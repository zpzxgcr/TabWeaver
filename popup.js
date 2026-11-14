/**
 * popup.js
 * 负责点击扩展图标时展示的弹窗交互与快捷导航
 */

document.addEventListener('DOMContentLoaded', () => {
  const activeTitleEl = document.getElementById('active-tab-title');

  // 获取当前活动标签页状态
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];
    if (!tab) {
      activeTitleEl.textContent = '无法获取当前页面';
      return;
    }

    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      activeTitleEl.innerHTML = `<span style="color:#ef4444;">浏览器内置页面 (不可控制)</span>`;
    } else {
      activeTitleEl.textContent = tab.title || tab.url;
      activeTitleEl.title = `${tab.title}\n${tab.url}`;
    }
  });

  // 绑定一键打开 AI 平台按钮
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetUrl = btn.getAttribute('data-url');
      if (targetUrl) {
        // 先检查是否已经打开了该平台
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
