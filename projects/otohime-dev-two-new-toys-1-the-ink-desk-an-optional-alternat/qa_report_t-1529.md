# QA report t-1529 (Ledger Press replay, reduced motion, e2e), run-8679, verdict pass

Delivery sha a9b36452a2e60755f71ac29a9f5866d5f7f22cf7 (author Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer; checked with git log). Checked out main@a9b3645 (no deploy step on this lease; the cited deployed commit is a9b3645 itself, `git merge-base --is-ancestor a9b3645 HEAD` = yes). The green gate passed for a9b3645 (supplied; not re-read from CI).

Fresh `npm ci`, then:
- `npm test`: 1912/1912 pass.
- `rm -rf .next && npm run test:e2e -- e2e/ledger.test.ts`: exit 0, 46/46, including the 4 ledger tests (keyboard receipt, Press 365 days in 349 ticks with 53 thuds, reduced motion, 390x844 phone).
- Negative control: the ledger.css reduced-motion `transition: none` rule disabled -> the reduced-motion e2e (test 7) fails, 45/46; restored with git checkout, tree clean.

Real/fake boundary: real next build + next start, React, CSS, rAF and Chrome transition events. AudioContext is faked in the test (counts oscillator starts), so audible output is not proven. CI for a9b3645 was not observed by me. History/queue scan: not applicable (no job queue in this task).
Defects: none blocking.
