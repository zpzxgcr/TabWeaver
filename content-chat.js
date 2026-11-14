/**
 * content-chat.js
 * 纯原生跨标签页 AI 控制器 (一体化极简 UI + 零 Emoji + 极速控制执行协议终极版)
 * 
 * 核心特性：
 * 1. 彻底根除“带空格标签删除断裂”顽疾：移除末尾空格关闭阻断，支持多词段模糊搜索，退格全程浮层稳固驻留；
 * 2. 右下角控制胶囊与步骤轨迹抽屉 100% 整合为同一体化组件，平滑展开，浑然一体；
 * 3. 彻底去除所有 Emoji 表情符，全界面采用现代极简、高级纯文字与扁平质感指示器；
 * 4. 样式全面支持纯白质感与系统深浅双主题无缝自适应；
 * 5. 100% 继承第一版极速闭环协议：AI 单步 JSON 指令 + 毫秒级抢跑执行 + 系统状态回执 + 持续自循环，确保真实返回最终答案；
 * 6. 全局键盘事件接管 + 列表事件委托（click/mousedown双重触发）+ 彻底销毁防反弹锁；
 * 7. 计数文案规范为「共 X 个标签页」；
 * 8. 聊天视窗技术 DOM 自动折叠为原生优雅的 details 组件，保持对话流清爽。
 */

