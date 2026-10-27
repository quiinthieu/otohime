---
plan_id: pm-272
run_id: run-9218
kind: acceptance_report
verdict: pass
cycle: 1
---

# pm-272 Keyless Pocket Presence · part 2: acceptance, cycle 1

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Production at 10:38:10Z | GET `https://otohime.dev/api/health`, `/api/now-playing` and `/music` | Health returns `b4e142ad37c76abdc496c14afb4ac18b2b5c03ba`. The `/music` `<meta name="build-sha">` matches. `/api/now-playing` returns 200 with `cache-control: no-store`: `music {source:null, state:off}`, `play {source:null, state:off}`, `track:null`, `game:null`. This is the honest default because no owner identity is configured. | curl capture in this run |
| Local repo, `origin/main` fetched | `git merge-base --is-ancestor` for baec1f8 (t-1565), ea79432 and 79f7813 (t-1566) against b4e142a. `git diff` of the provider files across 79f7813..b4e142a..HEAD | All three exit 0. The diff is empty for `lib/now-playing.ts`, `lib/now-playing-data.ts`, `components/cassette.tsx`, `content/now-playing.ts`, `content/site.ts`, `next.config.ts` and `package-lock.json`, so the deployed code is the delivered code. | `acceptance-run-9218/fingerprint.txt` |
| Clean worktree at b4e142a, `npm ci` exit 0, Node 22.23.3 linux x64, Chrome 154.0.8037.57, playwright-core 1.64.0 | `npm run build` with `LISTENBRAINZ_USER`, `LANYARD_USER_ID` and both provider hosts pointed at my own loopback recorder | Build exits 0 with BUILD_ID `X0b8IQertd4pM3uWuMNR0`. **The recorder saw 0 requests during the build.** | `build-requests.json` (`[]`), `build-tail.log` |
| Same build, recorder positive control (scenario `recorder-503`) | Start `next start` with the same recorder host, then GET `/api/now-playing` | The recorder saw **3** runtime requests: `/1/user/aerozol/playing-now`, `/listens?count=1` and `/v1/users/<id>`, all with UA `otohime.dev/1.0 (+https://otohime.dev)`. Both 503 replies give `quiet` with no fixture/live claim. So the build's zero is not vacuous. | `walk.json` → `recorder-503` |
| Same build, no identity (`default-off`) | GET the API twice, then no-JS `/music` HTML | Music off and play off, identical to production. Page data attributes agree with the API. The second read has the same `readAt`, so it is served from the shared cache. | `walk.json` |
| Same build, **live public providers**: `LISTENBRAINZ_USER=aerozol` (an active public account) and `LANYARD_USER_ID=94490510688792576` (Lanyard's documented example user), on a local server only, never as a production default | GET the API and `/music`. Separately, read `api.listenbrainz.org` and `api.lanyard.rest` directly before and after | Music `listenbrainz/live` with profile `https://listenbrainz.org/user/aerozol/`. Track "Fisherman's Tune (single version)" by Launchable Socks, `listenedAt 2026-10-27T05:54:28Z`. That is **equal to my independent upstream read**, last listen with nothing playing now. Play `lanyard/live` with `game:null`, equal to the upstream activities `[]`. The Discord id is absent from the API. The page agrees, has no fixture label and carries the Lanyard credit. | `walk.json` → `live`, `server-live.log` |
| Live scenario, comparator negative control | Compare the server reading against a different upstream track | Rejected, so the equality check is not vacuous | `comparatorNegativeControl: rejected` |
| Live server in Chrome at **1366×768** and **390×844**, JS on and off, reduced motion | Open `/music`, read the shelf, Tab to the tape link, take screenshots | All 4 contexts show "Side A · ListenBrainz", "Last on the deck", the title and artist, `2026-10-27 · 05:54:28 UTC`, still reels (`data-spin` absent), and links to the ListenBrainz profile, ListenBrainz (CC0) and `github.com/Phineas/lanyard`. The cart reads "Cartridge · Lanyard / Quiet / Hades II, one more run / From my Now list, not read live." It has no store link. No horizontal overflow. With JS on, the tape link is reachable by keyboard. **0 console errors and 0 page errors.** | `local-live-*.png`, `walk.json` → `browser` |
| **Deployed** `https://otohime.dev/music` at **1366×768** and **390×844**, JS on and off | The same walk | All 4 contexts have build-sha b4e142a, `off/off`, quiet tape with no spin, "Not read live: the labels are the static ones.", no store link and no overflow. With JS on, the link is reachable by keyboard. **0 console errors and 0 page errors.** The only request failures are aborted `?_rsc=` link prefetches (JS on) and chunk scripts Chrome reports blocked as `csp` (JS off), recorded as benign. | `deployed-*.png`, `walk.json` |
| Same build, `live-unknown`: a nonexistent ListenBrainz user and the unmonitored Lanyard id `100000000000000000` | GET the API and page | Both `quiet`. Neither switches to another provider, and no track or game appears. | `walk.json` |
| Same build, `live-hostile`: `NOW_PLAYING_LISTENBRAINZ_HOST=https://evil.example` and `LANYARD_USER_ID=12345` | GET the API | The non-loopback override is ignored and the real API is read (`listenbrainz/live`). The invalid id gives play `off`. | `walk.json` |
| Same build, `invalid-user`: `LISTENBRAINZ_USER=../admin` | GET the API | Music `off` | `walk.json` |
| Same build, `hang-game`: Lanyard host pointed at a loopback socket that never answers | GET the API | Answers in 4,039 ms. Play `quiet`. Music stays `listenbrainz/live` with the real last listen, so the provider failure is isolated. | `walk.json` |
| Local server logs, all 7 scenarios | Scan for errors, exceptions and `⨯` lines | No error lines | `server-*.log` (`serverLogErrorLines: []`) |
| Main checkout at 531c0ba with this evidence added, `npm ci` exit 0 | `npm test`; `npm run lint` | 2,510 pass, 0 fail, 0 skip. Lint exit 0 (0 errors, 10 existing warnings, none in this evidence). | this run's local logs |

## Verdict

**Pass.** The idea asked to pick up pm-242 and use free services that need no keys or secrets. That outcome exists in the running product.

- **Integration deployed:** yes. Production serves b4e142a, which contains both deliveries, and the provider files are byte-identical. GitHub CI [40485335471](https://github.com/quiinthieu/otohime/actions/runs/40485335471) at b4e142a passed: checks job 122125584886 and production job 122133865717 both succeeded (10:02–10:24Z).
- **Execution demonstrated:** yes, against the **real** keyless upstreams, not only fixtures. The locked production build at b4e142a reads public ListenBrainz and Lanyard with no key, token or secret. It renders the same reading on the API and on `/music` at both required viewports, with and without JS. Every failure mode I injected stays honest.
- **Waiting for capacity:** none. Nothing is queued.
- **Product delivered:** the keyless capability is delivered, with the honest `off` default the contract requires. **Personalized owner presence is not delivered.** Production has no owner ListenBrainz username or Lanyard id, so a visitor sees the static quiet shelf. The plan (plan_run-8715 §Product outcome) makes the owner's identity advisory, and it is an opt-in, not a secret. My advisory question gives the exact env names and the readiness probe (`/api/now-playing` with `music.source="listenbrainz"`, `state="live"`). This is not a defect and does not fail acceptance.

## Observations (not defects)

- **Slow upstream degrades to "nothing on the deck".** In `live-hostile`, one real `listens?count=1` call took more than the 4-second budget. The server answered in 4,045 ms with `listenbrainz/live` and `track:null`, though aerozol had a last listen. A direct probe saw that endpoint at 4.81 s once in 12 calls. Later samples were 0/40 over 4 s (max 1.65 s) for `listens` and 0/20 (max 2.92 s) for `playing-now` (`listens-latency.txt`, `playing-now-latency.txt`). The contract fixes one 4-second budget and treats one usable endpoint as live, and "nothing on the deck right now" is true for playing-now. It is honest, but a visitor will occasionally miss the last listen until the next revalidation. If the product owner wants it, follow-up options are a separate budget per endpoint or keeping the last good last-listen.
- **Lanyard "in a game" is unobserved live.** The public Lanyard example user had no activities, so the live `In a game now` face was not seen. It needs someone actually playing. The fixture path and the live no-game path are both proven. This belongs to personalized activation.

## Identities

- Deployed: `b4e142ad37c76abdc496c14afb4ac18b2b5c03ba` (health and meta, read in each browser context). Deliveries: t-1565 `baec1f88e602e9ad50ebecb9827a476f939495af`; t-1566 `ea79432eb9bf23f40a18586eb91408ba1a585288` + `79f7813e939d92610a86540c71783c02973d737e`.
- Local acceptance build at b4e142a: BUILD_ID `X0b8IQertd4pM3uWuMNR0`, lock SHA-256 `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` (same as QA run-9212). Source hashes are in `fingerprint.txt`. This is my local artifact. Vercel's deployed server bundle was not downloaded.
- Author: baec1f8, ea79432, 79f7813 and b4e142a are all authored and committed by **Otohime <quiinthieu@gmail.com>**, with 0 `Co-Authored-By` trailers. The recorded author.txt digest `7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada` (44 bytes) equals SHA-256 of `Otohime quiinthieu@gmail.com\ntrailers: none\n`, which I recomputed. I did not download the artifact bytes myself, so that remains inconclusive beyond the digest match.
- This run: run-9218, profile `claude-opus-high`, model `claude-opus-5-5`, effort `high`, account `claude-kqviet`, worker `avietidol-z490`, task-manager `687e22a6-97bd-454c-bc8e-44bfca2085c5`, attempt 1.

## Real/fake boundary

- **Real:** the Next production server and cache, Node fetch with abort, the **live api.listenbrainz.org and api.lanyard.rest**, Chrome layout, keyboard, no-JS and reduced motion, and the migrated embedded Postgres (`scripts/e2e.mjs --serve-db`) needed for the auth runtime. The deployed site and public GitHub CI are also real.
- **Fake:** my loopback recorder (503) and hanging socket, which are negative controls only, and a placeholder `BETTER_AUTH_SECRET`. The sample identities are public strangers', used on a local server only. They are not the owner's presence and are not configured in production.
- My harness (`walk.mjs`) imports none of the delivered probes, fixtures or parsers.

## History and completeness

- pm-272 plan runs: all **14** read. 12 succeeded, plus run-9218 (this run) running. 2 failed: run-9109/7e3c8ba6 (`push_retries_exhausted`, then recovered by run-9118) and run-9127/0d9749c4. For run-9127 I read the raw tail myself: `Selected model is at capacity` twice, exit 1, "no local work beyond origin/main". Neither is a product defect. All runs have `callback_apply_failures=0`.
- Task-manager `project_id=plan-manager`: **FAILED 5/103** read, newest first. None are pm-272. 4478a567 is an otohime MCP startup timeout. d8f818df is pm-270 `push_not_on_main`. Three are mono-v2 `batch_publish_failed`. **COMPLETED 5/1,377** read; QA 49c9ed1e (run-9212) shows callback `delivered`. Unread pages are inconclusive.
- GitHub: I read the runs for b4e142a (1/1, success) and the 10 newest of 489 main runs. **221af4b (pm-268/t-1601, test-only) failed `npm test` in CI** (run 40488773079, checks job 122137146374) and was not deployed. Its follow-up 531c0ba is in progress. That item is owned by pm-268/t-1601. Its failure condition is a red main checks job at that plan's head. It does not touch the provider files. Earlier history is unread.
- Logs: local server logs for all 7 scenarios were read and are clean. Vercel runtime/function logs are not accessible without operator credentials, so they are **inconclusive**. The deployed browser walk saw no errors.

## Retained items (not waived)

| Item | Owner | Failure condition |
| --- | --- | --- |
| Personalized owner music/game | pm-272 activation (advisory question from run-9218) | `/api/now-playing` on production does not show `listenbrainz` `live` with the owner's own track once an identity is set |
| Slow-listens degradation | Product owner (observation) | A visitor-visible false claim, or a failure rate that makes the last listen routinely absent |
| 221af4b CI `npm test` red | pm-268/t-1601 | Main checks job still red at that plan's head |
| G9121-2 theme AbortError | t-1610 | Rapid double theme activation still emits an unhandled rejection |
| pm-271/run-9214/D1 stale Tamatebako history | pm-271 product owner | Newest deployed leaf more than 20 commits behind health SHA |
