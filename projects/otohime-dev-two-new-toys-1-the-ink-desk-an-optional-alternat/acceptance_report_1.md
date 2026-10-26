---
plan_id: pm-250
run_id: run-8693
kind: acceptance_report
verdict: pass
cycle: 1
---
# Acceptance pm-250 (Ink Desk and Ledger): pass

| Starting state | Action | Observable result | Evidence |
|---|---|---|---|
| Fresh `npm ci`, `next build` (exit 0, /desk and /ledger routes listed), `next start` on main@2f0313b, 1366x768 Chrome | Open `/`, look at the console figure | Console lists a DESK cartridge | probe: home contains "DESK" |
| /desk, 1366x768, empty localStorage | Load | 5 objects (notebook, projects and sketches polaroids with washi tape, cassette, pocket console), cork board with 5 pins and a red string linking projects | screenshot desk-1366.png; 5 `data-desk-item`, 5 `data-pin` |
| Same | Drag the first object (+150,+80 px) then reload | Moved 149.7/79.7 px, `desk:v1` written, position persisted after reload (dy differs 6 px from wobble/rotation) | probe output |
| Same | Click Tidy up | Object returns to default (0.3, -5.6 px from start) | probe |
| Same | Hold the mouse on an object 800 ms | Radial menu: Open, Rotate, Send to back | probe |
| /ledger, 1366x768 | Load, hover a day, click Press | 365 cells, as-of 26 Oct 2026, 3 notes stamps with NEW marks, receipt popover ("FRI 15 MAY 2026 / no ink today"), Press button runs without error; linked from /work | screenshot ledger-hover.png, probe |
| /desk and /ledger, 390x844 touch | Load, tap a ledger cell | Desk is a stacked single-column (no horizontal scroll, no drag area), cork pins listed; ledger 365 cells, no horizontal overflow, tap works | screenshot desk-390.png, probe |
| Negative control: `GITHUB_TOKEN=bogus node scripts/ledger-fetch.mjs` | Run | Exits 0, prints "kept content/ledger.json (GitHub GraphQL: HTTP 401)", tree unchanged | command output |
| Whole repo | `npm test` | 1926/1926 pass | run output |

Identities: cited sha 2f0313bcc9ae3184406160fcdb033760ad37b91a (contains the task deliveries a117f48 … 2131b2a; all authored Otohime <quiinthieu@gmail.com>, 0 Co-Authored-By in the last 12 commits). Local build, no deployed environment exists on this lease; build id = this local `.next` from that sha.

Logs: after setting BETTER_AUTH_SECRET (my first start without it logged BetterAuth default-secret errors, an environment omission, not a pm-250 defect) the server log had 0 errors and the browser pageerror/console error lists were empty on /desk and /ledger at both viewports.

Real/fake boundary: real build, server, Chrome (desktop mouse and mobile touch emulation). Sound output was not heard (not driven; covered by tasks' unit tests with fake AudioContext). Real GitHub data was not fetched: no GITHUB_TOKEN here and the network call returned 401 with the bogus token, so only the fallback path is demonstrated live. The shipped fallback `content/ledger.json` holds 3 notes days and 0 commits, so until a build runs with GITHUB_TOKEN the ledger shows no commit ink. This is by plan design (token optional), noted as a caveat, not a defect. Deferred: first build with GITHUB_TOKEN in the deploy env; owner: site owner; broken if the build log says "kept" despite a valid token or /ledger still shows 0 commits.

Defect noted from QA, not blocking: the menu's "Send to back" live announcement is overwritten by "menu closed". No job queue/history applies.
