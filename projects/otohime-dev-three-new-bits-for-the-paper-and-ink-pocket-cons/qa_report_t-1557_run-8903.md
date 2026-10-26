# QA report t-1557 Ask deploy bundle probe (run-8903)

Verdict: pass. Delivery sha bca260a (ancestor of main 0366867). Author of bca260a: Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer (checked with git show). No author.txt in the delivery evidence.
QA run profile: claude-sonnet-5-5 (as invoked).

## Independent evidence (fresh checkout, `npm ci`, then own runs)
- `npm test`: 2168 tests, 2168 pass, 0 fail. (Before `npm ci`, with no node_modules, 22 dependency-import failures: environment of the lease, not the delivery.)
- `node --experimental-strip-types ... --test lib/ask-deploy.test.ts`: 8/8 pass.
- `npm run typecheck`: exit 0.
- Real executable: `next build` of bca260a, `next start -p 4111`, `BASE_URL=http://localhost:4111 bash scripts/probe-ask-deploy.sh`: linked 16, checked 21, carrying 1, exit 0.
- Negative control (static fixture, one linked chunk holding only `/api/ask-old`): linked 1, checked 1, carrying 0, exit 1.
- Unreachable BASE_URL (127.0.0.1:1): `not ok`, exit 1.
- Scope: git diff bca260a..HEAD shows no change under app/, components/ or lib/ask-tier.ts; build left the tree clean.

## Real/fake boundary
Real: local production build and server, the probe script, node fetch. Fake: the static fixture for the negative control; the unit tests' injected fetch. Production https://otohime.dev was not probed (non-goal).

## Identities and deploy
- Delivery bca260a. Green gate: pass for bca260a (reported by platform; I re-ran all three items).
- Live /api/health sha: 0abec76d8145fb16f1a5e31cfe78898ff61819ff. It is an ancestor of bca260a and does not contain it yet. The delivery is a read-only repo script; it adds no runtime behaviour to the site, so deployment is not required for it to work. Deployment of main is pending in the CI lane.

## History completeness
No CI job history was read (no gh CLI/API access here); the platform gate is the only CI evidence. Inconclusive for CI.

## Deferred checks
- Production chunk check, `BASE_URL=https://otohime.dev bash scripts/probe-ask-deploy.sh`. Owner: acceptance, after main (containing bca260a) deploys. Failure: exit 1 with the deploy newer than bca260a, then raise operator_action redeploy:otohime-web-production.
- Production enabled tier: owner acceptance, task 2 of the plan.

## Defects
None observed. Note: a correct build has no api/ask in any HTML-linked chunk; the crawl's lazy-chunk following is required and is verified here by the real build.
