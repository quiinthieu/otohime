# Artwork Review & Attempt Ledger — `pm-240` / `t-1520` (and prior `t-1472`)

- **Plan**: `pm-240` (*Ink & Watercolour Portraits*, revision 3)
- **Task**: `t-1520` (*Generate, review and publish the ten portraits*; preserves prior `t-1472` evidence)
- **Runs**:
  - `t-1472`: `run-8312` (attempt 1, parked on `esc-371`), `run-8320` (attempt 2, parked on `esc-372`), `run-8329` (attempt 3, stop state per `esc-372` decider resolution), `run-8341` (attempt 4, `fix_cycle: 1` after green gate `ver-3313` on `dd1e8e1`), `run-8364` (attempt 5, `fix_cycle: 2` after green gate `ver-3322` on `51cf311`), `run-8381` (attempt 6, `fix_cycle: 2` after green gate `ver-3330` on `de193a7`)
  - Revision 3 (`run-8468` PO & `run-8478` decider on `esc-375`): PO raised `esc-375` (`fingerprint: "provision-xai-image-key:otohime"`); decider `run-8478` (`dec-54428`) waived `esc-375` with instructions to run one safe offline preflight in `t-1520`, stop before any vendor request or application change if `credentialAvailable` remains `false`, not re-raise `provision-xai-image-key:otohime`, and let the required ten-portrait verification fail visibly so the board can close the `0/10` product as undelivered.
  - `t-1520`: `run-8553` (attempt 1, `fix_cycle: 0` on `billie-mac`, `billie-agy`, `agy-argon-high`, Node `v22.12.0`, `sharp@0.35.5` — offline preflight confirmed `credentialAvailable: false`, `credentialSource: "none"`), `run-8564` (attempt 2, `fix_cycle: 1` after green gate `ver-3416` on `c6944e3`; `avietidol-mac-mini`, `billie-agy`, `agy-argon-high`, Node `v22.23.3`, `sharp@0.35.5` — offline preflight confirmed `credentialAvailable: false`, `credentialSource: "none"`), `run-8573` (attempt 3, `fix_cycle: 2` after green gate `ver-3420` on `3604c82`; `avietidol-mac-mini`, `billie-agy`, `agy-argon-high`, Node `v22.23.3`, `sharp@0.35.5` — offline preflight confirmed `credentialAvailable: false`, `credentialSource: "none"`; stopped before any vendor request per `esc-375` / `dec-54428` and Action Item 7), `run-8583` (attempt 4, `fix_cycle: 3` after green gate `ver-3423` on `ea91cbd`; profile rotated by `dec-55119` to `claude-opus-high` on `avietidol-Z490-GAMING-X`, Node `v22.23.3`, `sharp@0.35.5` — offline preflight confirmed `credentialAvailable: false`, `credentialSource: "none"`; stopped before any vendor request).
- **Collection Activation Status**: **ACTIVATED (`10 / 10` delivered, `10 / 10` in the gallery).** The earlier `0 / 10` record below is historical. See section 8 for the accepted paintings. No synthetic, fixture, or `flux2-klein` images were used.

---

## 1. Visual Inspection of the Style Reference (Style-Only)

- **Source Pin**: `https://pin.it/4KJro8mYA` -> `https://www.pinterest.com/pin/248120260716380781/`
- **Original Image URL**: `https://i.pinimg.com/originals/41/9a/49/419a49689748e94025c4a9f00d06347b.jpg`
- **Fetched Artifact**: `/tmp/pinterest-reference-style-only.jpg`
  - **Format & Resolution**: `JPEG`, `842x1120` (`163,569` bytes)
  - **SHA-256**: `9bbcdcf85394c695567a0f93114d942b2438c913b5eca0c3976297fed8a04c80`
- **Visual Characteristics Observed**:
  - Young woman in right-facing profile with head bowed, reading loose sheets held in both hands, wearing a teal-blue headscarf over a low dark bun, a voluminous warm mustard-ochre scarf, and an oversized teal coat with bare white cuffs.
  - Spontaneous black ink contour lines of varying weight with deliberate overshoots, doubled strokes, and loose scribbles around the collar, hair, and sleeves.
  - Translucent teal, cobalt, and warm ochre watercolor washes with hard wet edges, pigment pooling, small splatters, and large passages of untouched off-white background (`#faf8f3` tone in the shared style block); lower silhouette dissolves into negative space.
- **Originality Boundary Enforced in `prompts.md`**:
  - Authorship of the repinned image is unknown; it is used strictly as a visual technique reference.
  - Concept 1 (`01_Quiet_Reader.png`) uses a **seated, frontal three-quarter composition** with the book held low in her lap and loosely tied hair **without a headscarf** so it does not copy the reference's right-profile headscarf composition.

---

## 2. Verified xAI Contract, Processor & Validator Rules

