# QA report t-1533 (Desk radial menu, keyboard, sound, page turn), run-8665, verdict pass

Delivery sha 5d299a66f849180bdc3182e3009770b292402aa5 (author Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer; checked with git log). Checked out main@3b52977, which contains it (`git merge-base --is-ancestor 5d299a6 HEAD` = yes). No deploy step on this lease, so the cited deployed commit is main@3b52977. The green gate passed for 5d299a6 (supplied; not independently re-read from CI).

Fresh `npm ci`, then:
- `npm run typecheck`: exit 0
- `npm test`: 1893/1893 pass
- Independent user path: `next build` + `next start` (placeholder env), playwright-core + system Chrome, my own probe (not the SWE's). /desk 200. Results: ArrowRight moves 16.0px, Shift+ArrowDown 63.8px; aria-live says moved / turned / sent to the back / brought to the front; R rotates; no menu at 300ms, menu at 700ms with Open, Rotate, Send to back; the hold does not navigate; Esc closes; moving 30px cancels the hold; menu Send to back works; clicking the notebook opens /notes.
- One probe line "FAIL" was my expectation: after Send to back, the live region reads "menu closed" because closeMenu overwrites the "sent to the back" line. Minor a11y nit (the action's announcement is lost when done via the menu), not an acceptance failure.
- Negative control: LONG_PRESS_MS 500 -> 400 makes npm test fail (2 failures); restored, tree clean.

Real/fake boundary: real Next production server and real Chrome, no database. Audio output (stamp/rustle) was not heard or captured in my probe; sound firing is covered by source-wiring tests (5 play() calls asserted) and the SWE's fake-AudioContext probe. Leaf rotation visuals were not screenshot-verified by me beyond the notebook opening to /notes. Defect noted, not blocking: menu Send to back live line overwritten.
