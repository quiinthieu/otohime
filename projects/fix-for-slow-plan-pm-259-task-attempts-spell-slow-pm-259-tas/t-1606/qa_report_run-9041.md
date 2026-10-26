# t-1606 QA — run-9041

**Verdict: fail — cause=environment.** Desk execution is demonstrated, but the
main deployment gate still contains a deterministic footer browser-probe defect.
The required served SHA containing delivery 3ae76a4 has not been established.
See [the exact fix plan](fix_plan_run-9041.md).

Delivery: **3ae76a4dc84456cd8b7bebb74023eb7989eb3721**; implementation:
**0b349dc012c0591ded5f82d28d0cf3395b71567c**. Independently rerun source checkout:
**ab348743f001460a066f5233c4d99f95af8b15ba**. The relevant desk implementation,
gesture helper and tests are unchanged since delivery. Full executable, lock and
configuration fingerprints are in [fingerprints.json](qa_run-9041/fingerprints.json).

## Verification

| Check | Independent result |
| --- | --- |
| Locked install | `npm ci`, exit 0; Node v22.23.3, Next 16.4.2, playwright-core 1.64.0 |
| Trace unit test | 5/5 pass |
| Lint and typecheck | exit 0; 10 existing lint warnings, 0 errors |
| `npm test` | 2,321 pass, 0 fail |
| `CI=true npm test` | 2,321 pass, 0 fail |
| Production-build E2E ×3 | 3/3 exit 0; each 138 pass, 0 fail, 1 skip; desk tests 7 and 8 pass in all 3 |
| Public footer walk against the real local production server | 65 pass, 0 fail |
| Independent production browser path | Three 120px wide-desk drags: x=.300 → .425, persisted after reload; tablet stays at .300 |
| Negative control of the delivered helper | Intentional tablet `drags: true` fails with `ERR_ASSERTION`, expected exit 1, actual exit 1; message contains pointerdown and pointermove |

E2E uses `for i in 1 2 3; do bash scripts/e2e-local.sh || exit 1; done`:
each iteration builds and migrates its own real Docker Postgres. The skipped test
is `evidence: every root hydrated under each colored run`, outside the desk task.
No desk test is quarantined; the 120px expectation and stacked breakpoints remain.

The page-side recorder is capped at 400 raw records; the pure helper formats a
maximum of 40 with its default bound, preserving press and release while dropping
older moves. `swipe()` scrolls the tape into view, observes a stable hittable box
over two frames, waits for `[data-dragging]` after the first move beyond 6px, and
waits for it to clear on release. The wide control and narrow/tablet assertions
include formatted event traces. No evidence warranted the conditional application
repair in `ink-desk.tsx`.

After a report-only fast-forward to
**907a131b78eb75b7c525d4cb21854930d15c09de**, trace, lint, types and all 2,321 unit
tests were rerun successfully. Every stored executable/configuration/lock
fingerprint is identical to ab34874. The three production E2E runs remain
attributed to their actual source/build, rather than a new unrelated SHA. See
[post-rebase checks](qa_run-9041/post-rebase-checks.json).

## Independent user path and negative control

[live-gesture.mjs](qa_run-9041/live-gesture.mjs) drives Chrome directly and does
not import the delivered swipe helper. It checks the actual DOM drop and reload
persistence, then intentionally requires a tablet drag and verifies that the
missing drag fails with a real pointer trace. Initial results and served build
identities are in [live-gesture-reload.json](qa_run-9041/live-gesture-reload.json).

A second control executes the actual delivered test helper from a temporary copy
with only the tablet `drags: false` changed to `true` and imports relocated for
execution outside the repository. This produces:

```text
music is dragging after the first move past 6px
pointer events the page saw:
+0ms pointerdown touch#2 (892.8,218.4) span.desk-tape
+29ms pointermove touch#2 (904.8,218.4) span.desk-tape
```

The exact mutation, command and result are in
[negative-control.json](qa_run-9041/negative-control.json) and the complete failure
in [negative-helper.log](qa_run-9041/negative-helper.log). No application source was
edited to make a check pass.

## CI history, deployment and completeness

