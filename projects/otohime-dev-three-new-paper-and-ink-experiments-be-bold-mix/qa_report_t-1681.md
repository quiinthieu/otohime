# QA Report — Task `t-1681`: Hanafuda Mobile Viewport-Visible Koi-Koi and Round-Over Prompts

- **Plan ID**: `pm-293` (*Washi Daruma, Emaki, and Hanafuda*, Revision 2, Cycle 1)
- **Task ID**: `t-1681` (*Hanafuda mobile viewport-visible Koi-Koi and round-over prompts*)
- **QA Run ID**: `run-9263` (`role=quality_engineer`, `agent_profile=agy-argon-medium`, `model_id=gemini-4-argon-medium`, `effort=medium`, `runner=fleet`, `worker_id=avietidol-mac-mini`, `tm_task_id=ce16bc6f-dda4-4ae0-9227-e6e318975b52`)
- **SWE Delivery Run**: `run-9255` (`role=software_engineer`, `agent_profile=agy-argon-high`, `model_id=gemini-4-argon-high`, `runner=fleet`, `worker_id=avietidol-z490`, `tm_task_id=afe22cca-cec9-48c4-be0a-a05444b2a158`)
- **Delivery Commit SHA**: `68bde4aca8b7aa99fb92c374cc2e7e413be12778` (`68bde4a`)
- **Green Gate**: `ver-3680` (`run-9261`, `tm_task_id=a1c2fba5-8682-48a4-b750-7ca0ef269a09`, `gate=green`, `git_sha=68bde4a`, `status=pass`)
- **Deployed Commit SHA**: `68bde4aca8b7aa99fb92c374cc2e7e413be12778` (`git merge-base --is-ancestor 68bde4aca8b7aa99fb92c374cc2e7e413be12778 68bde4aca8b7aa99fb92c374cc2e7e413be12778` → exit `0`)
- **Verdict**: **PASS**

---

## 1. Execution Evidence Classification & Real/Fake Boundaries

| Dimension | Status | Evidence |
| :--- | :--- | :--- |
| **Integration Deployed** | **Proven** | Commit `68bde4aca8b7aa99fb92c374cc2e7e413be12778` merged to `main`, verified by green gate `ver-3680` (`run-9261`) and GitHub Actions CI run `40555071055` (`run_number=526`), and deployed to production at `https://otohime.dev` (`/api/health` returns `{"ok":true,"sha":"68bde4aca8b7aa99fb92c374cc2e7e413be12778"}`). |
| **Waiting for Capacity** | **None** | All local, CI, and production checks executed directly on `avietidol-mac-mini` and GitHub Actions / Vercel production without capacity deferral. |
| **Execution Demonstrated** | **Proven** | Contract Playwright suite (`e2e/hanafuda.test.ts`, 6/6 passed), independent QA Playwright negative-control suite (`qa-t1681-browser-negative.mjs`, passed locally and against `https://otohime.dev`), real SSR/module preflight (`qa-t1681-preflight.mjs`), Hanafuda engine unit suite (`lib/hanafuda/hanafuda.test.ts`, 7/7 passed), yearly-log suites (`lib/yearly-log.test.ts` & `scripts/yearly-log.test.ts`, 15/15 passed), sound suite (`lib/sound.test.ts`, 15/15 passed), full project unit test suite (`npm test`, 2573/2573 passed), `npm run typecheck` (0 errors), and `npm run lint` (0 errors). |
| **Product Delivered** | **Proven** | Live user path on `/play/hanafuda` at both `390x844` mobile and `1366x768` desktop viewports keeps `koi-koi-prompt` and `round-result-banner` (plus primary action buttons `decide-koi-koi`, `decide-shobu`, `next-round-btn`, `play-again-btn`) strictly within `[0, window.innerHeight]`, moves keyboard focus to the primary decision button, and preserves `aria-live="polite"` announcements. |

