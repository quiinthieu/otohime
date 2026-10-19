---
plan_id: pm-181
run_id: run-6277
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: 00f04b08489dbedc2a6d9d42b306beb74910ba7e
---

# Acceptance: Shore Sea-Glass Timer (pm-181)

I walked https://otohime.dev in a real headless Chromium (Playwright, Chrome Headless Shell 156) at 1366x768 and at 390x844 on 2026-10-19. Production's `build-sha` meta reads 00f04b0.

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev serves `build-sha` 00f04b08489dbedc2a6d9d42b306beb74910ba7e | Read the meta on `/` and `/shore` | Both carry 00f04b0. It contains 5d2040d, 1e171e8, 34495a2 and 00f04b0 (`git merge-base --is-ancestor`). Main head 0e8a03c only adds qa-t-1060.md | curl; remote walk check `/shore build-sha` |
| Fresh browser on `/projects`, both viewports | Open the Projects bench | 200, site sidebar (`aria-label="Main"`) present, exactly one link to `/shore` | browser walk: `/projects 200`, `has one Shore link` |
| `/projects` | Click the Shore row | Full page load to `/shore`, title "Shore", no site sidebar, exactly one stylesheet (`/_next/static/chunks/2qu0zji_i7i6m.css`) | browser walk |
| `/shore`, empty ledger | Look at the page | Sea-glass design: paper scene, serif display, letter-spaced captions, lilac capsule length control, lagoon Begin, lilac action toolbar. All 3 sea-glass canvases are painted (non-transparent pixels) | screenshots below; `canvases are painted: 3/3` |
| `/shore`, 25 min chosen | Press Begin, wait 2 s | Countdown 25:00 → 24:58, Begin becomes Pause, tab title `24:58 · Shore` | browser walk |
| Running | Pause, wait 1.5 s, then Resume | Countdown holds at 24:58, the button reads Resume, and Resume restarts it | browser walk |
| Running | Finish now | One "25 minute piece" pebble (mint, seed 2095245), the note says "A piece of sea glass washed up.", tally "1 piece · 25 min" | `localStorage["shore-v1"]` = `{"scene":"light","pebbles":[{"minutes":25,"palette":"mint","seed":2095245,…}]}` |
| One pebble | Reload | The pebble and tally survive | browser walk `pebble survives reload` |
| One pebble | Choose 15 min, Begin, Finish now | A second pebble, amber, distinct seed 2095246, tally "2 pieces · 40 min" | browser walk |
| Light scene | Press Dark scene, reload | Wrapper class `shore dark-scene`, kept across the reload | browser walk; dark screenshots |
| Two pebbles | Clear today → Keep, then Clear today → Yes, clear, reload | "Clear 2 pieces?" confirm appears, Keep keeps both, Yes clears, the shore is empty after reload | browser walk |
| `/shore` | Click the "otohime.dev" link in the top bar | Full load to `/`, title "Otohime", site stylesheet back | browser walk |
| Whole walk | Watch console, page errors and HTTP ≥ 400 | None at either viewport | browser walk `no console/page/http errors` |
| Site pages | Fetch the site stylesheet for `/`, `/work`, `/projects` | No `sea-glass`, `dark-scene` or `.shore` rules; Shore's stylesheet has no `--tw-`, `tailwind` or `--color-paper` | grep counts 0; walk check `stylesheet is Shore's own` |
| otohime.dev | `BASE_URL=https://otohime.dev EXPECT_SHA=00f04b0… bash scripts/walk-shore.sh` | `walk: 20 ok, 0 failed`, exit 0 (site pages 200, `/shore/nope` and `/nonexistent` 404 with the parcel page) | /tmp/walk-remote.log |
| Clean checkout of main 0e8a03c | `npm ci`, `bash scripts/walk-shore.sh` (build + `next start` :4019) | `walk: 21 ok, 0 failed`, exit 0, no server left on 4019 | /tmp/walk-local.log |
| Local `next start` of 0e8a03c on :4031 | Same browser walk against it, then read the server log | Same 57 ok, 1 note (below). The server log has only the Next.js ready lines, with no errors | /tmp/next-4031.log |

## Verdict: pass

The idea asked for a project that uses the sea-glass UI design as a separate component, untouched by otohime's design. Shore exists at otohime.dev/shore. It has its own root layout, its own single stylesheet and the vendored Apache-2.0 renderer drawing live glass. No Tailwind or site tokens reach it, and no Shore CSS reaches the site. A person can find it from the Projects bench and use the timer: Begin, Pause/Resume, Finish now, pebbles that persist, the dark scene, Clear today. They can also get back to the site. This works at desktop and phone sizes on production.

## Note (not blocking): 11px sideways pan on phones

At 390x844 the document is 401px wide. The Session actions toolbar's sea-glass canvas includes its 48px glow gutter, so it spans left −11 to width 412. A phone can therefore pan 11px sideways, and in the dark scene a pale strip shows at the right edge when panned. All content is visible and every action works. `/`, `/projects` and `/work` do not overflow. One rule such as `overflow-x: clip` on `.shore` would fix it. Recorded as a decision, not a fail.

## Sha and identity

- Deployed: otohime.dev `build-sha` 00f04b08489dbedc2a6d9d42b306beb74910ba7e (t-1060 delivery; t-1051 5d2040d, t-1052 1e171e8 and t-1059 34495a2 are ancestors).
- Local build: 0e8a03c29924080f80a1e771e8bb9250aab954d2 (00f04b0 plus a QA markdown file).
- Author: no author.txt in the delivery evidence. All four delivery commits are authored and committed by Otohime <quiinthieu@gmail.com>. Each carries a `Co-Authored-By` trailer, which plan.md revision 3 accepts. Recorded as a decision.
- Logs: the local `next start` log is clean. Production runs on Vercel, whose logs are not readable from this lease. The browser saw no errors or failed requests there.

## Screenshots (taken on this lease, not committed)

`/tmp/pw/shots/{1366x768,390x844}-{projects,shore-light,shore-dark,home-after}.png`. I inspected them myself: the light and dark scenes render the glass controls and the mint and amber pebbles as designed.
