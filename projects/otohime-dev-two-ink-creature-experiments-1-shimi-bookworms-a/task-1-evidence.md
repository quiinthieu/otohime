# pm-300 / t-1770 — Inkblot model delivery

Run: `run-9670`, software engineer, 2026-10-29. Branch: `pm-300-t-1770-inkblot`.
Base: freshly fetched `origin/main`, `2cc4b041a506d36bcf264c10b6f46fdcebacfb71`.
The delivery commit is the commit containing this file; its resolved SHA is submitted to plan-manager and written to the run's `artifacts/commits.txt`.

Actual run metadata from `plan_manager_get_run(run-9670)`: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, reasoning effort `high`, runner `fleet`, worker `billie-mac`, attempt 1. These are the run's recorded flags, rather than inferred dashboard defaults.

## Implementation and interfaces

- `lib/inkblot.ts` has no imports, DOM access, network calls, runtime assets, or new dependencies. It exports all requested seed, daily-key, geometry, description, reading, and specimen-note functions and their types.
- Lowercase base36 keys accept 1–10 characters. Parsing maps safely representable base36 integers into the uint32 generator domain; formatting emits canonical uint32 base36. Invalid parses return `null`; key validation returns a boolean.
- Daily seeds hash exactly `inkblot:YYYY-MM-DD`. Daily validation checks a real calendar date and the previous/current/next UTC day, including leap days and year boundaries. Invalid daily seed dates throw `RangeError`.
- Geometry uses normalized square-paper coordinates, radians, minor radius `r`, and major radius `r * elongation`. A seeded plate has 8–20 bodies with 1–4 satellite ellipses each. User drops are normalized, finite, clamped, and capped at 48 without mutating inputs.
- Fold output contains adjacent left/right body pairs with mirrored satellite coordinates and angles, followed by self-symmetric crease bridge lobes for bodies at `x >= 0.42`.
- Analysis counts folded lobes (including crease bridges) and mirrored splatters. Density samples the union on a deterministic 32×32 grid, so overlap is counted once. Spread is clipped to paper bounds. Alt text names the seed/daily plate, crease symmetry, lobes, splatters, dominant zone, density, and paper extent; blank paper has its own description.
- Readings use 40 distinct offline interpretation templates and 24 distinct fragments. Visitor words receive NFKC normalization, tag/URL/email/control removal, and word/length bounds, with a nonempty fallback. The disclaimer is exactly `A paper-and-ink toy — not medical or psychological advice.` Three deterministic specimen notes have unique ids/text, nonzero tilt in `[-4, 4]`, hands in `[0, 2]`, and `specimen: true`.
- `app/(site)/(app)/play/inkblot/_lib/blot.ts` re-exports the actual shared model. Its real import and execution are part of the focused tests. No React page, database, migration, or SVG filter rendering is delivered by this task.

## Locked environment and guidance

Final verification uses **Node 22.16.0, npm 10.9.0, ICU 77.1, tz 2025b**, with a fresh `npm ci --no-audit --no-fund` from the unchanged `package-lock.json`. Installed Next is **16.4.2**.

Read the installed Next guides for project structure/private `_lib` folders, server/client components, and testing, including after the lockfile installation. Followed `AGENTS.md`. The referenced `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md` are absent from this checkout and neighboring workspace search; this was recorded as a decision, not treated as a human gate. No codebase graph tool is available, so source inspection was used.

Executable/configuration SHA-256 identities (independent of a report-only commit SHA):

| File | SHA-256 |
| --- | --- |
| `lib/inkblot.ts` | `17618c7a2673ae85e1be9af1ad504aeb2e8e44cee504cafbf720e18b2dd84fc6` |
| `lib/inkblot.test.ts` | `fd6c9c7818df3a499fa203df3abc392ca135c0aca5214fb0b08ed635eb115e4c` |
| route-local `_lib/blot.ts` | `14ff6e83bb3edd8778a961c3fe4ff319295d66a52b0f2c064bbbbfd4a48af382` |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |
| `tsconfig.json` | `31902b54fba14db30d5a63026588796ddd27599ac76e6660e2c0b3d3ec69ba2d` |
| `eslint.config.mjs` | `0afc8d322f1a50fc60b8e79396a2eec3ee4bb802d81e574d4e0589c656ed9b99` |

## Verification

