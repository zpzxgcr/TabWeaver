const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');

// 构造用于执行 action-executor.js 的仿真 DOM 沙箱
function createActionContext({ elements = [], activeElement = null } = {}) {
  const listeners = {};
  const doc = {
    title: '复杂业务测试页',
    querySelector: (selector) => {
      const matchId = selector.match(/\[data-ext-elem-id="([^"]+)"\]/);
      if (matchId) {
        return elements.find(el => el.getAttribute('data-ext-elem-id') === matchId[1]) || null;
      }
      return null;
    },
    querySelectorAll: () => elements,
    activeElement: activeElement || null,
    body: { tagName: 'BODY' },
    scrollingElement: { scrollTop: 0, scrollHeight: 1000, clientHeight: 1000 },
    documentElement: { scrollTop: 0, scrollHeight: 1000, clientHeight: 1000 }
  };

  const win = {
    location: { href: 'https://example.com/booking' },
    history: { back() {}, forward() {} },
    innerHeight: 800,
    innerWidth: 1200
  };

  const context = vm.createContext({
    window: win,
    location: win.location,
    document: doc,
    innerHeight: 800,
    innerWidth: 1200,
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    HTMLSelectElement: class {},
    MouseEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.bubbles = !!init.bubbles;
        this.cancelable = !!init.cancelable;
        this.defaultPrevented = false;
      }
      preventDefault() { this.defaultPrevented = true; }
    },
    KeyboardEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.key = init.key;
        this.code = init.code;
        this.keyCode = init.keyCode;
      }
    },
    Event: class {
      constructor(type, init = {}) {
        this.type = type;
        this.bubbles = !!init.bubbles;
      }
    },
    setTimeout: (fn, ms) => { fn(); return 0; },
    getComputedStyle: () => ({ visibility: 'visible', overflowY: 'auto' })
  });

  const runner = vm.runInContext(source('action-executor.js'), context);

  return {
    context,
    run: (action) => runner(action)
  };
}

// 仿真 DOM 元素构造器
function mockElement(tag, attrs = {}, props = {}) {
  const events = [];
  return {
    tagName: tag.toUpperCase(),
    nodeType: 1,
    style: {},
    disabled: !!props.disabled,
    value: props.value || '',
    innerText: props.innerText || '',
    textContent: props.textContent || '',
    checked: !!props.checked,
    options: props.options || [],
    selectedOptions: props.selectedOptions || [],
    isContentEditable: !!props.isContentEditable,
    _valueTracker: props._valueTracker || null,
    getAttribute(name) { return attrs[name] ?? null; },
    setAttribute(name, val) { attrs[name] = String(val); },
    removeAttribute(name) { delete attrs[name]; },
    closest: () => null,
    focus() { props.focused = true; },
    scrollIntoView() {},
    click() {
      events.push('click');
      if (this.onclick) this.onclick();
    },
    dispatchEvent(ev) {
      events.push(ev.type);
      return !ev.defaultPrevented;
    },
    events
  };
}

// ==================== 场景 1：复杂表单多步骤级联与受控联动测试 ====================
test('Scenario 1: complex cascade form inputs, select option matching, and disabled guard', async () => {
  // 1. 出发地输入框 (React 受控输入框，带 _valueTracker)
  let trackerValue = '';
  const fromInput = mockElement('input', { 'data-ext-elem-id': '1', type: 'text', name: 'fromCity' }, {
    value: '',
    _valueTracker: {
      setValue(v) { trackerValue = v; }
    }
  });

  // 2. 舱位选择下拉框 (原生 select，选项包含代码和中文)
  const cabinSelect = mockElement('select', { 'data-ext-elem-id': '2', name: 'cabin' }, {
    options: [
      { value: 'Y', text: '经济舱 (Economy)' },
      { value: 'C', text: '公务舱 / 商务舱 (Business)' },
      { value: 'F', text: '头等舱 (First Class)' }
    ],
    selectedOptions: [{ value: 'Y', text: '经济舱 (Economy)' }]
  });

  // 3. 提交按钮 (初始处于禁用状态)
  const submitBtn = mockElement('button', { 'data-ext-elem-id': '3', type: 'submit' }, {
    disabled: true,
    innerText: '立即搜索航班'
  });

  const env = createActionContext({ elements: [fromInput, cabinSelect, submitBtn] });

  // 步骤 A: 使用 input 指令填入出发地
  const resInput = await env.run({ action: 'input', element: 1, value: '北京大兴' });
  assert.equal(resInput.success, true);
  assert.equal(fromInput.value, '北京大兴');
  assert.ok(fromInput.events.includes('input'));
  assert.ok(fromInput.events.includes('change'));

  // 步骤 B: 使用 select 指令按模糊中文选择“商务舱”
  const resSelect = await env.run({ action: 'select', element: 2, value: '商务舱' });
  assert.equal(resSelect.success, true);
  assert.equal(cabinSelect.selectedIndex, 1);
  assert.ok(cabinSelect.events.includes('change'));

  // 步骤 C: 尝试直接点击处于 disabled 状态的提交按钮 -> 触发友好拦截诊断，指导 AI 进行自我纠正
  const resClickDisabled = await env.run({ action: 'click', element: 3 });
  assert.equal(resClickDisabled.success, false);
  assert.ok(resClickDisabled.error.includes('禁用状态 (disabled)'));

  // 步骤 D: 模拟前置条件满足后解开 disabled，再次点击提交按钮
  submitBtn.disabled = false;
  const resClickActive = await env.run({ action: 'click', element: 3 });
  assert.equal(resClickActive.success, true);
  assert.ok(submitBtn.events.includes('click'));
});

