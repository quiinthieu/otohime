# t-1562 · Add opt-in palace sound · run-8964 summary

Plan pm-271 (Ryugu Palace Experience · part 2). Role: software engineer. Run profile: Claude Opus 5.5 (`claude-opus-5-5`), effort low.

## What changed

- `app/(ryugu)/_lib/ambience.ts`: the palace's sea sound. It uses Web Audio only: 6 s of seeded brown noise, looped, through a low-pass at 360 Hz whose cutoff a 0.05 Hz sine moves ±140 Hz. The level is -38 dB, faded in over 2 s and out over 0.4 s. There's no audio file and no network. `createAmbience({ make, available, storage })` has four statuses: `off | waiting | playing | unsupported`. It makes no AudioContext until a gesture, and never throws.
- `app/(ryugu)/_components/ambience.tsx`: the palace's "Sea sound" button (`aria-pressed`, `aria-disabled` when there's no Web Audio, plus a `role=status` note). It sits on the paper strip under "Back to the surface". Engine hooks:
  - window `click`/`keydown` trigger the gesture (except the button's own click/Enter/Space, and Escape)
  - `storage` stops the sound when Pocket switches it off
  - `visibilitychange` suspends and resumes
  - `pagehide` and unmount call `close()`
- `lib/palace-sound.ts`: Pocket's external store over `localStorage["ryugu-sound"]` (`on`/`off`, default off). It is separate from the site's beeps (`sound`).
- `components/handheld.tsx` + `content/site.ts`: a `♪ Sea sound` chip beside `▽ Dive` (`aria-pressed`, `data-pocket-sea-sound`). It only writes the preference and makes no sound on Home.
- The palace and the site may not import each other (`isolation.test.ts`), so they share only the key string. Both test files pin it.
- `package.json` is unchanged: the existing `lib/**/*.test.ts` and `app/(ryugu)/_lib/*.test.ts` globs pick up the new tests, and `wiring.test.ts` now requires `ambience`.

## Verification (lease checkout, after `npm ci`)

- `npm test`: exit 0, 2260 tests, 2260 pass (was 2233 at red sha 1ca12d0). The new named tests are 15 in `app/(ryugu)/_lib/ambience.test.ts` and 6 in `lib/palace-sound.test.ts`.
- Mutation checks (each reverted afterwards):

  | Mutation | Tests that fail |
  |---|---|
  | Autoplay on load | ambience tests 6 and 8 |
  | Pocket's off doesn't stop the sound | ambience test 7 |
  | Pocket chip unwired | palace-sound test 6 |

  The unmutated control passes 15/15 and 6/6.
- `npm run lint`: exit 0, 0 errors, the same 10 warnings as at the red sha. The touched files are clean.
- `npm run build`: exit 0. It ran from an APFS clone at `/tmp/oto-8964`, because the lease path with a space breaks next/font (known lesson). `/ryugu` is static and serves `Sea sound: off`; Home's HTML carries `data-pocket-sea-sound`.

## Real-browser evidence (not CI)

`probe-sound.mjs` / `probe-sound.log` ran against `next start` of this build at localhost:4064, in Google Chrome via playwright-core, with an instrumented AudioContext. The real/fake boundary: real Chrome and a real Web Audio graph, a local production server, placeholder auth env. It was not deployed. Every check passed (`PROBE PASS`):

1. On a fresh visit, a click and a key create 0 AudioContexts (the negative control for scenario 2).
2. The palace button creates 1 context, which reaches `running`, and stores `on`.
3. Pocket's chip on Home (another tab) switches it off. The palace goes to `off`, its source is stopped, and Home creates no audio. Turning it on again from Pocket leaves the palace `waiting`, with no new sound.
4. A key in the palace plays the sound again. "Back to the surface" calls `AudioContext.close()` while it is `running`.
5. On a return visit with `on` stored, the palace is `waiting` with 0 audio events on load, and a key press makes it `running`. The palace button then turns it off and stores `off`.
6. With `AudioContext` deleted, the status is `unsupported` and the button is `aria-disabled`. A click stores nothing, and there are 0 page errors.

The probe found and fixed one defect: a keydown while the sound button had focus was ignored even for arrow keys. Now only Enter and Space are ignored there (they're the button's own click), and `ambience.test.ts` pins this.

## Not done / deferred

- No browser e2e was added to `e2e/ryugu.test.ts`, because that harness needs a Postgres DB. QA can rerun `probe-sound.mjs`. If QA reruns it, the result counts as evidence of the same scenarios, not independent proof.
- Delivery to otohime.dev is unobserved here. Plan-manager's CI/deploy/QA owns it, and it fails if `/ryugu` on the deployed sha doesn't serve `Sea sound: off`.
