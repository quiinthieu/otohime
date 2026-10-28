# pm-279 / t-1621 independent QA

Run `run-9379`. **QA state: pending deployed integration; local geometry passes.** Delivery: `c1d4726e7a4c049ebeb971911f984fbbc0e355d6` on `main`; green gate passed the three contract checks at this SHA. The commit author and committer are Otohime <quiinthieu@gmail.com>, with no Co-Authored-By trailer. The delivery report records `artifacts/commits.txt` with that SHA and subject; it contains no `author.txt` artifact.

## Verification

| Check | Independent result |
| --- | --- |
| Locked install | `npm ci --ignore-scripts` installed 522 packages from the unchanged lockfile; Node 22.23.3, npm 10.9.9, Next 16.4.2. |
| Sky tests | 10/10 pass, exit 0. |
| Full `npm test` | 2,650/2,650 pass, exit 0, with bundled native-library search path as described below. |
| `npm run typecheck` | Exit 0. |
| Real import and construction | Imported `sky.ts` and published `content/site.ts` in Node's TypeScript-strip environment; three stars fit finite bounds; the sole edge connects notes sharing `data-engineering`. The three actual note radii were 5.4185, 5.432, 5.4365 and brightness values 0.98575, 0.97329, 0.95103 at 2026-10-28. |
| Independent negative control | Constructed an `ink`-only and a `paper`-only pair outside the supplied test script; zero edges. A sparse single note gave one star and zero edges. |
| Live user path | `GET /notes` and `/notes/backfills-are-a-feature` returned 200. `/notes/sky` returned 404, as expected before the separate chart UI task. |

The first local `npm test` returned 2,647 pass and three failures in `lib/e2e-runner.test.ts` and `lib/gate-closure.test.ts`: the installed embedded Postgres binaries could not resolve bundled `libicu*.so.60` and `libpq.so.5` SONAMEs. I created the missing links only inside ignored `node_modules/@embedded-postgres/linux-x64/native/lib`, set `LD_LIBRARY_PATH` to that directory, verified real `postgres` and `initdb` 17.10 imports, and reran the full suite successfully. No tracked application or test file changed. This local package-link issue is not evidence of a delivery defect or CI failure.

## Identities and execution boundary

The SHA-256 executable fingerprint matches the delivered summary: `sky.ts` `b3c5a9391f794b13d29da350f191519a953df9e54f9bd7fd4404cb9f861bc0c4`; `sky.test.ts` `4eb769109e6d7ab7af5702aa908724feee1389fdd7ffcdb0360e97af412c3a91`; `package-lock.json` `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`; `package.json` `8f9738c8f9cf680970dc8c12c614f3f7a43796e4eac43ecd6f674e4ee9adaacd`; `tsconfig.json` `31902b54fba14db30d5a63026588796ddd27599ac76e6660e2c0b3d3ec69ba2d`. There is no artifact or model asset for this pure library.

Actual SWE launch was profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, on fleet worker `avietidol-mac-mini`. This QA run uses profile `codex-sol-medium`, model `gpt-6-sol`, effort `medium`, on `avietidol-z490`. Tests use real module imports and actual published notes; generated test notes are fixtures, and there is no fake execution runner. Geometry execution is demonstrated locally. A library has no runtime adapter, queue, callback or persisted ingestion, so FAILED/COMPLETED job history and pagination counts do not apply.

## Delivery observation

At 2026-10-28 09:34 UTC, `https://otohime.dev/api/health` reported deployed SHA `7d2a49923ebaa4b709e954442729bb0c5617b8f9`, an ancestor of the delivery; `git merge-base --is-ancestor c1d4726 7d2a499` returned 1. Thus production integration of the delivery was not yet demonstrated. GitHub public CI run `40664399593` for `c1d4726` showed **in progress**; checks job `122735129696` and production job `122735131802` were listed. The public Actions list exposed 15 recent runs (one page inspected, earlier pages not scanned); the GitHub API returned 403 due exhausted anonymous rate limit, so raw CI job logs and full FAILED/COMPLETED CI history are unread. The supplied green gate is a pass for the exact delivery SHA, but does not prove production deployment. No raw failure from this executable or CI was observed. These scan limits make unread CI evidence inconclusive.

**Deferred:** `40664399593` production deployment and subsequent health ancestry, owner CI/plan-manager; failure condition is terminal CI failure or live health SHA that still excludes `c1d4726` after successful deployment. The separate interactive chart task owns `/notes/sky` and product delivery; this geometry task does not claim that user experience. No deterministic geometry defect was found.
