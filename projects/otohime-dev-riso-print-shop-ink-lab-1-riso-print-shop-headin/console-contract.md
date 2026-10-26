# Pocket print runs — pm-268/t-1600

Visitors can choose the site's print run with labeled native radio chips beside the Pocket console controls on Home, or in the Pocket terminal's settings. Both surfaces use the existing browser `AppearanceStore`; selecting from either surface or a command synchronizes both controls and the site's appearance immediately. No dependency or physical LCD menu item is added.

## Choices and commands

| Id | Visible label | Command |
| --- | --- | --- |
| `house` | House | `print run house` |
| `sumi` | Sumi black | `print run sumi` |
| `riso` | Riso pink + mint | `print run riso` |
| `indigo` | Indigo night | `print run indigo` |

`print run` reports the effective choice, for example `print run: Riso pink + mint (riso)`. When an explicitly applied Lab snapshot is effective, the report names that snapshot's run and appends `; Ink Lab override active`, even if the stored preset differs. The radios show this same effective run. Clicking the already checked preset also selects it, so a visitor can clear Lab overrides without changing the run or retry a failed save.

`lab`, `go lab` and `go /lab` navigate to `/lab` through `PLACES` and close the terminal. HELP and suggestions include the print-run choices and Lab navigation. This task implements the navigation effect; the public Lab page and public navigation entry are delivered by the separate Lab task. The seven-item physical console menu, LCD pitch and TitleMorph wiring remain unchanged.

Commands ignore case and repeated whitespace. Preset ids must be exact. `print`, `print riso`, `print run purple`, `print run ris`, and `print run riso extra` print usage without effects, DOM changes or storage writes. The usage line is:

```text
print run: house, sumi, riso or indigo; use print run to see the current choice
```

## Persistence and feedback

Each selection calls `setPrintRun` on the existing adapter: write the validated id to localStorage `otohime:print-run:v1`, clear sessionStorage `otohime:ink-lab:v1`, and publish the requested current-page snapshot. No other preferences are touched. Reload reads the same keys through the existing pre-paint/runtime adapters.

Successful selection reports the effective choice followed by:

```text
Saved for reload; Ink Lab override cleared.
```

If either storage-object access, write or removal throws, the current page still changes and reports:

```text
Storage is blocked; active on this page only. Reload may not retain this choice.
```

This conservative warning includes quota errors and partial writes. If local storage fails but Lab removal succeeds, reload can restore House or an earlier preset. If session removal fails, a stale persisted Lab can override the successfully written preset after reload. Neither outcome is described as saved. Retrying a chip or command attempts both operations again.

`selectPrintRun` in `components/print-run-switch.tsx` publishes the adapter's actual `AppearanceWriteResult` to a small shared, in-memory feedback subscription. Both controls show the latest selection result; command results also print in the terminal log. This subscription is necessary because a repeated choice can fail to persist without changing the appearance snapshot. External Lab/preset changes invalidate feedback for a different snapshot. Hydration uses House and no feedback on the server, then follows the browser store.

## Keyboard and focus

Each instance has a unique native radio name, a persistent Print run legend, visible chip labels, a checked state, visible focus and a polite status associated through `aria-describedby`. Outside the terminal, browser radio arrows, Space and Tab work normally; the handheld capture listener already exempts inputs.

The terminal loader captures and stops keydown at `window`, before React's target handlers. Its existing `bind()` path calls `printRunKey` for a radio in this switch: Left/Up select and focus the previous chip, Right/Down the next, wrapping at either end; Space selects the focused chip. It prevents the original default for handled selection keys and uses the native input's `click()` activation to run the same controlled selection path. Modified keys are left alone. Prompt arrows still operate the suggestion palette; typing and form submission retain their existing paths.

Tab and Shift+Tab use native order within the modal, with wrap at the first/last enabled control. Unchecked radios are excluded from the boundary list so each group has one logical stop. Chrome can also focus an overflowing log/list for keyboard scrolling; that native stop remains available. Escape closes from a radio, prompt or button and returns focus to the element that opened the terminal. Enter on the Esc button still activates it. Captured keys do not reach document or handheld listeners. The dialog's settings/prompt/header do not shrink when the log and suggestions grow; the existing scrollable log/list contain overflow.

## Architecture

```mermaid
flowchart LR
  H["Pocket radio chips"] --> S["selectPrintRun(id)"]
  T["Terminal radio chips via bind()"] --> S
  C["run: typed print run id → effect"] --> S
  S --> A["AppearanceStore.setPrintRun"]
  A --> P["local preset + clear session Lab"]
  A --> R["AppearanceRuntime: root tokens and SVG filters"]
  A --> F["AppearanceWriteResult → shared feedback + terminal log"]
  A --> U["useAppearanceSnapshot → both checked states"]
```

The parser remains pure. Its extended `TerminalState.appearance` is read when a command executes; it never trusts stale UI state. Existing adventure fixtures only gain this required state field; their assertions and behavior are preserved. `lib/pages.ts`, appearance adapters and their persistence semantics are unchanged.

## Verification and evidence boundary

