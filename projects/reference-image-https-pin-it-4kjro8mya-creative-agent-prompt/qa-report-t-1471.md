# QA report: pm-240 / t-1471 (Build portrait tooling and gallery support)

Run run-8310, role quality_engineer, model Sonnet 5.5. Delivery sha `702c5dd82d5c66c6d1f8acb5df2a8c4826df7b9a` (== origin/main HEAD at QA time; contains itself, so `merge-base --is-ancestor` holds). Green gate: pass for 702c5dd (supplied; all 7 items re-run here).

Author check: author and committer are `Otohime <quiinthieu@gmail.com>`, no Co-Authored-By trailer. (No author.txt artifact was supplied; the git header was checked directly.)

## Scope verdict
- Integration deployed: pushed to origin/main. GitHub CI run for 702c5dd was `in_progress` when read through the public API (checks job in progress; cleanup/preview skipped). Not waited on. Vercel deployment not observed.
- Execution demonstrated: yes, on a different machine than the SWE gate (Linux, Node v22.23.3, fresh `npm ci`, sharp 0.35.5).
- Product delivered: NO, by design. content/portraits.json is `[]`; no real paintings exist. Real generation, publication and the ten-person activation belong to t-1472 and remain unproven. No xAI call was made (credentialAvailable=false).

## Independent runs (cwd = repo root, fresh npm ci)
1. `npm test`: 1429 pass, 0 fail, 0 skipped.
2. `node --experimental-strip-types scripts/sketches-paint.ts preflight --offline`: exit 0; real sharp import, processor smoke 768x1024 -> 1152x1536 JPEG (23508 B), adapter constructed, 10 prompts parsed, 12 base sketches verified, 0 manifest records.
3. `npm run sketches:check`: 12 base sketches, 0 portraits, 0 errors, exit 0.
4. `npm run typecheck`: pass. 5. `npm run lint`: 0 errors, 9 pre-existing warnings.
6. Production build with placeholder BETTER_AUTH_SECRET: pass; /sketches and /sketches/download/[filename] (dynamic) built.
7. `SKIP_BUILD=1 EXPECT_PEOPLE=0 bash scripts/walk-sketches.sh`: probe 21 ok / 0 failed, walk 13 ok / 0 failed (2 sections, 12 figures, 1366x768 and 390x844, no overflow, download route 404/400).

## Negative controls (own construction, not the SWE script)
- `sketches:check --manifest <[]> --require-people`: exit 1 ("0 records ... requires all 10").
- A hand-written one-record manifest with host evil.example.com, provenance "fixture", missing derivative: exit 1 with 23 errors incl. non-files-cdn.x.ai URL rejection and provenance rejection; also fails in default (non-delivery) mode, so partial manifests are not silently hidden.
- `sketches:check --live --require-people` on the committed manifest: exit 1 (cannot pass without real records).
- The walk's own controls were observed passing: intercepted-404 image fails the loaded-image assertion; unknown filename 404; external URL parameter 400.

## Real/fake boundaries
Real: sharp decoding/encoding, adapter construction, Next build/server, headless Chromium. Fake: xAI API (in-process loopback in lib/sketches-generation.test.ts); the live CDN path (--live) and 502 upstream path were exercised only via tests, not against files-cdn.x.ai. No image binaries added by the commit (diff checked).

## History / ledger
No attempt ledger exists (no generation ever run); FAILED/COMPLETED vendor history count = 0, complete (nothing to read). No deferred checks created by this task.

## Observations (non-blocking defects/notes)
- SWE report claims differ slightly from code: processor enforces 3:4 but accepts native sizes below 1536x2048 (recorded as resolutionLimitation) rather than rejecting them; credential sources are XAI_API_KEY and .grok settings files (XAI_SETTINGS_PATH), not --api-key-file/XAI_API_KEY_FILE; 401 vs 429 retry behaviour is as tested. t-1472 should confirm native resolution honestly.
- Deferred, owner t-1472 QA/acceptance: deployed read-only `BASE_URL=... EXPECT_PEOPLE=10` walk, live CDN hashes. Fails if any of the 20 URLs is non-200, mismatched hash, or the walk does not show 22 figures.

Verdict: pass for t-1471's stated integration-readiness scope only.
