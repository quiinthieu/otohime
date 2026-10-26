# t-1557 Ask deploy bundle probe: summary (run-8894)

Role: software_engineer. Model: claude-opus-5-5 (run profile effort as launched). Plan pm-255, plan doc
`plan_run-8662.md` (eccf196). Base: main 8955310.

## Delivered

- `lib/ask-deploy.ts` exports `chunkCarriesAskCall(text)` and `bundleCarriesAskCall(chunks)`. A match is
  the literal path `api/ask` as a whole segment (`/(?<![\w-])api\/ask(?![\w-])/`). `api/ask-old`,
  `api/asker`, `api/ask_v2` and `xapi/ask` do not count. `"/api/ask"`, `/api/ask?x` and `/api/ask/` do.
  It also exports `chunkLinks(text)` and `collectChunks(baseUrl, fetchText, limit=400)`, the crawl. The
  crawl takes an injected fetch, so its unit tests can prove it.
- `scripts/probe-ask-deploy.mjs` fetches `BASE_URL/` (default `http://127.0.0.1:3000`) and reads its
  `/_next/static/chunks/*.js` links. It fetches each one, prints the counts (linked, checked, carrying,
  plus any non-200 chunks) and exits 0 only when `bundleCarriesAskCall` is true.
- `scripts/probe-ask-deploy.sh` is a thin wrapper. It runs the .mjs under `node --experimental-strip-types`
  so the .ts import resolves, and passes `BASE_URL` through.
- Nothing changed in app/, components/, the route, lib/ask-tier.ts, env or Vercel.

## The judgement call: follow lazy chunks

On a local `next build` of 8955310 (Next 16.4.2), `/` links **16 chunks and none of them carries
`api/ask`**. The console is a dynamic import (`components/ask-console-loader.tsx`), so the call sits in the
lazy chunk `28ruvnx0jj7kr.js`. The HTML never names that chunk. The linked chunk `34u4xutumq18p.js` names it
in its loader table as `"static/chunks/28ruvnx0jj7kr.js"`. A scan of only the HTML-linked chunks would
therefore exit 1 on a correct build. So the crawl also follows `static/chunks/*.js` references inside the
fetched chunks. It stays same-origin, fetches each chunk once and stops at 400 chunks (reported as
truncated). A lazy chunk reachable from `/` counts as linked from `/`.

This also bears on the change request. "17 chunks linked from / contain no api/ask" does not by itself
prove that production is stale, because a current build looks the same at that depth. The deferred
production check should use this probe, not an HTML-level grep.

## Verification (all run in this checkout, exit 0)

| item | command | result |
|---|---|---|
| unit tests | `npm test` | 2168 tests, 2168 pass, 0 fail |
| deploy bundle logic | `node --experimental-strip-types ... --test lib/ask-deploy.test.ts` | 8 tests pass |
| typecheck | `npm run typecheck` | exit 0 |
| lint (extra) | `npx eslint` on the 3 JS/TS files | exit 0 |

Unit cases: a chunk with `/api/ask` is true. A chunk without it is false. An empty bundle is false.
`api/ask-old` (and its look-alikes) is false. `chunkLinks` reads HTML links and loader tables. The crawl
finds the call in a lazy chunk that only a linked chunk names. A stale fake site is false. The crawl
reports non-200 chunks, sets truncated at its limit and rejects a `/` that is not 200.

## Execution evidence (real/fake boundaries)

- Real executable, local: `npx next build` of 8955310, then `next start -p 4093`, then
  `BASE_URL=http://localhost:4093 bash scripts/probe-ask-deploy.sh`. Output: linked 16, checked 21,
  carrying 1. **exit 0.**
- Negative control, a fake: a static fixture server whose one linked chunk holds only `/api/ask-old` and
  names a second chunk. Output: linked 1, checked 2, carrying 0. **exit 1.**
- Unreachable `BASE_URL` (closed port): prints `not ok` and **exit 1**.
- Production (https://otohime.dev) was **not** probed. That is a non-goal here. The check is deferred to
  acceptance per the plan doc ("Production chunk check"). Owner: acceptance, after the CI deploy of this
  delivery. Failure: `BASE_URL=https://otohime.dev bash scripts/probe-ask-deploy.sh` exits 1. If CI
  has deployed and the probe still exits 1, raise `operator_action` `redeploy:otohime-web-production`.

## Not done

- CI and deploy were not watched, per the role contract. plan-manager runs the green gate.
