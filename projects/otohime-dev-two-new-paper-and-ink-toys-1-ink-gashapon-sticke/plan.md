# Ink Gashapon and Shodo Desk

Plan pm-286, revision 1. Research is preserved in `research.md`. The requested extraction guide and `docs/claude/software-development.md` are absent from this checkout; follow `AGENTS.md`, the installed Next guide before route changes, and the contracts in `tasks.json`.

## Product outcome

Ship two linked Play toys without accounts, purchases, or server storage.

1. **Ink Gashapon and Sticker Book** at `/play/gashapon`: a hand-drawn capsule machine accepts a paper coin earned from exploration. Pointer drag rotates the crank; Space/Enter provides an equivalent turn. Sound uses the existing off-by-default sound gate. A capsule rolls out and cracks open to reveal an ink sticker. The catalog covers site projects, Spark, Airflow, DuckDB, music, and mascots. Common, uncommon, rare, and secret stock is finite within each local batch. The odds board uses the same remaining counts as the draw. A secret rare has a moving foil treatment with a static reduced-motion fallback. Duplicates remain visible in inventory. An album lets visitors place stickers by pointer or keyboard, persists normalized positions locally, and exports a PNG. Notes, Sketches, 404, and a Konami sequence each hide a one-time find. Coins are earned by unique page exploration and finds only.
2. **Shodo Practice Desk** at `/play/shodo`: a responsive washi canvas accepts pen, touch, and mouse. A multi-bristle brush drains ink, makes dry streaks, varies width with pressure and speed, and bleeds along deterministic paper fibres. A locally bundled, attributed KanjiVG subset supplies a daily stroke-order ghost. Gentle order and shape feedback never blocks saving. Visitors can reload the brush, sign with a vermilion seal, download or share a composed PNG. The seal uses pm-285's pure Hanko generator when present at integration, with a compatible local fallback otherwise. The same brush language animates selected section headings and an ensō loader; reduced motion reveals a static final state.

## Boundaries and proof

- Keep collection and sheet state on the device. Validate versioned localStorage data and retain memory-only operation when storage is denied. Never add a payment or server collection endpoint. Do not leak a visitor name or sheet into a URL.
- Model stock, coins, input matching, brush deposition, daily selection, scoring, and export geometry as pure functions with deterministic fixtures. Browser components own drawing and interaction. Cap canvas DPR and bristle/sample work; no runtime third-party asset fetch.
- Bundle a curated KanjiVG subset with its source and CC BY-SA 3.0 attribution and carry that attribution on the Shodo page and exported sheet. Verify that the bundled stroke paths and attribution actually ship.
- Preserve existing Play toys and pinned global navigation labels. Use semantic accessible controls and text; test headings by role because RisoText duplicates visual ink text. Only the drawing canvas suppresses touch scrolling.
- The relevant installed Next 16.4.2 docs are required before changing routes or client boundaries. Run `npm ci` in fresh leases. Move a stale `.next` aside if its Turbopack font cache reproduces the documented failure.
- Each task proves its code now with checkout commands, fixtures, and local browser interactions. Engineers stop at the push. Green gate, QA and acceptance independently inspect the delivered SHA, CI/deploy evidence, browser behavior, and negative controls. They distinguish code built, production deployed, execution observed, and actual PNG delivered; a queued job or unrelated green SHA is insufficient. Evidence includes bounded complete history where applicable and raw failures; unread pages remain inconclusive.

## Task DAG

| # | Contract | Depends on | QA |
| --- | --- | --- | --- |
| 1 | Finite sticker stock and coin model | — | skip |
| 2 | Gashapon machine and Play entry | 1 | required |
| 3 | Sticker album and PNG export | 1, 2 | required |
| 4 | Hidden sticker hunt | 1, 3 | required |
| 5 | Multi-bristle brush engine | — | skip |
| 6 | Daily kanji and gentle scoring | — | skip |
| 7 | Shodo desk, seal and export | 5, 6 | required |
| 8 | Brush headings and ensō loader | 5, 7 | required |

The Gashapon and Shodo chains can progress independently. Task 7 does not depend on pm-285. A prerequisite only a person can establish is raised as an operator action at the start of the first affected task; unrelated tasks proceed. Fleet capacity is submitted to the durable scheduler, never treated as a person chore. No task relies on a natural run, soak, or clock.

## External capabilities

`prerequisites.json` declares existing GitHub repository delivery, the software-engineer fleet, GitHub Actions, and Vercel production. No new product service, credential, purchase, or runtime API is required. Typed probes are control-plane or runner-specific and do not prove the other side. A failed adapter probe is recorded as inconclusive rather than claimed ready. Production browser verification and CI status belong to QA/acceptance.

## Acceptance walkthrough

At the deployed commit, open Play and both new routes on desktop and mobile. Turn the machine with pointer and keyboard, inspect the stock table before and after, reload without rerolling, collect a duplicate and a hidden find, place a sticker, reload, and inspect the exported PNG. Denied localStorage and reduced motion are negative controls. Confirm no purchase path and sound off before gesture. On Shodo, trace a bundled kanji with pen and mouse fallback, deliberately reverse a stroke for gentle feedback, exhaust and reload ink, sign and inspect an exported PNG, then check the same sheet under reduced motion. Confirm attribution, readable headings, the ensō final state, and absence of console errors. QA must inspect independent browser/network evidence at the cited SHA, not merely repeat the engineer's test summary.
