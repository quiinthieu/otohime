"""Negative control: the delivered test must reject a relaxed real runner cap."""
import hashlib
import json
import pathlib
import subprocess
import tempfile

out = pathlib.Path(__file__).resolve().parent
test = pathlib.Path('lib/gate-closure.test.ts').read_bytes()
original = pathlib.Path('scripts/check-gate-closure.mjs').read_text()
with tempfile.TemporaryDirectory(prefix='pm270-child-control-') as tmp:
    root = pathlib.Path(tmp)
    (root / 'lib').mkdir()
    (root / 'scripts').mkdir()
    (root / 'lib/gate-closure.test.ts').write_bytes(test)
    args = ['node', '--experimental-strip-types', '--disable-warning=ExperimentalWarning',
            '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--test',
            '--test-name-pattern=the real child runner keeps exits', str(root / 'lib/gate-closure.test.ts')]
    for label, cap, expected in [('negative', '2_000_000', 1), ('positive', '1_000_000', 0)]:
        (root / 'scripts/check-gate-closure.mjs').write_text(original.replace('const KEEP_CHARS = 1_000_000;', f'const KEEP_CHARS = {cap};'))
        result = subprocess.run(args, capture_output=True, text=True, timeout=60)
        (out / f'child-cap-{label}.log').write_text(result.stdout + result.stderr)
        assert result.returncode == expected, result.stdout + result.stderr
        if label == 'negative':
            assert 'output over the bound is cut to the bound' in result.stdout
            assert '1200000' in result.stdout
(out / 'child-control.json').write_text(json.dumps({
    'real': True, 'producer': 'actual Node children, callback-flushed',
    'copied_test_sha256': hashlib.sha256(test).hexdigest(),
    'mutated_cap': 2000000, 'negative_exit': 1,
    'negative_assertion': 'output over the bound is cut to the bound: 1200000 != 1000000',
    'original_cap': 1000000, 'positive_exit': 0,
}, indent=2) + '\n')
