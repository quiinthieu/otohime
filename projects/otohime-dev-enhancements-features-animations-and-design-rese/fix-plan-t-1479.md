# Fix plan t-1479 (cause=code)

File: scripts/probe-ink-modes.mjs, line 282, in rateOk().
Change `minGap >= 120` to `minGap >= 60`, and update the comment on line 276 to say "never two changes closer than one 12 fps tick (83 ms) allows, less jitter". The rate window (4.5 to 6.7 Hz) stays as is, and the doubled-clock negative control still fails because it would give about 12 Hz.
No application source change is needed.
Verify: run `SKIP_BUILD=1 bash scripts/probe-ink-modes.sh` five times in a row, all exit 0; the doubled-clock negative control must still report "ok".
