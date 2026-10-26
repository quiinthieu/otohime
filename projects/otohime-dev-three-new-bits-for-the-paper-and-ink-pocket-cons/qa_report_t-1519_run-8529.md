# QA report t-1519 Season ambient polish (run-8529)

Verdict: pass. Delivery sha 323b528 (HEAD of main in this checkout; no separate deploy, repo is checked out and built locally). Author Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer.

Fresh checkout: npm ci, rm -rf .next before each run.
- bash scripts/probe-seasons.sh: exit 0. node 19/19, layer 59/59, dial 45/45, joint 28/28 (390px and 1366px).
- npm run build: exit 0.
- npm test: 1723/1723.
- Independent negative control: f4a360b's seasons.css restored, node probe fails "one reduced-motion rule" (18/19); restored after.
- Real: built app under next start, headless Chromium. Fixture: layer made hit-testable for paint reads. Not checked: Safari/real devices, no deployed URL.
- No execution queue/history involved; green gate pass for 323b528 given in the task.
