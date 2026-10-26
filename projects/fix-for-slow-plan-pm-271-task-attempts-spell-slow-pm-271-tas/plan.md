# Reliable Plan Delivery

Plan: pm-275 · revision 1 · product-owner run: run-9003 · 2026-10-26
Repository baseline: 152e2c3 (main). Prior research: [research.md](research.md), rep-5269/run-8990.

## Outcome

Restore the existing GitHub Actions checks and production path so pm-271, pm-273,
pm-268 and pm-259 can deliver. A successful implementation has a green checks job
including npm test on ubuntu-24.04 with Google Chrome, a green production job
including the existing terminal/press verification, and public /api/health serving
a commit containing the code delivery and 9d65d9c.

This document is an execution contract, not a claim the fixes have shipped.
Product-owner changes are Markdown only; the assigned SWE implements the fixes.

## Evidence and design

The four TMPDIR cases in lib/end.test.ts inherit CI. On a Chrome host they skip
the fake npm installer and execute a real browser probe, then receive SIGTERM.
The default local suite hides this branch error. Isolate the installer tests
and separately cover the runner branch with controlled executables. Preserve the
CI no-installer optimization. No unit test currently executes the signed-in motion
shell script; recheck this at implementation time.

The deploy upload can reach production while the later inspect calls fail.
Research infers a CLI/API-context failure, but its exact raw vendor error was
unavailable: do not present a specific auth or rate-limit cause as proven.
Restore synchronous deployment under a bound and require the requested served SHA.
Remove inspect from the verdict. Maintain the final verify-deploy.sh step.

A 540-second total upload bound and 180-second total health bound prevent retry
multiplication; the workflow's existing 18-minute timeout remains the backstop.
Only a fast failure before a URL permits one retry within the original budget.
A timed-out command with a URL may already have deployed, so health decides;
a timed-out command without a URL fails explicitly. Fixtures must prove both.
Comments in ci.yml may be refreshed without changing workflow behavior.

## Work order and size

One SWE task carries both tightly coupled repairs in one code push, followed by
the platform's required QA and plan acceptance. No separate QA task is proposed:
qa=required invokes the normal independent QA run. There are no dependencies on
other plans, clock-based conditions, human choices or scheduled events.

Settings observed: max_live_runs_per_plan=1, max_plan_elapsed=6h, qa_mode=auto.
One task is estimated by the platform's SWE role p50 (or 1h fallback); its dependency
path equals its duration and it has no overlap multiplier. Admission calculates
the authoritative estimate. This small repair needs no project parts.

## SWE build contract

