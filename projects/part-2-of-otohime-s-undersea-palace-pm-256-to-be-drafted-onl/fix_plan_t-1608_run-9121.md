# t-1608 fix plan — G9121-1

**Cause: code.** The delivered optional `/api/ghosts` request adds a contract-required 404 on Home.
The existing repository browser gate rejects its resource-console error. GitHub run **40433812567**,
checks job **121957596650**, fails E2E; independent local production reproduction fails **3/5** Riso tests
at delivery **ebbb06d09e6030f6a56b323247e879efdb76fcb6**. This is not runner failure or a board precondition.

Change **e2e/riso-headings.test.ts:21**, the error collector used by assertions at lines **87, 110, 155**.
Reconcile only an independently verified **404 response at the exact same-origin `/api/ghosts` path** with
the disabled feature contract. Preserve the empty no-store 404 in `app/api/ghosts/route.ts:6` and the
404-to-null behavior at `ghosts/canvas.tsx:20`. Keep every unexpected resource/console error and pageerror
failing. Do not blanket-ignore 404 messages, network failures, same-text application errors or all ghost errors.

Declare a small response-aware console classification interface before implementing it, preferably in an
E2E helper shared with this suite. Verify response URL, status and the matching resource-console event;
do not classify using only generic message text. Add negative controls for another missing resource,
same-path 500 and ordinary application `console.error`; all must remain unexpected. Keep all heading,
hydration, motion and isolation assertions. A deliberate fixture may isolate unrelated Riso behavior only
if separate real-route disabled-fallback coverage still runs and the same negative controls remain strict.

Reproduction and source evidence: [raw local failure](t-1608/run-9121/riso-e2e.log),
[native CI annotations](t-1608/run-9121/delivery-annotations.json),
[independent console URLs](t-1608/run-9121/browser-results.json).

The repair contract preserves all four original checks and adds the browser checks that exposed the gap:

```json
{
  "problem": "Disabled ghost configuration is safe in the product but breaks the existing strict Riso console gate.",
  "action_items": [
    "Declare and test a response-aware expected-disabled-config resource classifier; retain unrelated-error detection.",
    "Reconcile e2e/riso-headings.test.ts:21 with only the exact required /api/ghosts 404 and preserve all existing assertions.",
    "Prove real production disabled/configured behavior and negative controls; run every original verification and the browser gate.",
    "Commit and push; QA rechecks the resulting CI and actual deployed ancestry rather than a queued production job."
  ],
  "interfaces": "e2e/riso-headings.test.ts:21; a narrowly scoped E2E console helper/tests if needed; projects/part-2-of-otohime-s-undersea-palace-pm-256-to-be-drafted-onl/",
  "non_goals": ["Changing the required disabled 404 contract", "Blanket console-error suppression", "Cloudflare production activation"],
  "verification": [
    {"name":"Client and config behaviors","cwd":".","cmd":"node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test ghosts/client.test.ts ghosts/config.test.ts","expect":"exit0","timeout_s":300},
    {"name":"Project tests","cwd":".","cmd":"npm test","expect":"exit0","timeout_s":300},
    {"name":"Lint","cwd":".","cmd":"npm run lint","expect":"exit0","timeout_s":300},
    {"name":"Production build","cwd":".","cmd":"npm run build","expect":"exit0","timeout_s":900},
    {"name":"Riso browser regression","cwd":".","cmd":"TMPDIR=/tmp SKIP_BUILD=1 node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/riso-headings.test.ts","expect":"exit0","timeout_s":300},
    {"name":"Full existing browser gate","cwd":".","cmd":"TMPDIR=/tmp SKIP_BUILD=1 npm run test:e2e","expect":"exit0","timeout_s":900}
  ]
}
```

Own the repair as **pm-257/t-1608**, commit with an imperative subject such as
`pm-257/t-1608: Reconcile disabled ghost configuration with console checks`, then `git push origin HEAD`.
An E2E/helper source change triggers the existing `.github/workflows/ci.yml` push gate; no runner/configuration
repair or credential chore is required. On a rejected push, rebase and rerun the checks before pushing again.
SWE reports its tested push; independent QA must observe green native checks, a deployed SHA containing the
repair, the real no-store fallback, and the targeted negative controls before accepting. The current live
`4c9f325` does not contain the delivery; publication alone is not deployment.

Additional baseline defect **G9121-2**, owned for follow-up by **t-1610 SWE/QA**: rapid synthetic double
activation of the theme control emits an unhandled skipped-transition AbortError on both the delivered
test UI and public pre-delivery `4c9f325` with zero ghost layers. Inspect **components/theme-toggle.tsx:71**,
which chains `finished.finally` without handling a rejected transition. A separate, scoped theme repair
must consume expected skipped-transition cancellation and preserve valid theme application/cleanup;
prove it using overlapping native transitions and retain unexpected-error checks. Do not silently hide
this baseline defect in the ghost test collector. The normal source push runs the existing CI gate.
It remains an explicit open baseline defect rather than being called an environment issue or ghost repair.
