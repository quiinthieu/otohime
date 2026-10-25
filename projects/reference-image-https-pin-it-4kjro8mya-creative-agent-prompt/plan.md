# Ink & Watercolour Portraits

Plan **pm-240** · product-owner run **run-8299** · 2026-10-25
Repository baseline: `ad778f1`. Product deliverable: ten original adult-woman
ink-and-watercolour portraits, published as the third section of `/sketches`,
with ten separate named PNG master downloads.

## Outcome and boundaries

A visitor sees Places, Small things and People in one sketchbook: twenty-two
figures, including the ten concepts in [prompts.md](prompts.md). Each portrait
uses a different pose, outfit and restrained palette but shares expressive black
ink, transparent irregular washes, off-white negative space and incomplete edges.
The collection must be visually inspected; metadata and test doubles cannot
certify anatomy, painterly quality or consistency.

This PO run delivers the plan, prompt pack and the verbatim prior report
[research.md](research.md), not generated paintings. The research is historical
evidence from run-8296; the overrides below govern implementation.

Only text enters git. Keep the PNG masters, JPEG derivatives and optional contact
sheet in durable external storage. Exactly these PNG download names are required:

1. `01_Quiet_Reader.png`
2. `02_Flower_Girl.png`
3. `03_Rainy_Afternoon.png`
4. `04_Cafe_Dreamer.png`
5. `05_Autumn_Wanderer.png`
6. `06_Violinist.png`
7. `07_Morning_by_the_Window.png`
8. `08_Painter.png`
9. `09_Spring_Breeze.png`
10. `10_Letter_Writer.png`

Generate at native 3:4, preferably at least 1536×2048. Record an API's actual
largest supported native size if lower; do not upscale and label it native.
A lower resolution is an explicit limitation in the final product report.
Derivatives are exactly 1152×1536 JPEG, less than 600,000 bytes, with no crop that
removes hands or meaningful clothing. Names, captions, palettes, gestures and
focal points are specified in prompts.md.

## Decisions and corrections to research

- **Keep the existing page.** `lib/pages.test.ts` enforces six console menu lines.
  Add People on figure 07; add neither a public route entry nor a menu line.
- **Original Reader composition.** Seated, frontal three-quarter view, book low in
  her lap, loosely tied hair without the reference's headscarf. This keeps the
  concept and teal/ochre palette while changing the reference's profile pose.
- **Preserve the masters.** The research proposed omitting PNGs and committing
  JPEGs. The user's PNG deliverables and no-binaries instruction take priority.
  Upload masters and derivatives to the already relevant vendor's Files storage;
  commit a typed manifest of permanent public URLs, file ids and checksums.
- **Current API contract.** The primary docs describe
  `grok-imagine-image-2.0`, `aspect_ratio: "3:4"`, `resolution: "2k"` and JSON
  image editing. Do not implement the research's unsupported multipart/seed
  assumptions or select the retiring quality alias. Check the official contract
  at implementation time and record actual request settings and resolved model.
- **Durability.** xAI's ordinary generation URLs are temporary. Files and their
  public URLs must both have no expiration. Anonymous downloads must work before
  activation. Keep the native candidate hash and encoded master hash separately.
- **No capacity dependency on a GPU recipe.** The platform's flux2-klein runner
  is a sprite pipeline, so this plan uses the hosted xAI image API. It introduces
  no local model, GPU job, polling loop, schedule or new queue. A runtime elsewhere
  may not be substituted merely to bypass a failed image API.
- **Credentials are not proven.** grok-main is active and has now been bound to
  otohime with its previous empty repo binding preserved by replacement with
  `["otohime"]`. That eligibility does not authenticate an image call or mount
  .grok on an agy lease. Do not alter the operator's selected agent profile.
- **Order independent work first.** Task 1 needs neither credentials nor real
  output. It delivers the processor, adapter, validator, download route and
  fixture-proven gallery. Task 2 obtains, reviews and publishes real output and
  activates all ten records atomically. No partial collection is published.

The named platform standing documents are absent from otohime. They were read
from `/data/build-worker/repo/mono-v2/projects/20260921222547_plan_manager_chief_of_staff_extraction.md`
and `/data/build-worker/repo/mono-v2/docs/claude/software-development.md`.
Do not copy their platform-specific staging deployment instructions into this
GitHub/Vercel repository. Follow otohime's AGENTS.md, installed Next.js guides and
existing CI. Product-owner changes remain under projects/.

## Interface and data flow

`prompts.md → ImagePublisher → candidate ledger → visual review → PNG/JPEG
processor → xAI Files → public URL/hash check → content/portraits.json →
content/site.ts → /sketches`

