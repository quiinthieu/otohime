# Gate closure: local repair controls (pm-258/t-1623)

Plan pm-258 revision 2, task t-1623, SWE run-9080, 2026-10-27.
Actual run: Claude Code agent, model `claude-opus-5-5`, effort `high` (`--model claude-opus-5-5 --effort high`), account `claude-kqviet`, fleet host `avietidol-Z490-GAMING-X`, runner `fleet`.
Base: `e21f83206f8ce94a86e7cd2e8eb2144ef629f9a3`. The delivery SHA is the commit that adds this file. It is recorded in the summary report and `commits.txt` because a commit cannot contain its own SHA.

This delivers local closure tooling only. It does not prove production recovery, a green shared CI lane or personalized presence.

## Command

```sh
npm ci                                  # the locked environment the preflight checks
node scripts/check-gate-closure.mjs     # one JSON document on stdout; exit 0 or 1
```

It runs three nested `node --experimental-strip-types --test --test-reporter=tap <file>` children, side by side, against the files in the current checkout. `NODE_TEST_CONTEXT` is cleared for each child. Each child runs in its own process group, which is killed with SIGTERM and then SIGKILL after at most 180 s. Before the children start, a preflight child checks the locked modules and the embedded Postgres binaries. The command fetches nothing, reads no CI history, launches no browser and changes no deployment.

| Control | File | Required regressions, by exact test name id |
| --- | --- | --- |
| `e2e-runner` | `lib/e2e-runner.test.ts` | `serial_vs_parallel`, `actions_vs_local_reporter`, `ci_status_preservation`, `embedded_postgres_lifecycle` |
| `end` | `lib/end.test.ts` | `footer_heading_source`, `footer_walk_probe_wiring` |
| `urashima` | `lib/urashima.test.ts` | `waterline_structure` |

The assertions stay in those files. The CLI only requires that each named top-level test ran and passed (the full names are in `CONTROLS` in `scripts/check-gate-closure.mjs`).

## Schema `otohime.gate-closure.v1`

| Field | Meaning |
| --- | --- |
| `schema`, `started_at`, `finished_at` | Identity and the time window of the run. |
| `runner` | `real` (node child processes) or the fake port's kind. |
| `certified` | `true` only when `runner=real` and `local_controls=pass`. |
| `checkout` | `root`, `git_sha` (null unless root is a git top level), `dirty`, the first 50 `dirty_paths`, and `git_error`. |
| `runtime` | Node version, platform, arch and the test-runner command. |
| `fingerprint` | SHA-256 of each path in `FINGERPRINT_PATHS` (a directory is hashed as its sorted `path\0sha256` lines), `combined`, `missing`, `changed_during_run` (hashed before and after the children) and `ok`. |
| `preflight` | Locked vs installed vs imported for `playwright-core`, `pg`, `embedded-postgres` and `@embedded-postgres/<platform>-<arch>`. Also each Postgres binary's SHA-256 and its `--version` output. |
| `commands[]` | `id`, `file`, `argv`, `executed`, `exit_code`, `signal`, `timed_out`, `timeout_ms`, `spawn_error`, `duration_ms`, `stdout_tail`/`stderr_tail` (last 4,000 characters each), TAP counts, `required[].status` (`pass`/`fail`/`skip`/`todo`/`missing`/`not_run`), `failures` and `ok`. |
| `local_controls` | `pass` only if the fingerprint is complete and unchanged, the git identity is known, the preflight passed, and every child ran, exited 0 without a signal or timeout, reported a complete TAP summary with tests > 0, pass = tests, no fail/cancelled/skipped/todo, and passed every required regression. |
| `failures[]` | Every reason for `fail`. |
| `external_evidence` | Always `inconclusive`. |
| `not_proven` | `deployment`, `global_green_gate`, `shared_ci_recovery`, `kame_browser_execution`, `browser_user_path`, `historical_raw_assertions`, `author_txt_bytes`, `personalized_presence`. |

A dirty checkout is reported but does not fail the run. `npm run build` regenerates `content/history.json`, and the fingerprint plus `dirty_paths` already show what was tested. The exit code is 0 only when `certified` is true.

## Real and fake boundary