Delivery verification: plan-manager run `run-8948`, `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, worker `avietidol-mac-mini` (observed through `plan_manager_get_run`); Node 22.23.3, npm 10.9.9, locked Next.js 16.4.2/React 19.3.0/Playwright 1.64.0 installed through `npm ci`. The installed Next.js Server and Client Components guide was read. The requested process documents are absent here; their host mono-v2 copies were consulted. The task's existing Next.js stack, Otohime chips and stop-at-push delivery contract take precedence over generic host migration/deployment guidance.

The runner restored the previous implementation as local WIP commit `3fa2f09` on main. All nine task files were retained, including the necessary adventure fixture state updates; no unrelated reports from the prompt were present in that commit. The prior run's supplied tail shows 2,222 unit passes and a model-capacity termination before commit/push. This run reverified the rescued code and replaces the WIP subject with the required task-prefixed delivery subject. Build-regenerated `content/history.json` is restored before committing; screenshots and logs are local artifacts, not source changes.

- `node --experimental-strip-types --test lib/terminal.test.ts`: 22 passing parser/navigation/status cases, including malformed ids and applied Lab state.
- `npm test`: 2,232 initially passed; 2,233 passed after incorporating concurrent main changes through the required push-rejection rebase. Zero failures or skips, including existing terminal, adventure, handheld/LCD and TitleMorph assertions.
- `npm run typecheck` and `npm run lint`: required static checks; lint has 10 pre-existing warnings, no errors.
- `node --experimental-strip-types scripts/e2e.mjs --test e2e/print-run-console.test.ts`: real production build, embedded PostgreSQL migrations, `next start`, installed Chrome, and the real browser appearance adapter. Eight cases cover pointer/keyboard changes, synchronization, invalid commands, actual storage read-back/reload, throwing local/session getters, quota/remove failures, stale Lab restoration, same-run persistence feedback, Tab/Shift+Tab, Escape/focus return and Lab routing.
- The existing `e2e/pocket-terminal.test.ts` was run with the feature suite to preserve lazy opening, suggestions, navigation, theme/sound/season and both adventure journeys: 14 combined cases passed, zero failures or skips. The harness built all 200 pages successfully before starting the real server.
- Browser layouts: 1366×768, 1920×1080, 390×844 and 640×450 CSS pixels (200% equivalent reflow of 1280×900, not a claim of browser-zoom automation). Pocket and terminal screenshots were opened and inspected at desktop, phone and reflow sizes: labels, selection, prompt and Escape remain visible; dense logs and suggestions scroll. Optional screenshot output uses `PRINT_RUN_CONSOLE_EVIDENCE`; local screenshots/logs and `commits.txt` belong to locally excluded `.agent-artifacts/pm-268-t-1600/`, not the source commit.

Only failure injection uses fakes: throwing real browser storage accessors/methods, and injected pure-store storage ports in unit tests. There is no fake appearance runtime or simulated command runner. Negative controls include a document key received while the terminal is shut versus stopped while open, invalid command ids that preserve storage and checked state, and actual reload restoration after failed writes.

Prior-attempt red evidence (recorded by run-8934, not independently replayed here): the initial unit test failed on the missing status export; the initial production-browser test failed on the absent visible Print run group. A later same-run write-failure regression failed by observing the earlier `Saved for reload` message; the shared result subscription fixes it. An intermediate focus assertion incorrectly excluded Chrome's native scrollable-log stop, and `networkidle` reloads timed out; browser inspection justified preserving native focus behavior and using `load` plus explicit hydration/selection readiness. One diagnostic run reused a harness server that was shutting down; its connection failures are inconclusive. Run-8948's fresh verification uses its own harness/server and has no failing local check.

This is local execution evidence for t-1600, not a deployed-product or whole-plan acceptance claim. No queued runtime or capacity deferral applies. CI, deployed acceptance and independent QA belong to plan-manager after the delivery push; this engineering run does not watch CI or probe deployment. No remote failed/completed job history is claimed as inspected; the bounded local attempts and their failures above are explicit.

## run-9005 repair and positive verification

The supplied [fix plan](fix_plan_run-8961.md) targets the deployment gate, rather than the Pocket implementation. `scripts/vercel-deploy.sh` now preserves a nonzero or timed-out inspect's state and both diagnostic outputs, then performs the existing bounded public health reads. Only the expected `GITHUB_SHA` permits success. Failure includes the last health body and the inspect diagnostics in one escaped workflow error. Upload retry limits, process-group termination, inspection timeouts and health retry bounds are retained.

The deploy regression uses a fake Vercel CLI and a real local HTTP server/curl. It asserts exact-SHA success despite inspect exit 1, wrong-SHA and connection-refused failure, preserved diagnostics, bounded timeout handling, and an old-to-expected alias transition driven by request count. This proves script orchestration, not a real Vercel deployment. A new code push starts CI through the existing main workflow; plan-manager owns the production result and deployed verification after this software-engineer run stops at push.

The source plan's t-1600 verification entries now require named positive TAP results for the parser and browser feature, a nonzero project pass count, and the named deploy fallback regression. All commands must also exit successfully. This edits the committed source contract; no SWE tool is available to mutate the board's admitted contract, so the summary calls out that distinction. Typecheck and lint remain real static-analyzer invocations with `exit0`; they do not have behavioral test names. They supplement the behavior assertions rather than proving visitor behavior themselves.

The browser invalid-command control now verifies every attempted invalid command immediately, including exact local/session storage bytes while a Lab override is applied. The preserved existing-terminal test checks one exact accessible heading and dialog name: Riso's aria-hidden visual plates intentionally duplicate raw `textContent`, while assistive technology must receive one plain name. See [summary_run-9005.md](summary_run-9005.md) for fresh counts, identities, failures and evidence limits.
