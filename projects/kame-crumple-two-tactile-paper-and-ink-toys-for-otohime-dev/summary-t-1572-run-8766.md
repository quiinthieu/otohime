# t-1572 delivery summary

Plan pm-259 · Run run-8766 · Software engineer · 2026-10-26.
Actual run profile: `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet runner (run record).
Delivery SHA is the pushed commit containing this report, pinned by the summary's `git_sha` and artifacts/commits.txt.

Implemented reversible, seeded paper-corner peeling on every project Cartridge and public note. A single load/idle-gated browser adapter owns the pointer, renders real accessible margin text and keyboard controls, preserves original content/links/geometry, restores route state on reload and clears it on departure. Save-Data is on demand, reduced motion is instant, and teardown handles captures, listeners, observers and page lifecycle. The shared pure registry/session/gesture interfaces and their future hold/fetch/crumple vocabulary are documented in [tactile-contract.md](tactile-contract.md).

## Verification at the delivered executable

| Contract command | Result |
| --- | --- |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/tactile.test.ts lib/tear.test.ts` | Exit 0, 9/9 tests |
| `npm test` | Exit 0, 2053/2053 tests, no skips |
| `npm run lint && npm run typecheck` | Exit 0; lint has 10 existing warnings, no errors |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/tactile-tear.test.ts` | Exit 0; final retry adds `e2e/kame.test.ts`: 16/16 tests (8 tear + 8 Kame), no skips; includes production build and isolated migrated Postgres |

Locked preflight used `npm ci`, Node 22.23.3, npm 10.9.9, Next 16.4.2, Playwright 1.64.0 and Chrome 154.0.8037.57. The real renderer imports and constructs successfully in the production browser. No new dependency, asset download, backend endpoint or root layout was added.

Executable fingerprint (SHA-256 of sorted source path + NUL + bytes + NUL, paths in fingerprint.json): `2f40747f8be05866fa1f8fa4a5655b26a7957c2947cb2d1b0cd0e8cb2c077962`.
Lock SHA-256: `2d0ec0bea389a532592da1c7a96f8eb6452a90f055fa37cebb8a39d771791a8b`.
Production Next build id: `3Dttird1xWbhDHv4LrzKA`; build meta is `dev` in the local runner, so the build/source/chunk fingerprints identify this execution.
Renderer chunk: `.next/static/chunks/3ivipg5og5g1o.js`, SHA-256 `e395cdaa7a627c687ca55dfc98b21b3335f95f62dde0e63262bfb98ed9e0ebec`.

Evidence artifacts: pure, repository, lint, typecheck and production-browser logs; fingerprint.json; commits.txt. Additional merged-base Kame browser suite: exit 0, 8/8 tests. Source and Markdown are committed; generated build output remains outside git.

## Walkthrough and negative controls

- No-JS project/notes HTML retains readable content and working ordinary links; no paper UI appears in parsed server HTML.
- Keyboard Peel corner / Reset reveal real margin text and restore the same card; x/y/width/height stay within 1px. Seeded geometry survives reload. Next navigation removes the departed route's session state.
- Real mouse drags peel. Wrong-pointer cancel cannot take ownership. Pointercancel, lost capture, Escape and blur restore cosmetics. Pagehide removes UI/capture/listeners while retaining committed session data; pageshow restores exactly one adapter.
- Blocked sessionStorage leaves usable operations. Reduced motion and live preference changes retain instant recovery. Save-Data downloads no renderer until the enable action.
- Actual renderer response bytes prove no import before load/idle and no renderer preload in server HTML. The held-idle test injects only scheduler policy, then permits the real production import.
- Real CDP touch input scrolls a measured card-body point outside the handle; explicit corner touches peel. Mobile notes support tap/reset without permanent control rows covering intact neighboring notes.
- Existing desktop Ink Desk and stamp-board drags still move/stamp their own items and receive no paper controls.

Pure tests fake clock/seed/storage. Browser fixtures inject storage denial, Save-Data, media preference, lifecycle/cancel events and the idle scheduler. Production React, CSS, DOM, dynamic imports, pointer capture, navigation, mouse and touch execution are real. This is SWE evidence; independent QA remains owned by plan-manager.

## Rescue, defects and delivery boundary

Retained all implementation from rescue `64188ad`; no feature files were discarded. Reproduced its production failure (`CLIENT_HOOK_DYNAMIC` on `/admin/users/[id]`) and fixed the required null Suspense boundary. Relocated feature CSS out of the root-palette imports, repaired early React navigation cleanup and pointer ownership, prevented adjacent control overlap, removed permanent touch overlays and disabled cartridge lift only while using toy controls. Updated the exact root-mount test to permit this one loader while retaining season-first ordering. Corrected the rescued pagehide expectation (teardown removes attributes) and the fixed-coordinate touch negative control (it had hit a handle).

Prior run run-8763 ended at model capacity. Its supplied tail and bounded run log were inspected; those logs are incomplete and cannot prove a prior browser pass. No external executable jobs, model runtime queue or ingestion callbacks exist for this browser feature, so paginated FAILED/COMPLETED runtime history is not applicable. Local failure logs are preserved and final deterministic failures are resolved.

Execution demonstrated: local production build/browser. Integration deployed: not claimed. Source delivery: commit/push for t-1572. CI/deployed product acceptance: pending platform green gate and independent QA for this pushed SHA; owner plan-manager, task t-1572, run run-8766. The first push was rejected because pm-259/t-1573 landed as `dd21add`. Rebased without force, preserved both lazy loaders and merged the exact mount assertion. Removed a duplicate Suspense import caught by the rebuilt production gate; reran all four contract commands and the Kame browser suite on this combined build. A second rejection brought documentation-only base `f6ebc8e`; that rebase was clean, all four checks were rerun, and the combined tear/Kame browser runner passed 16/16. No pipeline id/result was observed before the required stop-at-push boundary. A failed CI/build/deployment or deployed walkthrough must return this task for repair. No operator action or capacity prerequisite is outstanding. Kame is independently delivered by t-1573 and preserved from the new base. Fetch, crumple/basket and final performance budgets remain later task scope.
