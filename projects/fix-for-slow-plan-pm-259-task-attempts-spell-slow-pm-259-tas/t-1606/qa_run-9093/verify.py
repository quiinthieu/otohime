from pathlib import Path
import hashlib,json,subprocess,time,sys
out=Path('projects/fix-for-slow-plan-pm-259-task-attempts-spell-slow-pm-259-tas/t-1606/qa_run-9093')
def digest(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
files=subprocess.check_output(['git','ls-files','-z']).decode().split('\0')
source={p:digest(p) for p in files if p and not p.startswith('projects/') and p!='content/history.json' and Path(p).is_file()}
identity={'base_head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'files':source,'sha256':hashlib.sha256(json.dumps(source,sort_keys=True).encode()).hexdigest()}
(out/'source-fingerprint.json').write_text(json.dumps(identity,indent=2)+'\n')
results=[]
repeats=int(sys.argv[1]) if len(sys.argv)>1 else 3
for i in range(1,repeats+1):
    started=time.time()
    print('Starting full production E2E',i,flush=True)
    with (out/f'e2e-{i}.log').open('w') as log:
        run=subprocess.run(['bash','scripts/e2e-local.sh'],stdout=log,stderr=subprocess.STDOUT)
    snapshot={}
    for root in (Path('.next/server'),Path('.next/static')):
        if root.exists():
            for p in sorted(root.rglob('*')):
                if p.is_file(): snapshot[str(p)]=digest(p)
    for p in sorted(Path('.next').glob('*')):
        if p.is_file(): snapshot[str(p)]=digest(p)
    assets={str(p):digest(p) for p in sorted(Path('public/vendor/peep-box').rglob('*')) if p.is_file()}
    build={'build_id':Path('.next/BUILD_ID').read_text().strip() if Path('.next/BUILD_ID').exists() else None,'source_sha256':identity['sha256'],'artifact_sha256':hashlib.sha256(json.dumps(snapshot,sort_keys=True).encode()).hexdigest(),'files':snapshot,'vendored_assets':assets,'history_sha256':digest('content/history.json')}
    (out/f'build-{i}.json').write_text(json.dumps(build,indent=2)+'\n')
    row={'repeat':i,'exit':run.returncode,'duration_seconds':round(time.time()-started,3),'log':f'e2e-{i}.log','build':f'build-{i}.json'}
    results.append(row)
    (out/'e2e-results.json').write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps(row),flush=True)
    if run.returncode: sys.exit(run.returncode)
