---
plan_id: pm-271
run_id: run-9214
kind: acceptance_report
verdict: fail
cycle: 0
---

| starting state | action | observable result | evidence |
|---|---|---|---|
| `/` at 1366×768 and 390×844 (touch) | type `urashima` | lands on `/ryugu` | walk.log 1, 21 |
| `/ryugu`, both viewports | look at the Tamatebako | box shut (`aria-expanded=false`), replay hidden | walk.log 2, 22; shots/*-box-shut.png |
| same | Enter (desk) / tap (phone) on the box | opens; note reads "A changelog replay … The site itself is not rebuilt"; one slider "Scrub back through the changelog" | walk.log 3–5, 23–25; shots/*-box-open-newest.png |
| box open at the newest position | read the newest leaf, compare with live `/api/health` | **newest leaf `fe0dd82eb8` (26 Oct 2026 11:17 UTC), 213 commits behind the live sha `b4e142a`. The note says "the newest 200 of its 414 commits", but git has 627 commits at `b4e142a`. None of the commits after 26 Oct 11:17 appear, including this palace's own Tamatebako and sound deliveries.** | walk.log 6–8, 26–28 (**not ok**) |
| box open | Home (desk) / tap at the slider's left end (phone) | oldest leaf `6b0b2012fe` (25 Oct 17:32 UTC), a real commit (`git show`) | walk.log 9, 29 |
| oldest vs newest | read the computed paper | rgb(242,239,231) at age 0 → rgb(228,213,177) at age 0.497 → rgb(214,186,122) at age 1 | walk.log 10–11, 30–31; shots/*-box-open-older.png |
| middle position | read `aria-valuetext` | "26 Oct 2026, 02:49 UTC: Record QA failure on Co-Authored-By trailer. Commit 101 …" | walk.log 12, 32 |
| palace after clicks/taps/keys, never enabled | count AudioContexts | 0 contexts, status off | walk.log 13, 33 |
| same | press "Sea sound" | 1 running context, quiet output RMS 3.6e-3 (desk) / 2.4e-3 (phone) | walk.log 14, 34; shots/*-sound-on.png |
| sound on, Home in a second tab | Pocket chip `♪ Sea sound` (shows pressed), then press it | palace RMS 0, status off; Home made 0 contexts | walk.log 15–17, 35–37; shots/*-pocket-chip.png |
| sound re-enabled in the palace | "Back to the surface" | the playing context's `close()` is called (1 call, from `running`); the surface makes 0 contexts | walk.log 18–19, 38–39 |
| whole walk, both viewports | watch page errors, console errors, same-origin 4xx/5xx | none | walk.log 20, 40 |
| 390×844 with `AudioContext`/`webkitAudioContext` deleted | tap the sound button | `unsupported`, `aria-disabled=true`, 0 errors | walk.log 41; shots/phone-no-webaudio.png |
| negative control: full clone of this repo at 6809e82 | `npm run history:index` | "git (full history): 200 of 628"; newest `6809e82cd0` (27 Oct 10:26Z). The file was restored afterwards. | negative-control.log |
| negative control: `git clone --depth 1` (what the production job checks out) | run the indexer | "fallback (shallow clone): 200 of 414 … unchanged", which is exactly what live serves | negative-control.log |
| this full clone | `npm run history:check` | exit 1: "content/history.json is stale: 214 commits behind HEAD (at most 20)" | this run |

**Verdict: fail.** `walk.mjs` ran against https://otohime.dev at `b4e142ad37c76abdc496c14afb4ac18b2b5c03ba` and gave FAIL 4 of 41. All 4 failures have one cause: the history replay is stale.

## What works and what does not

- **Works on live:** the box, the scrubber, real commit entries, aged paper and the honest "changelog replay" label (t-1561). The opt-in sound with the Pocket off switch, stopping on leave and the no-Web-Audio fallback (t-1562) work at both viewports with no errors.
- **Does not work as the idea asks:** the Tamatebako does not replay otohime.dev's git history as of the deployed build. The idea asks for history "built at build time from git log". Instead the palace replays a snapshot committed on 26 Oct 11:17Z that ends 213 commits before the version being served, and it shows a false total (414 against 627).
  - **Cause:** the production job checks out with depth 1 (`.github/workflows/ci.yml:281`, no `fetch-depth`). `scripts/history-index.ts` treats a shallow clone as "use the committed fallback unchanged". Nothing in CI runs `history:check`, which already rejects this file.
  - **The gap grows:** the replay drifts further from the real history with every deploy.
  - **It was flagged:** pm-256's acceptance (run-8929) named exactly this failure condition for pm-271: "when Tamatebako ships, its newest entry is older than the product accepts".
  - **Why task QA missed it:** QA probes matched each leaf against `git show`, so they proved the entries are real, not that they are current. QA t-1561 also quoted "200 of 623" from its own local full-clone build, not from production.

## Identities

- **Live:** `/api/health` → `b4e142ad37c76abdc496c14afb4ac18b2b5c03ba` (`health.json`). Deployed by CI run #507 (40485335471), shown as "completed successfully" on the public workflow index. The index for #496–#507 was read; #496–#504 failed and belong to other plans (pm-269, pm-270, pm-257).
- **Deliveries in live** (`merge-base --is-ancestor`): t-1561 `e3852eb` and `9ada4e1`; t-1562 `9d65d9c` and `cf9e3e5`.
- **Author:** all four are `Otohime <quiinthieu@gmail.com>` as both author and committer (`identity.log`). `t-1562/author.txt` names `cf9e3e5` with "(no trailers)", and that matches.
  - Residual: the superseded `9d65d9c` carries `Co-Authored-By: Claude Opus 5.5`. This is recorded and cannot be rewritten without a force-push, so it is not the fail reason.

## Boundaries and limits

- **Real:** production otohime.dev, Google Chrome via the locked playwright-core (npm ci, Node 22.23.3, Linux), the Web Audio RMS from an AnalyserNode tap, cross-tab localStorage, and this repo's git history.
- **Simulated:** no-Web-Audio (constructors deleted) and phone (Chrome mobile emulation with touch).
- **Not read:** Vercel runtime logs (no token on this lease). Errors were judged from the browser side only. CI job logs need sign-in; status comes from the public index.
- **Not re-walked:** pm-256 already accepted the water, the fish and the no-WebGL and reduced-motion fallbacks. I re-checked only the `urashima` entry. Ink ghosts belongs to pm-257.
- **Run profile:** acceptance_engineer, claude-opus-5-5, plan pin claude-opus-medium.

## Defects and deferred

- **D1 (fail):** the live Tamatebako history is frozen at the committed fallback (`fe0dd82`, 414 commits) and does not reflect the deployed sha. Owner: pm-271 product owner. Failure condition: on a fresh deploy, the live `/ryugu` newest leaf is more than 20 commits behind `/api/health`'s sha, or the note's total differs from `git rev-list --count <live sha>`.
- **Deferred:** none.
