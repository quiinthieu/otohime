// pm-272 acceptance run-9218: real production server at the deployed SHA against LIVE keyless providers,
// plus loopback negative controls and a browser walk of local and deployed /music.
// Usage: node walk.mjs <checkout> <evidence-dir>
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [checkout, ev] = process.argv.slice(2);
const require = createRequire(path.join(checkout, 'package.json'));
const { chromium } = require('playwright-core');
const LB_USER = 'aerozol';
const LANYARD_ID = '94490510688792576';
const UA = 'otohime-acceptance/run-9218';
const out = { started: new Date().toISOString(), checkout, scenarios: [], browser: [], failures: [] };
const fail = (where, msg) => { out.failures.push(`${where}: ${msg}`); console.log('FAIL', where, msg); };
const check = (where, cond, msg) => { if (!cond) fail(where, msg); else console.log('ok  ', where, msg); };

// Loopback servers for negative controls: one answers 503, one never answers.
const recorded = [];
const recorder = http.createServer((req, res) => { recorded.push({ url: req.url, ua: req.headers['user-agent'] }); res.writeHead(503); res.end('no'); });
const hanging = http.createServer(() => {});
await new Promise(r => recorder.listen(45992, '127.0.0.1', r));
await new Promise(r => hanging.listen(45993, '127.0.0.1', r));

const db = spawn(process.execPath, ['scripts/e2e.mjs', '--serve-db', '/tmp/acc-9218-db'], { cwd: checkout, stdio: ['ignore', 'pipe', 'inherit'] });
const databaseUrl = await new Promise((resolve, reject) => {
  let log = ''; const t = setTimeout(() => reject(new Error('db timeout')), 120000);
  db.stdout.on('data', c => { log += c; const m = /^DATABASE_URL=(.+)$/m.exec(log); if (m) { clearTimeout(t); resolve(m[1].trim()); } });
});

async function upstream() {
  const j = async u => { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' } }); return { status: r.status, body: await r.json().catch(() => null) }; };
  const [now, last, lan] = await Promise.all([
    j(`https://api.listenbrainz.org/1/user/${LB_USER}/playing-now`),
    j(`https://api.listenbrainz.org/1/user/${LB_USER}/listens?count=1`),
    j(`https://api.lanyard.rest/v1/users/${LANYARD_ID}`),
  ]);
  const playing = now.body?.payload?.listens?.[0]?.track_metadata ?? null;
  const l = last.body?.payload?.listens?.[0] ?? null;
  const game = (lan.body?.data?.activities ?? []).find(a => a?.type === 0 && typeof a.name === 'string')?.name ?? null;
  return {
    at: new Date().toISOString(),
    playing: playing ? { title: playing.track_name, artist: playing.artist_name } : null,
    last: l ? { title: l.track_metadata.track_name, artist: l.track_metadata.artist_name, listenedAt: new Date(l.listened_at * 1000).toISOString() } : null,
    lanyard: { status: lan.status, success: lan.body?.success ?? null, activityTypes: (lan.body?.data?.activities ?? []).map(a => a.type), game },
  };
}

function base(port) {
  const env = { ...process.env, TMPDIR: '/tmp', PORT: String(port), DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: 'acceptance-placeholder-not-a-real-secret-0123456789', BETTER_AUTH_URL: `http://127.0.0.1:${port}` };
  for (const k of ['LISTENBRAINZ_USER', 'LANYARD_USER_ID', 'NOW_PLAYING_LISTENBRAINZ_HOST', 'NOW_PLAYING_LANYARD_HOST', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN', 'STEAM_API_KEY', 'STEAM_ID', 'NOW_PLAYING_STEAM_HOST']) delete env[k];
  return env;
}

async function withServer(name, port, extra, fn) {
  const logPath = path.join(ev, `server-${name}.log`);
  const fd = fs.openSync(logPath, 'w');
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: checkout, env: { ...base(port), ...extra }, detached: true, stdio: ['ignore', fd, fd] });
  try {
    for (let i = 0; i < 120; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/api/health`); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    await new Promise(r => setTimeout(r, 800));
    fs.closeSync(fd);
    const log = fs.readFileSync(logPath, 'utf8');
    const errs = log.split('\n').filter(l => /error|exception|unhandled|⨯/i.test(l) && !/BETTER_AUTH|better-auth/i.test(l));
    out.scenarios.find(s => s.name === name).serverLogErrorLines = errs;
  }
}

async function read(origin) {
  const t0 = Date.now();
  const r1 = await fetch(`${origin}/api/now-playing`); const a1 = await r1.json(); const ms = Date.now() - t0;
  const a2 = await (await fetch(`${origin}/api/now-playing`)).json();
  const html = await (await fetch(`${origin}/music`)).text();
  const attr = n => (new RegExp(`${n}="([^"]*)"`).exec(html) ?? [])[1] ?? null;
  return { status: r1.status, cacheControl: r1.headers.get('cache-control'), firstMs: ms, api: a1, apiRepeatReadAtEqual: a1.readAt === a2.readAt,
    page: { musicSource: attr('data-music-source'), musicState: attr('data-music-state'), playSource: attr('data-play-source'), playState: attr('data-play-state'),
      hasTitle: a1.track ? html.includes(escapeHtml(a1.track.title)) : null, hasGame: a1.game ? html.includes(escapeHtml(a1.game.title)) : null,
      fixtureLabel: html.includes(' · fixture'), lanyardCredit: html.includes('https://github.com/Phineas/lanyard'), steamStoreLink: html.includes('store.steampowered.com') } };
}
const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const agrees = (s, r) => s.page.musicSource === (r.api.music.source ?? 'none') && s.page.musicState === r.api.music.state && s.page.playSource === (r.api.play.source ?? 'none') && s.page.playState === r.api.play.state;

// Comparator: does the server's track equal the independently read upstream?
function matchesUpstream(api, up) {
  const want = up.playing ?? up.last;
  if (!want) return api.track === null;
  return api.track?.title === want.title && (up.playing ? api.track?.playing === true : api.track?.listenedAt === want.listenedAt);
}

async function scenario(name, port, env, assert) {
  const s = { name, env: Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v])) };
  out.scenarios.push(s);
  await withServer(name, port, env, async origin => {
    s.upstreamBefore = name.startsWith('live') ? await upstream() : undefined;
    s.reading = await read(origin);
    s.upstreamAfter = name.startsWith('live') ? await upstream() : undefined;
    s.pageAgreesWithApi = agrees(s.reading, s.reading);
    check(name, s.reading.status === 200, `API status ${s.reading.status}`);
    check(name, s.pageAgreesWithApi, 'no-JS /music data attributes agree with API source/state');
    check(name, s.reading.apiRepeatReadAtEqual, 'repeat API read is served from the shared cache (same readAt)');
    await assert(s, origin);
  });
}

