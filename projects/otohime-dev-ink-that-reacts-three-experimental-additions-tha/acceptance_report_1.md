---
plan_id: pm-243
run_id: run-8403
kind: acceptance_report
verdict: pass
cycle: 1
---

| starting state | action | observable result | evidence |
|---|---|---|---|
| Prod otohime.dev, build-sha 61bbd2c (meta `build-sha`), fresh headless Chromium 1366x768 | Load `/`, wait for idle | Hero canvas present, `data-state=settled`, title "Otohime", signature and handheld visible | screenshot taken during walk (home-1366x768.png, scratch); `scripts/probe-ink.sh` BASE_URL=https://otohime.dev: 51 ok / 0 failed |
| Same prod, 390x844 touch | Load `/` | Canvas `data-state=settled`, layout intact | walk output `home 390x844 ... data-state=settled`; probe-ink 51/51 covers 390x844 |
| Prod, 1366x768 | Load `/play`, click "Stamp it" | Heading "Play" resolves; 11 stamp elements appear after click | walk output; `scripts/probe-stamps.sh` BASE_URL: 77 ok / 0 failed (drag leaves marks, Tidy clears overlay, reduced motion static) |
| Prod, 390x844 touch | Load `/play`, click "Stamp it" | Heading "Play" resolves; 11 stamp elements | walk output; covered by probe-stamps 77/77 |
| Prod, 1366x768 | Click "Ask the console" chip, type `what is shore`, Enter | Dialog opens; receipt prints "FOUND: Shore: A focus timer that leaves sea glass behind." with one link `/shore` | walk output; probe-ask BASE_URL: 50 ok / 0 failed |
| Prod, 1366x768 | Press Escape in the dialog | Dialog closes (`dialog[open]` count 0) | walk output `escape closed=true` |
| Prod, 1366x768 | Ask `pizza recipe` | Receipt "NO MATCH. TRY A PROJECT, A GAME, A NOTE OR 'CONTACT'." with zero links | separate walk script, output captured |
| Prod, 390x844 | Open Ask, type `what is shore` | Bottom-sheet dialog, receipt visible with `-> Shore` link | screenshot (ask-390x844.png, scratch) and walk output |
| Prod | `GET /api/ask` and `POST /api/ask` with no ASK_LLM | Both 404 (LLM tier off, as the operator chose) | `curl` on https://otohime.dev/api/ask: GET 404, POST 404 |
| Prod, both viewports, full walk | Collect page errors and console errors | None at 1366x768 or 390x844 | walk output `errors ...: none` |
| Plan delivery state | `plan_manager_get_delivery_readiness` pm-243 | ready=true, no blockers; t-1487..t-1491 all done, fix_cycle 0, evidence green_gate | tool output |
| Service logs (container `otohime`) | `mcp__cluster__task_manager_cluster_logs`, 1440 min, with and without contains=error | Returned null both times, no lines | INCONCLUSIVE: no log lines readable for this service |

## Cited builds and shas

- Deployed component (otohime.dev): build-sha **61bbd2c871471f05191a63d1359b6d01a6ea5937**, verified in the served HTML.
- Repo HEAD at walk time: `main` 17724fd. Delivery shas, all authored Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer, checked with `git log`:
  - t-1487 c58a037 (ancestor of 61bbd2c: yes)
  - t-1488 21bb9ed (ancestor of 61bbd2c: yes)
  - t-1489 d4cb19c (ancestor of 61bbd2c: yes)
  - t-1490 0238226 (ancestor of 61bbd2c: yes)
  - t-1491 2b6fdd7 (ancestor of 61bbd2c: **no**, it is on main after the deployed build)
- `author.txt` was not in the delivery evidence, so it is not cited.

## Run profile

Acceptance role run-8403, model claude-haiku-5-5, effort default (not overridden). Playwright 1.64.0 headless Chromium, installed into a scratch directory outside the repo, the same pin as the repo probes.

## Real / fake boundaries

- Real: the deployed prod site at otohime.dev (build 61bbd2c), a real browser at both viewports, real Chromium rendering. WebGL in the probe runs on SwiftShader, not a GPU.
- Fake or not exercised: no real Anthropic call, no Postgres. The LLM route tier (t-1491) is not deployed at 61bbd2c; prod shows 404, which is the intended off state. Its 200/429 behaviour is covered only by unit tests (QA rep-4860, 14 tests green), not by this walk.
- The service-log read was inconclusive (see table). Browser console and page errors were clean, but server logs were not read.
- The plan document named in the request (`plan.md` at dd1e8e1) is not present in this repo at this sha. The task contracts from plan_manager were the only spec used.

## Defects

None observed in the user path.

## Deferred checks

- Server logs for `otohime` on prod. Owner: platform operator. Failure condition: any ERROR or 5xx line in the window of the walk. Currently unreadable through the cluster log tool.
- LLM answer tier (t-1491) on prod. Owner: site operator (`ASK_LLM` is unset by operator choice, esc-374). Failure condition: when the tier is enabled, `GET /api/ask` is not 200 with `enabled: true`, or a same-origin POST is not mode "llm" with sources from the index.
- Build 2b6fdd7 is not yet on prod. Owner: deploy pipeline. Failure condition: prod build-sha still 61bbd2c after the next deploy of main, which would leave the t-1491 route unobserved on prod.

## Verdict

PASS. Every user-facing outcome the idea asked for (the ink-particle hero, the rubber-stamp board on Play, and the Ask console with a receipt and NO MATCH behaviour) is present and working on the running product at both required viewports. The LLM tier is off in prod by operator choice and that is the observed state.
