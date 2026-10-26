# t-1607 QA — run-9008

Verdict: **fail**, cause: **code**. The declared suites pass, but independent probes reproduce two defects. No application source was changed by QA.

Delivery: `4647c201ff4ad11102e725a1bd081faf807f0a6c`, containing implementation `ae6573a10e499b644491bb1f9ac36588cafbb387`. Green gate: `ver-3585`, run `run-9004`, pass for `4647c20`. QA checkout initially `aa14129c5f9011357f9735223560d1640d0f15d1`; executable files, both locks and configuration match the delivery (`git diff --exit-code 4647c20 -- ghosts scripts/ghosts-fake.mjs scripts/ghosts-fake.test.mjs package-lock.json package.json tsconfig.json eslint.config.mjs`, exit 0).

## Findings

| ID | Severity / owner | Evidence and failure condition |
|---|---|---|
| G9008-1 | P2 / t-1607 SWE | `scripts/ghosts-fake.mjs:73` reads FIN/opcode but discards RSV bits. A masked text frame with RSV1 set, without any negotiated extension, is decoded and relayed as a valid move. The real local Worker rejects the identical frame with zero fan-out. The fake relays one move. This violates the bad-frame boundary and makes fake proof overstate real transport parity. |
| G9008-2 | P2 / t-1607 SWE | `ghosts/room.ts:156` moves the bucket timestamp backward. Drain 15 tokens at 1000000 ms, receive once at 995000 (correctly dropped), then return to 1000000: the next frame is accepted with 14 tokens left. No progress beyond the previously consumed timestamp occurred. Rollback/recovery can mint another bucket; the existing rollback test stops before recovery. The shared room is used by both adapters. This is a deterministic injected-clock boundary defect, not a claim that a production clock adjustment was observed. |

[Independent probe](qa_run-9008/probe.mjs) imports the delivered fake server but uses a separate `ws` client from the installed, locked Worker dependency tree. It does not use the delivered raw client or `CONTRACT_CASES`. Two executions produced the same 8 pass / 2 fail result, exit 1; [raw results](qa_run-9008/independent.json). Reproduce from the root:

```sh
npm ci
(cd ghosts/worker && npm ci)
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON projects/part-2-of-otohime-s-undersea-palace-pm-256-to-be-drafted-onl/qa_run-9008/probe.mjs
```

The malformed-wire test is paired with successful ordinary moves/clicks through the same connections, so zero fan-out is not inferred from an unstarted server. Separate negative controls reject an evil Origin with 403 and close on the fifth malformed JSON message with 1008 in both implementations. Actual Worker rejection and fake acceptance of RSV1 provide an independent comparison.

## Verification performed here

Node 22.23.3 on macOS arm64. Both root and Worker `npm ci` completed. Real Wrangler 4.152.0 / workerd 1.20261019.1 / Workers types 5.20261026.1, compatibility date 2026-10-15; `GhostRoom` constructed through the real namespace. No substitute runtime was used to validate the real Worker. [Environment and locks](qa_run-9008/environment.json).

| Contract command | Result |
|---|---|
| Protocol/room command with strip-types and warning flags | exit 0, 23/23 |
| Fake-server command with strip-types and warning flags | exit 0, 18/18 |
| Worker `npm ci` | exit 0 |
| Worker `npm run typecheck` | exit 0 |
| Worker `npm run test:local` | exit 0, 14/14; reconstruction driven on demand |
| Worker `npm run bundle:check` | exit 0; index.js 12336 bytes; expected two exports |
| Root `npm test` | exit 0, 2315/2315 |
| Root `npm run lint` | exit 0, zero errors; 10 pre-existing warnings |
| Root `npm run build` | exit 0; temporary build-only auth placeholders; BUILD_ID `YmGkBC2GJE9_WF06y4PkG` |

[Unit tail](qa_run-9008/units-tail.txt), [fake tail](qa_run-9008/fake-tail.txt), [Worker runtime tail](qa_run-9008/worker-local-tail.txt), [project tail](qa_run-9008/root-test-tail.txt), [lint](qa_run-9008/lint-with-probe-tail.txt), [build](qa_run-9008/build-tail.txt). Build-generated `content/history.json` was restored to its original committed contents; no application change was saved.

Worker public fingerprint: `54ea22a371c9031e7f6e7801a246aea25a9b11841ccaa2ff1390bc48d186574e`. The actual Worker's /version returned exactly service plus fingerprint. [Per-file hashes](qa_run-9008/fingerprint.json) bind shared code, adapter code, lock and configuration. Fake hash: `e7b612ee1e23bee85139a6944d4a247935934809a7c82c3b29d61d66b1140028`; root lock hash is recorded separately. No model or external artifact assets are required by this transport.

Review confirmed exact-origin and room admission before DO allocation, stripped visitor headers, fresh UUIDs, attachment-only id/bucket/strike metadata, no coordinate history or application storage/log APIs, disabled observability and ignored local runtime state. Declared tests demonstrate 24-member cap, rate/strike enforcement, reconstruction and zero application tables/keys. The two additional boundary failures remain defects beside these passing checks.

## Deployment and CI

Observed deployed **application** SHA: `074059495faf4bee48e8f655584dfd4487089b41` from GET https://otohime.dev/api/health (200, ok true). `git merge-base --is-ancestor 4647c20 074059495faf4bee48e8f655584dfd4487089b41` exits 1: production does not contain this delivery. Home and /ryugu were also probed read-only; /api/ghosts returns 404, consistent with that route belonging to t-1608. This is not hosted Worker proof. No Cloudflare Worker URL/version exists in the delivered task; deploying one is explicitly outside t-1607.

