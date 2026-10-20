# Rotor: a hand-drawn Enigma, and room for the next projects (pm-202)

**Idea.** "Research and design more projects into the app."

**Product.** `otohime.dev/rotor`, the sixth project on the Projects bench: an
Enigma I drawn in ink on cream paper. It has three rotor windows, a lampboard
of 26 lamps, a keyboard of 26 keys and a paper tape. Type on it (click a key,
or use the real keyboard): the key sinks, the right rotor steps, one lamp
lights amber, and the tape gains a letter, plain text above and code below.
The inner lid holds the settings: three rotors chosen from I to V, ring
settings, start positions, reflector B or C, and up to ten plugboard pairs. A
"Share" line gives a URL that holds the settings and the message. Open that
URL with the same settings and the code turns back into the message. The page
does all of this before JavaScript loads: a plain `<form method="get">`
encodes on the server.

This plan also gets the site ready for more projects. Each isolation test now
reads the list of route groups from `app/` instead of hard-coding it. The two
designs that follow Rotor are filed as their own ideas: **Planisphere**
(`/planisphere`, research §4.2) and **Barometer** (`/barometer`, research
§4.3).

Research: [research.md](research.md) (run-6756, rep-3849), checked against
the repo at 4cbeff1. It holds the house recipe every project follows (§1), the
scoring (§2), the shortlist of eight (§3), the three full designs (§4) and the
five shorter ones (§5). This plan repeats only what it changes.

## Decisions

