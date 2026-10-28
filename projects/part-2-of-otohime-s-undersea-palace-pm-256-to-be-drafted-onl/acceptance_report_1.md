---
plan_id: pm-257
run_id: run-9385
kind: acceptance_report
verdict: pass
cycle: 1
---

# Ink Ghosts acceptance: run-9385

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Public otohime.dev | GET `/api/health`, `/api/ghosts`, `/api/ghosts?probe=1` | Health ok. It read 7d2a499 first, then **4992aec** (redeployed during the walk; every page I walked served 4992aec in its build meta). Direct config: empty **404**, `no-store`. Probe: **200 `null`**, `no-store` | [prod-result.json](acceptance/run-9385/prod-result.json) |
| Production Home, 1366x768 and 390x844, motion allowed | Open Home | 200. Layer `off`, 0 others, **0 WebSockets**, no horizontal overflow, no page/console errors | same; screenshots hashed in [screenshots.sha256](acceptance/run-9385/screenshots.sha256) |
| Production Home, both viewports | Press the Pocket **Ghosts on** chip, then reload | `aria-pressed` true→false, label "Ghosts off". Survives reload: `localStorage.ghosts=hidden`, 0 sockets | same |
| Production, ghosts hidden, both viewports | Open `/ryugu` | 200. No layer, **0 config requests**, 0 sockets | same |
| Production, ghosts re-enabled, both viewports | Open `/ryugu` | Layer `off`, 0 sockets, no overflow: a quiet fallback because no endpoint is configured | same |
| Production, `prefers-reduced-motion: reduce`, both viewports | Open Home, then `/ryugu` | 0 config requests, 0 sockets, 0 page errors | same |
| Local production build of 6ab6d94 (ghost files byte-identical to 4992aec) with the **actual Worker/DO in local workerd**, `ALLOWED_ORIGINS=http://localhost:3917` | Raw WebSocket upgrades | Allowed Origin **101**. Denied `https://evil.example` **403**. Lookalike `https://otohime.dev.evil.example` **403**. Missing Origin **403**. Unknown room **404** | [local-result.json](acceptance/run-9385/local-result.json), [worker.log](acceptance/run-9385/worker.log) |
| Two visitors on Home (separate Chrome processes) plus one on `/ryugu`, both viewports | Load and wait for the idle loader | A and B: `on`, "1 here", 1 socket each. The palace visitor: `on`, 0 others, no label | local-result.json |
| A and B on Home, both viewports | A moves the mouse | B sees A's ink tip (desktop 97 px, phone 111 px). The other room has **0 px** | local-result.json |
| Same | Trail check right after the move, then at 400 ms and 1200 ms | Trail band 0.85 along the path: desktop **83 px → 0**, phone **85 px → 0**. The tip stays visible (≈40 px after 1.5 s) | [trail-result.json](acceptance/run-9385/trail-result.json), [msg-probe.mjs](acceptance/run-9385/msg-probe.mjs) |
| Same | A clicks an empty spot | Pointer hits the page (`section`/`svg`), not the overlay. Local ripple 70/66 px; peer ripple 112/92 px. Both counters advance. Other room: 0 ripples. Peer ripple fades 112→41 and 92→41 px (the remaining pixels are the tip) | local-result.json |
| B on Home with ghosts on | B presses the Pocket chip (hit-test lands on the chip itself, focusable) | B goes `off` with **0 canvas pixels**. A sees 0 others within 5 s | local-result.json |
| B with ghosts hidden | Reload Home, then open `/ryugu` | No layer and **0 sockets** on both. Stored value `hidden` | local-result.json |
| B: a `/ryugu` tab plus a Home tab | Toggle on, then off, from Home | The palace tab turns `on`, then `off`, through the cross-tab storage event | local-result.json |
| B visible to A | B moves, then closes its tab | A's tip pixels 74/78 → **0**. Others → 0. "here" label removed | local-result.json |
| Two visitors on `/ryugu`, one on Home | Palace visitor moves | Palace peer sees 100/51 px. Home sees **0** | local-result.json |
| Reduced-motion visitor | Open Home, wait 3 s | `off`, 0 sockets. Existing visitors see 0 others | local-result.json |
| A connected | Browser offline, then online | Stops while offline, then reconnects | local-result.json |
| **Negative control**: viewer with canvas `stroke`/`fill` disabled | A clicks | Ripple counter advances (0→4, 0→5) but ripple pixels are **0**, so the same pixel assertion rejects it | local-result.json |
| All local contexts, both viewports | Collect page and console errors | None | local-result.json, [app.log](acceptance/run-9385/app.log) |

