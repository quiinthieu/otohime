---
plan_id: pm-198
run_id: run-6688
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: 7d34dfdddad8511ae50cae23ebc936bc974ab797
---

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| https://otohime.dev/vinyl, 1366x768 and 390x844, Chromium 156, a record placed on the platter (deck `loaded`) | Focus Genre, press Enter | The page-styled picker opens: a `--card` panel with a `--line` border, 8px radius and a bold accent "All" | `acceptance-keys-1.mjs`; `acc1-{1366x768,390x844}-vinyl-open-loaded.png` |
| Genre picker open | ArrowDown, ArrowDown, **Escape** | The picker closes, the value stays All, the record stays loaded and focus goes back to the select | keys: `Escape closes the picker and leaves All`, `does not eject the record` (`loaded -> loaded`), `focus returns` |
| Same | Enter, ArrowDown, **Space** | "Classical" is picked, the picker closes and the crate filters 12 -> 1. The deck stays `loaded` and nothing plays | keys ok at both viewports |
| Picker open again | **ArrowRight, ArrowLeft, ArrowLeft**, then Home+Enter | The record stays "Harbour Lights". Home+Enter returns to All and the full 12-sleeve crate | keys ok |
| Turntable focused | Space; then open Genre, Escape, click a genre | Playback starts (`playing`). Opening, Escaping and picking in Genre leaves the same record `playing` | keys ok |
| Turntable focused, picker closed | ArrowRight, then Escape | The record changes and Escape ejects it (`empty`), so the deck keeps its shortcuts | keys ok |
| /vinyl, no record loaded | Click Genre; hover; click "Electronic"; Enter, Home, Enter | The picker uses card, line, 8px radius, accent checked and `--raised` hover, and stays inside the viewport. Escape closes it and keeps All. The crate filters 12 -> 2 and returns to All | `acceptance-walk.mjs` (both viewports, now ok on the cycle-0 Escape lines); `walk-*-vinyl-open.png` |
| https://otohime.dev/music, light and dark set with the real theme toggle, both viewports | Click copies of the Colour (add-channel) and Role (admin) `select.field` markup | `--paper` picker (light `rgb(242, 239, 231)`, dark `rgb(28, 25, 21)`), ink border, 10px radius, `2px 2px 0` ink shadow, `--yellow` checked option and `--paper-2` hover, inside 390px | walk ok; `walk-1366x768-dark-colour-open.png`, `walk-390x844-light-role-open.png` (viewed) |
| Same | Escape; ArrowDown+Enter; type "p"; read FormData; measure heights | Escape closes the picker; ArrowDown+Enter picks the next option; "p" picks pink; the form submits `colour=coral`; the closed box equals the input's height | walk ok |
| Firefox 157, /vinyl and /music | `CSS.supports`, computed appearance, `selectOption` | No base-select support, so the native popup stays (Genre `auto`, `select.field` `none`) and both still select | walk firefox lines ok |
| All pages above | Watch console errors, page errors and 4xx/5xx from otohime.dev | No first-party errors in Chromium or Firefox. The only not-ok line is Firefox's third-party YouTube cookie rejections from the /music embeds (youtube.com files), as in cycle 0 | walk 110 ok / 1 not ok; keys 30 ok |
| Production | `BASE_URL=https://otohime.dev bash scripts/probe-selects.sh` / `walk-vinyl.sh` / `walk-music.sh` | probe 49 ok (including all 28 `/vinyl keys` lines), walk-vinyl 48 ok, walk-music 11 ok, all exit 0 | this run, build ae62f08 |

**Verdict: pass.** All three dropdowns now open a picker that looks like its page. On the site, Colour and Role use paper with an ink border, the hard shadow and a yellow pick, in light and dark. On Vinyl, Genre uses the card panel with an accent pick. This holds at 1366x768 and 390x844. Keyboard and form behaviour match a native select. The cycle-0 defect is gone: with a record on the platter, Escape, Space and the arrows inside the open Genre picker reach the picker and never the deck. Outside the picker the deck still takes those keys. Firefox keeps its native popup and nothing breaks there.

## Deployed components

- Production https://otohime.dev (Vercel, `server: Vercel`). It served `build-sha` ae62f088110e2e381ac93d0ac1263c3a31c44a45 for the probe, the walks and the first key walk. By the end, all of `/`, `/vinyl`, `/music` and `/projects` served 7d34dfdddad8511ae50cae23ebc936bc974ab797. `git diff ae62f08 7d34dfd` is one pm-196 report file, and the key walk re-ran on 7d34dfd with 30 ok, 0 failed.
- Deliveries 6298cd646f1ed7128d377b26c41495934d51f028 (t-1135, green gate ver-2569) and 97c4e0f26cc9576dffb947a6d3df7d97bc09899e (t-1136, green gate ver-2581) are ancestors of both builds (`git merge-base --is-ancestor`). Both are authored by `Otohime <quiinthieu@gmail.com>` with 0 Co-Authored-By trailers, which matches plan.commit_identity. Delivery readiness: ready, with no blockers.

## Not walked, and why

- **Signed-in Colour on /music and Role on /admin/users/[id]**: no credentials were given, and this pod has no docker or psql for `scripts/e2e-local.sh`. I walked the exact component markup on live /music instead, with the same served stylesheet and the real theme toggle. Cycle 1 changed only the Vinyl key handler.
- **Service logs**: production runs on Vercel, and kubectl shows no otohime workload. I captured browser-side errors (console, page errors, first-party 4xx/5xx) in their place.
- **WebKit**: Playwright's WebKit is not installed on this pod. QA ran WebKit 27.2 for t-1135.

Scripts in this folder: `acceptance-keys-1.mjs` (new, 30 checks) and `acceptance-walk.mjs` (from cycle 0, 111 checks).
