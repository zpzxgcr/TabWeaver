/**
 * background.js (企业级跨标签页调度与页面静止态内核)
 * 核心升级：
 * 1. 深度对齐官方 Playwright/AXTree 沉淀哲学：实现页面静止态等待（Quiescence Detector），
 *    彻底根除“点击后页面还在跳转/异步渲染，就提前抓取快照导致 AI 重复点击或找不到元素”的致命根因；
 * 2. 全局持久化受控会话（chrome.storage.session），生命周期绝对锁定，杜绝前端刷新/聚焦漂移导致的目标丢失；
 * 3. 实时追踪目标标签页 URL/Title 变动，并注入到回执上下文中，提供强事实闭环。
 */

// 内置诊断日志存储内核（原子自包含，彻底杜绝 MV3 Service Worker 休眠唤醒时 importScripts 的 NetworkError）
(() => {
  const KEY = 'tabweaverDiagnostics';
  const LIMIT = 400;
  const MAX_CHARS = 700000;
  let queue = Promise.resolve();
  let flushRunning = false;
  let flushRequested = false;
  let flushTimer;
  let sinkStatus = { connected: false, directory: '', pending: 0, lastError: '' };
  const eventId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  function scheduleFlush(delay = 150) {
    if (typeof fetch !== 'function' || typeof setTimeout !== 'function' || flushTimer) return;
    flushTimer = setTimeout(() => { flushTimer = null; void flushToDirectory(); }, delay);
  }
  async function flushToDirectory() {
    if (typeof fetch !== 'function') return;
    if (flushRunning) { flushRequested = true; return; }
    flushRunning = true;
    let more = false;
    try {
      const data = await snapshot();
      if (!data.enabled) return;
      const cursor = (await chrome.storage.local.get('tabweaverLogCursor')).tabweaverLogCursor;
      const index = data.events.findIndex(event => event.id === cursor);
      const pending = data.events.slice(index + 1);
      sinkStatus.pending = pending.length;
      if (!pending.length) {
        const health = await fetch('http://127.0.0.1:17321/health', { headers: { 'X-TabWeaver-Client': chrome.runtime.id }, signal: AbortSignal.timeout(2000) });
        if (!health.ok) throw new Error('Collector HTTP ' + health.status);
        const info = await health.json();
        if (!info.ok) throw new Error('Collector health check failed');
        sinkStatus = { ...sinkStatus, connected: true, directory: info.directory, lastError: '' };
        return;
      }
      const batch = [];
      let chars = 0;
      for (const event of pending) {
        const length = JSON.stringify(event).length;
        if (batch.length && (batch.length >= 20 || chars + length > 300000)) break;
        batch.push(event);
        chars += length;
      }
      const response = await fetch('http://127.0.0.1:17321/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TabWeaver-Client': chrome.runtime.id },
        body: JSON.stringify({ events: batch }), signal: AbortSignal.timeout(2000)
      });
      if (!response.ok) throw new Error('Collector HTTP ' + response.status);
      const result = await response.json();
      if (!result.ok) throw new Error('Collector did not acknowledge the write');
      await chrome.storage.local.set({ tabweaverLogCursor: batch[batch.length - 1].id });
      sinkStatus = { connected: true, directory: result.directory, pending: pending.length - batch.length, lastError: '', lastWrite: new Date().toISOString() };
      more = pending.length > batch.length || (await snapshot()).events.at(-1)?.id !== batch.at(-1).id;
    } catch (error) {
      sinkStatus = { ...sinkStatus, connected: false, lastError: error.message };
    } finally {
      flushRunning = false;
      if (more || flushRequested) { flushRequested = false; scheduleFlush(); }
    }
  }
  function getSinkStatus() { scheduleFlush(); return { ...sinkStatus }; }
  function serial(job) {
    const next = queue.then(job);
    queue = next.catch(() => {});
    return next;
  }
  function clean(value, depth = 0) {
    if (depth > 5) return '[depth limited]';
    if (typeof value === 'string') return value.replace(/(Bearer\s+)[\w.\-]+/gi, '$1[redacted]').slice(0, 12000);
    if (Array.isArray(value)) return value.slice(0, 40).map(v => clean(v, depth + 1));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).slice(0, 50).map(([k, v]) => [k, /password|cookie|authorization|token|secret/i.test(k) ? '[redacted]' : clean(v, depth + 1)]));
    }
    return value;
  }
  async function load() {
    const result = await chrome.storage.local.get(KEY);
    const data = result[KEY] || { enabled: false, captureContent: false, events: [] };
    if (data.events.some(event => !event.id)) {
      data.events.forEach(event => { if (!event.id) event.id = eventId(); });
      await chrome.storage.local.set({ [KEY]: data });
    }
    return data;
  }
  function record(event) {
    return serial(async () => {
      const data = await load();
      if (!data.enabled) return;
      const { content, ...metadata } = event;
      const entry = clean({ ...metadata, id: eventId(), time: new Date().toISOString() });
      if (data.captureContent && content !== undefined) entry.content = clean(content);
      data.events.push(entry);
      data.events = data.events.slice(-LIMIT);
      while (JSON.stringify(data.events).length > MAX_CHARS) data.events.shift();
      await chrome.storage.local.set({ [KEY]: data });
      scheduleFlush();
      return entry.id;
    });
  }
  async function probe() {
    if (!(await snapshot()).enabled) throw new Error('请先开启开发日志');
    const id = await record({ source: 'debug', event: 'diagnostics.probe', synthetic: true, purpose: 'Verify extension-to-disk delivery; not a browser task execution' });
    const deadline = Date.now() + 7000;
    while (Date.now() < deadline) {
      await flushToDirectory();
      const cursor = (await chrome.storage.local.get('tabweaverLogCursor')).tabweaverLogCursor;
      const data = await snapshot();
      const probeIndex = data.events.findIndex(event => event.id === id);
      const cursorIndex = data.events.findIndex(event => event.id === cursor);
      if (probeIndex >= 0 && cursorIndex >= probeIndex && sinkStatus.connected) {
        return { delivered: true, probeId: id, directory: sinkStatus.directory };
      }
      if (!sinkStatus.connected && !flushRunning) break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    return { delivered: false, probeId: id, directory: sinkStatus.directory, error: sinkStatus.lastError || '尚未收到磁盘写入确认' };
  }
  function configure(settings) {
    return serial(async () => {
      const data = await load();
      data.enabled = settings.enabled === true;
      data.captureContent = data.enabled && settings.captureContent === true;
      data.events.push({ id: eventId(), time: new Date().toISOString(), source: 'debug', event: 'settings.changed', enabled: data.enabled, captureContent: data.captureContent });
      data.events = data.events.slice(-LIMIT);
      await chrome.storage.local.set({ [KEY]: data });
      if (data.enabled) scheduleFlush();
      return { enabled: data.enabled, captureContent: data.captureContent, count: data.events.length };
    });
  }
  function snapshot() { return serial(load); }
  function clear() {
    return serial(async () => {
      const data = await load();
      data.events = [];
      await chrome.storage.local.set({ [KEY]: data, tabweaverLogCursor: null });
      sinkStatus.pending = 0;
    });
  }
  function safeUrl(url) {
    try { const parsed = new URL(url); return parsed.origin + parsed.pathname; } catch { return ''; }
  }
  globalThis.TabWeaverDebug = { record, configure, snapshot, clear, safeUrl, getSinkStatus, flushToDirectory, probe };
})();

