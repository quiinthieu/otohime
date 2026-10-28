# Ink ghosts proof and dark deployment automation

- Add a dedicated real Chrome two-context proof with canvas pixels, trail/ripple decay, room isolation,
  anonymous membership, host-cookie separation, throttling and lifecycle/failure controls. Disabled real
  painting fails the same pixel assertion even when the application counter advances.
- Let the local browser runner own the bounded fake; require explicit fake configuration for external servers.
  Keep CI's fake alive through every later browser/footer probe and clean it on success or failure.
- Add one disabled-by-default, dispatchable Worker deployment job with a separate locked install,
  real workerd checks, dry-run, least-privilege secret scope and serialized deploys. Fixture execution
  covers disabled/missing-secret/failure/success paths without deploying.
- Publish exact Worker version metadata and its code/lock/configuration fingerprint, separately from the
  app SHA and Next BUILD_ID. Add read-only identity checks and an operator setup/rollback runbook.

Production activation and independent hosted browser acceptance remain with pm-257/t-1611.
