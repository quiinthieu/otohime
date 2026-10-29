# Ink Bonsai and Shadow Theatre delivery

2026-10-29: the interrupted checkout contained the plan, with neither feature
implemented. `/play/bonsai` returned HTTP 404; production health reported
`017810c694e4e9ea256fc543b3ec213695875cc6`. This change implements both routes.

Local verification of the feature commit:

- `npm test`: 2,810 passing tests, no failures or skips.
- `npm run typecheck`: exit 0.
- `npm run lint -- --quiet`: exit 0 (the repository has existing lint warnings).
- `npm run build`: exit 0; both pages and `/og/bonsai` are in the route output.
- `node scripts/check-gate-closure.mjs`: certified real runner, all controls pass.
- `node scripts/vendor-hand-landmarker.mjs --check`: exit 0.
- Eight focused browser tests pass against a production Next server and a
  disposable, migrated local Postgres. Headless Chrome uses its fake camera.
- Desktop 1280px and mobile 390px screenshots reviewed; neither route overflows.

The browser suite checks pruning/regrowth, seasons, nonblank local PNG download,
deterministic OG PNGs, invalid weeks, reduced motion, mouse/touch/keyboard puppet
movement, permission/model failure fallback, real CPU Hand Landmarker
construction and blank-frame inference, camera Stop/visibility/route cleanup,
and all four synthetic pose/link paths. Gate regressions reject each renamed
required browser test.

The baseline snapshot was captured from quiinthieu's public contribution
calendar through 2026-10-29. Build refresh is optional and visibly falls back to
the committed snapshot offline. No visitor-time GitHub request is made.

Hand Landmarker float16/1 SHA256:
`fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`.
SDK 0.10.32, local verified assets, worker inference, same-origin worker CSP.
Real-device human pose recognition has not been manually qualified; synthetic
landmarks prove classifier behavior, and a fake camera proves lifecycle.
Paper puppets remain available independently of camera/model support.

An initial sandboxed unit run could not launch its browser/Postgres fixtures;
the complete rerun with the required local OS access passed. Initial feature
validation also caught a test-double type, page-transition wrappers, internal
links, and a fallback-message assertion, which were repaired before publication.

The first hosted PR run passed units, build, real camera verification and the
complete browser suite, then failed four signed-in motion assertions on the
unchanged Work/Projects pages. The same failure was reproduced on production:
the departure board uses a ViewTimeline that stays running until the visitor
scrolls. The probe now waits for finite animations on the document's time
timeline. A real-browser regression reproduces the old failure and retains
negative controls for running/paused clock animations, unresolved Suspense,
React transitions and unfinished page hops. All 78 affected CI/motion guard
tests pass locally; the four formerly failing Work/Projects cases also pass.

After integrating concurrent main releases, run 40838054209 reached Senko after
286 browser tests and was killed at the existing 1,200-second suite limit. It
also recorded an intermittent Pachinko drain timeout. That file retained prior
tests' pages and continuous canvas loops until file teardown; it now closes its
contexts after each test. All six Pachinko browser cases pass locally with the
original 12-second drain bounds. Current main subsequently supplied a
1,800-second suite bound, a 32-minute step and 50-minute job, which this branch
preserves. The workflow regression checks those bounds and retains failure-status
propagation and process cleanup.
