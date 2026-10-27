from pathlib import Path
import os,re,subprocess,tempfile,json
root=Path.cwd();out=Path(__file__).parent
flags=['node','--experimental-strip-types','--disable-warning=ExperimentalWarning','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','--test']
results=[]
for name,source,pattern,old,new in [
 ('desk-trace','e2e/desk.test.ts','a narrow window and a wide touch tablet','await swipe(tablet, "music", 120, 0, { drags: false });','await swipe(tablet, "music", 120, 0, { drags: true });'),
 ('clock-host-delay','e2e/kame.test.ts','clock fixture observes browser elapsed time','page.waitForFunction((started) => performance.now() - started >= 50, started, { timeout: 2_000 })','page.waitForTimeout(50)')]:
 text=(root/source).read_text();assert text.count(old)==1
 text=text.replace(old,new)
 # Keep the delivered imports real while placing the deliberate failing fixture outside suite globs.
 text=re.sub(r'from "(\.\./[^"]+)"',lambda m:'from "'+(root/'e2e'/m[1]).resolve().as_uri()+'"',text)
 with tempfile.NamedTemporaryFile(suffix='.test.ts',mode='w',dir='/tmp',delete=False) as f:f.write(text);temp=Path(f.name)
 try:
  cmd=flags+['--test-name-pattern',pattern,str(temp)]
  env={**os.environ,'BASE_URL':'https://otohime.dev','NODE_PATH':str(root/'node_modules')}
  # Bare package resolution is relative to the module, so rewrite it to the locked package entry.
  text=temp.read_text().replace('from "playwright-core"','from "'+(root/'node_modules/playwright-core/index.mjs').as_uri()+'"');temp.write_text(text)
  with (out/(name+'-negative.log')).open('w') as log: r=subprocess.run(cmd,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=150)
  body=(out/(name+'-negative.log')).read_text()
  expected='music is dragging after the first move past 6px' if name=='desk-trace' else 'Missing expected rejection'
  assert r.returncode!=0 and expected in body,(name,r.returncode,body[-2500:])
  if name=='desk-trace':assert 'pointerdown' in body and 'pointermove' in body and 'desk-tape' in body
  results.append({'name':name,'exit_code':r.returncode,'expected_failure':expected,'source':source,'only_mutation':{'old':old,'new':new},'base_url':env['BASE_URL'],'runtime':'real locked Chrome/Playwright; deliberate test mutation'})
 finally:temp.unlink(missing_ok=True)
(out/'negative-controls.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
