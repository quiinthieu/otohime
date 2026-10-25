# QA report t-1517 Ask model switch (run-8485)

Verdict: pass. Delivery sha 29191450a082f7218811a648b39fa10674a65b84; checked on main HEAD 6c953be, which contains it (`git merge-base --is-ancestor` true). Green gate for 2919145: pass.

Independent checks (fresh npm ci, main 6c953be):
- npm test: 1712/1712 pass (gate had 1680 at the delivery; later commits add tests).
- npm run ask:check: exit 0; covers Work /work (7), Projects /projects (12), Notes /notes (3).
- npm run typecheck: exit 0.
- MODEL = "claude-haiku-5-5" in lib/ask-llm.ts; the only "fallbacks" left is a comment.
- Author of 2919145: Otohime <quiinthieu@gmail.com>, no Co-Authored-By trailer. (author.txt not supplied; checked via git log.)
- Negative control: reverting MODEL to opus makes lib/ask-llm.test.ts fail 3 tests. Restored; tree clean.

Real/fake: the Anthropic client and usage store are fakes in tests. No live API call: ANTHROPIC_API_KEY is absent. Live Haiku output and production ASK_LLM enablement are unproven, as the plan states. CI pipeline not observed. No history/queue evidence applies (no job submitted).