// 1. Default: no identity -> honest off, exactly like production.
await scenario('default-off', 46001, {}, async s => {
  check('default-off', s.reading.api.music.state === 'off' && s.reading.api.play.state === 'off' && !s.reading.api.track && !s.reading.api.game, 'music off, play off, no track/game');
});

// 2. LIVE keyless providers (real upstream, public sample identities, local server only).
await scenario('live', 46002, { LISTENBRAINZ_USER: LB_USER, LANYARD_USER_ID: LANYARD_ID }, async (s, origin) => {
  const a = s.reading.api;
  check('live', a.music.source === 'listenbrainz' && a.music.state === 'live', `music listenbrainz/live (got ${a.music.source}/${a.music.state})`);
  check('live', a.music.profileUrl === `https://listenbrainz.org/user/${LB_USER}/`, `profile url ${a.music.profileUrl}`);
  const ok = matchesUpstream(a, s.upstreamBefore) || matchesUpstream(a, s.upstreamAfter);
  check('live', ok, `track equals independent upstream read (${JSON.stringify(a.track)} vs ${JSON.stringify(s.upstreamBefore.playing ?? s.upstreamBefore.last)})`);
  check('live', !a.track || s.reading.page.hasTitle, 'no-JS /music HTML contains the track title');
  check('live', a.play.source === 'lanyard' && a.play.state === 'live', `play lanyard/live (got ${a.play.source}/${a.play.state})`);
  const g = s.upstreamBefore.lanyard.game ?? s.upstreamAfter.lanyard.game;
  check('live', (a.game?.title ?? null) === g || (a.game?.title ?? null) === s.upstreamAfter.lanyard.game, `game equals upstream first type-0 activity (${a.game?.title ?? null} vs ${g})`);
  check('live', !a.game || a.game.url === null, 'Lanyard game has no invented store link');
  check('live', !s.reading.page.fixtureLabel, 'live reading is not labelled fixture');
  check('live', s.reading.page.lanyardCredit, 'Lanyard credit link present');
  check('live', !JSON.stringify(a).includes(LANYARD_ID), 'Discord id not published in API');
  // Comparator negative control: the same comparison against another account must reject.
  const other = { playing: null, last: { title: '__not-the-track__', listenedAt: '2000-01-01T00:00:00.000Z' }, lanyard: {} };
  s.comparatorNegativeControl = matchesUpstream(a, other) ? 'accepted (BAD)' : 'rejected';
  check('live', s.comparatorNegativeControl === 'rejected', 'comparator rejects a different upstream reading');
  await browserWalk('local-live', origin, s);
});

