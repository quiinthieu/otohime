# Washi Daruma, Emaki, and Hanafuda

Plan `pm-293`, revision 2 (cycle 1 change-request remediation). Product-owner run `run-9252`. Prior research from `rep-5449` (`run-9228`) is preserved in [research.md](research.md); cycle 1 acceptance and change-request findings are recorded in [acceptance_report_1.md](acceptance_report_1.md) and [change_request_1.md](change_request_1.md).

## Outcome

Visitors to `otohime.dev` gain three tactile paper-and-ink experiments backed by a shared build-time yearly digest, with all three cycle-1 acceptance defects resolved:

1. **Making-of Emaki (`/making-of`) — Real Per-Role Run Models & Shipped Plans Only**:
   - Each scene's per-role model (`research`, `product_owner`, `software_engineer`, `quality_engineer`) is the public model ID recorded for that role's runs on that plan in `plan-manager` (`runs.profile_flags --model`).
   - `DEFAULT_ROLE_MODELS` is removed. Any role that never ran on a plan (such as `research` and `product_owner` on `pm-272`, or `research` on `pm-255`) is omitted from `scene.roles` in `content/making-of.json` and rendered as visibly absent (`data-testid="emaki-role-absent"`, no `data-model-id`) on `/making-of`—never defaulted.
   - Scenes in `content/making-of.json` are limited to shipped plans (`status = 'done'` plus `pm-293`; unshipped `paused`, `abandoned`, `rejected`, or `executing` plans such as `pm-288`, `pm-287`, `pm-286`, `pm-285`, `pm-282`, `pm-279`, `pm-277`, `pm-276`, `pm-275`, `pm-273`, `pm-271`, `pm-269`, `pm-268`, `pm-260`, `pm-257`, `pm-248`, `pm-242`, `pm-240`, `pm-171` are excluded from the shipped handscroll).
   - `scripts/making-of-index.ts --check` verifies that every scene in `content/making-of.json` is a shipped plan and that every role's `modelId` (and absence of unrun roles) matches the committed `PLAN_RUN_HISTORY` ledger, failing on any wrong or defaulted model.
2. **Hanafuda Koi-Koi (`/play/hanafuda`) — Phone Viewport Decision & Round Banners**:
   - At `390×844` (mobile touch viewport) as well as `1366×768`, when a finger or pointer capture forms a yaku (`koi-koi-decision`) or finishes a round/match (`round-over` / `match-over`), the prompt (`[data-testid="koi-koi-prompt"]` with red hanko stamp, brush-stroke `"Koi-koi?"` heading, and `decide-koi-koi` / `decide-shobu` buttons) and the round/match banner (`[data-testid="round-result-banner"]` with `next-round-btn` / `play-again-btn`) are docked/scrolled into the viewport (`0 <= top` and `bottom <= viewportHeight`) with keyboard focus moved to the primary action button, while preserving `aria-live="polite"` text.
3. **Daruma Project Board (`/projects`) — Real Project States & Honest Unfinished Shelf**:
   - All 11 projects in `content/site.ts` (`Shore`, `Capsule`, `Orrery`, `Elements`, `Vinyl`, `Rotor`, `Planisphere`, `Barometer`, `Gazette`, `Structures`, `Design system`) reflect the owner's real history: `status: "live"`, with true October 2026 `started`, `shipped`, and `lastActivityAt` dates (no pre-repo May/June 2026 dates, and no live routes marked `building` or `shelved`).
   - Live projects display `live` badges in both Cartridges and Daruma views, have both eyes painted (`eyeState: "both"`), and match `content/yearly-log.json`.
   - When all real projects in `content/site.ts` have shipped, the Unfinished shelf and Daruma Kuyo ceremony show an honest empty state (`0` unfinished, `0` abandoned, `"Daruma Kuyo ink-fire ceremony lit: no abandoned Daruma dolls to retire."`), while supporting an explicit opt-in fixture parameter (`?fixture=kuyo` / `window.__DARUMA_FIXTURES__`) so the unfinished shelf (`left` and `none` eye states) and Kuyo ink-fire retirement ceremony can still be demonstrated on demand without misreporting live projects.

## Completed Tasks (Kept from Revision 1)

- `t-1673`: Shared yearly shipped digest (`c1c885c`)
- `t-1674`: Daruma project board and Kuyo shelf (`8b0c491`)
- `t-1675`: Making-of Emaki handscroll (`36ba86a`)
- `t-1676`: Hanafuda Koi-Koi engine and yaku (`5fd1284`)
- `t-1677`: Hanafuda Koi-Koi board and monthly backs (`db788b1`)

## Cycle 1 Task Graph

The three remediation tasks touch disjoint files and have no inter-task dependencies (`depends_on: []`):

