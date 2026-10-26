# Delivery summary · pm-264/t-1590 · run-9044

Repairs the Footer Chromium probe as `fix_plan_run-9043.md` requires. Its title checks now read RisoText's plain source inside `h2#end-title` instead of the whole heading's `textContent`, which repeats the title. This covers seven routes and no-JS. The desktop text-bounds check now waits for the heading's finite ink entry and measures its visible glyphs, not the decorative plates. The expressions live in `scripts/probe-end-dom.mjs`, and the new real-Chrome regression `scripts/probe-end-dom.test.mjs` (in `npm test`) runs those exact functions. Product, Peep-box, lockfile and workflow are unchanged; `package.json` changes only to add the new test to `npm test`. See [architecture.md](architecture.md#footer-chromium-probe-heading-repair--run-9044).

## Local verification

Fresh `npm ci` on Linux fleet host `avietidol-Z490-GAMING-X`: Node 22.23.3, Next 16.4.2, React 19.3.0, Playwright Core 1.64.0, Google Chrome 154.0.8037.57. The real runners built and served Next and used embedded Postgres; the probe ran in CI mode (`CI=true`, runner Chrome, nothing installed).

| Check | Result |
| --- | --- |
| Baseline `CI=true bash scripts/probe-end.sh`, unmodified probe | 159 ok, 12 failed: reproduces QA (7 routes plus no-JS duplicate title, 4 desktop text bounds) |
| Pure projection/pose contract | 6/6 |
| `npm test` / `CI=true npm test` | 2323/2323 each |
| Lint + typecheck | exit 0; ten existing warnings |
| Focused production Peep-box contract, fresh build | 8/8 |
| `SKIP_BUILD=1 bash scripts/walk-end.sh` | 67 ok, 0 failed |
| `SKIP_BUILD=1 npm run test:e2e` | 138 pass, 0 fail, 1 optional screenshot-evidence skip |
| First repaired probe (scroll check kept for Riso) | 170 ok, 1 failed: /music 1366 settled, glyphs inside, `scrollWidth` 429/424 from plates |
| Final `CI=true SKIP_BUILD=1 bash scripts/probe-end.sh`, run twice | 171 ok, 0 failed; 171 ok, 0 failed |

All browser runs share the fresh production build produced by the focused contract command. The probe-helper edits after that build touch scripts only, not the served app. The real-Chrome regression fixtures are synthetic HTML styled by the real `riso-heading.css`. Negative controls: wrong source under a correct plate, extra text, wrong id, source outside the heading, imitation class, two sources, plain/Riso off-viewport text, Riso glyph spill and a missing heading. A paused first frame demonstrates the transient plate overflow that the old check failed on. Tilt, permission and visibility in the Peep-box contract remain synthetic policy fixtures.

## Handoff

Local integration execution is demonstrated; deployment and product acceptance are unproven here. Under the stop-at-push contract, plan-manager owns the new SHA's green gate, GitHub checks (including the Footer walk and Chromium probe), production deploy, and live-health ancestry. QA must repeat the live geometry, Disable, scrolling, reduced-motion and no-camera checks at 390×844 and 1366×768. Failure condition: any declared check, Footer walk or Chromium probe fails; production fails or is skipped; or live health excludes this delivery. No pipeline watch or deployed-system probe was performed.