const diagnostics = globalThis.TabWeaverDebug;

// 已注册的 AI 对话平台域名集合（用于扩展重载后对已打开的聊天标签页自动热恢复注入）
const SUPPORTED_CHAT_HOSTS = new Set([
  'chatgpt.com', 'chat.openai.com', 'gemini.google.com', 'chat.deepseek.com',
  'claude.ai', 'grok.com', 'www.doubao.com', 'doubao.com',
  'www.kimi.com', 'kimi.com', 'kimi.moonshot.cn',
  'www.qianwen.com', 'qianwen.com', 'tongyi.aliyun.com', 'tongyi.com', 'www.tongyi.com',
  'chat.qwen.ai', 'yuanbao.tencent.com', 'chatglm.cn', 'www.chatglm.cn', 'chat.z.ai',
  'yiyan.baidu.com', 'wenxiaoyan.com', 'www.wenxiaoyan.com',
  'xinghuo.xfyun.cn', 'www.perplexity.ai', 'perplexity.ai',
  'hailuoai.com', 'www.hailuoai.com'
]);

function ensureChatTabsInjected() {
  try {
    if (!chrome.tabs?.query || !chrome.scripting?.executeScript) return;
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime?.lastError || !Array.isArray(tabs)) return;
      for (const tab of tabs) {
        if (!tab?.id || !tab.url) continue;
        let host = '';
        try { host = new URL(tab.url).hostname.toLowerCase(); } catch { continue; }
        if (!SUPPORTED_CHAT_HOSTS.has(host)) continue;

        // 探活检测：若该聊天页尚未注入或因扩展重载导致旧上下文失效，则自动热注入最新脚本
        chrome.tabs.sendMessage(tab.id, { type: 'TABWEAVER_PING' }, (res) => {
          const needInject = Boolean(chrome.runtime?.lastError) || !res?.ok;
          if (!needInject) return;
          chrome.scripting.insertCSS?.({
            target: { tabId: tab.id },
            files: ['styles.css']
          })?.catch?.(() => {});
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['platforms.js', 'chat-dom.js', 'content-chat.js']
          })?.catch?.(() => {});
        });
      }
    });
  } catch {}
}

