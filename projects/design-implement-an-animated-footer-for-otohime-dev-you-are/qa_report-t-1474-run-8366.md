# QA t-1474 — fail (cause=code)

Run `run-8366`, plan `pm-241`. Delivery: **a750f28953d68eaf98f94befaace43e7d7bc9d4b**.
The footer works in the tested local production build, but its new verification
wrapper crashes with an unset optional environment variable. The delivery's real
GitHub checks failed and production does not contain this SHA. A passing local
matrix with an environment workaround cannot satisfy delivery acceptance.

## Defect D1

`scripts/probe-end.sh:34` expands `${#TMPDIR}` under `set -u` before providing a
default. In a normal environment without `TMPDIR`, it exits before readiness,
Playwright installation, or any browser verification:

```text
env -u TMPDIR SKIP_BUILD=1 bash scripts/probe-end.sh
scripts/probe-end.sh: line 34: TMPDIR: unbound variable
exit=1
```

The workflow does not define `TMPDIR`. This is a reproducible defect in delivered
code, not a missing person, quota, or runner-capacity issue. See the companion
[fix plan](fix_plan-t-1474-run-8366.md). QA changed no application or CI source.

## Identities and evidence boundaries

- Exact delivery was tested in detached worktree `/tmp/pm241-qa-a750`, populated
  with **npm ci** from the committed lock. Node **22.23.3**, npm **10.9.9**,
  Next **16.4.2**, React **19.3.0**, temporary Playwright **1.64.0**, real
  headless Chromium **156.0.8078.4** on Linux. No runtime dependency changes.
- Production build ID: `mwtHlHVVwyCbhh2xbX0Et`.
  Build manifest SHA-256: `4c166bf853804f01920cedc64547b3c81ada0661c6007bb79299254d80054392`.
  `GITHUB_SHA` at build time was the full delivery SHA, verified in rendered DOM.
- Lock SHA-256: `ac0edc0da9da7579a0c43c802d1c8b43c75aa0bc7ee3bfde230586346f8a851a`.
  Workflow SHA-256: `23410d8f1209cceb0959e871e583551118d2430640a3d5f9bf101187de856dfa`.
  `probe-end.sh` SHA-256: `7f5d69e6b8e244128a95562b3655e169dca3a0d583de4478a3444ac1cbe591fa`.
  Complete relevant code/config hashes and observable browser results are in
  [the textual evidence](qa-t-1474-run-8366-evidence.json). No external model or
  generated-artifact dependency belongs to this SVG footer.
- Real imports and construction also succeeded for Next's production app,
  `pg.Pool` **8.23.1**, and Sharp **0.35.5** (generated a 91-byte PNG in memory).
  The tests launched actual Next servers and Chromium. RBAC used actual isolated
  Docker Postgres **17-alpine**, migrations, sessions and HTTP. There was no fake
  app runner or mocked browser used to establish functional delivery.
- The direct browser server used the public static build and a deliberately
  disconnected database URL. Its public routes rendered successfully; its
  `/api/health` returned 500 after a diagnostic request because that endpoint
  executes `select 1`. This is fixture configuration, not evidence about footer
  health. The isolated e2e server had a real database and passed all 28 checks.
- Harness-only synthetic boundaries: local DOM href corruption and temporary
  editable fixture; author's document-hidden simulation and denied-storage
  fixture. These prove handlers under those inputs, not native browser tab
  lifecycle on other engines. No deployed content/accounts/infrastructure changed.
- Author and committer from `git show --format=fuller a750f28` are **Otohime
  <quiinthieu@gmail.com>**; the message has no `Co-Authored-By` trailer.
  Delivery task `9c0bae95-2c80-4284-a1c7-648f12a8cc62` also lists **author.txt**,
  44 bytes, SHA-256 `7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`.
  Artifact-content retrieval returned 403; its contents cannot be independently
  matched. The git identity was checked directly; artifact-byte verification
  remains inconclusive and is not silently marked passed.

## Required checks independently executed

All commands below ran against exact delivery source and its locked environment.
`TMPDIR=/tmp` is explicit on browser scripts so D1 cannot mask functional results.

| Check | Observed result |
| --- | --- |
| `npm test` | 1,460 passed, zero failed |
| `npm run lint` | exit 0; nine existing unused-disable warnings |
| `npm run typecheck` | exit 0 |
| `npm run build` with local placeholder auth config and exact `GITHUB_SHA` | exit 0 |
| `SKIP_BUILD=1 PORT=4081 EXPECT_SHA=<delivery> bash scripts/walk-end.sh` | 67 passed, zero failed |
| `TMPDIR=/tmp SKIP_BUILD=1 PORT=4083 EXPECT_SHA=<delivery> bash scripts/probe-end.sh` | 164 passed, zero failed |
| `TMPDIR=/tmp SKIP_BUILD=1 bash scripts/probe-motion.sh` | 510 passed, zero failed |
| `SKIP_BUILD=1 APP_PORT=4085 bash scripts/e2e-local.sh` | 28 passed, zero failed |
| `env -u TMPDIR SKIP_BUILD=1 bash scripts/probe-end.sh` | **exit 1**, D1 |

