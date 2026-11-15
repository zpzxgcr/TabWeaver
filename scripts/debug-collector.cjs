#!/usr/bin/env node
/** Optional local diagnostic sink. No dependencies; never binds to external interfaces. */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function createCollector({ directory = path.resolve(__dirname, '../debug-logs'), port = 17321 } = {}) {
  let writes = Promise.resolve();
  let activeFile;
  let bytes = 0;
  const seen = new Set();
  const session = new Date().toISOString().replace(/[:.]/g, '-');
  let segment = 0;
  async function append(events) {
    await fs.mkdir(directory, { recursive: true });
    const batchIds = new Set();
    const fresh = events.filter(event => {
      if (seen.has(event.id) || batchIds.has(event.id)) return false;
      batchIds.add(event.id);
      return true;
    });
    if (!fresh.length) return 0;
    const text = fresh.map(event => JSON.stringify(event)).join('\n') + '\n';
    if (!activeFile || bytes + Buffer.byteLength(text) > 8 * 1024 * 1024) {
      activeFile = path.join(directory, `runtime-${session}-${process.pid}-${segment++}.jsonl`);
      bytes = 0;
    }
    await fs.appendFile(activeFile, text, { encoding: 'utf8', mode: 0o600 });
    bytes += Buffer.byteLength(text);
    fresh.forEach(event => seen.add(event.id));
    while (seen.size > 10000) seen.delete(seen.values().next().value);
    // Retain the most recent 10 log segments, never touch unrelated files.
    const files = (await fs.readdir(directory)).filter(name => /^runtime-[\w.\-]+\.jsonl$/.test(name)).sort();
    await Promise.all(files.slice(0, -10).filter(name => path.join(directory, name) !== activeFile).map(name => fs.unlink(path.join(directory, name))));
    return fresh.length;
  }
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const extensionOrigin = typeof origin === 'string' && /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
    const expectedHost = `127.0.0.1:${server.address().port}`;
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
        ...(extensionOrigin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) });
      res.end(JSON.stringify(data));
    };
    // The custom header + extension-only CORS gate prevents ordinary webpages from
    // submitting logs. Local processes are trusted; this is not a remote service.
    if (req.headers.host !== expectedHost || (origin && !extensionOrigin)) return reply(403, { error: 'Forbidden origin or host' });
    if (req.method === 'OPTIONS') {
      if (!extensionOrigin) return reply(403, { error: 'Extension origin required' });
      res.writeHead(204, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-TabWeaver-Client', Vary: 'Origin' });
      return res.end();
    }
    const client = req.headers['x-tabweaver-client'];
    if (!/^[a-p]{32}$/.test(client || '') || (origin && origin !== `chrome-extension://${client}`)) return reply(403, { error: 'Extension client header required' });
    if (req.method === 'GET' && req.url === '/health') return reply(200, { ok: true, directory });
    if (req.method !== 'POST' || req.url !== '/events') return reply(404, { error: 'Not found' });
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return reply(415, { error: 'JSON required' });
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 3 * 1024 * 1024) { reply(413, { error: 'Request too large' }); req.resume(); return; }
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Array.isArray(data.events) || !data.events.length || data.events.length > 40 ||
          data.events.some(event => !event || typeof event !== 'object' || typeof event.event !== 'string' || typeof event.id !== 'string' || event.id.length > 128)) {
        return reply(400, { error: 'Invalid event batch' });
      }
      const batch = data.events.map(event => ({ ...event, receivedAt: new Date().toISOString(), extensionId: client }));
      const job = writes.then(() => append(batch));
      writes = job.catch(() => {});
      const written = await job;
      reply(200, { ok: true, written, directory });
    } catch (error) {
      reply(error instanceof SyntaxError ? 400 : 500, { error: error instanceof SyntaxError ? 'Invalid JSON' : 'Cannot write local diagnostics' });
      if (!(error instanceof SyntaxError)) console.error('[TabWeaver collector]', error.message);
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  return { server, directory, start: () => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', async () => {
      try {
        const address = server.address();
        const startedAt = new Date().toISOString();
        await append([{ id: randomUUID(), event: 'collector.started', source: 'collector', time: startedAt, pid: process.pid, port: address.port, directory }]);
        await fs.writeFile(path.join(directory, 'collector-status.json'), JSON.stringify({ pid: process.pid, port: address.port, directory, startedAt }, null, 2));
        resolve(address);
      } catch (error) { server.close(); reject(error); }
    });
  }) };
}
if (require.main === module) {
  const collector = createCollector();
  collector.start().then(address => {
    console.log(`TabWeaver local collector: http://127.0.0.1:${address.port}`);
    console.log(`Logs: ${collector.directory}`);
    console.log('Enable developer mode in the extension. Leave this terminal running; Ctrl+C stops the collector.');
  }).catch(error => { console.error(`Cannot start collector: ${error.message}`); process.exitCode = 1; });
}
module.exports = { createCollector };
