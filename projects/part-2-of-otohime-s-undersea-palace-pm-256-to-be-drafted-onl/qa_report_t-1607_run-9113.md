# t-1607 QA — run-9113

Delivery: **5139d4fd9d7e4b83d53e17fb715ad576b4e38cc4**. Green gate **ver-3620**, run-9112,
is persisted as pass at `5139d4f`, with all nine contract items passing. **PASS for t-1607's local transport
scope**, with the application deployment independently observed at the delivery commit. No remaining
transport defect was observed; hosted Worker activation and product UI remain successor scope.

QA ran with recorded profile **codex-sol-6-1-high**, **gpt-6.1-sol**, effort **high**, fleet worker
**avietidol-mac-mini**, account codex-main. Fixed delivery run-9111 used that same recorded profile.
Original run-8976 used claude-opus-high / claude-opus-5-5 / high. These are run records, not role defaults.
Only this report and QA evidence were added; no application or transport source was changed.

## Local execution and independent proof

Root and Worker dependencies were separately installed with `npm ci` on Node **22.23.3**, macOS/arm64.
The locked Wrangler **4.152.0** actually imports and constructs the Worker and GhostRoom in local workerd
with real namespace bindings and compatibility date **2026-10-15**. This is executable preflight and
execution, rather than a fake standing in for the Cloudflare adapter. There are no model/data assets.

| Contract command | Observed result |
| --- | --- |
| Root protocol/room tests | 25 pass |
| Fake WebSocket tests | 22 pass |
| Worker `npm ci` | exit 0 |
| Worker `npm run typecheck` | exit 0 |
| Worker `npm run test:local` | 17 pass; real routing, namespace, hibernation handlers and constructor re-entry |
| Worker `npm run bundle:check` | exit 0; Wrangler dry-run, exports/privacy assertions, 12,344-byte bundle |
| Root `npm test` | 2,380 pass |
| Root `npm run lint` | exit 0; 10 existing warnings, zero errors |
| Root `npm run build` | exit 0 |

The main update incorporated during QA was report-only commit `7666778`; project and actual Worker tests,
lint and production build were also checked on that integrated tree. Generated `content/history.json`
was restored after builds. [Command results and logs](t-1607/run-9113/root-results.json),
[Worker results](t-1607/run-9113/worker-results.json).

[New independent probe](t-1607/run-9113/probe.mjs): **14/14 pass**, using locked **ws 8.21.0** and its
own assertions, without the delivered raw client or shared CONTRACT_CASES. Both actual Worker and fake:

- Exchange normalized moves and clicks with distinct fresh UUIDs, ignore forged ids, avoid echoes, isolate
  `/` from `/ryugu`, and announce departure/count cleanup.
- Reject missing, null, path-bearing and lookalike Origins with 403, unknown/duplicate rooms with 404 and
  plain non-upgrade requests with 426. These negative controls follow successful ordinary connections.
- Reject numeric strings, null, array JSON, a 129-byte text frame and binary JSON; the fifth strike closes
  1008 with no invalid event reaching the other client.
- Fan out **15 of 200** attempted burst messages and admit 24 sockets; socket 25 receives `full` and 1013.
- Reject an independently masked RSV2 frame with an observed **1002 close frame**, bye and zero invalid
  fan-out, after a positive ordinary click.

An independent clock sequence drains 11 valid + 4 invalid tokens at T=10,000, rolls back 1,000ms,
serializes/restores membership, and confirms that recovery to T and T+66ms refills nothing. T+67ms
admits the fifth invalid attempt and closes 1008. This checks both the timestamp and retained penalties.
G9008-1 and G9008-2 are resolved for this fingerprint. [Independent results](t-1607/run-9113/independent.json).

The initial QA harness incorrectly required TCP close completion within 2.5 seconds and then assumed
cross-socket bye/close ordering. The final probe awaits the ws receiver's actual `conclude` event,
asserts close 1002, membership release and no fan-out, and tears down explicitly. workerd's tunnel can
remain CLOSING after the protocol close; that is recorded separately, not called an executable defect.

[Browser transport proof](t-1607/run-9113/browser-transport.json): Chrome **156.0.8078.48**, three isolated
contexts, real browser WebSockets against the fake. Two same-room clients exchange move/click events;
the other room receives none, there are no echoes or Cookie headers, and a different browser Origin is
refused. This uses synthetic pages and the local fake, and does **not** establish product canvas behavior.

## Identity, privacy and history

Actual local `/version` and dry-run bundle identify fingerprint
**24da92a191ac0825a41cb0ac9963d2483bb7436cd2360967f32981fd0c91cd6f**.
The nine code/lock/config input hashes are recorded in the independent result; root/fake/lock/config/native
runtime hashes are in [hashes.json](t-1607/run-9113/hashes.json). The prior defective executable fingerprint
was `54ea22a371c9031e7f6e7801a246aea25a9b11841ccaa2ff1390bc48d186574e`.
No artifact/model hash is applicable beyond the locked native runtime and bundled code.

