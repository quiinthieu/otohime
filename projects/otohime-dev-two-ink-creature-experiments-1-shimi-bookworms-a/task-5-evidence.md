# t-1774 — Shimi overlay, Pocket/terminal/key summon, Notes burps

Plan `pm-300`, task 5. Verified locally on 2026-10-29 in this worktree.
Owner identity: `Otohime <quiinthieu@gmail.com>` via `bash scripts/setup-owner-git.sh --check`.

## Delivered interfaces

- `shimi/canvas.tsx`: body portal, `aria-hidden` canvas `pointer-events:none` z-32, ≤30fps, DPR≤2, overlay nibbles, trails, Notes burps, pill + Escape off. Colors from `getComputedStyle(document.body)`.
- `shimi/loader.tsx`: idle-mount canvas when enabled; capture-phase `"shimi"` key; ignores fields/dialogs.
- `shimi/shimi.css`: reduced-motion last.
- `components/kame/loader.tsx`: always mounts `<ShimiLoader />` before the eligible companion gate. `app/(site)/layout.tsx` untouched.
- `components/handheld.tsx`: Pocket chip `data-pocket-shimi` after Ghosts.
- `lib/terminal.ts` / `components/pocket-terminal.tsx`: `shimi [on|off|toggle]` and `bookworms`; `SUGGESTIONS` entry after `stamps`.
- `lib/sound-client.ts`: `playShimiChirp` reuses `playCustomCue` (one `AudioContext`).
- `e2e/shimi.test.ts`: default off, three summon paths, overlay-only nibbles, reduced-motion static, muted/sound chirps.

## Checks

| Check | Result |
| --- | --- |
| `lib/shimi.test.ts` | 25 pass (in the 80-test targeted run) |
| `lib/terminal.test.ts` shimi cases | pass; `suggest("s").slice(0,7)` unchanged |
| `lib/sound.test.ts` single AudioContext | pass |
| Home SSR | `data-pocket-shimi` present, zero `data-shimi-canvas` |
| Notes SSR | zero `data-shimi-canvas` |
| Orca home | chip `Shimi off` / `aria-pressed=false`; click summons canvas `aria-hidden=true`, `pointer-events:none`, `z-index:32`, pill + toggle |
| Orca `/notes/backfills-are-a-feature` | Burp phrase `idempotent from day one data-engineering` from the note vocabulary; main text unchanged by overlay |
| Orca rAF | tab did not fire `requestAnimationFrame` (centroid identical across 3s); live nibble walk is covered by `e2e/shimi.test.ts` in real Chrome |
| Playwright `e2e/shimi.test.ts` | Chrome launch blocked in this agent sandbox |
| `scripts/check-gate-closure.mjs` | blocked here by embedded-Postgres `shmget` / Chrome probes, same 13 `npm test` fails as on main |

Default remains off (`localStorage` `shimi=on` only). Reduced-motion CSS is last. Handheld chip is home-only; terminal command and the `"shimi"` key work on every site page via `KameLoader`.
