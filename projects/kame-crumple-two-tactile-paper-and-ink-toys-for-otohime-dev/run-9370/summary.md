# Basket and Iron delivery recovery

pm-274/t-1585 · run-9370 · 2026-10-28

Retained rescued implementation f7f55edfe4d10062cdb25704aa95d83f03b4ef83 (original c5664a80c16433b7da86da4e5e822f72922b5f8d). Revalidated bounded fixed-step basket physics, pointer/touch grips, keyboard/offscreen/reduced-motion placement, isolated per-card Reset and global Iron flat. Source accessibility/geometry, footer waterline/navigation, shell controls and Kame memory remain covered. No application rewrite was needed.

The previous run failed after its successful branch push: `push_not_on_main: HEAD c5664a80c164 is not on origin/main`. This run creates a task branch without rebasing the rescued checkout, adds task-prefixed evidence, then fast-forwards main for `git push origin HEAD`. The summary report binds the immutable pushed delivery SHA. The existing rescued commit is preserved rather than amended; see artifacts/commits.txt.

## Verification

All required commands passed with no failed, skipped or cancelled tests:

- Physics/shared lifecycle: 20/20.
- Repository suite: 2640/2640.
- Lint: zero errors, ten existing warnings. Next route type generation and TypeScript passed.
- Production browser: 39/39, including native opening hit versus rim-miss negative control, touch flick, keyboard/offscreen/reduced-motion paths, interruptions, per-card isolation and global recovery.

Real construction: unchanged-lock npm ci; Node22.23.3; Next16.4.2 production build/start; migrated embedded PostgreSQL17; locked Playwright1.64.0 and Chromium156.0.8078.48; real Canvas, mouse and CDP touch. Existing Ghosts external-service fixtures and injected clock/interruption conditions are explicit fake boundaries. Pageshow duplication uses a synthetic lifecycle fixture, not actual bfcache observation. Inspected the local hit screenshot; no binary asset is committed. Exact build, code/lock/config/test and emitted chunk hashes are in artifacts/fingerprints.json; results and log hashes in artifacts/verification.json.

## Evidence and limits

Actual run profile/model/effort: codex-sol-6-1-high / gpt-6.1-sol / high, from plan_manager_get_run(run-9370). Fleet worker avietidol-mac-mini.

Before delivery, inspected two FAILED pages (20/155), two COMPLETED pages (20/555), in-progress 4/4 and queued 0/0. Categories overlap; older history unread, completeness inconclusive. Latest historical failed run 40646398062, checks job 122676106582, failed E2E; raw log returned HTTP403. Its public annotation identifies the older accessible-link assertion at e2e/crumple.test.ts:80. Current source already contains the landed accessible-name/focus regression and negative controls. Historical failure and current executable differ; the saved comparison includes relevant source, lock and config. Compared with c5664a8, current task source/tests/lock are unchanged, while unrelated landed CI configuration differs. Do not infer the historical cause or deployed success from the new SHA. See artifacts/ci-history.json.

Dropped nothing from the rescued task. Unrelated CI/Ghosts/guestbook paths named in the rescue prompt are already main ancestors and are preserved. Excluded only this run's generated content/history.json by restoring its original committed bytes. The referenced extraction document and docs/claude/software-development.md are absent; supplied AGENTS and task rules govern. Installed Next lazy-loading and usePathname guides were read. Explicit decisions and the push_not_on_main lesson are recorded on the plan board.

Local execution is demonstrated; integration deployment and product delivery remain unproven. No runtime capacity, person-only setup, asynchronous compute job or persisted callback ingestion applies. Engineering stops at push; no pipeline watching or deployed-system checks. Platform green gate owns exact delivery CI (failure: absent main integration or red/skipped required checks). Independent QA/acceptance owns served identity and deployed basket/recovery negative controls (failure: stale/missing feature ancestry, input/content/geometry regression). Their exact-delivery obligations are listed in artifacts/verification.json.
