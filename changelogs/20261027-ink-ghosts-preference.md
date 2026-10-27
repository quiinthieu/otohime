# Persist the Pocket ghost preference

Home now has a menu-only Ghosts on/off chip after Dive and Sea sound. Pressed means enabled. Hiding immediately
closes transport and clears ink; the `ghosts=hidden` localStorage preference survives reloads, both page roots and
same-origin tabs. Missing/malformed storage allows configured ghosts; unavailable storage keeps a memory choice.

The neutral loader waits for hydration and preference eligibility before loading. Once mounted, the canvas keeps
one session while suppression, reduced motion, visibility and connectivity changes stop/restart it. All three
attempts belong to that session; toggling cannot renew an exhausted budget. Cancelled socket/timer/frame callbacks
are guarded against later generations. Existing palace sound, Tamatebako and game behavior remain intact.

Verification: named preference/client assertions, project tests, ESLint, production build and
`TMPDIR=/tmp npm run test:ghosts-pref`. The focused suite uses real Chrome/production components/2D pixels with a
local fake WebSocket and injected visibility/offline events. It includes a disabled-paint negative control.
Production activation and hosted fan-out remain owned by subsequent pm-257 tasks.
