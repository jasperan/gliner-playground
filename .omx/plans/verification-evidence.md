
## Post-fix re-verification (review cycle 1)

| Check | Result |
|---|---|
| pytest (16 tests incl. new entities-long + all-endpoints 422) | 16 passed |
| tsc --noEmit | 0 errors |
| next build | ✓ compiled |
| browser (all 8 sections) | 0 console errors, 0 failed requests |
| badges | 6/6 badge widgets LIVE (0 DEMO) |
| backend health | loaded 5/5 models warm |

## Fixes applied (from review cycle 0)
- M1: unknown model → 422 on ALL endpoints (_resolve_model + global KeyError handler)
- M2: new /api/entities-long chunked endpoint + honest 512-truncation note
- M3/M5: fixed demo.ts `uchade` typo, added 5th model row, removed unsafe casts
- M4: multilingual widget parallelized (Promise.all), removed dead batchDone + sleeps
- M6: threshold widget fetches real candidate pool at 0.05 floor (honest stats)
- M7: zero-shot overlapping spans handled + request-seq stale-response guard
- L1: removed _lock, _device, list_models, no-op extra, void has
- L2: typed MODEL_CATALOG via ModelInfo dataclass
- L3: removed unused pydantic-settings/python-multipart
- L4: global exception handler + logging
- L5: relations head/tail isinstance guards
- L6: DEMO_CLASSIFY intent task
- L7: entities-long endpoint (long-doc support)
- L8: memoized checkBackend (5s TTL)
- H1: CORS now env-configurable (GLINER_ALLOWED_ORIGINS), no wildcard default
