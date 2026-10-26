# Revision 2 proposal contract

Exact pm-258/run-9039 task objects and prerequisite declaration. Typed probes own readiness state.

## Task DAG

```json
[
  {
    "sequence": 1,
    "title": "Make landed gate repairs reproducibly verifiable",
    "role": "software_engineer",
    "depends_on": [],
    "qa": "skip",
    "problem": "Exhausted t-1564 mixes deployed local control repairs with evolving shared-lane failures. Evidence-only reruns repeat manual work and cannot be machine-checked. Add a bounded local closure command that preserves nonzero results and explicitly leaves deployment, historical logs and personalized presence unproven.",
    "action_items": [
      "Read AGENTS.md, relevant installed Next docs and plan.md revision 2. Preserve landed 841ca69/15fd171/3351f78/9ddd084 behavior and all completed owner tasks. Implement only the internal verifier and its tests/documentation; do not reopen desk, footer heading, Kame, provider or deploy code.",
      "Declare JSON interface otohime.gate-closure.v1 for an on-demand CLI: node scripts/check-gate-closure.mjs. Execute current-checkout lib/e2e-runner.test.ts, lib/end.test.ts and lib/urashima.test.ts through Node 22's locked strip-types test runner with child timeout at most 180s and bounded stdout/stderr tails. Clear NODE_TEST_CONTEXT for nested tests. Reuse those real regressions, including serial-vs-parallel, Actions-vs-local reporter, CI status preservation, migrated embedded Postgres lifecycle and waterline structure; do not copy their assertions into a competing test suite.",
      "Emit one JSON result containing tested git SHA, dirty status, Node/platform, SHA-256 hashes of relevant source/test/workflow files and package-lock.json, per-command exit/signal/timeout and bounded tails, local_controls pass/fail, and explicit external_evidence=inconclusive. Exit zero only when every required local child check actually executed and passed. Spawn errors, missing/empty results, nonzero exit, timeout, malformed runner output and fingerprint failures must exit nonzero. Do not infer deployment, a global green gate, Kame browser execution, raw historical assertions or author.txt bytes from these unit controls.",
      "Write failing tests first in lib/gate-closure.test.ts for result serialization and nonzero/timeout/spawn-error propagation using a fake child-runner port, plus one real CLI path. Add a temp-checkout mutation negative control: removing serial enforcement from the real e2e runner makes closure fail; restore in the isolated copy only. Keep production checkout and shared infrastructure unchanged, clean owned children/temp files. Add the new unit test under the existing npm test lib glob without changing package scripts.",
      "Run npm ci from package-lock.json and preflight real imports for playwright-core, pg and embedded-postgres plus embedded binary assets in that exact environment before the real local controls. Distinguish fake runner tests from actual nested Node/Postgres execution; no browser/user-path proof is supplied by this command.",
      "Write gate-closure.md with CLI/schema usage, exact delivery/source/lock fingerprints, negative-control results, local scope and existing unresolved-owner table from revision 2. Preserve prior raw evidence, research.md and archived revision 1. Name actual profile/model/effort from run flags. Run verification, commit as Otohime <quiinthieu@gmail.com> with pm-258/<assigned-task-id>: subject and no co-author trailer, then git push origin HEAD. On non-fast-forward pull --rebase, rerun verification on integrated HEAD and push normally. SWE stops at push; external acceptance belongs to plan acceptance."
    ],
    "interfaces": [
      "scripts/check-gate-closure.mjs",
      "lib/gate-closure.test.ts",
      "projects/pick-up-this-plan-https-apps-vietky-io-vn-plans-plans-pm-242/gate-closure.md"
    ],
    "non_goals": [
      "Editing application UI, migrations, keyed or keyless provider adapters",
      "Changing existing runner/reporter/footer/Kame/desk/deploy implementations or relaxing their assertions",
      "Certifying shared CI recovery or personalized live owner presence",
      "Fetching CI history or mutating deployment from verification commands",
      "Creating owner accounts, new credentials, runtime submissions or scheduled work"
    ],
    "acceptance_criteria": "On demand, node scripts/check-gate-closure.mjs executes the real current-checkout local repair regressions and emits fingerprinted otohime.gate-closure.v1 JSON. Healthy controls exit 0; an isolated removal of serial enforcement and fake nonzero/timeout/spawn failures each fail nonzero. Output explicitly leaves external evidence inconclusive. Existing npm tests, lint, types and build pass at delivery SHA. gate-closure.md preserves unresolved owners and the real/fake boundary. This delivers local closure tooling only; production recovery and personalized presence remain separately unproven.",
    "verification": [
      {
        "name": "Project tests including closure negative controls",
        "cwd": ".",
        "cmd": "npm test",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Lint",
        "cwd": ".",
        "cmd": "npm run lint",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Types",
        "cwd": ".",
        "cmd": "npm run typecheck",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "Build",
        "cwd": ".",
        "cmd": "npm run build",
        "expect": "exit0",
        "timeout_s": 600
      },
      {
        "name": "Real local repair controls through closure CLI",
        "cwd": ".",
        "cmd": "node scripts/check-gate-closure.mjs",
        "expect": "exit0",
        "timeout_s": 240
      }
    ]
  }
]
```