The 164 checks included seven public routes, auth/404 and all eleven independent
project roots; desktop/tablet/touch layout; actual LCD text bounds for 13 states
including poke 10 and achievement; colors/contrast, wobble; entrance and reserved
geometry; pause/filter/idle-loop behavior; mascot click/tap/Enter/Space; Konami
exclusions and persistence; blocked storage; Tab focus; top action; no-JS; no
hydration/page/console errors; and no unexpected footer network requests.
The canonical-href negative control really rejected `/broken-play` in place of
`/play`; reload restored the same assertion to passing. The motion probe also
demonstrated its CSS-rule interception negative control.

## Independent user path and visual review

QA wrote and ran [a separate browser driver](qa-t-1474-run-8366.mjs), which imports
Playwright directly and does not invoke the author's probe functions. It recorded
38 before/action/after observations, zero page errors, and nine locally reviewed
screenshots. The full 3 viewport × 2 theme × 5 accent cross product was exercised.

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Fresh desktop Home, footer visible | Click footer Work, then footer Projects | Actual URLs `/work`, `/projects`; exactly one visible footer below main; six correct hrefs; no horizontal overflow | Independent observations 1–2; Home/Work/Projects screenshots |
| Locked, visible Projects footer | Focus temporary textarea; type real Konami keystrokes | Textarea receives `ba`; achievement remains locked | Observation 3, independent negative control |
| Same page, fixture removed | Focus mascot, reset with X, type sequence | Unlocked readout/badge and storage `end:achievement=1`; remains `/projects` | Observation 4, positive control |
| Achievement saved | Reload, activate reduced motion live | Restored achievement; inactive motion flag; pupils at `(0,0)` | Observation 5 |
| Projects footer, reduced motion | Click Back to top | `scrollY=0`, focus `main` | Observation 6 |
| Music at each viewport and OS theme | Select yellow/coral/mint/blue/pink separately | Correct figure hex, unchanged theme paper, one unclipped footer below main in all 30 states | Observations 7–38; six Music theme/viewport screenshots |
| Mobile disclosure closed | Focus summary and press Enter, choose accent, tap mascot | Native panel opens, settings work, `HI/THERE` LCD, full HTML readout changes, eyes remain centered | Mobile observations and screenshots |

The paper cliff and familiar console fit the existing ink geometry and rhythm.
Desktop has balanced scene/copy columns; tablet and mobile stack clearly, keep
navigation/contact groups readable and preserve the Music television area.
Both paper themes and pastel accents remain legible; mobile summary is centered.
Ambient/entrance work is restrained; no visual defect was found in this review.
The initial QA driver expected “hi there” in the HTML readout; inspection showed
that phrase belongs to the LCD while the intentional full readout is “Still
scrolling? There is only paper past this edge.” The QA assertion was corrected
to verify actual LCD rows, and the complete independent driver then passed.
This harness correction changed no application behavior.

## Actual CI, deployment and history

Board green gate **ver-3324**, run **run-8357**, passed all eight checks for
**a750f28**. Its raw verify-runner tail was read independently, not only the
supplied summary. It ran on **avietidol-mac-mini**, where TMPDIR is populated.
Both that green gate and the production GitHub failure are preserved as evidence.

