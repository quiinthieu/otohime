# QA report t-1534 (Desk mobile stack, reduced motion, e2e), run-8689, verdict pass

Delivery sha 2131b2a6c71bcbe409bcb8a1918e5d01b406b3f4 (author Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer; checked with git log). Checked out main@f3e4fbb; `git merge-base --is-ancestor 2131b2a HEAD` = yes. No deploy step on this lease, so the cited deployed commit is f3e4fbb, which contains the delivery. The green gate passed for 2131b2a (supplied; not re-read from CI).

Fresh `npm ci`, then:
- `npm test`: 1926/1926 pass.
- `rm -rf .next && npm run test:e2e -- e2e/desk.test.ts`: 54/54 pass, including the 8 desk tests (drag persistence, Tidy up, keyboard, long-press menu, reduced motion, full-motion control, phone, narrow/tablet).
- Negative control: the reduced-motion rule in desk.css was replaced by `transition: all 1s`. The reduced-motion e2e (test 5) failed, 53/54. Restored with git checkout; tree clean.

Real/fake boundary: real next build and start, React, CSS media queries, rAF, Chrome transition/animation events and CDP touches. Sound is off, so audio is not exercised. CI for 2131b2a was not observed by me. No job queue or history applies to this task.
Defects: none.
