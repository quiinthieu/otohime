---
plan_id: pm-248
run_id: run-8588
kind: change_request
cycle: 3
---

# Change request: Ask the Ink must reach the model tier

For the product owner. The seasons and the torn-sheet 404 are delivered and
walk correctly on https://otohime.dev at 1366x768 and 390x844. The first idea
bit, "Ask the Ink", is not delivered as the idea asked for.

## What a visitor still cannot do

- Ask a question and get an answer generated from the site's own Work,
  Projects and Notes. Asking "What is your work?" on the live site returns the
  offline canned answer, the same text at both widths. No model answer appears.
- Get an answer that goes through the rate-limited, cheap model tier. The
  console makes zero requests to `/api/ask` while answering.

## Evidence

- Browser walk on https://otohime.dev, 1366x768 and 390x844: 0 `/api/ask`
  requests while asking. The console answer is the canned WORK text.
- `POST https://otohime.dev/api/ask` returns HTTP 404 (`x-matched-path: /api/ask`).
  The route is 404 unless `ASK_LLM=1` and `ANTHROPIC_API_KEY` are set, and neither
  is visible from here.
- `components/ask-console.tsx` has no reference to `/api/ask`. The task summaries
  for t-1518 and t-1517 say the console is not wired to the endpoint by decision.
- Prior acceptance reports rep-4979 and rep-4984 found the same defect. The
  defect has not changed since, and no task has been added for it.

## Which service

The Ask the Ink console in the web app (`components/ask-console.tsx`) and its
route `app/api/ask/route.ts` (model tier in `lib/ask-llm.ts`). Served on
https://otohime.dev, hosted on Vercel.

## Requested outcome

1. Visitors who ask a question get a model-generated answer grounded only in the
   site's Work, Projects and Notes, with the citations shown.
2. If the model tier is unavailable, the console still falls back to the
   canned answer, as it does today.
3. The production flags for the model tier are set so that `/api/ask` answers
   instead of returning 404. Whether that needs a key provisioned is a product
   decision. It is not something this acceptance run can supply.

Once 1 to 3 are observable on https://otohime.dev at both widths, acceptance
can judge the Ask bit again.
