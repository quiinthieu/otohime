# t-1523 Terminal text adventure: summary (run-8718, claude-opus-5-5)

## Delivered
- `lib/adventure.ts` (pure, no DOM). `step(state, line)` returns `{state, lines, quit?, won?}` and never mutates
  its input.
  - Rooms (8): The Warehouse (start), The Lake, The Glacier, The Stream, Staging Table, The Broken DAG, Cron
    Tavern, The Catalog. Every exit has a way back and every room is reachable.
  - Things (4): an index lantern, a dedup net, a RETRY key and a schema.
  - Secrets (4), each found by using one thing in one room: the first commit (lantern in The Glacier), the lost
    partition (net in The Lake), the clean load (schema in Staging Table), the green DAG (key in The Broken DAG).
  - Verbs: look/l/x [thing], go <dir>, n/s/e/w and the full words, take/get/pick up, use, inventory/i,
    help/?, quit/q/exit, and restart.
  - `moves(state, query)` fills the palette with look, the exits, what lies here, what is carried, then
    inventory, help and quit.
- Persistence: `loadProgress` and `saveProgress` wrap every storage call in try/catch, so a storage that throws
  or is null means the game plays in memory.
  - The walk is saved after every line under `terminal-adventure` (JSON, strictly decoded; unknown ids are dropped).
  - Once all 4 secrets are found, the stamp "Keeper of the Pipeline" is added once to t-1522's `terminal-stamps`
    list, keeping any stamps already there. The `stamps` command shows it.
  - `restart` resets the walk but the stamp stays.
- `components/pocket-terminal.tsx`: `adventure` enters game mode. Every later line goes to `step()` until `quit`,
  and progress is saved after each one. If storage refuses the save, a single line says the walk lasts until
  reload. While playing, the palette and placeholder switch to game moves. The game ships in the terminal's lazy
  chunk, never in the loader.
- `lib/terminal.ts`: `adventure` now returns `effect {kind:"adventure"}` instead of the stub, the palette hint is
  "the data world", and the empty-stamps line reads "the adventure hides one".
- `lib/stamps.ts` is not changed: it is the stamp board's physics solver and earns or saves nothing (decision
  recorded).

## Evidence (macOS build-worker lease, Darwin arm64, Node 22, Next 16.4.2 Turbopack, Chrome via playwright-core)
| check | result |
| --- | --- |
| `npm ci && npm test` | exit 0, 1983/1983 pass (15 new in `lib/adventure.test.ts`; red gate had 1968) |
| `npm run typecheck && npm run lint` | exit 0, 0 errors; the same 10 pre-existing warnings, none in touched files |
| `scripts/e2e.mjs --test e2e/pocket-terminal.test.ts` (production build, embedded Postgres 17, `next start`) | 6/6 pass (4 existing + 2 new) |

What the unit tests assert:
- The map: 8 rooms including the five named ones, every exit reciprocal, all reachable.
- 4 secrets, each found with a distinct thing in a distinct room.
- Each verb and alias, with its edge cases.
- Purity: states are frozen and checked as JSON before and after each step.
- The full winning walk (18 lines): `won` is set on the last line only, and secrets arrive 0→1→2→3→4.
- Save and load in the middle of the walk, then finish from the loaded state.
- The stamp is written once next to an existing stamp and survives a restart.
- Private mode: a storage whose getItem and setItem throw (also null or undefined) never throws, and the game
  still wins.
- Strict decoding of garbage.
- Every palette move steps to a real action.
- The terminal wiring is read as text.

What the e2e asserts:
- In real Chrome, `adventure`, `take lantern` and `n`, then Escape and a page reload. `adventure` then says
  "welcome back" in The Lake with the lantern still carried.
- Finishing the walk prints the stamp; `quit` then `stamps` lists "Keeper of the Pipeline", and localStorage
  holds it.
- Private mode, with `Storage.prototype.setItem` throwing: the full walk still wins, the unsaved note appears
  exactly once, and nothing is stored.

Negative controls (unit):
- Removing the try/catch around the walk's `setItem` fails only the private-mode test.
- Disabling the stamp write fails only the stamp test.
- Both were restored, and the suite is green again.

## Boundaries and deferred checks
- Real: Next production build and server, React, Chrome, localStorage, embedded Postgres. Fake: the in-memory and
  throwing `StoreLike` in unit tests only.
- The deployed site was not checked (the task stops at the push). Owner: QA. It fails if, on
  https://otohime.dev/notes, "/" then `adventure` does not print "== The Warehouse ==", or a reload loses the
  walk.
- Non-goals not done: multiplayer, server persistence.
