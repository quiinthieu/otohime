# QA report t-1541 (run-8657): pass

Delivery 5d54e31 is an ancestor of main d51172e. Author Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer.

Rerun on a fresh npm ci checkout: npm test 1878/1878; npm run build exit 0; probe-ask-llm.sh 6 ok; probe-ask-llm-fake.sh exit 0 (docker Postgres, 4 migrations; on 42 ok, off 11 ok).
Negative control: the on phase started without ASK_LLM=1 exits 1 with 30 not ok.
Real: built app, route, SDK, Postgres 16, Chromium. Fake: Anthropic endpoint and key.
Not proven: production ASK_LLM/key (set-env:ask-llm-production, acceptance), live Haiku quality, CI for the sha.