| Sequence | Title | Depends on | QA | Interfaces |
| --- | --- | --- | --- | --- |
| 1 | Making-of Emaki run-history models and shipped scenes | — | `required` | `lib/making-of.ts`; `lib/making-of.test.ts`; `scripts/making-of-index.ts`; `scripts/making-of-index.test.ts`; `content/making-of.json`; `app/(site)/(app)/making-of/_components/emaki-scroll.tsx`; `app/(site)/(app)/making-of/making-of.css`; `e2e/making-of.test.ts` |
| 2 | Hanafuda mobile viewport Koi-koi and round prompts | — | `required` | `app/(site)/(app)/play/hanafuda/_components/hanafuda-board.tsx`; `app/(site)/(app)/play/hanafuda/hanafuda.css`; `e2e/hanafuda.test.ts` |
| 3 | Truthful Daruma project states and honest unfinished shelf | — | `required` | `content/site.ts`; `content/yearly-log.json`; `lib/daruma.ts`; `lib/daruma.test.ts`; `components/daruma-board.tsx`; `app/(site)/(app)/projects/daruma.css`; `e2e/daruma.test.ts` |

## Ground-Truth Plan & Run History (`plan_manager` DB)

Verified from `plan_manager` (`plans` and `runs.profile_flags --model`) for `repo_id = 'otohime'` (the software engineer in Task 1 should also re-query `plan_manager` at execution time in case another plan transitions to `done`):

- **Shipped plans (34 plans: `pm-293` + 33 `done` plans)**:
  - `pm-293`: `research: "claude-sonnet-5-5"`, `product_owner: "gemini-4-argon-medium"`, `software_engineer: "gemini-4-argon-high"`, `quality_engineer: "gemini-4-argon-medium"`
  - `pm-272`: `research: null`, `product_owner: null`, `software_engineer: "gpt-6.1-sol"`, `quality_engineer: "gpt-6.1-sol"`
  - `pm-270`: `research: "claude-fable-5-1"`, `product_owner: "gemini-4-argon-high"`, `software_engineer: "gpt-6.1-sol"`, `quality_engineer: "claude-sonnet-5-5"`
  - `pm-264`: `research: "claude-sonnet-5-5"`, `product_owner: "gpt-6.1-sol"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "gpt-6-sol"`
  - `pm-259`: `research: "claude-sonnet-5-5"`, `product_owner: "gpt-6.1-sol"`, `software_engineer: "gpt-6.1-sol"`, `quality_engineer: "gpt-6-sol"`
  - `pm-258`: `research: "claude-fable-5-1"`, `product_owner: "gpt-6.1-sol"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "gpt-6.1-sol"`
  - `pm-256`: `research: "claude-sonnet-5-5"`, `product_owner: "gpt-6-luna"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-255`: `research: null`, `product_owner: "claude-haiku-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-sonnet-5-5"`
  - `pm-251`: `research: "claude-opus-5-5"`, `product_owner: "claude-sonnet-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-sonnet-5-5"`
  - `pm-250`: `research: "claude-sonnet-5-5"`, `product_owner: "claude-sonnet-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-sonnet-5-5"`
  - `pm-249`: `research: "claude-sonnet-5-5"`, `product_owner: "claude-sonnet-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-sonnet-5-5"`
  - `pm-247`: `research: "claude-sonnet-5-5"`, `product_owner: "gpt-6-sol"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "gpt-6-luna"`
  - `pm-243`: `research: "claude-opus-5-5"`, `product_owner: "claude-haiku-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-sonnet-5-5"`
  - `pm-241`: `research: "claude-fable-5-1"`, `product_owner: "gpt-6.1-sol"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-216`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "gemini-3.8-flash-high"`, `quality_engineer: "gemini-3.8-flash-high"`
  - `pm-214`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-213`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-206`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-204`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-sonnet-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-203`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-sonnet-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-202`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-199`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-198`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-sonnet-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-197`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-sonnet-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-196`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-195`: `research: "claude-fable-5-1"`, `product_owner: "claude-sonnet-5-5"`, `software_engineer: "claude-sonnet-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-191`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-190`: `research: "claude-fable-5-1"`, `product_owner: "claude-sonnet-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-189`: `research: "claude-fable-5-1"`, `product_owner: "claude-sonnet-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-188`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-sonnet-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-186`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-sonnet-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-184`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-opus-5-5"`, `quality_engineer: "claude-opus-5-5"`
  - `pm-181`: `research: "claude-fable-5-1"`, `product_owner: "claude-opus-5-5"`, `software_engineer: "claude-sonnet-5-5"`, `quality_engineer: "claude-sonnet-5-5"`
  - `pm-180`: `research: "claude-fable-5-1"`, `product_owner: "claude-sonnet-5-5"`, `software_engineer: "claude-sonnet-5-5"`, `quality_engineer: "claude-sonnet-5-5"`
- **Unshipped plans in git history (19 plans — excluded from shipped Emaki scenes)**:
  - `paused`: `pm-288`, `pm-287`, `pm-286`, `pm-285`, `pm-282`, `pm-279`, `pm-276`, `pm-275`, `pm-273`, `pm-271`, `pm-269`, `pm-257`
  - `abandoned`: `pm-277`, `pm-260`, `pm-248`, `pm-242`, `pm-240`, `pm-171`
  - `executing`: `pm-268` (unless `done` at Task 1 build time)

## Prerequisites and Delivery Evidence

- **External dependencies**: None (`prerequisites: []`, `external_dependencies_reviewed: true`). All snapshots, scripts, components, and tests are repository-owned.
- **Verification discipline**: Every task verification command runs `(test -d node_modules || npm ci)` and normalizes `TMPDIR=/tmp`, restoring `content/history.json` after `scripts/e2e.mjs` runs.
