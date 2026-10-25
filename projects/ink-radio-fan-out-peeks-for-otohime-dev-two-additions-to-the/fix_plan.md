# Fix plan: t-1507 Ship Fan-out Peeks

**Cause: environment.** The application UI passes the local contract and local Chromium probe. Production is still on `8b54cc4`, which contains UI commit `593d699` but not task delivery/gate `18ef637`. GitHub Actions run `40235108426` failed before deployment at its combined **Footer walk and Chromium probe** step. Its raw log endpoint returned 403; independent hosted probes reproduced `net::ERR_NETWORK_CHANGED` and a transient route timeout, while the local probe passed 61/61. No `.github/workflows/ci.yml` change landed between the last green matching check and the failed `18ef637` check.

## Exact follow-up

1. In `.github/workflows/ci.yml:91-98`, split the combined **Footer walk and Chromium probe** block into separately named steps, preserving both commands and their current failure behavior. This makes the failing command explicit on the next run.
2. In `scripts/probe-end.mjs:279` on failed source `18ef637` (the route `page.goto` used by the footer Chromium probe), add one bounded retry only for Playwright's transient `net::ERR_NETWORK_CHANGED` navigation error. Reapply it to the corresponding route-navigation call on the current branch. Keep all application assertions and fail if the retry also fails; do not suppress console or page errors.
3. Push the focused fix on `main` to trigger GitHub Actions. Require the checks job and production job to succeed, then verify `/api/health` and read the production `build-sha`. Confirm `git merge-base --is-ancestor 18ef637 <deployed-sha>` before resubmitting QA.

Run `npm ci && npm test && npm run test:e2e && npm run lint && npm run typecheck && npm run build` on the fix commit before push. The already-pending run `40236130954` at `c885936` is not considered proof until its checks and production deployment are observed.
