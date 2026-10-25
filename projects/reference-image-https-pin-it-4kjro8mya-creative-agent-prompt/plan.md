# Ink & Watercolour Portraits

Plan **pm-240** · revision **2** · product-owner run **run-8397**

Repository baseline: `bc9137c1ff01c145fa96cdfd6ae65ac23ab61c2c`. This revision replaces
only superseded **t-1472**. Completed **t-1471** remains done and is not re-proposed.

## Deliverable for this revision

Deliver a **portable portrait production kit**: ten independently usable complete
ink-and-watercolour prompts, the exact return filenames, captions, style and review
requirements, a deterministic provenance manifest, and a credential-free export/check
command. Keep the original ten-painting goal visible as **undelivered: 0 of 10**.

This is the nearest deliverable that can pass now under the operator's change
request. A kit is creative direction and a production handoff, not an illustration
collection. This revision's completion must never be reported as ten delivered
paintings. All original image requirements remain in [prompts.md](prompts.md);
[research.md](research.md) preserves rep-4789 verbatim. It is already committed
and was compared byte-for-byte with the report body in this run.

The new task has no credential, external-capacity, human-response or previous-task
dependency. No new paid account, storage provider, public UI or runtime is introduced.

## Failure evidence and what changes

| Evidence inspected | Observed result | Consequence |
|---|---|---|
| Board task t-1471; QA rep-4798 | Done; tooling accepted for integration readiness only | Preserve processor, adapter, validators, download route, prompt pack and conditional gallery |
| Board task t-1472 | Superseded after six SWE attempts on agy-argon-high and claude-opus-high | Do not retry its unchanged output-dependent contract |
| Latest gate ver-3339 / run-8389 at a6bce33 | Tests, lint, typecheck and production build pass; real-file check and 22-figure walk fail | These failures demonstrate missing product; they are not evidence of broken offline tooling |
| Raw task log 267d873e-7bce-47dc-ba6f-59bc0b08d67e | grok-4.7/high on billie-mac exits 1: Not signed in | A profile switch does not provision authentication |
| Current account registry read in run-8397 | grok-main enabled, auth_expired, repos=[] | Re-sign-in alone also does not restore repo eligibility |
| Current locked preflight in run-8397 | sharp 0.35.5 runs; adapter constructs; ten prompts parse; credentialAvailable=false; manifestRecordsCount=0 | Offline execution is demonstrated; image generation/publication is not |
| Current production manifest | content/portraits.json is [] | Keep twelve studies and no empty People section |

The operator describes exhausted QA cycles. The fetched record more precisely
locates the final failure in the **green verification gate before QA**. Repeated
checks of absent inputs consumed cycles even though code checks were green.

The failed task combined obtaining externally authenticated images, reviewing,
publishing, and activating them. The replacement exports a reviewable text product
with acceptance entirely inside a clean checkout. It adds only the missing
portable handoff capability, reusing the existing prompt parser. No task depends
on a person supplying images; no fixture becomes a portrait; no image-delivery
assertion is weakened. A second tooling or activation task would duplicate
finished work or recreate the same unavailable-input dependency.

This session exposes an image-generation tool, but tool availability alone does
not establish durable anonymous publication to the implemented xAI-only
manifest/download path. We make no claim that image creation is universally
impossible. Changing publication infrastructure is outside this recovery scope;
this revision deliberately claims only the production kit.

## Creative direction and return contract

The kit preserves all ten concepts and exact mappings from prompts.md:

