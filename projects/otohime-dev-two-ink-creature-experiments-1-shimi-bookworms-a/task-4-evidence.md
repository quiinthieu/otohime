# Task 4 — Shimi pure core

Plan `pm-300`, task `t-1773`, run `run-9671`. Verified on 2026-10-29.
Branch: `pm-300-t-1773-shimi-core`, based on freshly fetched
`origin/main` at `2cc4b041a506d36bcf264c10b6f46fdcebacfb71`.
The immutable delivery SHA is attached to the plan-manager summary after push;
the commit manifest is [run-9671/artifacts/commits.txt](run-9671/artifacts/commits.txt).

## Delivered interfaces

- `shimi/rng.ts`: Mulberry32, FNV-1a UTF-16 string seeds.
- `shimi/body.ts`: immutable seeded swarm snapshots (3–5 creatures, 7–9
  strictly tapered segments, 3–4 phased leg pairs, twin antennae, three cerci),
  word-target movement, 48-slot trail rings at alpha `0.12`, and at most 12
  overlay notches. Notches expire after four simulation seconds and hover/focus
  restoration returns a new snapshot without changing text. Simulation uses
  explicit seconds, clamps a stalled frame to 100ms, and does nothing at `dt=0`.
- `shimi/walker.ts`: tag/attribute predicate for the main-text adapter to apply
  to every ancestor; Unicode word extraction strips URLs/emails before splitting.
  No DOM traversal or geometry measurement occurs in this core.
- `shimi/markov.ts`: immutable FIFO diet, at most 2,000 retained tokens and
  1,999 first-order transitions; seeded 4–10 word remixes or sparse-diet murmurs.
- `shimi/audio.ts`: ten C Yo pentatonic pitches (C4–A5, approximately
  `261.625..880 Hz`), one-note `Cue` values at `-28 dB`, `30..80 ms` envelopes,
  and an explicit monotonic-millisecond limiter. Options can lower the limits
  but cannot exceed three concurrent reservations or eight starts per rolling
  second. The playback adapter must reserve through the actual oscillator end,
  including the shared scheduler's release tail.
- `shimi/pref.ts`: strictly opt-in `shimi=on`, false server snapshot,
  synchronous same-tab notifications, cross-tab updates/clear, ignored unrelated
  storage keys/areas, removable shared subscriptions, and blocked-storage session
  fallback. `shimiKeyStep` returns progress `0..5`, handles case/overlap, and
  signals completion at five. The adapter filters editable/dialog contexts and
  consumes shortcut keys only once the previous progress is at least two.
- `shimi/pref-client.ts`: `useShimiEnabled(store)` accepts one shared injected
  store; its optional fallback stays off. The browser integration creates that
  store with `() => window.localStorage` and `() => window`. No browser globals
  are accessed by any delivered module. `lib/shimi.ts` re-exports the full API,
  including the client hook, without mounting UI or starting audio.

## Exact environment and executable identity

Real Node `v22.23.3`, npm `10.9.9`. Existing installed packages were checked
against `package-lock.json`: Next `16.4.2`, React/React DOM `19.3.0`, TypeScript
`5.9.3`, ESLint `9.39.5`, eslint-config-next `16.4.2` all match. No dependency,
lockfile or configuration changes; no asset or external model is required.

Lockfile SHA-256:
`9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`.

Executable/test/configuration fingerprint SHA-256:
`b8a64a54a590b21af36a2135ef8272008c467468516ee85975b0db1a06ad8eee`.
Reproduce by sorting these paths and hashing each UTF-8 path, NUL, raw file
bytes, NUL in sequence: `shimi/*.ts`, `lib/shimi.ts`, `lib/shimi.test.ts`,
`lib/sound.ts`, `package.json`, `package-lock.json`, `tsconfig.json`,
`eslint.config.mjs`, `next.config.ts`. This excludes evidence-only files and
binds the actual executable, dependencies and check configuration rather than
an unrelated documentation SHA.

Read the installed Next.js server/client component and TypeScript guides before
implementation. `AGENTS.md` was read; `~/.config/ai-agents/RTK.md` does not exist.
The requested `docs/claude/software-development.md` and
`projects/20260921222547_plan_manager_chief_of_staff_extraction.md` are absent
from this checkout/work directory. No codebase knowledge-graph tool was exposed;
inspected the relevant source directly, including `ghosts/pref.ts` and
`lib/sound.ts`. Owner identity check passes as Otohime.

## Verification output

`node_modules` exists; the contract's install guard therefore selects the
already installed locked environment. Final checks all exited 0:

```text
TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/shimi.test.ts
# tests 25
# suites 0
# pass 25
# fail 0
# cancelled 0
# skipped 0
# todo 0

TMPDIR=/tmp npm test
1..2703
# tests 2721
# suites 2
# pass 2721
# fail 0
# cancelled 0
# skipped 0
# todo 0

npm run typecheck
> next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully

npm run lint
> eslint
✖ 11 problems (0 errors, 11 warnings)
```

All 11 lint warnings are in existing unrelated files; none are in the delivered
interfaces. A separate strict TypeScript construction check passed with actual
`Window` and `localStorage` types supplied to `shimiPreferenceStore`.

The tests cover known PRNG/hash vectors, many seeds, anatomy, immutable stepping,
trail bounds, retained word targets during cooldown, stalled/static steps,
notch cap/expiration/restoration, rejected address/offscreen targets, the complete
skip-list, Unicode sanitization, FIFO/transition eviction, deterministic
first-order burps, sparse fallback, ten-note pitches across Unicode code points,
quiet bounded cues, simultaneous/rolling-second limiter rejection, opt-in
preferences, storage failure modes, subscription cleanup, and key progression.

Real preflight imports the entire barrel and client module in a fresh Node
process, constructs/steps the actual models and exercises the store. Browser
globals are throwing getters; `Math.random` and `Date.now` also throw. A negative
control first accesses each prohibited browser global and verifies rejection,
then the production imports/construction succeed. React SSR uses the actual
React DOM renderer to verify the hook's false server/hydration snapshot.
Additional negative controls reject the fourth simultaneous/ninth rolling-second
chirp and non-`on` persisted values.

## Boundaries and attempt history

The models, React imports/SSR, sound cue helpers, Node tests, TypeScript and lint
are real. Rectangles, storage ports and storage-change callbacks are synthetic
unit fixtures; they do not prove browser layout, actual cross-tab dispatch,
canvas drawing or audible Web Audio. No fake runner stands in for dependencies.

Local check history was fully read: initial 24 focused tests and 2,720 repository
tests passed; initial typecheck found `TS2322` because a fixture inferred mutable
arrays where the model returns readonly snapshots. Its explicit `ShimiSwarm`
return type fixed that error. Review added target-retention coverage and fixed
the corresponding movement behavior. Subsequent focused runs passed 25/25,
and both subsequent repository runs passed 2,721/2,721. Final typecheck and lint
passed after all source changes. No known core defect remains.

No platform runtime job, processor, callback or durable queue is used by this
pure-library task. External FAILED/COMPLETED job-history counts/completeness
are not applicable. CI is unobserved: this role stops at the push and the board
owns the CI gate. No deployment or delivered interactive product is claimed.

Task 5 owns browser verification (canvas/DOM filtering through ancestors,
hover/focus behavior, actual storage events, shared Web Audio scheduling,
Pocket/terminal/key wiring, visibility handling and reduced-motion rendering).
Those checks are outside this task's build contract, not capacity deferrals;
Task 5 must fail if its real browser tests violate the bounds or accessibility
behavior. There are no queued jobs or capacity checks awaiting follow-up here.
