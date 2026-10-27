# Complete production browser recovery — pm-259/t-1625

Run `run-9205`, engineering on `main`, base `8b9826587572145c935e52d41b652938e48a2116`.
Actual run profile: `codex-sol-6-1-high`; model `gpt-6.1-sol`, reasoning `high`,
fleet worker `avietidol-z490` (run metadata and actual runner flags, not current defaults).
This is local execution evidence. Deployment and independent live acceptance remain the platform's responsibility.

## Repair and positive contract

Fresh origin/main matched the checkout. Read AGENTS.md and installed Next 16.4.2 guides
`01-app/02-guides/testing/playwright.md` and `01-app/02-guides/lazy-loading.md`.
The requested extraction document and `docs/claude/software-development.md` are absent here;
the present plan and task contract govern. No person-only prerequisite was needed.
All landed Kame, peel, fetch, Peek, footer and motion implementation was preserved.
A normal pull/rebase later incorporated report-only commits `15bb2ac` and `4da200b`;
the complete final contract runs again on base `4da200bff320a802a2ea48ac354fac1bdef46e92`.

Observed defect: `e2e/print-runs.test.ts:214` skipped its hydration matrix unless screenshot
output was requested. The new regression failed on that exact skip before repair
([red output](run-9205/artifacts/recovery-red.json)). The hydration assertions now run for
all three colored runs across every root and the global 404. Only screenshot writes are optional.
Removed the pre-existing 400ms delay: hydration is observed directly. A real browser DOM
negative control changes the current run to `house`, requires the same observer to fail,
restores the run, and requires it to pass again.

Run the entire positive contract with:

```sh
node scripts/verify-browser-recovery.mjs /tmp/browser-recovery
```

It executes seven named tests, each running its real contract command before validating output.
It sets `CI=true`, `TMPDIR=/tmp`, `GITHUB_SHA=HEAD`, clears nested `NODE_TEST_CONTEXT`, and
unsets BASE_URL/SKIP_BUILD/DATABASE_URL/EXPECT_SHA for isolated production commands.
Missing/renamed tests, zero tests, nonzero command exits, skips, cancellations, TODOs,
probe count mismatches and missing probe assertions fail. Foundation includes the five
already landed `lib/kame-fetch.test.ts` tests, giving the required 21 rather than the
16 selected by the original board command. The browser validator requires all 173 literal
source test names and at least 187 total tests, including parameterized cases; 28 feature
tests cannot satisfy it. Static tools have no TAP names: their positive contract requires
successful lint and typecheck commands plus ESLint, Next type generation and TypeScript
command/completion identities. This is static analysis, not browser proof.

Validator fixtures deliberately remove assertions, rename tests, corrupt counters, add
skip directives and force exit 7 for each relevant check. These are fake output fixtures,
not application execution. The validator additionally accepts the real full browser log
and rejects its removed hydration name and injected skipped count. Node escapes `#` in
TAP names (`\\#section`); result-name decoding preserves the actual assertion and skip checks.

## Locked real environment

`npm ci` installed the unchanged lock on Node **22.23.3**, npm **10.9.9**, Linux x64.
Actual Google Chrome **154.0.8037.57** through locked playwright-core **1.64.0**;
Next **16.4.2**; embedded-postgres **17.10.0-beta.17**, native PostgreSQL **17.10**.
[Native preflight](run-9205/artifacts/native-preflight.json) constructs a real browser/context,
measures an actual heading rectangle, executes sharp's native SVG-to-PNG pipeline in memory,
and constructs pg.Client and EmbeddedPostgres. The production runner actually initializes
and starts native Postgres, creates the database, applies Drizzle migrations, builds Next,
starts production and exercises HTTP/auth/browser behavior. No browser/database substitute
was used for those checks. Existing explicitly labeled fake inference/WebSocket/adapter
fixtures retain their limited boundaries; they do not prove external camera/model services.
There is no queued runtime, model job, callback or persisted ingestion output in this task.

Initial native production build ID: `P7ZeONv7zlOzqH80pY4FR`; initial full run: **187/187**,
zero failures/skips, 402460ms. This run started before the new evidence driver existed;
the repaired print-run test was loaded and executed in it. Final isolated build IDs and
command/log hashes are recorded by the final driver receipts; code/lock/config identities
are in the fingerprint manifest. Build-time GITHUB_SHA names the precommit HEAD; file
hashes identify the actual tested delivery source rather than treating an unrelated SHA as proof.

## Complete execution before the first push

Before the final rebase, actual command results were 21 foundation tests, 2515 repository
tests, lint/typecheck, 187 browser tests, 67 footer-walk assertions, 171 footer-Chrome
assertions and 356 signed-in-motion assertions, all passing with zero skipped tests.
The first driver process retained its pre-fix TAP parser in memory, so its evidence
assertion was red on the escaped Peeks name despite its child browser command passing.
Corrected output validation passes seven named checks
([saved-output validation only](run-9205/artifacts/pre-rebase-output-validation.log)).
The final driver reruns the actual commands after rebase; its fresh results are recorded below.

