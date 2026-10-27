# t-1601 run-9238: reverify the fix_plan_run-9220 browser-contract repair

The supplied red gate ran at `4c4bc97`. That is the planning commit, which predates the Riso implementation, so `Could not find lib/riso-heading.test.ts` / `e2e/riso-headings.test.ts` is the expected baseline. Both files are present on main.

Both code items in [fix_plan_run-9220](fix_plan_run-9220.md) were already on main in `9b4a2cc`:

1. `e2e/console-errors.ts` accepts Chrome's `404 (Not Found)` and `404 ()` reason phrases. It still requires the exact `/api/ghosts` URL, a matching 404 GET/fetch response, a zero console location and zero arguments. `scripts/console-errors.test.ts` (in `npm test`) runs negative controls against both renderings. An unrelated 404 URL, a query or cross-origin URL, a 500, a POST, a document resource and an absent response all still fail. So do an application `console.error` with the same text and a pageerror.
2. In `e2e/riso-headings.test.ts`, the Pocket A test now waits for `data-riso-state="printed"` on the Home h1 before clicking. That marker is set only after hydration. The test also waits for `networkidle` before the click, then still requires the `console` view-transition type. The separate no-JavaScript test still asserts the server heading is settled and has no state marker.

No duplicate code change was made. Heading implementation hashes match run-9217's.

After `npm ci`, all five contract commands pass on Node v22.23.3 at base `8b0c491`:

| Command | Result |
| --- | --- |
| `node --experimental-strip-types --test lib/riso-heading.test.ts` | 5 passed |
| `npm test` | 2,552 passed; 0 failed/skipped |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0; 10 existing warnings |
| `node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts` | fresh production build `j1h1E2UTNCv9UGGis8pev`; 6 passed |

Evidence: [verification.json](../../.agent-artifacts/pm-268-t-1601/run-9238/verification.json) and [output tails](../../.agent-artifacts/pm-268-t-1601/run-9238/verification-output.txt).

What this run does not prove:
- The pre-fix public failure was never reproduced locally, because local hydration beats the click. The hydration wait therefore cannot be discriminated against a local server.
- Under the SWE stop-at-push contract, this run did not inspect the deployed origin, CI or remote history.

Status: integration deployed is unverified; no capacity wait; execution is demonstrated on a local production build only. Plan-manager's green gate and QA for `pm-268/t-1601` own one deferred check: the corrected suite against `https://otohime.dev` at a deployed SHA descending from this delivery, plus `/api/health` ancestry. It fails if browser test 1 or 5 fails publicly, or if the health SHA does not descend from the delivery.
