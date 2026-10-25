---
plan_id: pm-240
task_id: t-1510
run_id: run-8460
kind: qa_report
verdict: pass
delivery_sha: ef8035cc950f54a58f3bd714f49415f3c79e2dbc
deployed_sha: ef8035cc950f54a58f3bd714f49415f3c79e2dbc
green_gate: ver-3372
---

# Independent QA: portable portrait production kit (third delivery)

**Pass, for the production-kit scope only.** All eight contract checks pass at the delivery sha. Every independent export-confinement and check-rejection control behaves correctly on case-insensitive APFS, including regressions for QA-8430-01, QA-8446-01 and QA-8446-02. The deployed site serves the delivery commit. This pass covers the text kit and its offline tooling. It is not artwork delivery.

**Paintings delivered: 0/10. Gallery portraits activated: 0/10.** This task delivers a text-only production kit. No painting was generated, imported, published, reviewed or activated in this run.

## Identities

- Delivery: `ef8035cc950f54a58f3bd714f49415f3c79e2dbc` on `main` (`pm-240/t-1510: fix case-variant and hard-link export escapes`). `git show` shows author and committer **Otohime <quiinthieu@gmail.com>**, the right subject prefix, and no `Co-Authored-By` trailer. I did not download the SWE `author.txt` artifact. The identity comes from Git.
- Board green gate: **ver-3372** (verifier run-8456), status pass at `ef8035c`, created 2026-10-25T22:02:43Z.
- Deployment: At first `https://otohime.dev/sketches` `meta[name=build-sha]` showed `84dc823`, then `eddc84c`, because GitHub Actions run **40238014283** for ef8035c was queued behind the eddc84c deploy. That run then completed: `checks` job **121305383055** success (22:12:55Z) and `production` job **121306958586** success (22:14:19Z). At 22:15Z the deployed build-sha was **`ef8035cc950f54a58f3bd714f49415f3c79e2dbc`**, and `git merge-base --is-ancestor ef8035c… ef8035c…` exited 0. `GET /api/health` returned 200. The deployed walk `BASE_URL=https://otohime.dev EXPECT_PEOPLE=0 EXPECT_SHA=ef8035c… bash scripts/walk-sketches.sh` gave **walk 16/16, probe 103/103, exit 0**: twelve studies, no People section, and the 404/400 download controls working.
- QA run **run-8460** on a macOS Darwin 27.0.0 arm64 lease. The filesystem is APFS and case-insensitive (`CONTENT` resolves). Node v22.23.3, fresh `npm ci`, sharp 0.35.5. The agent is Claude Opus 5.5 (`claude-opus-5-5`). The run profile name was not supplied in this run's prompt, so it is not asserted here.
- SWE run-8450: profile `agy-argon-high`, Gemini 4 Argon (High), high effort, as recorded in SWE report rep-4899.

## Contract verification (rerun in this checkout at ef8035c)

| Command | Result |
|---|---|
| `npm ci --no-audit --no-fund` | exit 0 |
| `npm test` | exit 0. **1639 pass, 0 fail** |
| `npm run portraits:handoff:check` | exit 0. production_required, 10 prompt files, 0 delivered and 0 activated |
| `node --experimental-strip-types scripts/sketches-paint.ts preflight --offline` | exit 0. Real sharp 0.35.5 processor runs and the real adapter is constructed. credentialAvailable=false, 10 concepts, 12 base sketches, 0 manifest records |
| `npm run sketches:check` | exit 0. `12 base sketches, 0 portraits, 0 errors (offline)` |
| Artwork-gap assertion (original contract one-liner) | exit 0. `Artwork delivery still fails explicitly: 0 of 10` |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0. 0 errors, 9 warnings that already existed |
| `BETTER_AUTH_SECRET=… npm run build` | exit 0. 182/182 static pages |
| Local gallery walk `SKIP_BUILD=1 EXPECT_PEOPLE=0 bash scripts/walk-sketches.sh` | exit 0. walk 17/17, probe 103/103. Includes the 404 and 400 download negative controls |

The preflight smoke image (768x1024, which gives a 1152x1536/23508-byte derivative) is synthetic test data, not artwork.

## Independent negative controls (my own probe, not the SWE tests)

