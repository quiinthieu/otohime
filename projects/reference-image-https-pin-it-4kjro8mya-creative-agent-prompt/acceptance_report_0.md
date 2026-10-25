---
plan_id: pm-240
run_id: run-8466
kind: acceptance_report
verdict: fail
cycle: 0
cited_sha: ef8035cc950f54a58f3bd714f49415f3c79e2dbc
---

# Acceptance: pm-240, Ink & Watercolour Portraits (run-8466)

| Starting state | Action | Observable result | Evidence |
|---|---|---|---|
| otohime.dev serving build-sha `ef8035c` (contains t-1471 `702c5dd` and t-1510 `ef8035c`) | Open `/sketches` in Chromium at 1366x768 | HTTP 200. Sections are Places and Small things only. **12 figures, none in portrait orientation, no People section, no portrait captions, 0 download links.** 0 console/page errors, no horizontal overflow | `acceptance_run-8466/walk.json`; screenshot sha256 in `screenshots.sha256` |
| Same | Open `/sketches` at 390x844 | Same content: 12 figures, no People section, 0 errors, no overflow (10 of 12 images had loaded before the lazy below-the-fold ones) | `walk.json` |
| Same | `GET /sketches/download/01_Quiet_Reader.png` and `/10_Letter_Writer.png` (the idea's deliverable filenames) | **404** for both | `walk.json` |
| Same | `GET /sketches/13-reader.jpg` and `/22-letter.jpg` (gallery derivatives) | **404** for both. Control `/sketches/01-cove.jpg` returns 200 image/jpeg | `walk.json` |
| Same | Repo walk `BASE_URL=https://otohime.dev EXPECT_PEOPLE=10 EXPECT_SHA=ef8035c… bash scripts/walk-sketches.sh` (the activated-collection check) | **exit 1, walk 8 ok / 18 failed**: 12 of 22 figures, no `id="people"`, all ten `/sketches/download/NN_*.png` links missing, 2 of 3 rendered sections | `walk-people10.log` |
| Same | Same walk with `EXPECT_PEOPLE=0` (regression of the existing gallery) | exit 0, walk 16/16, probe 103/103. The twelve studies are intact, and the download route rejects unknown files (404) and external URLs (400) | `walk-people0.log` |
| Fresh `npm ci` at `25d0294` (main HEAD, macOS arm64 APFS, Node 22.23.3) | `content/portraits.json`; `npm run sketches:check -- --require-people`; `-- --live --require-people` | `[]`. Both exit 1: `manifest contains 0 records; --require-people requires all 10 reviewed portrait records` | `reqpeople.log`, `livepeople.log` |
| Same checkout, no provider credential | `npm run portraits:handoff:check` | exit 0: `production_required`, 10 verified prompt files, `paintingsDelivered: 0`, `galleryPortraitsActivated: 0` | `check.log` |
| Empty temp dir | `sketches-handoff.ts export`, then `diff -r` against the committed kit | exit 0. 11 files, byte-identical to `production-kit/` | `kit-controls.log` |
| Temp copy: `04_Cafe_Dreamer.md` edited, manifest byte length and SHA-256 recomputed (own negative control) | `check` | exit 1 `prompt_mismatch` `04-cafe-dreamer` | `kit-controls.log` |
| Temp copy without `09_Spring_Breeze.md`; temp copy with status `delivered` | `check` | exit 1 `missing_file` `09-spring-breeze`; exit 1 `invalid_status` | `kit-controls.log` |
| Repo checkout | `export --output-dir Content/acc-x` (case variant of protected `content/`); `frobnicate` subcommand | exit 1 `invalid_path`, nothing written (`git status` clean); exit 2 `invalid_cli` | `kit-controls.log` |
| Same | `node --experimental-strip-types scripts/sketches-paint.ts preflight --offline` | exit 0. Real sharp 0.35.5 processor runs and the xAI adapter is constructed. `credentialAvailable: false`, `credentialSource: none`, 10 concepts, 12 base sketches, 0 records | `preflight.log` |
| Same | `npm test`; `npm run sketches:check` | 1639 pass / 0 fail; `12 base sketches, 0 portraits, 0 errors (offline)` | `npm-test-summary.txt`, `skcheck.log` |
| task-manager account registry (read only) | `task_manager_list_accounts` | `grok-main`: `status auth_expired`, `cooling_reason "auth failure reported by a run"`, `repos []`, last ok 2026-10-12. No other account carries an xAI/image credential | MCP read in this run |

## Verdict: fail

The idea asked for **ten original ink-and-watercolour portraits**, delivered as separate 3:4 files `01_Quiet_Reader.png` … `10_Letter_Writer.png`. In the running product a person sees none of them:

- `/sketches` shows the same twelve studies as before the plan.
- The ten deliverable filenames and the ten gallery derivatives return 404.
- The repo's own activated-collection walk fails 18 checks.

**Paintings delivered: 0/10. Gallery portraits activated: 0/10.**

What does exist, and works:

- **t-1471 tooling** (portrait manifest and conditional gallery section, sharp processor, xAI adapter, download route, checks). It runs offline in the locked environment, and its gates correctly reject the empty collection.
- **t-1510 production kit**: ten standalone prompts, the manifest, `handoff.md`, and an export/check CLI. Export reproduces the committed kit byte for byte. Check is read-only and rejects coordinated tampering, missing files, false completion status, case-variant protected paths and bad CLI usage.

Both are means to the outcome, not the outcome itself. The plan's revision 2 states that its completion "must never be reported as ten delivered paintings", so a pass here would misstate what a user can do. `pending` does not apply either. No dated event or queued generation job exists (`plan.md` § Deferred product gap: "no durable generation job … no dated readiness event"). The gap is a missing input, not a clock.

## Identities

- **Deployed:** otohime.dev `meta[name=build-sha]` = `ef8035cc950f54a58f3bd714f49415f3c79e2dbc`, read in the browser at both viewports and via curl. GitHub Actions run 40238014283 (ef8035c): conclusion success. `GET /api/health` 200.
- **Touched components** (the single Next.js app on Vercel plus its offline scripts):
  - t-1471 `702c5dd82d5c66c6d1f8acb5df2a8c4826df7b9a`, which is an ancestor of the deployed sha.
  - t-1510 `ef8035cc950f54a58f3bd714f49415f3c79e2dbc`, which is the deployed sha.
  - Later main commits `25d0294` (pm-240 QA evidence only, CI 40239428669 cancelled by concurrency) and `0444d51` (CI 40239691884 in progress when read) change no portrait code or content.
- **Commit identity:** all 16 `pm-240/` commits are authored and committed by `Otohime <quiinthieu@gmail.com>`, with 0 `Co-Authored-By` trailers (`git log --grep '^pm-240/'`). No SWE `author.txt` artifact was supplied to this run, so the check rests on Git alone.
- **This run:** acceptance_engineer run-8466, profile `claude-opus-high` (`claude-opus-5-5`, effort high), account `claude-kqviet`, worker `avietidol-mac-mini`, task-manager `444ba7bc-44db-4020-91aa-dbe2ec6b79f9`.

## Real/fake boundaries, logs and history

- **Real:** the deployed site, headless Chromium (Playwright 1.64.0), the CLI as a subprocess, locked sharp 0.35.5, and adapter construction. **Fake:** none in my probes; only the SWE unit tests stub `fetch`. No vendor request was made, because no credential exists.
- **Integration deployed:** yes (tooling and kit). **Execution demonstrated:** offline only. **Waiting for capacity:** no; nothing is queued. **Product delivered:** no.
- **Logs:**
  - Browser console and page errors: 0 at both viewports.
  - `task_manager_cluster_logs container=otohime` (60 min, limit 50) returned `null`.
  - No Vercel log access was available.
  - Server logs are therefore **unread, not clean**. The verdict does not depend on them.
- **task-manager history:** project `plan-manager`, FAILED page offset 0 limit 20, **20 of 58** read. That page holds no pm-240-owned job; the pm-240 string matches are multi-plan `harvest semantic check` generation jobs. Run-8430 had read 54/54 FAILED with no pm-240 match, and the 4 newer records are within my page, so FAILED coverage is complete across both reads. I did not page COMPLETED again: no portrait job has ever existed to complete (the t-1472 Grok probe `267d873e` failed with `Not signed in`, per the ledger and run-8430's raw log read).
- **Negative control:** the `EXPECT_PEOPLE=10` walk and `--require-people` both fail on the empty manifest, while the `EXPECT_PEOPLE=0` walk passes. So the delivery gates can tell "no portraits" apart from "portraits present". The kit check rejects my own coordinated-tamper copy.

## Deferred / owner

| Gap | Owner | Ready / failure condition |
|---|---|---|
| Ten real paintings plus ten derivatives at durable public URLs | Operator/producer (credential or masters), then the plan-manager product owner (delivery amendment) | Ready when a usable xAI credential is reachable from an otohime lease (grok-main re-signed **and** re-bound to `otohime`, or an API key on the lease), or ten named native masters are supplied. Fails while `content/portraits.json` is `[]`, `sketches:check -- --live --require-people` exits non-zero, or `BASE_URL=https://otohime.dev EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh` fails |
| Server log read | Deployment operator | Requires a bounded Vercel log read; not inferred |

No application source, workload, account or binding was changed by this run. Screenshots stay out of git; only their hashes are committed.
