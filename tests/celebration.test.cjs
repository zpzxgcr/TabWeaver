const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');

test('celebration popup has ignore attribute and styles in styles.css', () => {
  const css = source('styles.css');
  assert.ok(css.includes('.tabweaver-celebration-popup'), 'styles.css contains celebration popup');
  assert.ok(css.includes('.tabweaver-celebration-canvas'), 'styles.css contains celebration canvas');
  assert.ok(css.includes('.tabweaver-gift-wrap'), 'styles.css contains gift wrap');
  assert.ok(css.includes('twGiftLidPop'), 'styles.css contains animated gift lid');
  assert.ok(css.includes('twCelebrationPopIn'), 'styles.css contains popup animation');
});

test('content-chat.js triggers celebration popup and notifies target on finish', () => {
  const chatScript = source('content-chat.js');
  assert.ok(chatScript.includes('showCelebrationPopup'), 'content-chat.js defines showCelebrationPopup');
  assert.ok(chatScript.includes('SHOW_TARGET_CELEBRATION'), 'content-chat.js notifies target tab');
  assert.ok(chatScript.includes('data-tabweaver-ignore'), 'popup container sets data-tabweaver-ignore');
  assert.ok(chatScript.includes('launchCelebrationParticles'), 'particles engine is included');
});

test('background.js handles FOCUS_TAB and SHOW_TARGET_CELEBRATION', () => {
  const bgScript = source('background.js');
  assert.ok(bgScript.includes("case 'FOCUS_TAB':"), 'background handles FOCUS_TAB');
  assert.ok(bgScript.includes("case 'SHOW_TARGET_CELEBRATION':"), 'background handles SHOW_TARGET_CELEBRATION');
  assert.ok(bgScript.includes('showTargetCelebrationFunction'), 'background contains target celebration function');
});
