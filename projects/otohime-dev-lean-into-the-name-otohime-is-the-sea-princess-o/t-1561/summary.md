# t-1561 · Open Tamatebako · summary (run-8935)

Plan pm-271 (Ryugu Palace Experience, part 2), task contract 3 of plan.md. Role: software engineer, Opus 5.5.

## Delivered

- `app/(ryugu)/_components/tamatebako.tsx`: a lacquered box button (`aria-expanded`, `aria-controls`). Opening it lets out a
  brief smoke puff (about 1.4 s) and shows the changelog replay. The scrubber is a native `<input type="range">` over the
  static index, oldest commit to newest, so arrows, Home/End, Page Up/Down, drag and tap all work. `aria-valuetext`
  reads each commit's date, subject, position and paper age. The leaf shows the real commit date (UTC), subject,
  short sha, plan/task and the changed-file areas. With no indexed commits, the box says it is empty and shows no scrubber.
- `app/(ryugu)/_lib/tamatebako.ts`: pure functions. `replay()` turns content/history.json into scrubber positions and
  drops malformed entries. `ageAt()` maps position to age (0 at the newest commit, 1 at the oldest, strictly
  progressive). `paperAt()` yellows the paper, fades the ink and brings up foxing as age grows. `stamp()` prints dates
  in UTC. `valueText()` builds the scrubber's spoken value. `opening()` skips the smoke under reduced motion.
- The replay calls itself what it is: "A changelog replay … The site itself is not rebuilt as it was: only the
  paper ages." It does not reconstruct old site versions (non-goal).
- `app/(ryugu)/ryugu/page.tsx` imports `@/content/history.json` at build time. `/ryugu` stays static (○).
  `_lib/isolation.test.ts` gets one narrow exception for this import: that specifier, in page.tsx only.
- `ryugu.css`: the box, smoke and leaf styles. The smoke animation runs only under `prefers-reduced-motion:
  no-preference`. The one reduced-motion block hides the smoke, and the lid's transition goes to 0 s there.

## Tests

- `app/(ryugu)/_lib/tamatebako.test.ts` (8 tests) checks:
  - positions match the committed history.json entries;
  - empty and malformed indexes give an empty box;
  - age is monotonic, and the paper yellows at every step back;
  - dates print in UTC;
  - `valueText` reads correctly;
  - reduced motion opens with no smoke;
  - the source's replay label, range input and empty state are present.
- npm test picks the new file up through the existing `app/(ryugu)/_lib/*.test.ts` glob. `wiring.test.ts` now
  requires it too. package.json needed no change.
- `e2e/ryugu.test.ts` has 3 new browser tests:
  - keyboard: Enter opens the box, the smoke appears and clears, Tab reaches the scrubber, ArrowLeft/Home/End walk
    the commits and the paper's blue channel drops, Enter closes the box;
  - touch: a 390×844 hasTouch viewport, where taps on the ends of the scrubber jump between the oldest and newest
    commits;
  - reduced motion: no smoke ever enters the DOM and the lid's transition is 0 s. Negative control: switching to
    no-preference brings the smoke back.

## Verification (this lease, darwin, Node 22.12.0)

| check | result |
| --- | --- |
| `npm test` | exit 0, 2227/2227 pass |
| `npm run lint` | exit 0 (0 errors; 10 warnings, none in touched files) |
| `npm run build` | exit 0 from an APFS clone at /tmp/oto-tm-build. In place it exits 1, with the same 8 errors on clean main d47d847 |
| `SKIP_BUILD=1 node scripts/e2e.mjs --test e2e/ryugu.test.ts` (own embedded Postgres) | exit 0, 12/12 pass |

About the build: Turbopack's `next/font/google` replacer fails with "queries have exactly one entry" when the checkout
path contains a space (this lease is under "Application Support"). Clean main fails identically in place. The same
tree builds from a space-free path, so the failure comes from the environment, not this change. CI paths have no
spaces.

## Boundaries

- Real: the build-time content/history.json (457 commits, the newest 200 indexed, at the clone's build), the
  production `next start` server, and Google Chrome via playwright-core.
- Not exercised: a browser render of the empty-history state (covered by unit tests and a source assertion), and the
  deployed site (QA owns it).