The generator is an explicit CLI, separate from the application request path.
Page loads, builds, CI and verification never purchase images.
Generation and publication share the same port for real and fake adapters.
Download routes accept only exact committed master filenames, stream the
corresponding public PNG and send a named attachment header; user-supplied URLs
never become fetch targets.

The manifest is a text-only record of ten selected artworks. It stores
concept identity, filenames, master/derivative public URLs and ids, actual
dimensions, MIME types, bytes, SHA-256 hashes, full prompt or prompt-pack hash,
settings and reference hashes, model and attempt identity, and review status.
Keep secrets and private request URLs out of it. It begins empty after task 1;
only ten complete reviewed records activate People. A nonempty partial or
invalid manifest is an error, not a silently hidden failure.

Use files-cdn.x.ai as the sole new remote image host, with exact HTTPS/path
validation and the installed Next.js remotePatterns API. Existing local
`/sketches/*.jpg` remain local. For portraits, reserve intrinsic 1152×1536 space
and use responsive sizes; the People grid follows the existing two/three-column
pattern. Keep `alt=""` and meaningful figcaptions consistent with the gallery.
Provide a plainly labeled master download beside each caption.

No binary fixture enters git: tests create fixtures in temporary directories.
Hermetic loopback HTTP tests remove both lowercase and uppercase proxy variables
and provider/MCP environment variables before starting their fake.

## Execution contracts

These JSON objects are the exact task definitions submitted to plan-manager.
Their verification commands execute at each delivered SHA inside a checkout;
none purchases images or changes shared infrastructure. The walk creates and
cleans up only its own local server/browser processes. A read-only remote mode
is used by QA against the deployment after CI.

