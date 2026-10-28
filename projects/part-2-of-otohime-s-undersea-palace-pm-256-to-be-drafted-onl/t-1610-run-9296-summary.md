# t-1610 Booth gate repair — run-9296

The Booth browser verifier now waits for the exact `canvas2d` backend after
dispatching `webglcontextlost`. The event, all film-stock comparisons, the exact
backend assertion and the nonblank fallback pixel assertion remain. No application,
Worker, dependency, deployment flag or timeout changed. This implements the
cross-plan repair assigned by run-9292 for source owner pm-294/t-1684.

The committed QA diagnosis ran alongside all six Booth cases against real Chrome
and production Next: seven checks passed. It observed `webgl2` before and immediately
after dispatch, then `canvas2d` with 43,200 opaque pixels. Thus the synchronous
assumption is demonstrably false even when an isolated original test happens to
pass. The new wait observes the existing application state; it cannot replace the
pixel checks. The full ghost proof also retains its disabled-paint negative control:
a positive application counter cannot make zero canvas pixels pass.

## Verification and identities

All six declared verification commands run sequentially; complete local logs and
exit/duration/hash receipts are in this run's shared `artifacts/verification.json`.
The focused Booth command also includes the committed QA control. Root dependencies
were installed with unchanged-lock `npm ci`. Actual profile from the run record:
`codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet worker
`avietidol-z490`. Node is `22.23.3`, Chrome `156.0.8078.47`, Next `16.4.2`,
playwright-core `1.64.0`.

| Command | Result |
| --- | --- |
| Declared workflow fixtures | 59 pass |
| `npm test` | 2,609 pass |
| `npm run lint` | Exit 0; 10 existing warnings |
| `npm run build` | Exit 0 |
| `TMPDIR=/tmp npm run test:ghosts` | 8 pass |
| `TMPDIR=/tmp npm run test:e2e` | 230 pass; exit 0 in 511.7s |
| Focused Booth file plus committed QA diagnostic control | 7 pass |

All commands passed on their first invocation in this run. Full-suite production
Next BUILD_ID: `Pe-QtiHD5C40iZZBFbdTN`. The full suite includes the repaired Booth
case, actual locked camera/model runtime checks and all existing ghost controls.
No local verification processes overlapped one another.

The source/configuration/locked-asset inventory in `artifacts/executable-identity.json`
contains 919 files; its SHA256 is
`71e8af4c6306b48559f95f47678b4fae0c8df33cc18e0a798fbc35f977bb1a01`.
It excludes generated history and report prose. The base is
`de6807f1b95fbe1846abd34e70cec47ded911c04`; the only executable-input change is
`e2e/booth.test.ts`. The unchanged Worker code/lock/configuration fingerprint is
`aa87b9e3b4328f59801de5028120046f3c244f4f55e7e26d661b16d02b6a7115`.
No hosted Worker version is created. The local app SHA marker is `dev`, separate
from Next BUILD_ID and the pushed delivery SHA.

The browser harness uses actual production Next, migrated embedded Postgres,
Chrome, native WebSockets and canvas backing-store pixels. Ghost fan-out is the
bounded local fake, owned throughout the suite by the harness. Visibility/offline
events, unset configuration and native context loss are injected. The Booth
control uses the actual sample renderer without a camera mock; camera hardware
elsewhere in the suite is synthetic. Workflow fixtures exercise the workflow shell
with explicit deploy stand-ins, without Cloudflare credentials or deployment.

## History and handoff

Independent task-manager reads covered FAILED offsets 0/3, three each (6/107),
COMPLETED offsets 0/3 (6/1,315), and RUNNING offset 0 (2/2). Global history is partial;
the plan-run read returned 28 records. `artifacts/history.json` and `ingestion.json`
retain the bounded identities. Prior gate job
`66996231-fdae-45a9-8636-c532bafc1417` has delivered callback state, one attempt;
persisted run-9288 has zero callback-apply failures and ver-3693 passes at 308b362.
Its 69-line raw runner log confirms all six results. The old run-9276 read is a
1,063-line bounded tail; its explicit failure is `push_not_on_main`, with its
rescue retained. Older ver-3687 remains a timeout, not retrospectively a pass.
The raw Booth failure and QA control are committed under `qa-run-9292/`; this
repair is correlated to the changed verifier and unchanged renderer, not merely
to a newer unrelated SHA. Unread history remains inconclusive.

Integration deployed at this repair: unproven. Waiting for capacity: no. Local
execution demonstrated: yes, within the boundaries above. Hosted active product
delivered: unproven. No live-system check or pipeline watch belongs to this SWE run.
No product job/callback exists for ephemeral presence; the callback evidence above
is the platform verification flow.

Task branch: `pm-257-t-1610-run-9296`; delivery integration branch: `main`.
The pushed SHA is supplied in Plan Manager's summary `git_sha` and shared
`artifacts/commits.txt`. Generated `content/history.json` is excluded. Owner identity
is checked with inherited author/committer overrides removed. CI and the new
exact-SHA green gate/deployed QA belong to Plan Manager for pm-257/t-1610 after
push; their new ids are not yet assigned. Any failed declared command, repeated
backend mismatch, absent fallback pixels or deployment lacking the repair returns
this task. Hosted activation remains with pm-257/t-1611 and its operator/SWE and
independent QA: exact hosted Worker/app identity, denied-Origin rejection, peer
render/clear and opt-out behavior must be observed there. Neither deployment flag
is enabled by this repair; no external chore is reached.
