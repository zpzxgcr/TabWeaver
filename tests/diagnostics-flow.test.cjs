const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function debugStore(storage = {}) {
  const context = vm.createContext({ chrome: { storage: { local: {
    async get(key) { return { [key]: structuredClone(storage[key]) }; },
    async set(data) { Object.assign(storage, structuredClone(data)); }
  } } }, URL });
  vm.runInContext(read('debug-store.js'), context);
  return context.TabWeaverDebug;
}
test('diagnostics are opt-in, omit content by default, survive reload and serialize concurrent writes', async () => {
  const storage = {};
  const debug = debugStore(storage);
  await debug.record({ event: 'disabled' });
  assert.equal((await debug.snapshot()).events.length, 0);
  await debug.configure({ enabled: true });
  await Promise.all(Array.from({ length: 30 }, (_, i) => debug.record({ event: 'test', i, content: 'PRIVATE PAGE', accessToken: 'secret' })));
  const snapshot = await debugStore(storage).snapshot();
  assert.equal(snapshot.events.length, 31);
  assert.equal(new Set(snapshot.events.slice(1).map(e => e.i)).size, 30);
  assert.ok(!JSON.stringify(snapshot).includes('PRIVATE PAGE'));
  assert.ok(!JSON.stringify(snapshot).includes('secret'));
  await debug.configure({ enabled: true, captureContent: true });
  await debug.record({ event: 'content', content: 'explicit opt-in' });
  assert.equal((await debug.snapshot()).events.at(-1).content, 'explicit opt-in');
  await debug.clear();
  assert.equal((await debug.snapshot()).events.length, 0);
  assert.equal((await debug.snapshot()).enabled, true);
});
test('diagnostic retention bounds event count and payload size', async () => {
  const debug = debugStore();
  await debug.configure({ enabled: true });
  for (let i = 0; i < 410; i++) await debug.record({ event: 'bounded', i });
  assert.equal((await debug.snapshot()).events.length, 400);
  await debug.configure({ enabled: true, captureContent: true });
  for (let i = 0; i < 70; i++) await debug.record({ event: 'large', content: 'a'.repeat(15000) });
  const events = (await debug.snapshot()).events;
  assert.ok(JSON.stringify(events).length <= 700000);
  assert.ok(events.at(-1).content.length <= 12000);
});
test('diagnostic URL metadata drops query strings and fragments', () => {
  assert.equal(debugStore().safeUrl('https://example.com/stats?secret=123#token'), 'https://example.com/stats');
});

function executor({ root, children = [], clicked } = {}) {
  const context = vm.createContext({
    window: { innerHeight: 800 }, innerHeight: 800, innerWidth: 1200,
    document: { scrollingElement: root, documentElement: root,
      querySelectorAll: () => children, querySelector: () => clicked, title: 'Test' },
    location: { href: 'https://example.com' },
    getComputedStyle: () => ({ overflowY: 'auto', visibility: 'visible' }),
    setTimeout(fn) { fn(); return 0; },
    MouseEvent: class { constructor(type) { this.type = type; this.defaultPrevented = false; } }
  });
  return vm.runInContext(read('action-executor.js'), context);
}
function scrollElement({ height = 500, total = 1500 } = {}) {
  return { tagName: 'DIV', scrollTop: 0, scrollHeight: total, clientHeight: height,
    getBoundingClientRect: () => ({ width: 1100, height, top: 0, bottom: height, left: 0, right: 1100 }),
    scrollTo({ top }) { this.scrollTop = top; }
  };
}
test('scroll targets a nested dashboard container when the window cannot scroll', async () => {
  const root = scrollElement({ total: 500 });
  const content = scrollElement({ height: 700, total: 2000 });
  const result = await executor({ root, children: [content] })({ action: 'scroll', direction: 'down' });
  assert.equal(result.success, true);
  assert.equal(root.scrollTop, 0);
  assert.equal(content.scrollTop, 525);
  assert.equal(result.scroll.before, 0);
  assert.equal(result.scroll.after, 525);
});
test('scroll at boundary reports no movement rather than success', async () => {
  const root = scrollElement({ total: 500 });
  const result = await executor({ root })({ action: 'scroll', direction: 'down' });
  assert.equal(result.success, false);
  assert.equal(result.error, 'NO_SCROLL_MOVEMENT');
  assert.equal(result.scroll.atBoundary, true);
});
test('click produces one click, not duplicate dispatch plus native clicks', async () => {
  let clicks = 0;
  const clicked = { innerText: '今天', style: {}, tagName: 'BUTTON',
    closest: () => null, getAttribute: () => '', scrollIntoView() {},
    dispatchEvent(event) { if (event.type === 'click') clicks++; }, click() { clicks++; }
  };
  const result = await executor({ clicked })({ action: 'click', element: 1 });
  assert.equal(result.success, true);
  assert.equal(clicks, 1);
});

