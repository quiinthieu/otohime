# Ink Ghosts

Plan: pm-257 · Run: run-8946 · Role: product_owner  
Part 2 of Otohime's Undersea Palace; after_plan_id=pm-256 (done).  
Planning base: main e3852eb, fetched/rebased from origin on 2026-10-26.  
Research: [rep-5228, preserved verbatim](research.md).

## Outcome and scope

Visitors on Home and /ryugu can briefly see anonymous ink cursors and fading trails from others in the same room, with immediate local click ripples. A persisted Pocket switch hides the layer across tabs and both roots. Motion reduction turns it fully off. Without an endpoint or connectivity the existing site remains fully usable.

The static palace remains independent: no new layout imports or stylesheet, no modifications to its sea, no dependence on unfinished pm-271 sound work. Current main contains the palace, static history index and pm-271/t-1561 Tamatebako, which landed during this run; the broader Part 1 document is not evidence that every original task landed. Fetch current main before Pocket/route edits and preserve additions by other plans.

## Architecture and invariants

- Neutral top-level ghosts/ owns protocol, policy, preferences, loader and rendering, avoiding the palace ban on imports from components/, lib/ and other route groups. Both page mounts use the neutral client loader, so dynamic({ssr:false}) is inside a client boundary on both roots.
- GET /api/ghosts reads GHOSTS_ENDPOINT at request time via connection(); unset/invalid is 404, valid configuration is no-store JSON. Production uses a dedicated cross-origin wss endpoint; localhost ws is only for local proof. Vercel environment changes may need a configuration redeployment, but no source rebuild flag is required.
- Upgrade interface: /ghosts?room=%2F or /ghosts?room=%2Fryugu. Exact ALLOWED_ORIGINS and the two-room allowlist are checked before DO allocation. The Worker selects one GhostRoom per canonical room.
- Client messages: {t:"m",x,y} and {t:"c",x,y}. Server messages: {t:"hi",id,n}, {t:"m",id,x,y}, {t:"c",id,x,y}, {t:"bye",id}, {t:"n",n}, {t:"full"}. n is total connected members; client label/data count is max(0,n-1), separate from drawable tip expiry. Server ignores client id fields and uses fresh UUIDs.
- Room cap 24, 128-byte frame cap, rate token bucket capacity/refill 15 per second across all incoming attempts, five invalid-frame strikes -> close 1008; excess rate is dropped and full closes 1013. Pure injected-clock tests define exact boundary behavior.
- Client movement <=10Hz with 0.002 deadzone; clicks draw immediately locally and use the bounded server channel. Tips expire after six seconds of silence; each trail has <=12 points fading within 700ms; rAF runs only while visible with drawable work, including a lone visitor's ripple. DPR <=1.5.
- Retry ceiling is three total connection attempts per mounted page session (immediate, 1s, 3s). Full is terminal. Hide/reduced motion/hidden/offline stops drawing and transport; budget exhaustion cannot be reset by lifecycle toggles.
- Application code neither reads nor stores identity, IP/UA, cookie values or visitor history. No DO storage/SQL/KV writes and no visitor telemetry/logs. Hibernation attachments retain only current-socket id/rate/strike metadata, released with the connection; they contain no coordinates. Provider-managed network metadata is outside this application-level promise.
- Browser WebSocket has no credentials:omit option. The dedicated Worker origin avoids application cookies; local proof sets an app cookie and checks header presence only on the different fake host. Do not claim universal suppression of browser cookies. No cookie values or real visitor traces enter test evidence.
- Worker package has its own exact lock, compatibility date and real local runtime contract test. A bundle dry-run, pure room test or fake alone is insufficient evidence of the actual adapter. Socket reconstruction is driven directly in tests rather than by idle timing.

