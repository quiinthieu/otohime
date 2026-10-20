# QA: t-1185 cycle 2, site pages hand over and /projects rows rise (pm-206, run-6909)

**Verdict: pass.** Delivery sha `738437f2a22dd48de50394256c5e01bf85789aa7`. It is the fix from
[fix-t-1185.md](fix-t-1185.md) on top of the site change `5df755c`. Production serves the same
sha: `<meta name="build-sha">` on https://otohime.dev/ and /projects is `738437f2…`, and
`git merge-base --is-ancestor 738437f 738437f2a22d…` exits 0. The platform green gate for 738437f
is pass. CI's `production` job has `needs: checks` (.github/workflows/ci.yml), so the deploy of
738437f also means its CI checks passed. `gh` is not authenticated here, so I could not read the
run itself.

## Contract verification (local, macOS, at 738437f)

| Item | Result |
| --- | --- |
| `npm ci && npm run lint && npm run typecheck && npm test` | exit 0, 720 pass, 0 fail |
| every site page wraps (find/grep, catch-all excluded) | exit 0 |
| no layout wraps | exit 0 |
| `npm run build && SKIP_BUILD=1 bash scripts/probe-motion.sh` | exit 0, **279 ok, 0 failed** |
| `SKIP_BUILD=1 bash scripts/walk-music.sh` | exit 0, 12 ok, 0 failed |
| `git log -1 --format=%ae` | `quiinthieu@gmail.com` |

## Deployed site (the plan's production acceptance line)

- `BASE_URL=https://otohime.dev bash scripts/probe-motion.sh`: **exit 0, 279 ok, 0 failed**.
  The check that failed in cycle 1 ("/projects, /sign-in and /does-not-exist load with no console
  error or page error") now passes over HTTP/2. All 16 `site` checks pass. They cover /work → /projects
  page-out (fade-out 150 ms) and page-in (fade-in 210 ms after 150 ms), 8 rises 40 ms apart
  finishing within 0.7 s, /sign-in 200, /does-not-exist 404, and reduced motion (every row
  delay ≤ 1 ms, and every animation on /projects, /sign-in and the 404 ≤ 1 ms or finished). Every
  hop check from t-1184 also passes at both viewports.
- `BASE_URL=https://otohime.dev bash scripts/walk-music.sh`: exit 0, 11 ok, 0 failed, build-sha ok.

## The fix keeps the check able to fail

With node, I tested the new `notFoundLoad` regex (scripts/probe-motion.mjs:289) against these lines:

| Logged line | Result |
| --- | --- |
| `/does-not-exist: … 404 ()` | excluded |
| `/does-not-exist: … 404 (Not Found)` | excluded |
| `/does-not-exist: … 404 () (https://…/x.css)` (subresource) | error |
| `/does-not-exist: … 404 (Not Found) (https://x/a.js)` (subresource) | error |
| `/does-not-exist: … 500 ()` | error |
| `/sign-in: … 404 ()` | error |
| `/does-not-exist: … 404 (Gone)` | error |

## Scope of the fix

`git diff --stat 9e0d154 738437f` changes only `scripts/probe-motion.mjs` (2+, 1−), as the fix
plan asked. The site change I reviewed and mutation-tested in cycle 1 ([qa-t-1185.md](qa-t-1185.md))
is untouched, so I did not repeat those five mutations (decision recorded).

## Not proven live

The signed-in rooms and the skeleton → page handover need a session, and the probe runs with no
database. The unit test and the every-page grep prove them statically, and both pass at HEAD.

## Commit identity

738437f, 9e0d154 and 5df755c are authored and committed by `Otohime <quiinthieu@gmail.com>`
with no Co-Authored-By trailer. The delivery evidence has no author.txt.
