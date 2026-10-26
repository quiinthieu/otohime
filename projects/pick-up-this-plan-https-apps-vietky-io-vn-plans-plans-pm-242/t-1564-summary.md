# t-1564 · Restore the deployment checks gate (run-8744)

Delivery base: 320a07f (origin/main after three rebases; the claim was at 5cd6ee0). Run: software_engineer, Claude Opus 5.5 (`claude-opus-5-5`), on the macOS fleet lease. Real/fake boundary: every result here comes from a real production build, real Chromium/Chrome and a real Postgres (Docker or embedded). Nothing was deployed, and no CI run of the delivery commit had been observed when this was written.

## CI history read

- Source: unauthenticated GitHub API, `actions/runs?branch=main&per_page=50`, page 1 of 364 runs (bounded; older pages unread). The 60/h quota was exhausted afterwards.
- The last green run was c38f72a (40263545741). Since then 28 completed runs failed their `checks` job. The failing step was found for each:
  - Footer Chromium probe: 20 runs, 999fea4 (40264696243) … 7041d7f (40275822192), plus 2a58479 (40277523350).
  - E2E against next start: 7 runs, 76141f1 (40277024423), 1417dd8, a847437, 1507a61, 7041ef4, 0e0d87b, 8b49935 (40281293182).
  - `npm run build`: 54a9583 (40280586018).
  - 5cd6ee0 (40282630815) was pending and 2965bc5 (40282476358) in progress.
- Raw job logs returned HTTP 403 (no token). Check-run annotations only say "exit code 1". The exact CI assertions are therefore **inconclusive**, so each failure was reproduced locally. I replayed the CI steps on macOS (shared Postgres plus `next start` on :3000, BASE_URL remote mode) and in a 4-CPU Ubuntu 24.04 container.

## Each failure

| Failure | Finding | Where it is fixed | Evidence at the delivery build |
| --- | --- | --- | --- |
| Footer probe 999fea4..7041d7f | A fixed 13-Tab loop against a 7th CONSOLE_MENU page (Desk) | 2a58479 (`expectedKinds`-length loop) | `ok - keyboard Tab progression: … 7 pages, the zine link, 4 contact lines, Back to top and the waterline …` |
| Footer probe 2a58479 (one run) | Did not reproduce on macOS or in the Linux container (e2e+walk+probe, motion+walk+probe) | none | Inconclusive (single run, log unreadable) |
| Footer walk and probe at 5cd6ee0 | The waterline's 4th SVG and its link after Back to top (walk 58/7, probe 160/9 when reproduced) | 3351f78 (pm-249/t-1568, landed while this run was working); my duplicate repair was dropped in the rebase | walk 67 ok / 0 failed; probe 170 ok / 0 failed (`route …: 3 aria-hidden scene SVGs and the waterline last`) |
| E2E 76141f1..8b49935 | Frame-floor tests starve when `node --test` runs browser files side by side: the desk's `turning.length > 6` got 6, and ryugu's `loop runs` got 7 or 10 | **this task:** `scripts/e2e.mjs` passes `--test-concurrency=1` (a later CLI flag still wins). 3351f78 separately made the ryugu frame checks bounded waits | `npm run test:e2e` 75/75 twice on macOS at load averages 12–20; lib/e2e-runner.test.ts |

Two more failures came in with dd21add (pm-259/t-1573, the Kame companion) during this run. Both reproduced deterministically and are repaired here:

| Failure | Finding | Repair | Regression / negative control |
| --- | --- | --- | --- |
| Footer probe `desktop eyes: … at most 1 pending rAF` (4/4 runs, maxPending 2) | A stack captured inside the probe showed the 2nd pending frame is Kame's scroll edge frame. The setup `scrollIntoView` scroll event lands after the probe's `pending === 0` wait. The eyes never had more than 1 pending | `scrollQuiet(page)` waits until scroll events stop for 200 ms before the drain wait; the threshold stays at <= 1 | `rAF negative control:` a scroll during pointer work makes the count read 2. lib/end.test.ts pins the wait and the control |
| E2E `e2e/ink-press.test.ts` "Export PNG …" | `getByRole("status")` matched 2 elements once Kame added its own live region | `pressStatus(page)` scopes the lookup to the press's status beside its poster | The same assertion text now passes (ink-press 6/6) |

Regression and negative control for the E2E repair: lib/e2e-runner.test.ts runs two fixture files through `scripts/e2e.mjs` the way the gate does. Their spans must not overlap, and with `--test-concurrency=2` they must overlap. With the flag removed from e2e.mjs the test fails: "the second file started before the first ended".

## Isolated database for the walk and probe

`node scripts/e2e.mjs --serve-db <dir>` starts the e2e runner's embedded Postgres, applies the migrations, prints `DATABASE_URL=…` and holds it until SIGTERM or SIGINT. `walk-end.sh` (which had no database before) and `probe-end.sh` (Docker first, as before) use it when no database answers. They stop only their own PID and remove only `$WORK`.

While adding it I found a second bug: embedded-postgres's own async-exit-hook exited before e2e.mjs's cleanup ran. That left the work dir behind (5/8 SIGTERMs) and could leave the `next start` group running. e2e.mjs now owns SIGINT and SIGTERM, and `db.stop()` is bounded at 10 s. After the change, 8/8 SIGTERMs left nothing behind.

Covered by lib/e2e-runner.test.ts (the database answers with the `user` table, its files are gone after SIGTERM, exit code 143, and it refuses connections afterwards). Probe with Docker hidden: 170 ok / 0 failed, including `local 390x844 reduced-motion 403 exit: isolated plain-user sign-up succeeds`.

## Verification on the delivery tree (320a07f + this commit, after `npm ci`)

`npm test` 2078/2078 · `npm run lint` exit 0 (0 errors) · `npm run typecheck` exit 0 · `npm run build` exit 0 · `SKIP_BUILD=1 bash scripts/walk-end.sh` 67 ok / 0 failed · `SKIP_BUILD=1 bash scripts/probe-end.sh` 171 ok / 0 failed (and 171/0 three times at dd21add, once with Docker hidden) · `SKIP_BUILD=1 npm run test:e2e` 91/91 (75/75 twice at 3351f78). The host's load average was 11–20 throughout, from a co-tenant job.

## Open defect (not this task's; reported, not filtered)

`e2e/ryugu.test.ts:110` ("typing urashima … goes down to the palace") intermittently records an uncaught `InvalidStateError: Transition was aborted because of invalid state. Page already revealed`.

- Rates at 5cd6ee0's ryugu code: 9/40 typing urashima from /work, 1–7/40 from /, 1/3 serial e2e runs in the container. A single-key or `evaluate()` navigation to /ryugu gave 0/30, and Home→/shore 0/40.
- It happens when /ryugu's `pagereveal` has no viewTransition while the old page's `pageswap` had one.
- Page script can't catch it: `.catch` on every promise of both transitions, and the site's holdForHop guard, left the rate unchanged.
- It did not occur in this run's last three e2e runs (75/75, 75/75, 91/91).
- Owner: pm-256/t-1559 (components/urashima-keys.tsx, app/(ryugu)/). It fails when that assertion fails in "E2E against next start".