### Real / Fake Boundaries
- **Real dependencies exercised**:
  - Real Next.js `16.4.2` production build and server (`next build` + `next start`) and live production deployment (`https://otohime.dev`).
  - Real embedded PostgreSQL 17 instance with Drizzle migrations applied (`scripts/e2e.mjs`).
  - Real headless Chromium via Playwright (`playwright@1.64.1` / `playwright-core`) at both `390x844` (`isMobile: true, hasTouch: true`) and `1366x768` desktop viewports.
  - Real React 19 (`react`, `react-dom/server`), real Hanafuda engine (`lib/hanafuda/engine.ts`, `lib/hanafuda/deck.ts`, `lib/hanafuda/yaku.ts`), real Web Audio sound synthesizer (`lib/sound.ts`), and real `content/yearly-log.json` data.
- **Deterministic fixtures (`?fixture=koi-koi-ready`, `?fixture=match-over-ready`)**:
  - Opt-in URL query fixtures construct deterministic 1-tap `HanafudaState` boards via `createCustomRoundState` in `app/(site)/(app)/play/hanafuda/_components/hanafuda-board.tsx`.
  - Default gameplay without `fixture` (`?seed=53` and default `/play/hanafuda`) remains 100% unmocked and was independently verified on `390x844` mobile using a real 2-tap capture from the bottom of the scrolled page (`scrollY = 2323`).

---

## 2. Executable & Artifact Fingerprint (`68bde4aca8b7aa99fb92c374cc2e7e413be12778`)

Preflight script `qa-t1681-preflight.mjs` executed under locked Node.js `v22.23.3` imported `react`, `react-dom/server`, `lib/yearly-log.ts`, `lib/hanafuda/engine.ts`, and `app/(site)/(app)/play/hanafuda/_components/hanafuda-board.tsx`, rendered `232,756` bytes of SSR HTML (`data-testid="hanafuda-board"`, `data-testid="hanafuda-live-status"`, `aria-live="polite"`), and recorded the exact SHA-256 hashes of all task-relevant files:

| File | SHA-256 |
| :--- | :--- |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |
| `app/(site)/(app)/play/hanafuda/_components/hanafuda-board.tsx` | `250c6ae53d658c00bed95163dd0e2fff9ac57de60f60aa2ee826230c13dbf542` |
| `app/(site)/(app)/play/hanafuda/hanafuda.css` | `e9a0a45a3d9286433b6a4ea736761b832def54165d35b33e4f19c1da6f795123` |
| `e2e/hanafuda.test.ts` | `9c8d5c7ce018a442bcb67a729fa6a9223d4cfbfa7b03b0ba246471636f30b22b` |
| `content/yearly-log.json` | `7916708e6d5f025e4554a9e272eca7195bc62cb542a769af5505ae7a5106a611` |
| `projects/otohime-dev-three-new-paper-and-ink-experiments-be-bold-mix/task-2-evidence.md` | `1665e11423fa41191de6b0a40a9d2524783f62e1486ccc20ee49229bb0839f25` |

---

## 3. Commit Identity Verification

- **Delivery Commit**: `68bde4aca8b7aa99fb92c374cc2e7e413be12778`
  - `git show -s --format="Author: %an <%ae>%nCommitter: %cn <%ce>%nSubject: %s%nBody:%b" 68bde4aca8b7aa99fb92c374cc2e7e413be12778`:
    - Author: `Otohime <quiinthieu@gmail.com>`
    - Committer: `Otohime <quiinthieu@gmail.com>`
    - Subject: `pm-293/t-1681: pin Hanafuda Koi-Koi and round prompts in mobile viewport`
    - Trailers: None (`0` `Co-Authored-By` trailers).
- **Repository Git Check**: `bash scripts/setup-owner-git.sh --check` → `Effective commit author: Otohime <quiinthieu@gmail.com>`.

---

## 4. Bounded Paginated Run & Task History Inspection

