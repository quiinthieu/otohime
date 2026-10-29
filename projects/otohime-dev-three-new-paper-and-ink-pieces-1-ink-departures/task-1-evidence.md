# t-1785 — Senko Hanabi pure core

Plan `pm-301`, run `run-9711`, software engineer, attempt 1. Delivery branch:
`pm-301/t-1785-senko-core`. Base: `444953b99578374d5204dc9b5e71d93fd87ef07d`.
Delivery identity: the commit containing this file; the submitted report records its
immutable pushed `git_sha`. See `run-9711/artifacts/commits.txt`.

## Implementation and integration contract

- `lib/senko.ts` supplies ordered English/Japanese stage metadata, status text,
  immutable state transitions, reset/release behavior, deterministic stage jumps,
  bead growth, fading and gravitational drop. Stage starts are 0, 600, 3200, 6800,
  10400 and 13200ms of injected held time.
- `stepSenkoState(state, { dtMs, holding, reset?, dx?, dy?, pointerType?, steadyLatch? })`
  consumes active time only. Keyboard uses `pointerType: "keyboard"`; the latch
  also maintains hold. `out` requires explicit reset or stage selection to relight.
- Steadiness uses exponentially decaying displacement memory over 250ms and
  inclusive 24px mouse/pen versus 42px touch budgets (CSS pixels). Opposite
  movement accumulates; keyboard and latch clear jitter. A drop starts at 45px/s,
  accelerates downward, and extinguishes after 700ms.
- The caller owns a fixed pool of at most 200 reusable particle objects. As in
  `ink-particles.step`, particle stepping mutates only that pool and its injected
  RNG. Construct `rng = seeded(state.seed)` once per session. Particle steps use
  10ms increments and at most 250ms/call, discarding suspension backlog.
  Matsuba parents split once into 2–3 shorter-lived children if capacity permits;
  children cannot branch. Other stages have distinct speed, gravity, width,
  lifetime and glow profiles. Reduced motion halves primary emission and sets
  stem tremor to exactly zero, including a zero-time preference change.
- Crackle returns the existing `Cue` shape: non-overlapping triangle ticks at
  1100–1950Hz, <=50ms total, <=-24dB, and a >=100ms playback interval. Muted
  requests fail the gate. No AudioContext is constructed here.
- The route-private `_lib/senko.ts` re-exports the same implementation through a
  relative import that works under Node's type stripping and Next's compiler.

## Environment and source identities

Real runtime: Node `v22.23.3`, npm `10.9.9`, Next `16.4.2`, TypeScript `5.9.3`.
Existing installation verified by `npm ls --depth=0` (exit 0); all 522 entries in
`node_modules/.package-lock.json` match `package-lock.json` versions (zero
mismatches). No dependencies or lockfiles changed; this core has no asset/model
downloads, processor or external adapter prerequisites.

Actual run metadata from `plan_manager_get_run`: profile `codex-sol-6-1-high`,
model `gpt-6.1-sol`, reasoning effort `high`, runner `fleet`, worker
`avietidol-z490`. This is the recorded run configuration, not a current default.

SHA-256 fingerprints:

```text
2b639952132b3e025b14e62e1aee015e4b8d92c5443f86faaad47c5a18343d47  lib/senko.ts
067c8891470a3260afc902e6a88bfd6d6a8558edc1667d133a490fbac24c3d09  lib/senko.test.ts
2bbfd3dbfbaadb22cbbc7163cf7cb0ecfb5b93ce4d0916da6fdb490ebb162830  app/(site)/(app)/play/senko/_lib/senko.ts
9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b  package-lock.json
8f9738c8f9cf680970dc8c12c614f3f7a43796e4eac43ecd6f674e4ee9adaacd  package.json
31902b54fba14db30d5a63026588796ddd27599ac76e6660e2c0b3d3ec69ba2d  tsconfig.json
```

Read installed Next docs for project structure/private folders, server/client
boundaries and TypeScript before implementation. Owner Git identity configured
and checked using `scripts/setup-owner-git.sh`. The requested extraction guide
and `docs/claude/software-development.md` are absent; repository `AGENTS.md`,
`lib/motion.test.ts`, `lib/sound.test.ts`, and the plan govern this delivery.

## Verification output

All commands ran at the repository root; node_modules was already installed.

```sh
(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/senko.test.ts
```

```text
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 135.999427
exit 0
```

```sh
(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint
```

The three checks were launched independently against the same source tree:

```text
npm test:
1..2739
# tests 2757
# suites 2
# pass 2757
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 42134.299682
exit 0

npm run typecheck:
> next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
exit 0

npm run lint:
> eslint
13 problems (0 errors, 13 warnings)
exit 0
```

All 13 lint warnings are in existing unrelated files. No warning points to this
task's files. Raw local outputs are copied to `/shared/artifacts/` for this run.

## Evidence boundaries, negative controls, and follow-up ownership

The tests import the real module and route re-export, construct the actual pool
and cues, and execute the real physics under Node without `document`. Only elapsed
clock values and seeded RNG inputs are controlled: there is no fake simulation
runner, browser canvas, audio device, deployment, or remote job submission.

Negative controls include mouse dropping where touch survives, shaking versus
resting, keyboard/latch immunity, release extinguishing, out refusing to relight,
inactive stages refusing emission/branching, invalid deltas not advancing time,
and muted/sub-100ms audio requests refusing playback. A seeded two-second Matsuba
run observes both two-child and three-child families and rules out recursive
branching. Tiny and full-capacity pools retain their slot identities while recycling.

Local Senko run history is complete: the initial run passed 14/16; one defect
(zero-time drop changed bead glow) was fixed and one test incorrectly expecting
an upward willow spark to fall immediately was corrected. The final run passed
16/16. The repository suite passed 2757/2757. Both initial failures were read in
full; there is no known remaining defect from them. There are no runtime-job
FAILED/COMPLETED pages or callbacks in this pure-library scope. CI/deployment
history was not inspected and no CI/deployment success is claimed.

Execution demonstrated and task-1 core delivered locally; UI/product experience
remains owned by Task 2 per the plan. Browser Canvas, shared Web Audio
scheduling, gesture wiring, hidden-tab lifecycle, and deployed checks are outside
this contract. Plan-manager owns post-push CI/green gate; any failed job returns
this task. No unavailable capacity, operator chore, or timed wait is deferred.

Lesson recorded via `plan_manager_record_decision kind=lesson`: preserve the
bead's existing glow on drop so a zero-time step cannot change it.
