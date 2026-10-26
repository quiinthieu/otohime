# External prerequisites

```json
{
  "schema": "platform.plan-prerequisites.v1",
  "plan_id": "pm-279",
  "revision": 1,
  "external_dependencies_reviewed": true,
  "reason": "The UI uses repository-owned content, Next and existing locked packages. External delivery needs only the existing GitHub repository/Actions and Vercel project; no new service, secret, account or spend is requested. Control-plane probes do not prove runner credentials or a completed deploy.",
  "prerequisites": [
    {
      "id": "git:otohime:ssh-delivery",
      "owner": "agent",
      "required_setup": "Registered task-manager repo otohime at git@github.com:quiinthieu/otohime.git on main, with existing git-key-otohime read/write deploy key scoped to this repo; quiinthieu owns the GitHub account and current cost authority. Probe establishes control-plane read only; the lease push establishes write. Existing control-plane secret probe checks key presence because git_host_read requires an unrelated ci_token.",
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
      "id": "github:otohime:actions",
      "owner": "operator",
      "required_setup": "Existing GitHub Actions enabled on quiinthieu/otohime for push to main, hosted Ubuntu runner with Node 22 and npm registry access, contents:read workflow token and existing deployment secrets. quiinthieu owns the account and current runner billing authority. Control-plane reachability does not prove runner execution.",
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
      "required_setup": "Existing Vercel otohime production project and otohime.dev domain under quiinthieu's current account and cost authority; existing GitHub Actions VERCEL_TOKEN permits this project's deploy, VERCEL_ORG_ID and VERCEL_PROJECT_ID identify it, and production environment remains attached. No new permission or purchase. Control-plane service reachability does not prove runner credential attachment.",
      "secret_refs": [
        {
          "secret": "github:quiinthieu/otohime:actions",
          "key": "VERCEL_TOKEN"
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
    }
  ]
}
```

Probes on 2026-10-26 found the platform adapter cannot read this repo's git key and does not allowlist GitHub Actions or Vercel. These results are not evidence that the existing delivery capabilities are absent. This plan is legacy_v1, so prerequisite admission is shadow only; deployment still requires independent CI and site evidence.
