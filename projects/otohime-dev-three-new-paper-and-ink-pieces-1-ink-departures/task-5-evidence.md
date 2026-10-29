# pm-301 / t-1789 — Ennichi pure core

Run: `run-9713`. Branch: `pm-301-t-1789-ennichi-core`.
Integration base: `b3e3b992a6b3d08311f32482178e0f8a75fa125c` (freshly fetched main).
Delivery identity: the commit enclosing this file; the submitted summary records its immutable `git_sha`.

Implemented `lib/ennichi.ts`, its route-local `_lib/ennichi.ts` re-export, and `lib/ennichi.test.ts`. No dependencies, artwork, route components, browser globals, timers, storage access or audio were added.

The seven fixed motifs have complete display/story/region metadata and disjoint 72-unit hit radii. A 390×260 contain-fit renders each hit diameter as **46.8 CSS pixels**. The plan's minimum radius of 28 alone would render as 18.2px, so radii are deliberately larger. Tests also cover 390×600, 1280×720 and 1280×900. A UI rendered smaller than this minimum fit must enlarge its effective targets.

The four CMYK plates expose resting/hover registration offsets. `getEnnichiPlates(true)` zeros both without mutating the catalog. Viewport `scale` is contain-fit-relative zoom, bounded to [1, 3.5]; `tx`/`ty` and pan/focal inputs are CSS pixels from the viewport origin. For scene point `(x, y)`, rendered position is `(tx + x * fit * scale, ty + y * fit * scale)`, with `fit = min(width / 1200, height / 800)` and transform origin at the top-left. Letterboxed axes remain centered; oversized axes cannot reveal space past their edges. Zoom preserves its focal scene point until clamping is required. Invalid dimensions throw; nonfinite transforms recover and invalid zoom factors are ignored.

Hints choose the nearest unfound motif, breaking ties by catalog order. The ready payload contains only status, ID, direction, stall region and clue; no numeric coordinates. Caller-injected time enforces the four-second cooldown, including timestamp zero and clock rollback. The caller records `lastHintAtMs = nowMs` only after a ready result. Complete progress takes priority over cooldown.

Storage uses `ennichi:v1` and `{ "version": 1, "found": [...] }`. Corrupt JSON, wrong schemas and mixed-type arrays recover to an empty set; unknown string IDs are filtered and duplicates removed. Serialization uses catalog order. Stamp unlock requires membership of all seven real IDs, preventing an unrelated ID from satisfying a size-only check.

Environment: Node `v22.23.3`, npm `10.9.9`, Linux x64; installed Next `16.4.2`, TypeScript `5.9.3` and ESLint `9.39.5` match `package-lock.json`. Existing `node_modules` was used under the contract's installation guard. The actual model and reasoning-effort identifiers are not exposed by repository/runtime metadata; no inferred model profile is claimed.

Read installed Next docs: `01-app/01-getting-started/02-project-structure.md` (route groups/private folders) and `05-server-and-client-components.md` (shared pure modules versus browser APIs). Owner git identity was configured and checked. The referenced extraction document and `docs/claude/software-development.md` are absent; repository `AGENTS.md`, the plan and source/test invariants were used. Decisions and this lesson were recorded through plan-manager.

Verification executed against the real exported modules, including the route-local import, without a fake runner:

```text
$ TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/ennichi.test.ts
# tests 19
# pass 19
# fail 0
# cancelled 0
# skipped 0
# todo 0
exit 0

$ TMPDIR=/tmp npm test
# tests 2768
# suites 2
# pass 2768
# fail 0
# cancelled 0
# skipped 0
# todo 0
exit 0

$ npm run typecheck
> next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
exit 0

$ npm run lint
> eslint
13 problems (0 errors, 13 warnings)
exit 0
```

All lint warnings refer to unchanged files (unused disables/variables and existing `e2e/crumple.test.ts` expressions). `git diff --check` and the staged equivalent also passed.

Negative controls exercise a point just outside each hit disc, arbitrary pan beyond every edge, cooldown immediately before expiry, malformed storage, and six real motif IDs plus an unknown seventh ID. No defects were observed in these checks. These are SWE regression results, not independent QA.

SHA-256 executable/test/lock fingerprints:

```text
381f4fc7d4c70a37a725d31f9039ea22e99a7809e464d0585a98e88a70dd7f08  lib/ennichi.ts
4ac7f5e461a6da477b6faaff7d30d210422025cfc61eb06c996878de4ca38c1a  lib/ennichi.test.ts
a47a7d043fee78bd1faaf5ecd1d21fb17a917f2274bf3b55bd0053d2a7c7e45e  app/(site)/(app)/play/ennichi/_lib/ennichi.ts
9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b  package-lock.json
```

Execution demonstrated: pure core and repository checks ran locally. Integration delivery is the pushed commit on the task branch and main. Integration deployment, production execution and the visitor-facing product are unproven here; Task 6 owns the UI/browser workflow. No capacity deferral or external jobs were created. CI/job history inspected: zero pages/attempts; history completeness is inconclusive. Per the role contract, plan-manager owns CI/green-gate follow-up for this delivery SHA; no pipeline watch or deployed-system probe was performed. CI failure returns the task through that mechanism. Task 6 remains responsible for rendered hit targets, gesture behavior and actual localStorage wiring; failure of those checks must be reported against its delivery.
