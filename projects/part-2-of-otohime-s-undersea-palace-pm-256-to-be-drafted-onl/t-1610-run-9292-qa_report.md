# t-1610 QA report — run-9292

**Verdict: fail. Cause: code.** The Ink Ghosts proof and dark deployment preparation pass at delivery **308b36202ef8774294596ac9d689016fd64d8d5b**. The latest independently observed deployed descendant is **2f405343eeee2a625884a6e999591efebed9270c**. However, refreshing the save branch to main **995279a572db68e48ace27cd2aaa04b9d6611e72** introduces a new Booth browser test that fails the full integration gate: **229/230**, exit 1. All 222 original top-level cases pass again; the two nested original cases also pass. The failure is in the six newly added Booth cases, not ghost behavior. It remains a defect despite an isolated pass and pending upstream CI.

No application or existing test source was edited by QA. The focused repair is [the fix plan](t-1610-run-9292-fix_plan.md). Source owner: **pm-294/t-1684**; repair owner: the next **pm-257/t-1610 software-engineer** run responsible for restoring this full-suite gate. This classification follows the instruction to use code, rather than authority/environment, for a failing check that cannot be attributed to the original delivery.

## Exact identities and deployment

Board green gate **ver-3693 / run-9288** passes all six declared commands at **308b362**. Its task-manager job **66996231-fdae-45a9-8636-c532bafc1417** completed; callback delivered in one attempt; persisted ingestion has `callback_apply_failures=0`. The raw 69-line runner read confirms each command result.

