# External prerequisites

```json
{
  "schema": "platform.plan-prerequisites.v1",
  "plan_id": "pm-276",
  "revision": 1,
  "external_dependencies_reviewed": true,
  "reason": "Internal CI plumbing uses the existing GitHub, npm/Node runner, Vercel and Neon delivery path. No new credential, account, permissions or spend. Public annotations are the chosen alternative to authenticated raw-log reads. Control-plane probes do not prove GitHub runner deployment permissions.",
  "prerequisites": [
    {
      "id": "git:otohime:ssh-delivery",
      "owner": "agent",
      "required_setup": "Registered task-manager otohime repository git@github.com:quiinthieu/otohime.git, default branch main, existing git-key-otohime SSH deploy key with repository read/write rights. Otohime owner quiinthieu controls repository and cost authority; use existing grant only. This control-plane probe checks key presence, not host write rights; normal lease clone/push proves the latter.",
      "secret_refs": [
        {
          "secret": "git-key-otohime",
          "key": "private_key"
        }
      ],
      "probe": {
        "kind": "secret_key_exists",
        "target": "git-key-otohime/private_key",
        "expect": "present"
      },
      "probe_context": [
        "control_plane"
      ],
      "state": "unknown"
    },
    {
      "id": "fleet:otohime:swe",
      "owner": "agent",
      "required_setup": "Existing task-manager fleet placement and an eligible software_engineer account for repository otohime; Node 22 from package.json, locked npm dependencies, Bash and git in the lease. Platform-owned existing account/capacity authority only; no new paid runtime. Account admission is the extent of this probe, not GitHub runner readiness.",
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
      "owner": "operator",
      "required_setup": "GitHub quiinthieu/otohime Actions enabled for existing CI workflow, push main and workflow_dispatch, contents:read job token, ubuntu-24.04 hosted runner with Node 22, Chrome, Bash/GNU timeout, curl, npm registry egress and postgres:17-alpine service. Repository owner quiinthieu retains existing Actions runner/account billing authority. Existing deployment secrets remain attached. Probe service reachability from control plane only; actual execution-runner capability must be observed from the code-push CI run.",
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
      "id": "vercel:otohime:production",
      "owner": "operator",
      "required_setup": "Existing Vercel otohime production project operated by quiinthieu under the current account/cost authority. GitHub Actions secret VERCEL_TOKEN permits pull/build/deploy only for this project; variables VERCEL_ORG_ID and VERCEL_PROJECT_ID identify it. Production env DATABASE_URL, BETTER_AUTH_SECRET and BETTER_AUTH_URL=https://otohime.dev stay attached; existing CI aliases otohime.dev. No new scope or purchase. This service probe cannot prove the execution runner's credential attachment.",
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
        "target": "vercel:otohime",
        "expect": "status:200"
      },
      "probe_context": [
        "control_plane"
      ],
      "state": "unknown"
    },
    {
      "id": "neon:otohime:production",
      "owner": "operator",
      "required_setup": "Existing Otohime Neon PostgreSQL production database operated and funded by quiinthieu. Existing GitHub Actions DATABASE_URL_UNPOOLED secret grants the current migration role direct access; Vercel pooled DATABASE_URL targets that same database. No migration/schema, permission or account change. Control-plane service reachability does not establish migration execution from GitHub's runner.",
      "secret_refs": [
        {
          "secret": "github:quiinthieu/otohime:actions",
          "key": "DATABASE_URL_UNPOOLED"
        }
      ],
      "probe": {
        "kind": "service_capability",
        "target": "neon:otohime",
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
