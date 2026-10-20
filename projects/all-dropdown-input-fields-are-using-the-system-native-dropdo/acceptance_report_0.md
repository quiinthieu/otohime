---
plan_id: pm-198
run_id: run-6663
kind: acceptance_report
verdict: fail
cycle: 0
cited_sha: 83881c1d9c6f8dadfbd6678cf433519dc6b7c9ff
---

# Acceptance: pm-198, Page-styled dropdowns (run-6663)

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| https://otohime.dev/vinyl, 1366x768 and 390x844, Chromium 156 | Click the Genre select | The picker is a `--card` panel `rgb(42, 35, 30)` with a `--line` border, 8px radius and bold accent "All". Hover is `--raised`. It sits under the box inside the viewport | `acceptance-walk.mjs`; screenshots `walk-{1366x768,390x844}-vinyl-open.png` |
| Genre picker open | Click "Electronic" | The value changes, the picker closes and the crate filters from 12 to 2 sleeves | walk: `picking a genre filters the crate (12 -> 2 sleeves)` |
| Genre select focused | Enter, Home, Enter | The value goes back to All and the crate shows 12 sleeves again | walk ok at both viewports |
| Genre picker open (nothing on the platter) | ArrowDown, then **Escape** | **The picker stays open** (`:open` true) | walk `not ok - … /vinyl Escape closes the picker and keeps All (open=true value="")` at both viewports |
| A record placed on the platter (deck `loaded`), Genre picker open | **Escape** | **The record is ejected (deck `empty`) and the picker stays open.** A second Escape does nothing either | `acceptance-keys.mjs`, run on builds 40e9d7c and 83881c1 |
| Record loaded, Genre picker open on "Classical" | **Space** | **Playback starts (deck `playing`) and the option is not picked** (value stays "") | `acceptance-keys.mjs` |
| Same | **ArrowRight** | **The turntable changes record** while the picker stays open | `acceptance-keys.mjs`; `escape-stuck-vinyl.png` shows the picker still open over a new record |
| A bare page in the same Chromium, plain `<select>` with `appearance: base-select` | Open, ArrowDown, Escape | The picker closes. So the stuck picker comes from the page, not the browser | ad-hoc control run in this job |
| https://otohime.dev/music, light and dark set with the real theme toggle, both viewports | Click copies of the Colour field (add-channel form markup: `select.field`, SWATCH_KEYS, next to a `.field` Title input) and the Role field (admin markup: `select.field`, user/admin) | The picker is `--paper` (light `rgb(242, 239, 231)`, dark `rgb(28, 25, 21)`) with a 1px ink border, 10px radius, hard `2px 2px 0` ink shadow, a `--yellow` checked option and a `--paper-2` hover. It stays inside 390px | walk 64 ok on the /music section; `walk-*-{light,dark}-{colour,role}-open.png` |
| Same | Escape; ArrowDown+Enter; type "p"; read FormData | Escape closes the picker; ArrowDown+Enter picks the next option; "p" picks pink; the form submits `colour=coral`; the closed box height equals the input's (36.39 = 36.39) | walk ok |
| All pages above | Watch console errors, page errors and 4xx/5xx from otohime.dev | None in Chromium | walk ok |
| Firefox 157 (Linux pod), /vinyl and /music | Check `CSS.supports`, computed appearance, `selectOption` | `base-select` is unsupported. Genre stays `appearance: auto` (native popup) and `select.field` stays `none` (closed styling, native popup). Both still select. The only console errors are third-party YouTube cookie warnings from the /music embeds | walk: firefox lines |
| Production | `BASE_URL=https://otohime.dev bash scripts/walk-vinyl.sh` / `walk-music.sh` / `probe-selects.sh` | 48 ok / 11 ok / 21 ok, all exit 0 | this run, build 40e9d7c |

**Verdict: fail.** The pickers now look like their pages on all three dropdowns, in light and dark, at 1366 and 390. But the Vinyl Genre dropdown has lost its keyboard. Inside the open picker, Escape does not close it and instead ejects the record on the turntable. Space starts playback instead of picking the option, and ArrowRight changes the record. Before this plan, the native popup took those keys itself. Task t-1135 promised that "keyboard and form behaviour are unchanged", so a keyboard user on /vinyl is now worse off.

## Why it happens

When the picker is open, focus moves onto an `<option>` element, which is how a customizable select works. The deck's keyboard handler `onKeyDown` in `app/(vinyl)/_components/vinyl-app.tsx:321-342` exempts only `INPUT`, `SELECT` and `TEXTAREA` targets. An `OPTION` target falls through, so the handler runs eject/play/prev/next and calls `preventDefault()`, and the browser never closes the picker or picks the option. The site's Colour and Role fields are not affected: no page-level handler on /music or /admin claims those keys, and my walk showed Escape closes them.

## Deployed components

- Production https://otohime.dev (Vercel). It served `build-sha` 40e9d7c0960847adeec64ed07ec6dc025e4cc636 for most of the walk and 83881c1d9c6f8dadfbd6678cf433519dc6b7c9ff by the end. Every page agreed each time I checked, and the gap between the two builds is report files only. I re-ran the key repro on 83881c1 with the same result.
- Delivery 6298cd646f1ed7128d377b26c41495934d51f028 (t-1135) is an ancestor of both builds (`git merge-base --is-ancestor`). Its author is `Otohime <quiinthieu@gmail.com>` with no Co-Authored-By trailer, which matches plan.commit_identity. Delivery readiness: green gate ver-2569.

## Not walked, and why

- **Signed-in Colour on /music and Role on /admin/users/[id]**: this job has no credentials, no docker and no Postgres, so no documented sign-in was possible. I placed copies of the exact component markup into the live /music page, which uses the same served stylesheet and the real theme toggle. These fields passed. The fail does not depend on them.
- **Service logs**: production runs on Vercel and kubectl shows no otohime workload. I used browser-side error capture (console, page errors, 4xx/5xx) in its place.
- **WebKit**: Playwright's WebKit is missing host libraries on this pod, so it did not launch.

Scripts: `acceptance-walk.mjs` (111 checks: 108 ok, 3 not ok, namely the two Escape lines and Firefox's third-party cookie warnings) and `acceptance-keys.mjs` (the key repro), both in this folder.