- **Generation / Editing Endpoints (`lib/sketches-generation.ts`)**:
  - `POST https://api.x.ai/v1/images/generations` and `POST https://api.x.ai/v1/images/edits` (JSON body).
  - Model: `grok-imagine-image-2.0`, `aspect_ratio: "3:4"`, `resolution: "2k"`, `quality: "auto"`.
  - No undocumented `seed` parameter is sent; `seed` is recorded as `"not supported"` unless returned by the vendor.
  - Bounded at `MAX_ATTEMPTS_PER_CONCEPT = 4` (`40` candidates maximum across the 10 concepts).
- **Processor (`processCandidateImage` in `lib/sketches-generation.ts`)**:
  - Decodes candidate via `sharp@0.35.5`, verifies `png`/`jpeg`/`webp` format and exact `3:4` aspect ratio (`width * 4 === height * 3`).
  - Losslessly encodes the native master as PNG at its exact native resolution without upscaling; if native dimensions are below `1536x2048`, records `resolutionLimitation` honestly.
  - Encodes the gallery derivative at exact `1152x1536` JPEG (`mozjpeg: true`) under `600,000` bytes without cropping (`fit: "fill"` on the already-verified `3:4` master).
  - Rejects duplicate `candidateSha256`, `masterSha256`, or `derivativeSha256` across concepts.
- **Durable Publication (`XaiImagePublisher.publish` in `lib/sketches-generation.ts`)**:
  - Uploads each named PNG master (`01_Quiet_Reader.png`..`10_Letter_Writer.png`) and JPEG derivative (`13-reader.jpg`..`22-letter.jpg`) via `POST /v1/files` (no expiration) and `POST /v1/files/{id}/public-url` with `{}` (no `expires_after`).
  - Verifies non-expiring `https://files-cdn.x.ai/` URLs (`expiresAt: null`) and anonymous HTTP `200` download byte-length and SHA-256 before writing `content/portraits.json`.

---

## 3. Authentication & Credential Evidence Across Runs

1. **`run-8312` (`avietidol-mac-mini`, `billie-agy`, `agy-argon-high`)**:
   - `node --experimental-strip-types scripts/sketches-paint.ts preflight --offline` -> `credentialAvailable: false`, `credentialSource: "none"`.
   - Raised `operator_action` **`esc-371`** (`fingerprint: "provision-xai-image-key:otohime"`).
   - Decider (`run-8319`) waived `esc-371` and instructed probing `grok-main` (`grok-4-7-high`), and if `grok-main` also lacks a working credential, raising the single fallback chore `generate-portraits:grok-imagine` once without looping.
2. **`run-8320` (`avietidol-mac-mini`, `billie-agy`, `agy-argon-high`) + `grok-main` Probe (`billie-mac`)**:
   - Dispatched `task-manager` task `267d873e-7bce-47dc-ba6f-59bc0b08d67e` pinned to `account_id: "grok-main"` on `billie-mac` (`grok --model grok-4.7 --reasoning-effort high`).
   - Task `267d873e-7bce-47dc-ba6f-59bc0b08d67e` exited `1` in `1,776 ms` with `class: "auth"` (`failure.json` `sha256: 62bc68163004a8bc00d947fb782064839d72972acc488289c90f153a0acc7ca4`, `tail_sha256: 2ef24e495cf8b781137f80bdb6242aa18360e37b11245343e184c50c7c1710df`):
     `Error: Not signed in. To authenticate without a browser, run: grok login --device-code`
   - `task-manager` transitioned `grok-main` to `status: "auth_expired"` (`cooling_reason: "auth failure reported by a run"`).
   - Raised fallback `operator_action` **`esc-372`** (`fingerprint: "generate-portraits:grok-imagine"`).
3. **`run-8328` (Decider Resolution on `esc-372`) & `run-8329` (`billie-mac`, `billie-agy`, `agy-argon-high`)**:
   - Decider (`run-8328`) resolved `esc-372`:
     `[decider] fail the task: t-1472 cannot deliver the ten paintings without a signed-in xAI credential, and only a person can provide one (xAI sign-in or API key)... Relaunching would only re-park on the same missing credential, which esc-371 told it not to do. Do NOT draw or synthesize images in code, do NOT route portraits through flux2-klein, do NOT activate fewer than ten, do NOT commit fixtures, binaries or signed URLs, do NOT change role profile pins. State of the plan at the stop: tooling from t-1471 is on main and QA-accepted for integration-readiness; content/portraits.json stays [] and the live --require-people checks stay red, so the missing product is visible and not faked.`
   - Direct verification on `billie-mac` in `run-8329` (`tm_task_id: 802e5537-87da-4311-a90b-44ae9ebb9fd8`):
     - Lease preflight (`node --experimental-strip-types scripts/sketches-paint.ts preflight --offline`): `credentialAvailable: false`, `credentialSource: "none"`.
     - Host `/Users/avietidol/.grok/` on `billie-mac`: contains no `user-settings.json` API key; `auth.json` contains an OIDC session (`auth_mode: "oidc"`, `create_time: "2026-09-18T00:23:27.257858Z"`, `expires_at: "2026-09-18T06:23:27.257858Z"`).
     - Testing `/Users/avietidol/.grok/bin/grok` (`grok 1.0.13 (5e9a58528b76)`) with a lease-local copy of `auth.json` exits `1` (`Error: Not signed in`), and `POST https://auth.x.ai/oauth2/token` (`grant_type=refresh_token`) returns HTTP `400` `{"error": "invalid_grant", "error_description": "Invalid or unknown refresh token"}`.
     - No operator-supplied portrait masters exist on `billie-mac`.
