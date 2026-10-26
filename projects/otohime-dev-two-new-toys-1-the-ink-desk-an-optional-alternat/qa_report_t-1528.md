# QA report t-1528 (Ledger page with stamp calendar), run-8648, verdict pass

Delivery sha d21426a36166859a46d783ba064eee9e6b731e1e (author Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer; checked with git log). Checked out HEAD 82c5e42, which contains it (`git merge-base --is-ancestor d21426a HEAD` = yes). The repo has no deploy step in this lease, so the cited deployed commit is main@82c5e42. The green gate passed for d21426a.

Fresh `npm ci`, then:
- `npm run typecheck`: exit 0
- `npx eslint 'app/(site)/(app)/ledger' components`: exit 0
- `npm test`: 1877/1877 pass
- Independent user path: `next dev` with placeholder env, GET /ledger 200. SSR HTML has 365 role=button cells, exactly one tabindex=0, labels like "27 Oct: no ink", `as of <time dateTime="2026-10-26">26 Oct 2026`. GET /work contains href="/ledger". (6 `<filter` tags in the page: 4 shared smudge filters plus site-level ones, not one per cell.)
- Negative control: ArrowRight step WEEKDAYS -> 1 in _lib/calendar.ts makes npm test fail (2 failures); file restored, tree clean.

Real/fake boundary: the real Next server rendered SSR only. Hover/focus/tap receipt behaviour was not driven in a browser (headless Chrome never reaches the dev server on this lease, a known lesson). It is covered by source-wiring assertions (onFocus, onPointerEnter, onClick, onKeyDown) and pure-helper tests, which are not browser evidence. Deferred: browser receipt check, owner task 5 (press replay + e2e); fails if hovering, focusing or tapping a /ledger cell shows no receipt. Press animation is a non-goal here.
