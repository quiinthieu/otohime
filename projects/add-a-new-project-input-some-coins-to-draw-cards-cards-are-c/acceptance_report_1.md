---
plan_id: pm-184
run_id: run-6295
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: 136cc5c80240ee4707214c5774fa0d3642d62ed4
---

# Acceptance: pm-184, Capsule Card Machine (run-6295)

**Verdict: pass.** At https://otohime.dev/capsule a person can insert free coins, turn the crank, open a capsule and keep a hand-drawn chibi card of a Studio Ghibli character. The album keeps those cards across reloads, and coins come back each day. All twelve cards are drawn.

## Walkthrough (production, otohime.dev at 136cc5c)

I drove a Playwright Chrome Headless Shell through four contexts: 1366×768 and 390×844 (touch), each with `reducedMotion` set to `no-preference` and to `reduce`. Every row below passed in all four contexts (`browser: 124 ok, 0 failed`).

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| fresh browser, `/projects` | tap the one Capsule row | `/capsule` opens, titled "Capsule", with build-sha `136cc5c…` | walk.log, `*-1-fresh.png` |
| `/capsule`, empty ledger | look | "5 coins · 3 more tomorrow", 12 album slots (silhouettes), the rates line "Common 70% · Rare 25% · Legend 5% · a legend at least every 20 draws · coins are free and can't be bought", and the Studio Ghibli "Not affiliated" disclaimer. No horizontal overflow at 390px. | walk.log, `mobile-*-3-album-after-reload.png` |
| 5 coins | Insert coin → Turn → Open | the crank turns and the card rises, e.g. "Jiji, Kiki's Delivery Service · 1989", status "Jiji. Common.", tray "4 coins". The card is a drawn SVG (≥8 paths). | `desktop-no-preference-2-revealed.png` |
| 4 coins | four more rounds | coins 0, draws 5, **Insert coin** disabled, "No coins left. More tomorrow." Each card drawn was a real drawing (Ponyo, Heen, Kodama, Catbus, Teto, Calcifer, Kiki, Robot soldier, Soot sprite and others across contexts) | walk.log |
| 5 draws | reload | same owned map, draws 5, coins 0. The tally reads e.g. "4 of 12 · 5 draws" and owned slots show their drawing and ×n (Kodama ×2). Nothing is re-rolled. | `*-3-album-after-reload.png` |
| album with cards | tap an owned card | modal `<dialog>` with the large card, name, "film · year", tier badge, ×n and note | `mobile-reduce-4-enlarge.png` |
| dialog open | Esc, then reopen and Close | it closes each time, and focus returns to the slot | walk.log |
| album with cards | Reset album → Keep | inline "Reset album? This clears your N cards. [Reset] [Keep]"; Keep leaves the album untouched | `*-5-reset-confirm.png` |
| confirm shown | Reset | owned {} and draws 0; seed and coins unchanged. 0 native browser dialogs fired. | walk.log |
| 0 coins, `lastDay` = yesterday | reload | tray "3 coins · 3 more tomorrow", Insert enabled; one more round leaves 2 coins | `refill-next-day.png`, walk.log |
| `sinceLegend` 19 (19 misses) | Insert → Turn → Open | "No-Face. Legend." with sinceLegend reset to 0: the pity rule holds | pity.mjs output |
| `/capsule` | tap "otohime.dev" | goes to `/` | walk.log |
| whole session, 4 contexts | — | 0 console errors and 0 page errors | walk.log |

## Other evidence produced in this run

| Check | Result |
| --- | --- |
| `BASE_URL=https://otohime.dev EXPECT_SHA=136cc5c… bash scripts/walk-capsule.sh` | `walk: 27 ok, 0 failed`. This covers /capsule markers, its own stylesheet with no Tailwind, /projects linking /capsule once, and /shore, /, /work, /play, /notes and /music returning 200. /capsule/nope and /nonexistent return 404 with the parcel page. |
| The same walk at the earlier deploy, `EXPECT_SHA=e895ac9…` | `walk: 27 ok, 0 failed` (production redeployed during this run) |
| `npm ci && npm run lint && npm run typecheck && npm test` on e895ac9 (code identical to 136cc5c) | exit 0; 98 tests, 98 pass |
| `bash scripts/walk-capsule.sh` (local build) | `walk: 28 ok, 0 failed`; no server left on :4021 |
| `npm run --silent capsule:sheet`, rendered with Chrome | twelve framed cards in album order, matching the hand-drawn chibi brief (one ink outline, flat fills, blush, big head). The tier frames are correct: plain for common, a thin foil line for rare (Totoro, Catbus, Calcifer, Kiki) and a full foil border for legend (No-Face, Robot soldier). There is no raster or gradient. |
| `https://otohime.dev/api/health` | 200 |

## Components and shas

- **otohime.dev (Vercel, Next app):** build-sha `136cc5c80240ee4707214c5774fa0d3642d62ed4` on `/` and `/capsule`. This is the head of main, and it differs from `e895ac9` only in `qa-t-1063.md`.
- **Delivery shas, all ancestors of the deployed sha:** 4cb0fe0 (t-1061), 5a5a430 (t-1062), b348de6 (t-1063) and afe5773 (t-1064). `git merge-base --is-ancestor` exits 0 for each.
- **Logs:** Capsule is client-side (localStorage, no API or DB). The lease has no Vercel CLI or token and no gh auth, so Vercel's runtime logs could not be read. Browser console and pageerror capture showed 0 errors across the walk, and health is 200.

## Identity

There is no `author.txt` in the delivery evidence. Every pm-184 commit (a268af4…136cc5c) is authored and committed by `Otohime <quiinthieu@gmail.com>`. The commits a268af4, 4cb0fe0 and 5a5a430 carry a `Co-Authored-By: Claude Opus 5.5` trailer. This is noted but is not a fail: plan.md QA item 5 says so, the identity check is the author email, and the later commits have no trailer.

## Notes (not failures)

- A next-day refill shows in the tray at once, but it is written to localStorage only on the next Turn or Reset. This is by design, because render never writes.
- The hand-font fallback on Linux, noted at t-1062, still applies there. On macOS Chrome the fonts render as intended.
- The screenshots were viewed on the lease and are not committed (no binaries in the repo).
