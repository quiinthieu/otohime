---
plan_id: pm-214
run_id: run-7075
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: fa501d665456c83e3d6712b4857807ab68659e92
---

# Acceptance: Structures Notebook (pm-214), cycle 1

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev/projects, 1366x768 and 390x844, light | Read the bench; click "Structures" | One `/structures` link, last row, with the mint dot `#93d3b0` (the same colour as Shore's) and the note "Eight ways to keep things, drawn by hand so you can poke them."; the title carries `--vt:project-structures` and lands on `/structures` whose visible `h1` "Structures" has `view-transition-name: project-structures` | `mywalk.log` desk/phone lines 1–6; `motion.log`: pageswap and pagereveal of type hop, fade out 150 ms, fade in 210 ms, "the title moves as project-structures" |
| `/structures` | Read the index | Eight rows in teaching order (array, linked-list, stack, queue, hash-table, binary-search-tree, heap, graph), each with an In life thumbnail, a deck and three cost-dot rows; the dots read 3/3/3, 3/1/3, 1/1/1, 1/1/1, 1/1/1, 2/2/2, 1/2/2, 3/1/1, which match the plan's bands | `desk-02-index.png`, `mywalk.log` "index lists eight pages in order" |
| `/structures/stack`, JS on | Wait for hydration; type 9, Push | The three figures (In life, machine, costs) are present with the caption "In life: The last plate on is the first plate off."; the controls enable after hydration; the drawing starts at "1, 7 and 2, with 2 on top"; Push 9 plays in beats (narration "9 goes on top." arrives 747 ms desk / 851 ms phone after the press, with 2 elements lit red mid-move), the label then ends "with 9 on top", "Counted: 1 step", the trace lists 2 beats | `phone-03-stack-push-mid.png`, `phone-04-stack-after-push.png`, `mywalk.log` |
| stack with 9 on top | Pop | "9 comes off; 2 is on top now.", the label no longer has 9, "Counted: 1 step" | `mywalk.log` |
| stack, 3 plates | Push 5, 6, 7, 8, 9 (now 7 plates), then push 42 | "The pile has 7 plates and is full, so 42 would overflow it."; the drawing's label is unchanged | `desk-05-stack-full.png`, `mywalk.log` |
| stack | Compare the costs card with the machine | The card says find, add and remove are "about the same, whatever the size", 1 step each; Push and Pop above each counted 1 step | `phone-04-stack-after-push.png` |
| stack | Click "Next: The queue" | `/structures/queue`, `h1` "The queue"; Join 4 → "4 joins the back of the line.", Counted: 2 steps; Leave → "2 leaves the front of the line.", Counted: 2 steps, the label reads "front to back: 9, 6, 1, 8, 3, 7 and 4" with the head hand on tile 2 and the tail hand on tile 1 | `desk-06-queue.png`, `mywalk.log` |
| queue | Click "← All pages" | Back on `/structures` with its eight rows | `mywalk.log` |
| `/structures/graph` | From A, "Ripple from" | "Lit all 8 stations in 8 steps; the farthest is 3 hops away.", Counted: 8 steps; the costs card's find row shows 8 boxes and "8 steps" | `desk-07-graph.png` |
| `/structures/heap`, JavaScript off, both viewports | Load; click Next | The machine shows the example's end state (tree 3/4/8/5 and the row 3 4 8 5 in boxes 0–3), the narration "The smallest, 1, is out in 3 steps.", a 5-step numbered trace, and `<fieldset disabled>` greyed controls (`fieldset.disabled === true`, inner input `:disabled`); Next reaches `/structures/graph` without JS | `phone-10-heap-nojs.png`, `nojs.mjs` output, `walk2.log` |
| `/structures/nope` | Load | HTTP 404, "Not in this series.", a link back to `/structures` | `desk-08-404.png`, curl 404 |
| 320x640 | Load `/structures`, `/structures/stack`, `/structures/heap` | `scrollWidth` 320 on all three: nothing scrolls sideways | `phone-09-stack-320.png`, `mywalk.log` |
| `/structures/binary-search-tree`, dark scheme, reduced motion | Load; keyboard only: focus the number box, type 6, Enter | Paper `rgb(22, 21, 19)`; the In life paths have `stroke-dashoffset: 0` and `animation: none` (drawn complete); "Found 6 in 3 steps." lands in 3 ms (at once) with the trace "6 is less than 8, so go left. / 6 is more than 3, so go right. / This is 6: found it. / Found 6 in 3 steps." | `desk-11-bst-dark.png`, `mywalk.log` |
| search tree, Step mode | Find 7, press "Next step" twice | The trace grows one beat a press (1 → 2 → 3), ending "7 is more than 6, so go right, but there is nothing there." | `desk-11-bst-dark.png` |
| every page above, light and dark | Watch the console | 0 page errors and 0 console errors; the only console lines are Chrome's own "Failed to load resource: 404" for `/structures/nope` | `mywalk.log` last lines |
| production, the plan's Acceptance lines | `BASE_URL=https://otohime.dev` with `EXPECT_SHA=fa501d6…`: `walk-structures.sh`, `probe-structures.sh`, `probe-motion.sh` | `walk: 195 ok, 0 failed`; `probe: 62 ok, 0 failed`; `probe: 486 ok, 0 failed`; all exit 0 | `walk2.log`, `probe.log`, `motion.log` |

## Verdict

**Pass.** The idea asked for a series that explains data structures with illustration and infographics, interactive if possible. On otohime.dev a person finds Structures on the Projects bench, reads an index of eight hand-drawn pages, and on each page sees an everyday drawing with its rule, a machine they can work by button or keyboard that narrates every beat and counts the steps, and a costs infographic whose numbers the machine reproduces. Without JavaScript the pages still explain the worked example. Both viewports, 320 px, dark, reduced motion and the 404 behave.

## Deployed sha and identity

- **Deployed:** `fa501d665456c83e3d6712b4857807ab68659e92`, read from `<meta name="build-sha">` on https://otohime.dev/ and /structures on 2026-10-21T07:4xZ. By 08:00Z the meta on `/`, `/projects` and `/structures` read `62eb0d71d7c67892d6d78b6544cd2d2eb2e0dcb3`, this report's own commit, which adds only this Markdown on top of fa501d6 (`git merge-base --is-ancestor` ok); the re-walk below ran against it. It is t-1222's delivery sha and contains t-1220 (db59176) and t-1221 (045f87c), which have no deployable surface of their own: the whole plan is one Vercel deployment of otohime.dev.
- **Author:** `git log` shows every plan commit (db59176, 045f87c, fa501d6, 4b06a5f) authored and committed by `Otohime <quiinthieu@gmail.com>` with no Co-Authored-By trailer. No author.txt came with the delivery evidence; the identity is read from git.
- **Logs:** otohime.dev is a static Vercel deployment and this lease holds no Vercel or GitHub credentials, so the browser's page and console errors across every page walked stand in for service logs: none.

## How it was walked

Playwright 1.64 (headless Chromium shell) from a scratch prefix in `/tmp/acc214`, my own `walk.mjs` against production at 1366x768 and 390x844 (isMobile, hasTouch), then 320x640, a `javaScriptEnabled: false` context, and a `colorScheme: dark` + `reducedMotion: reduce` context; 24 full-page screenshots, of which I read the index, the stack after Push 9 at 390, the graph, the heap with JS off at 390 and the search tree in dark. Lines: 76 ok. Two lines first read "not ok" for the JS-off fieldset because Playwright's `isDisabled()` ignores `<fieldset>`; a DOM read and the served HTML show it disabled (lesson recorded). The repo's three production scripts were run a second time after `npm ci`, since the walk's self-check greps `node_modules/roughjs`.

## Noted, not blocking

- The walk-structures self-check `the rough.js pattern matches rough.js` needs `node_modules` even with `BASE_URL`, so a fresh checkout without `npm ci` reports 194/1. Cosmetic, same family as the QA's `linkednonelist` nit.
- Advisory questions on the plan: none open.

## Re-walk after the run was relaunched (08:00Z to 08:1xZ, this lease)

The run's first session submitted the report above and pushed it, then ended
without closing the run. The second session walked production again, now at
build-sha `62eb0d7`, from a fresh `npm ci` and a copy of `walk.mjs` in
`/tmp/acc214b` (the JS-off fieldset check now reads `fieldset.disabled` from
the DOM). Everything held:

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev, 1366x768 and 390x844, light | `/projects` → Structures → index → stack → Push 9, Pop, five pushes and a push on a full pile → Next → queue Join 4, Leave → `← All pages` → graph Ripple from A → `/structures/nope` | Same results as the table above: mint dot `#93d3b0` once; eight rows in order with drawings and dots; "9 goes on top." after 524 ms desk / 719 ms phone with 2 elements lit mid-move, "Counted: 1 step", trace of 2 beats; Pop drops the 9; "The pile has 7 plates and is full, so 42 would overflow it." with the drawing unchanged; the queue's Join and Leave count 2 steps each; the ripple counts 8 and the card shows 8; the 404 says "Not in this series." | `/tmp/acc214b/mywalk.log`: 78 ok, 0 failed; `shots/desk-02-index.png`, `phone-04-stack-after-push.png` read by eye |
| 320x640 | `/structures`, `/structures/stack`, `/structures/heap` | `scrollWidth` 320 on all three | `mywalk.log` |
| JS off, both viewports | `/structures/heap`; click Next | `fieldset.disabled === true` and the input `:disabled`; 5-step trace; "The smallest, 1, is out in 3 steps."; the row 3 4 8 5; Next reaches the graph | `mywalk.log` |
| dark, reduced motion, keyboard only | `/structures/binary-search-tree`: type 6, Enter; Step mode Find 7, Next step twice | paper `rgb(22, 21, 19)`; In life paths `stroke-dashoffset: 0`, `animation: none`; "Found 6 in 3 steps." in 3 ms; the trace grows 1 → 2 → 3 | `mywalk.log` |
| console, every page above | | 0 page errors, 0 console errors apart from Chrome's resource-404 line on the 404 page | `mywalk.log` |
| the plan's Acceptance lines, `BASE_URL=https://otohime.dev` | `walk-structures.sh` with `EXPECT_SHA=62eb0d7…`; `probe-structures.sh`; `probe-motion.sh` | `walk: 195 ok, 0 failed`; `probe: 62 ok, 0 failed` (Find 6 ≥ 1,000 ms with motion, ≤ 250 ms reduced, axe clean on `/structures` and `/structures/heap` at both sizes, light and dark); `probe: 486 ok, 0 failed` | `/tmp/acc214b/walk.log`, `probe.log`, `motion.log` |

Identity, re-read from `git log fa501d6~3..HEAD`: every commit (db59176, 045f87c,
fa501d6, 4b06a5f, 62eb0d7) has author and committer `Otohime <quiinthieu@gmail.com>`
and zero `Co-Authored-By` lines. This lease has no GitHub or Vercel login
(`gh auth status`: not logged in), so the deploy is judged by the build-sha
meta the site serves.
