# Security notes

This repository is a **demo**. It is not hardened for public production use as-is;
treat the following as the minimum before exposing the API beyond a trusted network.

## Backend (FastAPI)

- **CORS**: `backend/app/main.py` currently sets `allow_origins=["*"]` so the static
  GitHub Pages site can call it from anywhere. Before public use, replace with the
  explicit list of origins that should be allowed, e.g.
  `allow_origins=["https://<user>.github.io"]`.
- **Auth**: there is no authentication. If you deploy the API publicly, put it behind
  an API key / bearer token (or a reverse proxy such as nginx/caddy with basic auth).
- **DoS**: each request triggers model inference. Add rate limiting (e.g. `slowapi`) and
  keep `max_len` as a hard cap (currently 512 tokens in the model call) to bound CPU/GPU
  cost per request.
- **Prompt injection / PII**: the API accepts arbitrary user text and echoes extracted
  spans. If used with untrusted input, apply output sanitization (strip control chars,
  cap response size) on top of whatever the API already does.
- **HF token**: model downloads run unauthenticated from the public Hub. If you pin
  private/gated checkpoints, set `HF_TOKEN` in the environment — never commit it.

## Frontend (Next.js static export)

- The static site is inert (no secrets), but the `NEXT_PUBLIC_API_URL` baked in at
  build time is public by design — do not put credentials in it. Put auth in a header
  or cookie set by your own gateway if needed.
- Demo fallback data contains only synthetic examples.

## Models

- All bundled checkpoints are Apache-2.0 (see model cards). No weights are committed;
  they download at first load into `backend/models_cache/`.