| Evidence | Real or fake | What it proves |
| --- | --- | --- |
| `lib/gate-closure.test.ts` tests 1–5 | Fake child-runner port | Serialization, and how a nonzero exit, timeout, signal, spawn error, thrown runner, empty, malformed, zero, skipped or missing results, a red required regression, a failed or malformed preflight, missing files, a non-git root and a file changed mid-run each turn into `fail`. A healthy fake gives `local_controls=pass` but `certified=false` and exit 1. |
| Test 6 | Real `realRunChild` on throwaway node children | Exit 3 is kept, the 200 kB stdout is cut to a bounded tail, ENOENT becomes a spawn error, and a timeout kills the child together with its grandchild. |
| Test 7 and the CLI | Real nested Node children and real embedded Postgres 17.10 | The current checkout's regressions pass. Hashes are compared with an independent SHA-256 of the files and the git SHA with `git rev-parse HEAD`. |
| Test 8 | Real CLI in an isolated temp copy (its own throwaway git repo, `node_modules` symlinked) | The mutation negative control below. |
| Nothing here | — | Browser or user-path behaviour, Kame's browser run, deployment, served SHA, CI history. |

## Results on this lease (pre-commit tree on base `e21f832`, after `npm ci`)

Healthy CLI: exit 0, `local_controls=pass`, `certified=true`, `dirty=true` (`content/history.json` regenerated by build, plus the new files before commit).

| Command | Exit / signal / timeout | ms | TAP | Required |
| --- | --- | --- | --- | --- |
| preflight | 0 / – / no | 553 | – | modules locked = installed = imported; postgres, initdb and pg_ctl report 17.10 |
| e2e-runner | 0 / – / no | 3980 | 4/4 | all four pass |
| end | 0 / – / no | 412 | 12/12 | both pass |
| urashima | 0 / – / no | 177 | 10/10 | pass |

Mutation negative control: `"--test-concurrency=1", ` removed from `scripts/e2e.mjs` in the isolated copy only (copy hash `8d81865f7f2413b2322e006e3a05dda6ac0db6c039350093de53da4007ad6237`). The CLI exited 1 with `local_controls=fail` and failures `e2e-runner: exit 1`, `1 failed`, `3/4 passed`, `serial_vs_parallel: fail`. Preflight, end and urashima stayed ok. After restoring the file in the copy, the hash was `c34edb6b…` again and the CLI exited 0. The temp copy was removed, and the production checkout's `scripts/e2e.mjs` was never written. The test skips this control when `os.availableParallelism() < 3`, because there node's default concurrency is already serial; this host has 20.

Verification on this tree: `npm test` 2363/2363 pass; `npm run lint` 0 errors / 10 existing warnings; `npm run typecheck` exit 0; `npm run build` exit 0. The first two builds failed in `next/font/google` (`Can't resolve '@vercel/turbopack-next/internal/font/google/font'`), with or without this task's files. With the old `.next` Turbopack cache moved aside, the build passed, so the cause was a stale local build cache, not code. If verification is repeated after a rebase, the results are in the summary report.

### Fingerprints

`combined` = `e4767b0725bbf6092663f70a6888e0d55689f2d63ead0ae1b516095db9cfd73b`. Node v22.23.3, linux x64, kernel 7.0.0-38-generic.

| Path | SHA-256 |
| --- | --- |
| `scripts/check-gate-closure.mjs` | `38bf3c064f9e66ee51c927081997c5336e69ea469a3928ff57ec57884ca9aff2` |
| `lib/gate-closure.test.ts` | `4f9eb7cd3db7427609e7aa798a6c2a3629ba2d8889fc7fd23a665a5a2e03559a` |
| `lib/e2e-runner.test.ts` | `d4b11956ad3200e85b92fb9b83245a076b10b6c80847be56aef6f6d480874c95` |
| `lib/end.test.ts` | `da34e1db0b0d4027bc797734c2a609c67d4168e8996ec53c618fce2a87d93895` |
| `lib/urashima.test.ts` | `df5472e89881014bc75dc1e91e29301193f6bd14a17f3168423a96240cc505af` |
| `scripts/e2e.mjs` | `c34edb6bcaa017a9d552f3762b40ff76bbd2f0956d50ef22422834651d350f96` |
| `scripts/e2e-annotate.mjs` | `9f51f1cc753de5b8690a143ac3f404a90d574d660a5d09f20fd7eebd859933f4` |
| `scripts/walk-end.sh` | `379bee702533f74d321c56b18f1eb01c3ea884e8b9f232de6cd37c5961578d15` |
| `scripts/probe-end.sh` | `e9dbb2589e968a06ea01bd771d1675000b2fb41dd671783b33ec07ec10793fba` |
| `scripts/probe-end.mjs` | `958029c7b17fbd50345b1e949ddd6beab7a37ec88455be0e83ee0e21850b70af` |
| `lib/end.ts` | `0e1cab423c67ed77fc7a1bf065a1e30239238e89a8506bfe7d3ab57faba578b4` |
| `lib/urashima.ts` | `b0c669ac6ddc59b7ef98b1ca7b5a2249f452060e6c51e5f55b771bec1e7663a1` |
| `lib/pages.ts` | `42240e734397fb3ac8d65e57a33ef016b347ce2237da18c2f57a9ce120c8dd95` |
| `content/site.ts` | `64a62e89c7aaa7f839e6c342dda8f991890b0c8031c4c1f1fd7e29f3d13e21ac` |
| `components/end-footer.tsx` | `043707b4ed9eb2b106eae92a30f2e9cb7c576f7d65c1ca6c22b0b160a3adef0d` |
| `components/urashima-keys.tsx` | `e19f857a64fa105992d8ba92574606105c63e46763b5a5e5282e432979143c12` |
| `components/handheld.tsx` | `a400cad3a73b47fbedbcbd146e801bbc88be303d8394e886a80b53f2623cc1c0` |
| `app/(site)/layout.tsx` | `d585cb4de2ec3e9ea8192f25b618c0fcc309386f794901f9bf7943cde3ff2012` |
| `app/(site)/globals.css` | `06ddbe30668c4456062cf103a9c4cb0f64d7771f9a96296d3807f467d0dfc3f7` |
| `drizzle.config.ts` | `e71aa804d5af6318de36246908d13777f49e0c1671927465eef53460b522dbd4` |
| `db/migrations` (directory) | `150edbf1046b1031ae8639848fc81f8728b8395d4277d5c524f2454f5a489172` |
| `.github/workflows/ci.yml` | `0887b2665934bf51631692f4022734c8acb108ea3d535de0b1bbfaf6be32afe7` |
| `package.json` | `cc0c85cfdc4261781ddeea43ceaad9c743f6269e1f8a0fbbf5ecc849a96a501d` |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |

