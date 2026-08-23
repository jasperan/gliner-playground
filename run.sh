#!/usr/bin/env bash
# Convenience runner for the GLiNER Playground.
# Usage:
#   ./run.sh backend          start the FastAPI inference API (port 8000)
#   ./run.sh dev              start the Next.js dev server (port 3200)
#   ./run.sh tests            run the pytest suite
#   ./run.sh examples         list the CLI examples
#   ./run.sh build            static-export the site into site/out
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${1:-help}" in
  backend)
    echo "◆ Starting GLiNER inference API on http://0.0.0.0:8000 …"
    cd "$ROOT/backend"
    HF_HOME="${HF_HOME:-$ROOT/backend/models_cache}" uv run python __run__.py
    ;;
  dev)
    echo "◆ Starting Next.js dev server on http://localhost:3200 (API at localhost:8000) …"
    cd "$ROOT/site"
    npm run dev
    ;;
  tests)
    cd "$ROOT/backend"
    HF_HOME="${HF_HOME:-$ROOT/backend/models_cache}" uv run pytest tests/ -q
    ;;
  build)
    cd "$ROOT/site"
    npm run build
    echo "◆ Static export written to site/out — serve with: npx serve out -l 3100"
    ;;
  examples)
    echo "Run any example with:  uv run --project backend python examples/<file>.py"
    ls "$ROOT/examples"/*.py | sed 's|.*/||'
    ;;
  install)
    cd "$ROOT/backend" && uv sync
    cd "$ROOT/site" && npm install
    echo "◆ Dependencies ready."
    ;;
  *)
    echo "GLiNER Playground — usage: ./run.sh {backend|dev|tests|build|examples|install}"
    ;;
esac