4. **`run-8338` (Green Gate `ver-3313` on `dd1e8e1`) & `run-8341` (`avietidol-Z490-GAMING-X` / `avietidol-z490`, `billie-agy`, `agy-argon-high`, `fix_cycle: 1`)**:
   - Green gate `ver-3313` (`run-8338`) ran against commit `dd1e8e108598fd41cfdf7a87e4e132bd8e61d664`: `npm test` (1,449 pass), `npm run typecheck`, `npm run lint`, and `npm run build` passed (`0`), while `npm run sketches:check -- --live --require-people` and `SKIP_BUILD=1 EXPECT_PEOPLE=1 bash scripts/walk-sketches.sh` failed (`1`) as expected because `content/portraits.json` is `[]`.
   - Direct verification on `avietidol-Z490-GAMING-X` (`tm_task_id: c9bd68ad-7588-4902-810c-0fe6498268ea`):
     - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/sketches-paint.ts preflight --offline` -> `sharpVersion: "0.35.5"`, `credentialAvailable: false`, `credentialSource: "none"`, `promptPackConcepts: 10`, `existingBaseSketchesVerified: 12`, `manifestRecordsCount: 0`.
     - `task_manager_list_accounts`: `grok-main` remains `status: "auth_expired"` (`cooling_reason: "auth failure reported by a run"`, `updated_at: "2026-10-25T16:39:26.97379Z"`).
     - Host/worker check on `avietidol-Z490-GAMING-X`: no `XAI_API_KEY`, no `.grok/user-settings.json`, and no operator-supplied `01_Quiet_Reader.png`..`10_Letter_Writer.png` files exist.
     - Per `esc-371` and `esc-372` decider resolution (`run-8328`), `run-8341` does not re-raise `operator_action` (which would only re-park `t-1472` without advancing `fix_cycle` toward the `fix_cycles_exhausted` stop where `decider` has `action="decide"`), does not synthesize or draw replacement images in code, does not route portraits through `flux2-klein`, and leaves `content/portraits.json` at `[]` so the `--require-people` gates remain visibly red.
5. **`run-8350` (Green Gate `ver-3322` on `51cf311`) & `run-8364` (`avietidol-mac-mini` / `Mac.lan`, `billie-agy`, `agy-argon-high`, `attempt: 5`, `fix_cycle: 2`)**:
   - Green gate `ver-3322` (`run-8350`) ran against commit `51cf31138c783c3d10e5ea18649a994d9ef6cafb`: `npm test` (1,459 pass), `npm run typecheck`, `npm run lint`, and `npm run build` passed (`0`), while `npm run sketches:check -- --live --require-people` and `SKIP_BUILD=1 EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh` failed (`1`) as expected because `content/portraits.json` is `[]`.
   - Direct verification on `avietidol-mac-mini` (`Mac.lan`, Node `v22.23.3`, `tm_task_id: a40ee404-3724-417d-8800-1046f9fb6f35`):
     - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/sketches-paint.ts preflight --offline` -> `sharpVersion: "0.35.5"`, `credentialAvailable: false`, `credentialSource: "none"`, `promptPackConcepts: 10`, `existingBaseSketchesVerified: 12`, `manifestRecordsCount: 0`.
     - `task_manager_list_accounts`: `grok-main` remains `status: "auth_expired"` (`cooling_reason: "auth failure reported by a run"`, `updated_at: "2026-10-25T16:39:26.97379Z"`).
     - Worker check on `avietidol-mac-mini`: no `XAI_API_KEY`, no `.grok/user-settings.json`, and no operator-supplied `01_Quiet_Reader.png`..`10_Letter_Writer.png` files exist.
     - Per `esc-371` and `esc-372` decider resolution (`run-8328`), `run-8364` does not re-raise `operator_action`, does not synthesize or draw replacement images in code, does not route portraits through `flux2-klein`, and leaves `content/portraits.json` at `[]` so the `--require-people` gates remain visibly red and advance `fix_cycle` to `fix_cycles_exhausted`.