GitHub delivery [run 40218042174](https://github.com/quiinthieu/otohime/actions/runs/40218042174),
checks job **121243956797**, runner `GitHub Actions 1000000620`, `ubuntu-latest`:
lint/type/unit/build/migrations/e2e/signed-in-motion steps succeeded; **Footer
walk and Chromium probe failed**; production job **121245178054** was skipped.
Annotations report exit 1. Raw GitHub log download returned **403**, and the
public UI requires login, so the precise remote stderr is unread and inconclusive.
D1 is established by real local execution without depending on that unread log.

Compared the same checks job with last green
[run 40216527659](https://github.com/quiinthieu/otohime/actions/runs/40216527659),
SHA **d4cb19cdb4fd03e307b4af78127beae9010237e3**, checks job **121238748532** and
production job **121240076560**, both successful. Read the workflow git log and
diff between it and delivery: a750f28 adds the footer step; no other workflow
change occurs in that interval. Cause remains **code**, not environment.

`https://otohime.dev/api/health` returned HTTP 200, `{"ok":true}`. Live Home HTML
reports deployed SHA **d4cb19cdb4fd03e307b4af78127beae9010237e3**.
`git merge-base --is-ancestor a750f28953d68eaf98f94befaace43e7d7bc9d4b d4cb19cdb4fd03e307b4af78127beae9010237e3`
exits **1**. Therefore the delivery is **not deployed**. A live walkthrough of
this older footer would not establish the new polish or browser-check delivery.

Bounded history inspection (no polling):

- GitHub completed history: pages 1–2, ten per page, **20/232** read: seven
  successful, ten failed, three cancelled. Older completed history unread;
  no claim of complete repository history.
- GitHub failed history: pages 1–3, ten per page, **23/23** read; complete for
  that snapshot. Queued and in-progress queries each returned zero.
- Read job-step state for delivery and later runs **40218576240** (`f82ea2f`),
  **40218922209** (`21bb9ed`), **40219528031** (`10b7043`). The middle run also
  failed the footer step; the other two failed earlier signed-in motion and
  cannot prove the footer fixed. Lock/workflow/probe shell/browser script blobs
  are identical across those SHAs. A new unrelated SHA never clears D1.
- Task-manager `project_id=plan-manager`: FAILED pages offsets 0 and 30,
  limit 30, **48/48** read, no pm-241 match; COMPLETED offsets 0 and 30,
  **60/903** read, incomplete, including four pm-241 records. Earlier global
  scans read FAILED **60/972**, COMPLETED **60/~5114**, PENDING **30/146** and
  RUNNING **3/3**; global history is deliberately bounded and largely unrelated.
  An initial `project_id=otohime` query returned empty because plan runs use
  project `plan-manager` and repo `otohime`; it was corrected, not treated as
  absence of execution.
- Direct task reads: delivery **9c0bae95-2c80-4284-a1c7-648f12a8cc62** and gate
  **2b938349-c055-4cc9-b00f-b4a234c7bdfe** are COMPLETED, callbacks **delivered**,
  one attempt each. Board run records have zero callback-apply failures, store
  a750f28, report rep-4823 and green verification ver-3324: ingestion is observed.
  Software-run raw tail is bounded to ~64 KiB; gate raw tail lists all eight
  execution outcomes. No failed pm-241 task appeared in the complete scoped
  failed-history scan. Unread unrelated failure logs are inconclusive.

## Delivery state and deferred checks

**Implementation pushed:** yes, a750f28. **Execution demonstrated:** real local
production footer/browser/database checks passed with the explicit TMPDIR
workaround. **Integration deployed:** no, delivery ancestry fails. **Product
delivered:** no, repeatable Linux check and new deployed build are missing.
**Waiting for capacity:** no; no runtime queue, soak, watch, or operator chore
is needed. Do not park or poll to waive D1.

| Deferred check / exact IDs | Owner | Failure condition / next action |
| --- | --- | --- |
| D1, `scripts/probe-end.sh:34`, t-1474 | Software engineer fixing t-1474 | Unset TMPDIR still exits before browser setup; normalize it and rerun actual matrix plus all contract checks |
| New checks/production after run 40218042174 and skipped job 121245178054 | Software engineer, then QA/acceptance | Replacement commit lacks successful Linux checks or deployment ancestry; push corrected source to trigger on demand |
| Production walkthrough for delivery a750f28 plus correction | Acceptance engineer | Live build-sha lacks delivery/correction or observed interactions fail; check once an actual deployment exists |
| Raw CI log job 121243956797, and author.txt on task 9c0bae95-2c80-4284-a1c7-648f12a8cc62 | Platform evidence access owner / next authorized QA run | Access remains 403; do not claim unread bytes validated. Independently checked git author is correct |
| Firefox/Safari, native background-tab lifecycle, device-GPU smoothness | Future browser/device coverage owner | No execution was performed; these are limits, not claimed passes or invented acceptance gates |

Run provenance: software engineer **run-8321**, profile **agy-argon-high**,
model **gemini-4-argon-high**, `avietidol-mac-mini`; verification **run-8357** is
the shell verify-runner on that machine (no agent-model inference). This QA is
**run-8366**, profile **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**,
fleet worker **avietidol-z490**. The missing requested standing workflow files
were confirmed; installed Next layout and server/client guides were read.

This QA saves only its independent driver, textual evidence, QA report and fix
plan. Screenshots, browser binaries, dependency installs and raw logs stay out
of git. Root checkout tests also passed **1,490/1,490** and lint exit 0 on the
newer main used to commit these QA artifacts; those are separate from exact
delivery results above.
