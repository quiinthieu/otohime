# QA t-1515 Ambient almanac layer (run-8511, quality_engineer, claude-sonnet-5-5)

Verdict: pass. Delivery and deployed sha: bc1f6e720f097faf35bb327ed5180b03ff189e32 (main HEAD; the delivery sha is itself, so the ancestor check holds trivially). Green gate: pass for bc1f6e7. Author.txt not supplied; git author of bc1f6e7 is Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer.

Independent runs on a fresh checkout (npm ci, clean .next):
- npm test: 1723/1723.
- npm run typecheck: exit 0.
- bash scripts/probe-seasons.sh (builds, next start, pinned playwright 1.64.0): exit 0, node 14/14, layer 59/59 (the build inside the probe passed).
- Source: useSyncExternalStore with visibilitychange; layer mounted in layout.

Negative control: count 28 -> 44 for summer in components/season-layer.tsx; clean rebuild; probe exit 1, 57/59. Reverted (git clean).

Real/fake: real build, server and Chromium. Fake: document.hidden override (headless cannot background a tab). Not checked: the deployed site and CI beyond the supplied gate; frame cost on low-end phones; live deploy URL. History: no job queue involved. Defects: none.