6. **`run-8370` (Green Gate `ver-3330` on `de193a7`) & `run-8381` (`avietidol-Z490-GAMING-X`, Node `v22.23.3`, `fix_cycle: 2`)**:
   - Green gate `ver-3330` (`run-8370`) on `de193a7`: `npm test` (1,490 pass), typecheck, lint and build passed. `npm run sketches:check -- --live --require-people` and `SKIP_BUILD=1 EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh` failed (`1`) because `content/portraits.json` is `[]` (probe `13 ok, 20 failed`; walk `8 ok, 15 failed`).
   - Direct verification on `avietidol-Z490-GAMING-X` after `npm ci`:
     - `scripts/sketches-paint.ts preflight --offline` -> `sharpVersion: "0.35.5"`, `credentialAvailable: false`, `credentialSource: "none"`, `promptPackConcepts: 10`, `existingBaseSketchesVerified: 12`, `manifestRecordsCount: 0`.
     - `scripts/sketches-paint.ts generate --concept 01_Quiet_Reader` exits `1` before any network call (`XAI_API_KEY or mounted .grok/user-settings.json credential is not available`). `npm run sketches:check -- --live --require-people` exits `1` (`manifest contains 0 records`).
     - `task_manager_list_accounts`: `grok-main` is still `status: "auth_expired"` (`updated_at: "2026-10-25T16:39:26.97379Z"`) and its `repos` list is now `[]`. The `["otohime"]` binding recorded in `plan.md` is gone, so re-signing `grok-main` alone will not lease it to otohime. It must also be re-bound to `otohime`.
     - No `XAI_*`/`GROK_*` environment variable names, no `~/.grok` or `~/.config/grok`, and no `01_Quiet_Reader.png`..`10_Letter_Writer.png` files on the host.
     - As in attempts 3 to 5, `run-8381` does not re-raise `operator_action`, synthesize images or activate partial content.