```json
{
  "sequence": 1,
  "title": "Restore deterministic checks and production delivery",
  "role": "software_engineer",
  "qa": "required",
  "depends_on": [],
  "problem": "Since 5dcfe98 the BASE_URL TMPDIR regression inherits CI and takes the installed-Chrome path instead of its npm stub on ubuntu-24.04. Production also gates a successful upload on a failing Vercel inspect request. Local default tests can pass while both delivery gates remain red.",
  "action_items": [
    "At task start read plan.md, research.md, AGENTS.md and the standing software-development rules. If an actual missing operator-owned prerequisite is discovered, immediately record kind=operator_action with its prerequisite_id, exact setup action and readiness signal; preserve independent work and do not spend a fix cycle on an unanswered chore. An adapter's unsupported probe is not proof a working service needs reconfiguration.",
    "In lib/end.test.ts explicitly unset CI in the four installer/TMPDIR cases. Add deterministic runner-branch coverage with fake google-chrome and fake node: CI=true, expected browser diagnostic and probe-end.mjs handoff/exit, no npm invocation. Keep probe-end.sh's no-installer CI behavior. Confirm probe-motion-signed-in.sh is only read by unit tests; apply environment isolation if any executable coverage has appeared.",
    "Add scripts/probe-end-env.test.sh to run lib/end.test.ts with a temporary sparse PATH that demonstrably excludes google-chrome, both CI unset and CI=true, and with a fake google-chrome on PATH and CI=true. Restore environment and remove fixtures on exit; never hide/rename system Chrome. Missing essential commands must fail, not silently skip.",
    "Change scripts/vercel-deploy.sh to synchronous npx vercel@64 deploy --prebuilt --prod --archive=tgz under a total upload budget of at most 540 seconds including at most one fast no-URL retry. Remove --no-wait and the inspect verdict/parser. Do not retry after timeout or any printed deployment URL. A timeout/nonzero upload can reach health only when a URL was captured; timeout without URL remains an explicit failure.",
    "Use the requested GITHUB_SHA at HEALTH_URL as the authoritative readiness gate. Permit alias propagation (about 18 attempts) within one total health budget of at most 180 seconds, including curl and delays; avoid multiplying curl retries by attempts. A captured deployment URL or a zero CLI exit alone cannot pass. Preserve escaped public failure annotations and process-group cleanup.",
    "Update scripts/vercel-deploy.test.sh before the implementation: assert synchronous command and zero inspect calls; retain existing failure/retry/missing-SHA/unreachable/wrong-SHA controls and replace obsolete inspect cases with timeout-with-URL matching/wrong-health cases, transient stale-to-correct health, and a hanging health response that obeys the total deadline. Keep timeout-no-URL fatal, one deployment after URL, no orphan processes and multiline annotation escaping coverage.",
    "Keep .github/workflows/ci.yml behavior and the final verify-deploy.sh step; update only obsolete deployment comments if needed. Run the declared verification and the project's full tests. Commit as Otohime <quiinthieu@gmail.com> by setting author/committer environment explicitly, with pm-275/<assigned-task-id>: imperative subject and no Co-Authored-By trailer; push main through the normal CI path and end SWE work at the push."
  ],
  "interfaces": [
    "lib/end.test.ts",
    "scripts/probe-end-env.test.sh",
    "scripts/vercel-deploy.sh",
    "scripts/vercel-deploy.test.sh",
    ".github/workflows/ci.yml"
  ],
  "non_goals": [
    "t-1562 ambience or t-1561 Tamatebako changes",
    "Application/UI/database schema changes",
    "Changing runner Chrome selection or restoring browser installers in CI",
    "New hosting, credentials, services, paid capacity or Vercel Git integration",
    "History rewrite, force push or manual production deployment",
    "Changing verify-deploy.sh ancestry semantics or workflow behavior"
  ],
  "acceptance_criteria": "One code delivery makes the full unit suite green on ubuntu-24.04 with Chrome present, and the probe regression passes with CI=true/fake Chrome and with Chrome absent. Fake deploy cases prove bounded synchronous deployment and served-SHA gating. Independent QA observes a green checks job through npm test, green production including final verification, and https://otohime.dev/api/health serving a SHA containing both the delivery and 9d65d9c.",
  "verification": [
    {
      "name": "Probe environment matrix",
      "cwd": ".",
      "cmd": "bash scripts/probe-end-env.test.sh",
      "expect": "exit0",
      "timeout_s": 120
    },
    {
      "name": "Full CI unit suite",
      "cwd": ".",
      "cmd": "CI=true npm test",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Deploy behavior and failure controls",
      "cwd": ".",
      "cmd": "bash scripts/vercel-deploy.test.sh",
      "expect": "exit0",
      "timeout_s": 180
    },
    {
      "name": "Existing served-SHA ancestry controls",
      "cwd": ".",
      "cmd": "bash scripts/verify-deploy.sh --self-test",
      "expect": "exit0",
      "timeout_s": 180
    },
    {
      "name": "Lint",
      "cwd": ".",
      "cmd": "npm run lint",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Typecheck",
      "cwd": ".",
      "cmd": "npm run typecheck",
      "expect": "exit0",
      "timeout_s": 300
    }
  ]
}
```

All verification commands run inside the delivery checkout and change no shared
infrastructure. npm ci uses the committed lock before verification. Fake npx,
fake node and fake Chrome prove orchestration/branch choice only; real browser,
GitHub runner, Vercel and Neon delivery remain independent integration evidence.

