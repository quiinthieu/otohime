// Loopback recorder: logs every request it receives and answers 503, so any build-time provider read is counted.
import http from 'node:http';
import fs from 'node:fs';
const [port, out] = [Number(process.argv[2]), process.argv[3]];
const seen = [];
http.createServer((req, res) => {
  seen.push({ at: new Date().toISOString(), method: req.method, url: req.url, ua: req.headers['user-agent'] ?? null });
  fs.writeFileSync(out, JSON.stringify(seen, null, 2));
  res.writeHead(503, { 'content-type': 'text/plain' }); res.end('recorder');
}).listen(port, '127.0.0.1', () => { fs.writeFileSync(out, '[]'); console.log('recorder ready', port); });
