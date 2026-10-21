# Gazette: a small newspaper of short, illustrated explainers at /articles (pm-213)

**Idea.** "Add articles section to the app. Add some short articles under it.
Articles should have illustrations, infographic to explain the ideas. I like
the newspaper look and feel for this module. Keep the articles concise and
easy to understand for general population."

**Product.** `otohime.dev/articles` is **The Otohime Gazette**, the ninth row on
the Projects bench ("Gazette"). The front page looks like a broadsheet: a
blackletter masthead between double rules, a small-caps dateline
(`Vol. I · No. 1 · Wednesday, 21 October 2026 · otohime.dev · Free`), the lead
story above the fold with its infographic across the page, and five more
stories below it in ruled columns. Each story opens at `/articles/<slug>`:
headline, deck, byline, date, reading time, one drawn infographic with a
caption, a body of 180 to 350 plain words in justified newspaper columns with
a drop cap, a boxed list of sources, and Previous / Next. Every page is static
HTML built ahead of time, so it reads with JavaScript off and prints cleanly.
The first edition has six pieces on everyday science: why the sky is blue,
why February gets a 29th, how your phone knows where it is, what a gigabyte
holds, why ice floats, how tides work.

Research: [research.md](research.md) (run-7028, rep-4027), checked against the
repo at 06f25bf by the product owner (run-7030). §3 is the look, §4 the six
article briefs (point, numbers, sources, picture), §5 the engine and its
tests. This plan repeats what the contracts need and records where it
departs.

## Decisions

