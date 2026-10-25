---
plan_id: pm-240
task_id: t-1510
run_id: run-8446
kind: qa_report
verdict: fail
cause: code
delivery_sha: c885936355a74539ec786b30b86f21dc5a09afc5
deployed_sha: 791f08d36a0f836b1104289b7d114a74e6cbfe91
green_gate: ver-3364
---

# Independent QA (re-check after QA-8430-01 fix): portable portrait production kit

**Fail, cause=code.** The QA-8430-01 case (a symlinked parent with a missing child) is now fixed. Two new export-confinement bypasses remain, and both write into protected `content/`:

- **QA-8446-01:** a case-variant path such as `Content/new-kit` or `PUBLIC/x` on a case-insensitive filesystem (default macOS APFS).
- **QA-8446-02:** a hard link already sitting in the output directory, which makes export overwrite `content/portraits.json`.

The contract says: "Export may write only its explicitly resolved output directory, never production portrait content." See [fix plan](fix_plan_t-1510_run-8446.md).

**Paintings delivered: 0/10; gallery portraits activated: 0/10.** This task delivers a text kit only.

## Identities

- Delivery `c885936355a74539ec786b30b86f21dc5a09afc5` on `main`. Author and committer are both `Otohime <quiinthieu@gmail.com>`, the subject has the `pm-240/t-1510:` prefix, and there is no Co-Authored-By trailer (checked with `git log -1 --format`). The delivery diff touches only `scripts/sketches-handoff.ts` and `lib/sketches-handoff.test.ts`. Compared with the previously QA'd 1f7490b, these are byte-identical: production-kit, prompts.md, handoff.md, `content/`, `public/`, `lib/sketches.ts` and `lib/sketches-handoff.ts`. The package.json/lock delta since then comes from pm-247/t-1507 (18ef637), not from t-1510.
- Board green gate **ver-3364** (verifier run-8443) at `c885936`: 8/8 items pass. Fetched independently with `plan_manager_get_verification`.
- Deployed build: `https://otohime.dev/sketches` `meta[name=build-sha]` = `791f08d36a0f836b1104289b7d114a74e6cbfe91`. `git merge-base --is-ancestor c885936 791f08d` exits **1**, so the delivery is **not deployed yet**. GitHub Actions run [40236130954](https://github.com/quiinthieu/otohime/actions/runs/40236130954) for the delivery sha: `checks` job 121299726226 still **in_progress** at 21:45Z; preview and cleanup skipped. I did not wait for it, because the verdict rests on a deterministic code defect that a deploy cannot change. `GET /api/health` returned 200.
- QA run run-8446 used Claude Opus 5.5 (`claude-opus-5-5`) on a macOS lease (Darwin 27.2.0, APFS, case-insensitive), Node v22.12.0, fresh `npm ci` (exit 0), real sharp 0.35.5. SWE run-8435 used profile agy-argon-high (Gemini 4 Argon High) on macOS, per rep-4889.

## Contract checks rerun in this checkout (all exit 0)

| Command | Result |
|---|---|
| `npm test` | 1615 pass, 0 fail |
| `npm run portraits:handoff:check` | ok, production_required, 10 prompt files, 0 delivered/activated |
| `scripts/sketches-paint.ts preflight --offline` | sharp 0.35.5, adapterConstructed=true, credentialAvailable=false, manifestRecordsCount=0 |
| `npm run sketches:check` | 12 base sketches, 0 portraits, 0 errors |
| Artwork-gap assertion | portraits.json `[]`; `--require-people` exits 1 with "manifest contains 0 records" |
| `npm run typecheck` | ok |
| `npm run lint` | 0 errors, 9 pre-existing warnings |
| production build | 182/182 static pages |

## Independent probes (my own scripts outside the repo; temp roots and a disposable worktree)

| Starting state | Action | Observable result |
|---|---|---|
| Temp root, `alias -> content` | export `alias/new-kit` (QA-8430-01 reproducer) | ok=false, `invalid_path`, content untouched — **fixed** |
| Temp-level `lnk -> root/content` | export `lnk/a/b` | `invalid_path` |
| `exports/../content/x`; final-component symlink; `content`, `public/x`, `lib/y`, `.git/z`, `node_modules/q`, plan folder | export each | all `invalid_path`, no writes |
| Fresh nested dir and a second temp dir | export twice, compare with committed kit | 11 files each, byte-identical to committed kit; check ok |
| Committed kit | check, comparing mtime_ns and SHA-256 before and after | unchanged (read-only) |
| Copy with Reader prompt edited and manifest byteLength/sha recomputed | check | exit 1 `prompt_mismatch` `01-quiet-reader` |
| Copy with `03_Rainy_Afternoon.md` removed | check | exit 1 `missing_file` `03-rainy-afternoon` |
| Lowercase control: worktree of c885936 | real CLI `export --output-dir content/new-kit` | exit 1 `invalid_path` |
| **Same worktree** | real CLI `export --output-dir Content/new-kit` | **exit 0, ok=true; 11 files written to `content/new-kit` (git shows them untracked under `content/`)** |
| **Same worktree** | real CLI `export --output-dir PUBLIC/qa-x` | **exit 0; `public/qa-x` created** |
| **Same worktree, `ln content/portraits.json exports/kit/manifest.json`** | real CLI `export --output-dir exports/kit` | **exit 0; `content/portraits.json` overwritten 3 → 9000 bytes (git: ` M content/portraits.json`)** |

After the probes the worktree was cleaned and removed (`git worktree list` shows only the main checkout). Production paths in the real checkout were never written; `git status` is clean.

## Defects

**QA-8446-01 (owner: t-1510 SWE).** `resolvePhysicalTargetPath` canonicalizes with the JS `realpathSync` (`scripts/sketches-handoff.ts:156`, and again after mkdir at `:424`). That function returns whatever case the caller typed. `isForbiddenExportTarget` (`:253`–`:281`) then compares strings case-sensitively, so `Content` does not match the protected `content`. `fs.realpathSync.native` returns the on-disk case (checked here: `Content` → `content`). Trigger: any case-insensitive volume, including the macOS leases used by both SWE run-8435 and this QA run. Linux ext4 is not affected.

**QA-8446-02 (owner: t-1510 SWE).** Before writing, the code only rejects a target file that is a symlink or not a regular file (`:464`). `writeFileSync` at `:478` then truncates and rewrites a hard-linked regular file in place, which changes the inode it shares with the protected file. Trigger: a pre-existing hard link in the chosen output directory.

## Boundaries and deferred checks

| Boundary | Status |
|---|---|
| Integration deployed | **No.** Deployed 791f08d does not contain c885936; CI run 40236130954 is in progress. Owner: GitHub/Vercel pipeline, which runs automatically on main push. Not a reason for this fail. |
| Execution demonstrated | Real offline CLI and locked sharp/adapter construction both work; the two confinement defects reproduce. |
| Fake boundary | Network stubs and unusable key exist only in the SWE unit tests. My probes call the real CLI and the real exported interface, with no network. |
| Waiting for capacity | None. |
| Product (10 paintings) | **Not delivered, 0/10; activated 0/10.** esc-371/esc-372 are advisory provenance only and were not re-raised. Artifact owner: operator/producer. Next delivery amendment: plan-manager product owner. |
| Server logs | Not read in this run, so they are unproven. A prior run showed the cluster log tool returns null for otohime. |
| History | I read the board green gates ver-3364 and ver-3357 (complete for t-1510) and the prior reports rep-4884/4885/4889. I did not re-page task-manager FAILED/COMPLETED history, so this run makes no new history claim; run-8430 recorded its page bounds in qa_history_run-8430.json. |

Application source was not changed by this QA run.
