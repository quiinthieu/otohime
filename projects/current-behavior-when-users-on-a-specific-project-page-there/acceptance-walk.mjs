// Acceptance walk pm-195 run-6657: a person on a project page goes back to the project list.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'https://otohime.dev';
const OUT = process.argv[2] || '/tmp/acc-6657/shots';
fs.mkdirSync(OUT, { recursive: true });
const projects = ['shore', 'capsule', 'sun', 'elements', 'vinyl'];
const sizes = [
  { name: 'desktop', viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
];
let ok = 0, bad = 0;
const rows = [];
const say = (pass, msg) => { if (pass) ok++; else bad++; console.log(`${pass ? 'ok' : 'NOT OK'} - ${msg}`); rows.push({ pass, msg }); };

const browser = await chromium.launch();
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: s.viewport, isMobile: s.isMobile, hasTouch: s.hasTouch, deviceScaleFactor: s.deviceScaleFactor });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

  for (const p of projects) {
    errors.length = 0;
    // Arrive the way a person does: from the project list, click the project.
    await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
    const entry = page.locator(`main a[href="/${p}"]`).first();
    await entry.click();
    await page.waitForURL(`${BASE}/${p}`, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    const sha = await page.locator('meta[name="build-sha"]').getAttribute('content').catch(() => null);

    const back = page.getByRole('link', { name: 'All projects' });
    const n = await back.count();
    say(n === 1, `${s.name} /${p}: exactly one "All projects" link (found ${n}), build-sha ${sha?.slice(0, 7)}`);
    if (n !== 1) continue;
    const info = await back.evaluate(el => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      const home = document.querySelector('a[href="/"]');
      const hr = home?.getBoundingClientRect();
      return {
        href: el.getAttribute('href'), text: el.innerText.replace(/\s+/g, ' ').trim(),
        top: r.top, left: r.left, right: r.right, bottom: r.bottom, w: r.width, h: r.height,
        topHit: hit === el || el.contains(hit),
        sw: document.documentElement.scrollWidth, iw: window.innerWidth,
        homeVisible: !!hr && hr.width > 0 && hr.top >= 0 && hr.right <= window.innerWidth,
      };
    });
    const inView = info.top >= 0 && info.left >= 0 && info.right <= info.iw && info.bottom <= s.viewport.height;
    say(info.href === '/projects', `${s.name} /${p}: link goes to /projects (href=${info.href}), label "${info.text}"`);
    say(inView && info.topHit, `${s.name} /${p}: link visible above the fold and not covered (box ${Math.round(info.left)},${Math.round(info.top)} ${Math.round(info.w)}x${Math.round(info.h)})`);
    say(info.h >= 44 || s.name === 'desktop', `${s.name} /${p}: tap target ${Math.round(info.h)}px tall`);
    say(info.sw <= info.iw, `${s.name} /${p}: no sideways scroll (scrollWidth ${info.sw} <= ${info.iw})`);
    say(info.homeVisible, `${s.name} /${p}: otohime.dev home link still there`);
    await page.screenshot({ path: `${OUT}/${s.name}-${p}.png` });

    if (s.isMobile) await back.tap(); else await back.click();
    await page.waitForURL(`${BASE}/projects`, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    const listed = await page.evaluate(ps => ps.filter(x => document.querySelector(`main a[href="/${x}"]`)).length, projects);
    say(listed === 5, `${s.name} /${p} -> /projects: landed on the project list, ${listed}/5 projects listed`);
    // Browser back returns to the project, forward again to the list.
    await page.goBack({ waitUntil: 'networkidle' });
    say(new URL(page.url()).pathname === `/${p}`, `${s.name} /projects: browser Back returns to /${p}`);
    say(errors.length === 0, `${s.name} /${p}: no page errors, console errors or 4xx/5xx (${errors.join(' | ') || 'none'})`);
  }
  // Keyboard: Tab reaches the link on desktop.
  if (!s.isMobile) {
    for (const p of projects) {
      await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });
      let reached = false;
      for (let i = 0; i < 6 && !reached; i++) {
        await page.keyboard.press('Tab');
        reached = await page.evaluate(() => document.activeElement?.getAttribute('href') === '/projects');
      }
      if (reached) { await page.keyboard.press('Enter'); await page.waitForURL(`${BASE}/projects`, { timeout: 15000 }); }
      say(reached && new URL(page.url()).pathname === '/projects', `keyboard /${p}: Tab reaches "All projects" within 6 presses, Enter opens /projects`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`# ${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
