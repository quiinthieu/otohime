# Fix plan — pm-279/t-1620, run-9333

Cause: **code**. GitHub Actions runs 540 (`40645049226`) and 541 (`40645771046`) fail the same `e2e/crumple.test.ts:80` assertion (`0 !== 1`). A real local production build reproduces it. The last green `checks` job was run 539 (`40641088253`); its CI workflow is identical to run 540's. The later workflow path-filter edit in `53109d3` did not repair the assertion.

Change **`e2e/crumple.test.ts:78-80`**: capture the link's `ariaSnapshot()` before the fold/focus restoration, verify it contains a link, focus the link, wait for the card to become intact, and assert that the link's accessible snapshot is unchanged. Remove the `innerText`-based accessible-name lookup. Keep the existing source, geometry, fold, Read and Reset checks. The accessible name is one title; `RisoText` creates two decorative `innerText` copies.

The software engineer should run the targeted production E2E, then `npm test`, `npm run typecheck`, `npm run lint`, and the full project E2E/production gates. Commit the focused fix with Otohime identity and the `pm-279/t-1620:` subject, push normally, and confirm a green `checks` and production job. QA then checks that the public health SHA contains delivery `a6297cb` and repeats the public three-note and unknown-slug path. No operator action, runtime capacity or board precondition is needed.
