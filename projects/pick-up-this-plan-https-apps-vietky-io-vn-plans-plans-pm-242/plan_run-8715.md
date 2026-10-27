# Keyless Pocket Presence

Plan: pm-258 · idea-254 · product-owner recovery run run-8715 (supersedes run-8712 delivery)

Repository baseline: 2a58479b90339ca0d5519c89c6e0c16a58753c08 · 2026-10-26
Source: [rep-5070 preserved verbatim](research.md) and [pm-242](https://apps.vietky.io.vn/plans/plans/pm-242).

## Product outcome and scope

Visitors can read the owner's public listening or gaming presence in the existing /music cassette and game cartridge without adding deployment keys or secrets. ListenBrainz is the music provider; Lanyard is the optional game provider. All eleven other delivered pm-242 outcomes stay outside this work. The original Spotify/Steam adapters remain available as explicitly configured alternatives.

The immediately deliverable outcome is a deployed, verified keyless integration with honest defaults and safe failure behavior. A personalized live owner track/game is a separate observable outcome: absent an owner-provided public identifier and feed, it is **undelivered**, even if integration checks pass. Never substitute an unrelated public account into production or claim a fixture is live. Account setup is advisory and does not block the build or core capability acceptance.

## Evidence and policy inputs

- Research rep-5070 found pm-242 abandoned after 12/12 completed tasks; eleven visitor ideas worked and live Now Playing remained quiet behind Spotify/Steam secrets. Its provider probes belong to that research run and are not execution evidence from this planning run.
- Recovery run independently read five recent main run summaries and job-step listings for two completed failures: [40277024423](https://github.com/quiinthieu/otohime/actions/runs/40277024423) at 76141f1 failed E2E against next start; [40275822192](https://github.com/quiinthieu/otohime/actions/runs/40275822192) at 7041d7f failed Footer Chromium probe. Both skipped production. Run 40277523350 at the current baseline 2a58479 was in progress at inspection. This is one bounded summary page, not complete history. Both raw checks-log requests returned HTTP 403, so the exact assertions are inconclusive. Task 1 owns diagnosis and repair of both known gate failures, and checks whether the new baseline already corrected either.
- Installed locked dependencies with npm ci. Recovery preflight at 76141f1: npm test passed 1,968 tests with zero failed/skipped; lint passed with 10 warnings; typecheck passed. Delivery checks are repeated after integrating concurrent main changes and recorded in the summary report. No feature implementation or live-provider execution is claimed by this document.
- AGENTS.md applies. The referenced projects/20260921222547_plan_manager_chief_of_staff_extraction.md and docs/claude/software-development.md are absent from this checkout and lease-home search; an attempted upstream lookup was unavailable. Their contents have not been read or inferred. The explicit user role/build-contract rules govern this plan; the missing-policy lesson is recorded on the board.
- Read installed Next 16.4.2 guides for connection() and cacheLife. Preserve request-time provider reads and cacheLife inside the existing use-cache function. The connection guide now prefers io() for some Cache Components cases, but real-request-only reads remain intentional here; do not perform an unrelated API migration.
- Provider primary references: [ListenBrainz core read endpoints](https://listenbrainz.readthedocs.io/en/latest/users/api/core.html) describe current and latest listens; [Lanyard documentation](https://github.com/Phineas/lanyard) describes its opt-in public presence API. A documented public endpoint does not prove an owner account is configured.

## Architecture and interfaces

Extend lib/now-playing.ts and its pure parser/sanitizer module, not a parallel reader. Keep GET /api/now-playing always 200 for provider failure, with no-store response headers, and retain the shared server-rendered /music shelf. Preserve the single cached reader with stale=30, revalidate=60, expire=300; this is request-driven caching, not a schedule. On-demand GET is the production trigger; fixtures and a controlled cache clock prove refresh immediately.

Add music and play objects with source (listenbrainz|spotify|null and lanyard|steam|null respectively) and state (off|quiet|live|fixture). Keep spotify, steam, track, game and readAt. Legacy provider fields describe only the adapter actually read; selected track/game are identified by music/play. Unselected adapters remain off and need not make requests. A configured ListenBrainz/Lanyard source takes priority over Spotify/Steam; failure stays quiet rather than silently changing attribution. A valid real empty response can be live with null data; live means the selected real endpoint answered validly, not that something is playing.

Extend Track with a sanitized listenedAt timestamp for a past ListenBrainz listen. Playing-now has no listened_at; only a valid actual track enables reels. Last-listen labels include full UTC date and time so an old record cannot look current. Keep caps (title/artists 64, game 48), text-only rendering, strict HTTPS public-link hosts and encoded username path segments.

Use server-owned content/now-playing.ts for optional public identifier defaults (initially empty), overridable by LISTENBRAINZ_USER and LANYARD_USER_ID. Never accept provider URLs or identities from an HTTP caller. Host overrides are test-only loopback origins, reject credentials/path tricks and redirects, and can never produce live state. Provider errors, HTML gateway challenges, malformed payloads and aborts produce quiet output without exception details. A partial ListenBrainz success may display a valid last listen, never infer current playback from history.

No cron, OAuth, scrape, new paid service, bot token, new infrastructure, or durable compute queue is needed. Two ListenBrainz requests may occur per cache read; rate/caching claims are per cache instance, not a global once-per-minute guarantee across a serverless fleet. Keyed credentials must stay server-only and never enter HTML, RSC, client chunks or logs.

## Order, size and ownership

Three software-engineer tasks, ordered 1 → 2 → 3, because provider/API/UI/walk interfaces overlap and a red deploy gate must be repaired first. Each has qa=required. The platform supplies task QA and final acceptance; duplicating those as build tasks would add no product change.

Settings read this run: max_plan_elapsed=24h, max_live_runs_per_plan=3, qa_mode=auto. With the fallback one-hour role duration, overlapping/serial tasks total 3h and longest dependency path 3h. The server uses its current learned p50 on proposal admission. If refused for size, split at task boundaries, propose the first admissible part here, and file later parts with after_plan_id chaining rather than parent_plan_id.

The product owner writes this document, preserves research, records decisions, runs repository tests, commits and pushes documentation on main, confirms the delivery commit is on origin/main, then proposes these exact contracts with the delivery SHA and product title. No task claim belongs to this role. The software engineers stop at tested pushes; deployment evidence comes from the gate and independent QA.

## Build contracts

The machine-readable equivalent is [tasks.json](tasks.json). Verification runs inside the delivery checkout and touches only isolated local fixtures/databases, never shared infrastructure. Build/probe commands may perform their own bounded readiness checks for processes they just started; no contract relies on elapsed time, a natural refresh, an operator response or another plan's work.

### 1. Restore the deployment checks gate

**Role:** software_engineer · **Depends on:** none · **QA:** required

**Problem:** Main has observed E2E and Footer Chromium probe failures, so checks blocks production and keyless presence cannot deploy. The latest baseline may have changed either failure and must be reproduced before choosing a repair.

**Action items:**

- Inspect current and bounded paginated completed/failed GitHub Actions history around c38f72a through the delivery base, including 40277024423 (E2E) and 40275822192 (footer). Read raw failure tails where accessible and reproduce each remaining failure against a production build with a throwaway local database. Diagnose the assertion and correlate relevant code/lock/configuration fingerprints; a later SHA alone is not evidence of a fix. Record exact run ids, inspected counts and any unavailable/truncated evidence.
- Fix the smallest E2E behavior, footer behavior or objectively incorrect probe assumption responsible, preserving the public-page, keyboard, reduced-motion, contrast and negative-control coverage. Add a focused regression for each actual defect; do not skip a gate, relax correct thresholds or alter unrelated feature work. If a failure is already corrected at the delivery base, cite the actual assertion passing rather than duplicate the repair.
- Make the existing footer walk and browser probe run with an isolated local database on supported leases, reusing the embedded-postgres lifecycle in scripts/e2e.mjs when Docker is unavailable if needed. Clean up only PIDs and database files created by this run.
- Run the verification commands and push the focused repair. CI/deployment evidence is evaluated by the green gate and QA; do not add a staging mutation or a deployment wait to this build task.

**Interfaces:** `components/end-footer.tsx`; `components/end-stage.tsx`; `lib/end.ts`; `lib/end.test.ts`; `app/(site)/globals.css`; `scripts/walk-end.sh`; `scripts/probe-end.sh`; `scripts/probe-end.mjs`; `scripts/e2e.mjs`; `e2e/`.

**Non-goals:** Redesigning the footer; Deleting or disabling the CI gate; New providers or owner account setup; Repairing unrelated abandoned plans.

**Acceptance:** The observed E2E and footer gate failures are diagnosed and each remaining defect is reproduced and corrected; application E2E, the original footer walk and Chromium matrix pass against the delivery build with a regression/negative control that detects each repaired defect. The green gate must pass before the platform marks the task delivered; production deployment remains gated by checks.

**Verification:** each command runs at repository root, expects exit 0.

| Check | Command | Timeout |
| --- | --- | --- |
| Project tests | `npm test` | 300s |
| Lint | `npm run lint` | 300s |
| Typecheck | `npm run typecheck` | 300s |
| Build | `npm run build` | 600s |
| Footer HTTP walk | `SKIP_BUILD=1 bash scripts/walk-end.sh` | 900s |
| Footer Chromium matrix | `SKIP_BUILD=1 bash scripts/probe-end.sh` | 900s |
| Application end to end | `SKIP_BUILD=1 npm run test:e2e` | 900s |

### 2. Read the cassette from ListenBrainz

**Role:** software_engineer · **Depends on:** 1 · **QA:** required

**Problem:** The music cassette requires Spotify secrets and only shows its quiet face; a public ListenBrainz account can supply current or last-listened music without deployment secrets.

**Action items:**

- Implement pure unknown-input ListenBrainz parsers and fixtures, capped/clean display strings, a validated listenedAt ISO timestamp for last listens, and HTTPS link allowlisting. Distinguish a valid empty payload from malformed JSON, HTML challenges and error shapes.
- Add validated LISTENBRAINZ_USER configuration with an optional server-owned public default in content/now-playing.ts (empty until the operator supplies an identity); environment configuration takes precedence. Encode the username as one path segment. Never select an unrelated person's account as the production default. No owner chore is needed to implement or verify this task.
- Read playing-now and listens?count=1 concurrently under one 4-second abort budget, with User-Agent otohime.dev/1.0 (+https://otohime.dev), Accept application/json, and no retries. A valid playing-now listen wins; otherwise show a valid last listen with its full UTC date/time and stationary reels. Neither endpoint being usable yields quiet. Reject redirects and unapproved hosts; loopback-only NOW_PLAYING_LISTENBRAINZ_HOST yields fixture state.
- Add source metadata music/play without removing spotify/steam/track/game/readAt; extend sanitize and every UI/API consumer consistently. Select ListenBrainz when configured, otherwise Spotify; failures of a configured selected provider stay quiet. Legacy adapter states identify only adapters actually read; never mark a fixture or a different source spotify-live. Introduce the empty play metadata now, preserving Steam as the game source until task 3.
- Render per-source side labels, public profile/track links and provider credits; retain the playlist and static game quiet faces, no-JS HTML, keyboard affordances, long-label bounds, reduced-motion behavior and original keyed-provider support.
- Keep readNowPlaying as the shared server-only use-cache reader with cacheLife stale 30/revalidate 60/expire 300; callers still await connection(). No provider reads at build and no background schedule. Extend loopback fakes and clock-controlled HTTP/browser walks for current, last, old last-listen, empty, 404, 429, HTML, bad JSON, unsafe URLs, timeouts, one-endpoint failure, missing/invalid configuration, source selection and sentinel scans. Prove no provider requests during a build in a fixture build check inside the HTTP walk, even with SKIP_BUILD=1 on the outer walk.
- Document public configuration and owner feed setup as advisory, with the live-connector uncertainty from research; update .env.example and README, and regenerate public/ask-index.json with npm run ask:index when indexed copy changes. Preserve the real/fake distinction and report no live owner output unless observed.

**Interfaces:** `lib/now-playing.ts`; `lib/now-playing-data.ts`; `lib/now-playing.test.ts`; `lib/now-playing-data.test.ts`; `components/cassette.tsx`; `content/site.ts`; `content/now-playing.ts`; `app/api/now-playing/route.ts`; `app/(site)/(app)/music/page.tsx`; `app/(site)/globals.css`; `scripts/walk-now-playing.sh`; `scripts/probe-cassette.sh`; `scripts/probe-cassette.mjs`; `.env.example`; `README.md`; `public/ask-index.json`.

**Non-goals:** Creating a ListenBrainz account or uploading listens; OAuth or keys in the deployment; Lanyard music fallback; Cron jobs or polling services; Claiming the owner is playing a sampled public user's track.

**Acceptance:** On-demand GET /api/now-playing and /music use the same cached selected reading: a valid current ListenBrainz fixture shows its credited track and spinning reels, a last listen shows its full UTC timestamp and still reels, and failures return HTTP 200 with honest quiet content. Fixtures are labelled fixture, the default with no account is off, legacy adapters work when selected, public links are safe, and an instrumented build makes zero provider requests. Owner account setup is advisory and does not gate integration delivery.

**Verification:** each command runs at repository root, expects exit 0.

| Check | Command | Timeout |
| --- | --- | --- |
| Project tests | `npm test` | 300s |
| Lint | `npm run lint` | 300s |
| Typecheck | `npm run typecheck` | 300s |
| Build | `npm run build` | 600s |
| Search content index | `npm run ask:check` | 300s |
| Provider HTTP contract | `SKIP_BUILD=1 bash scripts/walk-now-playing.sh` | 900s |
| Cassette browser matrix | `SKIP_BUILD=1 bash scripts/probe-cassette.sh` | 900s |
| Reduced motion | `SKIP_BUILD=1 bash scripts/probe-motion.sh` | 900s |
| Application end to end | `SKIP_BUILD=1 npm run test:e2e` | 900s |

### 3. Read optional games from Lanyard

**Role:** software_engineer · **Depends on:** 2 · **QA:** required

**Problem:** The game cartridge still needs a Steam key, while optional Lanyard public Discord presence can identify the current game without a deployment secret.

**Action items:**

- Add a pure Lanyard parser taking unknown, requiring success:true and a valid data.activities array; use the first type===0 activity with a valid capped game name. Ignore Spotify-only, custom-status, streaming and malformed activities, strip control characters, and retain no Discord profile/avatar/friend identifiers in the public result.
- Validate LANYARD_USER_ID as a 17-20 digit snowflake with the same environment-over-server-public-default configuration path from task 2; default empty. Add a 4-second server-only request, meaningful User-Agent, JSON validation and no retry. Reject redirects; NOW_PLAYING_LANYARD_HOST remains loopback-only and always fixture-labelled.
- Select Lanyard when configured, otherwise Steam. Valid empty activities produce live-with-no-game (fixture for a fake); unknown/unmonitored user, error status, HTML, malformed response and timeout produce quiet. Keep music independent and keep configured-provider failures quiet instead of switching providers.
- Extend play source metadata, sanitized API result and per-source cartridge/credit copy. Lanyard games have no invented Steam/store URL. Preserve the static Now-list fallback, existing Steam path, no-JS rendering, readable long names, mobile layout, keyboard and reduced motion.
- Extend captured fixtures and the existing HTTP/browser walks for a type-0 game, no game, Spotify-only presence, user_not_monitored, invalid/overlong fields, HTML, 429, abort, missing/invalid identifiers and mixed-provider isolation. Retain the instrumented no-fetch-at-build check and credential sentinel scan; update README/.env.example and regenerate the search index if needed.
- Run the build-contract verification and push. Leave owner Discord joining/identity personalization advisory to the post-build activation check; no person-only prerequisite is required for these tests.

**Interfaces:** `lib/now-playing.ts`; `lib/now-playing-data.ts`; `lib/now-playing.test.ts`; `lib/now-playing-data.test.ts`; `content/now-playing.ts`; `content/site.ts`; `components/cassette.tsx`; `scripts/walk-now-playing.sh`; `scripts/probe-cassette.sh`; `scripts/probe-cassette.mjs`; `.env.example`; `README.md`; `public/ask-index.json`.

**Non-goals:** Discord bot hosting or tokens; Lanyard Spotify fallback; Steam XML scraping; A service-availability SLA; Account joining as a build prerequisite.

**Acceptance:** With the on-demand loopback Lanyard fixture selected, GET /api/now-playing and /music agree on the credited game with no invented store link and a fixture state. Empty, unknown, malformed or timed-out presence degrades honestly without changing the music reading. With no public identifier the default stays off; the Steam fallback works when selected. Independent QA verifies the delivery SHA and a relevant negative control. Personalized live presence is reported separately from integration proof.

**Verification:** each command runs at repository root, expects exit 0.

| Check | Command | Timeout |
| --- | --- | --- |
| Project tests | `npm test` | 300s |
| Lint | `npm run lint` | 300s |
| Typecheck | `npm run typecheck` | 300s |
| Build | `npm run build` | 600s |
| Search content index | `npm run ask:check` | 300s |
| Provider HTTP contract | `SKIP_BUILD=1 bash scripts/walk-now-playing.sh` | 900s |
| Cassette browser matrix | `SKIP_BUILD=1 bash scripts/probe-cassette.sh` | 900s |
| Reduced motion | `SKIP_BUILD=1 bash scripts/probe-motion.sh` | 900s |
| Application end to end | `SKIP_BUILD=1 npm run test:e2e` | 900s |

## Independent QA and acceptance

QA obtains the deployed build-sha and the gate result independently; reports cite the delivery SHA and relevant code/lock/configuration/fixture fingerprints. Do not use a new documentation SHA to dismiss a deterministic executable failure.

| Starting state | On-demand action | Observable result / proof |
| --- | --- | --- |
| Gate repair build | Run application E2E and footer matrix with real browser and isolated DB | Each original failing assertion passes; reintroducing a repaired defect in an isolated local copy makes its regression fail. Production checks/deploy jobs are inspected by exact SHA. |
| All provider config absent | GET /api/now-playing; open /music with JS on/off | Always 200, sources off, playlist/static game face, no provider requests, no misleading live text. |
| Loopback current ListenBrainz | GET API then /music against a delivery build | Matching track/source/readAt, fixture state, bounded labels, correct credit, safe link, reels only when playing. |
| Loopback last/old listen | Trigger same read with controlled cache clock | Full UTC timestamp, still reels, no current-playback claim. No real-time sleep. |
| Lanyard type-0 activity | Trigger same selected reader | Fixture game/source agrees with page; music independent; no fabricated Steam URL. |
| Error/empty/HTML/429/timeout/unsafe URL | Trigger fixtures and inspect API plus browser | Empty valid response and failed response remain distinguishable; failures are quiet, links safe, the other provider still works. |
| Configured legacy provider only | Trigger existing keyed-provider fakes | Previous Spotify/Steam path works, sentinels absent from HTML/RSC/assets/logs, selected-source metadata truthful. |
| Desktop/mobile, light/dark, no JS, reduced motion | Independent browser walkthrough at 1366 and 390 | No overflow/layout jump, readable contrast, keyboard link/focus works, credits remain, motion stops as specified. |
| Fresh production build | GET /api/now-playing and /music, compare build-sha | Actual deployed integration and quiet/live state reported independently; never apply loopback host overrides to production. |
| Owner public identity supplied | GET real public endpoint and production trigger | Only an observed matching owner reading counts as personalized live delivery; otherwise explicitly undelivered. |

A role rerunning the supplied walk alone is not independent proof. QA independently checks browser DOM/network and API responses, supplies one separate malformed/wrong-type response, and uses a relevant negative control (for example, unsafe-link acceptance must fail when an allowlist is bypassed in an isolated local copy). Restore the local mutation before reporting; never deploy it. Retain existing footer/cassette controls as additional evidence.

Execution evidence reports separate integration deployed, execution demonstrated against fakes, any real provider read, and personalized product output delivered. No GPU/runtime or capacity deferral applies. Inspect bounded paginated failed/completed CI history plus current runs and raw failure tails where accessible; state counts, bound and completeness, follow deployment through the actual persisted workflow result, and mark unread/truncated evidence inconclusive. Record defects alongside replacements rather than waiving them.

Report the actual run profile/model/effort from the run's evidence; this plan's dashboard role preferences are not proof of which model a future fallback run used. Each report names real/fake boundaries, build/executable identity, negative control, history completeness, defects and deferred-check ownership.

## Advisory activation, without idle tasks

Implementation, fixture execution, and core capability acceptance go first. Public identifiers default empty; never infer the owner's account from a sample username.

The first later run that actually needs an owner's feed raises only the corresponding physical chore through plan_manager_ask_user kind=operator_action, records what remains unproven, and ends that activation run immediately. It never polls. Core build tasks do not depend on that activation run.

- Music fingerprint: listenbrainz-user:now-playing. Ask the owner to create/use a public ListenBrainz account, connect an existing player or scrobbler, and provide the username. No credential is copied into this repository or deployment. Once the username is known, attach a real ready_probe URL https://api.listenbrainz.org/1/user/<encoded-name>/listens?count=1, expect_status 200 and body_contains track_name; never submit a literal placeholder URL. The Spotify connector's playing-now behavior is unverified, so last-listen support is mandatory and Web Scrobbler is the documented live path.
- Optional game fingerprint: lanyard-join:current-game. Ask the owner to join the Lanyard server with their Discord account, enable presence and supply the public user id. Once known, ready_probe https://api.lanyard.rest/v1/users/<id>, expect_status 200 and body_contains discord_user. No bot token or deployment key.
- A subsequent platform run can commit the public identifiers after an answer; an absent or waived answer leaves quiet output. State this as an advisory personalization gap in the operator-owned plan report, not a fake success or a build gate. The old waived Spotify/Steam secret chores esc-377/esc-378 are not prerequisites.
- Capture actual escalation/report ids returned by the platform, the activation owner, readiness URL and failure condition (owner feed absent/mismatched or configured provider deterministically failing). No scheduled watch is invented for an unknown account date. If acceptance has a genuine dated condition, use the existing pending/not_before mechanism; otherwise report the present gap and close the run without a timed recheck.

## Completion criteria for this planning run

Research and these exact runnable contracts are committed and pushed; plan_manager_propose_tasks accepts the path, SHA and title Keyless Pocket Presence; plan_manager_submit_report(kind=summary) references the same artifact. Planning does not certify a deployed feature or a green default branch: the inherited E2E/footer gate failures are explicitly owned by task 1.

## Delivery recovery for run-8715

The task-manager result for run-8712 was `agent_failed: exit 1 class=push_failed marker=push_not_on_main: HEAD 2cf0b57ba573 is not on origin/main`. Its feature-branch push succeeded but did not satisfy platform delivery. This run restores all three planning artifacts from that commit onto current main, preserves research.md byte for byte, updates the current gate evidence/contracts, and pushes with `git push origin HEAD`. On a non-fast-forward rejection, pull with rebase, rerun the project tests, and push again without force. Confirm the remote main contains the final delivery commit before submitting the replacement proposal and summary.

No application implementation is part of this product-owner recovery. The standing policy files remain absent in both the checkout and fetched origin/main; their contents cannot be claimed as read. The explicit role instructions govern the work. Actual run metadata: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet worker `avietidol-mac-mini`. This is planning evidence, with no live owner output, deployment proof, or runtime execution claim.
