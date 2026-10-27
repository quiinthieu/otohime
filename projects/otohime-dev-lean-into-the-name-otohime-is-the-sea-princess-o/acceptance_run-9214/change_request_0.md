---
plan_id: pm-271
run_id: run-9214
kind: change_request
cycle: 0
---

# The Tamatebako must replay the history of the site the visitor is actually on

**What a visitor still cannot do:** open the Tamatebako on otohime.dev and scrub through the site's real, current changelog.
- Live `/ryugu`, served from `b4e142a`, shows its newest leaf as `fe0dd82` (26 Oct 2026 11:17 UTC). That is 213 commits before the version being served.
- It says "the newest 200 of its 414 commits", but the site has 627.
- None of the recent work appears, not even the Tamatebako and palace sound commits. Every future deploy makes the gap larger.

**Evidence** (acceptance_run-9214):
- `walk.log`, checks 7–8 and 27–28: real Chrome on production at 1366×768 and 390×844.
- `negative-control.log`:
  - A full clone indexes `6809e82`, 200 of 628.
  - A depth-1 clone, the way production checks out, yields "fallback (shallow clone): 200 of 414 … unchanged".
- `npm run history:check` on a full clone exits 1: "stale: 214 commits behind HEAD (at most 20)".

**Service:** the otohime.dev production deploy, i.e. the GitHub Actions `production` job in `.github/workflows/ci.yml`, and the build-time history index that `/ryugu` imports.
- The production checkout is shallow (`actions/checkout` without `fetch-depth`, ci.yml:281).
- So the indexer always ships the committed fallback.
- No CI step enforces `history:check`.

**Work for the product owner:** make the deployed palace's changelog current with the deployed build. Acceptance needs both of these on a fresh deploy:
- the newest leaf on live `/ryugu` is within 20 commits (the indexer's own MAX_LAG) of the sha `/api/health` serves;
- the replay note's total equals `git rev-list --count <that sha>`.

The fix must not need someone to remember to recommit `content/history.json`, and a stale index should be caught before it ships.

Everything else on the user path passed on live and needs no change:
- the box, scrubber, aged paper and replay label;
- sound opt-in, Pocket off, stop on leave and the no-Web-Audio fallback.
