"""Run zero-shot NER with the original GLiNER family (small / medium / multi).

Usage:
    uv run python examples/01_zero_shot_ner.py [--model urchade/gliner_small-v2.1]
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))
sys.path.insert(0, str(_REPO_ROOT / "backend"))

from gliner import GLiNER  # noqa: E402

import torch  # noqa: E402

from examples.common import (  # noqa: E402
    banner,
    highlight_entities,
    colorize,
    pprint_entities,
    print_section,
)

SAMPLE_TEXT = (
    "Elon Musk founded SpaceX in 2002 and Tesla in 2003. Tim Cook is the CEO of Apple, "
    "which is headquartered in Cupertino, California. J.K. Rowling wrote the Harry Potter "
    "series, published by Bloomsbury in London."
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Zero-shot NER with GLiNER")
    parser.add_argument("--model", default="urchade/gliner_small-v2.1")
    parser.add_argument("--text", default=SAMPLE_TEXT)
    parser.add_argument("--labels", nargs="+", default=["person", "company", "product", "location", "book"])
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    banner(f"Zero-shot NER · {args.model} · {args.device}")
    print(colorize("Text: ", "dim") + args.text[:180] + ("…" if len(args.text) > 180 else ""))
    print(colorize("Entity types: ", "dim") + ", ".join(args.labels))

    print_section("Loading model")
    t0 = time.perf_counter()
    model = GLiNER.from_pretrained(args.model)
    if args.device == "cuda":
        model = model.to("cuda")
    print(colorize(f"  loaded in {time.perf_counter()-t0:.1f}s", "green"))

    print_section("Inference")
    t0 = time.perf_counter()
    entities = model.predict_entities(args.text, args.labels, threshold=args.threshold)
    dt = (time.perf_counter() - t0) * 1000

    print(highlight_entities(args.text, entities))
    print(colorize(f"\n  ⏱  {dt:.0f} ms  ·  {len(entities)} entities found", "yellow"))
    print_section("Extracted entities")
    pprint_entities(entities)


if __name__ == "__main__":
    main()