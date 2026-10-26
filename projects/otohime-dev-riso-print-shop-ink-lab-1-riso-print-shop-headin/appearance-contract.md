# Appearance contract — pm-268/t-1598

The pure boundary lives in `lib/print-runs.ts` and `lib/ink-lab.ts`. It adds no browser effects, UI, dependencies, or changes to `MATERIALS`/`inkFilter`. Interfaces were declared first; adjacent `node:test` suites specify the behavior. The browser adapter, pre-paint script, CSS aliases and SVG updates belong to the next task.

## Types and resolution

| Type / function | Contract |
| --- | --- |
| `PrintRunId` / `PRINT_RUN_IDS` | `house`, `sumi`, `riso`, `indigo`, in that order |
| `PrintRun` / `PRINT_RUNS` | Recursively frozen repository presets, labeled House, Sumi black, Riso pink + mint, Indigo night |
| `AppearanceColors` | Readable `ink`, `muted`, `focus`, `line`; `paper`, `paper2`, `field`; decorative `hairline` |
| `AppearanceContext` | Caller supplies resolved light/dark `theme`, existing `season` (or null), and the root's current `house` colors |
| `resolvePrintRun(id, context)` | Invalid id falls back to House. Returns immutable preset, copied context, effective color scheme, colors, overrides and plate colors |
| `InkLabSettings` | Bounded numeric controls, three decorative hex plates, count 2/3, existing `Hand`, boolean halftone |
| `LabSnapshot` | `{version: 1, printRun, settings}`; complete, normalized, immutable |
| `AppearanceSnapshot` | `{printRun, lab: LabSnapshot \| null}`; selected persistent run remains distinct from the applied session override |
| `resolveAppearance(snapshot, context)` | Resolves applied Lab's run/settings if present, otherwise selected preset; returns `source: "lab" \| "preset"` |

Precedence is the root's existing house plus theme/season → persistent preset → explicitly applied Lab. Query preview state never enters the store without `applyLab`. Indigo resolves dark without changing `context.theme`; House restores that saved/system theme. Season is preserved underneath every preset. Roots supply their own house colors; the main-site `HOUSE_COLORS` reference is not a global override. House returns `overrides: null`, so adapters must leave root house tokens alone, including their existing decorative borders.

Preset numeric multipliers are Sumi 0.85/0.8, Riso 1.1/1.15, Indigo 0.9/0.9 for turbulence/displacement. House is 1/1. Default grain peaks are 0.06/0.03/0.04/0.03; halftone defaults off. Sumi uses two plates; others use three. Sumi/Riso use scheme-specific palette inputs from the plan; Indigo uses its night palette in both contexts. Fields reuse the primary paper for Riso/Indigo; Sumi uses the existing light/dark house field. Non-house meaningful borders use muted ink and focus uses body ink; hairlines are decorative.

`resolved.colors.ink` is always the readable heading anchor and body ink. Preset `resolved.plates[0]` follows that ink, including a root's seasonal tint. Lab's `settings.plates` may be freely edited, including the first swatch, but never replaces body ink or the anchor. Renderers must take decorative swatches from settings and readable text from colors. Existing `MATERIALS[settings.hand]` supplies stroke, tooth and wash; explicit Lab turbulence/displacement replace its resolved numeric controls. Seeds, scene geometry and interaction effects remain the adapter's responsibility.

## Version 1 URL and normalization

`decodeLab(query)` accepts a query string with an optional leading `?`, not an absolute URL. `encodeLab(snapshot)` returns a query without `?` in exactly this order, always emitting every field:

| Key | Setting | Range / values | House ink default |
| --- | --- | --- | --- |
| `v` | version | `1` | `1` |
| `r` | print run | house, sumi, riso, indigo | house |
| `t` | turbulence | 0.005–0.120, step 0.001 | 0.035 |
| `d` | displacement | 0–12, step 0.1 | 3.5 |
| `w` | wobble changes/second | 0–6, step 0.1 | 0 |
| `g` | **total** grain peak alpha | 0–0.06, step 0.005 | 0.06 |
| `p` | decorative plates | Exactly three comma-separated six-digit hex colors without `#` | 231e16,f3a6bb,93d3b0 |
| `n` | plate count | `2` or `3` | 3 |
| `m` | transition milliseconds | 0–1200, step 10 | 420 |
| `h` | hand | ink, pencil, crayon, watercolour | ink |
| `o` | halftone | `0` or `1` | 0 |

The maximum query is 2048 UTF-16 characters, excluding the optional leading `?`, checked before parsing. `decodeLab` returns `{snapshot, reason, message}`. Overlong input, non-string input, or an explicitly unsupported version returns House with a static polite explanation (`too_long`, `invalid_input`, `unsupported_version`). Empty/missing version means v1 for preview. Missing/invalid fields default individually; first duplicate wins, even if invalid; unknown keys are discarded.

Missing numeric fields use the selected run and hand's material defaults after multiplier, clamping and quantization. Thus changing `h` to pencil with no `t` uses the existing pencil turbulence. Explicit numeric controls override this. Default Riso ink turbulence is 0.039 and displacement 4; Sumi is 0.030/2.8; Indigo is 0.032/3.2. Values quantize to the nearest step (half steps upward); finite values clamp, non-finite values fall back. Decimal/exponent notation is accepted; empty/whitespace, hex numbers, units, NaN and Infinity are rejected. Strings never become CSS/SVG fragments.