`qa_run-8460/probe.mjs` runs the **real CLI** as a subprocess (`node --experimental-strip-types scripts/sketches-handoff.ts`). Its working directory is a disposable replica root with `content/ public/ app/ lib/ scripts/ .git/`, plus an existing `content/existing/` and `content/portraits.json`. Raw results are in `qa_evidence_run-8460.json`. Before and after the escape attempts, the probe took a SHA-256 snapshot of every file under the protected trees. **The snapshots are identical.**

| Starting state | Action | Observable result |
|---|---|---|
| Case-insensitive APFS replica | `export --output-dir` with each of `Content/new-kit`, `CONTENT/x`, `cOnTeNt/existing`, `Content/existing/deeper`, `PUBLIC/x`, `App/x`, `LIB/x`, `Scripts/x`, `ſcripts/x` (U+017F, Unicode case-folds to `scripts`), `.GIT/x`, `.Git`, `Content`, `./lib/../Content/./y/`, `content/existing/`, `projects/../CONTENT/z` | All 15 exit 1, `invalid_path`. Zero protected writes |
| `exports/kit/manifest.json` hard-linked to `content/portraits.json` | export to `exports/kit` | exit 1, `invalid_path`. portraits.json is still `[]\n` |
| `exports/kit/06_Violinist.md` hard-linked to `content/portraits.json` (a different file from SWE's test) | export | exit 1, `invalid_path`. Nothing else written. portraits.json is unchanged |
| `alias -> content`, `alias/new-kit` absent (QA-8430-01 regression) | export | exit 1, `invalid_path` |
| Empty `out/a`, `out/b` | export twice | Both exit 0. Each contains exactly the 11 committed files, byte-identical |
| Existing `out/a` kit | re-export (temp+rename path) | exit 0. Still byte-identical. No `.handoff-tmp-*` files left behind |
| Copy of committed kit | check | exit 0 |
| Reader prompt edited, with manifest `promptFileByteLength`/`promptFileSha256` recomputed | check | exit 1, `prompt_mismatch`, `01-quiet-reader` |
| `03_Rainy_Afternoon.md` removed | check | exit 1, `missing_file`, `03-rainy-afternoon` |
| Extra `11_Extra.md` | check | exit 1, `extra_file` |
| Manifest status set to `completed` | check | exit 1, `invalid_status` |
| Concept 2 promptFile duplicated from concept 1 | check | exit 1, `duplicate_mapping`, `02-flower-girl` |
| `08_Painter.md` replaced by a symlink | check | exit 1, `invalid_path` |
| `check --bogus` | CLI | exit 2, `invalid_cli` |
| Committed kit | check, comparing nanosecond mtime and SHA-256 of every file before and after | exit 0. **No file rewritten** |
| `content/portraits.json` is `[]` | original `sketches:check -- --require-people` | exit 1, `manifest contains 0 records` |

Both earlier defects are fixed in this delivery. **QA-8446-01** (case-variant escape) and **QA-8446-02** (hard-link overwrite) no longer reproduce, and neither does the earlier **QA-8430-01** (ancestor symlink). On case-insensitive APFS, the dev/ino ancestor comparison also covers non-ASCII case folding (`ſcripts`), which a `toLowerCase()` check alone would miss.

## Kit content inspection (separate Python, not the handoff parser)

`qa_run-8460/inspect.py` (output in `qa_run-8460/inspect-out.json`) uses only regular expressions and hashlib against `prompts.md`. Its result is **0 errors**:

- 10 Markdown files plus `manifest.json`, in exact order: `01_Quiet_Reader.md` … `10_Letter_Writer.md`. Each PNG/JPEG pair, title and caption matches the prompts.md mapping table.
- Each file has the full shared-style paragraph and the full concept composition inside its single ```text``` copyable block. Each also states 3:4, `>=1536x2048`, and the honest-lower-size/no-upscale note.
- For all ten files, the manifest's `promptFileByteLength` and `promptFileSha256` equal the actual UTF-8 bytes, and `fullPromptSha256` equals the SHA-256 of the copyable block.
- `schemaVersion=1`, `status=production_required`. `promptPackSha256` equals the prompts.md bytes. `referenceUrlSha256` is the SHA-256 of the URL string, and the manifest labels it that way.
- `generationSettings.status=unverified_guidance` and `executed=false`. There are 10 checklist items. The derivative is 1152x1536 JPEG with maxBytes 600000. `deliveryStatus` is 0/10 delivered and 0 activated. There are no candidate ids, image hashes, public URLs or acceptance claims.
- The Reader stays seated in a three-quarter view from the front. The other nine poses, palettes and focal points are copied verbatim from prompts.md. These are creative directions only. No art exists to review.

## Scope and regression

The t-1510 commits touch only `lib/sketches-handoff{,.test}.ts`, `scripts/sketches-handoff.ts`, `package.json`, and plan-folder text and evidence. `content/portraits.json` and `public/sketches` have no diff since the plan baseline `bc9137c`. No file under `app/`, `content/` or `components/` imports `sketches-handoff`. I did not change any application source.

## Executable fingerprints (SHA-256, bytes), checked out at ef8035c

| File | SHA-256 | Bytes |
|---|---|---|
| package-lock.json | `e7aa5d85635862f956400a2d67338cd661d01d0dcab8cf959ea1d6d58be96877` | 352274 |
| package.json | `6b15ad3e9d828275cc6f1556faf3754397758b45ffd146212e3fbbe5ccc69923` | 4488 |
| lib/sketches.ts | `8c28d22034be719f76a16d93d8c642c41ae646ff5d1463858a08d85a3b02a43a` | 33954 |
| lib/sketches-handoff.ts | `0cfd42c757ed10e8f141ad2384ae99db5df4622492e9a4244c15c4aa85490d0f` | 30447 |
| scripts/sketches-handoff.ts | `c5c7369cd32b7f9a7ccee18fba09f2f3adfd81ab573e1646180811b62c791402` | 26831 |
| lib/sketches-handoff.test.ts | `99f551982a538b477536246840e248addb5f327eac33b1596bada62bc9beda0b` | 35271 |
| scripts/sketches-paint.ts | `5e745d2edc8a93b98d1bedadc4b3d0753c16a587785a30d99d57b06e41db8d16` | 5078 |
| lib/sketches-generation.ts | `71a94159e2f5a1ecc70a8fc78e3c3dac65ba4d9fa80cbd7d8e1122968050b216` | 44599 |
| prompts.md | `195f898d267d1d8f9ba8e1e2db6f607bc5b1f5325fce2fff51302591874f4a9f` | 8358 |
| production-kit/manifest.json | `3159f95680ecae21d1d12fbb795a47a3bb70113458b63d66f89900b92f026f95` | 9000 |
| content/portraits.json | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` | 3 |

These match the SWE fingerprints in rep-4899. The kit bytes are unchanged since the first delivery 1f7490b. Only the export guard changed.

## History and completeness

- I read the board history for t-1510: green gates ver-3357 (1f7490b), ver-3364 (c885936) and ver-3372 (ef8035c), all pass, plus prior reports rep-4871, rep-4884/4885, rep-4889, rep-4894/4895 and rep-4899, as supplied. Two earlier QA fails were cause=code. Their defects (QA-8430-01, QA-8446-01, QA-8446-02) are fixed, as verified above.
- GitHub Actions on `main`: I read the first 8 runs, so this list is **not** a complete history. 791f08d success, c885936 success, e3edc10/52ad2bd/41a4f3e cancelled (superseded by concurrency), 84dc823 success, eddc84c production deploy in progress at 22:06Z, ef8035c run 40238014283 (see Deployment).
- I did not repeat the task-manager queue or vendor history scan. This kit has no queued job, no runtime and no vendor call. Run-8430 recorded vendor history as zero requests from the saved ledger; I did not audit it again.
- No Vercel server-log access was available in this run, so I make no claim that the server logs are clean.

## Boundaries and deferred checks

| Boundary | Status |
|---|---|
| Integration deployed | Yes. ef8035c is live on otohime.dev (CI run 40238014283: checks and production both success). The deployed gallery walk passes with EXPECT_PEOPLE=0 |
| Execution demonstrated | Yes, offline. Real CLI, real locked sharp, and adapter construction on macOS with no credential |
| Fake boundary | The SWE unit tests stub fetch and use an unusable key. My probes need no stubs because the CLI makes no network calls |
| Waiting for capacity | None. This text kit needs no runtime capacity |
| Product (10 paintings) | **Not delivered: 0/10, activated 0/10.** The artifacts and credential are owned by the operator/producer. The future delivery amendment is owned by the plan-manager product owner. Advisory chores esc-371 and esc-372 are existing items and were not re-raised. Failure condition: any missing, temporary, unreachable, wrong-hash or wrong-dimension master or derivative, a rejected full-size review, or a failure of `sketches:check -- --live --require-people` or `EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh` |
