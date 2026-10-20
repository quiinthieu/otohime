// QA probe for pm-195/t-1129: every project top bar at 390px and 1366px.
// Usage: npm i playwright && npx playwright install chromium-headless-shell
//        BASE=https://otohime.dev node topbar-probe.mjs   (or BASE=http://localhost:4041)
// Exit 0 only when every page passes every check.
import { chromium } from 'playwright';
const base = process.env.BASE || 'https://otohime.dev';
// Pill heights before the change (3e01a0a); the new pill must not be smaller.
const minH = { shore: 36, capsule: 36, sun: 24, elements: 44, vinyl: 44 };
const b = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
let fails = 0;
for (const w of [390, 1366]) for (const p of Object.keys(minH)) {
  const pg = await b.newPage({ viewport: { width: w, height: 844 } });
  await pg.goto(`${base}/${p}`, { waitUntil: 'networkidle' });
  const r = await pg.evaluate(() => {
    const bar = document.querySelector('.topbar').getBoundingClientRect();
    const nav = document.querySelector('nav[aria-label="Site"]');
    const links = [...nav.querySelectorAll('a')].map(a => {
      const box = a.getBoundingClientRect();
      const span = a.querySelector('span[aria-hidden]');
      let space = null;
      if (span) {
        const t = span.nextSibling, range = document.createRange();
        const i = t.textContent.search(/\S/);
        range.setStart(t, i); range.setEnd(t, i + 1);
        space = Math.round(range.getBoundingClientRect().left - span.getBoundingClientRect().right);
      }
      return { href: a.getAttribute('href'), text: a.textContent.trim(), top: box.top, bottom: box.bottom, left: box.left, right: box.right, h: Math.round(box.height), space };
    });
    return { iw: innerWidth, sw: document.documentElement.scrollWidth, barTop: bar.top, barBottom: bar.bottom, links };
  });
  const bad = [];
  if (r.links.map(l => l.href).join() !== '/,/projects') bad.push(`links ${r.links.map(l => l.href)}`);
  if (r.links[1]?.text !== '← All projects') bad.push(`label ${r.links[1]?.text}`);
  if (r.sw > r.iw) bad.push(`horizontal overflow ${r.sw}>${r.iw}`);
  for (const l of r.links) {
    if (l.left < 0 || l.right > r.iw || l.top < 0) bad.push(`${l.href} outside the viewport (top ${l.top})`);
    if (l.top < r.barTop || l.bottom > r.barBottom) bad.push(`${l.href} spills out of the top bar (${l.top}-${l.bottom} vs ${r.barTop}-${r.barBottom})`);
    if (l.h < minH[p]) bad.push(`${l.href} ${l.h}px tall, was ${minH[p]}px`);
  }
  if (r.links[1]?.space !== null && r.links[1]?.space < 2) bad.push(`no space after the arrow (${r.links[1].space}px)`);
  await Promise.all([pg.waitForURL('**/projects'), pg.locator('nav[aria-label="Site"] a[href="/projects"]').click()]);
  if (new URL(pg.url()).pathname !== '/projects') bad.push(`click landed on ${pg.url()}`);
  if (bad.length) fails++;
  console.log(`${bad.length ? 'not ok' : 'ok'} - /${p} at ${w}px${bad.length ? ': ' + bad.join('; ') : ''}`);
  await pg.close();
}
await b.close();
console.log(`probe: ${10 - fails} ok, ${fails} failed`);
process.exit(fails ? 1 : 0);
