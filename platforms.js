/** Shared website registry for the content script and popup. No remote code or API keys. */
(() => {
  'use strict';

  // 每个平台的标志性品牌 SVG 图标 (零网络依赖，高清自适应)
  const ICONS = {
    deepseek: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.93V18h-2v-1.07c-2.83-.48-5-2.94-5-5.93h2c0 2.21 1.79 4 4 4s4-1.79 4-4h2c0 2.99-2.17 5.45-5 5.93zM12 6c1.66 0 3 1.34 3 3h-6c0-1.66 1.34-3 3-3z" fill="#4D6BFE"/></svg>`,
    chatgpt: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M20.5 10.2a5.3 5.3 0 0 0-.4-4.2 5.4 5.4 0 0 0-4.8-2.7c-.5 0-1 .1-1.5.3A5.4 5.4 0 0 0 4.6 5.8a5.3 5.3 0 0 0-2.3 4.2c0 .9.2 1.8.7 2.6a5.3 5.3 0 0 0 .4 4.2 5.4 5.4 0 0 0 4.8 2.7c.5 0 1-.1 1.5-.3a5.4 5.4 0 0 0 9.2-2.2 5.3 5.3 0 0 0 2.3-4.2c0-.9-.2-1.8-.7-2.6zm-8.5 9.1a4 4 0 0 1-2.4-.8l.2-.4 2.5-4.3a.8.8 0 0 1 .7-.4h.1a.8.8 0 0 1 .7.4l1.4 2.4a4 4 0 0 1-3.2 3.5zm-5.4-2.8a4 4 0 0 1-.9-2.4c0-.4.1-.7.2-1.1l.4.2 4.4 2.5a.8.8 0 0 1 .4.7v.1a.8.8 0 0 1-.4.7l-2.4 1.4a4 4 0 0 1-1.7-2.1zm-1.4-6.3a4 4 0 0 1 1.5-2.1l.3.3 2 4.6a.8.8 0 0 1-.3.8l-.1.1a.8.8 0 0 1-.8-.3l-2.4-2.4a4 4 0 0 1-.2-1zm8.8-4.5a4 4 0 0 1 2.4.8l-.2.4-2.5 4.3a.8.8 0 0 1-.7.4h-.1a.8.8 0 0 1-.7-.4L11 8.5a4 4 0 0 1 3.2-3.5zm5.4 2.8a4 4 0 0 1 .9 2.4c0 .4-.1.7-.2 1.1l-.4-.2-4.4-2.5a.8.8 0 0 1-.4-.7v-.1a.8.8 0 0 1 .4-.7l2.4-1.4a4 4 0 0 1 1.7 2.1zm1.4 6.3a4 4 0 0 1-1.5 2.1l-.3-.3-2-4.6a.8.8 0 0 1 .3-.8l.1-.1a.8.8 0 0 1 .8.3l2.4 2.4a4 4 0 0 1 .2 1z" fill="#10A37F"/></svg>`,
    gemini: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 2a10 10 0 0 0 2.5 7.5A10 10 0 0 0 22 12a10 10 0 0 0-7.5 2.5A10 10 0 0 0 12 22a10 10 0 0 0-2.5-7.5A10 10 0 0 0 2 12a10 10 0 0 0 7.5-2.5A10 10 0 0 0 12 2z" fill="url(#geminiGrad)"/><defs><linearGradient id="geminiGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#1A73E8"/><stop offset="0.5" stop-color="#8AB4F8"/><stop offset="1" stop-color="#EA4335"/></linearGradient></defs></svg>`,
    claude: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.8l5.5 3.4L12 11.7 6.5 8.2 12 4.8zm-6 4.9l5 3.1v6.3l-5-3.1V9.7zm7 9.4v-6.3l5-3.1v6.3l-5 3.1z" fill="#CC785C"/></svg>`,
    grok: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    doubao: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect width="24" height="24" rx="6" fill="#3B82F6"/><path d="M7 11c0-2.8 2.2-5 5-5s5 2.2 5 5c0 3.5-3.5 7-5 7s-5-3.5-5-7z" fill="#FFFFFF"/><circle cx="10" cy="11" r="1.5" fill="#3B82F6"/><circle cx="14" cy="11" r="1.5" fill="#3B82F6"/><path d="M10.5 14c.8.5 2.2.5 3 0" stroke="#3B82F6" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    kimi: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect width="24" height="24" rx="6" fill="#18181B"/><path d="M7 6h3v12H7V6zm7 0h3v4.5l3.5-4.5H23l-4.5 5.5L23 18h-2.5l-3.5-4.5V18h-3V6z" fill="#00D2B4"/></svg>`,
    qianwen: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect width="24" height="24" rx="6" fill="#615CED"/><path d="M12 6l5 3v6l-5 3-5-3V9l5-3z" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="#FFFFFF"/></svg>`,
    qwen: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><circle cx="12" cy="12" r="10" fill="#6366F1"/><path d="M12 6a6 6 0 1 0 4.24 10.24l2.83 2.83-1.42 1.41-2.83-2.82A6 6 0 0 0 12 6zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" fill="#FFFFFF"/></svg>`,
    yuanbao: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect width="24" height="24" rx="6" fill="#FF5E00"/><path d="M5 13c0 3.3 3.1 6 7 6s7-2.7 7-6c0-2-1.5-3.8-3.7-4.8.7-.9 1.7-1.5 2.7-1.7-1.2-.4-2.8-.2-4.2.8C13.1 7.1 12.6 7 12 7s-1.1.1-1.8.3C8.8 6.3 7.2 6.1 6 6.5c1 .2 2 .8 2.7 1.7C6.5 9.2 5 11 5 13z" fill="#FFDF00"/></svg>`,
    wenxiaoyan: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><circle cx="12" cy="12" r="10" fill="#2563EB"/><path d="M7 12a5 5 0 0 1 8.5-3.5L17 7v5h-5l1.8-1.8A3 3 0 1 0 12 15h-1v2h1a5 5 0 0 1-5-5z" fill="#FFFFFF"/></svg>`,
    xinghuo: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect width="24" height="24" rx="6" fill="#0284C7"/><path d="M12 4l2.2 5.8L20 12l-5.8 2.2L12 20l-2.2-5.8L4 12l5.8-2.2L12 4z" fill="#FFFFFF"/></svg>`,
    zhipu: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect width="24" height="24" rx="6" fill="#2563EB"/><path d="M6 8h12v2H9.5L18 16v2H6v-2h8.5L6 10V8z" fill="#67E8F9"/></svg>`,
    nami: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><circle cx="12" cy="12" r="10" fill="#0EA5E9"/><path d="M6 12c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6-6-2.7-6-6zm4 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" fill="#FFFFFF"/></svg>`
  };

  const platforms = [
    {
      id: 'deepseek', name: 'DeepSeek', iconSvg: ICONS.deepseek, icon: 'DS', group: 'cn', url: 'https://chat.deepseek.com', hosts: ['chat.deepseek.com'],
      input: ['textarea#chat-input', 'textarea.chat-input', '.chat-input textarea', 'textarea[placeholder]'],
      send: ['.chat-input-send-button', '[role="button"][aria-label*="发送"]'],
      assistant: ['.chat-message-assistant', '.ds-message-assistant', '.ds-markdown'],
      user: ['.chat-message-user', '.ds-message-user'], stop: ['.chat-stop-button', 'button:has(.ds-icon-stop)']
    },
    {
      id: 'chatgpt', name: 'ChatGPT', iconSvg: ICONS.chatgpt, icon: 'AI', group: 'global', url: 'https://chatgpt.com', hosts: ['chatgpt.com', 'chat.openai.com'],
      input: ['#prompt-textarea', 'textarea[data-id="root"]'],
      send: ['button[data-testid="send-button"]', 'button[data-testid="fruitjuice-send-button"]'],
      assistant: ['[data-message-author-role="assistant"]'], user: ['[data-message-author-role="user"]'],
      stop: ['button[data-testid="stop-button"]']
    },
    {
      id: 'gemini', name: 'Gemini', iconSvg: ICONS.gemini, icon: 'G', group: 'global', url: 'https://gemini.google.com', hosts: ['gemini.google.com'],
      input: ['rich-textarea .ql-editor', '.input-area [contenteditable="true"]'],
      send: ['button.send-button', '.send-button-container button'],
      assistant: ['model-response', '.response-container', '.model-response-text'], user: ['user-query', '.user-query'],
      stop: ['.streaming-cursor', '.cursor-indicator']
    },
    {
      id: 'claude', name: 'Claude', iconSvg: ICONS.claude, icon: 'C', group: 'global', url: 'https://claude.ai', hosts: ['claude.ai'],
      input: ['[contenteditable="true"].ProseMirror', '[contenteditable="true"][data-placeholder]'],
      send: ['button[aria-label="Send message"]'], assistant: ['[data-is-streaming]', '[data-testid="assistant-message"]'],
      user: ['[data-testid="user-message"]'], stop: ['[data-is-streaming="true"]']
    },
    {
      id: 'grok', name: 'Grok', iconSvg: ICONS.grok, icon: 'X', group: 'global', url: 'https://grok.com', hosts: ['grok.com'],
      input: ['textarea[placeholder]', '.tiptap[contenteditable="true"]', '[contenteditable="true"][role="textbox"]'],
      send: ['button[aria-label="Submit"]'], assistant: ['.message-bubble:has(.response-content-markdown)', '.response-content-markdown'],
      user: ['[data-role="user"]', '.message-bubble.bg-surface-l1'], stop: []
    },
    {
      id: 'doubao', name: 'Doubao', nameZh: '豆包', iconSvg: ICONS.doubao, icon: '豆', group: 'cn', url: 'https://www.doubao.com/chat/', hosts: ['www.doubao.com', 'doubao.com'],
      input: ['textarea[data-testid="chat_input_input"]', 'textarea[placeholder]', '[contenteditable="true"][role="textbox"]'],
      send: ['[data-testid="chat_input_send_button"]'],
      assistant: ['[data-testid="receive_message"]', '[data-message-role="assistant"]'],
      user: ['[data-testid="send_message"]', '[data-message-role="user"]'], stop: ['[data-testid="chat_input_stop_button"]']
    },
    {
      id: 'kimi', name: 'Kimi', iconSvg: ICONS.kimi, icon: 'K', group: 'cn', url: 'https://www.kimi.com', hosts: ['www.kimi.com', 'kimi.com', 'kimi.moonshot.cn'],
      input: ['.chat-input-editor[contenteditable="true"]', '.chat-input textarea', '[contenteditable="true"][data-placeholder]'],
      send: ['.send-button', '.send-btn'], assistant: ['.segment-assistant', '.chat-content-item-assistant'],
      user: ['.segment-user', '.chat-content-item-user'], stop: ['.stop-button', '.stop-btn']
    },
    {
      id: 'qianwen', name: 'Qianwen', nameZh: '通义千问', iconSvg: ICONS.qianwen, icon: '千', group: 'cn', url: 'https://www.qianwen.com', hosts: ['www.qianwen.com', 'qianwen.com', 'tongyi.aliyun.com', 'tongyi.com', 'www.tongyi.com'],
      input: ['textarea.ant-input', 'textarea[placeholder]', '[contenteditable="true"][role="textbox"]'],
      send: ['[class*="sendBtn"]', '[class*="send-btn"]'],
      assistant: ['[data-message-role="assistant"]', '[class*="answerItem"]', '[class*="answer-item"]'],
      user: ['[data-message-role="user"]', '[class*="questionItem"]'], stop: ['[class*="stopBtn"]']
    },
    {
      id: 'qwen', name: 'Qwen', iconSvg: ICONS.qwen, icon: 'Q', group: 'global', url: 'https://chat.qwen.ai', hosts: ['chat.qwen.ai'],
      input: ['#chat-input', 'textarea[placeholder]', '[contenteditable="true"][role="textbox"]'],
      send: ['#send-message-button'], assistant: ['.chat-assistant', '[data-message-role="assistant"]'],
      user: ['.chat-user', '[data-message-role="user"]'], stop: ['#stop-response-button']
    },
    {
      id: 'yuanbao', name: 'Yuanbao', nameZh: '腾讯元宝', iconSvg: ICONS.yuanbao, icon: '元', group: 'cn', url: 'https://yuanbao.tencent.com', hosts: ['yuanbao.tencent.com'],
      input: ['.ql-editor[contenteditable="true"]', 'textarea[placeholder]'],
      send: ['.style__send-btn', '[class*="send-btn"]'], assistant: ['.agent-chat__bubble--ai', '.agent-chat__list__item--ai'],
      user: ['.agent-chat__bubble--human', '.agent-chat__list__item--human'], stop: ['[class*="stop-btn"]']
    },
    {
      id: 'wenxiaoyan', name: 'Wenxiaoyan', nameZh: '文小言', iconSvg: ICONS.wenxiaoyan, icon: '言', group: 'cn', url: 'https://yiyan.baidu.com', hosts: ['yiyan.baidu.com', 'wenxiaoyan.com', 'www.wenxiaoyan.com'],
      input: ['#dialogue-input', 'textarea[placeholder]', '[contenteditable="true"][role="textbox"]'],
      send: ['[class*="send-button"]', '[class*="sendBtn"]'], assistant: ['[class*="answer-content"]', '[data-role="assistant"]'],
      user: ['[class*="question-content"]', '[data-role="user"]'], stop: ['[class*="stop-button"]']
    },
    {
      id: 'xinghuo', name: 'Spark', nameZh: '讯飞星火', iconSvg: ICONS.xinghuo, icon: '星', group: 'cn', url: 'https://xinghuo.xfyun.cn/desk', hosts: ['xinghuo.xfyun.cn'],
      input: ['#commonTextarea', 'textarea[placeholder]', '[contenteditable="true"][role="textbox"]'],
      send: ['.send-btn', '.send-button'], assistant: ['.answer-content', '.answer-wrap'],
      user: ['.question-content', '.question-wrap'], stop: ['.stop-btn']
    },
    {
      id: 'zhipu', name: 'Z.ai / Qingyan', nameZh: '智谱清言', iconSvg: ICONS.zhipu, icon: '智', group: 'cn', url: 'https://chatglm.cn', hosts: ['chatglm.cn', 'www.chatglm.cn', 'chat.z.ai'],
      input: ['textarea[placeholder]', '.input-box [contenteditable="true"]'], send: ['.send-btn', '.send-button'],
      assistant: ['.item.conversation-item.assistant', '.conversation-item.assistant', '[data-role="assistant"]'],
      user: ['.conversation-item.user', '[data-role="user"]'], stop: ['.stop-btn']
    },
    {
      id: 'nami', name: 'Nami AI', nameZh: '纳米 AI', iconSvg: ICONS.nami, icon: '纳', group: 'cn', url: 'https://www.n.cn', hosts: ['www.n.cn', 'n.cn'],
      input: ['textarea[placeholder]', '[contenteditable="true"][role="textbox"]'], send: ['.send-btn', '[class*="send-button"]'],
      assistant: ['[data-role="assistant"]', '.assistant-message', '.answer-content'],
      user: ['[data-role="user"]', '.user-message'], stop: ['.stop-btn']
    }
  ];

  function findByHostname(hostname) {
    const host = String(hostname).toLowerCase();
    return platforms.find(platform => platform.hosts.includes(host)) || null;
  }

  globalThis.TabWeaverPlatforms = Object.freeze({ platforms, findByHostname });
})();
