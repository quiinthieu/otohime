// Drive the additional CI footer gate against the same local production app and live fake.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';

test('actual CI footer probe with its ownership and network negative controls', { timeout: 480000 }, async () => {
  const status = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning',
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/probe-end.mjs'], {
      env: { ...process.env, ANY_SHA_OR_DEV: '1', EXPECT_SHA: '', PROBE_LOCAL: '1', TMPDIR: '/tmp' },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve(code ?? signal));
  });
  assert.equal(status, 0, 'the real footer CI gate must pass');
});
