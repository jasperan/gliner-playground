"""Multilingual zero-shot NER: the same sentence in many languages.

GLiNER Multi and GLiNER2 Multi accept entity types in the local language —
no translation pipeline needed, no training data per language.

Usage:
    uv run python examples/02_multilingual.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))
sys.path.insert(0, str(_REPO_ROOT / "backend"))

import torch  # noqa: E402

from examples.common import banner, colorize, print_section, pprint_entities, highlight_entities  # noqa: E402

# (language, sentence saying: "Apple CEO Tim Cook announced the iPhone 15 in Cupertino", labels)
SAMPLES = [
    ("English", "Apple CEO Tim Cook announced the iPhone 15 in Cupertino.",
     ["company", "person", "product", "location"]),
    ("Français", "Le PDG d'Apple, Tim Cook, a annoncé l'iPhone 15 à Cupertino.",
     ["entreprise", "personne", "produit", "lieu"]),
    ("Español", "El CEO de Apple, Tim Cook, anunció el iPhone 15 en Cupertino.",
     ["empresa", "persona", "producto", "ubicación"]),
    ("Deutsch", "Apple-CEO Tim Cook kündigte das iPhone 15 in Cupertino an.",
     ["Unternehmen", "Person", "Produkt", "Ort"]),
    ("Italiano", "Il CEO di Apple, Tim Cook, ha annunciato l'iPhone 15 a Cupertino.",
     ["azienda", "persona", "prodotto", "luogo"]),
    ("Português", "O CEO da Apple, Tim Cook, anunciou o iPhone 15 em Cupertino.",
     ["empresa", "pessoa", "produto", "local"]),
]


def main() -> None:
    banner("Multilingual zero-shot NER · fastino/gliner2-multi-v1")

    from gliner2 import GLiNER2

    t0 = time.perf_counter()
    model = GLiNER2.from_pretrained("fastino/gliner2-multi-v1")
    if torch.cuda.is_available():
        model = model.to("cuda")
    print(colorize(f"  model loaded in {time.perf_counter()-t0:.1f}s", "green"))

    for lang, text, labels in SAMPLES:
        print_section(lang)
        t0 = time.perf_counter()
        raw = model.extract_entities(text, labels, threshold=0.4, include_confidence=True, include_spans=True)
        dt = (time.perf_counter() - t0) * 1000
        entities = [
            {"label": label, "text": h.get("text"), "confidence": h.get("confidence"), "start": h.get("start"), "end": h.get("end")}
            for label, hits in raw.get("entities", {}).items()
            for h in hits
        ]
        print(colorize("  " + text, "dim"))
        print(highlight_entities(text, entities))
        print(colorize(f"  ⏱  {dt:.0f} ms  ·  {len(entities)} entities", "yellow"))
        pprint_entities(entities)


if __name__ == "__main__":
    main()