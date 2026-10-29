# t-1768 independent QA — run-9776

**Verdict: fail. Cause: authority.** All fresh task executable checks pass. Acceptance remains unproven because the original protected delivery `author.txt` has not been independently read. Existing operator action **esc-475** expressly requires failing QA until that check can be completed; it supplies no acceptance override. No application change or code fix cycle can repair that authorization.

Delivery and observed deployment: **`017810c694e4e9ea256fc543b3ec213695875cc6`**. Board green gate **`ver-3885`** passes `017810c` with both required commands exiting 0. Fresh production `/api/health`, route `build-sha` metadata and before/after health checks agree on that full SHA. `git merge-base --is-ancestor 017810c694e4e9ea256fc543b3ec213695875cc6 017810c694e4e9ea256fc543b3ec213695875cc6` exits 0; the original executable delivery `f54f160a9e40284090f0332c2f5dca55d147ecfd` is also an ancestor of that deployment (exit 0).

Claim preceded work. Freshly fetched main/local verification base: `ad09e3c520ba978bffd7b486c99cbe4222e898e8`. Task branch: `pm-299-t-1768-qa-run-9776`. Before committing, fast-forwarded this uncommitted branch to freshly fetched main `3cf6d6dd8f1d8b46687b81767263c8c6d91f96ad`; the three intervening commits change only another plan’s QA/fix-plan documents, so executable and test inputs remain identical. No rebase or task work was lost. Only this run's QA documentation, text evidence and probe are changed. No application, test suite, dependency or CI configuration is edited. Repository `AGENTS.md` and installed Next lazy-loading/Server-Client Component guides were read. `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md` are absent. No codebase graph tool was available; source was inspected directly. The board's historical run-9759 reports are absent from this main checkout, so their claims are attributed history, not this run's proof.

## Identity and locked execution

Actual recorded run: profile **`codex-sol-6-1-high`**, model **`gpt-6.1-sol`**, effort **`high`**, native task **`c923af5c-3dcf-408d-ad59-bdaf955b7a8e`**. Linux x64, Node **22.23.3**, fresh `npm ci`, unchanged lock: Next 16.4.2, React 19.3.0, Three 0.186.1, Fiber 9.8.2. These are recorded run flags and installed versions, not inferred defaults. Prior native runs inspected below also record that profile/model/effort; workers differ.

[Real preflight](preflight.json) recomputes all ten source/lock/config hashes and exactly matches executable fingerprint **`d2ebb604525ce8933bbbe3ff088d6532b4a5d3d80e7f0d73a709619ded49c8d6`**. Actual locked Three/Fiber imports and real `ShaderMaterial`, `WebGLRenderTarget` with attached `DepthTexture` construction/disposal pass. This Node check does not create a GL context. Shelf geometry and canvas spine textures are procedural, with no external shelf model/font/texture assets or model hashes. [Build identities](build-identities.json) records local build **`xI72c6VFAlSpLHCF35FYd`**, Git authors, and separate CI-config/lock/Next-config hashes at delivery and local base; the intervening CI-only change does not change the shelf fingerprint.

Git independently confirms **Otohime <quiinthieu@gmail.com>**, with no `Co-Authored-By` trailer, for implementation `e6d0e64c7db356822b0a0522ce18423bb4920510`, executable delivery `f54f160` and current delivery `017810c`. This does **not** substitute for reading `author.txt`. Native task `0671daac-7af4-4d24-8d86-920cecb2f1fb` still lists `author.txt`, **44 bytes**, SHA-256 **`7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`**. Its bytes were neither read nor reconstructed. HTTP 401 is the prior QA observation, not a fresh download result here; the current board answer explicitly says access cannot be provided now.

## Fresh checks

[Verification receipt](verification.txt) retains full shelf TAP, bounded repository/build summaries and static check output. Both contract commands run from the repository root after fresh `npm ci`:

