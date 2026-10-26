---
plan_id: pm-248
run_id: run-8660
kind: change_request
cycle: 1
---

# Change request: Ask the Ink must reach the model tier on production

For the product owner. Seasons and the torn-sheet 404 pass live at 1366x768 and
390x844 (see `acceptance_report_1.md`). The Ask bit still does not work for a
visitor on https://otohime.dev.

## What a visitor still cannot do

- Ask a question and get an answer generated from the site's Work, Projects and
  Notes. The console answers only with the offline canned text.
- See the console call the model tier. The console sends no `GET /api/ask` and no
  `POST /api/ask` on production.

## Evidence

- `GET https://otohime.dev/api/ask` and `POST` with origin and JSON: HTTP 404.
- The probe `scripts/probe-ask.sh` with `BASE_URL=https://otohime.dev`: 63 ok,
  23 failed. The failures are the model-tier checks, plus the tier-off GET check.
- The 17 `/_next/static` chunks linked from `/`: none contains `api/ask`. Main has
  the call in `components/ask-console.tsx` and `lib/ask-tier.ts`, since `8e02b8d`.
  The deployed build therefore predates `8e02b8d`, or that code did not ship.

## Which service

The Ask console in the web app (`components/ask-console.tsx`, `lib/ask-tier.ts`)
and its route `app/api/ask/route.ts`, served on https://otohime.dev (Vercel).

## Requested outcome

1. Production runs a web build that includes `8e02b8d` or later. The chunks
   linked from `/` contain `api/ask`, and the console sends one `GET /api/ask`
   on open.
2. The model tier is on in production: `GET /api/ask` returns 200 with
   `"enabled":true`. This is operator action `set-env:ask-llm-production`
   (esc-381). It needs a person with the Vercel account to set `ASK_LLM=1` and a
   server-only `ANTHROPIC_API_KEY`, then redeploy.
3. A visitor's question on https://otohime.dev sends one `POST /api/ask`, and the
   model's lines and cited pages print. If the model tier is unavailable, the
   console still shows the canned answer with no visible error.

Acceptance walks production again once 1 to 3 hold, at both widths.
