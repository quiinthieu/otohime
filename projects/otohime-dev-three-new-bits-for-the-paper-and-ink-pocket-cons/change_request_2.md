---
plan_id: pm-248
run_id: run-8581
kind: change_request
cycle: 2
---

# Change request: Ask the Ink must reach the model (pm-248, cycle 2)

## What a visitor still cannot do

A visitor cannot get an AI answer from Ask the Ink. Asking "what is your work"
in the console prints the stock, offline answer every time. The console never
sends the question to the model endpoint, and that endpoint is off in
production: `GET` and `POST https://otohime.dev/api/ask` both return 404. The
idea asks for an oracle that answers from the site's own content and streams
the answer; the offline path alone does not deliver that.

## Evidence

- Live walk (`acceptance_report_2.md`, rows 7 and 8; `acceptance_walk_run-8581.log`):
  0 requests to `/api/ask` while the console answers, at 1366x768 and 390x844.
  `POST /api/ask` from the origin returns 404 at both widths.
- `curl -i https://otohime.dev/api/ask` returns 404 (GET).
- Source at HEAD `c0dbca8`: no `fetch("/api/ask")` in `components/ask-console*.tsx`.
  `components/ask-console-loader.tsx:15` fetches only `/ask-index.json`.
- The route `app/api/ask/route.ts` returns 404 unless `ASK_LLM=1` and
  `ANTHROPIC_API_KEY` are set (`lib/ask-llm.ts:48`). Neither is set in production.
- Deployed sha `d8a9be1`. Repo HEAD adds no app code since then.

## Service

otohime.dev, the Next.js app on Vercel. The affected code is
`components/ask-console.tsx`, `components/ask-console-loader.tsx`,
`app/api/ask/route.ts` and `lib/ask-llm.ts`. The production settings are
`ASK_LLM` and `ANTHROPIC_API_KEY`.

## Requested work for the product owner

1. Wire the console to `POST /api/ask`. Send the question, type the returned
   answer out inside the console screen, and render the returned citations as
   links to their pages.
2. Keep the offline canned answer as the fallback. Use it when the endpoint
   returns 404, 429, a network error or unparseable JSON, so the console still
   answers with the endpoint off.
3. Enable the model tier in production (`ASK_LLM=1` plus the key). This is
   configuration, and it is separate from step 1; it can be reversed by
   unsetting the flag. A person must supply the key. It is not a reason to skip
   step 1.

## Done when

On https://otohime.dev, a question produces at least one `POST /api/ask` that
returns 200 with a model-written answer, and its citations match the passages
returned. This is checked at 1366x768 and 390x844. With the endpoint at 404, the
offline answer still shows.

## Not in this request

Live answer quality is unproven here: no key in the pod, and the flag is off.
Server logs and CI for `d8a9be1` were not read (see `acceptance_report_2.md`).
