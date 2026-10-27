# QA Report: `pm-268` / `t-1679` — Open the public Ink Lab proof sheet (`run-9274`)

- **Plan ID**: `pm-268` (Riso Ink Studio)
- **Task ID**: `t-1679` (Open the public Ink Lab proof sheet)
- **QA Run ID**: `run-9274` (`tm_task_id: a65ba7c3-e214-44fb-83cf-512c8f5a8742`)
- **QA Agent Runtime & Profile**: `role=quality_engineer`, `profile_id=agy-argon-high`, model `Gemini 4 Argon (High)`, `effort=high`, `account_id=billie-agy`, `worker_id=avietidol-z490`, `runner=fleet`
- **SWE Delivery Run**: `run-9271` (`tm_task_id: 5eb43968-8e51-4cc1-abc1-40327f0cc989`, `profile_id=codex-sol-6-1-high`, model `gpt-6.1-sol`, `effort=high`, `account_id=codex-main`, `worker_id=avietidol-z490`) following `run-9270` (`07fae291-16bf-4f67-b26d-6fe9294a12cb`, same `codex-sol-6-1-high` profile) and `run-9267` (`e726e7c6-c939-4c35-9714-497b10953cd6`, `codex-sol-6-1-high` on `avietidol-mac-mini`)
- **Delivery Commit SHA**: `139f7054e040558b7bb9078f6d4e73e245dc5fd1` (`139f705`, `pm-268/t-1679: docs(lab): record verified rescue delivery`), directly atop `8ca0de3f7f81e8f0d79e31d43c477966553845eb` (`pm-268/t-1679: fix(lab): render previews before the frame paints`) and `9cc593e9d0c99e9f7f06ae293edfbaba8bbabbff` (`pm-268/t-1679: feat(lab): open the public Ink Lab proof sheet`)
- **Cited Deployed SHA**: `139f7054e040558b7bb9078f6d4e73e245dc5fd1` (`git merge-base --is-ancestor 139f7054e040558b7bb9078f6d4e73e245dc5fd1 139f7054e040558b7bb9078f6d4e73e245dc5fd1` exits `0`)
- **Green Gate Verification**: `ver-3685` (`run-9273`, `tm_task_id: d098995f-517c-4242-b348-ba79eba0a430`, template `verify-runner`, agent `shell`, worker `avietidol-z490`, `git_sha: 139f705`, `status: pass`, all 5 contract checks exit `0`)
- **Verdict**: **`pass`**

---

## 1. Four-Stage Delivery Classification

| Stage | Status | Evidence |
| --- | --- | --- |
| **1. Integration deployed** | **Proven** | Delivery commit `139f7054e040558b7bb9078f6d4e73e245dc5fd1` (containing `8ca0de3f7f81e8f0d79e31d43c477966553845eb` and `9cc593e9d0c99e9f7f06ae293edfbaba8bbabbff`) is pushed on `origin/main` and `origin/pm-268-t-1679-delivery-run-9271`, built by Next.js `16.4.2` in CI (`#528` `40564127414` and `#529` `40567397034`), and served at `https://otohime.dev/lab` and `https://otohime.dev/api/health`. |
| **2. Waiting for capacity** | **None (`0` pending / `0` deferred)** | Task-manager global `PENDING` queue has `0` tasks (`total: 0`). All local, green-gate (`ver-3685`), and CI (`#528`/`#529`) executions ran on active capacity (`avietidol-z490`, `avietidol-mac-mini`, and GitHub Actions `ubuntu-latest`). |
| **3. Execution demonstrated** | **Proven** | Real module/runtime preflight in the locked Node `v24.14.1` / `package-lock.json` environment (`sha256: 9d0bded9...`), all 5 declared verification gates (`53/53` contract unit tests, `typecheck`, `lint`, `2,575/2,575` unit tests, `10/10` real-browser E2E tests in `e2e/ink-lab.test.ts`), `35/35` surrounding E2E tests (`print-runs`, `print-run-console`, `riso-headings`, `kame`), `3/3` independent QA browser probes with 3 negative controls, and live `https://otohime.dev/lab` verification. |
| **4. Product delivered** | **Proven** | Public `/lab` route renders the server-first Ink Lab heading (`<h1>Ink Lab</h1>`) and `role="status"` fallback before hydration, upgrades into the interactive two-group proof sheet (`01 / Ink & motion`, `02 / Paper & plates`, and `OTOHIME / LIVE MATERIAL PROOF`), isolates live preview updates inside `.lab-preview` with `flushSync` inside a single `requestAnimationFrame` (`14.40ms`–`17.90ms <= 100ms`, `renderedBeforePaint: true`), canonicalizes `?v=1&...` URLs via `history.replaceState` while preserving `#hash`, copies/falls back on `Share`, applies session-wide overrides across all 14 root `<html>` layouts with `Apply to whole site`, resets cleanly with `Reset to house style`, and exposes navigation in desktop/mobile nav, footer `Materials`, and terminal (`go lab`, `open lab`, `cd lab`, `ls`) while keeping physical `CONSOLE_MENU` at 7 items. |