// 默认开启全链路日志可观测性，并自动对已打开的 AI 页面热恢复注入
diagnostics?.configure?.({ enabled: true, captureContent: true })?.catch?.(() => {});
ensureChatTabsInjected();
chrome.runtime?.onInstalled?.addListener(() => {
  diagnostics?.configure?.({ enabled: true, captureContent: true })?.catch?.(() => {});
  ensureChatTabsInjected();
});

function isNormalWebUrl(url) {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

// 目标标签页内的静止态探测脚本（等待网络与 DOM Mutation 稳定）
function pageQuiescenceFunction(maxWaitMs = 2200, quietPeriodMs = 350) {
  return new Promise((resolve) => {
    let quietTimer = null;
    let maxTimer = null;
    let observer = null;
    let finished = false;

    const cleanupAndDone = (reason) => {
      if (finished) return;
      finished = true;
      if (quietTimer) clearTimeout(quietTimer);
      if (maxTimer) clearTimeout(maxTimer);
      if (observer) observer.disconnect();
      resolve({ success: true, reason });
    };

    const resetQuietTimer = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        cleanupAndDone('dom_settled');
      }, quietPeriodMs);
    };

    try {
      observer = new MutationObserver(() => {
        resetQuietTimer();
      });

      const root = document.body || document.documentElement;
      if (root) {
        observer.observe(root, {
          childList: true,
          subtree: true,
          attributes: true
        });
      }
    } catch (e) {}

    // 初始启动静默倒计时
    resetQuietTimer();

    // 硬超时兜底
    maxTimer = setTimeout(() => {
      cleanupAndDone('timeout_reached');
    }, maxWaitMs);
  });
}