| Standalone prompt file | Native PNG master | Gallery JPEG derivative |
|---|---|---|
| 01_Quiet_Reader.md | 01_Quiet_Reader.png | 13-reader.jpg |
| 02_Flower_Girl.md | 02_Flower_Girl.png | 14-flowers.jpg |
| 03_Rainy_Afternoon.md | 03_Rainy_Afternoon.png | 15-rain.jpg |
| 04_Cafe_Dreamer.md | 04_Cafe_Dreamer.png | 16-cafe.jpg |
| 05_Autumn_Wanderer.md | 05_Autumn_Wanderer.png | 17-leaves.jpg |
| 06_Violinist.md | 06_Violinist.png | 18-violin.jpg |
| 07_Morning_by_the_Window.md | 07_Morning_by_the_Window.png | 19-window.jpg |
| 08_Painter.md | 08_Painter.png | 20-painter.jpg |
| 09_Spring_Breeze.md | 09_Spring_Breeze.png | 21-breeze.jpg |
| 10_Letter_Writer.md | 10_Letter_Writer.png | 22-letter.jpg |

Every prompt repeats the shared expressive, nonuniform black ink and loose
transparent washes, restrained palette, off-white #faf8f3 negative space and
unfinished edges. Exactly one original adult woman, age 20–30, appears per
painting; no text, signature, border, watermark or polished digital rendering.
The Reader stays seated in a frontal three-quarter view, book low in her lap,
without the reference's headscarf. This avoids copying the reference composition.

The future artwork return contract is unchanged: ten native 3:4 PNG masters,
preferably >=1536×2048 without upscaling, and ten 1152×1536 JPEG derivatives
under 600000 bytes. Actual lower native dimensions must be declared honestly.
Each file needs permanent anonymous public storage, exact byte count and SHA-256,
MIME and dimensions, prompt/settings provenance, and full-size visual review.
The existing adapter/allowlist accepts non-expiring files-cdn.x.ai publication.
No image binaries or signed URLs enter git. A candidate URL or a queued job is
not delivery. None of those image files exists in this revision's kit.

## Data and command contract

The source is prompts.md, parsed by the existing lib/sketches.ts parsePromptPack.
The new isolated handoff module exports/validates plain text values; its filesystem
CLI does not enter content/site.ts or the App Router dependency graph.

`node --experimental-strip-types scripts/sketches-handoff.ts export --output-dir <dir>`
writes ten .md prompts plus manifest.json; `check --input-dir <dir>` validates without
rewriting anything. Both commands accept `--prompts <path>`; their default directory
is this plan folder's production-kit/. Package aliases are portraits:handoff:export
and portraits:handoff:check. Success is exit 0; invalid kit is exit 1 with a stable
reason and offending path/concept; invalid CLI usage is exit 2.

manifest.json has schemaVersion=1 and status=production_required. It records source
pack hash, reference URL and **referenceUrlSha256**, ten ordered concept rows with
mapping/caption, full-prompt hash and exact prompt-file bytes/hash, review checklist
and image requirements. The existing parser's referenceSha256 hashes the URL text,
not downloaded reference bytes: name it accurately. Generation settings are
**unverified guidance**, not an actual model execution record. No accepted images,
file ids or completion status are fabricated.

Export is deterministic: no current timestamps, host paths, secrets or run-specific
values in its output. Check compares against the canonical source as well as the
stored hashes, so coordinated prompt/hash tampering is rejected. Constrain file
reads/writes to the declared output/input tree, reject escaping paths/symlinks and
unexpected files. Tests use temporary directories; only final text kit files are
committed.

Use stable reasons: missing_file, extra_file, prompt_mismatch, source_mismatch,
metadata_mismatch, duplicate_mapping, invalid_path, invalid_status and invalid_cli.
The ten review checklist items are: one adult subject; natural face/proportions;
plausible visible hands (occlusion allowed); varied expressive ink; organic loose
washes; three-to-five-colour palette; sparse off-white paper; original distinct
pose; absence of digital polish/anime/photorealism; absence of text, frame,
signature and watermark. These are future viewing criteria, not kit review passes.

## Remaining task DAG

Only the following task is proposed, numbered from 1. It has no dependencies;
t-1471 remains completed outside this proposal. QA is required despite the limited
scope so an independent role verifies the recovery deliverable and its boundaries.

