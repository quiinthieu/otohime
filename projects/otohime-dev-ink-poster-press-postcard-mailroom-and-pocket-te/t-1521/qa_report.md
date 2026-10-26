# QA report t-1521 (run-8604, claude-sonnet-5-5) - verdict FAIL, cause=authority

Delivery sha 2f1680c (contains 93413db); main at fd9bc0a contains it (merge-base --is-ancestor ok). Deploy not observed (no deploy from this lease); CI not observed (no gh).

## Independent evidence (fresh npm ci, this lease, Node/Next 16.4.2)
- npm test: 1756/1756 pass. typecheck exit 0; lint 0 errors/10 old warnings; build exit 0 with /postcard, /postcard/image, /postcard/view, 7 segment opengraph-images.
- e2e/postcard.test.ts: 5/5 (stamped 1200x630 PNG per page, picker with 140 cap, view noindex with og:image, image 404 on bad code).
- Real: Next build and server, Satori. Fake: none. Not proven: production site, real share sheet, emoji without network.
- Negative control: bad code -> lost-postcard view and 404 image (e2e test 4/5).

## Identity (author.txt)
- All commits author/committer Otohime <quiinthieu@gmail.com>.
- 2f1680c: Co-Authored-By trailers (anchored ^Co-Authored-By:) = 0.
- 93413db (the delivery commit): trailers = 1 ("Co-Authored-By: Claude"). plan.commit_identity forbids it, so this is a failure.
- It sits under later commits on shared main; fixing needs a history rewrite/force-push, which is forbidden. No code change can remove it.

## Verdict
Every functional check passes. Only a board-side precondition is missing: a decider waiver of the 93413db commit message. cause=authority, blocker {t-1521, "commit identity: no Co-Authored-By trailer"}. Owner: decider/operator. Once waived/reconciled, re-verify needs no code change.
