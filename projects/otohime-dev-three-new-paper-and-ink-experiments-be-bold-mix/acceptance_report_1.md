---
plan_id: pm-293
run_id: run-9251
kind: acceptance_report
verdict: fail
cycle: 1
cited_sha: 36ba86a99f78ce93a8972c8e1f4d003242325469
---

# Acceptance: Washi Daruma, Emaki, and Hanafuda (pm-293), cycle 1

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev, 2026-10-27 ~16:40 UTC | `GET /api/health` | `{"ok":true,"sha":"36ba86a99f78ce93a8972c8e1f4d003242325469"}`. It contains t-1673 `c1c885c`, t-1676 `5fd1284`, t-1674 `8b0c491`, t-1677 `db788b1` and t-1675 `36ba86a` (`git merge-base --is-ancestor` exits 0 for each). origin/main `e8f2667` differs from it only under `projects/`. | curl, git |
| GitHub Actions | `GET /repos/quiinthieu/otohime/actions/runs?head_sha=36ba86a…` | run `40539710809` (#522, CI) `completed / success` | GitHub API |
| production, 1366×768, mouse | `/play` → click the Hanafuda link | `/play/hanafuda`: 8 cards in hand, 8 CPU, 8 field, "24 cards" stock; 48-card deck covering 12 months; no horizontal overflow | walk-prod.log, hanafuda-deal-desktop.png |
| same, `?seed=53` | drag Cherry Curtain onto Cherry Poetry Ribbon | hanko `花見酒 Hanami-zake · 5pt`, brush heading `Koi-koi? 来い来い？`, `aria-live="polite"`: "You formed Hanami-zake (5 pts) — Koi-koi?"; 1 `startViewTransition` call; 0 AudioContexts (sound off by default) | walk-prod.log |
| same | play the rest of the match as a person would (Koi-koi once, then Shobu; tap/click matches; place unmatched cards; choose between two field matches when asked) | phases play-hand → koi-koi-decision → round-over → choose-draw-match → … → **match-over** after rounds 1, 2, 3. Banner: "Shobu! CPU wins Round 3 with Ame-Shiko for 14 pts (×2). Score: You 21 pts · CPU 14 pts". "Play match again" deals round 1 | hanafuda-matchover-desktop.png |
| same | flip month pill `10 Maple` | "10 · Maple (紅葉) 645 commits · 2026 · SHIPPED (11) Shore … Planisphere … Design system · NOTES (1) Backfills are a feature" | walk-prod.log |
| same (negative control) | flip `03 Cherry` | "0 commits · Quiet workshop month — no shipped projects or notes recorded for Cherry." The repo's first commit is 2026-10-17, so empty months are truthful | walk-prod.log, git |
| same | flip one hand card's own back; then turn the sound toggle on and tap a card | card `data-flipped="true"`; AudioContexts 0 → 1, oscillators 0 → 13 | walk-prod.log |
| same, keyboard only | focus the hand, ArrowRight to Cherry Curtain, Enter | capture and "Koi-koi?" announced | walk-prod.log |
| **390×844 phone** (isMobile, hasTouch), finger taps | everything in the three rows above | same results: deal counts, Hanami-zake, full 3-round match to match-over, October/March backs, flip, sound opt-in; no overflow (sw 390) | walk-prod.log |
| **390×844**, `?seed=53` | tap Cherry Curtain, tap Cherry Poetry Ribbon (forms a yaku) | **Defect B.** The Koi-koi prompt with hanko and Koi-koi/Shobu buttons sits at **top −1015…−640 px** (scrollY 1747), off screen. The hand is disabled until the player decides. The only visible change is a small "花見酒 Hanami-zake (5pt)" pill. At 1366×768 the prompt is in view (top 63) | probe-prompt.mjs, prompt-mobile.png |
| production, 1366 and 390 | `/projects` → "Daruma shelf" | 11 red SVG dolls, shipped:8 and unfinished:3 shelves; eyes "both" ×8, "left" ×2, "none" ×1; hover/focus runs `daruma-wobble` | daruma-shelf-*.png |
| same | press "Daruma Kuyo" toggle; open `?view=daruma&kuyo=1` | 2 ink fires, `aria-live`: "Daruma Kuyo ink-fire ceremony lit: retiring 2 abandoned Daruma dolls (Structures, Design system) in sumi ink flames." | daruma-kuyo-mobile.png |
| same | compare the retired dolls to the site and the repo | **Defect C.** `/structures` and `/design-system` serve 200 and are live. Commit `8b0c491` (t-1674) changed `content/site.ts`: Barometer live→**building**, Structures live→**shelved, abandoned** (`started 2026-05-12`, `lastActivityAt 2026-06-20`), Design system live→**shelved** (`lastActivityAt 2026-06-01`). Those dates are before the repo existed (first commit 2026-10-17); Structures was added 2026-10-21 by pm-214. The **Cartridges** view on live `/projects` now prints "Barometer building", "Structures shelved", "Design system shelved". Hanafuda's October back says both shipped 2026-10-21 | curl /projects, `git show 8b0c491 -- content/site.ts` |
| production, 1366 and 390 | `/work` → "/making-of" link | 53 scenes, 4 ink figures (`emaki-figure-research/product_owner/software_engineer/quality_engineer`), each with title, date, 4 role badges and a GitHub commit link (`…/commit/db788b1cd8` → 200) | emaki-start-*.png |
| same | scroll down 40 % of the stage | progress 0.000 → 0.554, translate 0 → −9971.64 (−10307.26 on the phone), clouds −2492.91 vs pines −5484.40 (parallax) | emaki-scrolled-*.png |
| reduced motion, 1366; JS off, 390 | scroll; load the page | translate stays 0, `data-reduced-motion="true"`, 0 animations; JS off serves 53 `<li>` in the `<ol>` | walk-prod.log |
| `/making-of` scene for **pm-293** | compare its role badges with the board's run records for this plan | **Defect A.** Shows research `claude-sonnet-5-5`, product owner **`claude-opus-5-5`**, engineer `gemini-4-argon`, QA **`claude-sonnet-5-5`**. Real runs: run-9228 `--model claude-sonnet-5-5`; run-9229 (PO) `--model gemini-4-argon-medium`; SWE runs `gemini-4-argon-high`; QA run-9237/9244/9249 `gemini-4-argon-medium` | plan_manager_list_runs pm-293 (16/16 runs) |
| `/making-of` scenes pm-268, pm-288 | same comparison | pm-268 QA shown `claude-sonnet-5-5`; all 6 real QA runs (run-8917 … run-9241) used `gpt-6-sol`. pm-288 PO shown `gpt-6.1-sol`; run-9123 used `gpt-6-sol`. pm-288 shows an engineer and QA model, but it has 0 software_engineer runs | plan_manager_list_runs |
| `content/making-of.json` (served data) | count scenes whose 4 roles equal `DEFAULT_ROLE_MODELS` in `lib/making-of.ts` | **41 of 53** scenes show only the hard-coded defaults. Per-role models come from a hand-written `DEFAULT_PLAN_CATALOG` plus defaults, not from run history | node count |
| same, with `plan_manager_list_plans` statuses | classify scenes by plan status (28 of 53 readable; pm-171…pm-243 are older than the list) | 11 done, 1 accepting (pm-293), and **16 not shipped**: paused pm-288, 287, 286, 285, 282, 279, 276, 275, 273, 271, 269, 257; abandoned pm-277, 260, 248; executing pm-268. Several are a single plan-draft commit (pm-288, 286, 282, 279, 277, 276, 275) | node classify |
| local `next start -p 4093` of origin/main `e8f2667` (build `XRkvo84wzXirT1RjNZ-Jz`, same app code as 36ba86a), embedded Postgres 17 | the whole walk again, then read the server log | walk 48 ok / 0 failed. Defect B reproduces (prompt top −1015). The server log is 5 lines (start banner, `✓ Ready in 97ms`), **0** `error`/`⨯`/`warn` lines | walk-local.log, server-4093.log |
| repo at e8f2667, Node v22.23.3 | `TMPDIR=/tmp npm test` | 2567 tests, 2567 pass, 0 fail | npmtest.log |
| every walked page, both viewports, production and local | console errors, page errors, same-origin ≥400 responses | 0 | walk-*.log |

**Verdict: fail.** Most of what the idea asked for works on otohime.dev at
both 1366×768 and 390×844. Hanafuda Koi-Koi plays a whole three-round match
against the CPU by drag, tap or keyboard, with the hanko, the brush
"Koi-koi?", View Transitions, opt-in sound and truthful monthly card backs.
The Daruma shelf paints eyes, wobbles and lights a Kuyo fire on demand. The
Emaki scrolls sideways with parallax, honours reduced motion and works with
JS off. Three things still fail a person using it:

- **A. The Emaki's per-role model labels are false.** The idea asks that each
  shipped plan's scene be "labelled with … the model used per role", from an
  export of plan/run history. The labels come from a hand-written catalog and
  defaults. This plan's own scene names two wrong models. Every scene I could
  check against run records is wrong somewhere, and 41 of 53 scenes are pure
  defaults. 16 of the 28 scenes I could classify are plans that never shipped.
- **B. On a phone, the "Koi-koi?" decision appears off screen.** After a
  finger capture forms a yaku, the prompt and its two buttons are about 1000 px
  above the viewport. The hand goes inert and nothing on screen says why.
- **C. The Daruma board misreports the owner's projects.** To fill the
  unfinished shelf, three live projects were relabelled building/shelved with
  invented 2026-05/06 dates. The Cartridges view and the Kuyo ceremony now tell
  visitors that Structures and Design system were abandoned, while both pages
  are live and Hanafuda's October back lists them as shipped.

## Delivery

- **Deployed sha:** `36ba86a99f78ce93a8972c8e1f4d003242325469` on otohime.dev
  (Vercel); CI run `40539710809` (#522) success. It contains every delivery:
  t-1673 `c1c885c`, t-1676 `5fd1284`, t-1674 `8b0c491`, t-1677 `db788b1`,
  t-1675 `36ba86a`. There is one service, the otohime Next.js app.
- **Commit identity:** all 9 `pm-293/` commits (`086e991` … `e8f2667`) are
  authored and committed by `Otohime <quiinthieu@gmail.com>`, with 0
  `Co-Authored-By` trailers. No author.txt came with this run's evidence. The
  QA reports cite author.txt sha256 `7694250f…5ada` (44 bytes) with the same
  identity.
- **Integration deployed:** yes (health sha above). **Execution
  demonstrated:** yes, by my own browser walk on production and on a local
  build. **Product delivered:** no, because of defects A–C. **Waiting for
  capacity:** nothing.

## Real/fake boundaries and identities

- Real: live otohime.dev; the locked tree (`package-lock.json` sha256
  `9d0bded9b7c00b1d…`, `npm ci`); `next build` + `next start` (Next 16.4.2,
  build `XRkvo84wzXirT1RjNZ-Jz`); embedded Postgres 17 via
  `scripts/e2e.mjs --serve-db`; Google Chrome `/usr/bin/google-chrome` through
  playwright-core 1.64.0.
- Instrumentation, not fakes: an init script wraps `window.AudioContext` and
  `document.startViewTransition` to count calls and passes everything through.
- My scripts (out of tree, not committed): `/tmp/acc-9251/walk.mjs` (sha256
  `087a5c3474f68b0b…`), `/tmp/acc-9251/probe-prompt.mjs` (`efa647095487d1b1…`).
  Served data: `content/making-of.json` `38cacbebe4c36935…` (head `db788b1`),
  `content/yearly-log.json` `c3233c09fd9b3e21…` (head `086e991`),
  `lib/making-of.ts` `a9d5138d7b5dae3d…`.
- Screenshots and logs are under `/tmp/acc-9251/{prod,local}` on this lease
  and die with it. The table quotes their content.
- The walk's first pass reported 4 failures. All were selectors in my own
  script (the choice marker sits on the tile, not the button; the month pills
  use `flip-month-NN`). After fixing them, production and local each gave
  48/48. These were not product failures.

## History

- `plan_manager_list_runs(pm-293)`: complete, 16/16. All 15 earlier runs
  succeeded (research run-9228 claude-sonnet-medium; PO run-9229
  agy-argon-medium; SWE 9230/9232/9234/9236/9243 agy-argon-high; verify
  9231/9233/9235/9242/9248; QA 9237/9244/9249 agy-argon-medium). This run,
  run-9251, is `claude-opus-high` (`--model claude-opus-5-5`).
- `task_manager_list_tasks status=FAILED limit=20 offset=0`: 20 of 1174
  scanned (incomplete by design). 0 match a pm-293 tm_task_id or the string
  `pm-293`. The COMPLETED and FAILED filters by `project_id=otohime` returned
  empty objects, so per-project pagination was not available.
- Negative controls: March's back shows nothing invented; Koi-koi stays off
  screen only on the phone, not at 1366; reduced motion keeps translate 0;
  sound stays off (0 AudioContexts) until opted in.

## Deferred checks

None. Nothing here waits on capacity, an operator or a date.
