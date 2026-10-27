"""Summarize completed logs only; reject missing or partial production repeats."""
import datetime
import hashlib
import json
import pathlib
import re

out = pathlib.Path(__file__).resolve().parent
def counts(name):
    text = (out / name).read_text()
    result = {}
    for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo', 'duration_ms']:
        found = re.findall(r'^# ' + key + r' ([\d.]+)$', text, re.M)
        assert found, (name, key, 'incomplete log')
        result[key] = float(found[-1]) if key == 'duration_ms' else int(found[-1])
    result['log'] = name
    result['log_sha256'] = hashlib.sha256((out / name).read_bytes()).hexdigest()
    return result

trace = counts('trace.log')
units = counts('unit.log')
assert trace['pass'] == 5 and trace['fail'] == 0
assert units['fail'] == units['cancelled'] == units['skipped'] == 0
e2e = [counts(f'e2e-{i}.log') for i in [1, 2, 3]]
assert all(r['tests'] == 180 and r['pass'] == 179 and r['fail'] == 0 and r['cancelled'] == 0 and r['skipped'] == 1 for r in e2e), e2e
builds = [json.loads((out / f'build-{i}.json').read_text()) for i in [1, 2, 3]]
footer = (out / 'footer-local.log').read_text()
found = re.findall(r'^probe: (\d+) ok, (\d+) failed$', footer, re.M)
assert found, 'incomplete Footer log'
footer_ok, footer_failed = map(int, found[-1])
verification = [
    {'name': 'trace helper unit test', 'cmd': 'node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/e2e-gesture-trace.test.ts', 'expect': 'exit0', 'exit_code': 0, 'status': 'pass', 'counts': trace},
    {'name': 'lint and types', 'cmd': 'npm run lint && npm run typecheck', 'expect': 'exit0', 'exit_code': 0, 'status': 'pass', 'logs': ['lint.log', 'types.log', 'lint-final.log']},
    {'name': 'unit tests', 'cmd': 'npm test', 'expect': 'exit0', 'exit_code': 0, 'status': 'pass', 'counts': units},
    {'name': 'e2e x3', 'cmd': 'for i in 1 2 3; do bash scripts/e2e-local.sh || exit 1; done', 'expect': 'exit0', 'exit_code': 0, 'status': 'pass', 'repeats': e2e},
]
data = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'delivery_sha': 'c6d09f0067cb3f3ea77a75b723edc72918013c24', 'tested_head': builds[0]['head'], 'source_fingerprint': json.loads((out / 'source-fingerprint.json').read_text())['sha256'], 'verification': verification, 'builds': [{'id': b['build_id'], 'sha256': b['sha256']} for b in builds], 'footer_local': {'pass': footer_ok, 'fail': footer_failed, 'log': 'footer-local.log'}, 'negative_controls': json.loads((out / 'negative-controls.json').read_text()), 'child_control': json.loads((out / 'child-control.json').read_text())}
(out / 'verification.json').write_text(json.dumps(data, indent=2) + '\n')
report = out.parents[1] / 'qa_report_run-9108.md'
text = report.read_text().replace('E2E_RESULT_PENDING', '3/3 exit 0; each 179 pass / 0 fail / 1 existing skip (180 total)').replace('FOOTER_RESULT_PENDING', f'{footer_ok} pass / {footer_failed} fail; complete same-artifact local probe, EXPECT_SHA=dev')
report.write_text(text)
print(json.dumps({'e2e': e2e, 'footer_local': data['footer_local']}, indent=2))
