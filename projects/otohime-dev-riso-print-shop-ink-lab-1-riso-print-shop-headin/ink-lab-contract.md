# Ink Lab public proof sheet

Task pm-268/t-1679. `/lab` is public: find **Ink Lab** in Main navigation, or open Pocket Terminal with Ctrl/Cmd-K and type `lab` or `go lab`. It is deliberately absent from the seven-cartridge physical LCD menu. The server sends the page title, description, heading and a meaningful Suspense fallback; the heading remains readable without JavaScript.

The proof uses the site's `RisoHeading`, `.card`, letterpress `.btn` and `inkFilter` materials. Wide containers put grouped controls beside the proof; smaller containers, phones and zoomed layouts put the proof first. Actions remain in document flow with a sticky bottom strip. Every control has a persistent label and current value. Native ranges support arrows/Home/End, selects support keyboard selection, color inputs expose the browser's picker, and Space toggles Halftone. The proof button reprints the heading to demonstrate transition timing.

## Controls and URL schema

All inputs pass through `normalizeLab`; all links pass through `decodeLab` and `encodeLab` in `lib/ink-lab.ts`.

| Query key | Visible control | Accepted values |
| --- | --- | --- |
| `v` | Version (implicit) | `1` |
| `r` | Print run | house, sumi, riso, indigo |
| `t` | Turbulence | 0.005–0.12, step 0.001 |
| `d` | Displacement | 0–12 px, step 0.1 |
| `w` | Wobble speed | 0–6 seeds/second, step 0.1 |
| `g` | Paper grain | 0–0.06 opacity, step 0.005 |
| `p` | Decorative plate 1, 2, 3 | Three six-digit hex colors, comma-separated without `#` in the query |
| `n` | Plate count | 2 or 3 |
| `m` | Transition duration | 0–1200 ms, step 10 |
| `h` | Hand style | ink, pencil, crayon, watercolour |
| `o` | Halftone | 0 or 1 |

Choosing a print run loads that run's defaults using the selected hand. Other controls change only their own field. The three plate colors are decorative: readable anchor text retains the preset's contrasting ink. Paper specks and halftone share one opacity budget, at most 6%, behind content. The proof uses a light paper reference except for Indigo night; surrounding chrome continues to use the visitor's actual theme/season until Apply.

A nonempty query becomes a complete canonical v1 query with bounded/quantized numbers, normalized lowercase hex and fixed field order. First duplicate wins; unknown fields are dropped; invalid values use schema defaults. Unsupported versions and raw queries longer than 2048 characters show an explanatory status and House defaults. Raw query length is checked before URLSearchParams normalization, including percent-encoded padding. Hash fragments are removed. Untrusted input never becomes raw CSS, markup, an SVG id or a navigation target.

Edits replace the current history entry, once per animation frame; they do not add entries. Back/Forward and reload restore the proof from the URL. A clean `/lab` stays clean, including after Reset. Opening or editing a shared link **never applies** that recipe to the site, even when another snapshot is already applied.

**Share** flushes pending edits and copies the canonical absolute URL on the current origin. If clipboard access is unavailable or denied, a readonly **Share URL** field appears, focused and selected, with a truthful failure message. Copy it manually, or retry Share after allowing clipboard access. Edits remain intact.

## Apply, lifetime and recovery

**Apply to whole site** flushes and sanitizes an immutable snapshot, calls the shared `AppearanceStore.applyLab`, and synchronizes the root appearance plan. Success is reported after the active root marker exists. The existing runtime updates tagged site SVG filters; the proof has unique, untagged local filters, so applying or editing cannot let the global adapter rewrite the proof.

The applied recipe is stored only in `sessionStorage["otohime:ink-lab:v1"]`. It survives same-tab route changes, full document hops such as Shore, and reloads. It is independent of the share URL. Later edits stay in the proof until another Apply. A fresh independent browser context gets no session recipe. Browser behavior that clones sessionStorage through an opener is outside this promise.

When storage writes are denied, the in-memory appearance still takes effect and the status explicitly says **current page only**, with no promise about routes or reload. Allow session storage and Apply again to recover. Storage getters and operations are guarded by the existing store adapter.

**Reset to house style** calls `AppearanceStore.resetHouse`, clears both `otohime:ink-lab:v1` and the persistent `otohime:print-run:v1`, removes the corresponding root attributes/inline appearance variables, restores the original tagged SVG values through the runtime, resets the proof and replaces the URL with `/lab`. It keeps the visitor's saved theme, season and unrelated state. If removal is denied, Reset restores the current page but warns that saved overrides could return on reload; allow storage and Reset again.

## Scheduling and verification

Native control state commits immediately. A separate proof snapshot and canonical URL update are coalesced into one requestAnimationFrame per frame. The proof component is memoized so draft-only changes do not redraw its heading, card or SVG. Filters apply only to bounded proof elements, with no page rasterization. The local seed clock runs only for visible proof sheets in visible documents, at effective speed zero for reduced motion. It cancels rAF and disconnects its observer/listeners on route deactivation, including Next Activity's cached hidden routes.

The coalescing callback synchronously commits the bounded proof with `flushSync` before publishing its URL. This prevents React's default-priority rAF update from remaining queued beyond the intended paint. The browser regression checks the actual displacement SVG attribute in a second callback registered for that same frame, as well as the unchanged ≤100 ms latency limit and single filter-commit count. A low elapsed-time sample alone cannot prove the preview met its frame deadline.

`e2e/ink-lab.test.ts` exercises every field, a separate unchanged control-card/root/storage negative control, burst update counts, real clipboard copying, clean-context sharing, hostile/overlong links, history, apply → Work → Shore → reload → Lab → reset, denied storage/clipboard and recovery, no-JS heading, motion/observer cleanup, and keyboard traversal at 1366×768, 390×844 and 200% CSS zoom. The zoom case doubles the actual CSS sizing and tests container reflow; it is not a browser toolbar zoom assertion. Screenshots are optional via `LAB_SCREENSHOT_DIR` and are artifacts, never repository binaries.

Real-browser boundaries: production Next build/start, real React, real SVG filters, real Chrome and browser storage/clipboard. Failure tests replace Storage writes/removals and Clipboard.writeText deliberately. The motion test advances Playwright's clock and injects `document.hidden` only for the hidden-tab branch; real scroll intersection, reduced-motion media and observer disposal are observed independently. No external runtime, model or worker queue is introduced by this feature.

Original implementation evidence is recorded in [t-1679-run-9265.md](t-1679-run-9265.md). Fresh rescue verification, performance repair and delivery evidence are in [t-1679-run-9267.md](t-1679-run-9267.md). Local checks demonstrate implementation execution; platform CI, deployment and independent QA remain downstream of the delivery push.

The subsequent frame-deadline repair and fresh verification are recorded in [t-1679-run-9270.md](t-1679-run-9270.md).
