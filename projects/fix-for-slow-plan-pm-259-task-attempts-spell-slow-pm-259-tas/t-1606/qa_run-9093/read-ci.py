from pathlib import Path
import concurrent.futures,datetime,json,urllib.request,urllib.error
out=Path(__file__).parent
base='https://api.github.com/repos/quiinthieu/otohime'
def read(name,path):
    url=path if path.startswith('https:') else base+path
    try:
        r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'otohime-qa-run-9093','Accept':'application/vnd.github+json'}),timeout=40)
        body=r.read().decode()
        try: data=json.loads(body)
        except ValueError: data={'raw':body}
        receipt={'url':url,'status':r.status,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'data':data}
    except urllib.error.HTTPError as e: receipt={'url':url,'status':e.code,'body':e.read().decode()}
    except Exception as e: receipt={'url':url,'error':str(e)}
    (out/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n')
    return receipt.get('data',{})
queries=[(f'history-{status}-{page}',f'/actions/workflows/ci.yml/runs?branch=main&status={status}&per_page={size}&page={page}') for status,size in [('completed',20),('failure',10)] for page in [1,2]]
queries += [(f'current-{s}',f'/actions/workflows/ci.yml/runs?branch=main&status={s}&per_page=20') for s in ['queued','in_progress','pending','waiting','requested']]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(lambda x:read(*x),queries))
runs={r['id']:r for d in results for r in d.get('workflow_runs',[])}
(out/'history-union.json').write_text(json.dumps(list(runs.values()),indent=2)+'\n')
print('history',[(n,len(d.get('workflow_runs',[])),d.get('total_count')) for (n,_),d in zip(queries,results)],flush=True)
# Exact delivery, prior green, latest successor, historical Kame failure and unresolved footer jobs.
for run in [40405893755,40398613267,40409123749,40388684010,40387187938]:
    d=read(f'jobs-{run}',f'/actions/runs/{run}/jobs?per_page=100')
    print(run,[(j['id'],j['name'],j['status'],j['conclusion'],[(s['name'],s['conclusion']) for s in j.get('steps',[]) if s['conclusion']=='failure']) for j in d.get('jobs',[])],flush=True)
    for job in d.get('jobs',[]):
        if job['name']=='checks':
            check=job.get('check_run_url','')
            if check:
                read(f'annotations-{job["id"]}',check+'/annotations?per_page=100')
            read(f'raw-job-{job["id"]}',f'/actions/jobs/{job["id"]}/logs')
read('delivery-checks','/commits/9d3f7463d69b852c8a40b8b94b560a9ecdfe31ca/check-runs?per_page=100')
