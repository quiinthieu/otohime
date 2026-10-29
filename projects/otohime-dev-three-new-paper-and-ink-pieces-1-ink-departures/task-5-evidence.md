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

## Green-gate repair — run-9727

Branch: `pm-301-t-1789-green-gate`, from freshly fetched main `377dfe0`.
The enclosing repair commit is resolved by `run-9727/artifacts/commits.txt`;
the submitted summary records the exact pushed SHA. The preceding sections
describe the original delivery, not this repair's verification totals.

The returned gate `ver-3868` at `42faf51` passed Ennichi 19/19 but failed
repository tests 1/2784. Its worker was `billie-mac`. The native job
`897a7c3b-f086-447c-bcc6-5f8eb6891178` completed with runner exit 0, and its
callback was delivered once and persisted as the failing gate. Native job
completion is not evidence of passing verification. Downloaded and read its
`verification.json` (SHA-256
`68cf5b168cea8739be33cfcb83a698c5f7d84295e276a6a383e210946dac3934`):
each stdout tail is limited to 4096 characters and stderr is empty, so the
original failing assertion cannot be recovered from that artifact.

Unchanged repository tests passed 2784/2784 on Linux Node 22.23.3, both at the
normal checkout and an isolated worktree with `Application Support` in its
path. Running the same suite under Node **22.12.0**, the version observed on
the macOS worker, reproduced one deterministic failure:

```text
not ok 2346 - every listed southern zone is one Intl knows
Got unwanted exception: America/Coyhaique
Actual message: "Invalid time zone specified: America/Coyhaique"
# tests 2784
# pass 2783
# fail 1
```

Node 22.12.0 bundles ICU 76.1 / tzdb 2024b; Node 22.23.3 here bundles ICU 78.3 /
tzdb 2026c. [IANA's 2025b release notes](https://data.iana.org/time-zones/tzdb-2025b/NEWS)
document the new Coyhaique zone. The original macOS assertion remains
unobserved; this is a matching deterministic reproduction, not a claim to
have recovered its lost output.

`lib/seasons.test.ts` now accounts for that exact documented addition only
when the reported host tzdb predates 2025b. All other zones, and Coyhaique on
newer databases, retain strict Intl validation. Missing tzdb metadata also
keeps strict validation. No production module, Ennichi interface, dependency,
lockfile or CI workflow changed.

A new regression injects a RangeError only for Coyhaique and exercises the real
`monthIn`, `resolveSeason`, and pre-paint script at a month boundary: UTC March
selects southern autumn. Controls retain Santiago's February/summer and an
unknown northern zone's spring. A separate mutation in a temporary copy changes
the catalog entry to `America/Coyhaiquee`; the final validator fails with exit
1 on Node 22.12.0, showing that misspelled names are still rejected.

Final local verification of the guarded test bytes:

| Check | Command | Result |
| --- | --- | --- |
| Ennichi contract | `TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/ennichi.test.ts` | exit 0; 19 pass, 0 fail/skip |
| Repository, Node 22.23.3 | `TMPDIR=/tmp npm test` | exit 0; 2785 pass, 0 fail/skip; 43.3s |
| Repository, Node 22.12.0 | `npx --yes --package=node@22.12.0 --call 'TMPDIR=/tmp npm test'` | exit 0; 2785 pass, 0 fail/skip; 44.7s |
| Typecheck | `npm run typecheck` | exit 0; route generation and tsc pass |
| Lint | `npm run lint` | exit 0; 0 errors, 13 existing unrelated warnings |
| Mutation control | final test with misspelled catalog in temporary copy, Node 22.12.0 | expected exit 1; 1 fail, 0 skip |

Installed repository dependencies with `npm ci` from the unchanged lockfile
(522 packages). Node 22.12.0 was fetched at that exact version through npx
without changing repository dependencies. Tests import the real Ennichi core
and route re-export; there are no required model or asset downloads for this
pure core. Only the new fallback regression mocks one Intl capability; the
full old-runtime reproduction uses its actual bundled database. This is SWE
regression evidence, not independent QA or browser execution.

The initial fix passed both full suites but typecheck caught optional
`process.versions.tz` metadata; the final guard fixed TS18048, and both full
suites were rerun with 2785/2785 passing. Raw logs are in
`/shared/artifacts/run-9727/`. The original core/test/re-export/lock fingerprints
listed above are unchanged. Repair fingerprints:

```text
c6a7a691c0ff19fdcc47a98b652cfca26d13bb6cb278ff336719dec8e54aef23  lib/seasons.ts
94150f846dd7b7def2a5c51961be8915b0872dbe12b6bcc4f6e821badd527189  lib/seasons.test.ts
8f9738c8f9cf680970dc8c12c614f3f7a43796e4eac43ecd6f674e4ee9adaacd  package.json
31902b54fba14db30d5a63026588796ddd27599ac76e6660e2c0b3d3ec69ba2d  tsconfig.json
321b992409329951687bbdf81ff936fd317055490a1c438e15a22abfe7f6606d  next.config.ts
```

Bounded history inspection: FAILED offsets 0/20, 40 of 158 records; COMPLETED
offsets 0/20, 40 of 1140/1141 records (a concurrent completion changed the
total); RUNNING offset 0, all 6 records at that snapshot. Global history is
incomplete and mutable, so no exhaustive historical conclusion is claimed.
Inspected the returned gate's native runner tail, artifact and persisted
callback outcome. Correlation uses the actual core, test, configuration and
lock hashes, not unrelated documentation commits.

Optional macOS diagnostic `00c72956-146d-4399-9a62-5076591ab52b` failed before
tests because its harness used Linux's `/shared` path on macOS; its complete
failure artifact was read. Corrected queued diagnostic
`080d807f-3c75-41b1-a249-9526902fca27` was cancelled before execution when the
typecheck guard changed. Replacement `91a06a02-b366-4e33-afb0-98c662c10faa` was
also cancelled while pending: workers reported insufficient memory headroom,
and the completed real Node 22.12.0 regressions already demonstrated the bug
and fix locally. No idle capacity wait, pending diagnostic or operator action
remains; macOS repetition is unproven and is not part of the pure-core contract.

Actual run metadata from `plan_manager_get_run`: profile
`codex-sol-6-1-high`, model `gpt-6.1-sol`, reasoning effort `high`, runner
`fleet`, worker `avietidol-z490`. Owner git identity configured and checked;
installed Next 16.4.2 project-structure, testing and TypeScript guides read.
The referenced extraction and software-development documents remain absent,
and no code knowledge graph tool was available; source was inspected directly.
Judgments and lessons were recorded with plan-manager.

Pure core execution is demonstrated and the compatibility defect is fixed
locally. Product delivery, browser integration and production deployment remain
unproven and belong to Task 6 and platform gates. Plan-manager owns the required
post-push green gate at the summary's SHA; a failing gate returns this task.
This run stops at push and summary without watching CI or deployed systems.
