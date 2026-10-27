# Recover the existing Vercel production deployment

pm-257/t-1608, run-9128. **Cause=environment**, operator action **esc-427**,
fingerprint `vercel-ci-access:otohime-production`. Park without spending a code fix
cycle or retry. All original executable checks, independent local browser proof and
native checks121976229834 are green at **a958913b6a17f2cefda59882dfbdfcb0cd01e453**.

Production job **121981152892** in workflow **40439524623** fails its deploy/served-SHA
step. The raw annotation records Vercel CLI64.7.0 on Node22.23.3: both inspect calls
return `User not found`, and public health remains
**ea79432eb9bf23f40a18586eb91408ba1a585288**. The protected immutable deployment is
`https://otohime-olrgoztc7-otohime.vercel.app` (independent health302). Raw GitHub logs
are403, so no unsupported claim identifies which credential/account/scope is wrong.

Required same-job comparison: last green production **121977078467**, workflow
**40438060093**, ea79432, runner1000000884; red production121981152892, a958913,
runner1000000885. Both use ubuntu-24.04; pull/build/migrate pass in both. Git log/diff
ea79432..a958913 for workflow and deploy/verify scripts are empty. No delivered
renderer change can explain the explicit vendor account lookup error.

The operator's concrete configuration repair target is the existing GitHub repository
secret **VERCEL_TOKEN**, bound at **.github/workflows/ci.yml:272**, and its owning
project/team variables **VERCEL_ORG_ID / VERCEL_PROJECT_ID**, lines **273–274**.
Sign in to the owning Vercel account and GitHub repository, verify/recover that CI
access, inspect the protected deployment, and restore the deployment's production
promotion through the existing workflow. Keep secret values out of chat and git.
This is a credential/configuration change at those exact bindings; no speculative
application or CI-source edit is justified by the available evidence. The failed
script calls are **scripts/vercel-deploy.sh:102** and **:107**; preserve its public
health SHA requirement at **:127**. If authorized investigation instead establishes
a CLI scope defect, the subsequent SWE repair must name and test that exact scope
change at those call sites before pushing; do not silently label token rotation a
proven root cause. Vercel documents explicit team/scope and token options in its
[CLI global options](https://vercel.com/docs/cli/global-options).

After access recovery, the operator reruns the failed job using GitHub Actions
**Re-run failed jobs** for workflow40439524623, or an authenticated CLI:

```sh
gh run rerun 40439524623 --failed --repo quiinthieu/otohime
```

The existing workflow_dispatch on main is also an available pipeline trigger if a
fresh build is required. Do not force-push, bypass checks, weaken ancestry or change
the renderer merely to create another pipeline. Do not enable Cloudflare ghosts;
hosted activation remains t-1611.

Readiness probe for esc-427: GET **https://otohime.dev/api/health**, status **200**,
body containing **a958913b6a17f2cefda59882dfbdfcb0cd01e453**. The platform relaunches QA
when the action resolves. No polling or operator waiting occurs in this run.

Resumed QA must read the actual rerun/deployment ids and terminal outcomes, check
the original ver-3626 gate against the delivery, then require
`git merge-base --is-ancestor a958913 <deployed-sha>` exit0 and both roots' live
metadata/health agreement. Repeat the read-only runtime fallback and pixel/control
checks relevant to the recovered executable. Retain all six verification commands
from the original fix contract (focused16, npm test, lint, build, targeted Riso,
full E2E); rerun after any code/config change affecting the executable. Fail if the
live delivery remains absent, access errors persist, native checks regress, the
config route caches/misclassifies, or negative controls stop rejecting failures.

The separately recorded baseline **G9121-2**, unchanged
components/theme-toggle.tsx:71, remains t-1610 SWE/QA's defect. t-1609 owns preference
storage; t-1611 owns hosted Worker setup and final product proof. Pending recovery
does not waive any observed defect. Detailed scan limits, real/fake boundaries,
source/lock/artifact identities and raw evidence are in the companion QA report.
