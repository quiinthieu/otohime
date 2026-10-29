# t-1766 — Susuki footer delivery evidence

Run `run-9686`, role `software_engineer`, plan `pm-299`. Task branch:
`pm-299-t-1766-susuki`, based on freshly fetched main
`2cc4b041a506d36bcf264c10b6f46fdcebacfb71`.

The server footer mounts a client loader and an absolute, inaccessible canvas
backdrop before the waterline. A single instanced strip draw renders segmented
blades and the optional four-pose fox atlas. The atlas is baked locally from
Canvas2D paths; there are no remote image/model assets or new dependencies.
The adapter owns passive input, seasonal uniforms, session persistence,
intersection/visibility scheduling, static fallbacks, context restoration,
adaptive blade count and resource disposal. EndStage's probe counters exclude
only the separate Susuki ambient callback, using a production-stable literal.

## Locked executable and execution boundary

- Installation: `npm ci`, unchanged package lock. Node `v22.23.3`, npm `10.9.9`,
  Next `16.4.2`, Playwright Core `1.64.0`, Chrome `156.0.8078.47`.
- Actual run invocation: Codex CLI, `gpt-6.1-sol`, reasoning effort `high`.
- Real production `next build` and `next start`, throwaway embedded Postgres 17
  with real migrations, real Chromium WebGL2 shader compilation/linking,
  instanced draws, framebuffer reads and `WEBGL_lose_context` loss/restoration.
- No fake renderer. Save-Data and missing WebGL2 are explicit browser capability
  fixtures; document visibility uses a property/event fixture. Native touch is
  dispatched through Chromium CDP. The existing e2e harness uses its Ghosts fake
  endpoint and Bottle tests use their declared network fixtures; those do not
  prove third-party services.
- Production build ID: `Ec1Db3USfDHQAflvEdlkx`.
- Field chunk: `.next/static/chunks/12qgltjgzy1gg.js`, SHA-256
  `5ca02dfa389bb4c1055229019d254b2dc447eff5ad2dd7e5735319091ec1ff16`.
- Package-lock SHA-256:
  `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`.
- Executable fingerprint: SHA-256 of ordered `sha256sum` output for
  `components/susuki-field.tsx`, `components/susuki-field-loader.tsx`,
  `components/end-footer.tsx`, `lib/susuki.ts`, `lib/ink-particles.ts`,
  `lib/seasons.ts`, `app/(site)/globals.css`, `scripts/probe-end.mjs`,
  `e2e/susuki.test.ts`, `package-lock.json`, `next.config.ts`:
  `e8391b38fb8be6554832b0c4b09a13b5faae00b13e4ba943c0b9521d436f5fa0`.
  This binds the code, baked atlas/shaders, configuration, tests and lock,
  independently of subsequent evidence-only commit metadata.

## Verification with positive assertions

The final browser rerun reused the freshly built executable with `SKIP_BUILD=1`.
All commands ran locally before commit/push. The build itself passed TypeScript
and prerendering; no existing server was reused.

| Check | Executed command | Observed result |
| --- | --- | --- |
| susuki-and-footer-e2e | `TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/susuki.test.ts e2e/bottle-ui.test.ts` | 21 tests, 21 pass, 0 fail, 0 skipped: seven new Susuki tests and 14 Bottle tests |
| footer-walk-and-unit | `TMPDIR=/tmp npm test` | 2,696 tests, 2,696 pass, 0 fail, 0 skipped |
| TypeScript | `npm run typecheck` | type generation and `tsc --noEmit` pass |
| Lint | `npm run lint` | 0 errors, 11 existing warnings outside changed files |
| Gate closure | `TMPDIR=/tmp node scripts/check-gate-closure.mjs` | `local_controls: pass`, `failures: []`; its external evidence remains inconclusive |
| Footer HTTP/structure walk | `SKIP_BUILD=1 TMPDIR=/tmp bash scripts/walk-end.sh` | `walk: 67 ok, 0 failed` |
| Footer browser probe | `CI=1 SKIP_BUILD=1 TMPDIR=/tmp bash scripts/probe-end.sh` | `probe: 177 ok, 0 failed` |

The build-generated `content/history.json` was restored to its original contents
using the contract's `git checkout -- content/history.json`. No generated build
output, lock changes, binary assets or unrelated source changes are delivered.

