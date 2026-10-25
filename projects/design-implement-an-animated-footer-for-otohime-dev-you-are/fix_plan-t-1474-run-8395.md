# Fix plan: pm-241 / t-1474 / run-8395

**Cause: code. Owner: software engineer for t-1474.** Exact delivery
`6b31607838c312e0942731b970249db005b1e179` passes the eight contract commands,
but the CI signed-in probe independently fails 354/2. A fresh isolated browser
reproduces two React #419 errors on each of three 403-to-Dashboard cycles.
The streamed source response contains boundary B:3 aborted with
`NEXT_HTTP_ERROR_FALLBACK;403`. Later green CI at deployed `61bbd2c` does not
waive the repeated exact-delivery failure. No capacity or authority issue.

1. Reproduce with real dependencies and a temporary local Postgres database.
   Build the exact delivery with its lock, migrate and start on a free port.
   Run `qa-t-1474-run-8395-repro.mjs` with `PW_PREFIX`, local-only `BASE_URL`
   and `QA_REPRO_OUT=/tmp/repro.json`. It creates only an isolated plain test
   account; destroy that disposable DB afterward. Also run
   `SKIP_BUILD=1 PORT=4093 bash scripts/probe-motion-signed-in.sh` unchanged.
2. Primary source correction target:
   **`app/(site)/(app)/admin/roles/page.tsx:12`**, which calls
   **`lib/dal.ts:27-29`** and throws `forbidden()` after the admin loading
   boundary has streamed (**`app/(site)/(app)/admin/loading.tsx:6`**).
   Render the existing denied-room UI from
   **`app/(site)/(app)/forbidden.tsx:6`** as an ordinary completed server
   result for a signed-in insufficient role, rather than aborting an already
   streamed Suspense boundary. Keep `requireUser` for signed-out redirects,
   the exact permission predicate, locked-room copy, noindex semantics and
   transition markup. Keep the footer placement and all authorization/data
   protection intact. This is a proposed correction grounded in the observed
   abort digest, not a QA-tested patch; verify the actual boundary ownership
   before applying the smallest change. If another boundary owns the abort,
   fix that proven source rather than applying this proposal blindly.
3. Preserve diagnostic evidence at
   **`scripts/probe-motion-signed-in.mjs:112`**: include pageerror stack and
   navigation phase/last response abort digest, since `page.url()` alone
   assigns delayed source errors to a destination URL. At
   **`scripts/probe-motion-signed-in.sh:242`**, preserve the Node exit status
   and print a bounded server-log tail on failure before cleanup. Do not
   suppress #419, delete the regression cases or weaken the no-error check.
4. Add a focused production-browser assertion for repeated local plain-user
   full-load 403 -> Projects -> full-load 403 -> Dashboard at 390x844 with
   reduced motion. Assert zero page/console errors, unchanged access denial,
   noindex, one visible footer and normal page navigation. Keep the independent
   editable-field negative control and corrupted-href failing control.
5. Run `npm test`, lint, typecheck, production build, walk-end, probe-end,
   probe-motion and e2e-local, plus the strict signed-in motion probe. Exercise
   probe-end with TMPDIR absent again. A previously green gate is not a waiver.
6. Commit with owner identity and `pm-241/t-1474:` subject; push normally.
   A push to main or a PR triggers `.github/workflows/ci.yml` on demand;
   signed-in motion must pass before Footer walk and Chromium probe, then
   production follows checks on main. Preserve migration/deploy semantics.
   QA must re-read the exact new green gate, CI jobs and live build stamp,
   verify delivery ancestry and rerun the independent user path. No scheduled
   wait, runner repair, operator action or force-push is needed.

The observed failure cannot yet be proven introduced by the footer. It remains
cause=code under the QA role's explicit attribution rule; do not relabel it
environment because a later run happened to pass. Raw original GitHub logs and
author.txt bytes still require authorized evidence access as documented in the
QA report; unread bytes remain inconclusive.
