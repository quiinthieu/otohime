# Current Palace Changelog

Plan: pm-271 · revision 2 · product-owner run: run-9216 · 2026-10-27
Planning baseline: main 86dfe92; origin advanced to bbf394e during read-only inspection.
This revision supersedes only the remaining work in pm-271. The original pm-256
[plan.md](plan.md) and [research.md](research.md) remain historical records.

## Visitor outcome

A visitor opens the Tamatebako on otohime.dev and scrubs the real, current site's
changelog. For a single stable SHA S reported by /api/health, the newest visible
leaf L is an ancestor of S with at most MAX_LAG=20 commits between them, and the
note's total equals `git rev-list --count S`. Generation happens automatically
for every build; nobody refreshes and recommits JSON to make a deploy correct.

The list stays static and bounded to the newest 200 non-merge leaves. Its total
counts **all** reachable commits, including merges, to meet the operator's exact
acceptance requirement. A merge HEAD may have a non-merge newest leaf: validate
its lag separately from the total at the build SHA.

## Evidence and ownership

Acceptance run-9214 independently opened production in Chrome at 1366×768 and
390×844. At served b4e142a, the latest leaf was fe0dd82 (213 commits behind);
the note said 200 of 414 while that build had 627 commits. See
[walk.log](acceptance_run-9214/walk.log) and
[negative-control.log](acceptance_run-9214/negative-control.log).
A full-clone index reached 6809e82 (200 of 628), while depth-1 kept the old file.
These historical counts are evidence of the defect, never fixed expectations.

Inspected code confirms production checkout lacks fetch-depth: 0; checks has it,
preview also lacks it. prebuild runs the permissive indexer, and history:check
accepts shallow history without comparing to git. Current count() excludes merges.
Production needs complete ancestry and a strict gate in its own job.

Board inspection preserved these owners and boundaries:

- pm-256 is done (palace and static index).
- pm-271 t-1561 and t-1562 are done (Tamatebako and sound); they stay done.
- pm-257 owns Ink Ghosts and is paused; its existing work remains intact.
- pm-275/t-1617 owns a paused deploy/probe infrastructure repair. This revision
  changes history-specific workflow steps and probes, retaining its ownership.
- pm-268 owns active Riso work, including palace appearance and browser checks;
  rebase and preserve those additions.

No new plan, successor part, task waiting on another plan, or duplicated completed
feature is proposed. One cohesive SWE task couples strict semantics with complete
checkout and generation so intermediate delivery cannot break production.
DAG: **1**, then normal required QA, then plan acceptance.

## Build contract

This JSON array is the exact remaining proposal; numbering restarts at 1.