// 目标网页控制态光圈（网页四周蓝色渐变呼吸光效）
function setTabHaloFunction(enabled) {
  const HALO_ID = '__tabweaver_control_halo__';
  const existing = document.getElementById(HALO_ID);
  if (!enabled) {
    if (existing) {
      existing.style.opacity = '0';
      setTimeout(() => {
        try { existing.remove(); } catch (e) {}
      }, 400);
    }
    return;
  }
  if (existing) return;

  try {
    const halo = document.createElement('div');
    halo.id = HALO_ID;
    halo.setAttribute('data-tabweaver-ignore', 'true');
    halo.setAttribute('aria-hidden', 'true');

    halo.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      pointer-events: none !important;
      user-select: none !important;
      z-index: 2147483647 !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
      opacity: 0;
    `;

    const style = document.createElement('style');
    style.setAttribute('data-tabweaver-ignore', 'true');
    style.textContent = `
      @keyframes __tw_halo_breathing {
        0%, 100% {
          border: 2px solid rgba(56, 189, 248, 0.55);
          box-shadow: inset 0 0 25px rgba(14, 165, 233, 0.45),
                      inset 0 0 65px rgba(37, 99, 235, 0.3),
                      inset 0 0 110px rgba(2, 132, 199, 0.15);
          opacity: 0.65;
        }
        50% {
          border: 2.5px solid rgba(56, 189, 248, 0.95);
          box-shadow: inset 0 0 45px rgba(14, 165, 233, 0.8),
                      inset 0 0 95px rgba(37, 99, 235, 0.5),
                      inset 0 0 150px rgba(59, 130, 246, 0.25);
          opacity: 1;
        }
      }
      #__tabweaver_control_halo__ {
        animation: __tw_halo_breathing 2.2s ease-in-out infinite !important;
      }
    `;

    halo.appendChild(style);
    const targetParent = document.fullscreenElement || document.body || document.documentElement;
    if (targetParent) {
      targetParent.appendChild(halo);
      requestAnimationFrame(() => {
        halo.style.opacity = '1';
      });
    }
  } catch (e) {}
}

// 目标网页内的任务完成烟花礼品庆祝弹框
function showTargetCelebrationFunction(payload) {
  const POPUP_ID = '__tabweaver_celebration_popup__';
  const existing = document.getElementById(POPUP_ID);
  if (existing) {
    try { existing.remove(); } catch (e) {}
  }

  const { reason = '已成功达成预期目标', round = 1 } = payload || {};

  try {
    const container = document.createElement('div');
    container.id = POPUP_ID;
    container.setAttribute('data-tabweaver-ignore', 'true');
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = `
      position: fixed !important;
      right: 24px !important;
      bottom: 24px !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      user-select: none !important;
      pointer-events: auto !important;
      transition: opacity 0.25s ease, transform 0.25s ease !important;
      margin: 0 !important;
      padding: 0 !important;
    `;

    const style = document.createElement('style');
    style.setAttribute('data-tabweaver-ignore', 'true');
    style.textContent = `
      #__tabweaver_celebration_popup__ * { box-sizing: border-box !important; margin: 0; padding: 0; }
      #__tabweaver_celebration_popup__ .tw-card {
        position: relative !important;
        width: 330px !important;
        background: rgba(255, 255, 255, 0.96) !important;
        backdrop-filter: blur(18px) !important;
        -webkit-backdrop-filter: blur(18px) !important;
        border: 1px solid rgba(59, 130, 246, 0.4) !important;
        border-radius: 16px !important;
        padding: 16px 16px 14px !important;
        box-shadow: 0 16px 44px rgba(0, 0, 0, 0.18), 0 0 24px rgba(59, 130, 246, 0.22) !important;
        color: #0f172a !important;
        overflow: hidden !important;
        animation: __tw_pop_in 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
      }
      @media (prefers-color-scheme: dark) {
        #__tabweaver_celebration_popup__ .tw-card {
          background: rgba(24, 26, 32, 0.96) !important;
          color: #f8fafc !important;
        }
      }
      @keyframes __tw_pop_in {
        0% { opacity: 0; transform: translateY(24px) scale(0.92); }
        60% { transform: translateY(-4px) scale(1.02); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      #__tabweaver_celebration_popup__ .tw-canvas {
        position: absolute !important;
        top: -60px !important;
        left: -40px !important;
        width: 410px !important;
        height: 330px !important;
        pointer-events: none !important;
        z-index: 12 !important;
      }
      #__tabweaver_celebration_popup__ .tw-close-btn {
        position: absolute !important;
        top: 10px !important;
        right: 10px !important;
        width: 24px !important;
        height: 24px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(0,0,0,0.06) !important;
        border: 1px solid rgba(0,0,0,0.08) !important;
        border-radius: 50% !important;
        cursor: pointer !important;
        color: #64748b !important;
        z-index: 15 !important;
        transition: all 0.15s ease !important;
      }
      #__tabweaver_celebration_popup__ .tw-close-btn:hover {
        background: rgba(0,0,0,0.12) !important;
        color: #0f172a !important;
      }
      #__tabweaver_celebration_popup__ .tw-hero {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        margin-bottom: 10px !important;
      }
      #__tabweaver_celebration_popup__ .tw-gift-wrap {
        position: relative !important;
        width: 44px !important;
        height: 44px !important;
        flex-shrink: 0 !important;
      }
      #__tabweaver_celebration_popup__ .tw-gift-lid {
        transform-origin: 22px 14px !important;
        animation: __tw_lid_pop 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite !important;
      }
      @keyframes __tw_lid_pop {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        25% { transform: translateY(-4px) rotate(-8deg); }
        40% { transform: translateY(-2px) rotate(-4deg); }
        55% { transform: translateY(0) rotate(0deg); }
      }
      #__tabweaver_celebration_popup__ .tw-badge {
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        padding: 2.5px 8px !important;
        background: rgba(16, 185, 129, 0.12) !important;
        border: 1px solid rgba(16, 185, 129, 0.3) !important;
        border-radius: 12px !important;
        color: #10b981 !important;
        font-size: 11px !important;
        font-weight: 600 !important;
      }
      #__tabweaver_celebration_popup__ .tw-badge-dot {
        width: 6px !important;
        height: 6px !important;
        border-radius: 50% !important;
        background: #10b981 !important;
        box-shadow: 0 0 6px #10b981 !important;
      }
      #__tabweaver_celebration_popup__ .tw-title {
        font-size: 13.5px !important;
        font-weight: 700 !important;
        line-height: 1.35 !important;
        margin-bottom: 5px !important;
      }
      #__tabweaver_celebration_popup__ .tw-desc {
        font-size: 11.5px !important;
        line-height: 1.45 !important;
        opacity: 0.85 !important;
        background: rgba(0,0,0,0.04) !important;
        border-radius: 6px !important;
        padding: 6px 8px !important;
        margin-bottom: 8px !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        word-break: break-all !important;
      }
      #__tabweaver_celebration_popup__ .tw-meta {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        margin-bottom: 10px !important;
      }
      #__tabweaver_celebration_popup__ .tw-tag {
        font-size: 10.5px !important;
        font-weight: 500 !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
        background: rgba(37, 99, 235, 0.1) !important;
        color: #2563eb !important;
      }
      #__tabweaver_celebration_popup__ .tw-ok-btn {
        width: 100% !important;
        height: 28px !important;
        background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 6px !important;
        font-size: 11.5px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3) !important;
        transition: all 0.15s ease !important;
      }
      #__tabweaver_celebration_popup__ .tw-ok-btn:hover {
        background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
        transform: translateY(-1px) !important;
      }
      #__tabweaver_celebration_popup__ .tw-progress {
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 2.5px !important;
        background: rgba(59, 130, 246, 0.15) !important;
      }
      #__tabweaver_celebration_popup__ .tw-progress-bar {
        height: 100% !important;
        width: 100% !important;
        background: linear-gradient(90deg, #3b82f6, #10b981) !important;
        transform-origin: left !important;
        transition: transform 7.5s linear !important;
      }
    `;
    container.appendChild(style);

    // Canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'tw-canvas';
    canvas.width = 410;
    canvas.height = 330;
    container.appendChild(canvas);

    const safeReason = (reason || '已达成预期目标').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Card
    const card = document.createElement('div');
    card.className = 'tw-card';
    card.innerHTML = `
      <button class="tw-close-btn" aria-label="关闭">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div class="tw-hero">
        <div class="tw-gift-wrap">
          <svg viewBox="0 0 44 44" width="44" height="44">
            <defs>
              <linearGradient id="__tw_gbg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f59e0b"/>
                <stop offset="100%" stop-color="#d97706"/>
              </linearGradient>
              <linearGradient id="__tw_glid" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fbbf24"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
              <linearGradient id="__tw_grb" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ef4444"/>
                <stop offset="100%" stop-color="#dc2626"/>
              </linearGradient>
            </defs>
            <rect x="7" y="16" width="30" height="23" rx="3.5" fill="url(#__tw_gbg)"/>
            <rect x="19.5" y="16" width="5" height="23" fill="url(#__tw_grb)"/>
            <g class="tw-gift-lid">
              <rect x="4" y="10" width="36" height="7" rx="2.5" fill="url(#__tw_glid)"/>
              <rect x="19.5" y="10" width="5" height="7" fill="url(#__tw_grb)"/>
              <path d="M16 10 C12 5, 7 6, 9 8 C11 10, 19 10, 22 10 C25 10, 33 10, 35 8 C37 6, 32 5, 28 10 Z" fill="url(#__tw_grb)"/>
              <circle cx="22" cy="10" r="2.2" fill="#fef08a"/>
            </g>
          </svg>
        </div>
        <div class="tw-badge">
          <span class="tw-badge-dot"></span>
          任务完成 🎉
        </div>
      </div>
      <div class="tw-title">自动化任务已圆满完成！</div>
      <div class="tw-desc" title="${safeReason}">已达成目标：${safeReason}</div>
      <div class="tw-meta">
        <span class="tw-tag">执行 ${round} 轮</span>
        <span class="tw-tag" style="background:rgba(16,185,129,0.1);color:#10b981;">结果已达成</span>
      </div>
      <button class="tw-ok-btn">好的，知道了</button>
      <div class="tw-progress"><div class="tw-progress-bar"></div></div>
    `;
    container.appendChild(card);

    const targetParent = document.fullscreenElement || document.body || document.documentElement;
    if (targetParent) {
      targetParent.appendChild(container);
    }

    // 启动烟花粒子
    const ctx = canvas.getContext('2d');
    const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#eab308'];
    const particles = [];
    function addBurst(ox, oy, count, speedBase) {
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const speed = (Math.random() * 0.7 + 0.5) * speedBase;
        const type = Math.random() > 0.45 ? 'confetti' : (Math.random() > 0.5 ? 'star' : 'dot');
        particles.push({
          x: ox, y: oy,
          vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 2,
          vy: Math.sin(angle) * speed,
          gravity: 0.22, drag: 0.965,
          size: type === 'confetti' ? (Math.random() * 3 + 4) : (Math.random() * 2.5 + 2.5),
          sizeH: type === 'confetti' ? (Math.random() * 3 + 3) : 0,
          color: colors[Math.floor(Math.random() * colors.length)],
          type, rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 10,
          tiltAngle: Math.random() * Math.PI * 2,
          tiltSpeed: Math.random() * 0.12 + 0.05,
          alpha: 1, decay: Math.random() * 0.007 + 0.008
        });
      }
    }

    addBurst(205, 80, 50, 9);
    setTimeout(() => addBurst(110, 60, 25, 7), 450);
    setTimeout(() => addBurst(300, 60, 25, 7), 900);

    let animId = null;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
        p.vx *= p.drag; p.vy *= p.drag;
        p.tiltAngle += p.tiltSpeed;
        p.rotation += p.rotSpeed;
        p.alpha -= p.decay;
        if (p.alpha <= 0 || p.y > canvas.height + 20) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        if (p.type === 'confetti') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.sizeH / 2 + Math.sin(p.tiltAngle) * p.size, p.size, p.sizeH);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
        ctx.restore();
      }
      if (particles.length > 0) animId = requestAnimationFrame(render);
    }
    animId = requestAnimationFrame(render);

    const closePopup = () => {
      if (animId) cancelAnimationFrame(animId);
      container.style.opacity = '0';
      container.style.transform = 'translateY(16px) scale(0.95)';
      setTimeout(() => { try { container.remove(); } catch (e) {} }, 250);
    };

    card.querySelector('.tw-close-btn')?.addEventListener('click', closePopup);
    card.querySelector('.tw-ok-btn')?.addEventListener('click', closePopup);

    const pBar = card.querySelector('.tw-progress-bar');
    requestAnimationFrame(() => {
      if (pBar) pBar.style.transform = 'scaleX(0)';
    });

    setTimeout(closePopup, 7800);
  } catch (e) {}
}

// 监听标签页关闭事件，自动清理受控绑定
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session?.get(['controlledTab'], (res) => {
    if (res?.controlledTab?.id === tabId) {
      chrome.storage.session.remove('controlledTab');
    }
  });
});

// 监听标签页更新（如跳转、标题变化），实时同步
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  chrome.storage.session?.get(['controlledTab'], (res) => {
    if (res?.controlledTab?.id === tabId) {
      const updated = {
        ...res.controlledTab,
        title: tab.title || res.controlledTab.title,
        url: tab.url || res.controlledTab.url
      };
      chrome.storage.session.set({ controlledTab: updated });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, payload } = request || {};
  if (type?.startsWith('DEBUG_')) {
    // Only extension pages may inspect or configure logs. Content scripts may append events.
    const extensionPage = !sender.tab && sender.id === chrome.runtime.id;
    let operation;
    if (type === 'DEBUG_EVENT') {
      operation = diagnostics.record({ ...payload, source: 'chat', chatTabId: sender.tab?.id, page: diagnostics.safeUrl(sender.tab?.url) });
    } else if (!extensionPage) {
      sendResponse({ success: false, error: 'Only extension pages may access diagnostics' });
      return false;
    } else if (type === 'DEBUG_CONFIGURE') operation = diagnostics.configure(payload || {});
    else if (type === 'DEBUG_CLEAR') operation = diagnostics.clear();
    else if (type === 'DEBUG_PROBE') operation = diagnostics.probe().then(async result => {
      await diagnostics.record({ source: 'debug', event: 'diagnostics.probe.result', synthetic: true, ...result });
      return result;
    });
    else if (type === 'DEBUG_STATE') operation = diagnostics.snapshot().then(data => {
      const sink = diagnostics.getSinkStatus();
      return { enabled: data.enabled, captureContent: data.captureContent, count: data.events.length,
        phase: [...data.events].reverse().find(event => event.phase)?.phase || '',
        sink: { connected: sink.connected, directory: sink.directory, pending: sink.pending } };
    });
    else if (type === 'DEBUG_EXPORT') operation = diagnostics.snapshot().then(data => ({ ...data, version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString() }));
    else return false;
    operation.then(data => sendResponse({ success: true, data })).catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (type === 'DISTILL_TAB_DOM' || type === 'EXECUTE_ACTION') {
    const started = Date.now();
    const trace = { source: 'background', event: type, requestId: request.requestId, runId: request.runId, tabId: payload?.tabId };
    void diagnostics.record({ ...trace, stage: 'start', action: payload?.action?.action });
    const originalResponse = sendResponse;
    sendResponse = response => {
      void diagnostics.record({ ...trace, stage: 'end', durationMs: Date.now() - started, success: response?.success, error: response?.error,
        result: response?.result ? { success: response.result.success, scroll: response.result.scroll, needConfirm: response.result.needConfirm } : undefined, snapshot: response?.data ? { chars: response.data.snapshotText?.length, elements: response.data.totalCount, textChars: response.data.textChars, url: diagnostics.safeUrl(response.data.url) } : undefined,
        content: { snapshot: response?.data?.snapshotText, result: response?.result } });
      originalResponse(response);
    };
  }

  switch (type) {
    // 1. 获取可被控制的所有候选标签页（同窗口优先排列，自动兼容跨窗口网页）
    case 'GET_WINDOW_TABS': {
      const currentTabId = sender.tab?.id;
      const senderWindowId = sender.tab?.windowId;
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        const allNormal = (tabs || []).filter(t => t.id !== currentTabId && isNormalWebUrl(t.url));
        allNormal.sort((a, b) => {
          const aSame = a.windowId === senderWindowId ? 0 : 1;
          const bSame = b.windowId === senderWindowId ? 0 : 1;
          return aSame - bSame;
        });

        const candidateTabs = allNormal.map(t => ({
          id: t.id,
          title: t.title || '无标题标签页',
          url: t.url,
          favIconUrl: t.favIconUrl || ''
        }));

        sendResponse({ success: true, tabs: candidateTabs });
      });
      return true;
    }

    // 2. 同步与持久化受控标签页状态
    case 'SET_CONTROLLED_TAB': {
      const { tab } = payload || {};
      if (tab) {
        chrome.storage.session?.set({ controlledTab: tab }, () => {
          sendResponse({ success: true });
        });
      } else {
        chrome.storage.session?.remove('controlledTab', () => {
          sendResponse({ success: true });
        });
      }
      return true;
    }

    case 'GET_CONTROLLED_TAB': {
      chrome.storage.session?.get(['controlledTab'], (res) => {
        sendResponse({ success: true, tab: res?.controlledTab || null });
      });
      return true;
    }

    // 3. 毫秒级注入并执行 dom-distiller.js 提取精简快照（具备真正的页面沉淀等待）
    case 'DISTILL_TAB_DOM': {
      const targetTabId = payload?.tabId;
      const isPostAction = payload?.isPostAction === true; // 是否在动作执行之后触发的快照提取

      if (!targetTabId) {
        sendResponse({ success: false, error: '未指定目标标签页 ID' });
        return false;
      }

      // 等待标签页就绪（若在加载中等待 complete，若是动作后沉淀则同时等待 DOM 静止）
      const waitForPageReady = (done) => {
        chrome.tabs.get(targetTabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
            done();
            return;
          }

          const proceedToQuiescence = () => {
            if (!isPostAction) {
              done();
              return;
            }
            // 动作后执行静止态探测
            chrome.scripting.executeScript({
              target: { tabId: targetTabId },
              func: pageQuiescenceFunction,
              args: [2000, 300]
            }).then(() => {
              setTimeout(done, 150);
            }).catch(() => {
              done();
            });
          };

          if (tab.status === 'complete') {
            proceedToQuiescence();
            return;
          }

          // 页面处于 loading 状态，监听 complete
          let isDone = false;
          const onUpdatedListener = (tId, changeInfo) => {
            if (tId === targetTabId && changeInfo.status === 'complete') {
              if (!isDone) {
                isDone = true;
                chrome.tabs.onUpdated.removeListener(onUpdatedListener);
                proceedToQuiescence();
              }
            }
          };

          chrome.tabs.onUpdated.addListener(onUpdatedListener);
          setTimeout(() => {
            if (!isDone) {
              isDone = true;
              chrome.tabs.onUpdated.removeListener(onUpdatedListener);
              proceedToQuiescence();
            }
          }, 3500);
        });
      };

      const tryDistill = (retriesLeft = 2) => {
        chrome.scripting.executeScript({
          target: { tabId: targetTabId },
          files: ['dom-distiller.js']
        }).then(results => {
          const snapshot = results?.[0]?.result;
          if (!snapshot && retriesLeft > 0) {
            setTimeout(() => tryDistill(retriesLeft - 1), 500);
          } else if (!snapshot) {
            sendResponse({ success: false, error: '页面快照获取为空，可能页面正在跳转加载' });
          } else {
            chrome.scripting.executeScript({
              target: { tabId: targetTabId },
              func: setTabHaloFunction,
              args: [true]
            }).catch(() => {});
            sendResponse({ success: true, data: snapshot });
          }
        }).catch(err => {
          if (retriesLeft > 0) {
            setTimeout(() => tryDistill(retriesLeft - 1), 500);
          } else {
            sendResponse({ success: false, error: `无法访问该标签页: ${err.message}` });
          }
        });
      };

      waitForPageReady(() => {
        tryDistill();
      });
      return true;
    }

    // 4. 在目标标签页中下发执行具体动作
    case 'EXECUTE_ACTION': {
      const { tabId, action } = payload || {};
      if (!tabId || !action) {
        sendResponse({ success: false, error: '缺少执行目标参数' });
        return false;
      }

      chrome.scripting.executeScript({
        target: { tabId },
        files: ['action-executor.js']
      }).then(() => {
        return chrome.scripting.executeScript({
          target: { tabId },
          args: [action],
          func: (act) => {
            if (typeof window.__runBrowserAction === 'function') {
              return window.__runBrowserAction(act);
            }
            return { success: false, error: '执行引擎未就绪' };
          }
        });
      }).then(results => {
        const actionResult = results?.[0]?.result;
        sendResponse({ success: true, result: actionResult });
      }).catch(err => {
        sendResponse({ success: false, error: `执行指令失败: ${err.message}` });
      });
      return true;
    }

    // 5. 控制受控目标网页四周的蓝色呼吸渐变光圈
    case 'SET_TARGET_HALO': {
      const targetTabId = payload?.tabId;
      const enabled = payload?.enabled === true;
      if (!targetTabId) {
        sendResponse({ success: false, error: '未指定目标标签页 ID' });
        return false;
      }
      chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: setTabHaloFunction,
        args: [enabled]
      }).then(() => {
        sendResponse({ success: true });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    // 6. 激活并聚焦到指定受控标签页
    case 'FOCUS_TAB': {
      const targetTabId = payload?.tabId;
      if (!targetTabId) {
        sendResponse({ success: false, error: '未指定目标标签页 ID' });
        return false;
      }
      chrome.tabs.update(targetTabId, { active: true }, (tab) => {
        if (tab?.windowId) {
          chrome.windows.update(tab.windowId, { focused: true }, () => {});
        }
        sendResponse({ success: true });
      });
      return true;
    }

    // 7. 在受控目标网页中展示烟花礼品庆祝弹框
    case 'SHOW_TARGET_CELEBRATION': {
      const targetTabId = payload?.tabId;
      if (!targetTabId) {
        sendResponse({ success: false, error: '未指定目标标签页 ID' });
        return false;
      }
      chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: showTargetCelebrationFunction,
        args: [payload]
      }).then(() => {
        sendResponse({ success: true });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    default:
      return false;
  }
});