```json
[
  {
    "sequence": 1,
    "title": "Export and verify the portable portrait production kit",
    "role": "software_engineer",
    "depends_on": [],
    "qa": "required",
    "problem": "The ten paintings cannot currently be generated and durably published through the provisioned xAI path: grok-main is auth_expired, its repo binding is empty, and no masters exist. t-1471 already supplies gallery tooling and a combined prompt pack, but an external producer still has to manually assemble ten prompts and a return checklist. Replace only the exhausted t-1472 with a useful, credential-free production handoff; do not claim artwork delivery.",
    "acceptance_criteria": "A clean npm ci checkout can export and check a portable text-only production kit without credentials or network access. The committed production-kit directory contains ten separately usable complete prompts and manifest.json with the exact ten PNG/JPEG filename pairs, captions, prompt/source hashes, review checklist and explicit production_required status. Missing, altered, duplicate or extra prompt files fail check with a stable reason. Production content/portraits.json remains [], the twelve existing sketches remain intact, and artwork-delivery checks still reject the absent collection. QA independently verifies the kit and its rejection behavior. This task delivers a production kit, not the ten paintings.",
    "action_items": [
      "Read otohime AGENTS.md, this revision of plan.md, prompts.md and artwork-review.md. Keep completed t-1471 unchanged. Reuse parsePromptPack from lib/sketches.ts; do not repeat account probes or dispatch credential-dependent generation. This task needs no person-only prerequisite and does not consume or re-raise esc-371/esc-372.",
      "Declare a small pure PortraitHandoff export/validation interface in lib/sketches-handoff.ts; implement scripts/sketches-handoff.ts export --output-dir <directory> and check --input-dir <directory>, with --prompts <path> for a source-pack override. Default both paths to projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/production-kit/. Add package scripts portraits:handoff:export and portraits:handoff:check using Node 22 strip-types. Do not import this filesystem CLI or any new module into content/site.ts or the App Router.",
      "Export ten UTF-8 Markdown files named with the exact master basename and .md extension, e.g. 01_Quiet_Reader.md through 10_Letter_Writer.md. Each contains the full shared style plus its concept composition as one copyable prompt, exact master/derivative names, caption, 3:4 orientation, preferred native >=1536x2048, and a note to report a lower native size honestly rather than upscale. Preserve the seated frontal three-quarter Reader, original adult subjects and all ten distinct poses, palettes and focal points. Treat prompts.md as the only creative source.",
      "Export deterministic manifest.json with schemaVersion=1, status=production_required, source prompt-pack SHA-256, reference URL and referenceUrlSha256 (the existing parser hashes the URL, not downloaded image bytes), and ten ordered concept records containing conceptId, title, caption, masterFilename, derivativeFilename, promptFile, fullPromptSha256 and exact UTF-8 prompt-file byteLength/SHA-256. Record generationSettings as unverified guidance from prompts.md, never as an executed model/seed. Include the ten-item visual review checklist and derivative requirement 1152x1536 JPEG <600000 bytes. Do not invent candidate ids, image hashes, accepted reviews, public URLs or completion claims.",
      "The check command reads without rewriting files. Verify exact filenames and order against parsePromptPack, full prompt equality, captions, manifest metadata, UTF-8 byte lengths/hashes and production_required status. Reject missing/extra files, duplicate filename mappings, tampered content or hashes, traversal/symlink escape, and status implying completed paintings. Return exit 0 with a concise structured summary on success; exit 1 with a stable reason and offending concept/path for invalid input; invalid CLI usage exits 2. Export may write only its explicitly resolved output directory, never production portrait content.",
      "Write failing interface/CLI tests in lib/sketches-handoff.test.ts before implementation. Use isolated temporary directories and no network: valid ten-concept round trip, deterministic repeated exports, Unicode captions/byte lengths, one-file tamper, missing/extra prompt, duplicate mapping, changed source pack, path escape and false completion status. Prove export/check do not resolve credentials or call a vendor even with an unusable key and network functions stubbed to throw. Include a negative control proving the existing delivery validator still rejects zero artwork records. Keep fixtures as text or generated test data outside production.",
      "Commit the generated production-kit text files and a handoff.md in the plan folder. The handoff explains the offline commands, the exact physical artifact return contract (ten named native PNGs plus ten named derivatives at non-expiring public URLs with byte/hash/dimension evidence), the full-size per-image and collection review requirements, and the current 0/10 delivery gap. Document existing import/publish/live-check commands accurately, including that xAI publication still needs a usable API key and repo/account provisioning. Link esc-371/esc-372 as existing advisory chores; never make completion depend on a reply. A producer can use each prompt in an image tool of their choice; that alone does not prove publication or activation.",
      "Run the contract checks, commit every task change with pm-240/<assigned_task_id>: prefix and push with git push origin HEAD. Keep content/portraits.json, gallery code, the twelve base assets and --require-people/EXPECT_PEOPLE=10 assertions unchanged. SWE stops at the push; QA checks the delivered text kit independently. Record actual results and explicit artwork non-delivery in the report."
    ],
    "interfaces": [
      "lib/sketches-handoff.ts",
      "lib/sketches-handoff.test.ts",
      "scripts/sketches-handoff.ts",
      "package.json",
      "projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/production-kit/",
      "projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/handoff.md"
    ],
    "non_goals": [
      "Generating, importing, publishing or visually accepting paintings in this task",
      "Activating People or modifying content/portraits.json, gallery rendering, existing artwork or delivery gates",
      "Rebuilding completed t-1471 tooling or changing prompt-pack creative direction",
      "Changing agent profiles, account bindings, shared credentials, paid providers, storage or GPU/runtime infrastructure",
      "Image binaries, synthetic paintings, signed URLs or secrets in git",
      "A public UI, extra page, menu entry, schedule, poller or capacity-dependent task"
    ],
    "verification": [
      {
        "name": "Repository tests including handoff contract and negative controls",
        "cwd": ".",
        "cmd": "npm test",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Read-only committed production kit verification",
        "cwd": ".",
        "cmd": "npm run portraits:handoff:check",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Real locked processor and adapter construction; no paid request",
        "cwd": ".",
        "cmd": "node --experimental-strip-types scripts/sketches-paint.ts preflight --offline",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Existing artwork remains valid in offline scope",
        "cwd": ".",
        "cmd": "npm run sketches:check",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Original artwork gap remains explicit",
        "cwd": ".",
        "cmd": "node --input-type=module -e 'import assert from \"node:assert/strict\"; import {readFileSync} from \"node:fs\"; import {spawnSync} from \"node:child_process\"; assert.deepEqual(JSON.parse(readFileSync(\"content/portraits.json\",\"utf8\")),[]); const r=spawnSync(\"npm\",[\"run\",\"sketches:check\",\"--\",\"--require-people\"],{encoding:\"utf8\"}); assert.equal(r.status,1); assert.match(r.stdout+r.stderr,/manifest contains 0 records/); console.log(\"Artwork delivery still fails explicitly: 0 of 10\");'",
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
        "name": "Production build regression",
        "cwd": ".",
        "cmd": "BETTER_AUTH_SECRET=ci-placeholder-not-a-real-secret-0123456789abcdef npm run build",
        "expect": "exit0",
        "timeout_s": 600
      }
    ]
  }
]
```

