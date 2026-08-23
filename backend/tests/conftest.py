"""Shared test fixtures — a FastAPI TestClient with the catalog preloaded."""

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Make sure the backend package is importable regardless of CWD.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault(
    "HF_HOME",
    str(Path(__file__).resolve().parents[1] / "models_cache"),
)

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def cached_model_id() -> str:
    """The default GLiNER2 model; on CI this runs CPU but the demo is identical."""
    return "fastino/gliner2-base-v1"