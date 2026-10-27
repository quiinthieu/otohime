# QA Report — `pm-293` / `t-1677`: Hanafuda Koi-Koi board and monthly backs

- **Plan**: `pm-293` (Washi Daruma, Emaki, and Hanafuda)
- **Task**: `t-1677` (Hanafuda Koi-Koi board and monthly backs)
- **QA Run**: `run-9244` (`role=quality_engineer`, `agent_profile=agy-argon-medium`, `model_id=gemini-4-argon`, `effort=medium`, `runner=fleet`, `worker_id=avietidol-z490`, `tm_task_id=e22b5897-d6f9-47cd-8584-7941e5475970`)
- **SWE Delivery Run**: `run-9236` (`role=software_engineer`, `agent_profile=agy-argon-high`, `model_id=gemini-4-argon`, `effort=high`, `runner=fleet`, `worker_id=avietidol-z490`, `tm_task_id=ab91ef35-9b35-4461-84eb-e88aae355a9d`)
- **Green Gate**: `ver-3671` (`run-9242`, `gate=green`, `git_sha=db788b1`, `status=pass`, `tm_task_id=508a2462-158b-4a94-b299-7a332e575bda`)
- **Delivery SHA**: `db788b1cd8a73670c906eb828401582709910017` (`db788b1`)
- **Deployed SHA (`https://otohime.dev/api/health`)**: `db788b1cd8a73670c906eb828401582709910017` (`git merge-base --is-ancestor db788b1cd8a73670c906eb828401582709910017 db788b1cd8a73670c906eb828401582709910017` -> exit `0`)
- **Verdict**: `pass`

## 1. Delivery Classification & Status

| Dimension | Status | Evidence |
| --- | --- | --- |
| **Integration deployed** | Proven | `https://otohime.dev/api/health` returned HTTP `200` `{"ok":true,"sha":"db788b1cd8a73670c906eb828401582709910017"}`; GitHub Actions CI run `40534556213` (`runNumber=521`) passed `checks` (`aria-label="completed successfully: "`) and deployed `db788b1cd8a73670c906eb828401582709910017` in `production`. |
| **Waiting for capacity** | None (`0` deferred) | All local, green-gate, and live production browser/unit suites ran immediately with zero capacity deferrals. |
| **Execution demonstrated** | Proven | Both build-contract verification suites (`hanafuda browser e2e`, `repository unit suite and types`), independent Node/React 19 SSR preflight (`qa-hanafuda-preflight.mjs`), `/play` coexistence E2E suites (`e2e/ink-press.test.ts`, `e2e/riso-headings.test.ts`), and independent Chromium negative-control suites (`qa-hanafuda-browser-negative.mjs`) executed and exited `0`. |
| **Product delivered** | Proven | Live `https://otohime.dev/play` links to `/play/hanafuda`, which renders the playable 48-card ink-and-washi Koi-Koi board against the greedy CPU with drag-to-match, tap-to-match, and keyboard arrow/Space/Enter controls, unique `ViewTransition` names (`hanafuda-table-<id>`), red hanko stamp yaku announcements, brush-stroke `'Koi-koi?'` vs `'Shobu'` prompts backed by `aria-live="polite"` text, opt-in `-25 dB` (`<= -18 dB` `MAX_DB`) WebAudio shuffle sound, and flippable monthly card backs showing shipped projects, notes, and commit counts from `content/yearly-log.json`. |

## 2. Commit Identity & Ancestry Verification

- **Commit inspected**: `db788b1cd8a73670c906eb828401582709910017`
- **Author (`git show -s --format='%an <%ae>' db788b1cd8a73670c906eb828401582709910017`, `bash scripts/setup-owner-git.sh --check`, and SWE artifact `author.txt` `sha256: 7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`, `44` bytes)**: `Otohime <quiinthieu@gmail.com>` (matches `plan.commit_identity`).
- **Trailers (`git show -s --format='%b' db788b1cd8a73670c906eb828401582709910017`)**: Empty — no `Co-Authored-By` or AI attribution trailer.
- **Subject**: `pm-293/t-1677: add playable Hanafuda Koi-Koi board and monthly log backs`
- **Ancestry check**: `git merge-base --is-ancestor db788b1cd8a73670c906eb828401582709910017 db788b1cd8a73670c906eb828401582709910017` -> exit `0`.

## 3. Executable Fingerprint & Real/Fake Boundaries

