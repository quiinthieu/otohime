import collections
import concurrent.futures
import json
from pathlib import Path
import urllib.request
import urllib.error

OUT = Path(__file__).resolve().parent
ROOT = 'https://api.github.com/repos/quiinthieu/otohime/'
def payload(entry):
    data = entry.get('data')
    return data if isinstance(data, dict) else {}

def read(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'otohime-independent-qa-8849'}), timeout=35) as response:
            body = response.read()
            try:
                data = json.loads(body)
            except ValueError:
                data = body.decode(errors='replace')[-16000:]
            return {'url': url, 'status': response.status, 'data': data}
    except urllib.error.HTTPError as error:
        return {'url': url, 'status': error.code, 'data': error.read().decode(errors='replace')[-2000:]}
    except Exception as error:
        return {'url': url, 'error': str(error)}

pages = [read(ROOT + f'actions/runs?branch=main&per_page=50&page={page}') for page in [1, 2]]
runs = [run for page in pages for run in payload(page).get('workflow_runs', [])]
ids = list(dict.fromkeys([40310239199, 40277024423, 40275822192, 40277523350, 40263545741, 40306337481, 40303724712, 40303396148] + [r['id'] for r in runs[:4]]))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    jobs = list(pool.map(lambda run: read(ROOT + f'actions/runs/{run}/jobs?per_page=100'), ids))
alljobs = [job for listing in jobs for job in payload(listing).get('jobs', [])]
failed = [job for job in alljobs if job.get('conclusion') == 'failure']
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    logs = list(pool.map(lambda job: read(ROOT + f'actions/jobs/{job["id"]}/logs'), failed))
    annotations = list(pool.map(lambda job: read(job['check_run_url'] + '/annotations?per_page=100'), failed))
live = [read('https://otohime.dev' + path) for path in ['/api/health', '/api/now-playing']]
data = {'limits': {'pages': [1, 2], 'per_page': 50, 'total': payload(pages[0]).get('total_count'), 'summaries_read': len(runs), 'conclusions': dict(collections.Counter(r.get('conclusion') or r['status'] for r in runs)), 'job_listings_attempted': len(jobs), 'job_listings_read': sum('jobs' in payload(j) for j in jobs), 'jobs_read': len(alljobs), 'older_history_unread': True}, 'pages': pages, 'jobs': jobs, 'failed_logs': logs, 'annotations': annotations, 'live': live}
(OUT / 'ci-evidence.json').write_text(json.dumps(data, indent=2) + '\n')
print(json.dumps(data['limits']))
for job in alljobs:
    print(job['run_id'], job['id'], job['name'], job['status'], job.get('conclusion'), [(s['name'], s.get('conclusion')) for s in job.get('steps', []) if s.get('conclusion') == 'failure'])
for entry in annotations:
    print('annotations', entry)