1. **Plan Manager Runs (`plan_manager_list_runs(plan_id="pm-293")`)**:
   - **Completeness**: `23 / 23` runs scanned (100% complete).
   - **Cycle 0 History**: Tasks `t-1675`, `t-1676`, `t-1677`, `t-1678`, `t-1679`, and `t-1680` all passed SWE + QA (`run-9220` through `run-9248`). Acceptance run `run-9251` (`role=chief_of_staff`, `agent_profile=claude-opus-high`, `model_id=claude-opus-4-7`) found that on `390x844` mobile, tapping `03-hikari-curtain` at the bottom of the scrolled board (`scrollY ≈ 1701`) rendered `koi-koi-prompt` near the top of the document (`top = -1329.3px`), off-screen above the viewport.
   - **Cycle 1 History**:
     - `run-9255` (`t-1681`, `role=software_engineer`, `agent_profile=agy-argon-high`, `model_id=gemini-4-argon-high`, `tm_task_id=afe22cca-cec9-48c4-be0a-a05444b2a158`): Completed `done` at commit `68bde4aca8b7aa99fb92c374cc2e7e413be12778`.
     - `run-9261` (`t-1681`, `role=verification`, `gate=green`, `ver-3680`, `tm_task_id=a1c2fba5-8682-48a4-b750-7ca0ef269a09`): Completed `done` (`status=pass`) for `68bde4a`.
     - `run-9256` (`t-1682`), `run-9258` (`t-1682` green gate), `run-9260` (`t-1682` QA): Completed `done`.
2. **Task Manager Fleet Queue (`task_manager_list_tasks`)**:
   - Scanned bounded page `limit=50, offset=0` across `COMPLETED` (`50 / 6222`), `FAILED` (`50 / 1176`), `RUNNING` (`4 / 4`, 100% complete), and `PENDING` (`1 / 1`, 100% complete).
   - Zero `FAILED` tasks match `pm-293` or commit `68bde4aca8b7aa99fb92c374cc2e7e413be12778`.
3. **GitHub Actions Workflow History (`ci.yml`)**:
   - Run `524` (`40554368295` on earlier commit `7ad719f`, `pm-293/t-1682`) failed in `e2e/hanafuda.test.ts` line 253 because `t-1682` regenerated `content/yearly-log.json` (bumping Month 10 commits from `645` to `660`) before `t-1681` (`68bde4a`) replaced the hardcoded `"645 commits"` assertion in `e2e/hanafuda.test.ts` with dynamic `rawYearlyLog.months["10"].commits`.
   - Run `526` (`40555071055` on delivery commit `68bde4aca8b7aa99fb92c374cc2e7e413be12778`) passed `checks` (including `E2E against next start`) and `production` deploy.

---

## 5. Acceptance Criteria & Independent Verification

### 5.1 Contract Verification (`e2e/hanafuda.test.ts`)
Command:
```bash
(test -d node_modules || npm ci) && npx playwright test e2e/hanafuda.test.ts && git checkout -- content/history.json
```
Result: **6 / 6 tests passed** (`20,493.3ms` against fresh Next.js 16.4.2 production build):
1. `renders 48 cards with >=2 SVG paths each, deals 8 hand + 8 field + 24 stock, and flips card backs with View Transitions` (`1665.3ms`)
2. `supports drag-to-match and keyboard play, triggers 1-turn Hanami-zake with hanko stamp and Koi-Koi prompt, and plays 3 rounds to Match Complete` (`4713.5ms`)
3. `pins Koi-Koi prompt and round/match result banners inside the 390x844 mobile viewport after a finger tap from the bottom of the scrolled board` (`1619.2ms`)
4. `sound toggle mutes and unmutes Web Audio synthesis cleanly` (`550.2ms`)
5. `Monthly Shipped Log gallery flips all 12 monthly cards and displays real October (Maple) shipped data` (`812.6ms`)
6. `axe-core WCAG 2.1 AA scan passes with zero violations and layout has zero horizontal overflow at 1366x768 and 390x844` (`2646.9ms`)

### 5.2 Independent Browser Verification & Negative Controls
Executed independent QA Playwright script (`qa-t1681-browser-negative.mjs`) both locally (`http://localhost:56853`) and against live production (`https://otohime.dev`):