### Locked Environment & Artifact Hashes (SHA-256)
- **Runtime**: Node `v22.23.3` (`/home/avietidol/.local/bin/node`, `linux-x64`), `next@16.4.2` (production build ID `-br9VRw4D6mmHxSS2yVWT`), `react@19.3.0`, `playwright-core@1.64.0`, Headless Chromium.
- `package-lock.json`: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`
- `lib/sound.ts`: `c9e1326c5fe38e1e87214e0781e7aae846e58f83b1b4a139fb4be69cdf270205`
- `lib/sound.test.ts`: `afbe977167397841a34f0aaecb5b9fe96304338a2ae931ad15ffebbc7283d036`
- `lib/hanafuda/deck.ts`: `0c0c48f8c3f918b4d0b15b5ecdef92be4888f828dac80b3cb5893f0d5a44def8`
- `lib/hanafuda/yaku.ts`: `9e2bcc337100104536b8debaa5f6df72e99ac27c43f125cbac44ab93da0e7795`
- `lib/hanafuda/engine.ts`: `645b59db0285b879aabdb774b3d01344d5b64291a44b2922557a8b8f1c4cc80b`
- `lib/yearly-log.ts`: `1cb63c71ac38a8ab42209a232af2d4ed98fa52295d0b41ff927bcb52c6c25db0`
- `content/yearly-log.json`: `c3233c09fd9b3e214ab92d991a419c0b1f9ca8db7249cbc3f936054bd4685876`
- `app/(site)/(app)/play/page.tsx`: `fe8d97c0099c861fcff641c29f4ab6668c7cbc3f7ae4d6de819b2e380541935f`
- `app/(site)/(app)/play/hanafuda/page.tsx`: `c8e4e662dfa6a1caa791e64f88c9116354d25e07963d47fbd60b183d45e17800`
- `app/(site)/(app)/play/hanafuda/hanafuda.css`: `ae03bd820c14b6eb2bf8f948c2030423d88d80fc5b948d727f6430545b62c997`
- `app/(site)/(app)/play/hanafuda/_components/hanafuda-board.tsx`: `2fb91a38eb09a269a1d250ef11bb6255f25cea1f5efefee14c685fa2820e36c1`
- `app/(site)/(app)/play/hanafuda/_components/hanafuda-card.tsx`: `2807841f3d1330426b08d189c93c7d5cd9c068275bfccddc071b2a2dad275f5b`
- `e2e/hanafuda.test.ts`: `8b5a6649d5e3c4a999743440b3402b3ac63cd4ab42bff84eb1370c54bf1a0e77`

### Real vs. Fake Boundaries
- **Real**: Next.js 16.4.2 production build (`next build` + `next start`), real embedded PostgreSQL 17 with Drizzle migrations (`scripts/e2e.mjs`), real React 19 `renderToStaticMarkup` SSR tree construction across all 48 cards and 12 months, real headless Chromium browser rendering, real `document.startViewTransition` and `window.AudioContext` in Chromium, and real live Vercel production deployment (`https://otohime.dev`).
- **Fake / Stand-in**: `FakeAudioContext` in Node unit test `lib/sound.test.ts` (used to verify envelope gains without a browser); in Chromium E2E (`e2e/hanafuda.test.ts`), the real `window.AudioContext` is wrapped only by a pass-through telemetry subclass to count `createOscillator()` calls and record peak `GainNode` values.

## 4. Bounded Paginated Run & Task History Inspection

- **`plan_manager_list_runs(plan_id="pm-293")`** (complete scan: `13 / 13` runs on plan `pm-293`):
  - `run-9228` (`research`, `claude-sonnet-medium`, `tm_task_id=a9b766fa-f77b-4d64-9a57-c8dbd2f9d215`): `succeeded`
  - `run-9229` (`product_owner`, `agy-argon-medium`, `086e991`, `tm_task_id=e9450dfe-56cd-4624-a974-06595fa0f5cc`): `succeeded`
  - `run-9230` (`t-1673`, `software_engineer`, `agy-argon-high`, `c1c885c`, `tm_task_id=52dad46a-cbc6-451f-8ccf-9718fa4d4527`): `succeeded`
  - `run-9231` (`t-1673`, `verify`, `c1c885c`, `tm_task_id=43471b63-a4cd-4afd-a346-7041a515ac5d`): `succeeded`
  - `run-9232` (`t-1676`, `software_engineer`, `agy-argon-high`, `5fd1284`, `tm_task_id=64c846b3-1fd7-42a6-bb83-d4a92e6244fa`): `succeeded`
  - `run-9233` (`t-1676`, `verify`, `5fd1284`, `tm_task_id=1faced93-14f4-4e90-846c-1ccb0391fef6`): `succeeded`
  - `run-9234` (`t-1674`, `software_engineer`, `agy-argon-high`, `8b0c491`, `tm_task_id=e11f2717-152c-48a7-9a57-754e47db243f`): `succeeded`
  - `run-9235` (`t-1674`, `verify`, `8b0c491`, `tm_task_id=a54b57d7-e678-43d8-a41d-87335d579f86`): `succeeded`
  - `run-9236` (`t-1677`, `software_engineer`, `agy-argon-high`, `db788b1`, `tm_task_id=ab91ef35-9b35-4461-84eb-e88aae355a9d`): `succeeded` (attempt 1, 0 retries, `callbackState="delivered"`)
  - `run-9237` (`t-1674`, `quality_engineer`, `agy-argon-medium`, `6a2e327`, `tm_task_id=8a295849-a0cc-49b2-b384-95e62f2f146a`): `succeeded`
  - `run-9242` (`t-1677`, `verify`, `db788b1`, `tm_task_id=508a2462-158b-4a94-b299-7a332e575bda`): `succeeded` (`ver-3671` green gate pass, `callbackState="delivered"`)
  - `run-9243` (`t-1675`, `software_engineer`, `agy-argon-high`, `tm_task_id=4284548d-f1f4-48a4-ba0c-5a5ebdc94f67`): `running`
  - `run-9244` (`t-1677`, `quality_engineer`, `agy-argon-medium`, `tm_task_id=e22b5897-d6f9-47cd-8584-7941e5475970`): `running` (this QA run)
