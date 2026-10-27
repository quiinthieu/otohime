# Prerequisite probe, revision 1

The manifest was declared and probed on 2026-10-27 before proposal. Plan Manager identifies this plan as `legacy_v1` with `shadow` prerequisite admission. None of the typed probes proved readiness:

| ID | Result | Raw reason |
| --- | --- | --- |
| `github:otohime:git` | missing | Repository `otohime` has no control-plane `ci_token`; authenticated read is impossible for this adapter. |
| `fleet:otohime:software-engineer` | unknown | Task-manager accounts/rank returned HTTP 400: repo and provider or account ID are required. |
| `github:otohime:actions` | failed | Service `github` is not allowlisted by the capability adapter. |
| `vercel:otohime:production` | failed | Service `https` is not allowlisted by the capability adapter. |
| `neon:otohime:postgres` | failed | Service `https` is not allowlisted by the capability adapter. |

These are control-plane adapter or request-shape limits, not evidence that checkout push, runner placement, CI, deployment, or database migration succeeds. Later roles must collect independent execution and deployment evidence at the delivered SHA. No physical operator chore was established by these results. A batched revision would require repaired probes before admission; this legacy revision accepted the six-task proposal in shadow mode.
