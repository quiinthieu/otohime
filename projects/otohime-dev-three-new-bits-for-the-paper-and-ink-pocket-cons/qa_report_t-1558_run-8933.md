# QA report t-1558 Ask tier production probe (run-8933) - verdict: pass

Role: quality_engineer, claude-sonnet-5-5. Delivery shas: 9cb3833 (run-8909), 6bb062c (run-8924); both ancestors of origin/main e87fb98 (merge-base --is-ancestor true). Green gate: pass for 6bb062c.
Authorship: both commits Otohime <quiinthieu@gmail.com>, 0 Co-Authored-By hits in the message bodies (no author.txt in the evidence; read from git log).

## Independent runs (fresh lease, npm ci, checkout e87fb98)
- npm test: exit 0, 2218/2218 pass, 0 fail, 0 skipped.
- npm run typecheck: exit 0.
- bash scripts/probe-ask-llm-fake.sh: exit 0, 64 ok, 0 not ok. Tier probe: on "30 ok, 0 failed"; on-control (non-JSON fake) "28 ok, 1 failed"; off "27 ok, 2 failed"; "tier verdicts: 8 of 8 reached".
- Negative controls: on-control makes the POST check fail; off makes GET 404 and the fake model sees 0 requests; unit tests cover (OFFLINE), off-site citation, 429, wrong Origin.
- Production, read-only: BASE_URL=https://otohime.dev bash scripts/probe-ask-tier.sh -> GET /api/ask 404; POST "not sent"; 27 ok, 2 failed; exit 1. Defined tier-off state; canned answer printed with no error element in all 6 forced-failure cases. No production POST was made (quota preserved).

## Real/fake boundary
Fake: Anthropic server, local Postgres, local next start. Real: production GET only.
Operator chore set-env:ask-llm-production is esc-413 (already raised; not re-raised).

## Not delivered / deferred
The live model tier is NOT delivered; execution against production is unproven. Deferred: BASE_URL=https://otohime.dev bash scripts/probe-ask-tier.sh, owner acceptance after esc-413's ready_probe passes; fails on any "not ok" line. Deployed sha not independently read this run (no CI/deploy API consulted); the tier-off production 404 is consistent with the task's stated state.
History scan: no job/CI history read; not applicable to this probe-only change.
