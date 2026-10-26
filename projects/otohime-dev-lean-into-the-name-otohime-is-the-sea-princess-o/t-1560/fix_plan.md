# t-1560 fix plan (run-8843)

**Cause: code.** The contract's verification command `node … --test scripts/history-index.test.ts` is nondeterministic. Test 8 ("the index is capped at MAX_ENTRIES…") fails intermittently with `bad tree object HEAD`. Its fixture repo makes 205 quick commits, and git's detached auto-maintenance (`gc --auto` / `maintenance run --auto`) repacks and prunes loose objects under it. On this lease, 3 of 7 full-file runs failed. With auto-maintenance off, 0 of 8 runs of test 8 failed.

## Change

`scripts/history-index.test.ts:38`: add config that turns off automatic maintenance to `GIT_ENV`. Every git call in the test passes through `GIT_ENV`: `sh`, the commit in `fixtureRepo` and `runScript`. The `gitRunner` calls made by the code under test inherit `process.env`, so set the variables on `process.env` as well, or pass them in through the env:

```ts
const NO_AUTO_GC = { GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: "gc.auto", GIT_CONFIG_VALUE_0: "0", GIT_CONFIG_KEY_1: "maintenance.auto", GIT_CONFIG_VALUE_1: "false" };
const GIT_ENV = { ...process.env, ...NO_AUTO_GC, GIT_CONFIG_GLOBAL: "/dev/null", … };
```

An alternative is `-c gc.auto=0 -c maintenance.auto=false` in `sh` and in the commit call at line 56, but the environment form covers every call at once. Do not change `scripts/history-index.ts`: its behaviour passed every independent control.

## Proof the fix cycle must show

1. Run the full contract command 10 times in a row, all exit 0. The baseline on this lease was 3 failures in 7.
2. `npm run build`: exit 0.
3. A negative control showing the change matters, for example a temporary revert in the lease: default config reproduces `bad tree object HEAD` at least once in about 10 runs of test 8.
4. Push, and confirm `/api/health` reports a sha that contains the fix commit, or name the CI run id that is carrying it.
