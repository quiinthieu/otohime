# Research: The Otohime Gazette, an articles section at `/articles` (pm-213, run-7028)

Submitted as rep-4027 by the research run and committed by the product owner
(run-7030) unchanged. Where the plan departs from it, `plan.md` says so.

**Idea.** "Add articles section to the app. Add some short articles under it. Articles should have illustrations, infographic to explain the ideas. I like the newspaper look and feel for this module. Keep the articles concise and easy to understand for general population."

**Short answer.** Build **Gazette**, the ninth row on the Projects bench, as its own route group `app/(articles)/` serving `/articles` (the front page) and `/articles/<slug>` (one page per article), in the house recipe every project since Shore follows: own root layout and stylesheet, no Tailwind, pure data and pure drawing code under `_lib/` proven by `node --test`, an isolation test, a walk script, a row in `content/site.ts`. It is the first project with **no client island at all**: every page is static HTML drawn at build time (`generateStaticParams` + `ensureStatic = "navigation"`, the shape Orrery's 14 posters already use at `app/(orrery)/orrery/[body]/page.tsx`), so it works with JavaScript off and ships no script of its own.

The newspaper look is typography and rules, not a library: a blackletter masthead, serif headlines and body (three Google faces self-hosted by `next/font` at build, the same path Orrery's Caveat and Patrick Hand take), a dateline, a lead story above the fold, the rest in ruled columns below it, drop caps, justified two-column body text on wide screens, and a print stylesheet. Each article carries one **infographic drawn on the server** from the same numbers the text uses: rough.js ink (a copy of Orrery's `ink.ts`, `SEED = 213`) in black with one spot red, like an editorial illustration. "Concise and easy to understand" becomes a contract the tests enforce: 180 to 350 words a body, a Flesch-Kincaid grade of 8 or under, no sentence over 35 words, every number sourced on an allowlist of public sites.

The first edition is **six articles** on everyday science (§4): why the sky is blue, why we need a leap day, how your phone knows where it is, what a gigabyte holds, why ice floats, how tides work. The whole project is about 1,500 lines, one plan, two build tasks plus QA and acceptance, in the shape of the Rotor and Barometer plans.

## 1. The repo today (06f25bf, 2026-10-21)

- Eight projects follow the house recipe (Shore, Capsule, Orrery, Elements, Vinyl, Rotor, Planisphere, Barometer). Each has its own root layout, a hand-written stylesheet, `_lib/*.test.ts` under `npm test`, an `isolation.test.ts` that reads the other route groups from `app/`, a `scripts/walk-<name>.sh`, a row in `site.projectList`, a line in `e2e/rbac.test.ts` and `lib/build-stamp.test.ts`, and a README block. Baseline this run: `npm ci` then `npm test` passes **741** tests.
- pm-206 (motion) landed since Barometer and adds three rules a new project must meet, all read from the tree by tests: `lib/motion.test.ts` wants the stylesheet to carry the hop rule, the typed root fade, the `fade-in`/`fade-out` keyframes, `h1 { view-transition-name: project-<group>; }` and a last `prefers-reduced-motion` block that also zeroes `::view-transition-group(*)`; the root layout repeats `@view-transition{navigation:auto;types:hop}` in an inline `<style>`; and **the route-group directory name must equal the URL slug** (the test derives both the `h1` name and the `/projects` row from the directory name). So the group is `app/(articles)/`, not `(gazette)`, because the address the idea asks for is `/articles`.
- `lib/motion.test.ts:67` asserts `PROJECTS.length === 8` and `scripts/probe-motion.mjs` hard-codes the eight slugs (line 30) and "8 row rise animations" (lines 504 to 513). The new project edits both to nine. The probe then hops `/projects` → `/articles` on its own.
- No active plan is on the board (`plan_manager_list_plans` is empty), so the shared lines (`content/site.ts`, `package.json`, `e2e/rbac.test.ts`, `lib/build-stamp.test.ts`, `lib/motion.test.ts`, `scripts/probe-motion.mjs`, `README.md`) have no competing editor today. On a rebase conflict keep both sides' lines (lesson iss-9).
- The brief names `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md`; neither exists in this checkout, and `AGENTS.md` holds only the `next dev` block. The Rotor and Barometer plans are the rules (decision recorded).
- Walk and probe ports in use: 4019 to 4057 (walks, Barometer's fake), 4061 (motion probe), 4063 (signed-in probe). Gazette's walk takes **4065** and 4067 for its "nothing listens" negative check.
- A fresh checkout has no `node_modules`; every task starts with `npm ci`. The Google Fonts CSS endpoint answers 200 from the pod, so `next/font/google` can fetch at build as it does for Orrery.
- The site already has a **Notes** page (`/notes`, three dated one-liners in `content/site.ts`). The Gazette does not replace it: notes are the owner's own short remarks inside the site's layout; articles are explanatory pieces for a general reader in their own paper. No sidebar entry is added: `lib/pages.ts`'s `PublicPage.href` union and the handheld's LCD menu (five lines of pitch 10 in a 56-unit screen, `lib/pages.ts`) are sized for the five site pages, and every project is reached from `/projects` (decision recorded).

## 2. What was checked, and what was not built

| Question | Answer | How |
| --- | --- | --- |
| Can a static `[slug]` route with `cacheComponents: true` prerender every article and 404 the rest? | Yes, this is Orrery's exact shape: `export const ensureStatic = "navigation"`, `generateStaticParams` over the list, `notFound()` for an unknown slug, a group `not-found.tsx`. `node_modules/next/dist/docs/.../ensureStatic.md`: `'navigation'` requires the complete route to be static and needs at least one params object. | Read the docs and `app/(orrery)/orrery/[body]/page.tsx`; not rebuilt (nothing new to prove). |
| Do the newspaper faces exist in `next/font/google`? | Yes. `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` lists **Playfair Display** (400 to 900, italic, variable), **Old Standard TT** (400, 700, italic), **UnifrakturMaguntia** (400, latin) and the alternatives Libre Caslon Text, EB Garamond, Source Serif 4, Playfair Display SC. | Read the font list; `fonts.googleapis.com` answers 200 from the pod. |
| Is a readability cap measurable without a library? | Yes. A 20-line Flesch-Kincaid grade with a vowel-group syllable count scored two sample paragraphs in the target register at **4.6** and **5.1**, Orrery's callouts at 1.2 and a one-sentence textbook definition at 28.1. A cap of **8** leaves room and still rejects dense prose. The heuristic is deterministic, so the number in the test is stable. | `/tmp/fk.mjs`, this run. |
| Is any dependency needed? | No. No MDX, no markdown parser, no motion library. Articles are typed data (plain-text paragraphs), infographics are rough.js path data drawn by a server component, the look is CSS. `package.json` changes only in the `test` glob. | — |
| Throwaway `next build` | **Skipped.** The three risks a spike would retire (static `[slug]`, Google fonts at build, cross-group isolation) are each already proven by a shipped project on the same config; a build would only repeat them (decision recorded). | — |

## 3. The product

**The front page, `/articles`.** Top bar as every project (`otohime.dev`, `← All projects`, plain `<a>` since they cross root layouts). Then the paper:

- **Masthead:** "The Otohime Gazette" in UnifrakturMaguntia, centred, between a 3px double rule above and a 1px rule below; this is the page's one `h1` (so the row title on `/projects` morphs into it on the hop). Under it a dateline row in small caps: `Vol. I · No. 1 · Wednesday, 21 October 2026 · otohime.dev · Free`. The edition date is the newest article's `published` date, formatted by a pure function with a month table (no `Intl`, no clock), so the page is the same bytes on every build.
- **Above the fold:** the lead story (the first article in the list): kicker in small caps, headline in Playfair Display 900 at 44px, the deck in italic, byline `By Otohime` with the reading time, its infographic across the full width, then the first two paragraphs and `Read on →` to the article page.
- **Below the fold:** the other five in a three-column grid (one column under 640px, two to 960px) with 1px vertical rules between columns and a 1px rule above the row: kicker, headline at 24px, deck, a small render of the same infographic, reading time, `Read on →`. Each card is an `<article data-article="<slug>">` so the walk counts six.
- **Colophon:** one line on sources ("Every number links to where it came from") and the type ("Set in Playfair Display, Old Standard TT and UnifrakturMaguntia, self-hosted"), and the licence line for the text (CC BY 4.0 for the Gazette's own words, if the owner wants it reusable; the plan decides).

**An article, `/articles/<slug>`.** The same top bar, then the masthead in one line at 24px with `← Front page`, a 1px rule, kicker, the headline as the `h1`, deck, byline, published date (`<time datetime>`), reading time, the infographic in a `<figure>` with a `<figcaption>`, the body in two justified columns from 720px (one column below), a drop cap on the first paragraph, paragraph indents and no paragraph spacing (print convention), a boxed **Sources** list (numbered, each an `https` link), then `← Previous` and `Next →` within the edition's order, and the colophon. `metadata.title` is the headline; `description` the deck.

**Infographics.** One per article, drawn on the server as SVG from `_lib/figures/<slug>.ts`, a pure function returning `{ viewBox, paths: InkPath[], labels: Label[] }` from the article's `facts` (the numbers), so a number cannot differ between the text and the picture. Ink is a copy of Orrery's rough.js wrapper with `roughness: 0.9` (steadier than the posters' 1.4, as an editorial illustration is) in `--ink`, with one spot colour `--spot` (a printer's red, `#b23a2f` light / `#e07a6a` dark) for the thing the article is about. Labels are real `<text>` in Old Standard TT at a size that is 12px or more at 390px. Each figure gets `role="img"` and an `aria-label` from `figure.alt`, and the caption restates the point in one sentence. Motion follows the house grammar: strokes carry `pathLength="1"` and draw on over 600ms at load, labels fade up after; the resting pose is the whole drawing, so reduced motion and no-CSS show it complete.

**Type and colour.** `--paper #f3eee3`, `--ink #1a1816`, `--muted #5d564c`, `--rule #c9c1b2`, `--spot #b23a2f`; dark from the OS or the pinned `localStorage.theme` (Barometer's script and CSS shape): `--paper #171513`, `--ink #e8e1d4`, `--rule #3d3730`, `--spot #e07a6a`. Newsprint grain as an inline data-URI dot pattern (Orrery's trick, no fetch). Headlines Playfair Display, body Old Standard TT 18px/1.45, small caps via `font-variant-caps: small-caps` for kickers and the dateline. Body columns: `columns: 2; column-gap: 32px; column-rule: 1px solid var(--rule); text-align: justify; hyphens: auto` from 720px, left-aligned and single column below (justified narrow columns make rivers). `html lang="en"` is required for `hyphens: auto`. Drop cap: `initial-letter: 3 2` where supported, a floated 3-line fallback under `@supports not (initial-letter: 3)` (Firefox still lacks it). A `@media print` block hides the top bar and navigation and prints black on white.

**No JavaScript, on purpose.** Nothing on these pages needs a browser script: no form, no state, no clock. The isolation test asserts **zero** `"use client"` files under `app/(articles)/`, and the walk checks that no served HTML contains `$RC` or `<template id="B:` (nothing streams) and that each article page is under 150 KB.

**What is not here, on purpose:** comments, search, tags, an RSS feed, pagination, MDX, a CMS, a database table. Articles are a TypeScript file each; adding one is a commit. An RSS feed (`/articles/feed.xml` as a route handler built from the same list) is a cheap second edition item if the owner wants it.

## 4. The first edition: six articles

Each entry below is the brief the engineer writes from: the point, the key numbers with where they come from, and the infographic. Bodies are written in the plan's register (short sentences, concrete things, one idea a paragraph, no jargon without an everyday word beside it). Source allowlist: `https` on `en.wikipedia.org`, `*.nasa.gov`, `*.noaa.gov`, `www.gps.gov`, `*.usgs.gov`, `*.nist.gov` (the pattern of Orrery's `bodies.test.ts` and Elements' facts).

| # | Slug · kicker | Headline · the point | Numbers (source) | Infographic |
| --- | --- | --- | --- | --- |
| 1 (lead) | `why-the-sky-is-blue` · Sky | **Why the sky is blue.** Sunlight is every colour; air molecules scatter short (blue) waves far more than long (red) ones, so the sky away from the Sun is scattered blue, and a sunset is what is left after a long path through air. | Scattering goes as 1/wavelength⁴ (Wikipedia: Rayleigh scattering); blue ≈ 450 nm, red ≈ 700 nm, so blue scatters about 5.5× more (computed from the same law); violet scatters more but the Sun emits less and eyes see it less (NASA Space Place: Why is the sky blue?) | A beam of sunlight entering a band of air; blue arrows peeling off in every direction, red carrying straight to a small figure; a second, low beam at sunset crossing a much longer slab of air. |
| 2 | `why-we-need-a-leap-day` · Calendar | **Why February gets a 29th.** A year is 365.2422 days; a 365-day calendar drifts a day every four years, so a leap day is added, except on century years, except again every 400. | Tropical year 365.2422 days; the Gregorian rule (every 4, not every 100, yes every 400) and its mean year 365.2425 (Wikipedia: Leap year, Gregorian calendar); without leap days the seasons would slide about 24 days a century (computed) | A drift bar: four stacked year-bars each 0.2422 day short, the gap closing with one leap day; a 400-year ruler marking the 97 leap days. |
| 3 | `how-your-phone-knows-where-it-is` · Numbers | **How your phone knows where it is.** Satellites broadcast the time; the delay from each gives a distance; three distances cross at one spot, a fourth fixes the phone's cheap clock. | GPS constellation of 31 operational satellites (as of 2024), orbit about 20,200 km, four satellites needed for a fix, civilian accuracy within about 5 m open-sky (gps.gov: Space segment, GPS accuracy; Wikipedia: Global Positioning System) | Three circles from three satellites meeting at one point, a fourth satellite with a clock; a scale bar "20,200 km up" against Earth. |
| 4 | `what-a-gigabyte-holds` · Numbers | **What a gigabyte holds.** A byte is eight switches and holds one letter; each step up (kilo, mega, giga, tera) is a thousand times more; a page of text, a photo, a film and a phone sit on that ladder. | Byte = 8 bits; SI prefixes ×1000 and the binary 1024 difference that makes a "1 TB" drive show less (Wikipedia: Byte, Gigabyte); typical sizes stated as "about" (a page of plain text ≈ 2 KB, a phone photo ≈ 3 MB, a film ≈ 4 GB) with the English Wikipedia text dump ≈ 20 GB compressed (Wikipedia: Wikipedia:Database download) | A ladder of five boxes each ×1,000, with the everyday object drawn beside each rung; the 1,000 vs 1,024 gap as a thin sliver on the top rung. The owner's own field, so the byline voice can be first person. |
| 5 | `why-ice-floats` · Earth | **Why ice floats.** Most things shrink when they freeze; water grows about 9 % because its molecules lock into an open hexagonal lattice, so ice is lighter than the water under it, and lakes freeze from the top down, which is why fish survive winter. | Ice density 0.917 g/cm³ vs water ≈ 1.000 (Wikipedia: Ice); water is densest at about 4 °C (USGS Water Science School: Water density); the hexagonal lattice (Wikipedia: Ice Ih) | Two jars: crowded liquid molecules vs a spaced hexagonal lattice; a lake cross-section with the ice lid, 4 °C water at the bottom and a fish. |
| 6 | `how-tides-work` · Earth | **How tides work.** The Moon pulls the near side of Earth's water more than the far side, so the oceans bulge on both sides; Earth turns through both bulges, giving two high tides a day; when the Sun lines up the tides are biggest. | Two bulges, about two high tides in 24 h 50 min (the lunar day); spring and neap tides at new/full and quarter Moons; the Moon's pull is about 2.2× the Sun's tidal effect (NOAA Ocean Service: Tides and Water Levels; Wikipedia: Tide) | Earth with two exaggerated bulges, the Moon to one side, arrows showing the difference in pull; a small inset of Sun-Moon-Earth in line (spring) and at right angles (neap). |

Second-edition candidates, same register, not in this plan: why bread rises (yeast and carbon dioxide), how a rainbow forms (42°), what compound interest does (the rule of 72), why the Moon shows one face. They fit the same data shape and need no new code.

## 5. The engine (`_lib/`, pure, no React)

```ts
// app/(articles)/_lib/articles.ts: the whole edition as data. Plain text only: no HTML, no markdown.
export type SourceKey = string;
export type Fact = { id: string; label: string; value: string; source: SourceKey };
export type Article = {
  slug: string;                 // [a-z-]+, the URL and the figure's file name
  kicker: "Sky" | "Calendar" | "Numbers" | "Earth";
  headline: string;             // ≤ 8 words
  deck: string;                 // one sentence, ≤ 30 words
  published: string;            // YYYY-MM-DD
  body: readonly string[];      // paragraphs; 180 to 350 words in all, none over 90
  facts: readonly Fact[];       // the numbers the text and the figure use, each sourced
  sources: Record<SourceKey, { title: string; url: string }>; // ≥ 2, https on the allowlist
  figure: { caption: string; alt: string };
};
export const ARTICLES: readonly Article[]; // front-page order, the lead first
export const bySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug);
export const neighbours = (slug: string) => ({ prev, next });   // Orrery's shape
```

- `readability.ts`: `syllables(word)`, `sentences(text)`, `fkGrade(text)`, `longestSentence(text)`, `textWords` (Orrery's counter), `readingMinutes(words)` (ceil of words/200, at least 1). All pure, all tested on fixed strings, with the four calibration paragraphs from §2 pinned (4.6, 5.1, 1.2, 28.1 ± 0.1).
- `edition.ts`: `editionDate(articles)` (the newest `published`), `longDate("2026-10-21") → "Wednesday, 21 October 2026"` with a month and weekday table (Zeller's or `Date.UTC` day-of-week, no locale), `volume(articles) → "Vol. I · No. 1"`.
- `figures/<slug>.ts` ×6 and `figures/index.ts`: `FIGURES: Record<slug, (facts) => Figure>`; `Figure = { viewBox: [w, h]; paths: InkPath[]; labels: { x, y, text, size, anchor?, spot? }[] }`.
- `ink.ts`, `roughjs.d.ts`: Orrery's copies, `SEED = 213`, default roughness 0.9. `words.ts`: Orrery's counter, `WORD_CAP = 600` for a whole article page.
- Tests (`*.test.ts`): `articles.test.ts` (six articles, unique slugs matching `/^[a-z-]+$/`, the lead is `why-the-sky-is-blue`, each body 180 to 350 words, no paragraph over 90, headline ≤ 8 words, deck ≤ 30, `fkGrade(body) ≤ 8`, mean sentence ≤ 20 words, longest ≤ 35, every fact names a source key, every source `https` on the allowlist, at least two sources each, `published` a valid date, every body paragraph free of `<`, `>` and `http`); `readability.test.ts`; `edition.test.ts`; `figures.test.ts` (every article has a figure, every path's numbers stay inside the viewBox with a 2-unit margin as Capsule's `art.test.ts` does, labels ≥ 12px at 390px for the viewBox's scale, label count ≤ 14, and a figure uses each of its article's `facts` ids at least once in a label or is listed as an exception with a reason); `ink.test.ts`, `words.test.ts` as Orrery's; `isolation.test.ts` modelled on Barometer's: no import of the site, Tailwind or another group; `_lib/` imports no React and nothing from `next`; only `ink.ts` imports roughjs; **no** `"use client"` anywhere in the group; no `fetch(`; no `process.env` outside `layout.tsx`'s build-sha line.

## 6. The page files

```
app/(articles)/
  layout.tsx                  own <html lang="en">, articles.css, three next/font/google calls (Playfair_Display, Old_Standard_TT,
                              UnifrakturMaguntia) with literal serif fallbacks, build-sha meta, the inline @view-transition style,
                              Barometer's pinTheme script, themeColor light #f3eee3 / dark #171513
  articles.css                tokens (light/dark), masthead, dateline, lead, column grid with rules, article body columns, drop cap,
                              sources box, figure draw-on, @media print, the hop block, h1 { view-transition-name: project-articles; },
                              the reduced-motion block last
  articles/page.tsx           the front page, server only; ensureStatic = "navigation"
  articles/[slug]/page.tsx    one article; generateStaticParams over ARTICLES; notFound() for the rest; generateMetadata
  not-found.tsx               "Not in this edition." with the masthead and a link to the front page
  _components/masthead.tsx    masthead + dateline (full and one-line variants), top bar (plain <a> home and /projects)
  _components/figure.tsx      <figure role="img"> rendering a Figure: <Ink> paths with pathLength="1", <text> labels, <figcaption>
  _components/card.tsx        a below-the-fold story card
  _lib/ articles.ts readability.ts edition.ts words.ts ink.ts roughjs.d.ts figures/{index,why-the-sky-is-blue,...}.ts *.test.ts
scripts/walk-articles.sh      port 4065
content/site.ts · lib/build-stamp.test.ts · lib/motion.test.ts (8 → 9) · scripts/probe-motion.mjs (slugs, 8 → 9) · e2e/rbac.test.ts · package.json · README.md
```

Row in `content/site.ts`: `{ title: "Gazette", note: "A small newspaper: six short pieces on everyday science, each with a drawn infographic.", href: "/articles", status: "live", colour: "pink" }` (pink is the one swatch no project uses yet).

**Walk, `scripts/walk-articles.sh`** (port 4065, Rotor's style, `grep -c`, no `wc -l`, servers killed by process group): `/articles` is 200 with the build-sha meta, no `aria-label="Main"`, a `/projects` link, the masthead text once in an `<h1`, the dateline with the edition date, exactly six `data-article="` cards, the lead's headline, no `$RC` and no `<template id="B:`, no client chunk of its own (at source level `grep -rl '"use client"' 'app/(articles)'` is empty, and the served HTML references no `/_next/static/chunks/app/(articles)` script), every `<a href="https://` in a Sources box on the allowlist; each of the six `/articles/<slug>` is 200 with one `<h1`, one `<figure`, one `<svg` with `role="img"`, a `<figcaption`, a Sources list with at least two `https://` links, `<time datetime="`, a reading time, prev/next links as the order says (the lead has no Previous, the last no Next), at most 600 visible words, under 150 KB; `/articles/nope` is 404 and shows the group's not-found; `/projects` links `/articles` once; `articles.css` is the page's only stylesheet and contains `@media print`. Negative: `BASE_URL=http://127.0.0.1:4067 bash scripts/walk-articles.sh` exits non-zero.

## 7. Plan shape (for the product owner)

Two build tasks, in order, both with `verification[]`, in the Rotor plan's form:

1. **The edition and its engine** (software_engineer, `qa: skip`; `_lib/` only, no route): `articles.ts` with the six articles written in full to the §4 briefs and the §5 caps, `readability.ts`, `edition.ts`, `words.ts`, `ink.ts`, `roughjs.d.ts`, the six `figures/*.ts`, every test in §5, the `npm test` glob, the README test line.
2. **The paper: front page, article pages, the hop and the walk** (software_engineer, QA required; depends on 1): layout, CSS, both pages, `not-found.tsx`, the three components, the `content/site.ts` row, `lib/build-stamp.test.ts`, `lib/motion.test.ts` and `scripts/probe-motion.mjs` to nine, `e2e/rbac.test.ts`, the walk, the README block.

QA for task 2 reads the paper at 390px and 1366px (no sideways scroll, drop cap and columns, the figure's labels legible, light and dark), checks one article's numbers against its linked sources, and runs the walk and the motion probe. Acceptance walks `/projects` → Gazette → an article → Next → Front page on the deployed site, with JavaScript off once.

**Decisions this research made (recorded):** the group is `(articles)` at `/articles` because `lib/motion.test.ts` ties the group name to the URL; the paper is called "The Otohime Gazette" and the row "Gazette"; no sidebar entry; articles are typed data, not MDX; zero client code; readability is a tested number (FK grade ≤ 8); no throwaway build.
