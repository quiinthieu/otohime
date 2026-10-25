# Ink & Watercolour Portraits

Plan **pm-240** · revision **3** · product-owner **run-8468**
Baseline: `b16f2c624959fe2d40cd8aace620c136d9a08fce`.

## Outcome and retained work

A visitor to https://otohime.dev/sketches must see, open and download ten original ink-and-watercolour portraits as a third **People** section alongside the twelve earlier studies. Delivery is **0/10**, activation **0/10** at this revision's baseline. This plan restores the original artwork outcome; a production kit cannot complete it.

Keep completed **t-1471** (processor, xAI adapter, validator, download route and gallery support) and **t-1510** (portable production kit). Neither is re-proposed. Keep [research.md](research.md), [prompts.md](prompts.md), [production-kit/](production-kit/), [handoff.md](handoff.md) and all existing images. The research report rep-4789 is already committed; it is historical evidence, not a claim of current authentication.

The sole remaining task below starts at sequence 1 and has no dependencies. No new preparatory code or kit task can substitute for it.

## Chosen route: provision the existing xAI path

Choose change-request route 1: install a usable **XAI_API_KEY on the actual otohime SWE lease**. The current pinned SWE profile is `agy-argon-high` / `gemini-4-argon` / high; its eligible account is `billie-agy`. Provisioning must survive a fresh lease of that profile. A supported mounted `.grok/user-settings.json` containing an API key is also sufficient. Do not put a key in chat, git, a public readiness endpoint or a report.

This choice fixes both image generation and the already implemented xAI Files publication path. Re-signing `grok-main` alone would not: its registry status is `auth_expired`, its repo bindings are `[]`, and the pinned SWE profile leases another provider. The operator may instead restore the full grok path only if the actual dispatched lease can resolve a usable API key; an OAuth CLI session and an account binding are not that proof.

Raise **one** deduplicated `operator_action`, fingerprint **provision-xai-image-key:otohime** (existing esc-371), after saving and proposing this plan. Its chore is provisioning, not choosing policy or approving this plan. End the run immediately after the short board report; never poll for the person. At the first dependent task's start, refer to the same action if it is still unready and end that run.

Readiness is an explicit safe receipt from a fresh pinned lease: preflight `credentialAvailable=true` and source, plus one successful generation and permanent Files upload/publication with request id, file id, anonymous-download SHA-256/byte count and actual model. The task performs that one canary and reuses its Reader candidate; the operator supplies the credential and confirms its placement, without sending the key. There is no HTTP endpoint exposing credential readiness today, so **ready_probe is omitted**. A healthy /api/health URL would resolve the action falsely. A waived chore or answer alone is not generation or publication proof.

If provisioning does not become real after this single action, retain the done work and record the original outcome **undelivered**, then seek terminal closure through the board's decider/acceptance path. Do not propose another kit revision, create a new fingerprint, retry expired-login jobs or spend repeated fix cycles on absent files. This PO cannot invoke decider-only close controls; it does not pretend that an advisory answer provisions a secret.

## Evidence and alternatives

Fresh observations in run-8468:

- `task_manager_list_accounts`: grok-main auth_expired, repos=[]; billie-agy and codex-main active and eligible for otohime.
- Locked Node 22.23.3 / sharp 0.35.5 preflight runs the real processor and constructs the real adapter; ten concepts, twelve base studies, zero portrait records, credentialAvailable=false, source=none.
- Production-kit check succeeds and explicitly reports paintingsDelivered=0 and galleryPortraitsActivated=0. Offline sketches check succeeds for the twelve base studies; it is not the artwork gate.
- Existing URL validator and Next remote pattern accept only permanent HTTPS files-cdn.x.ai URLs without queries or credentials.
- Repo registration has no ci_token; this lease exposes no gh command or GitHub/xAI API-key environment variable. No generic durable asset-upload MCP was found.

The imagegen skill and built-in image generator are available without OPENAI_API_KEY. Revision 2 already noticed that fact: local generation does not solve permanent publication. Tool availability was inspected, **no image was generated or claimed** in this planning run. A GitHub release or other new host would need demonstrated upload authority, persistence and a separately planned allowlist/provenance scope change; none is provisioned here. Do not infer such authority from the SSH push key.

