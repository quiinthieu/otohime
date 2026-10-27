---
plan_id: pm-259
run_id: run-9227
kind: acceptance_report
verdict: pass
cycle: 0
---

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Live `/projects`, Chrome 1366×768 | Keyboard Fetch back, then Peel corner | Fetch proxy appeared and completed; first card rectangle and hrefs stayed identical; paper state became `peeled` | Independent real Chrome walk on 2026-10-27; page/console/HTTP 5xx errors: 0 |
| Live `/notes`, Chrome 1366×768 | Keyboard Fetch back, then Peel corner | Fetch proxy appeared and completed; rectangle and hrefs stayed identical; state became `peeled` | Same independent walk; errors: 0 |
| Live `/projects`, Chrome 390×844 with touch enabled | Keyboard Fetch back, then Peel corner | Fetch proxy appeared and completed; rectangle and hrefs stayed identical; state became `peeled` | Same independent walk; errors: 0 |
| Live `/notes`, Chrome 390×844 with touch enabled | Keyboard Fetch back, then Peel corner | Fetch proxy appeared and completed; rectangle and hrefs stayed identical; state became `peeled` | Same independent walk; errors: 0 |
| Live `/projects`, open Peek fan at 1366×768 | Approach Fetch back with a real mouse, click, then click the project title | Fetch back was the actual hit target; fetch completed on `/projects`; native title link navigated to `/shore` | Separate real Chrome pointer walk; page errors: 0 |
| Live `/projects`, 390×844, reduced motion | Keyboard activate Fetch back | Kame reported `data-motion=still`; no animated fetch proxy appeared | Independent negative control in real Chrome |
| Production service | Read `/api/health`, Git ancestry and exact delivery workflow | Served SHA `739ca990a632e31ca718924346bf6b8e1fc387e1` contains f83c73f and 7735e74; workflow 40499670850 checks and production succeeded | Health JSON, `git merge-base --is-ancestor`, GitHub jobs 122173896509 and 122181114192 |

## Verdict and proof boundary

**Pass for pm-259's kept recovery scope.** Kame, paper peel and safe fetch are in the running product. The split assigns the remaining crumple, basket and ironing work to pm-274; this report makes no delivery claim for that scope. Product delivery is demonstrated by the exact healthy production SHA and real Chrome input. No job is waiting for capacity. This synchronous website path has no model, runtime callback or persisted ingestion job; those checks are inapplicable, not silently satisfied.

The deployed component is `739ca990a632e31ca718924346bf6b8e1fc387e1`, authored `Otohime <quiinthieu@gmail.com>` without a Co-Authored-By trailer. No delivery `author.txt` was present. The locked install used `package-lock.json` SHA256 `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`, Node 22.23.3, `playwright-core` 1.64.0 and the actual Chrome application. Its browser imports and construction worked in the installed environment; no fake runner was used. At the served commit, `.github/workflows/ci.yml` SHA256 is `ef6d19d53cf3b6a1499559549776ceaf50866a35fe99dfb995637b6be825788a`, `scripts/vercel-deploy.sh` is `973ede2b7ada96d1c3dbb57ff26021ea1e93d0fb314e55d106629d366020d85f`, and `scripts/verify-deploy.sh` is `7cd0751ea5ff2482921fc73b8da8f18e2a1cb512cdefa56b498803e8644d9d0a`. The newer checkout changes workflow/history outside the served executable and has its own in-progress run; its SHA is not substituted for the live identity.

The exact delivery workflow's checks job records successful build, migration, entire E2E, signed-in motion and both footer probes; its production job records successful Vercel pull/build, migration, deploy and served-SHA verification. Independently, this run installed the lock and ran `CI=true npm test`: a concurrent first run had one Ledger geometry timing assertion fail while Chrome ran, and a quiet full rerun passed **2526/2526, zero skips**. `npm run lint` passed with ten warnings and `npm run typecheck` passed. The Ledger failure was outside pm-259's served fingerprint and did not reproduce on the identical checkout; it is recorded rather than attributed to the deployed feature. The current browser walk observed no product defect. Mobile touch drag, blocked storage and Save-Data were not repeated independently here; the exact green delivery workflow covers its browser contract, while this run independently used mobile touch-enabled Chrome, keyboard input and the reduced-motion control.

## History, logs and deferred evidence

The bounded public GitHub scan read FAILED pages 1–2: **60/144**; COMPLETED pages 1–2: **60/515**; in-progress pages 1–2: **1/1**; queued pages 1–2: **0/0**. Status sets overlap and older pages were unread, so the history scan is incomplete. The current in-progress run `40507321301` is for newer SHA `9b4a2cc`, not the deployed fingerprint, and is not awaited or used to waive a defect. Historical production failure job `121600218178` and exact successful checks job `122173896509` raw log requests returned HTTP 403. Their raw tails and historical failure cause remain inconclusive. The older repeated failures had different code/configuration fingerprints; no current repeated deterministic failure was observed. The browser walk captured page errors, console errors and HTTP 5xx responses for each route and viewport and found none. Direct Vercel runtime logs are not exposed through the available unauthenticated interface; public production job steps and live health were inspected instead.

Deferred evidence: historical raw log access for job `121600218178` is owned by the CI/provider operator if access becomes available; it becomes a present defect only if the same executable fingerprint reproduces a red deployment or broken live path. The newer SHA's pending run `40507321301` belongs to that separate delivery owner; failure there must be judged against its own code/configuration fingerprint. No acceptance watch is needed because pm-259's kept outcome has no natural schedule or pending required product execution.

Run attribution: `run-9227`, recorded profile `codex-sol-medium`, model `gpt-6-sol`, effort `medium`, worker `billie-mac`, account `codex-main`.