## Independent QA and acceptance

QA reads the actual delivered diff and the kit, not only the SWE summary.
Independently parse all ten Markdown outputs and manifest rows using a short
separate script or direct inspection, then compare with prompts.md: full shared
style, composition, captions, filenames and actual UTF-8 byte lengths/hashes.
Review the Reader originality change and the other nine poses, palettes and focal
points as **directions**, never certify nonexistent art. Reconstruct an export in
a temporary directory and compare it to the committed kit.

Exercise a negative control outside the supplied tests: alter one prompt and
update its manifest file hash to match; check must still fail against prompts.md.
Also remove a concept and verify rejection. Independently inspect that the live
portrait manifest stays empty, the existing twelve assets remain unchanged and
the original require-people assertion still reports the missing collection.
A green kit gate proves the kit only.

Acceptance walkthrough:

| Starting state | Action | Observable result |
|---|---|---|
| Clean checkout with npm ci, no provider key | Run handoff check | Ten complete prompt files and truthful production_required metadata pass |
| Empty temporary output directory | Run export then compare bytes | Exactly ten prompts plus manifest.json reproduce the committed kit |
| Temporary copy with a modified prompt and recomputed file hash | Run check | Stable rejection against canonical source |
| Temporary copy with one missing concept | Run check | Stable missing-file rejection |
| Production portrait manifest [] | Run original --require-people checker | Nonzero exit and 0-record gap; no fabricated gallery activation |

