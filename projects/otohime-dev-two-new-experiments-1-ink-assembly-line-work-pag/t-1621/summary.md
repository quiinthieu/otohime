# pm-279 / t-1621 — Deterministic sky geometry

Run: `run-9375`. Delivery branch: `pm-279/t-1621-sky-geometry`.
The submitted plan-manager summary supplies the pushed commit SHA and generated
`artifacts/commits.txt` contents, which are available only after committing.

`buildSky(notes, referenceDate)` returns serializable chart bounds, stars,
shared-tag edges and named constellations. The explicit reference date must be
a valid UTC calendar date (`YYYY-MM-DD`). There is no wall-clock fallback or
randomness. The delivered `Note` shape is accepted directly, including readonly
collections; sparse notes need only a valid slug.

Slug-seeded grid placement is independent of input order, note edits and the
reference date. A changed slug set may reflow the chart. The canvas starts at
960×640 and grows for dense collections to retain at least 48 units between
centers, above the maximum 28-unit star diameter. Body length sets radius from
5 to 14, reaching its cap at 2,000 UTF-16 code units. Age fades brightness from
1 to a visible 0.35 over 730 days. Future notes cap at 1; missing or invalid
dates use 0.35. Invalid reference dates throw rather than silently using today.

Tags are trimmed, deduplicated and sorted. Each shared tag gets a deterministic
playful name and a chain of its members, with every edge carrying that shared
tag. Untagged notes and singleton tags generate no edges or constellations.
Malformed entries without usable slugs are skipped; duplicate identities select
the first canonical normalized record, independent of input order.

The existing `app/(site)/(app)/notes/_lib/*.test.ts` glob already registers the
new tests in `npm test`, so `package.json` needs no change. No dependencies,
content, UI or delivery configuration changed.

## Verification

All commands ran from the checkout root with Node **22.23.3**, npm **10.9.9**,
installed Next **16.4.2** and TypeScript **5.9.3**. The actual agent launch used
`gpt-6.1-sol` with `model_reasoning_effort=high`.

| Check | Result |
| --- | --- |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(site)/(app)/notes/_lib/sky.test.ts'` | Exit 0; 10 passed |
| `npm test` | Exit 0; 2,650 passed; zero failures or skips |
| `npm run typecheck` | Exit 0; Next route types generated and TypeScript passed |
| Targeted ESLint for `sky.ts` and `sky.test.ts` | Exit 0 |
| `git diff --check` | Exit 0 |
| `bash scripts/setup-owner-git.sh --check` | Exit 0; effective Otohime identity |

Tests cover repeatability, input and tag order, immutable inputs, empty/single/
published three-note skies, all-pairs spacing for 1,000 maximum-sized stars,
absolute clamped size/age scales, future/invalid/leap dates, naming, malformed
and sparse records, duplicate identities and timezone equality in real Node
subprocesses (`Pacific/Honolulu` and `Asia/Ho_Chi_Minh`). Negative controls verify
that unrelated tags and untagged pairs cannot generate constellation lines.

A separate real Node import of `sky.ts` and `content/site.ts` constructed the
published chart: three stars in 960×640 and one `data-engineering` edge, named
**The Sleepy Umbrella**. It also verified an unrelated-tag pair produces zero
edges. Geometry has no runtime adapter, model or asset dependency; there is no
fake runner in this smoke check. Unit-only generated note fixtures are not
claims about published content or browser behavior.

## Executable fingerprint and boundaries

SHA-256 identities checked before delivery:

| Input | SHA-256 |
| --- | --- |
| `sky.ts` | `b3c5a9391f794b13d29da350f191519a953df9e54f9bd7fd4404cb9f861bc0c4` |
| `sky.test.ts` | `4eb769109e6d7ab7af5702aa908724feee1389fdd7ffcdb0360e97af412c3a91` |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |
| `package.json` | `8f9738c8f9cf680970dc8c12c614f3f7a43796e4eac43ecd6f674e4ee9adaacd` |
| `tsconfig.json` | `31902b54fba14db30d5a63026588796ddd27599ac76e6660e2c0b3d3ec69ba2d` |

Execution is demonstrated locally for this pure geometry contract. No UI or
deployment is claimed. No defects remain in the checks above. This executable
has no asynchronous job queue, callback or persisted ingestion; FAILED/COMPLETED
execution history counts and pagination completeness do not apply. CI and
deployment history were not inspected, as required by the stop-at-push contract.
Plan-manager owns the subsequent green gate and independent QA for
`pm-279/t-1621` at the submitted SHA; a failed required check returns the task.
The interactive chart remains a separate plan task.

Installed Next private-folder, server/client and view-transition guidance was
read before editing, together with the delivered note shape. The requested
chief-of-staff and `docs/claude/software-development.md` files are absent, as
already documented in the plan; AGENTS.md and the build contract were followed.
Decisions and a lesson were recorded with plan-manager: `Date.parse` silently
rolls April 31 to May 1, so the parser verifies its UTC round trip before using
a date for brightness.
