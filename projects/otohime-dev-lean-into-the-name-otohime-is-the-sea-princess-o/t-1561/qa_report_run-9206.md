# QA report — pm-271/t-1561 Open Tamatebako (run-9206)

Verdict: **pass**. Cited (deployed) sha: `103f0c5511d4590e66a8a83b1a35acfe870e7ca3`.

QA agent: claude-opus-5-5 (Opus 5.5), quality_engineer role, effort as set by the run profile. The lease is Linux and
runs Node v22.23.3. Dependencies came from `npm ci` against the committed lock.

## Identities

| what | value |
| --- | --- |
| deliveries | `e3852eb46f06192140c7ff292e78444c736e4467` (run-8935), `9ada4e1db31a1e4fca16c14c5018162a7c1682cc` (run-8986) |
| author | both are `Otohime <quiinthieu@gmail.com>`, with no `Co-Authored-By` trailer (`git log -1 --format=%B`, grep count 0). There is no author.txt in the delivery evidence. |
| deployed | `https://otohime.dev/api/health` → `{"ok":true,"sha":"103f0c5511d4590e66a8a83b1a35acfe870e7ca3"}` (`qa_run-9206/health.json`) |
| ancestry | `git merge-base --is-ancestor` reports that 9ada4e1 and e3852eb are both in 103f0c5 |
| deploying CI | GitHub Actions CI run #506 `40478220840` at 103f0c5: success. Job `checks` 122101643247 passed (npm test, deploy-script self-tests). Job `production` 122108815375 passed ("Deploy and verify the served sha", "Verify the deployed sha, terminal and press"). |
| green gate | `gate=green sha=9ada4e1 status=pass` (npm test, lint and build all exit 0) |
| main at QA | `15bb2ac`. 103f0c5..15bb2ac touches only `projects/` reports, with no app, content or package changes. |

## Contract verification (this lease, tree 15bb2ac)

| check | result |
| --- | --- |
| `npm test` | exit 0: 2506 tests pass, 0 fail. Includes the delivery's tests: `tamatebako-render.test.ts` (2 tests, ok 882/883) and `tamatebako.test.ts` (ok 884, 885, 890, 891). |
| `npm run lint` | exit 0: 0 errors and 10 warnings, all pre-existing and none in t-1561 files |
| `npm run build` | exit 0 after `rm -rf .next`. `/ryugu` is static (○). `history:index`: 200 of 623 commits. The rewritten `content/history.json` was restored and is not committed. |
| determinism | Both Tamatebako test files were run alone 5 times: 10/10 pass every time |

## Independent user-path probe on production

`qa_run-9206/probe.mjs` is new for this run. It does not reuse the SWE's e2e or the run-8955 probe. It drives real Google
Chrome (`/usr/bin/google-chrome`) through the repo's locked playwright-core against `https://otohime.dev/ryugu`, and
checks every leaf against `git show` in this checkout, not against history.json. Log: `qa_run-9206/probe-production.log`, PASS (21 checks).

- **Keyboard.** The box starts shut (`aria-expanded=false`) with the replay hidden, and Enter opens it.
  - There is exactly one slider named "Scrub back through the changelog".
  - The note says it is "A changelog replay … not rebuilt", so the replay does not present itself as the old site.
- **Real entries.** Home, then ArrowRight walks all 200 positions. Each position is checked against `git show`:
  sha, UTC committer date and subject all match (0 mismatches). There are 0 unknown shas, 200 distinct commits, and
  each `aria-valuetext` contains its subject.
- **Aged paper.** `data-age` falls at every step forward, and the computed paper/ink/shadow style changes at every step.
  The paper colour never yellows going forward in time. The newest leaf is `rgb(242, 239, 231)` and the oldest is
  `rgb(214, 186, 122)`.
- **Touch** (390×844, `hasTouch`, `isMobile`). A tap opens the box. A tap at the scrubber's left end moves it from
  199 to 0, and age goes to 1.
- **Reduced motion.** With `reduce`, opening the box creates no smoke node. Control: with `no-preference`, smoke rises
  and clears within 2 s.
- **Errors.** No page errors.

My first attempt (`probe-production-attempt1.log`) failed one assertion of my own. It required the background RGB alone
to differ at every one of 199 steps, and 8-bit quantisation makes some neighbours round equal. That is not a product
defect. The decision is recorded, and the corrected assertion also covers monotonic yellowing.

## Negative controls

| control | expected | observed |
| --- | --- | --- |
| `MODE=empty` probe against production | fail | exit 1: "no scrubber" and "the empty box" are not ok (`probe-production-mode-empty.log`) |
| Local build from `git archive 15bb2ac` with an empty `content/history.json` (indexer: "fallback … 0 of 0 commits, unchanged"), `next start` | `MODE=empty` passes | exit 0, PASS. The box opens, shows "The box is empty", has no scrubber and keeps the replay label (`probe-local-empty-build.log`) |
| same empty build, full-mode probe | fail | exit 1: there is no slider, and it times out looking for one (`probe-local-empty-build-mode-full.log`) |

These controls show the probe can tell a real changelog from an empty one, and they exercise the empty-history state
in a real browser.

## CI history read (bounded)

- I read GitHub Actions runs #440–#506, using `actions/runs` pages 1–4 at per_page=20. The total count is 506.
- I read job and step detail for #449, #454 and #506. Run-page annotations for #452–#455 came from public HTML, because
  the API quota (60/h) ran out at 09:58Z and resets at 10:42Z.
- Job logs are unreadable without admin (HTTP 403), so the specific test that failed in #452–#464 is **inconclusive**.
- #454 `40337993898` was the own run of 9ada4e1. Its `checks` job failed at "Run npm test" (job 121624630579, annotation
  "Process completed with exit code 1."). This is not attributed to t-1561:
  - #452 (9d65d9c, t-1562) and #453 (c0368d1) came before 9ada4e1 and failed the same job with the same annotation.
  - 9ada4e1 adds only a test file.
  - The `checks` job passed in #465 (9bb1dae) and in the deploying #506.
- Earlier deploy-step failures (#445 and #449, the vercel-deploy.sh issue in fix_plan_run-8955) are resolved: #506's
  production job deployed and verified 103f0c5.

## Boundaries

- **Real:** the production site, Google Chrome, git history, and the repo's locked TypeScript, React and Next for
  test and build.
- **Fake:** none in the production probe. The empty-history control is a local `next start` of a tree I exported
  with an empty index. The SWE's react-dom/server render test is used only as supporting evidence.

## Defects and deferred checks

- Defects in t-1561: none.
- Deferred: none for this task.
- Noted but not owned here:
  - The cause of the red `checks` jobs in #452–#464 is unread (logs need admin). It predates 9ada4e1 and has
    since gone green.
  - The 10 pre-existing lint warnings remain.
