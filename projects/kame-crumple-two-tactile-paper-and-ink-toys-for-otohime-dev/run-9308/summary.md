# pm-274/t-1584 · Reversible Canvas paper folds

Run run-9308, branch `pm-274-t-1584-crumple`, based on freshly fetched main
`2cc83e69630cbc2c7faa4072cf7ae5e993b2612b`. Delivery SHA is the enclosing commit
and the exact pushed SHA in this run's plan-manager summary `git_sha` field.
Actual run: codex-sol-6-1-high / gpt-6.1-sol / high; fleet avietidol-mac-mini.

Project and note cards now fold into seeded, ink-creased Canvas balls through
Crumple/keyboard or the shared 600ms grip/blank-paper hold. Native selection,
links, scrolling and corner peel retain their input. Read card, source focus and
Reset restore content synchronously. Eight slots include pending imports; the
ninth action announces the limit without changing its source. Original DOM,
accessible names, hrefs and source geometry remain intact. The renderer is loaded
only on first action after the existing load/idle activation, caps DPR at 2, uses
no new dependency, and paints a static final ball under reduced motion.

Renderer import/context/paint/loss failures and lifecycle cancellation restore
paper and release frames, bitmap, slot and import generation. Reset also clears
peel/fetch. Real hit testing caught wrapped controls behind another shelf slot;
the route stylesheet now raises that enclosing slot. A live motion change exposed
the global 0.01ms opacity tween on source SVGs; scoped transition suppression
preserves immediate restoration without weakening the regression assertion.

| Required gate | Observed assertions |
| --- | --- |
| Fold geometry and gesture boundaries | 19 passed; 0 failed/skipped |
| Repository `npm test` | 2,612 passed; 0 failed/skipped |
| Lint and type contracts | ESLint 0 errors, 10 existing warnings; Next typegen and tsc passed |
| Production crumple/fetch/peel | 27 passed; 0 failed/skipped |

The new fold tests failed before implementation. Browser proof reads real Canvas
pixels, varied crease colors, compact transparent bounds and DPR; compares source
accessibility snapshots, attributes, text/hrefs and geometry; and drives native
Chrome mouse, keyboard and CDP touch. Negative controls block the real renderer
request, hold/release a delayed import after Read, return null Canvas, throw paint,
dispatch context loss, reject a ninth ball and preserve touch body scrolling.
Subsequent real Canvas folds recover after context/paint controls. Existing fetch
arrival/return and unreachable-turtle negative controls also pass.

Production build `10POThptT-ILqm5o3aY9C`, Node 22.23.3, Next 16.4.2,
locked Playwright 1.64.0, installed native Chrome 156.0.8078.48 and a real migrated
temporary embedded Postgres demonstrate local execution. Positive paper proof
uses real Canvas, not a fake renderer. Failure injection and the runner's unrelated
Ghosts service are fixtures. Source/lock/config/chunk hashes, complete relevant
browser TAP and named unit/counter evidence are in `artifacts/`. The screenshot
was inspected locally and omitted from Git to honor the no-binaries requirement.

Pre-push history read two FAILED pages (20/152) and two COMPLETED pages (20/538),
with overlapping filters; older pages remain unread, so completeness is
inconclusive. In-progress and queued were both 0/0. Prior run 40635091133,
job 122640103971 at unrelated SHA 68dd79dba309c7713122e08b02ebb4e6844de749,
failed Footer Chromium on an unverified YouTube embed frame (175 pass, 1 fail).
Its raw log returned HTTP403; the public bounded annotation and runner tail were
read. That older build does not prove this fold implementation's CI status. No
async product runtime, callback ingestion or capacity wait applies here.

Local execution is demonstrated. Integration deployment and product delivery
remain unobserved at this engineering boundary. Platform CI owns the pushed-SHA
green gate; independent QA/acceptance owns deployed identity and real interaction
proof. Failure conditions are any missing/red/skipped gate, incorrect served
identity or content/accessibility/input/geometry regression. Engineering stops
after push without watching CI or checking the deployed site.

The referenced extraction/software-development documents are absent in this
checkout; AGENTS.md, installed Next guides and the explicit task contract were
used. The checked-in plan.md still describes pm-259 recovery. Decisions and lessons
record these mismatches, static-tool evidence boundaries, the pinned foundation
inventory and the two real visual/input defects found and fixed.
