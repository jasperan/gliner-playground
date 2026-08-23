"""Model zoo comparison: same NER task across the GLiNER family.

Shows that a bigger model isn't always needed — and that both the original
GLiNER line and the new GLiNER2 line share the zero-shot property.

Usage:
    uv run python examples/05_model_comparison.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))
sys.path.insert(0, str(_REPO_ROOT / "backend"))

import torch  # noqa: E402

from examples.common import banner, colorize, print_section, highlight_entities, pprint_entities  # noqa: E402

MODELS = [
    ("urchade/gliner_small-v2.1", "gliner", "~64M"),
    ("gliner-community/gliner_medium-v2.5", "gliner", "~169M"),
    ("urchade/gliner_multi-v2.1", "gliner", "~169M"),
    ("fastino/gliner2-base-v1", "gliner2", "205M"),
]

TEXT = "Sundar Pichai runs Alphabet and Google. The Pixel 9 was released in Mountain View, California."
LABELS = ["person", "company", "product", "location"]


def main() -> None:
    banner("Model comparison · same text, four models")

    results = []
    for model_id, family, params in MODELS:
        print_section(f"{model_id}  ({params})")
        if family == "gliner":
            from gliner import GLiNER
            m = GLiNER.from_pretrained(model_id)
            if torch.cuda.is_available():
                m = m.to("cuda")
            t0 = time.perf_counter()
            ents = m.predict_entities(TEXT, LABELS, threshold=0.5)
            dt = (time.perf_counter() - t0) * 1000
        else:
            from gliner2 import GLiNER2
            m = GLiNER2.from_pretrained(model_id)
            if torch.cuda.is_available():
                m = m.to("cuda")
            t0 = time.perf_counter()
            raw = m.extract_entities(TEXT, LABELS, threshold=0.5, include_confidence=True, include_spans=True)
            ents = [
                {"label": l, "text": h.get("text"), "confidence": h.get("confidence"), "start": h.get("start"), "end": h.get("end")}
                for l, hits in raw.get("entities", {}).items() for h in hits
            ]
            dt = (time.perf_counter() - t0) * 1000
        print(highlight_entities(TEXT, ents))
        print(colorize(f"  ⏱  {dt:.0f} ms · {len(ents)} entities", "yellow"))
        pprint_entities(ents)
        results.append((model_id, params, dt, len(ents)))

    print_section("Summary")
    print(f"{'model':<42} {'params':<8} {'latency':<10} {'entities'}")
    for model_id, params, dt, n in results:
        print(f"  {model_id:<40} {params:<8} {dt:<9.0f}ms {n}")


if __name__ == "__main__":
    main()