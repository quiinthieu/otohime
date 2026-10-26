# QA t-1548 Pond on Play: PASS

Delivery sha 82c5e429fa66053eee3391ed3e2cb2ea7886be0b; checked at main 5d54e31 (contains it, `merge-base --is-ancestor` ok). Author of 82c5e42: Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer. Green gate for 82c5e42: pass (typecheck, pond probe).

Independent runs (fresh `npm ci`, production build, run in this lease):
- `npm run typecheck`: exit 0
- `bash scripts/probe-pond.sh`: 81 ok, 0 failed, exit 0; webgl2 (SwiftShader) at 1366x768 and 390x844 touch
- `npm test`: 1877 pass, 0 fail
- Negative controls in the probe fail as intended (motion guard bypass, stopped rAF, touch-action pan-y -> pointercancel).

Acceptance: pond below claw machine; SVG first (in HTML, JS off, reduced motion); lazy chunk absent from HTML; drip/comb/blow change data-drops/verts and pixels; four inks; keyboard reticle+Space; aria-live; Canvas2D fallback; lost context -> print; axe clean; no console errors.

Boundaries: real Next build, real Chromium, real WebGL2 via SwiftShader (not a GPU), CDP touch. Not exercised: real phone GPU, iOS Safari. Deployed site not probed (no deploy URL here; CI status not visible from this pod). History: no failed runs read; n/a.
