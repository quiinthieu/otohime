---
plan_id: pm-248
run_id: run-8575
kind: acceptance_report
verdict: fail
cycle: 1
cited_sha: 3604c822f6616f8eb7f091ff46c2af68a8ef488b
---

# Acceptance report: Paper Almanac Bits (pm-248, run-8575, cycle 1)

Verdict: **fail**. Two of the three bits work for a visitor on the live site.
Bit 1, "Ask the Ink", does not give visitors the AI answers the idea asked for:
the console never calls the model endpoint, and that endpoint is off in production.
A change request is filed beside this report: `change_request_1.md`.

Deployed identity: https://otohime.dev, Vercel. `<meta name="build-sha">` is
`3604c822f6616f8eb7f091ff46c2af68a8ef488b` on `/`, `/work` and `/notes`. The
global 404 document does not publish the sha. CI run 40256829882 for that sha
(`main`, push) concluded `success`. Its `checks` job passed lint, typecheck,
`npm test`, `ask:check`, build, migrations and E2E. The `production` check run
also concluded `success`. The sha's commit is `pm-240/t-1520`, a record-only
commit (`artwork-review.md`). The t-1538 404 code is inherited from c06a430 and
is in the deployed tree.

## Walkthrough

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Live site, anonymous visitor, TZ Australia/Sydney, 26 Oct 2026 | Open `/` at 1366x768 and 390x844 | 200. `<meta build-sha>` = 3604c82. `data-season="spring"` set before the probe reads it (north would be autumn). | `walk.mjs` checks 1-2, both widths; `final.log` |
| Same | Read the ambient layer | `svg.season-layer`, aria-hidden=true, 16 `.almanac-bit`, pointer-events none, z -1 | `final.log`, both widths |
| Same | Use the season dial (keyboard Space on the `winter` radio) | `data-season=winter`, localStorage `season=winter`, still winter after reload | `final.log`, both widths |
| Negative control for season | Open `/` as Europe/London, same date | `data-season="autumn"`, so the zone drives the answer | `neg.mjs` output |
| Same | Open "> Ask the console", ask "what is your work" | Typed answer begins "WORK:". After completion, one link `-> Work` to `/work`. | `final.log`, both widths |
| Same | Count requests to `/api/ask` during the ask | **0**. The console never calls the model endpoint. | `final.log`; `components/ask-console*.tsx` has no `api/ask` call |
| Production config | `GET /api/ask` | **404** (`ASK_LLM` off on prod). Ask answers are offline-only (canned and index-based). | `curl`, see below |
| Live site, no JS (simulated) | Fetch the five links | `/`, `/work`, `/projects`, `/notes`, `/play` each 200 | `final.log`, both widths |
| Unknown path `/acc-no-such-page-…` | `GET` | **404** with the torn sheet (`lost-404`, `lost-crumpled`, `lost-page`). Links: Home, Work, Projects, Notes, Play. | `curl` and screenshot `404-1366x768.png` |
| Negative control for 404 | `GET /work` | No `lost-*` sheet markup, so the sheet is 404-only | `curl` |
| 404 with JS | Press "Smooth it out" until disabled | 20%, 40%, 60%, 80%, then "Flat again. Pick a way back." The button becomes aria-disabled. | `final.log`, both widths |
| Reduced motion (Playwright `reducedMotion: reduce`) | Open the 404 and `/` | No "Smooth it out" button. 0 running `.almanac-bit`. | `final.log`, both widths |
| Both widths | Check horizontal overflow on `/` | scrollWidth - clientWidth = 0 | `final.log` |
| Both widths | Console and page errors on `/`, the 404 and reduced-motion pages | None, apart from the deliberate unknown-path 404 (filtered; the status is asserted instead). Benign Next `_rsc` prefetch aborts on navigation are excluded. | `final.log` (38/38) |

Walk result: **38 of 38 pass** (`final.log`, `SUMMARY 38/38 pass`). Each
width ran 19 checks. The walk is the acceptance script `walk.mjs` (Playwright-core
1.64.0, Chrome 154 at /usr/bin/google-chrome, live site, not the repo's probes).

Project suite on this checkout (`npm ci` then `npm test`): exit 0, 1723 pass,
0 fail. This is a context check; the walk above is the evidence.

## Bit verdicts

| Bit | Outcome asked for | Delivered to a visitor | Verdict |
| --- | --- | --- | --- |
| 1 Ask the Ink | AI oracle answers grounded in site content, cited, streamed as typewriter, rate-limited, cheap model, offline fallback | Grounded, cited, typed answers. Offline fallback works. **Model is never reached from the console, and `/api/ask` is off on prod.** | **Fail** (change request) |
| 2 Paper almanac seasons | Paper, tints and ambient layer follow real season and hemisphere, a dial overrides, reduced motion respected | Works at both widths (clock and zone, dial, persistence, layer, reduced motion) | Pass |
| 3 Lost page 404 | Torn sheet 404 with plain links, smooth-out play, reduced-motion flat sheet | Works at both widths; links reachable without JS | Pass |

## Logs and services read

- Vercel runtime logs: **not read**. No Vercel credentials in this pod. The walk
  captured client-side console, page and request errors at both widths instead.
- GitHub Actions (CI for 3604c82): read via the unauthenticated API. Run 40256829882, `success`.
  Job logs were not read beyond step conclusions.

## Real and fake boundaries

- Real: the live Vercel deployment, real Chrome 154, real network.
- Fake or assisted: `timezoneId` and `reducedMotion` are browser-context settings, not the visitor's device. Nothing signed in.
- Not exercised: `/api/ask` with a key (the key is absent and no operator
  provided one). No live Haiku call. Keyboard focus rings beyond the dial were not walked by me (covered by the task probes, not independent).
  No Safari or real devices.

## Defects

1. **Ask the Ink: model never reached by a visitor.** `components/ask-console.tsx`
   answers only from `lib/ask.ts` and `ask-index.json`. Even with `ASK_LLM=1`
   and a key, a visitor never calls `POST /api/ask`. Production has
   `ASK_LLM` off (`GET /api/ask` returns 404). The idea's core ("AI oracle, cheap
   model") is therefore not delivered for a visitor. See `change_request_1.md`.

## Deferred checks

| Check | Owner | Failure condition |
| --- | --- | --- |
| Live Haiku answer quality via `/api/ask` | product_owner (wiring), operator (`ANTHROPIC_API_KEY`, `ASK_LLM=1`) | A visitor's question with the flag on returns no model answer, or a non-cited answer, or the console ignores the endpoint |
| Keyboard focus ring on the dial and console at 390px | quality_engineer | Focus invisible or lost in the dial or console |
| Real device or Safari check of layer motion | operator | Layer janks or does not pause on tab hide |

## Judgement calls

- Fail rather than pending on bit 1. The gap is code (the console is not wired to the endpoint). The key is only an operator step on top of it.
- Branch for the commit, not `main`. Pushing to `main` redeploys production. This is a docs-only change, so it goes to a new branch.
