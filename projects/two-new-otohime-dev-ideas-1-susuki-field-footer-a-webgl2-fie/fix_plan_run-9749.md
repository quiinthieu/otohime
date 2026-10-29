# t-1766 fix plan — run-9749

**Cause: code. Owner: t-1766 software engineer.** Delivery ec7e171 introduces an unguarded NetworkInformation event method call into the shared footer. Existing Save-Data capability objects intentionally contain only `{ saveData: true }`. Mount throws at `components/susuki-field.tsx:290`; React removes the page; three previously existing suites fail. Independent production reproduction and an EventTarget control are in qa-save-data-evidence-run-9749.json at deployed ce7f635652de107a44d2ee5e27f7377596d662cd.

1. At **components/susuki-field.tsx:290**, guard the method itself: `connection?.addEventListener?.("change", policy)`. At **line 300**, apply the corresponding optional method call to removal. At **line 153**, describe optional subscription methods explicitly if needed instead of assuming the connection is always a full EventTarget. Preserve static Save-Data rendering and real change-event subscription when the methods exist.
2. Extend **e2e/susuki.test.ts:46** (`open` and its Save-Data fixture) and the fallback cases starting at **line 158** with a capability object containing only `saveData`. Assert an intact page/footer, one nonblank static frame, zero ambient rAF and no console/page errors; navigate away to exercise cleanup. Keep an EventTarget control that dispatches a real `change` event so the existing capability-event behavior remains covered. Do not weaken the older Kame/Peep-box assertions or replace their fixture merely to hide the shared-footer crash.
3. Run the exact contract commands, then the three affected suites against a fresh locked production build:

   ```sh
   TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/kame.test.ts e2e/kame-fetch.test.ts e2e/peep-box.test.ts e2e/susuki.test.ts e2e/bottle-ui.test.ts
   TMPDIR=/tmp npm test
   npm run typecheck
   npm run lint
   TMPDIR=/tmp node scripts/check-gate-closure.mjs
   SKIP_BUILD=1 TMPDIR=/tmp bash scripts/walk-end.sh
   CI=1 SKIP_BUILD=1 TMPDIR=/tmp bash scripts/probe-end.sh
   ```

   Require zero failed/skipped tests. This QA's three older suites currently produce **30 pass / 3 fail**, even though the dedicated Susuki/Bottle suite passes **21/21**. Keep both observations in the delivery record.
4. Commit with the plan/task prefix and required owner identity; push the task branch and publish through the existing authorized main workflow. A main repair push automatically triggers **.github/workflows/ci.yml**. To rerun an already published repair without another source change, dispatch **ci.yml** on **main** using GitHub's workflow_dispatch. Bind the terminal checks result to the actual repair SHA and read assertion annotations; the old delivery run **40817421327**, job **123261664083**, and successor **40817663407**, job **123262439242**, both remain failed history. No runner repair or operator chore is indicated.
5. After deployment, check `git merge-base --is-ancestor <repair-sha> <live-sha>`, then repeat the real browser Save-Data fixture and EventTarget control, all seven Susuki checks, and the footer user path. Change the diagnostic's currently expected-crash assertion to the required intact/static result as part of the regression verification. QA must reject any remaining React console TypeError, removed content, extra static frame or ambient rAF callback.

The 960s command at **.github/workflows/ci.yml:175** also expires in both inspected jobs. First eliminate the three proven assertion crashes and rerun the full suite. Only if a complete failure-free run independently demonstrates a remaining budget problem should CI timing be changed with measured evidence and the surrounding step/job budgets adjusted. Increasing the timeout alone is not a fix for this delivery.

No application source was edited by this QA role. The defect is actionable now; it is not parked behind a future run, unavailable capacity, a board reconciliation or a person-only prerequisite.
