---
plan_id: pm-270
run_id: run-9203
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: 103f0c5511d4590e66a8a83b1a35acfe870e7ca3
---

# pm-270 Main Lane Throughput: acceptance, cycle 1

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Live site, 09:30Z and 09:44Z | `curl https://otohime.dev/api/health`, then read `<meta name="build-sha">` on `/` | Both report `103f0c5511d4590e66a8a83b1a35acfe870e7ca3` | live-walk.json |
| Live sha 103f0c5 | `git merge-base --is-ancestor <c> 103f0c5` for 9ddd084, bdf721d, 2eaada2, 5dcfe98, 7a71dd0, 5577ec5, 8e69286, e03cf1c, 0b349dc, 9d3f746, c6d09f0, 4c9f325, 4c64080, 741f59c | All exit 0. Every pm-270 delivery and the idea's 9ddd084 are deployed | this report |
| Main CI, push of code commit 741f59c (t-1671) | Read run [40476115672](https://github.com/quiinthieu/otohime/actions/runs/40476115672) (#505) jobs and steps via the API | checks 122094641290 success (E2E 473 s, motion 171 s). production 122101385195 success: deploy step 39 s, terminal/press 97 s | jobs.json |
| Main CI, push of code commit 103f0c5 | Read run [40478220840](https://github.com/quiinthieu/otohime/actions/runs/40478220840) (#506) | checks 122101643247 success (E2E 486 s, motion 172 s, 1021 s total under the 25 min budget). production 122108815375 success: deploy step 29 s, terminal/press 68 s. Live sha advanced to 103f0c5 | jobs.json |
| 1366×768 mouse desktop, Chrome 154, `/` `/desk` `/music` `/projects` `/notes` `/sketches` `/ledger` | Load each page | All return 200 with build-sha 103f0c5, a rendered `main h1` and 0 px horizontal overflow. 0 page errors. 1 third-party console error (YouTube embed `compute-pressure` permissions policy). The only failed requests are 47 aborted RSC prefetches cancelled by navigation | live-walk.json |
| 1366×768 `/desk`, layout cleared | Real CDP touch swipe of 120 px on the music tape | Hit-test lands on `.desk-tape`, `data-dragging` appears, music moves from `left:30%` to `42.5%`, `desk:v1` is stored, and the move persists after a reload | live-walk.json |
| 390×844 touch phone, same pages | Load each page | All 200, build-sha 103f0c5, 0 overflow, 0 console or page errors | live-walk.json |
| 390×844 `/desk` (negative control) | Same 120 px tape swipe | No `data-dragging`, music stays at 30%, nothing is stored, still 30% after reload. The stacked phone desk correctly refuses a drag | live-walk.json |
| Report-only main pushes 8b98265 and 3dc10f8 (projects/** only) | `GET actions/runs?head_sha=<full sha>` | `total_count=0` for both | github-history.json |
| 78 first-parent main commits since 2026-10-26T18:00Z | Classify by changed paths and match to the 50 newest public ci.yml main runs (#456–#506) | 42 report-only commits started 0 runs. All 36 code commits have a run. The last cancelled main run is #451 (2026-10-26T13:39Z, before t-1603), so 0 runs have been cancelled since | public-index-titles.tsv, github-history.json |
| Local checkout 8b98265 (same executable as 103f0c5), `npm ci` locked | `node --test scripts/ci-workflow.test.mjs`, then the closure and gesture suites, then `bash scripts/vercel-deploy.test.sh` | 41/41, 26/26 and 63 assertions pass | this run |

**Verdict: pass.** The outcome the idea asked for exists. Report-only pushes no longer enter the main queue. Code commits are tested and deployed. The motion probe runs in about 170 s with no runtime installers, and its budget is explained in `ci.yml`. A deploy hang can no longer silently time out the job. The site serves a build that contains 9ddd084 and every pm-270 delivery. I read these facts myself, not from a summary.

## How each part of the idea was judged

1. **Queue starvation.** Fixed. The evidence is the commit-to-run matching and the head_sha negative control above. There are 0 runs in progress or queued right now (API `total_count=0`).
2. **Motion-probe stall.** Diagnosed: three silent runtime installers. They were removed (t-1604, `scripts/probe-motion-signed-in.sh` sha256 76972ccd8caf…). The `Motion probe, signed in` step took 167–173 s in every one of the 15 inspected checks jobs where it ran (#487–#506). That is under the 240 s proof bound and the 8 min step cap. The checks job budget is 25 min with a measured comment (`ci.yml:41-45`).
3. **Vercel deploy hang.** Bounded and self-diagnosing. Of the 17 inspected runs, 12 production jobs failed at `Deploy and verify the served sha`. Every one ended fast, 10–141 s for the step and 225 s at most for the job, never at a timeout. Each published a public `::error title=vercel deploy` naming its state and URL. Examples: annotations 121981152892 (#489) and 122096077381 (#504), both `Error: User not found. (404)` from the CLI user bootstrap. That deterministic defect was fixed by 741f59c (REST adapter `scripts/deployment-status.mjs`). Its deploy fingerprint is vercel-deploy.sh 973ede2b7ada…, deployment-status.mjs 8e94c32d4dfc…, ci.yml 42d136bbbff8… and lock 9d0bded9b7c0…. That fingerprint is green in both runs that executed it (#505, #506). The old fingerprint (ce09f182cf42…, no adapter) failed 11 of 11 times (#492–#504, excluding #497 and #499, whose production was skipped). Those failures stay recorded as defects of the superseded script; a successful run on the new fingerprint cures them. The 11:08Z dashboard read was waived by decider esc-419. It is deferred, not delivered.
4. **E2E against next start.** The idea's failures are triaged and repaired. The desk swipe at 841ca69 was a timing flake, repaired by state-observing preconditions (0b349dc). The Kame clock was a timing premise, repaired by 9d3f746. After #487, the E2E step succeeded in 15 of 16 inspected checks jobs. The one exception, #497, has only a Bottle annotation. The live desk swipe above also passes. Among 17 inspected runs there were two further E2E reds. **#487 ebbb06d** (`e2e/riso-headings.test.ts:87/110`, a 404 console error) was a deterministic defect, already fixed: no riso-headings failure appears in any later inspected run. **#497 f08f670** (`e2e/bottle-ui.test.ts:215` sceneTop under enlarged text, Chrome 155) was a single intermittent failure. It is owned by pm-269/t-1648, which is still active, and the E2E step passed in all 9 later runs.
5. **Proof run.** #506 (and #505) have both checks and production green, and the live build-sha advanced to 103f0c5, which contains 9ddd084.

## Open defects (not waived; outside this plan's deliverable)

- **Motion probe negative-control flake.** Run 40464199853, job 122055594240, f3512e8: `not ok - negative: without the guard a sign-in logs "Transition was skipped"` after 3 tries (`scripts/probe-motion-signed-in.mjs:438-465`, sha256 6b36e65d5a7b…, unchanged since). It happened once in 17 runs and has passed 7 times since. Owner: whoever owns the motion probe. Prior QA handed it to pm-270/t-1604, but t-1604 is done, so I raised it as an advisory question to carry into a follow-up. Failure condition: the negative control goes red again, or it can pass without an induced collision.
- **Bottle sceneTop drift under enlarged text.** Run 40460769638, job 122044564423. Owner: pm-269/t-1648. Failure condition: more than 1 px geometry drift in any later run.
- **Vercel dashboard record for the 2026-10-26T11:08Z hang.** Unread; esc-419 decider waiver. Deferred capability, not a gate.

## Boundaries, history and identities

- **Real:** the live site, Chrome 154.0.8037.57 driven by locked playwright-core 1.64.0 (Node 22.23.3, macOS lease), real CDP touch, and GitHub-hosted ubuntu-24.04 runners for the CI identities above. **Fake:** only in the local contract tests (fake `npx`/Vercel API/token in `vercel-deploy.test.sh`, fake dependencies in the closure suite). No fake proves deployment; that is proven by the real production jobs and the live sha.
- **History:** bounded and incomplete. API reads at about 09:42Z: main push runs total 486; FAILED page 1 read 30 of 129; COMPLETED-success page 1 read 30 of 243; cancelled page 1 read 10 of 114; in_progress 0 and queued 0. I read jobs and steps for 17 runs (#487, #489, #492–#506) and annotations for 5 failed jobs. The public HTML index gave 50 runs (#456–#506; run number 462 is absent from the branch=main index). Raw job logs were not requested: prior runs got 403 admin-only. Older history and unread raw tails are inconclusive.
- **Executable identity:** deployed 103f0c5 is identical to 741f59c except `scripts/vercel-deploy.test.sh` and `scripts/verify-bottle-contracts.mjs` (test-only). Both commits are authored and committed by `Otohime <quiinthieu@gmail.com>`.
- **States:** integration on main: yes. Integration deployed: yes, 103f0c5. Execution demonstrated: yes, real CI checks and production plus the live walk. Product delivered: yes. Waiting for capacity: none.
- **Acceptance run:** run-9203, Claude Opus 5.5 (`claude-opus-5-5`). Effort is not exposed in this session.

Evidence: [artifacts/acceptance-run-9203/](artifacts/acceptance-run-9203/), which holds the walk script and result, the API read scripts, the run history, jobs, annotations (reset-link tokens redacted) and the public run index titles.
