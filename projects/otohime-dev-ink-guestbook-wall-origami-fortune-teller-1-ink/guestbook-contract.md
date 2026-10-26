# Guestbook storage and API contract

`POST /api/guestbook` accepts only JSON in the version 1 compact vector form:

```json
{"v":1,"name":"A visitor","note":"A wave","durationMs":100,"website":"","strokes":[{"c":0,"p":[1,2,3,4],"w":[3,4],"t0":0,"d":100}]}
```

Logical coordinates are whole pixels on a 240 by 160 sheet. `c` is an index into the three site ink colours (0 ink, 1 coral, 2 blue). Each `p` pair has one quantized width `w` in 1..15; its rendered logical width is `0.5 + 0.3*w`. Each stroke has at least two points. `t0` and positive `d` are millisecond replay hints within `durationMs`, at most 60000, and starts are nondecreasing. The server accepts 1..40 strokes, up to 1500 points, 6144 UTF-8 bytes of serialized strokes, and 8192 request bytes, read incrementally. Unknown fields and caller moderation/decorations are rejected.

Name and note are optional, normalized to NFKC and one line, and limited to 24 and 80 Unicode code points. The filter rejects URLs and the following small English profanity set, including common digit and spaced variants: fuck, shit, bitch, cunt, nigger, faggot. It is a first pass before human moderation. The `website` honeypot must be empty. No caller SVG, bitmap, status, id, tilt, or tape is stored.

A valid write returns `201 {"id":"<uuid>","status":"pending"}`. It never publishes automatically. Invalid shape/text/link/honeypot returns 400; oversized body/vector 413; wrong media type 415; explicit foreign Origin 403. Each error includes stable `reason` and human `message`. Quota returns 429 with `Retry-After`; a full pending queue or absent database/secret returns 503. Responses use `Cache-Control: no-store`. The API logs only a generated request id and failure category, not user content or address.

`GET /api/guestbook` returns `{entries,nextCursor}` with at most 24 approved rows ordered by `created_at DESC,id DESC`. `cursor` is an opaque validated base64url pair of full microsecond timestamp and id. Any `status` query parameter is ignored. Public rows contain only `id,name,note,v,strokes,durationMs,tilt,tape,createdAt`; review fields and rate usage are never selected. Invalid cursor returns 400, unavailable database returns 503. Reads are uncached and do not require the write secret.

Migration `0004_green_scarlet_witch` adds `guestbook_entry` and `guestbook_usage` with status and decoration constraints and the composite descending public index. Apply with `npm run db:migrate` before serving this API. `DATABASE_URL` is required for reads and writes; `BETTER_AUTH_SECRET` is required for writes. No additional service or secret is introduced. The existing trusted deployment ingress passes `x-real-ip` or first `x-forwarded-for`; when neither is available every request uses one conservative `unknown` client bucket. These headers must be set/overwritten by a trusted ingress, not passed through from visitors.

Writes use HMAC SHA-256 namespaced IP/hour buckets, a UTC global/day bucket, and a guestbook-scoped advisory transaction lock. The lock protects the exact caps: three accepted writes per client UTC hour, 100 globally per UTC day, and 500 pending rows. Rejected transactions neither insert nor consume allowance. Expired usage rows are removed in batches of 100 during writes, with no scheduled job. No raw IP is persisted.
