# t-1621 QA — run-9381

Verdict: **pending deployed integration**. The pure sky geometry executes correctly in this checkout, but a deployed QA pass cannot be cited yet.

## Identities and scope

- Delivery: `c1d4726e7a4c049ebeb971911f984fbbc0e355d6`, authored and committed by `Otohime <quiinthieu@gmail.com>` with no coauthor trailer. Its parent is `00e48d6`; it is contained in `origin/main` as checked with `git merge-base --is-ancestor`.
- Current production `/api/health`: `7d2a49923ebaa4b709e954442729bb0c5617b8f9`. `git merge-base --is-ancestor c1d4726 7d2a499` exits 1. This is earlier deployed integration, not the geometry delivery.
- Delivery green gate: plan-manager `ver-3725` for `c1d4726`, pass. GitHub Actions CI run [40664399593](https://github.com/quiinthieu/otohime/actions/runs/40664399593), `checks` job `122735129696`, remained in progress at the final observation; build, typecheck, unit, migration, and artifact steps passed, while E2E was in progress. This does not establish a completed CI or deployment.
- Delivery author run `run-9376` recorded profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`. This QA run `run-9381` records profile `codex-sol-medium`, model `gpt-6-sol`, effort `medium` on `avietidol-mac-mini`. The previous QA run `run-9379` had the latter model and was rejected by the delivery runner as `push_not_on_main` after its topic-only report push.

## Execution and independent checks

- `npm ci` installed the unchanged lockfile in Node `22.23.3` / npm `10.9.9`; installed Next is `16.4.2`. Read its route-group guidance. The requested chief-of-staff and `docs/claude/software-development.md` files are absent in this checkout.
- Required sky test: 10 pass, 0 fail. `npm test`: 2,650 pass, 0 fail at delivery base; after fast-forwarding this QA branch to `eedd36a`, the full suite passed again with 2,652 pass, 0 fail. `npm run typecheck`: pass at both bases. `bash scripts/setup-owner-git.sh --check`: pass.
- Independently imported the real `sky.ts` and `content/site.ts` modules under the locked install, then constructed the chart from the three published notes at explicit date `2026-10-28`: three stars and one `data-engineering` edge, named `The Sleepy Umbrella`. This directly exercises the changed executable; there is no runtime adapter, model, downloaded asset, fake runner, callback, queue, or persisted ingestion for this pure function.
- Independent negative control: two notes tagged `ink` and `paper` yielded zero edges; invalid `2026-04-31` yielded the visible `0.35` brightness floor. The delivered test file also checks order, repeatability, bounds, size scaling, sparse inputs, and timezones.
- Fingerprint SHA-256: `sky.ts` `b3c5a9391f794b13d29da350f191519a953df9e54f9bd7fd4404cb9f861bc0c4`; `sky.test.ts` `4eb769109e6d7ab7af5702aa908724feee1389fdd7ffcdb0360e97af412c3a91`; `package.json` `8f9738c8f9cf680970dc8c12c614f3f7a43796e4eac43ecd6f674e4ee9adaacd`; lockfile `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`; `tsconfig.json` `31902b54fba14db30d5a63026588796ddd27599ac76e6660e2c0b3d3ec69ba2d`. No artifact or model hash applies.

## Deployed path and history limits

- Production `/notes` and `/notes/backfills-are-a-feature` returned HTTP 200. `/notes/sky` returned 404 because that UI belongs to later task t-1622; it is not a defect in this geometry-only contract. The production responses do not exercise `c1d4726`.
- Bounded GitHub Actions history scan: first 10 of 564 runs; two in progress, three recent completed failures, and five completed successes/skips. The delivery fingerprint has one observed CI run, `40664399593`, in progress. The last green production run was `40657712570` at `7d2a499`; the adjacent prior failed run `40662170532` at `00e48d6` had `Footer walk` fail. `git log 7d2a499..c1d4726 -- .github/workflows` returned no CI configuration changes. The public raw job log endpoint returned HTTP 403, so that failure tail and older history remain unread and inconclusive. No FAILED/COMPLETED job pagination or callback history applies to the pure sky executable.
- No observed geometry defect. Deferred check: `pm-279/t-1621@c1d4726` deployment and production ancestry, owned by the plan-manager delivery/QA continuation; it fails if the eventual deployed SHA excludes `c1d4726` or independent production checks fail. CI `40664399593` / job `122735129696` is owned by GitHub Actions; its E2E result and production deployment were unobserved at report time. A queued or in-progress run does not prove product delivery. The interactive `/notes/sky` product remains task t-1622.
