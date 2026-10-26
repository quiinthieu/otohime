# Fix plan: t-1507 Ship Fan-out Peeks

**Cause: code.** The required mobile browser probe fails on both a local production build and the deployed site before it reaches positive long-press assertions. The full checkout gate passes, but that does not prove the mobile browser path.

## Exact fix

In `scripts/probe-peeks.mjs:407-415`, the phone probe performs a moving-touch negative control and then calls `shore.scrollIntoViewIfNeeded()` at line 412. That call deterministically times out in this lease and in the independent production probe. Fix the probe's touch/scroll sequence so the moved gesture is fully canceled and the link can be brought into view before starting the positive long-press case. Keep both assertions: the moving gesture must not open a fan or navigate, and the subsequent stationary long-press must open the fan without following the link. Do not suppress the error or remove the positive assertions.

## Reverification

1. Run the full checkout contract: `npm test && npm run test:e2e && npm run lint && npm run typecheck && npm run build`.
2. Run `SKIP_BUILD=1 PORT=<free-port> bash scripts/probe-peeks.sh` against that production build; require every desktop, keyboard, navigation, touch, edge, reduced-motion, error, and negative-control assertion to pass.
3. After the fix is deployed, run `BASE_URL=https://otohime.dev bash scripts/probe-peeks.sh` and confirm the deployed build SHA contains the fix SHA. Separate any remaining `ERR_NETWORK_CHANGED` resource failures from repeatable interaction failures; do not accept the task until the positive mobile long-press assertions have executed successfully.