---

## 2. Commit Identity, `author.txt` Artifact, and Git Topology

- **`plan.commit_identity` Requirement**: `Otohime <quiinthieu@gmail.com>` with `commit_attribution: "none"` (no `Co-Authored-By` trailer).
- **SWE Delivery Artifact (`author.txt`)**: Retrieved from `task_manager_get_task("5eb43968-8e51-4cc1-abc1-40327f0cc989")` (`run-9271`):
  - Artifact `author.txt`: `size: 44` bytes, `sha256: 7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`
  - Payload: `git_author_name: "Otohime"`, `git_author_email: "quiinthieu@gmail.com"`, `commit_attribution: "none"`
- **Git Commit Chain Inspection (`git log -n 4 --format="%H|%P|%an <%ae>|%cn <%ce>|%s"` & Trailer Check)**:
  1. `139f7054e040558b7bb9078f6d4e73e245dc5fd1` (parent `8ca0de3f7f81e8f0d79e31d43c477966553845eb`): Author & Committer `Otohime <quiinthieu@gmail.com>`, subject `pm-268/t-1679: docs(lab): record verified rescue delivery`, single parent, `0` `Co-Authored-By` trailers.
  2. `8ca0de3f7f81e8f0d79e31d43c477966553845eb` (parent `9cc593e9d0c99e9f7f06ae293edfbaba8bbabbff`): Author & Committer `Otohime <quiinthieu@gmail.com>`, subject `pm-268/t-1679: fix(lab): render previews before the frame paints`, single parent, `0` `Co-Authored-By` trailers.
  3. `9cc593e9d0c99e9f7f06ae293edfbaba8bbabbff` (parent `400034a28715aa43bc1346f1ba917371df1a909e`): Author & Committer `Otohime <quiinthieu@gmail.com>`, subject `pm-268/t-1679: feat(lab): open the public Ink Lab proof sheet`, single parent, `0` `Co-Authored-By` trailers.
- **Strict History Check**:
  - `npm run history:index -- --strict --rev=139f7054e040558b7bb9078f6d4e73e245dc5fd1` -> **PASS (`0`, indexed `200` of `673` commits)**.
  - Local Git author check: `bash scripts/setup-owner-git.sh --check` -> `Effective commit author: Otohime <quiinthieu@gmail.com>`.

---

## 3. Executable Fingerprint & Locked Environment Verification

### 3.1 Runtime & Locked Package Versions
- **OS / Kernel**: Linux `6.8.0-106-generic` (`x86_64`) on worker `avietidol-z490`
- **Node / npm**: Node `v24.14.1`, npm `11.11.0` (`npm ci` installed `522` locked packages in `7s`, exit `0`)
- **Real Dependency Imports & Adapter Construction Preflight**:
  - `next@16.4.2`, `react@19.3.0`, `react-dom@19.3.0`, `playwright-core@1.64.0` (launching real system Google Chrome via `channel: "chrome"`), `embedded-postgres@17.10.0-beta.17`
  - Direct module execution of `./lib/ink-lab.ts`, `./lib/appearance-client.ts`, `./lib/pages.ts`, and `./lib/terminal.ts` verified in Node `v24.14.1`: `encodeLab(labDefaults("house")) === "v=1&r=house&t=0.035&d=3.5&w=0&g=0.06&p=231e16%2Cf3a6bb%2C93d3b0&n=3&m=420&h=ink&o=0"`, `CONSOLE_MENU.length === 7`, `PUBLIC_PAGES` includes `{ href: "/lab", label: "Ink Lab" }`, and `run("go lab", ...)` returns `{ kind: "go", href: "/lab" }`.
- **Production Build Identity**: `.next/BUILD_ID = Dc3AhmDpFtOJOJmt7xOvR3s` (`Dc3AhmDpFtOJmt7xOvR3s`), compiled cleanly by `next build` with `/lab` rendered in the `(site)/(app)` route group.

### 3.2 21-File SHA-256 Fingerprint Manifest (at `139f7054e040558b7bb9078f6d4e73e245dc5fd1`)