// ==================== 场景 2：悬停展开二级菜单与等待加载 ====================
test('Scenario 2: hover menu triggering and explicit wait for async rendering', async () => {
  const menuNav = mockElement('div', { 'data-ext-elem-id': '10', role: 'button' }, {
    innerText: '电子产品分类'
  });

  const env = createActionContext({ elements: [menuNav] });

  // 步骤 A: hover 悬停在菜单导航栏上
  const resHover = await env.run({ action: 'hover', element: 10 });
  assert.equal(resHover.success, true);
  assert.ok(menuNav.events.includes('mouseover'));
  assert.ok(menuNav.events.includes('mouseenter'));

  // 步骤 B: 显式等待 300ms 模拟异步菜单 DOM 挂载
  const resWait = await env.run({ action: 'wait', ms: 300 });
  assert.equal(resWait.success, true);
  assert.ok(resWait.message.includes('300ms'));
});

// ==================== 场景 3：富文本编辑器输入与按键派发 ====================
test('Scenario 3: contenteditable rich editor typing and press Enter', async () => {
  const editor = mockElement('div', { 'data-ext-elem-id': '20' }, {
    isContentEditable: true,
    innerText: ''
  });

  const env = createActionContext({ elements: [editor] });

  const resType = await env.run({ action: 'type', element: 20, value: '这是自动化测试自动输入的富文本' });
  assert.equal(resType.success, true);
  assert.equal(editor.innerText, '这是自动化测试自动输入的富文本');
  assert.ok(editor.events.includes('input'));

  const resPress = await env.run({ action: 'press', element: 20, key: 'Enter' });
  assert.equal(resPress.success, true);
  assert.ok(editor.events.includes('keydown'));
  assert.ok(editor.events.includes('keyup'));
});

// ==================== 场景 4：复杂畸变 JSON 指令解析与自我纠错验证 ====================
test('Scenario 4: robust action parser self-heals corrupted, multi-block and markdown-wrapped outputs', () => {
  const chatSource = source('content-chat.js');
  const parseStart = chatSource.indexOf('  function parseActionFromText(text)');
  const parseEnd = chatSource.indexOf('  // 核心监控调度器', parseStart);

  const context = vm.createContext({});
  vm.runInContext(chatSource.slice(parseStart, parseEnd), context);
  const parse = context.parseActionFromText;

  // 1. 包含全角冒号、全角引号和中文逗号
  const fullWidthJson = `我建议执行这一步：\n{“action”： “click”， “element”： 8}`;
  const parsed1 = parse(fullWidthJson);
  assert.ok(parsed1);
  assert.equal(parsed1.action, 'click');
  assert.equal(parsed1.element, 8);

  // 2. 单引号键值与尾随逗号
  const singleQuoteJson = `\`\`\`json\n{'action': 'input', 'element': 3, 'value': '上海浦东',}\n\`\`\``;
  const parsed2 = parse(singleQuoteJson);
  assert.ok(parsed2);
  assert.equal(parsed2.action, 'input');
  assert.equal(parsed2.value, '上海浦东');

  // 3. 多代码块对比：前文包含伪指令反例，文末给出最终指令
  const multiBlockText = `
    请不要执行旧代码：
    \`\`\`json
    { "action": "wrong_old_action", "element": 99 }
    \`\`\`
    经过深思熟虑，正确的最终指令应当是：
    \`\`\`json
    { "action": "finish", "reason": "已成功筛选出所有直飞低价机票" }
    \`\`\`
  `;
  const parsed3 = parse(multiBlockText);
  assert.ok(parsed3);
  assert.equal(parsed3.action, 'finish');
  assert.equal(parsed3.reason, '已成功筛选出所有直飞低价机票');

  // 4. 包含 Markdown 列表和粗体包裹
  const boldMarkdown = `* 经过核实，执行下一步：\n**{"action": "scroll", "direction": "down"}**`;
  const parsed4 = parse(boldMarkdown);
  assert.ok(parsed4);
  assert.equal(parsed4.action, 'scroll');
  assert.equal(parsed4.direction, 'down');

  // 5. 用户真实遇险场景：代码块中仅有单独一个单词 finish（无任何 action 键或大括号）
  const bareFinishCodeBlock = "```json\nfinish\n```\n一、会晤信息\n11月19日中美元首会晤...";
  const parsed5 = parse(bareFinishCodeBlock);
  assert.ok(parsed5);
  assert.equal(parsed5.action, 'finish');

  // 6. 独立行 finish
  const bareLineFinish = "任务已达成。\nfinish\n结果如下...";
  const parsed6 = parse(bareLineFinish);
  assert.ok(parsed6);
  assert.equal(parsed6.action, 'finish');

  // 7. 变体 JSON：{ "finish": true }
  const finishObjJson = "```json\n{ \"finish\": true, \"reason\": \"已查到评论数\" }\n```";
  const parsed7 = parse(finishObjJson);
  assert.ok(parsed7);
  assert.equal(parsed7.action, 'finish');
  assert.equal(parsed7.reason, '已查到评论数');
});

