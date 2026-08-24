# RALPLAN — gliner-playground verify & publish

## Goal
Repo is built and pushed. Deliver: (1) fresh green verification evidence, (2) clean two-lane code review, (3) live GitHub Pages deployment of the learn-by-play site.

## Scope
- No new features. Verification + deployment only.
- Fix only HIGH/CRITICAL findings surfaced by review; MEDIUM/LOW recorded as-is unless trivially safe.

## Plan phases
1. **ralph (verification)** — fresh evidence required:
   - `cd backend && uv run pytest tests/ -q` → expect 13 passed
   - `cd site && npx tsc --noEmit` → expect 0 errors
   - `npm run build` → expect success, static export with basePath
   - Headless browser pass (playwright, chromium-1223) over all 8 widgets → expect 0 console errors, live badges count > 0, section content present
2. **code-review** — two lanes in parallel (code-reviewer + architect) on committed diff vs main origin; synthesize with deterministic gating (BLOCK → REQUEST CHANGES; REQUEST CHANGES → REQUEST CHANGES; WATCH → COMMENT; else follow reviewer).
3. **fix loop** — if not clean, fix findings, re-verify (tests+build), re-run review; max 3 cycles.
4. **publish** — enable GitHub Pages via `gh api repos/jasperan/gliner-playground/pages` or the workflow; review NEXT_PUBLIC_API_URL decision (no backend host configured → build in demo-mode default localhost:8000; site falls back to demo data when offline). Confirm deployment URL returns 200 and contains expected markup.

## Test spec (already implemented)
- backend/tests/test_api.py — 13 API tests
- Browser checks — widget presence, live badges, console-error-free

## Stop conditions
- 3 review cycles without clean verdict → report
- Pages deployment fails with credential/permission error → report rather than workaround