```json
[
  {
    "sequence": 1,
    "title": "Ship current build history with a strict production gate",
    "role": "software_engineer",
    "qa": "required",
    "depends_on": [],
    "problem": "Production's depth-1 checkout makes prebuild reuse content/history.json from fe0dd82: live b4e142a is 213 commits newer and the note reports 414 instead of 627. history:check is absent from CI and accepts shallow data without proving freshness; committing refreshed fallback JSON cannot keep each deployment current.",
    "action_items": [
      "At task start inspect current main, this plan, AGENTS.md and applicable standing development rules; read the installed Next guide before code changes. Preserve t-1561/t-1562, pm-257 ghosts, pm-268 Riso and pm-275/t-1617 deploy-repair ownership. If a concrete missing person-owned prerequisite is discovered, raise kind=operator_action immediately with prerequisite_id, exact setup and readiness signal, then end that run; adapter unsupported responses alone do not show a service needs setup.",
      "Declare and test strict production generation/check semantics in scripts/history-index.ts before implementation. Keep the existing bounded static schema usable by Tamatebako. Compute total as all commits reachable from the build SHA (unfiltered git rev-list --count), even when capped leaves remain non-merge changelog entries; update type comments and fixtures. Keep deterministic <=200 entries and existing privacy/metadata bounds. Preserve permissive developer/archive fallback outside strict delivery mode.",
      "Implement explicit strict generation and history:check -- --strict for the build revision. Fail nonzero with actionable cause if git is missing, ancestry is incomplete/shallow, build identity differs from checked-out HEAD, index is malformed, head is absent/unrelated/ahead, newest leaf lags by more than MAX_LAG=20, or total differs from git rev-list --count of that revision. Strict validation must inspect the generated file's actual content, not just a command's success or metadata assertion. Separate total-at-build from total-at-newest-leaf when merge commits require it.",
      "Add fixture/CLI regressions: a depth-1 clone with the historical fallback cannot pass strict check; a complete clone regenerates current data and passes; add >20 commits without modifying fallback and prove automatic refresh; prove merge-head and interleaved-merge totals equal unfiltered rev-list; mutate only total while keeping a current head and prove failure; cover stale/unrelated/missing-head, malformed, git-unavailable, deterministic rerun and preserved permissive fallback. Do not let a later regeneration erase a negative control before the check observes it.",
      "Update .github/workflows/ci.yml so every job building the palace (checks, preview and production) has complete git ancestry via fetch-depth: 0. Regenerate from the exact checked-out build SHA on every build. Run strict history:check after generation and after the actual build, before production migrations/deploy/upload, through the same repository-owned commands; production must not ship on a missing, stale or unprovable index. Retain checks dependency, manual-dispatch recovery, existing checkout scope, author guard, deployment concurrency and terminal/press gates.",
      "Extend scripts/ci-workflow.test.mjs with behavioral/order guards for complete ancestry and strict generation/check before upload in production, not merely the checks job. Exercise the actual shared history gate with fixture commands that fail on stale/partial data and prove build/upload is not invoked, plus the positive path; preserve existing CI tests. Register any additional tests in npm test. No deployment credential is needed for fixture verification.",
      "Add scripts/verify-history-build.sh, runnable from a bare delivery checkout with its own locked dependency bootstrap. Build the real Next app with GITHUB_SHA from that checkout, strict history validation and the existing prebuild; serve that built /ryugu locally and use Chrome to open the real box. Verify newest leaf and total against full local git and build-sha metadata, proving the bundle imports the generated index rather than old cached JSON. Preflight real Next/Playwright imports and browser availability; use a short TMPDIR, temporary output/state and restore generated fallback on exit. No real provider deployment or shared infrastructure mutation in this verifier.",
      "Add scripts/probe-history.sh with a read-only live mode and --self-test. It bootstraps locked dependencies when needed. Live mode reads /api/health before and after browser inspection, pins one served SHA, checks the expected delivery's code ancestry, opens /ryugu at 1366x768 and 390x844, compares newest real leaf to that served SHA at <=20 commits and displayed total to unfiltered git rev-list --count of that SHA, and checks git metadata for the shown leaf. A moving deployment is an explicit inconclusive/nonzero result, never a pass against two identities. Self-test uses local fixture health/pages/git and proves stale-but-real leaf, wrong-total-only and wrong-build identity are rejected, and a correct fixture passes.",
      "Wire the live read-only probe after the existing production deploy/served-SHA verification and its fixture mode into checks, preserving the existing deploy script. Add a timestamped changelog and concise history-build architecture notes with fallback/strict boundaries. Run all declared verification, commit with pm-271/<assigned-task-id>: imperative subject as Otohime <quiinthieu@gmail.com>, push through the normal branch path and stop SWE work at the push. Required QA/acceptance own independent fresh-deployment proof."
    ],
    "interfaces": [
      "scripts/history-index.ts",
      "scripts/history-index.test.ts",
      "scripts/ci-workflow.test.mjs",
      "scripts/verify-history-build.sh",
      "scripts/probe-history.sh",
      ".github/workflows/ci.yml",
      "package.json",
      "content/history.json",
      "changelogs/",
      "projects/otohime-dev-lean-into-the-name-otohime-is-the-sea-princess-o/history-build-architecture.md"
    ],
    "non_goals": [
      "Redesigning the box, scrubber, aged-paper effect, replay label, sea or sound",
      "Rebuilding historical site snapshots or runtime git/network history fetching",
      "Ink Ghosts activation or backend changes",
      "Replacing pm-275 deploy/probe repairs or changing its task owner",
      "Manual index-recommit/deploy chores, scheduled refresh jobs, new credentials/providers, migrations or paid capacity",
      "Committing build-generated history solely to update freshness; existing fallback stays a fallback"
    ],
    "acceptance_criteria": "Every fresh production build automatically carries current real git history without a fallback recommit. On one pinned live /api/health SHA, /ryugu's newest leaf is a real ancestor within MAX_LAG=20 commits and the note total equals git rev-list --count of that SHA at desktop and mobile sizes. Production rejects incomplete history, stale head or wrong total before upload; negative controls prove rejection. Existing Tamatebako and sound behavior stays passing.",
    "verification": [
      {
        "name": "Locked project suite and history/workflow controls",
        "cwd": ".",
        "cmd": "npm ci --no-audit --no-fund && npm test",
        "expect": "exit0",
        "timeout_s": 900
      },
      {
        "name": "Lint and types",
        "cwd": ".",
        "cmd": "npm ci --no-audit --no-fund && npm run lint && npm run typecheck",
        "expect": "exit0",
        "timeout_s": 900
      },
      {
        "name": "Real generated-history production build and browser",
        "cwd": ".",
        "cmd": "bash scripts/verify-history-build.sh",
        "expect": "exit0",
        "timeout_s": 900
      },
      {
        "name": "Read-only deployment probe positive and negative fixtures",
        "cwd": ".",
        "cmd": "bash scripts/probe-history.sh --self-test",
        "expect": "exit0",
        "timeout_s": 300
      }
    ]
  }
]
```