The revision may pass acceptance only for the production kit and retained
integration-readiness scope. Its report must explicitly say **paintings delivered:
0/10; gallery portraits activated: 0/10**. Do not claim the original visual objective
has been achieved. A full-collection claim requires the original full-size visual
review and twenty real artifact checks in a later output-delivery amendment.

## Deferred product gap and ownership

Existing advisory chores remain esc-371 (provision-xai-image-key:otohime) and
esc-372 (generate-portraits:grok-imagine). They are already waived by the decider;
this revision neither re-raises them nor uses their replies as gates.

Owner of the absent external artifacts/credential: the operator. Exact resumption
evidence is either ten native named masters available for import plus usable
durable publication access, or ten masters and ten derivatives already anonymously
available at supported non-expiring URLs with file ids, byte counts, hashes,
dimensions and producer provenance. API-key availability by itself is not proof
that art exists. If account leasing is used, grok-main also needs otohime repo
eligibility; there is no authorization here to change role pins.

Owner of the next delivery amendment: plan-manager product owner after actual
readiness evidence is supplied. It must retain finished tasks and propose real
production/review/publication and activation only when the corresponding inputs
are executable. That future work is **not scheduled in this DAG**. The gap fails
any claim of the original collection if any required master/derivative is missing,
unreachable, temporary, malformed, duplicated, stylistically rejected or not
correlated to its review evidence.

There is no durable generation job to track, no capacity-only deferral and no
dated readiness event. Do not invent queue ids, polling deadlines or a watch date.
No run idles or proves success by an unanswered chore or elapsed time.

## Evidence discipline and saving

The latest plan run listing contains 16 records (15 finished, this PO run running):
one research, two PO including this run, seven SWE including t-1471, one QA for
t-1471, and five verifier runs. This is complete for the returned plan-run listing.
The raw failed Grok job log was independently read. Vendor history is limited to
the saved attempt ledger: zero failed vendor HTTP requests, zero decoded candidates,
zero published assets and zero activated records; no credential allowed the HTTP
workflow to begin. That is not an audited account-wide vendor history.

Reports distinguish integration deployed, real locked offline execution,
fake HTTP tests and product delivered. Cite actual profile/model/effort, relevant
code/lock/prompt hashes and history coverage; truncated or missing evidence is
inconclusive. Do not attribute output to an unrelated newer commit. Synthetic
fixtures demonstrate code only. Known executable failures are defects, never
excused by missing capacity.

The current PO run is codex-sol-6-1-high, gpt-6.1-sol, high effort, codex-main on
avietidol-z490 per run-8397. It changes plan Markdown only. Standing guidance was
read from otohime/AGENTS.md and the locally available mono-v2 copies of
projects/20260921222547_plan_manager_chief_of_staff_extraction.md and
docs/claude/software-development.md; their platform staging recipes do not replace
otohime's GitHub/Vercel CI. No claim/other-role tool is called by this PO.

Run npm ci and the project's unit tests, lint, typecheck, production build, offline
sketch checks and local E2E harness. Record observed results in the PO summary.
Commit with subject prefix pm-240/product_owner: and push with git push origin HEAD.
On non-fast-forward, pull --rebase, rerun tests, push without force. Submit this
committed plan path/SHA via plan_manager_propose_tasks with the title
**Ink & Watercolour Portraits**, then plan_manager_submit_report(kind=summary).
