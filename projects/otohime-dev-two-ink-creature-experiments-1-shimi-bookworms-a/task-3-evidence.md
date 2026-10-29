# t-1772 — Inkblot fold-the-paper toy, gallery, OG, /play link

Plan `pm-300`, task 3. Verified locally on 2026-10-29 in this worktree.
Owner identity: `Otohime <quiinthieu@gmail.com>` via `bash scripts/setup-owner-git.sh --check`.

## Delivered interfaces

- `app/(site)/(app)/play/inkblot/page.tsx`: Server page, `FigTitle n="03d"` without `morph`, `ViewTransition`.
- `app/(site)/(app)/play/inkblot/inkblot.css`: paper tokens; `prefers-reduced-motion: reduce` last.
- `app/(site)/(app)/play/inkblot/opengraph-image.tsx`: request-time daily blot (`connection()`), Satori `circle`/`path` (no `<ellipse>`), every text `div` has `display:flex`.
- `app/(site)/(app)/play/inkblot/_components/inkblot-studio.tsx`: daily / seeded / drip modes, pointer + keyboard drip, fold mirror + SVG bleed, patients' notes gallery, pseudo-reading, honeypot. Client clock lives on `Plate.now` so prerender never calls `new Date()` in the component body.
- `app/(site)/(app)/play/page.tsx`: discovery card `data-testid="play-inkblot-link"`.
- `e2e/inkblot.test.ts`: play link, seeded determinism, drip/fold symmetry, reduced-motion fold, observation + negative URL/profanity.

## Checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0, 13 pre-existing warnings outside task files |
| `lib/inkblot.test.ts` + terminal/sound/shimi units | 80 pass |
| `lib/motion.test.ts` + `lib/terminal.test.ts` | 127 pass |
| `npm run build` | Exit 0; `/play/inkblot` ◐ PPR; OG `ƒ /play/inkblot/opengraph-image-1vvig8` |
| Production `GET /play/inkblot` | 200, hydrates studio |
| Seeded `?b=otohime7` | `role="img"` alt includes `seed otohime7`; 40 left / 40 right, exact mirror |
| Random drops + Fold | 39 / 39, exact `cx` mirror |
| Observation form | Immediate reading + toy disclaimer |
| `GET /api/inkblot/answers?blot=otohime7` | 200 `{entries:[],nextCursor:null}` |
| `POST` URL | 400 `reason:url` |
| `POST` valid note | 201 pending `{id,blotKey,status,tilt,hand}` |
| OG hashed route | `image/png` 1200×630, 59421 bytes |
| `npm test` | 2786 pass / 13 fail, all sandbox Chrome / embedded-Postgres / gate-closure preflight |
| Playwright `e2e/inkblot.test.ts` | Chrome `browserType.launch` blocked in this agent sandbox |

Orca browser drove `/play/inkblot?b=otohime7`, drip mode, fold, and the observation form. Gallery specimens render. Pinned note needs a matching `Origin` (`BETTER_AUTH_URL`); curl against `http://localhost:4027` with that origin returned 201.

`content/history.json` is build-generated and is restored before commit.
