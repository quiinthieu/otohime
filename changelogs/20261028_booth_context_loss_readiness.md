# Wait for the Booth renderer fallback

The browser verifier now waits for React to publish the exact `canvas2d` backend
after the native context-loss event. Film-stock comparisons, the exact backend
assertion and the nonblank fallback pixel assertion remain intact. This removes
the synchronous-commit assumption identified by Ink Ghosts integration QA.
