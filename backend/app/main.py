"""GLiNER Playground — FastAPI inference backend.

Serves zero-shot information extraction across the GLiNER and GLiNER2 model
families: named entity recognition, text classification, structured JSON
extraction, and relation extraction — all through one normalized API.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .models import get_model, list_models, MODEL_CATALOG, ModelBackend

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class EntitiesRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20_000, description="Input text")
    labels: List[str] = Field(..., min_length=1, max_length=200, description="Entity types to search for")
    model: str = Field(MODEL_CATALOG["default"], description="Model identifier")
    threshold: float = Field(0.5, ge=0.0, le=1.0, description="Confidence threshold")
    include_spans: bool = True


class ClassifyRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20_000)
    tasks: Dict[str, List[str]] = Field(..., description="task -> candidate labels")
    model: str = Field(MODEL_CATALOG["default"])
    threshold: float = Field(0.5, ge=0.0, le=1.0)


class StructuredRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20_000)
    structures: Dict[str, List[str]] = Field(
        ..., description="structure name -> ['field::dtype::description', ...]"
    )
    model: str = Field(MODEL_CATALOG["default"])
    threshold: float = Field(0.5, ge=0.0, le=1.0)


class RelationsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20_000)
    relation_types: List[str] = Field(..., min_length=1, description="Relation types (e.g. works_for)")
    model: str = Field(MODEL_CATALOG["default"])
    threshold: float = Field(0.5, ge=0.0, le=1.0)


class CombinedRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20_000)
    model: str = Field(MODEL_CATALOG["default"])
    entities: Optional[Dict[str, str]] = None  # label -> description
    classifications: Optional[Dict[str, List[str]]] = None  # task -> labels
    structures: Optional[Dict[str, Dict[str, str]]] = None  # name -> field -> description
    relations: Optional[Dict[str, str]] = None  # relation -> description
    threshold: float = Field(0.5, ge=0.0, le=1.0)


class CompareRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20_000)
    labels: List[str] = Field(..., min_length=1)
    models: List[str] = Field(..., min_length=2, max_length=len(MODEL_CATALOG["models"]))
    threshold: float = Field(0.5, ge=0.0, le=1.0)


class BenchmarkRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20_000)
    labels: List[str] = Field(..., min_length=1)
    models: List[str] = Field(..., min_length=1, max_length=len(MODEL_CATALOG["models"]))
    iterations: int = Field(3, ge=1, le=20)
    threshold: float = Field(0.5, ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="GLiNER Playground API",
    description="Zero-shot information extraction with GLiNER and GLiNER2 — NER, "
                "classification, structured extraction and relations in one normalized API.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo backend; restrict in production
    allow_methods=["*"],
    allow_headers=["*"],
)

_lock = threading.Lock()


@app.get("/health")
def health() -> Dict[str, Any]:
    """Basic liveness probe."""
    import torch

    return {
        "status": "ok",
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "models": list(MODEL_CATALOG["models"].keys()),
    }


@app.get("/api/models")
def models() -> Dict[str, Any]:
    """Catalog of every model this backend can serve."""
    return {
        "default": MODEL_CATALOG["default"],
        "models": [
            {
                "id": mid,
                "family": info.family,
                "name": info.name,
                "params": info.params,
                "languages": info.languages,
                "tasks": list(info.tasks),
                "note": info.note,
            }
            for mid, info in MODEL_CATALOG["models"].items()
        ],
    }


def _require_gliner2(model: str) -> ModelBackend:
    """Load a model and fail if it can't do the requested task."""
    backend = get_model(model)
    if backend.family != "gliner2":
        raise HTTPException(
            status_code=422,
            detail=f"Model '{model}' (GLiNER family) only supports NER. Use a GLiNER2 model for this task.",
        )
    return backend


@app.post("/api/entities")
def extract_entities(req: EntitiesRequest) -> Dict[str, Any]:
    try:
        backend = get_model(req.model)
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    backend.ensure_loaded()
    t0 = time.perf_counter()

    if backend.family == "gliner2":
        raw = backend.model.extract_entities(
            req.text, req.labels, threshold=req.threshold,
            include_confidence=True, include_spans=req.include_spans, max_len=512,
        )
        entities = []
        for label, hits in raw.get("entities", {}).items():
            for h in hits:
                entities.append({
                    "label": label,
                    "text": h.get("text"),
                    "confidence": round(float(h.get("confidence", 0)), 6),
                    "start": h.get("start"),
                    "end": h.get("end"),
                })
    else:
        raw = backend.model.predict_entities(
            req.text, req.labels, threshold=req.threshold, flat_ner=True,
        )
        entities = [
            {
                "label": e["label"],
                "text": e["text"],
                "confidence": round(float(e["score"]), 6),
                "start": e.get("start"),
                "end": e.get("end"),
            }
            for e in raw
        ]

    return {
        "model": req.model,
        "family": backend.family,
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
        "entities": entities,
    }


