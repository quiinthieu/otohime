# t-1606 QA fix plan — run-9041

Cause: **environment**. The delivered desk gesture tests work against the real
production build; the deployment lane still has a deterministic stale verifier.
This is a CI probe defect outside the t-1606 delivery, requiring a concrete script
repair. No operator gate or authority reconciliation can fix it.

Owner: **pm-264/t-1590 software engineer**, with **pm-270 CI acceptance** owning
the subsequent main workflow/deployment proof.

## Defect and repair

1. At **scripts/probe-end.mjs:503**, the normal seven-route footer check reads
   `footer.querySelector("h2#end-title")?.textContent?.trim()`. At **:1881**, the
   no-JavaScript check repeats that read. Both compare for exact equality with
   the single title (comparisons at **:526** and **:1893**). Change each read to
   select `h2#end-title .riso-source`, with the plain h2 as fallback when there is
   no Riso source. Keep exact equality and keep the query scoped to that heading.
2. Add a regression that executes the browser heading read against actual nested
   Riso markup, with JavaScript enabled and disabled. A wrong plain source with
   correct decorative text must still fail. Preserve the normal plain-heading
   case. Do not read text elsewhere on the page or accept duplicated titles.
3. Keep **scripts/walk-end.sh:241** from **ab34874**: its corresponding shell
   repair already passes independently, 65/65. Do not undo that repair and do not
   modify `ink-desk.tsx`, expected drop thresholds, breakpoints, or quarantine
   the desk checks.

Independent evidence: [footer-browser-reproduction.json](qa_run-9041/footer-browser-reproduction.json)
shows the exact full DOM text is duplicated in both JS and no-JS contexts on a
real production build of **ab348743f001460a066f5233c4d99f95af8b15ba**. The plain
source matches `site.end.title`. The served local build meta is `dev`; source,
lock, configuration and build identities are separately recorded in QA artifacts.
The defect survives the shell-only fix and is deterministic, independently of
the main attempt.

## CI comparison and recovery

Last green checks job **121601102988**, run **40330477897**, sha **0740594**,
passed the footer probe before Riso markup landed. Runs **40346324813** (job
**121654087754**, sha **74522bc**) and **40349872187** (job **121666695821**, sha
**e03cf1c**) subsequently passed E2E but failed the earlier Footer walk.
The CI configuration log and diff between green and failing sources were read
before assigning environment; see [ci-comparison.json](qa_run-9041/ci-comparison.json)
and [configuration diff](qa_run-9041/ci-config-between-green-and-failure.diff).
Current main attempt **40352230491**, sha **ab34874**, **failed Footer Chromium
probe** (checks job **121675094950**), confirmed independently on the public
GitHub run and job pages after the final API read hit a rate limit. The observed
raw DOM mismatch proves the concrete verifier defect; unread job logs may contain
additional failures. Final live remains **074059495faf4bee48e8f655584dfd4487089b41**,
which omits 3ae76a4. A running or queued attempt does not satisfy the
deployment requirement or waive the reproduced browser assertion defect.

Push the executable script repair to **main**; `scripts/probe-end.mjs` is outside
the report-only paths-ignore, so this starts CI. If a prior pending run was
replaced, use the existing **CI → workflow_dispatch** action on main, without a
report-only trigger commit. No workflow edit or runner replacement is required.

Verify the repaired browser probe against a real production Next server and
Postgres in the locked npm environment:

```sh
npm ci
npm run lint && npm run typecheck
npm test
# With a production server/database already running, use its real build SHA:
BASE_URL=http://localhost:4027 EXPECT_SHA=dev CI=true bash scripts/probe-end.sh
```

Then independently read the new main run's **checks** and **production** results,
and both `https://otohime.dev/api/health` and `/desk` build meta. Require
`git merge-base --is-ancestor 3ae76a4 <deployed-sha>` to return 0, alongside the
already persisted green gate **ver-3593** for **3ae76a4**. Repeat the delivered
wide-desk control against that real deployed build and its tablet negative
control. The deploy script's local fake-npx tests prove bounds only; they cannot
establish production delivery.

Failure condition: either browser title comparison still rejects the correct
accessible Riso title, the repaired main run is red, the served SHA omits
3ae76a4, or the real wide swipe fails to move by 120px. Required final delivery
remains unaccepted until observed. Do not wait for a soak or capacity reset.