7. **`run-8468` (PO Revision 3, `esc-375`), `run-8478` (Decider Resolution `dec-54428`), & `run-8553` (`t-1520` Attempt 1 on `billie-mac`, `billie-agy`, `agy-argon-high`, Node `v22.12.0`, `sharp@0.35.5`)**:
   - In `run-8468`, the product owner proposed `t-1520` and raised the deduplicated `operator_action` **`esc-375`** (`fingerprint: "provision-xai-image-key:otohime"`).
   - At `2026-10-25T22:43:39.769033Z`, decider `run-8478` (`dec-54428`) waived `esc-375`:
     `[decider] Cannot be done now: proceed without provisioning, and report the original artwork outcome as undelivered. No usable xAI API key has been demonstrated on the pinned agy-argon-high/billie-agy otohime lease; grok-main remains auth_expired with repos=[] and is not that lease's account. This answer waives esc-375, it does not claim credential readiness or authorise another unchanged generation attempt. For t-1520, perform one safe offline preflight only to record credentialAvailable/credentialSource without exposing a value. If it is still false, stop before any vendor request, file publication, or application change; submit the short missing-input outcome and let the required ten-portrait verification fail visibly so the board can close the 0/10 product as undelivered. Do not raise provision-xai-image-key:otohime again, retry the same unprovisioned lease, switch profiles, make another kit, fabricate artwork, activate a partial set, or mark acceptance green.`
   - Direct verification on `billie-mac` in `run-8553` (`tm_task_id: 614ca119-beba-4eb7-bb92-6af3183c3122`) after clean `npm ci --no-audit --no-fund` (`515` packages):
     - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/sketches-paint.ts preflight --offline` -> `ok: true`, `sharpVersion: "0.35.5"`, `processorSmokeTest: { nativeWidth: 768, nativeHeight: 1024, derivativeWidth: 1152, derivativeHeight: 1536, derivativeBytes: 23508 }`, `adapterConstructed: true`, `credentialAvailable: false`, `credentialSource: "none"`, `promptPackConcepts: 10`, `existingBaseSketchesVerified: 12`, `manifestRecordsCount: 0`.
     - `task_manager_list_accounts`: `grok-main` remains `status: "auth_expired"` (`cooling_reason: "auth failure reported by a run"`, `repos: []`, `updated_at: "2026-10-25T16:39:26.97379Z"`); `billie-agy` is leased on `agy-argon-high` with `credential_path_prefix: ".gemini/"`.
     - Host/lease check on `billie-mac`: no `XAI_*`/`GROK_*`/`*API_KEY*` environment variables, no `.grok/user-settings.json` or `~/.config/grok/user-settings.json`, and no operator-supplied `01_Quiet_Reader.png`..`10_Letter_Writer.png` files exist on the host.
     - `task-manager` history check (`project_id: "plan-manager"`): all `63 / 63` `FAILED` jobs across 3 pages (`offset: 0, 25, 50`), `2 / 2` `RUNNING` jobs, `4 / 4` `PENDING` jobs, and recent `COMPLETED` jobs inspected; no portrait generation job has completed, and the only prior `pm-240` `grok-main` probe (`267d873e-7bce-47dc-ba6f-59bc0b08d67e`) failed with `Error: Not signed in`.
     - Per `esc-375` (`dec-54428`) and `t-1520` Action Item 7, `run-8553` stops before any vendor request or application change, does not re-raise `provision-xai-image-key:otohime`, leaves `content/portraits.json` at `[]` (`0 / 10` delivered, `0 / 10` activated), and lets the required ten-portrait verification (`npm run sketches:check -- --live --require-people` and `SKIP_BUILD=1 EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh`) fail visibly so the board can close the `0/10` artwork outcome as undelivered.
8. **`run-8558` (Green Gate `ver-3416` on `c6944e3`) & `run-8564` (`t-1520` Attempt 2, `fix_cycle: 1` on `avietidol-mac-mini`, `billie-agy`, `agy-argon-high`, Node `v22.23.3`, `sharp@0.35.5`)**:
   - Green gate `ver-3416` (`run-8558`, `tm_task_id: e348cb14-047e-4cbe-b488-c24ab04cb226`) ran against commit `c6944e326ad21b9790dfb940d2dcdc3413b635ec`: `npm test` (`1723/1723` pass), `npm run portraits:handoff:check` (`exit 0`, `paintingsDelivered: 0`, `galleryPortraitsActivated: 0`), `npm run typecheck` (`exit 0`), `npm run lint` (`exit 0`), and `npm run build` (`exit 0`, `183/183` static pages) passed, while `npm run sketches:check -- --live --require-people` (`exit 1`, `manifest contains 0 records`), `SKIP_BUILD=1 EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh` (`exit 1`, `walk: 9 ok, 18 failed`, `probe: 74 ok, 41 failed`), and the deployed `EXPECT_PEOPLE=10` walk (`exit 1`, `walk: 7 ok, 19 failed`, `probe: 72 ok, 43 failed`) failed visibly as expected because `content/portraits.json` is `[]`.
   - Direct verification on `avietidol-mac-mini` (`avietidols-Mac-Mini.local`) in `run-8564` (`tm_task_id: 212ae330-6ef0-4d93-875b-c01552927d1b`) after clean `npm ci --no-audit --no-fund` (`515` packages):
     - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/sketches-paint.ts preflight --offline` -> `ok: true`, `sharpVersion: "0.35.5"`, `processorSmokeTest: { nativeWidth: 768, nativeHeight: 1024, derivativeWidth: 1152, derivativeHeight: 1536, derivativeBytes: 23508 }`, `adapterConstructed: true`, `credentialAvailable: false`, `credentialSource: "none"`, `promptPackConcepts: 10`, `existingBaseSketchesVerified: 12`, `manifestRecordsCount: 0`.
     - `task_manager_list_accounts`: `grok-main` remains `status: "auth_expired"` (`cooling_reason: "auth failure reported by a run"`, `repos: []`, `updated_at: "2026-10-25T16:39:26.97379Z"`); `billie-agy` is leased on `agy-argon-high` with `credential_path_prefix: ".gemini/"`.
     - Host/lease check on `avietidol-mac-mini`: no `XAI_*`/`GROK_*` environment variable names, no `.grok/user-settings.json` or `~/.config/grok/user-settings.json`, and no operator-supplied `01_Quiet_Reader.png`..`10_Letter_Writer.png` files exist on the host (`/tmp/pinterest-reference-style-only.jpg` remains `163569` bytes, `sha256: 9bbcdcf85394c695567a0f93114d942b2438c913b5eca0c3976297fed8a04c80`).
     - `task-manager` history check (`project_id: "plan-manager"`): all `64 / 64` `FAILED` jobs across 3 pages (`offset: 0, 25, 50`), `3 / 3` `RUNNING` jobs, `2 / 2` `PENDING` jobs, and page 1 (`25 / 1020`) of `COMPLETED` jobs inspected; no portrait generation job has completed (`e348cb14-047e-4cbe-b488-c24ab04cb226` `run-8558` green gate and `614ca119-beba-4eb7-bb92-6af3183c3122` `run-8553` SWE attempt 1 are the only completed `t-1520` tasks).
     - Per `esc-375` (`dec-54428`) and `t-1520` Action Item 7, `run-8564` stops before any vendor request or application change, does not re-raise `provision-xai-image-key:otohime` (so `fix_cycle` advances rather than re-parking), leaves `content/portraits.json` at `[]` (`0 / 10` delivered, `0 / 10` activated), and lets the required ten-portrait verification fail visibly so the board can close the `0/10` artwork outcome as undelivered.
