# t-1607 fix delivery — run-9111

Fixed G9008-1 and G9008-2 from run-9008. The fake rejects RSV1/2/3 at the first two header bytes, before reading
lengths, masks or payloads, closes 1002 and releases membership without room receive/fan-out. The room retains
the bucket timestamp high-water mark across rollback and attachment restoration; returning to the prior time
grants no tokens, and T+67 ms grants exactly one. Attachments still contain exactly `{id,tokens,at,invalid}`.

Delivery identity is the single commit containing this report; the full pushed SHA and subject are in the runner's
`artifacts/commits.txt` and the summary MCP `git_sha`. Starting application checkout: `83acf98` on `main`.
Actual profile: `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet worker `avietidol-mac-mini`.

## Verification

All nine contract commands passed on Node v22.23.3. Both root and Worker dependencies were installed with `npm ci`.

| Command | Result |
|---|---|
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'ghosts/*.test.ts'` | 25/25 |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/ghosts-fake.test.mjs` | 22/22 |
| Worker `npm ci` | exit 0, exact committed lock |
| Worker `npm run typecheck` | exit 0 |
| Worker `npm run test:local` | 17/17, actual Worker/DO construction and real bindings in workerd |
| Worker `npm run bundle:check` | exit 0; Wrangler dry-run exports/privacy assertions |
| Root `npm test` | 2380/2380 |
| Root `npm run lint` | exit 0, 10 existing warnings, no errors |
| Root `npm run build` | exit 0, production build in the actual checkout |

New regressions failed before the fixes: two rollback cases, three masked RSV cases and the partial-header case.
[Red evidence](regressions-red.json). Shared RSV tests first demonstrate an ordinary move, then require 1002,
bye and zero invalid fan-out against both the fake and actual Worker. The partial-header test also verifies that
the fake records no room frame. Existing text/binary/rate/cap/room-isolation and adapter reconstruction cases pass.

Reran the supplied QA probe, which uses the separately installed `ws` client rather than the delivered raw client
or shared cases: initially 8 pass/2 fail, finally [10/10 pass](independent.json). This is a SWE reproduction of the
prior independent probe, not a new independent QA verdict. Its negative controls reject evil Origin with 403,
close fifth malformed JSON with 1008 and prove ordinary fan-out before rejecting RSV1.

Worker fingerprint changed from `54ea22a371c9031e7f6e7801a246aea25a9b11841ccaa2ff1390bc48d186574e` to
`24da92a191ac0825a41cb0ac9963d2483bb7436cd2360967f32981fd0c91cd6f`. Actual local `/version` and the dry-run
bundle match it. [Fingerprint inputs](fingerprint.json), [source/lock/config hashes](source-hashes.json).
The locks, dependencies and Worker configuration were not changed. No new runtime assets are required.

## CI failure reproduction

The requested CI fix already landed in `17bca22` before this checkout: unset inherited CI for npm-stub cases,
explicit Chrome/node stubs for the runner branch, and bounded TAP annotations in `.github/workflows/ci.yml`.
No duplicate CI change was needed. Last-green #444 and failing #458 comparison is preserved in run-9008;
its raw hosted assertion was unread (HTTP 403), so attribution of that particular hosted job remains inconclusive.

Reproduced ae6573a's historical `lib/end.test.ts` against current `probe-end.sh` in Ubuntu 24.04, Node 22.23.3,
`CI=true`, with a Chrome stub on PATH: [raw failure](historical-end-red.tap) at line 336 expects the npm stub's
TMPDIR line but receives the runner-Chrome branch. Current Footer cases pass under the same conditions.
The first whole-suite container control had six fixture failures (root Postgres, absent git metadata/browser),
documented in [initial Linux tail](ubuntu-ci.log.tail.txt), rather than an observed transport defect.

Repaired the local test fixture: Ubuntu 24.04.4, Node 22.23.3, linux/arm64, non-root `pwuser`, original git metadata,
real Chromium 151.0.7922.34 at Chrome's expected path, `CI=true`. Entire current project suite passes
[2380/2380](ubuntu-project-green.tap.tail.txt). This is a local Linux control, not the hosted amd64 GitHub job.
No pipeline was watched and no deployed endpoint was checked in this SWE run, per the stop-at-push contract.

## History and delivery boundary

[History evidence](history.json): two pages each (offsets 0/10) read 20/1136 FAILED and 20/6772 COMPLETED globally;
current RUNNING 12/12, PENDING 1/1. Bounded history is incomplete; older unread attempts are inconclusive.
No matching ghost transport attempt was present in those two-page windows. Explicit lookups of SWE run-8976
and QA run-9008 show task-manager COMPLETED, callbacks delivered and plan-manager succeeded runs with persisted
rep-5268, rep-5281 and rep-5282; green verification ver-3585 is persisted. Read the prior SWE runner's 49-line
tail and an unrelated failed Desk runner's 446-line tail (push_not_on_main/rescue), without attributing it to ghosts.
The prior QA executable is identified by the old fingerprint above; unrelated newer SHAs do not resolve its defects.

- **Execution demonstrated:** real local workerd Worker/DO, actual WebSockets, both rooms, bounded limits and `/version`.
  Hibernation re-entry is a deliberately rebuilt GhostRoom on live state, not observed Cloudflare idle hibernation.
- **Fake boundary:** Node server and its own bounded wire parser; only this test process retains capped synthetic
  coordinate/header-presence logs. Worker application data storage and observability remain disabled.
- **Integration deployed:** unproven here. Plan-manager's green gate and QA own checks/production application ancestry
  for this pushed delivery; failure means a red required check or a live SHA lacking delivery ancestry.
- **Hosted Worker:** t-1611 owns activation after t-1610 automation. Failure means mismatched `/version` or missing
  real client fan-out. No credentials/operator chore is needed by this local-only task.
- **Product delivered:** not claimed. t-1608/t-1609/t-1610 own rendering/preferences/two-browser proof; those fail if
  their independent browser controls or graceful fallback fail. No capacity dependency or queued output is claimed.

No remaining defect was observed within this task's local scope. Reports and evidence stay in this plan folder;
the changelog only describes the behavior change. Build-generated `content/history.json` was restored.
