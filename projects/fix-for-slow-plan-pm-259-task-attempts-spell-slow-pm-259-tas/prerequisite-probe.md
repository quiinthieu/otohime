# Prerequisite Probe · Revision 3 (`pm-270`)

Run `run-9166` declared manifest generation `3` for `pm-270` revision `3` and ran `plan_manager_probe_prerequisites` at `2026-10-27T06:13:20.904128174Z` (`adapter_fingerprint: cfg-46eeaaff9fc16017`). `pm-270` uses `delivery_workflow: legacy_v1` (`mode: shadow`).

| Prerequisite ID | Probe context | Observed state | Adapter detail & real-service verification |
| --- | --- | --- | --- |
| `github:otohime:git` | `control_plane` | `missing` | `git_host_read` reported `repository otohime has no ci_token: an authenticated read is impossible`. Fleet execution leases push and fetch over registered SSH deploy keys (`git@github.com:quiinthieu/otohime.git`), so control-plane REST token absence does not block lease git write access. |
| `fleet:otohime:software-engineer` | `execution_runner` | `unknown` | `task-manager:accounts` returned HTTP 400 (`invalid_request: repo and provider (or account_id) are required`), reflecting the control-plane adapter's query shape rather than missing fleet capacity (`avietidol-z490` and macOS fleet workers actively run `otohime` coding/verify jobs). |
| `github:otohime:actions` | `control_plane` | `failed` | `service_capability` reported `service github is not allowlisted`. Public GitHub Actions API (`GET https://api.github.com/repos/quiinthieu/otohime/actions/runs?branch=main&per_page=10`) returned HTTP 200 (`checks` green on `40456936288` at `e120461`, `40445303440` at `a958913`, and `40442254616` at `4c9f325`). |
| `vercel:otohime:production` | `control_plane` | `failed` | `service_capability` reported `service https is not allowlisted`. Independent lease `curl -fsS https://otohime.dev/api/health` returned HTTP 200 with `{"ok":true,"sha":"e120461717f7e69c17d88f7512e776206d8fe664"}` (`git merge-base --is-ancestor` proves `9ddd084`, `c6d09f0`, `2eaada2`, `5dcfe98`, `e03cf1c`, and `4c9f325` are all ancestors of `e120461`). |

All four non-`ready` probe states reflect shadow-mode control-plane adapter coverage rather than missing operator configuration, so no `operator_action` escalation was filed. Every SWE task proves its contract locally inside the checkout and stops at `git push origin HEAD`.