(() => {
  const SAFE_DEFAULT_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='2' y1='12' x2='22' y2='12'/%3E%3Cpath d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'/%3E%3C/svg%3E";

  function getSafeFaviconUrl(url) {
    if (!url || typeof url !== 'string') return SAFE_DEFAULT_FAVICON;
    if (location.protocol === 'https:' && url.startsWith('http://')) {
      return SAFE_DEFAULT_FAVICON;
    }
    return url;
  }

  // 全局运行时状态
  const state = {
    targetTab: null,             // 当前绑定的受控目标标签页 { id, title, url }
    isRunning: false,            // 自动化自循环状态
    isPaused: false,             // 用户暂停开关
    round: 0,                    // 当前执行轮次
    lastHandledSignature: '',    // 最近一次执行过的动作指令签名（防止单步重复执行）
    pickerActive: false,         // 选择面板是否正在展示
    pickerDismissed: false,      // 用户主动按 Esc 或外部点击关闭标记（防反弹）
    dismissedText: '',           // 取消关闭时的输入框文本
    isSelectingTab: false,       // 选定中锁定状态（防止输入事件死循环重弹选择器）
    isAssemblingPrompt: false,   // 是否正在装配首轮 Prompt
    isInternalSending: false,    // 是否正在内部通过代码发送自动化 Prompt（防自拦截死锁）
    isExecutingAction: false,    // 是否正在执行动作
    baseAiNodeCount: 0,          // 发送本轮 Prompt 时已存在的 AI 消息节点基数
    currentRoundHandled: false,  // 当前轮次的指令是否已经执行
    stepHistory: [],             // 步骤历史记录 [{ round, actionTitle, detail, cost, time, type }]
    drawerOpen: false,           // 步骤抽屉是否展开
    statusNotice: '',            // 当前即时状态或反馈文案（集成在卡片内展示，彻底取代外部 Toast）
    statusNoticeType: 'info',    // 'info' | 'success' | 'warn'
    lastTypedQuery: '',          // 输入框实时记忆文本（保留完整空格）
    accordionOpenMap: {}         // 手风琴折叠展开状态字典 { [groupId]: boolean }
  };

  // 严格主动触发判定守卫：只有用户显式输入了 # 或 @，或者当前正在自动化执行中，才拦截接管；日常普通聊天 100% 放行
  function shouldActivateAgent(val) {
    if (!val || typeof val !== 'string' || isAgentInternalPrompt(val)) return false;
    if (state.isRunning) return true;
    return /[#@]/.test(val);
  }

  // 严格判断文本是否为扩展自身装配的内部系统级 Prompt（绝对放行原生提交，严禁自我拦截死锁）
  function isAgentInternalPrompt(text) {
    if (!text || typeof text !== 'string') return false;
    return text.includes('【极速控制执行协议') ||
           text.includes('【极速控制协议') ||
           text.includes('【系统执行状态回执】') ||
           text.includes('【用户任务目标】') ||
           text.includes('=== 目标网页上下文 ===') ||
           text.includes('正在抓取 [');
  }

  /* ==========================================================================
     0. 安全通信管道 (防御扩展刷新后 content script 上下文失效)
     ========================================================================== */

  function safeSendMessage(payload, callback) {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        showToast('扩展已重载，请按 Cmd+R (或 F5) 刷新当前网页后再试！', 'warn');
        removePicker();
        return false;
      }

      chrome.runtime.sendMessage(payload, (res) => {
        if (chrome.runtime?.lastError) {
          const errMsg = chrome.runtime.lastError.message || '';
          if (errMsg.includes('invalidated') || errMsg.includes('context')) {
            showToast('扩展上下文已失效，请刷新当前网页！', 'warn');
          }
          if (callback) callback(null);
          return;
        }
        if (callback) callback(res);
      });
      return true;
    } catch (err) {
      showToast('扩展已重载，请按 Cmd+R 刷新当前网页！', 'warn');
      removePicker();
      return false;
    }
  }

  /* ==========================================================================
     1. 卡片内嵌即时状态提示系统 (零外部弹窗，状态全部收拢至悬浮卡片)
     ========================================================================== */

  let noticeClearTimer = null;

  function showToast(message, type = 'info', duration = 3500) {
    if (!message) return;
    state.statusNotice = message;
    state.statusNoticeType = type;
renderControlCapsule();

    if (noticeClearTimer) clearTimeout(noticeClearTimer);
    if (duration > 0) {
      noticeClearTimer = setTimeout(() => {
        if (state.statusNotice === message) {
          state.statusNotice = '';
          state.statusNoticeType = 'info';
renderControlCapsule();
        }
      }, duration);
    }
  }

  /* ==========================================================================
     2. 多平台原生聊天网页 DOM 适配层
     ========================================================================== */

  function getPlatform() {
    const host = location.hostname;
    if (host.includes('gemini.google.com')) return 'gemini';
    if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) return 'chatgpt';
    if (host.includes('deepseek.com')) return 'deepseek';
    return 'unknown';
  }

  function getChatInputElement() {
    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.isContentEditable || active.getAttribute('contenteditable') === 'true')) {
      return active;
    }

    const platform = getPlatform();
    if (platform === 'gemini') {
      return document.querySelector('rich-textarea .ql-editor') ||
             document.querySelector('div[contenteditable="true"].ql-editor') ||
             document.querySelector('rich-textarea div[contenteditable="true"]') ||
             document.querySelector('.input-area div[contenteditable="true"]') ||
             document.querySelector('div[contenteditable="true"]') ||
             document.querySelector('textarea[aria-label]');
    }
    if (platform === 'chatgpt') {
      return document.querySelector('#prompt-textarea') || 
             document.querySelector('textarea[data-id="root"]') ||
             document.querySelector('div[contenteditable="true"]#prompt-textarea') ||
             document.querySelector('textarea');
    }
    if (platform === 'deepseek') {
      return document.querySelector('textarea#chat-input') ||
             document.querySelector('textarea.chat-input') ||
             document.querySelector('div.chat-input textarea') ||
             document.querySelector('textarea[placeholder*="输入"]') ||
             document.querySelector('div[contenteditable="true"]');
    }
    return document.querySelector('textarea, div[contenteditable="true"]');
  }

  function getSendButton() {
    const platform = getPlatform();
    if (platform === 'gemini') {
      return document.querySelector('button[aria-label="Submit"]') ||
             document.querySelector('button.send-button') ||
             document.querySelector('button[mattooltip*="Send"]') ||
             document.querySelector('button[aria-label*="发送"]') ||
             document.querySelector('button.send-button-container') ||
             document.querySelector('.send-button-container button');
    }
    if (platform === 'chatgpt') {
      return document.querySelector('button[data-testid="send-button"]') ||
             document.querySelector('button[aria-label="Send prompt"]') ||
             document.querySelector('button[data-testid="fruitjuice-send-button"]') ||
             document.querySelector('button:has(svg path[d*="M0 0h24v24H0z"])');
    }
    if (platform === 'deepseek') {
      return document.querySelector('button.chat-input-send-button') ||
             document.querySelector('button[type="submit"]') ||
             document.querySelector('div[role="button"][aria-label*="发送"]') ||
             document.querySelector('.ds-icon-button:has(svg)') ||
             document.querySelector('button:has(svg)');
    }
    return document.querySelector('button[type="submit"]');
  }

  // 获取输入框当前完整文本（保留末尾空格，绝不无脑 trim() 剥离空格！）
  function getChatInputValue() {
    const el = getChatInputElement();
    if (!el) return state.lastTypedQuery || '';

    let text = '';
    if (el.isContentEditable || el.tagName.toLowerCase() !== 'textarea') {
      text = el.innerText || el.textContent || '';
    } else {
      text = el.value || '';
    }

    if (text) {
      state.lastTypedQuery = text;
    }
    return text;
  }

  // 为输入框注入文本并派发原生变更事件
  function setChatInputValue(text) {
    const el = getChatInputElement();
    if (!el) return false;

    el.focus();

    if (el.isContentEditable || el.tagName.toLowerCase() !== 'textarea') {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);

        const ok = document.execCommand('insertText', false, text);
        if (!ok) {
          el.innerText = text;
          el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        }
      } catch (err) {
        el.innerText = text;
        el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }
    } else {
      const proto = HTMLTextAreaElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }

    state.lastTypedQuery = text;

    // 赋值后立刻强制把光标精准移至末尾
    if (text) {
      moveCursorToEnd(el);
      requestAnimationFrame(() => moveCursorToEnd(el));
      setTimeout(() => moveCursorToEnd(el), 25);
    }
    return true;
  }

  // 光标精准移动到输入框文本末尾
  function moveCursorToEnd(el) {
    if (!el) return;
    try {
      el.focus();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        const len = el.value.length;
        el.selectionStart = len;
        el.selectionEnd = len;
        return;
      }

      if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
        const selection = window.getSelection();
        const range = document.createRange();

        let lastNode = el;
        while (lastNode.lastChild) {
          lastNode = lastNode.lastChild;
        }

        if (lastNode && lastNode.nodeType === Node.TEXT_NODE) {
          range.setStart(lastNode, lastNode.length);
          range.setEnd(lastNode, lastNode.length);
        } else {
          range.selectNodeContents(el);
          range.collapse(false);
        }

        selection.removeAllRanges();
        selection.addRange(range);
        el.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      }
    } catch (e) {}
  }

  // 触发发送（携带内部自动化放行标记，100% 确保原生提交生效）
  function triggerSend() {
    state.isInternalSending = true;
    try {
      const btn = getSendButton();
      if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
        btn.click();
        return true;
      }
      const inputEl = getChatInputElement();
      if (inputEl) {
        inputEl.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true,
          composed: true
        }));
        return true;
      }
      return false;
    } finally {
      setTimeout(() => {
        state.isInternalSending = false;
      }, 500);
    }
  }

  // 获取当前所有的 AI 消息容器节点列表
  function getAllAiMessageNodes() {
    const platform = getPlatform();
    let replyNodes = [];
    if (platform === 'gemini') {
      replyNodes = Array.from(document.querySelectorAll('model-response, .response-container'));
      if (replyNodes.length === 0) {
        replyNodes = Array.from(document.querySelectorAll('.model-response-text'));
      }
    } else if (platform === 'chatgpt') {
      replyNodes = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
    } else if (platform === 'deepseek') {
      replyNodes = Array.from(document.querySelectorAll('.chat-message-assistant, .ds-message-assistant, .ds-markdown'));
    } else {
      replyNodes = Array.from(document.querySelectorAll('.assistant-message, .ai-message'));
    }
    return replyNodes;
  }

  // 获取最新的 AI 消息容器节点
  function getLatestAiMessageNode() {
    const nodes = getAllAiMessageNodes();
    return nodes.length > 0 ? nodes[nodes.length - 1] : null;
  }

  // 判断 AI 是否处于流式生成中（V1 经典精髓：停止按钮、打字游标检测）
  function isAiStreaming() {
    const platform = getPlatform();
    if (platform === 'chatgpt') {
      return !!document.querySelector('button[data-testid="stop-button"], button[aria-label="Stop streaming"], button[aria-label*="Stop"]');
    }
    if (platform === 'gemini') {
      return !!document.querySelector('.streaming-cursor, .cursor-indicator, button[aria-label="Stop response"], button[aria-label*="Stop"], button[aria-label*="停止"]');
    }
    if (platform === 'deepseek') {
      return !!document.querySelector('button[aria-label*="停止"], .chat-stop-button, button:has(.ds-icon-stop)');
    }
    return !!document.querySelector('button[aria-label*="Stop"], button[aria-label*="停止"], .is-streaming');
  }

  /* ==========================================================================
     3. 聊天界面繁杂技术上下文自动折叠 (极简纯文字，零 Emoji)
     ========================================================================== */

  function autoFoldVerboseChatMessages() {
    const allUserMessages = document.querySelectorAll(
      '[data-message-author-role="user"], .user-query, .chat-message-user, .user-message, message-content:not(.model-response-text)'
    );

    allUserMessages.forEach(msgNode => {
      if (msgNode.__agent_folded) return;

      const rawText = msgNode.innerText || '';
      if (rawText.includes('=== 目标网页上下文 ===') || rawText.includes('【极速控制执行协议') || rawText.includes('【极速控制协议】')) {
        msgNode.__agent_folded = true;

        const matchGoal = rawText.match(/【用户任务目标】:\s*([^\n\r]+)/);
        const userGoal = matchGoal ? matchGoal[1] : '';

        const matchReceipt = rawText.match(/【系统执行状态回执】:\s*([^\n\r]+)/);
        const receiptText = matchReceipt ? matchReceipt[1] : '';

        const foldedWrapper = document.createElement('div');
        foldedWrapper.className = 'agent-folded-container';

        let headerHtml = '';
        if (userGoal) {
          headerHtml += `<div style="font-weight:600; margin-bottom: 6px; font-size:13.5px; color:inherit;">【用户任务目标】: ${escapeHtml(userGoal)}</div>`;
        }
        if (receiptText) {
          headerHtml += `<div style="font-size:12.5px; color:#10b981; margin-bottom:6px; font-weight:500;">【系统执行状态回执】: ${escapeHtml(receiptText)}</div>`;
        }

        foldedWrapper.innerHTML = `
          ${headerHtml}
          <details class="agent-folded-details">
            <summary class="agent-folded-summary">【极速控制执行协议（已折叠）】</summary>
            <div class="agent-folded-content">${escapeHtml(rawText)}</div>
          </details>
        `;

        msgNode.innerHTML = '';
        msgNode.appendChild(foldedWrapper);
      }
    });
  }

  setInterval(autoFoldVerboseChatMessages, 700);

  /* ==========================================================================
     4. 智能 Mention 动态识别与多词段模糊搜索算法 (彻底解决带空格标题删除痛点)
     ========================================================================== */

  /**
   * 判断当前输入框是否正在编辑 # 标签，并提取出用于实时搜索的关键词 query
   * 核心革新：
   * 1. 彻底移除末尾空格返回 null 的逻辑，退格删除过程中绝不闪退关闭浮层；
   * 2. 当输入框已有选中的标签时，一旦用户退格删除了空格或字符，瞬间解绑并秒级弹出浮层；
   * 3. 只有当用户输入了标点换行进入普通聊天，或者彻底删除了 # 符号时才关闭。
   */
  function getActiveMentionQuery() {
    // 自动化控制运行中或正在组装系统 Prompt 时，绝对不触发任何面板或解绑操作
    if (state.isRunning || state.isAssemblingPrompt) return null;

    const fullText = getChatInputValue();
    if (!fullText) {
      state.pickerDismissed = false;
      state.dismissedText = '';
      return null;
    }

    if (isAgentInternalPrompt(fullText)) return null;

    // 若用户主动按了 Esc 或外部点击关闭：在输入框文本没有发生改变前，绝不重新弹窗反弹！
    if (state.pickerDismissed) {
      if (fullText === state.dismissedText) {
        return null;
      }
      state.pickerDismissed = false;
      state.dismissedText = '';
    }

    // 1. 检查已选 targetTab：当用户在标签后面输入任务需求时，必须稳固保留 targetTab，坚决不能误清空！
    if (state.targetTab && state.targetTab.title) {
      const title = state.targetTab.title;
      // 只要输入框里依然包含该标签标题（用户在其后打字输入任务需求），目标稳固生效，不弹选择窗
      if (fullText.includes(title)) {
        return null;
      }
    }

    // 2. 找到输入框中最后一个 # 或 @ 符号
    const lastHashIdx = Math.max(fullText.lastIndexOf('#'), fullText.lastIndexOf('@'));
    if (lastHashIdx === -1) return null;

    // # 符号必须在文本起始，或者前一个字符必须为空白字符/换行
    if (lastHashIdx > 0 && !/\s/.test(fullText[lastHashIdx - 1])) {
      return null;
    }

    // 提取从 # 之后的所有内容
    const queryAfterHash = fullText.slice(lastHashIdx + 1);

    // 若包含换行，或者中英文标点符号，说明已处于日常聊天句子中，不弹窗
    if (/[\r\n，。！？,.!?；;]/.test(queryAfterHash)) {
      return null;
    }

    // 标题长度保护（一般网页标题不超过 60 字符）
    if (queryAfterHash.length > 60) {
      return null;
    }

    // 关键：即使中间有空格或末尾有空格，也持续返回 query，浮层稳固驻留并实时筛选！
    return queryAfterHash;
  }

  // 多词段多关键词模糊过滤函数
  function filterTabsByQuery(tabs, query) {
    if (!query) return [...tabs];
    const raw = query.trim().toLowerCase();
    if (!raw) return [...tabs];

    // 按空格分词
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [...tabs];

    return tabs.filter(tab => {
      const title = (tab.title || '').toLowerCase();
      const url = (tab.url || '').toLowerCase();
      const combined = `${title} ${url}`;
      // 所有 token 都能在标题或网址中命中
      return tokens.every(tok => combined.includes(tok));
    });
  }

  /* ==========================================================================
     5. 标签页选择悬浮面板 (实时模糊搜索 + 一键清空 + 零 Emoji)
     ========================================================================== */

  let pickerEl = null;
  let activeIndex = 0;
  let cachedTabs = [];
  let filteredTabs = [];

  function removePicker() {
    document.querySelectorAll('.tab-mention-picker').forEach(el => el.remove());
    pickerEl = null;
    state.pickerActive = false;
  }

  function dismissPicker() {
    state.pickerDismissed = true;
    state.dismissedText = getChatInputValue();
    removePicker();
  }

  function syncPickerQuery(query) {
    if (!pickerEl) return;
    const searchInput = pickerEl.querySelector('#picker-search-input');
    const clearBtn = pickerEl.querySelector('#picker-clear-btn');
    if (!searchInput) return;

    // 关键保护：若用户正聚焦在悬浮框搜索框中亲自删除或输入，绝不从外部用旧内容反向覆盖！
    if (document.activeElement === searchInput) {
      return;
    }

    const trimmed = (query || '').trim();
    if (searchInput.value !== trimmed) {
      searchInput.value = trimmed;
      if (trimmed) {
        if (clearBtn) clearBtn.style.display = 'block';
        filteredTabs = filterTabsByQuery(cachedTabs, trimmed);
      } else {
        if (clearBtn) clearBtn.style.display = 'none';
        filteredTabs = [...cachedTabs];
      }
      activeIndex = 0;
      refreshPickerList();
    }
  }

  function showPicker(rect, initialQuery = '') {
    if (state.isSelectingTab || state.isRunning || state.isAssemblingPrompt) return;

    if (state.pickerActive && pickerEl) {
      syncPickerQuery(initialQuery);
      return;
    }

    removePicker();
    state.pickerActive = true;

    safeSendMessage({ type: 'GET_WINDOW_TABS' }, (res) => {
      if (!res?.success || !res.tabs || res.tabs.length === 0) {
        showToast('未检测到其他网页标签，请先在当前窗口打开目标网页！', 'warn');
        removePicker();
        return;
      }
      cachedTabs = res.tabs;
      filteredTabs = filterTabsByQuery(cachedTabs, initialQuery);
      activeIndex = 0;
      renderPicker(rect, initialQuery);
    });
  }

  let refreshPickerList = () => {};

  function renderPicker(inputRect, initialQuery = '') {
    pickerEl = document.createElement('div');
    pickerEl.className = 'tab-mention-picker';

    let top = 100;
    let left = 20;

    if (inputRect && inputRect.top > 0) {
      top = Math.max(10, inputRect.top - 360);
      left = Math.min(window.innerWidth - 420, Math.max(10, inputRect.left));
    } else {
      top = window.innerHeight - 400;
      left = (window.innerWidth - 400) / 2;
    }

    pickerEl.style.top = `${top}px`;
    pickerEl.style.left = `${left}px`;

    // 1. 顶部标题栏（规范文案：共 X 个标签页）
    const header = document.createElement('div');
    header.className = 'picker-header';
    header.innerHTML = `<span>选择受控目标标签页</span><span id="picker-count-badge">共 ${cachedTabs.length} 个标签页</span>`;
    pickerEl.appendChild(header);

    // 2. 实时模糊搜索栏与一键清空（纯 SVG 极简放大镜，零 Emoji）
    const searchContainer = document.createElement('div');
    searchContainer.className = 'picker-search-container';
    searchContainer.innerHTML = `
      <div class="picker-search-wrapper">
        <span class="picker-search-icon" style="display:flex;align-items:center;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </span>
        <input type="text" class="picker-search-input" id="picker-search-input" placeholder="输入关键词实时筛选网页标题或网址..." spellcheck="false" autocomplete="off" />
        <button type="button" class="picker-clear-btn" id="picker-clear-btn" style="display:none;" title="一键清空搜索词">清空</button>
      </div>
    `;
    pickerEl.appendChild(searchContainer);

    // 3. 候选列表容器
    const ul = document.createElement('ul');
    ul.className = 'picker-list';
    pickerEl.appendChild(ul);

    // 4. 底部快捷键指示
    const footer = document.createElement('div');
    footer.className = 'picker-footer';
    footer.innerHTML = `<span>↑↓ 切换</span><span>Enter 确认</span><span>Esc 关闭</span>`;
    pickerEl.appendChild(footer);

    document.body.appendChild(pickerEl);

    const searchInput = pickerEl.querySelector('#picker-search-input');
    const clearBtn = pickerEl.querySelector('#picker-clear-btn');
    const countBadge = pickerEl.querySelector('#picker-count-badge');

    refreshPickerList = function renderList() {
      ul.innerHTML = '';

      if (filteredTabs.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'picker-empty-tip';
        emptyDiv.innerHTML = `未找到匹配的网页标签<br><span style="font-size:11px; color:var(--agent-text-muted); margin-top:4px; display:inline-block;">可点击“清空”按钮查看全部标签页</span>`;
        ul.appendChild(emptyDiv);
        countBadge.innerText = `0 个匹配 (共 ${cachedTabs.length} 个标签页)`;
        return;
      }

      const query = (searchInput.value || '').trim();
      if (query) {
        countBadge.innerText = `共 ${filteredTabs.length} 个匹配 (共 ${cachedTabs.length} 个标签页)`;
      } else {
        countBadge.innerText = `共 ${cachedTabs.length} 个标签页`;
      }

      if (activeIndex >= filteredTabs.length) {
        activeIndex = 0;
      }

      filteredTabs.forEach((tab, idx) => {
        const li = document.createElement('li');
        li.className = `picker-item ${idx === activeIndex ? 'active' : ''}`;
        li.setAttribute('data-index', String(idx));
        const safeIcon = getSafeFaviconUrl(tab.favIconUrl);

        li.innerHTML = `
          <img class="picker-favicon" src="${safeIcon}" />
          <div class="picker-info">
            <div class="picker-title">${escapeHtml(tab.title)}</div>
            <div class="picker-url">${escapeHtml(tab.url)}</div>
          </div>
        `;
        ul.appendChild(li);
      });

      updateActiveItem();
    };

    const handleItemPick = (e) => {
      const item = e.target.closest('.picker-item');
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const idx = parseInt(item.getAttribute('data-index'), 10);
      if (!isNaN(idx) && filteredTabs[idx]) {
        selectTab(filteredTabs[idx]);
      }
    };

    ul.addEventListener('click', handleItemPick);
    ul.addEventListener('mousedown', handleItemPick);

    if (initialQuery) {
      searchInput.value = initialQuery.trim();
      clearBtn.style.display = searchInput.value ? 'block' : 'none';
      filteredTabs = filterTabsByQuery(cachedTabs, searchInput.value);
    }

    refreshPickerList();

    // 严禁自动聚焦到浮层内部的搜索框，必须确保焦点永远保留在主聊天输入框中！

    searchInput.addEventListener('keydown', (e) => {
      const isEsc = e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27;
      if (isEsc) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        dismissPicker();
        const inputEl = getChatInputElement();
        if (inputEl) inputEl.focus();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredTabs.length > 0) {
          activeIndex = (activeIndex + 1) % filteredTabs.length;
          updateActiveItem();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredTabs.length > 0) {
          activeIndex = (activeIndex - 1 + filteredTabs.length) % filteredTabs.length;
          updateActiveItem();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredTabs[activeIndex]) {
          selectTab(filteredTabs[activeIndex]);
        }
      }
    });

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      if (!query) {
        clearBtn.style.display = 'none';
        filteredTabs = [...cachedTabs];
      } else {
        clearBtn.style.display = 'block';
        filteredTabs = filterTabsByQuery(cachedTabs, query);
      }
      activeIndex = 0;
      refreshPickerList();
    });

    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      searchInput.value = '';
      clearBtn.style.display = 'none';
      filteredTabs = [...cachedTabs];
      activeIndex = 0;
      refreshPickerList();
      const inputEl = getChatInputElement();
      if (inputEl) {
        inputEl.focus();
        moveCursorToEnd(inputEl);
      }
    });
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function updateActiveItem() {
    if (!pickerEl) return;
    const items = pickerEl.querySelectorAll('.picker-item');
    items.forEach((item, idx) => {
      item.classList.toggle('active', idx === activeIndex);
      if (idx === activeIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function selectTab(tab) {
    if (!tab) return;

    state.isSelectingTab = true;
    removePicker();

    state.targetTab = tab;
    safeSendMessage({ type: 'SET_CONTROLLED_TAB', payload: { tab } });
    state.round = 0;
    state.stepHistory = [];

    const currentVal = getChatInputValue();
    let replaced = '';
    const lastHashIdx = Math.max(currentVal.lastIndexOf('#'), currentVal.lastIndexOf('@'));

    if (lastHashIdx !== -1) {
      const beforeHash = currentVal.slice(0, lastHashIdx);
      replaced = `${beforeHash}#${tab.title} `.trimStart();
    } else {
      replaced = `#${tab.title} `;
    }

    setChatInputValue(replaced);

    const inputEl = getChatInputElement();
    if (inputEl) {
      inputEl.focus();
      moveCursorToEnd(inputEl);
      requestAnimationFrame(() => moveCursorToEnd(inputEl));
    }

    showToast(`已选定受控标签页: "${tab.title}"`, 'success');
renderControlCapsule();

    setTimeout(() => {
      state.isSelectingTab = false;
    }, 600);
  }

  /* ==========================================================================
     6. 右下角一体化控制胶囊与展开抽屉 (融为一体，零外部弹窗，零 Emoji)
     ========================================================================== */

  let integratedCapsuleEl = null;

  function renderControlCapsule() {
    if (!integratedCapsuleEl) {
      integratedCapsuleEl = document.createElement('div');
      integratedCapsuleEl.className = 'agent-integrated-capsule';
      document.body.appendChild(integratedCapsuleEl);
      makeDraggable(integratedCapsuleEl);
    }

    // A. 未选定目标标签页且未在执行任务：彻底隐藏隐身，绝不打扰日常 AI 聊天页面
    if (!state.targetTab && !state.isRunning) {
      integratedCapsuleEl.style.display = 'none';
      return;
    }

    // B. 用户输入 # 选定目标标签页或任务正在执行：才优雅浮现展示
    integratedCapsuleEl.style.display = 'flex';
    integratedCapsuleEl.classList.toggle('expanded', state.drawerOpen);

    const isFinished = state.stepHistory.some(s => s.type === 'finish');
    const statusClass = state.isPaused ? 'paused' 
                      : state.isRunning ? (state.isExecutingAction ? 'executing' : 'running') 
                      : (isFinished ? 'finish' : 'stopped');
    const statusText = state.isPaused ? '已暂停' 
                     : state.isRunning ? (state.isExecutingAction ? '执行中' : '运行中') 
                     : (isFinished ? '已完成' : '待命');

    const getStepStatus = (item) => {
      const isWarnOrError = item.type === 'warn' || 
                            item.type === 'error' || 
                            /未登录|未找到|失败|异常|超时|报错|需确认/i.test(item.detail || '') ||
                            /未登录|失败|报错/i.test(item.actionTitle || '');
      if (isWarnOrError) {
        return { type: 'warn', label: '注意' };
      }
      const isFinish = item.type === 'finish' || 
                       item.actionTitle.includes('Finish') || 
                       item.actionTitle.includes('任务完成');
      if (isFinish) {
        return { type: 'finish', label: '完成' };
      }
      return { type: 'action', label: '操作' };
    };

    if (!state.accordionOpenMap) {
      state.accordionOpenMap = {};
    }

    // 将单步操作按照 Finish 节点归拢聚合为里程碑事件手风琴组
    const groups = [];
    let currentGroup = {
      id: 1,
      title: '',
      status: 'action',
      statusLabel: '操作',
      totalCost: 0,
      steps: []
    };

    state.stepHistory.forEach((item) => {
      const status = getStepStatus(item);
      currentGroup.steps.push({ ...item, status });
      currentGroup.totalCost += (item.cost || 0);

      const isFinish = status.type === 'finish';
      if (isFinish) {
        currentGroup.status = 'finish';
        currentGroup.statusLabel = '完成';
        currentGroup.title = item.detail || item.actionTitle || '任务已达成目标';
        groups.push(currentGroup);
        currentGroup = {
          id: groups.length + 1,
          title: '',
          status: 'action',
          statusLabel: '操作',
          totalCost: 0,
          steps: []
        };
      }
    });

    // 如果最后一段尚未 finish（处于进行中状态）
    if (currentGroup.steps.length > 0) {
      const last = currentGroup.steps[currentGroup.steps.length - 1];
      const hasWarn = currentGroup.steps.some(s => s.status.type === 'warn');
      currentGroup.status = hasWarn ? 'warn' : 'action';
      currentGroup.statusLabel = hasWarn ? '注意' : '执行中';
      currentGroup.title = last.actionTitle ? `${last.actionTitle}: ${last.detail}` : '正在执行操作...';
      groups.push(currentGroup);
    }

    let listHtml = '';
    if (groups.length === 0) {
      listHtml = '<div style="color:var(--agent-text-muted); font-size:11.5px; padding:16px; text-align:center;">任务执行后将在此记录每步耗时与反馈</div>';
    } else {
      listHtml = `
        <div class="capsule-accordion-group">
          ${groups.map((group, gIdx) => {
            // 最后一组默认展开，前面的完成事件默认折叠收拢；用户点击过的以用户偏好为准
            const isLast = (gIdx === groups.length - 1);
            const isOpen = state.accordionOpenMap[group.id] !== undefined 
              ? !!state.accordionOpenMap[group.id] 
              : isLast;

            const sublistHtml = group.steps.map(step => `
              <div class="panel-step-item status-${step.status.type}">
                <span class="panel-step-status-badge status-${step.status.type}">
                  <span class="panel-step-status-dot"></span>
                  ${step.status.label}
                </span>
                <div class="panel-step-desc">
                  <span class="panel-step-title">${escapeHtml(step.actionTitle)}</span>
                  <span style="color:var(--agent-text-muted); margin-left:6px;">${escapeHtml(step.detail)}</span>
                </div>
                <span class="panel-step-cost">${step.cost}ms</span>
              </div>
            `).join('');

            return `
              <div class="capsule-accordion-item ${isOpen ? 'open' : ''}" data-group-id="${group.id}">
                <div class="capsule-accordion-header">
                  <div class="capsule-accordion-summary">
                    <span class="capsule-event-badge">事件 ${group.id}</span>
                    <span class="capsule-accordion-title" title="${escapeHtml(group.title)}">
                      ${escapeHtml(group.title)}
                    </span>
                  </div>
                  <div class="capsule-accordion-meta">
                    <span class="capsule-accordion-count">${group.steps.length} 步</span>
                    <span class="capsule-accordion-cost">${group.totalCost}ms</span>
                    <span class="capsule-accordion-arrow">${isOpen ? '▴' : '▾'}</span>
                  </div>
                </div>
                <div class="capsule-accordion-body" style="${isOpen ? '' : 'display:none;'}">
                  <div class="capsule-accordion-sublist">
                    ${sublistHtml}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    integratedCapsuleEl.innerHTML = `
      <!-- 顶部：状态与控制合成一体的标题栏 -->
      <div class="capsule-main-bar" id="capsule-main-bar">
        <div class="capsule-status-dot ${statusClass}" title="${statusText}"></div>
        <div class="capsule-target-text" id="capsule-target-text" title="受控目标: ${escapeHtml(state.targetTab.title)}">#${escapeHtml(state.targetTab.title)}</div>
        <button class="capsule-steps-badge ${state.drawerOpen ? 'active' : ''}" id="capsule-steps-toggle" title="${state.drawerOpen ? '收起任务记录' : '展开任务记录'}">
          任务记录 (${state.stepHistory.length}) ${state.drawerOpen ? '▴' : '▾'}
        </button>
        <div class="capsule-divider"></div>
        <div class="capsule-actions">
          <button class="capsule-btn" id="capsule-toggle-pause">${state.isPaused ? '继续' : '暂停'}</button>
          <button class="capsule-btn danger" id="capsule-stop">换目标</button>
        </div>
      </div>
      <!-- 内嵌即时状态提示条 (零外部弹窗) -->
      ${state.statusNotice ? `
        <div class="capsule-notice-banner ${state.statusNoticeType}">
          <span class="capsule-notice-text">${escapeHtml(state.statusNotice)}</span>
        </div>
      ` : ''}
      <!-- 下方：展开的任务记录流水线 -->
      ${state.drawerOpen ? `
        <div class="capsule-drawer">
          <div class="capsule-drawer-list">
            ${listHtml}
          </div>
        </div>
      ` : ''}
    `;

    const toggleBtn = integratedCapsuleEl.querySelector('#capsule-steps-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.drawerOpen = !state.drawerOpen;
renderControlCapsule();
      });
    }

    const pauseBtn = integratedCapsuleEl.querySelector('#capsule-toggle-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.isPaused = !state.isPaused;
        showToast(state.isPaused ? '已暂停自动化' : '继续自动执行', 'info');
renderControlCapsule();
        if (!state.isPaused && state.isRunning) {
          startActionWatchers();
        }
      });
    }

    const stopBtn = integratedCapsuleEl.querySelector('#capsule-stop');
    if (stopBtn) {
      stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.isRunning = false;
        state.isPaused = false;
        state.targetTab = null;
        safeSendMessage({ type: 'SET_CONTROLLED_TAB', payload: { tab: null } });
        state.drawerOpen = false;
        state.pickerDismissed = false;
        state.dismissedText = '';
        stopActionWatchers();
        renderControlCapsule();
        const inputEl = getChatInputElement();
        showPicker(inputEl?.getBoundingClientRect());
      });
    }

    // 手风琴头部点击切换展开/折叠
    const accHeaders = integratedCapsuleEl.querySelectorAll('.capsule-accordion-header');
    accHeaders.forEach(hdr => {
      hdr.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemEl = hdr.closest('.capsule-accordion-item');
        if (!itemEl) return;
        const gId = itemEl.getAttribute('data-group-id');
        const isCurrentlyOpen = itemEl.classList.contains('open');
        state.accordionOpenMap[gId] = !isCurrentlyOpen;

        const bodyEl = itemEl.querySelector('.capsule-accordion-body');
        const arrowEl = itemEl.querySelector('.capsule-accordion-arrow');
        if (bodyEl && arrowEl) {
          if (isCurrentlyOpen) {
            itemEl.classList.remove('open');
            bodyEl.style.display = 'none';
            arrowEl.textContent = '▾';
          } else {
            itemEl.classList.add('open');
            bodyEl.style.display = 'block';
            arrowEl.textContent = '▴';
          }
        }
      });
    });

    if (state.drawerOpen) {
      const listEl = integratedCapsuleEl.querySelector('.capsule-drawer-list');
      if (listEl) {
        listEl.scrollTop = listEl.scrollHeight;
      }
    }
  }

  function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, origX, origY;

    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('.capsule-drawer-list')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.left = `${origX}px`;
      el.style.top = `${origY}px`;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = `${origX + dx}px`;
      el.style.top = `${origY + dy}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
      }
    });
  }

  /* ==========================================================================
     7. 第一版经典健壮调度引擎 (双轨驱动：闭合代码块极速响应 + 流式结束兜底 + 页面跳转稳定)
     ========================================================================== */

  let streamObserver = null;
  let pollingTicker = null;

  function stopActionWatchers() {
    if (streamObserver) {
      streamObserver.disconnect();
      streamObserver = null;
    }
    if (pollingTicker) {
      clearInterval(pollingTicker);
      pollingTicker = null;
    }
  }

  function startInitialAgentTask(userQuery) {
    if (!state.targetTab) return;

    let cleanQuery = userQuery;
    if (state.targetTab?.title) {
      cleanQuery = cleanQuery.split(`#${state.targetTab.title}`).join('').split(`@${state.targetTab.title}`).join('');
    }
    cleanQuery = cleanQuery.replace(/^[#@]\S*\s*/, '').trim();

    safeSendMessage({
      type: 'DISTILL_TAB_DOM',
      payload: { tabId: state.targetTab.id }
    }, (res) => {
      if (!res?.success || !res.data) {
        showToast('获取目标页面快照失败: ' + (res?.error || '页面可能已关闭'), 'warn');
        state.isAssemblingPrompt = false;
        return;
      }

      const snapshot = res.data;

      const promptTemplate = [
        `【用户任务目标】: ${cleanQuery || '请协助在当前网页进行操作。'}`,
        `\n【极速控制执行协议（极其重要）】:`,
        `为实现毫秒级快速响应，请在回答的【第 1 行】直接输出一个闭合的操作指令 \`\`\`json 块，不要输出任何寒暄或前缀文字！后续行再输出简短说明。`,
        `可选动作示例:`,
        `- 点击: \`\`\`json\n{ "action": "click", "element": 1 }\n\`\`\``,
        `- 输入填表并回车提交: \`\`\`json\n{ "action": "fill", "element": 2, "value": "输入内容", "pressEnter": true }\n\`\`\``,
        `- 发送键盘按键 (如回车 Enter): \`\`\`json\n{ "action": "press", "key": "Enter" }\n\`\`\``,
        `- 浏览器后退 (返回上一页): \`\`\`json\n{ "action": "back" }\n\`\`\``,
        `- 浏览器前进: \`\`\`json\n{ "action": "forward" }\n\`\`\``,
        `- 刷新页面: \`\`\`json\n{ "action": "reload" }\n\`\`\``,
        `- 跳转指定网址: \`\`\`json\n{ "action": "navigate", "url": "https://example.com" }\n\`\`\``,
        `- 滚动页面: \`\`\`json\n{ "action": "scroll", "direction": "down" }\n\`\`\``,
        `- 任务已完成: \`\`\`json\n{ "action": "finish", "reason": "已找到目标结果" }\n\`\`\``,
        `\n【防幻觉与事实闭环准则】:`,
        `1. 严禁在未看到页面实际结果时谎称完成！仅当在下方【可交互元素清单】中确凿看到满足任务的数据时，才可输出 finish。`,
        `2. 输出 finish 时，必须在 reason 中确凿引用页面上的真实数据作为依据，杜绝主观臆测。`,
        `\n${snapshot.snapshotText}`
      ].join('\n');

      setChatInputValue(promptTemplate);

      setTimeout(() => {
        state.isAssemblingPrompt = false;
        state.isRunning = true;
        state.isPaused = false;
        state.round = 1;
        state.drawerOpen = true; // 任务启动执行时主动展开任务记录抽屉
        state.baseAiNodeCount = getAllAiMessageNodes().length;
        state.currentRoundHandled = false;
renderControlCapsule();
        triggerSend();
        startActionWatchers();
      }, 100);
    });
  }

  // 尝试从文本中解析合法 action
  function parseActionFromText(text) {
    if (!text || typeof text !== 'string') return null;
    // 优先匹配 ```json { ... } ``` 闭合块
    const codeMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?"action"[\s\S]*?\})\s*```/i);
    if (codeMatch) {
      try {
        const obj = JSON.parse(codeMatch[1]);
        if (obj && obj.action) return obj;
      } catch (e) {}
    }
    // 其次匹配裸 JSON { "action": ... }
    const bareMatch = text.match(/\{[\s\r\n]*"action"[\s\S]*?\}/);
    if (bareMatch) {
      try {
        const obj = JSON.parse(bareMatch[0]);
        if (obj && obj.action) return obj;
      } catch (e) {}
    }
    return null;
  }

  // 核心监控调度器（双轨驱动：Observer 极速抢跑 + Ticker 流式结束兜底）
  function startActionWatchers() {
    stopActionWatchers();

    const checkAssistantResponse = () => {
      if (!state.isRunning || state.isPaused || state.isExecutingAction || state.currentRoundHandled) {
        return;
      }

      const allNodes = getAllAiMessageNodes();
      // 严格防御：只有产生比基准更多的 AI 节点时，才代表新的一轮回答开始！
      if (allNodes.length <= state.baseAiNodeCount) {
        return;
      }

      const latestNode = allNodes[allNodes.length - 1];
      if (!latestNode) return;

      const currentText = (latestNode.innerText || latestNode.textContent || '').trim();
      if (!currentText) return;

      const streaming = isAiStreaming();
      const action = parseActionFromText(currentText);

      // 轨道 A：流式过程中已检测到完整的闭合指令，毫秒级抢跑执行
      // 轨道 B：AI 流式已完全停止（!streaming），且检测到指令（或者 finish）
      if (action) {
        state.currentRoundHandled = true;
        triggerAction(action);
      } else if (!streaming) {
        // 如果流式已经完全停止，但未检测到 action，检查是否有自然语言结论
        if (currentText.length > 10 && !currentText.includes('【极速控制')) {
          state.currentRoundHandled = true;
          triggerAction({ action: 'finish', reason: 'AI 回复完成' });
        }
      }
    };

    // 轨道 1：MutationObserver 监听实时 DOM 变动
    streamObserver = new MutationObserver(() => {
      checkAssistantResponse();
    });

    streamObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // 轨道 2：高频轮询 Ticker（500ms），兜底 MutationObserver 漏事件或流式停止状态感知
    pollingTicker = setInterval(() => {
      checkAssistantResponse();
    }, 500);
  }

  function triggerAction(action) {
    state.isExecutingAction = true;
    state.drawerOpen = true; // 执行动作指令时主动展开任务记录
renderControlCapsule();

    const actName = (action.action || '').toLowerCase();
    if (actName === 'finish') {
      const finishReason = action.reason || '已达成目标';
      showToast('任务已完成！', 'success', 4000);

      state.stepHistory.push({
        round: state.round,
        actionTitle: '任务完成 (Finish)',
        detail: finishReason,
        cost: 0,
        time: new Date().toLocaleTimeString(),
        type: 'finish'
      });

      state.isRunning = false;
      state.isExecutingAction = false;
      stopActionWatchers();
renderControlCapsule();
      return;
    }

    if (!state.targetTab || !state.targetTab.id) {
      console.warn('[Native Agent] 未检测到有效受控标签页，无法执行动作');
      state.isExecutingAction = false;
renderControlCapsule();
      return;
    }

    const startTime = performance.now();

    safeSendMessage({
      type: 'EXECUTE_ACTION',
      payload: { tabId: state.targetTab.id, action }
    }, (res) => {
      const actionResult = res?.result;
      const costMs = Math.round(performance.now() - startTime);

      const stepDesc = actName === 'click' ? `点击 [${action.element}]`
                     : actName === 'fill' ? `输入 [${action.element}] "${action.value}"${action.pressEnter ? ' + 回车' : ''}`
                     : actName === 'press' ? `按键 [${action.key || 'Enter'}]`
                     : actName === 'back' ? `浏览器后退 (返回上一页)`
                     : actName === 'forward' ? `浏览器前进`
                     : actName === 'reload' ? `刷新页面`
                     : (actName === 'navigate' || actName === 'goto') ? `跳转至 "${action.url}"`
                     : actName === 'scroll' ? `滚动页面 (${action.direction})`
                     : `提取 [${action.element}]`;

      state.stepHistory.push({
        round: state.round,
        actionTitle: stepDesc,
        detail: actionResult?.message || actionResult?.error || '执行完成',
        cost: costMs,
        time: new Date().toLocaleTimeString(),
        type: actionResult?.success ? 'success' : 'warn'
      });

      state.round += 1;
      renderControlCapsule();

      const feedbackMsg = actionResult?.success 
        ? `动作 [${action.action}] 执行成功 (${costMs}ms): ${actionResult.message || ''}` 
        : `动作 [${action.action}] 执行失败: ${actionResult?.error || res?.error || '未知错误'}`;

      // 由 background.js 内部的 pageQuiescenceFunction 自动等待页面网络和 DOM Mutation 沉淀
      // 前端只需给予极轻微的调度缓冲（150ms），兼具毫秒级极速响应与全场景稳定性
      setTimeout(() => {
        if (!state.isRunning || state.isPaused) {
          state.isExecutingAction = false;
          return;
        }

        safeSendMessage({
          type: 'DISTILL_TAB_DOM',
          payload: { tabId: state.targetTab.id, isPostAction: true }
        }, (snapRes) => {
          if (!snapRes?.success || !snapRes.data) {
            state.isExecutingAction = false;
            return;
          }

          const isActionFailed = !actionResult?.success;
          const warningBlock = isActionFailed ? [
            `\n⚠️【动作执行异常警告】: 上一步动作未能找到指定编号的元素！可能页面已发生跳转、单页局部重绘，旧 DOM 元素已销毁。`,
            `⚠️【严禁伪造任务完成】: 严禁在发生错误或未确凿看到目标数据时输出 finish！请仔细阅读下方最新页面清单，根据新页面的实际元素重新规划动作。`
          ].join('\n') : '';

          const nextPrompt = [
            `【系统执行状态回执】: ${feedbackMsg}`,
            warningBlock,
            `\n【极速控制执行协议（极其重要）】:`,
            `请在回答的【第 1 行】直接输出下一步操作指令 \`\`\`json 块，不要输出任何寒暄或前缀文字！若已查到最终答案，请输出 finish 指令并在下方给出详细说明。`,
            `支持动作: click, fill, press, back(后退), forward(前进), reload(刷新), navigate(跳转网址), scroll, finish`,
            `\n【防幻觉与事实闭环准则】:`,
            `1. 严禁在未看到页面实际内容时假装完成！必须在下方【可交互元素清单】中确凿看到所需数据，才可输出 finish。`,
            `2. 输出 finish 时，必须在 reason 中确凿引用页面上的真实数据作为依据。`,
            `\n${snapRes.data.snapshotText}`
          ].join('\n');

          // 发送下一轮 Prompt 前，更新 AI 节点基准，重置本轮处理标志
          state.baseAiNodeCount = getAllAiMessageNodes().length;
          state.currentRoundHandled = false;

          setChatInputValue(nextPrompt);

          setTimeout(() => {
            triggerSend();
            state.isExecutingAction = false;
          }, 120);
        });
      }, 150);
    });
  }

  /* ==========================================================================
     8. 智能标签页推断与多通道拦截防御机制 (100% 杜绝漏网走普通 AI)
     ========================================================================== */

  function tryResolveTargetTabFromQuery(query, callback) {
    if (state.targetTab) {
      if (callback) callback(state.targetTab);
      return;
    }

    const match = (query || '').match(/[#@]([^\s]+)/);
    if (!match) {
      if (callback) callback(null);
      return;
    }

    const targetKeyword = match[1].trim().toLowerCase();
    safeSendMessage({ type: 'GET_WINDOW_TABS' }, (res) => {
      if (!res?.success || !res.tabs || res.tabs.length === 0) {
        if (callback) callback(null);
        return;
      }

      let matched = res.tabs.find(t => (t.title || '').toLowerCase().includes(targetKeyword) || (t.url || '').toLowerCase().includes(targetKeyword));
      if (!matched && res.tabs.length > 0) {
        matched = res.tabs[0];
      }

      if (matched) {
        state.targetTab = matched;
renderControlCapsule();
        showToast(`智能识别并绑定受控页: "${matched.title}"`, 'success');
        if (callback) callback(matched);
      } else {
        if (callback) callback(null);
      }
    });
  }

  function handleInterceptedSubmission(rawText) {
    const val = rawText || getChatInputValue() || state.lastTypedQuery || '';
    if (!val || isAgentInternalPrompt(val)) return false;

    if (state.targetTab) {
      state.isAssemblingPrompt = true;
      state.drawerOpen = true; // 拦截任务提交后卡片立刻主动展开
renderControlCapsule();
      setChatInputValue(`正在抓取 [#${state.targetTab.title}] 快照并启动跨标签页控制...`);
      startInitialAgentTask(val);
      return true;
    }

    if (/[#@]/.test(val)) {
      tryResolveTargetTabFromQuery(val, (resolvedTab) => {
        if (resolvedTab) {
          state.isAssemblingPrompt = true;
          state.drawerOpen = true; // 识别并绑定目标后卡片立刻主动展开
renderControlCapsule();
          setChatInputValue(`正在抓取 [#${resolvedTab.title}] 快照并启动跨标签页控制...`);
          startInitialAgentTask(val);
        }
      });
      return true;
    }

    return false;
  }

  /* ==========================================================================
     9. 全局键盘与输入事件总线 (顶层捕获接管，绝对可靠)
     ========================================================================== */

  window.addEventListener('keydown', (e) => {
    const isEsc = e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27;

    // A. 悬浮面板打开期间：接管方向键、回车确认、Esc
    if (state.pickerActive) {
      if (isEsc) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        dismissPicker();
        const inputEl = getChatInputElement();
        if (inputEl) inputEl.focus();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (filteredTabs.length > 0) {
          activeIndex = (activeIndex + 1) % filteredTabs.length;
          updateActiveItem();
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (filteredTabs.length > 0) {
          activeIndex = (activeIndex - 1 + filteredTabs.length) % filteredTabs.length;
          updateActiveItem();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (filteredTabs[activeIndex]) {
          selectTab(filteredTabs[activeIndex]);
        }
        return;
      }

      // 其他按键（Backspace、文字输入、空格等）完全放行，不抢焦点
      return;
    }

    // 额外防御：如果 DOM 上残留了 picker 元素但 state.pickerActive 已经是 false，清理残留
    if (!state.pickerActive && isEsc) {
      const stale = document.querySelector('.tab-mention-picker');
      if (stale) {
        stale.remove();
        pickerEl = null;
        return;
      }
    }

    // B. 退格加速唤醒（仅在非执行态生效，且不破坏当前已选目标）
    if (e.key === 'Backspace' && state.targetTab && !state.pickerActive && !state.isRunning && !state.isAssemblingPrompt) {
      const fullText = getChatInputValue();
      const completedPrefix = `#${state.targetTab.title} `;
      if (fullText === completedPrefix) {
        e.preventDefault();
        const trimmedTag = `#${state.targetTab.title}`;
        setChatInputValue(trimmedTag);
        state.pickerDismissed = false;
        state.dismissedText = '';
        renderControlCapsule();
        const inputEl = getChatInputElement();
        if (inputEl) {
          inputEl.focus();
          moveCursorToEnd(inputEl);
        }
        showPicker(inputEl?.getBoundingClientRect(), trimmedTag.slice(1));
        return;
      }
    }

    // C. 面板未打开状态：按 # 或 @ 唤出面板
    if ((e.key === '#' || e.key === '@' || (e.code === 'Digit3' && e.shiftKey)) && !state.pickerActive && !state.isSelectingTab) {
      state.pickerDismissed = false;
      state.dismissedText = '';
      const inputEl = getChatInputElement();
      setTimeout(() => {
        showPicker(inputEl?.getBoundingClientRect());
      }, 15);
    }

    // D. 核心拦截：按 Enter 回车发送
    if (e.key === 'Enter' && !e.shiftKey && !state.isAssemblingPrompt && !state.pickerActive && !state.isInternalSending) {
      const val = getChatInputValue();
      if (shouldActivateAgent(val)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleInterceptedSubmission(val);
      } else {
        // 用户进行日常普通提问，若存在残留的已结束会话状态，静默清理并隐藏胶囊，彻底放行原生 AI 对话
        if (state.targetTab && !state.isRunning) {
          state.targetTab = null;
          renderControlCapsule();
        }
      }
    }
  }, true);

  // 2. 实时输入与退格事件追踪（无死角响应）
  document.addEventListener('input', (e) => {
    // 关键放行：若 input 事件源是悬浮框自身的搜索框，完全交给 searchInput 自身处理，绝不反向覆写！
    if (pickerEl && (e.target === pickerEl || pickerEl.contains(e.target))) {
      return;
    }

    if (state.isSelectingTab || state.isRunning || state.isAssemblingPrompt) return;

    const mentionQuery = getActiveMentionQuery();

    if (mentionQuery !== null) {
      const inputEl = getChatInputElement();
      showPicker(inputEl?.getBoundingClientRect(), mentionQuery);
    } else {
      if (state.pickerActive) {
        const fullText = getChatInputValue();
        if (!fullText.includes('#') && !fullText.includes('@')) {
          removePicker();
        }
      }
    }
  }, true);

  // 3. 点击外部区域关闭浮层
  document.addEventListener('mousedown', (e) => {
    if (!state.pickerActive) return;
    const currentPicker = document.querySelector('.tab-mention-picker');
    if (!currentPicker) {
      state.pickerActive = false;
      return;
    }
    if (!currentPicker.contains(e.target) && (!integratedCapsuleEl || !integratedCapsuleEl.contains(e.target))) {
      dismissPicker();
    }
  }, true);

  // 4. 点击发送按钮拦截 (捕获阶段，最高优先级)
  document.addEventListener('click', (e) => {
    if (state.pickerActive || state.isAssemblingPrompt || state.isInternalSending) return;

    const clickedBtn = e.target.closest('button');
    const sendBtn = getSendButton();
    const isSendClick = (sendBtn && (e.target === sendBtn || sendBtn.contains(e.target))) ||
                        (clickedBtn && /send|submit|发送/i.test(clickedBtn.getAttribute('aria-label') || clickedBtn.className || ''));

    if (isSendClick) {
      const val = getChatInputValue();
      if (shouldActivateAgent(val)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleInterceptedSubmission(val);
      } else {
        if (state.targetTab && !state.isRunning) {
          state.targetTab = null;
          renderControlCapsule();
        }
      }
    }
  }, true);

  // 5. 自动点火兜底
  setInterval(() => {
    if (state.isRunning || state.isAssemblingPrompt || state.isInternalSending) return;

    const userNodes = document.querySelectorAll(
      '[data-message-author-role="user"], .user-query, .chat-message-user, .user-message, message-content:not(.model-response-text)'
    );

    if (userNodes.length > 0) {
      const lastUser = userNodes[userNodes.length - 1];
      const userText = (lastUser.innerText || '').trim();

      if (/[#@]/.test(userText) && !isAgentInternalPrompt(userText) && !lastUser.__agent_ignited) {
        lastUser.__agent_ignited = true;

        tryResolveTargetTabFromQuery(userText, (resolvedTab) => {
          if (resolvedTab) {
            startInitialAgentTask(userText);
          }
        });
      }
    }
  }, 500);

  // 6. 初始化时尝试从 background 恢复当前会话绑定的受控目标（生命周期物理锁定，防止宿主 SPA 重新加载丢失）
  safeSendMessage({ type: 'GET_CONTROLLED_TAB' }, (res) => {
    if (res?.success && res.tab) {
      state.targetTab = res.tab;
      renderControlCapsule();
    }
  });

  renderControlCapsule();
})();
