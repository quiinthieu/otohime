# Kame Fetch Recovery

Plan pm-259 · Revision 3 · Product owner run-9038 · 2026-10-26.
Planning base: `21a8f6edb7a3bed1ec1e505917a522df1f653468`.
Actual profile/model/effort: codex-sol-6-1-high / gpt-6.1-sol / high; fleet worker billie-mac.
Research [rep-5095](research.md) is already preserved verbatim. Previous revision is retained in Git history.

## Outcome and retained deliveries

Ship the already implemented Kame, peeling and safe fetch through the actual full CI and production path. Preserve existing code and tests; do not rebuild the toys. Original folding, basket physics, ironing and final performance composition become **Part 2: Crumple Paper Play**, filed with after_plan_id=pm-259 and drafted against this recovery after it lands.

| Work | Preserve | Evidence boundary |
| --- | --- | --- |
| Kame companion | dd21add9d4badb1af46a1f3affea59058d6418c2 and later fixes | Real local/native-input QA; do not recreate |
| Paper registry and corner peel | a46ad8e496467183a5ed938dc5100e563a0e330b and later fixes | Real local/native-input QA; do not recreate |
| Safe fetch, actual arrival/return and Peek/input fixes | Source in 17bca22d109414873c566d676f63696907c2f2d4 ancestry | Feature subset 28/28; independent live ancestor paths pass |
| Unit-environment and TAP diagnostic fixes | 17bca22 | Latest local repository suite 2320/2320 |
| Board tasks t-1572–t-1575 and t-1583 | Retain history and landed code | Superseded status does not mean code is missing |

The board currently has no done rows to replace. Add only the remaining recovery contracts and retain all completed implementation. Do not resurrect the old unfinished-feature descriptions that say fetch is absent.

## What changes after three failed fix cycles

The [latest QA](qa_report_t-1583_run-9033.md) and [fix plan](fix_plan_t-1583_run-9033.md) describe distinct problems:
- Exact delivery run 40345114517: checks job 121649860247 failed E2E against next start after unit/build/migration passed; production skipped.
- Run 40346324813 passed E2E but failed Footer walk, on another executable/configuration.
- Historical inspect job 121600218178 (run 40328273755, SHA 5577ec5) passed Vercel pull/build/migration, then failed Deploy and verify the served sha. Raw cause remains unread.
- Fresh live health still serves 074059495faf4bee48e8f655584dfd4487089b41; it does not contain delivery 17bca22.

Prior attempts proved a feature subset or repaired the unit gate before the next opaque failure. Replace that broad loop with three independent contracts:
1. **Diagnostic wiring** captures full E2E output, startup/pre-reporter failures and bounded public evidence while retaining failure status.
2. **Full browser repair** immediately reproduces all browser/footer/motion contracts, identifies the actual failing line and fixes only observed defects.
3. **Production adapter proof** retains existing deploy repairs, covers missing fail-closed diagnostics and records current executable identity.

All have depends_on=[]: a diagnostics-only task can itself remain red on the pre-existing E2E defect, so making repair depend on its green gate would deadlock. Max live runs=2 allows independent starts; nobody starts a runtime by hand. Task 1 owns ci.yml, task 2 browser/probe/application paths, task 3 deploy shell adapters. Reads across interfaces are allowed. Record a concrete named-source defect before expanding an interface.

pm-275/t-1617 is paused at drafting time. Task 3 reads its contract and reuses anything already landed, without waiting for that plan or duplicating its repairs. The three tasks share final acceptance but have separate local proof obligations. CI-only/internal tasks 1 and 3 use qa=skip; visible browser behavior task 2 requires independent QA.

## Product constraints

Preserve [tactile-contract.md](tactile-contract.md), [kame-contract.md](kame-contract.md) and [fetch-contract.md](fetch-contract.md). Opt-in project/note paper, footer chip wrappers and lazy sticker remain scoped; existing Kame public-route allowlist and protected/desk/stamp/form/canvas exclusions stay intact. Keep one gesture owner, stable ids, native anchors/selection/scroll, 44px deliberate grips and accessible deckled peel.

