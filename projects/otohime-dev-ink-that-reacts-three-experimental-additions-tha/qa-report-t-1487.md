# QA report t-1487: Ink hero on home (run-8374) — verdict: pass

- Delivery sha c58a037 (author Otohime <quiinthieu@gmail.com>, no Co-Authored-By); tested on main 4f2f787, which contains it (`git merge-base --is-ancestor c58a037 HEAD` ok). The repo is not deployed from here; green gate for c58a037 = pass (supplied).
- Independent reruns on a fresh `npm ci` checkout (linux, headless Chromium, SwiftShader): lint exit 0 (9 existing warnings), typecheck exit 0, npm test 1490/1490, `bash scripts/probe-ink.sh` 51 ok / 0 failed.
- Covered: settled at 1366x768 (2400 specks) and 390x844 (1200); pointermove scatters then settles < 3 s; reduced motion has no canvas and shows the SVG; ink-hero chunk never requested on /work; CLS 0 in <main>.
- Negative controls (in probe, all caught): motion guard bypass, rAF stopped, late 40 px box.
- Real/fake: WebGL2 via SwiftShader only, no real GPU. No CI result observable (no gh).
- Known defect, out of scope: masthead Account Suspense "Sign in" shifts ~0.000374 outside <main>, pre-existing on main. A strict whole-page CLS=0 check can fail intermittently.
- Note: a fresh lease without node_modules gives spurious failures until `npm ci`.
