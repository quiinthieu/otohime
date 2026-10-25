---
plan_id: pm-240
run_id: run-8466
kind: change_request
cycle: 0
cited_sha: ef8035cc950f54a58f3bd714f49415f3c79e2dbc
---

# Change request: pm-240, the ten portraits still do not exist

## What a user still cannot do

A visitor to https://otohime.dev/sketches cannot see, open or download any of the ten ink-and-watercolour portraits the idea asked for (`01_Quiet_Reader.png` … `10_Letter_Writer.png`, 3:4, one young adult woman each, consistent sketchbook style). The page still shows only the twelve earlier studies.

The plan did produce a working text production kit and gallery tooling, but neither is a painting. **Delivered 0/10, activated 0/10.**

## Evidence (run-8466, deployed build-sha `ef8035c`)

- Chromium at 1366x768 and 390x844 shows 12 figures, sections Places and Small things, no People section and no portrait captions.
- `/sketches/download/01_Quiet_Reader.png` and `/10_Letter_Writer.png` return 404, as do `/sketches/13-reader.jpg` and `/22-letter.jpg`.
- `content/portraits.json` is `[]`. `npm run sketches:check -- --live --require-people` exits 1 with `manifest contains 0 records`.
- `BASE_URL=https://otohime.dev EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh` gives walk 8 ok / 18 failed.
- Root cause, unchanged since t-1472 (superseded after six attempts):
  - No otohime lease can reach an image-generation credential. `grok-main` is `auth_expired` (`Not signed in`, refresh token `invalid_grant`) and its `repos` is now `[]`.
  - `preflight --offline` reports `credentialAvailable: false, credentialSource: none`.
  - No producer-supplied masters exist.
- Evidence files are in `acceptance_run-8466/` next to this file, and the acceptance report is `acceptance_report_0.md`.

## Service

otohime (Next.js on Vercel), page `/sketches`, data `content/portraits.json`, delivery gates `scripts/sketches-check.ts` and `scripts/walk-sketches.sh`.

The external dependency is image generation plus durable public storage. Today that means xAI through `grok-main` or an API key, which is the only path the existing adapter and URL allowlist accept.

## Work for the product owner

The repo side is ready. The t-1471 import/publish/activate tooling and the t-1510 kit pass their own checks, and the gallery switches to 22 figures once ten reviewed records exist. What is missing is a way to produce ten real images and get them durably published. A further code-only or kit-only revision cannot close this gap. Re-running the unchanged credential-dependent contract would only burn cycles again.

For the next revision, decide which route makes real images obtainable, and record that choice:

1. **Restore the provisioned path.** This is a person chore outside the platform: re-sign `grok-main` (`grok login --device-code`) **and** re-bind it to `otohime`, or put a usable xAI API key on otohime leases. Either way, run the pinned task on a profile whose lease mounts that credential. The existing chore fingerprint is `provision-xai-image-key:otohime` (esc-371, waived). Raise it again only as one deduplicated `operator_action` with a ready signal; do not loop it.
2. **Accept producer-supplied masters.** Use the committed kit (`production-kit/`, `handoff.md`). The person-only step is generating and handing over ten named PNG masters. Publication must still reach a durable anonymous URL that the existing allowlist accepts, or the PO must explicitly widen that publication path. Widening it is a scope change and must be planned as one.
3. **Another image source the platform already holds.** No such source was found. research.md rules out flux2-klein (RGBA sprite pipeline, failing Colab capacity), and the account registry holds only agy/claude/codex/grok providers.

Whichever route is chosen, keep the existing delivery gates as acceptance:

- ten masters plus ten 1152x1536 JPEG derivatives under 600000 bytes, with hashes and dimensions;
- full-size visual review against the ten-item checklist, and a contact-sheet comparison for consistency and distinctness;
- `sketches:check -- --live --require-people` exits 0;
- the deployed `EXPECT_PEOPLE=10` walk passes at 1366x768 and 390x844.

Do not draw images in code, activate fewer than ten, or commit binaries or signed URLs.

If no route can become executable, the honest end state is to close the plan with the original outcome recorded as undelivered, rather than another kit revision that passes its own scope.
