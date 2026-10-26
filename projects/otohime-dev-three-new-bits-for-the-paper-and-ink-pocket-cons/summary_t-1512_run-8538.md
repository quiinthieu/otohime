# t-1512 Torn sheet 404 — summary (run-8538)

Role: software_engineer. Model: claude-opus-5-5. Plan pm-248, fix cycle
prompted by green gate ver-3409 (8cfcc84).

## Diagnosis

ver-3409 failed the same way as ver-3390 and ver-3391. Only "lint changed
files" failed, with exit 2 in 1 ms: `bash: -c: syntax error near unexpected
token '('`. `plan_manager_get_verification` shows the board cmd is still
unquoted (`npx eslint app/(site)/not-found.tsx ...`). The decider ruled on
esc-376 that the check must be fixed, not the code: quote the path and
re-run the gate without another SWE cycle. That edit was never applied to the
board contract. This is the third SWE cycle spent on a cmd that bash cannot
parse.

## Delivered

- No application code changed. `git diff c06a430 origin/main` over
  `app/(site)/not-found.tsx`, `app/global-not-found.tsx`,
  `components/lost-sheet.tsx`, `lib/lost.ts` and `scripts/probe-lost.*` is
  empty.
- This summary is the only file in the commit.

## Verification (this pod, tree at c23b4f9, fresh npm ci, clean .next)

Each item was run through `bash -c`, as the gate runs it.

| item | cmd | exit |
| --- | --- | --- |
| typecheck | `npm run typecheck` | 0 |
| lint changed files (quoted) | `npx eslint 'app/(site)/not-found.tsx' app/global-not-found.tsx components/lost-sheet.tsx` | 0 (eslint JSON: 3 files, 0 errors, 0 warnings) |
| negative control: lint as the board holds it | `npx eslint app/(site)/not-found.tsx ...` | 2 (parse error, eslint never runs) |
| production build | `npm run build` (Next 16.4.2, Turbopack, 183/183 pages) | 0 |
| lost probe | `bash scripts/probe-lost.sh` | 0, 34 ok / 0 failed |
| unit tests | `npm test` | 0, 1723 pass / 0 fail |

## Needed outside this task

- Board: replace t-1512's verification[] "lint changed files" cmd with the
  quoted form above, as esc-376 already decided, then re-run the green gate.
  This was raised again as an operator action, because the first answer was
  never applied. Sending t-1512 back to a software engineer cannot fix it.
- Boundaries: local build and `next start` only. CI and the deployed site
  were not observed (per the contract).
