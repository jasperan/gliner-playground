"""Model registry — lazy-loads GLiNER / GLiNER2 models with GPU preference."""

from __future__ import annotations

import dataclasses
import os
import threading
from typing import Dict, List, Optional, Tuple

import torch

HF_HOME = os.environ.get(
    "HF_HOME",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models_cache"),
)
os.environ.setdefault("HF_HOME", HF_HOME)


@dataclasses.dataclass
class ModelInfo:
    id: str
    family: str  # "gliner" | "gliner2"
    name: str
    params: Optional[str]
    languages: List[str]
    tasks: Tuple[str, ...]
    note: str = ""


_MODELS: Dict[str, ModelInfo] = {
    "urchade/gliner_small-v2.1": ModelInfo(
        id="urchade/gliner_small-v2.1",
        family="gliner",
        name="GLiNER Small v2.1",
        params="~64M",
        languages=["en"],
        tasks=("ner",),
        note="Original GLiNER, tiny and fast.",
    ),
    "gliner-community/gliner_medium-v2.5": ModelInfo(
        id="gliner-community/gliner_medium-v2.5",
        family="gliner",
        name="GLiNER Medium v2.5",
        params="~169M",
        languages=["en"],
        tasks=("ner",),
        note="Better accuracy, still CPU-friendly.",
    ),
    "urchade/gliner_multi-v2.1": ModelInfo(
        id="urchade/gliner_multi-v2.1",
        family="gliner",
        name="GLiNER Multi v2.1",
        params="~169M",
        languages=["en", "fr", "es", "de", "it", "pt", "zh", "ar", "ru", "ja", "ko", "hi", "nl"],
        tasks=("ner",),
        note="Multilingual zero-shot NER.",
    ),
    "fastino/gliner2-base-v1": ModelInfo(
        id="fastino/gliner2-base-v1",
        family="gliner2",
        name="GLiNER2 Base v1",
        params="205M",
        languages=["en"],
        tasks=("ner", "classification", "structured", "relations"),
        note="Fastino's unified multi-task model.",
    ),
    "fastino/gliner2-multi-v1": ModelInfo(
        id="fastino/gliner2-multi-v1",
        family="gliner2",
        name="GLiNER2 Multi v1",
        params="205M",
        languages=["fr", "en", "es", "de", "it", "pt"],
        tasks=("ner", "classification", "structured", "relations"),
        note="Multilingual multi-task (6 languages).",
    ),
}

MODEL_CATALOG: Dict[str, object] = {
    "default": "fastino/gliner2-base-v1",
    "models": _MODELS,
}


class ModelBackend:
    """Wrapper holding a loaded model plus catalog metadata."""

    def __init__(self, model_id: str):
        self.model_id = model_id
        self.info = _MODELS[model_id]
        self.model = None
        self._lock = threading.Lock()

    @property
    def family(self) -> str:
        return self.info.family

    def ensure_loaded(self):
        """Return the loaded model, loading it on first use.

        Returning the object (instead of only setting `self.model`) lets a caller hold its own
        reference, so an eviction elsewhere in the registry cannot pull the weights out from
        under an in-flight request.
        """
        model = self.model
        if model is not None:
            return model
        with self._lock:
            if self.model is not None:
                return self.model
            if self.family == "gliner":
                from gliner import GLiNER

                m = GLiNER.from_pretrained(self.model_id)
                if torch.cuda.is_available():
                    m = m.to("cuda")
                self.model = m
            else:
                from gliner2 import GLiNER2

                m = GLiNER2.from_pretrained(self.model_id)
                if torch.cuda.is_available():
                    m = m.to("cuda")
                self.model = m
            return self.model

    def unload(self) -> None:
        """Drop the loaded weights so the next ensure_loaded reloads them."""
        with self._lock:
            self.model = None

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ModelBackend {self.model_id} loaded={self.model is not None}>"


_loaders: Dict[str, ModelBackend] = {}
_loaders_lock = threading.Lock()


def max_loaded_models() -> int:
    """Resident-model ceiling from `GLINER_MAX_LOADED_MODELS`; 0 (the default) means no ceiling.

    With no ceiling every model that has been loaded stays resident for the process lifetime,
    which keeps the documented five-model `/api/compare` warm but pins the whole catalog in
    memory. On a shared or memory-tight device an operator can set this to bound the footprint;
    the least recently resolved model is unloaded when the ceiling is crossed.
    """
    raw = os.environ.get("GLINER_MAX_LOADED_MODELS")
    if not raw:
        return 0
    try:
        value = int(raw)
    except ValueError:
        return 0
    return max(0, value)


def get_model(model_id: str) -> ModelBackend:
    if model_id not in _MODELS:
        raise KeyError(f"Unknown model '{model_id}'")
    with _loaders_lock:
        backend = _loaders.pop(model_id, None) or ModelBackend(model_id)
        # Re-inserting keeps _loaders ordered from least to most recently resolved.
        _loaders[model_id] = backend
        ceiling = max_loaded_models()
        while ceiling and len(_loaders) > ceiling:
            oldest_id = next(iter(_loaders))
            _loaders.pop(oldest_id).unload()
        return backend