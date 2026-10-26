This run resumes the saved t-1606 delivery after run-9045 exhausted three
rebase/reverification cycles and four main push attempts. The checkout was clean
on main, one rescued commit (87c9863) ahead of origin/main (a688012). No initial
checkout or rebase was performed. The delivery commit identity is supplied as
git_sha on the plan-manager summary and resolved by this run's commits.txt.

The observed swipe implementation in 0b349dc already satisfies the original
contract: tape scrolling, stable bounds across two animation frames, an exact
tape hit-test, data-dragging after the first move beyond 6px and cleared after
release, and bounded 40-record failure traces. The wide control retains its
120px drop; narrow/tablet controls retain their no-drag assertions. No observed
gesture was lost by the application, so no ink-desk edit or quarantine is made.

All rescued changes are retained: the real production footer regressions in
e2e/probe-end.test.ts, the controlled notebook-clock fixture in e2e/desk.test.ts,
and run-9045's historical evidence. The footer source-reader repair from 9bb1dae
and shell repair from ab34874 remain intact. Other listed prior paths were
already upstream; no uncommitted foreign changes existed at the start. Only
the generated content/history.json diff from local builds was discarded, after
saving each build's actual generated-history hash. No workflow, breakpoint,
drop threshold, Kame/Ryugu test or application source was changed by this resume.

Fresh verification on the rescued executable, with npm ci and real production
builds, is saved under shared/artifacts/t-1606/run-9065/. verification.json
contains the exact verification[] commands, results and evidence boundaries.

| Check | Result |
| --- | --- |
| Locked dependency installation | exit 0 |
| Contract trace helper command | 5/5 pass |
| Lint and types | exit 0; 10 existing lint warnings, zero errors |
| npm test | 2344/2344 pass |
| Exact contracted e2e-local loop | 3/3 pass; each 158 pass, zero fail, one existing skip |
| Full footer browser probe | 171 pass, zero fail |

E2E suite durations were 327.957s, 336.517s and 333.926s. Each invocation
builds production Next, migrates a real throwaway Docker Postgres and runs the
whole browser suite. The existing skip is “evidence: every root hydrated under
each colored run”. Complete raw logs, three build IDs and manifest/generated
history hashes are saved. All three wide 120px controls and phone/narrow/tablet
negative controls pass. Both JS modes of the footer regression pass each time.
Wrong or empty accessible source text cannot borrow correct decorative ink or
an unrelated source; a plain heading works and a missing heading stays missing.
The full probe also exercises its own negative controls.

Real boundaries: locked imports, browser/pg adapter construction, Chrome/CDP,
production Next/React/DOM/CSS, built assets, database and migrations. Only the
full-motion notebook control uses the browser clock; all swipe controls use
real clocks. Footer DOM mutations and the suite's existing unit/network fixtures
are deliberate test doubles, not proof of external services or deployment.
Run-9045's saved failing-before footer and notebook controls remain historical
evidence, distinct from this run's fresh passing logs.

The stable source/configuration/lock/assets fingerprint covers 863 files:
338aa24310455e08a5987195dcf5add09bea17c314b438cc001b9239c93325ef.
The final production build fingerprint covers 3138 server/static/manifest files:
fbe82dc99de0c636945f8c8b85310b90b7057cc8e4497465d6421c85d2eeabc6.
Its build ID is X6SGBWet8HIIi9fwP7Dbq; the local build-sha is dev. All recorded
source and build files were rechecked unchanged after verification. Generated
history is excluded from the stable source digest and recorded per build.
The source ancestry contains both 3ae76a4 and 9ddd084; this is not deployed proof.

Execution is demonstrated locally. Integration deployed and product delivered
remain unobserved, pending plan-manager's independent CI/deployed gate. There
is no capacity wait. Local history is complete: three completed production E2E
attempts, zero failures, and a complete passing footer probe. No remote history,
current pipeline or deployed endpoint was queried, per the stop-at-push role
contract; this run supplies no remote run/job IDs or production verdict.
Deferred identity: the main push event for the summary's git_sha in
.github/workflows/ci.yml. Owner: plan-manager QA and pm-270 acceptance. Failure
conditions: red checks/production, served SHA omitting 3ae76a4 or 9ddd084, a
failed deployed wide swipe, or rejection of the correct footer title source.

Runtime: macOS arm64, Node 22.23.3, locked Next 16.4.2/playwright-core 1.64.0,
Chrome 156.0.8078.48, Docker 29.9.2 and postgres:17-alpine (digest recorded).
Profile: Codex, GPT-6 per runtime instructions, software_engineer, run-9065;
effort is not exposed. AGENTS.md and the installed Next CLI/Playwright guides
were read. The requested software-development.md and chief-of-staff extraction
document are absent. Decisions and a lesson about the resumed branch/committer
metadata are recorded on pm-270. This commit explicitly uses Codex author and
committer identity rather than the inherited Claude Code committer.
