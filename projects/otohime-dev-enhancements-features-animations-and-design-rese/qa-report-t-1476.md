# QA report t-1476 (run-8344): PASS

Delivery sha 284429c8b398e219ebb93ed7f5a7cc8deaf1b3b0 (ancestor of HEAD d4cb19c, the checked-out main; verified with merge-base --is-ancestor). Author Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer. Green gate: pass for 284429c.

Fresh checkout, npm ci, Linux, headless Chromium (Playwright 1.64.0), model claude-sonnet-5-5.
- npm test: 1459 pass / 0 fail
- npm run lint: exit 0 (9 pre-existing warnings)
- npm run typecheck: exit 0
- npm run build: exit 0
- probe-tilt.sh: 58 ok / 0 failed (leave rest 227-237 ms; both negative controls caught)
- probe-motion.sh: 510 ok / 0 failed. The first attempt aborted at once: port 4061 was in use on the lease. Rerun with PORT=4161 passed.
- e2e-local.sh APP_PORT=4099: 28/28

Source read of useTilt: pointer vector clamped to the unit circle, so rotation is at most 6 degrees. The transform sits on .machine-tilt outside the Inked filter. Reset on leave, cancel, query change, hidden document and cleanup. Rest has no transform.

Real/fake: real Chromium against local next start; no external services. Not run: Safari, Firefox, hybrid touch+mouse hardware. CI and deploy were not observed; this repo's gate result is the only gate evidence.
