# QA report t-1545 Letterpress CSS (run-8672) - verdict: pass

Delivery sha 9d0b52c; checked at HEAD 303eaa3 (origin/main), which contains it (`git merge-base --is-ancestor 9d0b52c HEAD` ok). Author Otohime <quiinthieu@gmail.com>, no trailer (git log; author.txt not supplied). Green gate for 9d0b52c: pass (supplied).

Independent runs in my own checkout (npm ci first):
- lib/letterpress.test.ts: 16 pass / 0 fail.
- npm test: 1909 pass / 0 fail. npm run typecheck: clean.
- scripts/probe-cartridges.sh (real next build + start, headless Chromium): 100 ok / 0 failed, including "no filter anywhere on the shelf" in 5 modes.
- Negative control: injected `filter: blur(1px)` into letterpress.css; the test went 15 pass / 1 fail; reverted (tree clean).

Real/fake: real build, real browser probe, real CSS. Not run: probe-motion/probe-peeks (task 5). No deploy history applicable (CSS only, no job queue). Known gap (reported by SE): app/global-not-found.tsx lacks letterpress.css, so 404 keys stay flat; outside this task's interfaces.