GitHub [CI 40625571209](https://github.com/quiinthieu/otohime/actions/runs/40625571209) is **success**, with checks job **122609540426** and production job **122615531353** successful. Public health and Home's build meta independently identify the full delivery SHA. The production probe executes `git merge-base --is-ancestor <delivery> <deployed>`, exit 0. Served Next build id: **r4lyw4G6B5AC1vpoNmEv8**, independently read from the RSC payload, separately from app SHA; no downloaded build artifact is claimed.

At the final read-only walkthrough, production had advanced to **2f405343eeee2a625884a6e999591efebed9270c**, with served RSC build id **M6HtPWCnO9UtxK1xpqLSU**. Its [CI 40626633944](https://github.com/quiinthieu/otohime/actions/runs/40626633944) is also **success**. The same ancestry command and full Home/palace dark-state walkthrough pass again, with no errors or upgrades. [Latest production receipt](qa-run-9292/deployed-latest-result.json). No production observation of 995279a is claimed by this run.

Local verification initially used fresh-main descendant **2f405343eeee2a625884a6e999591efebed9270c**, Next BUILD_ID **xeCLgKCnc5YQUyhvEyzSU**, source/proof inventory fingerprint **30b4a1420c16a1889185d177d234263835b92e22fde9ec93838ba0d75adc2e4a**. It differs from delivery by isolated Booth/Pachinko/sound additions. Final integration uses **995279a**, BUILD_ID **0bDoN0w65sG1Ih2hYiLaC**, inventory fingerprint **9a6d6d82b0f9eb6f203b2cd2be67406f660c9477a29ab73140c03217a8b90658**. Local app SHA marker is `dev`; neither local build is relabelled as production.

The Worker code/lock/configuration fingerprint stays **aa87b9e3b4328f59801de5028120046f3c244f4f55e7e26d661b16d02b6a7115**. The independent local workerd version is **512c2cde-701a-4e2d-801c-0c3c3326565c**, not a hosted version. Its explicit local Origin override is `http://localhost:58888`; effective local configuration fingerprint **680dcac1365c9bb5afb7bb1dc86adc0ea200f68fa4f6e138c743c47131d00fa1** is recorded separately.

Environment: Node **22.23.3**, Next **16.4.2**, Chrome **156.0.8078.48**, playwright-core **1.64.0**, locked Wrangler **4.152.0**. Root lock SHA256: **9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b**. [Identity inventories](qa-run-9292/identity.json) include per-file code/configuration hashes, both locks, actual vendored SDK/Wasm/model/production-worker hashes, and QA verifier hashes; [the integration inventory](qa-run-9292/integrated-identity.json) identifies the later tree.

## Verification

| Check | First QA tree (2f40534) | Integration tree (995279a) |
| --- | --- | --- |
| Declared workflow fixtures | 59 pass | 59 pass |
| `npm test` | 2,609 pass; final rerun also pass | 2,609 pass |
| `npm run lint` | Exit 0, 10 existing warnings | Exit 0, same warnings; final evidence-file lint also exit 0 |
| `npm run build` | Exit 0 | Exit 0 |
| `TMPDIR=/tmp npm run test:ghosts` | 8 pass | 8 pass |
| `TMPDIR=/tmp npm run test:e2e` | 224 pass, 494s TAP duration | **229/230; exit 1**, 530s TAP duration |

Worker `npm ci`, typecheck, **18 actual workerd tests**, and real Wrangler dry-run all pass. The Worker/DO constructors, bindings and exports are real. No credentials/deployment were used. Workflow fixtures execute real workflow shell against explicit npm/Wrangler stand-ins; they test disabled configuration, missing-secret rejection, shared-code triggers, dispatch equivalence, verify-before-deploy, public manifest identities and stale-identity rejection. They do not establish a hosted deployment. Real Worker tests and the independent probe reject fake-only control endpoints.

The first full command had two pre-browser Turbopack internal-font resolution failures. Reinstalling with the unchanged root lock restored successful compilation and the complete 224-case suite; subsequent integration builds also pass. [Both failures are retained](qa-run-9292/local-build-failures.json). Their precise installation/cache mechanism is not established. These are not silently counted as browser passes.

[Original receipts](qa-run-9292/verification.json) and [integration receipts](qa-run-9292/integrated-verification.json) preserve commands, exit codes, log hashes, counts and scope. A project-test rerun overlapped part of the second browser run; the Booth failure occurred at its beginning, before that overlap. The first complete 224-case pass and independent controls ran without concurrent local verification.

## Independent user-path and negative evidence

The committed [independent browser probe](qa-run-9292/independent.test.mjs) imports no supplied browser-proof helpers. It runs two real Chrome contexts against **actual local workerd**, using only an injected app config response and the explicit local Origin binding. Peer movement paints **44 real backing-store pixels**; Home/Ryugu room separation and peer departure clearing pass. A raw HTTP upgrade with denied Origin returns **403**; `/__log` is **404**. In a separate context, a WebSocket proxy drops **two actual server move/click messages** while forwarding membership. The same independent ink assertion rejects its **zero pixels**. Canvas methods and counters are not replaced. [Result](qa-run-9292/independent-result.json).

The supplied eight-case proof was separately rerun: two-context Home/Ryugu exchange, bounded anonymous joins/leaves and logs, <=10Hz finite normalized movement, trails/ripples and decay, app-cookie host separation, storage/reload/cross-tab suppression, initial/live reduced motion, hidden/offline cleanup, refused/full/flap attempt ceilings and disabled config. Its separate paint-suppression negative control also rejects zero pixels despite a positive application counter. The full suite retains its earlier preference, privacy and isolation controls.

The [read-only production walkthrough](qa-run-9292/deployed.mjs) performs no config override or fake transport:

| Starting state | Action | Observed outcome |
| --- | --- | --- |
| Public dark app at delivery SHA | GET health, ordinary config and optional config probe | Health ok; direct config empty 404/no-store; optional probe 200/null |
| Home, motion allowed | Load, hide with real Pocket, reload, enable | Off/zero peers; persisted hide; still dark after enabling |
| Separate palace root, same browser context | Change Home Pocket, reload palace, enable from Home | Stored hide propagates; hidden reload mounts no canvas; enabled palace returns off |
| Both routes | Collect page/console errors and native socket creation | **No errors, no upgrades** |

[Production result](qa-run-9292/deployed-result.json). Two initial QA-driver errors are retained in receipts: looking for Home's Pocket on the palace, and reading connecting before the asynchronous null config settled. The corrected driver keeps every behavioral assertion and waits for the exact off state within 10s. Neither error prompted an application edit.

The full camera regression constructs the locked production SDK/model/Wasm and capture adapter; public portrait processing yields 478 landmarks. Hardware is a synthetic canvas stream; visibility/offline controls are injected. [Original](qa-run-9292/camera-runtime.json) and [integration](qa-run-9292/integrated-camera-runtime.json) receipts retain their own BUILD_ID and asset/model hashes. No physical-camera or hosted Worker claim follows from these local tests.

## Defect requiring repair

**D1 — e2e/booth.test.ts:577, upstream 995279a.** Immediately after dispatching a native `webglcontextlost` event, the test reads `data-renderer-backend` and gets `webgl2` rather than `canvas2d`. [Raw failure and source identity](qa-run-9292/upstream-defect.json).

An independent real-application control observes **webgl2 before and immediately after dispatch**, then **canvas2d after two frame opportunities**, with **43,200 painted pixels**. The application fallback works; the test assumes synchronous React commitment. The unchanged isolated original case subsequently passes (1/1), which does not remove the full-suite race. The exact fix waits for the existing backend condition and retains its pixel checks. No timeout, pixel threshold or product requirement should be weakened.

Concurrent Booth QA run **run-9294** records a focused 6/6 pass in report-only commit **b5bbad531bd8cff412b1a5c27b389bc3043280cc**. This branch fast-forwards over that report without changing any verified executable input. Its recorded profile is `agy-argon-medium`, flags `--model gemini-4-argon-medium --dangerously-skip-permissions`, with no separate effort flag. That focused pass, like this run's isolated pass, does not discharge the observed full-suite race. [Authoritative run metadata](qa-run-9292/peer-qa.json).

Recorded source run **run-9290**: profile `agy-argon-high`, model `gemini-4-argon-high`, flags `--model gemini-4-argon-high --dangerously-skip-permissions`; no separate effort flag is recorded. This QA **run-9292** and delivery SWE **run-9283** both record `codex-sol-6-1-high`, model `gpt-6.1-sol`, reasoning effort **high**. Gate run-9288 is a shell verifier, not an LLM assertion.

## History completeness and handoff

[Platform history](qa-run-9292/history.json): FAILED offsets 0/3, 3 each (**6/107**); COMPLETED offsets 0/3 (**6/1,320**); RUNNING offset 0 (**2/2**). PENDING returned no tasks and no explicit total; no broader count is inferred. The plan-run read returned **27 records**, including all six returned t-1610 runs. [Ingestion evidence](qa-run-9292/ingestion.json).

Raw reads: original push-failure runner **1,063-line bounded tail**, prior gate **76 lines**, current green gate **69 lines**. The run-9276 push failed `push_not_on_main`; later delivery is on main. Prior gate job **0eb5d871-8b7a-4284-9d37-19acd9185794** delivered its callback once; Plan Manager persisted run-9280 with zero ingestion failures and the failed/timeout check results. Its raw runner output does not contain the original project-test assertion; that historical failure remains unidentified, not retrospectively “proved fixed.” New verification is bound to the repaired executable.

[GitHub history](qa-run-9292/ci-history.json): two pages of five FAILED runs (**10/149**) and two pages of five COMPLETED (**10/531**), plus current delivery/upstream jobs. These global scans are **partial**; unread/truncated evidence is inconclusive. No older failed run matches the reviewed delivery executable inputs. The inspected public raw assertion from run **40554703084**, job **122367525170**, is a different Hanafuda data-count failure (645 expected, 660 observed); authenticated raw-job-log retrieval returned **403**. No full remote-log audit is claimed.

Last green delivery CI **40625571209** and its preceding green **40619191440** use ubuntu-24.04. Workflow configuration between f2e1adf and 308b362 is unchanged; the additional Booth commit also changes no CI workflow. Upstream CI **40628728959**, checks job **122619827846**, was executing E2E at inspection. It is owned by **pm-294/t-1684**; any failing check or missing deployed descendant fails that follow-up. QA does not wait for it or use it to waive D1.

Integration deployed: **yes, app 2f40534 contains delivery 308b362, deliberately dark**. Waiting for capacity: **no**. Execution demonstrated: **yes, real local browser/Worker within the boundaries above**. Hosted active ghost product delivered: **unproven**. No hosted Worker version id or ghost job/callback exists; presence is intentionally ephemeral. Worker workflow **40619191293** was skipped while disabled.

Deferred activation/live fan-out belongs to **pm-257/t-1611** (software-engineer activation handoff, then independent QA/acceptance), currently backlog. It must obtain exact hosted Worker version/fingerprint and app SHA/BUILD_ID, prove actual peer rendering/clearing and all opt-outs, and reject a denied Origin. Failure conditions: missing activation, mismatched identities, accepted denied Origin, absent peer ink/clearing or broken opt-out/failure controls. No credential chore is reached by this QA task; no operator action or capacity deferral is raised.

Evidence is saved on **pm-257-t-1610-qa-run-9292-save** and integrated to main without application edits. The evidence commit SHA is supplied in Plan Manager submission metadata and the final response; generated history and binaries are excluded.
