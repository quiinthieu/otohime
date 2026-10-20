---
plan_id: pm-199
run_id: run-6730
kind: acceptance_report
verdict: pass
cycle: 0
---

# Acceptance: Orrery (pm-199, run-6730)

**Verdict: pass.** A visitor to https://otohime.dev now finds the Sun project renamed **Orrery** at `/orrery`. It has 14 hand-drawn posters: the Sun, the 8 planets, and Proxima Centauri, Sirius, Vega, Polaris and Betelgeuse. Two true-scale rows sit on the index, and every old `/sun` link lands on the Sun's poster. I walked it in headless Chromium at 1366×768 and 390×844, with motion on and reduced, on production serving **build-sha `098165213612572bc23a124db1b57aae920e64f4`**. That commit's code is the delivery `4a84e7f`: `git diff --stat 4a84e7f 0981652` touches only `qa-t-1144.md`.

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Visitor with an old bookmark | open `https://otohime.dev/sun` | 308 to `/orrery/sun`. The page is "The Sun" with 6 layers, 6 callouts, 4 badges, a 3-stage life strip, "Next: Mercury →" and no Previous. | curl `308 https://otohime.dev/orrery/sun`. Browser: title "Sun · Orrery", h1 "The Sun", same at all 4 viewport/motion combinations |
| Old deep link | open `/sun/nope` | 404 | curl 404, browser status 404 |
| On the Sun poster | click "← Orrery" | `/orrery` index: title "Orrery", tagline "The Sun, the planets and five stars, cut open and drawn by hand." | 14 `[data-body]`, 2 `[data-row]`, 3 `[data-edge]`, 64 visible words, 87,919 bytes, 0 buttons |
| On the index | look at the rows | "The planets, to scale" shows Mercury → Neptune in orbit order beside an orange arc labelled "the Sun's edge, to scale". Jupiter is the largest and Saturn wears its rings. "The stars, to scale" runs from Betelgeuse's red edge ("would fill the page") through the Sun, a tiny Proxima Centauri, Sirius and Vega, to Polaris's yellow edge ("would reach here"). | screenshot S-1366-index; `data-mark="rings"` on the index |
| Index at 390 px | swipe | Each row scrolls inside its own box (760/358, `overflow-x:auto`). The page itself does not move sideways. | `scrollWidth − clientWidth` = 0; smallest text 13.7 px |
| On the index | click Saturn's disc; click "Polaris would reach here"; click Betelgeuse's edge label | land on `/orrery/saturn`, `/orrery/polaris` and `/orrery/betelgeuse` | `page.url()` at 1366 and 390 |
| On `/orrery/sun` | click **Next** 13 times | Sun → Mercury → Venus → Earth → Mars → Jupiter → Saturn → Uranus → Neptune → Proxima Centauri → Sirius → Vega → Polaris → Betelgeuse. Betelgeuse has no Next. | each URL reached by a real click at all 4 combinations |
| On `/orrery/betelgeuse` | click **Previous** 13 times | back to `/orrery/sun` | `page.url()` = `/orrery/sun` at all 4 combinations |
| Each of the 14 posters | read | Layers match the bodies (Sun 6, Earth 5, Venus/Jupiter/Saturn/Polaris/Betelgeuse 4, others 3), with one callout per layer, 4 badges, a 3-stage life strip on every star and none on any planet, plus "← Orrery". Words per page are 95–154 (cap 220). | walk JSON per page; `/orrery/sun` keeps "15.7 million K", "8 min 19 s", "109" |
| Each poster with its mark | wait until drawn | Saturn shows a ring band with the near half in front. Jupiter has 4 belts and a red spot, Earth white cloud strokes, Mars a polar cap. Uranus has rings standing near-vertical and an axis line, Neptune a dark spot. Sirius has "Sirius B, a white dwarf, not to scale". Vega is wider than tall, with a spin arrow. Polaris has two dashed outlines and Betelgeuse a lumpy limb. | every `[data-mark]` group ends at opacity 1 at 1366 and 390; screenshots checked by eye |
| Any page, both widths, motion on and reduced | measure | No sideways scroll and no console errors. Smallest text is 13.4 px at 390 and 14 px at 1366. There are no buttons. | `scrollWidth − clientWidth` = 0 on all 68 measured page states; console errors [] |
| Someone browsing the site | open `/projects`, click Orrery | Orrery is listed once, LIVE, as "The Sun, the planets and five stars, cut open and drawn by hand." There is no `/sun` link. The click lands on `/orrery`. | 1 `a[href="/orrery"]`, 0 `a[href="/sun"]` |
| Mistyped body | open `/orrery/nope` | 404 "Nothing in this parcel". Its link back lands on `/orrery`. | browser status 404, `page.url()` = `/orrery` |
| Repo's own walk against production | `BASE_URL=https://otohime.dev EXPECT_SHA=0981652… bash scripts/walk-orrery.sh` | exit 0, **260 ok, 0 failed** | /tmp/walk-prod.log |
| Repo checks on this lease at 0981652 | `npm ci && npm run lint && npm run typecheck && npm test` | exit 0, 392/392 pass | /tmp/tests.log |

## Deployed components

| Component | Sha | How I know |
| --- | --- | --- |
| otohime.dev (Next.js on Vercel) | `098165213612572bc23a124db1b57aae920e64f4` | `<meta name="build-sha">` on every Orrery page during the walk. It was `4a84e7f` at the first curl, then redeployed to the docs-only `0981652` |
| Delivery shas | t-1141 `4d40469`, t-1142 `d42f069`, t-1143 `d442da5`, t-1144 `4a84e7f` | all are ancestors of the deployed sha |

**Author:** every pm-199 commit from `dd0c6ae` to `0981652` has author and committer `Otohime <quiinthieu@gmail.com>`, and none carries a Co-Authored-By trailer. This matches plan.commit_identity.

**Logs:** the site runs on Vercel, and no Vercel token is available on this lease, so I could not read the runtime logs (decision recorded). The Orrery pages are prerendered (`x-vercel-cache: HIT`). The browser console showed no errors on any load, except the expected 404 resource on `/orrery/nope`. `/api/health` returns `{"ok":true}`.

## Observations for the product owner (not failures)

- **The comparison disc is always Earth-blue.** On Earth the disc labelled "The Moon, to scale" is the same solid blue as Earth. On Vega and Polaris, "The Sun, to scale" is a solid blue disc. The size and the label are right, but the colour suggests the wrong body. The fill is fixed at `#2f6fd0` (t-1144 QA noted this on Vega and Polaris).
- **On Sirius, "The Sun, to scale" is an arc cut off at the bottom-right of the drawing.** At the true ratio it is too big to show whole. It reads as intended once you see the label, but it is the least clear of the comparisons.
- **On Betelgeuse, pins 1 and 2 sit almost on top of each other** near the centre, because the helium core and shell are tiny.
- **Soft navigation keeps the previous page in a hidden DOM.** This comes from Next 16 `cacheComponents`. Automation must scope to visible elements (`:visible`). People are not affected.