| Decision | Why |
| --- | --- |
| This plan builds Rotor. Planisphere and Barometer go in as their own ideas now, each pointing at its section of research.md. | The research asks for one plan per project. Three projects in one plan would all edit the same shared lines (`content/site.ts`, `package.json`, `e2e/rbac.test.ts`, `lib/build-stamp.test.ts`, `README.md`) one after another. Barometer also brings the site's first live third-party data and needs its own acceptance. Rotor scores 15/15 and its tests can be exact. |
| Task 1 moves the five existing isolation tests to read the other groups from `readdirSync(join(ROOT, "app"))` (every `(name)` entry except the test's own group). Each test keeps its own two-line copy, with no shared helper. | Two more projects are queued. With hard-coded lists, each of them would mean editing five or six tests (research §1, plan lesson). The isolation rule forbids a shared helper across groups. |
| Route group `app/(rotor)/` serves `/rotor`, with its own root layout and `rotor.css` written by hand. It uses Orrery's hand fonts (Caveat for titles, Patrick_Hand for text) through `next/font/google`, with the same literal options and cursive fallbacks. | This is house style. Orrery's fonts already build in CI. |
| The ink is drawn on the server with rough.js and a fixed seed. `app/(orrery)/_lib/ink.ts` and `roughjs.d.ts` are **copied** into `app/(rotor)/_lib/`, with `SEED = 202`. `ink.ts` is the only file that imports `roughjs`. | The isolation rule applies, and the server-drawn ink ships no rough.js to the browser (Orrery does the same). |
| One `"use client"` island, `_components/rotor-app.tsx`, handles live typing. Everything it shows comes from the pure reducer in `_lib/machine.ts`. | node:test proves the behaviour, and the page's server render and the island use the same `encode`. |
| Query shape: `?r=I-II-III&ring=AAA&pos=AAA&ref=B&plug=AB-CD&m=HELLO`. Plug pairs are joined with `-`, not `,`. Defaults are I-II-III, AAA, AAA, B, no plugs. A bad field falls back to its default on its own, never to a 4xx. The message is capped at 250 characters. | A `-` survives the URL without encoding. Separate fallbacks keep a half-good link useful. The cap bounds the server's work. |
| The pinned vectors are `AAAAA` → `BDZGO` (I-II-III, B, rings AAA, start AAA, no plugs), and the double step **ADU → ADV → AEW → BFX → BFY**. A third vector, with non-default rings and at least three plug pairs, comes from an independent simulator, and its URL goes in the test as a comment. | The research wrote the double step as ADU → AEV → BFW. That is not what the machine does (decision recorded). Rotor III turns over when it steps from V to W, and rotor II from E to F. |
| Wiring source allowlist: `https` on `en.wikipedia.org` or `www.cryptomuseum.com`. | Same pattern as Orrery's NASA/Wikipedia rule. |
| Colour swatch `coral`. Project-list note: "An Enigma, drawn by hand. Type and watch the lamps." | Orrery is already yellow. The dot is decoration only. |
| Walk port **4035**. Ports 4019–4033 are taken by existing scripts. Stop servers by process group, as `walk-orrery.sh` does. Never use `pkill -f "next start"`. | Avoids clashing with other walks. |
| Commits are authored and committed as `Otohime <quiinthieu@gmail.com>` (set `GIT_AUTHOR_*` and `GIT_COMMITTER_*`). | Vercel Hobby deploys only the owner's commits. |
| Other plans push to main and edit the same shared lines. On a rebase conflict, keep both sides' lines. | Lesson iss-9. |

## File tree

```
app/(rotor)/
  layout.tsx                 own <html>, rotor.css, hand fonts, build-sha meta, themeColor #f6f1e7
  rotor.css                  tokens (light + dark via prefers-color-scheme, localStorage.theme pin),
                             box, windows, lampboard, keyboard, tape, lid form, top bar, focus rings,
                             @media (prefers-reduced-motion: reduce)
  rotor/page.tsx             server: reads searchParams, encodes, renders the box + form + tape,
                             credit line, <RotorApp initial=…>
  _components/
    rotor-app.tsx            the one "use client" island: useReducer(machine), keydown/keyup,
                             12 fps frame timer, history.replaceState for the share URL
    box.tsx                  server-safe SVG: box, windows, lamps, keys (paths come from _lib/ink)
  _lib/
    wiring.ts                rotors I–V, reflectors B, C, notches, source URLs
    enigma.ts                step, encodeLetter, encode, parseSettings, toQuery, DEFAULTS
    tape.ts                  groups of five, last 60 letters, cut count
    machine.ts               page reducer + 12 fps frames
    ink.ts · roughjs.d.ts    copied from Orrery, SEED 202
    words.ts                 word counter, cap 120 for the explainer
    *.test.ts                wiring, enigma, tape, machine, ink, words, isolation
scripts/walk-rotor.sh
content/site.ts (Projects row) · lib/build-stamp.test.ts · e2e/rbac.test.ts · package.json · README.md
app/(shore|capsule|orrery|elements|vinyl)/_lib/isolation.test.ts   (task 1)
```

## Tasks

### 1. Isolation tests read the route groups from app/

- **Role:** software_engineer, `qa: skip`. Only the test files change.
- **Problem:** Four of the five isolation tests hard-code the other route
  groups, and Orrery's and Capsule's lists already miss Elements and Vinyl. So
  every new project means editing every older test, and the older tests
  silently stop guarding against the newer groups.
- **Action items:**
  1. In each of `app/(shore)/_lib/isolation.test.ts`,
     `app/(capsule)/_lib/isolation.test.ts`, `app/(orrery)/_lib/isolation.test.ts`,
     `app/(elements)/_lib/isolation.test.ts` and `app/(vinyl)/_lib/isolation.test.ts`,
     replace the hard-coded group list with
     `const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true }).filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== "(<self>)").map((e) => e.name).sort();`
     and build `OUTSIDE` (or Shore's `SITE_DIRS`) from it. Shore's test then
     guards against every other project as well as the site. In the tests
     that scan "nothing outside imports X", use the same list.
  2. In each file, add a test asserting that `GROUPS` includes `(site)` and
     every other current group (one `GROUPS.includes("(name)")` per group,
     not a second literal array), and excludes the file's own group. Add one
     `reachesOutside` case per file for a sibling group reached by `../`.
  3. Keep each file self-contained. Do not create a shared helper.
- **Interfaces:** `app/(shore)/_lib/isolation.test.ts`;
  `app/(capsule)/_lib/isolation.test.ts`; `app/(orrery)/_lib/isolation.test.ts`;
  `app/(elements)/_lib/isolation.test.ts`; `app/(vinyl)/_lib/isolation.test.ts`;
  `package.json` (unchanged, named so the gate runs `npm test`).
- **Non-goals:** any change to what the tests forbid apart from the group
  list; Rotor code; a shared test helper.
- **Acceptance:** `npm test` passes. No isolation test declares a literal
  group array, and each test's group list comes from `app/`.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `! grep -nE '^const GROUPS = \[' app/*/_lib/isolation.test.ts`
  - `! grep -nE '^const (OUTSIDE|SITE_DIRS) = .*join\("app", "\(' app/*/_lib/isolation.test.ts`
  - `test "$(grep -l 'readdirSync(join(ROOT, "app")' app/*/_lib/isolation.test.ts | grep -c .)" -ge 5`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. Rotor's engine: wiring, machine and tape, pinned to published vectors

- **Role:** software_engineer, `qa: skip`. The task adds only `_lib/` files,
  the test glob and the README test line. No route or layout is added, so
  visitors see no change.
- **Problem:** The page, the island and the no-JavaScript form all need one
  correct Enigma I. That means real wiring, the double step, plugboard and
  rings, and a settings format that round-trips through a URL. All of it must
  exist and be proven before any page draws it.
- **Action items:**
  1. Read `AGENTS.md`, `node_modules/next/dist/docs/` for anything
     `_lib` touches, `app/(vinyl)/_lib/isolation.test.ts` and
     `app/(capsule)/_lib/crank.ts` (the 12 fps frame pattern, to copy, not
     import).
  2. `_lib/wiring.ts`: rotors I–V with their turnover letters (I Q, II E,
     III V, IV J, V Z), reflectors B and C, each with a `source` URL. Fetch
     the wiring from `https://en.wikipedia.org/wiki/Enigma_rotor_details` and
     check it against `https://www.cryptomuseum.com/crypto/enigma/wiring.htm`.
  3. `_lib/enigma.ts`: `Settings` type; `DEFAULTS`; `step(positions, rotors)`
     with the double step; `encodeLetter(state, letter) → [state, lamp]`
     (plugboard, then right to left through the rotors, the reflector, then
     back, honouring ring settings); `encode(settings, text) → string`
     (uppercases; non-letters pass through and do not step);
     `parseSettings(query: Record<string, string | string[] | undefined>) → Settings`
     with each field falling back to its default on its own (rotors must be
     three distinct from I–V; rings and positions are three letters; reflector
     B or C; plugs at most ten disjoint pairs written `AB-CD`; message at
     most 250 characters); `toQuery(settings, message) → string`.
  4. `_lib/tape.ts`: `tape(plain, code)` groups both lines into fives, keeps
     the last 60 letters and returns `{ plain, code, cut }`.
  5. `_lib/machine.ts`: reducer with `press(letter)`, `release`,
     `set-rotor(slot, name)`, `set-ring(slot, letter)`, `set-start(slot, letter)`,
     `plug(a, b)`, `unplug(a)`, `reflector(name)`, `clear`, `tick`. A
     `press` steps the machine once, lights exactly one lamp and appends to
     the tape. A second press while a key is down is ignored. `tick`
     advances the key-sink and lamp-glow frames at 12 fps. Under reduced
     motion (a state flag), frames jump straight to their end.
  6. Copy `app/(orrery)/_lib/ink.ts` and `roughjs.d.ts` into `_lib/` with
     `SEED = 202`. Copy `words.ts` with `WORD_CAP = 120`.
  7. Tests: `wiring.test.ts` (every rotor is a permutation of A–Z; every
     reflector is an involution with no fixed point; notches are single
     letters; sources are `https` on the allowlist).
     `enigma.test.ts` (`AAAAA` → `BDZGO`; positions ADU → ADV → AEW → BFX →
     BFY on five presses; one vector with rings ≠ AAA and ≥ 3 plug pairs
     from an independent simulator, URL in a comment, cross-checking BDZGO
     too; `encode(s, encode(s, m)) === m` for 1,000 seeded random messages;
     no letter ever encodes to itself; a plug pair swaps both ways; a
     non-letter leaves the state alone; `parseSettings(toQuery(s, m))`
     round-trips; each bad field falls back alone; a 300-character message is
     cut to 250). `tape.test.ts`, `machine.test.ts` (one lamp per press,
     release clears it, a held key ignores a second press, settings changes
     reset positions as stated), `ink.test.ts` (same seed, same path data)
     and `words.test.ts`.
  8. `_lib/isolation.test.ts` modelled on Vinyl's, with the group list read
     from `app/` as in task 1. It also asserts: `_lib/` imports no React or
     Next; only `ink.ts` imports `roughjs`; nothing outside `app/(rotor)/`
     imports Rotor; no `fetch(` anywhere under `app/(rotor)/`.
  9. Add `'app/(rotor)/_lib/*.test.ts'` to the `npm test` glob in
     `package.json`. Name Rotor's tests in the README's `npm test` sentence.
- **Interfaces:** `app/(rotor)/_lib/`; `package.json`; `README.md`.
- **Non-goals:** the page, layout, CSS or island; the project-list row;
  M4 or four-rotor machines; rotors VI–VIII; any network fetch.
- **Acceptance:** `npm test` runs Rotor's engine tests and they pass. They
  include BDZGO, the double step and a third independent vector with rings
  and plugs. Encoding is its own inverse, and the isolation test reads its
  group list from `app/`.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(rotor)/_lib/wiring.test.ts' 'app/(rotor)/_lib/enigma.test.ts' 'app/(rotor)/_lib/tape.test.ts' 'app/(rotor)/_lib/machine.test.ts' 'app/(rotor)/_lib/isolation.test.ts'`
  - `grep -q 'BDZGO' 'app/(rotor)/_lib/enigma.test.ts' && grep -q 'BFX' 'app/(rotor)/_lib/enigma.test.ts'`
  - `grep -q "app/(rotor)/_lib/\*.test.ts" package.json`
  - `! grep -rn '"use client"' 'app/(rotor)/_lib'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. Rotor at /rotor: the drawn box, the form that works without JavaScript, live typing

- **Role:** software_engineer. Depends on 1 and 2. QA is required.
- **Problem:** The engine is invisible. Visitors need `/rotor`: a drawn
  machine they can type on, which also encodes through a plain form when
  JavaScript is off. It must be listed on `/projects` and stay inside a phone
  viewport.
- **Action items:**
  1. `app/(rotor)/layout.tsx`: its own `<html lang="en">`, `rotor.css`,
     Orrery's two `next/font/google` calls (literal options and fallbacks),
     `metadata.title` `{ default: "Rotor", template: "%s · Rotor" }`, a
     description, `other: { "build-sha": process.env.BUILD_SHA ?? "dev" }`,
     and `viewport.themeColor`. A tiny inline script applies
     `localStorage.theme` the way Orrery's layout does.
  2. `app/(rotor)/rotor/page.tsx` (server component): `await searchParams`,
     `parseSettings`, `encode`, then render: a top bar with `<a href="/">`
     and `<a href="/projects">All projects</a>`; the box SVG (`box.tsx`,
     ink paths from `_lib/ink.ts`) with the three windows at the final
     positions, the lamp of the last letter lit, and the tape (`data-tape`,
     plain and code lines); the inner-lid `<form method="get" action="/rotor">`
     with a `<select>` per rotor slot, ring and start `<select>`s, reflector
     radios, a plugboard text input (`AB-CD`), a message `<textarea>` and an
     "Encode" submit button; a "Share" line holding the canonical
     `/rotor?…` URL; an explainer of at most 120 words, including one line
     on why the same settings decode; and a credit line linking the two
     wiring sources. Tone is about the mechanism, with no war imagery.
  3. `_components/rotor-app.tsx`, the one `"use client"` island: it hydrates
     over the server box and takes over typing. It handles `keydown`/`keyup`
     for A–Z (ignoring repeats and keys with a modifier) and clicks or taps
     on the drawn keys (`<button>` per key, `aria-label` the letter). It runs
     the `machine.ts` reducer on a 12 fps `setInterval` only while frames are
     pending, and stops under `prefers-reduced-motion`. Settings changes
     update the share URL with `history.replaceState`, and an
     `aria-live="polite"` region announces the lamp letter. A Clear button
     empties the tape.
  4. `rotor.css`: cream paper and ink tokens, a dark scheme, amber lamp
     glow, key sink as a transform, tape monospace in groups of five. A
     two-column layout from 900 px (box, lid) stacks on phones, with nothing
     wider than 100vw at 320 px (top bar included, as pm-195 requires).
     Focus rings are visible, and all motion is off under
     `prefers-reduced-motion`.
  5. `content/site.ts`: add
     `{ title: "Rotor", note: "An Enigma, drawn by hand. Type and watch the lamps.", href: "/rotor", status: "live", colour: "coral" }`
     after Vinyl.
  6. `lib/build-stamp.test.ts`: add "Rotor's root layout publishes BUILD_SHA…".
     In `e2e/rbac.test.ts`, `/projects` links `/rotor`, and add "Rotor is its
     own page, without the site's sidebar" (200, no `aria-label="Main"`,
     links `/projects`).
  7. `scripts/walk-rotor.sh`, in the style of `walk-orrery.sh` (port 4035,
     local build and start or `BASE_URL`, `EXPECT_SHA`, process-group
     cleanup, `grep -c` counts, no `wc -l`). Checks:
     `/rotor` is 200 with the build-sha meta and no `aria-label="Main"`.
     `/rotor?m=AAAAA` has `BDZGO` inside `data-tape`.
     `/rotor?r=I-II-III&pos=ADU&m=AAAA` shows the windows at `BFY`.
     The default page and `/rotor?r=nope&ref=Z&plug=AA&m=hello` are both 200
     and fall back to the defaults.
     26 lamps (`data-lamp`), 26 keys (`data-key`) and one
     `<form method="get"`.
     Exactly one `"use client"` under `app/(rotor)`, no `roughjs` in any
     client chunk the page loads, and at most 120 explainer words.
     `/projects` links `/rotor` exactly once, and both wiring source links
     are present.
  8. README: a Rotor line in the route-group tree, the walk line and the
     project's one-paragraph description.
- **Interfaces:** `app/(rotor)/`; `scripts/walk-rotor.sh`; `content/site.ts`;
  `lib/build-stamp.test.ts`; `e2e/rbac.test.ts`; `README.md`.
- **Non-goals:** a 3D machine, sound, saving messages, accounts,
  four-rotor M4, a printable tape, any change to another project's look.
- **Acceptance:** `/rotor` shows a hand-drawn Enigma, listed on `/projects`.
  With JavaScript off, submitting the form with `AAAAA` and default settings
  prints `BDZGO` on the tape. With JavaScript on, typing lights one lamp per
  key, steps the rotors (with the double step), grows the tape and updates the
  share URL. Opening that URL and encoding the code gives back the message.
  The page fits 320 px, reads in light and dark, and stays still under
  reduced motion. `bash scripts/walk-rotor.sh` exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-rotor.sh && ! grep -nE 'wc +-l' scripts/walk-rotor.sh`
  - `bash scripts/walk-rotor.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4035/; then exit 1; fi`
  - `if BASE_URL=http://127.0.0.1:4039 bash scripts/walk-rotor.sh; then exit 1; fi`
  - `test "$(grep -rln '"use client"' 'app/(rotor)' | grep -c .)" -eq 1`
  - `grep -q 'href: "/rotor"' content/site.ts && grep -q '/rotor' e2e/rbac.test.ts`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA (task 3)

Use headless Chrome (playwright-core in a scratch directory; on a macOS lease
`chromium.launch({ channel: "chrome" })`) at 1366×768, 390×844 and 320×640,
in light and dark, with motion on and off. Check:

- With JavaScript disabled: submit the form with `AAAAA`; the tape reads
  `BDZGO`. Set rotors II-IV-V, rings BUL, plugs `AV-BS-CG-DL-FU`, and encode a
  sentence. Paste the code back with the same settings: the sentence returns.
- With JavaScript: type `HELLOWORLD` on the real keyboard. One lamp per key,
  the right window steps each time, the tape grows in fives, and the share
  URL updates. Starting from ADU, four presses show BFY in the windows. Hold a
  key: only one letter is typed. Click the drawn keys and tap them at 390 px.
- Tab through: every control has a visible focus ring, and the live region
  announces the lamp.
- At 320 px nothing scrolls sideways, and the top bar fits.
- The project list on `/projects` shows Rotor with a coral dot and the note.
  The other five projects look unchanged.
- No console errors. Lighthouse accessibility is at least 95 on `/rotor`.

## Acceptance

Walk the plan on production after CI deploys:
`BASE_URL=https://otohime.dev bash scripts/walk-rotor.sh` exits 0. Then
repeat the QA no-JavaScript round trip and the live typing on otohime.dev.
Confirm that each of the six isolation tests (five old, plus Rotor's) builds
its group list from `app/`. Confirm that the Planisphere and Barometer ideas
exist on the board and point at research.md §4.2 and §4.3.

## Follow-up ideas filed by this run

- Planisphere, `/planisphere`: research.md §4.2.
- Barometer, `/barometer`: research.md §4.3 (the first live-data project;
  its fetch rules are the template for Drum).
- Later, in order: Loom, Depot, Telegraph, Soroban, Drum (research §5).

## Risks

- **Wrong vector.** If an earlier draft gets the double step wrong (as the
  research did), the engine is still checked by BDZGO, the third independent
  vector and the self-inverse property. If any of them disagree, the
  engineer records it and trusts the independent simulator.
- **Rebase conflicts.** Planisphere's plan may land while this one is in
  flight and edit the same shared lines. Keep both sides' lines.
- **Fonts.** If the Google fonts fail to fetch at build time, the build fails
  for Orrery too. That is an environment cause, not this plan's code.
