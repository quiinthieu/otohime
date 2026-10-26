# QA report t-1568 (run-8914, claude-sonnet-5-5) verdict: pass

Tree: main a795bf2 (contains delivery b742a04, 3351f78, b80d942). macOS lease, nothing on :5432, fresh `npm ci`.

| step | result |
| --- | --- |
| npm ci, lint (0 errors, 10 warnings), typecheck | exit 0 |
| npm test | 2202/2202 |
| ask:check | up to date |
| npm run build | exit 0 |
| SKIP_BUILD=1 npm run test:e2e (embedded Postgres) | 118 tests, 117 pass, 0 fail, 1 skipped (pre-existing `# SKIP` "evidence: every root hydrated under each colored run") |
| walk-end.sh (SKIP_BUILD=1) | 67 ok, 0 failed |
| probe-end.sh (SKIP_BUILD=1) | 171 ok, 0 failed |

pocket-terminal and ink-press e2e both ran and passed (e2e glob includes them).
Negative control: bare `next start` with DATABASE_URL at localhost:5432 and nothing listening: /api/health 500, ECONNREFUSED. This reproduces the earlier red gate (environment, not code).
Not run: probe-motion-signed-in.sh (not in the verification list; SE evidence 356/0). Not observed: GitHub Actions run (no gh/token).

Identity: 3351f78, b80d942, b742a04 authored Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer.
Deploy: live otohime.dev serves bca260a (/api/health and build-sha meta). 3351f78 and b80d942 are ancestors of bca260a; b742a04 is projects/**-only, skipped by ci.yml paths-ignore, so it is never built (by design). Green gate: pass for b742a04.
