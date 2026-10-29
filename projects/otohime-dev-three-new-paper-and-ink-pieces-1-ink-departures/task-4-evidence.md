# pm-301 / t-1788 — Ink Departures integration

Run `run-9765`, software engineer, 2026-10-29. Branch `pm-301-t-1788-ink-departures`, freshly fetched base `3977e52e3ecd5cc27082d6aae4fc976fd34c03dd`. Delivery identity is the enclosing commit, resolved through `run-9765/artifacts/commits.txt` and supplied as `git_sha` in the plan-manager summary.

## Behavior and scope

Both `/work` and `/projects` mount `DeparturesBoard` with the existing deterministic builders: 10 pipeline/stack rows and 11 projects. The named section contains a native table, caption, column and row headers, permanent real code/name/schedule/status text, project links and explicitly illustrative schedule/status labeling. Decorative character drums are hidden from assistive technology. DELAYED uses theme-aware vermilion ink. Controls have 44px minimum targets; the table scrolls within its region on narrow screens.

The feature stylesheet is imported by the client component; `app/(site)/globals.css` is untouched. Scroll animation runs only under `prefers-reduced-motion: no-preference` and `@supports (animation-timeline: view())`. A scoped named view timeline on the outer board avoids the horizontal scroller capturing descendant timelines. Click, Enter and Flip all run the same bounded JS fallback in every browser: at most 12 frames at 70ms intervals, finishing at the true status. Semantic text never cycles. Hidden-document, preference-change and effect cleanup settle/cancel the timer. The stylesheet's final reduced-motion block disables animations and transitions with `!important`.

Sound uses the existing shared store and sole AudioContext. It is muted by default, never triggered by scrolling, and produces at most one three-note clack per board per 60ms, including simultaneous rows and rapid restarts. The board opts out of the site's global press cue. Reduced motion suppresses all board clacks and the sound toggle's confirmation cue; optional silent preference updates still persist and notify subscribers. An optional custom-cue policy is rechecked after asynchronous audio resume. No CUES keys or extra AudioContext constructors were added. Existing ViewTransition, FigTitle, DarumaBoard, cartridge-slot and project-title behavior remains intact.

## Verification results

Locked dependencies installed with `npm ci`. Runtime: Linux x64 build-worker lease, Node `v22.23.3`, npm `10.9.9`, Next `16.4.2`, Playwright Core `1.64.0`, Google Chrome `156.0.8078.47`, embedded Postgres `17.10.0-beta.17` (binaries report PostgreSQL `17.10`). The local Codex process invocation exposed model `gpt-6.1-sol` with reasoning effort `high`; no other named runtime profile was supplied. Read installed Next CSS, client-directive and server/client component guides before coding. Configured and checked the repository-local Otohime author identity.

| Check | Actual command | Positive result |
| --- | --- | --- |
| departures-e2e | `TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/departures.test.ts e2e/senko.test.ts` | exit 0; 17 named tests passed: 10 Departures and 7 Senko; 0 failed/skipped |
| repository tests | `TMPDIR=/tmp npm test` | exit 0; 2,794 passed, 0 failed/skipped; includes `lib/motion.test.ts`, departures and sound regressions |
| typecheck | `npm run typecheck` | exit 0; route generation and `tsc --noEmit` succeeded |
| lint | `npm run lint` | exit 0; 0 errors, 13 pre-existing warnings in untouched files |
| closure | `TMPDIR=/tmp node scripts/check-gate-closure.mjs` | exit 0; certified `otohime.gate-closure.v1`, preflight passed, local_controls=pass, failures=[]; 31 tests and all 10 required named regressions passed |
| whitespace | `git diff --check` | exit 0 |

After the build, restored only generated `content/history.json` using the contract's `git checkout -- content/history.json`. No generated build output, lock changes, binaries or screenshots are included in delivery.

Final combined browser TAP:

```text
ok 1 - /work at 1280px serves the full semantic final timetable without JavaScript
ok 2 - /projects at 1280px serves the full semantic final timetable without JavaScript
ok 3 - /work at 390px serves the full semantic final timetable without JavaScript
ok 4 - /projects at 390px serves the full semantic final timetable without JavaScript
ok 5 - /work click, Enter and board fallback change real drums in at most 12 steps and settle
ok 6 - /projects click, Enter and board fallback change real drums in at most 12 steps and settle
ok 7 - native scroll timeline turns drums; delayed hanko ink works on light and dark paper
ok 8 - muted negative control, shared opt-in and board-wide 60ms real clack throttle
ok 9 - /work reduced motion has zero steps, animations or sound even after opt-in
ok 10 - /projects reduced motion has zero steps, animations or sound even after opt-in
1..17
# tests 17
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 51127.911078
```

