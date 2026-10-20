---
plan_id: pm-196
run_id: run-6687
kind: acceptance_report
verdict: pass
cycle: 0
cited_sha: ae62f088110e2e381ac93d0ac1263c3a31c44a45
---

# Acceptance: pm-196, Capsule, Printed (run-6687)

**Verdict: pass.** At https://otohime.dev/capsule the cards, album and machine are now printed in ink: thin rough outlines, hatched shade, muted fills on grained cream paper, Fraunces type, and numbered double-rule frames with ink, slate or gold edges. A visitor can no longer tell the card before it is revealed:

- every capsule is the same shell;
- the turn length varies per round and does not depend on the tier;
- the capsule drops out of the dome;
- the card rises as a plain back, the tier edge draws on, and only then does the card flip to its face;
- the album and tally change only at the reveal.

The crank can be pulled by hand with a mouse or a finger.

## Walkthrough (production, headless Chromium 1248, Linux pod, 2026-10-20)

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Fresh visitor, 1366×768 | Open /capsule | Fraunces headline "Put a coin in. / See who rolls out." on `rgb(243,236,221)` paper. The inked coral machine has 8 identical coral-over-paper capsules. 12 album slots are hatched card backs labelled "Slot n, not found yet" (No. 01 to No. 12). 1 stylesheet, overflow 0, no console or page errors | `desk-idle.png`; probe `ok - desk` |
| Fresh visitor, 390×844 (touch) | Open /capsule | Same, stacked. Overflow 0, no errors | `phone-idle.png`; probe `ok - phone` |
| Anyone | `view-source` (prod walk) | Served HTML names no card (no Totoro, Calcifer, No-Face or Robot soldier), has no `data-slot="<id>"`, no tier hint on a slot, 12 `data-unfound`, 8 `data-shell`, none of the old tier colours, `data-stage="idle"` and `data-crank` | `BASE_URL=https://otohime.dev EXPECT_SHA=ae62f08… bash scripts/walk-capsule.sh` gives 42 ok, 0 failed |
| Fresh random seed, 1366, mouse | Insert coin, pull the crank 120° clockwise, Open | idle>loaded>turning>dropping>ready>shake>part>rise>edge>flip>revealed. Turn 2326 ms. 0 of 54 pre-edge snapshots expose a tier, face, name or sparks. Album and tally unchanged until revealed, then "Ponyo. Common. New to your album." | probe `ok - fresh-desk-mouse` |
| Fresh random seed, 390, finger | Insert coin, finger-pull the crank 120°, Open | Same order. Turn 2160 ms. 0 of 53 leaks. scrollY delta 0 during the pull. "Kiki. Rare. New to your album." | probe `ok - fresh-phone-touch`; `fresh-phone-touch-revealed.png` |
| Seed 1 (common), 1366 Turn button / 390 finger | Full round | Jiji. Edge first appears in `edge` as `common`. 0 of 34 / 0 of 52 leaks. Album changes only at reveal | probe `ok - common-desk`, `ok - common-phone` |
| Seed 2 (rare), 1366 mouse / 390 button | Full round | Calcifer. Edge `rare` (slate) from `edge`. 0 of 49 / 0 of 31 leaks | probe `ok - rare-desk`, `ok - rare-phone`; `rare-phone-edge.png` |
| Seed 14, sinceLegend 99 (legend), 1366 button / 390 finger | Full round | No-Face. …rise>edge>**hold**>flip>revealed. Gold edge with corner fans and a glow only in `hold`. 0 of 32 / 0 of 50 leaks | probe `ok - legend-desk`, `ok - legend-phone`; `legend-desk-rise/hold/revealed.png` |
| Every round above, in `ready` | Read the machine SVG | The same for every tier: shell fills `#c9684f #fffaf0`, 1 slate stroke (the dome reflection), 0 gold. The dome shows 7 capsules and one sits in the chute | probe `ready` field; `legend-desk-ready.png` |
| Seed 1 with `owned {jiji:1}` | Full round | `jiji×1` and "1 of 12 · 0 draws" stay through `flip`, then `jiji×2` and "1 of 12 · 1 draw". Status "Jiji. Common." (no "New") | probe `ok - extra-desk` |
| Reduced motion, 1366 button / 390 finger | Full round | idle>loaded>ready>revealed. Each press lands at once with no leak | probe `ok - reduced-desk`, `ok - reduced-phone` |
| One visitor, 9 coins, seed 77 | Five rounds in a row | Turn (click→ready) 1715, 2273, 1637, 2041 and 1553 ms, each different. Jiji, Jiji, Ponyo, Kodama, Ponyo. Tally "3 of 12 · 5 draws" | probe `ok - five rounds in a row` |
| Keyboard only | Enter on Insert coin, Space on Turn, Enter on Open | Full round, "Kiki. Rare. New to your album." | probe `ok - keyboard` |
| Loaded, mouse | Pull 50° and let go | Springs back to `matrix(1,0,0,1,0,0)`, stays `loaded`, draws 0 | probe `ok - crank released at 50°` |
| Seed 2, mid-turn | Reload the page | Calcifer is kept: album `calcifer`, "1 of 12 · 1 draw" | probe `ok - reload mid-turn` |
| 390×844 | Measure the machine top to the Open button bottom | 674 px, so the machine (where the card rises) and Open fit in one screen | probe `ok - phone` layout; `phone-natural.png` |

