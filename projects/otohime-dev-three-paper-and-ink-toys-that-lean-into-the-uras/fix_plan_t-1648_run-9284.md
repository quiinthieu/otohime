# Fix plan · pm-269/t-1648 · run-9284

Cause: **environment**, specifically CI trigger configuration for the report-only `ee40277` delivery. The Bottle executable is green in local gates and in production at served ancestor `f2e1adf`; no application source change is warranted.

Immediate recovery: dispatch the existing main workflow at `.github/workflows/ci.yml:5` against `ee40277` (or a forward-only descendant). Require checks and production green, team-scoped deployment API READY, and `/api/health` reporting the dispatched SHA or its descendant. Then QA repeats the independent live Bottle walkthrough and checks the delivery artifact's `author.txt` bytes. Do not mark a pending dispatch or uploaded deployment as delivered.

Durable pipeline fix: change `.github/workflows/ci.yml:12-14` so task delivery commits under `projects/otohime-dev-three-paper-and-ink-toys-that-lean-into-the-uras/` are not ignored by the `main` push trigger. Retain main-only production and all fail-closed readiness/health checks. Add a workflow trigger regression proving a report-only task delivery creates checks and production, while unrelated documentation can remain ignored. Push that CI change forward only and verify the new production run's served descendant before acceptance. No credential rotation or Bottle CSS change is indicated by the green `103f0c5` and `f2e1adf` production jobs.
