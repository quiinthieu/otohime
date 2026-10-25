# t-1517 Ask model switch — summary (run-8475)

Role: software_engineer. Model: claude-opus-5-5. Plan pm-248, sequence 7.

## Delivered

- `lib/ask-llm.ts`: `MODEL` is `claude-haiku-5-5`. The request no longer sends
  `betas: ["server-side-fallback-2026-07-01"]` or `fallbacks: "default"`. Haiku
  5.5 has no server-side fallback: `"default"` leaves a declined request declined,
  and a model list returns 400. A refusal already prints the offline answer
  (`stop_reason !== "end_turn"`). `effort: "low"` and the json_schema output stay.
- `lib/ask-llm.test.ts`: pins `MODEL` and `params.model` to `claude-haiku-5-5`,
  checks that the request a POST sends names Haiku, and checks that `fallbacks`
  and `betas` are absent.
- `lib/ask.ts`: the existing `INTENTS` table gains two stock questions with
  canned answers. There is no second mechanism.
  - `work` ("what is your work", "what stack/tools do you use", "… data
    engineering work"): `WORK:` plus the work and six stack passages, citing
    Work `/work`.
  - `notes` ("what do you write about", "show me your notes", "what have you
    written"): `NOTES:` plus the note passages, citing Notes `/notes`.
  - Each entry now declares how it cites: the first passage's page, each
    passage's page, or a named page. The old bio, now, projects and contact
    replies are unchanged.
- `scripts/ask-index.ts`: `--check` now parses the committed index and asserts
  `REQUIRED_SOURCES`:
  - Work `/work`, Projects `/projects` (plus at least one project) and Notes
    `/notes` must each have at least one passage on the page.
  - It prints `covers Work /work (7 passages), Projects /projects (12 passages),
    Notes /notes (3 passages)` and exits 1 with `does not cover <name>` when one
    is missing.
  - The index already covered all three, so `public/ask-index.json` is unchanged
    and was not regenerated.
- `lib/ask.test.ts` adds:
  - the check's coverage output, and a negative control: dropping Notes, Work or
    project passages makes the check exit 1;
  - canned Work and Notes answers, with exact lines and sources;
  - every stock answer cites a page its lines came from;
  - no API key (unset, empty, or ASK_LLM unset): GET and POST are 404, the fake
    client is never called, and the canned answer is the answer;
  - a failed call (connection error, 401), a refusal, or unparseable JSON gives
    `[(OFFLINE), …canned lines]` with the canned sources.

## Verification (local, node v22, linux)

- `npm test`: 1680 tests, 1680 pass, 0 fail (1674 before this change).
- `npm run ask:check`: exit 0. It prints the coverage line above.
- `npm run typecheck`: exit 0.
- `npx eslint` on the five touched files: exit 0.
- Mutation checks:
  - reverting `MODEL` to opus fails 3 tests;
  - citing the first note instead of the Notes page fails 1;
  - disabling the coverage gate fails 1.

## Boundaries

- Real: the BM25 and stock-answer logic, the index file, the check script, and
  `handlePost` and `handleGet` themselves.
- Fake: the Anthropic client in every test, and the usage store (in memory).
- Live Haiku output is not proven. ANTHROPIC_API_KEY is not in the pod, and no
  live API call was made. Production enablement (ASK_LLM=1 plus the key) is
  unchanged and unverified here.
- The console UI still answers offline only. The typewriter and link citations
  are t-1518.
