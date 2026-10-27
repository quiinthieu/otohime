---
plan_id: pm-264
run_id: run-9048
kind: acceptance_report
verdict: pass
cycle: 0
---

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Public `/play`, 1366×768, JavaScript on | Open Look inside, press Look right, then Disable | Four paper depths moved 84.44, 61.92, 39.11, 16.89 px; Disable unmounted the controller, set `data-running=false`, and restored all four positions exactly | Independent Google Chrome/Playwright walk on `https://otohime.dev/play`; page build meta and `/api/health` both `9bb1daea85c600788c8209819e5c4d69e08b3a46`; no page errors |
| Public `/play`, 390×844, touch viewport | Open Look inside, press Look right, pan the aperture, then Disable | Four depths moved 29.06, 21.31, 13.46, 5.81 px; `touch-action: pan-y`, document scrollY 2051→2814; Disable restored neutral positions and stopped the controller | Independent Chrome viewport and native CDP touch event; same page build SHA; no page errors |
| Initial public Play at both sizes | Inspect the unopened scene and network, then activate | Four server-rendered layers and a still paper sea precede the lazy controller; zero camera calls and zero MediaPipe/model/Wasm requests through activation | Browser DOM and request records; `getUserMedia` trap stayed at zero |
| Reduced-motion Play, 390×844 | Activate Look inside | Four static layers remain; no pose controller or running loop | Separate Chrome context with `prefers-reduced-motion: reduce` |
| No-JavaScript Play, 390×844 | Load the page | Four layers and the Look inside affordance remain in HTML | Separate Chrome context with JavaScript disabled |
| Active Play, 1366×768 | Inspect controls and sibling toys, press Look left | Labelled directional, Center, Enable tilt and Recenter tilt controls are present; Claw, Pond and Ink poster press remain on Play; left input changes the rendered scene | Separate live Chrome interaction and public server HTML |
| Delivered main SHA | Run repository tests in a fresh `npm ci` environment | `npm test`: 2323 pass, zero fail/skip; lint and typecheck exit 0 (10 lint warnings) | This run's `/tmp/pm264-9048-{npm-test,lint,type}.log`; Node 22.23.3, locked Playwright Core 1.64.0, installed Google Chrome |

## Verdict and scope

**Pass for the kept task t-1590.** The split moved Bottle, Theatre and camera tracking to pm-269; those outcomes are outside this acceptance cycle. The pointer/keyboard Peep-box is product-delivered, not merely integrated or queued. Its same-origin static scene and lazy controller run in real Chrome. The negative control is Disable after movement: it restores every layer and removes the controller. Native mobile touch scrolling is a second negative control. The orientation permission and sensor path has only synthetic contract coverage in prior task evidence; no physical sensor was present here. Owner for optional physical-device compatibility: device QA; failure condition: a granted real device orientation fails to change the paper view. No scheduled outcome, capacity wait or operator action applies.

## Identity and history

The deployed component is SHA `9bb1daea85c600788c8209819e5c4d69e08b3a46`, on `main`, with successful GitHub Actions workflow [40358326629](https://github.com/quiinthieu/otohime/actions/runs/40358326629), checks job `121696679994` and production job `121704552870`. Health and live page metadata independently return that exact SHA. `git merge-base --is-ancestor 9bb1dae HEAD` passed. The commit is authored by `Otohime <quiinthieu@gmail.com>` with no Co-Authored-By trailer. The software engineer's task-manager artifact manifest includes `author.txt` (44 bytes, SHA256 `7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`); its bytes were unavailable in this lease, so the Git commit is the independent author check. The delivery task `a8a63804-3ff5-49f0-bb49-6a7874c45e26` is persisted COMPLETED with callbackState `delivered`, one callback attempt and an exit-0 runner tail. Its recorded run profile was `claude-opus-high`, model `claude-opus-5-5`, effort high. This acceptance run's recorded profile is `codex-sol-medium`, model `gpt-6-sol`, effort medium, on fleet worker `avietidol-z490`.

The executable fingerprint includes Peep-box controller `9b7598a0`, loader `d4917ca7`, scene `0cced0aa`, projection `4e666373`, package lock `2d0ec0be` and Next configuration `0321d5e2` (SHA256 prefixes). The prior failed workflow [40352230491](https://github.com/quiinthieu/otohime/actions/runs/40352230491), checks job `121675094950`, failed its Footer Chromium probe and skipped production. That verifier was repaired in the delivered SHA, while the Peep-box and lock stayed unchanged. Fresh real-Chrome heading tests in the current `npm test` passed; the successful delivered checks and production jobs and current live SHA resolve this prior integration defect for the delivered fingerprint.

Bounded GitHub Actions history scan: pages 1–2 at 20 per page returned **40 of 105 failed** main runs and **40 of 445 completed** main runs. The unfiltered current page contained 20 of 445 and no nonterminal run. Older pages are unread and inconclusive. The failed job's public metadata names `Footer Chromium probe`; its annotations show exit code 1, but the raw job-log endpoint returned HTTP 403, so its raw assertion lines were not read. The successful workflow's job and step states were read. Browser page-error logs were empty at both required sizes. This Vercel-hosted repo exposes no application runtime log stream in the checkout; no runtime-log claim is made. No external compute job, model artifact, durable queue or ingestion callback is part of t-1590; the task-manager delivery callback above is the only applicable persisted callback.

No observed defect remains on this scope. Raw historical log access and older history pages are explicit evidence limits, not deferred product checks. Camera permission/inference and the other two toys remain pm-269's scope.