[Actions run 40340641001](https://github.com/quiinthieu/otohime/actions/runs/40340641001), implementation SHA ae6573a: checks job `121634081296` fails at **Run npm test** after successful install/lint/typecheck. Production job `121635222867` is skipped. Last green **checks** run is #444, `40325669520`, SHA `542c62068564fafaf7045560135064cbdb866f91`, job `121584905405`; both jobs use ubuntu-24.04, with recorded runner names GitHub Actions 1000000836 and 1000000824 respectively.

Read `git log 542c620..ae6573a -- .github/workflows scripts/ci-workflow.test.mjs scripts/probe-end.sh scripts/probe-motion-signed-in.sh`: six commits (5577ec5, ec59663, 5dcfe98, d476bd9, 658f6fc, c1b26f1). Current lib/end.test.ts still expects a stub npm installer while scripts/probe-end.sh has a CI/Chrome branch; this is a lead, not a reproduced Linux diagnosis. The raw job log endpoint returned HTTP 403 requiring repository admin rights ([response](qa_run-9008/raw-ci-log-response.json)). No runner failure was demonstrated. Therefore CI attribution remains **inconclusive**, and this report does not classify the delivery as environment or authority. The observed transport defects independently require cause=code.

[CI snapshot](qa_run-9008/ci.json): two pages, 20 each, newest 40 of 458 runs; 10 failure, 25 cancelled, 5 success, all completed, zero pending in that bounded window. This is not all historical CI. #452–458 are repeated npm-test failures per supplied history; only #458's step details were independently read here. An unread assertion cannot be dismissed as unrelated, and no pending replacement or quota reset establishes delivery.

## Job history, callbacks and run identity

[Sanitized evidence](qa_run-9008/history.json). Task-manager global FAILED and COMPLETED pages at offsets 0 and 25, limit 25: read 50/1123 failed (23 otohime), 50/6284 completed (26 otohime). Current RUNNING read 9/9 globally; PENDING returned no tasks. Zero failed titles matching this transport in the scanned window; one completed matching title (the verify job). Older history is unread and absence is inconclusive. An explicit SWE-id lookup supplements the bounded window.

- SWE `97f80709-45b8-4fb3-9eec-172d2f7f0dda`: COMPLETED; callback delivered in one attempt. Board run-8976 succeeded at 4647c20 with zero callback application failures and persisted report rep-5268.
- Verify `fcc6dbf7-cc08-4955-8f48-78a8b2c79950`: COMPLETED; callback delivered in one attempt; persisted green verification ver-3585 at 4647c20. Raw verification artifact SHA256 `e9d3648312f083ca862a5c88386aa7eeaadb546eb26489901b792f1fd0f60525`.
- Read newest failed otohime task `9ba74ec0-4222-4d33-b1b0-3f2349dd716e`: push_not_on_main, unrelated Kame work, callback delivered. Raw tail contains 762 lines with 3240 earlier lines truncated, ending in rescue push. It is not a failure of this executable and is not counted as a ghost attempt.
- The SWE log tail was read (812 earlier lines truncated); it confirms tests, report and push, but is incomplete and does not replace actual execution evidence.
- Attribution: SWE run-8976 records profile `claude-opus-high`, model `claude-opus-5-5`, effort high. QA run-9008 records `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort high. The verify run is shell, without a model. These are recorded run values, not present-day role defaults.

## Delivery boundaries and remaining work

| State / deferred check | Exact owner/id | Failure condition |
|---|---|---|
| Execution demonstrated locally | t-1607 / G9008-1, G9008-2 | Independent probe still exits 1 after the fix; required suites regress. |
| Integration deployed to application | t-1607 SWE / Actions 40340641001, job 121634081296 | Checks remain red, or live application SHA lacks delivery ancestry. No claim of deployed integration now. |
| Hosted transport and activation | t-1611 SWE, after t-1610 automation | Enabled Worker cannot prove matching /version and two real clients. Not yet reached; no credential chore raised prematurely. |
| Two-browser product experience | t-1608, t-1609, t-1610 SWE | Rendering/preferences/retries or independent visual negative controls fail. No client rendering delivered by t-1607. |
| Capacity | none | No capacity prerequisite or queued output is being used as evidence. |

The fake is local Node HTTP plus its own wire parser; only synthetic test-process logs retain capped coordinates/header-presence booleans. The actual transport was executed locally in workerd with real bindings. Reconstruction is a deliberate new GhostRoom instance on live state, not observed Cloudflare hibernation. Product delivery for Ink Ghosts remains unproven until the successor tasks land. QA records the fix plan now and does not wait for external work.

## Save-work verification after rebase

The first report push was rejected because main advanced. Ran `git pull --rebase` onto `5ad4906`, preserving concurrent changes to Vercel deployment scripts and browser tests. All nine required commands passed again (2315 root, 23 unit, 18 fake, 14 actual Worker tests), plus `bash scripts/vercel-deploy.test.sh`. Worker/source/config/lock diff against 4647c20 remains empty and the fingerprint is unchanged. [Rebase verification](qa_run-9008/rebase-verification.json). The report commit changes only projects/**; it cannot repair or trigger application CI. The known code findings and the original CI/deployment snapshot remain applicable to the delivery.