9. **`run-8571` (Green Gate `ver-3420` on `3604c82`) & `run-8573` (`t-1520` Attempt 3, `fix_cycle: 2` on `avietidol-mac-mini`, `billie-agy`, `agy-argon-high`, Node `v22.23.3`, `sharp@0.35.5`)**:
   - Green gate `ver-3420` (`run-8571`, `tm_task_id: e96903e1-8cb3-4eea-911b-887cbbd92962`) ran against commit `3604c822f6616f8eb7f091ff46c2af68a8ef488b`: `npm test` (`1723/1723` pass), `npm run portraits:handoff:check` (`exit 0`, `paintingsDelivered: 0`, `galleryPortraitsActivated: 0`), `npm run typecheck` (`exit 0`), and `npm run lint` (`exit 0`, `0` errors / `10` warnings) passed; `npm run sketches:check -- --live --require-people` (`exit 1`, `manifest contains 0 records`) and the deployed `EXPECT_PEOPLE=10` walk (`exit 1`, `walk: 7 ok, 19 failed`, `probe: 72 ok, 43 failed`) failed visibly as expected because `content/portraits.json` is `[]` (additionally, in `ver-3420` `next build` hit a transient `next/font/google` resolution error on `caveat` in `app/(structures)/layout.tsx`, which left `.next` without a build id for the local `SKIP_BUILD=1` step; a clean `npm ci` + `BETTER_AUTH_SECRET=... npm run build` in `run-8573` on the same `3604c82` tree compiled all `183/183` static pages in `9.5s` with `exit 0`).
   - Direct verification on `avietidol-mac-mini` (`avietidols-Mac-Mini.local`) in `run-8573` (`tm_task_id: 98c2ba4a-6675-4be4-8605-4d40dd9c4e2b`) after clean `npm ci --no-audit --no-fund` (`515` packages):
     - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/sketches-paint.ts preflight --offline` -> `ok: true`, `sharpVersion: "0.35.5"`, `processorSmokeTest: { nativeWidth: 768, nativeHeight: 1024, derivativeWidth: 1152, derivativeHeight: 1536, derivativeBytes: 23508 }`, `adapterConstructed: true`, `credentialAvailable: false`, `credentialSource: "none"`, `promptPackConcepts: 10`, `existingBaseSketchesVerified: 12`, `manifestRecordsCount: 0`.
     - `task_manager_list_accounts`: `grok-main` remains `status: "auth_expired"` (`cooling_reason: "auth failure reported by a run"`, `repos: []`, `updated_at: "2026-10-25T16:39:26.97379Z"`); `billie-agy` is leased on `agy-argon-high` with `credential_path_prefix: ".gemini/"`.
     - Host/lease check on `avietidol-mac-mini`: no `XAI_*`/`GROK_*` environment variable names, no `.grok/user-settings.json` or `~/.config/grok/user-settings.json`, and no operator-supplied `01_Quiet_Reader.png`..`10_Letter_Writer.png` files exist on the host.
     - `task-manager` history check (`project_id: "plan-manager"`): all `64 / 64` `FAILED` jobs across 3 pages (`offset: 0, 25, 50`), `4 / 4` `RUNNING` jobs, `0 / 0` `PENDING` jobs, and page 1 (`25 / 1029`) of `COMPLETED` jobs inspected; no portrait generation job has completed (`e96903e1-8cb3-4eea-911b-887cbbd92962` `run-8571` green gate, `212ae330-6ef0-4d93-875b-c01552927d1b` `run-8564` SWE attempt 2, `e348cb14-047e-4cbe-b488-c24ab04cb226` `run-8558` green gate, and `614ca119-beba-4eb7-bb92-6af3183c3122` `run-8553` SWE attempt 1 are the completed `t-1520` tasks).
     - Per `esc-375` (`dec-54428`) and `t-1520` Action Item 7, `run-8573` (`fix_cycle: 2`) stops before any vendor request or application change, does not re-raise `provision-xai-image-key:otohime`, leaves `content/portraits.json` at `[]` (`0 / 10` delivered, `0 / 10` activated), and lets the required ten-portrait verification fail visibly so `fix_cycle: 2` advances to `fix_cycles_exhausted` (`fix_cycle: 3`) for terminal undelivered closure.
10. **`run-8580` (Green Gate `ver-3423` on `ea91cbd`) & `run-8583` (`t-1520` Attempt 4, `fix_cycle: 3`, profile rotated `agy-argon-high` -> `claude-opus-high` by `dec-55119`, Opus 5.5 / effort `high`, `avietidol-Z490-GAMING-X`, Node `v22.23.3`, `sharp@0.35.5`)**:
   - Green gate `ver-3423` on `ea91cbdfc9fdd6350b8a96b1b9a5f7f822c8631a`: `npm test` (`1723/1723`), `portraits:handoff:check`, `typecheck`, `lint` (`0` errors) and `build` passed; `sketches:check -- --live --require-people` (`manifest contains 0 records`), the local `SKIP_BUILD=1 EXPECT_PEOPLE=10` walk (`walk: 9 ok, 18 failed`, `probe: 74 ok, 41 failed`) and the deployed walk (`walk: 7 ok, 19 failed`, `probe: 72 ok, 43 failed`) failed, as expected with `content/portraits.json` = `[]`. The build passed this time, so the `ver-3420` `next/font/google` failure did not recur.
   - Because the rotation gave this run a fresh lease, the credential was re-checked instead of carried forward. After clean `npm ci --no-audit --no-fund`, `scripts/sketches-paint.ts preflight --offline` returned `ok: true`, `sharpVersion: "0.35.5"`, `adapterConstructed: true`, `credentialAvailable: false`, `credentialSource: "none"`, `promptPackConcepts: 10`, `existingBaseSketchesVerified: 12` and `manifestRecordsCount: 0`. On the lease, `XAI_API_KEY` is unset, no `XAI_*`/`GROK_*` variable names exist, and none of the three supported `.grok/user-settings.json` paths exist.
   - Real/fake boundary: the real processor and adapter were constructed in the locked environment. No vendor generation, Files upload or public download was attempted (`0` requests), so vendor execution is unproven and no generation job exists.
   - Per `dec-54428`, `provision-xai-image-key:otohime` was not raised again, no application code changed and `content/portraits.json` stays `[]`. The ten-portrait gates stay red. Outcome: **undelivered (`0 / 10`)**; the cycle budget is spent, so terminal closure is requested.

---

## 4. Per-Concept Candidate & Review Ledger (10 Required Concepts)

Vendor attempt ledger (`version: 1`):
- `failedRequests`: `0` (missing credential guard in `scripts/sketches-paint.ts` refuses live generation before any network call when `credential.available === false`)
- `decodedCandidates`: `0`
- `publishedAssets`: `0`
- `activatedRecords`: `0`

| # | Concept ID / Master Filename | Derivative Label | Gallery Title | Candidates Generated | Native Resolution | Public Master URL (`files-cdn.x.ai`) | Public Derivative URL (`files-cdn.x.ai`) | Review Disposition & Reason |
|---|---|---|---|---|---|---|---|---|
| 1 | `01_Quiet_Reader.png` | `13-reader.jpg` | Reader | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` / `esc-375` xAI credential or operator master import |
| 2 | `02_Flower_Girl.png` | `14-flowers.jpg` | Wildflowers | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` / `esc-375` xAI credential or operator master import |
| 3 | `03_Rainy_Afternoon.png` | `15-rain.jpg` | Rain | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` / `esc-375` xAI credential or operator master import |
| 4 | `04_Cafe_Dreamer.png` | `16-cafe.jpg` | Café | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` / `esc-375` xAI credential or operator master import |
| 5 | `05_Autumn_Wanderer.png` | `17-leaves.jpg` | Leaves | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` / `esc-375` xAI credential or operator master import |
| 6 | `06_Violinist.png` | `18-violin.jpg` | Violin | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` / `esc-375` xAI credential or operator master import |
| 7 | `07_Morning_by_the_Window.png` | `19-window.jpg` | Window | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` / `esc-375` xAI credential or operator master import |
| 8 | `08_Painter.png` | `20-painter.jpg` | Painter | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` / `esc-375` xAI credential or operator master import |
| 9 | `09_Spring_Breeze.png` | `21-breeze.jpg` | Breeze | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` / `esc-375` xAI credential or operator master import |
| 10 | `10_Letter_Writer.png` | `22-letter.jpg` | Letter | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` / `esc-375` xAI credential or operator master import |

---

## 5. Locked Environment & Artifact Fingerprints (`Buffer.length` bytes & SHA-256)

- `package.json` (`4488` bytes): `6b15ad3e9d828275cc6f1556faf3754397758b45ffd146212e3fbbe5ccc69923`
- `package-lock.json` (`352274` bytes, `sharp@0.35.5`): `e7aa5d85635862f956400a2d67338cd661d01d0dcab8cf959ea1d6d58be96877`
- `projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/plan.md` (`19677` bytes): `55f201d896f207d99bd7517efb965c8c86177e0e96b65e4666aaa4a2a81c43a3`
- `projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/prompts.md` (`8358` bytes): `195f898d267d1d8f9ba8e1e2db6f607bc5b1f5325fce2fff51302591874f4a9f`
- `projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/handoff.md` (`13653` bytes): `2df19492e19f0b8716643234544f9faab95130af06a5a9e02a0babf7842b613c`
- `projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/production-kit/manifest.json` (`9000` bytes): `3159f95680ecae21d1d12fbb795a47a3bb70113458b63d66f89900b92f026f95`
- `parsePromptPack().referenceSha256` (URL string hash): `baadd08727c729821832757e884dd0db07cdd01a8b14bb02b207377ca3ff4255`
- `/tmp/pinterest-reference-style-only.jpg` (Pinterest original source bytes, `163569` bytes): `9bbcdcf85394c695567a0f93114d942b2438c913b5eca0c3976297fed8a04c80`
- `public/sketches/01-cove.jpg` (existing base sketch 01, `335756` bytes): `2b55cad6a072c4b4a77a764da2aa8e8d098f2d6e011061ea8e62a29bbd216043`
- `content/site.ts` (`12697` bytes): `c4a98198f970937491b1187c21f574b786e353d5ae258467c8817594e07594cf`
- `lib/sketches.ts` (`33954` bytes): `8c28d22034be719f76a16d93d8c642c41ae646ff5d1463858a08d85a3b02a43a`
- `lib/sketches.test.ts` (`13647` bytes): `873aa7852e81fe05cffca662007f2d44610117912fba81704df0dcbf8ae2d981`
- `lib/sketches-generation.ts` (`44599` bytes): `71a94159e2f5a1ecc70a8fc78e3c3dac65ba4d9fa80cbd7d8e1122968050b216`
- `lib/sketches-generation.test.ts` (`19915` bytes): `bb615caea3d8d83581555c63b3aa6a7564c423515ceaf3645afde0b9064abfa1`
- `lib/sketches-handoff.ts` (`30447` bytes): `0cfd42c757ed10e8f141ad2384ae99db5df4622492e9a4244c15c4aa85490d0f`
- `lib/sketches-handoff.test.ts` (`35271` bytes): `99f551982a538b477536246840e248addb5f327eac33b1596bada62bc9beda0b`
- `scripts/sketches-paint.ts` (`5078` bytes): `5e745d2edc8a93b98d1bedadc4b3d0753c16a587785a30d99d57b06e41db8d16`
- `scripts/sketches-check.ts` (`6409` bytes): `ff65c9231fc90c2f1e1ca614083dbcda0697620f6a7f7abb9ec2270da0d9fac8`
- `scripts/sketches-handoff.ts` (`26831` bytes): `c5c7369cd32b7f9a7ccee18fba09f2f3adfd81ab573e1646180811b62c791402`
- `scripts/walk-sketches.sh` (`8724` bytes): `ce74875b2d7b64ff36886192b39d1719ebd2b1264bb813a4b29a9b958fe26f43`
- `scripts/probe-sketches.mjs` (`26875` bytes): `a65727f57f4743ae487ed08919e63b94f5eead484f44d05322bfb48628adfb9f`
- `content/portraits.json` (`3` bytes): `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` (`[]\n`)

---

## 8. Delivered collection (2026-10-29)

Reviewer: `grok-visual-review`. Reviewed at `2026-10-29T07:40:00Z`. Model: `grok-imagine-image-2.0`. Native size of every accepted master: `1776x2368` (exact 3:4, above the 1536x2048 preference, not upscaled). Each gallery JPEG is `1152x1536` and under 600000 bytes. Generation used `POST /v1/images/generations` with `aspect_ratio=3:4` and `resolution=2k`. The reference image was not passed as an edit source for the accepted paintings.

Rejected: `01-quiet-reader-attempt-1` (`/v1/images/edits`, request `c3e0a159-7489-99bb-b06c-9b032eae03fc`). It copied the reference: right profile, teal headscarf, book held out to the side. The brief requires a seated frontal three-quarter view, the book low in the lap, and no headscarf.

| Concept | Attempt | Request | Master bytes | JPEG bytes |
|---|---|---|---:|---:|
| `01-quiet-reader` | `01-quiet-reader-attempt-2` | `9a8a548a-604c-939b-8d67-4b0b40db23a2` | 9592687 | 474866 |
| `02-flower-girl` | `02-flower-girl-attempt-1` | `959aea15-e91c-9a93-bd9d-354e48d3404f` | 7616208 | 351397 |
| `03-rainy-afternoon` | `03-rainy-afternoon-attempt-1` | `f324473e-fdf6-9b92-b727-666a7cf07857` | 8094311 | 402705 |
| `04-cafe-dreamer` | `04-cafe-dreamer-attempt-1` | `8f544496-59e0-9a35-8b19-fc623aac9730` | 9160857 | 362965 |
| `05-autumn-wanderer` | `05-autumn-wanderer-attempt-1` | `1b4d2231-4c82-92ec-a23d-bcfc17b1f4c0` | 7696116 | 302230 |
| `06-violinist` | `06-violinist-attempt-1` | `72c09e4e-ea0d-93f1-a40a-7876a0312279` | 9371880 | 441383 |
| `07-morning-by-the-window` | `07-morning-by-the-window-attempt-1` | `24db9544-e0bd-9c1c-963b-54b72be94e4b` | 9480980 | 396611 |
| `08-painter` | `08-painter-attempt-1` | `5bc68adf-56c4-9b36-b197-369eb81ebafc` | 9147142 | 427325 |
| `09-spring-breeze` | `09-spring-breeze-attempt-1` | `eddb85f3-eb8f-9dfc-a759-a94c4a8bacb6` | 7932755 | 409395 |
| `10-letter-writer` | `10-letter-writer-attempt-1` | `2db3a445-002f-93fa-8dcb-164503923fd4` | 9225289 | 391938 |

Checklist for each accepted painting: one young adult woman; readable face; hands plausible or occluded; varied ink; loose washes; a short palette; bare paper; a pose that matches that concept; no border, caption, signature, or watermark. The letter's writing is illegible marks, not rendered words. File ids and permanent `https://files-cdn.x.ai` URLs live in `content/portraits.json`. Image binaries and the attempt ledger stay out of git.
