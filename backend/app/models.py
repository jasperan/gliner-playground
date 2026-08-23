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

_devices: Dict[str, torch.device] = {}


@dataclasses.dataclass
class ModelInfo:
    id: str
    family: str  # "gliner" | "gliner2"
    name: str
    params: Optional[str]
    languages: List[str]
    tasks: Tuple[str, ...]
    note: str = ""


MODEL_CATALOG: Dict[str, object] = {
    "default": "fastino/gliner2-base-v1",
    "models": {
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
    },
}


def _device(model_id: str) -> torch.device:
    if model_id not in _devices:
        _devices[model_id] = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return _devices[model_id]


class ModelBackend:
    """Wrapper holding a loaded model plus catalog metadata."""

    def __init__(self, model_id: str):
        self.model_id = model_id
        self.info = MODEL_CATALOG["models"][model_id]
        self.model = None
        self._lock = threading.Lock()

    @property
    def family(self) -> str:
        return self.info.family

    def ensure_loaded(self):
        if self.model is not None:
            return
        with self._lock:
            if self.model is not None:
                return
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

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ModelBackend {self.model_id} loaded={self.model is not None}>"


_loaders: Dict[str, ModelBackend] = {}
_loaders_lock = threading.Lock()


def get_model(model_id: str) -> ModelBackend:
    if model_id not in MODEL_CATALOG["models"]:
        raise KeyError(f"Unknown model '{model_id}'")
    with _loaders_lock:
        if model_id not in _loaders:
            _loaders[model_id] = ModelBackend(model_id)
        return _loaders[model_id]


def list_models() -> List[Dict[str, str]]:
    return [
        {"id": k, "family": v.family, "name": v.name, "params": v.params or "?"}
        for k, v in MODEL_CATALOG["models"].items()
    ]