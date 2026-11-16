/** Popup: shared platform registry, bilingual search and safe existing-tab reuse. */
const I18N = {
  zh: {
    subtitle: '多平台 AI · 跨标签页自动化', statusLabel: '当前活动标签页', detectingTab: '正在检测当前页面…',
    unsupportedTab: '浏览器内置或受限页面（不可控制）', cannotDetect: '无法获取当前页面', aiHub: 'AI 对话平台',
    hubTitle: '打开 AI 控制中枢', searchPlaceholder: '搜索平台，如 Claude、豆包、Kimi', noResults: '没有匹配的平台',
    cn: '国内平台', global: '国际平台', count: '个平台入口',
    compatibility: '新增平台为实验性接入，尚未逐站登录实测；网页更新可能导致适配失效。',
    guideTitle: '快速上手', guideStep1: '先在同一窗口打开要操作的目标网页。',
    guideStep2: '打开并登录 AI 平台，在聊天输入框键入 # 或 @，选择目标标签页。',
    guideStep3: '输入具体任务并发送；可在控制胶囊中暂停或停止。',
    debugTitle: '开发日志', debugHint: '运行 node scripts/debug-collector.cjs 后自动写入项目 debug-logs/。接收器未启动时暂存最近 400 条。',
    debugContent: '同时记录正文、提示词和回复（可能包含隐私，仅排查时开启）', debugExport: '导出缓存（备用）', debugClear: '清空浏览器缓存', debugEvents: '条缓存事件',
    debugOff: '日志已关闭', debugConnected: '本地目录已连接', debugOffline: '接收器未连接，请启动本地脚本', debugPhase: '识别状态：',
    debugProbe: '测试日志落盘', debugProbeRunning: '正在验证写入…', debugProbeOk: '自检已落盘（非任务执行记录）', debugProbeFailed: '未确认落盘，请检查开发日志开关及接收器',
    toggleBtnText: 'English', openError: '操作失败，请重试。'
  },
  en: {
    subtitle: 'Multi-platform AI · Cross-tab automation', statusLabel: 'Active tab', detectingTab: 'Detecting current page…',
    unsupportedTab: 'Internal or restricted page (not controllable)', cannotDetect: 'Unable to access current page', aiHub: 'AI chat platform',
    hubTitle: 'Open AI control hub', searchPlaceholder: 'Search platforms, e.g. Claude, Doubao, Kimi', noResults: 'No matching platforms',
    cn: 'China', global: 'International', count: 'platform entries',
    compatibility: 'New integrations are experimental, without live signed-in testing. Website changes may break compatibility.',
    guideTitle: 'Quick start', guideStep1: 'Open a target webpage in this browser window.',
    guideStep2: 'Open and sign in to an AI platform. Type # or @ in its chat box and select the target tab.',
    guideStep3: 'Type your task and send. Pause or stop from the control capsule.',
    debugTitle: 'Developer logs', debugHint: 'Run node scripts/debug-collector.cjs to write automatically to debug-logs/. Keeps 400 cached events while the collector is offline.',
    debugContent: 'Include page text, prompts and replies (may contain private data; debugging only)', debugExport: 'Export cache (fallback)', debugClear: 'Clear browser cache', debugEvents: 'cached events',
    debugOff: 'Logging disabled', debugConnected: 'Local directory connected', debugOffline: 'Collector offline; start the local script', debugPhase: 'Detected state: ',
    debugProbe: 'Test disk logging', debugProbeRunning: 'Verifying write…', debugProbeOk: 'Probe written (not a task execution)', debugProbeFailed: 'Write unconfirmed; check logging and collector',
    toggleBtnText: '中文', openError: 'Operation failed. Please retry.'
  }
};

const registry = globalThis.TabWeaverPlatforms;
let currentLang = 'zh';
let activeTab = null;
let probeInProgress = false;

function detectBrowserLanguage() {
  const uiLang = typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage ? chrome.i18n.getUILanguage() : '';
  const navLang = navigator.language || navigator.userLanguage || '';
  const lang = (uiLang || navLang || 'zh').toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

function platformForUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? registry.findByHostname(parsed.hostname) : null;
  } catch { return null; }
}