Read adapter, policy, protocol, room, fake parser, namespace configuration, package registration and excludes.
Worker forwards only Upgrade to the DO; socket attachments have exactly `{id,tokens,at,invalid}`.
Production code never calls storage/SQL/KV/alarms, records coordinates/history, or reads identity/cookies/IP/UA.
Observability/logpush are disabled. Local reconstruction tests inspect empty application storage/SQL tables;
provider-owned runtime metadata is outside this application promise. Only the fake retains capped,
ephemeral synthetic coordinate/header-presence logs; no visitor traces or header values were saved here.

[Task history scan](t-1607/run-9113/history.json): two pages, limit 10, offsets 0 and 10, each for FAILED
and COMPLETED: **20/1,138 FAILED**, **20/6,756 COMPLETED**. Current **9/9 RUNNING**, **1/1 PENDING**.
This is a bounded, non-atomic global snapshot, not complete historical coverage. No matching ghost attempt
was found in those windows; older unread history is inconclusive. Unrelated forge E_ANIMATE_MAP and Desk
push failures do not describe this executable.

Explicit lookups supplement the window: run-9111/task `73c928b5-e2c3-4f51-9eeb-157aa766f5d5`,
run-9112/task `3a7e7256-d678-4160-a980-718110659f8e`, and prior QA run-9008/task
`5571b04a-2bbe-418f-a23f-abc4d67b1f54` are COMPLETED, callbacks delivered once, with persisted succeeded
board runs, rep-5368/rep-5281/rep-5282 and ver-3620. Runner tails read: 1,232/67/1,131 lines respectively;
the API supplies bounded tails, so they do not prove full transcript completeness. Read the raw 446-line
failed Desk tail for `a70403e1-d4fc-4944-8233-2ee4127908b3`: push_not_on_main/rescue, unrelated to ghosts.
[Callback/ingestion and selected raw tails](t-1607/run-9113/ingestion.json).

GitHub history: two pages each, 10/page: **20/126 failed** and **20/244 successful** CI workflows.
All 40 historical SHAs were compared with the nine current Worker code/lock/config inputs: **zero** match
the new fingerprint. They cannot establish success or repeated failure of the fixed executable.
[Fingerprint correlation](t-1607/run-9113/ci-fingerprint-history.json). Historical #484 failed Footer
Chromium probe; last green #483 succeeded. Both use ubuntu-24.04; workflow/Footer configuration history
between those SHAs is empty. Raw job logs return HTTP403, and the public annotation only says exit 1.
The raw assertion remains unread; environment attribution would be unjustified.
[Comparison](t-1607/run-9113/ci-comparison.json).

## Delivery boundaries and deferred owners

- **Execution demonstrated:** actual local Worker/DO, real ws clients, both rooms, limits, negative cases,
  exact locked executable and on-demand live-state constructor reconstruction. Natural edge hibernation
  was not observed and is not required by this local reconstruction contract.
- **Fake boundary:** the Node fake plus independent Chrome WebSockets on synthetic pages. This proves
  browser transport, not the product UI or real Cloudflare edge execution.
- **Waiting for capacity:** none. No queued runtime output is claimed as delivery.
- **Integration deployed:** the application serves delivery commit `5139d4f`; the dedicated Cloudflare
  Worker is not hosted yet. These are separate deployment identities.
- **Hosted Worker deferred:** **t-1611**, after automation in **t-1610**, owns activation. Failure condition:
  `/version` differs from the delivered Worker fingerprint or real hosted same-room fan-out fails. No
  credential chore is reached by t-1607.
- **Product delivery deferred:** **t-1608/t-1609/t-1610** own canvas, preference/lifecycle and real product
  two-browser controls. Failure condition: missing/incorrect rendering, opt-out/reduced-motion transport,
  privacy or graceful fallback. No product rendering is claimed here.

## Final CI and application deployment

GitHub [CI #485](https://github.com/quiinthieu/otohime/actions/runs/40430068517), run **40430068517**,
head **5139d4fd9d7e4b83d53e17fb715ad576b4e38cc4**: **checks job 121945296200 succeeded**, including
unit tests, production build, E2E, motion and both Footer probes. The production job **121950183033**
deployed the application and was running its final terminal/press verification at the saved snapshot;
do not read that snapshot as a completed workflow. [Native job evidence](t-1607/run-9113/delivery-current-jobs.json).

At **2026-10-27T01:19:15Z**, independent Chrome checked Home and `/ryugu`: both return 200, both meta
build SHAs equal **5139d4fd9d7e4b83d53e17fb715ad576b4e38cc4**, neither has horizontal overflow or
page errors. Live `/api/health` returns 200, `ok:true` and that exact SHA.
`git merge-base --is-ancestor 5139d4fd9d7e4b83d53e17fb715ad576b4e38cc4 5139d4fd9d7e4b83d53e17fb715ad576b4e38cc4`
exits **0**. [Public user path and health](t-1607/run-9113/public-path.json).

The read-only Footer probe was driven against the previous served baseline `baec1f8` while deployment
was building: **168 pass, zero fail**. This is baseline evidence, not a claim that it tested the new SHA.
[Raw baseline probe](t-1607/run-9113/live-footer-baseline.txt). Live Worker fan-out and complete product
delivery remain unclaimed; the exact follow-up owners and failure conditions are listed above.
