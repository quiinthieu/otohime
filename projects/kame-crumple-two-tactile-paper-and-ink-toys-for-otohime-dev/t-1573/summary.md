# Kame delivery — t-1573 / run-8768

Actual run profile: `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet Linux lease. Delivery commit: resolve `git_sha` from the submitted summary report (also the commit containing this file). Branch: `main`, as supplied by the runner. No branch checkout or initial rebase was performed.

## Result

Retained all 14 rescued paths from `dc746a2`, completed the missing Kame integration contract, and repaired first-paint positioning and reduced-motion resize. The browser adapter now applies its cached position when the sprite mounts and keeps the sleeping corner inside a resized viewport. The footer probe includes Kame's real Tab stops and scrolls its mascot stage into view before pointer sampling in the taller footer. No assertions were removed. No tactile/fetch-drag integration, dependency, media file, server tracking or independent root layout was added.

Kame loads after window load and idle; Save-Data requires explicit enabling. The ink turtle swims/naps/follows, accepts 500ms keyboard/touch pet holds, persists bounded local name/streak/dismissal and restores from the footer shell. Reduced motion retains static sleeping responses and controls. Modal/visibility/cancellation teardown and the existing sound switch gate the shared-context quiet bounded purr. The local command port is documented in `../kame-contract.md` for task 3.

## Local execution evidence

Locked environment: `npm ci`, Node `22.23.3`, Next `16.4.2`, React `19.3.0`, playwright-core `1.64.0`; real embedded Postgres 17, migrations, production `next build` and `next start`. Browser: Chromium `156.0.8078.4`. Final production build id: `OxGZrlX6IxLovYRzr5n1w`; build-sha metadata was `dc746a2` (the pre-delivery rescue HEAD), with the final executable working tree identified by `artifacts/executable.sha256` and `artifacts/build-chunks.sha256`. Documentation and probe changes do not alter this renderer fingerprint.

| Required verification | Result |
| --- | --- |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/kame.test.ts lib/sound.test.ts` | 19 passed, zero skipped |
| `npm test` | 2,044 passed, zero skipped |
| `npm run lint && npm run typecheck` | exit 0; 10 pre-existing lint warnings, zero errors |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/kame.test.ts` | production build and all 8 browser tests passed, zero skipped |

Additional CI footer checks on the same production renderer: `scripts/walk-end.sh` passed 65/65; `scripts/probe-end.sh` passed 169/169. Both ran with a local `BASE_URL` and `EXPECT_SHA` matching the build metadata, against the e2e runner's disposable migrated database. The setup used `SKIP_BUILD=1 node ... scripts/e2e.mjs /tmp/kame-footer-check.mjs`, whose wrapper sequentially ran those two bash scripts with the runner-supplied environment. This exercises CI's external-server mode locally. Evidence is in `artifacts/footer.log`.

The footer probe initially failed two pointer checks because the sticky masthead intercepted stage corners. Centering the stage fixed hit targeting. Its document-wide rAF counter then also counted Kame's setup-scroll placement; draining setup frames before measuring restored the original <=1 pointer-frame assertion. The zero-idle-work assertion and all eye-motion bounds remain unchanged and passed.

The browser tests execute actual renderer imports, SVG/CSS animation, keyboard press/release, CDP touch hold/cancel, localStorage, live motion preference changes, dialog pause, focus recovery and real Web Audio node construction/disconnection. Elapsed/calendar/idle callbacks and document visibility use explicit browser fixtures; pure sound tests use fake audio nodes. These boundaries are not claims of audible-output quality or an operating-system tab lifecycle.

Negative controls: typing K inside Name does not call Kame; sound-off creates zero purr oscillators; withholding the idle callback leaves the renderer absent; no-JavaScript public links and normal footer navigation work. New geometry assertions failed the rescued renderer (6/8 passed, 2/8 failed; initial x=0 rather than 1232) and pass after the fix. Calendar fixtures cover same-day visits, day-three greetings, missed/future/malformed records and local date boundaries. No 45-second wall-clock wait or natural-event soak was used.

## History and delivery boundary

Inspected the task record (no earlier reports or green/red gates) and the bounded raw log tail of prior failed run `run-8764` / task-manager `d3133670-fcdd-4712-8637-3470dc32c653`: it ended on selected-model capacity errors during browser validation and published the rescue branch. This is one known failed prior attempt, zero prior completed reports; the log is a tail, not a claim of complete platform history. External executable job queues/callbacks are inapplicable to this browser-only feature. No rescued work was dropped.

Execution is demonstrated locally. Integration deployment and product acceptance are unobserved here. CI and deployed QA are deferred to plan-manager's green gate for `pm-259/t-1573`, keyed to the submitted delivery SHA; the gate owner must return any failed build/job or mismatched deployed executable. No pipeline watching or deployed-system checks are performed by this run. Combined-toy budgets and independent product acceptance remain the plan's later tasks/gates. No known application defect remains from this run.
