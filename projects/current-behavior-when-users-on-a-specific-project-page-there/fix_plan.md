# Fix plan: pm-195 / t-1129 (from QA run-6644)

**Cause: code.** The delivered CSS lets the wrapped nav overflow a fixed-height bar on phones, and drops the space after the arrow in inline-flex pills. CI, the runner and the deploy are fine: the live site runs ec39dad, which contains the delivery.

## Changes (CSS only, one file per group, no shared code)

1. `app/(capsule)/capsule.css:224`, inside `@media (max-width: 480px)`:
   `.topbar { padding: 0 20px; height: 72px; }`
   → `.topbar { padding: 8px 20px; height: auto; min-height: 72px; }`
2. `app/(shore)/shore.css:191`, inside `@media (max-width: 480px)`:
   `.topbar { padding: 0 20px; height: 79px; }`
   → `.topbar { padding: 8px 20px; height: auto; min-height: 79px; }`
3. `app/(elements)/elements.css:76` and `app/(vinyl)/vinyl.css:59`: add `gap: 0.3em;` to `.home-link`. Because the pill is inline-flex, the gap restores the space between `←` and "All projects". The home pill has one text node, so it is unchanged.

Do not touch Sun, the page.tsx files, the walks or the e2e tests: they are correct.

## Verification

- The contract's eight commands, unchanged: `npm ci && npm test`, `npm run lint`, `npm run typecheck`, and the five walk commands. All must exit 0.
- The layout probe, against a local build and again after deploy:
  ```
  cd /tmp/pw && npm init -y && npm i playwright@1 && npx playwright install chromium-headless-shell
  cp <repo>/projects/current-behavior-when-users-on-a-specific-project-page-there/topbar-probe.mjs .
  (in the repo, after npm run build) npx next start -p 4046 &   then: BASE=http://localhost:4046 node topbar-probe.mjs
  BASE=https://otohime.dev node topbar-probe.mjs
  ```
  Expect `probe: 10 ok, 0 failed`, exit 0. On the live site, injecting exactly this CSS already gives 10/10 (QA run-6644).
- Commits as `Otohime <quiinthieu@gmail.com>` with no trailer, subject `pm-195/t-1129: …`. Push to main; CI's `production` job redeploys, and the live `build-sha` must then contain the fix sha.
