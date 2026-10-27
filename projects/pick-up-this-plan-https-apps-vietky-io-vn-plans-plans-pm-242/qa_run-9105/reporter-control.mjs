import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Run from the repository root. Assertions are synthetic; the child/pipe/reporter are real.
const code = `import {createProbeChecks} from './scripts/probe-checks.mjs'; const p=createProbeChecks(); p.check('QA deliberate cassette mismatch',false,'fixture marker missing');for(let i=0;i<20000;i++)p.check('later green '+i,true);process.exitCode=p.finish();`;
const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', maxBuffer: 3e6, timeout: 10000 });
assert.ifError(child.error);
assert.equal(child.status, 1);
const bytes = Buffer.byteLength(child.stdout);
assert.ok(bytes > 400000);
const tail = Buffer.from(child.stdout).subarray(-4096).toString();
assert.match(tail, /QA deliberate cassette mismatch: fixture marker missing/);
assert.match(tail, /20000 ok, 1 failed/);
assert.throws(() => assert.equal(0, 1));
assert.throws(() => assert.match(tail.replace(/.*QA deliberate cassette mismatch.*\n/g, ''), /QA deliberate cassette mismatch/));
console.log(JSON.stringify({ exit: child.status, bytes, tail, negativeControl: 'checker rejects green exit and a tail stripped of its failure' }, null, 2));
