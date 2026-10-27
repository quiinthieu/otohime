# Task 1 (`t-1680`) Execution Evidence — Making-of Emaki Ground-Truth Run Models & Shipped-Plan Filter

## 1. Run & Build Identity

- **Plan ID**: `pm-293` ("Washi Daruma, Emaki, and Hanafuda", revision 2)
- **Task ID**: `t-1680` ("Making-of Emaki ground-truth run models and shipped-plan filter")
- **Run ID**: `run-9264`
- **Role / Profile / Model / Effort**: `software_engineer` / `agy-argon-high` / `gemini-4-argon` / `high`
- **Node Runtime**: `v22.23.3` (linux x64, locked `package-lock.json` SHA-256 `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`)
- **Evidence Classification**:
  - **Integration deployed**: Yes — `lib/making-of.ts`, `scripts/making-of-index.ts`, `content/making-of.json`, and `app/(site)/(app)/making-of/_components/emaki-scroll.tsx` wired end-to-end.
  - **Waiting for capacity**: None (`0` deferred checks).
  - **Execution demonstrated**: Yes — unit tests, generator `--check`, and headless Chromium Playwright E2E tests at desktop (`1366×840`) and mobile (`390×844`) viewports passed with `0` console/page errors.
  - **Product delivered**: Yes — `/making-of` renders `34` shipped scenes (`33` `done` plans + `pm-293`), sources every role's model badge from recorded `plan-manager` run history, and renders `data-testid="emaki-role-absent"` (with no `data-model-id`) for roles that did not execute (`research` and `product_owner` on `pm-272`; `research` on `pm-255`).

---

## 2. Executable & Artifact Fingerprints (SHA-256)

| File | SHA-256 |
| --- | --- |
| `lib/making-of.ts` | `430cac9a2e19f8d83bac3fcb551c6e73484f2db04f6990d217d83584db7d9e96` |
| `lib/making-of.test.ts` | `4864aeea225b89f4a6b8277b28c769328a8522b45ab746060046d5bb24c1cf4b` |
| `scripts/making-of-index.ts` | `9503dc624fa18a597fdfb49b9f198a9ed67ee97e73af8ec7b01d4b561dcd47c6` |
| `scripts/making-of-index.test.ts` | `26f034ad18b33a4cb8cef18a0cdcc13cb57d12a1172c2e8fbad58ae994def977` |
| `content/making-of.json` | `3c358643baf7b6e1903d625256df908437fa04ea801a41dc6e86b5007e26533a` |
| `app/(site)/(app)/making-of/_components/emaki-scroll.tsx` | `255c116a0cfbbd98088a81f89cb53c4d7576856ec10068b1fdbc698fbab2b8e6` |
| `app/(site)/(app)/making-of/making-of.css` | `6ad3abad00297e551c9226e6121aeff1108c1549e9c010c8f7e25490d07e16a2` |
| `e2e/making-of.test.ts` | `b4792715c826b977e9742947f93d89070549192775c74ec5ac7f205b` |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |

---

## 3. Ground-Truth `plan_manager` Run History Verification

Queried directly from the `plan_manager` PostgreSQL database (`plans` and `runs.profile_flags --model` for `repo_id = 'otohime'`, complete history across all `61` repository plans: `33` `done`, `1` active `executing` plan `pm-293`, and `27` unshipped plans including `19` with commits on `main`):

- **Removed `DEFAULT_ROLE_MODELS`**: Eliminated static fallback model assignment from `lib/making-of.ts` and `scripts/making-of-index.ts`.
- **Shipped-Plan Filter (`34` scenes)**:
  - Included: `pm-293` (`executing`, shipping `/making-of`) + `33` `done` plans (`pm-272`, `pm-270`, `pm-264`, `pm-259`, `pm-258`, `pm-256`, `pm-255`, `pm-251`, `pm-250`, `pm-249`, `pm-247`, `pm-243`, `pm-241`, `pm-216`, `pm-214`, `pm-213`, `pm-206`, `pm-204`, `pm-203`, `pm-202`, `pm-199`, `pm-198`, `pm-197`, `pm-196`, `pm-195`, `pm-191`, `pm-190`, `pm-189`, `pm-188`, `pm-186`, `pm-184`, `pm-181`, `pm-180`).
  - Excluded (`19` unshipped plans with commits on `main`):
    - `paused` (`12`): `pm-288`, `pm-287`, `pm-286`, `pm-285`, `pm-282`, `pm-279`, `pm-276`, `pm-275`, `pm-273`, `pm-271`, `pm-269`, `pm-257`
    - `abandoned` (`6`): `pm-277`, `pm-260`, `pm-248`, `pm-242`, `pm-240`, `pm-171`
    - `executing` (`1`): `pm-268`