| Check | Observed result |
| --- | --- |
| `shelf-shader-unit` | 16 tests pass, no failures/skips: numerical grazing thresholds and preserved silhouettes, hatching boundaries, debug query/uniform construction, GLSL invariants, isolation and lifecycle assertions. |
| `repo-checks-and-build` | `TMPDIR=/tmp npm test`: **2,795 tests**, two suites, all pass; typecheck passes; lint has zero errors and 13 existing warnings; production build succeeds, **219/219** pages including `/shelf`. Existing Better Auth placeholder/base-URL diagnostics do not fail the build. |
| New QA executable | Locked Playwright import and actual Chrome construction/execution pass. ESLint on the final probe passes. Prebuild-generated `content/history.json` was returned to its initially clean committed bytes. |

The independent [probe](probe.mjs), authored in this QA run, does not rerun the supplied SWE browser script. [Five-group production receipt](browser.json) and [native click receipt](activation.json) use Chrome **156.0.8078.47** and actual ANGLE Vulkan **SwiftShader** WebGL2. Instrumentation preserves the drawing buffer and observes actual linked programs, uniforms, framebuffer bindings, draws and pixels. It does not replace renderer, shaders, scene, raycasting, network delivery or routing. This is real software WebGL execution, not physical-GPU performance proof. Only the explicit no-WebGL negative control returns null from WebGL `getContext`.

| Starting state / action | Observable result |
| --- | --- |
| Desktop `/shelf`, 1366×1100 | HTTP 200; 14 crawlable book links; 958×574 canvas, RGB range 43–242, GL error 0. Real object-hatching, normal and composite programs link with empty logs; observed two offscreen targets plus default framebuffer. |
| Idle / keyboard focus / real pointer hover | Zero additional shelf frames over a driven 90-browser-frame idle sample; focus sync updates the canvas book id and changes rendered pixel hash; real raycast hover updates id and pixels, with spring frames settling. |
| Mobile 390×844, device scale 3, `?outlineDebug=1&kd=2&kn=0.5&ndvCutoff=0.4` | Actual linked uniforms are 2, 0.5, approximately 0.4 and debug=1; DPR caps at **1.5**; **1,779** cyan debug pixels show grazing suppression. Focus and idle assertions pass. |
| Real `WEBGL_lose_context` extension | Shelf falls back to `data-shelf-mode="flat"`; renderer canvas is removed; links remain. No page/console errors. |
| **Negative control:** disable WebGL contexts before hydration | Flat shelf, no renderer canvas, all 14 links, zero shelf/Three bundles. Native keyboard activation reaches **`/articles`** with no errors. A silent missing-renderer success cannot satisfy the positive 3D/program/pixel checks. |
| Reduced motion | Stationary camera pixels after pointer movement; focus still highlights; no idle shelf frames. |
| `/` isolation | Zero shelf/Three bundles among 26 fully captured JS responses. |
| Actual 3D book activation | Native pointer raycast/click on `project-barometer` navigates to **`/barometer`**, whose heading exists. No page/console errors. View Transition animation remains task 5 scope. |

[Bundle correlation](bundle-correlation.json) independently hashes every captured script body before navigation/context close. Both delivered shelf chunk hashes match on each enhanced shelf case: `fbe13d630efdeec60591182f437eb9453713d90920f335852d17da99f0e8798a` and `471cafcd1fb215c2b8129102cd7ac6c3c734822f9a01b7d22003eb30f204d783`. Neither appears on home or in the no-WebGL shelf. Script-body capture is complete for these bounded cases; it is not an exhaustive route audit. Source review confirms explicit FBO/material/texture cleanup and R3F-owned geometry disposal; no exhaustive GPU leak/performance claim is made.

The first QA probe attempt terminated when a response-body promise outlived navigation. That fixture failure is preserved in `verification.txt` and establishes no product result. The corrected listener stops and settles every body promise before navigation, asserts zero capture failures and completes all five groups. The added real activation group also completes. No observed shelf executable defect is hidden behind the artifact blocker.

## Native history, callbacks and CI boundaries

[Platform evidence](platform-evidence.json) records unfiltered native history, two pages per terminal status, offsets **0 and 20**, limit **20**: **40/1,427 FAILED** and **40/4,495 COMPLETED** rows. These are global task histories, not counts of shelf rendering attempts. Both scans are **incomplete**; older unread jobs are inconclusive. Current reads return **4/4 RUNNING** and **1/1 PENDING** rows completely at that instant. This browser renderer submits no remote execution job, capacity request or fake-runtime job. Current unrelated pending work is not shelf delivery proof or an excuse for an observed defect.

