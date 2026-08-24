# Context snapshot — gliner-playground verify & publish

- task statement: push repo to GitHub (done), run autopilot verification (tests/build/browser), publish learn-by-play site to GitHub Pages, finish clean.
- desired outcome: green verification evidence, clean code review, live GitHub Pages deployment at https://jasperan.github.io/gliner-playground/
- known facts:
  - Repo: /home/ubuntu/personal/gliner-playground, main branch pushed to jasperan/gliner-playground
  - Backend: FastAPI, 5 models (gliner small/medium/multi, gliner2 base/multi), 13 pytest tests pass (verified earlier)
  - Site: Next.js 16 static export, next.config.ts basePath="/gliner-playground", 8 widgets with live API + demo fallback
  - Deploy workflow: .github/workflows/deploy.yml already committed; needs GitHub Pages enabled + NEXT_PUBLIC_API_URL decision
  - GPU A10 available, backend previously running on :8000
- constraints: demo project; keep changes small; do not commit models (6.3G cache gitignored); learn-by-play structure respected
- unknowns: backend hosting decision (Pages site is static; NEXT_PUBLIC_API_URL governs live vs demo mode); whether Pages API is available via gh
- likely touchpoints: site/next.config.ts, .github/workflows/deploy.yml, tests, widgets
