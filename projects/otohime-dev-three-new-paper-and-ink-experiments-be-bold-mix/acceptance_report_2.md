---
plan_id: pm-293
run_id: run-9272
kind: acceptance_report
verdict: pass
cycle: 2
cited_sha: 9cc593e9d0c99e9f7f06ae293edfbaba8bbabbff
---

# Acceptance: Washi Daruma, Emaki, and Hanafuda (pm-293), cycle 2

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev, 2026-10-28 | `GET /api/health` at start, then again after the walk | `400034a28715aa43bc1346f1ba917371df1a909e` at the start. `9cc593e9d0c99e9f7f06ae293edfbaba8bbabbff` (pm-268 Ink Lab, CI #528) after it. Both contain every pm-293 delivery (c1c885c, 5fd1284, 8b0c491, db788b1, 36ba86a, 68bde4a, 7ad719f, 400034a; `git merge-base --is-ancestor` 0). `git diff 400034a 9cc593e` touches no pm-293 file. The full walk was run on both | curl, git |
| GitHub Actions | runs for `400034a` and `9cc593e` | #527 `40562704334` success (400034a); #528 `40564127414` success (9cc593e) | GitHub API |
| plan_manager DB (`runs.profile_flags --model`, 33 `done` otohime plans + pm-293) | my own SQL: latest succeeded run's model per plan × role | 133 rows; `diff` against `content/making-of.json` (sha256 `3c358643…`) is **identical**. Roles with no run: pm-272 research and product owner, pm-255 research | sql, db.tsv/json.tsv |
| 1366×768, mouse | `/work` → `/making-of` link | 34 scenes. Badges in the DOM equal ground truth (133/133, 0 mismatches). 3 `emaki-role-absent` slots ("— skipped", no `data-model-id`). 4 ink figures. Commit link `…/commit/d3b2e1f4d7` returns 200. No horizontal overflow | walk-prod2.log |
| same (negative control) | look for the 20 unshipped or paused plans (pm-288…pm-171, pm-274) | 0 present | walk-prod2.log |
| same | wheel-scroll the stage | progress 0 → 0.361, translate −4039, clouds −1010 vs pines −2222 (parallax) | emaki-scrolled-desktop.png |
| 390×844 phone (touch) | same Emaki path, scroll | same 34/133/3 result, progress 0 → 0.287, parallax layers differ | walk-prod2.log |
| reduced motion 1366; JS off 390 | load and scroll `/making-of` | translate stays 0, `data-reduced-motion=true`; JS off serves 34 scenes in the `<ol>` | walk-prod2.log |
| 1366 and 390 | `/play` → Hanafuda link | 8 hand / 8 field / 8 CPU / 24 stock; 48-card deck over 12 months; no overflow | hanafuda-deal-*.png |
| same, default seed | play a whole match by click (1366) and finger tap (390): match captures, discards, choices, Koi-koi first then Shobu, Next round | Each Koi-koi? prompt (hanko + brush "Koi-koi? 来い来い？" + both buttons) and each round-over and match-over banner is **inside the viewport**. Phone: prompt top 557 / bottom 832 of 844, fixed. Desktop: 12–182, sticky. Focus lands on `decide-koi-koi`, `next-round-btn` and `play-again-btn`. The aria-live text reads "You formed Hanami-zake (5 pts) — Koi-koi?". Match-over: "CPU wins Round 3 with Ame-Shiko … You 21 pts · CPU 14 pts" | walk-prod2.log, hanafuda-matchover-*.png |
| **390×844**, `?seed=53`, scrolled past the hand (scrollY 2743) | tap Cherry Curtain, then tap the Cherry field card. This reproduces cycle-1 defect B | The prompt is at 557–832 with buttons at 742–775 and 784–816. Focus is on Koi-koi. 1 View Transition. Shobu shows the round banner at 686–832 | hanafuda-seed53-phone.png |
| same | flip month `10`, then `03` (negative control) | October: "660 commits · SHIPPED (11) … Barometer … Structures … Design system". March: "0 commits · Quiet workshop month" | walk-prod2.log |
| same | press play while sound is off, then turn the sound toggle on and tap a card | AudioContexts 0 → 1 (sound is opt-in) | walk-prod2.log |
| 1366 and 390 | `/projects` (Cartridges) | All 11 projects are labelled LIVE. No "building" or "shelved" anywhere | walk-prod2.log |
| same | switch to "Daruma shelf" | 11 red SVG dolls, all on the shipped shelf with `eye-state=both`. Unfinished shelf shows an honest empty state ("All 11 current projects have shipped…"). Hovering or focusing runs `daruma-wobble`; `daruma-paint-eye` is present | daruma-shelf-phone.png |
| same | Light Daruma Kuyo on the real board | "no abandoned Daruma dolls to retire", 0 fires | walk-prod2.log |
| same | `?view=daruma&fixture=kuyo&kuyo=1` | 3 badged demo dolls (left, left+abandoned, none+abandoned), 2 ink fires, 10 flame/ember animations. The 11 real dolls stay two-eyed | daruma-kuyo-fixture-*.png |
| same (negative control) | `?fixture=bogus&kuyo=1&now=2027-12-31` | fixture inactive, 0 fires, 0 demo dolls | walk-prod2.log |
| every walked page, both viewports | console errors, page errors, same-origin ≥400 | 0 | walk-prod.log, walk-prod2.log |
| local `next start` of exactly `400034a` (build `YLGo1AZf7Y3RPLdcxFjqE`), embedded Postgres 17 via `scripts/e2e.mjs --serve-db`, Node 22.23.4 | same 50-check walk; then read the server log | 50/50 ok. Server log is 5 lines (banner, Ready), 0 error/⨯/warn | walk-local.log, server-4098.log |
| worktree at `400034a`, Node 22.23.4 (official tarball, SHA256 checked) | `TMPDIR=/tmp npm test` | 2573 tests, 2573 pass, 0 fail | npmtest.log |

**Verdict: pass.** All three experiments work for someone visiting otohime.dev,
at both 1366×768 and 390×844. All three cycle-1 defects are gone:

- **A.** The Emaki now shows only the 34 shipped plans. Each role badge is
  the model of that role's latest successful run in plan_manager. My own query
  matched the page row for row. Roles that never ran are shown as skipped.
- **B.** On a phone, the Koi-koi? decision and the round-over and match-over
  banners appear inside the viewport, with focus on the main button. This held
  for every decision in a full tap-played match and in the cycle-1 repro.
- **C.** `/projects` shows the 11 live projects as live, with two-eyed dolls.
  The unfinished shelf and the Kuyo say honestly that nothing is unfinished.
  The ceremony can still be shown on demand with an opt-in, badged demo
  fixture. The Daruma board agrees with Hanafuda's October back.

## Delivery

- **Deployed sha:** `9cc593e9d0c99e9f7f06ae293edfbaba8bbabbff`, CI #528 success.
  The pm-293 tip is `400034a28715aa43bc1346f1ba917371df1a909e`, CI #527 success,
  which production served at the start of this run. Both were walked. There is
  one service, the otohime Next.js app (Vercel).
- **Commit identity:** all 17 `pm-293/` commits on origin/main are authored
  and committed by `Otohime <quiinthieu@gmail.com>`, with 0 `Co-Authored-By`
  trailers. `scripts/setup-owner-git.sh --check` returns the same identity. No
  author.txt came with this run's evidence. The QA reports cite author.txt
  sha256 `7694250f…5ada` with the same identity.
- **Integration deployed:** yes. **Execution demonstrated:** yes, by my own
  walk on production (twice) and on a local build. **Product delivered:** yes.
  **Waiting for capacity:** nothing.

## Real/fake boundaries and identities

- Real: live otohime.dev; plan_manager Postgres (read-only SQL);
  `package-lock.json` sha256 `9d0bded9b7c00b1d…` with `npm ci`; Next 16.4.2
  `next build` + `next start`; embedded Postgres 17; Google Chrome via
  playwright-core 1.64.0.
- Instrumentation, not fakes: an init script counts `startViewTransition` and
  `AudioContext` construction and passes everything through. The Kuyo demo
  dolls are the product's own opt-in fixture. No fake runtime was used.
- Served data at 400034a: `content/making-of.json` `3c358643baf7b6e1…`,
  `content/yearly-log.json` `7916708e6d5f025e…`, `content/site.ts`
  `5bf5875b6df1a134…`, `lib/making-of.ts` `430cac9a2e19f8d8…`.
- My script `/tmp/acc-9272/walk.mjs` (sha256 `dd8246b6e1f4a41c…`) is out of
  tree and not committed. Logs and screenshots live under `/tmp/acc-9272/` on
  this lease and die with it; the table quotes them.
- The first local walk failed 11/14 because I started `next start` without
  `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`, so every page was a 500. With the env
  `scripts/e2e.mjs` sets, the same build gave 50/50. That was my harness, not
  the product.

## History

- `plan_manager_list_runs(pm-293)`: complete, 27/27. 26 succeeded and 1 is
  running (this run). DB: 0 run errors, 0 callback apply failures.
  Profiles: research run-9228 claude-sonnet-medium; PO run-9229/9252
  agy-argon-medium (`gemini-4-argon-medium`); SWE agy-argon-high
  (`gemini-4-argon-high`); QA agy-argon-medium; acceptance run-9251 and this
  run-9272 claude-opus-high (`claude-opus-5-5`).
- `task_manager_list_tasks status=FAILED limit=20 offset=0`: 20 of 1178
  scanned (incomplete by design). 0 match `pm-293` or any pm-293 tm_task_id.
  PENDING: empty.
- Negative controls: unshipped plans are absent from the Emaki; March's back
  is empty; a bogus fixture with a December 2027 clock burns nothing; sound
  stays off until opted in; reduced motion keeps translate at 0.

## Notes for the owner (not defects)

- In 14 role slots across shipped plans, more than one model succeeded (e.g.
  pm-241 engineer: 4× gemini-4-argon-high, then claude-opus-5-5). The badge
  shows the latest. That is true, but listing every model would say more.
- `qa_report_t-1680.md` claims a SQL cross-check naming pm-144, pm-209, pm-215
  and pm-253, which are not otohime plans. It also says pm-214 lacks research,
  which is wrong. The product is correct; the report's narrative is not
  reliable evidence.

## Deferred checks

None. Nothing here waits on capacity, an operator or a date.
