"""Real-world use case: PII redaction in customer support messages.

A chat agent that receives free-text messages needs to strip emails, phone
numbers and names before routing to third-party tools. GLiNER does this with
zero training — just the entity types.

Usage:
    uv run python examples/04_pii_redaction.py
"""

from __future__ import annotations

import re
import sys
import time
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))
sys.path.insert(0, str(_REPO_ROOT / "backend"))

import torch  # noqa: E402

from examples.common import banner, colorize, print_section  # noqa: E402

MESSAGES = [
    "Hi, my order #48291 hasn't arrived. Please contact me at john.doe@gmail.com or 555-0192.",
    "Invoice for Acme Corp, attention Anna Smith, total $1,240. Pay to billing@acme.com.",
    "I'd like a refund. My account is sarah.k@hotmail.fr. Call me on 06 12 34 56 78.",
]

PII_TYPES = ["email_address", "phone_number", "person_name", "order_number"]


def redact(text: str, entities) -> str:
    """Replace each found entity span with a label placeholder."""
    spans = sorted(
        [(e.get("start"), e.get("end"), e["label"]) for e in entities if e.get("start") is not None],
        key=lambda s: s[0], reverse=True,
    )
    out = text
    for start, end, label in spans:
        out = out[:start] + f"«{label.upper()}»" + out[end:]
    return out


def main() -> None:
    banner("PII redaction · GLiNER2 on raw customer messages")

    from gliner2 import GLiNER2

    model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
    if torch.cuda.is_available():
        model = model.to("cuda")
    print(colorize("  entity types: " + ", ".join(PII_TYPES), "dim"))
    print(colorize("  (zero training — labels defined here, at inference time)", "green"))

    for msg in MESSAGES:
        print_section("Incoming message")
        print(colorize("  " + msg, "dim"))
        t0 = time.perf_counter()
        raw = model.extract_entities(msg, PII_TYPES, threshold=0.5, include_confidence=True, include_spans=True)
        dt = (time.perf_counter() - t0) * 1000
        entities = [
            {"label": l, "text": h.get("text"), "confidence": h.get("confidence"), "start": h.get("start"), "end": h.get("end")}
            for l, hits in raw.get("entities", {}).items() for h in hits
        ]
        print(colorize(f"  ⏱  {dt:.0f} ms\n", "yellow") + redact(msg, entities))
        conf_str = ", ".join(f"{e['label']}={e['confidence']:.2f}" for e in entities)
        print(colorize("  → " + conf_str, "cyan") if entities else colorize("  → no PII found", "cyan"))


if __name__ == "__main__":
    main()