| File | SHA-256 | Role in `t-1679` |
| --- | --- | --- |
| `package.json` | `e77f344d3388b7ea988ff6dadfafd873a8dd6baf7f64139f84e0be4b31038d92` | Project manifest & scripts |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` | Locked dependency graph |
| `next.config.ts` | `e2ab6eeb96755f02796a76a876f4d617db0d9d4b9cf8124156cd7e08814ab83e` | Next.js 16.4.2 configuration |
| `app/(site)/(app)/lab/page.tsx` | `e03438bc8ea00d91888d9b8836fb8511817ff20487c47f98721d66962a94afc8` | Public `/lab` server page + `<Suspense>` fallback (`role="status"`) |
| `components/ink-lab.tsx` | `32fc1e9bb6357862c2806a90c1889dba9658ded8ce94fdeed0e4010cdefe4865` | Interactive `InkLab` client workbench (`flushSync` inside single `rAF`) |
| `components/ink-lab-preview.tsx` | `6171f8242da01784e880a47bacf83811ac4ecdcf796bd453b1ff10427ee3882c` | Scoped `.lab-preview` stage (`#ink-lab-preview-filter`, RisoHeading, card, linework, `.btn`) |
| `components/ink-lab.css` | `c9306e1475a2ea75322c4750fa2f1c68a20010da50c0c7ab8b2e7b96b11ad9ef` | `@container (min-width: 760px)` layout, `.lab-preview`, `forced-colors`, `prefers-reduced-motion` |
| `components/appearance-boot.tsx` | `3ee562aa3436e3937f93da3815ed79214b42726ad014cd50ce6299dc9ccb90a2` | Pre-paint inline appearance boot script mounted across all 14 root layouts |
| `components/appearance-runtime.tsx` | `21caecdae9549c9976e1b78d882f5f6eec3218f077650c62a2aa05ed3eed2ec2` | Document-level SVG filter / wobble runtime (`#ink-boil`, `#ink-heavy`, `#pencil`, `#watercolour`) |
| `components/appearance.css` | `b0e3a8fd15cde30834beeabd65eed2dacd786ddc54c7248cc0b11ffbf0fbeb4d` | Root `--ap-*` token cascade & halftone overlay |
| `components/riso-heading.tsx` | `a725d673449386c6ebe8899c0898ae659bda20a11af662b9ed7a5432ab4912e5` | Risograph plate heading component used in preview and site |
| `components/riso-heading.css` | `fd64c5d5386762695074995bf4a66c8a9ec50e784120276da223439f3edad1cd` | Plate misregistration & reduced-motion styles |
| `lib/ink-lab.ts` | `c033fea2046b2bc96c1d564461260141cf1fdeff28d4fad5957849b100bfd1b1` | `v=1` codec (`encodeLab`, `decodeLab`, `clampLab`, `labCssVariables`, `readStoredLab`) |
| `lib/ink-lab.test.ts` | `6facaeb17d8c926255441b5747fe5bd82b3d4c9888a5bea0f96f7dc7ba043768` | Pure codec & storage unit tests |
| `lib/print-runs.ts` | `1babe0e53b4f30aac9b48da9c0b3fc2a7de4cbd1ddbb426ff666d3e7aefdaf4b` | Print-run presets (`house`, `sumi`, `riso`, `indigo`) |
| `lib/print-runs.test.ts` | `2c53ff24dbf1b8c751f016c3994f7a2bcf5e26dc64ff1e46b8a10a469d80ff1a` | Print-run unit tests |
| `lib/appearance-client.ts` | `1cd21cf954f9e0ac07f7f363ef4c85d8f3d1315a4f60f2193064e07b86517d38` | `applyAppearanceDocument`, `writeLabSession`, `clearLabSession`, `writePrintRun` |
| `lib/pages.ts` | `6ace6b9c38943f5d69d356c0e0dbb800edcfc3cd5987ffb174295a143ca4c0ca` | `PUBLIC_PAGES` (`Fig. 08 / Ink Lab`) vs `CONSOLE_MENU` (7 items) |
| `lib/pages.test.ts` | `ec0417cfd2a2e329e7613684038841cecd6c20559594c91701951e87f4145204` | Page registry contract unit tests |
| `lib/terminal.ts` | `5651d9c2f804d1dc31cba6a51de0ae2a1cc1ae4ec38b03abe24e233d42c318a4` | Terminal `PLACES` + `go lab`, `open lab`, `cd lab`, `ls` |
| `lib/terminal.test.ts` | `4a76f51d753351694dac6efb830b2344ed08d2836655eb0da2ce713b83c66a6a` | Terminal command routing unit tests |
| `e2e/ink-lab.test.ts` | `2cd0f41b331b3b46aa24f588d51d887d24bb13b8e6dd674815a3669ebe91aabd` | Real-browser Playwright E2E suite for `/lab` (`10` subtests) |