## Independent QA and acceptance

SWE proves local locked executable construction and fake failure/orchestration
paths; it stops at its push. The platform's green gate runs verification at the
delivery SHA. Required QA independently reads workflow changes, raw relevant CI
failure tails, real build output and a fresh deployment. A passed self-test or
rerunning the supplied probe alone is insufficient independent evidence.

QA/acceptance pin health SHA S before and after their own browser inspection and
fetch complete ancestry for S. S must contain the delivered code; report-only
commits may lead S under existing delivery rules. Use unfiltered git rev-list
counts, not the script's own count helper. Compare the UI's actual latest SHA,
date/subject and displayed total; open and scrub to old/new leaves with keyboard
and touch at both requested viewports. Check the newest entry is real **and**
current. Include an independent negative control using a real old ancestor more
than 20 commits behind and a separate wrong-total mutation with a current head.

Verify existing smoke/box/scrubber/aged-paper/replay-label behavior and sound:
off until opted in, Pocket off, stop on leave, back/forward restore and no-Web-Audio
fallback. Keep all previously passing coverage.

Inspect a bounded paginated set of relevant failed and completed CI runs as well
as current runs. Report ids, counts, bounds, raw failures, truncation and whether
history is complete within that bound. Correlate relevant history code, workflow,
package lock/config and generated artifact fingerprints rather than equating
unrelated report SHAs with new executable attempts. Report integration deployed,
execution demonstrated and product delivered separately; fake paths cannot prove
Vercel execution or the actual served UI. Unread/truncated evidence is inconclusive.
No asynchronous product job, callback ingestion or delayed schedule is added.

No soak or natural-run condition is required: ordinary code push or existing
workflow_dispatch drives the same build/deploy path on demand. Any existing
deployment defect is still a defect, not waived by a queued successor. No operator
starts runtime capacity. Record exact continuation ids, owner and failure
condition if platform capacity is unavailable; do not turn a known failure into
a pending success.

## External prerequisites

The exact revision manifest follows. All are existing capabilities; no secret
values are requested or stored. Named provider secret stores identify existing
configuration only. Account/cost authority stays with the site owner.

