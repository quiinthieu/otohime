---
plan_id: pm-249
run_id: run-8725
kind: change_request
verdict: fail
cycle: 1
---
A visitor to https://otohime.dev still cannot press "/" or Cmd/Ctrl-K to open the Pocket Terminal, run `adventure` or earn the stamp, and cannot see or export an Ink Poster Press on /play. The postcard mailroom does work live.
Evidence: BASE_URL=https://otohime.dev e2e: pocket-terminal 0/6 (dialog.pocket-terminal never visible), ink-press 0/6 (no press-heading on /play), postcard 5/5. Main is a847437 and contains 654c406, 1417dd8 and 76141f1.
Service: otohime.dev web deploy (.github/workflows/ci.yml main to Vercel).
Work for the product owner: get main (a847437 or later) deployed to production and make the deployed sha observable (e.g. a build id in /api/health), then re-run acceptance. Fails if the terminal dialog or /play press is still missing after a green deploy of that sha.