## QA and acceptance walkthrough

1. Identify the delivery SHA, lockfile and relevant script/test hashes. Read the
   actual run profile/model/effort from that run, rather than using current defaults.
2. Inspect bounded GitHub CI history from run 444 through the delivery: the known
   baseline includes production failures 445/449, cancelled 450/451 and checks
   failures 452/453/454. Enumerate all intervening/newer pages up to 100 runs,
   retain ids and conclusions, and state counts and pagination completeness.
   Unread/truncated logs remain inconclusive. Correlate code/lock/config hashes
   rather than treating a report-only SHA as a different executable.
3. Independently open the delivery CI run/job evidence and inspect the checks
   step after typecheck (npm test), deploy step and final verification. Record the
   actual ubuntu-24.04/Chrome/Node identities where observable. Read raw failing
   command tails where accessible, preserve annotations otherwise, and disclose
   any authenticated-log boundary. A cancelled superseded run is not a pass.
4. Observe the existing code-push trigger's result on demand. If a pending run
   was replaced, identify a newer run containing the same delivery. If needed,
   trigger the existing workflow_dispatch for main with the platform's existing
   authorized capability; do not create a person-starts-CI prerequisite.
   No soak, consecutive-run threshold or future natural event is required.
5. Fetch https://otohime.dev/api/health independently. Require HTTP 200 and ok=true,
   record its full SHA, fetch that commit if needed, and run
   git merge-base --is-ancestor 9d65d9c <live-sha> plus
   git merge-base --is-ancestor <code-delivery-sha> <live-sha>.
   Documentation-only lead commits may use the existing verify-deploy.sh semantics;
   code delivery itself must be contained in the live commit.
6. Independently construct a wrong-SHA fixture for the deploy health gate and prove
   nonzero exit; do not count rerunning the supplied shell suite as independent QA.
   For the probe branch, use an independently prepared fake executable and verify
   its observed handoff. Live read-only terminal/press behavior is covered by
   the existing production verification and may be exercised with
   EXPECT_SHA=<code-delivery-sha> bash scripts/verify-deploy.sh https://otohime.dev.
7. Report checks/production integration, executable demonstration and product
   delivery separately. Record all defects, real/fake boundaries, history
   completeness, negative controls, and exact deferred CI/run ids with owner and
   failure condition. Acceptance cannot pass required output merely because a
   CI run is queued. No polling task or idle wait is part of this contract.

## External prerequisites

These are existing capabilities, not new setup requests. The manifest below
declares exact scope and named secret references only; it includes no secret
values. References under github: and vercel: denote provider-managed stores,
not fabricated Kubernetes Secrets. The registered SSH key store is git-key-otohime;
its adapter-facing private-key field is not independently confirmed.

Probes on 2026-10-26 found:
- github:otohime:delivery: missing in the control-plane adapter because the repo
  has no ci_token. The registered SSH key cloned this checkout; public run pages
  remain an independent read path. That evidence does not override the typed probe.
- runner:otohime:node22-chrome, vercel:otohime:production and
  neon:otohime:production-migrate: unknown because service_capability proves only
  control_plane, not execution_runner. A task_manager_capability eligibility
  probe also cannot establish these GitHub/Vercel/Neon runtime properties.
- Adapter fingerprint: cfg-46eeaaff9fc16017. No capability is declared ready by
  this document. This plan uses legacy_v1 with shadow admission; an enforced
  batched plan would refuse these unproven prerequisites rather than waive them.

No actual external configuration loss was observed, so no new credential or
operator chore is requested to work around an adapter limitation. If a real
missing operator-owned setup is found, the first task needing it raises the
specified operator_action at its start. The operator never sends a secret in chat.
Existing platform capacity is a queue concern, never a person-only prerequisite.