```json
{
  "schema": "platform.plan-prerequisites.v1",
  "plan_id": "pm-271",
  "revision": 2,
  "external_dependencies_reviewed": true,
  "reason": "Repository-owned static history fix uses existing GitHub Actions/Vercel/Neon delivery and task-manager runner. No new provider, account, paid capacity or expanded secret scope. These dependencies still require declaration; control-plane adapter gaps do not prove execution-runner readiness.",
  "prerequisites": [
    {
      "id": "github:otohime:repository",
      "owner": "agent",
      "required_setup": "Registered repository otohime, git@github.com:quiinthieu/otohime.git, branch main, existing git-key-otohime deploy key with clone/fetch/push scope; GitHub contents:read token for full-history Actions checkout. quiinthieu retains repository/account and current cost authority. Existing SSH binding is established; no new API credential is required for this repair.",
      "secret_refs": [
        {
          "secret": "git-key-otohime",
          "key": "private_key"
        }
      ],
      "probe": {
        "kind": "git_host_read",
        "target": "repo:otohime",
        "expect": "readable"
      },
      "probe_context": [
        "control_plane"
      ],
      "state": "unknown"
    },
    {
      "id": "runner:otohime:coding",
      "owner": "agent",
      "required_setup": "Existing task-manager otohime coding placement and assigned software-engineer account with Node 22 >=22.23, Bash, Git, npm lockfile install and outbound npm registry access. Platform schedules its existing account/runner allocation; no operator starts a runtime or buys capacity.",
      "secret_refs": [],
      "probe": {
        "kind": "task_manager_capability",
        "target": "account:otohime:software_engineer",
        "expect": "eligible"
      },
      "probe_context": [
        "execution_runner"
      ],
      "state": "unknown"
    },
    {
      "id": "github:otohime:actions",
      "owner": "agent",
      "required_setup": "Existing quiinthieu/otohime GitHub Actions CI on main push/manual dispatch with ubuntu-24.04, Node 22 from package.json, Google Chrome, PostgreSQL 17 service, Bash/curl and npm registry access. Workflow's existing contents:read scope must permit full ancestry checkout; only repository-owned workflow configuration changes. quiinthieu's existing GitHub runner allocation/cost authority applies.",
      "secret_refs": [],
      "probe": {
        "kind": "service_capability",
        "target": "github:quiinthieu/otohime:actions:ubuntu-24.04",
        "expect": "checks and production jobs available with full git fetch, Node 22, Chrome and npm"
      },
      "probe_context": [
        "control_plane"
      ],
      "state": "unknown"
    },
    {
      "id": "vercel:otohime:production",
      "owner": "operator",
      "required_setup": "Existing Vercel project bound by quiinthieu/otohime Actions variables VERCEL_ORG_ID and VERCEL_PROJECT_ID, token VERCEL_TOKEN scoped to pull/build/deploy that project and alias otohime.dev. Existing production environment DATABASE_URL, BETTER_AUTH_SECRET and BETTER_AUTH_URL=https://otohime.dev remains attached. Site owner quiinthieu retains existing account/cost authority; no additional permission or purchase.",
      "secret_refs": [
        {
          "secret": "github:quiinthieu/otohime:actions",
          "key": "VERCEL_TOKEN"
        },
        {
          "secret": "vercel:otohime:production",
          "key": "DATABASE_URL"
        },
        {
          "secret": "vercel:otohime:production",
          "key": "BETTER_AUTH_SECRET"
        }
      ],
      "probe": {
        "kind": "service_capability",
        "target": "vercel:otohime:production",
        "expect": "existing CI identity can pull/build/deploy and serve otohime.dev"
      },
      "probe_context": [
        "control_plane"
      ],
      "state": "unknown"
    },
    {
      "id": "neon:otohime:production",
      "owner": "operator",
      "required_setup": "Existing Otohime Neon Postgres under quiinthieu's existing account/cost authority; production GitHub runner's DATABASE_URL_UNPOOLED permits the current db:migrate step, and Vercel's pooled DATABASE_URL permits /api/health SELECT 1. No migration, role, account, secret or database permission change in this plan.",
      "secret_refs": [
        {
          "secret": "github:quiinthieu/otohime:actions",
          "key": "DATABASE_URL_UNPOOLED"
        },
        {
          "secret": "vercel:otohime:production",
          "key": "DATABASE_URL"
        }
      ],
      "probe": {
        "kind": "service_capability",
        "target": "neon:otohime:production",
        "expect": "existing production runner migration access and deployed health read access"
      },
      "probe_context": [
        "control_plane"
      ],
      "state": "unknown"
    }
  ]
}
```

Manifest generation 4 was declared then probed at 2026-10-27T10:37:41Z.
The git_host_read adapter says missing because otohime has no ci_token; actual
lease SSH origin read succeeds. The task-manager account probe returns HTTP 400
(repo/provider requirement); GitHub, Vercel and Neon are not service-allowlisted.
These typed results remain missing/unknown/failed and are **not** declared ready.
The board identifies this revision as legacy_v1, whose prerequisite admission
is shadow-only; enforced batched admission would refuse these results.

Control-plane provider probes cannot prove runner credentials or a deployment.
Agent-owned repo registration, locked local install and ordinary SSH access are
already established. Public health returned b4e142a in this run; that is a
separate observation, not a replacement typed probe. There is no observed lost
person-owned configuration or physical chore to raise. If one emerges, the first
task needing it raises operator_action at its start with prerequisite id, exact
action and readiness signal and ends that run. Never ask for a secret in chat.

## Planning verification and standing guidance

This run changes planning artifacts only. After the locked install, npm test
passed all 2,510 tests (0 failures) on Node 22.23.3 before commit/push.
Initial npm test could not import dependencies because node_modules was absent;
npm ci restores the locked environment before retest. Node here is 22.23.3.

The task checkout's AGENTS.md was read. The named chief-of-staff extraction and
software-development document are absent here; canonical copies were found and
read in /data/build-worker/repo/mono-v2. Standing rules stay in those sources.
Current role/service instructions govern this GitHub/Vercel plan and preserve the
product-owner boundary; this run does not claim an engineering task.

Decisions are recorded on the board for scope/ownership, strict production with
permissive local fallback, all-commit total semantics, missing-document discovery,
and prerequisite adapter limits. This document proposes remediation; live
freshness remains unproven until implementation and independent acceptance.