### 3.3 Real vs. Fake / Failure-Injection Boundaries

| Boundary | Mode | Details |
| --- | --- | --- |
| Next.js `16.4.2` server & App Router (`next build` + `next start`) | **Real** | Production server started via `scripts/e2e.mjs` against real compiled `.next` output (`BUILD_ID = Dc3AhmDpFtOJmt7xOvR3s`). |
| PostgreSQL database (`embedded-postgres@17.10.0-beta.17` + `drizzle-kit migrate`) | **Real** | Ephemeral local Postgres instance started and migrated per E2E run (`127.0.0.1:41939` / `36461` / `34021`). |
| Browser engine (`playwright-core@1.64.0` `channel: "chrome"`) | **Real** | Real headless Google Chrome executing DOM layout, `@container` queries, SVG `<filter>` primitives, `IntersectionObserver`, `requestAnimationFrame`, `sessionStorage`, and `localStorage`. |
| Browser failure-injection ports (`Storage.prototype.setItem`, `navigator.clipboard.writeText`, `document.hidden`) | **Injected at browser API port** | Exercised in both `e2e/ink-lab.test.ts` and independent QA Negative Control C to verify graceful degradation when browser permissions/storage are denied or tab visibility changes. |

---

## 4. Walkthrough & Verification Matrix

| Step / Gate | Starting State | Action | Observable Result | Evidence |
| --- | --- | --- | --- | --- |
| **Gate 1: Feature contract unit tests** | Clean checkout at `139f705` | Run `node --experimental-strip-types --test lib/print-runs.test.ts lib/ink-lab.test.ts lib/pages.test.ts lib/terminal.test.ts` | **PASS (`53/53`, `0` failed, `119.27ms`)**: Codec round-trip, clamping, plate validation, `CONSOLE_MENU` 7-item cap, `PUBLIC_PAGES` `/lab` entry, and terminal `go/open/cd/ls` for `lab`. | `ver-3685` & QA local run (`119.27ms`) |
| **Gate 2: Typecheck** | Clean checkout at `139f705` | Run `npm run typecheck` (`next typegen && tsc --noEmit`) | **PASS (exit `0`)**: Zero TypeScript or Next.js route type errors. | `ver-3685` & QA local run |
| **Gate 3: Lint** | Clean checkout at `139f705` | Run `npm run lint` (`eslint .`) | **PASS (exit `0`)**: `0` errors (`10` pre-existing warnings in unrelated scripts/components). | `ver-3685` & QA local run |
| **Gate 4: Full unit suite** | Clean checkout at `139f705` | Run `npm test` | **PASS (`2,575/2,575` tests, `2` suites, `0` failed, `0` skipped, `20,969.37ms`)**. | `ver-3685` & QA local run |
| **Gate 5: Real-browser Ink Lab contract (`e2e/ink-lab.test.ts`)** | Production build `Dc3AhmDpFtOJmt7xOvR3s` + migrated Postgres | Run `TMPDIR=/tmp LAB_SCREENSHOT_DIR=/tmp/qa-lab-screenshots-run-9274 node --experimental-strip-types scripts/e2e.mjs --test e2e/ink-lab.test.ts` | **PASS (`10/10` tests, `0` failed, `12,610.85ms`)**: Covers no-JS server fallback, navigation from desktop/mobile/footer/terminal, preview isolation & single-rAF `flushSync` latency (`14.40ms <= 100ms`, `renderedBeforePaint: true`, `updates: 1`, `effectiveSpeed: "0"`), URL canonicalization & hostile query fallback, Share clipboard + fallback, Apply & Reset across routes/reload/ConsoleProvider, storage failure degradation, wobble pause on offscreen/hidden/reduced-motion/route exit (`labObserverCount === 0`), and keyboard/overflow checks at desktop `1366x768`, mobile `390x844`, and `200% zoom`. | `ver-3685` (`6.20ms`) & QA local run (`14.40ms`) |
| **Surrounding E2E Regression Suite** | Production build `Dc3AhmDpFtOJmt7xOvR3s` | Run `SKIP_BUILD=1 TMPDIR=/tmp node --experimental-strip-types scripts/e2e.mjs --test e2e/print-runs.test.ts e2e/print-run-console.test.ts e2e/riso-headings.test.ts e2e/kame.test.ts` | **PASS (`35/35` tests, `0` failed, `54,610.12ms`)**: Pre-paint boot across roots, Pocket console Print run selector, Riso headings plate registration & accessibility, and Kame motion/hydration. | QA local run (`54,610.12ms`) |
| **Independent QA Probe (`qa-probe-run-9274.mjs`)** | Production build `Dc3AhmDpFtOJmt7xOvR3s` | Run `SKIP_BUILD=1 TMPDIR=/tmp node --experimental-strip-types scripts/e2e.mjs --test .../scratch/qa-probe-run-9274.mjs` | **PASS (`3/3` subtests, `0` failed, `8,610.21ms`)**: Viewports `1920x1080`, `1366x768`, `390x844`, `200% zoom`, `forced-colors: active`, no-JS, Negative Controls A/B/C, all 17 routes across 14 root layouts (`contrast 14.01:1`–`14.05:1 >= 4.5:1`), `/play` `Stamp it`, and `/projects` Kame hydration (`0` `pageerror`s). | `/tmp/qa-run-9274-artifacts/*.json` & `*.png` |
| **Live Production Verification (`https://otohime.dev`)** | Deployed commit `139f7054e040558b7bb9078f6d4e73e245dc5fd1` on `https://otohime.dev` | Query `https://otohime.dev/api/health` and run headless Chrome (`live-probe-run-9274.mjs`) against `https://otohime.dev/lab?v=1&r=riso&d=6.4&o=1` | **PASS**: `/api/health` returns `{"ok":true,"sha":"139f7054e040558b7bb9078f6d4e73e245dc5fd1"}`, live `/lab` slider input commits before paint (`renderedBeforePaint: true`, `ms: 4.30`, whereas pre-cutover `9cc593e` returned `renderedBeforePaint: false`), `Apply to whole site` sets `data-print-run="riso"` and `data-ink-lab=""` (`sessionStorage: "v=1&r=riso&t=0.039&d=8.2&w=0&g=0.04&p=292522%2Cff48b0%2C00a95c&n=3&m=420&h=ink&o=1"`), and `Reset to house style` clears `data-print-run`, `data-ink-lab`, and `sessionStorage` with `0` `pageerror`s. | Section 6.3 (`live-probe-run-9274.mjs`) |

