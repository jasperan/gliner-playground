"""GLiNER Playground — FastAPI inference backend.

Serves zero-shot information extraction across the GLiNER and GLiNER2 model
families: named entity recognition, text classification, structured JSON
extraction, and relation extraction — all through one normalized API.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .models import MODEL_CATALOG, ModelBackend, get_model

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

_log = logging.getLogger("gliner.playground")

# CORS origins from env (comma-separated). Defaults are local-dev friendly; set
# GLINER_ALLOWED_ORIGINS to your deployed site origin(s) before public hosting.
_cors_origins = os.environ.get("GLINER_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3100,http://localhost:3200")
_allowed_origins = [o.strip() for o in _cors_origins.split(",") if o.strip()]

# The API is unauthenticated and every request costs a forward pass, so a wildcard
# allowlist lets any site it is loaded from drive this backend. It is not refused (a
# self-hosted deployment may mean it), but it is never silent.
if "*" in _allowed_origins:
    _log.warning(
        "GLINER_ALLOWED_ORIGINS contains '*': any web origin can call this inference API. "
        "Prefer explicit origins, and put TLS plus authentication in front before exposing it."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    # Credentials stay off: the API is unauthenticated and needs no cookies, and this
    # keeps the wildcard-with-credentials combination impossible by construction.
    allow_credentials=False,
)



@app.get("/health")
def health() -> Dict[str, Any]:
    """Basic liveness probe."""
    import torch

    from .models import _loaders

    return {
        "status": "ok",
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "models": list(MODEL_CATALOG["models"].keys()),
        "loaded": {mid: b.model is not None for mid, b in _loaders.items()},
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


def _resolve_model(model: str) -> ModelBackend:
    """Resolve a model id or fail with 422 (unknown id)."""
    try:
        return get_model(model)
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _require_gliner2(model: str) -> ModelBackend:
    """Resolve a model and fail if it can't do the requested task."""
    backend = _resolve_model(model)
    if backend.family != "gliner2":
        raise HTTPException(
            status_code=422,
            detail=f"Model '{model}' (GLiNER family) only supports NER. Use a GLiNER2 model for this task.",
        )
    return backend


@app.post("/api/entities")
def extract_entities(req: EntitiesRequest) -> Dict[str, Any]:
    backend = _resolve_model(req.model)
    backend.ensure_loaded()
    t0 = time.perf_counter()

    # Honest truncation signal: report when the input exceeds the 512-token
    # window the model actually sees, instead of silently dropping the tail.
    truncated = False
    try:
        tokenizer = getattr(getattr(backend.model, "processor", None), "tokenizer", None)
        if tokenizer is not None and req.text:
            truncated = len(tokenizer.encode(req.text, add_special_tokens=False)) > 512
    except Exception:  # pragma: no cover — tokenizer is best-effort
        truncated = False

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
        "truncated": truncated,
        "max_len": 512,
    }


class LongEntitiesRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=200_000, description="Long input text (chunked internally)")
    labels: List[str] = Field(..., min_length=1, max_length=200)
    model: str = Field(MODEL_CATALOG["default"])
    threshold: float = Field(0.5, ge=0.0, le=1.0)


@app.post("/api/entities-long")
def extract_entities_long(req: LongEntitiesRequest) -> Dict[str, Any]:
    """Chunked zero-shot NER for documents beyond the 512-token window.

    gliner2's released wheel (1.3.x) does not yet expose `extract_entities_long`,
    so we run a sliding window over the text and merge results here.
    Only GLiNER2 models are supported; GLiNER models get a 422 with a hint.
    """
    backend = _require_gliner2(req.model)
    backend.ensure_loaded()

    # Chunk on ~2000-char windows with ~250-char overlap at sentence breaks so
    # entities at chunk edges are seen twice (merged below). Each chunk records
    # its base offset so merged entities carry DOCUMENT-space coordinates.
    window, overlap = 2000, 250
    chunks: List[tuple] = []  # (text, base_offset)
    if len(req.text) <= window:
        chunks = [(req.text, 0)]
    else:
        start = 0
        while start < len(req.text):
            end = min(start + window, len(req.text))
            if end < len(req.text):
                # back off to the last sentence boundary in the window
                cut = req.text.rfind(". ", start + overlap, end)
                if cut > start:
                    end = cut + 1
            chunks.append((req.text[start:end], start))
            start = end - overlap if end < len(req.text) else len(req.text)

    t0 = time.perf_counter()
    merged: Dict[tuple, Dict[str, Any]] = {}
    for chunk_idx, (chunk, base) in enumerate(chunks):
        raw = backend.model.extract_entities(
            chunk, req.labels, threshold=req.threshold,
            include_confidence=True, include_spans=True, max_len=512,
        )
        for label, hits in raw.get("entities", {}).items():
            for h in hits:
                start = h.get("start")
                end = h.get("end")
                # translate chunk-relative offsets to document space
                doc_start = (start + base) if start is not None else None
                doc_end = (end + base) if end is not None else None
                key = (label, h.get("text"))
                if key not in merged or h.get("confidence", 0) > merged[key]["confidence"]:
                    merged[key] = {
                        "label": label,
                        "text": h.get("text"),
                        "confidence": round(float(h.get("confidence", 0)), 6),
                        "start": doc_start,
                        "end": doc_end,
                        "chunk_index": chunk_idx,
                    }

    return {
        "model": req.model,
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
        "entities": list(merged.values()),
        "chunked": len(chunks) > 1,
        "chunks": len(chunks),
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
            if isinstance(h, dict) and isinstance(h.get("head"), dict) and isinstance(h.get("tail"), dict):
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
        backend = _resolve_model(mid)
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
        backend = _resolve_model(mid)
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

@app.exception_handler(KeyError)
async def key_error_handler(request, exc: KeyError):
    """Unknown model ids surface as 422; genuine model bugs get logged."""
    message = str(exc)
    if message.startswith("Unknown model"):
        return JSONResponse(status_code=422, content={"detail": message})
    _log.exception("KeyError on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.exception_handler(Exception)
async def unhandled_handler(request, exc: Exception):
    """Log unhandled inference errors instead of swallowing them silently."""
    _log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
