# Ship The Bench — verify pm-171, complete it, deploy it (pm-180)

Idea: "Verify pm-171, complete the plan, and ship it". Research: reports
rep-3446 and rep-3447 (run-6164). The earlier plan is
[pm-171](../create-a-projects-page-where-we-will-list-independent-projec/plan.md).

## Verification of pm-171 (done in research, run-6164)

The Projects page (e097b14) is correct and on main (e7c679f). On a pod with
Node 22.23.3: `npm ci`, lint, typecheck, `npm test` (17/17), the bare
`node --test lib/pages.test.ts` gate command (4/4), `npm run build` and a
`next start` walk all pass. `/projects` is 200 inside the sidebar with Fig. 06
and "Nothing on the bench yet"; `/` shows five console lines from -146.

What is not done:

- pm-171 was abandoned seven seconds after its revision-2 task was proposed, so
  that task never existed. The repo has no `--experimental-strip-types` in the
  test scripts, no `BUILD_SHA` in `next.config.ts` and no `build-sha` meta.
- Production (otohime.dev) still serves 6456dd7: `/projects` is 404.

## Why production is stale (hypothesis, tested by this plan)

Every commit that deployed is authored `Ōtohime <quiinthieu@gmail.com>`. Every
commit since the stall is authored `Viet Ky <viet.ky@be.com.vn>` (pod jobs,
with a Claude Code trailer) or `Claude Code <noreply@anthropic.com>` (fleet
leases). Vercel Hobby deploys only commits authored by the project owner. Nobody
on the platform can read GitHub Actions for this private repo, so this is
inferred, not read. Other candidates that fit the same symptoms: a stuck
concurrency group, exhausted Actions minutes, an expired `VERCEL_TOKEN` or
`DATABASE_URL_UNPOOLED`.

One push separates them: a commit authored `Otohime <quiinthieu@gmail.com>`.
A normal main run takes about 4 minutes from push to live.

## Decisions

| Decision | Why |
| --- | --- |
| One SWE task: pm-171's revision-2 contract, committed explicitly as the owner with no `Co-Authored-By` trailer. | It is the smallest change that both completes pm-171 and tests the author hypothesis. |
| The commit author is set with `git -c user.name=Otohime -c user.email=quiinthieu@gmail.com commit`, not left to platform defaults. | Fleet leases still commit as Claude Code (pm-176 rep-3438); explicit flags work on any substrate. |
| An author gate is a verification item. | A wrongly authored delivery would silently not deploy and cost a QA cycle. The item runs only when the checkout has a `.git`. |
| `.github/workflows/ci.yml` is not changed. | A blind CI edit cannot be observed and could break the deploy path that last worked. |
| Production is checked by QA at its start (one curl), not waited for. | The push-to-live time is about 4 minutes and QA starts later. A 404 with a correctly authored commit is a `cause=environment` fail that re-raises the CI chore. |
| No operator action is raised by the task. | Nothing in the task needs a person. QA raises `sign-in-required:ci-provider:quiinthieu-otohime` only if the author hypothesis fails. |

## Not in scope

- Changing the Projects page, `lib/pages.ts` or CI.
- The lasting fix: an `actions:read` token bound as otohime's `ci_token` with
  `deploy_detection=workflow-success`. That is a person's chore.
- Real project entries; DB-backed projects.

## Tasks

### 1. Ship the Projects page: owner-authored commit with gate-proof tests and build stamp (software_engineer)

**Problem.** The Projects page is on main but production serves 6456dd7.
Vercel Hobby deploys only commits authored by the project owner, the gate
pods' Node 22.12 cannot run the `.ts` tests, and nobody can read which commit
otohime.dev serves.

**Action items.**

1. `package.json`: in `test` and `test:e2e`, add
   `--experimental-strip-types --disable-warning=ExperimentalWarning` before
   `--test`. Keep `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`.
2. `next.config.ts`: add `env: { BUILD_SHA: process.env.GITHUB_SHA ??
   process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" }` with a one-line comment.
3. `app/layout.tsx`: add `other: { "build-sha": process.env.BUILD_SHA ?? "dev" }`
   to the root `metadata`.
4. `README.md`: one line in the deploy section saying `<meta name="build-sha">`
   on any page names the live commit, and one line saying commits to main must
   be authored by the site owner's GitHub email or Vercel Hobby will not deploy
   them.
5. Commit explicitly as the owner, with no trailer:
   `git -c user.name=Otohime -c user.email=quiinthieu@gmail.com commit -m "pm-180/<task_id>: …"`.
   Before pushing, check `git log -1 --format='%an <%ae>'` prints
   `Otohime <quiinthieu@gmail.com>` and
   `git log -1 --format=%B | grep -ci co-authored-by` prints 0; amend if not.
6. Do not change the Projects page, `lib/pages.ts` or `.github/workflows/ci.yml`.
   Do not commit the `AGENTS.md` block that `next dev` re-adds.

**Interfaces.** `package.json`; `next.config.ts`; `app/layout.tsx`; `README.md`.

**Non-goals.** Changing CI, its secrets or runners; reading GitHub Actions;
new page content; DB-backed projects.

**Acceptance.** On a local `next start` of the delivery sha, signed out,
`/projects` is 200 inside the sidebar with Fig. 06 and "Nothing on the bench
yet"; `/` shows five console lines from -146; every page carries
`<meta name="build-sha">` with the build's commit; `npm test` passes on Node
22.12; the delivery commit is authored `Otohime <quiinthieu@gmail.com>` with
no `Co-Authored-By` trailer.

## QA and acceptance (for the roles that run later)

- **QA, first check:** `GET https://otohime.dev/projects`. Live means 200 with
  "Nothing on the bench yet" and `<meta name="build-sha" content="<sha>">`
  where `git merge-base --is-ancestor e097b14 <sha>` holds. Then pass and
  record that the author rule was the blocker.
- **Still 404 with a correctly authored delivery commit:** fail with
  `cause=environment`, point at pm-171's fix_plan.md, and raise
  `sign-in-required:ci-provider:quiinthieu-otohime` again with ready probe
  `GET https://otohime.dev/projects` (200, body contains "Nothing on the bench
  yet"), naming the remaining candidates. Do not edit `ci.yml` blind.
- **Acceptance:** walk the local build; if production is live, pass; if not,
  pass with a watch (`not_before` 15 minutes to a day ahead) on the production
  probe and leave the person's chore in the digest.
