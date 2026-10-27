# Ink Loom and Hanko Press

Plan pm-285 · revision 1 · product owner run-9072. Base SHA `01dfe6b0e79fb286927057cccadfe29da83214cb`. The requested extraction guide and `docs/claude/software-development.md` are absent from this checkout; `AGENTS.md` and the supplied role contract govern this draft. Research report rep-5330 is preserved in `research.md`.

## Outcome

Ship two discoverable paper-and-ink toys on otohime.dev:

1. `/play/loom`: an accessible 16-step, 8-row paper sequencer. Visitors stamp/toggle ink blots, start and stop a repeating playhead, adjust tempo (60–180 BPM) and swing, copy a shareable URL hash, and print a score-like PNG. Four distinct synth timbres cover square chip, soft marimba, brush snare and paper crinkle across eight pitched/percussive rows. The existing sound switch owns the only AudioContext and is off by default; Play is the sole audio unlock gesture. Reduced motion removes moving/pulsing ink and leaves an understandable step indicator. Background tabs stop scheduling. The existing tagged SVG ink filter participates in appearance changes.
2. `/play/hanko`: a visitor enters a short name and presses a deterministic vermilion seal, round or square with a carved edge. They can download standalone SVG and high-resolution PNG. A saved visitor seal appears as a client island on Notes and in the footer; a stable site seal is the server-rendered fallback. The name stays on the device and never enters a URL or server. Reduced motion removes the thunk animation, and the existing sound switch gates its cue.

The Play page links to both routes. Preserve existing navigation labels in `lib/pages.ts`, current Play content and all existing toys. No backend, account, paid service, binary asset, new dependency, or server storage is needed. Both features work silently when audio or storage is unavailable.

## Design and proof

- Loom pattern data is eight 16-bit row masks, serialized as `#t=<tempo>&s=<swing>&p=<eight hex4>` with strict length/range/character validation and a safe fallback. Hash writes use debounced `history.replaceState`; browser reload restores the grid. Scheduler math is pure and independently tested for tempo, swing, row masks and wrap. Web Audio uses a lookahead window, no second context, bounded gain (at most existing `MAX_DB`), reusable seeded noise, and teardown on stop, sound off, hidden page and unmount.
- Loom score layout is a pure drawing plan. Canvas export includes title, tempo, swing, rows and all blots; blob download is browser-only. Export failure leaves the pattern usable. Controls have accessible names and keyboard operation; the grid exposes row and step state.
- Hanko normalizes names with NFKC, trims, removes controls and caps at 12 visible characters. Seeded geometry and a fixed font stack make SVG byte-identical for the same normalized input. Round and square variants are both reachable. The SVG is self-contained. PNG draws geometry and text on canvas directly so browser SVG-image font limitations cannot remove glyphs. Download filenames are safe.
- The visitor's chosen seal is stored only after pressing. Notes/footer use a small client component that reads localStorage after hydration and responds to same-tab changes; blocked storage falls back cleanly. Server HTML remains deterministic. E2E asserts reload, cross-route continuity, storage failure, download content, reduced motion, no sound before a user gesture, and dark/light legibility.
- E2E uses semantic headings because `RisoText` duplicates visual text. New filter SVG source is added to the appearance regression test. Any new route `_lib` tests must be included in the `npm test` glob. Engineers read the relevant installed Next 16.4.2 docs before changing routes or client boundaries, as `AGENTS.md` requires.

## Delivery DAG

| # | Contract | Depends on | Visible QA |
| --- | --- | --- | --- |
| 1 | Loom pattern and sound engine | — | required: audible/browser lifecycle |
| 2 | Loom route, controls and print | 1 | required |
| 3 | Deterministic seal model | — | skip: pure model and tests |
| 4 | Hanko maker and downloads | 3 | required |
| 5 | Visitor signatures on Notes/footer | 3, 4 | required |
| 6 | Play discovery and integration | 2, 4, 5 | required |

Tasks 1 and 3 can start independently. A failed unrelated full suite must be diagnosed and fixed, not bypassed. Each engineer runs its listed checkout verification on the pushed SHA. CI/deployment status and independent browser observation belong to the green gate, QA and acceptance, not an engineering task's action list. No task waits for another natural run, human choice, or timed soak.

## External capabilities

`prerequisites.json` declares GitHub repository delivery, existing GitHub Actions, existing Vercel production, and the task-manager execution account. There is no new product runtime or managed secret. The production site is already served by existing infrastructure; this change needs no database migration or new provider key. The current typed probe results are in `prerequisite-probe.json`: the registered Git key is outside the secret adapter's managed set, the account adapter returned HTTP 400, and the service adapter does not allowlist GitHub Actions or Vercel. These are inconclusive about the actual existing capabilities; no physical operator chore was identified. Admission is `legacy_v1` shadow mode. A control-plane probe never proves runner credentials or production delivery. If a real person-only setup gap is observed, the first affected run raises an `operator_action` with exact chore and readiness signal at its start and ends; other work continues. Capacity uses platform placement, not an operator request.

## Acceptance

Acceptance independently reads the deployed SHA and matching CI checks, then walks both routes and the Play links on desktop and mobile. It tries an invalid hash and blocked storage as negative controls, verifies muted-by-default and reduced-motion behavior, checks a shared Loom URL after reload, checks score PNG and both seal downloads, saves a visitor seal and sees it on Notes/footer after navigation and reload. It records exact build/config/lock identity, bounded CI history completeness and raw failure evidence when relevant. A submitted build or unrelated green SHA alone does not establish product delivery.
