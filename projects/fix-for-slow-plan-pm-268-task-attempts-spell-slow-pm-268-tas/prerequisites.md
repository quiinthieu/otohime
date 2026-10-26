# Consolidation prerequisites

```json
{
  "schema": "platform.plan-prerequisites.v1",
  "plan_id": "pm-277",
  "revision": 1,
  "external_dependencies_reviewed": true,
  "reason": "Consolidation-only plan: no new executable, deployment, migration, runtime submission or SWE task. Existing GitHub repository publication and public CI/health reads are the only external capabilities used here. Vercel deployment and database credentials remain owned and declared by pm-275, not needed to write or evaluate this plan. Board MCP access is already attached to this product-owner run.",
  "prerequisites": [
    {
      "id": "github:otohime:repository",
      "owner": "agent",
      "required_setup": "Existing task-manager repository otohime, git@github.com:quiinthieu/otohime.git on main. Existing git-key-otohime deploy key reads/writes this repository only; quiinthieu owns repository and current cost authority. Existing registered git host integration permits repository reads. The typed control-plane read does not establish execution-runner push permission; this lease's normal git push supplies separate evidence.",
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
      "id": "github:otohime:public-ci",
      "owner": "agent",
      "required_setup": "Anonymous HTTPS read access to github.com/quiinthieu/otohime/actions and api.github.com/repos/quiinthieu/otohime/actions/runs from the existing execution runner, including public run/job conclusions and annotations. No token, new account, paid capacity or permission increase. Raw logs requiring sign-in remain an explicit evidence gap; public availability and runner egress are checked independently of the control plane.",
      "secret_refs": [],
      "probe": {
        "kind": "service_capability",
        "target": "github-actions:otohime",
        "expect": "status:200"
      },
      "probe_context": [
        "execution_runner"
      ],
      "state": "unknown"
    },
    {
      "id": "otohime:public-health",
      "owner": "agent",
      "required_setup": "Anonymous HTTPS GET https://otohime.dev/api/health from the execution runner, HTTP 200 JSON ok=true with a full git SHA. Existing otohime.dev hosting/domain stays under quiinthieu's current Vercel account and cost authority. No hosting token, deploy privilege, database credential, service mutation or purchase is needed for this read.",
      "secret_refs": [],
      "probe": {
        "kind": "service_capability",
        "target": "https://otohime.dev/api/health",
        "expect": "status:200"
      },
      "probe_context": [
        "execution_runner"
      ],
      "state": "unknown"
    }
  ]
}
```
