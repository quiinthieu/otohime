# t-1560 fix plan (run-8858)

**Cause: environment.** The delivery at 543ba68 is correct, with every contract check and independent control green (see qa_report_run-8858.md). What is missing is a production deploy that contains it. Production `/api/health` serves ae4607d. The serialized `main` pipeline cancelled 543ba68's own run, 416 (id 40312088029), in favour of run 417 (id 40312560588, sha 45129f9, which contains 543ba68). At 11:10Z run 417 was waiting for run 414 (id 40311256064, 3673c50), whose `checks` job was green and whose `production` job was running.

Comparison with the last green run of the same job: run 405 (id 40306337481, ae4607d). The only CI config commit between ae4607d and 543ba68 is 841ca69. It changes `.github/workflows/ci.yml:76-98` (E2E output goes to a log and a step summary) and keeps the exit status. Nothing in it can stop a deploy. The pipeline is not broken. It is queued.

## Change

- **No change to t-1560 files.** `scripts/history-index.ts`, `scripts/history-index.test.ts`, `content/history.json` and `package.json` stay as they are at 543ba68.
- **No push to `main` to "kick" the pipeline.** A new push replaces the pending run in `ci-refs/heads/main` (`.github/workflows/ci.yml:11-13`), so it does not speed anything up. This QA run's own report commit sits on top of 45129f9, so its CI run replaces 417 as the pending run and still contains 543ba68. The deploying run is therefore that run or any later one on `main`.
- **If run 417 fails**, read its annotations. The checks job reports failed tests as public annotations.
  - Failure at `e2e/desk.test.ts:597`, the wide-desk swipe control `near(at(moved,"music").x, …)`, which reported 0.3 against 0.425 in run 411: that is a desk E2E defect owned by the desk plan (pm-250/t-1534). It is not t-1560. Open it as a separate desk task, starting from the swipe at `e2e/desk.test.ts:594` and the `stored(wide)` read after it. To get the deploy, re-run the failed jobs of that run from the Actions page (this needs repo write access), or let the next push to `main` run the queue again.
  - Any other failure: compare it with run 414's green `checks` before you assign it to this delivery.

## How the pipeline runs again

It runs by itself. When run 414 finishes, the pending run starts: 417, or the run for this QA commit if it has replaced 417. A full green run takes about 12 minutes (405: 11m56s; 394: 13m0s).

## Proof the next QA run must show

1. The `https://otohime.dev/api/health` `sha` passes `git merge-base --is-ancestor 543ba68fb184a73232fe16e532afb31590a05e73 <sha>`.
2. The CI run that deployed that sha completed successfully. Cite its id.
3. The contract command exits 0 and `npm run build` exits 0 at the cited sha. Repeat one real-clone control: a depth-1 clone gives a byte-identical fallback, and a tampered `--check` exits 1.