| Check | Observed result | Local build ID |
| --- | --- | --- |
| foundation policy | 21 tests passed; zero skipped | — |
| repository suite under CI | 2515 tests passed; zero skipped | — |
| lint and type contracts | lint/typecheck passed; 0 errors, 10 existing lint warnings | — |
| entire isolated production browser suite | 187 tests passed; zero skipped | ehhLbrpO805A63Y39kR83 |
| isolated footer walk | 67 assertions passed | 7kGsrM1ikQ_fE0edyed3X |
| isolated footer Chrome probe | 171 assertions passed | jFeL0ThpwuNBhIKPTeH9T |
| isolated signed-in motion | 356 assertions passed | iphTNF7dx80qGbz3iWaPg |

## Historical evidence and delivery boundary

Fresh API reads of FAILED pages 1/2, COMPLETED pages 1/2, current in-progress/queued,
raw job 121649860247 and run 40346324813 jobs returned HTTP 403 (API rate limit).
Public Actions pages recovered bounded history: FAILED **50/141** across two pages;
COMPLETED **50/506** across two pages; current in-progress **0**, queued **0**.
Filters overlap and older pages/raw tails remain unread: history completeness is **inconclusive**.
[History snapshot](run-9205/artifacts/history.json), [public annotation excerpts](run-9205/artifacts/annotations.json).

Historical job 121649860247 publicly identifies `e2e/ink-radio.test.ts:39`: a regex expected
literal text immediately inside h2 and rejected the Riso heading. Main already has the
bounded heading-source fix; the local complete suite passes it. Footer job 121654087754
in run 40346324813 exposes only `Footer walk` exit 1; its raw failing assertion remains unread.
No guessed application change was made for it. Both footer-heading browser modes pass locally.

Current pre-delivery run 40478220840 / checks 122101643247 succeeded on ancestor `103f0c5`.
The most recent failed run 40474532913 / checks 122089383442 also succeeded; its production
122096077381 failed Vercel identity inspection (`User not found (404)`). These are different
executables/configurations, not this delivery's CI result and not an acceptance waiver.

Engineering stops at the push. Platform CI owns the pushed delivery checks and production;
platform independent QA/acceptance owns served-SHA ancestry, live native gestures and product
delivery. Failure condition: any red/skipped/missing delivery gate, stale served executable,
lost content/accessibility, broken geometry/native navigation or missing live output rejects
acceptance. No pipeline watching, deployed-system testing, capacity wait or operator polling
was performed by this engineering run.

First complete real driver: **7/7 named checks passed**, zero failures/skips, 739818ms
([driver output](run-9205/artifacts/contract.log), [receipts](run-9205/artifacts/verification.json)).
[Complete browser output](run-9205/artifacts/browser-output.json) retains all original UTF-8
lines including Next progress carriage returns; joining `lines` reconstructs the exact bytes
and `sha256` / receipt `log_sha256`. The red regression uses the same lossless JSON format.
Other command logs are stored unchanged alongside the receipts. No local contract output was truncated.

First complete-run source/config/lock fingerprint: `2feedcad207d4cb4787151d0d40d97934fde5f7a3a8b2437c349ad7e5009c1e9`
([per-file code, native binary, asset and compiled-build hashes](run-9205/artifacts/fingerprints.json)).
Locked assets also pass the real vendor integrity check. Additional installed versions:
TypeScript 5.9.3, ESLint 9.39.5, pg 8.23.1, sharp 0.35.5.
Generated `content/history.json` is restored before commit; its tested build-output hash
is recorded separately. All committed application and test source matches the tested source
fingerprint; subsequent changes only finalize this evidence archive.

The original board `expect=exit0` fields have no engineering edit operation. The executable
seven-check contract and named repository controls provide positive assertions for each;
the decision log records the board limitation and static-tool boundary.

## Delivery after non-fast-forward retry 1

The first push was rejected because main advanced. A normal pull/rebase preserved
the incoming `cf9e3e5` palace audio back/forward-cache fix and reports through `b4e142a`.
The entire real contract reran on tested commit `1f04569f061d4e8c251a55ee1d4637fdabc638e5`.
This supersedes the earlier executable fingerprint for final delivery; only evidence
finalization is amended afterward. All source/config/lock bytes remain those tested.

| Check | Observed result | Local build ID |
| --- | --- | --- |
| foundation policy | 21 tests passed; zero skipped | — |
| repository suite under CI | 2516 tests passed; zero skipped | — |
| lint and type contracts | lint/typecheck passed | — |
| entire isolated production browser suite | 187 tests passed; zero skipped | NN0eSkmXRqnucq8ncOSEi |
| isolated footer walk | 67 assertions passed | xu4Z8mt3rjBiZ-9aQRaVF |
| isolated footer Chrome probe | 171 assertions passed | lMiP9CmsaPn8PnFJCeDD2 |
| isolated signed-in motion | 356 assertions passed | l35S5m5AjXuNmyoWJLHzD |

