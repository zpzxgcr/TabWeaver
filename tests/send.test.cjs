const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'content-chat.js'), 'utf8');
const start = source.indexOf('  async function triggerSend(text)');
const end = source.indexOf('  async function sendAgentPrompt(text)', start);
async function submit({ accepted, missingButton = false, disabledButton = false, platform = 'deepseek' }) {
  let input = '';
  const errors = [];
  const events = [];
  let clicks = 0;
  let keyDowns = 0;
  const editor = { focus() {}, dispatchEvent(event) { if (event.type === 'keydown') { keyDowns++; if (accepted) input = ''; } } };
  const context = vm.createContext({
    Date, state: { round: 1, runId: 'test', isRunning: true },
    setTimeout(fn) { fn(); return 0; },
    setPhase() {}, trace(event) { events.push(event); },
    getAllAiMessageNodes: () => [], isAiStreaming: () => false,
    setChatInputValue(value) { input = value; return true; }, getChatInputValue: () => input,
    getSendButton: () => missingButton ? null : ({ disabled: disabledButton, click() { clicks++; if (accepted) input = ''; } }),
    getChatInputElement: () => editor,
    KeyboardEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    chatDOM: { profile: () => ({ id: platform }), getMessageText: () => '', getMessages: () => [], isEnabled: button => !!button && !button.disabled, describe: () => ({}) },
    stopForCompatibility(message) { errors.push(message); }
  });
  vm.runInContext(source.slice(start, end), context);
  const result = await vm.runInContext('triggerSend("test prompt")', context);
  return { result, errors, events, clicks, keyDowns };
}
test('sending verifies site acknowledgement after a single click', async () => {
  const result = await submit({ accepted: true });
  assert.equal(result.result, true);
  assert.equal(result.clicks, 1);
  assert.ok(result.events.includes('prompt.ack'));
});
test('original sites retain one Enter fallback when no send button is identified', async () => {
  for (const platform of ['deepseek', 'chatgpt', 'gemini']) {
    const result = await submit({ accepted: true, missingButton: true, platform });
    assert.equal(result.result, true, platform);
    assert.equal(result.clicks, 0);
    assert.equal(result.keyDowns, 1);
    assert.ok(result.events.includes('prompt.ack'));
  }
});
test('Enter fallback does not bypass a disabled button or unknown site configuration', async () => {
  for (const options of [{ disabledButton: true }, { missingButton: true, platform: 'unknown' }]) {
    const result = await submit({ accepted: true, ...options });
    assert.equal(result.result, false);
    assert.equal(result.keyDowns, 0);
  }
});
test('an unacknowledged Enter is not automatically retried', async () => {
  const result = await submit({ accepted: false, missingButton: true });
  assert.equal(result.result, false);
  assert.equal(result.keyDowns, 1);
});
test('an unacknowledged send blocks visibly without retrying the click', async () => {
  const result = await submit({ accepted: false });
  assert.equal(result.result, false);
  assert.equal(result.clicks, 1);
  assert.ok(result.errors[0].includes('未检测到网站接收消息'));
});