---

## 5. Independent QA Evidence & Negative Controls

Outside the SWE-authored `e2e/ink-lab.test.ts`, QA wrote and executed `/home/avietidol/.local/share/build-worker/leases/a65ba7c3-e214-44fb-83cf-512c8f5a8742-49d1dc9fbb4a6a47415c4755135de097/home/.gemini/antigravity-cli/brain/0cc56a45-b99c-4a8c-910f-35d926d18e69/scratch/qa-probe-run-9274.mjs` (`3/3` pass):

### 5.1 Negative Control A — Frame-Deadline Negative Control & Preview Isolation
- **Frame-Deadline Negative Control (why `8ca0de3` fixed `ver-3684`)**:
  - In `ver-3684` (`run-9269` on `9cc593e`), calling plain React `setLab(...)` inside `requestAnimationFrame` allowed React 19 to defer the DOM commit past the current frame's paint deadline (`137.6ms > 100ms`).
  - QA's probe tested a negative control in the same browser page: scheduling a deferred state update (`setTimeout(..., 0)`) inside the first `requestAnimationFrame` callback and checking whether a second `requestAnimationFrame` callback in the same frame observed the update (`deferredHitSameFrame === false`), then firing a 4-event slider burst (`2.1`, `4.3`, `6.5`, `9.4`) on `#lab-displacement` and checking a second `requestAnimationFrame` callback in the same frame (`actualHitSameFrame === true`, `filterUpdatesDelta === 1`, `latencyMs === 17.90ms <= 100ms`).
- **Preview Isolation Before Apply**:
  - After tuning all 11 controls (`Print run = indigo`, `Hand style = watercolour`, `Turbulence = 0.095`, `Displacement = 9.4`, `Wobble speed = 3.5`, `Paper grain = 0.045`, `Transition duration = 650`, `Plate count = 2`, `Decorative plate 1..3 = #112233/#445566/#778899`, `Halftone = checked`) without clicking `Apply to whole site`:
  - `document.documentElement` attributes, inline `style`, `localStorage.getItem("otohime:print-run:v1")`, `sessionStorage.getItem("otohime:ink-lab:v1")`, computed `h1#lab-title` color, `.lab-controls .card` background color, and all site `[data-ap-scale]` filter elements remained byte-for-byte identical to their initial pre-tuning snapshot.