All **7/7 named real checks** passed with zero failures/skips.
[Fresh driver output](run-9205/artifacts/rebase-1/contract.log),
[receipts and raw-output hashes](run-9205/artifacts/rebase-1/verification.json),
[complete browser output](run-9205/artifacts/rebase-1/browser-output.json),
[executable/build/asset fingerprint](run-9205/artifacts/rebase-1/fingerprints.json).
Source fingerprint: `f506ae5186a044576773a2315c90e9fe4d9deb780852f046fe89d3ea92ec54fd`.
No tests were skipped and no source assertion, runner floor or native-input contract was weakened.
Delivery CI and independent live QA remain platform-owned; they were not watched here.

## Delivery after non-fast-forward retry 2

A push was rejected because main advanced. Normal pull/rebase preserved all incoming work.
The palace audio fix `cf9e3e5` remains intact; retry 2 incorporates the report-only
`6809e82` QA commit without changing application/config/lock source.
The entire real contract reran on tested commit `d202a538c5e90d0b20a654e29008b380502f1fe4`.
This supersedes the earlier executable fingerprint for final delivery; only evidence
finalization is amended afterward. All source/config/lock bytes remain those tested.

| Check | Observed result | Local build ID |
| --- | --- | --- |
| foundation policy | 21 tests passed; zero skipped | — |
| repository suite under CI | 2516 tests passed; zero skipped | — |
| lint and type contracts | lint/typecheck passed | — |
| entire isolated production browser suite | 187 tests passed; zero skipped | Gb6Mse9lPBLQ90rELtjgQ |
| isolated footer walk | 67 assertions passed | 56fIBbHrfg7Z_E3BCCcpI |
| isolated footer Chrome probe | 171 assertions passed | J1caB1ghQG-QdDEAtHHeg |
| isolated signed-in motion | 356 assertions passed | b_ZSwrSuhEMwK48fmE3zF |

All **7/7 named real checks** passed with zero failures/skips.
[Fresh driver output](run-9205/artifacts/rebase-2/contract.log),
[receipts and raw-output hashes](run-9205/artifacts/rebase-2/verification.json),
[complete browser output](run-9205/artifacts/rebase-2/browser-output.json),
[executable/build/asset fingerprint](run-9205/artifacts/rebase-2/fingerprints.json).
Source fingerprint: `f506ae5186a044576773a2315c90e9fe4d9deb780852f046fe89d3ea92ec54fd`.
No tests were skipped and no source assertion, runner floor or native-input contract was weakened.
Delivery CI and independent live QA remain platform-owned; they were not watched here.

## Delivery after non-fast-forward retry 3

A push was rejected because main advanced. Normal pull/rebase preserved all incoming work.
The palace audio fix `cf9e3e5` remains intact; retry 2 incorporates the report-only
`6809e82` QA commit without changing application/config/lock source.
The entire real contract reran on tested commit `b155d9a97615d04b429b0b9d692e1e57fd67127f`.
This supersedes the earlier executable fingerprint for final delivery; only evidence
finalization is amended afterward. All source/config/lock bytes remain those tested.

| Check | Observed result | Local build ID |
| --- | --- | --- |
| foundation policy | 21 tests passed; zero skipped | — |
| repository suite under CI | 2519 tests passed; zero skipped | — |
| lint and type contracts | lint/typecheck passed | — |
| entire isolated production browser suite | 187 tests passed; zero skipped | WpgxLbV_yOIrGkT40ri09 |
| isolated footer walk | 67 assertions passed | fz3nMS98e24m_SJzkU7IG |
| isolated footer Chrome probe | 171 assertions passed | iIApxjFkpDcN-9s9HVDbZ |
| isolated signed-in motion | 356 assertions passed | _TLNpz_PzMtAUQ0v1qYyI |

All **7/7 named real checks** passed with zero failures/skips.
[Fresh driver output](run-9205/artifacts/rebase-3/contract.log),
[receipts and raw-output hashes](run-9205/artifacts/rebase-3/verification.json),
[complete browser output](run-9205/artifacts/rebase-3/browser-output.json),
[executable/build/asset fingerprint](run-9205/artifacts/rebase-3/fingerprints.json).
Source fingerprint: `1268e9ebe2be70d2b2e622f2d5bd45107064a79af85d22f0fb80902869d465bd`.
No tests were skipped and no source assertion, runner floor or native-input contract was weakened.
Delivery CI and independent live QA remain platform-owned; they were not watched here.

## Main integration infrastructure failure

All four `git push origin HEAD` attempts to main were rejected non-fast-forward.
The three authorized normal rebase retries each reran the full real contract green.
Latest rejected main candidate: `755b6716ecc4a764efde7ea208c0f2c8be5d6bd3`.
The retry cap is exhausted; no force push or further main rebase was attempted.
The tested source and complete evidence are saved on `pm-259/t-1625-run-9205`.
This branch preserves the work and **does not satisfy required main delivery**.
Platform pm-259/t-1625 owns integration/relaunch, then delivery CI and independent live QA.
Failure remains until main contains this implementation and its gates/live acceptance pass.
No person-only operator action or capacity wait is involved.