// 3. Unknown/unmonitored identities -> quiet, not switched to another provider.
await scenario('live-unknown', 46003, { LISTENBRAINZ_USER: 'otohime-acc-9218-no-such-user', LANYARD_USER_ID: '100000000000000000' }, async s => {
  const a = s.reading.api;
  check('live-unknown', a.music.source === 'listenbrainz' && a.music.state === 'quiet' && !a.track, `unknown ListenBrainz user is quiet (${a.music.state})`);
  check('live-unknown', a.play.source === 'lanyard' && a.play.state === 'quiet' && !a.game, `unmonitored Lanyard id is quiet (${a.play.state})`);
});

// 4. Hostile configuration: non-loopback host override is ignored; invalid names/ids are off.
await scenario('live-hostile', 46004, { LISTENBRAINZ_USER: LB_USER, NOW_PLAYING_LISTENBRAINZ_HOST: 'https://evil.example', LANYARD_USER_ID: '12345' }, async s => {
  const a = s.reading.api;
  check('live-hostile', a.music.source === 'listenbrainz' && a.music.state === 'live', `non-loopback host override ignored, real API read (${a.music.state})`);
  check('live-hostile', a.play.state === 'off', `invalid 5-digit Lanyard id is off (${a.play.state})`);
});
await scenario('invalid-user', 46005, { LISTENBRAINZ_USER: '../admin' }, async s => {
  check('invalid-user', s.reading.api.music.state === 'off', `path-traversal username is off (${s.reading.api.music.state})`);
});

// 5. Positive control for the zero-request build check: the same recorder host DOES receive runtime reads.
await scenario('recorder-503', 46006, { LISTENBRAINZ_USER: LB_USER, LANYARD_USER_ID: LANYARD_ID, NOW_PLAYING_LISTENBRAINZ_HOST: 'http://127.0.0.1:45992', NOW_PLAYING_LANYARD_HOST: 'http://127.0.0.1:45992' }, async s => {
  s.recorded = [...recorded];
  check('recorder-503', recorded.length >= 3, `recorder saw ${recorded.length} runtime requests (build saw 0)`);
  check('recorder-503', recorded.every(r => r.ua === 'otohime.dev/1.0 (+https://otohime.dev)'), 'required User-Agent');
  check('recorder-503', s.reading.api.music.state === 'quiet' && s.reading.api.play.state === 'quiet', '503 upstream gives quiet music and game');
  check('recorder-503', !s.reading.page.fixtureLabel && s.reading.api.spotify !== 'spotify-live', 'a failed loopback read is honest quiet: no fixture/live claim');
});

// 6. Hanging upstream: answered within the 4 s budget, quiet; music isolation from a hung game provider.
await scenario('hang-game', 46007, { LISTENBRAINZ_USER: LB_USER, LANYARD_USER_ID: LANYARD_ID, NOW_PLAYING_LANYARD_HOST: 'http://127.0.0.1:45993' }, async s => {
  const a = s.reading.api;
  check('hang-game', s.reading.firstMs < 6000, `answered in ${s.reading.firstMs} ms`);
  check('hang-game', a.play.state === 'quiet' && !a.game, 'hung Lanyard is quiet');
  check('hang-game', a.music.source === 'listenbrainz' && a.music.state === 'live' && !!a.track, 'music still live from real ListenBrainz');
});

// Browser walk of the DEPLOYED product.
await browserWalk('deployed', 'https://otohime.dev', null);

