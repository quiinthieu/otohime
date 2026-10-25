# QA report t-1475 (run-8367): PASS

Delivery sha 916f58ff8a5b17e2ba5a87a3b0e76b6aa4b6c743 (feature 9550093 plus the free-port fix). It is an ancestor of the checked-out main HEAD 10b7043 (merge-base --is-ancestor ok). Author Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer. The green gate passed for 916f58f.

Run on HEAD 10b7043, Linux, headless Chromium, model claude-sonnet-5-5:
- npm test: 1490 pass / 0 fail
- npm run lint: exit 0 (9 pre-existing warnings)
- npm run typecheck: exit 0
- npm run build: exit 0
- probe-sound.sh: 101 ok / 0 failed
- probe-motion.sh: 510 ok / 0 failed (default port 4061 was busy, fallback used a free port)
- e2e-local.sh APP_PORT=4099: 28/28

Negative controls: the probe-sound eager-AudioContext control is caught. I also ran PORT=4377 with 4377 busy, and it was refused (explicit PORT is not overridden).

Real/fake: real Chromium against a real next start. The AudioContext spy is a fake, so blocked autoplay is simulated. Audibility was not judged by ear. Safari and Firefox were not run. CI and deploy were not observed beyond the supplied gate result.
