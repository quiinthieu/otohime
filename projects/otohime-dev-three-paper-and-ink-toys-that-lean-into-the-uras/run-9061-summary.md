# Theatre focus repair · pm-269/t-1589 · run-9061

The supplied green gate for `6453315` failed at `e2e/kamishibai.test.ts:115`, where Read all cards must focus the revealed list heading. The original six browser cases passed on this worker, but the new production regression deterministically failed on the original build when application animation-frame callbacks were withheld (focus timeout). An animation frame is not a React commit boundary. `TheatreLoader` now records the explicit return-to-list request and consumes it in `useLayoutEffect` after list mode commits. Both the stage and top mode controls use that path. Initial render and preference-only changes do not request focus. Existing assertions remain intact.

## Verification

Fresh `npm ci`; Node 22.23.3, Next 16.4.2, React/React DOM 19.3.0, Playwright Core 1.64.0, Chrome 154.0.8037.57. Actual board record: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, worker `avietidol-z490`. Production build `AgKAOICVeqFrQ5Xf0izHl`.

- PASS 27 focused data/state/babble/sound tests: `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/kamishibai.test.ts lib/ink-babble.test.ts lib/sound.test.ts lib/sound-client.test.ts`.
- PASS 2344 repository tests: `npm test`.
- PASS `npm run lint` (zero errors, 10 existing warnings) and `npm run typecheck`.
- PASS 7 production-browser cases: `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/kamishibai.test.ts`.
- Red control: the new focus regression failed against the original production build, using `SKIP_BUILD=1` and `--test-name-pattern='both Read all cards'`. It passes with the repaired loader, covering both controls while rAF remains withheld.

The runner constructs actual embedded Postgres 17, applies migrations, builds Next, starts the production server and drives real Chrome. ViewTransitions, DOM focus, SVG rendering and native WebAudio nodes/context are real. Unit AudioContext, withheld rAF, removed transition API and synthetic hidden/pagehide events are fixtures. No physical device, subjective listening or native browser zoom claimed: the existing 200% reflow case uses 683×384 CSS pixels at DPR 2. All 11 projects/33 cards, normal directory links, scoped arrows/editable/dialog exclusions, sound/mute/teardown, no-JS and initial/live reduced-motion cases remain green. Conservative transitive Theatre gzip bytes at desktop/touch/200%-equivalent reflow: 22773, 22773, 22773 (limit 40960). Emitted resource paths and hashes are saved in the verification artifact.

## Executable identity and history

Sorted relative path + NUL + file bytes + NUL SHA256, covering all `components/kamishibai/*`, project stories, pure state/babble, sound source, projects page, lock and Next configuration: old gate `6453315` and current base `9bdb3b2` both `82aba5ebf86f7611033894e89a96438b874b30001ace57777dbe66b756840162`; repaired executable `c0151079f94f615717e76d748c5c14f014e39d6d732dc7c2b400c8aa60b7cc09`. Lock SHA256 `2d0ec0bea389a532592da1c7a96f8eb6452a90f055fa37cebb8a39d771791a8b`. Browser-test SHA256 `9978d137e578845310cac7df8f2208fefaec409cb74f7037585a7c3b760254e0`. There are no model/binary assets or changed dependencies in this fix.

Bounded task-manager coding history read offsets 0 and 10, limit 10: 20 FAILED of 81, 20 COMPLETED of 1440; current RUNNING snapshot 5 of 5. Global history is incomplete. Two relevant completed records: original SWE `f6c0ffc1-5a8d-4716-a526-95074b1036fd` (run-9051) and green-gate runner `2f3e053d-24e7-4914-b277-c514996c228f` (run-9056); both have persisted `callbackState=delivered`, `callbackAttempts=1`, and plan rows have `callback_apply_failures=0`. Gate runner raw log (3568 characters, read fully) confirms checkout `6453315` and the browser item failing while the first three passed. Original SWE log is a truncated transcript; its tail shows local 6/6 and push, and cannot establish gate success. The supplied gate assertion and this run's real red control establish the focus defect for that same old executable despite local baseline success. No unrelated historical failure is claimed resolved. No queued external execution belongs to this browser feature.

## Delivery limits

Execution demonstrated locally for the repaired executable; integration deployment and live product delivery remain unproven. No capacity or operator prerequisite. CI/green gate and independent deployed QA are deferred to plan-manager for `pm-269/t-1589/run-9061`; new ids are assigned after push. Failure condition: any failed CI/gate/acceptance check or deployed build lacking this fix. The supplied previous green gate failed; no new CI result was inspected. Stop at the tested push; no pipeline watch or deployed-system probes.

Read repository AGENTS, plan, installed Next ViewTransitions/lazy-loading guides, and the shared chief-of-staff/software-development/frontend documents located at `/data/build-worker/repo/mono-v2/`. Task-specific Next/paper/Vercel scope and push-only handoff take precedence over platform stack/deployment defaults. Build-generated `content/history.json` is restored to its committed baseline. Explicit approach, scope, identity and lesson decisions are recorded on the board.
