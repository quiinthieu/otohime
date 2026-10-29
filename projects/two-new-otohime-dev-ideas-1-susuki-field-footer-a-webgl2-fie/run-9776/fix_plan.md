# t-1768 authority fix plan — run-9776

Cause: **authority**, under the existing answered operator action **esc-475**. The missing precondition is independent access to the original delivery artifact. No application or CI file/line can repair this authorization, and no code fix cycle is warranted.

The operator must sign in to task-manager and grant QA read access to `0671daac-7af4-4d24-8d86-920cecb2f1fb/artifacts/author.txt`, or attach its exact **44 bytes** to the existing action. Never send credentials or reconstruct bytes from Git identity or a digest. Expected SHA-256: `7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`.

QA then reads those original bytes, checks that digest, checks **Otohime <quiinthieu@gmail.com>** and absence of `Co-Authored-By`, and refreshes delivery/deployed commit ancestry and executable fingerprint checks before any passing verdict. Git's independent matching author is supporting evidence, not a substitute for the protected file. This run's current delivery and deployed identity is `017810c694e4e9ea256fc543b3ec213695875cc6`; green gate `ver-3885` passes that delivery.

Deferred item **t-1768/delivery-author-artifact**: operator owns access, QE owns verification. Failure condition: unreadable bytes, a digest/identity/trailer mismatch, or deployment that cannot be bound to delivery. Existing esc-475 answers that access cannot be supplied now and explicitly preserves failing QA; it is not an acceptance waiver. Resume QA on the operator outcome, without polling or waiting.

Pipeline action: **none for this authorization gap**. The board expressly prohibits rerunning CI for it. Existing passing local gates and real deployed execution cannot waive the protected artifact. CI and provider-side production logs inaccessible to this run remain unproven; on resumed QA, inspect terminal failures rather than treating a pending/replaced workflow as green. Do not spend a code fix cycle on access, alter source, or ask an operator to choose policy.
