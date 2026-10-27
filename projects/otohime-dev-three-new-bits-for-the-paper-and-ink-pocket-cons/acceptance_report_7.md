---
plan_id: pm-255
run_id: run-9147
kind: acceptance_report
verdict: pass
cycle: 7
cited_sha: cabb78b
---

| starting state | action | observable result | evidence |
| --- | --- | --- | --- |
| Production `https://otohime.dev`, `/api/health` reports `7735e74f801c5fab18abf1f944fec5b464ee11d1` (contains delivered `9cb3833` and `6bb062c`) | `curl GET https://otohime.dev/api/health`, `/`, `/shore`, `/api/ask` (GET only) | health `{"ok":true,"sha":"7735e74…"}`; `/` 200 text/html; `/shore` 200; `GET /api/ask` 404 (tier off, the designed `enabled:false` state) | curl, 2026-10-27 |
| Production, visitor on `/`, seasons layer and dial, 1366x768 and 390x844 | `BASE_URL=https://otohime.dev bash scripts/probe-seasons.sh` (read-only, no POST) | exit 0; **joint 28/28 checks pass** at both widths (was 26/28 in cycle 6). Layer, dial, masthead and reduced-motion checks pass; 151 `ok` lines, 0 `FAIL`. The tier-off `GET /api/ask` 404 is allowed by the probe, and the injected negative controls (another URL's 404, a `GET /api/ask` 500, a `console.error`) are still counted | `/tmp/pm255-acc7/seasons-prod.log` |
| Production, torn-sheet 404 at both widths | `BASE_URL=https://otohime.dev bash scripts/probe-lost.sh` | `probe: 34 ok, 0 failed`, exit 0 (five links visible and on top, no horizontal overflow at 390x844, no console or page errors) | `/tmp/pm255-acc7/lost-prod.log` |
| Production, visitor opens "Ask the console" and asks "shore", 1366x768 and 390x844 touch | Playwright (`playwright-core`, Chromium), script `/tmp/pm255-acc7/walk-ask.cjs`. Every POST to `/api/ask` aborted; GET passed through | At both widths the dialog shows the canned `FOUND: Shore: A focus timer that leaves sea glass behind.` with the `/shore` citation. 0 alert elements, no error wording in the dialog, 1 `GET /api/ask` → 404, **0 POST**, and the only console error is the tier-off 404 | `/tmp/pm255-acc7/walk-ask.json`, `ask-1366x768.png`, `ask-390x844.png` |
| Gate at delivered `cabb78b` (`npm ci` from the lockfile, Node 22) | `npm test`; `npm run typecheck` | `npm test`: **2432 tests, 2432 pass, 0 fail, 0 skipped**, exit 0. Typecheck exit 0 (`tsc --noEmit` after `next typegen`) | `/tmp/pm255-acc7/npm-test.log`, `typecheck.log`, `npm-ci.log` |
| Ask fake-model probe, own run (fake Anthropic, throwaway Postgres, local `next build` + `next start`) | `bash scripts/probe-ask-llm-fake.sh` | exit 0, `probe: passed`, `fake exit=0`. **On**: 42 ok, 0 failed; tier probe 30 ok, exactly 1 POST reached the fake; forced failures print the canned answer, no error. **On-control** (non-JSON fake): tier probe 28 ok, 1 failed on the POST check, `mode "offline"`, as designed (negative control). **Off**: 11 ok, 0 failed; tier probe 27 ok, 2 expected misses (`GET 404`, POST "not sent"), 0 requests to the fake (negative control). `tier verdicts: 8 of 8 reached` | `/tmp/pm255-acc7/fake-probe.log` |
| Ask model tier on production | **Not exercised.** Decider ruling: no POST to production `/api/ask`, no env change, no redeploy | `GET /api/ask` 404; the visitor sees the canned answer (row 4) | curl, walk |
| Negative control for the cycle-6 fix | Included in the seasons probe: an injected console error, a `GET /api/ask` 500 and another URL's 404 are each still counted | Joint still fails for any other console error (see row 2) | `seasons-prod.log` |
| Touched-service logs (web on Vercel; CI on main) | `command -v vercel` (absent); `gh auth status` (installed, **not logged in**, no credentials supplied) | Runtime logs and CI run history **not read**. Inconclusive for logs, not clean | environment check |

## Verdict: pass (delivered scope)

Accepted on the delivered scope: the paper-almanac seasons layer and dial, the torn-sheet 404 mini-game with its links, and Ask the Ink with its canned offline fallback. A visitor on https://otohime.dev sees all three at 1366x768 and 390x844. The seasons joint check that failed cycle 6 (26/28) now passes 28/28 on production.

**Not delivered, recorded as the open capability:** the live model tier of Ask the Ink. It is built and proven against the fake Anthropic server only. Production execution is unproven. Owner: the Vercel-account holder, chore `set-env:ask-llm-production` (esc-413; esc-418 duplicates it).

**Deferred check (open, owned by the Vercel-account holder, not run here):**
- Command: `BASE_URL=https://otohime.dev bash scripts/probe-ask-tier.sh`
- Owner: Vercel-account holder, under chore `set-env:ask-llm-production` (esc-413).
- Failure condition: any `not ok` line. This run would POST one paid answer to production, which this acceptance did not do.

No watch is needed: no scheduled or periodic outcome is part of the idea.

## Cited sha and build identities

- Production (`https://otohime.dev`), per `/api/health`: **`7735e74f801c5fab18abf1f944fec5b464ee11d1`** (contains `9cb3833` and `6bb062c`; cycle 6 read `9bb1daea…`).
- Delivered and tested HEAD: **`cabb78b`** (`pm-255/t-1632`). Between `7735e74` and `cabb78b` the change is probe and test scripts only (22 files, `git diff --stat`). No `app/`, `components/` or runtime `lib/` change is in the diff I checked. Production therefore shows the visitor-facing behaviour of `cabb78b`. Recorded as an assumption.
- Author of `cabb78b`: Otohime <quiinthieu@gmail.com>, with no `Co-Authored-By` trailer. `author.txt` is not in the delivery evidence; the identity was read from `git log`.

## Real and fake boundaries

- Real: production `https://otohime.dev` (GET only, plus one browser session per width with every POST to `/api/ask` aborted); the production seasons and 404 probes; `npm ci`, `npm test` and typecheck at `cabb78b`; the local `next build` and `next start` in the fake-model probe.
- Fake: the fake Anthropic server, the throwaway Postgres and the page-route fixtures in the fake-model probe. No live model call anywhere.
- Not checked: production runtime logs; CI run history on main; Safari; assistive technology; real devices.

## History completeness and defects

- Logs: not read (Vercel CLI absent, `gh` not logged in). Inconclusive for logs.
- CI: not observed. Inconclusive.
- Defects observed: none in the walked scope. The only console error on production is the designed tier-off `GET /api/ask` 404, which the probe allows.
- Side effect: the local build rewrote `content/history.json` (a generated index from `scripts/history-index.ts`). It was restored to the committed state with `git checkout`, and it is not part of this report.
- The first `npm run typecheck` failed with `next: command not found` because the lease had no `node_modules`. `npm ci` fixed it and the typecheck then passed. This is the known fresh-lease issue, not a delivery defect.
