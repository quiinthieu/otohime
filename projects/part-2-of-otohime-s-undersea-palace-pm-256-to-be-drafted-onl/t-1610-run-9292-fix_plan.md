# t-1610 QA fix plan — run-9292

Cause: **code**. The latest integration tree has a browser verifier defect in upstream commit `995279a572db68e48ace27cd2aaa04b9d6611e72` (pm-294/t-1684, run-9290). Delivery `308b36202ef8774294596ac9d689016fd64d8d5b`, its green gate ver-3693, and its deployed dark-state walkthrough pass. The new failing file did not exist at that delivery. This is not an authority or capacity failure, and a pending CI run cannot discharge the observed red full-suite check.

Change **e2e/booth.test.ts:577**. After dispatching `webglcontextlost`, wait for the existing exact state before reading it:

```ts
await page.waitForFunction(() =>
  document.querySelector('[data-testid="booth-studio"]')
    ?.getAttribute("data-renderer-backend") === "canvas2d",
);
assert.equal(await studio.getAttribute("data-renderer-backend"), "canvas2d");
```

Keep the context-loss event, all film-stock pixel comparisons, the exact backend assertion and the nonblank fallback pixel assertion. No sleep, enlarged arbitrary delay, skipped case, relaxed pixel threshold or application behavior change is needed. The callback in `app/(site)/(app)/play/booth/_components/booth-studio.tsx:283` calls React's `setContextLost(true)`; the native event's dispatch is not a guarantee that React has committed the data attribute.

Owner: the next **pm-257/t-1610 software-engineer** run that repairs the full-suite gate; coordinate with source owner **pm-294/t-1684** and preserve that feature. Its recorded run-9290 profile is `agy-argon-high`, flags `--model gemini-4-argon-high --dangerously-skip-permissions`; no separate effort flag is recorded. This attribution comes from the run record, not a role default.

Verify the repair against real Chrome and the production build, keeping the fake alive through the full suite:

```sh
TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/booth.test.ts
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/ghosts-workflow.test.mjs scripts/ci-workflow.test.mjs
npm test
npm run lint
npm run build
TMPDIR=/tmp npm run test:ghosts
TMPDIR=/tmp npm run test:e2e
```

Use the committed QA control in `qa-run-9292/booth-control.test.mjs` to diagnose the native-event/React-commit boundary; the preserved raw failure is `qa-run-9292/upstream-defect.json`. An isolated green rerun alone does not repair the racy original assertion.

Commit the focused test repair on a freshly fetched task branch, with the required task prefix, then integrate and push main without force. Changing `e2e/booth.test.ts` triggers `.github/workflows/ci.yml` automatically. If that run is replaced, dispatch **CI** on main; its existing `workflow_dispatch` uses the same checks/production gates. Obtain a new green gate at the repair SHA and re-run QA against its deployed descendant. Keep `GHOSTS_DEPLOY_ENABLED` and `GHOSTS_ENDPOINT` dark; no Cloudflare credential or operator dependency is needed for this repair.

Failure condition: any repeat of the immediate backend mismatch, missing fallback pixels, failed existing browser case, or deployment lacking the repair. Hosted active ghost acceptance remains with **pm-257/t-1611**, currently backlog; it is a separate dependency and cannot waive this defect.
