const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createCollector } = require('../scripts/debug-collector.cjs');
const client = 'a'.repeat(32);

test('collector binds to loopback, writes JSONL, deduplicates retries and rejects webpage origins', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tabweaver-collector-'));
  const collector = createCollector({ directory, port: 0 });
  const address = await collector.start();
  t.after(async () => {
    await new Promise(resolve => collector.server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  assert.equal(address.address, '127.0.0.1');
  const url = `http://127.0.0.1:${address.port}`;
  const headers = { 'Content-Type': 'application/json', 'X-TabWeaver-Client': client, Origin: `chrome-extension://${client}` };
  const events = [{ id: 'one', event: 'task.blocked', message: 'send missing' }];
  const response = await fetch(url + '/events', { method: 'POST', headers, body: JSON.stringify({ events }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).written, 1);
  const again = await fetch(url + '/events', { method: 'POST', headers, body: JSON.stringify({ events }) });
  assert.equal((await again.json()).written, 0);
  const forbidden = await fetch(url + '/events', { method: 'POST', headers: { ...headers, Origin: 'https://example.com' }, body: JSON.stringify({ events }) });
  assert.equal(forbidden.status, 403);
  const health = await fetch(url + '/health', { headers });
  assert.equal((await health.json()).directory, directory);
  const files = (await fs.readdir(directory)).filter(name => name.endsWith('.jsonl'));
  assert.equal(files.length, 1);
  assert.ok(files[0].endsWith('.jsonl'));
  const lines = (await fs.readFile(path.join(directory, files[0]), 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).event, 'collector.started');
  assert.equal(JSON.parse(lines[1]).message, 'send missing');
  const status = JSON.parse(await fs.readFile(path.join(directory, 'collector-status.json'), 'utf8'));
  assert.equal(status.port, address.port);
});

test('disk sink keeps offline cache, then acknowledges directory writes without blocking recording', async () => {
  const storage = {};
  let online = false;
  const written = [];
  const context = vm.createContext({
    URL, AbortSignal,
    chrome: { runtime: { id: client }, storage: { local: {
      async get(key) { return { [key]: structuredClone(storage[key]) }; },
      async set(data) { Object.assign(storage, structuredClone(data)); }
    } } },
    async fetch(url, options) {
      if (!online) throw new Error('offline');
      if (options.body) written.push(...JSON.parse(options.body).events);
      return { ok: true, async json() { return { ok: true, directory: 'E:/code/TabWeaver/debug-logs' }; } };
    }
  });
  vm.runInContext(await fs.readFile(path.join(__dirname, '../debug-store.js'), 'utf8'), context);
  const debug = context.TabWeaverDebug;
  await debug.configure({ enabled: true });
  await debug.record({ event: 'task.blocked', message: 'missing send' });
  await debug.flushToDirectory();
  assert.equal(debug.getSinkStatus().connected, false);
  assert.equal((await debug.snapshot()).events.length, 2);
  online = true;
  await debug.flushToDirectory();
  assert.equal(written.length, 2);
  assert.equal(written[1].message, 'missing send');
  assert.equal(debug.getSinkStatus().connected, true);
  await debug.flushToDirectory();
  assert.equal(written.length, 2, 'acknowledged events are not sent again');
  const probe = await debug.probe();
  assert.equal(probe.delivered, true);
  assert.equal(written.at(-1).id, probe.probeId);
  assert.equal(written.at(-1).event, 'diagnostics.probe');
  assert.equal(written.at(-1).synthetic, true);
  online = false;
  const failed = await debug.probe();
  assert.equal(failed.delivered, false);
});

test('only the capsule header starts dragging; body, warning rows, buttons and right click do not', async () => {
  const source = await fs.readFile(path.join(__dirname, '../content-chat.js'), 'utf8');
  const start = source.indexOf('  function makeDraggable(el)');
  const end = source.indexOf('  /* =====', start);
  const handlers = {};
  const windowHandlers = {};
  const header = {};
  const el = { style: {}, contains: node => node === header,
    getBoundingClientRect: () => ({ left: 10, top: 20 }), addEventListener: (type, fn) => { handlers[type] = fn; }
  };
  const context = vm.createContext({ window: { addEventListener: (type, fn) => { windowHandlers[type] = fn; } } });
  vm.runInContext(source.slice(start, end) + '\nglobalThis.attach = makeDraggable;', context);
  context.attach(el);
  const down = ({ inHeader, control = false, button = 0 }) => {
    let prevented = false;
    handlers.mousedown({ button, clientX: 30, clientY: 50, preventDefault() { prevented = true; },
      target: { closest: selector => selector === '.capsule-main-bar' ? (inHeader ? header : null) : (control ? {} : null) }
    });
    return prevented;
  };
  assert.equal(down({ inHeader: false }), false);
  assert.equal(down({ inHeader: true, control: true }), false);
  assert.equal(down({ inHeader: true, button: 2 }), false);
  assert.equal(down({ inHeader: true }), true);
  windowHandlers.mousemove({ clientX: 50, clientY: 70 });
  assert.equal(el.style.left, '30px');
  assert.equal(el.style.top, '40px');
  windowHandlers.mouseup();
  windowHandlers.mousemove({ clientX: 200, clientY: 200 });
  assert.equal(el.style.left, '30px');
});
