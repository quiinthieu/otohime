# Prerequisite probe, revision 1

Run `run-9090` declared manifest generation 1 and probed all four prerequisites on 2026-10-26. The board identified this plan as `legacy_v1` with shadow admission. None of the typed probes established ready state:

| ID | Result | Bounded observation |
| --- | --- | --- |
| `github:otohime:git` | missing | `git_host_read` requires a registered `ci_token`; the repo has none. This checkout has an SSH origin, so the result does not establish that a push fails. |
| `fleet:otohime:software-engineer` | unknown | Task-manager account adapter returned HTTP 400 because its request lacked repo/provider or account ID. |
| `github:otohime:actions` | failed | Service adapter did not allowlist the GitHub target. |
| `vercel:otohime:production` | failed | Service adapter did not allowlist the HTTPS target. |

These are adapter coverage or request-shape limits, not evidence that a runner, CI job, or production deploy executed. No person-only setup action was observed. Coding tasks retain their checkout verification; QA and acceptance must inspect actual CI and deployed behavior at the delivered SHA.
