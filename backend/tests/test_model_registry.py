"""Model-registry residency regressions.

The registry is process-global; the default keeps every resolved model resident so the
documented five-model comparison stays warm, and `GLINER_MAX_LOADED_MODELS` bounds it.
"""

import pytest

from app import models


def _catalog_ids():
    return list(models.MODEL_CATALOG["models"].keys())


@pytest.fixture
def fresh_registry(monkeypatch):
    monkeypatch.setattr(models, "_loaders", {})
    return models._loaders


def test_residency_is_unbounded_by_default(monkeypatch, fresh_registry):
    monkeypatch.delenv("GLINER_MAX_LOADED_MODELS", raising=False)
    for model_id in _catalog_ids():
        models.get_model(model_id)
    assert len(fresh_registry) == len(_catalog_ids())


def test_residency_ceiling_evicts_the_least_recently_resolved_model(monkeypatch, fresh_registry):
    ids = _catalog_ids()
    monkeypatch.setenv("GLINER_MAX_LOADED_MODELS", "2")
    for model_id in ids:
        models.get_model(model_id)
    assert list(fresh_registry) == ids[-2:]


def test_ceiling_is_ignored_when_it_is_not_a_positive_integer(monkeypatch, fresh_registry):
    for value in ("", "0", "-3", "not-a-number"):
        monkeypatch.setenv("GLINER_MAX_LOADED_MODELS", value)
        assert models.max_loaded_models() == 0


def test_unload_drops_the_weights_reference():
    backend = models.ModelBackend(_catalog_ids()[0])
    backend.model = object()
    backend.unload()
    assert backend.model is None
