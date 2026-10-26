// Independent QA client. Uses ws from the locked Worker dependency tree, not the delivered raw client/cases.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const root = new URL('../../../', import.meta.url);
const workerDir = new URL('ghosts/worker/', root);
const require = createRequire(new URL('package.json', workerDir));
const { unstable_startWorker } = require('wrangler');
const WebSocket = require('ws');
const { Room } = await import(new URL('ghosts/room.ts', root));
const { startGhostsFake } = await import(new URL('scripts/ghosts-fake.mjs', root));
const { fingerprint } = await import(new URL('scripts/fingerprint.mjs', workerDir));
const results = [];
const quiet = () => new Promise(resolve => setTimeout(resolve, 80));

async function check(name, run) {
  try { results.push({ name, status: 'pass', evidence: await run() }); }
  catch (error) { results.push({ name, status: 'fail', error: error.message }); }
}

async function connect(base, room = '/', origin = 'https://otohime.dev') {
  const socket = new WebSocket(`${base.replace(/^http/, 'ws')}/ghosts?room=${encodeURIComponent(room)}`, { origin });
  const messages = [];
  socket.on('message', data => messages.push(JSON.parse(data.toString())));
  socket.on('error', () => {});
  await once(socket, 'open');
  for (let n = 0; !messages.some(m => m.t === 'hi') && n < 20; n++) await quiet();
  assert.ok(messages.some(m => m.t === 'hi'), 'server greets independent ws client');
  return { socket, messages, id: messages.find(m => m.t === 'hi').id };
}

async function exercise(base, label) {
  const clients = [];
  const open = async room => { const client = await connect(base, room); clients.push(client); return client; };
  try {
    await check(`${label}: independent move/click, UUID, no echo and room isolation`, async () => {
      const a = await open('/'); const b = await open('/'); const c = await open('/ryugu');
      assert.match(a.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      assert.notEqual(a.id, b.id);
      a.socket.send(JSON.stringify({t:'m',x:-2,y:3,id:'spoof'}));
      a.socket.send(JSON.stringify({t:'c',x:0.25,y:0.75}));
      await quiet();
      assert.deepEqual(b.messages.filter(m => m.t === 'm' || m.t === 'c'), [
        {t:'m',id:a.id,x:0,y:1}, {t:'c',id:a.id,x:0.25,y:0.75},
      ]);
      assert.equal(a.messages.some(m => m.t === 'm' || m.t === 'c'), false);
      assert.equal(c.messages.some(m => m.t === 'm' || m.t === 'c'), false);
      return { clients:3, credentials: false, moveAndClick:true };
    });
    await check(`${label}: negative control bad Origin refuses upgrade`, async () => {
      const status = await new Promise((resolve, reject) => {
        const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/ghosts?room=%2F`, {origin:'https://evil.example'});
        ws.on('error', () => {});
        ws.on('open', () => {ws.terminate(); reject(new Error('bad Origin was admitted'));});
        ws.on('unexpected-response', (_req, response) => {response.resume(); resolve(response.statusCode);});
      });
      assert.equal(status, 403); return { status };
    });
    await check(`${label}: malformed JSON does not fan out and closes after five`, async () => {
      const a = await open('/ryugu');
      const closed = once(a.socket, 'close');
      for (let i = 0; i < 5; i++) a.socket.send('{');
      const [code] = await closed; assert.equal(code, 1008); return { code };
    });
    await check(`${label}: reserved RSV1 without extension cannot fan out`, async () => {
      const a = await open('/'); const b = await open('/');
      const data = Buffer.from('{"t":"m","x":0.3,"y":0.6}');
      // FIN + RSV1 + text; no extension was negotiated. Fixed nonzero mask.
      const mask = Buffer.from([1,2,3,4]);
      const masked = Buffer.from(data.map((v,i) => v ^ mask[i % 4]));
      a.socket._socket.write(Buffer.concat([Buffer.from([0xc1,0x80 | data.length]),mask,masked]));
      await quiet();
      const events = b.messages.filter(m => m.t === 'm' && m.id === a.id);
      assert.equal(events.length, 0, `invalid wire frame fanned out ${events.length} event(s)`);
      return { invalidFanout:events.length, readyState:a.socket.readyState };
    });
  } finally { for (const {socket} of clients) socket.terminate(); }
}

process.env.WRANGLER_SEND_METRICS = 'false';
const build = fingerprint();
const worker = await unstable_startWorker({
  config:fileURLToPath(new URL('wrangler.jsonc', workerDir)),
  build:{define:{__GHOSTS_FINGERPRINT__:JSON.stringify(build.fingerprint)}},
  dev:{server:{hostname:'127.0.0.1',port:0},inspector:false,persist:false,watch:false,logLevel:'none'},
});
try {
  await worker.ready;
  const base = String(await worker.url).replace(/\/$/,'');
  await check('actual Worker version identifies locked executable', async () => {
    const response = await fetch(`${base}/version`, {signal:AbortSignal.timeout(10000)});
    assert.deepEqual(await response.json(), {service:'otohime-ghosts',fingerprint:build.fingerprint});
    return build;
  });
  await exercise(base, 'actual Worker');
} finally { await worker.dispose(); }
const fake = await startGhostsFake({origins:['https://otohime.dev']});
try { await exercise(fake.base, 'fake'); } finally { await fake.close(); }

await check('clock rollback then recovery cannot refill without passing the prior high-water mark', () => {
  let now = 1000000;
  const room = new Room({now:() => now}); room.join('a'); room.join('b');
  const frame = '{"t":"m","x":0.2,"y":0.4}';
  for (let n=0;n<15;n++) assert.equal(room.receive('a',frame).outcome,'accepted');
  now -= 5000; assert.equal(room.receive('a',frame).outcome,'rate');
  now += 5000;
  const result = room.receive('a',frame);
  assert.equal(result.outcome,'rate', `recovery minted tokens: ${JSON.stringify(result.member)}`);
});
console.log(JSON.stringify({node:process.version, fingerprint:build.fingerprint, results},null,2));
process.exitCode = results.some(r => r.status === 'fail') ? 1 : 0;