```json
[
  {
    "sequence": 1,
    "title": "Build portrait tooling and gallery support",
    "role": "software_engineer",
    "depends_on": [],
    "qa": "required",
    "problem": "The gallery supports only place/object studies, and there is no tested image-generation, durable-publication or validation path. Real API credentials must not block the work that fixtures can prove.",
    "acceptance_criteria": "A credential-free fake proves generation/publication/import failures and success; the portrait gallery renders ten fixture people correctly while production keeps its twelve studies until a reviewed real manifest is supplied. No image binaries or credentials enter git. This task proves integration readiness only; real generation and product delivery remain unproven.",
    "action_items": [
      "Read AGENTS.md and the installed Next.js image/testing guides. Use this plan and prompts.md as the build contract; write failing interface-level tests first.",
      "Declare an ImagePublisher port in lib/sketches-generation.ts with generate, publish and fetch-artifact operations. Implement the xAI REST adapter behind the port using the current official JSON contract; Node 22 and a directly locked sharp dependency handle image decoding/conversion. Keep credentials in memory from XAI_API_KEY or an already mounted provider settings file; do not print credentials or alter shared secret configuration.",
      "Add scripts/sketches-paint.ts with on-demand preflight, generate, import and publish commands. Preflight must actually import the processor and construct the adapter in npm ci's locked environment, parse all ten prompts and validate reference/fixture assets without requiring a paid call. Generation produces separate concepts, uses 3:4/2k, bounds attempts to four per concept, records exact native resolution, and never fabricates unsupported seeds.",
      "Make publication persist named PNG masters and JPEG derivatives through xAI Files with no file expiration and non-expiring anonymous public URLs. Resume from saved attempts rather than repurchasing successful images. Persist a redacted JSON attempt ledger immediately after each API response; separate failed requests, decoded images, published assets and activated gallery content. Never treat temporary imgen URLs as delivery.",
      "Implement scripts/sketches-check.ts, a typed content/portraits.json manifest initially containing zero records, and npm run sketches:check. A portrait record includes concept id, filename, permanent master/derivative URLs and file ids, content hashes, MIME, bytes, native and derivative dimensions, prompt/settings/reference fingerprints, actual model and review disposition. Validate exact required filename mapping, 3:4, derivative 1152x1536 and <600000 bytes, uniqueness, HTTPS CDN allowlist and non-expiring provenance. Default mode is offline; --live is a read-only download/hash/decode check; --require-people requires ten complete real records. Reject missing, extra, partial and fake records in delivery mode.",
      "Extend Sketch.kind with person, consume the portrait manifest in content/site.ts, and add a conditional People section on /sketches with 1152x1536 intrinsic dimensions and responsive sizes. Retain FigTitle 07 and the six-line console menu. Use only the exact files-cdn.x.ai remote pattern in next.config.ts, validate URLs against that host in the manifest, and expose named master downloads with a manifest-only filename lookup route at app/(site)/(app)/sketches/download/[filename]/route.ts. Stream the public PNG with correct Content-Type and Content-Disposition; unknown names return 404, upstream failures return a controlled 502, and arbitrary external URL parameters are rejected.",
      "Keep production's existing twelve entries and intro until the ten-record reviewed manifest exists. Derive intro/counts from activated content. Captions come from prompts.md. Add lib/sketches.test.ts and lib/sketches-generation.test.ts to the existing npm test discovery; create image fixtures at test time from text so no fixture binaries are committed. Use a loopback fake HTTP server with proxy env scrubbed to prove request serialization, PNG/JPEG processing, public publication, resume, 401/429/5xx, malformed payloads, wrong dimensions, duplicate bytes, expiry and download-route failures. Rendering tests pass fixture records directly, without a public fixture mode.",
      "Add scripts/walk-sketches.sh and a browser probe supporting a local production server or read-only BASE_URL mode with EXPECT_PEOPLE. Assert build-sha, section/figure counts from rendered DOM, responsive loaded images and named PNG download behavior. Document commands and the durable manifest lifecycle in README.md. Run tests, build and push; deployment checks belong to verification and QA."
    ],
    "interfaces": [
      "lib/sketches-generation.ts",
      "lib/sketches-generation.test.ts",
      "lib/sketches.ts",
      "lib/sketches.test.ts",
      "lib/pages.test.ts",
      "scripts/sketches-paint.ts",
      "scripts/sketches-check.ts",
      "scripts/walk-sketches.sh",
      "scripts/probe-sketches.mjs",
      "content/portraits.json",
      "content/site.ts",
      "app/(site)/(app)/sketches/",
      "next.config.ts",
      "package.json",
      "package-lock.json",
      "README.md",
      "projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/prompts.md"
    ],
    "non_goals": [
      "Real image generation or a claim of completed artworks in this task",
      "New public page or console menu line",
      "A general GPU runner, queue, model training or flux2-klein changes",
      "Committed image binaries, paid API calls in verification, secrets in manifests",
      "Changes to the existing twelve paintings"
    ],
    "verification": [
      {
        "name": "Repository tests including fake publisher and renderer",
        "cwd": ".",
        "cmd": "npm test",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Locked processor and adapter preflight",
        "cwd": ".",
        "cmd": "node --experimental-strip-types scripts/sketches-paint.ts preflight --offline",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Offline manifest and existing asset validation",
        "cwd": ".",
        "cmd": "npm run sketches:check",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Type safety",
        "cwd": ".",
        "cmd": "npm run typecheck",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Lint",
        "cwd": ".",
        "cmd": "npm run lint",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Production build",
        "cwd": ".",
        "cmd": "BETTER_AUTH_SECRET=ci-placeholder-not-a-real-secret-0123456789abcdef npm run build",
        "expect": "exit0",
        "timeout_s": 600
      },
      {
        "name": "Production gallery walk before activation",
        "cwd": ".",
        "cmd": "SKIP_BUILD=1 EXPECT_PEOPLE=0 bash scripts/walk-sketches.sh",
        "expect": "exit0",
        "timeout_s": 300
      }
    ]
  },
  {
    "sequence": 2,
    "title": "Publish and activate ten reviewed portraits",
    "role": "software_engineer",
    "depends_on": [
      "1"
    ],
    "qa": "required",
    "problem": "Tooling and fixture tests do not deliver the requested paintings. Ten individually reviewed masters and public derivatives must exist durably before the People section is activated.",
    "acceptance_criteria": "The real manifest contains ten distinct reviewed paintings, with the exact 01_Quiet_Reader.png through 10_Letter_Writer.png mapping in prompts.md and working anonymous PNG downloads. /sketches shows twenty-two figures in three sections, including ten responsive portraits. Each published derivative is 1152x1536 JPEG under 600000 bytes; native master resolution is recorded honestly. Independent QA accepts each image and the collection.",
    "action_items": [
      "At task start, inspect secure XAI_API_KEY availability or an already provisioned .grok settings mount without printing secrets. Binding grok-main to otohime is already done but does not guarantee an API key on an agy lease. If obtaining a usable key needs a person's sign-in/provisioning, immediately call plan_manager_ask_user kind=operator_action fingerprint=provision-xai-image-key:otohime with the exact environment provisioning chore, report the task as parked and end; do not burn a fix cycle. Do not change the operator's role profile.",
      "Use the locked npm ci environment and the task-1 preflight to prove real sharp imports, adapter construction, prompts and assets. Retrieve and view the Pinterest original as style-only reference. Consult current official xAI docs and capture actual model/settings, not the research's old defaults. Make one real initial concept call as the authentication/output smoke test; retain a usable output as a candidate. On a definitive credential rejection, raise the stable fallback chore generate-portraits:grok-imagine to generate/upload the exact named masters from the committed pack and provide durable file ids/URLs, then report and end.",
      "Run the on-demand paint command for ten separate concepts, starting with one candidate each and generating replacements only for observed defects, at most forty candidates total. Choose a consistent documented model/settings set. Use the frontal seated Reader composition. Never draw replacement pictures with code or route portraits through the sprite-only flux2-klein recipe. Keep native PNG masters and review contact sheet outside git.",
      "Inspect every candidate and each keeper at full size against prompts.md. Regenerate any rejected anatomy, digital gloss, style drift, copying, text, watermark or composition defect; record per-image rejection reasons and final acceptance in projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/artwork-review.md with public evidence URLs and actual resolutions. Different file hashes alone are not visual originality.",
      "Publish all ten named PNG masters and ten labeled JPEG derivatives to non-expiring xAI Files public URLs through the tested path. Import operator-produced masters through that same processor/validator if necessary. Persist attempts and file ids durably before scratch is lost. Verify public downloads and hashes before committing a complete ten-entry content/portraits.json. Never commit image binaries or temporary/signed source URLs.",
      "Activate the ten real content records together, preserve the twelve existing studies, update intro/hint to twenty-two studies and places, small things and people, and use the researched titles/captions. Update lib/pages.test.ts to require 22 entries, exactly ten people, unique titles/URLs and a six-line menu. The gallery must offer the exact named master downloads.",
      "Update the read-only walk/probe delivery assertions to require twenty-two figures, ten loaded portrait images and ten named master downloads; do not use image generation in verification. Keep failures visible if real output is missing. Run checks, commit with pm-240/<assigned_task_id>: prefix and push. SWE stops at the push; QA performs deployed review."
    ],
    "interfaces": [
      "content/portraits.json",
      "content/site.ts",
      "lib/pages.test.ts",
      "lib/sketches.test.ts",
      "scripts/walk-sketches.sh",
      "scripts/probe-sketches.mjs",
      "projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/artwork-review.md",
      "projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/prompts.md"
    ],
    "non_goals": [
      "Synthetic fixture images as final deliverables",
      "Activation with fewer than ten accepted images",
      "Generation or shared-state writes in verification",
      "Expiring download links or image binaries in git",
      "Changing platform scheduling, agent profile pins or GPU recipes"
    ],
    "verification": [
      {
        "name": "Repository tests and activated collection invariants",
        "cwd": ".",
        "cmd": "npm test",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Real published files, dimensions and checksums",
        "cwd": ".",
        "cmd": "npm run sketches:check -- --live --require-people",
        "expect": "exit0",
        "timeout_s": 600
      },
      {
        "name": "Type safety",
        "cwd": ".",
        "cmd": "npm run typecheck",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Lint",
        "cwd": ".",
        "cmd": "npm run lint",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Production build",
        "cwd": ".",
        "cmd": "BETTER_AUTH_SECRET=ci-placeholder-not-a-real-secret-0123456789abcdef npm run build",
        "expect": "exit0",
        "timeout_s": 600
      },
      {
        "name": "Production collection and downloads",
        "cwd": ".",
        "cmd": "SKIP_BUILD=1 EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh",
        "expect": "exit0",
        "timeout_s": 600
      }
    ]
  }
]
```

