# QA report: pm-180 / t-1045 (run-6184)

Verdict: **fail, cause=environment**. The delivery is correct; production does not serve it.

Delivery sha: c3cc730840d5d9bfd9e47abb2d7a523734f75942 (origin/main HEAD, pushed 2026-10-19 ~03:54Z).
Green gate for c3cc730: pass (install/lint/typecheck, npm test, pages test, local build+walk, author gate).

## Checked on Node v22.12.0, darwin lease, clean tree at c3cc730

| Check | Result |
| --- | --- |
| npm ci, lint, typecheck | pass |
| npm test | pass, 17/17 (strip-types flags work on 22.12) |
| author | `Otohime <quiinthieu@gmail.com>`, Co-Authored-By count 0 (matches plan.commit_identity) |
| npm run build with GITHUB_SHA=c3cc730... | pass; `/projects` in app-path-routes-manifest |
| next start :4017, signed out, `/projects` | 200; "Nothing on the bench yet" x2; `aria-label="Main"` sidebar; Fig. 06 present |
| `/` | 200; PROJECTS; `y="-146"` |
| `<meta name="build-sha">` | content = c3cc730... on `/projects`, `/` and the not-found page |

The contract's one-shot bash -c script printed `curl: (7)` and still exits 0 on darwin, so each step was run separately (above).

## Production (https://otohime.dev)

- `GET /projects` -> 404 (`x-matched-path: /404`, `x-vercel-cache: HIT`, last-modified Sun 18 Oct 18:34Z). `/` has no `build-sha` meta and no `-146` line.
- ~8 minutes after the push (plan: ~4 minutes push-to-live) the site still serves the old build. No deployed commit exists to compare, so `git merge-base --is-ancestor c3cc730 <deployed>` cannot be satisfied.
- Author hypothesis: the delivery commit is correctly authored with the owner's email, and production still did not move. Caveat: earlier deployed commits (6456dd7 and before) are authored `Ōtohime` (macron) with the same email; c3cc730 is `Otohime`. Vercel checks the email, so I do not think the name matters, but it is the one visible difference.
- `.github/workflows/ci.yml` last changed 2026-10-18 19:09 (07eed29), before the last deployed commit 6456dd7 (23:27). CI config did not change between the last green deploy and now, so the cause is outside the repo: GitHub Actions run/minutes/concurrency, `VERCEL_TOKEN`, or `DATABASE_URL_UNPOOLED`. GitHub Actions is not readable from here (gh unauthenticated, repo private).
