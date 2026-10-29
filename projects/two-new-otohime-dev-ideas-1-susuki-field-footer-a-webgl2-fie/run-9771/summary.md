# t-1768 publication recovery — run-9771

The 3D shelf implementation is already delivered in `f54f160a9e40284090f0332c2f5dca55d147ecfd`. This run preserves the recovered authorization handoff and repairs its publication procedure. **t-1768 remains unaccepted** because QA cannot independently verify the protected `author.txt`. No application, dependency, test, or CI configuration change is made.

## Recovery and authority

Claimed t-1768 first. Read repository `AGENTS.md`, the plan's task 4 contract, prior run metadata, native task details and raw runner tails. The referenced chief-of-staff extraction and `docs/claude/software-development.md` files are absent. No codebase knowledge graph is exposed; relevant source and assertion coverage were inspected directly.

The prior run's task `2ed62246-e998-48f1-9817-4df5bfd7a59a` is FAILED. Its [raw runner tail](artifacts/previous-runner-tail.txt) shows a successful feature-branch push followed by `push_not_on_main: HEAD 233a5331f0ae is not on origin/main`. The native callback is delivered in one attempt; persisted plan run-9768 records the same failure and zero callback-apply failures. This is a publication defect, not a shader failure.

The runner already rebased that recovered commit to `b55f39e5e3c81ac26b0d8167d14814fb883c90f0` on local main above `de21b2f064d73255970443844e3b1c0075e1f611`. Fetched origin/main and preserved that state on `pm-299-t-1768-author-recovery-run-9771`, without another checkout of the rescue branch or another rebase. All recovered work is retained; **nothing is dropped**. The unrelated Ink Departures changes are already in the main base and are not edited or restaged. The recovered commit remains intact; the additional recovery commit also carries the required task prefix.

After green local checks, atomically publish the new task branch and fast-forward main with `git push --atomic origin HEAD HEAD:main`, then execute the required `git push origin HEAD`. Atomic publication prevents a partial branch update if concurrent main activity rejects the push; neither ref is forced. The new subject carries `[skip ci]` because esc-475 explicitly prohibits rerunning CI for this authorization gap. No workflow is changed or dispatched, and no CI or deployment is watched. The board summary binds the actual pushed SHA; [commits receipt](artifacts/commits.txt) identifies both recovered and enclosing commits.

## Fresh local checks

Actual run: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet worker `billie-mac`, macOS arm64. Node **22.23.4** is used instead of the lease default 22.12.0 with its known obsolete ICU data. Fresh `npm ci` uses the unchanged lockfile: Next 16.4.2, React 19.3.0, Three 0.186.1, Fiber 9.8.2. No external shelf assets are required; all geometry and spine textures are procedural.

Both contract gates ran from the repository root with `TMPDIR=/tmp`. [Verification receipt](artifacts/verification.txt) preserves complete shelf TAP, the repository summary, static check output, bounded build assertions, import construction and the negative control.

| Check | Observed result |
| --- | --- |
| `shelf-shader-unit` | 16 tests pass; zero failures/skips. Numerical grazing/silhouette, hatching, debug parsing/uniforms, GLSL, import isolation and lifecycle assertions execute. |
| `repo-checks-and-build` | 2,794 repository tests pass, two suites, zero failures/skips; typecheck passes; lint has zero errors and 13 existing warnings; build generates 219/219 static pages including `/shelf`. Build ID: `qNOoCj6eTCrQ5LyAz-GSZ`. Existing Better Auth diagnostics do not fail the build. |
| Real dependency construction | Actual locked Three/Fiber imports resolve. Real `ShaderMaterial`, `WebGLRenderTarget` and attached `DepthTexture` construct and dispose. No WebGL context or rendered pixel is claimed by this check. |
| Executable correlation | All ten source/lock/config hashes match `run-9747/artifacts/executable-fingerprint.json`. Recomputed fingerprint: `d2ebb604525ce8933bbbe3ff088d6532b4a5d3d80e7f0d73a709619ded49c8d6`. Documentation SHAs do not represent executable changes. |
| Negative control | In a temporary copy only, change `SHELF_THRESHOLDS.minNdv` from 0.2 to 0.1. The existing grazing test fails with `ERR_ASSERTION`, actual `0.17999999999999997` versus expected `Infinity`, exit 1. Repository source stays unchanged. This is SWE test-sensitivity evidence, not independent QA. |

Prebuild-regenerated `content/history.json` was returned to its initially clean committed bytes. Build output, binaries and vendor files are excluded from the commit.

## Evidence completeness and unresolved acceptance

[Platform evidence](artifacts/platform-evidence.json) records two bounded native pages each of FAILED and COMPLETED jobs (offsets 0 and 20, limit 20): **40/165 FAILED**, **40/1,145 COMPLETED**. Those histories are incomplete; unread older jobs are inconclusive. All **5/5 RUNNING** jobs were returned. The plan's unfiltered SWE list returns 16 runs, including six for t-1768: three succeeded, two failed, one running. The literal `completed` plan status returns no rows because success is named `succeeded`; no absence is inferred from that empty filter. The successful delivery task `0671daac-7af4-4d24-8d86-920cecb2f1fb` independently persists COMPLETED with a delivered callback and one attempt; its bounded raw tail reports branch/main publication of f54f160 and exit 0. Raw logs are bounded/truncated overall, not a complete historical audit. No remote runtime executable, durable capacity queue job or new callback is submitted by this documentation recovery.

Implementation integration and previous browser execution are historical observations recorded in the earlier evidence. Fresh local assertions, imports and a production build are demonstrated here; no new browser execution, deployed integration or delivered product acceptance is claimed. No capacity is awaited and no executable defect is hidden behind this authorization issue. The earlier independent QA remains responsible for its original browser proof boundaries.

`esc-475` records an answer that access cannot be provided now, not successful access or an acceptance override. Do not reconstruct the protected artifact from Git author, its manifest digest or another task's matching metadata. No artifact request, repeated escalation or operator polling is performed.

Deferred check **`t-1768/delivery-author-artifact`**: the human operator must grant QA read access to task `0671daac-7af4-4d24-8d86-920cecb2f1fb/artifacts/author.txt` or attach its exact **44 bytes**. QA must independently verify SHA-256 **`7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`**, required Otohime identity and absence of `Co-Authored-By`, then rerun current delivered-SHA/deployment checks. Failure condition: unreadable bytes, a hash/identity/trailer mismatch, or unbound current delivery/deployment. Passing local gates or earlier deployed browser checks cannot waive it. No fresh CI result is observed. Independent t-1766 repair remains outside this task.
