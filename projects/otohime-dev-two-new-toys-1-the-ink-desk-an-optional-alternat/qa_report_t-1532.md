# QA report t-1532 (Desk page with draggable objects), run-8634, verdict pass

Delivery sha 999fea44b5410234e2af25c124b5242235dba08c (author Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer; checked with git log). Checked out HEAD 5799048, which contains it (`git merge-base --is-ancestor 999fea4 HEAD` = yes). The repo has no deploy step in this lease, so the cited deployed commit is main@5799048.

Fresh `npm ci`, then:
- `npm run typecheck`: exit 0
- `npx eslint 'app/(site)/(app)/desk' components lib`: exit 0
- `npm test`: 1841/1841 pass (the gate's 1827 plus later commits)
- Independent user-path check: `next dev` with a dummy DATABASE_URL, GET /desk returned 200. SSR HTML has five `data-desk-item` links in registry order (notes, projects, sketches, music, play), five `data-pin` pins, a "Tidy up" button and 32 SVG paths. The home page's console figure lists DESK.
- Negative control: DRAG_THRESHOLD 6 -> 3 makes npm test fail (1 failure); file restored, tree clean.

Real/fake boundary: the real Next server rendered SSR only. Drag, spring, persistence and the live string were not driven in a browser by this run. They are covered by the unit tests, source-wiring assertions, and the SWE's 22/22 headless Chrome probe, which is not independent evidence. No deferred checks. Task 9 (radial menu, keyboard) and task 10 (mobile) are non-goals.
