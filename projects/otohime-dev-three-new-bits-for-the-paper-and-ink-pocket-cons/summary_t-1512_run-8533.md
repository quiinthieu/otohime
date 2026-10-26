# t-1512 Torn sheet 404 — summary (run-8533)

Role: software_engineer. Model: claude-opus-5-5. Plan pm-248, sequence 2,
fix cycle 1 (prompt source: green gate ver-3391).

## Diagnosis

Green gate ver-3391 (c06a430) and red gate ver-3390 (8b54cc4) both failed only
"lint changed files", with exit 2 in 1–4 ms:
`bash: -c: syntax error near unexpected token '('`. The board contract still
holds the unquoted `npx eslint app/(site)/not-found.tsx ...`. bash rejects that
line at parse time, so eslint never starts and no code change can turn it
green. The decider on esc-376 ruled it a contract defect: fix the check, not
the code. The repo copy in `tasks.json` has been quoted since 22b32d9.

## Delivered

- No application code changed. The 404 sources (`app/(site)/not-found.tsx`,
  `app/global-not-found.tsx`, `components/lost-sheet.tsx`, `lib/lost.ts`,
  `scripts/probe-lost.*`) are byte-identical to c06a430.
- `app/(site)/globals.css` has changed since c06a430 because of the season tasks
  (t-1517, t-1519), so the probe was rerun on the current tree below.
- This summary is the only file in the commit.

## Verification (this pod, tree at 7ba5061, fresh npm ci, clean .next)

Each item was run through `bash -c`, as the gate runs it.

| item | cmd | exit |
| --- | --- | --- |
| typecheck | `npm run typecheck` | 0 |
| lint changed files (quoted) | `npx eslint 'app/(site)/not-found.tsx' app/global-not-found.tsx components/lost-sheet.tsx` | 0 |
| negative control: lint as the board holds it | `npx eslint app/(site)/not-found.tsx ...` | 2 (parse error) |
| production build | `npm run build` (Next 16.4.2, Turbopack, 183/183 pages) | 0 |
| lost probe | `bash scripts/probe-lost.sh` (Playwright 1.64.0 Chromium) | 0, 34 ok / 0 failed |
| unit tests | `npm test` | 0, 1723 pass / 0 fail |

The probe covers: raw GET 404 with the server-drawn sheet, the crumple
filter, the hop opt-in and plain anchors; no-JS crumpled sheet with all five
links navigating; JS rub to progress 1 (8 strokes), with the hover-only
negative control and the flutter positive control; Tab reaching all five links;
keyboard "Smooth it out" stepping 0.2 to 1; reduced motion with no island, a
flat sheet, `animation: none` and nothing running; 390x844 without overflow.

## Needed outside this task

- Board: change t-1512's verification[] "lint changed files" cmd to the
  quoted form above (esc-376). Until that happens, the gate or QA should take
  the quoted run as that item's evidence, as the decider allowed.
- Boundaries: local build and `next start` only. CI and the deployed site
  were not observed (per the contract).
