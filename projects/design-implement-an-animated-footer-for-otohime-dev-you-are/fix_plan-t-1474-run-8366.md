# Fix plan t-1474 — cause=code

QA run `run-8366`, delivery `a750f28953d68eaf98f94befaace43e7d7bc9d4b`.
Owner: software engineer fixing t-1474. One reproducible defect, D1.

1. Change **scripts/probe-end.sh:34**. Before checking the length of TMPDIR,
   normalize/export it with `export TMPDIR="${TMPDIR:-/tmp}"`. Retain the
   existing long-path guard and temporary-prefix cleanup. This makes both
   local mode and `BASE_URL` CI mode safe when the optional variable is unset.
   Do not merely set TMPDIR in GitHub's workflow; the standalone documented
   command must work too. No footer rendering change is required by this finding.
2. Extend the footer wrapper regression coverage near **lib/end.test.ts:224**
   with an executable check of the absent-variable branch, or an equivalent
   bounded shell regression. The existing regex wiring check cannot detect an
   expansion before a fallback. Keep production dependencies unchanged and
   retain actual Playwright execution as the final dependency proof.
3. In the locked environment (`npm ci`, Node 22), rebuild with the correction
   SHA stamp. Run **all eight contract checks**, especially the real browser
   matrix under `env -u TMPDIR SKIP_BUILD=1 PORT=4083 EXPECT_SHA=<built-sha>
   bash scripts/probe-end.sh`. Expect all 164 checks, including the demonstrated
   canonical-href negative control, to pass. Also cover unset, empty and long
   TMPDIR branches. Run the independent QA driver from the companion report.
4. Commit as `pm-241/t-1474: Handle an unset temporary directory in the footer probe`,
   authored by `Otohime <quiinthieu@gmail.com>`, without coauthor trailer;
   push normally. A push to main triggers **CI checks** on demand through
   `.github/workflows/ci.yml:92–99`, then its existing production job. Do not
   change migrations/deploy semantics and do not force-push.
5. Read the new GitHub checks job and raw failing output if red. Expected:
   footer step succeeds after e2e/signed-in motion; production deploy runs and
   succeeds. If another unrelated regression fails earlier, identify it from
   that actual job, and do not claim the footer ran. Prior delivery failure:
   run **40218042174**, checks **121243956797**, skipped production
   **121245178054**. Last green comparison: run **40216527659**, checks
   **121238748532**, production **121240076560**, SHA **d4cb19c**. QA read both
   job states and the workflow git log/diff; this failure is not attributed to
   the runner. The exact remote stderr is access-limited, while D1 is independently
   reproduced locally.
6. Acceptance reads live `/api/health` and `build-sha`, verifies both a750f28
   and the correction are ancestors of the deployed SHA, and performs the
   direct user walkthrough. Existing live SHA **d4cb19cdb4fd03e307b4af78127beae9010237e3**
   does not contain a750f28. A green local gate alone cannot close this requirement.

Evidence access follow-up, not a speculative operator gate: raw GitHub logs for
job **121243956797** and the delivery's **author.txt** artifact returned 403.
The platform evidence owner should make those bytes readable to authorized QA;
then verify author.txt (44 bytes; SHA-256
`7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`) against
the mandated identity. The actual git author/committer already match and have no
coauthor trailer. This access limit does not excuse or change D1's code cause.

No human choice, capacity queue, future calendar event or soak is required.
Drive the correction and CI now; do not wait or poll for an unrelated SHA.
