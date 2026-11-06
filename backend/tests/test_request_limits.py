"""Request-bound regressions: one unauthenticated caller cannot pick its own payload size.

Every case here is rejected during validation or at the transport, before any model is loaded.
"""

import json

import pytest

from app import main as app_main
from app.main import (
    MAX_LABELS,
    MAX_LONG_TEXT_CHARS,
    MAX_MAP_ENTRIES,
    MAX_TEXT_CHARS,
    MAX_CHUNKS,
)


def _oversized_body(padding: int = 5_000_000) -> bytes:
    payload = json.dumps({"text": "hi", "relation_types": ["works_for"]}).encode()
    return payload[:-1] + b',"pad":"' + b"x" * padding + b'"}'


def test_oversized_declared_body_is_refused(client):
    response = client.post(
        "/api/relations",
        content=_oversized_body(),
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 413


def test_oversized_chunked_body_is_refused(client):
    body = _oversized_body()

    def chunks():
        yield body[:500_000]
        yield body[500_000:]

    response = client.post(
        "/api/relations", content=chunks(), headers={"content-type": "application/json"}
    )
    assert response.status_code == 413


def test_documented_maximum_document_still_reaches_the_handler(client):
    """The size gate must not cut the documented 200,000-character document surface."""
    response = client.post(
        "/api/entities-long",
        json={"text": "s" * MAX_LONG_TEXT_CHARS, "labels": ["person"], "model": "does/not-exist"},
    )
    assert response.status_code == 422  # unknown model, i.e. the body was accepted


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/api/entities", {"text": "hi", "labels": ["L" * 1_000]}),
        ("/api/entities", {"text": "hi", "labels": [f"l{i}" for i in range(MAX_LABELS + 1)]}),
        ("/api/classify", {"text": "hi", "tasks": {"T" * 1_000: ["x"]}}),
        ("/api/classify", {"text": "hi", "tasks": {f"t{i}": ["a"] for i in range(MAX_MAP_ENTRIES + 1)}}),
        ("/api/structured", {"text": "hi", "structures": {"s": ["f::str::" + "d" * 1_000]}}),
        ("/api/relations", {"text": "hi", "relation_types": ["R" * 1_000]}),
        ("/api/relations", {"text": "hi", "relation_types": [f"r{i}" for i in range(MAX_LABELS + 1)]}),
        ("/api/combined", {"text": "hi", "entities": {"E" * 1_000: "d"}}),
        ("/api/combined", {"text": "hi", "entities": {f"e{i}": "d" for i in range(MAX_MAP_ENTRIES + 1)}}),
        ("/api/combined", {"text": "hi", "relations": {"r": "d" * 5_000}}),
        ("/api/combined", {"text": "hi", "structures": {f"s{i}": {"f": "d"} for i in range(MAX_MAP_ENTRIES + 1)}}),
        ("/api/entities", {"text": "a" * (MAX_TEXT_CHARS + 1), "labels": ["person"]}),
    ],
)
def test_unbounded_fields_are_rejected(client, path, body):
    assert client.post(path, json=body).status_code == 422


def test_duplicate_model_ids_are_rejected(client):
    duplicated = ["fastino/gliner2-base-v1", "fastino/gliner2-base-v1"]
    for path in ("/api/compare", "/api/benchmark"):
        response = client.post(path, json={"text": "hi", "labels": ["p"], "models": duplicated})
        assert response.status_code == 422, path


def test_chunk_cap_covers_the_documented_text_bound():
    """Raising the text bound without raising the chunk cap must fail here, not in production."""
    window, overlap = 2000, 250
    worst_case_chunks = -(-MAX_LONG_TEXT_CHARS // (window - overlap))
    assert worst_case_chunks <= MAX_CHUNKS


def test_chunk_cap_is_enforced(client, monkeypatch):
    monkeypatch.setattr(app_main, "MAX_CHUNKS", 1)
    response = client.post(
        "/api/entities-long", json={"text": "s" * 5_000, "labels": ["person"]}
    )
    assert response.status_code == 413
