"""GLiNER2 multi-task: classification + structured extraction in one model.

GLiNER2 runs four tasks — NER, text classification, structured JSON extraction,
and relation extraction — through a single schema-driven interface.

Usage:
    uv run python examples/03_gliner2_multi_task.py
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

SAMPLES = [
    {
        "name": "Product review → sentiment + structured specs",
        "text": "The iPhone 15 Pro is fantastic — the 6.1-inch titanium design weighs only 187g "
                "and costs $999. Battery life is a little short though.",
        "schema": {
            "entities": {"product": "Product name", "brand": "Brand name"},
            "classifications": {"sentiment": ["positive", "negative", "neutral"]},
            "structures": {"review": {"model": "Model name", "weight": "Weight in grams", "price": "Price in dollars", "screen_size": "Screen diagonal"}},
        },
    },
    {
        "name": "Contact card → extracted fields + relations",
        "text": "You can reach Dr. Emily Carter at emily@fastino.ai or +33 6 12 34 56 78. "
                "She works for Fastino Labs in Paris.",
        "schema": {
            "entities": {"person": "Person name", "company": "Organization name", "location": "Location"},
            "relations": {"works_for": "head works for tail"},
            "structures": {"contact": {"email": "Email address", "phone": "Phone number"}},
        },
    },
]


def main() -> None:
    banner("GLiNER2 multi-task · one model, four tasks")

    from gliner2 import GLiNER2

    t0 = time.perf_counter()
    model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
    if torch.cuda.is_available():
        model = model.to("cuda")
    print(colorize(f"  model loaded in {time.perf_counter()-t0:.1f}s", "green"))

    for sample in SAMPLES:
        print_section(sample["name"])
        print(colorize("  " + sample["text"], "dim"))

        schema = model.create_schema()
        ent = sample["schema"].get("entities")
        if ent:
            schema = schema.entities(ent)
        for task, labels in sample["schema"].get("classifications", {}).items():
            schema = schema.classification(task, labels)
        for rel, desc in sample["schema"].get("relations", {}).items():
            schema = schema.relations({rel: desc})
        for sname, fields in sample["schema"].get("structures", {}).items():
            sb = schema.structure(sname)
            for fname, desc in fields.items():
                sb = sb.field(fname, dtype="str", description=desc)
            schema = sb

        t0 = time.perf_counter()
        result = model.extract(sample["text"], schema, threshold=0.5, include_confidence=True)
        dt = (time.perf_counter() - t0) * 1000
        print(colorize(f"  ⏱  {dt:.0f} ms", "yellow"))
        print(json.dumps(result, indent=2)[:2000])


if __name__ == "__main__":
    main()