### 5.2 Negative Control B — Hostile / XSS / Out-of-Range Query & Corrupt `sessionStorage` Injection
- **Hostile Query String**: Navigated to `/lab?v=1&r=%3Cscript%3Ewindow.__xss=1%3C/script%3E&t=NaN&d=-50&w=Infinity&g=99&p=javascript:alert(1),123456,abcdef&n=99&m=-20&h=eval()&o=99&evil=1#frag`:
  - Verified `window.__xss === undefined`, `document.documentElement.hasAttribute("data-ink-lab") === false`, `#frag` cleared on canonicalization, and `window.location.search` replaced via `history.replaceState` with canonical clamped `v=1&r=house&t=0.035&d=0&w=0&g=0.06&p=231e16%2Cf3a6bb%2C93d3b0&n=3&m=0&h=ink&o=0`.
- **Corrupt `sessionStorage` Payload**:
  - Confirmed `readStoredLab("v=1&r=indigo&d=999") === null` (non-canonical string rejected because `encodeLab(decodeLab(raw)) !== raw`).
  - Injected `sessionStorage.setItem("otohime:ink-lab:v1", "v=1&r=indigo&d=999")` and navigated to `/work`: `appearanceBootScript` rejected the non-canonical payload and booted cleanly with `data-ink-lab === false` and `data-print-run === null`.

### 5.3 Negative Control C — Denied `Storage` & `navigator.clipboard` Failure Injection
- Overrode `Storage.prototype.setItem` / `removeItem` to throw `DOMException("blocked", "SecurityError")` and `navigator.clipboard.writeText` to reject:
  - Clicking `Share` rendered `Clipboard unavailable — copy the Share URL below.` in `role="status"` and automatically selected all `103` characters (`selectionEnd - selectionStart === value.length`) of the readonly `Share URL` input.
  - Clicking `Apply to whole site` applied the variables to the current document and announced `Applied on the current page only. Storage is blocked; routes and reload may lose it. Allow session storage, then Apply again.` with `0` uncaught errors.

### 5.4 Layout Geometry, Viewport Reflow, Forced-Colors, No-JS, and 14-Root-Layout Contrast Audit
- **Measured Viewport Geometry (`/tmp/qa-run-9274-artifacts/layout-report.json`, visually inspected via screenshots)**:
  - `desktop-1920x1080`: `.lab-controls` (`x: 582.5, y: 274.6, w: 444.6, h: 963.6`) beside sticky `.lab-preview` (`x: 1051.1, y: 274.6, w: 491.4, h: 601.8`); `scrollWidth: 1905 <= innerWidth: 1920`.
  - `desktop-1366x768`: `.lab-controls` (`x: 305.5, y: 274.6, w: 444.6, h: 963.6`) beside sticky `.lab-preview` (`x: 774.1, y: 274.6, w: 491.4, h: 601.8`); `scrollWidth: 1351 <= innerWidth: 1366`.
  - `mobile-390x844`: `.lab-preview` (`x: 20, y: 313, w: 335, h: 575.75`) stacked vertically above `.lab-controls` (`x: 20, y: 912.75, w: 335, h: 982.8`); `scrollWidth: 375 <= innerWidth: 390`.
  - `zoom-200pct` (`1366x768` with `document.documentElement.style.zoom = "2"`): `@container (min-width: 760px)` on `.ink-lab` reflows to single-column with `.lab-preview` (`x: 504, y: 589.5, w: 783, h: 1351.2`) stacked vertically above `.lab-controls` (`x: 504, y: 1988.7, w: 783, h: 1927.6`); `scrollWidth: 1351 <= innerWidth: 1366`.
- **`forced-colors: active` Media Query**: Verified `.lab-paper-grain` has `display: none` and `.lab-proof-heading`, `.lab-linework`, and `.lab-proof-card .btn` have `filter: none`.
- **No-JavaScript (`javaScriptEnabled: false`)**: `/lab` renders visible `<h1>Ink Lab</h1>` and `<p role="status">Laying out the proof sheet… If this message stays, interactive ink controls need JavaScript.</p>`.
- **14 Root Layouts Carry-Through & WCAG Contrast (`/tmp/qa-run-9274-artifacts/roots-audit.json`)**:
  - After applying `?v=1&r=riso&t=0.064&d=6.2&w=0&g=0.06&p=ff48b0,00a95c,292522&n=3&m=350&h=pencil&o=1` (max grain `0.06` + halftone `o=1` + bright decorative plates), navigated across 17 routes covering all 14 root `<html>` layouts: `(site)` (`/`, `/work`, `/projects`, `/play`), `/articles`, `/barometer`, `/capsule`, `/design-system`, `/elements`, `/orrery`, `/planisphere`, `/rotor`, `/ryugu`, `/shore`, `/structures`, `/vinyl`, and `/zine`.
  - Every root layout carried `data-print-run="riso"`, `data-ink-lab=""`, `data-ap-halftone=""`, `--ap-grain: 0.06`, and `--ap-plate-1: #ff48b0`.
  - Readable body/heading ink (`--ink`) remained preset ink rather than decorative plate colors, yielding **14.01:1** contrast on light paper (`rgb(255, 244, 232)` vs `rgb(41, 37, 34)`) and **14.05:1** on dark surfaces (`/ryugu`, `/vinyl`: `rgb(32, 30, 28)` vs `rgb(243, 235, 223)`), exceeding the `>= 4.5:1` contract requirement.

