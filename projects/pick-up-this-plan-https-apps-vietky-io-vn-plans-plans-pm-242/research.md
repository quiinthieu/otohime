# Picking up pm-242 (Pocket Console Encore) with free, key-less services

Research for idea-254 ("Pick up this plan: pm-242 and use other services that are free and do not require any keys/secrets if possible"), read against main `654c406` on 2026-10-26 (05:35–05:45 UTC). Every provider claim below was probed from this build-worker pod with `curl` unless marked otherwise.

## 1. Where pm-242 stands (nothing to redo except idea 9's live reading)

- pm-242 is **abandoned** on the board with all **12 build tasks done** (t-1475 … t-1486) and one acceptance cycle that ended `pending`. The acceptance walk (rep-4950, production `cb2c417`, 87/0 checks twice, 1366 and 390, reduced motion and no-JS) found **eleven of the twelve ideas working for a visitor**: console sounds, tilt, cartridges, plug drag, ink tools and re-roll, pipeline model, session-aware boot, LCD→page morph, work pipeline, snake, scroll-drawn sketch frames, and the earlier ink-wipe theme toggle.
- The one undelivered outcome is **idea 9, Now Playing**: the cassette and game cartridge are shipped and honest, but they only ever show the quiet face because the live reading needs owner secrets. Two operator chores were raised and then **waived by the decider**:
  - `esc-377` `spotify-app:now-playing`: a Spotify developer app (which since February 2026 requires the owner on **Premium**), an OAuth consent, and `SPOTIFY_CLIENT_ID/SECRET/REFRESH_TOKEN` in Vercel Production.
  - `esc-378` `steam-key:current-game` (optional): `STEAM_API_KEY` + `STEAM_ID` in Vercel Production and a public Steam profile.
- Live today (2026-10-26T05:40Z): `GET https://otohime.dev/api/now-playing` → `{"spotify":"spotify-off","track":null,"steam":"steam-off","game":null,"readAt":"2026-10-26T05:40:48.015Z"}`; production `build-sha` is `c38f72a`.
- So this plan reduces to: **replace the keyed providers behind idea 9 with key-less ones**, keep everything else as shipped. The reader architecture from t-1481 (`lib/now-playing.ts` one `"use cache"` reader with `cacheLife({stale:30, revalidate:60, expire:300})`, pure parsers in `lib/now-playing-data.ts`, `components/cassette.tsx`, `GET /api/now-playing`, loopback-host fakes in `scripts/walk-now-playing.sh` and `scripts/probe-cassette.sh/.mjs`) is sound and should be extended, not rewritten.

### A blocker outside idea 9: main CI is red, so nothing new deploys

- GitHub Actions on `main`: the last green run is `c38f72a` (2026-10-26T03:19Z), which is exactly the deployed build. Since then every completed run failed (17 failures in the last 40 runs) at job `checks`, step **"Footer Chromium probe"** (`EXPECT_SHA=$GITHUB_SHA bash scripts/probe-end.sh`), and the `production` job is `needs: checks`, so it is skipped. **HEAD `654c406` is 36 commits ahead of production.** Runs for `654c406` and `7041d7f` were still in progress at 05:44Z.
- The footer belongs to pm-248 (Paper Almanac Bits), which is itself **abandoned** (acceptance exhausted, esc-385), so nobody owns the repair. Any pm-258 build will sit undeployed until main is green again. The product owner should put a "make main green" task first, or make the first SWE task's contract include it.

## 2. What "free and no keys" rules out

