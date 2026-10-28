# t-1612 fix plan — run-9355

Cause: **code/provenance**. The migration and feature-introduction commit `c0368d1` has the wrong author, and `.github/workflows/ci.yml:82-86` does not inspect schema/migration paths. Production now serves delivery `f4b3de8`.

1. At `.github/workflows/ci.yml:82-86`, include `db/schema.ts` and `db/migrations/` in the guestbook author predicate. Add a CI fixture in `scripts/ci-workflow.test.mjs` that supplies a wrong-author migration-only commit and asserts rejection. This makes the pipeline reject future migration provenance errors. Do not rewrite or force-push main merely to alter historical Git metadata; send the immutable `c0368d1` mismatch to the plan decider for explicit reconciliation or a properly authored superseding migration delivery.
2. Run the five t-1612 verification commands on the corrected, pushed main descendant. Require a green checks gate for its exact delivery SHA and confirm production health SHA still contains it. If CI fails, read the failed job's raw log and compare the last green job plus CI-configuration history before choosing an environment cause.
3. Once deployed, independently test the live approved-row, moderation-isolation, pagination and quota paths using an isolated production-equivalent database or approved safe fixture. A queued CI run and the current empty public wall do not prove those outcomes.
