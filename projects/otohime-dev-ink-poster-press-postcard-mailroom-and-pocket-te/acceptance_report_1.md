---
plan_id: pm-249
run_id: run-8725
kind: acceptance_report
verdict: fail
cycle: 1
---
| starting state | action | observable result | evidence |
| --- | --- | --- | --- |
| live https://otohime.dev, desktop/mobile viewport via Playwright Chrome | e2e/postcard.test.ts with BASE_URL (13 pages' og:image, desk, view, image, bad code) | 5/5 pass: Postcard Mailroom is live | node scripts/e2e.mjs, BASE_URL=https://otohime.dev |
| /notes on live | press "/" (and Ctrl-K), wait for dialog.pocket-terminal | dialog never appears, 30s timeout; terminal e2e 0/6 (shell + adventure) | same runner, 0 pass 6 fail |
| /play on live | scroll to "Ink poster press" | section absent (grep press-heading = 0); ink-press e2e 0/6 | curl + e2e |
| /og, /postcard/image?c=zzz | fetch | /og 200 image/png; bad code 404 (negative control ok) | curl |
| origin/main | check head | a847437, author Otohime <quiinthieu@gmail.com> | git; deployed sha unreadable (no gh); homepage x-vercel-cache HIT age 7164s |

Real: live production, real Chrome. No fakes. Logs of the live service are not readable from here. Completeness: no queue/job history applies.
Result: 1 of 3 features delivered to the running product (Mailroom). Terminal (t-1522, t-1523) and Ink Poster Press (t-1524) are on main but not served by otohime.dev. Matches the deferred checks in QA reports rep-5069, rep-5074, rep-5078 ("fails if absent after deploy"). Not waited on (15-minute rule). Cited main sha a847437; deployed build id unknown.