Kame retains slow edge swim, fixture-driven 45s nap, Call/K outside fields/dialogs, 500ms pet, sound-toggle-gated purr, guarded name/streak/dismissal storage and footer shell. Reduced motion stays asleep with accessible static controls and no animated fetch/follow. Save-Data defers optional renderers to explicit enable. Content, names, hrefs, text and geometry survive every action and cancellation. Preserve lifecycle/capture/modal/route teardown.

Retain load+idle dynamic boundaries, null interactive server render, existing stylesheet placement and no new LCP request. No new dependency, backend, binary asset, root layout or global event API. Read relevant installed Next docs before code; this PO read node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md after npm ci.

Standing rules stay in AGENTS.md and docs/claude/software-development.md. The requested extraction document and software-development.md are absent here; matching mono-v2 paths under /Users/avietidol/codes return Operation not permitted. The decision records this limitation without inventing rules or imposing a human gate.

## Prerequisites and scheduling

[prerequisites.json](prerequisites.json) is the exact platform.plan-prerequisites.v1 declaration: git host, Node22/Chrome/Postgres placement, GitHub Actions, Vercel and existing production Neon. Existing operator-owned accounts and allowances suffice; no new account/billing/runtime is requested. Provider secret names appear only as configuration references; no values or invented managed-secret keys are stored.

[prerequisite-probe.json](prerequisite-probe.json) preserves the final manifest_generation=3 probe:
- Git host missing: registered otohime has no ci_token for authenticated control-plane read.
- Runner unknown: accounts/rank adapter HTTP400, repo/provider required.
- GitHub/https/Neon service probes failed: service not allowlisted.

These results neither prove runner context nor establish a physical setup chore. This is legacy_v1/shadow admission, not a readiness waiver. A batched enforcement refusal would retain the declaration and end with a summary. Existing public CI plus repository-owned diagnostics avoid making authenticated historical log export a human prerequisite. A task that establishes an actually required person-only chore raises operator_action at its start, with exact action/fingerprint/readiness signal and no secret value, and reports the limitation rather than idling.

Settings: max_plan_elapsed=6h; max_live_runs_per_plan=2; qa_mode=auto. Three SWE contracts estimate at most 3h using fallback 1h/task (1.5h if interfaces count as entirely disjoint); the server's role p50 and overlap calculation are authoritative. No dependencies on another plan or calendar. Task commands prove claims now with local fixtures or production execution; no soak, natural-run criterion or polling task step.

## Evidence and proof boundaries

Fresh [planning-ci-evidence.json](planning-ci-evidence.json) reads two FAILED pages (40/103), two COMPLETED pages (40/442), current in-progress (1/1), queued (0/0). Filters overlap; older pages unread, so history completeness is inconclusive. Job metadata is now readable; raw E2E/historical deploy log endpoints return 403. Do not repeat the older blanket API-403 claim. Python CA lookup failed locally; verified system curl succeeded without disabling TLS verification.

This PO ran npm ci and npm test: 2320 passed, zero failed/skipped. It changed planning artifacts only and makes no new browser/deployment success claim. There is no async feature executable, model, callback or ingestion job. Real browser construction requires production Next, locked Chrome and migrated Postgres; shell npx/health fixtures prove only adapter policy. CI and independent live observation alone prove delivery.

Nearest deliverable when historical authenticated logs cannot be read: reproducible repository controls and actionable current diagnostic output. This is not product delivery. Historical root cause may remain explicitly unknown, while successful current checks+production and served ancestry remain required. No pending replacement erases a known repeated defect.

## Independent acceptance and deferred ownership

Engineering finishes at tested commit/push. Platform drives normal main CI or existing workflow_dispatch for a replaced code run; report-only PO pushes are intentionally ignored. No empty code change is needed.

