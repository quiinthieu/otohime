# pm-300 research: Shimi Bookworms + Ink Blot Test

Note: /shared is read-only in this pod, so answer.md could not be written. This body is the deliverable.

## Verdict
Both are feasible, small and fit the paper-and-ink style. Neither needs a dependency. Ship them as two plans. Inkblot goes first because it is self-contained, deterministic and testable. Bookworms touches every page, so it carries more risk.

## Repo facts that shape the design
- AGENTS.md says this Next.js is non-standard. SWE tasks must read node_modules/next/dist/docs/ first. Task interfaces must name a recognized top-level path (scripts/ or projects/<plan>/task-N-evidence.md) when they touch app/(site)/ route groups.
- Precedents to copy:
  - Route shape: app/(site)/(app)/play/booth, with its own css.
  - Neutral top-level module: ghosts/ has a pure *.ts core, an idle client-only loader.tsx, and a Pocket preference in pref.ts and pref-client.ts using useSyncExternalStore.
  - Lazy boundary: components/*-loader.tsx.
  - Audio gate: components/sound-toggle.tsx and press-sound.tsx.
  - Summon point: components/pocket-terminal*.tsx.
- User text already has a pipeline in the Guestbook (db/schema.ts guestbookEntry and guestbookUsage, app/api/guestbook, and guestbook-contract.md in the guestbook plan folder). It covers NFKC normalisation, a profanity and URL filter, a honeypot, HMAC IP/hour buckets, pending-to-approved moderation, cursor pagination, and no raw IP. Reuse it rather than building a second scheme.
- `npm test` runs explicit globs in package.json. A new _lib test directory must be added to that script or it will not run.

## 1. Shimi Bookworms

### Design
- **Module:** a new top-level `shimi/` folder, like ghosts/. Files: rng.ts (seeded mulberry32), body.ts (seed to segments, legs and antennae), markov.ts, walker.ts, audio.ts, pref.ts (off by default), loader.tsx, canvas.tsx.
- **Rendering:** one fixed full-viewport canvas with `aria-hidden` and `pointer-events:none`. It holds 3 to 5 creatures, each a chain of about 8 segments with sine-wave legs. Trails go on a low-resolution offscreen canvas with slow alpha decay. Cap at about 30 fps, DPR at most 2, and pause on visibilitychange.
- **Reading real DOM text:**
  - Walk text nodes with TreeWalker inside `main` only.
  - Skip script, style, input, textarea, code, pre, contenteditable, [data-shimi-ignore] and nav/forms.
  - Pick targets from cached Range rects refreshed on a throttle. No layout reads inside rAF.
- **Nibble is overlay-only (recommended):**
  - Draw a paper-coloured notch over the glyph on the canvas and mutate no DOM.
  - DOM mutation would break React hydration and reconciliation, copy/paste, screen readers, find-in-page and Notes output.
  - "Restore on hover" then becomes a notch fade on pointerenter or focus.
  - If DOM mutation is ever required, use a Map of originals, a cap of about 12 eaten characters, exact restore on hover, focus, disable, pagehide and route change, and a test that restore is exact.
- **Accessibility:**
  - Canvas is decorative and nothing focusable is added.
  - The speech bubble is a single non-announced status region, so text stays out of the screen-reader flow, with a visible toggle that has `aria-pressed`.
  - The "hidden key" must have a visible Pocket-command equivalent. Avoid single-character shortcuts (WCAG 2.1.4). Esc stops it.
  - Trail alpha must stay at or below .15 so text contrast stays AA.
- **prefers-reduced-motion:**
  - Never auto-start.
  - If the visitor summons explicitly, show a static state: creatures placed, no walking, burps only on a button press.
  - Listen for changes to the media query.
- **Sound:**
  - Web Audio is created lazily on the summon click, with one shared context and one gain node (about 0.05).
  - Blips are 30 to 80 ms sine or triangle, pitch from charCode mapped to a pentatonic scale.
  - At most 3 voices and about 8 blips per second.
  - Muted unless the existing site sound toggle is on. Suspend on blur.
  - No audio files.
- **Markov diet:**
  - Order-1 chain built locally from the words actually crawled, capped at about 2000 tokens. It never ingests form values, and strips emails and URLs.
  - Seeded and reproducible. Burps are 4 to 10 words with a 3 s bubble.
  - On by default only on /notes/[slug], and only after opt-in.
- **Summon:** a Pocket command `shimi` plus a localStorage preference, off by default, same pattern as ghosts/pref.ts.
- **Bundle:** dynamic import behind the preference. Target is at most 8 KB gzip for the chunk and main-bundle delta of at most 0.5 KB. Verify with next build route sizes.

### Risks
1. DOM mutation against React hydration and assistive tech. Mitigated by overlay-only.
2. Vestibular and distraction. Mitigated by off by default, reduced-motion, and an easy stop.
3. Trails lowering text contrast.
4. Audio surprises. Never autoplay.
5. Overlap with the Ink Ghosts canvas on Home. Use separate canvases and check z-index.

### Tests
- Pure tests with node --test: seed determinism for body and Markov, the walker skip list, preference default off, reduced-motion gate, pitch bounds.
- One e2e: summon shows an aria-hidden canvas, main text is unchanged, stop removes the canvas, and reduced-motion emulation does not auto-start.

## 2. Ink Blot Test (/play/inkblot)

### Design
- **Route:** app/(site)/(app)/play/inkblot with page.tsx, _components, _lib/blot.ts and inkblot.css. Add the _lib test glob to the test script.
- **Seed and sharing:**
  - URL `?b=<base36 seed>` selects a generated blot, so sharing needs no storage.
  - The daily blot uses seed = hash("inkblot:" + UTC date). Use UTC and document it.
  - Drip-blot sharing is a later follow-up (stored vector with a short id, or PNG export). Vectors are too large for a URL.
- **Generator and mirror:**
  - 8 to 20 soft drops on the left half from the PRNG, each with position, radius, elongation and splatter satellites.
  - Fold mirrors the half with `ctx.scale(-1,1)`, or in SVG for seeded blots.
  - Bleed is an SVG filter (feTurbulence, feDisplacementMap, feGaussianBlur, feColorMatrix threshold) on a container of at most about 640 px.
  - Animate only a 300 ms CSS flip, never filter parameters. Reduced-motion, or a slow device, gets an instant swap and a plain-blur fallback.
  - No p5.js. Canvas plus SVG is about 3 to 5 KB.
- **Accessibility:**
  - Keyboard drip path: arrow keys move a visible pen, Space or Enter drips (hold for bigger). Also a "Random drops" button and the seeded generator, which needs no pointer.
  - The canvas has role="img" with generated alt text (lobes, spread, density, seed).
  - The answer form uses a native label, textarea with maxlength, and submit button. Status goes in aria-live="polite" and focus moves to the result after the fold.
- **Answers and gallery:**
  - New table `inkblot_answer`: id uuid, blot_key, text (at most 80 code points), optional name (at most 24), status pending|approved|rejected, created_at. tilt and hand are derived server-side and never supplied by the caller.
  - Extract the guestbook text validation into a shared lib helper. Reuse the quotas (3 per IP-hour, a global daily cap, a pending cap), the honeypot, and the Origin check.
  - Index on (blot_key, created_at desc, id desc).
  - API: POST and GET /api/inkblot/answers with no-store, the guestbook 400/403/413/415/429/503 semantics, and cursor pagination. GET returns approved rows only. The submitter sees "pinned, awaiting the doctor's initials".
  - Validate blot_key against `^[0-9a-z]{1,10}$` or `^daily:\d{4}-\d{2}-\d{2}$`. Daily dates must be within one day of the server date, so nobody can create unbounded gallery buckets.
  - The gallery is handwritten-note cards, tilted by the stored tilt. Use a cursive system stack (0 bytes) or a self-hosted font subset of at most 20 KB.
- **Pseudo-reading:**
  - Deterministic and offline. About 40 templates and 20 fragments, with slots filled from blot features (lobes, density, splatter count, spread) and the visitor's own words, seeded by hash.
  - Labelled "a toy, not medical advice". No LLM in v1 because of cost, abuse and latency.
- **Hydration and OG:**
  - Render the blot client-side after mount to avoid hydration mismatch and midnight cache staleness.
  - Add play/inkblot/opengraph-image.tsx drawing the seeded blot as plain SVG shapes (no filter, because of satori).

### Risks
1. Free-text spam and slurs. Mitigated by the pending queue, filter and quotas.
2. The migration must be applied (`npm run db:migrate`) before the API deploys. Keep the migration as its own generated task, sequenced first, with a 503 path when the DB is absent.
3. SVG filter cost on low-end phones.
4. Date-seed timezone mismatch. UTC, with boundary tests.
5. Tone: keep it playful with no diagnostic claims.

### Tests
- `_lib/blot.test.ts`: same seed gives identical drops, mirror is exactly symmetric, daily seed at UTC midnight and leap day, blot_key accept/reject table, reading generator deterministic with no empty slot, alt text.
- API: copy the guestbook matrix (400, 403, 413, 415, 429, 503, honeypot, pending hidden from GET, cursor round-trip, key validation).
- e2e: seeded URL gives stable alt text, keyboard-only drip, fold and submit work, and reduced-motion fold has no transition.

## Suggested task split for the product owner
- **Plan A, Inkblot:**
  1. Pure _lib (generator, reading, key validator) with tests and the test-script glob.
  2. Page UI: canvas/SVG, keyboard path, fold, filter, reduced-motion.
  3. Migration, shared text-validation extraction, and API with tests.
  4. Gallery UI, OG image, and a link from the play index and Pocket.
  5. e2e, a11y pass, bundle check.
- **Plan B, Bookworms:**
  1. Pure core (rng, body, markov, walker, audio map, pref) with tests.
  2. Canvas, loader, Pocket summon, reduced-motion and sound gating.
  3. Burps on Notes.
  4. e2e, a11y, bundle check.
- Every SWE task needs verification[] and a recognized top-level path in its interfaces.

## Decisions made (none blocking)
- Overlay-only nibble.
- Seeded-URL sharing, with drip sharing deferred.
- UTC daily seed.
- Template-based reading with no LLM.
- Reuse the guestbook moderation pipeline.

## Not verified
- I did not benchmark SVG filter cost.
- I did not read the site sound-toggle API. The first SWE task of each plan should read components/sound-toggle.tsx and ghosts/pref.ts.
- I did not open the X posts. Implement from scratch and copy no Crawlers or REYSCHACH code or assets.