Locked modules: playwright-core 1.64.0, pg 8.23.1, embedded-postgres 17.10.0-beta.17, @embedded-postgres/linux-x64 17.10.0-beta.17. Binaries: postgres `87eec857…6a99`, initdb `8d9bd95e…bd7b`, pg_ctl `7ab40d78…50fa`.

The landed repairs 841ca69, 15fd171, 3351f78 and 9ddd084 are ancestors of the base (`git merge-base --is-ancestor`, exit 0 each). This task changes none of their code.

## Scope and what stays unproven

This run proves only that this checkout's local regressions for the landed runner, reporter, CI-status, embedded-Postgres, footer-wiring and waterline repairs ran and passed in the locked Node 22 environment. It did not read CI history, live `/api/health`, the served SHA, the raw historical assertions or the author.txt bytes. Those remain inconclusive for plan acceptance. No runtime, queue or scheduled work was submitted.

## Unresolved owners (from plan revision 2, unchanged)

| Outstanding item | Evidence anchor | Owner and failure condition |
| --- | --- | --- |
| Desk swipe | 40310239199/checks 121530268639; desk.test.ts:597; music x0.3 vs0.425 | pm-270/t-1606; fails if the displacement assertion recurs on matched sources containing the repair. |
| Riso footer integration | ver-3586/run-9009/task 1527adf0-8941-4d2e-955d-5743acd0b45d; rep-5295 local walk 7/matrix 12 failures | pm-268/t-1601 source, pm-270/t-1604 harness; pm-275/t-1617 recorded canonical delivery recovery owner. Reproduced code defects remain failures. |
| Vercel production | 40328273755/121600218178; 40330477897/121613136055 | pm-275/t-1617, predecessor t-1605; fails if production fails or served SHA lacks intended code. pm-275 is paused, not proof of repair. |
| Historical unit reds | Eight run/job pairs in t-1564-closure.md; local fixture fix 17bca22 | pm-275/t-1617; diagnose actual assertions/repeated matched failures. Generic exit evidence remains inconclusive. |
| Original footer raw assertion | 40277523350/121423322274 at 2a58479 | Evidence owner this replacement; footer owner t-1604. Unread assertion remains inconclusive. |
| author.txt bytes | Historical task 03c16ea7; 44 bytes; SHA256 7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada | Existing platform artifact owner; replacement preserves gap. Git identity does not prove artifact bytes. |
| Navigation/hydration candidates | Page already revealed / React #418; no matching annotation in later closure interval | pm-256/t-1559 and pm-259/t-1573; matching uncaught errors remain failures. |
| Personalized music/game | No demonstrated owner public identifier/feed | pm-272 activation/acceptance; absent or mismatched owner feed means personalized output undelivered. |

Prior raw evidence (`qa-run-*`, `t-1564-*`), `research.md` and the archived `plan_run-8715.md` are unchanged.
