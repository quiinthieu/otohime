// Independent QA: no delivered provider parser, fake, walk or browser assertion is imported.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openSync, closeSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const dir = import.meta.dirname;
const listen = async s => { s.listen(0, '127.0.0.1'); await once(s, 'listening'); return s.address().port; };
const freePort = async () => { const s = createServer(); const port = await listen(s); await new Promise(r => s.close(r)); return port; };
const events = [];
let scenario = '';
const id = '234567890123456789';
const privateName = 'QA_PRIVATE_DISCORD_PROFILE';
const music = { title: 'Independent music stays', artists: 'QA artist', url: null, playing: true, listenedAt: null };
const fake = createServer((req, res) => {
  events.push({ scenario, path: req.url, agent: req.headers['user-agent'], accept: req.headers.accept });
  res.setHeader('content-type', 'application/json');
  if (req.url.startsWith('/1/user/')) {
    const current = req.url.endsWith('/playing-now');
    res.end(JSON.stringify({ payload: { ...(current ? { playing_now: true } : {}), count: current ? 1 : 0, listens: current ? [{ track_metadata: { track_name: music.title, artist_name: music.artists } }] : [] } }));
  } else if (req.url.startsWith('/ISteamUser/')) {
    res.end(JSON.stringify({ response: { players: [{ communityvisibilitystate: 3, gameextrainfo: 'Independent Steam', gameid: '570' }] } }));
  } else if (req.url.startsWith('/v1/users/')) {
    if (scenario === 'timeout') return;
    if (scenario === 'html') { res.setHeader('content-type', 'text/html'); res.end('<h1>service down</h1>'); return; }
    if (scenario === '429') { res.statusCode = 429; res.end('{}'); return; }
    if (scenario === 'redirect') { res.statusCode = 302; res.setHeader('location', '/forbidden-follow'); res.end('{}'); return; }
    if (scenario === 'unknown') { res.end(JSON.stringify({ success: false, error: { code: 'user_not_monitored' } })); return; }
    if (scenario === 'malformed') { res.end(JSON.stringify({ success: true, data: { activities: {} } })); return; }
    const activities = scenario === 'empty' ? [] : scenario === 'spotify-only' ? [{ type: 2, name: 'Spotify' }] : [
      { type: 1, name: 'Ignore streaming' }, { type: 4, name: 'Ignore status' }, { type: 0, name: 123 },
      { type: 0, name: 'QA\u0000A\u202eB', application_id: id, url: 'https://store.steampowered.com/app/999/' },
      { type: 0, name: 'Never choose second game' },
    ];
    res.end(JSON.stringify({ success: true, data: { activities, discord_user: { id, username: privateName, avatar: privateName }, friends: [privateName] } }));
  } else { res.statusCode = 500; res.end('{}'); }
});
const fakePort = await listen(fake);
const database = spawn(process.execPath, ['scripts/e2e.mjs', '--serve-db', '/tmp/qa-9212-db'], { stdio: ['ignore', 'pipe', 'inherit'] });
const databaseUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('database startup exceeded 30s')), 30000);
  let log = '';
  database.stdout.on('data', c => { log += c; const m = /^DATABASE_URL=(.+)$/m.exec(log); if (m) { clearTimeout(timer); resolve(m[1]); } });
  database.on('exit', code => { clearTimeout(timer); reject(new Error(`database exited ${code}`)); });
});
const browser = await chromium.launch({ channel: 'chrome' });
const output = { browser: browser.version(), scenarios: [], real: 'Next production server/cache, fetch/abort, Chrome, migrated embedded PostgreSQL', fake: 'only upstream HTTP responses' };
try {
  for (scenario of ['game', 'empty', 'spotify-only', 'unknown', 'malformed', 'html', '429', 'redirect', 'timeout', 'off', 'invalid', 'steam']) {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const env = { ...process.env, DATABASE_URL: databaseUrl, BETTER_AUTH_SECRET: 'ci-placeholder-not-a-real-secret-0123456789abcdef', BETTER_AUTH_URL: base,
      LISTENBRAINZ_USER: 'Independent QA', NOW_PLAYING_LISTENBRAINZ_HOST: `http://127.0.0.1:${fakePort}`,
      LANYARD_USER_ID: scenario === 'invalid' ? '1234' : ['off', 'steam'].includes(scenario) ? '' : id,
      NOW_PLAYING_LANYARD_HOST: `http://127.0.0.1:${fakePort}`,
      STEAM_API_KEY: 'QaSyntheticSteamKey12345678', STEAM_ID: '76561197960435530', NOW_PLAYING_STEAM_HOST: `http://127.0.0.1:${fakePort}` };
    if (['off', 'invalid'].includes(scenario)) { delete env.STEAM_API_KEY; delete env.STEAM_ID; }
    for (const key of ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN']) delete env[key];
    const fd = openSync(`${dir}/independent-${scenario}-server.log`, 'w');
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { env, detached: true, stdio: ['ignore', fd, fd] });
    closeSync(fd);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', javaScriptEnabled: false });
    try {
      const deadline = Date.now() + 15000;
      while (true) {
        try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* server startup */ }
        if (Date.now() > deadline) throw new Error('Next readiness exceeded 15s');
        await new Promise(r => setTimeout(r, 100));
      }
      const start = Date.now();
      const response = await fetch(`${base}/api/now-playing`);
      assert.equal(response.status, 200);
      const api = await response.json();
      const elapsedMs = Date.now() - start;
      assert.deepEqual(api.track, music, 'music is unchanged by every game condition');
      assert.equal(api.music.state, 'fixture');
      const off = ['off', 'invalid'].includes(scenario);
      const steam = scenario === 'steam';
      const usable = ['game', 'empty', 'spotify-only', 'steam'].includes(scenario);
      assert.equal(api.play.source, off ? null : steam ? 'steam' : 'lanyard');
      assert.equal(api.play.state, off ? 'off' : usable ? 'fixture' : 'quiet');
      assert.deepEqual(api.game, scenario === 'game' ? { title: 'QA A B', url: null } : steam ? { title: 'Independent Steam', url: 'https://store.steampowered.com/app/570/' } : null);
      if (scenario === 'timeout') assert.ok(elapsedMs >= 3800 && elapsedMs < 6500, `four-second abort: ${elapsedMs}`);
      const page = await context.newPage();
      assert.equal((await page.goto(`${base}/music`, { waitUntil: 'load' })).status(), 200);
      const shelf = page.locator('[data-now-playing]');
      assert.equal(await shelf.getAttribute('data-play-source'), api.play.source ?? 'none');
      assert.equal(await shelf.getAttribute('data-play-state'), api.play.state);
      assert.equal(await shelf.locator('.tape [data-label="title"]').textContent(), music.title);
      if (api.game) assert.equal(await shelf.locator('[data-label="game"]').textContent(), api.game.title);
      if (!off && !steam) {
        assert.equal(await shelf.locator('a[href="https://github.com/Phineas/lanyard"]').count(), 1);
        assert.equal(await shelf.locator('.game-cart a').count(), 0, 'Lanyard never invents a game link');
      }
      const markup = await shelf.innerHTML();
      for (const sentinel of [id, privateName]) { assert.ok(!JSON.stringify(api).includes(sentinel)); assert.ok(!markup.includes(sentinel)); }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      const requests = events.filter(e => e.scenario === scenario);
      assert.equal(requests.filter(e => e.path.startsWith('/v1/users/')).length, off || steam ? 0 : 1, 'one Lanyard request, no retry');
      assert.equal(requests.filter(e => e.path.startsWith('/ISteamUser/')).length, steam ? 1 : 0, 'configured Lanyard never falls through to Steam');
      assert.equal(requests.filter(e => e.path.startsWith('/1/user/')).length, 2, 'API and page share the music reading');
      assert.equal(requests.filter(e => e.path === '/forbidden-follow').length, 0, 'redirect rejected before follow');
      for (const req of requests.filter(e => e.path.startsWith('/v1/users/'))) { assert.equal(req.agent, 'otohime.dev/1.0 (+https://otohime.dev)'); assert.equal(req.accept, 'application/json'); }
      let control = null;
      if (scenario === 'game') {
        // Mutate only the browser DOM; our link assertion must reject invented attribution.
        await page.evaluate(() => { const a = document.createElement('a'); a.href = 'https://store.steampowered.com/app/999/'; document.querySelector('.game-cart').append(a); });
        await assert.rejects(async () => assert.equal(await shelf.locator('.game-cart a').count(), 0));
        await page.evaluate(() => document.querySelector('.game-cart a').remove());
        assert.equal(await shelf.locator('.game-cart a').count(), 0);
        control = 'injected invented Steam link rejected; restored DOM passes';
      }
      output.scenarios.push({ scenario, api, elapsedMs, requests, control });
      console.log(`independent ${scenario}: pass (${elapsedMs}ms)`);
    } finally {
      await context.close();
      process.kill(-child.pid, 'SIGTERM');
      await once(child, 'exit');
    }
  }
  writeFileSync(`${dir}/independent.json`, JSON.stringify(output, null, 2) + '\n');
} finally {
  await browser.close();
  fake.closeAllConnections(); await new Promise(r => fake.close(r));
  database.kill('SIGTERM'); await once(database, 'exit');
}
