import json,urllib.request,urllib.error,pathlib,datetime,re,subprocess
OUT=pathlib.Path(__file__).parent
BASE='https://api.github.com/repos/quiinthieu/otohime'
def read(url):
    req=urllib.request.Request(url,headers={'User-Agent':'otohime-pm258-run8813-qa','Accept':'application/vnd.github+json' if 'api.github.com' in url else '*/*'})
    try:
        with urllib.request.urlopen(req,timeout=40) as r: return {'url':url,'status':r.status,'body':r.read().decode()}
    except urllib.error.HTTPError as e: return {'url':url,'status':e.code,'body':e.read().decode()[:2000]}
    except Exception as e: return {'url':url,'error':str(e)}
e={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pages':[],'runs':[],'job_pages':[],'raw_logs':[]}
for page in [1,2]:
    r=read(BASE+'/actions/runs?branch=main&per_page=50&page='+str(page))
    if r.get('status')==200:
        b=json.loads(r.pop('body'));r.update(total_count=b.get('total_count'),count=len(b.get('workflow_runs',[])))
        e['runs'] += [{k:x.get(k) for k in ['id','head_sha','status','conclusion','created_at','updated_at','html_url']} for x in b.get('workflow_runs',[])]
    e['pages'].append(r)
ids=list(dict.fromkeys([40295803050,40296784613,40263545741,40277024423,40275822192,40277523350]+[x['id'] for x in e['runs'][:2]]))
for runid in ids:
    r=read(BASE+'/actions/runs/'+str(runid)+'/jobs?per_page=100')
    if r.get('status')==200:
        b=json.loads(r.pop('body'));r.update(run_id=runid,total_count=b.get('total_count'),jobs=[{k:j.get(k) for k in ['id','name','conclusion','status','head_sha','steps','html_url']} for j in b.get('jobs',[])])
    e['job_pages'].append(r)
for jobid in [121481439046,121484664977]:
    e['raw_logs'].append(read(BASE+'/actions/jobs/'+str(jobid)+'/logs'))
# Public job HTML is an independent fallback; extract meaningful step labels and annotations.
for runid,jobid in [(40295803050,121481439046),(40296784613,121484664977)]:
    r=read('https://github.com/quiinthieu/otohime/actions/runs/'+str(runid)+'/job/'+str(jobid))
    if r.get('status')==200:
        body=r.pop('body')
        (OUT/('job-'+str(jobid)+'-excerpt.txt')).write_text('\n'.join(line.strip()[:1200] for line in body.splitlines() if re.search('E2E against|Footer Chromium|Process completed|data-conclusion|step-summary|step-name',line))+'\n')
        r['excerpt']='job-'+str(jobid)+'-excerpt.txt';r['full_bytes']=len(body)
    e.setdefault('public_job_html',[]).append(r)
for path in ['/api/health','/api/now-playing','/projects','/music']:
    r=read('https://otohime.dev'+path)
    if r.get('status')==200 and path in ['/projects','/music']:
        body=r.pop('body');r['build_sha']=re.findall(r'<meta name="build-sha" content="([^"]+)"',body);r['bytes']=len(body);r['footer_count']=body.count('<footer');r['waterline_present']='data-end-waterline' in body
    e.setdefault('production',[]).append(r)
e['ci_config_log']=subprocess.check_output(['git','log','--oneline','c38f72a..HEAD','--','.github/workflows/ci.yml'],text=True)
(OUT/'independent-evidence.json').write_text(json.dumps(e,indent=2)+'\n')
print(json.dumps({'pages':e['pages'],'run_count':len(e['runs']),'jobs':[{'run_id':j.get('run_id'),'status':j.get('status'),'jobs':[(x['id'],x['name'],x['conclusion']) for x in j.get('jobs',[])]} for j in e['job_pages']],'logs':e['raw_logs'],'production':e['production']},indent=2))