Acceptance independently obtains:
1. Successful checks **and** production for one current main executable containing 17bca22 and all replacement code. Red, skipped, cancelled or unrelated green jobs fail. Report-only descendants require full relevant executable/config/lock equivalence and ancestry.
2. A one-shot /api/health read, fetch of the served commit if absent, and git merge-base ancestry for feature plus recovery code. Preserve exact build/chunk/source/config hashes. Existing report-only exceptions cannot conceal an undeployed code change. Stale health is a rejection control.
3. /projects and /notes keyboard Fetch back, continuous real pointer approach/drag past Peek, CDP touch grip versus body scroll, actual turtle/proxy arrival-return rectangles, peel/reset and intact source names/text/hrefs/geometry. Native link navigation remains normal. Repeat reduced motion (zero animated fetch proxies), Save-Data, blocked storage, dismissal and route/capture cancellation.
4. Entire serial browser, both footer probes and signed-in motion results; independent observations outside supplied proof scripts. Controls include pre-test crash, deliberately immobilized turtle, and failed inspect despite matching health/off-branch SHA.
5. Historical inspect cause when accessible. If unread, retain job 121600218178 as cause unknown and require a current complete production success plus live ancestry at the repaired fingerprint. A repeated inspect failure stays a defect.

Deferred owners: platform green gate owns exact replacement-delivery CI; QA owns independent served behavior/negative controls; acceptance owns production+ancestry and the historical inspect record. Failure conditions: red/skipped production or checks, missing feature/recovery ancestry, content/input/geometry regression or repeated deploy error. Required product delivery stays pending until observed; no waiting or timer proves it.

## Part 2: Crumple Paper Play

File after_plan_id=pm-259; draft only against landed recovery. Preserve original scope:
- Seeded Canvas2D mesh/ink creases (~400ms), 600ms hold cancelled by >8px movement, keyboard Crumple/Read/Reset. Original DOM and reserved box remain accessible; restore paint before link focus. No visibility:hidden/display:none/inert/aria-hidden on content. Lazy Canvas only on action and immediate recovery on renderer failure.
- Fixed-step gravity/restitution/friction/rim physics, injected clock/seed, max eight balls, DPR2, bounded flight, sleep at rest, pointer toss and keyboard Toss to basket. Deterministic fixtures prove settling without elapsed external time.
- Footer SVG basket, per-card Reset/global Iron flat with optional ironing sweep, route/lifecycle recovery, instant reduced-motion paths; keep Kame identity separate from paper state.
- Actual emitted chunk attribution/gzip: combined bootstrap <=2KiB, Kame <15KiB, combined paper <20KiB, new shared code counted once. No interactive toy server markup or critical preload; demonstrate absence before load/idle/action and presence after explicit release.
- Five paired desktop/mobile cold navigations with identical CPU/network, only toy chunks blocked in control: median LCP delta <=max(100ms,5%), toy never final LCP; toy CLS <=0.001 and source rectangles <=1px. Intentional eager-request/budget-breach controls and full serial browser/footer/motion tests.

These are future deliverables, not existing implementation claims. That PO makes admitted contracts using current role durations and actual landed interfaces.

## Exact replacement build contracts

New test/helper files named below are implementation obligations; missing/zero/skipped tests fail. Verification runs inside the checkout and does not mutate shared infrastructure.