// ==================== 场景 5：DOM 蒸馏器对弹窗浮层的最高优先级权重提升 ====================
test('Scenario 5: dom-distiller prioritizes open modal elements above static nav background', () => {
  const distillerSource = source('dom-distiller.js');

  const navButton = {
    nodeType: 1, tagName: 'BUTTON', innerText: '首页导航按钮', textContent: '首页导航按钮',
    getAttribute: () => null,
    getBoundingClientRect: () => ({ top: 10, bottom: 40, left: 10, right: 100, width: 90, height: 30 }),
    closest: () => null, parentElement: null, querySelector: () => null, querySelectorAll: () => [],
    removeAttribute() {}, setAttribute() {}
  };

  const modalDialog = {
    nodeType: 1, tagName: 'DIALOG',
    contains: (node) => node === modalConfirmBtn,
    closest: () => null
  };

  const modalConfirmBtn = {
    nodeType: 1, tagName: 'BUTTON', innerText: '弹窗确认提交', textContent: '弹窗确认提交',
    getAttribute: () => null,
    getBoundingClientRect: () => ({ top: 300, bottom: 340, left: 400, right: 520, width: 120, height: 40 }),
    closest: (sel) => sel.includes('dialog') ? modalDialog : null,
    parentElement: modalDialog, querySelector: () => null, querySelectorAll: () => [],
    removeAttribute() {}, setAttribute() {}
  };

  const doc = {
    title: '模态框测试页',
    body: { tagName: 'BODY' },
    activeElement: null,
    documentElement: { clientWidth: 1200, clientHeight: 800 },
    scrollingElement: { scrollTop: 0, scrollHeight: 800, clientHeight: 800 },
    querySelectorAll: (sel) => {
      if (sel.includes('dialog[open]')) return [modalDialog];
      if (sel.includes('button')) return [navButton, modalConfirmBtn];
      return [];
    },
    querySelector: (sel) => {
      if (sel.includes('dialog[open]')) return modalDialog;
      return null;
    },
    createTreeWalker: () => ({ nextNode: () => null })
  };

  const context = vm.createContext({
    document: doc,
    window: { innerWidth: 1200, innerHeight: 800, getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }) },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    location: { href: 'https://example.com/modal' },
    Node: { ELEMENT_NODE: 1 },
    NodeFilter: { SHOW_TEXT: 4 }
  });

  const result = vm.runInContext(distillerSource, context);
  assert.ok(result.snapshotText.includes('弹窗确认提交'));
  assert.ok(result.snapshotText.includes('首页导航按钮'));
  assert.equal(result.totalCount, 2);
});

// ==================== 场景 6：高危支付与删除操作拦截机制 ====================
test('Scenario 6: high-risk payment or destructive action triggers confirmation guard', async () => {
  const payBtn = mockElement('button', { 'data-ext-elem-id': '99', type: 'submit' }, {
    innerText: '立即支付 998 元'
  });

  const env = createActionContext({ elements: [payBtn] });

  // 默认情况下高危操作被拦截，返回 needConfirm
  const resGuard = await env.run({ action: 'click', element: 99 });
  assert.equal(resGuard.success, false);
  assert.equal(resGuard.needConfirm, true);
  assert.ok(resGuard.warning.includes('高危操作'));
  assert.equal(payBtn.events.length, 0, '拦截状态下绝不派发真实点击');

  // 若明确带有 skipConfirm 则允许放行
  const resBypass = await env.run({ action: 'click', element: 99, skipConfirm: true });
  assert.equal(resBypass.success, true);
  assert.ok(payBtn.events.includes('click'));
});

// ==================== 场景 7：内容提取动作 (extract) 与超长文本安全截断 ====================
test('Scenario 7: extract action retrieves text and bounds long content', async () => {
  const longArticle = mockElement('div', { 'data-ext-elem-id': '50' }, {
    innerText: '【新闻快讯】' + '重点内容：'.repeat(250)
  });

  const env = createActionContext({ elements: [longArticle] });

  const resExtract = await env.run({ action: 'extract', element: 50 });
  assert.equal(resExtract.success, true);
  assert.ok(resExtract.extractedText.startsWith('【新闻快讯】'));
  assert.ok(resExtract.extractedText.length <= 1000);
});