The commands below run inside the pinned Node 22.16.0 environment, selected with `npm exec --yes --package=node@22.16.0 -- bash -c '…'`. This only installs the verification runtime in npm's external cache; it does not alter the project dependencies or lockfile.

```sh
(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/inkblot.test.ts
(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint
```

Both contract commands exited **0**. Final raw result excerpts:

```text
v22.16.0
added 517 packages in 10s

# inkblot-unit
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 295.324125

# npm test
1..2693
# tests 2711
# suites 2
# pass 2711
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 82234.088166

> otohime@0.1.0 typecheck
> next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully

> otohime@0.1.0 lint
> eslint
✖ 11 problems (0 errors, 11 warnings)
```

Lint exited 0. All 11 warnings are in pre-existing unrelated route components and prior project probe scripts; the three new TypeScript modules produced no warning. There is no unresolved failure in the required checks under the final runtime.

The 15 focused tests cover stable hash/PRNG vectors; base36 round trips and rejection; UTC midnight, offsets, leap day and year boundaries; 256 generated seed geometries; immutable normalized drips and the 48-drop cap; exact body/satellite reflection for 64 plates; crease threshold and connectivity; analytical circle area, rotated extents, clipped bounds and overlap density; alt text; all 40 templates and all 24 fragments reached over 2,048 readings; empty/non-Latin/malformed/oversized visitor input; deterministic specimen notes; and actual route-local module imports.

Negative controls include invalid `2026-02-30`, non-leap `2023-02-29`, daily keys two UTC days away, uppercase/whitespace/oversized base36 keys, nonfinite drip inputs, and overlapping circles that would expose additive overcounting. These exercise the real functions without a fake runtime.

Local history: the initial focused run passed 14/15 because a hand-entered expected value for ten-digit base36 reduction was wrong; correcting the fixture to `3104833535` produced 15/15. The first full run on preinstalled Node 22.12.0 passed 2,710/2,711 tests and failed the existing `lib/seasons.test.ts` assertion for `America/Coyhaique` with `RangeError: Invalid time zone specified`. Its ICU 76.1/tz 2024b lacks that zone. It also produced an ESLint dependency engine warning. A direct real `Intl.DateTimeFormat` construction succeeds under Node 22.16.0/ICU 77.1/tz 2025b. The workaround preserves the existing seasons test and repository code; a lesson and approach decision record it.

The complete final local command log is retained in `/tmp/pm-300-t-1770-artifacts/locked-node22.16.0-checks.log`; the initial full run is in `repo-checks.log` beside it. Relevant raw result output is included in this committed evidence. No required focused assertion is skipped.

## Delivery boundary

Execution demonstrated: actual pure-model imports and functions in the locked environment. No fake adapter, browser, model download, background job, queue, callback, or persisted ingestion is involved. Platform FAILED/COMPLETED job pagination is therefore not evidence for this library change and was not inspected; no claim about external execution history is made. Local verification history above covers this run's attempts; unrelated platform history is unproven.

Integration deployed: unobserved. Product delivered: the t-1770 model/test contract only; the complete Inkblot page/API remain tasks 2–3. There is no capacity or operator deferral. CI and any deployed QA remain owned by plan-manager for the pushed delivery SHA; a failed named gate or a returned QA defect is the failure condition. Per the run contract, this run stops at push and does not watch CI or query deployment.

Before commit, `bash scripts/setup-owner-git.sh --check` passed with the verified Otohime owner, staged/working diffs were inspected, and only the four task-owned interfaces were staged.

## Publication recovery — run-9681 (2026-10-29)

This section supersedes the prior run's delivery conclusion. Its feature-branch push succeeded, but the persisted run and raw runner tail ended with `agent_failed: exit 1 class=push_failed marker=push_not_on_main: HEAD 67cb7d226f62 is not on origin/main`. Task Manager task `68497134-1df6-4822-b4dc-0c9bdb87ec4b` records `FAILED`, callback `delivered` in one attempt, and the rescue branch. Plan Manager `run-9670` persisted the same failure. A saved branch alone did not satisfy the runner's integration publication check.

The runner restored clean local `main` at `67cb7d226f6230979657073d7bcc55db386b3a60`; freshly fetched `origin/main` remained its parent `2cc4b041a506d36bcf264c10b6f46fdcebacfb71`. Created task branch `pm-300-t-1770-delivery-run-9681` from that preserved HEAD. No checkout/replay of the rescue, reset, amend or rebase was needed. **Retained all three source/test modules unchanged; dropped nothing.** This run adds only recovery evidence, with a second task-prefixed commit to preserve the rescued commit.

