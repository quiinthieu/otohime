# t-1610 QA report — run-9314

**Verdict: pass for the declared browser-proof and dark deployment-preparation scope.** Delivery and independently observed deployed commit: **3684cb5e2aa7a2ae517637c74a6d387aa693a9f9**. Green gate **ver-3701 / run-9310** passes all six contracts at that delivery. [CI 40640198126](https://github.com/quiinthieu/otohime/actions/runs/40640198126) independently reports **Success**, checks **22m53s**, production **4m7s**, total **27m5s**. [Public CI receipt](qa-run-9314/ci-delivery-final.json).

QA adds only evidence and standalone probes under this plan folder. No application, existing test, workflow, lock or generated-history changes are included. Evidence branch: **pm-257-t-1610-qa-run-9314**; the evidence commit is recorded in the submission metadata and final response.

## Identities and scope

The local integration tree is **d323b8777a9c34428967314bb9f7f6a87a861fff**, freshly fetched from main. It contains delivery 3684cb5 plus the separately delivered pm-274 crumple feature. All its browser cases are included. Local Next BUILD_ID: **VESpu-sDiy0ykYurW4tZD**; local app marker: **dev**. The 950-file source/configuration/verifier inventory fingerprint is **8f93e8c1d8127018126151de0d89f15e833cfb26f1eaa01372afabb2c3e1de10**. [Inventory](qa-run-9314/identity.json) includes both locks, per-file hashes, nine actual vendored camera assets and the model manifest; QA verifier hashes are separately captured in [verification.json](qa-run-9314/verification.json).

Environment: Node **22.23.3**, Next **16.4.2**, playwright-core **1.64.0**, real Chrome **156.0.8078.48**, locked Wrangler **4.152.0**, Darwin/arm64. Root lock SHA256: **9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b**. Worker code/lock/configuration fingerprint: **aa87b9e3b4328f59801de5028120046f3c244f4f55e7e26d661b16d02b6a7115**; actual dry-run bundle SHA256: **60b3272e28ea5bfecaddb055c367d66a89f24e32f5ddeaa3c766f630e77de06f**.

The serving production SHA is exactly the delivery. `git merge-base --is-ancestor 3684cb5e2aa7a2ae517637c74a6d387aa693a9f9 <health.sha>` exits **0**. Independently served RSC BUILD_ID: **jzLQWmkziY5XkhxfgQ6Nn**; Home build meta agrees with health. The public application-build artifact is listed by CI, but was **not downloaded**; its digest is retained separately, not used to invent the served BUILD_ID.

Recorded attribution: delivery SWE **run-9305** is **claude-opus-high**, flags select **claude-opus-5-5**, effort **high**. QA **run-9314** is **codex-sol-6-1-high**, **gpt-6.1-sol**, effort **high**, fleet worker **avietidol-mac-mini**. Gate run-9310 is a shell verifier on **avietidol-z490**. These come from run records, not current role defaults. [Profiles/history](qa-run-9314/platform-history.json).

## Verification

| Contract/check | Result |
| --- | --- |
| Exact declared workflow-fixture command | **60 pass**, exit 0 |
| `npm test` | **2,613 pass**, exit 0 |
| `npm run lint` | Exit 0; 10 existing warnings, no errors; final evidence lint also passes |
| `npm run build` | Exit 0 |
| `TMPDIR=/tmp npm run test:ghosts` | **8 pass**, exit 0 |
| `TMPDIR=/tmp npm run test:e2e` | **242 pass**, exit 0; **629s** including build |
| Worker locked `npm ci`, typecheck, local tests, dry-run | Exit 0; **18 actual workerd tests** |
| Independent QA suite | **3 pass**; includes actual CI footer probe **176/176** |
| Read-only deployed walkthrough | Pass at exact delivery SHA |

The initial workflow/project commands failed **4/7 assertions respectively**, all due to absent GNU `timeout` on this Mac (127 instead of the expected child/124 status). A real existing GNU coreutils **9.7** executable was added to PATH, with its SHA256 recorded; unchanged commands then passed 60/60 and 2,613/2,613. This is an environment bootstrap, not a test relaxation or a fake timeout. [Initial workflow failures](qa-run-9314/workflow-initial-failures.log), [initial project failures](qa-run-9314/project-initial-failures.log). Full local command receipts, log hashes, counts and bounded tails preserve both attempts. The full browser suite ran without overlapping unit/build verification.

The first production ancestry probe correctly rejected older deployed **22a88f0**. The final independent walkthrough ran after production served 3684cb5; the old rejection is retained in [the initial receipt](qa-run-9314/deployed-initial-failure.log).

## Independent observations and negative controls

[Independent browser probe](qa-run-9314/independent.test.mjs) imports no supplied browser-proof helpers and uses **actual local workerd**, real Worker/DO construction, bindings, native transport and Chrome backing-store pixels. Only the app configuration response and the local allowed-Origin binding are overridden. Local runtime version: **1e756d83-826d-400a-9b38-60159d0cee65**; effective local configuration fingerprint: **848af3ddbef51f591f2d50057ee18fdce34519a5ca22003fea281c8b478f0105**. This is not a hosted version.

Peer motion paints **44 Ryugu pixels** and **43 Home pixels**; cross-room isolation and departure clearing pass. A separate WebSocket proxy drops **two actual server movement/click frames** while retaining membership: the same ink assertion rejects its **zero pixels**. A denied-Origin upgrade returns **403**; fake-only `/__log` returns **404**. No canvas methods/counters are substituted. [Result](qa-run-9314/independent-result.json).

The independent footer check measures the 768px layout at 200%: root **32px**, padding **120px**, borders **2px**, scene offset **122px**. Explicit 24px/32px labels preserve all measured geometry within the original 1px bound. Injecting the historical 2.5rem padding yields **80px** and the same independent band assertion rejects it. The screenshot was visually inspected; only its hash is committed. [Numeric result](qa-run-9314/footer-result.json). The shipped Bottle cases separately preserve containment, geometry, three viewports and their original negative controls.

The supplied ghost suite also proves throttling/finite normalized coordinates, anonymous joins/leaves, trails/ripples/decay, app-cookie host separation without cookie values, initial/live reduced motion, persisted hide/reload/cross-tab propagation, hidden/offline cleanup, refused/full/flap terminal budgets and quiet unset configuration. Fake logs are bounded/reset and the tests assert no dropped records. Its paint-suppression control rejects zero pixels despite a positive data counter.

Workflow fixtures execute actual YAML shell against explicit npm/Wrangler stand-ins. They prove dark/missing-secret behavior, path triggers, dispatch equivalence, locked commands, verification ordering, manifest identities and stale-identity rejection. They do not deploy. Separate real workerd and dry-run checks establish runtime dependencies and absence of fake hooks/storage/logging in the Worker.

The camera regression actually constructs the locked production SDK/model/Wasm/worker and yields **478 landmarks**. Hardware is a continuing synthetic canvas stream, with lifecycle controls injected. [Actual camera receipt and asset/model hashes](qa-run-9314/camera-runtime.json). No physical-camera claim follows.

## Deployed user path

[Read-only production driver](qa-run-9314/deployed.mjs) uses no config override/fake and performs no configuration mutation.

| Starting state | Action | Observed result |
| --- | --- | --- |
| Public app at 3684cb5 | Health, direct and optional config | Health ok; direct config empty 404/no-store; optional config null |
| Home, motion allowed | Load; hide through Pocket; reload; enable | Off, zero peers; hidden preference persists; enabling stays quietly off |
| Palace, same context | Toggle Home Pocket; reload palace; enable from Home | Storage choice propagates; hidden reload mounts no canvas; enabling returns off |
| Both roots | Capture page/console errors and socket creation | **No errors; no upgrades** |

[Production result](qa-run-9314/deployed-result.json). These browser logs and APIs are independently observed. Authenticated backend logs were unavailable; no full server-log audit is claimed. Worker visitor logging is intentionally disabled.

## History, defects and handoff

Task-manager history: FAILED offsets **0/3**, limit 3 (**6/111**); COMPLETED offsets **0/3**, limit 3 (**6/1,328**); RUNNING offsets **0/3** (**4/4** at read). PENDING returned an empty object without an explicit total. The plan run list returned **34 records**. Global scans are partial; unread evidence is inconclusive.

Latest failed SWE run-9304/task **edb12e60-dbba-494c-8483-f1de9d165dc9** has raw **exit 143** and rescue **16c266c** containing generated history only. Its callback delivered once and persisted ingestion has **callback_apply_failures=0**. The tool returned a bounded 79-line tail containing nested transcript; retained startup/exit/rescue lines are not a full execution history. Current green gate task **e291c3a3-509e-49ca-9cff-8f133608790f** completed, callback delivered once, persisted ingestion failures **0**; its raw **68 lines** confirm each command status. [Ingestion/raw runner evidence](qa-run-9314/ingestion.json).

GitHub scans: FAILED two pages of five (**10/152**), COMPLETED two pages of five (**10/538**), then-current in-progress **2/2**, queued **0/0**. Worker workflow history is **1/1**, skipped run **40619191293**. The latest inspected red CI **40635091133**, job **122640103971**, publicly reports a footer-network unverified YouTube embed request. Its full raw job log returns **403**; later API reads hit the shared unauthenticated rate limit. Last green same-job **40631993207 / 122630267659** and the red job both use ubuntu-24.04. [Code/lock/configuration comparison](qa-run-9314/prior-ci-inputs.json) shows the network verifier unchanged. Its exact historical cause remains unproven; it is not relabelled an environment outage or claimed repaired by the Bottle change. Current delivery CI and an actual local 176-check footer run pass, including frame ownership/foreign-frame negative controls. No repeated deterministic network defect was established in these reads. [Bounded history](qa-run-9314/ci-history.json), [raw public failure/access limit](qa-run-9314/ci-raw-failure.json).

**No observed defect remains in the verified t-1610 scope.** Earlier Bottle failures are addressed by changed dependent-band readiness, preserved assertions, independent numeric/negative evidence, the full local suite, exact-SHA green gate and successful deployed CI.

- **Integration deployed:** yes, application 3684cb5, deliberately dark.
- **Waiting for capacity:** no.
- **Execution demonstrated:** yes, local real Chrome/Next/workerd within the explicit boundaries above.
- **Hosted active ghost product delivered:** unproven; outside this task.

Deferred activation/live fan-out remains **pm-257/t-1611**, currently backlog, owned by its SWE/operator handoff and later independent QA/acceptance. No hosted Worker version/deploy id or escalation exists yet. At that dependency it must handle credentials/configuration, bind actual hosted Worker version/fingerprint and app SHA/BUILD_ID, and observe live two-browser ink/clearing/opt-outs plus denied-Origin rejection. Failure conditions: missing activation, identity mismatch, accepted denied Origin, absent peer rendering/clearing or broken suppression/retry controls. There is no persistent product job queue or ingestion callback for ephemeral presence. No operator chore or capacity wait is reached by t-1610.

The evidence-only save does not require another deployment; production remains judged at the delivered SHA above.

Separate integration CI **40641088253 / checks job 122659156611** at d323b87 was last read in progress; its final remote outcome is unobserved here. Owner: **pm-274/t-1584** and QA **run-9315**. Any failed integration gate or deployed crumple regression requires that owner’s repair. Its 242-case local integration pass is observed; its pending remote result does not waive any defect or replace delivery 3684cb5’s completed gate/CI/deployed proof.
