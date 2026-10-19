---
plan_id: pm-189
run_id: run-6406
kind: acceptance_report
verdict: pass
cycle: 0
---

# Acceptance: Sun Ink Poster (pm-189, run-6406)

**Verdict: pass.** The page at https://otohime.dev/sun is now what the idea asked for: a simple, one-page infographic in a hand-drawn style. It shows 142 visible words; the old tour had 861. It has a rough-inked cutaway on cream paper and no buttons.

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| A visitor with no cache, at 1366×768, motion allowed | Opens https://otohime.dev/sun | 200, title "Sun". One scroll (1044 px tall) on cream paper `#f6f1e7`. "The Sun" in Caveat, "A star, cut open.", a rough-hatched cutaway with a quarter cut away and pins 1–6, two sunspots, corona rays, "Earth, to scale" with a tiny Earth, six numbered callouts on the right, four rough-framed badges, the life strip Today → Red giant → White dwarf, and a one-line credit with 3 source links | `1366-no-preference-full.png`; walk.mjs JSON: layers 6, callouts 6, badges 4, stages 3 |
| The same page, warm load | Probes at 0.7 s, 1.5 s, 3 s and 5.5 s | At 0.7 s the core is inked and the outer rings are still drawing (39 layer paths mid-draw). At 1.5 s 27 are mid-draw. At 3 s 0 are mid-draw and the loops are fading in. At 5.5 s the loops have opacity 1, with sun-convection-roll ×2, sun-photon-walk ×1 and sun-wind-stream ×4 running, and they move between samples 0.9 s apart | early.mjs output; `1366-t700.png` |
| A visitor with reduced motion, at 1366×768 and 390×844 | Opens /sun | 0 animations and 0 paths mid-draw or hidden. The drawing is complete and still, and the loops rest at opacity 1 | walk.mjs JSON `names: {}`, `moved: false`; `390-reduce-full.png` |
| A phone visitor at 390×844, motion on | Opens /sun and scrolls | One column: title, a 358 px drawing, the callouts, the badges 2×2, the life strip and the credit. Sideways scroll is 0 px, and the smallest text is 14 px. The draw-on runs (68 animations, 39 paths mid-draw at the first probe) | `390-no-preference-fold.png`, `390-reduce-full.png`; JSON `sx: 0`, `minFont: 14` |
| Any visitor | Reads the page | 142 visible words (my own innerText count, tokens with a letter or digit), under the 220 cap. Every callout is one sentence. 0 buttons, 0 inputs, no filter, image, canvas or video | walk.mjs JSON `words: 142`, `buttons: 0`; full text captured in walk.out |
| Any visitor | Loads the page's JavaScript | 8 framework chunks are served. None contains Sun code: a grep for `data-layer`, `hachure`, `roughjs`, `sun-draw` or the callout text matches nothing. So the poster works without client JS | curl and grep over every `/_next/static/chunks/*.js` on /sun |
| Any visitor | Uses the home link and the sources | The `otohime.dev` link goes to `/`. The footer links nssdc.gsfc.nasa.gov, science.nasa.gov/sun/facts and en.wikipedia.org/wiki/Sun | JSON `homeLink: true`, `srcLinks` |
| A visitor on /projects | Finds the Sun row | One `href="/sun"` with the note "Our star, cut open and drawn by hand.", and no "Eight chapters" text left | curl /projects |
| The rest of the site | Runs `BASE_URL=https://otohime.dev bash scripts/walk-sun.sh` | Exit 0, 37 ok, 0 failed. /shore, /capsule, /, /work, /play, /notes and /music return 200, and both 404s show the parcel page | walk output on this lease |
| Logs (Vercel-hosted, no log access from this pod) | Watches the browser during all four walks | 0 console errors or warnings, 0 page errors, 0 failed requests, 0 responses with status 400 or above | walk.mjs JSON `errs: []`, `fails: []` |

## Deployed build

- One component is touched: the otohime Next.js app on Vercel (`server: Vercel`).
- The `build-sha` meta on https://otohime.dev/sun is `edbdb9ffa22a02e92f4b62358a441f9f50c6dc46`.
- `git diff 3bf61ea edbdb9f` only adds `qa-t-1082.md`, and `git merge-base --is-ancestor 3bf61ea edbdb9f` passes. So production runs the code from the t-1082 delivery.
- That build contains all three delivery shas: t-1080 at `bafc5dd`, t-1081 at `4a6b027` and t-1082 at `3bf61ea`.

## Commit identity

`git log` shows that bafc5dd, 4a6b027 and 3bf61ea are each authored and committed by `Otohime <quiinthieu@gmail.com>`, with no Co-Authored-By trailer. No author.txt was in the delivery evidence.

## Against the idea

1. **"Too many words."** The page now has 142 visible words; the old tour had 861 (research). Each fact appears once.
2. **"The graphic is poor."** There is now one large drawing with a wobbly pen line and hatched fills, numbered to the callouts, instead of a flat diagram in a dark UI. Earth is drawn to true scale beside the Sun.
3. **"A simple one-page infography with hand-drawn art style."** The whole poster is one scroll on a phone and about 1.4 screens on a desktop. The lettering is hand-drawn, the frames are rough-drawn and the background is paper. Nothing needs a click.

## Notes (not failures)

- On a cold first load, the drawing can show complete before the stylesheet starts the draw-on. The base styles are the finished still, as the plan intends.
- During the first ~0.7 s of the draw-on, the two sunspot fills and a few rays show before the photosphere outline is drawn (`1366-t700.png`). This is cosmetic and was already noted by QA.
- Browser: playwright-core 1 with chromium-headless-shell, installed in `/tmp/acc` (a scratch dir, nothing added to the repo). Screenshots are not committed.
