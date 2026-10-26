# t-1512 Torn sheet 404: summary (run-8550)

Role: software_engineer. Model: claude-opus-5-5. Plan pm-248. This SWE
dispatch followed green gate ver-3409 (8cfcc84) and the esc-379 ruling.

## Diagnosis

`plan_manager_get_verification` still holds the unquoted board cmd
`npx eslint app/(site)/not-found.tsx ...`. Run through `bash -c`, it fails
at parse time on any sha, so no repo change can turn it green. On esc-379 the
decider ruled it a contract defect. The fix is to replace t-1512 with a
verification-only task and change no application code. This run follows that
ruling.

## Delivered

- No application code changed. Over `app/(site)/not-found.tsx`,
  `app/global-not-found.tsx`, `components/lost-sheet.tsx`, `lib/lost.ts` and
  `scripts/probe-lost.*`, `git diff c06a430 origin/main` is empty.
- The commit holds only this record. The job requires a push.

## Verification (this pod, tree 3c8b05e, fresh npm ci, clean .next)

Each item was run through `bash -c`, as the gate runs it.

| item | cmd | exit |
| --- | --- | --- |
| typecheck | `npm run typecheck` | 0 |
| lint changed files (quoted) | `npx eslint 'app/(site)/not-found.tsx' app/global-not-found.tsx components/lost-sheet.tsx` | 0 (eslint JSON: 3 files, 0 errors, 0 warnings) |
| negative control: lint as the board holds it | `npx eslint app/(site)/not-found.tsx ...` | 2 (parse error, eslint never runs) |
| production build | `npm run build` | 0 |
| lost probe | `bash scripts/probe-lost.sh` | 0, 34 ok / 0 failed |
| unit tests | `npm test` | 0, 1723 pass / 0 fail |

## Needed outside this task (product_owner, per esc-379)

Propose the replacement task "Torn sheet 404 (gate fix)" in place of t-1512:

- same acceptance criteria and footprint
- depends_on t-1511
- verification[] identical, except that "lint changed files" uses the cmd
  `npx eslint 'app/(site)/not-found.tsx' app/global-not-found.tsx components/lost-sheet.tsx`
  (cwd ".", expect exit0, timeout 600)

Tasks that depend on t-1512 should then depend on the replacement. Its QA
uses the unquoted form, which exits 2, as the negative control. The lint item
is not waived.

Boundaries: only the local build and `next start` were exercised. CI and the
deployed site were not observed, per the contract.
