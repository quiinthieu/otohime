"""Bounded, public, read-only CI evidence; never uses credentials."""
import json, subprocess, pathlib, datetime

ROOT = pathlib.Path(__file__).parent
API = 'https://api.github.com/repos/quiinthieu/otohime'
DELIVERY = 'cce131daf5c5648830ffe50a7d756e8adc490d73'

def read(path, name):
    p = subprocess.run(['curl', '-sS', '--max-time', '25', '-w', '\n%{http_code}', API + path], capture_output=True, text=True)
    body, _, status = p.stdout.rpartition('\n')
    try: data = json.loads(body)
    except ValueError: data = {'body': body[-6000:]}
    result = {'url': API + path, 'http': status, 'curl_exit': p.returncode, 'data': data}
    (ROOT / (name + '.json')).write_text(json.dumps(result, indent=2) + '\n')
    return data

hist = []
for status in ['failure', 'success', 'in_progress', 'queued']:
    for page in ([1, 2] if status in ['failure', 'success'] else [1]):
        data = read(f'/actions/workflows/ci.yml/runs?status={status}&per_page=5&page={page}', f'ci-{status}-{page}')
        hist.append({'status': status, 'page': page, 'total': data.get('total_count'), 'runs': data.get('workflow_runs', [])})
delivery = read(f'/actions/runs?head_sha={DELIVERY}&per_page=5', 'ci-delivery')
runs = {r['id']: r for h in hist for r in h['runs']}
runs.update({r['id']: r for r in delivery.get('workflow_runs', [])})
jobs = []
for run_id, run in runs.items():
    data = read(f'/actions/runs/{run_id}/jobs?per_page=100', f'jobs-{run_id}')
    for job in data.get('jobs', []):
        jobs.append({'run': run_id, 'sha': run['head_sha'], **job})
        if job['conclusion'] == 'failure':
            read(f'/check-runs/{job["id"]}/annotations?per_page=100', f'annotations-{job["id"]}')
            read(f'/actions/jobs/{job["id"]}/logs', f'raw-logs-{job["id"]}')
summary = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'history': [{'status':h['status'], 'page':h['page'], 'total':h['total'], 'read':len(h['runs'])} for h in hist],
           'jobs': [{'run':j['run'], 'sha':j['sha'], 'id':j['id'], 'name':j['name'], 'conclusion':j['conclusion'], 'status':j['status'], 'runner_name':j.get('runner_name'), 'labels':j.get('labels'), 'failed_steps':[s for s in j['steps'] if s['conclusion']=='failure']} for j in jobs]}
(ROOT / 'ci-summary.json').write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps(summary, indent=2))
