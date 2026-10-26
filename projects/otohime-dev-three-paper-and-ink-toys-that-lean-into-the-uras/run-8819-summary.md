# Delivery summary · pm-264/t-1590 · run-8819

Implemented the pointer/keyboard and explicitly enabled tilt Ryugu-jo Peep-box on `/play`. The server SVG survives without JavaScript; independent layer depths project through a fixed clipped aperture. Gesture-loaded inputs, bounded smoothing, exclusive source handoff and teardown preserve native scrolling and the existing toys. No camera/worker/model dependency or asset was added. Architecture and verification details are in [architecture.md](architecture.md).

## Verification

All commands exited 0 in the locked local environment after `npm ci`:

| Command | Result |
| --- | --- |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/peep-box.test.ts` | 6 passed |
| `npm test` | 2,111 passed after the final rebase; 0 skipped |
| `npm run lint && npm run typecheck` | Passed; 10 existing lint warnings, no errors |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/peep-box.test.ts` | Production build passed; 8 browser tests passed, 0 skipped |
| `SKIP_BUILD=1 npm run test:e2e` | Final integrated production executable; full serial suite: 110 passed, 0 skipped |
| `SKIP_BUILD=1 node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/kame.test.ts` | 8 passed after repairing the existing running-clock fixture |

At both 390×844 and 1366×768: conservative incremental gzip upper bound **8,456 bytes**, attributable CLS **0**, stabilized inactive rAF **0**, camera permission calls **0**, Worker constructions **0**, camera/model/Wasm requests **0**. The budget includes the full Play page chunk, the complete lazy controller/helper chunk and scoped CSS, excluding existing shared React/Next runtime.

Normal movement schedules nonzero attributed rAF, providing a negative control for inactive zero counts. CDP touch input actually scrolls the document. The production browser asserts analytic depth displacement using real SVG matrices, mirrored views, pointer/keyboard input, tilt calibration/rotation, denied/unavailable permission, pending-grant cancellation, visibility/offscreen/pagehide/Disable/reduced-motion stops and same-document route cleanup. No-JS keeps all four scene layers in server markup.

## Executable identity and evidence boundary

- Actual board profile: `codex-sol-6-1-high`; `gpt-6.1-sol`, effort `high`; fleet worker `avietidol-z490`, account `codex-main`.
- Node **22.23.3**, Next **16.4.2**, React **19.3.0**, Playwright Core **1.64.0**, real Chrome **154.0.8037.57**. The runner constructs the real isolated Postgres adapter, runs migrations, builds Next and starts a production server. Scene assets are source SVG/CSS; there is no separate binary/model preflight.
- Local Next build id: `-zgEdYlkUACgGm6CnZ7Ia` after the final runtime rebase (earlier verified builds: `KIAxelfOshNMuFeszMz7V`, `K_MgFCLlX-d9CCKtC8QV7`). All emitted identical Peep-box chunk hashes below. Build metadata SHA is `dev` because this local runner has no CI commit environment variable. Delivery Git SHA is supplied in the board report and artifact `commits.txt`; it is not inferred from that metadata.
- Relevant source/lock/config SHA256 fingerprint: `6d4b115e33cfb82bdae3c9ded455c7817f7d92746fab693b7896e20f876e73c3`. Algorithm: concatenate sorted relative path, NUL, content, NUL, then SHA256. Inputs are the Play page, all four `components/peep-box/` files, `lib/peep-box.ts`, `package-lock.json` and `next.config.ts`. Per-file identities are in artifact `peep-box-build.json`.
- Final integration fingerprint: `264641e9ba8a2bbdcbbaf62f13dbb37445d049b87b547c4ff3d4b6dbdee0292c`. This extends the preceding input set with all runtime files changed by the incoming Kame fetch delivery (`9ddd084`); the exact paths/hashes are in `integration_files` in the same artifact. Earlier full-suite evidence is not substituted for verification of these runtime changes.
- Emitted Play chunk `32g9fvu743qtq.js`: SHA256 `b399ef8c91621fa7d2ababe12c896d4fa74bbfa2ea1560dd218aab0c7bacdce1`, gzip **5,281 bytes**. Lazy controller `3y01lkwuqj4_p.js`: SHA256 `3570b1f30dfed72f4f83c6c15e8ba2dbb5c95bcc7b328f0ddacdba6ed4b12c23`, gzip **2,637 bytes**. Source CSS gzip **538 bytes**.
- Real: production imports/build, SVG rendering/layout, pointer/keyboard/DOM lifecycle, native browser touch scrolling and resource observations. Synthetic: orientation sensor values, permission responses, hidden-state dispatch. Fake orientation proves policy, not a real phone sensor. Physical sensor testing is explicitly outside this contract's delivery gate.