## Verdict

**PASS for the observable scope. Live hosted fan-out is DEFERRED and NOT DELIVERED.**
I do not claim that real visitors on otohime.dev see each other's ink today.

The deployed application **4992aec82c18135f37279f973527789bed92c9c8** contains every delivery: t-1607 5139d4f, t-1608 a6723c1, t-1609 cce131d, t-1610 3684cb5 and t-1611 4a1c848. For each, `git merge-base --is-ancestor` exits 0. Its CI run [40666892164](https://github.com/quiinthieu/otohime/actions/runs/40666892164) shows 5 jobs completed successfully and 2 skipped. In production the feature is dark behind `GHOSTS_ENDPOINT`, as the idea specified ("behind an environment flag", "graceful … unset-endpoint fallback"). A visitor gets a quiet, error-free site at both viewports, a working persisted Pocket hide toggle and reduced-motion suppression.

With the actual locked Worker and Durable Object in local workerd, the full outcome works on Home and `/ryugu` at both viewports:
- anonymous peer cursors, fading trails and click ripples
- room isolation and departure clearing
- the persisted, cross-tab Pocket hide
- reduced motion and offline handling
- denied-Origin rejection

No code defect was observed.

The production fan-out is missing only because of operator chore **esc-444** (`cloudflare-credentials:otohime-ghosts`). The decider resolved it as "cannot be done now", so per my rules I neither raise it again nor hold acceptance for it. The Worker workflow `ghosts.yml` has 2 of 2 runs in its exhausted history, both **skipped**: 40656021737 and 40619191293. There are 0 failed, 0 successful and 0 current runs. No hosted Worker version, Durable Object deployment or hosted fingerprint exists.

| Claim | Status |
| --- | --- |
| Integration deployed | Yes for the app (4992aec, dark). No for the Worker (never deployed) |
| Waiting for capacity | No |
| Execution demonstrated | Yes: actual Worker/DO in local workerd, real Chrome, production Next build |
| Product delivered to real visitors | **No.** Deferred to esc-444 |

## Identities

| Component | Identity |
| --- | --- |
| Deployed app SHA | `4992aec82c18135f37279f973527789bed92c9c8` (health and page meta, re-read at the end of the walk); CI 40666892164 |
| Deployed Next BUILD_ID | Not exposed by health/meta; **unavailable**. I did not substitute the local BUILD_ID |
| Local walked build | main `6ab6d94`, Next BUILD_ID `B_xTb1OM7AL-3basZhFY8`. `git diff 4992aec 6ab6d94` over ghosts/, the page mounts, `app/api/ghosts`, handheld, root package/lock, `ghosts.yml` and next.config is **empty** |
| Worker code + lock + config fingerprint | `aa87b9e3b4328f59801de5028120046f3c244f4f55e7e26d661b16d02b6a7115`; lock `b49cf8d3…7bd7`; wrangler.jsonc `72986fca…c80d` |
| Local Worker version (wrangler dev, not hosted) | `4fa46ea4-84ee-42e3-b9a4-9ebc9ad55833`. `/version` reports fingerprint `unbuilt` under dev, because the deploy job stamps it |
| Hosted Worker version / DO deployment | **Unavailable**: never deployed |
| Runtime | Node 22.23.4 (official tarball, SHA256 verified), npm 10.9.9, Next 16.4.2, playwright-core 1.64.0, system Google Chrome, Wrangler 4.152.0 from the Worker lock; root and Worker `npm ci` from unchanged locks |
| This run | Acceptance run-9385, recorded flags `--model claude-opus-5-5 --effort high`, fleet billie-mac |

## Real/fake boundaries

- **Real:** production site and network (read-only, no interception); locally, the actual Worker/DO in workerd with real bindings, the Next production server with an embedded Postgres, native WebSockets, canvas backing-store pixels, localStorage events, and Chrome reduced-motion and offline emulation.
- **Synthetic:** pointer input is scripted; the Worker origin allowlist is set to the local app origin; the extra `offline`/`online` events are dispatched alongside Chrome's offline emulation.
- **Not used:** the repository's fake fan-out server and the tasks' own test scripts. All four drivers in `acceptance/run-9385/` are new for this run.
- **Not exercised:** hosted Cloudflare edge, real hibernation and a production denied-Origin request. There is no hosted endpoint to send one to.

## Probe errors kept on record

My first walk failed 2 of 29 rows: the desktop "trail" and "trail fades" checks, shown in [walk-local.log](acceptance/run-9385/walk-local.log). The probe assumed a 0.5 s glide and sampled the path midpoint. Measured, Playwright's scripted glide took **2.72 s**, and B received 19 move frames with 103–206 ms gaps, which is within the 10 Hz limit. With `TRAIL_MS=700`, only the newest segments of that path can still be visible, so the midpoint had already faded. The focused trail probe above samples bands along the path and shows paint, then decay.

The production walk's final "health unchanged" row failed because production redeployed 7d2a499 → 4992aec during the walk. The pages had already served 4992aec throughout. Neither failure is a product defect, and neither is hidden.

## Logs and history

- **Local logs:** the app log has no errors. The Worker log lists only `/ghosts` upgrade lines: 101 for allowed joins, 403 for my denied-Origin controls, 404 for the unknown-room control. No coordinates or visitor data appear.
- **Production logs:** Vercel runtime logs are unavailable without an account. The hosted Worker does not exist.
- **Project tests:** the `npm test` and Worker `test:local` results for this run are in [verification.json](acceptance/run-9385/verification.json).
- **CI history** ([history.json](acceptance/run-9385/history.json)): the GitHub REST API was rate-limited (60/60 used), so I read the public Actions pages instead.
  - `ghosts.yml`: the history is complete, as stated above.
  - `ci.yml`: failures read 25 of 159 and successes 25 of 286 (page 1 only); 3 runs in progress, 0 queued. Older pages and raw job logs were not read, so they are inconclusive.
- **Latest failure read:** 40664399593 at c1d4726, a Footer walk "expected 3 SVG layers … found 4". It belongs to pm-274/t-1585 and is not ghost code. The deployed 4992aec's own run is fully green; replacement runs 40668245716 (53867bf) and 40668740377 (6ab6d94) were still in progress. Those remain pm-274's responsibility and do not waive that failure.

## Deferred and remaining checks

| Check / id | Owner | Failure condition |
| --- | --- | --- |
| Install Cloudflare secrets, set `GHOSTS_DEPLOY_ENABLED=true`, dispatch `ghosts.yml`, set Vercel Production `GHOSTS_ENDPOINT` (**esc-444**, `cloudflare-credentials:otohime-ghosts`) | Operator, daily digest | No change until it is done: the site stays dark, and that is the expected state, not a defect |
| Live two-browser walk on otohime.dev Home and `/ryugu` once `GHOSTS_ENDPOINT` is set, binding Worker `/version` to fingerprint `aa87b9e3…` and the app SHA | Next QA/acceptance after esc-444 | Fails on: no peer ink, trail or ripple; failure to clear on departure; cross-room leakage; Pocket or reduced motion not stopping the socket; `/version` mismatch |
| Production denied-Origin control: one raw upgrade with `Origin: https://evil.example` to the hosted `/ghosts` | Same | Fails if the upgrade is accepted (anything but 403) or a valid otohime.dev join is refused |
| Rollback | Operator | Unset Vercel `GHOSTS_ENDPOINT` and redeploy; set `GHOSTS_DEPLOY_ENABLED=false` (see activation.md) |

**Observation, not a defect:** while the site is dark, the Pocket chip reads "Ghosts on" even though there are no ghosts to see. It reflects the stored preference as contracted. Hiding the chip while unconfigured would be a product choice for a later plan.
