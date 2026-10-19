---
plan_id: pm-188
run_id: run-6347
kind: acceptance_report
verdict: pass
cycle: 1
---

# Acceptance: Sun Cutaway (pm-188)

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev in production; final code sha 00dd5f2 | Read `<meta name="build-sha">` on `/` and `/sun` | First `00dd5f280b8a…`, later `8591a2eb4804…` (it redeployed during the walk). 8591a2e changes only `qa-t-1077.md` | `curl`; `git diff --stat 00dd5f2 8591a2e` |
| Production at 00dd5f2, then at 8591a2e | `BASE_URL=https://otohime.dev EXPECT_SHA=<sha> bash scripts/walk-sun.sh` | Exit 0, 31 ok, 0 failed, at both shas | Walk output |
| Production | The same walk with `EXPECT_SHA=deadbeef` | Exit 1: the only failure is "/sun build-sha … want deadbeef" | Negative walk output |
| Visitor on `/projects` (1366×768 and 390×844) | Click the one `a[href="/sun"]` | `/sun` loads with title "Sun", no site sidebar, and build-sha set | Playwright, all 4 runs |
| `/sun`, chapter 1 | Next ×7 | `data-chapter` goes scale → core → radiative → convective → photosphere → chromosphere → corona → life. The caption changes each time ("1. How big is it?" … "8. A star's life"). Only the current chapter's scene is visible. Every chapter has 3–6 facts with links to nasa.gov or wikipedia.org | Playwright log |
| Motion allowed (1366 and 390) | Read the running animations in the visible scene per chapter | 2 / 6 / 2 / 4 / 51 / 25 / 16 / 5: every chapter animates | `getAnimations({subtree:true})` |
| `prefers-reduced-motion: reduce` (1366 and 390) | Same | 0 running animations in all 8 chapters. The screenshots show the resting poses (e.g. life: Today, Red giant and White dwarf all drawn and labelled) | Playwright log; screenshots at 390/reduce |
| Any chapter at 390×844 | `scrollWidth − clientWidth` | 0 on every chapter, with and without reduced motion | Playwright log |
| Chapter 1 / chapter 8 | Check whether Back and Next are disabled | Back is disabled on 1 and Next is disabled on 8 | Playwright log |
| Chapter 8 | Back; dot 3; → on the focused stage | corona; radiative (`aria-current="step"` on "Chapter 3: The radiative zone"); convective | Playwright log, all 4 runs |
| Chapter 1 | Play | Visits all 8 in order and stops on life (the button reads Play). 78 s at 1366/motion and 105 s at 390/reduce | Playwright log |
| Chapter 7 | Play | corona → life, then stops. 26 s at 1366/reduce and 18 s at 390/motion | Playwright log |
| Chapter 8, stopped | Play | Restarts at scale | Playwright log, all 4 runs |
| `/sun` | Click "otohime.dev" in the top bar | `https://otohime.dev/`, title "Otohime" | Playwright log |
| Whole walk | Console and page errors | 0 in all 4 runs | Playwright `console`/`pageerror` |
| JavaScript disabled, 390 px | Load `/sun` | 8 `section[data-chapter-section]` with the eight chapter `<h2>`s: the story reads without JS | Playwright, no-JS context |
| Lease checkout at 8591a2e | `npm ci && npm run lint && npm run typecheck && npm test` | Exit 0: 146 tests, 146 pass, 0 fail | Local run |
| git history f2c90d8..8591a2e | Author, committer and trailers | All 8 pm-188 commits are `Otohime <quiinthieu@gmail.com>` as author and committer, with no Co-Authored-By trailer | `git log --format` |

**Verdict: pass.** The idea asked for an animated infographic of the Sun and its
structure, as a project. Production has it: `otohime.dev/sun`, the third row on
the Projects bench, an animated SVG cutaway with eight chapters (scale, core,
radiative zone, convection zone, photosphere, chromosphere, corona and solar
wind, life). Each chapter animates its own scene and lists facts sourced from
NASA or Wikipedia. The tour is driven by Back, Next, the dots, the arrow keys
and Play. Under reduced motion every scene is a still, and without JavaScript
the page still reads as eight plain sections.

## Shas

- Final code sha: `00dd5f280b8a2a2f70a05e15a3330b7cd45e0cbf` (t-1077 delivery).
- Deployed build (otohime.dev, Vercel production): it served
  `00dd5f280b8a2a2f70a05e15a3330b7cd45e0cbf` at the start of the walk and
  `8591a2eb4804e309f344b4e782e94f88c8313dfc` from partway through. That commit
  only adds the QA report.
- Task deliveries: t-1075 `ba77f6e` (ver-2421), t-1076 `d443ac7` (ver-2425),
  t-1077 `00dd5f2` (ver-2427). The delivery readiness check says ready, with 3
  green gates. Each delivery sha is an ancestor of the deployed build.

## Logs

Sun is a static page, with no API, database or auth, served by Vercel. The lease
has no Vercel CLI or project link, so I could not read runtime logs. What I
checked instead: 0 console or page errors in all four browser runs, and every
walked route gave its expected status (31 checks, including the two 404s).

## Notes (not fails)

- Play runs a little slower than nominal in headless Chrome: about 9.4 s per
  chapter with motion and about 13 s under reduced motion, against 8.8 s nominal.
  The order and the stop rule are correct.
- Scene labels are small at 390 px (the 800-wide SVG is scaled to about 350 px).
  The same text is in the facts list and the chapter sections below.
- The life scene's sizes are illustrative, not to scale. It claims no scale.
- No open advisory questions on the plan.
