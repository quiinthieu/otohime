# Bottle footer band readiness and a 900-second E2E bound

Under reduced motion the site-wide reset leaves every element on
`transition: all 0.01ms`, so a root font change reaches the rem-based
`.end-inner` padding a frame or more after the root value has settled. The
footer Bottle verifier waited only for the font values plus two frames, which
sits on that boundary. It now waits for the actual band (`3.75rem` plus both
footer borders) before the baseline, every enlarged-label comparison and the
200% reference. When the band never arrives, the verifier fails with the viewport,
the BUILD_ID, both geometries, the computed padding and the border widths. The
2.5rem and -2.4rem negative controls wait only for their own injected value, so
they still fail their original containment assertions.

CI's checks job now has 30 minutes and its E2E step 17. The suite itself is
bounded by `timeout --signal=TERM --kill-after=10s 900s`. A workflow fixture
drives a hung suite and checks for exit 124 plus one bounded annotation.
