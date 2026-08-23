"""API-level tests for the GLiNER Playground backend."""

TEXT = (
    "Apple CEO Tim Cook announced the iPhone 15 in Cupertino, California "
    "on September 12, 2023."
)


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["device"] in ("cuda", "cpu")
    assert "fastino/gliner2-base-v1" in body["models"]


def test_models_catalog(client):
    r = client.get("/api/models")
    assert r.status_code == 200
    body = r.json()
    mids = [m["id"] for m in body["models"]]
    assert "fastino/gliner2-base-v1" in mids
    assert "urchade/gliner_small-v2.1" in mids
    gliner2 = next(m for m in body["models"] if m["id"] == "fastino/gliner2-base-v1")
    assert set(gliner2["tasks"]) >= {"ner", "classification", "structured", "relations"}


def test_entities_gliner2(client):
    r = client.post(
        "/api/entities",
        json={
            "text": TEXT,
            "labels": ["company", "person", "product", "location"],
            "model": "fastino/gliner2-base-v1",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["model"] == "fastino/gliner2-base-v1"
    found = {(e["label"], e["text"]) for e in body["entities"]}
    assert ("person", "Tim Cook") in found
    assert ("company", "Apple") in found
    assert ("product", "iPhone 15") in found
    assert all(0 <= e["confidence"] <= 1 for e in body["entities"])
    assert "latency_ms" in body


def test_entities_gliner_small(client):
    r = client.post(
        "/api/entities",
        json={
            "text": TEXT,
            "labels": ["company", "person", "location"],
            "model": "urchade/gliner_small-v2.1",
            "threshold": 0.4,
        },
    )
    assert r.status_code == 200
    body = r.json()
    found = {(e["label"], e["text"]) for e in body["entities"]}
    assert ("person", "Tim Cook") in found
    assert ("company", "Apple") in found


def test_entities_high_threshold_filters(client):
    """At threshold 0.99, low-confidence hits disappear (or confidence is capped)."""
    r = client.post(
        "/api/entities",
        json={
            "text": TEXT,
            "labels": ["company", "person", "product", "location"],
            "model": "fastino/gliner2-base-v1",
            "threshold": 0.99,
        },
    )
    assert r.status_code == 200
    for e in r.json()["entities"]:
        assert e["confidence"] >= 0.99


def test_classify(client):
    r = client.post(
        "/api/classify",
        json={
            "text": "This laptop has amazing performance but terrible battery life!",
            "tasks": {"sentiment": ["positive", "negative", "neutral"]},
        },
    )
    assert r.status_code == 200
    body = r.json()
    cls = {c["task"]: c for c in body["classifications"]}
    assert cls["sentiment"]["label"] in ("positive", "negative", "neutral")
    assert cls["sentiment"]["confidence"] > 0.5


def test_structured(client):
    r = client.post(
        "/api/structured",
        json={
            "text": "iPhone 15 Pro Max with 256GB storage, priced at $1199.",
            "structures": {
                "product": [
                    "name::str::Product name and model",
                    "storage::str::Storage size",
                    "price::str::Retail price",
                ]
            },
        },
    )
    assert r.status_code == 200
    data = r.json()["data"]
    prod = data["product"][0]
    assert prod["name"]["text"] == "iPhone 15 Pro Max"
    assert prod["price"]["text"] == "$1199"


def test_relations(client):
    r = client.post(
        "/api/relations",
        json={
            "text": "John works for Apple Inc. and lives in San Francisco.",
            "relation_types": ["works_for", "lives_in"],
        },
    )
    assert r.status_code == 200
    rels = r.json()["relations"]
    assert len(rels) == 2
    by_rel = {rel["relation"]: rel for rel in rels}
    assert by_rel["works_for"]["head"] == "John"
    assert by_rel["works_for"]["tail"] == "Apple Inc."
    assert by_rel["lives_in"]["tail"] == "San Francisco"


def test_combined_multitask(client):
    r = client.post(
        "/api/combined",
        json={
            "text": "Glad I could reach Sarah at sarah@acme.io or 555-1234. "
                    "Sarah works for Acme Corp, which is doing great!",
            "entities": {"person": "Names of people", "company": "Organizations"},
            "classifications": {"sentiment": ["positive", "negative", "neutral"]},
            "structures": {"contact": {"email": "Email address", "phone": "Phone number"}},
            "relations": {"works_for": "head works for tail"},
        },
    )
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["sentiment"]["label"] == "positive"
    assert data["contact"][0]["email"]["text"] == "sarah@acme.io"
    assert data["entities"]["person"][0]["text"] == "Sarah"


def test_gliner_family_rejects_non_ner(client):
    r = client.post(
        "/api/classify",
        json={
            "text": "hello world",
            "tasks": {"t": ["a", "b"]},
            "model": "urchade/gliner_small-v2.1",
        },
    )
    assert r.status_code == 422


def test_compare_models(client):
    r = client.post(
        "/api/compare",
        json={
            "text": "Elon Musk founded SpaceX in 2002.",
            "labels": ["person", "company"],
            "models": ["urchade/gliner_small-v2.1", "fastino/gliner2-base-v1"],
        },
    )
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 2
    for row in results:
        found = {(e["label"], e["text"]) for e in row["entities"]}
        assert ("person", "Elon Musk") in found


def test_benchmark(client):
    r = client.post(
        "/api/benchmark",
        json={
            "text": "Elon Musk founded SpaceX in 2002.",
            "labels": ["person", "company"],
            "models": ["fastino/gliner2-base-v1"],
            "iterations": 2,
        },
    )
    assert r.status_code == 200
    row = r.json()["results"][0]
    assert row["model"] == "fastino/gliner2-base-v1"
    assert row["avg_ms"] > 0
    assert len(row["samples"]) == 2


def test_unknown_model_422(client):
    r = client.post(
        "/api/entities",
        json={"text": "hi", "labels": ["x"], "model": "does/not-exist"},
    )
    assert r.status_code == 422