Producer-supplied masters remain a possible future input, but neither masters nor permanent approved URLs currently exist. That route still requires publication authority. FLUX2-klein remains outside this RGB portrait scope. No alternate route is represented as executable merely to avoid recording the missing credential.

The change request and acceptance_run-8466 evidence are retained. Prior live failure evidence is attributed to that run, not relabelled a new browser observation. This run changes documentation only and does not launch an asynchronous generation job, change a runtime or claim capacity deferral. No GPU queue/watch is appropriate to a missing API credential. If actual platform capacity becomes the only missing input in later implementation, submit the real durable job with callback and exact ids, prove its fake orchestration and real locked preflight, then transfer only the unavailable real result to pending/watch; known executable defects still fail.

## Artwork and publication contract

Use the complete ten prompts and composition/palette/pose guidance in production-kit/. All ten must feel like one expressive ink-and-watercolour sketchbook: varied black strokes, transparent irregular washes, restrained palettes, incomplete contours and sparse off-white paper. Exactly one original young adult woman per image. View the reference for technique; the Reader remains seated in frontal three-quarter view, book in lap, no headscarf, rather than copying its profile composition.

Generate separately at native 3:4, preferably >=1536×2048; never upscale a master. Declare any lower native resolution honestly in review evidence. Each derivative is exactly 1152×1536 JPEG and <600000 bytes. Do not accept a tiny native output merely because a schema permits it: high-resolution usability is part of visual QA.

| Native PNG master | Gallery JPEG |
|---|---|
| 01_Quiet_Reader.png | 13-reader.jpg |
| 02_Flower_Girl.png | 14-flowers.jpg |
| 03_Rainy_Afternoon.png | 15-rain.jpg |
| 04_Cafe_Dreamer.png | 16-cafe.jpg |
| 05_Autumn_Wanderer.png | 17-leaves.jpg |
| 06_Violinist.png | 18-violin.jpg |
| 07_Morning_by_the_Window.png | 19-window.jpg |
| 08_Painter.png | 20-painter.jpg |
| 09_Spring_Breeze.png | 21-breeze.jpg |
| 10_Letter_Writer.png | 22-letter.jpg |

All twenty artifacts need permanent anonymous files-cdn.x.ai URLs, expiresAt=null, actual file ids, MIME, byte counts, dimensions and SHA-256. Keep binaries, contact sheets, raw signed candidate URLs and credentials out of git. Persist only sanitized provenance/review text and complete public manifest records. Partial publication does not activate People.

Inspect each master at full resolution against all ten checklist items in production-kit/manifest.json; make a scratch contact sheet and inspect consistency and distinctness together. Record actual accepted/rejected attempts and reviewer identity in artwork-review.md. No automatic acceptance. Different file hashes alone do not prove different images. Preserve the original generation request/model provenance rather than inventing xAI provenance for imported images.

## Remaining build contract

