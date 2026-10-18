# QA report: t-1018 Add a public Projects page (run-6006)

Verdict: **fail**, cause = **environment**. The delivered change is correct.
Production has not deployed it, and CI on main cannot be read from this pod.

- Delivery sha: `e097b14594c88b9a38c11f8e3c887575edff5423` (HEAD of `origin/main`)
- Green gate: ver-2267, pass, sha e097b14
- Deployed sha: `6456dd7`. The Music page is live, `/projects` returns 404,
  and the console's first baseline is still -142.
  `git merge-base --is-ancestor e097b14 6456dd7` is false.

## Contract verification (re-run locally on e097b14)

| Gate | Result |
| --- | --- |
| `npm ci && npm run lint && npm run typecheck` | exit 0 |
| `node --test lib/pages.test.ts` | 4/4 pass |
| `npm test` | 17/17 pass |
| build with the CI placeholder env, then grep `"/projects"` in the manifest | exit 0, `/projects` is ◐ |

## CI checks job mirrored locally (embedded Postgres 18 on :5432)

| Step | Result |
| --- | --- |
| `drizzle-kit check`, `db:generate`, `git status db/migrations` | no changes |
| `npm run build` | ok |
| `npm run db:migrate` | applied |
| `npm start`, then `/api/health` | `{"ok":true}` |
| `npm run test:e2e` | 9/9 pass, including "the projects page sits in the sidebar and shows its empty state" |

## Acceptance walk (local `next start` build of e097b14)

| Starting state | Action | Observable result |
| --- | --- | --- |
| Signed out | GET /projects | 200; `aria-label="Main"`; `<h1>Fig. 06 — Projects</h1>`; "Nothing on the bench yet" notice |
| Signed out | The sidebar on /projects | 01 Home, 02 Work, 03 Play, 04 Notes, 05 Music, 06 Projects |
| Signed out | The console on / | LCD rect y=-158 h=56 (bottom -102); WORK -146, PLAY -136, NOTES -126, MUSIC -116, PROJECTS -106, all inside [-150, -105] |
| Signed out | A on PROJECTS | `router.push(MENU[cursor].href)` with MENU = CONSOLE_MENU; the cursor wraps on `MENU.length` (5); the fallback list links `/projects` |
| Signed in (local user, promoted to owner) | /dashboard, /account, /admin/users, /admin/users/[id], /admin/roles | Fig. 07, 08, 09, 09, 10 |
| Repo | Add one entry to `site.projectList` (temporary, reverted, not committed) | typecheck ok; row with a swatch dot (#f4b829), a linked title, a `building` badge and the note; empty state gone |
| Repo | README | the `lib/pages.ts` line names `site.projectList` in content/site.ts |

Note: "PROJECTS" in 8.5px monospace with 0.1em tracking ends at about x≈86.8,
against the LCD's right edge at 88. It fits, but a longer label would not.

## Why environment

- Production (`otohime.dev`) still serves 6456dd7. At 17:39Z, `/work` had an
  edge cache `age` of 4069s, so that build went live about 16:31Z, about 4
  minutes after the 6456dd7 commit (16:27Z). That is the length of a normal
  checks → production run.
- Three pushes to main followed: d5a6575 (17:10Z, docs only), 6b9f21a
  (17:11Z, docs only) and e097b14 (17:20Z). None of them has deployed, even
  29, 28 and 19 minutes later. The two docs-only commits cannot break lint,
  typecheck, the build or e2e.
- `git log 6456dd7..e097b14 -- .github/ package.json package-lock.json` is
  empty. Neither the pipeline config nor the dependencies changed between the
  last green deploy and now.
- Every step of the `checks` job passes locally on e097b14, so the code would
  not stop `production` (`needs: checks`).
- The run list could not be read. `quiinthieu/otohime` is private, this pod
  has no `gh` CLI or GitHub token, and the Actions API returns 404.

See [fix_plan.md](fix_plan.md).
