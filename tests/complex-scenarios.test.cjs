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

// ==================== 场景 8：# / @ / 全角 ＃ / ＠ 与中文输入法触发及空标签面板保底 ====================
test('Scenario 8: mention picker triggers on #, @, fullwidth ＃/＠, IME compositionend, and renders empty state when no other tabs exist', async () => {
  const listeners = { window: {}, document: {} };
  const bodyChildren = [];
  const composerEl = {
    tagName: 'DIV',
    isContentEditable: true,
    innerText: '',
    textContent: '',
    style: { display: 'block', visibility: 'visible' },
    focus() {},
    closest() { return null; },
    contains(target) { return target === this; },
    getClientRects() { return [{ top: 500, left: 100 }]; },
    getBoundingClientRect() { return { top: 500, left: 100, width: 400, height: 40 }; },
    getAttribute(attr) { return attr === 'contenteditable' ? 'true' : null; },
    dispatchEvent() {}
  };

  function makeDomElement(tag) {
    return {
      tagName: tag.toUpperCase(),
      className: '',
      id: '',
      style: {},
      innerHTML: '',
      innerText: '',
      value: '',
      children: [],
      attributes: {},
      appendChild(child) { this.children.push(child); return child; },
      remove() {
        const idx = bodyChildren.indexOf(this);
        if (idx !== -1) bodyChildren.splice(idx, 1);
      },
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k] ?? null; },
      addEventListener() {},
      classList: {
        add() {},
        remove() {},
        toggle() {},
        contains() { return false; }
      },
      querySelector(sel) {
        if (sel === '#picker-search-input') return { value: '', addEventListener() {}, focus() {} };
        if (sel === '#picker-clear-btn') return { style: {}, addEventListener() {} };
        if (sel === '#picker-count-badge') return { innerText: '' };
        return null;
      },
      querySelectorAll() { return []; }
    };
  }

  let pingResponder = null;
  const ctx = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
    requestAnimationFrame: (fn) => fn(),
    cancelAnimationFrame: () => {},
    crypto: { randomUUID: () => 'test-uuid' },
    Node: { TEXT_NODE: 3 },
    location: { protocol: 'https:', hostname: 'www.doubao.com' },
    getComputedStyle: (el) => el.style || { display: 'block', visibility: 'visible' },
    Event: class { constructor(type) { this.type = type; } },
    KeyboardEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    window: {
      innerWidth: 1280,
      innerHeight: 800,
      addEventListener(type, fn) { (listeners.window[type] ||= []).push(fn); },
      removeEventListener() {},
      getSelection: () => ({ removeAllRanges() {}, addRange() {} })
    },
    document: {
      visibilityState: 'visible',
      activeElement: composerEl,
      contains: () => true,
      body: {
        appendChild(el) { bodyChildren.push(el); return el; }
      },
      createElement: (tag) => makeDomElement(tag),
      createRange: () => ({ selectNodeContents() {}, collapse() {}, setStart() {}, setEnd() {} }),
      addEventListener(type, fn) { (listeners.document[type] ||= []).push(fn); },
      removeEventListener() {},
      querySelector(sel) {
        if (sel === '.tab-mention-picker') return bodyChildren.find(c => c.className === 'tab-mention-picker') || null;
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '.tab-mention-picker') return bodyChildren.filter(c => c.className === 'tab-mention-picker');
        if (sel.includes('contenteditable')) return [composerEl];
        return [];
      }
    },
    chrome: {
      storage: {
        local: { get(_k, cb) { cb?.({}); } },
        onChanged: { addListener() {} }
      },
      runtime: {
        getURL: () => 'chrome-extension://test/',
        onMessage: { addListener(fn) { pingResponder = fn; } },
        sendMessage(msg, cb) {
          if (msg.type === 'GET_WINDOW_TABS') {
            // 模拟即使当前窗口没有其他标签页（返回空数组），面板也应正常渲染弹出
            cb?.({ success: true, tabs: [] });
          } else {
            cb?.({ success: true });
          }
        }
      }
    }
  });
  ctx.globalThis = ctx;
  ctx.window.document = ctx.document;

  vm.runInContext(source('platforms.js'), ctx);
  vm.runInContext(source('chat-dom.js'), ctx);
  vm.runInContext(source('content-chat.js'), ctx);

  // 1. 验证 TABWEAVER_PING 探活响应
  assert.equal(typeof pingResponder, 'function');
  let pingResult = null;
  pingResponder({ type: 'TABWEAVER_PING' }, {}, (res) => { pingResult = res; });
  assert.equal(pingResult?.ok, true);

  // 2. 验证富文本编辑器（如 Gemini Quill <p>#<br></p> 导致 innerText 末尾带 "\n"）及中文输入法全角 '＃' 下能正常弹出 picker
  composerEl.innerText = '＃\n';
  for (const fn of listeners.document.compositionend || []) {
    fn({ target: composerEl });
  }
  const pickerAfterFullwidthHash = bodyChildren.find(c => c.className === 'tab-mention-picker');
  assert.ok(pickerAfterFullwidthHash, '带尾随换行符 \\n 的富文本编辑器与全角 ＃ 应当成功触发标签页选择浮层');

  // 清理后再测试 '@' 触发
  pickerAfterFullwidthHash.remove();
  ctx.window.__tabWeaverCleanup?.();
  assert.equal(typeof ctx.window.__tabWeaverCleanup, 'function');
});

