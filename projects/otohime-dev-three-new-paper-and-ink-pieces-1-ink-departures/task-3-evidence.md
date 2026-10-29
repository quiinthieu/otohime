# pm-301 / t-1787 — Ink Departures pure core

Run: `run-9712`, role: `software_engineer`. Base: `444953b99578374d5204dc9b5e71d93fd87ef07d`.
Branch: `pm-301-t-1787-departures-core`. Delivery SHA is the enclosing commit, resolved by `artifacts/commits.txt` and recorded immutably in the plan-manager summary. The session identifies the agent as Codex based on GPT-6; no exact model variant, runtime profile or effort setting was exposed, so none is inferred.

## Delivered behavior

- `lib/departures.ts` exports the row/status types, default and injectable Work/Projects builders, alphabet, normalization/padding, character paths, synchronized row frames and clack helpers. Actual content produces 10 Work rows and 11 project rows; each board contains all three illustrative statuses, with a hard 12-row cap. Names, notes, links and project dates come from static site content. Empty/small injected project catalogs remain empty/small rather than inventing entries.
- Schedules and statuses are explicitly described as illustrative in every row note. The content has no live run telemetry and all current projects are live; no source lifecycle metadata was changed to manufacture delayed or backfilling projects.
- A forward drum rotation visits every slot if it fits the budget; longer arcs are sampled evenly, wrap in alphabet order, and end on the normalized target. Frames exclude the starting glyph and include the target. The hard maximum is 12, including when callers request more. A non-positive or invalid budget yields one final frame and zero intermediate animation steps. Row frames hold completed cells until all cells settle.
- Unsupported Unicode glyphs become one blank cell, including emoji and uppercase expansions. Invalid cell widths throw `RangeError`.
- Clacks require enabled sound, full motion, and at least 60 ms since the previous cue. Caller-owned timestamps keep the model pure; `-Infinity` means no previous clack. Cues are compatible with `lib/sound.ts`: two short high oscillator ticks approximate clatter before a low latch, total duration 0.047 s, volume -22 to -24 dB and always below `MAX_DB` (-18 dB). This task supplies cue data, not noise-buffer synthesis or audio playback.

## Verification

Installed locked dependencies with `npm ci` (exit 0). Runtime: Node `v22.23.3`, Next `16.4.2`, TypeScript `5.9.3`, ESLint `9.39.5`. Read installed Next guides on the server/client boundary, TypeScript (including `next typegen`) and testing before implementation. Configured and checked repository-local owner Git identity with `scripts/setup-owner-git.sh`.

| Check | Actual command | Result |
| --- | --- | --- |
| departures-unit | `TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/departures.test.ts` | exit 0; 8 pass, 0 fail, 0 skipped |
| repository tests | `TMPDIR=/tmp npm test` | exit 0; 2,749 pass, 0 fail, 0 skipped |
| typecheck | `npm run typecheck` | exit 0; route types generated and `tsc --noEmit` passed |
| lint | `npm run lint` | exit 0; 0 errors, 13 warnings, all in untouched files |
| whitespace | `git diff --check` | exit 0 |

Focused test output:

```text
1..8
# tests 8
# suites 0
# pass 8
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 73.111625
```

Full repository output:

```text
1..2731
# tests 2749
# suites 2
# pass 2749
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 40185.156125
```

Typecheck and lint output:

```text
> next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully

✖ 13 problems (0 errors, 13 warnings)
```

The tests exercise every pair in the 41-character alphabet with budgets 1, 2, 5, 12, 100 and Infinity, plus default, zero, negative, fractional and NaN budgets. They verify forward progress, target termination, exact short paths, wrapping, normalization, row synchronization, frozen injected content, row limits and input/output isolation. Sound tests check the 59.999/60 ms boundary, a sequence producing only `[0, 60, 120, 180]` clacks, muted and reduced-motion suppression, invalid timestamps, cue duration and gain bounds.

Negative controls: row builders run with `Date.now`, `Math.random` and `fetch` replaced by throwing guards; actual static imports and default builders still execute. Unsupported characters, empty catalogs, invalid widths, muted sound, reduced motion and too-early timestamps exercise rejection/final-only behavior. These are real Node tests of the exported module with actual `content/site.ts`, `lib/sound.ts`, transitive manifest imports and locked dependencies; injected catalogs and clocks are deterministic test inputs. No fake browser, audio renderer, deployment or processor is presented as production proof.

## Executable identity

SHA-256 of tested inputs (evidence-only edits do not change these):

```text
b277b7f6b0f028df091316a3f601125c16f96acf448b1e69b0f8630535345dc0 lib/departures.ts
f833d787d7b1ee3e9fd5faa988bbe7baf8f89110cf656f5c425df4e4466f48e8 lib/departures.test.ts
7e924841a468d850cb8bbdf8d62a74f8b586759d4c65042e371c88bb511b3464 content/site.ts
7711e42a5aa37824caafd391d3cb61e48020c621749602af8f3975109387af7f lib/sound.ts
8c28d22034be719f76a16d93d8c642c41ae646ff5d1463858a08d85a3b02a43a lib/sketches.ts
37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570 content/portraits.json
9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b package-lock.json
31902b54fba14db30d5a63026588796ddd27599ac76e6660e2c0b3d3ec69ba2d tsconfig.json
321b992409329951687bbdf81ff936fd317055490a1c438e15a22abfe7f6606d next.config.ts
```

## Boundaries and follow-up ownership

Pure core execution is demonstrated. Production integration, browser playback and completed product delivery are not claimed by this task. There is no runtime queue or capacity deferral for this synchronous module. FAILED/COMPLETED platform job history was not inspected (zero pages); no complete historical, CI or deployed-system conclusion is made. Per the software-engineer role contract, stop after pushing and submitting the summary. Plan-manager owns the CI green gate at the reported pushed SHA; any failed gate returns this task. Task 4 owns React/CSS/page integration, browser accessibility, reduced-motion presentation and actual clack playback; failure to settle at final text, respect mute/reduced motion or throttle playback fails that integration task. No in-scope defect remains from local verification.

Recorded lesson: the referenced extraction document and `docs/claude/software-development.md` are absent in this repository; current `AGENTS.md`, plan, motion and sound rules are available and were used. No code knowledge graph tool was available, so relevant source was read directly. Decisions and the lesson were recorded through plan-manager.
