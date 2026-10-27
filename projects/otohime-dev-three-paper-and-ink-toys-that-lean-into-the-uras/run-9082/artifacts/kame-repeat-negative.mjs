import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import assert from 'node:assert/strict';
const args=['--experimental-strip-types','--disable-warning=ExperimentalWarning','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','--test','--test-name-pattern=keyboard hold threshold'];
for(let i=1;i<=10;i++) {
  console.log(`Focused repetition ${i}/10`);
  const r=spawnSync(process.execPath,[...args,'e2e/kame.test.ts'],{stdio:'inherit',env:process.env});
  assert.equal(r.status,0);
}
const negative='e2e/.kame-negative-run-9082.test.ts';
try {
  const source=readFileSync('e2e/kame.test.ts','utf8');
  assert.equal(source.split('  const started =').length,2);
  writeFileSync(negative,source.replace('  const started =','  await pet.evaluate((button) => button.blur());\n  const started ='));
  const r=spawnSync(process.execPath,[...args,negative],{encoding:'utf8',env:process.env});
  console.log('Negative control: blur the held key after keydown');
  console.log(r.stdout); console.error(r.stderr);
  assert.equal(r.status,1);
  assert.match(r.stdout,/the focused key remains held beyond the 500ms threshold/);
  assert.match(r.stdout,/'swim' !== 'pet'/);
} finally { try { unlinkSync(negative); } catch {} }