function renderActiveTab() {
  const dict = I18N[currentLang];
  const label = document.getElementById('active-tab-label');
  const title = document.getElementById('active-tab-title');
  const platform = platformForUrl(activeTab?.url);
  
  if (label) {
    const platformName = platform ? (currentLang === 'zh' ? platform.nameZh || platform.name : platform.name) : '';
    const spanText = platform ? `${dict.aiHub} · ${platformName}` : dict.statusLabel;
    label.innerHTML = `<div class="status-dot"></div><span>${spanText}</span>`;
  }
  if (title) {
    title.textContent = !activeTab ? dict.cannotDetect
      : !/^https?:\/\//.test(activeTab.url || '') ? dict.unsupportedTab : activeTab.title || activeTab.url;
    title.title = activeTab?.url || '';
  }
}

function showError() {
  const el = document.getElementById('popup-error');
  if (el) {
    el.textContent = I18N[currentLang].openError;
    el.hidden = false;
  }
}

function openPlatform(platform) {
  chrome.tabs.query({ currentWindow: true }, tabs => {
    if (chrome.runtime.lastError) { showError(); return; }
    const existing = (tabs || []).find(tab => platformForUrl(tab.url)?.id === platform.id);
    const done = () => {
      if (chrome.runtime.lastError) showError();
      else window.close();
    };
    if (existing) chrome.tabs.update(existing.id, { active: true }, done);
    else chrome.tabs.create({ url: platform.url }, done);
  });
}

function renderPlatforms() {
  const dict = I18N[currentLang];
  const filter = (document.getElementById('platform-search')?.value || '').trim().toLowerCase();
  const platforms = registry.platforms.filter(p => `${p.name} ${p.nameZh || ''} ${p.id} ${p.hosts.join(' ')}`.toLowerCase().includes(filter));
  const groups = document.getElementById('platform-groups');
  if (!groups) return;
  groups.replaceChildren();

  const countEl = document.getElementById('platform-count');
  if (countEl) countEl.textContent = `${platforms.length} ${dict.count}`;
  const emptyEl = document.getElementById('empty-platforms');
  if (emptyEl) emptyEl.hidden = platforms.length > 0;

  for (const group of ['cn', 'global']) {
    const members = platforms.filter(p => p.group === group);
    if (!members.length) continue;
    const heading = document.createElement('h3');
    heading.className = 'group-title';
    heading.textContent = dict[group];
    const grid = document.createElement('div');
    grid.className = 'platforms';
    for (const platform of members) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'platform-btn';
      if (platformForUrl(activeTab?.url)?.id === platform.id) button.classList.add('current');
      button.title = platform.url;

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.setAttribute('aria-hidden', 'true');
      if (platform.iconSvg) {
        icon.innerHTML = platform.iconSvg;
      } else {
        icon.textContent = platform.icon || 'AI';
      }

      const name = document.createElement('span');
      name.className = 'name-text';
      name.textContent = currentLang === 'zh' ? platform.nameZh || platform.name : platform.name;

      button.append(icon, name);
      button.addEventListener('click', () => openPlatform(platform));
      grid.append(button);
    }
    groups.append(heading, grid);
  }
}

function applyLanguage(lang) {
  currentLang = lang === 'en' ? 'en' : 'zh';
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  const dict = I18N[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = dict[el.dataset.i18n] || ''; });
  const search = document.getElementById('platform-search');
  if (search) {
    search.placeholder = dict.searchPlaceholder;
    search.setAttribute('aria-label', dict.searchPlaceholder);
  }
  const toggleBtn = document.getElementById('lang-toggle-btn');
  if (toggleBtn) {
    toggleBtn.textContent = dict.toggleBtnText;
  }
  renderActiveTab();
  renderPlatforms();
  const errEl = document.getElementById('popup-error');
  if (errEl && !errEl.hidden) showError();
}

