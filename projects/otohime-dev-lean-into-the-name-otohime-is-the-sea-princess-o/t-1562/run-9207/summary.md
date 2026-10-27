# t-1562 · Add opt-in palace sound · run-9207 summary (fix cycle for qa_run-8975)

Plan pm-271. Role: software engineer. Run profile: Claude Opus 5.5 (`claude-opus-5-5`). This run follows [fix_plan.md](../qa_run-8975/fix_plan.md).

## 1. What failed CI #452 (fix plan step 1)

Run #452 is `40334420077`, job `121613911206`, on the delivery 9d65d9c. It failed at step 9 `Run npm test`. `gh` is not signed in on this lease, so the raw log was not read. I reproduced the failure on the lease instead:

| Tree | Command | Result |
|---|---|---|
| 9d65d9c | `CI=true` + a `google-chrome` on PATH, `lib/end.test.ts` | **not ok 11**, `130 !== 1` |
| 9d65d9c, control | the same without `CI` | 11/11 |
| 9d65d9c | `CI=true`, `ambience.test.ts` + `palace-sound.test.ts` + `wiring.test.ts` | 24/24 |
| 15bb2ac (HEAD before this run) | `CI=true` + Chrome, `lib/end.test.ts` | 12/12 |

The failing assertion came in with 5dcfe98 (pm-270/t-1604): with CI set and Chrome present, `probe-end.sh` takes the runner branch. It was fixed on main by 17bca22 (pm-259/t-1583, CI #460), which names the same `130 !== 1`. It was **not** a defect in the palace sound.

The delivery is already on main and green. These were read from GitHub's public REST API and the live site; none of it was rerun by this role:
- CI #506 (`40478220840`) at 103f0c5 contains 9d65d9c. Its `checks` job (122101643247, with `npm test` success) and its `production` job (122108815375) are both success.
- `https://otohime.dev/api/health` serves `103f0c5511d4590e66a8a83b1a35acfe870e7ca3`.
- `https://otohime.dev/ryugu` contains `Sea sound: off`.
- Main-branch history read: runs #446–#470 and the latest three (#504–#506). It is not exhaustive.

## 2. The code change in this delivery

The fix plan asks for a new code-touching commit as the delivery, because 9d65d9c and 239a4e6 carry a `Co-Authored-By` trailer and may not be rewritten. Rather than an empty touch, this commit fixes a real defect found while reviewing the sound:

- **Defect:** `pagehide` closed the ambience for good. A palace the browser restores from its back/forward cache (Back after "Back to the surface", which is a plain `<a>`) keeps the mounted button. So every later click, key press or Pocket change was ignored, and the button said "off" forever.
- **Fix:** `ambienceSession` in `app/(ryugu)/_lib/ambience.ts`.
  - `hide` (pagehide) still closes the ambience.
  - `show(persisted)` (pageshow) opens a fresh ambience only on a cache restore. It rereads the stored preference and, like a first visit, waits for a gesture, so there is still no autoplay.
  - `dispose` (unmount) closes it and stops listening.
  - `_components/ambience.tsx` wires `pagehide`/`pageshow` through it.
- **Test:** `ambience.test.ts` "back to a palace the browser kept (bfcache)" runs against the fake AudioContext. Mutation control: making `show()` never reopen fails exactly that test (15/16).

## 3. Verification

The default lease Node is 22.12.0, which lacks `node:module` `stripTypeScriptTypes`. Because of that, `scripts/main-lane-closure.test.mjs` (not this task's) fails there with or without this change. CI resolves `22.x` from package.json, so I used Node v22.23.4 (official tarball, SHA256 verified) for the full gates:

- `npm test`: exit 0, 2507/2507. Under `CI=true` with Chrome on PATH it is also 2507/2507.
- `npm run lint`: exit 0, 0 errors, the same 10 existing warnings.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0, from the space-free APFS clone `/tmp/oto-9207` with `.next` removed. `/ryugu` is static. The build's rewrite of `content/history.json` is not committed.

**Browser (inconclusive for the bfcache path).** I ran [probe-bfcache.mjs](probe-bfcache.mjs) against `next start` of this build in Chrome; output is in the [log](probe-bfcache.log).
- Chrome never restored from the bfcache under automation. Back fired `pageshow persisted=false`, a fresh load, even with `--enable-features=BackForwardCache`, so the probe exits 1 on its final assertion.
- The fresh-load path passed: status waiting, 0 contexts on return, a key plays, the restored button stores off, 0 page errors.

## 4. Identity

The commits are made as `Otohime <quiinthieu@gmail.com>` through the lease's `GIT_AUTHOR_*`/`GIT_COMMITTER_*` env, with no `Co-Authored-By` trailer. Evidence is in [../author.txt](../author.txt). 9d65d9c and 239a4e6 were not rewritten.

## 5. Status

- Execution: demonstrated locally (unit, build and real Chrome on a fresh load).
- Previous delivery: 9d65d9c is deployed in production at 103f0c5.
- This delivery: pushed. Its CI, production deploy and served sha are owned by plan-manager.
- The task fails if any of these happen:
  - this sha's `checks` or `production` job is red;
  - `/api/health` serves a sha that does not contain this commit;
  - `otohime.dev/ryugu` stops serving `Sea sound: off`.