async function browserWalk(target, origin, s) {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  try {
    for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) for (const js of [true, false]) {
      const ctx = await browser.newContext({ viewport: vp, javaScriptEnabled: js, reducedMotion: 'reduce', isMobile: vp.width < 500, hasTouch: vp.width < 500 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()} @ ${m.location().url}`); });
      page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
      // Aborted RSC prefetches (JS) and scripts blocked because JS is off (Chrome reports 'csp') are recorded, not errors.
      const benign = [];
      page.on('requestfailed', r => { const e = r.failure()?.errorText ?? ''; const u = r.url();
        if ((js && e === 'net::ERR_ABORTED' && /[?&]_rsc=/.test(u)) || (!js && e === 'csp' && /\/_next\/static\/chunks\//.test(u))) benign.push(`${u} ${e}`);
        else errors.push(`requestfailed: ${u} ${e}`); });
      page.on('response', r => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
      const resp = await page.goto(`${origin}/music`, { waitUntil: 'load', timeout: 60000 });
      const shelf = page.locator('[data-now-playing]');
      await shelf.waitFor({ state: 'visible', timeout: 30000 });
      await shelf.scrollIntoViewIfNeeded();
      await page.waitForTimeout(js ? 1500 : 300);
      const r = await page.evaluate(() => {
        const n = document.querySelector('[data-now-playing]');
        const tape = n.querySelector('.tape'); const cart = n.querySelector('.game-cart');
        const t = sel => (n.querySelector(sel)?.textContent ?? '').trim();
        const box = n.getBoundingClientRect();
        return {
          sha: document.querySelector('meta[name="build-sha"]')?.content ?? null,
          music: [n.dataset.musicSource, n.dataset.musicState], play: [n.dataset.playSource, n.dataset.playState],
          tapeFace: tape?.dataset.face, spinning: tape?.hasAttribute('data-spin'),
          tapeSide: t('.tape .np-side'), tapeTitle: t('.tape [data-label="title"]'), tapeSub: t('.tape [data-label="sub"]'),
          listenedAt: n.querySelector('.np-listened-at')?.getAttribute('datetime') ?? null, listenedText: t('.np-listened-at'),
          cartFace: cart?.dataset.face, cartSide: t('.game-cart .np-side'), cartGame: t('.game-cart [data-label="game"]'),
          tapeLink: n.querySelector('.tape .np-link')?.href ?? null, cartLinks: [...(cart?.querySelectorAll('a') ?? [])].map(a => a.href),
          credit: t('[data-now-playing-credit]'), creditLinks: [...n.querySelectorAll('[data-now-playing-credit] a')].map(a => a.href),
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          shelfInViewportWidth: box.left >= -1 && box.right <= window.innerWidth + 1,
        };
      });
      const shot = path.join(ev, `${target}-${vp.width}x${vp.height}-${js ? 'js' : 'nojs'}.png`);
      await shelf.screenshot({ path: shot });
      // Keyboard: the tape link must be reachable by Tab.
      let tabReached = null;
      if (js) { await page.evaluate(() => window.scrollTo(0, 0)); tabReached = false; for (let i = 0; i < 80; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement?.classList.contains('np-link'))) { tabReached = true; break; } } }
      const w = `${target} ${vp.width}x${vp.height} ${js ? 'JS' : 'no-JS'}`;
      const rec = { target, viewport: vp, js, status: resp.status(), ...r, tabReached, errors, benignRequestFailures: benign, screenshot: path.basename(shot) };
      out.browser.push(rec);
      check(w, resp.status() === 200, `HTTP ${resp.status()}`);
      check(w, errors.length === 0, `browser errors: ${errors.length ? errors.join(' | ') : 'none'}`);
      check(w, !r.overflowX && r.shelfInViewportWidth, 'no horizontal overflow');
      if (js) check(w, tabReached, 'tape link reachable by keyboard');
      if (target === 'deployed') {
        check(w, r.sha === 'b4e142ad37c76abdc496c14afb4ac18b2b5c03ba', `build-sha ${r.sha}`);
        check(w, r.music[1] === 'off' && r.play[1] === 'off' && r.tapeFace === 'quiet' && !r.spinning, `honest off/quiet shelf (${r.music}/${r.play})`);
        check(w, !r.cartLinks.some(h => /steampowered/.test(h)), 'no invented store link');
      } else {
        const a = s.reading.api;
        check(w, r.music[0] === 'listenbrainz' && r.music[1] === 'live' && r.play[0] === 'lanyard', `live sources shown (${r.music}/${r.play})`);
        if (a.track) check(w, r.tapeTitle.includes(a.track.title), `tape shows "${a.track.title}"`);
        if (a.track && !a.track.playing) check(w, r.listenedAt === a.track.listenedAt && /UTC/.test(r.listenedText) && !r.spinning, `last listen shows full UTC time "${r.listenedText}" and still reels`);
        check(w, r.creditLinks.includes('https://listenbrainz.org/') && r.creditLinks.includes('https://github.com/Phineas/lanyard'), 'ListenBrainz and Lanyard credits');
        check(w, r.creditLinks.some(h => h === `https://listenbrainz.org/user/${LB_USER}/`), 'public profile link');
        check(w, !r.cartLinks.some(h => /steampowered/.test(h)), 'no invented store link');
        check(w, !/fixture/.test(r.tapeSide + r.cartSide), 'not labelled fixture');
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
}

out.finished = new Date().toISOString();
fs.writeFileSync(path.join(ev, 'walk.json'), JSON.stringify(out, null, 2));
db.kill('SIGTERM'); recorder.close(); hanging.close();
await new Promise(r => setTimeout(r, 2000));
console.log(`\n${out.failures.length} failures`);
process.exit(out.failures.length ? 1 : 0);