function debugRequest(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, response => {
      const error = chrome.runtime.lastError;
      if (error || !response?.success) reject(new Error(error?.message || response?.error || 'Diagnostics unavailable'));
      else resolve(response.data);
    });
  });
}

async function refreshDebugState() {
  const data = await debugRequest('DEBUG_STATE');
  const enabledEl = document.getElementById('debug-enabled');
  if (enabledEl) enabledEl.checked = data.enabled;
  const capture = document.getElementById('debug-content');
  if (capture) {
    capture.checked = data.captureContent;
    capture.disabled = !data.enabled;
  }
  const probeBtn = document.getElementById('debug-probe');
  if (probeBtn) probeBtn.disabled = !data.enabled || probeInProgress;
  const dict = I18N[currentLang];
  const statusEl = document.getElementById('debug-status');
  if (statusEl) {
    statusEl.textContent = !data.enabled ? dict.debugOff : data.sink?.connected ? dict.debugConnected : dict.debugOffline;
  }
  const pathEl = document.getElementById('debug-path');
  if (pathEl) {
    pathEl.textContent = data.enabled && data.sink?.connected ? data.sink.directory : `${data.count} ${dict.debugEvents}`;
  }
  const phaseEl = document.getElementById('debug-phase');
  if (phaseEl) {
    phaseEl.textContent = data.phase ? dict.debugPhase + data.phase.replace(/已阻塞：.*/, 'blocked / 已阻塞') : '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 语种优先遵循用户手动保存的偏好；若未手动保存，自动按浏览器设置的语言切换
  chrome.storage.local.get(['preferredLanguage'], res => {
    const saved = res?.preferredLanguage;
    const defaultLang = detectBrowserLanguage();
    applyLanguage(saved === 'zh' || saved === 'en' ? saved : defaultLang);
  });

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!chrome.runtime.lastError) activeTab = tabs?.[0] || null;
    renderActiveTab();
    renderPlatforms();
  });

  document.getElementById('lang-toggle-btn')?.addEventListener('click', () => {
    const nextLang = currentLang === 'zh' ? 'en' : 'zh';
    applyLanguage(nextLang);
    chrome.storage.local.set({ preferredLanguage: nextLang });
  });

  document.getElementById('platform-search')?.addEventListener('input', renderPlatforms);

  const configureDebug = async () => {
    try {
      await debugRequest('DEBUG_CONFIGURE', {
        enabled: document.getElementById('debug-enabled').checked,
        captureContent: document.getElementById('debug-content').checked
      });
      await refreshDebugState();
    } catch { showError(); }
  };

  document.getElementById('debug-enabled')?.addEventListener('change', configureDebug);
  document.getElementById('debug-content')?.addEventListener('change', configureDebug);
  document.getElementById('debug-clear')?.addEventListener('click', async () => {
    try { await debugRequest('DEBUG_CLEAR'); await refreshDebugState(); } catch { showError(); }
  });

  document.getElementById('debug-probe')?.addEventListener('click', async () => {
    probeInProgress = true;
    const probeBtn = document.getElementById('debug-probe');
    if (probeBtn) probeBtn.disabled = true;
    const status = document.getElementById('debug-probe-result');
    if (status) status.textContent = I18N[currentLang].debugProbeRunning;
    try {
      const result = await debugRequest('DEBUG_PROBE');
      if (status) {
        status.textContent = I18N[currentLang][result.delivered ? 'debugProbeOk' : 'debugProbeFailed'];
        status.title = result.probeId || '';
      }
    } catch {
      if (status) status.textContent = I18N[currentLang].debugProbeFailed;
    } finally {
      probeInProgress = false;
      refreshDebugState().catch(() => {});
    }
  });

  document.getElementById('debug-export')?.addEventListener('click', async () => {
    try {
      const data = await debugRequest('DEBUG_EXPORT');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `tabweaver-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { showError(); }
  });

  refreshDebugState().catch(showError);
  setInterval(() => refreshDebugState().catch(() => {}), 2000);
});