function responseWatcher({ text, baseline, count = 1, baseCount = count }) {
  const source = read('content-chat.js');
  const start = source.indexOf('    const checkAssistantResponse = () => {');
  const end = source.indexOf('    const safeCheck = () => {', start);
  const parseStart = source.indexOf('  function parseActionFromText(text)');
  const parseEnd = source.indexOf('  // 核心监控调度器', parseStart);
  const actions = [];
  const warnings = [];
  const context = vm.createContext({
    Date, state: { round: 2, isRunning: true, responseBaseline: { texts: baseline }, baseAiNodeCount: baseCount, currentRoundHandled: false },
    getAllAiMessageNodes: () => Array.from({ length: count }, () => ({})),
    chatDOM: { getMessageText: () => text, describe: () => ({}) }, isAiStreaming: () => false,
    isAgentInternalPrompt: value => value.includes('【系统执行状态回执】'),
    trace() {}, triggerAction: action => actions.push(action), stopForCompatibility: message => warnings.push(message)
  });
  vm.runInContext(`let lastRound=2,lastResponseText='',lastResponseChange=Date.now(),lastResponseLog=0,lastWaitLog=0;\n${source.slice(parseStart, parseEnd)}\n${source.slice(start, end)}\ncheckAssistantResponse();`, context);
  return { actions, warnings };
}
test('response watcher processes new JSON even when the site reuses a message node/count', () => {
  const { actions } = responseWatcher({ text: 'json\n{ "action": "scroll", "direction": "down" }', baseline: ['old reply'] });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].action, 'scroll');
});
test('a newly appended reply can repeat the same scroll command without being deduplicated', () => {
  const text = '{"action":"scroll","direction":"down"}';
  assert.equal(responseWatcher({ text, baseline: [text], count: 2, baseCount: 1 }).actions.length, 1);
});
test('response watcher does not replay an unchanged old reply or execute an outgoing prompt', () => {
  const text = '{"action":"click","element":1}';
  assert.equal(responseWatcher({ text, baseline: [text] }).actions.length, 0);
  assert.equal(responseWatcher({ text: '【系统执行状态回执】' + text, baseline: [] }).actions.length, 0);
});

test('snapshot includes non-interactive KPI text and canvas limitations', () => {
  const parent = { nodeType: 1, closest: () => null, getBoundingClientRect: () => ({ width: 100, height: 30 }) };
  const texts = ['浏览量(PV)', '38', '访客数(UV)', '26'];
  let cursor = 0;
  const root = { scrollTop: 0, scrollHeight: 500, clientHeight: 500, clientWidth: 1000 };
  const content = {};
  const document = { title: '统计', documentElement: root, scrollingElement: root, body: content,
    querySelectorAll: selector => selector === 'canvas' ? [parent] : [],
    querySelector: selector => selector.startsWith('main,') ? content : null,
    createTreeWalker: () => ({ nextNode: () => cursor < texts.length ? { parentElement: parent, textContent: texts[cursor++] } : null })
  };
  const style = { display: 'block', visibility: 'visible', opacity: '1' };
  const context = vm.createContext({ document, window: { innerWidth: 1000, innerHeight: 800, getComputedStyle: () => style },
    getComputedStyle: () => style, Node: { ELEMENT_NODE: 1 }, NodeFilter: { SHOW_TEXT: 4 }, location: { href: 'https://example.com/stats' } });
  const result = vm.runInContext(read('dom-distiller.js'), context);
  assert.equal(result.totalCount, 0);
  assert.ok(result.snapshotText.includes('浏览量(PV)\n38'));
  assert.ok(result.snapshotText.includes('访客数(UV)\n26'));
  assert.ok(result.snapshotText.includes('canvas'));
  assert.equal(result.canvasCount, 1);
});