Final repository TAP:

```text
1..2776
# tests 2794
# suites 2
# pass 2794
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 41461.952156
```

These are assertions beyond exit status: no-JavaScript contexts check every final row, accessible status cell and link; DOM MutationObserver evidence checks actual changing glyphs and bounded step values; CSS animation is forcibly disabled for click/Enter fallback tests; real viewport scrolling changes computed transforms; both themes change the delayed ink. Fresh contexts prove zero AudioContext construction/notes while muted and under reduced motion even after opt-in. Enabled sound produces three real oscillator starts per clack, one context, and >=60ms between clacks despite eight simultaneous restarts. Muting mid-flip prevents subsequent notes. Changing reduced motion mid-flip settles all rows without replay. Focused unit tests also prove silent preference persistence and suppression after delayed resume.

## Executable identity and failure resolution

The final production build ID was `YmM_9hnYQNkM1Uur5TRKE`. Its locked imports, migrated real Postgres instance, real Next server, Chrome DOM and Web Audio node scheduling executed successfully. Closure additionally preflighted actual imports of playwright-core, pg, embedded-postgres and its platform package against the lock, and executed all three Postgres binaries with recorded hashes.

Final executable-input fingerprint: `a1470820f9d572ff2de28ac94b758c936bd97821f7e0bd56faa416e27490eefb` (SHA-256 of the sorted compact JSON file/hash map below).

```text
da7af6830804a460596eefd65f73dc2c2216feef0d276e4e5b33d6958f555c5e app/(site)/(app)/projects/page.tsx
479a8f7eecaa552d1fc68648d2d3ae4dbc308b530cb6d994cf723789b8fd90c0 app/(site)/(app)/work/page.tsx
bd5e446ce4672ed430e770c5345812cbf96e7e71ca253b8fa9a7c49a941e073f components/departures-board.css
5c210aae41c8d376512cfdf8f399f5c5bfaa24888bcf75c96351154cf8818fe1 components/departures-board.tsx
1b557d5a091badfe4c8a0f1eb868be2df3f8aa5775acdad2ee3ba1ddc5d6f98b e2e/departures.test.ts
b277b7f6b0f028df091316a3f601125c16f96acf448b1e69b0f8630535345dc0 lib/departures.ts
4566d911ac0611dcc0a796999f4e55214b24e641c89dda0265e30ac4ea22f8ad lib/sound-client.test.ts
0549f917adf366d3ee97570f58768658935c55f6265b1f9fddc2ca77de270ec2 lib/sound-client.ts
321b992409329951687bbdf81ff936fd317055490a1c438e15a22abfe7f6606d next.config.ts
9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b package-lock.json
```

Read raw local failures before correcting them: the first build caught a DOM TypeScript property missing from the installed typings (use `getPropertyValue`); the first completed browser attempt passed 14/17 and exposed inert scroll transforms and fractional 44px geometry assertions. The named outer timeline fixes the actual animation defect; hit-target tests assert computed minimums plus a 0.01px geometry tolerance. A superseded attempt using `waitForFunction` in a JavaScript-disabled context was cancelled; no such wait remains. The final build reran both full browser suites after implementation changes. All observed failures are resolved on the fingerprint above, rather than attributed to a later unrelated SHA.

## Evidence boundaries and ownership

Local execution and product behavior are demonstrated in a real production build. The E2E runner's existing Ghosts service is a fake unrelated remote service; Node audio-policy unit tests use a fake context and deferred resume. Browser audio instrumentation delegates to real AudioContext/oscillator methods and observes node scheduling; it does not prove physical speaker output. Page clocks, synthetic preference changes and rapid clicks are explicit test inputs. Browser screenshots were inspected locally and remain only under `/tmp`.

Integration deployed: unproven. Production product delivery and independent QA: pending plan-manager's green gate/QA for the pushed delivery SHA. Waiting for capacity: none; there is no queued runtime job or operator prerequisite. Current/FAILED/COMPLETED remote job history: 0 pages read, incomplete, no remote-history conclusion. The complete final local TAP was read; no pipeline or deployed-system checks were run. Per the role contract, stop after pushes and submit the summary. Plan-manager owns remote CI (failure at this exact delivery SHA returns the task) and subsequent deployed QA. No in-scope local defect remains and no capacity deferral waives a defect.

Decisions and lessons were recorded through plan-manager, including the absent extraction/software-development documents, use of existing policy/tests, non-vacuous verification, shared-sound regression coverage, the scroll-container timeline trap and asynchronous audio policy. No knowledge-graph tool was available; relevant source and installed docs were inspected directly.