- **`task_manager_list_tasks` bounded scan** (`limit=20, offset=0` per status):
  - `PENDING`: `0` tasks (`complete`).
  - `RUNNING`: `4` tasks (`complete`, 3 on `otohime` including `e22b5897-d6f9-47cd-8584-7941e5475970` for `run-9244`).
  - `COMPLETED`: `20` tasks scanned (`5` on `otohime`, including `508a2462-158b-4a94-b299-7a332e575bda` for green gate `run-9242` on `db788b1`, callback ingested as `ver-3671`).
  - `FAILED`: `20` tasks scanned (`6` on `otohime` from earlier plans `pm-268`, `pm-259`, `pm-270`; `0` failures match `pm-293/t-1677` or fingerprint `db788b1`).

## 5. Verification Suites & Independent QA Evidence

1. **Contract Check 1 — `hanafuda browser e2e`**:
   - Command: `(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/hanafuda.test.ts' && git checkout -- content/history.json`
   - Result: Exit `0` (`5 / 5` Chromium E2E tests passed in `14,604.2ms` against fresh production build `-br9VRw4D6mmHxSS2yVWT` + real embedded Postgres 17).
2. **Contract Check 2 — `repository unit suite and types`**:
   - Command: `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint`
   - Result: Exit `0` (`2,552 / 2,552` unit and main-lane closure tests passed in `20,040.0ms`, `next typegen && tsc --noEmit` exited `0`, `eslint` exited `0` with `0` errors).
3. **Independent QA Preflight & React 19 SSR Construction (`qa-hanafuda-preflight.mjs`)**:
   - Directly imported `lib/sound.ts`, `lib/yearly-log.ts`, `lib/hanafuda/deck.ts`, `lib/hanafuda/yaku.ts`, `lib/hanafuda/engine.ts`, `app/(site)/(app)/play/hanafuda/_components/hanafuda-card.tsx`, and `app/(site)/(app)/play/hanafuda/_components/hanafuda-board.tsx` in locked Node `v22.23.3` + `react-dom/server` `renderToStaticMarkup`.
   - Verified `CUES.shuffle` (`db: -25`, 6 notes, `cueGain <= dbToGain(-18)`), `readYearlyLog` fallback to `EMPTY_YEARLY_LOG` on invalid version/head, valid SVG and card-back SSR markup across all 48 cards and 12 months (`231,449` bytes SSR output for `<HanafudaBoard />`), and engine rejections for non-hand card IDs (`not in human's hand`), invalid custom card IDs (`Invalid Hanafuda card reference`), and invalid 2-way field match targets (`not a valid match choice`).
4. **Independent Negative Controls & Live Production (`https://otohime.dev`) Verification**:
   - Ran both `e2e/hanafuda.test.ts` (`5 / 5` passed) and independent `qa-hanafuda-browser-negative.mjs` (`1 / 1` passed) against both the local production server and live `BASE_URL=https://otohime.dev` (`24,018.3ms` total):
     - **Negative control 1 (Invalid query params fallback)**: `/play/hanafuda?seed=-99&flip=13` ignores negative seed (`data-seed="53"`) and out-of-range month (`data-spotlight-month="10"`, `0` flipped deck tiles), while `/play/hanafuda?seed=151&flip=9` normalizes `flip=9` to Month `09` (`4` flipped Chrysanthemum deck tiles).
     - **Negative control 2 (Non-matching suit drop rejection)**: On Seed 53, dragging `03-hikari-curtain` (Month 3 Cherry) onto a non-Month-3 field card is rejected when a valid Month 3 match (`03-tanzaku-akatan`) is on the field: both cards remain in their zones, `0` cards are captured, and `aria-live="polite"` announces `does not match that card. Match a Month 3 Cherry card.`
     - **Negative control 3 (Single-card flip isolation & zero-match discard)**: Clicking `[data-flip-card="03-hikari-curtain"]` flips only `03-hikari-curtain` (`data-flipped="true"`) while leaving `03-tanzaku-akatan` face-up (`data-flipped="false"`), and selecting an unmatched hand card + clicking `[data-testid="discard-to-field"]` discards it cleanly to the field.
     - **Coexistence on `/play` (`e2e/ink-press.test.ts` + `e2e/riso-headings.test.ts`)**: `12 / 12` tests passed (`0` console or page errors).

## 6. Defects & Deferred Checks

- **Defects observed**: None (`0`).
- **Deferred checks**: None (`0`). All acceptance criteria and verification checks are proven now.