The supplied red-gate artifact was read: four verification items, two passed and two failed because the new unit/browser files did not exist. Development fixture failures (strict floating-point equality, sibling Press layout, and URL mutation preceding actual route teardown) were corrected; both final focused and full logs are complete and green. Final unit, focused browser and full browser logs are preserved in this run's artifacts. No remote runtime queue, capacity job or callback-ingestion path is introduced by this browser-only task; remote job/CI history is not asserted complete.

The initial push was rejected because main advanced. Rebased onto `9d0fba4`, which adds three Ryugu test-discovery guard cases and unrelated QA evidence documents; it changes no Peep-box executable input, dependency lock or configuration. The repository unit total therefore rose from 2,102 to 2,105. Re-ran the declared task checks and full serial browser regression before retrying the push; never force-pushed. The single delivery commit was amended to refresh these evidence notes and include the minimal Kame test fixture repair below.

The first full suite passed 99/99. The first post-rebase full run passed 98/99: the known unrelated Kame hold-boundary flake (`e2e/kame.test.ts:90`, already noted in upstream pm-256/t-1559 evidence) saw `pet` after its intended 499ms negative control. The installed Playwright clock still advances between key-down and `runFor(499)`. Added an explicit same-day future `clock.pauseAt` after hydration and before input; the original 499ms negative and 500ms positive assertions remain unchanged. This changes three test lines, no Kame product code. The focused Kame suite and final full suite pass; the failed full log is retained as `peep-box-rebase-full-browser.log`, alongside the final green `peep-box-final-full-browser.log`. The relevant product fingerprint/chunks stayed identical throughout; the verification-file hashes are recorded separately in `peep-box-build.json`.

The second push was also rejected after concurrent QA-document commits. Rebased onto `922b210`; all incoming paths are under other plans' `projects/` folders. Recomputed and matched both the product fingerprint and each verification-file hash. Repeated all four task contracts, using the runner's documented `SKIP_BUILD=1` mode for the identical already-verified production build. The 99/99 full-suite result applies to that same executable and test-file identity; it was not needlessly repeated for documentation-only incoming changes. Final retry checks are preserved in `peep-box-retry2-checks.log`.

The third push encountered the new Kame fetch delivery. The final permitted rebase onto `9ddd084` includes runtime changes and 11 new browser tests. Resolved the sole conflict in the Kame hold fixture by retaining the already-verified fixed same-day future pause, rather than racing a 100ms protocol deadline; its boundary assertions remain unchanged. Rebuilt production, reran all four task checks (2,111 repository tests and all eight Peep-box browser cases pass), and passed all 110 cases in the expanded full browser suite against this new integration fingerprint. Task results are in `peep-box-retry3-checks.log`; the expanded full results are in `peep-box-integrated-full-browser.log`.

The final main push was rejected fetch-first again. All three permitted rebase retries are exhausted: four main push attempts, none accepted. Classification: **infrastructure**, reason `git_push_non_fast_forward_retries_exhausted`. Preserved the tested delivery on **`pm-264-t-1590-run-8819`**, without force-pushing or changing main. This final branch/report amendment changes no executable or verification input, so the final 2,111-unit/eight-focused/110-full results still apply. Main integration remains pending with plan-manager for **pm-264/t-1590**; it fails until this delivery is integrated and the current-head gate passes.

## Delivery and remaining platform checks

Engineering implementation and real local execution are demonstrated. This summary belongs to the single delivery commit on `pm-264-t-1590-run-8819`; the pushed SHA is recorded externally to avoid a self-referential file. No unresolved local implementation defect remains. Default-branch integration is blocked by the exhausted concurrent-push retries above.

CI, deployment and independent QA are **unobserved** here under the explicit stop-at-push contract. Owner: plan-manager, task **t-1590**, delivered SHA from the summary report. The platform green gate fails on any declared command failing; independent QA fails on geometry/lifecycle/privacy/budget or surrounding-toy regressions. CI/QA execution ids are allocated by the platform after submission and are not fabricated here. Deployed product delivery is not claimed by a local build. Camera functionality remains plan task 5, outside this delivery.

Lessons were recorded on the board: existing Ink Press loading can move mobile document geometry; Next history changes before outgoing ViewTransition/Activity effect cleanup. No operator action or capacity deferral is required.
