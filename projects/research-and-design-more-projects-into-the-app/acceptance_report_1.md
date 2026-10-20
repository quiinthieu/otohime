---
plan_id: pm-202
run_id: run-6800
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: 4c784c9a6faeed4833eaeda85266e14da5107b3f
---

# Acceptance: Rotor Enigma (pm-202)

**Verdict: pass.** A visitor to https://otohime.dev/rotor finds an Enigma I drawn in ink, listed in coral on /projects. They can encode on it with JavaScript off (the GET form) and with JavaScript on (real keyboard, clicks, taps). The share URL decodes back. It reads in light and dark, fits 390 px and 320 px, and keeps still under reduced motion. The site-wide part of the idea also holds: every isolation test reads its route groups from `app/`, and the two follow-up designs (Planisphere, Barometer) are their own plans pointing at research.md §4.2 and §4.3.

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| production, any page | read `<meta name="build-sha">` on /, /rotor, /projects | `4c784c9a6faeed4833eaeda85266e14da5107b3f` on all three; a937f40 (t-1158) and 1dec2aa (t-1159) are ancestors of it | curl; `git merge-base --is-ancestor` exit 0 |
| production | `BASE_URL=https://otohime.dev EXPECT_SHA=4c784c9… bash scripts/walk-rotor.sh` | `walk: 56 ok, 0 failed`, exit 0 (26 lamps, 26 keys, one GET form, `?m=AAAAA` → BDZGO, `?pos=ADU&m=AAAA` → BFY, bad fields fall back, no rough.js in client chunks, /projects links /rotor once) | walk log (first try failed 1 self-check because this checkout had no `node_modules`; after `npm ci`, 56/56) |
| JS off, 1366×768 and 390×844, light | type `ACCEPTANCE`, press Encode | tape code `BREWJRCMZC` = py-enigma (I-II-III, B, AAA, AAA) | Playwright + Chrome; py-enigma via `uv run --with py-enigma` |
| JS off, both widths | rotors V-I-III, rings QEV, start XYZ, reflector C, plugs `AZ-BY-CX-DW-KM`, message `MEETMEBYTHECLOCKTOWERATNOON`, Encode | code `FHTQPFHDOZDLOGLNNEHJNDJFQEX` = py-enigma; share line `/rotor?r=V-I-III&ring=QEV&pos=XYZ&ref=C&plug=AZ-BY-CX-DW-KM&m=…` | my own vector, not one the tasks pinned |
| same settings, JS off | paste the code into Message, Encode | lamps line reads `MEETMEBYTHECLOCKTOWERATNOON` | browser walk |
| JS on, 1366×768, light and dark | type `acceptance` on the real keyboard, holding each key | exactly one `[data-lamp].lit` while each key is down, none after release; the right window steps every key (AAA → AAK); tape `ACCEPTANCE` / `BREWJ RCMZC`; live region "Lamp C, letter 10"; address bar `…&m=ACCEPTANCE` | browser walk |
| new tab | open that URL, then "Open the code with these settings" | same tape `BREWJRCMZC`; then the lamps line reads `ACCEPTANCE` | browser walk |
| JS on, `/rotor?pos=ADU` | press A ×4 | windows `ADV AEW BFX BFY` (double step) | browser walk |
| JS on | change the left rotor to IV | URL becomes `r=IV-II-III…` | browser walk |
| JS on, 1366 | Tab to the drawn keys | focused key shows a 2px dashed outline | browser walk, screenshot |
| JS on, 390×844 touch, light and dark | tap the drawn A ×5 | `BDZGO`, URL `…m=AAAAA`, scrollWidth 390, no element past the edge | browser walk, screenshot (dark) |
| 320×640 dark, 10 plugs + 64-letter message | open | scrollWidth 320, 0 elements wider than the viewport | browser walk |
| paper | read `<html>` background | light `rgb(246,241,231)`, dark `rgb(29,25,22)` at 1366 and 390 | browser walk |
| reduced motion | hold A | lamp `--glow: 1` at once; 0 animations, 0 non-zero transitions, 0 `setInterval` calls | browser walk |
| /projects, light and dark | open | Rotor linked once, note "An Enigma, drawn by hand. Type and watch the lamps.", dot `rgb(239,106,76)` (coral); Shore, Capsule, Orrery, Elements and Vinyl still linked | browser walk |
| whole browser walk | console and page errors | none; `browser: 51 ok, 0 failed` | browser walk |
| repo at 4c784c9 | read the 8 `app/*/_lib/isolation.test.ts` (five old, Rotor's, and the newer Planisphere and Barometer) | each builds `GROUPS` from `readdirSync(join(ROOT, "app"))`, filtered to `(name)` dirs except its own; `OUTSIDE`/`SITE_DIRS` are derived from `GROUPS`; no literal group array | grep in a worktree at 4c784c9 |
| main | run the 8 isolation tests + Rotor's engine tests with node --test | 131 pass, 0 fail | node 22.23.3 |
| board | look up the follow-ups | pm-203 Planisphere (plan cites research §4.2, task t-1162 in QA) and pm-204 Barometer (plan cites §4.3 (pm-202)) exist with plans committed (c6b86fe, 52600ed) | plan_manager_get_plan pm-203; `projects/you-are-…-planisphere-tonight/plan.md`, `…-barometer-…/plan.md` |
| git | author of each delivery | a937f40, 1dec2aa and 4c784c9: author and committer `Otohime <quiinthieu@gmail.com>`, no Co-Authored-By trailer | `git log -1 --format='%an <%ae> | %cn <%ce>'` |

## Components and shas

- **otohime.dev (Vercel, production):** build-sha `4c784c9a6faeed4833eaeda85266e14da5107b3f`, served by `server: Vercel`, region hkg1. It contains all three deliveries: a937f40 (t-1158), 1dec2aa (t-1159) and 4c784c9 (t-1160).
- **CI:** `.github/workflows/ci.yml` gates `production` on `needs: checks`. From this lease the run itself could not be seen: there is no gh, and the private repo's Actions API returns 404. Production serves 4c784c9, so the production job ran for it.

## How it was walked

- Lease: macOS arm64, Node 22.23.3, Google Chrome (headless) through playwright-core in a scratch directory (not committed). Reference vectors came from py-enigma.
- My first browser pass reported 49 ok, 2 failed. Both failures were my probe reading `<body>` for the paper colour; the page paints `<html>`. With the probe fixed, the full rerun was 51 ok, 0 failed.
- Logs: there is no Vercel CLI or token on this lease, so I could not read the runtime logs. Every walked request returned 200, and the browser recorded no console or page errors.

## Not checked

- Lighthouse accessibility score (in the plan's QA list, not in any task's acceptance). I checked its inputs directly: focus rings, `aria-label` per key, the live region, and labelled fields.
- Planisphere and Barometer as products. They are separate plans (pm-203, pm-204); this plan only had to file them.
