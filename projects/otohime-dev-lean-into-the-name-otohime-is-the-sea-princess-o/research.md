# pm-256 Research: Ryugu-jo + Tamatebako, and Ink Ghosts

Basis: repo at 45bdb21 (350 commits, Next 16.4.2, React 19.3; three + r3f + drei and roughjs already deps; no realtime dep). Pocket = components/handheld.tsx. Caveats: /shared/artifacts is not writable in this pod (answer.md not written, body submitted instead); the X posts could not be fetched, so inspiration is from the brief; the named project doc is absent from the checkout.

## Verdict
Both feasible and on-brand. Ship Ryugu-jo first as a static, zero-backend route. Ship Ink ghosts second, flag-gated, on a separate realtime service (the only new infra and privacy surface).

## 1. Ryugu-jo + Tamatebako
- Entry: type `urashima` (reuse keyboard easter-egg pattern, see lib/boot.ts / lib/end.ts) or scroll past a "below the waterline" sentinel under the footer; plus a Pocket menu line so it is keyboard/touch reachable. Own route group + own layout so cartridge CSS in app/(site)/globals.css stays out.
- Water: SVG filter (feTurbulence+feDisplacementMap) or one full-screen fragment-shader quad (three is already a dep; no postprocessing). Two scrolling noise layers for caustics. DPR cap 1.5, pause when hidden, static ink-wash fallback if WebGL fails or prefers-reduced-motion.
- Fish: 8-14 roughjs/SVG strokes with boids + pointer flee force (touch: last tap). Reduced motion: slow drift, no flee.
- Sound: opt-in, off by default, WebAudio-generated (filtered brown noise + LFO), started only after a gesture, toggle in Pocket, persisted in localStorage. No assets/licences.
- Tamatebako: smoke puff (reuse lib/ink-particles.ts) then a time-scrubber.
- History data: scripts/history-index.ts in prebuild (same posture as ledger-fetch.mjs / peeks-index.ts, with --check) emitting content/history.json: sha, date, subject, plan/task prefix, files changed; collapse to ~60-120 stops, under ~50 KB. Detect shallow clones (git rev-parse --is-shallow-repository) and fall back to last committed JSON; never fail the build.
- Aged look: do NOT render real historic snapshots (would mean building 350 commits). Use a stylized changelog replay: age = f(position) drives sepia/yellow paper filter + grain on a card per stop showing real subject/date. Be honest in copy ("changelog replay"). Optional: a few hand-captured milestone screenshots.
- Risks: root-layout CSS fails two allowlists (lib/motion.test.ts TINTS + import order; app/(design-system)/_lib/siblings.test.ts SHEETS), so keep Ryugu CSS in its own layout; new test dirs must be added to the npm test glob; mobile GPU cost; audio autoplay rules.
- Sizing (~5 tasks): route+triggers+e2e; water+fish; opt-in sound+Pocket toggle; history script+tests+check; Tamatebako/scrubber UI+reduced-motion+e2e+QA.

