import sys,re,json,hashlib,pathlib
K=pathlib.Path(sys.argv[1]); P=(K/'prompts.md').read_text('utf-8'); kit=K/'production-kit'
style=re.search(r'^> (.+)$',P,re.M).group(1)
comps={int(m.group(1)):(m.group(2),m.group(3).strip()) for m in re.finditer(r'^(\d+)\. \*\*(.+?)\.\*\* (.+)$',P,re.M)}
rows=re.findall(r'^\| (\d\d_\S+\.png) \| (\S+\.jpg) \| (.+?) \| (.+?) \|$',P,re.M)
m=json.loads((kit/'manifest.json').read_text('utf-8'))
out={'status':m.get('status'),'schemaVersion':m.get('schemaVersion'),'rows':len(rows),'files':sorted(p.name for p in kit.iterdir()),'errors':[]}
E=out['errors']
if m['status']!='production_required':E.append('status')
for i,(png,jpg,title,cap) in enumerate(rows,1):
  md=png[:-4]+'.md'; b=(kit/md).read_bytes(); t=b.decode('utf-8'); c=m['concepts'][i-1]
  ct,comp=comps[i]
  block=re.search(r'```text\n(.*?)\n```',t,re.S).group(1)
  for need,name in [(style,'style'),(comp,'composition'),(cap,'caption'),(png,'png'),(jpg,'jpg'),('3:4','3:4'),('>=1536x2048','size'),('honestly','honest')]:
    if need not in t:E.append(f'{md}:{name}')
  if style not in block or comp not in block:E.append(f'{md}:prompt-block')
  if (c['promptFile'],c['masterFilename'],c['derivativeFilename'],c['caption'],c['title'])!=(md,png,jpg,cap,title):E.append(f'{md}:manifest-mapping')
  if c['promptFileByteLength']!=len(b) or c['promptFileSha256']!=hashlib.sha256(b).hexdigest():E.append(f'{md}:bytes/hash')
  if c['fullPromptSha256']!=hashlib.sha256(block.encode()).hexdigest():E.append(f'{md}:fullPromptSha(block-hash differs)')
out['promptPackSha256ok']=m['promptPackSha256']==hashlib.sha256((K/'prompts.md').read_bytes()).hexdigest()
out['referenceUrl']=m.get('referenceUrl'); out['refUrlShaOk']=m.get('referenceUrlSha256')==hashlib.sha256(m.get('referenceUrl','').encode()).hexdigest()
out['generationSettings']=m.get('generationSettings')
out['checklistLen']=len(m.get('reviewChecklist',m.get('visualReviewChecklist',[])))
out['otherKeys']=[k for k in m if k not in('concepts',)]
out['derivative']={k:v for k,v in m.items() if 'deriv' in k.lower() or 'image' in k.lower()}
out['reader_frontal']='three-quarter view from the front' in (kit/'01_Quiet_Reader.md').read_text()
print(json.dumps(out,indent=1,ensure_ascii=False))