Actual run metadata: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet worker `avietidol-z490`, attempt 2 (from `plan_manager_get_run(run-9681)`). Fresh `npm ci --no-audit --no-fund` installed 522 packages from the unchanged lockfile. Runtime: Node **22.23.3**, npm **10.9.9**, ICU **78.3**, tz **2026c**, Next **16.4.2**. Real `Intl.DateTimeFormat` construction for `America/Coyhaique` succeeds. All six executable/configuration hashes in the original table remain identical; `package.json` SHA-256 is `8f9738c8f9cf680970dc8c12c614f3f7a43796e4eac43ecd6f674e4ee9adaacd`. This report-only delivery does not change the executable fingerprint.

Read `AGENTS.md`, the plan, installed Next project-structure/private-folder, server/client-component and testing guides after lockfile installation. The two standing guidance documents absent from this repository were found and read at `/data/build-worker/repo/mono-v2/projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `/data/build-worker/repo/mono-v2/docs/claude/software-development.md`. Explicit task instructions override their general post-push monitoring and changelog rules: stop at publication, submit the summary, and leave CI/QA to Plan Manager. No graph tool is exposed; direct source inspection was used.

Historical evidence is bounded, not exhaustive: two pages (offsets 0 and 5, limit 5) each of global FAILED and COMPLETED tasks were inspected: **10/1,382 FAILED**, **10/4,665 COMPLETED**. Current jobs: **4/4 RUNNING**, **2/2 PENDING**. The attempted `project_id=otohime` filters returned empty objects and cannot prove absence; the global queries provide the counts above. Prior run/log API tails explicitly truncate earlier lines, so older raw history is inconclusive. The relevant final runner tail, persisted Task Manager failure/callback and Plan Manager run agree on the delivery defect. No pending replacement erases it. No product queue, runtime processor, callback-ingestion adapter, assets or external model exists in this pure library; these platform task callbacks describe orchestration only.

The following contract commands were rerun against the real core and route-local imports with no fake runner or mocks:

```sh
(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/inkblot.test.ts
(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint
```

Complete fresh local logs are in the worker's `shared/artifacts/run-9681/inkblot-unit.log` and `repo-checks.log`; install log is copied alongside them. These artifacts complement the committed result excerpts below. The focused suite exercises all 40 templates and 24 fragments with zero empty slots, 256 seeded plates, exact mirror geometry, UTC/leap-date cases, alt text, specimens and real re-exports. Negative controls include malformed base36, impossible dates, daily dates two days away, nonfinite drips and duplicate-overlap density.

Publication procedure after green checks: `git push origin HEAD` saves the task branch, then normal `git push origin HEAD:main` fast-forwards the exact tested delivery into integration to fix `push_not_on_main`, as in this repository's prior pm-299 recovery. All commits are made on the task branch; no force push. If main rejects a concurrent update, use the explicitly authorized pull/rebase, rerun both contract checks and retry up to three times. Actual publication results/SHA are recorded in the summary and worker `shared/artifacts/commits.txt`.

Execution demonstrated: actual deterministic pure-model functions in a fresh locked install. Integration deployed: unobserved. Product delivery scope: t-1770 library/tests only; page/API completion remains Tasks 2–3. No known model defect, capacity deferral or operator prerequisite is identified by this run. CI/green-gate ownership remains Plan Manager, for t-1770/run-9681 and the reported delivery SHA; a failed named gate or returned QA defect is its failure condition. No pipeline watching or deployed-system checks are performed.

Fresh verification results (both commands exited **0**, no skips):

```text
# inkblot-unit
1..15
# tests 15
# pass 15
# fail 0
# skipped 0
# duration_ms 286.497812

# npm test
1..2693
# tests 2711
# suites 2
# pass 2711
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 37462.19469

> otohime@0.1.0 typecheck
> next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully

> otohime@0.1.0 lint
> eslint
✖ 11 problems (0 errors, 11 warnings)
```

The warnings are the same pre-existing unrelated files as the original delivery. Fresh local verification history is complete: one lockfile install, one passing focused command, one passing repository/typecheck/lint chain. `bash scripts/setup-owner-git.sh --check` passed; working/staged diffs were inspected and only this task evidence update is staged. Original source/test hashes remain unchanged.
