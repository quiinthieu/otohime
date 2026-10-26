# t-1559 Enter Ryugu-jo: summary (run-8731)

Plan pm-256. Role: software engineer. Run profile: claude-opus-5-5 (Claude Code, Linux lease).

## What changed

- **Palace route** `app/(ryugu)/`: its own root layout (`layout.tsx`, own `<html>`/`<body>`, only `./ryugu.css`, `robots: noindex, nofollow`), page `/ryugu` (static, `○` in the build), client scene `_components/sea.tsx`, pure engine `_lib/school.ts` (seeded ink fish that flee a pointer or touch) and `_lib/scene.ts` (mode rules, buffer sizing, a hand-written WebGL 1 caustic shader).
- **Fallbacks**: the server draws a still sea (SVG `feTurbulence` caustic, palace, fish at seeded positions). The client adds motion only when `sceneMode` says `live` (WebGL available and motion welcome). With no WebGL it is `static`, under reduced motion `still` (no WebGL context is requested at all), and in both cases no frame runs. While `document.hidden` the rAF loop stops, and it resumes on `visibilitychange`. A lost context drops back to the still sea.
- **Entry points**:
  1. `components/urashima-keys.tsx` + `lib/urashima.ts`: a capture-phase window listener mounted in the site root layout ahead of `{children}`. From the third letter on it `preventDefault`s the word's keys, so the Pocket console (which skips handled keys) never opens a page with the a's. Form fields, open dialogs (Pocket Terminal) and modifier keys are ignored.
  2. Pocket: a `▽ Dive` chip link in `components/handheld.tsx` menu controls.
  3. Footer: `components/end-footer.tsx` ends with a waterline band (`data-end-waterline`) whose link "Below the waterline: Ryugu-jo ↓" sits below the footer bar.
- Repo scanners updated for the new group: `lib/motion.test.ts` (ryugu is a sheet-only document like the zine; the root-layout body regex allows `<UrashimaKeys />`); the design-system `SIBLINGS` pin ryugu.css (counts 11 paper / 12 ink / 8 creams).
- `package.json` `test` now includes `'app/(ryugu)/_lib/*.test.ts'` (`lib/urashima.test.ts` is already under `lib/**`).

## Evidence (this lease, built from the delivery tree)

| check | result |
|---|---|
| `npm test` | exit 0, 2031 tests, 2031 pass, 0 fail (red gate had 1989; 42 new asserting tests in `lib/urashima.test.ts`, `app/(ryugu)/_lib/{school,scene,isolation}.test.ts`) |
| `npm run lint` | exit 0, 0 errors (the 10 pre-existing warnings, none in touched files) |
| `npm run build` | exit 0, `○ /ryugu` prerendered static |
| `npm run test:e2e` (SKIP_BUILD=1, embedded Postgres, `next start`, Google Chrome headless with SwiftShader WebGL) | exit 0, 75/75, including the 9 new tests in `e2e/ryugu.test.ts`; that file was also green on 2 further runs |

The new e2e tests cover: urashima typed at the top of Home lands on /ryugu after "ura" left the page on / (negative control: a lone A does open /work); typing into a field goes nowhere; the Pocket Dive chip; the footer waterline link by tap on a 390px touch viewport; one stylesheet with no Tailwind, machine, cartridge or chip rules plus noindex; live sea (rAF running, fish moving, a fish fleeing the mouse); the hidden page stops the loop and it resumes; no WebGL gives `static` (served fish unchanged, at most 2 rAF in 700ms, WebGL canvas at opacity 0); reduced motion gives `still` with 0 WebGL requests and no surface animation, then turns live when the preference changes.

**Negative control (mutation)**: deleting `if (step.take) event.preventDefault();` from `components/urashima-keys.tsx` and rebuilding made the keyboard e2e fail with `the word's a opened a console page '/work' !== '/'` and the unit source check fail. The file was restored, rebuilt and re-verified.

Real/fake boundaries: the browser, Next production server and Postgres are real. WebGL is SwiftShader (software). "No WebGL" is simulated by an init script that returns null from `getContext('webgl')`, and "hidden" by overriding `document.hidden`. Not checked: real mobile GPUs and Safari. The deployed site is not checked by this role (plan-manager runs QA after CI).

## Non-goals respected

No history replay, Tamatebako, audio, realtime visitors, snapshots or new runtime services.
