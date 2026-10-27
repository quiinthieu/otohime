---
plan_id: pm-259
run_id: run-9226
kind: acceptance_report
verdict: pass
cycle: 0
---

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Live `/projects`, 1366×768, fresh Chrome context | Keyboard activate first card's Fetch back, then Peel corner | Fetch proxy appeared and returned; card remained 304×157 at (313,176), `/shore` href intact; state became `peeled` | Independent Playwright/real Chrome walk, 2026-10-27; browser console, page errors and HTTP 5xx: zero |
| Live `/notes`, 1366×768 | Keyboard Fetch back and Peel corner | Proxy appeared and returned; card remained 664×130 at (313,148); state became `peeled` | Same independent walk; zero captured errors |
| Live `/projects`, 390×844 | Keyboard Fetch back and Peel corner | Proxy appeared and returned; card remained 169×157 at (20,242), `/shore` href intact; state became `peeled` | Same independent walk; zero captured errors |
| Live `/notes`, 390×844 | Keyboard Fetch back and Peel corner | Proxy appeared and returned; card remained 350×150 at (20,193); state became `peeled` | Same independent walk; zero captured errors |
| Live `/projects`, 1366×768 with Peek opened by real mouse hover | Move mouse continuously from project title to Fetch back, click, then click the native project link | Hit target was Fetch back; proxy returned; page stayed at `/projects` until native link click navigated to `/shore` | Separate independent Chrome pointer walk; source href `/shore` |
| Live `/projects`, 390×844 with `prefers-reduced-motion: reduce` | Keyboard activate Fetch back | Kame remained `nap`, `data-motion=still`, zero animated fetch proxies | Independent negative control in real Chrome |
| Deployed service | Read `/api/health`; compare Git ancestry and exact workflow run | Healthy SHA `739ca990a632e31ca718924346bf6b8e1fc387e1`; it contains deliveries `f83c73f`, `7735e74`, and the exact t-1625 delivery; checks and production succeeded | Health JSON; local `git merge-base --is-ancestor` all exit 0; GitHub run `40499670850`, jobs `122173896509` and `122181114192` |

## Verdict and scope

**Pass for pm-259's kept recovery scope.** Live Kame, paper peeling and safe fetch are delivered. The crumple ball, basket, ironing and remaining composition were moved to pm-274, so they are outside this verdict. This is product delivery, beyond integration or queued capacity: the exact deployed SHA is observed in health and native browser input. No runtime capacity or callback queue is involved in this synchronous website path; callback/ingestion state and model artifacts are not applicable.

The live component identity is `739ca990a632e31ca718924346bf6b8e1fc387e1`, authored `Otohime <quiinthieu@gmail.com>` with no Co-Authored-By trailer. No `author.txt` accompanies this delivery. The exact CI workflow includes successful lint, typecheck, 2523-test repository suite, full E2E, signed-in motion, both footer probes, deploy and served-SHA verification. This run independently executed `CI=true npm test` (2523 pass, 0 fail/skip), `npm run lint` (exit 0, 10 warnings), and `npm run typecheck` (exit 0). `npm ci` installed the unchanged lock; Playwright-core and the real Chrome application launched successfully. Browser input was real Chrome mouse and keyboard, with no fake runner. Touch drag, blocked-storage and Save-Data paths were not independently repeated here; the exact green CI browser contract covers them.

Fingerprint at the observed source tree: `package-lock.json` SHA256 `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`; `.github/workflows/ci.yml` `ef6d19d53cf3b6a1499559549776ceaf50866a35fe99dfb995637b6be825788a`; `scripts/vercel-deploy.sh` `973ede2b7ada96d1c3dbb57ff26021ea1e93d0fb314e55d106629d366020d85f`; `scripts/verify-deploy.sh` `7cd0751ea5ff2482921fc73b8da8f18e2a1cb512cdefa56b498803e8644d9d0a`. The health SHA exactly matches the CI head, so the current checks, deploy and live executable share a commit; older failures are not attributed to it. No external model or binary artifact participates.

## History, logs and limits

Public GitHub Actions API scan: FAILED page 1–2 read 60 of 144, COMPLETED page 1–2 read 60 of 515; current in-progress and queued pages 1–2 each read 0 of 0. Pages overlap, and older history is unread; this is a bounded, incomplete scan. The current exact run has four jobs: checks and production succeeded; cleanup and preview were intentionally skipped. Historical inspect job `121600218178` and current checks job `122173896509` raw log requests both returned HTTP 403; their raw tails are inconclusive. The historical inspect failure remains an unresolved historical cause, not a demonstrated defect of the current executable. Browser page errors, console errors and HTTP 5xx were captured during all four walked route/viewport combinations and were empty. Direct Vercel runtime logs are not exposed by the documented unauthenticated path; current production job metadata and live health are the independent available service evidence.

Run attribution: acceptance `run-9226`, recorded profile `codex-sol-medium`, fleet worker `avietidol-mac-mini`, account `codex-main`; model and effort are not exposed in the run record and are not inferred from today's defaults. No deferred product check or watch is requested: this outcome has no natural schedule. The remaining unread historical raw failure is owned by the CI/provider operator if access later becomes available; it would become a current defect only if the same fingerprint reproduces a red check, deploy failure, or broken live path.