## Prerequisite manifest

```json
{
  "schema": "platform.plan-prerequisites.v1",
  "plan_id": "pm-258",
  "revision": 2,
  "external_dependencies_reviewed": true,
  "reason": "Revision 2 delivers repository-local closure tooling, not providers or deployment repair. Existing repository publication, Node/npm execution and independent public CI/served-SHA reads are external. No Spotify/Steam/ListenBrainz/Lanyard account, deployment secret or new paid resource is required. Provider setup remains in pm-272; deployment permissions stay with existing owner plans.",
  "prerequisites": [
    {
      "id": "github:otohime:repository",
      "owner": "agent",
      "required_setup": "Task-manager repo otohime uses git@github.com:quiinthieu/otohime.git main under quiinthieu's existing repository and cost authority. Managed git-key-otohime deploy key permits read/write only to this repo. Existing registered GitHub integration supplies public repository read; control-plane read does not prove execution-runner push. Normal push from the lease supplies separate delivery evidence.",
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
      "id": "runner:otohime:node22",
      "owner": "agent",
      "required_setup": "Existing task-manager otohime coding/verify fleet placement with Node 22.x, npm, bash and Linux x64 or macOS supported embedded-postgres assets from package-lock.json. Runner needs outbound registry.npmjs.org HTTPS for npm ci and build font-fetch egress to fonts.googleapis.com/fonts.gstatic.com. Use existing operator-owned fleet/account/cost allocation, no new account or purchased runtime. Preflight exact locked imports and binary construction in the checkout; this capability probe cannot prove another runner.",
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
      "id": "github:otohime:public-ci",
      "owner": "agent",
      "required_setup": "Anonymous read of public github.com/quiinthieu/otohime/actions run/job pages and api.github.com/repos/quiinthieu/otohime from current execution runner for acceptance evidence. No new credential or paid service. Rate-limited or private raw logs remain inconclusive; a public summary never substitutes for unread raw assertion. Typed service adapter observes control-plane reachability only; acceptance obtains independent execution-runner HTTP proof and never infers one context from another.",
      "secret_refs": [],
      "probe": {
        "kind": "service_capability",
        "target": "github-actions:otohime",
        "expect": "status:200"
      },
      "probe_context": [
        "control_plane"
      ],
      "state": "unknown"
    },
    {
      "id": "otohime:served-sha",
      "owner": "agent",
      "required_setup": "Anonymous HTTPS GET https://otohime.dev/api/health and rendered home build-sha under quiinthieu's existing Vercel project otohime/domain and cost authority. Read-only proof of original repair ancestry; this revision requires no Vercel token, new environment variable, hosted DB credential or deployment mutation. Typed service adapter observes control-plane reachability only; acceptance obtains independent execution-runner HTTP proof and never infers one context from another.",
      "secret_refs": [],
      "probe": {
        "kind": "service_capability",
        "target": "https://otohime.dev/api/health",
        "expect": "status:200"
      },
      "probe_context": [
        "control_plane"
      ],
      "state": "unknown"
    }
  ]
}
```
