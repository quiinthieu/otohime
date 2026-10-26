# t-1558 Ask tier production probe: fix cycle for red_gate_vacuous (run-8924)

Role: software_engineer. Model claude-opus-5-5, macOS lease, Node v22.23.3, `npm ci` from the committed lockfile.
Base: origin/main 591c28e. The earlier delivery 9cb3833 (run-8909) is an ancestor of the base.

## Why this run

The red gate passed, but it was vacuous: each verification item only expected exit 0. The contract's commands
stay as they are. This run makes each exit 0 depend on named assertions, without changing the route,
`lib/ask-llm.ts`, the model pin or any env.

## Operator chore

This run cites esc-413 (`set-env:ask-llm-production`) and does not raise it again. Per the decider's answer, production
stays tier-off: GET https://otohime.dev/api/ask is 404 and visitors get the canned offline answers.

## What changed

- `lib/ask-deploy.ts`: new `probeTierLive(baseUrl, request, origin)`. It owns the probe's live request
  sequence: a GET, then at most one POST, sent only if the GET says the tier is on, then each distinct cited
  page. The request function is injected. `scripts/probe-ask-tier.mjs` now calls it, so the code under unit
  test is the code that runs against production. Check names and output are unchanged.
- `lib/ask-deploy.test.ts`: 6 new named tests, 2213 in total (2207 before them).
  - Tier on: a fake shaped like the route (403 unless the Origin is the site's) gets exactly the GET, one POST
    with Origin `https://otohime.dev` and body `{question: TIER_QUESTION}`, then GET /work. Duplicate citations
    are fetched once, and a cited 404 page is a miss.
  - Tier off: a 404, `enabled:false`, a 503 or a refused connection sends 0 POSTs, and the POST check says "not sent".
  - Negative controls: an (OFFLINE) reply, an off-site citation, a 429, a wrong Origin (403) and a throwing
    POST each fail the POST check, with no page fetch afterwards.
  - Guards:
    - the probe imports and calls `probeTierLive` and has no POST of its own;
    - `probe-ask-tier.sh` is executable;
    - neither script mentions vercel, ASK_LLM or ANTHROPIC_API_KEY outside comments;
    - `probe-ask-llm-fake.sh` runs the tier probe once each in on, on-control (after `fake_mode nonjson`)
      and off, with the fixed tallies;
    - the npm test glob covers `lib/**/*.test.ts`;
    - tsconfig is strict and includes `**/*.ts`;
    - there is no `.only`, skip, todo or ts-ignore in these files.
- `scripts/probe-ask-llm-fake.sh`: each phase now requires exact tallies. All 6 forced-failure cases must print
  the canned answer, and all 6 must show no error. The probe's own summary must be exact: on `30 ok, 0 failed`,
  on-control `28 ok, 1 failed`, off `27 ok, 2 failed`. The run also fails unless all 8 tier verdicts are reached.

## Verification (this lease, after npm ci)

- `npm test`: exit 0, **2213/2213** pass, 0 skipped.
- `npm run typecheck`: exit 0. Negative control: a temporary `lib/` file with a type error made `tsc --noEmit`
  exit 2 with 1 error TS, and the file was removed. eslint on the touched files: exit 0.
- `bash scripts/probe-ask-llm-fake.sh` (docker Postgres, fake Anthropic, local `next build` + `next start`):
  exit 0, 64 ok, 0 not ok. Tier probe summaries matched on `30 ok, 0 failed`, on-control `28 ok, 1 failed` and
  off `27 ok, 2 failed`. On, the fake got exactly 1 tier POST; off, it got 0. The run ended with `tier verdicts: 8 of 8 reached`.
- Tally negative controls, using the real `tier on` output from that run: `fallback_and_tally` returns 0 on it,
  returns 1 when the expected summary is wrong, and returns 1 when one canned-answer line is dropped.

## Real/fake boundary and deferred check

Everything above is fake: the fake Anthropic server, a throwaway Postgres and a local build. Production was not
touched: no POST to production /api/ask, no env and no deploy.

The live model tier is **not delivered**. The integration is built and proven against the fake. Production execution is unproven.

Deferred: `BASE_URL=https://otohime.dev bash scripts/probe-ask-tier.sh`.
- Owner: acceptance, after chore esc-413 (`set-env:ask-llm-production`) passes its ready_probe.
- Fails on: any `not ok` line.
- Today's checkable product behaviour: GET /api/ask is 404, and the console prints the canned answer with no error.

SHA-256 (first 16 hex digits): lib/ask-deploy.ts 6416097d6d02d492, lib/ask-deploy.test.ts 95bfa10f7f928390,
scripts/probe-ask-tier.mjs 403c3a253eb19f48, scripts/probe-ask-tier.sh 7e17bd2755f4d10f (unchanged),
scripts/probe-ask-llm-fake.sh 221d352820b1bfd5, package-lock.json 2d0ec0bea389a532.
