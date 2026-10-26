import collections
import concurrent.futures
import html
import json
from pathlib import Path
import re
import urllib.request
import urllib.error

OUT = Path(__file__).resolve().parent
BASE = 'https://github.com/quiinthieu/otohime'

def read(url):
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return {'url': url, 'status': response.status, 'html': response.read().decode(errors='replace')}
    except urllib.error.HTTPError as error:
        return {'url': url, 'status': error.code, 'error': error.read().decode(errors='replace')[:1500]}
    except Exception as error:
        return {'url': url, 'error': str(error)}

def plain(text):
    text = re.sub(r'<(script|style)\b.*?</\1>', '', text, flags=re.S)
    return '\n'.join(line for line in [re.sub(r'\s+', ' ', html.unescape(s)).strip() for s in re.sub('<[^>]+>', '\n', text).splitlines()] if line)

def find_runs(obj):
    if isinstance(obj, dict):
        if 'runNumber' in obj and 'runUrl' in obj:
            yield {k: v for k, v in obj.items() if k in ['id', 'runNumber', 'title', 'state', 'createdAt', 'description', 'runUrl']}
        else:
            for v in obj.values():
                yield from find_runs(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from find_runs(v)

pages = []
for number in [1, 2]:
    result = read(BASE + f'/actions?query=branch%3Amain&page={number}')
    page_runs = []
    for content in re.findall(r'<script[^>]+type="application/json"[^>]*>(.*?)</script>', result.get('html', ''), flags=re.S):
        try:
            page_runs.extend(find_runs(json.loads(content)))
        except ValueError:
            pass
    result.pop('html', None)
    result['runs'] = page_runs
    pages.append(result)

ids = [40310239199, 40306337481, 40303724712, 40303396148, 40277024423, 40275822192, 40277523350, 40263545741]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    runs = list(pool.map(lambda run: read(BASE + f'/actions/runs/{run}'), ids))
jobs = []
for result in runs:
    source = result.pop('html', '')
    links = list(dict.fromkeys(re.findall(r'href="(/quiinthieu/otohime/actions/runs/\d+/job/\d+)"', source)))
    result['jobs'] = links
    result['text'] = plain(source)[-22000:]
    jobs.extend(BASE.split('/quiinthieu')[0] + link for link in links if 'job/' in link)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    listings = list(pool.map(read, jobs))
raw = []
for result in listings:
    source = result.pop('html', '')
    result['steps'] = re.findall(r'data-name="([^"]+)"\s+data-conclusion="([^"]+)"', source)
    result['text'] = plain(source)[-18000:]
    for url in re.findall(r'data-log-url="([^"]+)"', source):
        if url.endswith('/14'):
            raw.append('https://github.com' + url)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    raw_logs = list(pool.map(read, raw[:8]))
for result in raw_logs:
    if 'html' in result:
        result['text'] = plain(result.pop('html'))[-12000:]
summary_runs = [r for p in pages for r in p['runs']]
data = {'limits': {'summary_pages': 2, 'summaries_read': len(summary_runs), 'conclusions': dict(collections.Counter(r['state'].get('conclusion') or r['state']['status'] for r in summary_runs)), 'run_pages_read': len(runs), 'job_pages_read': len(listings), 'raw_log_attempts': len(raw_logs), 'complete': False, 'text_tail_limits': {'run': 22000, 'job': 18000}}, 'pages': pages, 'runs': runs, 'jobs': listings, 'raw_logs': raw_logs}
(OUT / 'public-ci.json').write_text(json.dumps(data, indent=2) + '\n')
print(json.dumps(data['limits']))
for r in runs:
    print(r['url'], r.get('status'), r['text'][-3000:])