```json
{
  "schema": "platform.plan-prerequisites.v1",
  "plan_id": "pm-275",
  "revision": 1,
  "external_dependencies_reviewed": true,
  "reason": "This plan changes only tests and the existing production deploy script. Existing external GitHub, npm, runner, Vercel and Neon capabilities are required; no new account, paid service, credential or permission expansion is authorized.",
  "prerequisites": [
    {
      "id": "github:otohime:delivery",
      "owner": "agent",
      "required_setup": "GitHub repository quiinthieu/otohime, branch main: task-manager's registered otohime deploy key must clone and push; GitHub Actions CI must run on push with contents:read. Existing site-owner account quiinthieu retains repository and billing authority. No new credential.",
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
      "id": "runner:otohime:node22-chrome",
      "owner": "agent",
      "required_setup": "Existing GitHub Actions ubuntu-24.04 execution runner for quiinthieu/otohime with Node 22, Bash, GNU timeout, curl, Google Chrome, postgres:17-alpine service and outbound npm registry access; npm ci must resolve the committed lock. Use existing GitHub account/runner cost authority only; do not buy capacity.",
      "secret_refs": [],
      "probe": {
        "kind": "service_capability",
        "target": "github:quiinthieu/otohime:actions:ubuntu-24.04",
        "expect": "Node 22, Google Chrome, PostgreSQL service and npm registry access"
      },
      "probe_context": [
        "execution_runner"
      ],
      "state": "unknown"
    },
    {
      "id": "vercel:otohime:production",
      "owner": "operator",
      "required_setup": "Existing Vercel otohime production project, operated by quiinthieu (Otohime owner), Hobby account authority; GitHub repo quiinthieu/otohime Actions secret VERCEL_TOKEN with deploy/pull/build rights for that project; repo variables VERCEL_ORG_ID and VERCEL_PROJECT_ID identify it. Vercel production env DATABASE_URL (pooled), BETTER_AUTH_SECRET and BETTER_AUTH_URL=https://otohime.dev must remain attached. CI deploys and aliases otohime.dev; Git integration stays disconnected. No new scope or spend.",
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
        "expect": "Existing CI identity can pull/build/deploy this project and serve https://otohime.dev/api/health"
      },
      "probe_context": [
        "execution_runner"
      ],
      "state": "unknown"
    },
    {
      "id": "neon:otohime:production-migrate",
      "owner": "operator",
      "required_setup": "Existing Otohime Neon production PostgreSQL database, operated and funded by quiinthieu, reachable from the existing GitHub production runner. GitHub repo quiinthieu/otohime Actions secret DATABASE_URL_UNPOOLED must contain the existing direct database URL with migration permissions. Existing Vercel DATABASE_URL points to the same database through its pooled connection. No schema, account, permission or billing change.",
      "secret_refs": [
        {
          "secret": "github:quiinthieu/otohime:actions",
          "key": "DATABASE_URL_UNPOOLED"
        }
      ],
      "probe": {
        "kind": "service_capability",
        "target": "neon:otohime:production",
        "expect": "Existing GitHub production runner can execute the repository's current migration command"
      },
      "probe_context": [
        "execution_runner"
      ],
      "state": "unknown"
    }
  ]
}
```

## Product-owner validation

At baseline 152e2c3 after npm ci on this Linux lease with /usr/bin/google-chrome:
- npm test: 2315 passed, 0 failed (CI unset).
- bash scripts/vercel-deploy.test.sh: all checks passed.
- npm run lint: exit 0, 10 existing warnings.
- CI=true node --test lib/end.test.ts: 10 passed, 1 failed; the reported TMPDIR
  case observed exit 130 instead of 1. This is the reproduced defect the SWE
  contract must fix, not a passing CI claim.

Research is preserved verbatim from the platform report. Its historical 2268
test count differs from today's 2315 because main advanced. The research-only
lease patch is advisory and is not part of the committed code.

Standing rules remain in AGENTS.md and docs/claude/software-development.md.
The latter and the named chief-of-staff plan are absent from otohime; this run
read their canonical copies under /data/build-worker/repo/mono-v2. Do not duplicate
standing rules into new repository policy files.