## Operator and environment handling

The first task works without people or external generation. The second task's
first action checks whether usable credentials are already provisioned. If a
person must sign in or provision the key, raise
`kind=operator_action`, fingerprint `provision-xai-image-key:otohime`,
with the exact credential-installation chore and end the run with a parked report.
Never print the key or ask someone to choose an implementation policy.

If a real credential check is definitively rejected, raise the fallback chore
`generate-portraits:grok-imagine`: generate the ten separate artworks using
prompts.md, upload the named native PNGs to persistent Files storage, and return
their file ids/public URLs for the importer. This is a physical fallback chore,
not a style approval gate. The agent performs the visual review after import.
There is no known readiness HTTP URL for either chore, so do not invent a
ready_probe; include one only when an actual reachable readiness endpoint exists.

Network/429/5xx is an environment failure, not evidence that a person must start
a runtime. Capture the bounded raw response, actual request id and saved ledger,
then report the missing output and owner without polling. If a durable deferred
vendor request already exists, record its exact id, result-retrieval endpoint,
retention deadline and ingestion owner in the report; acceptance/watch can perform
one on-demand retrieval and import with the same code path. Do not create
duplicate billable requests to disguise missing results. A queued request alone
does not satisfy task 2, which remains incomplete until the named public files
exist. This plan requires no GPU runtime; if a subsequent scope change introduces
one, it must use the platform's durable queue/callback and fake orchestration
proof, with capacity-only checks assigned to watch and actual output still pending.

