---
plan_id: pm-213
run_id: run-7053
kind: acceptance_report
verdict: pass
cycle: 1
---

# Acceptance: The Otohime Gazette (pm-213), cycle 1

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev, signed out, Chrome 1366×768 and 390×844, light scheme | Open `/projects` | Nine project rows; the last is "Gazette", live badge, note "A small newspaper: six short pieces…", with a pink dot (`rgb(243, 166, 187)` = the site's `--pink`), one link to `/articles` | walk.mjs "lists Gazette once", "dot is the site's pink"; `shots/1366x768-projects.png` |
| `/projects` | Click "Gazette" | A broadsheet front page at `/articles`: the only `h1` is the blackletter masthead "The Otohime Gazette" (UnifrakturMaguntia loaded) between double rules; the dateline `Vol. I · No. 1 · Wednesday, 21 October 2026 · otohime.dev · Free`; the sky lead with its drawn figure above the fold (svg y 212–623 at 1366×768, 349–588 at 390×844); five ruled story cards in three columns at 1366 and one at 390, in the edition's order; the title carries `project-articles` for the hop | walk.mjs front checks ×2 viewports; `shots/1366x768-front-fold.png`, `390x844-front-fold.png`, `*-front-full.png` |
| `/articles` | Click "Read on" under the lead | `/articles/why-the-sky-is-blue`: one `h1`; a rough.js infographic (`svg role="img"` with an aria-label, 102 paths, 14 labels, smallest label 12.7 px at 390) with a caption; at 1366 the body sits in two justified columns with a column rule and a red drop cap; at 390 one start-aligned column; 261 words; three numbered https sources; dated byline "Wednesday, 21 October 2026 · 2 min read"; no Previous, Next → leap day | walk.mjs story checks; `shots/1366x768-story-sky.png`, `390x844-story-sky.png` |
| the sky story | Click Next, then Next | The leap-day story, then the GPS story, each with the same shape and Previous/Next pointing at their neighbours in edition order | walk.mjs "Next points at…", "Previous points at…" |
| the GPS story | Click "← Front page" | Back on `/articles` | walk.mjs "Front page link returns to /articles" |
| `/articles` | Open the other three stories directly, then `/articles/nope` | Gigabyte, ice and tides stories pass the same checks (tides has no Next); `/articles/nope` is HTTP 404 and says "Not in this edition." with a link back to the front page | walk.mjs; `shots/1366x768-404.png` |
| Chrome with JavaScript off, both viewports | `/projects` → Gazette → Read on → Next → Next → Front page → All projects; `/articles/nope` | Every step lands on the right page by plain links; the figure is whole at rest (labels visible, strokes drawn); the 404 returns 404 with an empty body, as the house's static not-found pages do without JS | walk.mjs nojs section; `shots/*-nojs-story.png` |
| dark scheme, both viewports | `/articles`, `/articles/why-ice-floats` | Paper `#171513`, ink `#e8e1d4`, the spot red `#e07a6a` on the figure | walk.mjs dark checks; `shots/*-front-dark.png`, `*-story-ice-dark.png` |
| print media | `/articles/why-ice-floats` | White page, black ink, top bar and Previous/Next hidden, no grain; a PDF renders | walk.mjs print check; `shots/1366x768-story-ice-print.png` |
| 320×640 | `/articles`, `/articles/how-tides-work` | No sideways scroll | walk.mjs "fits 320 px" |
| motion on / reduced motion, 1366 | `/articles/how-tides-work` | Motion on: 27 ink-draw/label-rise animations run once and none run after 2 s, labels at opacity 1. Reduced motion: nothing animates and the figure is whole at load | walk.mjs motion checks |
| terminal | `EXPECT_SHA=c28759f… BASE_URL=https://otohime.dev bash scripts/walk-articles.sh` | `walk: 153 ok, 0 failed`, exit 0 (also 153/0 earlier at 1849711) | `/tmp/pm213-acc-walk2.log`, `/tmp/pm213-acc-walk.log` |
| terminal | `BASE_URL=https://otohime.dev bash scripts/probe-motion.sh` | `probe: 462 ok, 0 failed`, exit 0, first run: /projects → /articles hops at 1366 and 390 with the title morphing as `project-articles`, reduced-motion hops at 0 ms, nine rows rise in order | `/tmp/pm213-acc-probe.log` |
| the tides story | Check every number against its linked sources | 24 h 50 min: Wikipedia "Tide" gives M2's period as 12 h 25.2 min, half a lunar day. Moon ≈ 2.2× the Sun: Wikipedia "Tide" has the 2.2 figure; NOAA's tutorial says the Sun's tide-generating force is about half the Moon's. Spring and neap: NOAA tides06 | curl of the three sources, this run |

**Verdict: pass.** A person on otohime.dev can open the Gazette from the Projects bench, read a newspaper front page with a lead story and its infographic above the fold, open each of six short illustrated articles with sourced numbers, step through them with Previous/Next, and get back to the front page, with or without JavaScript, on a laptop and a phone, in light and dark, and on paper. That is what the idea asked for.

## Shas and identity

- **Delivery shas:** t-1216 `bda6a0044071c24b40856471ff731d30ffb19983`, t-1217 `184971134f52fed9c1699b49dc8c7afa3c256517` (both on `main`).
- **Deployed sha (cited):** `c28759f4c795cb007df76636c8b078193e900f4a`, read from `<meta name="build-sha">` on `/articles`, `/projects` and `/articles/how-tides-work` at 2026-10-21 04:38Z. It is the QA-report commit; `git diff --stat 1849711..c28759f` touches only `projects/…/qa-t-1217.md`, and `git merge-base --is-ancestor 1849711 c28759f` exits 0. When this run started (04:30Z) production served 1849711; the first production walk passed 153/0 at that sha, and both walks were rerun at c28759f.
- **Commit identity:** `git log -3 --format='%an <%ae> | %cn <%ce>'` gives `Otohime <quiinthieu@gmail.com>` for author and committer on bda6a00, 1849711 and c28759f; zero trailer lines. No author.txt came with the delivery evidence, so the identity is read from git.
- **Service:** the Gazette is prerendered HTML on Vercel. This lease has no Vercel token, no `vercel` CLI and no `gh` login, so the deployment's logs are not readable from here. In their place, every page load in the browser walk collected console errors and page errors: none on any page, apart from the browser's own 404 line when `/articles/nope` is opened on purpose. The motion probe's console check also passed.
- **Repo tests on this lease (c28759f):** `npm run lint && npm run typecheck && npm test` exit 0, 859 pass, 0 fail.

## How it was walked

Headless Google Chrome (playwright-core 1.64.1, `channel: "chrome"`) against https://otohime.dev, at 1366×768, 390×844 (`isMobile`, touch, DPR 2) and 320×640, light and dark, JavaScript on and off, print media, motion on and reduced. The script (`/tmp/pm213-acc/walk.mjs`, scratch, not committed) prints one `ok -` / `not ok -` line per check. Final run at c28759f: 253 ok, 0 failed, exit 0 (`/tmp/pm213-acc/walk2.log`). First run at 1849711: 251 ok, 2 failed, the two being the build-sha stamp after production moved to c28759f mid-walk.

## Observations, not blocking

1. **The previous page stays in the DOM, hidden, after a soft navigation.** After "Read on", the body holds two `.gazette` roots: the story, and the front page with `style="display: none !important"`. After Next, Next there are three. This is Next 16's Activity segment cache; `/orrery/sun → /orrery/mercury` leaves two `.orrery` roots and `/projects → /work` leaves two `h1`s, so it is house-wide and predates the plan. Nothing is painted twice (the full-page screenshot and `scrollHeight` match the visible story), no view transition stays active, and a 40-press Tab walk never entered a hidden copy. Checks that count `h1`s or links in the whole document after a soft navigation must scope to `body > .gazette:visible`.
2. The three follow-ups in the QA report stand: the no-JS 404 body is empty (house shape), axe's moderate duplicate-banner note (two top-level `header`s), and the ice story's `Ice_Ih` source now redirects to "Phases of ice".
