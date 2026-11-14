/**
 * popup.js - TabWeaver Control Popup
 * 包含中英双语自适应与持久化切换、当前活动标签状态探测及一键跳转
 */

const I18N = {
  zh: {
    subtitle: '极速跨标签页自动化已就绪',
    statusLabel: '当前活动标签页 (候选控制目标)',
    detectingTab: '正在检测当前页面...',
    unsupportedTab: '浏览器内置页面 (不可控制)',
    cannotDetect: '无法获取当前页面',
    hubTitle: '打开 AI 控制中枢网页',
    guideTitle: '💡 快速上手使用指引：',
    guideStep1: '打开任意你想操作的目标网页；',
    guideStep2: '在 AI 网页对话输入框中键入 <code>#</code>；',
    guideStep3: '在弹出的浮层中选择目标标签页，回车即可极速自动化！',
    toggleBtnText: 'English'
  },
  en: {
    subtitle: 'High-speed cross-tab automation ready',
    statusLabel: 'Active Tab (Candidate Target)',
    detectingTab: 'Detecting current page...',
    unsupportedTab: 'Internal browser page (restricted)',
    cannotDetect: 'Unable to access current page',
    hubTitle: 'Open AI Control Hub',
    guideTitle: '💡 Quick Start Guide:',
    guideStep1: 'Open any target web page you want to operate;',
    guideStep2: 'Type <code>#</code> in the AI chat prompt box;',
    guideStep3: 'Pick the target tab from the popup, and hit Enter to automate!',
    toggleBtnText: '中文'
  }
};

let currentLang = 'en';

function detectDefaultLang() {
  const browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  return browserLang.startsWith('zh') ? 'zh' : 'en';
}

function applyLanguage(lang) {
  currentLang = lang;
  const dict = I18N[lang] || I18N.en;

  // 更新所有带有 data-i18n 的元素
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  // 更新语言切换按钮文本
  const toggleBtn = document.getElementById('lang-toggle-btn');
  if (toggleBtn) {
    toggleBtn.textContent = dict.toggleBtnText;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const activeTitleEl = document.getElementById('active-tab-title');
  const toggleBtn = document.getElementById('lang-toggle-btn');

  // 1. 初始化语言：先读取本地存储，未设置则遵循浏览器系统语言
  chrome.storage.local.get(['preferredLanguage'], (res) => {
    const initialLang = res?.preferredLanguage || detectDefaultLang();
    applyLanguage(initialLang);

    // 2. 获取当前活动标签页状态
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      const dict = I18N[currentLang];
      if (!tab) {
        activeTitleEl.textContent = dict.cannotDetect;
        return;
      }

      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        activeTitleEl.innerHTML = `<span style="color:#ef4444;">${dict.unsupportedTab}</span>`;
      } else {
        activeTitleEl.textContent = tab.title || tab.url;
        activeTitleEl.title = `${tab.title}\n${tab.url}`;
      }
    });
  });

  // 3. 语言切换按钮点击事件
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const nextLang = currentLang === 'zh' ? 'en' : 'zh';
      applyLanguage(nextLang);
      chrome.storage.local.set({ preferredLanguage: nextLang });

      // 重新检查当前标签的内置页提示
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        const dict = I18N[nextLang];
        if (!tab) {
          activeTitleEl.textContent = dict.cannotDetect;
        } else if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
          activeTitleEl.innerHTML = `<span style="color:#ef4444;">${dict.unsupportedTab}</span>`;
        }
      });
    });
  }

  // 4. 绑定一键打开 AI 平台按钮
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetUrl = btn.getAttribute('data-url');
      if (targetUrl) {
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
          const domain = new URL(targetUrl).hostname;
          const existTab = (tabs || []).find(t => t.url && t.url.includes(domain));
          if (existTab) {
            chrome.tabs.update(existTab.id, { active: true });
          } else {
            chrome.tabs.create({ url: targetUrl });
          }
          window.close();
        });
      }
    });
  });
});
