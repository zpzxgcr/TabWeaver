/** Popup: shared platform registry, bilingual search and safe existing-tab reuse. */
const I18N = {
  zh: {
    subtitle: '多平台 AI · 跨标签页自动化', statusLabel: '当前活动标签页', detectingTab: '正在检测当前页面…',
    unsupportedTab: '浏览器内置或受限页面（不可控制）', cannotDetect: '无法获取当前页面', aiHub: 'AI 对话平台',
    hubTitle: '打开 AI 控制中枢', searchPlaceholder: '搜索平台，如 Claude、豆包、Kimi', noResults: '没有匹配的平台',
    cn: '国内平台', global: '国际平台',
    toggleBtnText: 'English', openError: '操作失败，请重试。',
    githubTitle: 'GitHub 源码与支持', feedbackLabel: '支持一下'
  },
  en: {
    subtitle: 'Multi-platform AI · Cross-tab automation', statusLabel: 'Active tab', detectingTab: 'Detecting current page…',
    unsupportedTab: 'Internal or restricted page (not controllable)', cannotDetect: 'Unable to access current page', aiHub: 'AI chat platform',
    hubTitle: 'Open AI control hub', searchPlaceholder: 'Search platforms, e.g. Claude, Doubao, Kimi', noResults: 'No matching platforms',
    cn: 'China', global: 'International',
    toggleBtnText: '中文', openError: 'Operation failed. Please retry.',
    githubTitle: 'GitHub Source & Support', feedbackLabel: 'Star on GitHub'
  }
};

const registry = globalThis.TabWeaverPlatforms;
let currentLang = 'zh';
let activeTab = null;

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
  const platforms = registry.platforms;
  const groups = document.getElementById('platform-groups');
  if (!groups) return;
  groups.replaceChildren();

  const grid = document.createElement('div');
  grid.className = 'platforms';

  for (const platform of platforms) {
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

  groups.append(grid);
}

function applyLanguage(lang) {
  currentLang = lang === 'en' ? 'en' : 'zh';
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  const dict = I18N[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = dict[el.dataset.i18n] || ''; });
  const toggleBtn = document.getElementById('lang-toggle-btn');
  if (toggleBtn) {
    toggleBtn.textContent = dict.toggleBtnText;
  }
  const githubBtn = document.getElementById('github-link');
  if (githubBtn) {
    githubBtn.title = dict.githubTitle;
    githubBtn.setAttribute('aria-label', dict.githubTitle);
  }
  renderActiveTab();
  renderPlatforms();
  const errEl = document.getElementById('popup-error');
  if (errEl && !errEl.hidden) showError();
}

function safeOpenUrl(url) {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
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

  document.getElementById('github-link')?.addEventListener('click', e => {
    e.preventDefault();
    safeOpenUrl('https://github.com/zpzxgcr/TabWeaver');
  });

  document.getElementById('feedback-link')?.addEventListener('click', e => {
    e.preventDefault();
    safeOpenUrl('https://github.com/zpzxgcr/TabWeaver');
  });
});
