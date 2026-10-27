# On-device head tracking · pm-269/t-1591 · run-9068

Use my camera now requests video only, then starts a checksum-verified same-origin FaceLandmarker worker and drives the existing off-axis paper projection. Frames and landmark arrays stay in browser memory. Camera on / Turn camera off, permission/device/model/worker fallback, generation cancellation and all lifecycle shutdowns are implemented. Pointer/tilt remain usable. Assets are generated at build time; no model, Wasm or photograph binary is committed.

## Final local verification

Fresh `npm ci`, Node 22.23.3, Next 16.4.2, React 19.3.0, Playwright Core 1.64.0, Chrome 156.0.8078.48, migrated disposable embedded Postgres 17. Actual board profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet worker `avietidol-mac-mini` (run-9068 profile_flags), rather than a default inferred from older runs.

All seven contract commands pass on the combined tree based on `234342159d8fad056e7db0432bec3d3c2959f3d5`:

- Focused head lifecycle / asset contract: 8 passed, none skipped.
- `npm test`: 2,354 passed, none skipped.
- `npm run lint && npm run typecheck`: exit 0; 10 existing lint warnings, zero errors.
- `node scripts/vendor-peep-box.mjs && node scripts/vendor-peep-box.mjs --check`: exit 0.
- `node scripts/verify-peep-box-camera.mjs`: 6 production-browser cases passed, no skips.
- `npm run test:e2e`: 176 cases, 175 passed, zero failures, one existing APPEARANCE_EVIDENCE-only screenshot skip. Files run serially.
- `node scripts/verify-bottle-footer.mjs`: CI=true, HEAD-matched GITHUB_SHA/EXPECT_SHA, isolated production walk 65/65 and Chromium probe 170/170; exit 0.

The first complete serial run on the old base exposed the already-landed Bottle motion assertion race. Fast-forwarded main to include `01dfe6b`, which observes the actual media-query change event, and repeated every required command, including the complete serial suite and footer verifier. No Bottle application code or assertion was duplicated in this delivery. The preserved failure excerpt identifies the exact old assertion; this final green run contains the actual verifier repair.

## Execution and identity

Real: locked SDK import, FaceLandmarker VIDEO/one-face construction, model/Wasm checksum checks, forced CPU inference independent of delegate selection, default GPU attempt (observed GPU success), decoded fixture pixels, transferable ImageBitmaps, actual browser worker and rendered SVG geometry. CPU yields 478 landmarks; a 25px translation changes pose x from about 92.84 to 61.56. A bottom-right crop from the same pinned photograph produces zero landmarks / null pose; restoring the face recovers 478. The same licensed pixels also drive a synthetic video stream through the real capture adapter and normal worker into the rendered off-axis layers. Camera network requests have no bodies or uploads. The production response verifies camera=(self), microphone=() and the worker-specific restrictive CSP.

Synthetic: camera hardware/permission responses, hidden/pagehide/revocation events and lifecycle-only fake workers. They prove opt-in and cleanup policy, not inference. Real worker-error, corrupted-model, failed-fetch and Off-during-held-model-response controls preserve pointer mode. Off during pending permission closes late tracks. All eight active exit paths stop tracks/worker and cannot resume without another click. Physical webcam/device compatibility and browsers other than the recorded Chrome were not measured.

Executable fingerprint (sorted path + NUL + bytes + NUL): `8b18d0ce3a7c09684064a239c2f229ceed571b2075962b82f0248516dae2d6f5`. Lock SHA256 `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`; generated worker `abded2a89252b128933ca06c8a4c9501e128029aaf9df049f231bc7428b5337a`. Full serial production build `iLtJ7CO1n7mhpu51hPg6H`; final CI-mode footer build `9fbuM-NRzb54D_16TxBo8`. All SDK/model/SIMD/non-SIMD Wasm hashes and sizes are in the source manifest and camera-verification.json. Model SHA256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`. Fixture SHA256 `88431cd9653ccd539741b555fb0a46b61558b301d4110412b5bc28b5e3ea6cb5`; immutable URL and NASA public-domain terms are in content/peep-box-test-assets.json. No fixture enters public/vendor or deployment assets.

The existing pointer suite measures 10,772 bytes gzip including scoped CSS, versus its 35KiB limit, and zero attributable CLS at 390×844 and 1366×768. Camera SDK/model/Wasm remain unloaded before consent and are separately recorded in the manifest. Product source, emitted chunks, asset fingerprints and full final browser/footer logs are preserved in run-9068/artifacts.

## History and handoff

Bounded task-manager scan: offsets 0/5, limit 5, read 10 FAILED of 1,126 and 10 COMPLETED of 6,425; RUNNING 3/3. Global history is incomplete. Plan SWE listing has seven runs and only this run targets t-1591. Read the raw tail of older pointer Peep-box task `a7d6a38f-7400-4d5e-840f-935c6002a3c0`: it ends push_not_on_main and is incomplete, so it cannot establish camera execution. Completed Bottle predecessor `acde707b-0dcb-4582-84c1-3c192ac1f618` has a terminal runner tail, persisted COMPLETED / callbackState=delivered / callbackAttempts=1, with plan run-9064 succeeded at 5abaebc and callback_apply_failures=0. That different executable does not prove this camera change. This run's callback ingestion occurs after exit and is unproven here. Sanitized receipts are in history.json.

Local execution demonstrated; integration deployed and product delivered remain unproven. No capacity deferral, durable compute job, operator prerequisite or idle wait applies. CI/green gate and independent deployed QA are deferred to plan-manager for `pm-269/t-1591/run-9068`; successor ids are allocated after push. Owner: plan-manager / assigned QE. Failure condition: a failing CI/gate/QA result or a deployed executable missing this change. No pipeline watch or deployed-system checks were performed.

Repository AGENTS, available plan/architecture and installed Next use-client/headers guides were read. Referenced shared extraction/software-development files are absent on this Mac lease. Explicit design/scope decisions and lessons are recorded, including the real Off-button defect caught by the browser negative control. Generated checkout history was preserved as a text artifact and excluded from the feature diff. The single delivery commit SHA is reported via summary git_sha and runner artifacts/commits.txt.
