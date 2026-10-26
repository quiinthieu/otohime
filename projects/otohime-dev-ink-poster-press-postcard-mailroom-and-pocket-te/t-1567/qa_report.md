# t-1567 QA report (run-8740, claude-sonnet-5-5): PASS

Delivery sha 54a95833a57904b71c3855ba5ff223b9e2cdf4d5 (author Otohime <quiinthieu@gmail.com>, no trailer; checked with git log). It is an ancestor of origin/main. Green gate: pass for 54a9583.

| check | result |
| --- | --- |
| npm ci && npm test | 1995/1995 pass |
| npm run typecheck && npm run lint | exit 0, 0 errors, 10 old warnings |
| real build GITHUB_SHA=54a9583... + next start on embedded Postgres, independent probe (/tmp, not the SE's) | GET /api/health 200, sha == 54a9583... |
| negative control, same build, EXPECT_SHA=dev | probe fails (1 fail) |

Real: Next build, server, Postgres, HTTP. Fake: none besides the injected GITHUB_SHA.

## Production (not observed, deferred by plan)
https://otohime.dev/api/health still returns {"ok":true}; build-sha meta is c38f72a6e927, which does NOT contain 54a9583. This is expected: deploy is Cycle 2 tasks 2 and 3 (checks green on main, production job asserts health sha == GITHUB_SHA). Not a defect of t-1567; owner: those tasks; failure condition: after they land, live /api/health sha != the deployed main sha.
No scheduled/history evidence applies (no jobs or queues involved).
