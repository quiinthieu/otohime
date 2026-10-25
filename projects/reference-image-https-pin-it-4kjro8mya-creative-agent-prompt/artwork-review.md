# Artwork Review & Attempt Ledger — `pm-240` / `t-1472`

- **Plan**: `pm-240` (*Ink & Watercolour Portraits*)
- **Task**: `t-1472` (*Publish and activate ten reviewed portraits*)
- **Runs**: `run-8312` (attempt 1, parked on `esc-371`), `run-8320` (attempt 2, parked on `esc-372`), `run-8329` (attempt 3, stop state per `esc-372` decider resolution), `run-8341` (attempt 4, `fix_cycle: 1` after green gate `ver-3313` on `dd1e8e1`), `run-8364` (attempt 5, `fix_cycle: 2` after green gate `ver-3322` on `51cf311`), `run-8381` (attempt 6, `fix_cycle: 2` after green gate `ver-3330` on `de193a7`)
- **Collection Activation Status**: **NOT ACTIVATED (`content/portraits.json` = `[]`)** — blocked on human operator credential/master provisioning (`esc-371` `provision-xai-image-key:otohime` and `esc-372` `generate-portraits:grok-imagine`). Per `t-1472` contract and `esc-372`, no synthetic/fixture images, code-drawn substitutes, or `flux2-klein` outputs are used, fewer than ten portraits are never activated, and live `--require-people` verification gates remain visibly red until all ten reviewed paintings are published to permanent `https://files-cdn.x.ai/` URLs.

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

---

## 4. Per-Concept Candidate & Review Ledger (10 Required Concepts)

Vendor attempt ledger (`version: 1`):
- `failedRequests`: `0` (missing credential guard in `scripts/sketches-paint.ts` refuses live generation before any network call when `credential.available === false`)
- `decodedCandidates`: `0`
- `publishedAssets`: `0`
- `activatedRecords`: `0`

| # | Concept ID / Master Filename | Derivative Label | Gallery Title | Candidates Generated | Native Resolution | Public Master URL (`files-cdn.x.ai`) | Public Derivative URL (`files-cdn.x.ai`) | Review Disposition & Reason |
|---|---|---|---|---|---|---|---|---|
| 1 | `01_Quiet_Reader.png` | `13-reader.jpg` | Reader | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` xAI credential or operator master import |
| 2 | `02_Flower_Girl.png` | `14-flowers.jpg` | Wildflowers | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` xAI credential or operator master import |
| 3 | `03_Rainy_Afternoon.png` | `15-rain.jpg` | Rain | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` xAI credential or operator master import |
| 4 | `04_Cafe_Dreamer.png` | `16-cafe.jpg` | Café | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` xAI credential or operator master import |
| 5 | `05_Autumn_Wanderer.png` | `17-leaves.jpg` | Leaves | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` xAI credential or operator master import |
| 6 | `06_Violinist.png` | `18-violin.jpg` | Violin | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` xAI credential or operator master import |
| 7 | `07_Morning_by_the_Window.png` | `19-window.jpg` | Window | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` xAI credential or operator master import |
| 8 | `08_Painter.png` | `20-painter.jpg` | Painter | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` xAI credential or operator master import |
| 9 | `09_Spring_Breeze.png` | `21-breeze.jpg` | Breeze | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` xAI credential or operator master import |
| 10 | `10_Letter_Writer.png` | `22-letter.jpg` | Letter | 0 / 4 | pending | pending | pending | **Pending (`blocked_missing_credential`)** — awaiting `esc-371` / `esc-372` xAI credential or operator master import |

---

## 5. Locked Environment & Artifact Fingerprints (SHA-256)

- `package-lock.json`: `ac0edc0da9da7579a0c43c802d1c8b43c75aa0bc7ee3bfde230586346f8a851a` (`sharp@0.35.5`)
- `projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/prompts.md`: `195f898d267d1d8f9ba8e1e2db6f607bc5b1f5325fce2fff51302591874f4a9f`
- `parsePromptPack().referenceSha256`: `baadd08727c729821832757e884dd0db07cdd01a8b14bb02b207377ca3ff4255`
- `public/sketches/01-cove.jpg` (existing base sketch 01): `2b55cad6a072c4b4a77a764da2aa8e8d098f2d6e011061ea8e62a29bbd216043`
- `/tmp/pinterest-reference-style-only.jpg` (Pinterest original): `9bbcdcf85394c695567a0f93114d942b2438c913b5eca0c3976297fed8a04c80`
- `lib/sketches.ts`: `8c28d22034be719f76a16d93d8c642c41ae646ff5d1463858a08d85a3b02a43a`
- `lib/sketches-generation.ts`: `71a94159e2f5a1ecc70a8fc78e3c3dac65ba4d9fa80cbd7d8e1122968050b216`
- `scripts/sketches-paint.ts`: `5e745d2edc8a93b98d1bedadc4b3d0753c16a587785a30d99d57b06e41db8d16`
- `scripts/sketches-check.ts`: `ff65c9231fc90c2f1e1ca614083dbcda0697620f6a7f7abb9ec2270da0d9fac8`
- `content/portraits.json`: `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` (`[]\n`)
