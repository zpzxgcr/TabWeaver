const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');

// Lightweight DOM doubles exercise the selection algorithm, not real website markup.
function element(options = {}) {
  return {
    disabled: false,
    style: { display: 'block', visibility: 'visible' },
    closest(selector) { return options.closest?.(selector) || null; },
    getClientRects() { return options.offscreen ? [] : [{}]; },
    getAttribute(name) { return options.attributes?.[name] ?? null; },
    contains(node) { return options.children?.includes(node) || false; },
    querySelectorAll(selector) { return options.queries?.[selector] || []; },
    ...options
  };
}
function setup(host = 'chatgpt.com', queries = {}) {
  const context = vm.createContext({
    location: { hostname: host },
    document: { querySelectorAll: selector => queries[selector] || [], addEventListener() {} },
    getComputedStyle: el => el.style,
    URL
  });
  vm.runInContext(source('platforms.js'), context);
  vm.runInContext(source('chat-dom.js'), context);
  return { context, registry: context.TabWeaverPlatforms, dom: context.TabWeaverChatDOM, queries };
}

test('registry hosts exactly match manifest injection rules; entry URLs are registered', () => {
  const { registry } = setup();
  const manifest = JSON.parse(source('manifest.json'));
  const hosts = registry.platforms.flatMap(p => Array.from(p.hosts));
  assert.equal(new Set(hosts).size, hosts.length, 'no ambiguous host ownership');
  const matches = manifest.content_scripts[0].matches;
  assert.deepEqual([...hosts].sort(), matches.map(m => new URL(m).hostname).sort());
  assert.equal(new Set(registry.platforms.map(p => p.id)).size, registry.platforms.length);
  for (const platform of registry.platforms) {
    assert.equal(registry.findByHostname(new URL(platform.url).hostname).id, platform.id);
    for (const kind of ['input', 'send', 'assistant', 'user', 'stop']) assert.ok(Array.isArray(platform[kind]));
  }
  assert.ok(registry.platforms.length >= 14);
});

test('host matching rejects substring spoofing and unknown domains', () => {
  const { registry } = setup();
  for (const host of ['claude.ai.evil.test', 'notchatgpt.com', 'x.com', 'example.com', 'evil.kimi.com']) {
    assert.equal(registry.findByHostname(host), null);
  }
  assert.equal(registry.findByHostname('CLAUDE.AI').id, 'claude');
});

test('manifest and popup load the registry before its consumers, and all local scripts exist', () => {
  const manifest = JSON.parse(source('manifest.json'));
  assert.deepEqual(manifest.content_scripts[0].js, ['platforms.js', 'chat-dom.js', 'content-chat.js']);
  const popup = source('popup.html');
  assert.ok(popup.indexOf('src="platforms.js"') < popup.indexOf('src="popup.js"'));
  for (const name of [...manifest.content_scripts[0].js, 'popup.js', manifest.background.service_worker]) {
    assert.ok(fs.existsSync(path.join(root, name)));
    assert.doesNotThrow(() => new vm.Script(source(name), { filename: name }));
  }
});

test('each configured platform uses its composer and assistant selectors', () => {
  for (const platform of setup().registry.platforms) {
    const input = element();
    const reply = element();
    const { dom } = setup(platform.hosts[0], { [platform.input[0]]: [input], [platform.assistant[0]]: [reply] });
    assert.equal(dom.getInput(), input, platform.id);
    assert.equal(dom.getMessages('assistant')[0], reply, platform.id);
  }
});

test('input discovery skips hidden controls and the extension picker', () => {
  const hidden = element({ style: { display: 'none' } });
  const picker = element({ closest: selector => selector.includes('.tab-mention-picker') ? {} : null });
  const input = element();
  const { dom } = setup('chatgpt.com', { '#prompt-textarea': [hidden, picker, input] });
  assert.equal(dom.getInput(), input);
});

test('unknown websites do not get a generic composer', () => {
  const { dom } = setup('example.com', { 'textarea[placeholder]': [element()] });
  assert.equal(dom.getInput(), null);
  assert.equal(dom.getMessages('assistant').length, 0);
});

test('send discovery prefers the composer form and rejects disabled controls', () => {
  const local = element();
  const global = element();
  const form = element({ queries: { 'button[type="submit"]': [local] } });
  const input = element({ closest: selector => selector === 'form' ? form : null });
  const { dom } = setup('chatgpt.com', { '#prompt-textarea': [input], 'button[data-testid="send-button"]': [global] });
  assert.equal(dom.getSendButton(), local);
  assert.equal(dom.isEnabled(local), true);
  local.disabled = true;
  assert.equal(dom.isEnabled(local), false);
  assert.equal(dom.isEnabled(element({ attributes: { 'aria-disabled': 'true' } })), false);
});

test('does not fall back to arbitrary SVG buttons or global submit buttons', () => {
  const { dom } = setup('deepseek.com', { 'button:has(svg)': [element()] });
  assert.equal(dom.getSendButton(), null);
  const known = setup('chat.deepseek.com', {
    'textarea#chat-input': [element()], 'button:has(svg)': [element()], 'button[type="submit"]': [element()]
  });
  assert.equal(known.dom.getSendButton(), null);
});

test('assistant discovery excludes user content and nested duplicate containers', () => {
  const user = element({ closest: selector => selector.includes('[data-message-author-role="user"]') ? {} : null });
  const child = element();
  const parent = element({ children: [child] });
  const { dom } = setup('chatgpt.com', { '[data-message-author-role="assistant"]': [user, parent, child] });
  const messages = dom.getMessages('assistant');
  assert.equal(messages.length, 1);
  assert.equal(messages[0], parent);
});

test('assistant selector families are not combined into unstable message counts', () => {
  const first = element();
  const { dom } = setup('gemini.google.com', {
    'model-response': [first], '.response-container': [element(), element()], '.model-response-text': [element()]
  });
  assert.equal(dom.getMessages('assistant').length, 1);
  assert.equal(dom.getMessages('assistant')[0], first);
});

test('hidden stop controls do not signal streaming', () => {
  const stop = element({ style: { display: 'none' } });
  const { dom } = setup('chatgpt.com', { 'button[data-testid="stop-button"]': [stop] });
  assert.equal(dom.isStreaming(), false);
  stop.style.display = 'block';
  assert.equal(dom.isStreaming(), true);
});

test('message text is read from a cleaned clone without mutating the live reply', () => {
  let cleaned = false;
  const reply = { cloneNode: () => ({
    querySelectorAll: () => [{ remove() { cleaned = true; } }],
    textContent: '  {"action":"finish"}  '
  }) };
  assert.equal(setup().dom.getMessageText(reply), '{"action":"finish"}');
  assert.equal(cleaned, true);
});

test('popup URL matching only reuses exact registered HTTPS platform hosts', () => {
  const { context } = setup();
  vm.runInContext(source('popup.js'), context);
  const classify = url => vm.runInContext(`platformForUrl(${JSON.stringify(url)})`, context);
  assert.equal(classify('https://claude.ai/chat/123').id, 'claude');
  assert.equal(classify('https://kimi.moonshot.cn/chat/123').id, 'kimi');
  for (const url of ['https://claude.ai.evil.test', 'https://evil.test/?q=claude.ai', 'http://claude.ai', 'chrome://extensions/', 'bad url']) {
    assert.equal(classify(url), null);
  }
});