The plan's returned t-1768 history has ten runs: six SWE (four succeeded/two failed), two successful verification runs, prior QA failed and this QA running. Direct native task reads supplement the bounded global pages:

| Native task / persisted plan run | Independently read evidence |
| --- | --- |
| `2ed62246-e998-48f1-9817-4df5bfd7a59a` / run-9768 | FAILED; raw tail shows successful branch push followed by deterministic `push_not_on_main` rejection and rescue. Callback delivered once; persisted run fails for the same reason with zero callback-apply failures. |
| `da3e879c-99f6-4319-b51a-c80c3a02d1d4` / run-9771 | COMPLETED; raw terminal tail reports exit 0; persisted run succeeded at `017810c`, callback delivered once, zero apply failures. Current Git and live deployment independently corroborate publication. |
| `0671daac-7af4-4d24-8d86-920cecb2f1fb` / run-9747 | COMPLETED; raw tail shows branch/main publication of `f54f160` and exit 0; callback delivered once; persisted run succeeded, zero apply failures. Its artifact manifest is the source of the protected author requirement. |

Returned log tails contain 1,070 / 1,094 / 645 lines respectively; only terminal publication/failure/exit portions were read for this audit, with final 40 lines retained. Earlier portions and truncated older history are inconclusive. The repeated branch-only publication failures remain recorded defects of those attempts, not shader failures; run-9771's terminal success and live SHA establish the repaired publication. Executable correlation uses immutable source/lock/config and served chunk hashes, not a new documentation SHA alone.

**CI result: unproven here.** The unauthenticated GitHub API returns HTTP 403 (rate limit), the repository registry has no CI token, and fleet-qa cannot read secrets. No authorization boundary was bypassed, no CI rerun was dispatched, and no pending CI job was watched. The passing board green gate is ver-3885; it is not a claim that a GitHub workflow passed. Provider-side production runtime logs were unavailable without provider credentials; the production browser console/page errors and native runner failure tails above were read. No unseen CI failure is classified as environmental or waived. Earlier CI ids `40820018472` / `40820561536` remain historical observations, not current green evidence.

## Delivery state and follow-up

**Integration deployed:** observed exact `017810c`. **Execution demonstrated:** fresh local suites/build/imports and six real deployed browser groups pass. **Waiting for capacity:** none. **Product delivered/accepted:** withheld; mandatory original author artifact is unproven.

Deferred **`t-1768/delivery-author-artifact`**: operator owns granting access or attaching the original 44 bytes; QE owns digest/required identity/no-trailer verification and refreshed current delivery/deployment correlation. Failure condition: unreadable artifact, hash/identity/trailer mismatch, or an unbound deployment. The existing physical chore is **esc-475**, fingerprint `task-artifact-read:0671daac-7af4-4d24-8d86-920cecb2f1fb:author.txt`. Do not infer those bytes or poll the operator. [Fix plan](fix_plan.md) specifies the exact protected resource and resume procedure; no source/CI line change or pipeline rerun is appropriate for this cause.

Deferred **`t-1768/current-ci-and-provider-logs`**: QE owns reading available terminal CI/provider evidence on resumed QA. Failure condition: a relevant terminal failure, missing required successful delivery gate, or runtime error attributable to this executable. GitHub workflow status and provider logs are unproven now; no CI/environment defect or green workflow is inferred from inaccessible evidence. Current required board gate and directly exercised user path pass. Save-Data, exhaustive disposal counters, physical GPU performance and task-5 transitions were not newly exercised or claimed by this run.

Explicit decisions and lessons were recorded. Save this evidence in one owner-authored task-prefixed documentation commit with `[skip ci]`, publish branch/main without force using the established atomic procedure, then run required `git push origin HEAD`. The submitted board report binds the actual pushed QA SHA; it is distinct from the delivery/deployed SHA cited above.
