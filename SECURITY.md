# Security notes

This repository is a **demo**. It is not hardened for public production use as-is;
treat the following as the minimum before exposing the API beyond a trusted network.

## Backend (FastAPI)

- **CORS**: `backend/app/main.py` reads `GLINER_ALLOWED_ORIGINS` (comma-separated)
  and defaults to localhost dev origins — **not** `*`. Before public use, set the
  env var to your deployed site's origin(s), e.g.
  `GLINER_ALLOWED_ORIGINS="https://<user>.github.io,.yourdomain.com"`.
- **Auth**: there is no authentication. If you deploy the API publicly, put it behind
  an API key / bearer token (or a reverse proxy such as nginx/caddy with basic auth).
- **DoS**: each request triggers model inference. Add rate limiting (e.g. `slowapi`) and
  keep `max_len` as a hard cap (currently 512 tokens in the model call) to bound CPU/GPU
  cost per request. The source bounds one request's *size*, not how many requests arrive:
  - `backend/app/limits.py` refuses a request body over `GLINER_MAX_REQUEST_BYTES`
    (default 1,000,000 bytes) with `413`, including chunked bodies without a
    `Content-Length`.
  - Every caller-supplied string and collection is bounded in the request models
    (`backend/app/main.py`: label/task/field/relation names ≤ 200 chars, ≥ 1 and ≤ 200
    entries per list, ≤ 50 keys per map). `text` stays ≤ 20,000 chars, or ≤ 200,000 on
    `/api/entities-long`, which runs at most 115 chunked forward passes (capped at
    `MAX_CHUNKS`).
  - `/api/compare` and `/api/benchmark` reject duplicate model ids, so a request cannot
    multiply passes by repeating an id.
- **Resident memory**: resolved models stay resident for the process lifetime
  (`backend/app/models.py#_loaders`). All five catalog checkpoints are roughly 812M
  parameters, i.e. about 1.6 GB in fp16 or 3.2 GB in fp32 if every model is loaded. On a
  shared or memory-tight device set `GLINER_MAX_LOADED_MODELS=<n>` to unload the least
  recently resolved model above `n`; the default (unset/`0`) keeps everything loaded so
  `/api/compare` stays warm.
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