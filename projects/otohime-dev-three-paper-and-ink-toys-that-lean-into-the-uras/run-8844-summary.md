# Delivery summary · pm-264/t-1590 · run-8844

Retain and deliver the rescued pointer/keyboard and explicitly enabled tilt Peep-box on `/play`. The paper SVG is server rendered; four depths project independently through a fixed aperture. Inputs load only after Look inside. Calibrated tilt, exclusive source handoff, bounded smoothing and lifecycle teardown preserve reduced motion and native scrolling. Camera code, permissions, workers and model downloads are absent. Existing Claw, Pond and Ink Press remain available.

## Local verification

Fresh `npm ci` completed with the committed lock. All four build-contract commands exited 0:

| Verification | Result |
| --- | --- |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/peep-box.test.ts` | 6 passed, none skipped |
| `npm test` | 2,133 passed, none skipped |
| `npm run lint && npm run typecheck` | Passed; 10 existing lint warnings, no errors |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/peep-box.test.ts` | Fresh production build and 8 browser cases passed, none skipped |

`SKIP_BUILD=1 npm run test:e2e` also exited 0 against the same production build: **110 passed, none skipped**. Complete results are recorded in shared artifact `peep-full-browser.log` before commit/push, including the retained Kame 499/500ms negative/positive boundary assertions.

At 390×844 and 1366×768 the conservative incremental gzip upper bound is **8,456 bytes**, attributable CLS **0**, and stabilized inactive rAF **0**. Moving input produces nonzero attributed frames as a negative control. CDP touch input actually scrolls the page. Camera calls, Worker constructions and camera/model/Wasm requests are zero. Coverage includes analytic SVG screen geometry, keyboard/pointer, grant/denial/unavailable tilt, calibration/rotation, late permission cancellation, rest/offscreen/hidden/pagehide/Disable/route exit, live reduced motion, Save-Data and no-JS.

## Identity and evidence boundaries

- Actual run profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`; worker `avietidol-z490`, account `codex-main`.
- Node 22.23.3, Next 16.4.2, React 19.3.0, Playwright Core 1.64.0, Chrome 154.0.8037.57. The real runner imports and constructs embedded Postgres 17, applies migrations, builds and starts Next production; no fake runner substitutes for those dependencies. All scene assets are source SVG/CSS.
- Final production build `Gc-DZDimCpinBxFycHj1H` (initial pre-rebase build `NBl-xF5jR7OIxk1Y8hfvB`). Subsystem source/lock/config SHA256 fingerprint `6d4b115e33cfb82bdae3c9ded455c7817f7d92746fab693b7896e20f876e73c3`: sorted path + NUL + content + NUL for the Play page, four Peep-box components, pure library, package lock and Next config. Per-file identities are in shared artifact `peep-box-build.json`.
- Emitted Play chunk `32g9fvu743qtq.js`: SHA256 `b399ef8c91621fa7d2ababe12c896d4fa74bbfa2ea1560dd218aab0c7bacdce1`, gzip 5,281 bytes; lazy controller `3y01lkwuqj4_p.js`: SHA256 `3570b1f30dfed72f4f83c6c15e8ba2dbb5c95bcc7b328f0ddacdba6ed4b12c23`, gzip 2,637 bytes; scoped source CSS gzip 538 bytes. Existing shared runtime excluded.
- Real: production dependency construction, browser layout, SVG transforms, input events, lifecycle, touch scrolling and resource observations. Synthetic: orientation values/permission, visibility events and Save-Data. Physical device sensors are unproven and explicitly not a delivery gate. No independent QA claim is made by rerunning the engineering suite.

## Recovery and history

Read prior run `run-8819`, persisted terminal failure and its raw runner tail. The tail is explicitly truncated (earlier lines omitted), so overall prior history remains inconclusive; current complete local logs supply this run's execution evidence. The unpaginated plan-run endpoint returned four rows: two succeeded research/planning runs, failed SWE `run-8819`, and current SWE `run-8844`. No completed SWE or green gate exists yet for this task. Red gate `ver-3533` is pinned to `095c899` and fails because the new unit/browser files are absent at that original plan SHA.

The actual previous failure is `push_not_on_main`: saving `85b0eb1` to a side branch did not integrate delivery. This runner already prepared local main with rescue commit `3b2faf8` on `0c4a25d`; no initial checkout or extra rebase was performed. Keep every rescued executable/test change, including the Kame 499/500ms clock fixture repair. Drop only the incidental prebuild history snapshot refresh. Other listed pm-255/history-index paths are already upstream and require no task changes. Amend the single task-prefixed commit with refreshed evidence and push current main. The pushed SHA is supplied externally in the report and shared artifact `commits.txt` to avoid a self-reference.

The first push rejected fetch-first because main advanced to `841ca69` (CI annotations, runner diagnostics and a Kame flowing-clock control). `git pull --rebase` succeeded without conflicts. Retained the incoming control and reran all four contract commands: 2,133 units, six pure fixtures, lint/types and all eight fresh production browser cases pass. The Peep-box source/lock/config and emitted chunk hashes are unchanged. The repeated full serial regression also passed 110/110, none skipped, on the changed runner and Kame fixture; complete results are in `peep-retry1-full-browser.log`. No force push or side-branch fallback. Retry evidence is preserved as `peep-retry1-*.log` and updated build/verification identities in shared artifacts.

The second push also rejected fetch-first. Rebased without conflicts onto `3673c50`; all 17 incoming paths are plan evidence documents. Matched every source/lock/config and runner/test hash to final build `Gc-DZDimCpinBxFycHj1H`, then repeated all four task contracts successfully (2,133 repository units, six pure fixtures, lint/types, eight production browser cases). Used documented `SKIP_BUILD=1` for the identical executable; the complete 110/110 regression remains applicable to those unchanged inputs. Retry2 logs are preserved separately.

## Handoff

Local integration execution is demonstrated; deployed product delivery remains unobserved. No runtime queue, capacity deferral, remote inference, or callback ingestion is introduced by this browser-only task. CI/green gate/deployment and independent QA belong to plan-manager, task t-1590, after the pushed SHA; ids are allocated after handoff. Failure conditions: any declared verification fails, main lacks the delivery, or independent QA finds geometry/lifecycle/privacy/budget or surrounding-toy regression. This run stops at push and does not watch CI or probe deployment. The main-delivery lesson and explicit decisions were recorded on the board.
