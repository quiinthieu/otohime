# QA report t-1514 Season tokens on site (run-8493) — verdict: pass

Role quality_engineer, claude-sonnet-5-5. Delivery sha 6c953be; verified at HEAD b80e3d7 (6c953be is an ancestor,
`git merge-base --is-ancestor` ok). Author of 6c953be: Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer
(read from git log; no author.txt supplied). Green gate for 6c953be: pass (supplied).

Independent runs (fresh `npm ci`, node local):
- npm test: 1712/1712 pass. npm run typecheck: exit 0. npm run build: exit 0.
- probe-seasons.mjs: 14/14 including the north-only negative control (script winter vs resolveSeason summer).
- Served build (`next start`): /work and unknown address /nope-xyz (404 global document) both carry the inline
  script setting data-season, placed before `<body>`; the shared CSS chunk holds all four `:root[data-season=...]` rules.
Real/fake boundary: unit/probe use fakes for document/localStorage/Date/Intl; build and served HTML are real. Not run
here: a real browser paint (the SE's 34/34 Chromium run is its own, not re-run) and the deployed site (not checked; CI not observed).
History: no job queue involved; nothing deferred.
