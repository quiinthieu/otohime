import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,linkSync,symlinkSync,existsSync,rmSync,cpSync,statSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os'; import {join,resolve} from 'node:path'; import {spawnSync} from 'node:child_process'; import {createHash} from 'node:crypto';
const REPO=process.argv[2]; const CLI=join(REPO,'scripts/sketches-handoff.ts');
const PROMPTS=join(REPO,'projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/prompts.md');
const KIT=join(REPO,'projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/production-kit');
const work=mkdtempSync(join(tmpdir(),'qa8460-')); const root=join(work,'repo');
for (const d of ['content','public','app','lib','scripts','.git']) mkdirSync(join(root,d),{recursive:true});
mkdirSync(join(root,'content','existing'),{recursive:true});
writeFileSync(join(root,'content','portraits.json'),'[]\n');
const run=(...a)=>{const r=spawnSync(process.execPath,['--experimental-strip-types','--disable-warning=ExperimentalWarning','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',CLI,...a],{cwd:root,encoding:'utf8'});let j=null;try{j=JSON.parse((r.stdout||r.stderr).trim())}catch{};return {status:r.status,reason:j?.reason??null,ok:j?.ok,concept:j?.offendingConcept??null}};
const snap=()=>{const out=[];const walk=(d)=>{for(const n of readdirSync(d,{withFileTypes:true})){const p=join(d,n.name);if(n.isDirectory())walk(p);else out.push(p.slice(root.length)+':'+createHash('sha256').update(readFileSync(p)).digest('hex'))}};for(const t of ['content','public','app','lib','scripts','.git'])walk(join(root,t));return out.sort().join('\n')};
const caseInsensitive=existsSync(join(root,'CONTENT'));
const res={caseInsensitive,cases:[]};
const before=snap();
const exportCases=['Content/new-kit','CONTENT/x','cOnTeNt/existing','Content/existing/deeper','PUBLIC/x','App/x','LIB/x','Scripts/x','ſcripts/x','.GIT/x','.Git','Content','./lib/../Content/./y/','content/existing/','projects/../CONTENT/z'];
for (const c of exportCases) res.cases.push({action:'export --output-dir '+JSON.stringify(c),...run('export','--output-dir',c,'--prompts',PROMPTS)});
// hard links
mkdirSync(join(root,'exports','kit'),{recursive:true});
linkSync(join(root,'content','portraits.json'),join(root,'exports','kit','manifest.json'));
res.cases.push({action:'export with hard-linked manifest.json -> content/portraits.json',...run('export','--output-dir','exports/kit','--prompts',PROMPTS),portraits:readFileSync(join(root,'content','portraits.json'),'utf8')});
unlinkSync(join(root,'exports','kit','manifest.json'));
linkSync(join(root,'content','portraits.json'),join(root,'exports','kit','06_Violinist.md'));
res.cases.push({action:'export with hard-linked 06_Violinist.md',...run('export','--output-dir','exports/kit','--prompts',PROMPTS),portraits:readFileSync(join(root,'content','portraits.json'),'utf8'),kitFiles:readdirSync(join(root,'exports','kit'))});
unlinkSync(join(root,'exports','kit','06_Violinist.md'));
// symlink alias ancestor
symlinkSync(join(root,'content'),join(root,'alias'));
res.cases.push({action:'export alias/new-kit (alias->content)',...run('export','--output-dir','alias/new-kit','--prompts',PROMPTS)});
res.protectedUnchanged = snap()===before;
// positive: export twice, compare with committed kit
const cmpKit=(d)=>{const f=readdirSync(KIT).sort();const g=readdirSync(d).sort();return JSON.stringify(f)===JSON.stringify(g)&&f.every(n=>readFileSync(join(KIT,n)).equals(readFileSync(join(d,n))))};
const e1=run('export','--output-dir','out/a','--prompts',PROMPTS), e2=run('export','--output-dir','out/b','--prompts',PROMPTS);
res.positive={e1,e2,aEqualsCommitted:cmpKit(join(root,'out/a')),bEqualsCommitted:cmpKit(join(root,'out/b'))};
// re-export over existing kit (rename path)
const e3=run('export','--output-dir','out/a','--prompts',PROMPTS); res.positive.reexport={...e3,still:cmpKit(join(root,'out/a')),tmpLeft:readdirSync(join(root,'out/a')).filter(n=>n.startsWith('.handoff-tmp'))};
// check controls on copies
const copy=(n)=>{const d=join(work,n);cpSync(KIT,d,{recursive:true});return d};
const chk=(d)=>run('check','--input-dir',d,'--prompts',PROMPTS);
res.check={valid:chk(copy('valid'))};
{const d=copy('coord');const p=join(d,'01_Quiet_Reader.md');const t=readFileSync(p,'utf8').replace('book','novel');writeFileSync(p,t);const m=JSON.parse(readFileSync(join(d,'manifest.json'),'utf8'));const rec=m.concepts.find(c=>c.promptFile==='01_Quiet_Reader.md');const b=Buffer.from(t,'utf8');for(const k of Object.keys(rec)){if(/byte/i.test(k))rec[k]=b.length;if(/^prompt.*sha|fileSha/i.test(k))rec[k]=createHash('sha256').update(b).digest('hex')};writeFileSync(join(d,'manifest.json'),JSON.stringify(m,null,2)+'\n');res.check.coordinatedTamper={...chk(d),manifestKeys:Object.keys(rec)}}
{const d=copy('missing');unlinkSync(join(d,'03_Rainy_Afternoon.md'));res.check.missing=chk(d)}
{const d=copy('extra');writeFileSync(join(d,'11_Extra.md'),'x');res.check.extra=chk(d)}
{const d=copy('status');const m=JSON.parse(readFileSync(join(d,'manifest.json'),'utf8'));m.status='completed';writeFileSync(join(d,'manifest.json'),JSON.stringify(m,null,2)+'\n');res.check.falseStatus=chk(d)}
{const d=copy('dup');const m=JSON.parse(readFileSync(join(d,'manifest.json'),'utf8'));m.concepts[1].promptFile=m.concepts[0].promptFile;writeFileSync(join(d,'manifest.json'),JSON.stringify(m,null,2)+'\n');res.check.duplicate=chk(d)}
{const d=copy('ln');unlinkSync(join(d,'08_Painter.md'));symlinkSync(join(KIT,'08_Painter.md'),join(d,'08_Painter.md'));res.check.symlinkPrompt=chk(d)}
res.check.badCli=run('check','--bogus');
// read-only check of committed kit
const mt=()=>readdirSync(KIT).map(n=>{const s=statSync(join(KIT,n),{bigint:true});return n+s.mtimeNs+':'+createHash('sha256').update(readFileSync(join(KIT,n))).digest('hex')}).join();
const m0=mt(); res.check.committed=run('check','--input-dir',KIT,'--prompts',PROMPTS); res.check.committedUnchanged=mt()===m0;
rmSync(work,{recursive:true,force:true});
console.log(JSON.stringify(res,null,1));
