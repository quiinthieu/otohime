# QA report t-1540 Console calls the model tier (run-8641): PASS

Delivery sha 8e02b8d21fc896acdc2e9c9874218427f0bec995 (author Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer; author.txt not supplied, checked with git log).
Checked tree: ce80089 (main). `git merge-base --is-ancestor 8e02b8d HEAD` is true. The delivered files (components/ask-console.tsx, lib/ask-tier.ts, lib/ask.ts, lib/ask-llm.ts) are unchanged between 8e02b8d and HEAD. Green gate for 8e02b8d: gate=green status=pass (supplied; I did not see CI or the deployed site).

## Independent runs (fresh npm ci, TMPDIR short)
- npm run typecheck: exit 0
- npx eslint components/ask-console.tsx lib/ask-llm.ts lib/ask-tier.ts: exit 0
- npm test: 1863/1863 pass, 0 fail
- bash scripts/probe-ask.sh (full build + next start, ASK_LLM unset): exit 0, 86 ok, 0 failed

## Negative control
Changed the console so the tier is never used (`(await tier.current && false) ? askModel : null`), reran the probe: exit 1, 69 ok, 17 failed. The failures include 0 POSTs, model lines not shown and no link to the cited page. The edit was reverted (git checkout; tree clean). A first mutation that deleted askModel broke the build, so it proves nothing and is not counted.

## Real / fake boundaries
- Real: built app with ASK_LLM unset. Its GET /api/ask returns 404; the console asks once per mount and sends no POST.
- Fake: every tier-on response (llm, server offline 429, abort, non-JSON, off-site link, 10 s hang) is a Playwright page.route fake. The real route, Anthropic, Postgres, Origin check and rate limits were not exercised; that is t-1541's probe. No live model call.
- Not observed: CI, the deployed site, production (ASK_LLM off there; operator action set-env:ask-llm-production).

## History
No CI or task-manager history was read (no access from this pod); the green-gate text was supplied. Treated as unverified beyond the local reruns above.

## Defects
None observed. Deferred: production walk after set-env:ask-llm-production, owner acceptance; fails if GET /api/ask is still 404 or the console makes no POST while enabled.