Cloudflare documents that hibernation resets in-memory state and supports socket attachments to restore it: [WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/). New namespaces use SQLite configuration: [Cloudflare namespace change](https://developers.cloudflare.com/changelog/post/2026-07-09-restrict-new-kv-backed-namespaces/). These APIs are verified references, not a claim of hosted deployment.

## Sequence and size

Five SWE contracts form 1 -> 2 -> 3 -> 4 -> 5. Current settings: max_live_runs_per_plan=1, max_plan_elapsed=6h, qa_mode=auto. The default one-hour estimate gives five hours for both the weighted sum and longest dependency path; actual admission uses the platform's measured role p50 where enough samples exist. If admission exceeds the cap, split at the accepted dependency boundary and file the remaining part using after_plan_id rather than parent_plan_id.

All tasks retain QA. Feature and deploy wiring are locally provable; only task 5 reaches external credential/configuration prerequisites. Task 4 first supplies the concrete workflow and runbook. The activation chore is raised at task 5's start only if needed, then its run ends with exact escalation ids. No time, soak, natural run or unanswered human preference proves a contract. Manual deploy dispatch and push deploy share the same job.

## Build contracts

The JSON below is the exact proposal payload's tasks array. Verification runs in the checkout at each delivery SHA, uses only local fixtures/processes, and never changes an external system. Every contract adds an explicit feature-specific verifier so pre-existing green commands cannot stand in for new behavior. SWE commits begin pm-257/<task_id>: and stop at the push; QA/acceptance own independent deployed proof.

### 1. Build bounded ghost rooms and Worker adapter

```json
{
  "sequence": 1,
  "title": "Build bounded ghost rooms and Worker adapter",
  "role": "software_engineer",
  "depends_on": [],
  "problem": "There is no anonymous visitor transport. The isolated palace needs a shared fan-out module with bounded cost and credential-free proof of the real Cloudflare adapter.",
  "action_items": [
    "Declare protocol and room interfaces in ghosts/ before implementing; add failing behavioral tests with an injected clock and id source. Share origin/room policy and the pure room state machine between the fake and Worker.",
    "Implement GET /ghosts?room=%2F or room=%2Fryugu upgrades only. Require an exact allowed Origin, reject missing/malformed/null origins and unknown rooms before allocating a DO, reject non-upgrade requests. Use a fresh crypto.randomUUID per connection, no client-supplied id. Cap each room at 24 sockets; full sends {t:'full'} and closes 1013.",
    "Accept only numeric coordinate move/click JSON, normalize finite coordinates to [0,1], drop malformed/oversize (>128 UTF-8 bytes)/binary frames, and close 1008 after five invalid frames. Apply a 15-token bucket refilling at 15 messages/s per connection, including invalid attempts; rate overflow drops without fan-out. Broadcast accepted events only to other members; send join/leave counts and bye, isolate the two rooms, and clean up close/error paths.",
    "Implement GhostRoom with SQLite namespace configuration, acceptWebSocket and hibernation handlers. Reconstruct members from getWebSockets and serializeAttachment metadata containing only id, rate tokens/time and invalid count; preserve caps and penalties across reconstruction. Never store coordinates/history in attachments or use storage, SQL, KV, alarms, visitor logs, cookies, IP/UA or identity. Disable Worker observability logs.",
    "Build a dependency-free local fake WebSocket server using the same room/policy code, bounded frame parsing, local-only reset/log/mode controls and capped ephemeral logs; record coordinates and header-presence booleans only in this test process. Support normal, refuse, full and flap modes, readiness and deterministic teardown.",
    "Create a separate locked ghosts/worker package (Wrangler, Workers types and test runtime as needed), pin compatibility date, add npm scripts typecheck, test:local and bundle:check. test:local executes the actual Worker and DO in Wrangler/Miniflare with real bindings and shared negative cases; simulate constructor re-entry with attachments in adapter tests without a timed soak. bundle:check compiles with wrangler deploy --dry-run into a temporary directory and asserts the expected bundle/export.",
    "Register new ghosts/*.test.ts and fake-server tests in the project suite; exclude only Worker-specific runtime files from the Next app tsconfig/eslint. Document architecture/privacy boundaries in ghosts/README.md and update a changelog.",
    "Expose a read-only /version response with the public Worker code+lock+configuration build fingerprint (no connection data); test that it contains no secrets. Ignore local .wrangler state, dependencies and bundles in the Worker package so they cannot enter git."
  ],
  "interfaces": [
    "ghosts/protocol.ts",
    "ghosts/room.ts",
    "ghosts/policy.ts",
    "ghosts/room.test.ts",
    "ghosts/protocol.test.ts",
    "ghosts/worker/",
    "ghosts/README.md",
    "scripts/ghosts-fake.mjs",
    "scripts/ghosts-fake.test.mjs",
    "package.json",
    "tsconfig.json",
    "eslint.config.mjs",
    "changelogs/"
  ],
  "non_goals": [
    "Visitor identity, presence history or analytics",
    "Hosted deployment or credentials",
    "Client rendering",
    "Arbitrary rooms, chat or horizontal fan-out"
  ],
  "acceptance_criteria": "Two credential-free clients in one room exchange bounded anonymous move/click events; different rooms cannot communicate. The fake and actual local Worker reject bad origins/frames, enforce room/rate caps and preserve limits after adapter reconstruction, with no visitor data storage or logs.",
  "verification": [
    {
      "name": "Protocol and room contract",
      "cwd": ".",
      "cmd": "node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'ghosts/*.test.ts'",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Fake WebSocket protocol",
      "cwd": ".",
      "cmd": "node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/ghosts-fake.test.mjs",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Locked Worker dependencies",
      "cwd": "ghosts/worker",
      "cmd": "npm ci",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Worker typecheck",
      "cwd": "ghosts/worker",
      "cmd": "npm run typecheck",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Actual local Worker contract",
      "cwd": "ghosts/worker",
      "cmd": "npm run test:local",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Worker dry-run bundle",
      "cwd": "ghosts/worker",
      "cmd": "npm run bundle:check",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Project tests",
      "cwd": ".",
      "cmd": "npm test",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Lint",
      "cwd": ".",
      "cmd": "npm run lint",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Production build",
      "cwd": ".",
      "cmd": "npm run build",
      "expect": "exit0",
      "timeout_s": 900
    }
  ]
}
```

### 2. Render dynamically loaded ink cursors and ripples

```json
{
  "sequence": 2,
  "title": "Render dynamically loaded ink cursors and ripples",
  "role": "software_engineer",
  "depends_on": [
    "1"
  ],
  "problem": "Home and Ryugu-jo have no ephemeral visitor layer or safe runtime switch, and their separate root layouts must remain isolated.",
  "action_items": [
    "Read the installed Next guides for connection(), route handlers and lazy loading. Add GET /api/ghosts with await connection(), runtime GHOSTS_ENDPOINT parsing and no-store responses: unset/malformed is 404; configured is {endpoint,rooms:['/','/ryugu']}. Allow wss for a dedicated cross-origin production Worker, ws only for localhost development; forbid credentials, fragments and unexpected base query parameters.",
    "Declare and test pure transport/render policy in ghosts/client.ts: normalized pointer coordinates, movement deadzone 0.002, at most one movement every 100ms, bounded remote map (24), 12 points per ghost, 700ms fading trails, six-second silent-tip expiry and resize/DPR cap 1.5. Defend against malformed server frames.",
    "Create neutral ghosts/loader.tsx as a client boundary using dynamic import with ssr:false after requestIdleCallback with cancellable timeout fallback. Both Home and the palace import this neutral boundary; mount it from pages, never the palace layout. Add inline-styled fixed pointer-events:none decorative canvas and subdued 'N here' only for other connected members.",
    "Render brush tips, trails and immediate local pointerdown ripples (also accept peer click events). Animate while visible and any drawable local ripple, remote ripple or fading trail exists; cease rAF when clear, and restart on events. Canvas must not intercept input, alter focus or announce high-frequency updates.",
    "Ship safe lifecycle from the first mount: reduced motion means no socket/drawing; hidden, offline or unmounted closes transport and cancels frames/timers/listeners; config 404 or full yields no drawing or error UI. On retryable failure allow three total attempts per mounted page session (immediate, +1s, +3s), then gone; full terminates immediately. Preference wiring follows in task 3.",
    "Expose data-ghosts-state=off|connecting|on|gone, data-ghosts=other-member-count and a cumulative data-ghosts-ripples draw counter that advances only when a ripple is actually drawn. Test route config via a pure helper and actual route wiring; register explicit test globs and preserve existing isolation, CSS and hydration tests."
  ],
  "interfaces": [
    "app/api/ghosts/route.ts",
    "ghosts/config.ts",
    "ghosts/config.test.ts",
    "ghosts/client.ts",
    "ghosts/client.test.ts",
    "ghosts/canvas.tsx",
    "ghosts/loader.tsx",
    "app/(site)/(home)/page.tsx",
    "app/(ryugu)/ryugu/page.tsx",
    "package.json",
    "changelogs/"
  ],
  "non_goals": [
    "Changing palace layout/CSS or static sea",
    "Other site rooms",
    "Pocket preference UI (task 3)",
    "Production activation"
  ],
  "acceptance_criteria": "Configured Home and /ryugu dynamically draw anonymous peer cursors, fading trails and click ripples without intercepting controls. An unset endpoint, reduced motion or lost connection leaves the page usable and quiet, and the palace isolation suite remains green.",
  "verification": [
    {
      "name": "Client and config behaviors",
      "cwd": ".",
      "cmd": "node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test ghosts/client.test.ts ghosts/config.test.ts",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Project tests",
      "cwd": ".",
      "cmd": "npm test",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Lint",
      "cwd": ".",
      "cmd": "npm run lint",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Production build",
      "cwd": ".",
      "cmd": "npm run build",
      "expect": "exit0",
      "timeout_s": 900
    }
  ]
}
```

### 3. Persist the Pocket hide preference and lifecycle controls

```json
{
  "sequence": 3,
  "title": "Persist the Pocket hide preference and lifecycle controls",
  "role": "software_engineer",
  "depends_on": [
    "2"
  ],
  "problem": "Visitors need a persistent, accessible way to suppress ghosts across Home, the palace and other open tabs, including when browser storage is unavailable.",
  "action_items": [
    "Add ghosts/pref.ts and pref-client.ts with pure parse/store tests and useSyncExternalStore subscription: localStorage key ghosts, value hidden suppresses the feature, missing/malformed means visible when configured, server snapshot stays hidden until hydration. Handle blocked storage with an in-memory preference and synchronize same-tab changes plus storage events across tabs.",
    "Fetch main before changing Pocket/route files and preserve any pm-271 sound/time-box additions. Add a menu-only Ghosts on/off chip beside the Dive link in components/handheld.tsx with data-pocket-ghosts and explicit aria-pressed semantics (pressed means ghosts enabled); keyboard/touch work without activating the game. Hide takes effect synchronously and reloading preserves it.",
    "Wire the preference into both neutral loaders before config fetch/socket creation; changing to hidden closes the socket, clears all remote/local visuals, and cancels rAF/retry timers. Cross-tab storage changes do the same in /ryugu even though Pocket lives on Home only.",
    "Complete and test dynamic reduced-motion changes, document visibility and offline/online lifecycle: zero sockets when reduced/hidden/offline, fresh anonymous connection when eligible again, no duplicate listeners or transports. The three-attempt budget lasts the mounted page session and toggles cannot reset an exhausted budget.",
    "Test storage corruption/denial, same-tab and cross-tab updates, cleanup, no frames or messages after opt-out, and retention of the site's other Pocket chips. Add focused component or browser coverage where pure tests cannot establish behavior."
  ],
  "interfaces": [
    "ghosts/pref.ts",
    "ghosts/pref.test.ts",
    "ghosts/pref-client.ts",
    "ghosts/loader.tsx",
    "ghosts/canvas.tsx",
    "ghosts/client.ts",
    "ghosts/client.test.ts",
    "components/handheld.tsx",
    "package.json",
    "changelogs/"
  ],
  "non_goals": [
    "Adding Pocket to Ryugu-jo",
    "Changing sound or time-box behavior",
    "Account-backed settings",
    "Production activation"
  ],
  "acceptance_criteria": "The accessible Home Pocket chip hides ghosts immediately and persists across reloads and same-origin tabs/routes. Reduced motion, hidden tabs and offline state stop transport and drawing; unsupported storage degrades without breaking the page.",
  "verification": [
    {
      "name": "Preference policy",
      "cwd": ".",
      "cmd": "node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test ghosts/pref.test.ts ghosts/client.test.ts",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Project tests",
      "cwd": ".",
      "cmd": "npm test",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Lint",
      "cwd": ".",
      "cmd": "npm run lint",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Production build",
      "cwd": ".",
      "cmd": "npm run build",
      "expect": "exit0",
      "timeout_s": 900
    }
  ]
}
```

### 4. Prove two-browser behavior and prepare deploy automation

```json
{
  "sequence": 4,
  "title": "Prove two-browser behavior and prepare deploy automation",
  "role": "software_engineer",
  "depends_on": [
    "3"
  ],
  "problem": "Local policy tests do not prove two real browsers, and an activation chore is not actionable until tested deploy automation and an operator runbook exist.",
  "action_items": [
    "Add e2e/ghosts.test.ts using Chrome and TMPDIR=/tmp with two independent browser contexts on Home and then /ryugu. Drive pointer/click paths now and prove peer-visible pixel/draw changes as well as state attributes, anonymous joins/leaves, room separation and movement <=10Hz with finite normalized coordinates from fake logs. Set an application auth cookie in a context and prove it is not sent to the dedicated cross-origin fake host; never log cookie values.",
    "Prove a lone visitor's click renders and fades; prove reduced-motion initial/change means zero upgrades/drawing, persisted hide/reload and same-context cross-tab storage propagation, hidden/offline cleanup, refused/full/flap bounded retries and eventual gone, and unset endpoint 404/off using a second local server or injected config response. Check no uncaught page errors and no application console spam; isolate expected browser-native failed-WebSocket diagnostics in intentional refusal cases.",
    "Use independent draw instrumentation or pixel sampling so changing only a data counter cannot pass visual proof. Add at least one negative control that disables real event delivery/rendering and demonstrates the corresponding assertion fails. Keep fake records bounded and reset between cases; fake probe endpoints never ship in the Worker.",
    "Extend scripts/e2e.mjs to start/clean the fake with the self-owned app server and provide a dedicated npm run test:ghosts selecting only e2e/ghosts.test.ts (do not append a glob to the existing test:e2e script). With BASE_URL externally owned require explicit fake configuration instead of silently rewriting a real environment.",
    "Wire CI to keep the fake alive with GHOSTS_ENDPOINT for next start through every later browser/footer probe, and extend scripts/ci-workflow.test.mjs for lifecycle and configuration. Exercise the full existing browser suite to find regressions.",
    "Add .github/workflows/ghosts.yml with workflow_dispatch and main path filters for shared ghosts code, Worker lock/config and the workflow; manual and push use one deploy job. Use locked npm ci, local Worker tests and dry-run before wrangler deploy; deployment is conditionally skipped until repository variable GHOSTS_DEPLOY_ENABLED=true. Secret names are CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID; use least privilege, no secret output, serialized deploy concurrency and no token on fork PRs.",
    "Add a fixture-based workflow test for disabled configuration, missing-secret failure when enabled, shared-code triggers, dispatch equivalence and locked commands; validate behavior without deploying. Document operator setup, read-only live proof and rollback by unsetting GHOSTS_ENDPOINT in README.md/.env.example and ghosts/README.md; no external credential/configuration dependency is reached in this task.",
    "Have the deploy job publish its exact Worker version id and code+lock+configuration fingerprint as public build metadata/artifacts and make /version agree; keep app SHA and Next BUILD_ID separately identifiable. Test the manifest contract with fixtures."
  ],
  "interfaces": [
    "e2e/ghosts.test.ts",
    "scripts/e2e.mjs",
    "scripts/probe-ghosts.mjs",
    "scripts/ci-workflow.test.mjs",
    "scripts/ghosts-workflow.test.mjs",
    ".github/workflows/ci.yml",
    ".github/workflows/ghosts.yml",
    "package.json",
    "README.md",
    ".env.example",
    "ghosts/README.md",
    "changelogs/"
  ],
  "non_goals": [
    "Provisioning credentials or activating production",
    "Passing live acceptance from a fake",
    "Changing unrelated browser expectations"
  ],
  "acceptance_criteria": "An on-demand credential-free test proves two-browser cursors, trails, ripples, room separation and all opt-out/failure controls. The full browser suite stays green with the fake alive. Deployment automation is independently fixture-tested, dispatchable and dark until explicitly enabled.",
  "verification": [
    {
      "name": "Workflow fixtures",
      "cwd": ".",
      "cmd": "node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/ghosts-workflow.test.mjs scripts/ci-workflow.test.mjs",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Project tests",
      "cwd": ".",
      "cmd": "npm test",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Lint",
      "cwd": ".",
      "cmd": "npm run lint",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Production build",
      "cwd": ".",
      "cmd": "npm run build",
      "expect": "exit0",
      "timeout_s": 900
    },
    {
      "name": "Two-browser ghost proof",
      "cwd": ".",
      "cmd": "TMPDIR=/tmp npm run test:ghosts",
      "expect": "exit0",
      "timeout_s": 900
    },
    {
      "name": "Existing browser regression suite",
      "cwd": ".",
      "cmd": "TMPDIR=/tmp npm run test:e2e",
      "expect": "exit0",
      "timeout_s": 900
    }
  ]
}
```

### 5. Prepare and record the production activation handoff

```json
{
  "sequence": 5,
  "title": "Prepare and record the production activation handoff",
  "role": "software_engineer",
  "depends_on": [
    "4"
  ],
  "problem": "Fake and local Worker proof cannot establish a configured production fan-out. The operator setup must be handled only now, with a concrete workflow ready and honest activation evidence.",
  "action_items": [
    "At task start inspect names/readiness of the Cloudflare repo secrets, GHOSTS_DEPLOY_ENABLED and Vercel GHOSTS_ENDPOINT without printing secret values. If an outside-platform credential/configuration chore is needed, immediately call plan_manager_ask_user(kind=operator_action,fingerprint='cloudflare-credentials:otohime-ghosts'): ask the operator to install the account id and least-privilege Worker/DO deploy API token as repo secrets, set ALLOWED_ORIGINS=https://otohime.dev in the Worker configuration, enable the delivered workflow, dispatch it once and set Vercel Production GHOSTS_ENDPOINT=wss://<dedicated-worker>.workers.dev/ghosts via a production configuration redeployment. Attach ready_probe={type:'http',url:'https://otohime.dev/api/ghosts',expect_status:200,body_contains:'wss://'}. Cite the already-pushed task-4 workflow/runbook, submit a short report with the returned escalation id and end this run; resume through the platform outcome, without polling.",
    "Once prerequisites are available, declare a read-only activation-evidence interface in scripts/lib/ghosts-activation.mjs. It classifies explicit disabled, missing configuration, failed deployment, identity mismatch and ready-for-live-QA states from injected HTTP/workflow metadata. Add fixture tests and a probe CLI that defaults to fixtures in verification; the live mode is read-only and owned by QA/acceptance.",
    "Use version metadata/bundle identity that task 4 records to correlate Worker code, Worker lock/config hashes, application code SHA and Next BUILD_ID; do not equate a config readiness 200 or an unrelated newer SHA with successful delivery. Keep only public build/config metadata in the handoff.",
    "Write a production activation handoff naming the actual workflow/DO deployment version ids and relevant executable fingerprint, or explicitly mark them unavailable and live execution unproven. Point QA to independent two-browser live checks and the bad-origin negative control. Record operator escalation outcome and rollback instructions; SWE delivery ends at its tested push."
  ],
  "interfaces": [
    "scripts/lib/ghosts-activation.mjs",
    "scripts/ghosts-activation.test.mjs",
    "scripts/probe-ghosts-activation.mjs",
    "ghosts/README.md",
    "projects/part-2-of-otohime-s-undersea-palace-pm-256-to-be-drafted-onl/activation.md",
    "package.json",
    "changelogs/"
  ],
  "non_goals": [
    "External mutation from verification commands",
    "Declaring product delivery from a readiness probe",
    "Waiting for operators, timers or runtime capacity",
    "Persisting visitor data or real event captures"
  ],
  "acceptance_criteria": "The activation evidence classifier and read-only probe are fixture-proven at the delivery SHA, and an actionable operator handoff names configuration/deployment identities or explicitly states live execution is unproven. Product delivery remains subject to independent real-browser QA and acceptance.",
  "verification": [
    {
      "name": "Activation evidence fixtures",
      "cwd": ".",
      "cmd": "node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/ghosts-activation.test.mjs",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Activation CLI fixture",
      "cwd": ".",
      "cmd": "node scripts/probe-ghosts-activation.mjs --fixture",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Project tests",
      "cwd": ".",
      "cmd": "npm test",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Lint",
      "cwd": ".",
      "cmd": "npm run lint",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Production build",
      "cwd": ".",
      "cmd": "npm run build",
      "expect": "exit0",
      "timeout_s": 900
    }
  ]
}
```

## QA and acceptance ownership

QA reads the delivered diff and independently instruments real browser behavior; merely rerunning supplied scripts is not independent evidence. Use a negative control such as denied Origin, deliberately disconnected fan-out, or disabling canvas drawing, and show that the relevant assertion detects it. Distinguish real Chrome plus a fake transport, the real adapter in local workerd, integration deployed, and product delivered.

Before activation, QA proves two independent browser contexts per room, cross-room isolation, local and remote ripples/trail decay, reduced-motion initial/change, same-context tabs for storage propagation, persistence across full navigation/reload, hidden/offline cleanup, bounded retries/full, and endpoint-unset behavior. Check pointer/keyboard controls remain usable and root styles do not leak. A data attribute alone cannot prove rendering.

After the operator outcome, QA/acceptance uses the real configured site and dedicated Worker in two browsers on each route. It independently reads application build/SHA and Worker version/fingerprint, moves and clicks now to see peer marks and decay, leaves to remove presence, exercises opt-out/reduced motion, and sends a raw upgrade with a denied Origin to observe rejection. Do not send synthetic frame floods to shared production; use the local Worker for caps/rate negative tests. A configuration 200 is only readiness, never live fan-out proof.

Reports include starting state, action, observable result and evidence; actual agent profile/model/effort; app SHA/BUILD_ID and Worker version/code+lock+config fingerprint; fake/real boundaries; negative control; defects; and any deferred check's exact escalation/deploy ids, owner and failure condition. Inspect bounded paginated FAILED and COMPLETED workflow/deploy attempts plus current attempts, including raw failure tails, and record counts and completeness. For this feature there is no product job queue or ingestion callback; do not invent one. Missing/truncated workflow history is inconclusive, and an observed deterministic executable defect is a failure even beside a pending replacement. Never save raw real-visitor frames.

Product acceptance cannot pass from the fake or a queued deploy. If operator setup is absent, task 5 owns the returned escalation and exits; if setup exists but live proof fails, report that defect for repair. Any platform pending/watch entry must name the exact missing evidence, owner, ids and failure condition; it does not waive broken code.

## Decisions and source handling

Recorded in Plan Manager during run-8946: restore rep-5228 verbatim because the prior pod's file is gone; read missing standing-rule sources from /data/build-worker/repo/mono-v2; choose five serial contracts against landed code; use neutral ghosts/ plus runtime endpoint; require actual local Worker proof; deliver deploy automation before raising the activation chore; clarify retry counting, local ripple scheduling and browser cookie limitations. The preserved research is historical input; these contracts resolve its ambiguities.

Planning role is Markdown-only. This run does not implement the feature, request credentials, claim an SWE/QA task, deploy, or assert any live execution. It tests the existing project before saving the plan. Planning profile observed in run-8946: codex-sol-6-1-high, gpt-6.1-sol, high effort (from the run flags).