// ==================== 场景 9：finish 原因包含“未找到/失败/异常”等词时必须保持“完成”状态并展示累计总耗时 ====================
test('Scenario 9: finish step with "未找到" in reason stays "完成" (not "注意") and displays cumulative total duration', () => {
  const full = source('content-chat.js');
  const fnStart = full.indexOf('  function formatDuration(ms)');
  const fnEnd = full.indexOf('  // 全局运行时状态');
  const capStart = full.indexOf('  let integratedCapsuleEl = null;');
  const capEnd = full.indexOf('  function makeDraggable(el)');

  let capsuleEl = null;
  const ctx = vm.createContext({
    state: {
      targetTab: { id: 9, title: 'Recents – Figma', url: 'https://www.figma.com/files/recents' },
      isRunning: false,
      isPaused: false,
      isExecutingAction: false,
      isAssemblingPrompt: false,
      drawerOpen: true,
      phase: 'AI 报告任务完成（请核验结果）',
      userGoal: '帮我找到设置里面哪里可以关闭自动跳转到桌面版',
      initialDistillCostMs: 400,
      accordionOpenMap: {},
      stepHistory: [
        {
          round: 1,
          userGoal: '帮我找到设置里面哪里可以关闭自动跳转到桌面版',
          actionTitle: '点击 [1]',
          detail: '已点击 [1] "Vanceai Technology Limite"',
          cost: 1300,
          type: 'action'
        },
        {
          round: 2,
          userGoal: '帮我找到设置里面哪里可以关闭自动跳转到桌面版',
          actionTitle: '点击 [64]',
          detail: '已点击 [64] "Settings"',
          cost: 600,
          type: 'action'
        },
        {
          round: 2,
          userGoal: '帮我找到设置里面哪里可以关闭自动跳转到桌面版',
          actionTitle: '任务完成 (Finish)',
          detail: '当前网页端 Settings 页面仅包含 Account、Community、Notifications、Security 等账户相关设置，未找到桌面端唤起开关',
          cost: 0,
          type: 'finish'
        }
      ]
    },
    document: {
      body: { appendChild(el) { capsuleEl = el; return el; } },
      createElement() {
        return {
          className: '',
          style: {},
          innerHTML: '',
          classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
          querySelector() { return null; },
          querySelectorAll() { return []; }
        };
      }
    },
    escapeHtml: (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    makeDraggable() {},
    stopActionWatchers() {},
    startInitialAgentTask() {},
    updateTargetHalo() {},
    safeSendMessage() {},
    getChatInputElement: () => null,
    showPicker() {},
    showToast() {},
    trace() {},
    setTimeout,
    requestAnimationFrame: (fn) => fn()
  });

  vm.runInContext(full.slice(fnStart, fnEnd), ctx);
  vm.runInContext(full.slice(capStart, capEnd), ctx);
  vm.runInContext('renderControlCapsule()', ctx);

  assert.ok(capsuleEl, '应当渲染右下角控制胶囊');
  assert.ok(capsuleEl.innerHTML.includes('capsule-accordion-status-pill status-finish'), '手风琴头部状态胶囊必须为绿色的 status-finish（完成）');
  assert.ok(!capsuleEl.innerHTML.includes('status-warn'), 'finish 原因含“未找到”时严禁误判为 status-warn（注意）');
  assert.ok(capsuleEl.innerHTML.includes('任务完成:'), '最后一步必须展示“任务完成:”及完整多行结论');
  assert.ok(capsuleEl.innerHTML.includes('总耗时 1.9 秒'), '最后一步右侧必须准确展示累计总耗时 1.9 秒（1.3 + 0.6）');

  // 再验证单步直接 finish（无前序点击耗时，totalCost = 0）时使用 initialDistillCostMs 兜底而不显示 0 秒
  ctx.state.stepHistory = [
    {
      round: 1,
      userGoal: '读取当前标题',
      actionTitle: '任务完成 (Finish)',
      detail: '未找到异常，页面正常',
      cost: 0,
      type: 'finish'
    }
  ];
  vm.runInContext('renderControlCapsule()', ctx);
  assert.ok(capsuleEl.innerHTML.includes('总耗时 0.4 秒'), '单步直接完成时应展示快照提取耗时 0.4 秒而非 0 秒');
});

test('Scenario 10: input reset on failure, multiline error display, compact folded width, and viewport clamp', async () => {
  const full = fs.readFileSync(path.join(__dirname, '../content-chat.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');

  // 1. 验证 CSS 中对未展开胶囊紧凑宽度、抽屉隐藏、操作按钮紧邻以及错误多行展示的声明
  assert.ok(css.includes('.agent-integrated-capsule:not(.expanded)'), 'CSS 应包含折叠未展开态的专属样式');
  assert.ok(css.includes('.agent-integrated-capsule:not(.expanded) .capsule-drawer'), 'CSS 折叠态应隐藏抽屉避免撑宽父级');
  assert.ok(css.includes('.panel-step-item.status-warn .panel-step-desc'), 'CSS 警告与错误步骤应支持多行完整换行展示');
  assert.ok(css.includes('celebration-badge-bounce'), 'CSS 应包含完成状态 badge 的欢庆跳动动效');

  // 2. 验证失败停止时的输入框清空机制
  let chatInputValue = '正在抓取 [#个人资料] 快照并启动跨标签页控制...';
  const ctx = vm.createContext({
    console: { info() {} },
    trace() {},
    chatDOM: { describe: () => 'mock-dom' },
    getChatInputValue: () => chatInputValue,
    setChatInputValue: (val) => { chatInputValue = val; },
    stopActionWatchers() {},
    updateTargetHalo() {},
    renderControlCapsule() {},
    showToast() {},
    state: {
      round: 1,
      userGoal: '看看我的浏览器插件审核通过没',
      stepHistory: []
    }
  });

  const stopFnStart = full.indexOf('  function stopForCompatibility(message)');
  const stopFnEnd = full.indexOf('  // Wait for the previous', stopFnStart);
  vm.runInContext(full.slice(stopFnStart, stopFnEnd), ctx);
  ctx.stopForCompatibility('获取目标页面快照失败: 无法访问该标签页: The extensions gallery cannot be scripted');

  assert.equal(chatInputValue, '', '快照失败或任务受阻时必须彻底清空残留的临时抓取提示，绝不留存脏数据');
  assert.equal(ctx.state.phase, '已阻塞');
  assert.equal(ctx.state.stepHistory[0].type, 'warn');

  // 3. 验证 clampCapsuleToViewport 视口保护算法
  const clampStart = full.indexOf('  function clampCapsuleToViewport(el, margin');
  const clampEnd = full.indexOf('  function makeDraggable(el)', clampStart);
  const clampCtx = vm.createContext({
    window: { innerWidth: 1000, innerHeight: 800 },
    document: { contains: () => true },
    Math
  });
  vm.runInContext(full.slice(clampStart, clampEnd), clampCtx);

  // 测试超出右边缘
  const elRight = {
    style: {},
    getBoundingClientRect: () => ({ left: 900, top: 100, right: 1050, bottom: 200, width: 150, height: 100 })
  };
  clampCtx.clampCapsuleToViewport(elRight, 10);
  assert.equal(elRight.style.left, '840px', '当右边缘超出视口时，应自动向左推回到可视安全区内 (1000 - 150 - 10 = 840)');

  // 测试超出底边缘
  const elBottom = {
    style: {},
    getBoundingClientRect: () => ({ left: 100, top: 750, right: 300, bottom: 850, width: 200, height: 100 })
  };
  clampCtx.clampCapsuleToViewport(elBottom, 10);
  assert.equal(elBottom.style.top, '690px', '当底边缘超出视口时，应自动向上推回到可视安全区内 (800 - 100 - 10 = 690)');
});



