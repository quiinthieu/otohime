# t-1606 run-9103: fix-plan run-9093 items 1–3 (pm-270)

This run carries out [fix_plan_run-9093.md](../fix_plan_run-9093.md) items 1–3 on main b3cc5ae. It repairs two test fixtures and reverifies the whole contract. No application code, CSS, threshold, CI workflow or desk code changed.

## 1. Child-output fixture (lib/gate-closure.test.ts:182)

The old child called `process.exit(3)` straight after writing 200,000 characters. Its assertion (`length < 200000`) passed only because the pipe dropped output, not because of the runner's 1,000,000-character bound.

Each child now exits from `stdout.write`'s callback, after its output is flushed:
- **Under the bound:** 200,000 characters must come back whole.
- **Over the bound:** the child writes 200,000 `h` then 1,000,000 `t`. Exactly 1,000,000 characters must come back, ending in `t` with no `h`, so the tail is kept and the head is dropped.
- Both cases also assert exit code 3 and no timeout.

The spawn-error and process-group timeout cases are unchanged, and so is `realRunChild` (scripts/check-gate-closure.mjs).

Controls with the real `realRunChild` and real Node 22 children (`run-9103/child-output-control.json`, `child-control.mjs`):

| producer | length returned (3 trials) |
|---|---|
| immediate exit, 200k | 146176, 146176, 146176 (output lost) |
| flushed exit, 200k | 200000 ×3 |
| flushed exit, 200k h + 1M t | 1000000 ×3, no `h` |

Negative control: with `KEEP_CHARS` mutated to 2,000,000, the new test fails with `expected 1000000, actual 1200000` (`child-mutation.log`). The file was restored with git checkout afterwards.

## 2. Ledger phone layout (e2e/ledger.test.ts, phone test)

New `settledLayout(page)` runs one animation-frame loop in the page, bounded at 10 s. It returns once:
- `.ledger-scroll` and `.ledger-sheet` are visible with nonzero boxes;
- `readyState` is complete;
- the geometry is identical across two frames.

Geometry here means inner/visual viewport, root font, scroll/client widths, sheet width and computed min-width. The loop keeps the last 40 frame samples, which also carry the time, fonts status and page scroll width.

It never waits for `scrollWidth > clientWidth`, because that is the behaviour under test. `assertPhoneLayout` then makes the original page-overflow and in-frame-scroll assertions, and every message includes the formatted geometry and frame trace. The Press-by-touch and receipt checks are unchanged, and the 46rem minimum in ledger.css is untouched.

New real-browser controls, in the test "on a phone the layout check waits for a sheet shown after hydration, and fails a sheet without its minimum width":
- **Delayed visibility:**
  - The frame is hidden with `display:none` after hydration and shown again 400 ms later.
  - A read taken right after hydration does not scroll. So hydrated props alone do not mean the layout is usable.
  - The settle loop must record the hidden frames and then pass the real assertions.
- **Missing minimum:** with `min-width: 0` on the sheet, the layout settles, and the unchanged scroll assertion throws `the year scrolls inside its frame` with `min-width 0px` and equal scroll/client widths in its message.

Mutation control: changing the settle condition to accept the first frame makes the delayed control fail with `scroll 0 / client 0, sheet 0px … hidden` (`ledger-mutation-nowait.log`). Hydrated but not yet laid out, that is exactly the original CI signature at line 397 (expected true, actual false). So it is the likely mode of that failure. This is a reasoned match, not a reproduction of the CI run.

Ledger file alone against a production build: 5/5 tests, 3 of 3 runs (`ledger-{1,2,3}.log`).

## 3. Verification on b3cc5ae + this change

| check | result |
|---|---|
| npm ci | exit 0 |
| trace helper unit test (contract cmd) | 5/5 |
| npm run lint && npm run typecheck | exit 0 (existing warnings only) |
| npm test | 2370/2370 |
| e2e ×3 (`for i in 1 2 3; do bash scripts/e2e-local.sh \|\| exit 1; done`, full build each) | 3/3 exit 0, each 179 pass / 0 fail / 1 existing skip (`evidence: every root hydrated under each colored run`); about 372 s each |

The following passed in all three e2e runs:
- desk tests 31 and 32 (phone no-drag; narrow/tablet no-drag and the 120 px wide-desk control);
- Kame;
- ledger tests 78 and 79.

Full logs are in `run-9103/`. The unit log is cut to its last 400 lines; the summary counts are in it. Generated `content/history.json` was restored before committing.

Environment: Linux x64 lease, Node 22.23.3, Next 16.4.2 (locked), Google Chrome 154.0.8037.57 through playwright-core, docker `postgres@sha256:eee6c6e1b0894fa4fe0075eb054af9fd1cf39a35321c2d4110626cfe506411fb`. Source hashes are in `source-hashes.txt`.

**Real and fake.** Real: Chrome, CDP touch, the production Next server, Postgres and the Node subprocesses. Fake or controlled:
- the suite's existing AudioContext fake;
- the injected hide and min-width style tags, used only in the control test;
- the temporary mutations, all reverted.

**Commit identity.** Author and committer are `Otohime <quiinthieu@gmail.com>` (README: Vercel Hobby deploys only the site owner's commits). This overrides the lease's `Claude Code` GIT_* env. Agent profile: claude-opus-5-5, software_engineer, run-9103.

## Not done here (owners per fix plan §4–5)

- **Bottle 2540012:** already landed, not reapplied.
- **Footer CI jobs 121874634016/121773440006/121798467743:** raw logs unread. Owner: pm-270 CI investigator with pm-269/t-1588.
- **Vercel "User not found" production 121871360439 and the identity guard:** owners pm-270/t-1605, pm-276/t-1619 and pm-278.
- **Signed-in motion under 120 s:** owners pm-269/t-1588 and pm-270/t-1604.
- **CI and deploy of this push:** not watched, per the role contract. plan-manager/QA own the run, the served sha and its ancestry.