## QA and acceptance

Both tasks require QA. Task 1 is assessed against its limited integration scope:
inspect the actual diff, run a separately constructed malformed-publication and
unknown-download-name negative control, and exercise a fixture renderer and the
twelve-study production page. Report explicitly that no real paintings were
delivered by this task.

Task 2 QA independently fetches all twenty public artifacts, decodes and hashes
them outside the supplied checker, views all ten native masters at full size,
and compares a contact sheet with the reference and prompt pack. Check facial
proportions, convincing visible hands/violin grip, single adult subject, varied
ink strokes, organic washes, limited palette, negative space, distinct poses,
and no text/watermark/frame/signature. A single defective image fails delivery
until replaced. An occluded hand is assessed as drawn; do not require five
visible fingers when the pose hides them.

After GitHub checks and the Vercel deployment, QA opens /sketches at 1366×768 and
390×844. Count twenty-two rendered figures and ten People figures, verify all
ten images finish loading with nonzero natural size, check no horizontal
overflow, retain surrounding sections/menu, and download the ten named PNGs.
Use a read-only BASE_URL walk with the deployed build-sha, then independently
exercise one unknown filename (404) and intercept one portrait response with
a 404 in the browser to confirm the loaded-image assertion fails. A probe that
cannot fail when an image is broken proves nothing.

Acceptance traverses each concept: starting state → visit/scroll/download →
observed painting and named native PNG → evidence URL/hash. Check each done
task's green gate and actual delivered SHA. Use the real deployed page and file
responses rather than repeating only the SWE proof script. Missing output is
pending/incomplete, never converted to pass by fake tests.

Each report distinguishes **integration deployed**, **execution demonstrated**
and **product delivered**. If capacity is deferred, add **capacity pending**
with exact ids, owner, deadline and failure condition. State the actual run's
agent profile/model/effort and executable fingerprint (code, lock, settings,
prompt/reference and asset hashes); never substitute a newer unrelated SHA.

For the relevant saved attempt ledger, enumerate bounded FAILED and COMPLETED
history as well as current requests; inspect raw failures and publication/import
receipts and report counts, page bounds and whether history is complete.
Unavailable or truncated history is inconclusive. xAI is an HTTP vendor here,
not the platform GPU runner: do not imply task-manager generation history proves
its execution. Follow every retained candidate through selection, Files upload,
anonymous download and committed manifest. Repeated deterministic processor or
adapter failures remain defects even if a replacement request is pending.

No soak or future natural event is needed. Any genuine deferred request is
owned by the publishing task and then acceptance/watch, with its actual deadline;
the collection cannot be called delivered until the real artifacts are observed.

## Validation and saving this plan

Run the repository's own tests, lint, typecheck, production build and local e2e
harness before the PO commit. Record actual results in the summary report.
Commit the plan, prompts and research with subject prefix `pm-240/product_owner:`
and push using `git push origin HEAD`. On non-fast-forward rejection, rebase,
rerun the checks and push without force. Submit this committed plan path and
SHA with the short product title, then submit a summary report.
The proposed task ids are assigned by plan-manager; subsequent commits use the
actual assigned task id.

## Sources and provenance

- Prior report rep-4789, preserved verbatim in [research.md](research.md).
- [Reference pin](https://www.pinterest.com/pin/248120260716380781/).
- [Official xAI image generation](https://docs.x.ai/developers/model-capabilities/images/generation).
- [Official xAI image editing](https://docs.x.ai/developers/model-capabilities/images/editing).
- [Official xAI Files public URLs](https://docs.x.ai/developers/files/public-urls).
- [Persisting generated output](https://docs.x.ai/developers/model-capabilities/imagine/files/outputs).
- [Quality alias retirement](https://docs.x.ai/developers/migration/imagine-image-quality-nov-2).
- Current repository: `app/(site)/(app)/sketches/page.tsx`, `content/site.ts`,
  `lib/pages.test.ts`, `next.config.ts`, `scripts/e2e-local.sh`,
  `.github/workflows/ci.yml`.