---

## 6. Bounded Paginated History & CI / Live Deployment Audit

### 6.1 Plan-Manager Run History (`plan_manager_list_runs` for `pm-268`)
- **Scan Completeness**: Read all `43/43` runs (`100%`) recorded on plan `pm-268`.
- **All `t-1679` Runs in Chronological Order**:
  1. `run-9265` (`software_engineer`, `tm_task_id: 68ee9bfe-958f-48ae-a510-6fb170b0803e`, profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, worker `avietidol-z490`): `failed` at post-agent runner check `push_not_on_main` because commit `f23bffac2eb11ca0d9d50cf85e7f890f5616cc5f` was pushed only to `origin/pm-268-t-1679-ink-lab` and not `origin/main` (auto-rescued to `task-rescue/68ee9bfe-958f-48ae-a510-6fb170b0803e`).
  2. `run-9267` (`software_engineer`, `tm_task_id: e726e7c6-c939-4c35-9714-497b10953cd6`, profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, worker `avietidol-mac-mini`): `done`, delivered `9cc593e9d0c99e9f7f06ae293edfbaba8bbabbff` to `origin/main`.
  3. `run-9269` (`verify`, `tm_task_id: db895405-3ae6-4a01-9144-00aa9ed053c8`, template `verify-runner`, worker `avietidol-mac-mini`): persisted `ver-3684` (`status: fail` at `git_sha: 9cc593e`) because `e2e/ink-lab.test.ts` subtest `preview isolation, single-frame slider coalescing and <=100ms preview response` measured `137.6ms > 100ms` under React's deferred commit inside `requestAnimationFrame`.
  4. `run-9270` (`software_engineer`, `tm_task_id: 07fae291-16bf-4f67-b26d-6fe9294a12cb`, profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, worker `avietidol-z490`): wrapped the `requestAnimationFrame` preview commit in `flushSync` (`components/ink-lab.tsx:66`) and added `renderedBeforePaint` verification (`e2e/ink-lab.test.ts:104-121`), reducing latency to `4.2ms`, but `failed` at post-agent `push_not_on_main` when pushing only to `origin/pm-268-t-1679-frame-paint` (auto-rescued to `task-rescue/07fae291-16bf-4f67-b26d-6fe9294a12cb`).
  5. `run-9271` (`software_engineer`, `tm_task_id: 5eb43968-8e51-4cc1-abc1-40327f0cc989`, profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, worker `avietidol-z490`): `done`, fast-forwarded `8ca0de3f7f81e8f0d79e31d43c477966553845eb` + `139f7054e040558b7bb9078f6d4e73e245dc5fd1` to both `origin/pm-268-t-1679-delivery-run-9271` and `origin/main`.
  6. `run-9273` (`verify`, `tm_task_id: d098995f-517c-4242-b348-ba79eba0a430`, template `verify-runner`, worker `avietidol-z490`): `done`, persisted `ver-3685` (`status: pass` at `git_sha: 139f705`, all 5 checks exit `0`, latency `6.20ms`, `renderedBeforePaint: true`).
  7. `run-9274` (`quality_engineer`, `tm_task_id: a65ba7c3-e214-44fb-83cf-512c8f5a8742`, profile `agy-argon-high`, model `Gemini 4 Argon (High)`, effort `high`, worker `avietidol-z490`): current QA run.