```json
[
  {
    "sequence": 1,
    "title": "Generate, review and publish the ten portraits",
    "role": "software_engineer",
    "depends_on": [],
    "qa": "required",
    "problem": "The gallery tooling and production kit are complete, but content/portraits.json is empty and none of the ten paintings exists. Image generation and durable publication both require an xAI API key that the pinned otohime SWE lease cannot currently resolve.",
    "acceptance_criteria": "All ten separately generated original adult-woman portraits are reviewed at full size and together, durably published as the exact named native 3:4 PNG masters and ten 1152x1536 JPEG derivatives below 600000 bytes, with hashes, byte counts, dimensions and honest generation provenance. /sketches preserves the twelve earlier studies and displays all ten People portraits with working named master downloads. The live required-people check and desktop/mobile deployed walk pass; a text kit, fixture, queued request or credential presence alone cannot satisfy this contract.",
    "action_items": [
      "At task start read AGENTS.md, plan.md revision 3, prompts.md, handoff.md and artwork-review.md. Reuse done t-1471 and t-1510. Run the existing offline preflight in npm ci's Node 22 / locked sharp environment. The person-only prerequisite is installing a usable XAI_API_KEY on otohime leases running pinned agy-argon-high (including its eligible billie-agy account), or a supported mounted settings file containing an actual API key. Link the one provision-xai-image-key:otohime action raised by run-8468. If unavailable, call plan_manager_ask_user kind=operator_action with that same fingerprint at the start and end the run with a short missing-input report. Do not repeat sign-in probes or fabricate a readiness endpoint; a waived escalation or a prose 'done' answer is not successful vendor execution.",
      "Once the key is reachable on the real pinned lease, obtain the safe readiness receipt: preflight credentialAvailable=true and credentialSource; one Reader generation through the existing adapter with actual request/model ids; one non-expiring xAI Files upload/public-url round trip of the resulting real PNG, anonymously re-downloaded with matching bytes and SHA-256. Reuse this candidate and publication receipt. Refresh the API contract from primary xAI documentation if the real response disagrees with the locked adapter. Treat a deterministic endpoint/schema failure as a defect, reproduce it with a fake, and fix it within the listed interfaces; do not relabel it capacity or blindly generate the remaining nine.",
      "Use the existing ten standalone prompts and shared style, preserving the seated frontal three-quarter Reader with book low in her lap and no headscarf. Generate each painting separately with grok-imagine-image-2.0, requested 3:4/2k and at most four attempts per concept including the canary. Record returned model, settings, request ids and actual native size rather than invented seeds. Use the Pinterest image only for technique and original adult subjects; retain its known source-byte hash separately from the parser's reference-URL hash. No code-drawn images, collage-as-master or automatic accept-all.",
      "Inspect every native candidate with an image viewer against the ten-item production-kit checklist and compare all ten in a scratch contact sheet. Record accepted and rejected attempt ids, reasons, reviewer, review time and actual dimensions in artwork-review.md. Check plausible visible hands and faces, one adult woman, expressive varying ink, organic washes, sparse off-white paper, 3-5 dominant colours, distinct poses and no text/border/watermark. Regenerate rejects within the bounded budget. Prefer native >=1536x2048; never upscale a master or conceal a smaller native size. Preserve raw generation provenance when marking the chosen ledger candidates accepted.",
      "Use the existing processor and publisher to produce all ten exact PNG master names and JPEG names listed in plan.md. The JPEGs must be 1152x1536 and below 600000 bytes each. Publish all twenty to non-expiring anonymous files-cdn.x.ai URLs and verify downloaded bytes, hashes, MIME and dimensions. Preserve public file ids and sanitized attempt evidence durably in the review document before scratch is lost; exclude keys, raw signed candidate URLs, machine-specific paths and image binaries from git. Partial remote uploads are not an activated collection.",
      "Write content/portraits.json only when ten visually accepted, publicly verified records are complete. Keep the existing conditional People rendering, researched captions, six-line console menu and twelve original studies. Update only stale count assertions/copy that prevents the existing 22-study activation. Preserve --require-people and EXPECT_PEOPLE=10 semantics. If a real processor/adapter defect requires code changes, read the relevant installed Next guide first when applicable, declare the interface, write the failing fake test, and fix it; do not rebuild the accepted production kit.",
      "Run the checkout verification, commit every change with pm-240/<assigned_task_id>: and push git push origin HEAD. Rebase and rerun checks on a non-fast-forward rejection; never force push. Report the actual profile/model/effort, executable fingerprint (code, lock, settings and output hashes), safe vendor receipts, real/fake boundaries and remaining defects. SWE stops at the push; deployed proof belongs to the verification probe, independent QA and acceptance. If the one provisioning action is resolved without actual credential readiness, report undelivered and request terminal closure rather than another unchanged contract or kit-only replacement."
    ],
    "interfaces": [
      "content/portraits.json",
      "content/site.ts",
      "lib/pages.test.ts",
      "lib/sketches.ts",
      "lib/sketches.test.ts",
      "lib/sketches-generation.ts",
      "lib/sketches-generation.test.ts",
      "scripts/sketches-paint.ts",
      "scripts/sketches-check.ts",
      "scripts/walk-sketches.sh",
      "scripts/probe-sketches.mjs",
      "projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/artwork-review.md"
    ],
    "non_goals": [
      "Rebuilding completed tooling or the production kit",
      "New pages, menu entries, providers, GPU recipes, schedules or storage hosts",
      "Changing role profile pins or treating CLI OAuth as an xAI API key",
      "Synthetic final paintings, fewer than ten activated records, binaries/secrets/signed URLs in git",
      "Generation, uploads, credential writes or other shared-state mutations in verification",
      "Passing the original outcome from submission-only evidence"
    ],
    "verification": [
      {
        "name": "Repository suite including collection and adapter negative controls",
        "cwd": ".",
        "cmd": "npm test",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Durable real files and complete reviewed collection",
        "cwd": ".",
        "cmd": "npm run sketches:check -- --live --require-people",
        "expect": "exit0",
        "timeout_s": 600
      },
      {
        "name": "Keep the accepted production kit valid",
        "cwd": ".",
        "cmd": "npm run portraits:handoff:check",
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
        "name": "Built gallery and browser delivery checks",
        "cwd": ".",
        "cmd": "SKIP_BUILD=1 EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh",
        "expect": "exit0",
        "timeout_s": 600
      },
      {
        "name": "Read-only deployed desktop and mobile proof",
        "cwd": ".",
        "cmd": "BASE_URL=https://otohime.dev EXPECT_SHA=$(git rev-parse HEAD) EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh",
        "expect": "exit0",
        "timeout_s": 600
      }
    ]
  }
]
```

