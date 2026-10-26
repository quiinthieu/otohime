# Plan pm-249: Ink Poster Press, Postcard Mailroom, Pocket Terminal

Product name: **Postcard Press Terminal**

Order (from research rep-4922, no new dependencies): Mailroom, Terminal shell, Adventure, Press.
Every task runs `npm ci` first (the pod checkout has no node_modules). Next is 16.4.2 with breaking
changes: read `node_modules/next/dist/docs/` (ImageResponse, metadata files) before coding.
Constraints: one stylesheet per layout (lib/motion.test.ts and design-system sibling counts, so name any
new sheet explicitly in both); season tints keep 4.5:1 on untinted text tokens; lazy chunks only, so first-load
JS of `/` and `/play` must not grow.

## 1. Postcard Mailroom
- `lib/postcard.ts`: pure encode/decode/validate of {sketch id, note<=140, ts} as base64url; allow-listed sketch ids; control chars stripped.
- Shared `lib/og.tsx` (ImageResponse 1200x630, paper and ink, SVG postmark with build date and page title, flex only).
- OG images per segment, `/postcard` picker, `/postcard/view` (noindex), `/postcard/image` (png), download/share buttons.
- No DB. Note is escaped in JSX.

## 2. Pocket Terminal shell
- Tiny loader in the (site) layout; lazy `import()` of the palette on `/` or Cmd/Ctrl-K. Accessible dialog, capture-phase keys so the handheld ignores them.
- Commands: help, go, theme, sound, season, stamps, clear, adventure (stub until task 3).

## 3. Adventure
- `lib/adventure.ts` pure state machine, ~8 rooms, 4 secrets, stamp unlock, localStorage progress in try/catch.

## 4. Ink Poster Press
- `lib/ink-press.ts` seeded layouts (stamp, riso, brush), text fit, filenames; lazy WebGL2 shader on Play; PNG export at 1080x1350 dried frame; reduced-motion static; SVG filter / Canvas2D fallback; `?s=` seed.

## Evidence rules
All proof is on demand (unit tests, build, e2e with Playwright). No scheduled behaviour, no operator actions needed.

## Cycle 2: get main onto otohime.dev (change request 1)
Facts: tasks 1-4 above are done and on main (a847437+), but production serves build-sha
`c38f72a6e927` (45 commits behind), so the terminal and the /play press are absent. Postcard works live.
`/api/health` returns only `{ok:true}`; the sha is only in `<meta name="build-sha">`. The `production` job in
`.github/workflows/ci.yml` runs only after the whole `checks` job is green, so a red step in `checks` on main
(lint, typecheck, unit, ask:check, migrations, build, e2e, motion probe, footer walk/probe) silently keeps prod stale.
No operator action is assumed: the repo already has Vercel secrets, and the first task proves it from a local run.

1. Health reports the build: `/api/health` returns `{ok, sha}` from `BUILD_SHA`; unit test; README note.
2. Make `checks` green on main: run each CI step locally in order, fix whatever is red (including the terminal and
   press e2e, which must run in CI), push so the production job runs.
3. Close the loop: production job asserts `/api/health` sha equals `GITHUB_SHA` (retry, bounded) and runs the
   pocket-terminal and ink-press e2e against https://otohime.dev; `scripts/verify-deploy.sh` does the same on demand
   (`BASE_URL`, `EXPECT_SHA`). Acceptance re-runs against the live sha; it fails if the dialog or press is missing.