| Service | Why it is out |
| --- | --- |
| Spotify Web API | Always a client id + secret + per-user OAuth; since 2026-02 a dev-mode app also needs the owner on Premium (checked in pm-242's research). |
| Steam Web API (`GetPlayerSummaries`) | Needs `STEAM_API_KEY`. |
| Last.fm | Free, but every read needs an `api_key` (`ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=rj` without one → **400**, verified). Nearest "free with a key" fallback if a key-less path is later rejected. |
| Libre.fm | Last.fm-compatible and key-less for reads, but moribund; a probe answered `{"error":{"#text":"Invalid resource specified","code":"7"}}`. Not recommended. |
| Scraping `open.spotify.com` | Needs an anonymous web token that Spotify rotates; breaks without notice; against the house "no scraping" line. |
| Self-hosted Lanyard | Needs a Discord bot token: a secret again. |

## 3. Key-less candidates, verified

### 3.1 ListenBrainz (MetaBrainz Foundation) — recommended for the cassette

Public, documented read API, no token for reads, run by a non-profit, open source. Verified from this pod:

| Call | Result |
| --- | --- |
| `GET https://api.listenbrainz.org/1/user/rob/playing-now` | `200 application/json` `{"payload":{"count":0,"listens":[],"playing_now":true,"user_id":"rob"}}` (nothing playing right now). With a track it is one listen in `payload.listens[0].track_metadata` with no `listened_at`. |
| `GET …/1/user/rob/listens?count=1` | `200` with `payload.listens[0]`: `listened_at`, `track_metadata.artist_name`, `track_name`, `release_name`, `additional_info.{spotify_id, origin_url, music_service, duration_ms, submission_client}`, server-side `mbid_mapping`. |
| `GET …/1/user/zzz-no-such-user-xyz/listens?count=1` | `404 {"code":404,"error":"Cannot find user: …"}` |
| Headers | `x-ratelimit-limit: 30`, `x-ratelimit-remaining`, `x-ratelimit-reset-in` (~10 s window); `access-control-allow-origin: *`; `cache-control: private`. One read a minute is 1/300th of the budget. |
| Gateway gotcha | The **first** request from this pod (default curl UA) to `playing-now` returned **`200 text/html` "Verifying your browser"**, a JavaScript proof-of-work page from the MetaBrainz gateway (`x-mb-gateway: rex`). The next 9 requests, with and without a User-Agent, were all JSON. MetaBrainz's 2026-08-24 post "Blocked ListenBrainz services/User Agent strings" says clients without a meaningful UA get blocked, and the 2026-08-19 "Growing pains" post says some endpoints are disabled during scraping waves. |

Consequences for the adapter: send `User-Agent: otohime.dev/1.0 (+https://otohime.dev)` and `Accept: application/json`; treat a non-JSON body (the challenge page) exactly like today's garbage case → `*-quiet`; the 60 s cache already bounds the cost of an outage to one call a minute.

**How the owner feeds it (no secret ever touches our deployment, only a public username):**
- Create a free ListenBrainz account.
- Either connect Spotify at `listenbrainz.org/settings/music-services/details/` (ListenBrainz imports the listening history itself; since 2026-07-20 Spotify expires that connection every **6 months** and ListenBrainz emails a reminder; whether this connector also submits `playing_now` is **unverified**, the importer source could not be fetched), **or** install the MIT-licensed **Web Scrobbler** browser extension (Chrome/Firefox/Safari/Edge; ListenBrainz is a supported target) or Pano Scrobbler on Android, both of which submit `playing_now` live and never expire.
- The design below works either way: `playing-now` when something plays, otherwise the latest listen with its time.

ListenBrainz publishes its listen data under CC0; the credit line stays on every render anyway (Live data rule 7).

### 3.2 Lanyard (Discord presence) — optional, for the game cartridge (and a second Spotify source)

`GET https://api.lanyard.rest/v1/users/<discord_user_id>` — no key for reads, MIT, hosted by a volunteer on Railway (`server: railway-hikari`). Verified from this pod (0.45 s):

- `data` keys: `discord_user`, `discord_status`, `activities[]` (Discord's raw activity objects: `type` 0 = "Playing <name>", Discord detects Steam and other desktop games), `listening_to_spotify`, `spotify` (`song`, `artist`, `album`, `album_art_url`, `track_id`, `timestamps`), `kv`, `active_on_discord_*`.
- Unknown user → `404 {"error":{"code":"user_not_monitored",…},"success":false}`.
- No rate-limit headers, no documented limits or SLA.

Owner side: join Lanyard's Discord server (`discord.gg/UrXF2cfJ7F`), keep the Discord desktop app running for game detection, and (optionally) link Spotify in Discord so "Listening to Spotify" shows (a free Spotify account suffices for the status; only "Listen Along" needs Premium). Risk: a single volunteer service with no SLA; the quiet fallback and one call a minute make that acceptable, but it must stay optional.

### 3.3 Steam community XML — not recommended

`https://steamcommunity.com/profiles/<SteamID64>/?xml=1` is key-less and carries `<inGameInfo><gameName>` for a public profile, but Valve's own documentation calls the community XML data deprecated, and the pm-242 decider already ruled "do not scrape Steam". It also **could not be verified from here**: this pod resolves `steamcommunity.com`, `api.steampowered.com` and `store.steampowered.com` to `::1` (egress blocked), and WebFetch failed too. Lanyard's `activities` gives the same "playing Hades II" label without touching Steam.

## 4. Recommended design (extends t-1481, does not replace it)

1. **Cassette = ListenBrainz.** In `lib/now-playing.ts` add a third provider beside Spotify and Steam. Read `playing-now` and `listens?count=1` concurrently with one 4 s budget: if `playing-now` carries a listen → `playing: true`; else the latest listen with `listened_at` → `playing: false` and the label "Last on the deck · 14:02 UTC". Link: `additional_info.spotify_id` if it is an `open.spotify.com/track/...` URL (reuse `spotifyUrl`), else `origin_url` if https on an allowlist (`open.spotify.com`, `listenbrainz.org`, `musicbrainz.org`), else the owner's ListenBrainz profile `https://listenbrainz.org/user/<name>/`.
2. **Cartridge = Lanyard (optional).** First `activities[]` entry with `type === 0` → game name capped at 48, no store link (Discord gives none), credit "presence via Lanyard/Discord". No user id → `*-off`; `user_not_monitored`, non-JSON, abort → `*-quiet`.
3. **Pure parsers** in `lib/now-playing-data.ts`: `parseListenBrainzPlayingNow(unknown)`, `parseListenBrainzListens(unknown)`, `parseLanyardGame(unknown)` (and `parseLanyardTrack` if the PO wants Lanyard as a Spotify fallback) on captured fixtures: the responses above, the 404 shapes, the HTML challenge page, garbage, over-long strings, control characters.
4. **States and API shape.** Keep `GET /api/now-playing` always-200 and additive: keep `spotify/track/steam/game/readAt` and add `music: {source: "listenbrainz"|"spotify"|null, state}` and `play: {source: "lanyard"|"steam"|null, state}`, or rename to provider-neutral keys in one go; the walk, probe and acceptance report are the only consumers (`scripts/walk-now-playing.sh:338,358,411,605`, `components/cassette.tsx:14-21`). Copy in `content/site.ts` (`nowPlaying.tape "Side A · Spotify"`, `cart "Cartridge · Steam"`, `credit`) must become per-source.
5. **Configuration is public, not secret.** `LISTENBRAINZ_USER` (ListenBrainz username) and `LANYARD_USER_ID` (17–20 digit Discord snowflake), validated by regex in `configFrom(env)` like today; they can equally live in `content/site.ts` since they are public identifiers, which spares the owner a Vercel visit. Host overrides `NOW_PLAYING_LISTENBRAINZ_HOST` / `NOW_PLAYING_LANYARD_HOST` loopback-only, state `*-fixture`, exactly as the existing three.
6. **Caching unchanged** (`stale 30 / revalidate 60 / expire 300`), nothing at build, `await connection()` first. Spotify and Steam adapters stay in place, off without env, so the owner keeps that door open; README's "Now playing" section is rewritten with ListenBrainz as the documented path and Spotify/Steam as the keyed alternatives.
7. **Operator chores, parked not blocking** (`plan_manager_ask_user kind=operator_action`), raised at the start of the first run that needs them, never waited on:
   - `listenbrainz-user:now-playing`: create the account, connect Spotify on ListenBrainz or install Web Scrobbler/Pano, reply with the username. Ready probe: `GET https://api.listenbrainz.org/1/user/<name>/listens?count=1` → 200, body contains `"track_name"`.
   - `lanyard-join:current-game` (optional): join the Lanyard server, keep Discord running, reply with the Discord user id. Ready probe: `GET https://api.lanyard.rest/v1/users/<id>` → 200, body contains `"discord_user"`.
   - Until a username is known the shipped quiet face stays, which is honest.

## 5. Suggested tasks for the product owner

| # | Task | Size | Notes |
| --- | --- | --- | --- |
| A | **Make main green**: diagnose the red "Footer Chromium probe" (`scripts/probe-end.sh`) since `c38f72a`, fix the code or the probe, prove it with the same step locally (`SKIP_BUILD=1 bash scripts/probe-end.sh`) and a green push. | S/M | Precondition for any deploy; pm-248 is abandoned so it is unowned. Verification: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `SKIP_BUILD=1 bash scripts/walk-end.sh && SKIP_BUILD=1 bash scripts/probe-end.sh`. |
| B | **ListenBrainz cassette**: parsers + fixtures, adapter with UA and 4 s abort, per-source copy and credit, `.env.example`, README, loopback fake in `probe-cassette.mjs fake` (fourth port), walk cases: playing, last-listen, empty, 404 user, HTML challenge, dead/slow upstream, no requests at build, sentinel scan. | M | Same 7-command verification as t-1481 (`npm test`, lint, typecheck, build, `SKIP_BUILD=1 bash scripts/walk-now-playing.sh && SKIP_BUILD=1 bash scripts/probe-cassette.sh`, `SKIP_BUILD=1 bash scripts/probe-motion.sh`, `SKIP_BUILD=1 APP_PORT=4099 bash scripts/e2e-local.sh`). Raise `listenbrainz-user:now-playing` at the start of this run. |
| C | **Lanyard cartridge** (optional): parser + fixtures (`user_not_monitored`, no activities, type-0 activity, Spotify-only presence), adapter, copy "Cartridge · Discord", fake and walk cases. | S | Independent of B after B lands the per-source shape; raise `lanyard-join:current-game` at its start. |
| D | **Acceptance** on production: once A deploys B, `GET /api/now-playing` on the deployed build-sha shows `listenbrainz-live` (after the owner's chore) and `/music` prints the same track the owner's public ListenBrainz page shows, with no secret names in HTML or chunks; if the chore is undone, the outcome is reported as undelivered, never passed. | — | Successor to pm-242's pending acceptance; esc-377/378 stay waived and are superseded. |

## 6. Risks and how the design absorbs them

- **ListenBrainz gateway challenge or disabled endpoints during scraping waves** → non-JSON → quiet face, one call a minute; the UA makes us identifiable so MetaBrainz can allow-list if needed.
- **Spotify→ListenBrainz connector expires every 6 months** → the cassette silently stops updating; the latest-listen label shows its (old) time so staleness is visible; the extension/mobile scrobbler route has no expiry.
- **Lanyard is one volunteer's service** → optional provider, quiet on 404/timeout, never load-bearing.
- **Privacy**: a public ListenBrainz profile and Discord presence tell everyone what the owner plays, which is the point of idea 9 and what the owner is choosing by naming the accounts; the parsers keep only title/artist/game and public links.
- **Red main CI** → task A first; otherwise B and C ship to nowhere.

## 7. Evidence log

- Board: `plan_manager_get_plan pm-242` (status abandoned, 12 tasks done, rep-4950 pending, esc-377/378 waived with probe results "200 OK but body lacks spotify-live/steam-live" at 05:35Z); `plan_manager_get_plan pm-248` (abandoned, esc-385).
- Live: `curl https://otohime.dev/api/now-playing` and `build-sha` meta at 05:40Z; GitHub Actions API for `quiinthieu/otohime` main runs (last success `c38f72a`, failed step "Footer Chromium probe", production skipped).
- ListenBrainz: 11 requests to `api.listenbrainz.org` between 05:39Z and 05:42Z (first one challenged, rest JSON); readthedocs JSON format page; MetaBrainz blog 2026-07-19, 2026-08-19 and 2026-08-24.
- Lanyard: `api.lanyard.rest/v1/users/94490510688792576` (200, fields listed) and an unknown id (404 `user_not_monitored`); README (opt-in server, fields, MIT, self-host needs `BOT_TOKEN`).
- Steam: DNS for all three Steam hosts resolves to `::1` on this pod, so the XML feed is unverified here; Valve's community-data page marks it deprecated.
- Last.fm without key → 400; Libre.fm → error 7.
- Not done: no code was changed and nothing was pushed (research role). `/shared/artifacts` does not exist on this lease and cannot be created without sudo, so this file is the artifact.