`normalizeLab(unknown)` provides the same sanitization for typed control/apply inputs and strips extra fields. Settings use `#rrggbb` internally, lowercase; URL encoding uses `URLSearchParams`, so plate commas serialize as `%2C`. All numbers use their shortest canonical decimal representation. `decodeLab(encodeLab(s)).snapshot` equals `normalizeLab(s)`, and re-encoding is stable. Only known numbers, enums, booleans and validated colors leave the boundary. There is no eval, raw SVG, arbitrary CSS or filter URL.

## Store, lifetime and reset

`AppearanceStore` exposes `getSnapshot`, `subscribe`, `setPrintRun`, `applyLab`, `resetHouse`. `createAppearanceStore(ports)` is the pure reference implementation using injected `AppearanceStorage` factories (get/set/remove only). Factories are invoked inside try/catch, covering a throwing storage-object getter as well as methods. There is no import or access of window, document, localStorage or sessionStorage in either pure module.

| Operation | In-memory state | Storage |
| --- | --- | --- |
| Construct | Validate stored run, restore valid complete Lab | Read only the two appearance keys |
| `setPrintRun(id)` | Set run, clear Lab | Write local `otohime:print-run:v1` as validated id; remove session `otohime:ink-lab:v1` |
| `applyLab(snapshot)` | Normalize and apply Lab, preserve selected run | Write session `otohime:ink-lab:v1` as the complete canonical v1 query |
| `resetHouse()` | House, no Lab | Attempt removal of both appearance keys independently |

`getSnapshot` retains object identity until the value changes. A change notifies subscribers synchronously after storage attempts and state publication; unsubscribe removes the listener. Snapshots, settings, arrays and write results are frozen. Invalid runtime preset ids throw `TypeError` before state/storage mutation.

Mutations return `{snapshot, persisted, failedKeys}`. Any failure leaves the requested current-page state active, sets `persisted: false`, and identifies the failed keys without exposing exception text. Both reset removals are attempted even if the first fails. A partial preset write may leave a stale persisted Lab if its removal fails: the caller must disclose the failed key and cannot promise reload persistence. A blocked reset likewise cannot promise persisted values were removed. Never clear storage wholesale.

`readStoredLab` accepts only a complete exact canonical query produced by this codec; missing, partial, corrupt, unsupported, duplicate or noncanonical stored data means no override. This stricter restoration avoids turning damaged session data into an accidental House override. No theme, season, stamp, audio, focus or drawing key is read, changed or removed. Session persistence means same browsing context reload and document navigation; a new context with a fresh session port retains only the persistent preset. Opener cloning remains browser behavior.

The browser adapter must call preset-selection semantics on received cross-tab changes, clearing stale session Lab. It owns guarding browser access, storage events, pre-paint/hydration, DOM `data-print-run`/`data-ink-lab`, root tokens, resetting inline values and original numeric SVG attributes. Those effects are not claimed by the fake storage tests.

## Contrast and texture constraint

Body and muted text are tested independently against paper, paper2 and form fields, at both zero and the **maximum Lab alpha 0.06**, even when the preset's normal alpha is lower. The WCAG 2 sRGB calculation composites paper grain beneath text: white pigment on light paper, black on dark. Grain/halftone including house texture share one total alpha budget, never separate additive 0.06 budgets. They must remain behind glyphs, static, pointer transparent, and disabled in forced colors. A foreground overlay at 0.06 would fail House muted contrast; changing House materials to compensate is outside this contract.

Minimum ratios across the three named surfaces and grain endpoints (rounded down to two decimals):

| Preset / effective scheme | Body | Muted |
| --- | --- | --- |
| House / light | 13.39 | 4.74 |
| House / dark | 12.54 | 5.66 |
| Sumi / light | 13.39 | 4.74 |
| Sumi / dark | 12.54 | 5.66 |
| Riso / light | 12.28 | 4.93 |
| Riso / dark | 12.55 | 6.15 |
| Indigo / dark, either saved theme | 13.98 | 8.18 |

Tests also read all four seasonal house palettes from the existing CSS and check both schemes, papers and fields without duplicating seasonal colors in production. Meaningful preset borders/focus reach 3:1; decorative hairlines are excluded. Independent negative control `#aaaaaa` on white fails the text threshold. This proves the named presets and existing main-site seasonal inheritance; arbitrary isolated-root House materials remain owned by those roots, and later adapter tests must verify their actual rendered surfaces and no overrides under House.

## Verification boundary

Required commands are `node --experimental-strip-types --test lib/print-runs.test.ts lib/ink-lab.test.ts`, `npm test`, `npm run typecheck`, and `npm run lint`. They exercise real module imports and the store implementation on locked Node 22 dependencies. Only the storage objects are fakes, explicitly covering read/write/remove denial and throwing factories. They prove this pure foundation, not browser persistence, rendering, deployment or the completed Ink Lab product. Plan-manager owns CI and deployment verification after the delivery push.