### 6.2 Task-Manager Bounded Queue & History Scan (`task_manager_list_tasks` / `task_manager_get_task`)
- **`RUNNING`**: Read `2/2` (`100%`, `offset: 0, limit: 10`) — `a65ba7c3-e214-44fb-83cf-512c8f5a8742` (this QA run `run-9274`) and `c146c316-051d-4d04-a977-0da87d354494` (unrelated plan `pm-262`).
- **`PENDING`**: Read `0/0` (`100%`, `offset: 0, limit: 10`) — zero queued tasks waiting for capacity.
- **`COMPLETED`**: Read 2 bounded pages (`20/5,995` global tasks at `offset: 0..10, limit: 10`) plus `100%` (`4/4`) of completed `t-1679` tasks via `task_manager_get_task` + `task_manager_get_task_logs` (`d098995f-517c-4242-b348-ba79eba0a430`, `5eb43968-8e51-4cc1-abc1-40327f0cc989`, `db895405-3ae6-4a01-9144-00aa9ed053c8`, `e726e7c6-c939-4c35-9714-497b10953cd6`).
- **`FAILED`**: Read 2 bounded pages (`20/1,178` global tasks at `offset: 0..10, limit: 10`) plus `100%` (`2/2`) of failed `t-1679` tasks via `task_manager_get_task` + `task_manager_get_task_logs` (`07fae291-16bf-4f67-b26d-6fe9294a12cb` and `68ee9bfe-958f-48ae-a510-6fb170b0803e`). Both `t-1679` failures were post-agent `push_not_on_main` errors that were resolved in `run-9267` and `run-9271`.

### 6.3 GitHub Actions CI & Live Production (`https://otohime.dev`)
- **Live `/api/health` & Ancestry Check**:
  - `curl -sS https://otohime.dev/api/health` -> `{"ok":true,"sha":"139f7054e040558b7bb9078f6d4e73e245dc5fd1"}`.
  - `git merge-base --is-ancestor 139f7054e040558b7bb9078f6d4e73e245dc5fd1 139f7054e040558b7bb9078f6d4e73e245dc5fd1` -> exits `0`.
  - Live browser probe (`live-probe-run-9274.mjs`) against `https://otohime.dev/lab?v=1&r=riso&d=6.4&o=1`:
    - Before `#529` finished cutting over (while `https://otohime.dev/api/health` still served `9cc593e9d0c99e9f7f06ae293edfbaba8bbabbff`), the live probe observed `renderedBeforePaint: false` on slider input (confirming the pre-`8ca0de3` behavior on live production).
    - Immediately after `#529` deployed `139f7054e040558b7bb9078f6d4e73e245dc5fd1`, `/api/health` returned `{"ok":true,"sha":"139f7054e040558b7bb9078f6d4e73e245dc5fd1"}` and the identical live probe observed `renderedBeforePaint: true` (`4.30ms`), `inkLabBeforeApply: false`, `Apply to whole site` -> `{"printRun":"riso","inkLab":true,"session":"v=1&r=riso&t=0.039&d=8.2&w=0&g=0.04&p=292522%2Cff48b0%2C00a95c&n=3&m=420&h=ink&o=1"}`, and `Reset to house style` -> `{"printRun":null,"inkLab":false,"session":null}` with `0` `pageerror`s.
- **Bounded GitHub Actions History (`per_page=6` of `529` total workflow runs)**:
  - `#529` (`40567397034`, `head_sha: 139f7054e040558b7bb9078f6d4e73e245dc5fd1`, branch `main`): `checks` job completed with `conclusion: "success"` (`2026-10-27T19:15:09Z`–`19:36:24Z`), `production` job passed author check, `npm ci`, `vercel pull`, `Build production bundle with strict changelog history`, `npm run db:migrate`, and `Deploy and verify the served sha`, serving `139f7054e040558b7bb9078f6d4e73e245dc5fd1` on `https://otohime.dev/api/health`.
  - `#528` (`40564127414`, `head_sha: 9cc593e9d0c99e9f7f06ae293edfbaba8bbabbff`, branch `main`): `completed` / `success` (`2026-10-27T18:53:22Z`–`19:15:03Z`).
  - `#527` (`40562704334`, `head_sha: 400034a28715aa43bc1346f1ba917371df1a909e`, branch `main`, `t-1678` QA): `completed` / `success`.
  - `#526` (`40555071055`, `head_sha: 68bde4aca8b7aa99fb92c374cc2e7e413be12778`, branch `main`, `t-1678` SWE): `completed` / `success`.

---

## 7. Defects & Deferred Checks

- **Observed Defects**: **None (`0`)**. The single historical verification failure (`ver-3684` at `9cc593e`, `137.6ms > 100ms`) was deterministically root-caused and fixed in `8ca0de3f7f81e8f0d79e31d43c477966553845eb` (`flushSync` inside `requestAnimationFrame`), verified by `ver-3685` (`6.20ms`), QA's `e2e/ink-lab.test.ts` run (`14.40ms`), and QA's independent frame-deadline negative control (`17.90ms`, `actualHitSameFrame: true`, `deferredHitSameFrame: false`).
- **Deferred Checks**: **None (`0`)**. Every acceptance criterion and verification check in `t-1679` is proven now.
