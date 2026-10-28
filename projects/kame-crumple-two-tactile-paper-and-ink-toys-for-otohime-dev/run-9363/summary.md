# pm-274/t-1585 delivery

Implemented bounded paper-ball tossing and Iron flat on branch `pm-274-t-1585-basket`. The enclosing delivery commit is identified by the summary report's git_sha; artifacts/commits.txt provides a stable Git resolution command.

The pure port now simulates circle/rim collision at 120Hz, detects downward opening entry, applies gravity/friction/bounded restitution, clamps deltas and velocity, sleeps at rest and terminates at 5000ms active time. At most eight fold/ball slots and DPR2 remain enforced. The ink footer SVG reserves its layout slot. Ball grips capture native mouse/touch through the shared gesture owner; keyboard Toss targets the measured basket and places directly when offscreen without scrolling. Reduced motion places instantly. Hit state is transient and source content remains accessible.

Iron flat cancels fetch/fold/flight, clears every registered tear/session state and proxy, restores paint/focus and runs one 420ms sweep. Per-card Read/Reset affect their source only. Lifecycle interruption, source removal and renderer failure release resources; pagehide teardown and repeated pageshow avoid duplicate mounts. Kame identity, streak, dismissal and footer controls remain independent. recovery-contract.md documents ownership and coordinates.

## Observed local verification

- Physics and shared lifecycle: **20 passed**, zero failed/skipped.
- Repository: **2630 passed**, zero failed/skipped.
- ESLint: **zero errors**, ten existing warnings; Next route type generation and TypeScript passed.
- Real production browser: **39 passed**, zero failed/skipped. Native basket hit/rim miss, touch flick, keyboard/offscreen/reduced placement, per-card isolation, full fold/fetch/flight reset, lifecycle recovery, source/accessibility/geometry, footer navigation and shell/name/dismissal all asserted.
- Visual inspection: the local native-pointer basket-hit screenshot showed the ink ball inside the basket, with Iron flat, footer links and shell controls visibly separate. The screenshot is verification-only and not committed as a binary.

Node22.23.3, locked Next16.4.2/Playwright1.64.0, Chromium156.0.8078.48 and actual embedded PostgreSQL17 migrations/build/start constructed successfully. The existing unrelated Ghosts service uses its repository fake; Canvas, physics, pointer input and app rendering are real. Injected browser time drives flight tests; CSS sweep is observed through animationend. Exact source, lock, config, task chunk, test hashes and local build id are in artifacts/fingerprints.json. The build's automatic history fallback rewrite was restored to its original bytes; no generated application output or binary is part of delivery.

Actual run metadata: run-9363 profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, read from plan_manager_list_runs profile_flags. No alternate/default profile inferred.

Negative controls include a real rim miss against the same visible basket, pure rim-versus-opening trajectories, invalid clocks/deltas, forced sustained energy at the deadline and retained blocked renderer/Canvas failure controls. Initial extra-Canvas conflict was fixed with a released snapshot image. Source-id selectors account for reparenting; JS fake time does not stand in for compositor completion. These judgments and a lesson were recorded with plan-manager.

## Delivery boundary

Execution is demonstrated locally. CI integration, deployed execution and product delivery remain unobserved. There is no remote compute queue/model/callback ingestion history for this browser feature. FAILED/COMPLETED/current CI history was not inspected because the explicit task contract ends engineering at push; history completeness is unclaimed. No pipeline or deployed-system polling occurred. No capacity deferral or operator prerequisite was needed.

Platform green gate owns exact delivery CI and integration for t-1585; any red required check or absent integration fails it. Independent QA/acceptance owns the deployed basket, negative control, recovery and served ancestry; stale/missing delivery or input/content regressions fail it. No known local executable defect remains. The referenced extraction and software-development documents were absent; AGENTS.md, installed Next lazy-loading/client guides and the explicit task contract were used, with that limitation recorded.
