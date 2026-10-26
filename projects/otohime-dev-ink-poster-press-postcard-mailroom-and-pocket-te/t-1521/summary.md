# t-1521 Postcard Mailroom: summary (run-8589, claude-opus-5-5)

## Delivered
- `lib/postcard.ts`: pure encode/decode/validate of `{sketch, note, ts}` as base64url JSON (short keys `s n t`).
  Allow-list of the twelve sketchbook sheets (pinned to `lib/sketches.ts` BASE_SKETCHES by test), 140 code-point
  cap (an over-long decoded note is refused, the picker cuts), C0/C1/DEL and bidi controls stripped, ts in 2020..2100,
  codes over 1024 chars refused before decoding.
- `lib/og.tsx`: shared ImageResponse helper, 1200x630, paper and ink, SVG postmark rung with the build date
  (`next.config.ts` env `BUILD_DATE`) and the page title; `postcardCard` draws the postcard.
- Stamps: `app/og/route.tsx` (shared, named by every root layout and `global-not-found` with `metadataBase`),
  plus `opengraph-image.tsx` in work, play, notes, music, projects, sketches and postcard.
- `/postcard` desk (pick, note, stamp, Download PNG, Share link via `navigator.share`, clipboard, then a
  select-to-copy field), `/postcard/view` (noindex, nofollow; generateMetadata points og/twitter at
  `/postcard/image?c=`), `/postcard/image` (PNG, 404 on a bad code, `X-Robots-Tag: noindex`, cached a day).
  `/sketches` links to the desk.

## Evidence (local, macOS, Node 22.23.3, Next 16.4.2 Turbopack, `next start` on :4123, no database)
| check | result |
| --- | --- |
| `npm ci && npm test` | exit 0, 1741/1741 pass (18 in `lib/postcard.test.ts`) |
| `npm run typecheck && npm run lint` | exit 0, 0 errors, the same 10 pre-existing warnings, none in touched files |
| `npm run build` | exit 0, 0 metadataBase warnings, `/og` and 7 opengraph-image routes static |
| `e2e/postcard.test.ts` (BASE_URL) | 5/5 pass: 13 pages (site, auth, 4 projects, dynamic children) each one absolute og:image whose path draws a 1200x630 PNG; desk; view; image; lost postcards |
| `desk-probe.mjs` (Chromium) | 22/22: ?s= preselect, click and arrow pick, over-140 warning, preview 1200 wide, download is a 1200x630 PNG, share copies the link (clipboard granted) or shows it (denied), view shows the note as text, no page errors |
| `share-probe.mjs` (navigator.share stubbed) | navigator.share called with the view URL, note and title |
| first-load JS (`firstload.mjs`, `chunks.mjs`) | `/` 17 scripts 1,214,294 B and `/play` 16 scripts 1,227,604 B, chunk hashes identical to the pre-change build |

Negative controls: deleting `metadataBase` from `app/(shore)/layout.tsx` turned the wiring test red (restored);
junk, empty and `../../etc/passwd` codes give a lost-postcard view and a 404 image; a note holding
`<script>` reaches the view escaped and the PNG as literal text.

## Boundaries and deferred checks
- Real: Next production build and server, Satori/resvg rendering, Chromium. Fake: `navigator.share` (stubbed;
  headless Chromium has none), no Postgres (pages under test do not need it).
- The deployed site was not checked (task stops at the push). Owner: QA. It fails if `https://otohime.dev/og`
  or `/postcard/image?c=<code>` is not a 1200x630 PNG in production.
- Emoji in a note are drawn by Satori from its emoji CDN at request time (seen working here); how the PNG looks with no outbound network is unverified.

## Fix cycle (run-8599, claude-opus-5-5): commit trailer
QA rep-4993 failed 93413db for one reason: its message ends with `Co-Authored-By: Claude <noreply@anthropic.com>`,
which plan.commit_identity forbids. That trailer was a mistake. 93413db is already on shared main under later commits
(cda79f5, fb11fbd), so it is not rewritten and nothing is force-pushed. The decider is asked to waive the old message.
This follow-up commit is authored by Otohime <quiinthieu@gmail.com> and carries no trailer.
`author.txt` records the identity and trailer check for both commits. The application code is unchanged.
Re-run on HEAD fb11fbd + this commit (Node 22.23.3, Next 16.4.2): `npm ci && npm test` 1756/1756 passed;
`npm run typecheck && npm run lint` exit 0 (0 errors, the same 10 earlier warnings); `npm run build` exit 0
(`/og`, `/postcard`, `/postcard/image`, `/postcard/view` present).

## Waiver (run-8615, claude-opus-5-5): no code change
The operator waived the Co-Authored-By trailer in the message of 93413db, and only that message (fix_plan rep-5001).
Nothing is rewritten and nothing is force-pushed. Checked on main: 93413db is an ancestor of HEAD and still has 1
`^Co-Authored-By:` line; 2f1680c and 7a0d917 have 0. This commit is authored by Otohime <quiinthieu@gmail.com>
and had 0 trailers before the push. The waiver does not cover later tasks: t-1522, t-1523 and t-1524 must have no trailer.
Gates re-run on HEAD a117f48 + this commit (Node 22.23.3, Next 16.4.2): `npm ci && npm test` 1791/1791 passed;
`npm run typecheck && npm run lint` exit 0 (0 errors, the same 10 earlier warnings); `npm run build` exit 0
(`/og`, `/postcard`, `/postcard/image`, `/postcard/view` present).
Still open, not waived and owned by acceptance: the otohime CI/deploy result for the delivered SHA, plus live fetches of
`/postcard`, `/postcard/view` and an og:image. Neither has been observed (this pod has no `gh`). Unobserved means unproven.