The seven Susuki browser tests assert these outcomes:

1. Real instanced ink, pointer/scroll uniforms and fox cancellation: initial
   framebuffer contains **214,538 ink pixels** (alpha > 8), with 34 strip vertices
   and a bounded blade instance count. Pointer velocity and scroll boost reach
   the actual GL uniforms. Fox activation adds one instance to the same draw;
   pointer input immediately removes it and consumes the session. Hiding the
   backdrop changes footer/stage/Bottle bounding boxes by **0 px**. Exactly five
   SVGs remain and the waterline is the last footer element.
2. All four live season mutations change actual `uTint` values; a theme mutation
   changes them again. Canvas and backdrop are `aria-hidden`, contain no focusable
   controls, and accept no pointer hit testing. Every footer anchor passes native
   click actionability; an actual link click, Bottle modal activation and mascot
   click also succeed.
3. Reduced motion: one static WebGL draw, **214,484 ink pixels**, **0 ambient rAF
   ticks**, including after mouse, scroll, fox trigger and touch release input.
4. Save-Data: the same one-draw, nonblank, zero-callback result.
5. No WebGL2: one Canvas2D frame, **85,737 ink pixels**, zero GL calls and zero
   ambient rAF ticks.
6. Offscreen/hidden stop, live motion preference changes, actual context loss
   with `preventDefault()`, stopped callbacks while lost, and restoration to live
   drawing. **Negative control:** clearing the real framebuffer yields exactly
   zero ink pixels, then a subsequent actual draw resumes. Blank output cannot
   pass the nonblank predicate.
7. Native mobile touch produces a gust only during contact and clears both the
   exposed gust and actual pointer uniform on release. DPR is capped at 1.5.
   The attribute hook starts the fox, touch cancels it, and reload preserves the
   consumed session lock.

The complete footer browser probe also passes idle-loop/overlap checks,
keyboard/touch interactions, reduced motion, light/dark contrast, no-JavaScript
links, hydrated navigation, and its own corrupted-link and network-attribution
negative controls. Its final output includes:

```text
ok - negative control: verifyCanonicalLinks rejects a corrupted canonical footer href (/broken-play !== /play)
ok - negative control: after reload, the same verifyCanonicalLinks assertion passes
ok - errors: zero hydration errors across all contexts
ok - errors: zero console errors or page errors across all contexts
ok - network: zero unexpected external network requests from footer pages
probe: 177 ok, 0 failed
```

## Attempt history, limits and handoff

Five retained complete browser-suite captures were read for counts and failed
assertions: 19/20 (cursor fixture offscreen), 20/20 (before touch extension),
20/21 (native pan cancelled the pointer), 20/21 (post-release compatibility input
cancelled a newly triggered fox), and final **21/21**. Their failure tails point
to the relevant cursor/touch waits. Tests now reveal the canvas, observe held
contact before moving below pan slop, and start the fox before testing native
input cancellation. Application review also fixed lingering touch gusts and
unnecessary static touch-release redraws. An earlier build/typecheck attempt
found missing TypeScript annotations and lint found a `this` alias; both were
fixed and subsequent build/type/lint passed. The initial build log was overwritten,
so these retained captures are **not a complete historical CI/job record**.

The final source fingerprint above has no remaining observed local defect.
There are no pending local jobs after verification. No remote FAILED/COMPLETED
history, CI pipeline, callbacks, deployed system or global green gate was read;
remote history completeness is **inconclusive**. Local execution is demonstrated;
production integration/deployment and product acceptance are **unproven here**.
This is an SWE delivery report, not independent QA.

Deferred checks: plan-manager owns CI/green gate and deployed QA for `t-1766`
following the pushed delivery SHA in the summary report. A failed CI job or
failed deployed acceptance assertion returns this task for a fix. Pipeline/job
IDs do not exist in the evidence available before push and are not invented.
Per the role contract, this run stops at push and does not watch CI/deployment.
The platform-owned `expect=exit0` strings remain unchanged; the named assertions,
counts and negative controls above provide the positive verification evidence.

The referenced chief-of-staff document and `docs/claude/software-development.md`
are absent in this checkout; available `AGENTS.md`, local Next documentation and
the explicit task contract were followed. Decisions and the canvas-visibility
lesson were recorded through plan-manager during the run.
