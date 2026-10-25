# Portable Portrait Production Kit — Handoff & Return Contract (`pm-240` / `t-1510`)

- **Plan**: `pm-240` (*Ink & Watercolour Portraits*, revision 2)
- **Task**: `t-1510` (*Export and verify the portable portrait production kit*)
- **Kit Status**: `production_required`
- **Paintings Delivered**: **`0 / 10`**
- **Gallery Portraits Activated**: **`0 / 10`** (`content/portraits.json` = `[]`; existing 12 base studies in `public/sketches/01-cove.jpg`..`12-wallet.jpg` remain intact)
- **Existing Advisory Chores**: `esc-371` (`provision-xai-image-key:otohime`) and `esc-372` (`generate-portraits:grok-imagine`) — already waived by the decider; referenced for provenance only and never re-raised or waited on as completion gates.

---

## 1. Purpose and Delivery Boundary

This handoff packages the creative direction in [`prompts.md`](prompts.md) into a self-contained, deterministic, text-only production kit under [`production-kit/`](production-kit/). It allows an operator or external producer to generate and review the ten portraits offline without repository credentials or network access, and validates the kit deterministically in CI.

- **What this task delivers**:
  - Pure `PortraitHandoff` export/validation module in [`lib/sketches-handoff.ts`](../../lib/sketches-handoff.ts)
  - Offline CLI in [`scripts/sketches-handoff.ts`](../../scripts/sketches-handoff.ts) (`portraits:handoff:export` and `portraits:handoff:check`)
  - Ten standalone copyable prompt Markdown files ([`production-kit/01_Quiet_Reader.md`](production-kit/01_Quiet_Reader.md) through [`production-kit/10_Letter_Writer.md`](production-kit/10_Letter_Writer.md))
  - Deterministic provenance and review manifest ([`production-kit/manifest.json`](production-kit/manifest.json))
- **What remains undelivered (`0 / 10`)**:
  - None of the ten portrait paintings has been generated, visually accepted, uploaded to durable `https://files-cdn.x.ai/` storage, or activated in [`content/portraits.json`](../../content/portraits.json).
  - A producer can paste each prompt into an image tool of their choice to create candidate masters, but image creation alone does not satisfy durable anonymous publication or gallery activation.

---

## 2. Offline Production-Kit Commands

All production-kit commands run in a clean `npm ci` checkout with zero credentials and zero network calls:

```bash
# Export the 10 standalone prompt .md files and manifest.json to the default production-kit/ directory
npm run portraits:handoff:export

# Export to a custom directory or with a custom prompts.md source override
node --experimental-strip-types scripts/sketches-handoff.ts export \
  --output-dir /tmp/portrait-kit \
  --prompts projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/prompts.md

# Read-only verification of the committed production-kit/ directory
npm run portraits:handoff:check

# Read-only verification of a custom directory
node --experimental-strip-types scripts/sketches-handoff.ts check \
  --input-dir /tmp/portrait-kit
```

### Exit Codes & Stable Rejection Reasons

