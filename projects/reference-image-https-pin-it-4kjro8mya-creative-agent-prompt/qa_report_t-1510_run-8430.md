---
plan_id: pm-240
task_id: t-1510
run_id: run-8430
kind: qa_report
verdict: fail
cause: code
delivery_sha: 1f7490b36849aa2bdbcf8d12c61133a5429a814b
deployed_sha: 593d6996ec479bb65043e3a6be91f7bf8a7212b0
green_gate: ver-3357
---

# Independent QA: portable portrait production kit

**Fail, cause=code.** Defect **QA-8430-01**: exporting to a nonexistent directory below a symlink bypasses protected-directory checks and writes all eleven kit files into protected `content/`. Required repository checks and the ordinary kit workflow pass, but this explicitly required path-confinement behavior does not. QA changed only evidence/report files, not application source or the production kit. See [fix plan](fix_plan_t-1510_run-8430.md).

**Paintings delivered: 0/10; gallery portraits activated: 0/10.** The ten text prompts exist. This run does not generate, publish, visually accept or activate paintings.

## Identities and deployment

- Delivery: `1f7490b36849aa2bdbcf8d12c61133a5429a814b`, branch `main`.
- Independently observed deployed build: `593d6996ec479bb65043e3a6be91f7bf8a7212b0`, from the `/sketches` `meta[name=build-sha]` on `https://otohime.dev`. `git merge-base --is-ancestor 1f7490b36849aa2bdbcf8d12c61133a5429a814b 593d6996ec479bb65043e3a6be91f7bf8a7212b0` exited 0. All handoff implementation, kit, source prompt, lock and configuration files listed below match the delivery bytes.
- Board green gate **ver-3357**, verifier **run-8419**, reports all eight contract commands passed at `1f7490b`; obtained independently through `plan_manager_get_task`.
- [Delivery GitHub CI 40231443837](https://github.com/quiinthieu/otohime/actions/runs/40231443837): `checks` job **121284930583** success; `production` job **121286414425** success.
- [Deployed build GitHub CI 40232954343](https://github.com/quiinthieu/otohime/actions/runs/40232954343): `checks` job **121288646287** success; `production` job **121290255918** success. These are GitHub/Vercel jobs, not the platform's GitLab child jobs.
- QA run **run-8430**, task-manager **bbbf4d35-5d94-4584-8ac6-7f0c6311826a**, recorded profile **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**. Local host reports Node **v22.23.3**, fresh `npm ci`, real **sharp 0.35.5**.
- SWE **run-8408**, task-manager **f5938add-d3b5-47aa-b34f-3b4c124020ed**, recorded profile **agy-argon-high**, flags `--model gemini-4-argon-high`, account **billie-agy**, worker **avietidol-z490**. This attribution comes from historical run/task records, not current defaults. Shell verifier run-8419 has no LLM profile.
- `git show` verifies delivery author and committer **Otohime <quiinthieu@gmail.com>**, required subject prefix, and no Co-Authored-By trailer. SWE `author.txt` artifact metadata reports 44 bytes and SHA-256 `7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`. Reconstructing its documented format as `Otohime quiinthieu@gmail.com\ntrailers: none\n` produces exactly those bytes/hash. Raw artifact download returned HTTP 403; its content was verified by this digest comparison and Git, not by claiming a successful download.

## Independent user path and negative controls

[Machine-readable kit evidence](qa_evidence_run-8430.json) records ten separately inspected artifacts and thirteen CLI cases. Artifact inspection used Python standard-library regular expressions and SHA-256, without the handoff parser/validator. It separately extracted each mapping, caption, shared style, composition and copyable prompt from `prompts.md` and the generated Markdown. All ten byte lengths, full-prompt hashes and file hashes match. The Reader retains the seated frontal three-quarter direction; the other nine distinct compositions, palettes and focal points match the sole creative source. These are directions, not a visual review of nonexistent paintings.

| Starting state | Action | Observable result |
|---|---|---|
| Committed text kit | Independently inspect ten Markdown files and manifest | Exactly ten correct PNG/JPEG mappings; 3:4, native >=1536x2048 preference, honest lower-size/no-upscale notes; ten review items; `production_required`; settings explicitly unexecuted |
| Two empty temporary directories | Export twice and compare all bytes with committed kit | Each contains ten prompts and manifest.json, byte-identical to each other and the committed kit |
| Committed kit | Run check and compare every file's bytes and nanosecond mtime before/after | No file rewritten |
| Unusable key and missing settings path | Run export/check with fetch, net.Socket.connect, http.request and https.request replaced by throwing functions | Both succeed; no network request can succeed; no generation module is imported by the CLI |
| Changed Reader prompt plus recomputed file hash/byte length | Check against canonical prompts.md | Exit 1, `prompt_mismatch`, concept `01-quiet-reader` |
| Removed Rain prompt | Check | Exit 1, `missing_file`, concept `03-rainy-afternoon` |
| Extra prompt, duplicate prompt mapping, false completion status | Check each isolated mutation | Exit 1: `extra_file`, `duplicate_mapping`, `invalid_status` respectively |
| Traversal mapping or symlink prompt file | Check each | Exit 1, `invalid_path` |
| Changed source pack / bad CLI flag | Check each | Exit 1 `source_mismatch` / exit 2 `invalid_cli` |
| Temporary replica, `alias -> content`, absent `alias/new-kit` | Real CLI export to alias/new-kit | **Defect: exit 0, ok=true, eleven files written in protected content/new-kit** |
| Empty production portrait manifest | Original `sketches:check -- --require-people` | Exit 1, `manifest contains 0 records`; negative-control assertion succeeds |

The confinement failure was reproduced both by constructing the real exported interface and by invoking the real CLI in a minimal temporary replica. The replica copied `scripts/sketches-handoff.ts`, `lib/sketches-handoff.ts`, `lib/sketches.ts`, `content/portraits.json` and `prompts.md` without modifying any bytes. No production paths were written during the reproduction.

## Defect QA-8430-01

**Owner:** t-1510 software engineer. **Failure condition:** a symlink ancestor points into a protected tree while the final requested directory does not exist.

At `scripts/sketches-handoff.ts:99`, canonicalization is conditional on `existsSync(resolvedOutDir)`. For `alias/new-kit`, it keeps the lexical path and misses that `alias` points to `content`. The final-component-only check at line 177 finds no directory yet. `mkdirSync` at line 204 follows the ancestor link; `writeFileSync` at line 238 then writes the eleven artifacts under the protected tree. This is deterministic and independent of credentials, vendor availability, capacity or the deployed web UI.

Minimal safe reproduction, from repository root, using only a disposable fixture root:

```bash
node --experimental-strip-types --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,symlinkSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {exportHandoffDirectory} from './scripts/sketches-handoff.ts';
const work=mkdtempSync(join(tmpdir(),'pm240-confinement-'));
try {
  const root=join(work,'repo');
  mkdirSync(join(root,'content'),{recursive:true});
  symlinkSync(join(root,'content'),join(root,'alias'));
  const result=exportHandoffDirectory({rootDir:root,
    outputDir:join(root,'alias','new-kit'),
    promptsPath:resolve('projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/prompts.md')});
  console.log({ok:result.ok,written:result.ok?readdirSync(join(root,'content','new-kit')).length:0});
  assert.equal(result.ok,false,'must reject protected target reached through ancestor symlink');
} finally {rmSync(work,{recursive:true,force:true});}
JS
```

Observed `{ok:true,written:11}`, then assertion failure. Expected `ok:false`, stable `invalid_path`, and no writes. The supplied tests exercise a symlink at a final component, not this nonexistent-child case.

## Required checks rerun in this QA checkout

| Command | Result |
|---|---|
| `npm ci --no-audit --no-fund` | Exit 0; 512 packages installed from lock |
| `npm test` | Exit 0; **1615 pass, 0 fail** |
| `npm run portraits:handoff:check` | Exit 0; ten prompt files; production_required; 0 delivered/activated |
| `node --experimental-strip-types scripts/sketches-paint.ts preflight --offline` | Exit 0; real sharp 0.35.5 processor executes, real adapter constructs; 10 prompts, 12 assets, 0 records, credentialAvailable=false |
| `npm run sketches:check` | Exit 0; 12 base sketches, 0 portraits, 0 errors |
| Original artwork-gap assertion | Exit 0; portraits.json is []; child require-people check exits 1 with 0-record message |
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0; nine existing warnings, zero errors |
| `BETTER_AUTH_SECRET=ci-placeholder-not-a-real-secret-0123456789abcdef npm run build` | Exit 0; 182 static pages generated |
| Independent ancestor-symlink negative control | **Fails acceptance as described above**, despite the existing suite passing |

Preflight uses real locked dependencies and constructs the actual adapter without a paid request. Its 768x1024 processor smoke input and 1152x1536/23508-byte derivative are synthetic test data, not artwork. Network blocking in the independent handoff probe proves offline operation only, not the xAI vendor path.

## Deployed APIs and gallery regression

`GET https://otohime.dev/api/health` returned HTTP 200 with `{"ok":true}`. The existing deployed gallery walk was run with `BASE_URL=https://otohime.dev EXPECT_PEOPLE=0 EXPECT_SHA=593d6996ec479bb65043e3a6be91f7bf8a7212b0 bash scripts/walk-sketches.sh`: **walk 16/16, browser probe 103/103, exit 0**. It verifies loaded images, desktop/mobile layouts and no browser console/page errors. Independent downloaded HTML has twelve figures and no People section. The walk also rejects unknown master downloads with 404 and external URL parameters with 400; intercepting an image with a 404 trips the browser image-load control.

The t-1510 delivery diff leaves `content/portraits.json`, twelve base assets, gallery code and original delivery gates unchanged. Subsequent pm-242 changes add frame/wash walk checks; those are unrelated and are not attributed to t-1510. Protected portrait content and the base assets remain unchanged through the tested deployed revision. A cluster log query for container `otohime` (30 minutes, 50-line limit) returned **null**. No Vercel server-log read was available; clean server logs are **unproven**, not inferred from that null response.

## Executable fingerprints

SHA-256 values independently computed from the checkout; each below is byte-identical at delivery and deployed revision. No model weights or generated image artifacts are part of this executable.

| File | SHA-256 |
|---|---|
| package-lock.json | `9005913dc28933faba4649e30c1b4b45b3ae5c049a6b0110ef1a068997e0ad10` |
| package.json | `06bc0c06e04e4833b39678bdb456d45d2758b74334830b4f37c95aa925b09957` |
| next.config.ts | `aa42b15d18f6516b2364ebb47ddb18ee918102e3c430feabcaec04bb586a8a4b` |
| lib/sketches.ts | `8c28d22034be719f76a16d93d8c642c41ae646ff5d1463858a08d85a3b02a43a` |
| lib/sketches-handoff.ts | `0cfd42c757ed10e8f141ad2384ae99db5df4622492e9a4244c15c4aa85490d0f` |
| scripts/sketches-handoff.ts | `48b4703104cb07d8db9bbfd4d3451b966664ba27963210800d0c61a463f3e2b5` |
| lib/sketches-generation.ts | `71a94159e2f5a1ecc70a8fc78e3c3dac65ba4d9fa80cbd7d8e1122968050b216` |
| scripts/sketches-paint.ts | `5e745d2edc8a93b98d1bedadc4b3d0753c16a587785a30d99d57b06e41db8d16` |
| prompts.md | `195f898d267d1d8f9ba8e1e2db6f607bc5b1f5325fce2fff51302591874f4a9f` |
| production-kit/manifest.json | `3159f95680ecae21d1d12fbb795a47a3bb70113458b63d66f89900b92f026f95` |
| content/portraits.json | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` |

The reference hash `baadd08727c729821832757e884dd0db07cdd01a8b14bb02b207377ca3ff4255` is the canonical URL string hash, not downloaded image bytes. Image-model settings are unverified guidance (`grok-imagine-image-2.0`), not execution evidence. Per-prompt file hashes/byte lengths are in qa_evidence_run-8430.json. Older lock/package fingerprints in narrative summaries do not supersede these actual same-executable comparisons.

## History, callbacks and completeness

[History evidence](qa_history_run-8430.json) records scan bounds, ids, recorded agent flags and callback state.

- Complete returned plan-run list: **19**, including **18 succeeded** and this QA run running; all report callback_apply_failures=0. A succeeded verifier process is not the same as every historic verification item passing.
- task-manager project `plan-manager`, FAILED: pages of 20 at offsets **0,20,40**, **54/54** records read; no pm-240 match. COMPLETED: pages of 20 at **0,20,40,60**, **80/918** records read, **incomplete globally**, seven pm-240 matches including delivery and green gate. Older unread records cannot establish universal success.
- Current snapshot for that project: **3 pending**, **4 running**, all returned; no pm-240 pending job, one pm-240 running job (this QA). No queued image-generation job is claimed.
- Historical external probe lives in project `ask_task`: FAILED **1/1**, COMPLETED **2/2**, read at limit 20/offset 0. Its pending/running calls returned empty objects, retained as raw responses rather than treating absent metadata as an audited queue count.
- Raw failed Grok log **267d873e-7bce-47dc-ba6f-59bc0b08d67e** was read: clone `016369aa663331139f5d73a9505e8fa77289638d`, `grok --model grok-4.7 --reasoning-effort high`, account grok-main, exit 1 **Not signed in** before the agent ran. This predates the handoff and is not a failure of its fingerprint. No account/auth probe was repeated.
- SWE raw runner tail was read; a tail is incomplete transcript evidence. SWE **f5938add-d3b5-47aa-b34f-3b4c124020ed** and gate **d9dbf5e7-8f89-436c-a026-3703617c73f0** both have `callbackState=delivered`, callbackAttempts=1. Their persisted plan runs are succeeded; gate **ver-3357** and SWE report **rep-4871** are ingested on t-1510.
- Artwork-review.md records zero vendor requests/candidates/publications/activations, consistent with the current empty manifest. This is saved local evidence, **not independently audited account-wide vendor history**. No provider history or nonexistent art is certified.

## Scope boundaries and deferred checks

| Boundary/check | Status, id, owner and failure condition |
|---|---|
| Integration deployed | Delivery contained in observed deployed 593d699; CI jobs cited above succeeded |
| Execution demonstrated | Real offline CLI and locked sharp/adapter construction succeed; path-confinement defect QA-8430-01 remains reproducible |
| Waiting for capacity | None; no job, watch or runtime-capacity deferral required by this text-kit contract |
| Text kit acceptance | Failed pending QA-8430-01 fix by t-1510 SWE; recheck must reject the linked-parent case before any write |
| Original painting product | **Not delivered, 0/10; activated 0/10**. Existing advisory esc-371 / esc-372 are provenance only, not re-raised gates. External-artifact owner: operator/producer; future delivery-amendment owner: plan-manager product owner |
| Future artwork checks | Unscheduled under this revision. Failure condition: any missing/temporary/unreachable/wrong-hash/wrong-dimension artifact, rejected full-size review or failed original `--live --require-people` / `EXPECT_PEOPLE=10` checks. Requires twenty named native PNG/derivative artifacts with non-expiring supported URLs and actual review evidence |
| Server logs | Vercel log access unavailable in this run; owner: deployment operator/platform. Any assertion of clean server logs requires an actual bounded Vercel log read. Not used to explain away the code defect |

Standing platform documents were absent from otohime; relevant copies were read from the local mono-v2 Git mirror at `f1c5b0f22df35ea818a9a8d4f095f6d1d117bc04`. The task claim, explicit decisions and ancestor-symlink lesson were recorded through plan-manager. No operator wait, account reconfiguration, paid request or application fix was performed.

Saving evidence: the first push was rejected because concurrent report commit `af3c421` landed on main. `git pull --rebase` succeeded; all eight required checks were rerun and passed (1615 tests, zero failures; lint still nine warnings). The concurrent change is another plan's QA Markdown only. No force push was used. The delivery and observed deployment identities above remain the ones under review, separate from this evidence-only commit.
