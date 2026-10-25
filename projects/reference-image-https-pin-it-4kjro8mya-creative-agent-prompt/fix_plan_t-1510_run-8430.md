---
plan_id: pm-240
task_id: t-1510
run_id: run-8430
kind: fix_plan
cause: code
delivery_sha: 1f7490b36849aa2bdbcf8d12c61133a5429a814b
defect_id: QA-8430-01
---

# Fix ancestor-symlink export confinement

**Cause=code; owner=t-1510 software engineer.** A nonexistent output child below a symlink bypasses the protected-tree check. The real CLI returns exit 0 and writes eleven files through `alias -> content` into `content/new-kit`, violating the explicit output-boundary contract. No environment or board-side change can repair this implementation defect. Existing tests and deployed CI pass; that does not waive the failed independent negative control.

1. Add a failing regression in **lib/sketches-handoff.test.ts:341**, alongside path/security coverage. In an isolated root, create protected `content/`, a symlink alias to it, and request nonexistent `alias/new-kit` (also test multiple missing suffix segments). Assert `ok:false`, stable `invalid_path`, CLI exit 1, useful offendingPath, and no created child/files. Keep a normal nonexistent nested output-directory positive control. Use only disposable fixtures. Exercise real CLI behavior as well as the exported interface.
2. Change **scripts/sketches-handoff.ts:94–115**, especially **line 99**. Resolve the nearest existing ancestor before appending nonexistent path components; compare that physical destination with canonical protected roots. Reject traversal/symlink escape before any filesystem mutation. Do not assume `resolve()` canonicalizes ancestors or use a fallback that silently permits an unresolved unsafe target. Preserve supported symlinked lease/system roots by comparing canonical roots and destinations consistently.
3. Enforce the boundary before **scripts/sketches-handoff.ts:204** (`mkdirSync`) and verify the resulting physical directory before **line 238** writes. Final-component lstat at **line 177** alone is insufficient. Keep prompt-file symlink rejection, read-only check semantics and production content protection. Add ancestor-link check coverage for input/source paths if tightening those related guards; do not broaden permissions or touch production images.
4. Run the report's reproducer: it must now print `ok:false`, produce zero protected files and exit successfully on its rejection assertion. Re-run the independent coordinated prompt/hash tamper and missing-file controls. Run all eight original contract commands: `npm test`, `npm run portraits:handoff:check`, offline paint preflight, `npm run sketches:check`, the zero-artwork negative-control assertion, typecheck, lint and production build. Keep the ten text artifacts deterministic and content/portraits.json `[]`.
5. Commit as **Otohime <quiinthieu@gmail.com>**, no Co-Authored-By trailer, subject starting **pm-240/t-1510:**. Push with **git push origin HEAD**. The existing GitHub workflow runs checks and then production automatically for a main push; no runner repair, API-created pipeline or manual deploy is needed. On non-fast-forward, pull --rebase, rerun required checks and push without force. The new delivery needs its own green gate and independent QA. Leave t-1471, the twelve base assets, gallery and all artwork-delivery assertions unchanged.

Evidence: [QA report and safe reproduction](qa_report_t-1510_run-8430.md), [machine-readable independent cases](qa_evidence_run-8430.json). The requested fix is application work for the SWE role; this QA run changes only plan evidence files. Paintings remain **0/10 delivered, 0/10 activated** and are outside this fix.
