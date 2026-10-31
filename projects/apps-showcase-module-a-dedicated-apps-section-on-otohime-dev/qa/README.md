# QA Suite — Ink Apps Workshop (`pm-303` / `t-1882`)

Executable `platform.role-suite.v1` verification suite for plan `pm-303` (`Ink Apps Workshop`), task `t-1882`, run `run-10090`.

## Required Coverage

- `t-1882:sha256:0589346a70c8df8f407cf7a5016267205eb159078e44e35dc1b8a0380078da4a`
  > Adding a JSON file in `content/apps/<slug>.json` populates `/apps` and `/apps/<slug>` without code changes; Apps appears in the main sidebar nav and Pocket Terminal (`go apps` / `apps`) while `CONSOLE_MENU` stays at 7 items; `/apps` renders all four app cards (Bento, Niwa, Kakeibo, Shiki) with carved hanko status stamps, platform badges, generated ink illustrations, and accessible platform/status filters; `/apps/[slug]` renders each app's hero, description, key features, copyable install snippet, 5-stage lifecycle and milestones, dated changelog, and repo/Homebrew/zero-backend follow links (with HTTP 404 for unknown slugs); and `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.

## Cases & Budget (`declared_s = 900 <= budget_s = 1800`)

1. `t1882-data-nav-and-dropin-contract` (`timeout_s: 30`, `check_data_and_nav.mts`)
   - Real imports of `lib/apps.ts`, `lib/apps-server.ts`, `lib/pages.ts`, `lib/terminal.ts`, `lib/hanko.ts`, and `content/apps/*.json`.
   - Verifies the 4 initial manifests (`bento`, `niwa`, `kakeibo`, `shiki`), zero-code drop-in discovery of a 5th JSON manifest (`suzuri.json`), `AppManifestValidationError` rejection on unsafe/duplicate manifests, `PUBLIC_PAGES` `/apps` entry after `/sketches`, `CONSOLE_MENU` 7-item invariant (`menuBaseline(6) === -105`), and Pocket Terminal `apps` / `go apps` navigation.
2. `t1882-lint-typecheck-and-unit-tests` (`timeout_s: 120`, `check_gates.mjs`)
   - Executes `npm run lint`, `npm run typecheck`, `TMPDIR=/tmp npm test`, and `DEPLOY_AUTHOR_EMAIL=quiinthieu@gmail.com node scripts/check-deploy-author.mjs`.
3. `t1882-build-and-browser-user-journey` (`timeout_s: 300`, `check_browser_journey.mjs`)
   - Runs `TMPDIR=/tmp npm run build`, starts `next start` on an ephemeral localhost port, and drives headless Chromium (`playwright-core`) across `/`, `/apps`, `/apps/{bento,niwa,kakeibo,shiki}`, a dynamically dropped-in 5th manifest `/apps/zzzz-qa-workshop-probe` (blueprint fallback), and `/apps/unknown-nonexistent-slug-404` (HTTP 404), verifying zero console/page errors and zero horizontal overflow at `1280x860` and `390x844`.