Final independent observation: public GitHub run page
[40352230491](https://github.com/quiinthieu/otohime/actions/runs/40352230491)
reports **Failure** for **ab348743f001460a066f5233c4d99f95af8b15ba**. The last
successful API snapshot showed checks job **121675094950** executing **Footer
Chromium probe**, after E2E, signed-in motion and Footer walk. The final API read
returned **403 rate limit exceeded**; the public HTML is the independent fallback
for the final workflow outcome. The [public job page](https://github.com/quiinthieu/otohime/actions/runs/40352230491/job/121675094950)
also confirms **checks failed**, **Footer Chromium probe**, and `Process completed
with exit code 1`. Raw per-check diagnostics remain unread. Public visible text
and HTML hashes are saved in the artifacts.

Final public `/api/health` and `/desk` build meta still both serve
**074059495faf4bee48e8f655584dfd4487089b41**. Ancestry again returns **1** for
`git merge-base --is-ancestor 3ae76a4 0740594`, **0** for 0b349dc, and **0** for
9ddd084. Required delivery is not deployed. See [final state](qa_run-9041/final-state.json).
No quota reset or pending replacement was awaited or treated as a repair.

Initial independent GitHub REST scan: two pages of 30 main CI runs, **60 of 444**
runs: **16 failed, 6 successful, 37 cancelled, 1 in progress**. This is a bounded
sample, not complete history. Job/step data was read for 13 sampled runs; failure
annotations were read for four failed jobs. The 10 newest runs' job pages fit
within their 100-job page limit. Older uninspected jobs are inconclusive. Source:
[page 1](qa_run-9041/history-page-1.json),
[page 2](qa_run-9041/history-page-2.json).

The last completed red runs at the initial scan were
[40349872187](https://github.com/quiinthieu/otohime/actions/runs/40349872187)
(e03cf1c, checks job **121666695821**) and
[40346324813](https://github.com/quiinthieu/otohime/actions/runs/40346324813)
(74522bc, checks job **121654087754**). Both passed E2E and signed-in motion, then
failed **Footer walk**. Compared with last green **checks** run
[40330477897](https://github.com/quiinthieu/otohime/actions/runs/40330477897)
(0740594, job **121601102988**) and last entirely green workflow
[40325669520](https://github.com/quiinthieu/otohime/actions/runs/40325669520)
(542c6206), the changes to CI configuration were read in git log and diff. See
[comparison](qa_run-9041/ci-comparison.json) and
[configuration diff](qa_run-9041/ci-config-between-green-and-failure.diff).

The old footer verifier reads the Riso heading's decorative copy twice. Independent
reproduction against this checkout's production server confirms the mismatch;
the existing upstream repair **ab34874** at `scripts/walk-end.sh:241` reads the
plain `.riso-source` instead. The repaired verifier passes the 65-check walk.
However, **the browser verifier still has the same deterministic defect** at
`scripts/probe-end.mjs:503` and `:1881`: both read the entire heading's
`textContent`, compared for equality with the plain title at `:526` and `:1893`.
Independent real Chrome reads with JavaScript enabled and disabled show
`You've reached the end of the internet.You've reached the end of the internet.`
versus the expected single title. The plain `.riso-source` matches exactly in
both contexts. See [browser reproduction](qa_run-9041/footer-browser-reproduction.json).
The main run reached **Footer Chromium probe**, so the shell repair
does not establish a green whole pipeline. Owner: pm-264/t-1590 engineer and
pm-270 CI acceptance. Repair the two browser reads; do not weaken the title
assertions or waive this defect beside pending work.
These repeated historical failures are defects, even beside a newer pending run;
the shell repair is already present in the tested checkout. The other sampled E2E
failure, run **40345114517**, names the stale Riso assertion in
`e2e/ink-radio.test.ts:39`; this is independently visible in the annotation and
the current full suite passes that test.

Raw logs for jobs **121666695821**, **121654087754**, **121649860247**, and
**121613136055** return HTTP 403, `Must have admin rights to Repository`.
Their annotations are saved, but some messages are truncated by GitHub; unread
raw logs do not establish the absence of additional failures. Run 40330477897's
production failure annotation names deployment
`https://otohime-8vfgwc6u4-otohime.vercel.app`, `inspect exited 1` even though
0740594 subsequently served publicly. This QA does not infer an unseen deploy
root cause from that annotation.

The initial public health response and desk build meta both reported
**074059495faf4bee48e8f655584dfd4487089b41**. Ancestry checks returned 0 for
implementation 0b349dc and prerequisite 9ddd084, and 1 for delivery report commit
3ae76a4. Thus the initial live path demonstrated the gesture, while the exact
final-delivery ancestry remained unproven. The initial desk HTML and its 23
referenced JS/CSS assets were independently hashed; lazy chunks are outside
that asset scan. See [asset hashes](qa_run-9041/live-assets-initial.json).

## Execution boundaries and ownership

Real: locked Node imports, playwright-core launching installed Chrome
154.0.8037.57, CDP touch dispatch, production Next builds and servers, Docker
PostgreSQL **17.11** with migrations, and public production HTTP/browser paths.
The imported PostgreSQL Pool and Drizzle adapter were constructed successfully.
The database image digest is
`sha256:eee6c6e1b0894fa4fe0075eb054af9fd1cf39a35321c2d4110626cfe506411fb`.
Pure trace unit tests use fabricated event records; the browser controls use real
events and an intentionally wrong expectation. No fake runtime proves deployment
or substitutes for browser execution. No model assets apply to this change.

The green gate was read directly from the board: **ver-3593**, run **run-9036**,
sha **3ae76a4**, all four verification items passed. The recorded run succeeded
with **0 callback_apply_failures**; its host is avietidol-mac-mini. This is persisted
verification state, alongside the independent checks here. Model/profile for that
gate run is not exposed and is not inferred from defaults.

- **Integration deployed:** the initial served 0740594 contains implementation
  0b349dc; it does not contain report delivery 3ae76a4. Final state is recorded above.
- **Execution demonstrated:** real desk production-build suites and independent
  live 120px gestures, reload persistence and negative controls.
- **Waiting for capacity:** none. No fake runtime, queued job or soak is used as
  product proof; no future timer is required to diagnose this defect.
- **Product delivered:** the contract's final deployment acceptance remains failed.
- **Defect qa-9041-footer-title:** owner pm-264/t-1590 engineer; exact reads
  `scripts/probe-end.mjs:503` and `:1881`; failure condition is the correct
  Riso heading being rejected due to doubled text. The repair and retrigger are
  specified in the fix plan, with pm-270 acceptance owning main checks/production
  and served-SHA proof. Pending runs cannot waive this observed defect.
- **Deferred qa-9041-ci-desk-recurrence:** origin run **40310239199**, owner
  pm-270 QA/acceptance. The original CI-only timing failure was not reproduced
  here. Fail if a subsequent real main E2E run reports a missing desk precondition
  or wrong 120px drop. No guarantee about every future timing interleaving is made.
- **Deferred qa-9041-raw-history:** owner repository CI maintainer, jobs
  **121666695821 / 121654087754 / 121649860247 / 121613136055**. Raw logs require
  admin API access (403); the older 384 runs are outside the initial scan. Any
  inference about their unread failures remains inconclusive. This diagnostic
  limitation does not weaken the reproduced defect or require waiting to file it.

QA attribution: **run-9041**, profile **codex-sol-6-1-high**, model
**gpt-6.1-sol**, effort **high**, fleet **avietidol-z490**, account codex-main.
The supplied engineer run **run-9006** records profile **claude-opus-high**,
model **claude-opus-5-5**, effort **high**, fleet **avietidol-z490**, and zero
callback application failures. See [metadata](qa_run-9041/metadata.json).

Lessons recorded on the board: deep lease TMPDIR breaks Chrome's singleton socket
unless shortened; this Codex lease also inherited a Claude git identity, so QA
commits explicitly use Codex. The two referenced standing instruction files were
absent from both this checkout and the queried git history; AGENTS.md and the
explicit role contract were followed. The installed Next.js Playwright guide was
read before creating the QA executable.