- **Spot-Checked Role Lineage**:
  - `pm-293`: `research: "claude-sonnet-5-5"` (`run-9227`), `product_owner: "gemini-4-argon-medium"` (`run-9252`), `software_engineer: "gemini-4-argon-high"` (`run-9264`/`run-9265`/`run-9266`), `quality_engineer: "gemini-4-argon-medium"` (`run-9249`/`run-9251`).
  - `pm-272`: `research: null`, `product_owner: null`, `software_engineer: "gpt-6.1-sol"` (`run-8928`), `quality_engineer: "gpt-6.1-sol"` (`run-8933`). `scene.roles` has `2` entries; UI renders `2` `data-testid="emaki-role-absent"` items (for `research` and `product_owner`) with no `data-model-id`.
  - `pm-255`: `research: null`, `product_owner: "claude-haiku-5-5"` (`run-8501`), `software_engineer: "claude-opus-5-5"` (`run-8502`), `quality_engineer: "claude-sonnet-5-5"` (`run-8505`). `scene.roles` has `3` entries; UI renders `1` `data-testid="emaki-role-absent"` item (for `research`) with no `data-model-id`.
  - `pm-268`: Recorded in `PLAN_RUN_HISTORY` with `quality_engineer: "gpt-6-sol"` and `shipped: false`; excluded from `content/making-of.json` and `/making-of` scenes.

---

## 4. Real/Fake Boundaries & Negative Controls

- **Real Boundaries**:
  - `npm run making-of:index` and `npm run making-of:check` execute against the real repository git history (`402` commits across `34` shipped plans) and real `content/making-of.json`.
  - `npx playwright test e2e/making-of.test.ts` launches a real production Next.js server (`next build` + `next start` via `scripts/e2e.mjs`) and drives real headless Chromium via `playwright-core` at `1366×840` desktop and `390×844` mobile viewports.
- **Fake Boundaries**:
  - `scripts/making-of-index.test.ts` uses isolated `git fast-import` temporary repositories in `/tmp` only to unit-test shallow clone splicing, gitless fallback preservation, and `--check` lag/tampering cases.
- **Negative Controls Exercised**:
  1. **Unshipped plan rejection**: Passing `pm-288`, `pm-268`, or `pm-171` to `validateMakingOf` or `checkMakingOf` returns `null` / `{ ok: false }` (`lib/making-of.test.ts`, `scripts/making-of-index.test.ts`), and E2E verifies `0` DOM nodes match `[data-scene-plan="pm-288"]`, `[data-scene-plan="pm-274"]`, `[data-scene-plan="pm-268"]`, `[data-scene-plan="pm-257"]`, `[data-scene-plan="pm-171"]`.
  2. **Wrong/defaulted model rejection**: Mutating `pm-293` PO model from `"gemini-4-argon-medium"` to `"claude-opus-5-5"` is rejected by both `validateMakingOf` and `checkMakingOf`.
  3. **Fabricated absent-role rejection**: Injecting a `research` role into `pm-272` (where `research` is `null`) is rejected by `validateMakingOf`, and E2E verifies `[data-scene-plan="pm-272"] [data-testid="emaki-role-absent"]` has `getAttribute("data-model-id") === null`.
  4. **Reduced motion negative control**: `prefers-reduced-motion: reduce` keeps `data-translate-x="0"` and `transform: none` on scroll (`e2e/making-of.test.ts`).

---

## 5. Deferred Checks

- None (`0` deferred checks).
