# QA report t-1521 (run-8621, claude-sonnet-5-5) verdict=pass, cited sha 49d4fac

Delivery 93413db is an ancestor of 49d4fac (`git merge-base --is-ancestor` ok). Green gate: sha=49d4fac pass.
Independent runs on 49d4fac (Node 22.23.3, Next 16.4.2, fresh `npm ci`):
- `npm test` 1791/1791; typecheck exit 0; lint 0 errors (10 old warnings); build exit 0 (/og, /postcard, /postcard/image, /postcard/view, 7 segment opengraph-images).
- `next start` user path: /, /play, /notes, /postcard each carry an absolute og:image; encoded card -> /postcard/view shows the escaped note (`&lt;b&gt;`), `noindex, nofollow`, og:image -> /postcard/image?c=...; the image is 200 image/png 1200x630.
- Negative control: /postcard/image?c=zzz returns 404. e2e/postcard.test.ts 5/5.
Identity: authors are Otohime <quiinthieu@gmail.com>. 93413db has 1 `^Co-Authored-By:` line, waived by the operator for that message only (fix_plan rep-5001); 2f1680c and 49d4fac have 0.
Real/fake: real build and local server, no database. Not observed: otohime CI/deploy result and the live site (no gh, no network to prod); the production og:image host is metadataBase https://otohime.dev. Minor: /postcard/view?c=zzz returns 200 (not-found content), not a defect against the criteria.