Verification is read-only against shared services: it never generates, uploads or provisions credentials. Build/test commands may write local checkout artifacts. The live-file check needs public artifact URLs, **no image runtime or vendor credential**. The deployed probe is a green-gate/QA responsibility after CI deploys, not a SWE action item.

## Independent QA and product acceptance

QA obtains its own twenty anonymous downloads, computes hashes/dimensions/bytes independently, views every full-size master and a freshly assembled contact sheet, and compares the subjects, outfits, palettes and poses with the ten-item brief. QA opens /sketches at **1366×768** and **390×844**, checks 22 figures, ten loaded portraits and all ten named download links, and reads the served build-sha. Scroll to load images; a full-page screenshot with lazy blank sheets is not proof of missing art.

Keep these acceptance gates unchanged:

- `npm run sketches:check -- --live --require-people` exits 0.
- `BASE_URL=https://otohime.dev EXPECT_SHA=<delivery-sha> EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh` exits 0; its browser probe covers both viewports.
- All ten masters and derivatives meet the file and visual requirements above; the twelve earlier studies and six console menu lines remain intact.

QA must falsify a relevant claim independently: remove one portrait record in a scratch copy and confirm required-people rejection, and request an unknown download filename/external URL to confirm 404/400 without turning the route into a proxy. A second role simply rerunning the SWE summary is insufficient.

Reports separate **integration deployed**, **waiting for capacity**, **execution demonstrated** and **product delivered**, cite actual run profile/model/effort and delivery/build identities, name the fingerprint of relevant code+lock+settings+artifacts, and distinguish fake HTTP tests from real vendor/public-download proof. For any asynchronous jobs introduced, inspect bounded paginated FAILED and COMPLETED history and current jobs, read raw failure tails, follow callback ingestion, and record history counts/completeness. Unread or truncated history is inconclusive, not clean; unrelated documentation SHAs do not repair an executable.

No queued job, planned prompt, credential flag or advisory answer satisfies artwork acceptance. There is no dated condition or natural schedule in this plan, and no task proves anything by waiting.

## Standing instructions and planning validation

The referenced Chief of Staff extraction and software-development documents are absent from otohime. Read their available mono-v2 copies on this worker; retain standing rules in AGENTS.md / docs/claude/software-development.md rather than copying them into new permanent policy files. AGENTS.md was read. No Next application code changes in this PO run.

Planning verification: npm ci and the project's npm test, plus production-kit/offline-sketch checks and real locked preflight. The original required-people failure is a negative control and must remain visible until real artwork is activated. No external execution/deployment success is inferred from this documentation commit.
