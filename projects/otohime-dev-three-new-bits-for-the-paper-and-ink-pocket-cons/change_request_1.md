---
plan_id: pm-248
run_id: run-8575
kind: change_request
cycle: 1
---

# Change request: the Ask console must use the model tier (pm-248, cycle 1)

For the product owner. This is work to plan, not a fix for one task.

## What a visitor still cannot do

A visitor asks "Ask the Ink" a question and gets only canned or index-based
answers, never a model-written answer. The console never calls `POST /api/ask`,
so even a deployment with `ASK_LLM=1` and a key would not change what a
visitor sees. On production the endpoint is off anyway (`GET /api/ask` is 404).
The idea asked for an AI oracle with a cheap model and an offline fallback.

## Evidence

- Live https://otohime.dev, build `3604c822f6616f8eb7f091ff46c2af68a8ef488b`,
  Chrome 154, 1366x768 and 390x844. "what is your work" gives an answer
  starting "WORK:" with the `/work` link. **Requests to `/api/ask` during the ask: 0.**
- `curl https://otohime.dev/api/ask` returns 404.
- `components/ask-console.tsx` and `components/ask-console-loader.tsx` have no
  call to `/api/ask`. The endpoint is referenced only from `lib/ask-llm.ts`,
  its tests, and `app/api/ask/route.ts`.
- Plan record: the t-1518 summary states "/api/ask is not wired to the
  console (decision recorded)". The plan's own design (non-streaming POST, typed
  client-side) assumed the console would call it.

## Which service

Web app (Next.js on Vercel): `components/ask-console*.tsx`, `app/api/ask`,
`lib/ask-llm.ts`. The ops flag `ASK_LLM` and `ANTHROPIC_API_KEY` are an
operator step, not code.

## Requested outcome (done when a visitor sees it)

1. The console sends the question to `POST /api/ask` and types the returned
   answer with the same typewriter. On 404, 429, refusal or network error it
   falls back to the offline answer, marked as offline.
2. Citations from the model answer are validated against the index and rendered
   as links, as the offline ones are today.
3. With `ASK_LLM=1` and a key set (operator action, to be requested
   separately), a live question returns a model answer with a cited page. A
   negative control: with the flag off, the same question shows the offline
   answer and no model text.

## Not in this request

- The 404 sheet, the seasons and the dial work and are not in scope.
- Rate limits and the cheap model are already in `lib/ask-llm.ts`; verify them
  after wiring, do not rebuild them.
