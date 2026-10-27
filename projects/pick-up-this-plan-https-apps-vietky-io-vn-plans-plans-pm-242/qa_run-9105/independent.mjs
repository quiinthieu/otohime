// Separate QA implementation: no delivered fake, parser, walk or probe is imported.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openSync, closeSync } from 'node:fs';
import { chromium } from 'playwright-core';

const listen = async server => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port; };
const events = [];
// Reuse only the repository's database lifecycle, never its provider fixtures or assertions.
const database = spawn(process.execPath, ['scripts/e2e.mjs', '--serve-db', '/tmp/qa-9105/independent-db'], { stdio: ['ignore', 'pipe', 'inherit'] });
const databaseUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('database startup exceeded 20 seconds')), 20000);
  let text = '';
  database.stdout.on('data', chunk => {
    text += chunk;
    const match = /^DATABASE_URL=(.+)$/m.exec(text);
    if (match) { clearTimeout(timer); resolve(match[1]); }
  });
  database.on('exit', code => { clearTimeout(timer); reject(new Error(`database exited ${code}`)); });
});
let scenario = 'current';
const stamp = 946684800;
const metadata = { track_name: 'QA cassette <independent>', artist_name: 'QA artist', additional_info: { origin_url: 'https://evil.example/track/stolen' } };
const fake = createServer((req, res) => {
  events.push({ scenario, path: req.url, agent: req.headers['user-agent'], accept: req.headers.accept });
  res.setHeader('content-type', 'application/json');
  if (scenario === 'broken') { res.end('{bad json'); return; }
  const current = req.url.endsWith('/playing-now');
  res.end(JSON.stringify({ payload: current
    ? { playing_now: scenario === 'current', count: scenario === 'current' ? 1 : 0, listens: scenario === 'current' ? [{ track_metadata: metadata }] : [] }
    : { count: 1, listens: [{ listened_at: stamp, track_metadata: { ...metadata, track_name: 'QA old last' } }] } }));
});
const fakePort = await listen(fake);
const browser = await chromium.launch({ channel: 'chrome' });
const output = { browser: browser.version(), real: 'locked Chrome, Next production build, fetch, React and CSS', fake: 'only loopback ListenBrainz HTTP responses', scenarios: [] };
try {
  for (scenario of ['current', 'last', 'broken']) {
    const reserve = createServer(); const port = await listen(reserve); await new Promise(resolve => reserve.close(resolve));
    const env = { ...process.env, DATABASE_URL: databaseUrl, BETTER_AUTH_SECRET: 'ci-placeholder-not-a-real-secret-0123456789abcdef', BETTER_AUTH_URL: `http://127.0.0.1:${port}`, LISTENBRAINZ_USER: 'QA Identity', NOW_PLAYING_LISTENBRAINZ_HOST: `http://127.0.0.1:${fakePort}` };
    for (const key of ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN', 'STEAM_API_KEY', 'STEAM_ID']) delete env[key];
    const fd = openSync(`/tmp/qa-9105/independent-${scenario}-server.log`, 'w');
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { env, detached: true, stdio: ['ignore', fd, fd] });
    closeSync(fd);
    const base = `http://127.0.0.1:${port}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const deadline = Date.now() + 15000;
      while (true) {
        try { const r = await fetch(`${base}/api/now-playing`); if (r.status === 200) break; } catch {}
        if (Date.now() > deadline) throw new Error('Next readiness exceeded 15 seconds');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const response = await fetch(`${base}/api/now-playing`); assert.equal(response.status, 200);
      const api = await response.json();
      assert.equal(api.music.source, 'listenbrainz');
      assert.equal(api.spotify, 'spotify-off');
      assert.equal(api.music.state, scenario === 'broken' ? 'quiet' : 'fixture');
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      assert.equal((await page.goto(`${base}/music`, { waitUntil: 'networkidle' })).status(), 200);
      const shelf = page.locator('[data-now-playing]');
      assert.equal(await shelf.getAttribute('data-music-state'), api.music.state);
      assert.equal(await shelf.locator('[data-now-playing-credit] time').getAttribute('datetime'), api.readAt);
      if (scenario !== 'broken') {
        assert.equal(await shelf.locator('.tape [data-label="title"]').innerText(), api.track.title);
        assert.match(await shelf.innerText(), /fixture/i);
        assert.equal(api.track.url, null);
        assert.equal(await shelf.locator('.tape .np-link').getAttribute('href'), 'https://listenbrainz.org/user/QA%20Identity/');
        assert.equal(await shelf.locator('.tape[data-spin]').count(), scenario === 'current' ? 1 : 0);
        if (scenario === 'current') {
          assert.equal(await shelf.locator('.reel').first().evaluate(e => getComputedStyle(e).animationName), 'reel-spin');
          await page.emulateMedia({ reducedMotion: 'reduce' });
          assert.equal(await shelf.locator('.reel').first().evaluate(e => getComputedStyle(e).animationName), 'none');
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          assert.equal(await shelf.locator('.reel').first().evaluate(e => getComputedStyle(e).animationName), 'reel-spin');
        }
        if (scenario === 'last') {
          assert.equal(api.track.listenedAt, '2000-01-01T00:00:00.000Z');
          assert.equal(await shelf.locator('.np-listened-at').innerText(), '2000-01-01 · 00:00:00 UTC');
          assert.equal(await shelf.locator('.reel').first().evaluate(e => getComputedStyle(e).animationName), 'none');
        }
        // Mutation control exercises the independent fixture-state assertion.
        await shelf.evaluate(e => e.dataset.musicState = 'live');
        await assert.rejects(async () => assert.equal(await shelf.getAttribute('data-music-state'), 'fixture'));
        await shelf.evaluate(e => e.dataset.musicState = 'fixture');
      } else {
        assert.equal(api.track, null);
        assert.equal(await shelf.locator('.tape').getAttribute('data-face'), 'quiet');
        assert.equal(await shelf.locator('.tape[data-spin]').count(), 0);
      }
      assert.equal(await shelf.locator('a[href*="evil.example"]').count(), 0);
      assert.deepEqual(errors, []);
      const requests = events.filter(e => e.scenario === scenario);
      assert.equal(requests.length, 2, 'one cached selected reading for API and page');
      assert.deepEqual(requests.map(e => e.path).sort(), ['/1/user/QA%20Identity/listens?count=1', '/1/user/QA%20Identity/playing-now']);
      for (const request of requests) { assert.equal(request.agent, 'otohime.dev/1.0 (+https://otohime.dev)'); assert.equal(request.accept, 'application/json'); }
      output.scenarios.push({ scenario, api, requests, negativeControl: scenario === 'broken' ? 'malformed responses yield HTTP 200 quiet' : 'mutated fixture state rejected; unsafe provider URL discarded' });
    } finally {
      await context.close();
      process.kill(-child.pid, 'SIGTERM');
      await once(child, 'exit');
    }
  }
  console.log(JSON.stringify(output, null, 2));
} finally {
  await browser.close(); await new Promise(resolve => fake.close(resolve));
  database.kill('SIGTERM'); await once(database, 'exit');
}
