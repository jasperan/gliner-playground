"""Shared helpers for the GLiNER example scripts."""

from __future__ import annotations

import os
import sys
from typing import Any, Dict, List

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _REPO_ROOT)
sys.path.insert(0, os.path.join(_REPO_ROOT, "backend"))
C = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
    "red": "\033[31m",
    "green": "\033[32m",
    "yellow": "\033[33m",
    "blue": "\033[34m",
    "magenta": "\033[35m",
    "cyan": "\033[36m",
}

LABEL_COLORS = ["\033[36m", "\033[35m", "\033[33m", "\033[32m", "\033[34m", "\033[31m"]


def colorize(text: str, color: str) -> str:
    return f"{C.get(color, '')}{text}{C['reset']}"


def banner(title: str) -> None:
    print("\n" + colorize("=" * 68, "cyan"))
    print(colorize("  " + title, "bold") + colorize("", "cyan"))
    print(colorize("=" * 68, "cyan"))


def print_section(title: str) -> None:
    print("\n" + colorize("── " + title + " " + "─" * (60 - len(title)), "magenta"))


def highlight_entities(text: str, entities: List[Dict[str, Any]]) -> str:
    """Wrap found entities with ANSI colors by label so terminal demos pop."""
    entities = sorted(entities, key=lambda e: e.get("start", 0))
    out = []
    prev = 0
    color_map: Dict[str, str] = {}
    for e in entities:
        start, end = e.get("start"), e.get("end")
        if start is None or end is None:
            continue
        label = e["label"]
        if label not in color_map:
            color_map[label] = LABEL_COLORS[len(color_map) % len(LABEL_COLORS)]
        out.append(text[prev:start])
        out.append(f"{color_map[label]}[{text[start:end]}]{C['reset']}")
        prev = end
    out.append(text[prev:])
    return "".join(out)


def summary_key(entities: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    by_label: Dict[str, List[str]] = {}
    for e in entities:
        by_label.setdefault(e["label"], []).append(e["text"])
    return by_label


def pprint_entities(entities: List[Dict[str, Any]]) -> None:
    seen = set()
    for e in entities:
        key = (e["label"], e["text"])
        if key in seen:
            continue
        seen.add(key)
        conf = e.get("confidence", e.get("score", 0))
        bar = "█" * int(conf * 20)
        print(
            f"  {colorize(e['label'].ljust(16), 'cyan')} "
            f"{colorize(e['text'], 'bold')}  {colorize(f'{conf:.2f}', 'green')} {colorize(bar, 'green')}"
        )