| Scenario | Viewport | Scroll Before Trigger | Measured Bounding Boxes (`getBoundingClientRect()`) | Focus & ARIA Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Negative Control 1**: Invalid fixture query (`?seed=53&fixture=bogus-fixture`) | `390x844` mobile | `0` px | `data-fixture` attribute is `null`; `koi-koi-prompt` count = `0`; `round-result-banner` count = `0`; `.rise` ancestor computed `transform: "none"`, `translate: "none"`. | `data-phase="play-hand"` |
| **Independent Mobile Real Seed 53 (Non-Fixture 2-Tap Capture)**: Scroll to bottom hand, tap `03-hikari-curtain` twice | `390x844` mobile | `scrollY = 2323` px | `koi-koi-prompt`: `position: "fixed"`, `zIndex: "60"`, `top: 563.03`, `bottom: 838.00`, `left: 12`, `right: 378` (`0 <= top` & `bottom <= 844`)<br>`decide-koi-koi`: `top: 748.19`, `bottom: 780.81`, `left: 105.19`, `right: 305.03`<br>`decide-shobu`: `top: 790.41`, `bottom: 822.41`, `left: 105.19`, `right: 276.08` | `document.activeElement` is `[data-testid="decide-koi-koi"]`; `aria-live="polite"` region announces `"Hanami-zake (5 pts)! Call Koi-Koi or Shobu?"` |
| **Mobile `round-over` & `match-over` via `?seed=1&fixture=koi-koi-ready` and `?seed=7&fixture=match-over-ready`** | `390x844` mobile | `scrollY = 1856` px | `round-result-banner` (`match-over`): `position: "fixed"`, `zIndex: "60"`, `top: 685.78`, `bottom: 832.00`, `left: 12`, `right: 378` (`0 <= top` & `bottom <= 844`)<br>`play-again-btn`: `top: 784.58`, `bottom: 817.20`, `left: 29.19`, `right: 180.13` | `document.activeElement` is `[data-testid="next-round-btn"]` (`round-over`) and `[data-testid="play-again-btn"]` (`match-over`); `aria-live="polite"` intact |
| **Desktop `1366x768` Scrolled Hand Capture (`?seed=1&fixture=match-over-ready`)** | `1366x768` desktop | Scrolled to bottom hand | `koi-koi-prompt`: `position: "sticky"`, `zIndex: "40"`, `top: 18.00`, `bottom: 188.36`, `left: 313`, `right: 1273` (`0 <= top` & `bottom <= 768`)<br>`decide-koi-koi`: `top: 135.34`, `bottom: 167.97`<br>`decide-shobu`: `top: 135.66`, `bottom: 167.66`<br>`round-result-banner`: `top: 12.00`, `bottom: 110.38`<br>`play-again-btn`: `top: 46.88`, `bottom: 79.50` | `document.activeElement` moves to `decide-koi-koi` then `play-again-btn` |

### 5.3 Engine & Unit Negative Controls (`qa-t1681-preflight.mjs`)
- **Negative Control 2**: `createCustomRoundState({ seed: 1, hands: { human: ["99-invalid-card"], cpu: [] }, field: [], stock: [] })` throws `Error: Invalid Hanafuda card reference: 99-invalid-card`.
- **Negative Control 3**: `decideKoiKoi(playHandState, "shobu")` when `phase === "play-hand"` throws `Error: Cannot make a Koi-Koi decision during phase "play-hand"`.
- **Unit & Static Check Suites**:
  - `lib/hanafuda/hanafuda.test.ts`: `7 / 7` passed (`75.1ms`).
  - `lib/yearly-log.test.ts` + `scripts/yearly-log.test.ts`: `15 / 15` passed (`4359.3ms`).
  - `lib/sound.test.ts`: `15 / 15` passed (`64.6ms`).
  - `npm test`: `2573 / 2573` passed (`22,092.5ms`).
  - `npm run typecheck`: passed (`0` errors).
  - `npm run lint`: passed (`0` errors).

---

## 6. Defects & Deferred Checks

- **Defects Observed**: None (`0`).
- **Deferred Checks**: None (`0`).
