# QA report: t-1559, Enter Ryugu-jo (run-8834)

**Verdict: pass.** Cited (deployed) sha `ee1f6ce6cd7f47c8e7fe1c450b33ff07e922332f`. It contains the delivery commit `5cd6ee0102242f09f0f328fa5b786635d967b39c` (`git merge-base --is-ancestor 5cd6ee0 ee1f6ce` → true).

Run profile: quality_engineer on Claude (claude-opus-5-5) through the decider's role pin claude-opus-high, on a macOS lease (Darwin 27, node 22.23.3, Google Chrome via playwright-core 1.64.0).

## Identities

| What | Sha | Notes |
|---|---|---|
| Delivery (run-8731) | `5cd6ee0` | Route, layout, entries, sea, tests |
| Test guard (run-8820) | `9d0fba4` | Only adds `app/(ryugu)/_lib/wiring.test.ts`; HEAD of main at QA time |
| Green gate | ver-3527 @ `9d0fba4` (pass); ver-3503 @ `5cd6ee0` (pass) | Plan-manager green gate |
| Production | `ee1f6ce` | Read from `https://otohime.dev/api/health` at 2026-10-26T10:12Z |

Commit identity: `5cd6ee0` and `9d0fba4` are authored and committed by `Otohime <quiinthieu@gmail.com>`, with no `Co-Authored-By` trailer. There is no author.txt in the delivery evidence.

## Contract verification (my rerun at `9d0fba4`, after a fresh `npm ci`)

| Item | Result |
|---|---|
| `npm test` | exit 0, 2099/2099 |
| `npm run lint` | exit 0, 0 errors (10 pre-existing warnings, none in app/(ryugu)) |
| `npm run build` | exit 0, `○ /ryugu` static |
| `SKIP_BUILD=1 npm run test:e2e` (local, beyond the contract) | exit 0, 91/91, including the 9 tests in e2e/ryugu.test.ts and kame |

## Independent evidence: my own probe against production

`t-1559/qa_run-8834/probe.mjs` was written in this run and shares no code with e2e/ryugu.test.ts. It counts rAF callbacks and WebGL `getContext` calls through an init script. Against `https://otohime.dev` (build `ee1f6ce`), 18/18 checks hold:

- Keyboard: typing `urashima` on `/` reaches `/ryugu`.
- Pocket: the `▽ Dive` chip (`a[data-pocket-ryugu]`, href `/ryugu`) reaches `/ryugu`.
- Footer: on a 390×844 touch viewport, scrolling `/notes` to the bottom and tapping `a[data-end-ryugu]` reaches `/ryugu`.
- Isolation, two checks:
  - No Tailwind rules, no site footer, Pocket console or waterline in the palace document.
  - `/ryugu` loads 1 stylesheet and shares 0 of the 15 sheets on `/`.
- Live, with WebGL (SwiftShader):
  - `data-water=live` and 1 GL context.
  - 51 frames in 2.8 s, and the fish transforms change after the pointer moves.
- Hidden: 0 frames while `document.hidden`, and 21 frames after the page is visible again.
- No WebGL (`--disable-webgl --disable-3d-apis`): `data-water=static`, 9 served fish, 0 frames, no page errors.
- Reduced motion: `data-water=still`, 0 WebGL context requests, 0 frames.

**Negative controls:**
- Typing `urashimx` stays on `/`.
- The live baseline runs ≥20 frames, so 0 frames under the fallbacks is a real measurement.
- My first isolation selector also matched the palace's own `<header class="surface">`. That was a false positive in the probe, not a defect. I narrowed it to the site's markers and added the disjoint-stylesheet check.

**Real/fake boundary:** real production server, real Chrome with real WebGL (software via SwiftShader). Two things were simulated: document hiding (property override plus a `visibilitychange` event, not a real tab switch) and the no-WebGL condition (Chrome flags).

## CI history (GitHub public HTML; raw logs need a token and were not read)

Scan: the first page of the main-branch runs list covers runs 380–404, 25 runs: 1 green (394), 9 cancelled (serialization), 15 failed. I opened the job pages of runs 404, 403, 398 and 394 only. Other runs and every raw log are unread, so the evidence on which E2E file fails is inconclusive.

- Run 404 (40303724712, `9d0fba4`), job 121509554244: every step through `npm run build` and `db:migrate` passed (lint, typecheck, `npm test`, ask:check, migrations). `E2E against next start` failed, and everything after it was skipped. Runs 403 (`b73d93c`) and 398 (`0a32605`) fail at the same step.
- Run 394 (40297827219, `ee1f6ce`) passed every job, production deploy included, and that build is what is live now.
- Between `ee1f6ce` and `9d0fba4`, nothing changed in `.github/`, `e2e/`, `scripts/e2e.mjs`, package.json or package-lock.json. The only non-project changes are `app/(ryugu)/_lib/wiring.test.ts`, `lib/plan-release.ts` (with its test) and `scripts/probe-plan-release.mjs`, none of which the app imports. So the app and e2e code that failed in run 404 is the same code that passed in run 394. The E2E failure is recurring but not deterministic in this delivery, and the same suite passes 91/91 locally.

## Defects and deferred checks

- **Open, not this delivery's:** main's `E2E against next start` (`.github/workflows/ci.yml:76-80`) fails intermittently: 15 of the 25 runs listed above failed. Every red run blocks deploy, so `9d0fba4` (a test-only change) is not live. The prior lessons attribute this to kame.test.ts flakiness, owned by pm-259/pm-258. I couldn't confirm the failing file without a token; whoever holds a GitHub token can read job 121509554244's log. It counts as broken if a ryugu test is the one failing in CI.
- None of the deployed APIs are part of this task; the palace is static. `/api/health` was read only to identify the build.