| Decision | Why |
| --- | --- |
| Route group **`app/(articles)/`** serves `/articles` and `/articles/<slug>`, with its own root layout and hand-written `articles.css` (no Tailwind). The paper is "The Otohime Gazette"; the `/projects` row is "Gazette". | House recipe. Since pm-206, `lib/motion.test.ts` derives the `h1` view-transition name and the `/projects` row from the directory name, so the group name must equal the URL slug (global lesson). |
| **No client island**: zero `"use client"` files in the group. Both pages are server components; `[slug]` uses `generateStaticParams` + `export const ensureStatic = "navigation"` and `notFound()`, Orrery's `[body]` shape. The only script is the theme-pin inline script every root layout carries. | Nothing on a newspaper page needs state. Departure from the research: the walk does **not** check client-chunk paths (Turbopack names don't carry the group); the zero-island rule is checked at source, and JS-off reading is checked by QA and acceptance. Decision recorded. |
| Articles are **typed data** in `_lib/articles.ts` (plain-text paragraphs, no HTML, no markdown). No MDX, no CMS, no database, no new dependency. | One commit adds an article; the text can be tested. |
| **Readability is a tested contract**: a body is 180 to 350 words with no paragraph over 90; headline ≤ 8 words; deck ≤ 30; Flesch-Kincaid grade ≤ 8 from a pure `fkGrade`; mean sentence ≤ 20 words, longest ≤ 35. | Turns "concise and easy to understand for general population" into a number CI checks. Departure: calibration is pinned to vectors you can work out by hand (`fkGrade("The cat sat on the mat.")` = −1.45 ± 0.01; fixed syllable counts) rather than the research's `/tmp` samples, which are not in the repo. Decision recorded. |
| **Every number is sourced.** Each article has `facts[]`, each naming a source key; ≥ 2 sources, `https` only, hosts on the allowlist `en.wikipedia.org`, `*.nasa.gov`, `*.noaa.gov`, `www.gps.gov`, `*.usgs.gov`, `*.nist.gov`. | A general reader can check us, and QA checks one article against its links. |
| **One illustrated infographic per article**, drawn on the server from that article's `facts` by a pure `_lib/figures/<slug>.ts`: objects are drawn in rough.js ink (Orrery's `ink.ts` copied, `SEED = 213`, roughness 0.9) and the numbers are written on as `<text>` labels in `--ink`, with one spot red (`--spot`) for the subject. | The idea asks for illustrations and infographics; one figure that draws the things and labels the numbers does both, and a number can't differ between the text and the picture. Decision recorded. |
| Faces: `UnifrakturMaguntia` (masthead, weight 400), `Playfair_Display` (headlines, variable), `Old_Standard_TT` (body, 400/700, italic) via `next/font/google` with literal options and `serif` fallbacks. | All three are in Next's font list; Google Fonts answers from the pod, as it does for Orrery's build. |
| Colour: `--paper #f3eee3`, `--ink #1a1816`, `--muted #5d564c`, `--rule #c9c1b2`, `--spot #b23a2f`; dark `--paper #171513`, `--ink #e8e1d4`, `--muted #a39a8c`, `--rule #3d3730`, `--spot #e07a6a`, from `prefers-color-scheme` or the pinned `[data-theme]` (Barometer's shape). themeColor light `#f3eee3`, dark `#171513`. | Newsprint, readable in both schemes. |
| Site row `{ title: "Gazette", note: "A small newspaper: six short pieces on everyday science, each with a drawn infographic.", href: "/articles", status: "live", colour: "pink" }`, last in the list. | Departure: the research said pink is unused, but there are only five swatches and all five are taken; pink (Vinyl) and mint (Shore) are each used once, and pink reads as salmon newsprint. Decision recorded. |
| The edition date is the newest article's `published`; all six are `2026-10-21` (a Wednesday). `longDate` uses month and weekday tables with `Date.UTC(...).getUTCDay()`: no `Intl`, no clock. | Every build gives the same bytes. |
| No sidebar entry, no change to `/notes`, no licence line on the text, no RSS feed. | Every project is reached from `/projects`, and `lib/pages.ts` is sized for five pages. The owner asked for none of the rest; adding any of them later is a small commit. |
| Walk port **4065**; dead-port check **4067**. | 4019–4063 are taken (walks, Barometer's fake, the two motion probes). |
| Walk counts use attribute forms (`data-article="`, `data-figure="`, `<time datetime="`); visible text is only checked for presence. | The inline RSC payload repeats server text, so "exactly once" on plain text fails (Barometer lesson). |
| Commits are authored and committed as `Otohime <quiinthieu@gmail.com>`; subjects start `pm-213/t-NNNN:`. | Vercel Hobby deploys only the owner's commits. |
| Shared lines (`content/site.ts`, `package.json`, `e2e/rbac.test.ts`, `lib/build-stamp.test.ts`, `lib/motion.test.ts`, `scripts/probe-motion.mjs`, `README.md`): on a rebase conflict, keep both sides. | Lesson iss-9. No other plan is active today. |
| Two build tasks (engine `qa: skip`; paper with QA). No operator action, no throwaway build. | Nothing needs a person: no key, no account, no device. Static `[slug]`, Google fonts at build and cross-group isolation already ship in Orrery on the same config. |

## The first edition

Bodies are written in full by task 1 from these briefs (research §4 has the
detail). Order on the front page is this table's order; the first is the lead.

| # | Slug | Kicker | Headline | Key facts (source) | Figure |
| --- | --- | --- | --- | --- | --- |
| 1 | `why-the-sky-is-blue` | Sky | Why the sky is blue | scattering ∝ 1/λ⁴; blue ≈ 450 nm, red ≈ 700 nm, so blue scatters ≈ 5.9× more ((700/450)⁴ = 5.85; the research's 5.5 is a slip); violet is weaker in sunlight and to our eyes (Wikipedia: Rayleigh scattering; NASA Space Place) | sunbeam into a band of air, blue arrows scattering, red going straight on to a small figure; a low sunset beam through a longer slab |
| 2 | `why-we-need-a-leap-day` | Calendar | Why February gets a 29th | tropical year 365.2422 d; Gregorian rule 4/100/400 → 97 leap days in 400 years, mean 365.2425 d; ≈ 24 days of drift a century without them (Wikipedia: Leap year; Gregorian calendar) | four year-bars each 0.2422 d short, closed by one leap day; a 400-year ruler marking 97 |
| 3 | `how-your-phone-knows-where-it-is` | Numbers | How your phone knows where it is | ≈ 31 working GPS satellites, ≈ 20,200 km up, 4 needed for a fix, ≈ 5 m in open sky (gps.gov: Space segment; GPS accuracy; Wikipedia: Global Positioning System) | three distance circles meeting at one point, a fourth satellite with a clock, a "20,200 km" scale against Earth |
| 4 | `what-a-gigabyte-holds` | Numbers | What a gigabyte holds | byte = 8 bits; ×1,000 a step (kilo, mega, giga, tera); 1,000 vs 1,024; about 2 KB a page of text, 3 MB a phone photo, 4 GB a film (Wikipedia: Byte; Gigabyte) | a ladder of five rungs ×1,000 with an everyday object by each; the 1,000/1,024 gap as a sliver on the top rung |
| 5 | `why-ice-floats` | Earth | Why ice floats | ice 0.917 g/cm³ vs water ≈ 1.000; water grows ≈ 9 % when it freezes; densest at ≈ 4 °C (Wikipedia: Ice; USGS Water Science School: Water density) | two jars (crowded liquid, open hexagonal lattice); a lake section with the ice lid, 4 °C water at the bottom and a fish |
| 6 | `how-tides-work` | Earth | How tides work | two bulges; two high tides every 24 h 50 min; spring and neap tides; the Moon's tidal pull ≈ 2.2× the Sun's (NOAA Ocean Service: Tides and Water Levels; Wikipedia: Tide) | Earth with two exaggerated bulges and the Moon to one side; insets for Sun-Moon-Earth in line (spring) and at right angles (neap) |

The register: short sentences, one idea a paragraph, concrete everyday things,
any technical word explained in plain words next to it, numbers rounded as a
reader would say them, "about" where a value varies. The GPS count changes
over time, so the body says "about 31", the figure the same.

## File tree

```
app/(articles)/
  layout.tsx                  own <html lang="en">, articles.css, three next/font/google calls, build-sha meta,
                              inline @view-transition style, pinTheme script, metadata title template "%s · The Otohime Gazette"
  articles.css                tokens, masthead, dateline, lead, ruled column grid, article columns, drop cap, sources box,
                              figure draw-on, @media print, the hop block, h1 { view-transition-name: project-articles; },
                              the reduced-motion block last
  articles/page.tsx           the front page
  articles/[slug]/page.tsx    one article; generateStaticParams; ensureStatic = "navigation"; notFound(); generateMetadata
  not-found.tsx               "Not in this edition." with the masthead and a link to the front page
  _components/masthead.tsx    top bar (plain <a> to / and /projects), full masthead + dateline, one-line masthead
  _components/figure.tsx      <figure data-figure="<slug>"> with <svg role="img" aria-label>, ink paths (pathLength="1"),
                              <text> labels, <figcaption>
  _components/card.tsx        a below-the-fold story card: <article data-article="<slug>">
  _lib/ articles.ts readability.ts edition.ts words.ts ink.ts roughjs.d.ts figures/{index.ts,<six slugs>.ts}
        articles.test.ts readability.test.ts edition.test.ts figures.test.ts ink.test.ts words.test.ts isolation.test.ts
scripts/walk-articles.sh · content/site.ts · lib/build-stamp.test.ts · lib/motion.test.ts · scripts/probe-motion.mjs
e2e/rbac.test.ts · package.json · README.md
```

## Tasks

### 1. The Gazette's first edition and its engine: six sourced articles, readability, dates and figures

- **Role:** software_engineer, `qa: skip`. Only `app/(articles)/_lib/`, the
  `npm test` glob and the README test sentence. No route is added, so
  visitors see no change.
- **Problem:** The paper needs its six articles written to a reading level a
  general reader can manage, with every number sourced, and one infographic
  for each, drawn from those numbers. None of this exists, and "concise and
  easy to understand" is only a wish until a test measures it.
- **Action items:**
  1. `npm ci`. Read `AGENTS.md`, `app/(orrery)/_lib/ink.ts`, `words.ts`,
     `bodies.test.ts` (source allowlist pattern), `app/(capsule)/_lib/art.test.ts`
     (viewBox containment), `app/(barometer)/_lib/isolation.test.ts`, and
     research §4–§5.
  2. `articles.ts`: the types from research §5 (`Fact`, `Article`, `kicker`
     one of `Sky | Calendar | Numbers | Earth`), `ARTICLES` (the plan's six in
     the plan's order, all `published: "2026-10-21"`), `bySlug(slug)`,
     `neighbours(slug) → { prev?: Article; next?: Article }`. Write each body
     in full to the brief and the register above; every number in a body is
     also a `fact`. Use 5.9× for blue against red (the plan corrects the research's 5.5).
  3. `readability.ts`: `syllables(word)` (lowercase, letters only, count
     `[aeiouy]+` groups, take one off for a trailing `e` unless the word ends
     in consonant + `le` or the count is 1, minimum 1; a token with no letters,
     like `365.2422`, is 1), `sentences(text)` (split on `.`, `!`, `?`
     followed by a space or the end, but not inside a number like `0.917`),
     `fkGrade(text)` = 0.39·words/sentences + 11.8·syllables/words − 15.59,
     `longestSentence(text)`, `meanSentence(text)`, `readingMinutes(words)` =
     max(1, ceil(words / 200)).
  4. `edition.ts`: `editionDate(articles)` (the newest `published`),
     `longDate("2026-10-21") === "Wednesday, 21 October 2026"` (tables +
     `Date.UTC`, no `Intl`), `dateline(articles) === "Vol. I · No. 1 · Wednesday, 21 October 2026 · otohime.dev · Free"`.
  5. Copy `ink.ts` and `roughjs.d.ts` from Orrery with `SEED = 213` and
     default roughness 0.9; copy `words.ts` with `WORD_CAP = 600`.
  6. `figures/<slug>.ts` ×6 and `figures/index.ts`
     (`FIGURES: Record<string, (a: Article) => Figure>`, `Figure = { viewBox: [number, number]; paths: InkPath[]; spot: InkPath[]; labels: Label[] }`,
     `Label = { x; y; text; size; anchor?: "start" | "middle" | "end"; spot?: boolean }`).
     Each draws the plan's picture; label text takes its numbers from the
     article's `facts` by id.
  7. Tests (`node:test`):
     - `readability.test.ts`: `syllables` of `cat` 1, `water` 2, `table` 2,
       `the` 1, `sky` 1, `satellite` 3, `365.2422` 1; `sentences("Ice is 0.917 g/cm³. It floats!")` is 2;
       `fkGrade("The cat sat on the mat.")` is −1.45 ± 0.01; a one-sentence
       45-word, many-syllable definition (write it in the test) scores > 12;
       `readingMinutes` 0 → 1, 200 → 1, 201 → 2.
     - `articles.test.ts`: six, in the plan's order, lead `why-the-sky-is-blue`;
       slugs unique and `/^[a-z-]+$/`; each body 180–350 words (`textWords`),
       no paragraph over 90, `fkGrade(body.join(" ")) <= 8`, mean sentence
       ≤ 20, longest ≤ 35; headline ≤ 8 words, deck ≤ 30 and one sentence;
       no `<`, `>` or `http` in any body, headline or deck; every fact's
       source key exists; ≥ 2 sources, each `https:` on the allowlist; valid
       `published`; `neighbours` of the lead has no `prev`, of the last no
       `next`; `bySlug("nope")` undefined. Print each article's words and
       grade in the test name so the numbers show in the log.
     - `edition.test.ts`: the two strings above; `longDate("2024-02-29")` is
       `Thursday, 29 February 2024`; `editionDate` picks the newest.
     - `figures.test.ts`: every article has a figure; every path coordinate
       (parsed from `d`) and every label point lies inside the viewBox with a
       2-unit margin; at a rendered width of 358 CSS px (390 minus 16 px
       gutters) every label is ≥ 12 px (`size * 358 / viewBox[0] >= 12`);
       ≤ 14 labels; at least one `spot` path or spot label; every fact id of
       the article appears in some label's text value, or is listed in
       `figures/index.ts`'s `UNDRAWN` with a reason; drawing twice gives the
       same output.
     - `ink.test.ts`, `words.test.ts` as Orrery's (`SEED = 213`).
     - `isolation.test.ts`, Barometer's with `GROUPS` from
       `readdirSync(join(ROOT, "app"))`: nothing imports another group, the
       site (`@/`), or Tailwind; `_lib/` imports no React and nothing from
       `next`; only `ink.ts` imports `roughjs`; **no `"use client"` anywhere in
       `app/(articles)/`**; no `fetch(`, no `localStorage` under `_lib/`, no
       `process.env` except `layout.tsx` (when it exists).
  8. Add `'app/(articles)/_lib/*.test.ts' 'app/(articles)/_lib/figures/*.test.ts'`
     (or only the first, if no test lives in `figures/`) to the `npm test`
     glob, and name the Gazette's tests in the README's `npm test` sentence.
- **Interfaces:** `app/(articles)/_lib/`; `package.json`; `README.md`.
- **Non-goals:** the route, layout, CSS or components; MDX, markdown or a
  CMS; second-edition articles; RSS; translations.
- **Acceptance:** `npm test` runs the Gazette's engine tests and they pass:
  six articles, each 180–350 words at a Flesch-Kincaid grade of 8 or under,
  every number sourced on the allowlist, and six figures that stay in their
  frames, label legibly at 390 px and draw their article's facts.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(articles)/_lib/*.test.ts'`
  - `test "$(grep -c 'slug: "' 'app/(articles)/_lib/articles.ts')" -eq 6`
  - `test "$(ls 'app/(articles)/_lib/figures/'*.ts | grep -vc index.ts)" -ge 6`
  - `test "$(grep -rl '"use client"' 'app/(articles)' | grep -c .)" -eq 0 && ! grep -rn 'fetch(' 'app/(articles)/_lib'`
  - `grep -q 'SEED = 213' 'app/(articles)/_lib/ink.ts' && grep -q 'fkGrade' 'app/(articles)/_lib/articles.test.ts' && grep -q -- '-1.45' 'app/(articles)/_lib/readability.test.ts'`
  - `grep -q 'readdirSync(join(ROOT, "app")' 'app/(articles)/_lib/isolation.test.ts' && grep -q "app/(articles)/_lib/\*.test.ts" package.json`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. The Gazette at /articles: front page, article pages, the hop and the walk

- **Role:** software_engineer. Depends on 1. QA is required.
- **Problem:** The edition is invisible. Readers need `/articles` to look and
  read like a newspaper front page, each story on its own page with its
  infographic and sources, all static and readable without JavaScript, listed
  on `/projects` and joined to the site's hop motion.
- **Action items:**
  1. Read `node_modules/next/dist/docs/` on `ensureStatic`,
     `generateStaticParams` and `not-found`; `app/(orrery)/layout.tsx`,
     `app/(orrery)/orrery/[body]/page.tsx`, `app/(barometer)/layout.tsx` (theme
     pin, inline `@view-transition`), `app/(barometer)/barometer.css` (hop and
     reduced-motion blocks), `lib/motion.test.ts`, `scripts/walk-barometer.sh`.
  2. `layout.tsx`: `<html lang="en">`, `articles.css`, the three font calls,
     `metadata.title { default: "The Otohime Gazette", template: "%s · The Otohime Gazette" }`,
     a description, `other: { "build-sha": process.env.BUILD_SHA ?? "dev" }`,
     `viewport.themeColor` light/dark, the inline `@view-transition` style and
     the pinTheme script with `suppressHydrationWarning`.
  3. `articles/page.tsx`: top bar, full masthead (the page's only `<h1>`,
     "The Otohime Gazette") and `dateline(ARTICLES)`; the lead above the fold
     (kicker, `<h2>` headline, deck, byline "By Otohime" and
     `N min read`, the full-width figure, the first two paragraphs, `Read on →`
     to `/articles/<slug>`); the other five as `<Card>`s in a ruled grid
     (3 columns from 960 px, 2 from 640 px, 1 below); the colophon ("Every
     number links to where it came from." and the type line). Lead and cards
     are each `<article data-article="<slug>">`.
  4. `articles/[slug]/page.tsx`: `ensureStatic = "navigation"`,
     `generateStaticParams` over `ARTICLES`, `generateMetadata` (title =
     headline, description = deck), `notFound()` for an unknown slug. Top bar,
     one-line masthead linking `← Front page`, kicker, `<h1>` headline, deck,
     byline, `<time datetime="2026-10-21">`, reading time, the figure, the body
     as `<p>`s in `<div class="body">`, `<aside data-sources>` with an `<ol>`
     of `https` links, `<nav>` with `← Previous` / `Next →` per `neighbours`.
  5. `not-found.tsx`: the one-line masthead, "Not in this edition.", a link
     to `/articles`.
  6. `_components/figure.tsx` (server): `<figure data-figure="<slug>">`,
     `<svg viewBox role="img" aria-label={alt}>`, each ink path with
     `pathLength="1"`, spot paths in `var(--spot)`, `<text>` labels in the
     body face, `<figcaption>`. `_components/card.tsx`, `_components/masthead.tsx`.
  7. `articles.css`: research §3's tokens, dark scheme (`prefers-color-scheme`
     and `[data-theme]`), newsprint grain as an inline data URI, masthead
     double rule, small-caps kickers and dateline, the ruled grid
     (`column-rule`-style 1 px borders between cards), article body
     `columns: 2; column-gap: 32px; column-rule: 1px solid var(--rule); text-align: justify; hyphens: auto`
     from 720 px only, paragraph indents with no gap between paragraphs, the
     drop cap (`initial-letter: 3 2` plus a floated fallback under
     `@supports not (initial-letter: 3)`), the boxed sources, the figure
     draw-on (stroke-dashoffset 1 → 0 over 600 ms, labels fade up after,
     resting state is the full drawing), `@media print` (hide top bar and
     nav, black on white, no grain), visible focus rings, nothing wider than
     100vw at 320 px. Then the house motion: the hop rule, typed root fade,
     `fade-in`/`fade-out` keyframes, `h1 { view-transition-name: project-articles; }`
     and, last, the `prefers-reduced-motion: reduce` block that stops the
     draw-on and zeroes `::view-transition-group(*)`, as `lib/motion.test.ts`
     requires.
  8. Shared edits: `content/site.ts` the plan's row, last; `lib/motion.test.ts`
     8 → 9 (and the test name); `scripts/probe-motion.mjs` `PROJECTS` gets
     `"articles"` and every "8 row" count becomes 9 (and its header comment
     says nine); `lib/build-stamp.test.ts` "The Gazette's root layout
     publishes BUILD_SHA as <meta name=build-sha> too"; `e2e/rbac.test.ts`:
     `/projects` links `/articles`, and "The Gazette is its own page, without
     the site's sidebar" (200, no `aria-label="Main"`, a `/projects` link, six
     `data-article="`).
  9. `scripts/walk-articles.sh` in `walk-barometer.sh`'s style (port 4065,
     local build and start or `BASE_URL`, `EXPECT_SHA`, process-group cleanup,
     `grep -c`, no `wc -l`, no `set -e`, a summary of failures). `/articles`:
     200, build-sha meta, no `aria-label="Main"`, `href="/projects"`, exactly
     one `<h1` and it contains "Gazette", the dateline's
     `Wednesday, 21 October 2026`, exactly six `data-article="`, six
     `href="/articles/` story links, no `$RC`, no `<template id="B:`, only
     its own stylesheet (no `--tw-`). Each of the six `/articles/<slug>`: 200,
     one `<h1`, one `data-figure="`, one `role="img"`, a `<figcaption`,
     `data-sources` with ≥ 2 `https://` links all on the allowlist,
     `<time datetime="`, `min read`, Previous/Next per order (the lead has no
     Previous, the sixth no Next), ≤ 600 visible words (`_lib/words.ts`),
     under 150 KB, no `$RC`. `/articles/nope`: 404 and "Not in this edition".
     `/projects` links `/articles` exactly once. Source checks:
     `grep -rl '"use client"' 'app/(articles)'` empty and `articles.css` has
     `@media print`.
  10. README: the route-group line, the walk line, and a `## Gazette`
      section on adding an article (the data shape, the caps the tests
      enforce, the source allowlist).
- **Interfaces:** `app/(articles)/`; `scripts/walk-articles.sh`;
  `content/site.ts`; `lib/build-stamp.test.ts`; `lib/motion.test.ts`;
  `scripts/probe-motion.mjs`; `e2e/rbac.test.ts`; `README.md`.
- **Non-goals:** comments, search, tags, RSS, pagination; a sidebar entry or
  any change to `/notes`; a client island of any kind; new articles beyond
  the six; any change to another project's look.
- **Acceptance:** `/projects` lists Gazette with a pink dot; clicking it hops
  to a broadsheet front page with the masthead, dateline, the sky lead and
  its figure above the fold and five ruled story cards below; each story
  opens on its own page with a drawn, labelled infographic, two justified
  columns with a drop cap on a wide screen, numbered sources and
  Previous/Next; `/articles/nope` says "Not in this edition." with a 404; all
  of it reads with JavaScript off, fits 320 px, works in light and dark and
  prints cleanly. `bash scripts/walk-articles.sh` and
  `bash scripts/probe-motion.sh` exit 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-articles.sh && ! grep -nE 'wc +-l' scripts/walk-articles.sh`
  - `bash scripts/walk-articles.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4065/; then exit 1; fi`
  - `if BASE_URL=http://127.0.0.1:4067 bash scripts/walk-articles.sh; then exit 1; fi`
  - `grep -q 'ensureStatic = "navigation"' 'app/(articles)/articles/[slug]/page.tsx' && grep -q generateStaticParams 'app/(articles)/articles/[slug]/page.tsx'`
  - `test "$(grep -rl '"use client"' 'app/(articles)' | grep -c .)" -eq 0`
  - `grep -q 'href: "/articles"' content/site.ts && grep -q '/articles' e2e/rbac.test.ts && grep -q 'articles' lib/build-stamp.test.ts`
  - `grep -q 'project-articles' 'app/(articles)/articles.css' && grep -q '@media print' 'app/(articles)/articles.css'`
  - `grep -q '"articles"' scripts/probe-motion.mjs && ! grep -n '8 row' scripts/probe-motion.mjs`
  - `bash scripts/probe-motion.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA (task 2)

Headless Chrome (playwright-core in a scratch directory; on a macOS lease
`chromium.launch({ channel: "chrome" })`) at 1366×768, 390×844 and 320×640,
light and dark, motion on and off, against a local `next start` at the
delivery sha or the deployed site.

- The front page reads as a newspaper: blackletter masthead, dateline, lead
  with its figure above the fold at 1366×768, ruled cards below; one column
  at 390 px; nothing scrolls sideways at 320 px.
- On an article at 1366 px: two justified columns with a column rule and a
  drop cap; at 390 px one left-aligned column. Figure labels are legible at
  390 px (≥ 12 px measured) and the spot red shows in both schemes.
- Pick one article and check each of its numbers against its linked sources.
- JavaScript off (`javaScriptEnabled: false`): front page, an article, Next,
  Front page all work.
- Print preview (`page.emulateMedia({ media: "print" })`): no top bar or nav,
  black on white.
- Reduced motion: the figure shows complete at load. Motion on: strokes draw
  on once and stop.
- Tab order reaches every story link, Previous/Next and sources with a
  visible ring. Each `<svg role="img">` has an `aria-label`.
- `bash scripts/walk-articles.sh` and `bash scripts/probe-motion.sh` pass;
  no console errors; Lighthouse accessibility ≥ 95 on both page types.

## Acceptance

After CI deploys: `BASE_URL=https://otohime.dev bash scripts/walk-articles.sh`
exits 0 with `EXPECT_SHA` the delivery sha. On otohime.dev: `/projects` →
Gazette (the title morphs into the masthead) → the lead story → Next → Next →
Front page; then the same with JavaScript off; `/articles/nope` is a 404 with
"Not in this edition."; `/projects` lists Gazette once with a pink dot.
`BASE_URL=https://otohime.dev bash scripts/probe-motion.sh` passes.

## Risks

- **Readability caps fight the content.** A science fact can push a
  sentence's syllables up. The register (everyday words beside the technical
  one) keeps the grade under 8; if one article can't, split sentences, never
  loosen the cap.
- **Fonts at build.** If Google Fonts fails during a build, Orrery's build
  fails too, so the cause is the environment, not this change.
- **`initial-letter` support.** Firefox lacks it; the `@supports` fallback is
  a floated letter, and QA checks it in Chrome only, so a slight
  misalignment in Firefox is acceptable.
- **GPS count changes.** The body says "about 31", sourced to gps.gov; a
  later edition can update it in one line.
- **Motion probe on a new row.** `probe-motion.mjs` counts rows and delays
  (`i * 40` ms); nine rows keep the same rule. If the probe's per-project
  reduced-motion check catches the draw-on, the reduced-motion block is
  missing a selector: fix the CSS, not the probe.
