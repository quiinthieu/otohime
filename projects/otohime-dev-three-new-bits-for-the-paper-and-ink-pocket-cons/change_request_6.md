---
plan_id: pm-255
run_id: run-8942
kind: change_request
cycle: 6
---

# Change request (acceptance cycle 6): seasons joint check fails at the delivered SHA

For: product owner.

## What a visitor still cannot do

Nothing visible is missing. A visitor on https://otohime.dev at 1366x768 and 390x844 sees the seasons layer and dial, the torn-sheet 404, and the Ask the Ink canned fallback with no visible error. The gap is in the acceptance evidence: the seasons probe's joint block fails its "no console or page errors" check at both widths, so the seasons delivery does not pass its own required check.

## Evidence

- Production `GET https://otohime.dev/api/health`: sha `9bb1daea85c600788c8209819e5c4d69e08b3a46`. `probe-seasons.sh` against it: layer 59/59, dial 45/45, joint 26/28. The failures are `FAIL joint: 390px` and `FAIL joint: 1366px`, `motion welcome: no console or page errors`.
- Local `next build` + `next start` of the delivered SHA `6bb062c`: the same 26/28 with the same two failures on `localhost:4141`.
- Cause, confirmed with a response listener at both widths on production: the only 4xx is `404 GET https://otohime.dev/api/ask`, which the Ask dialog issues once on open (`lib/ask-tier.ts`). With the model tier off (`ASK_LLM` unset, per esc-413) that GET is the designed answer. Nothing else logs an error. The same check passed on production in cycle 4, before the console began calling `GET /api/ask` on open.
- The 404 page probe (`probe-lost.sh`) passes 34/34 on production and locally, and the Ask canned fallback passes in `probe-ask-llm-fake.sh`.

## Options for the product owner (choose one, record it)

1. The probe expects the tier-off state: the joint check ignores the `GET /api/ask` 404 when the tier is off (the page's `enabled:false` path). Smallest change, reversible, and does not change what visitors see. Recommended.
2. The console stops logging that 404: the GET is replaced by a non-error response when the tier is off, or fired only on an intent to ask. This changes the route or console behaviour and needs its own review; the ready probe of `set-env:ask-llm-production` reads `GET /api/ask` and would have to keep working.

## Owner and failure condition for the fix cycle

- Owner: product owner chooses the option; a software engineer implements it in the seasons probe (option 1) or the console (option 2).
- Pass condition: `BASE_URL=https://otohime.dev bash scripts/probe-seasons.sh` (and the local run) reports joint 28/28, exit 0, with the tier off, and the Ask fallback checks still pass.

## Not part of this change request

- Live model tier (`set-env:ask-llm-production`, esc-413): not delivered, deferred to the Vercel-account holder. This report does not ask for it.
- Production runtime logs: not read (no Vercel CLI, no `gh`). Owner: acceptance.