```json
[
  {
    "sequence": 1,
    "title": "Expose complete failing browser gate diagnostics",
    "role": "software_engineer",
    "depends_on": [],
    "qa": "skip",
    "problem": "checks job 121649860247 failed before useful public E2E output; per-assertion reporters alone do not expose pre-test crashes and restricted logs make repeated repairs speculative.",
    "action_items": [
      "At start, read AGENTS.md and the installed relevant Next guides, inspect fresh main and preserve all landed Kame/peel/fetch fixes. Raise any genuinely required person-only sign-in/setup immediately via plan_manager_ask_user(kind=operator_action, stable fingerprint, exact action/readiness signal); otherwise use the repository-owned diagnostic path and existing platform placement without a human gate.",
      "Capture full npm run test:e2e combined output at the CI E2E step with pipefail and tee; preserve its exact exit status. Add a repository helper for bounded escaped failure tails, commit/build/Node/Chrome identity and next-start tail in a public annotation and step summary, including pre-test startup failures. Retain existing per-assertion annotations and gate ordering.",
      "Write tests using real subprocess stdout/stderr and failing/successful fixture commands: annotated assertion, pre-test crash without reporter output, startup failure, missing/empty file, successful run, percent/CR/LF/ANSI/Markdown escaping and original nonzero exit propagation. Never emit environment dumps or secret values. Include workflow wiring coverage without copying implementation assertions.",
      "Apply the same bounded fallback mechanism to signed-in motion/footer steps where their existing output is opaque, without changing probe behavior, budgets, dependencies, concurrency or production conditions. This task owns CI wiring; browser repair and deploy adapter tasks do not edit ci.yml.",
      "Install the unchanged npm lock on Node 22. Record relevant code/lock/config hashes, actual tool versions, real versus fake boundaries, negative controls, unread evidence and deferred owners. Commit with pm-259/<assigned-task-id>: and push origin HEAD; engineering stops at the push. Never weaken checks, discard unrelated fixes or force-push."
    ],
    "interfaces": [
      ".github/workflows/ci.yml",
      "scripts/browser-gate-diagnostics.mjs",
      "lib/browser-gate-diagnostics.test.ts",
      "scripts/e2e-annotate.mjs",
      "lib/e2e-annotate.test.ts",
      "scripts/ci-workflow.test.mjs"
    ],
    "non_goals": [
      "changing fetch behavior or browser assertions",
      "changing workflow budgets/concurrency or deployment policy",
      "proving live feature delivery from a fixture"
    ],
    "acceptance_criteria": "Every failing E2E/motion/footer command exposes a bounded actionable tail and executable identity even before a reporter starts, while keeping its original red status. Success produces no failure annotation. Escaping/empty-output/startup negative controls and workflow wiring tests pass.",
    "verification": [
      {
        "name": "real subprocess diagnostic controls",
        "cwd": ".",
        "cmd": "node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/browser-gate-diagnostics.test.ts lib/e2e-annotate.test.ts scripts/ci-workflow.test.mjs",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "repository suite",
        "cwd": ".",
        "cmd": "npm test",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "lint and type contracts",
        "cwd": ".",
        "cmd": "npm run lint && npm run typecheck",
        "expect": "exit0",
        "timeout_s": 300
      }
    ]
  },
  {
    "sequence": 2,
    "title": "Repair the complete production browser contract",
    "role": "software_engineer",
    "depends_on": [],
    "qa": "required",
    "problem": "The prior task repeatedly proved only 28 feature tests while the actual full CI suite or Footer walk stayed red on a different step. Feature geometry is landed; the failing full composition must be reproduced without guessing its assertion.",
    "action_items": [
      "At start, read AGENTS.md and the installed relevant Next guides, inspect fresh main and preserve all landed Kame/peel/fetch fixes. Raise any genuinely required person-only sign-in/setup immediately via plan_manager_ask_user(kind=operator_action, stable fingerprint, exact action/readiness signal); otherwise use the repository-owned diagnostic path and existing platform placement without a human gate.",
      "Begin immediately with the full serial production browser suite under CI=true, short TMPDIR=/tmp, actual locked Chrome, migrated PostgreSQL and GITHUB_SHA=HEAD; then run both footer probes and signed-in motion against isolated local production. Do not depend on task 1 becoming green or on pm-275 landing; diagnostics can be incorporated normally when present.",
      "Read available raw output for jobs 121649860247 and the newer Footer walk failure 40346324813; if inaccessible, use the local full reproduction and the new current CI annotation, citing which evidence is unavailable. Identify each failing test/runner line before changing it. Retain application behavior and fix the smallest observed assertion, runner or source defect; extend interfaces only to the specifically named failing repository path and record that judgement.",
      "Preserve actual rendered turtle/proxy arrival-return geometry, continuous native mouse approach past Peek, CDP touch grip versus card scrolling, exact-once click suppression and native navigation. Keep original source DOM/hrefs/text/geometry, reduced motion, Save-Data, dismissal, modal/route/capture cancellation, Kame/peel foundation and desk/stamp exclusions. Preserve sound-off and keyboard controls.",
      "Add a focused regression and relevant intentional failure control for each observed defect. An assertion may change only to measure the intended behavior more accurately (for example RisoText accessible-name semantics); do not skip/quarantine, lower geometry floors, add arbitrary delays or replace full-suite proof with the 28-test subset. Missing/zero/skipped tests cannot pass.",
      "Record local build ID, native dependency construction and full-suite results in browser-recovery-evidence.md. Distinguish local execution from deployment; CI and independent live QA belong to the platform. If all current contracts already pass, preserve them and add the missing full-composition regression/evidence rather than rewriting fetch.",
      "Install the unchanged npm lock on Node 22. Record relevant code/lock/config hashes, actual tool versions, real versus fake boundaries, negative controls, unread evidence and deferred owners. Commit with pm-259/<assigned-task-id>: and push origin HEAD; engineering stops at the push. Never weaken checks, discard unrelated fixes or force-push."
    ],
    "interfaces": [
      "e2e/",
      "scripts/e2e.mjs",
      "scripts/e2e-gesture-trace.ts",
      "scripts/e2e-gesture-trace.test.ts",
      "scripts/walk-end.sh",
      "scripts/probe-end.sh",
      "scripts/probe-end.mjs",
      "scripts/probe-motion-signed-in.sh",
      "scripts/probe-motion-signed-in.mjs",
      "lib/end.test.ts",
      "components/tactile/",
      "components/kame/",
      "components/peek-layer.tsx",
      "app/(site)/tactile.css",
      "app/(site)/kame.css",
      "projects/kame-crumple-two-tactile-paper-and-ink-toys-for-otohime-dev/browser-recovery-evidence.md"
    ],
    "non_goals": [
      "new crumple/basket features or widening eligible routes",
      "CI wiring or Vercel adapter changes owned by tasks 1 and 3",
      "waiting for another plan, deployment or natural event"
    ],
    "acceptance_criteria": "The entire production browser suite, both footer probes, signed-in motion, 21 foundation tests, repository suite and lint/typecheck pass on the delivered checkout with no skipped browser tests. Actual geometry/native-input and one defect-specific negative control are observed; original content and accessibility survive interactions. Live delivery is separately required by plan acceptance.",
    "verification": [
      {
        "name": "foundation policy",
        "cwd": ".",
        "cmd": "node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/kame.test.ts lib/tactile.test.ts lib/tear.test.ts",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "repository suite under CI",
        "cwd": ".",
        "cmd": "CI=true npm test",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "lint and type contracts",
        "cwd": ".",
        "cmd": "npm run lint && npm run typecheck",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "entire isolated production browser suite",
        "cwd": ".",
        "cmd": "env -u BASE_URL -u SKIP_BUILD CI=true TMPDIR=/tmp GITHUB_SHA=$(git rev-parse HEAD) npm run test:e2e",
        "expect": "exit0",
        "timeout_s": 1800
      },
      {
        "name": "isolated footer walk",
        "cwd": ".",
        "cmd": "env -u BASE_URL -u DATABASE_URL -u EXPECT_SHA CI=true TMPDIR=/tmp GITHUB_SHA=$(git rev-parse HEAD) bash scripts/walk-end.sh",
        "expect": "exit0",
        "timeout_s": 900
      },
      {
        "name": "isolated footer Chrome probe",
        "cwd": ".",
        "cmd": "env -u BASE_URL -u DATABASE_URL -u EXPECT_SHA CI=true TMPDIR=/tmp GITHUB_SHA=$(git rev-parse HEAD) bash scripts/probe-end.sh",
        "expect": "exit0",
        "timeout_s": 900
      },
      {
        "name": "isolated signed-in motion",
        "cwd": ".",
        "cmd": "env -u BASE_URL -u DATABASE_URL CI=true TMPDIR=/tmp GITHUB_SHA=$(git rev-parse HEAD) bash scripts/probe-motion-signed-in.sh",
        "expect": "exit0",
        "timeout_s": 900
      }
    ]
  },
  {
    "sequence": 3,
    "title": "Prove fail-closed production deployment diagnostics",
    "role": "software_engineer",
    "depends_on": [],
    "qa": "skip",
    "problem": "Historical Vercel inspect job 121600218178 remains unread and live serves 0740594; a local fetch pass or pending deployment does not prove the repaired executable was delivered.",
    "action_items": [
      "At start, read AGENTS.md and the installed relevant Next guides, inspect fresh main and preserve all landed Kame/peel/fetch fixes. Raise any genuinely required person-only sign-in/setup immediately via plan_manager_ask_user(kind=operator_action, stable fingerprint, exact action/readiness signal); otherwise use the repository-owned diagnostic path and existing platform placement without a human gate.",
      "Inspect fresh main and read pm-275/t-1617 plus pm-270's landed deployment policy. pm-275 is paused at planning time, so do not wait for it or duplicate an already landed fix: retain its source and add only missing production diagnostic/regression proof. This task owns scripts/vercel-deploy* and scripts/verify-deploy.sh; task 1 owns CI wiring.",
      "Inspect bounded FAILED and COMPLETED CI history plus current jobs; request raw historical inspect failure 121600218178 and the last green production job 121590440426, comparing executable/lock/workflow fingerprints. Preserve HTTP status and history completeness. If the raw historical cause remains inaccessible, state it as unknown; prove current failure diagnostics using fixtures rather than inventing a Vercel error cause.",
      "Extend subprocess tests only for uncovered behavior: inspect stderr/state reread/readyStateReason retained with exit codes, generic Error text distinct from a labelled failed state, bounded upload/inspect timeouts, red checks cannot reach production, failed inspect cannot be rescued by matching health, stale/off-branch executable rejected. Correct a concrete adapter defect if reproduced. Preserve real status propagation, existing bounds and main-only checks-before-production policy; no remote deploy from a verification command.",
      "Run the actual pinned-major Vercel CLI command used by CI in help mode to preflight flag/import construction, record exact resolved version and CI configuration hash. Fake npx/health tests prove adapter policy only; authenticated deploy/inspection, production database migrations and served identity remain CI/acceptance obligations. Do not use login as a prerequisite for repository-only tests.",
      "Document a one-shot read-only acceptance procedure using GitHub jobs and /api/health plus git ancestry for 17bca22 and all three replacement deliveries. It must reject red/skipped production, an unrelated green SHA or stale live source. Engineering ends at push; platform CI runs existing main production path or on-demand workflow_dispatch when a code run was replaced. Required live output stays unproven until observed.",
      "Install the unchanged npm lock on Node 22. Record relevant code/lock/config hashes, actual tool versions, real versus fake boundaries, negative controls, unread evidence and deferred owners. Commit with pm-259/<assigned-task-id>: and push origin HEAD; engineering stops at the push. Never weaken checks, discard unrelated fixes or force-push."
    ],
    "interfaces": [
      "scripts/vercel-deploy.sh",
      "scripts/vercel-deploy.test.sh",
      "scripts/verify-deploy.sh",
      "projects/kame-crumple-two-tactile-paper-and-ink-toys-for-otohime-dev/delivery-recovery-evidence.md"
    ],
    "non_goals": [
      "changing provider secrets, accounts, billing, production schema or infrastructure",
      "CI workflow wiring or browser-feature repair",
      "claiming authenticated production success from fake adapters or a health response alone"
    ],
    "acceptance_criteria": "Local shell controls prove bounded actionable diagnostics and fail-closed inspect/health/ancestry policy, with current real CLI construction and source identity documented. Unread historical logs remain explicitly inconclusive. CI production success and live ancestry are independent plan acceptance obligations, never inferred from the fake fixtures.",
    "verification": [
      {
        "name": "deployment adapter positive and negative controls",
        "cwd": ".",
        "cmd": "bash scripts/vercel-deploy.test.sh",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "served ancestry rejection controls",
        "cwd": ".",
        "cmd": "bash scripts/verify-deploy.sh --self-test",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "repository suite",
        "cwd": ".",
        "cmd": "npm test",
        "expect": "exit0",
        "timeout_s": 300
      },
      {
        "name": "shell syntax",
        "cwd": ".",
        "cmd": "bash -n scripts/vercel-deploy.sh scripts/vercel-deploy.test.sh scripts/verify-deploy.sh",
        "expect": "exit0",
        "timeout_s": 60
      }
    ]
  }
]
```
