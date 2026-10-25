---
plan_id: pm-240
task_id: t-1510
run_id: run-8446
kind: fix_plan
cause: code
delivery_sha: c885936355a74539ec786b30b86f21dc5a09afc5
defect_ids: [QA-8446-01, QA-8446-02]
---

# Fix case-variant and hard-link export escapes

**Cause=code; owner: t-1510 software engineer.** No environment or board-side change can fix these. CI runs automatically on push to main; no runner work is needed.

1. **Tests first, in `lib/sketches-handoff.test.ts`**, next to the ancestor-symlink block in the test at line 343. All cases use an isolated temp root.
   - (a) Export to `Content/new-kit` and `PUBLIC/x` must return `invalid_path` and leave `content/` and `public/` unchanged. Gate this on detecting a case-insensitive filesystem (`existsSync(join(root, "CONTENT"))`) so it runs on macOS and is a no-op on Linux. Also run it through the real CLI (`spawnSync`).
   - (b) Create `exports/kit/manifest.json` as a hard link to `content/portraits.json`. Export to `exports/kit` must return `invalid_path`, and `content/portraits.json` must keep its exact bytes. Do the same with a prompt `.md` file hard-linked to an outside file.
   - Keep the existing positive controls: nested nonexistent output, and the symlinked lease root.
2. **QA-8446-01 in `scripts/sketches-handoff.ts:156`**: use `realpathSync.native` for `canonicalAncestor`. Use it at `:424` for `postMkdirRealpath` as well, and wherever the protected roots are canonicalized. In `isForbiddenExportTarget` (`:253`–`:281`), compare canonical (`.native`) paths for each root and protected tree, not only lexical joins. A more robust alternative is to compare `dev`/`ino` of each existing ancestor against the `dev`/`ino` of each protected tree.
3. **QA-8446-02 at `scripts/sketches-handoff.ts:464`**: reject an existing target whose `st.nlink > 1` with `invalid_path`. Optionally, write each file to a temp name in the verified directory and `renameSync` it into place, so an existing inode is never rewritten. Leave check read-only.
4. Rerun the eight contract commands: `npm test`, `portraits:handoff:check`, offline preflight, `sketches:check`, the zero-artwork assertion, typecheck, lint and build. Also rerun the reproducers from qa_report_t-1510_run-8446.md (real CLI `--output-dir Content/new-kit`, and the hard-link case) on a macOS/APFS lease; they must now exit 1 and write nothing. The committed kit bytes stay the same, and content/portraits.json stays `[]`.
5. Commit as Otohime <quiinthieu@gmail.com> with no trailer and subject prefix `pm-240/t-1510:`. Push with `git push origin HEAD`. On non-fast-forward, `pull --rebase`, rerun, push without force. Keep paintings at 0/10 delivered and 0/10 activated.
