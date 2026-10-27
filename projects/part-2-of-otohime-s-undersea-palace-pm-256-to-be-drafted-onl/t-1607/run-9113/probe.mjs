// QA-owned client and assertions; no delivered CONTRACT_CASES or rawConnect.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../../../../', import.meta.url);
const workerDir = new URL('ghosts/worker/', root);
const require = createRequire(new URL('package.json', workerDir));
const { unstable_startWorker } = require('wrangler');
const WebSocket = require('ws');
const { startGhostsFake } = await import(new URL('scripts/ghosts-fake.mjs', root));
const { Room } = await import(new URL('ghosts/room.ts', root));
const { fingerprint } = await import(new URL('scripts/fingerprint.mjs', workerDir));
const build = fingerprint();
const results = [];
const origin = 'https://otohime.dev';
const clients = new Set();

async function check(name, fn) {
  try { results.push({ name, status: 'pass', evidence: await fn() }); }
  catch (error) { results.push({ name, status: 'fail', error: error.stack }); }
}
function waitFor(client, predicate, timeout = 2500) {
  const found = client.messages.find(predicate);
  if (found) return Promise.resolve(found);
  return new Promise((resolve, reject) => {
    const listener = data => {
      const msg = JSON.parse(data.toString());
      if (predicate(msg)) { clearTimeout(timer); client.ws.off('message', listener); resolve(msg); }
    };
    const timer = setTimeout(() => { client.ws.off('message', listener); reject(new Error('message deadline')); }, timeout);
    client.ws.on('message', listener);
  });
}
async function open(base, room = '/') {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/ghosts?room=${encodeURIComponent(room)}`, { origin, perMessageDeflate: false });
  const client = { ws, messages: [], closed: null };
  clients.add(client);
  ws.on('error', () => {});
  ws.on('message', data => client.messages.push(JSON.parse(data.toString())));
  client.closed = new Promise(resolve => ws.on('close', code => { clients.delete(client); resolve(code); }));
  await once(ws, 'open');
  const hi = await waitFor(client, m => m.t === 'hi' || m.t === 'full');
  client.id = hi.id;
  return client;
}
async function close(client) {
  if (client.ws.readyState < 2) client.ws.close();
  return Promise.race([client.closed, delay(1000).then(() => client.ws.terminate())]);
}
async function refusal(base, headers, path = '/ghosts?room=%2F') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}${path}`, { headers, perMessageDeflate: false, handshakeTimeout: 2500 });
    ws.on('unexpected-response', (_, response) => { response.resume(); ws.terminate(); resolve(response.statusCode); });
    ws.on('open', () => { ws.terminate(); reject(new Error('negative control upgraded')); });
    ws.on('error', () => {});
    setTimeout(() => { ws.terminate(); reject(new Error('refusal deadline')); }, 3000).unref();
  });
}
async function exercise(label, base) {
  await check(`${label}: anonymous normalized move/click, room isolation and close cleanup`, async () => {
    const a = await open(base), b = await open(base), other = await open(base, '/ryugu');
    try {
      for (const c of [a, b, other]) assert.match(c.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      assert.equal(new Set([a.id, b.id, other.id]).size, 3);
      a.ws.send(JSON.stringify({ t: 'm', x: -100, y: 50, id: 'forged' }));
      assert.deepEqual(await waitFor(b, m => m.t === 'm'), { t: 'm', id: a.id, x: 0, y: 1 });
      b.ws.send(JSON.stringify({ t: 'c', x: 0.123456, y: 0.876543 }));
      assert.deepEqual(await waitFor(a, m => m.t === 'c'), { t: 'c', id: b.id, x: 0.1235, y: 0.8765 });
      await close(a);
      await waitFor(b, m => m.t === 'bye' && m.id === a.id);
      await waitFor(b, m => m.t === 'n' && m.n === 1);
      assert.equal(a.messages.some(m => m.t === 'm'), false);
      assert.equal(b.messages.some(m => m.t === 'c'), false);
      assert.equal(other.messages.some(m => ['m', 'c', 'bye'].includes(m.t)), false);
      return { clients: 3, credentials: false, serverUUIDs: true, moveAndClick: true };
    } finally { await Promise.all([a,b,other].map(close)); }
  });
  await check(`${label}: missing/null/path/evil Origins and duplicate/unknown rooms refuse`, async () => {
    const codes = [];
    for (const value of [undefined, 'null', 'https://otohime.dev/extra', 'https://otohime.dev.evil.invalid']) {
      codes.push(await refusal(base, value === undefined ? {} : { Origin: value }));
    }
    assert.deepEqual(codes, [403,403,403,403]);
    for (const path of ['/ghosts?room=%2F&room=%2F', '/ghosts?room=%2Felsewhere']) assert.equal(await refusal(base, { Origin: origin }, path), 404);
    assert.equal((await fetch(`${base}/ghosts?room=%2F`)).status, 426);
    return { originStatuses: codes, unknownAndDuplicateRoom: 404, nonUpgrade: 426 };
  });
  await check(`${label}: five distinct invalid cases never fan out and close 1008`, async () => {
    const a = await open(base), b = await open(base);
    try {
      // Five cases chosen independently of the delivered test vectors.
      for (const frame of ['{"t":"m","x":"0.1","y":0.2}', '{"t":"c","x":null,"y":0.2}', '[]', 'x'.repeat(129)]) a.ws.send(frame);
      a.ws.send(Buffer.from('{"t":"m","x":0.3,"y":0.4}'));
      const code = await Promise.race([a.closed, delay(2500).then(() => { throw new Error('invalid close deadline'); })]);
      assert.equal(code, 1008);
      await waitFor(b, m => m.t === 'bye' && m.id === a.id);
      assert.equal(b.messages.some(m => m.t === 'm' || m.t === 'c'), false);
      return { invalidAttempts: 5, close: code, invalidFanout: 0 };
    } finally { await Promise.all([a,b].map(close)); }
  });
  await check(`${label}: independent 200-event burst is bounded`, async () => {
    const a=await open(base), b=await open(base);
    try {
      const started=performance.now();
      a.ws._socket.cork();
      for(let i=0;i<200;i++) a.ws.send(JSON.stringify({t:'m',x:i/200,y:0.5}));
      a.ws._socket.uncork();
      await waitFor(b,m=>m.t==='m');
      // Bounded delivery window for frames already driven by this test, not an idle soak.
      await delay(100);
      const elapsed=performance.now()-started;
      const got=b.messages.filter(m=>m.t==='m').length;
      assert.ok(got>=15 && got<=15+Math.ceil(elapsed*15/1000),`${got} events after ${elapsed} ms`);
      assert.ok(got<200);
      return {attempts:200,fanout:got,elapsedMs:Math.round(elapsed)};
    } finally { await Promise.all([a,b].map(close)); }
  });
  await check(`${label}: 24-socket cap, full/1013, room remains bounded`, async () => {
    const group=[];
    try {
      for(let i=0;i<24;i++) group.push(await open(base));
      assert.equal(group[23].messages[0].n,24);
      const extra=await open(base);
      assert.deepEqual(extra.messages[0],{t:'full'});
      assert.equal(await Promise.race([extra.closed,delay(2500).then(()=>{throw new Error('full close deadline');})]),1013);
      return {members:24,extraClose:1013};
    } finally { await Promise.all(group.map(close)); }
  });
  await check(`${label}: independent handcrafted RSV2 negative after valid click`, async () => {
    const a = await open(base), b = await open(base);
    try {
      a.ws.send('{"t":"c","x":0.2,"y":0.4}');
      await waitFor(b, m => m.t === 'c');
      const body = Buffer.from('{"t":"m","x":0.9,"y":0.9}');
      const mask = Buffer.from([97,19,51,7]);
      const closeFrame = new Promise((resolve,reject) => {
        const timer=setTimeout(()=>reject(new Error('close frame deadline')),2500);
        a.ws._receiver.once('conclude',code=>{clearTimeout(timer);resolve(code);});
      });
      a.ws._socket.write(Buffer.concat([Buffer.from([0xa1,0x80|body.length]),mask,Buffer.from(body.map((x,i)=>x^mask[i%4]))]));
      assert.equal(await closeFrame,1002);
      await waitFor(b, m => m.t === 'bye' && m.id === a.id);
      // workerd's HTTP websocket tunnel can remain CLOSING until the ws close timeout.
      // Assert the actual received protocol close, separately from TCP teardown.
      assert.equal(a.ws._closeFrameReceived, true);
      assert.equal(a.ws._closeCode, 1002);
      assert.equal(b.messages.some(m => m.t === 'm'), false);
      const evidence = { validClick: true, receivedClose: a.ws._closeCode, readyState: a.ws.readyState, invalidFanout: 0 };
      a.ws.terminate();
      return evidence;
    } finally { await Promise.all([a,b].map(close)); }
  });
}
process.env.WRANGLER_SEND_METRICS = 'false';
let worker, fake;
try {
  worker = await unstable_startWorker({
    config: fileURLToPath(new URL('wrangler.jsonc', workerDir)),
    build: { define: { __GHOSTS_FINGERPRINT__: JSON.stringify(build.fingerprint) } },
    dev: { server: { hostname: '127.0.0.1', port: 0 }, inspector: false, persist: false, watch: false, logLevel: 'none' },
  });
  await worker.ready;
  const base = String(await worker.url).replace(/\/$/, '');
  await check('actual Worker /version matches code+lock+config fingerprint', async () => {
    assert.deepEqual(await (await fetch(`${base}/version`)).json(), { service:'otohime-ghosts', fingerprint:build.fingerprint });
    assert.equal((await fetch(`${base}/version`,{method:'DELETE'})).status,405);
    return build;
  });
  await exercise('actual Worker', base);
  fake = await startGhostsFake({ origins: origin });
  await exercise('fake', fake.base);
  await check('rollback high-water recovery and restored penalties (independent time sequence)', async () => {
    let now = 10000;
    let room = new Room({now:()=>now});
    room.join('qa');
    for(let i=0;i<11;i++) room.receive('qa','{"t":"m","x":0,"y":0}');
    for(let i=0;i<4;i++) room.receive('qa','{}');
    assert.equal(room.snapshot('qa').tokens,0);
    now=9000; assert.equal(room.receive('qa','{}').outcome,'rate');
    const state=JSON.parse(JSON.stringify(room.snapshot('qa')));
    assert.equal(state.at,10000);
    assert.deepEqual(Object.keys(state).sort(),['at','id','invalid','tokens']);
    room=new Room({now:()=>now}); assert.equal(room.restore(state),true);
    now=10000; assert.equal(room.receive('qa','{}').outcome,'rate');
    now=10066; assert.equal(room.receive('qa','{}').outcome,'rate');
    now=10067; assert.equal(room.receive('qa','{}').outcome,'closed');
    assert.equal(room.snapshot('qa').invalid,5);
    return { rollbackMs:1000, recoveryTokens:0, restoredStrikes:4, fifthStrikeAtMs:10067 };
  });
} finally {
  for (const c of clients) c.ws.terminate();
  await fake?.close();
  await worker?.dispose();
}
const output = { node:process.version, ws:require('ws/package.json').version, fingerprint:build.fingerprint, results };
writeFileSync(new URL('independent.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
process.exitCode=results.some(x=>x.status!=='pass')?1:0;
