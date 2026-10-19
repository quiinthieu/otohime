# QA report: pm-180 / t-1045 (run-6196)

Verdict: **pass**. Cited sha: 7f63d87d10c635414104bf0d42195f7a8b67f53e (delivery code c3cc730840d5d9bfd9e47abb2d7a523734f75942).

Green gate for 7f63d87: pass. Deployed commit: 7f63d87 (read from production, below). `git merge-base --is-ancestor c3cc730 7f63d87` and `git merge-base --is-ancestor e097b14 7f63d87` both hold.

## Production (checked first)

| Check | Result |
| --- | --- |
| `GET https://otohime.dev/projects` | 200; "Nothing on the bench yet" x2; `aria-label="Main"` |
| `GET https://otohime.dev/` | 200; `y="-146"` console lines |
| `<meta name="build-sha">` on `/` and `/projects` | `7f63d87d10c635414104bf0d42195f7a8b67f53e`, equal to origin/main HEAD |

The earlier environment fail (rep-3458, `/projects` 404) is resolved. Production now serves the owner-authored commits, which fits the plan's hypothesis that Vercel Hobby was skipping commits not authored by the site owner. It is inferred, not read from GitHub Actions.

## Local checks (Node v22.12.0, darwin lease, clean tree at 7f63d87)

| Check | Result |
| --- | --- |
| npm ci, lint, typecheck | pass |
| npm test | pass, 21/21 |
| author of c3cc730 and 7f63d87 | `Otohime <quiinthieu@gmail.com>`, Co-Authored-By count 0 (matches plan.commit_identity) |
| npm run build with GITHUB_SHA=0123...4567 | pass; `/projects` in app-path-routes-manifest |
| next start :4017, signed out | `/projects` 200 with "Nothing on the bench yet", `aria-label="Main"`; `/` 200 with PROJECTS and `y="-146"`; both carry build-sha = 0123...4567 |

Each build and start step was run separately, not as the contract's one-shot script. That script can print `curl: (7)` and still exit 0 on darwin, so its exit code is not proof.

No application source was edited.
