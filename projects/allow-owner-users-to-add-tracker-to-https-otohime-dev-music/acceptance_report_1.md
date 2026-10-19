---
plan_id: pm-186
run_id: run-6322
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: bbdcd2ba5c8908f3529bea7a36287e30bace2521
---

# Acceptance: Owner Channels on /music (pm-186)

**Verdict: pass.** An owner can add a YouTube song as the next channel on `/music`, and every visitor sees it at once. The owner can also remove it with two presses. Admins, plain users and signed-out visitors see no form. I walked this in a browser at 1366x768 and 390x844 on a production build of the deployed code. I also walked production anonymously.

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev, signed out | `EXPECT_SHA=<live> BASE_URL=https://otohime.dev bash scripts/walk-music.sh`, read build-sha before and after | 8 ok, 0 failed, at build-sha `1acc13b` and again at `bbdcd2b` (redeployed mid-run, unchanged across that walk); `/api/health` `{"ok":true}` | walk output, curl |
| otohime.dev, signed out, both viewports | Chromium opens `/music` | 200; CH 01–03 visible in Listings; no "Add a channel" and no `video` field; no horizontal scroll; no console errors | Playwright 9 ok, `remote-*-anon.png` |
| Local `next start` at `1acc13b` (`GITHUB_SHA` stamped), fresh docker Postgres 17, `db:migrate` | Anonymous opens `/music` (both viewports) | 200, exactly CH 01–03, no form | walk 49/49 |
| Owner, admin and plain user signed up through `/sign-in` → "Create one"; roles raised by SQL as README "Roles" documents | Admin and plain user open `/music` | 200, no `video` field, no "Add a channel" | walk 49/49 |
| Owner signed in | Open `/music` | "Add a channel" heading and form are shown (YouTube link, Title, Artist, Note, Colour); no horizontal scroll at 390 | `local-*-owner-form.png` |
| Owner, form filled with `https://youtu.be/dQw4w9WgXcQ?si=share123`, colour blue | Press **Add channel** | "Channel added." shown and the form clears. CH 04 appears in Listings and under "Added channels" without a reload. The row holds `dQw4w9WgXcQ`, `blue`, `created_by` = the owner's id | walk, SQL, `local-*-owner-added.png` |
| New anonymous visitor and the plain user | Open `/music` | CH 04 with the new title on the very next request | walk |
| Anonymous, YouTube player ready | Press **▼ Ch** from CH 1 | the TV wraps to CH 4: the LCD reads "CH 4" and the readout reads "CH 4: <title>, Acceptance Band." | `local-*-anon-tv-ch4.png` |
| Owner | Add the same video as a bare id | the alert reads "That video is already channel 4." and no row is added | walk, SQL |
| Owner | Add `https://evil.com/watch?v=dQw4w9WgXcQ` | the field error "Paste a YouTube link…" appears and no row is added | walk, SQL |
| Owner, keyboard focus on Remove | Enter, then Esc, then two presses | Enter shows "Really remove?" with a solid 2px outline. Esc goes back to "Remove" and the row stays. Two presses delete the row from the page and the DB | walk, SQL |
| New anonymous visitor after the remove | Open `/music` | CH 01–03 only | walk |
| 12 owner-added rows (SQL), owner signed in, both viewports | Open `/music`, then add a 13th (`www.youtube.com/watch?v=…&list=…&t=3`) | CH 01–CH 15 listed with no horizontal scroll. The 13th is refused with "12 channels added. Remove one to add another." and the count stays 12 | cap 6/6, `local-*-cap.png` |
| Checkout `1acc13b` with docker | `bash scripts/e2e-local.sh` | exit 0, 18/18. This includes the no-JS owner add, and replayed adds as plain and admin plus a replayed remove as plain, which change nothing. Owner-only `song` on `/admin/roles`. No container or listener left behind | e2e log |

## Shas and identity

- **Deployed:** `bbdcd2ba5c8908f3529bea7a36287e30bace2521` (otohime.dev `build-sha` at the end of the run). It was `1acc13bb4fd9cb1222dc6ec033ba4d2eae2df6ea` at the start. `git diff --stat 1acc13b bbdcd2b` touches only `qa-t-1068.md`, so the code is identical. Both delivery shas, `ddfda18` (t-1067) and `1acc13b` (t-1068), are ancestors.
- **Commit identity:** every `pm-186` commit (`f2ad003` plan, `ddfda18`, `5b72d29`, `954f3bc`, `1acc13b`, `bbdcd2b`) has author and committer `Otohime <quiinthieu@gmail.com>`, and none has a `Co-Authored-By` trailer. The delivery evidence has no author.txt.

## Logs

- Local `next start` log: startup lines only. No error or warning during either walk.
- Postgres container: no `ERROR` or `FATAL` lines.
- Browser console: the second full walk and both production walks logged zero errors. The first run logged one "Permissions policy violation: compute-pressure is not allowed in this document". No app source and no built chunk uses compute-pressure, and three targeted re-runs did not reproduce it. I treat it as YouTube embed noise.
- Production runtime logs (Vercel) and GitHub Actions are not readable from this lease: the repo is private, `gh` is not signed in, and there is no Vercel CLI. `bash scripts/e2e-local.sh` at the deployed code stands in for CI's `checks` job, as plan.md allows.

## Limits of this proof

- Production's Neon database is not reachable from here. On production, an empty `song` table and a missing one render the same page. In `.github/workflows/ci.yml`, the production job runs `npm run db:migrate` before `vercel deploy --prebuilt --prod` as sequential steps, so a live `bbdcd2b` means migration `0002` ran. The real owner adding a channel on production is advisory in plan.md and was not tried.
- My first two walk runs broke in my own harness: a `networkidle` wait never settles while the YouTube iframe streams, and a stale row from the crashed run made the next add a correct duplicate refusal. I cleaned up my rows, and the clean run is the one cited.