- **Exit `0`**: Kit matches `prompts.md` and `manifest.json` byte-for-byte with `status: "production_required"`.
- **Exit `1`**: Invalid or tampered kit; outputs JSON naming `reason`, `offendingConcept`, and `offendingPath`:
  - `missing_file` — missing `manifest.json`, missing prompt `.md` file, or fewer than 10 concept records
  - `extra_file` — unexpected file/subdirectory in the kit directory or extra concept rows
  - `prompt_mismatch` — altered prompt `.md` content, full prompt text, UTF-8 byte length (`Buffer.byteLength`), or SHA-256 (even if `manifest.json` hashes were recomputed to match the altered file)
  - `source_mismatch` — `promptPackSha256`, `styleReferenceUrl`, `referenceUrl`, or `referenceUrlSha256` does not match `parsePromptPack(prompts.md)`
  - `metadata_mismatch` — altered caption, title, filename mapping, `schemaVersion`, `generationSettings`, `artifactRequirements`, or `reviewChecklist`
  - `duplicate_mapping` — duplicate `conceptId`, `masterFilename`, `derivativeFilename`, `promptFile`, or `title`
  - `invalid_path` — path traversal (`..`, `/`, `\`, `:`), symbolic link in the kit directory, or export target overlapping protected repository directories (`content/`, `public/`, `app/`, `lib/`, `scripts/`)
  - `invalid_status` — `status !== "production_required"`, `generationSettings.executed !== false`, `deliveryStatus` claiming delivered/activated portraits, or fabricated completion fields (`fileId`, `publicUrl`, `candidateSha256`, `review`, etc.)
- **Exit `2`**: Invalid CLI usage (`reason: "invalid_cli"`).

---

## 3. Committed Kit Inventory & Fingerprints

- **Source Pack (`prompts.md`) SHA-256**: `195f898d267d1d8f9ba8e1e2db6f607bc5b1f5325fce2fff51302591874f4a9f`
- **Style Reference Pin URL**: `https://www.pinterest.com/pin/248120260716380781/`
- **Canonical Reference Image URL**: `https://i.pinimg.com/originals/41/9a/49/419a49689748e94025c4a9f00d06347b.jpg`
- **`referenceUrlSha256`**: `baadd08727c729821832757e884dd0db07cdd01a8b14bb02b207377ca3ff4255`
  *(Note: `parsePromptPack()` in `lib/sketches.ts` hashes the reference URL string, not downloaded image bytes.)*
- **Generation Settings Status**: `unverified_guidance` (`executed: false` — planning baseline from `prompts.md`: `grok-imagine-image-2.0`, aspect ratio `3:4`, preferred resolution `2k`, up to 4 attempts per concept / 40 total, no undocumented `seed` parameter).

| # | Concept ID | Standalone Prompt File | UTF-8 Bytes (`Buffer.byteLength`) | Prompt File SHA-256 | Master PNG Filename | Derivative JPEG Filename | Gallery Title | Caption |
|---|---|---|---:|---|---|---|---|---|
| 1 | `01-quiet-reader` | [`01_Quiet_Reader.md`](production-kit/01_Quiet_Reader.md) | `3822` | `ea763f4f3f125618d18e0aaf8878ed93d31dbecd0b4e3d7717629bca5ec53fdf` | `01_Quiet_Reader.png` | `13-reader.jpg` | Reader | Page forty, and the kettle can wait. |
| 2 | `02-flower-girl` | [`02_Flower_Girl.md`](production-kit/02_Flower_Girl.md) | `3743` | `ca27b4a7dca87eac4897b2644055b71ad01d0c5d6b43686ebc59e4eb09a61e5b` | `02_Flower_Girl.png` | `14-flowers.jpg` | Wildflowers | Picked on the way, for no one in particular. |
| 3 | `03-rainy-afternoon` | [`03_Rainy_Afternoon.md`](production-kit/03_Rainy_Afternoon.md) | `3754` | `904e2ae0b97020913cfc4cdd24e1ac7a71cdb1fb7205cb2fd3fe661ff6415e5b` | `03_Rainy_Afternoon.png` | `15-rain.jpg` | Rain | A clear umbrella keeps the sky in view. |
| 4 | `04-cafe-dreamer` | [`04_Cafe_Dreamer.md`](production-kit/04_Cafe_Dreamer.md) | `3769` | `21f0696069eb60cc50f99ff8374e333a5467f66eabeadd24e9ca9e697ab627a1` | `04_Cafe_Dreamer.png` | `16-cafe.jpg` | Café | The cup went cold while she was elsewhere. |
| 5 | `05-autumn-wanderer` | [`05_Autumn_Wanderer.md`](production-kit/05_Autumn_Wanderer.md) | `3706` | `02e75439b5baa112ca7eea6c876abb144fc506315ef8fa7df37132cfed284d6b` | `05_Autumn_Wanderer.png` | `17-leaves.jpg` | Leaves | The wind had the last word. |
| 6 | `06-violinist` | [`06_Violinist.md`](production-kit/06_Violinist.md) | `3581` | `c4e4ba68028a91ef66b9a6983bcffda82efa108e76b124a02e4eb8ea0161ec49` | `06_Violinist.png` | `18-violin.jpg` | Violin | Eyes closed, the hard bar coming up. |
| 7 | `07-morning-by-the-window` | [`07_Morning_by_the_Window.md`](production-kit/07_Morning_by_the_Window.md) | `3825` | `efcac98b2c8ac657516a20613480099f32bbb72be42e4b4c5fdef0947045bbe4` | `07_Morning_by_the_Window.png` | `19-window.jpg` | Window | Tea, and a street that is not awake yet. |
| 8 | `08-painter` | [`08_Painter.md`](production-kit/08_Painter.md) | `3704` | `70acd6c394f786d6055f02a4d0bcc33697b169c6aec4224724aa4ff01e4dc612` | `08_Painter.png` | `20-painter.jpg` | Painter | Cobalt on the sleeve, as usual. |
| 9 | `09-spring-breeze` | [`09_Spring_Breeze.md`](production-kit/09_Spring_Breeze.md) | `3619` | `041cb4511ea4286b0c4ea3ea49ce46bf8fd9d4a6d0ac4e25ad682abf538bdc4a` | `09_Spring_Breeze.png` | `21-breeze.jpg` | Breeze | Hair across her face, one stem held still. |
| 10 | `10-letter-writer` | [`10_Letter_Writer.md`](production-kit/10_Letter_Writer.md) | `3774` | `f79cad1f3c61843090c042acb649087aaf213f5a626011fbe034ee792e6dc9ee` | `10_Letter_Writer.png` | `22-letter.jpg` | Letter | Three lines in, and already a second sheet. |

---

## 4. Physical Artifact Return Contract & Review Requirements

To close the `0 / 10` artwork gap in a future delivery amendment, the producer/operator return package must supply:

1. **Ten Native PNG Masters (`01_Quiet_Reader.png` .. `10_Letter_Writer.png`)**:
   - Losslessly encoded `image/png` at exact `3:4` aspect ratio (`width * 4 === height * 3`, minimum `64x64` enforced by `processCandidateImage`).
   - Preferred native resolution `>=1536x2048` without upscaling. If the generation tool produces a smaller native `3:4` resolution (e.g. `768x1024` or `1152x1536`), preserve the exact native dimensions and record `resolutionLimitation` honestly rather than upscaling.
   - All ten masters must have distinct raw candidate and PNG SHA-256 hashes.
2. **Ten Gallery JPEG Derivatives (`13-reader.jpg` .. `22-letter.jpg`)**:
   - Encoded `image/jpeg` at exact `1152x1536` pixel dimensions (`< 600,000` bytes each) without cropping the figure.
3. **Permanent Anonymous Public URLs (`https://files-cdn.x.ai/`)**:
   - All 20 files (10 masters + 10 derivatives) uploaded via `POST https://api.x.ai/v1/files` (no `expires_after`) and published via `POST https://api.x.ai/v1/files/{id}/public-url` (`{}` body, `expiresAt: null`).
   - Every `publicUrl` must be an `https://files-cdn.x.ai/<token>/<file>.png|.jpg` URL with no query parameters or credentials, returning anonymous `HTTP 200` with exact byte-length (`Buffer.byteLength`) and SHA-256 match.
   - No image binaries, contact sheets, signed/temporary URLs, or secrets may be committed to git.
4. **Full-Size Per-Image & Collection Visual Review (10-Item Checklist)**:
   Each candidate must be inspected at full resolution and together across the ten-image collection against all ten checklist items in `manifest.json`:
   1. `one adult subject` — exactly one original young adult woman (age 20–30)
   2. `natural face/proportions` — minimal confident strokes and unified facial anatomy
   3. `plausible visible hands (occlusion allowed)` — convincing anatomical landmarks; occluded fingers need not all be shown
   4. `varied expressive ink` — spontaneous black ink contours of varying weight, overshoots, scribbles, unfinished lines
   5. `organic loose washes` — transparent watercolour washes, hard wet edges, granulation, bleeding, small splatters
   6. `three-to-five-colour palette` — restrained 3–5 dominant colours with saturated accents against pale washes and deep ink black
   7. `sparse off-white paper` — bare `#faf8f3` negative space with lower contours dissolving into paper
   8. `original distinct pose` — asymmetrical `3:4` portrait composition; Concept 1 (`Reader`) seated in frontal three-quarter view with book low in lap and no headscarf
   9. `absence of digital polish/anime/photorealism` — no clean uniform outlines, detailed backgrounds, or photographic paper grain overlay
   10. `absence of text, frame, signature and watermark` — no border, caption, signature, or watermark inside the artwork

---

## 5. Existing Import, Publication & Verification Commands (`t-1471` Tooling)

When either (a) ten native `3:4` master images are available on disk plus a working xAI API key for publication, or (b) a working xAI API key is provisioned for live generation + publication:

```bash
# 1. Offline preflight (verifies sharp@0.35.5 processor, adapter construction, 10 prompts, 12 base sketches)
node --experimental-strip-types scripts/sketches-paint.ts preflight --offline

# 2A. Import 10 externally produced native 3:4 PNG masters from a directory and encode 1152x1536 JPEG derivatives
node --experimental-strip-types scripts/sketches-paint.ts import \
  --input-dir /path/to/native-masters \
  --out-dir /tmp/otohime-sketches-paint/candidates \
  --ledger /tmp/otohime-sketches-paint/attempt-ledger.json \
  --reviewer "<reviewer-name>" \
  --accept

# 2B. Or generate candidates via xAI API (requires XAI_API_KEY or .grok/user-settings.json)
node --experimental-strip-types scripts/sketches-paint.ts generate \
  --out-dir /tmp/otohime-sketches-paint/candidates \
  --ledger /tmp/otohime-sketches-paint/attempt-ledger.json

# 3. Publish accepted masters + derivatives to permanent https://files-cdn.x.ai/ URLs and write content/portraits.json
node --experimental-strip-types scripts/sketches-paint.ts publish \
  --ledger /tmp/otohime-sketches-paint/attempt-ledger.json \
  --write-manifest

# 4. Verify live CDN downloads, SHA-256 hashes, dimensions, and 22-figure gallery rendering
npm run sketches:check -- --live --require-people
SKIP_BUILD=1 EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh
```

### Credential & Provisioning Notes

- `resolveXaiCredential()` in [`lib/sketches-generation.ts`](../../lib/sketches-generation.ts) reads `XAI_API_KEY` from the environment, or an `apiKey` / `api_key` / `xai_api_key` / `XAI_API_KEY` JSON field from `XAI_SETTINGS_PATH`, `./.grok/user-settings.json`, `~/.grok/user-settings.json`, or `~/.config/grok/user-settings.json` (there is no `--api-key-file` CLI flag).
- If platform account leasing (`grok-main`) is used in a future amendment, `grok-main` requires both re-authentication (`status: "auth_expired"` after `run-8320`) and re-binding to `repos: ["otohime"]` in `task-manager` (`repos` reverted to `[]`), and note that an `agy-argon-high` coding lease mounts `billie-agy` rather than `grok-main`.
