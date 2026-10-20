# QA report: pm-198 / t-1136 (run-6686)

Verdict: **pass**. Cited sha: 97c4e0f26cc9576dffb947a6d3df7d97bc09899e (delivery and deployed).

Green gate for 97c4e0f: pass (`gate=green sha=97c4e0f status=pass`, all three contract lines). Production `/`, `/vinyl` and `/projects` serve `<meta name="build-sha" content="97c4e0f26cc9576dffb947a6d3df7d97bc09899e">`, so `git merge-base --is-ancestor 97c4e0f 97c4e0f` holds. main has since moved to 13b7bde, which only adds `projects/…/qa-t-1133.md` (pm-196).

Author: `Otohime <quiinthieu@gmail.com>`, Co-Authored-By trailers 0. This matches plan.commit_identity.

## Diff review

- `vinyl-app.tsx` `onKeyDown`: the tagName list became `el.closest("input, select, textarea, [contenteditable]")`, the same idiom as `components/handheld.tsx`. The change keeps `isContentEditable`, Space-on-button, the modifier guards and the `defaultPrevented` guard, and updates the comment. Nothing else in the handler changed.
- `probe-selects.mjs` has a `/vinyl keys` section at 1366×768 and 390×844 with every check the contract names. Each round reloads and places a record. The section also has the turntable control (ArrowRight changes the record, Escape empties the deck).
- `probe-selects.sh` header and README line 123 are updated. There is no CSS change, no `package.json` change, and nothing outside the listed interfaces changed.

## Contract verification (Linux job pod, Node v22.23.3, tree at 13b7bde = 97c4e0f + one QA markdown)

| Line | Result |
| --- | --- |
| `npm ci && npm run lint && npm run typecheck && npm test` | exit 0; 349/349 tests pass |
| `bash scripts/probe-selects.sh` | exit 0; probe: 49 ok, 0 failed (28 `/vinyl keys` lines are all ok) |
| `bash scripts/walk-vinyl.sh` | exit 0; walk: 49 ok, 0 failed |

## Negative control (the probe catches the bug)

In a throwaway worktree at 97c4e0f I restored only `app/(vinyl)/_components/vinyl-app.tsx` from `97c4e0f^`, ran `npm ci`, then ran `PORT=4043 bash scripts/probe-selects.sh`. It exited 1 with **probe: 31 ok, 18 failed**. These lines failed at both viewports:

- Escape closes the picker: not ok. Escape leaves the record and phase alone: not ok, `loaded -> empty` (the deck ejected the record).
- ArrowDown+Space changes the value, closes the picker, and leaves the phase alone: all not ok, `loaded -> buffering` (the deck started playback).
- ArrowRight and ArrowLeft leave the record alone: not ok (Harbour Lights became Velvet Morning or Nocturne for Trains). The "Escape after" lines are also not ok.

The turntable control lines were ok both before and after the fix, so the deck still takes its shortcuts. I removed the worktree afterwards, and nothing from it was committed.

## Production (https://otohime.dev, build-sha 97c4e0f)

| Check | Result |
| --- | --- |
| `BASE_URL=https://otohime.dev bash scripts/probe-selects.sh` | exit 0; probe: 49 ok, 0 failed |

## The user path (headless Chromium, 1366×768 and 390×844, local and production)

With a record on the platter (`button.place`, deck `loaded`):
- Open Genre and press Escape: the picker closes, the value stays All (`""`), and the record and phase stay the same.
- Open Genre and press ArrowDown, then Space: a genre is picked and the picker closes. The deck stays `loaded` and does not play.
- Open Genre and press ArrowRight or ArrowLeft: the same record stays on the platter and the phase is unchanged. Escape then closes the picker.
- With the picker closed and focus on `.turntable-cell`: ArrowRight changes the record and Escape empties the deck.

The earlier picker checks (Vinyl look, and the site `select.field` in light and dark) are all still ok.

## Not run, and why

- **GitHub Actions status**: `gh` is not installed on this pod, and the private repo's API needs auth. I cite the platform green gate and the production build-sha instead. The deploy runs only after CI's checks pass.
- **Firefox**: this change is a JS guard, and `closest()` treats a native popup the same as before. The fallback was proved for t-1135 and is unaffected.

No application source was edited.
