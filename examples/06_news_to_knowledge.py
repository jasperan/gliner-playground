"""End-to-end: build a structured knowledge base from raw news text with GLiNER2.

Combines entity extraction, classification, structured fields and relations to
turn a free-text article into queryable JSON — the shape of a real RAG/analytics
pipeline before any database or vector store is involved.

Usage:
    uv run python examples/06_news_to_knowledge.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))
sys.path.insert(0, str(_REPO_ROOT / "backend"))

import torch  # noqa: E402

from examples.common import banner, colorize, print_section  # noqa: E402

ARTICLE = (
    "OpenAI announced a $40 billion funding round led by SoftBank. CEO Sam Altman said the "
    "capital will accelerate AGI research at the company's San Francisco headquarters. "
    "Microsoft, a major partner, will continue its cloud collaboration. Analysts at Morgan "
    "Stanley praised the deal, calling it the largest private investment in AI history. "
    "Meanwhile, Google, which is still reportedly seeking to invest a further $30 billion "
    "into its rival Anthropic, faces renewed antitrust scrutiny in Brussels."
)


def main() -> None:
    banner("News → structured knowledge · GLiNER2 single pass")

    from gliner2 import GLiNER2

    model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
    if torch.cuda.is_available():
        model = model.to("cuda")
    print(colorize("  input: 4-sentence news article", "dim"))

    schema = (
        model.create_schema()
        .entities({
            "company": "Companies and organizations",
            "person": "People mentioned",
            "city": "Cities or locations",
            "amount": "Monetary amounts or funding sums",
        })
        .classification("industry", ["AI", "finance", "cloud", "regulation"])
        .relations({"invested_in": "head invested in tail"})
    )
    schema = (
        schema.structure("deal")
        .field("amount", dtype="str", description="Total deal size")
        .field("lead_investor", dtype="str", description="Lead investor name")
        .field("target", dtype="str", description="Company receiving the investment")
    )

    t0 = time.perf_counter()
    result = model.extract(ARTICLE, schema, threshold=0.4, include_confidence=True)
    dt = (time.perf_counter() - t0) * 1000
    print(colorize(f"  ⏱  {dt:.0f} ms for all tasks in one forward pass\n", "yellow"))

    print(json.dumps(result, indent=2)[:3000])

    print_section("What a downstream app could use")
    ents = result.get("entities", {})
    print(colorize("  → fundable entities: " + ", ".join(
        t for ts in ents.values() for t in [x["text"] for x in ts])[:160], "cyan"))


if __name__ == "__main__":
    main()