# pm-269/t-1648 · run-9281 · QA handoff

This delivery documents the no-code resolution requested by the operator and
[fix plan run-9201](fix_plan_t-1648_run-9201.md). The operator reports that
`https://otohime.dev/api/health` now serves
`103f0c5511d4590e66a8a83b1a35acfe870e7ca3`, after QA sampled predecessor
`741f59c`. That is supplied evidence, not an independently observed production
result from this SWE run. The working Bottle implementation and direct
team-scoped API readiness need no speculative change. This commit changes only
this handoff and its architecture reference.

The tested base is `f2e1adfe1d04969255429a617bd4c8e6fceecf40`, fetched from main.
It contains `103f0c5`; subsequent unrelated footer/package changes mean the
current executable must be identified separately rather than borrowing an old
receipt. The current source/lock/configuration fingerprint is
`5eef65ac6fbd6dec7799c68d7b4a3a26767ac70ed1927b3cd277bd16edbfdcfb`.
Per-file hashes, complete local logs, build ids, named gate receipts and the
delivery SHA in `commits.txt` are saved in the lease's shared artifacts directory
(`shared/artifacts/run-9281/`). Generated build output and binaries are excluded
from the commit.

`node scripts/verify-bottle-contracts.mjs /tmp/pm269-run9281-artifacts` passed
all six exact contract commands and the deployment shell fixture. Every receipt
also passed its positive assertions and deliberate evidence-rejection controls.

| Contract | Result |
| --- | --- |
| Bottle layout and picker unit tests | 12/12 |
| `npm test` | 2,589/2,589; no skips |
| `npm run lint && npm run typecheck` | Exit 0; zero errors, 10 existing warnings |
| `node scripts/check-gate-closure.mjs` | Certified; real locked-package/binary preflight |
| Production Bottle browser suite | 14/14 |
| `node scripts/verify-bottle-footer.mjs` | 65 walk and 176 Chromium assertions |
| `bash scripts/vercel-deploy.test.sh` | 63/63 |

At all three required viewports (1366×768, 768×1024, 390×844), default/24px/32px
text and settled 200% root text retain at least 44px targets and positive border
and scene clearance. Normal scene gap is 4px; smallest measured top clearance
is 2.40625px. The default target grows from 44px to 45.796875px at 200% root text.
The same browser containment helper rejects both historical CSS mutations:
the old offset makes scene clearance negative; old padding makes border
clearance -9px. The explicit mixed-coordinate scroll control also passes.
Footer stage alignment, music TV clearance and ≤1px state stability pass.
Footer/Pocket gesture-only lazy loading, safe deliberate Visit, Escape focus
return, legacy Tab order, bounded/shared history and blocked-storage fallback,
real pending-only Postgres suggestions, offline/429 resilience, reduced motion
and no-JS all pass. Bootstrap is 1,634 gzip bytes; panel/CSS is 4,966 bytes;
open/close CLS is 0. Local browser build is `vS8SCdjf7m37eEiVb4GIY`; footer
build is `YU0u6ps4rHdzxXlPKnUBB`. Chrome is 156.0.8078.48 for Bottle and
Chromium 156.0.8078.4 for the isolated footer probe. No local gate failed.

The environment is checksum-verified Node 22.23.3 on macOS arm64 after `npm ci`,
with locked Next 16.4.2, React 19.3.0, Playwright Core 1.64.0, pg 8.23.1 and
embedded Postgres 17.10.0-beta.17. Gate closure imports the actual packages and
executes/checksums the PostgreSQL 17.10 binaries. Production Next builds,
migrations, local HTTP, browser and shell processes are real. Browser edge
responses, storage failures and historical CSS mutations are explicit fixtures;
the Vercel CLI/API/token fixture proves orchestration, not hosted authorization.
No live suggestion or external Visit is submitted by this run.

The actual persisted run profile is `codex-sol-6-1-high`, model `gpt-6.1-sol`,
effort `high`, worker `billie-mac`, account `codex-main`. The board and raw runner
identify prior run-9198 as `claude-opus-high` / `claude-opus-5-5` / `high`;
inherited Codex attribution for that earlier attempt is not reused.

Bounded coding-task history read FAILED offsets 0/3, limit 3: 6/106;
COMPLETED offsets 0/3, limit 3: 6/1317; RUNNING: 2/2. Global history is incomplete.
Prior delivery task `4555f7be-1b08-4ea6-8f08-ddf394560fed` has a raw tail ending
in the `103f0c5` delivery summary and a successful runner exit, task COMPLETED,
callback delivered in one attempt, and persisted run-9198 succeeded with zero
callback-application failures. Sampled failed task
`06e59416-c2fb-4814-bd7b-d6f7fcff0571` has a raw `push_not_on_main` guard failure
after its successful branch push, matching FAILED and a delivered callback in
one attempt. This is publication evidence for another task, not a Bottle
executable failure. Unread earlier log bodies/pages and callback transport
internals remain inconclusive. No hosted CI history is queried in this SWE run.

Local execution is demonstrated by the results above. No capacity is awaited.
Integration deployment and product delivery are not independently certified here.
Plan-manager/CI owns the complete green gate and production result for workflow
`40478220840` and the eventual delivery descendant; fail on any red job, failed
or non-READY team-scoped API readiness, or served SHA excluding `103f0c5`.
Independent QA owns a fresh served-SHA Footer/Pocket walkthrough at 1366×768 and
390×844, default/24px/32px labels and settled 200% root text, safe Visit/focus,
lazy/CLS budgets, and the unauthenticated admin-API negative control. Fail on any
contract regression or identity mismatch. These existing follow-ups are not
waived by the operator's health observation or this local rerun. This SWE run
stops at its tested push and summary; it does not poll CI or deployed systems.