## 2. Ink ghosts
Backend options: Cloudflare Worker + Durable Object with hibernating WebSockets (recommended: pure fan-out, no persistence, ~60 lines, near-zero idle cost); PartyKit (same model, extra vendor layer); Supabase Realtime broadcast (no server code but new vendor, anon key, msg-rate limits); self-hosting ws on the Next host (avoid, route handlers don't hold sockets).
- Protocol/privacy: client sends normalized {x,y} + page id at <=10 Hz, delta-thresholded; server assigns random per-connection id, never logs IP/UA, forwards only clamped numerics, rate-limits (>15 msg/s dropped), caps ~30 ghosts, batches rebroadcast at <=10 Hz, origin-checks the upgrade, stores nothing, no cookies, no text channel (no moderation). Click = {t:"c",x,y}; ripple client-side.
- Rendering: one fixed pointer-events:none canvas; lerped brush-tip dots, ~12-point fading trails, rough expanding ripple circles; rAF only while ghosts exist and tab visible. Dynamic import after idle so no main-bundle cost.
- Degrade: endpoint from env; unset/fail/close renders nothing, capped backoff (~3 tries), no error UI. prefers-reduced-motion: no trails/drift (recommend disabled by default, opt-in). Pocket toggle "Hide ghosts" persisted and closes the socket.
- Risks: empty-room problem (usually 0-1 visitors) so show a faint "N here" only when others present and test with a fake ws server (pattern: scripts/probe-ask-llm-fake.mjs) with two Playwright pages; check CSP connect-src in proxy.ts/next.config.ts before adding the wss origin; approximate positions across viewport sizes.
- Sizing (~4 tasks): worker/DO + protocol tests; client hook + canvas; Pocket toggle + reduced-motion + offline fallback; two-browser e2e + QA.

## Recommended order
1. Ryugu route + water/fish. 2. History script + Tamatebako scrubber. 3. Opt-in sound. 4. Ink ghosts merged dark behind an env flag; one operator_action needed for Cloudflare deploy credentials, everything else testable with a fake server.

## Open questions (advisory, defaults chosen)
Stylized replay vs real snapshots (stylized); ghosts on homepage+Ryugu first (yes); Cloudflare vs Supabase (Cloudflare).

## Known open platform issues (workaround first)

- [iss-7 · cluster_access · ×360] lesson theme: cluster access from a job pod — Read the cluster with kubectl directly, kubectl first, on both substrates: a job pod runs as task-agent-reader and a fleet lease with machine.cluster_access=qa…
- [iss-6 · ci_status · ×305] GitLab pipeline status misread — Production deploy jobs are when:never since pm-79/t-378, so a deploy is judged by the child's deploy-staging-k3s job (/pipelines/{id}/bridges, then the child's /jo…
- [iss-79 · other · ×258 · fix planned in pm-239] task-manager ask_task failures: no_account_available: no claude account is available for repo mono-v2 — Read one job's log before resubmitting; a related reliability fix is planned in pm-239.
- [iss-68 · other · ×83 · fix planned in pm-239] task-manager coding_task failures: agent_failed: exit 1 — Read one job's log before resubmitting; a related reliability fix is planned in pm-239.
- [iss-157 · other · ×73] task-manager generation_task failures: gpu_unavailable: colab_launch_circuit_open — Recover with the platform's generation-runner circuit guidance; do not treat queued work as delivered.
- [iss-112 · other · ×66 · fix planned in pm-239] task-manager maintenance_task failures: queue_ttl_exceeded — Read one job's log; a related reliability fix is planned in pm-239.
- [iss-123 · env_canary · ×62 · fix planned in pm-239] canary: mcp_backtest failed — Use the service HTTP API if the MCP server fails initialization; do not retry the unavailable MCP path.
- [iss-9 · git_push · ×49] lesson theme: git push to main rejected (non-fast-forward) — On rejection run git pull --rebase, rerun tests and push again; never force-push.
- [iss-142 · other · ×47 · fix planned in pm-239] task-manager generation_task failures: queue_ttl_exceeded — Read one job's log before resubmitting; a related reliability fix is planned in pm-239.
- [iss-80 · other · ×39 · fix planned in pm-239] task-manager coding_task failures: no_account_available — Re-check account choice before resubmitting; a related reliability fix is planned in pm-239.

## Lessons from earlier runs

- Editing a probe `.sh` while it runs can break its syntax; a 6% wash fails on autumn paper.
- Reduced-motion proof needs a component-scoped `transition: none`; the site's global 0.01ms reset still fires `transitionrun`.
- On Linux, Chrome may fail with `Socket path too long` from the deep per-lease `TMPDIR`; use a short directory under `/tmp`.
- Judge terminal-task causes against intervals at the failure time, not the current live list; the current job may change between runs.
- Remote Ask tier-on probes detect stale deploys: a bundle without the console call yields zero GETs.
- Menu's “Send to back” live line can be overwritten by “menu closed”.
- Otohime's cartridge rules in `app/(site)/globals.css` are unlayered, so a normal declaration in any `@layer` cannot override them; only a layered `!important` can. A new sheet imported by a root layout fails `lib/motion.test.ts` (TINTS and exact import order) and `app/(design-system)/_lib/siblings.test.ts` (SHEETS).
- A deployed-bundle grep for a client call string finds a stale deploy before a browser walk.
- On the macOS lease, `next dev` can serve SSR without hydration because its HMR websocket handshake fails. Use `next build && next start`, a dummy `DATABASE_URL`, Playwright with system Chrome, and a short `TMPDIR`. A popup under a held pointer takes `pointerup` unless the opener calls `setPointerCapture`.
- `@anthropic-ai/sdk` 1.3.0 sends `authorization: Bearer <key>`, not `x-api-key`, and may return a raw string for a 200 non-JSON response. A fake server should accept either header. Docker publishes localhost ports the job can reach; the host has `postgres:16-alpine` available.
