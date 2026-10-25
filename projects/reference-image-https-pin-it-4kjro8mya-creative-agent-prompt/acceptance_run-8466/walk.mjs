import { chromium } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch();
const res = [];
for (const [w,h] of [[1366,768],[390,844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on('console', m => m.type()==='error' && errs.push(m.text())); p.on('pageerror', e => errs.push(String(e)));
  const r = await p.goto('https://otohime.dev/sketches', { waitUntil: 'networkidle' });
  const info = await p.evaluate(() => ({
    sha: document.querySelector('meta[name=build-sha]')?.content,
    h2: [...document.querySelectorAll('h2,h3')].map(e=>e.textContent.trim()),
    figures: document.querySelectorAll('figure').length,
    loaded: [...document.querySelectorAll('figure img')].filter(i=>i.complete&&i.naturalWidth>0).length,
    tall: [...document.querySelectorAll('figure img')].filter(i=>i.naturalHeight>i.naturalWidth).length,
    people: !!document.getElementById('people'),
    portraitText: /Reader|Wildflowers|Violin|Letter/.test(document.body.innerText),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    downloads: [...document.querySelectorAll('a[href*="/sketches/download/"]')].length,
  }));
  await p.screenshot({ path: `${out}/sketches-${w}x${h}.png`, fullPage: true });
  res.push({ viewport: `${w}x${h}`, status: r.status(), ...info, errors: errs });
  await p.close();
}
const ctx = await b.newContext();
for (const f of ['01_Quiet_Reader.png','10_Letter_Writer.png']) {
  const r = await ctx.request.get(`https://otohime.dev/sketches/download/${f}`, { maxRedirects: 0 });
  res.push({ download: f, status: r.status() });
}
for (const f of ['13-reader.jpg','22-letter.jpg','01-cove.jpg']) {
  const r = await ctx.request.get(`https://otohime.dev/sketches/${f}`);
  res.push({ asset: f, status: r.status(), type: r.headers()['content-type'] });
}
console.log(JSON.stringify(res, null, 1));
await b.close();