@app.post("/api/classify")
def classify(req: ClassifyRequest) -> Dict[str, Any]:
    backend = _require_gliner2(req.model)
    backend.ensure_loaded()
    t0 = time.perf_counter()
    raw = backend.model.classify_text(
        req.text, req.tasks, threshold=req.threshold, include_confidence=True, max_len=512,
    )
    results = []
    for task, out in raw.items():
        if isinstance(out, dict) and "label" in out:
            results.append({
                "task": task,
                "label": out["label"],
                "confidence": round(float(out.get("confidence", 0)), 6),
            })
        elif isinstance(out, list):
            for o in out:
                results.append({
                    "task": task,
                    "label": o.get("label") if isinstance(o, dict) else o,
                    "confidence": round(float(o.get("confidence", 0)), 6) if isinstance(o, dict) else None,
                })
    return {
        "model": req.model,
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
        "classifications": results,
    }


@app.post("/api/structured")
def structured(req: StructuredRequest) -> Dict[str, Any]:
    backend = _require_gliner2(req.model)
    backend.ensure_loaded()
    t0 = time.perf_counter()
    raw = backend.model.extract_json(
        req.text, req.structures, threshold=req.threshold, include_confidence=True, max_len=512,
    )
    return {
        "model": req.model,
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
        "data": raw,
    }


@app.post("/api/relations")
def relations(req: RelationsRequest) -> Dict[str, Any]:
    backend = _require_gliner2(req.model)
    backend.ensure_loaded()
    t0 = time.perf_counter()
    raw = backend.model.extract_relations(
        req.text, req.relation_types, threshold=req.threshold,
        include_confidence=True, max_len=512,
    )
    # gliner2 wraps relation types under a 'relation_extraction' key
    relations_map = raw.get("relation_extraction", raw)
    out = []
    for rel, hits in relations_map.items():
        if not isinstance(hits, list):
            continue
        for h in hits:
            if isinstance(h, dict) and "head" in h:
                out.append({
                    "relation": rel,
                    "head": h["head"].get("text"),
                    "head_confidence": round(float(h["head"].get("confidence", 0)), 6),
                    "tail": h["tail"].get("text"),
                    "tail_confidence": round(float(h["tail"].get("confidence", 0)), 6),
                    "head_start": h["head"].get("start"),
                    "head_end": h["head"].get("end"),
                    "tail_start": h["tail"].get("start"),
                    "tail_end": h["tail"].get("end"),
                })
    return {
        "model": req.model,
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
        "relations": out,
    }


@app.post("/api/combined")
def combined(req: CombinedRequest) -> Dict[str, Any]:
    """Multi-task extraction: entities + classification + structured + relations
    in a single forward pass."""
    backend = _require_gliner2(req.model)
    backend.ensure_loaded()
    t0 = time.perf_counter()

    schema = backend.model.create_schema()
    if req.entities:
        schema = schema.entities(req.entities)
    if req.classifications:
        for task, labels in req.classifications.items():
            schema = schema.classification(task, labels)
    if req.structures:
        for name, fields in req.structures.items():
            sb = schema.structure(name)
            for fname, desc in fields.items():
                sb = sb.field(fname, dtype="str", description=desc)
            schema = sb
    if req.relations:
        schema = schema.relations(req.relations)

    raw = backend.model.extract(req.text, schema, threshold=req.threshold,
                                include_confidence=True, max_len=512)
    return {
        "model": req.model,
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
        "data": raw,
    }


@app.post("/api/compare")
def compare(req: CompareRequest) -> Dict[str, Any]:
    """Run the same NER task across several models, side by side."""
    rows = []
    for mid in req.models:
        backend = get_model(mid)
        backend.ensure_loaded()
        t0 = time.perf_counter()
        if backend.family == "gliner2":
            raw = backend.model.extract_entities(
                req.text, req.labels, threshold=req.threshold, include_confidence=True, max_len=512,
            )
            found = []
            for label, hits in raw.get("entities", {}).items():
                for h in hits:
                    found.append((label, h.get("text"), h.get("confidence"), h.get("start"), h.get("end")))
        else:
            raw = backend.model.predict_entities(req.text, req.labels, threshold=req.threshold, flat_ner=True)
            found = [(e["label"], e["text"], e["score"], e.get("start"), e.get("end")) for e in raw]
        rows.append({
            "model": mid,
            "family": backend.family,
            "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            "entities": [
                {"label": l, "text": t, "confidence": round(float(c), 6), "start": s, "end": e}
                for l, t, c, s, e in found
            ],
        })
    return {"results": rows}


@app.post("/api/benchmark")
def benchmark(req: BenchmarkRequest) -> Dict[str, Any]:
    """Latency benchmark across models (warm cache, then iterate)."""
    out = []
    for mid in req.models:
        backend = get_model(mid)
        backend.ensure_loaded()
        # warmup
        if backend.family == "gliner2":
            backend.model.extract_entities(req.text, req.labels, threshold=0.5, max_len=512)
        else:
            backend.model.predict_entities(req.text, req.labels, threshold=0.5)
        times = []
        for _ in range(req.iterations):
            t0 = time.perf_counter()
            if backend.family == "gliner2":
                backend.model.extract_entities(req.text, req.labels, threshold=req.threshold, max_len=512)
            else:
                backend.model.predict_entities(req.text, req.labels, threshold=req.threshold)
            times.append((time.perf_counter() - t0) * 1000)
        out.append({
            "model": mid,
            "family": backend.family,
            "min_ms": round(min(times), 2),
            "max_ms": round(max(times), 2),
            "avg_ms": round(sum(times) / len(times), 2),
            "samples": times,
        })
    return {"results": out}