# Fix plan: pm-180 / t-1045 (cause=environment)

Cause: environment. Delivery c3cc730 is right; the deploy pipeline has not published it.

No code change is needed. Do not edit `.github/workflows/ci.yml` (unchanged since 07eed29, 2026-10-18 19:09, before the last good deploy 6456dd7).

1. Someone with GitHub access opens the Actions run for c3cc730 on `main` (run name `pm-180/t-1045: ...`) and reads the failing or pending step. Likely candidates, in order: (a) the run is stuck, cancelled or never queued (concurrency group `ci-${{ github.ref }}`); (b) Actions minutes exhausted; (c) `VERCEL_TOKEN` expired -> the `npx vercel@64 pull`/`build --prod`/`deploy --prebuilt --prod` steps in the production job of `.github/workflows/ci.yml` (lines ~165-171) fail; (d) `DATABASE_URL_UNPOOLED` secret stale -> the `npm run db:migrate` step (line ~168) fails before deploy.
2. Fix that one thing in the repo settings (re-run the workflow after renewing the secret or freeing the group; no commit needed).
3. Done when `GET https://otohime.dev/projects` returns 200 with "Nothing on the bench yet" and `<meta name="build-sha" content="c3cc730...">` (or a later sha for which `git merge-base --is-ancestor c3cc730 <sha>` holds).

Operator action raised: sign-in-required:ci-provider:quiinthieu-otohime, ready probe `GET https://otohime.dev/projects` (200, body contains "Nothing on the bench yet").