Probe totals: 19 ok, 0 failed. The scripts and screenshots are in `/tmp/acc` (scratch, not committed).

## How the five leaks in the plan stand

| # | Leak | Now |
| --- | --- | --- |
| 1 | Capsule coloured by tier | Gone. Every shell has one fill set, the same in every tier at `ready` |
| 2 | Album silhouettes and tier | Gone. Unfound slots are numbered hatched backs |
| 3 | Served HTML names slots | Gone. The walk lacks every name, and slots are `data-slot="1".."12"` |
| 4 | Album fills in at Turn | Gone. Album, `×n` and tally change only at `revealed`, for first and extra copies |
| 5 | Fixed 12-frame turn, no drop, face-up pop | Gone. Turns range from 1.4 to 2.3 s, a capsule drops from the dome (7 left), and Open stages shake, part, rise, edge, (hold) and flip, with the tier last |

## Art (judged from the screenshots)

The page reads as a printed piece, not a sticker pack:

- **Type and paper.** Fraunces display type with an italic coral line, and cream grained paper.
- **Rules and buttons.** Ruled top bar, tray and rates line. Letterpress buttons.
- **Machine.** Drawn in the same rough ink as the cards, with hatched shadow and a slate dome reflection.
- **Cards.** Muted fills, a thin rough outline and a numbered double-rule frame with a serif plate and an italic film · year. The No-Face card is gold-edged with corner ornaments, and Kiki is slate-edged.

The request's "more sophisticated" is met.

## Components and shas

- Deployed: https://otohime.dev/capsule `build-sha` = `ae62f088110e2e381ac93d0ac1263c3a31c44a45` (= origin/main; served by Vercel, `server: Vercel`).
- Delivery shas `f2f3388` (t-1130), `c2660b7` (t-1131), `e3a3854` (t-1132) and `ee5612a` (t-1133) are all ancestors of `ae62f08` (`git merge-base --is-ancestor`). `git diff ee5612a ae62f08` touches only Vinyl, README, probe-selects and a QA report, and no Capsule code.
- Identity: each of the four delivery commits has author and committer `Otohime <quiinthieu@gmail.com>` and no Co-Authored-By trailer. There is no `author.txt` artifact on this pod, so this was read from git.
- Repo checks on this pod at ae62f08: `npm ci`, `npm run lint` and `npm run typecheck` exit 0. `npm test` gives 349 of 349 pass.

## Logs

Capsule is a client-only page: the ledger is in localStorage and a round makes no server call. Every browser context recorded console errors and page errors, and there were none. The pod has no Vercel token and no GitHub API access to the private repo, so it read no host logs (recorded as a decision).

## Notes, not fails

- At 1366×768 the album sits below the fold. You see it by scrolling, and it is the same as before the plan.
- The empty reveal frame next to the machine stays blank until revealed, because the card rises out of the chute instead. It reads as "a card will go here".
