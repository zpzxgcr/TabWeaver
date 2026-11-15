/** Shared website registry for the content script and popup. No remote code or API keys. */
(() => {
  'use strict';
  const platforms = [
    {
      id: 'deepseek', name: 'DeepSeek', icon: 'DS', group: 'cn', url: 'https://chat.deepseek.com', hosts: ['chat.deepseek.com'],
      input: ['textarea#chat-input', 'textarea.chat-input', '.chat-input textarea', 'textarea[placeholder]'],
      send: ['.chat-input-send-button', '[role="button"][aria-label*="发送"]'],
      assistant: ['.chat-message-assistant', '.ds-message-assistant', '.ds-markdown'],
      user: ['.chat-message-user', '.ds-message-user'], stop: ['.chat-stop-button', 'button:has(.ds-icon-stop)']
    },
    {
      id: 'chatgpt', name: 'ChatGPT', icon: 'AI', group: 'global', url: 'https://chatgpt.com', hosts: ['chatgpt.com', 'chat.openai.com'],
      input: ['#prompt-textarea', 'textarea[data-id="root"]'],
      send: ['button[data-testid="send-button"]', 'button[data-testid="fruitjuice-send-button"]'],
      assistant: ['[data-message-author-role="assistant"]'], user: ['[data-message-author-role="user"]'],
      stop: ['button[data-testid="stop-button"]']
    },
    {
      id: 'gemini', name: 'Gemini', icon: 'G', group: 'global', url: 'https://gemini.google.com', hosts: ['gemini.google.com'],
      input: ['rich-textarea .ql-editor', '.input-area [contenteditable="true"]'],
      send: ['button.send-button', '.send-button-container button'],
      assistant: ['model-response', '.response-container', '.model-response-text'], user: ['user-query', '.user-query'],
      stop: ['.streaming-cursor', '.cursor-indicator']
    },
    {
      id: 'claude', name: 'Claude', icon: 'C', group: 'global', url: 'https://claude.ai', hosts: ['claude.ai'],
      input: ['[contenteditable="true"].ProseMirror', '[contenteditable="true"][data-placeholder]'],
      send: ['button[aria-label="Send message"]'], assistant: ['[data-is-streaming]', '[data-testid="assistant-message"]'],
      user: ['[data-testid="user-message"]'], stop: ['[data-is-streaming="true"]']
    },
    {
      id: 'grok', name: 'Grok', icon: 'X', group: 'global', url: 'https://grok.com', hosts: ['grok.com'],
      input: ['textarea[placeholder]', '.tiptap[contenteditable="true"]', '[contenteditable="true"][role="textbox"]'],
      send: ['button[aria-label="Submit"]'], assistant: ['.message-bubble:has(.response-content-markdown)', '.response-content-markdown'],
      user: ['[data-role="user"]', '.message-bubble.bg-surface-l1'], stop: []
    },
    {
      id: 'doubao', name: 'Doubao', nameZh: '豆包', icon: '豆', group: 'cn', url: 'https://www.doubao.com/chat/', hosts: ['www.doubao.com', 'doubao.com'],
      input: ['textarea[data-testid="chat_input_input"]', 'textarea[placeholder]', '[contenteditable="true"][role="textbox"]'],
      send: ['[data-testid="chat_input_send_button"]'],
      assistant: ['[data-testid="receive_message"]', '[data-message-role="assistant"]'],
      user: ['[data-testid="send_message"]', '[data-message-role="user"]'], stop: ['[data-testid="chat_input_stop_button"]']
    },
    {
      id: 'kimi', name: 'Kimi', icon: 'K', group: 'cn', url: 'https://www.kimi.com', hosts: ['www.kimi.com', 'kimi.com', 'kimi.moonshot.cn'],
      input: ['.chat-input-editor[contenteditable="true"]', '.chat-input textarea', '[contenteditable="true"][data-placeholder]'],
      send: ['.send-button', '.send-btn'], assistant: ['.segment-assistant', '.chat-content-item-assistant'],
      user: ['.segment-user', '.chat-content-item-user'], stop: ['.stop-button', '.stop-btn']
    },
    {
      id: 'qianwen', name: 'Qianwen', nameZh: '千问', icon: '千', group: 'cn', url: 'https://www.qianwen.com', hosts: ['www.qianwen.com', 'qianwen.com', 'tongyi.aliyun.com', 'tongyi.com', 'www.tongyi.com'],
      input: ['textarea.ant-input', 'textarea[placeholder]', '[contenteditable="true"][role="textbox"]'],
      send: ['[class*="sendBtn"]', '[class*="send-btn"]'],
      assistant: ['[data-message-role="assistant"]', '[class*="answerItem"]', '[class*="answer-item"]'],
      user: ['[data-message-role="user"]', '[class*="questionItem"]'], stop: ['[class*="stopBtn"]']
    },
    {
      id: 'qwen', name: 'Qwen', icon: 'Q', group: 'global', url: 'https://chat.qwen.ai', hosts: ['chat.qwen.ai'],
      input: ['#chat-input', 'textarea[placeholder]', '[contenteditable="true"][role="textbox"]'],
      send: ['#send-message-button'], assistant: ['.chat-assistant', '[data-message-role="assistant"]'],
      user: ['.chat-user', '[data-message-role="user"]'], stop: ['#stop-response-button']
    },
    {
      id: 'yuanbao', name: 'Yuanbao', nameZh: '腾讯元宝', icon: '元', group: 'cn', url: 'https://yuanbao.tencent.com', hosts: ['yuanbao.tencent.com'],
      input: ['.ql-editor[contenteditable="true"]', 'textarea[placeholder]'],
      send: ['.style__send-btn', '[class*="send-btn"]'], assistant: ['.agent-chat__bubble--ai', '.agent-chat__list__item--ai'],
      user: ['.agent-chat__bubble--human', '.agent-chat__list__item--human'], stop: ['[class*="stop-btn"]']
    },
    {
      id: 'wenxiaoyan', name: 'Wenxiaoyan', nameZh: '文小言', icon: '言', group: 'cn', url: 'https://yiyan.baidu.com', hosts: ['yiyan.baidu.com', 'wenxiaoyan.com', 'www.wenxiaoyan.com'],
      input: ['#dialogue-input', 'textarea[placeholder]', '[contenteditable="true"][role="textbox"]'],
      send: ['[class*="send-button"]', '[class*="sendBtn"]'], assistant: ['[class*="answer-content"]', '[data-role="assistant"]'],
      user: ['[class*="question-content"]', '[data-role="user"]'], stop: ['[class*="stop-button"]']
    },
    {
      id: 'xinghuo', name: 'Spark', nameZh: '讯飞星火', icon: '星', group: 'cn', url: 'https://xinghuo.xfyun.cn/desk', hosts: ['xinghuo.xfyun.cn'],
      input: ['#commonTextarea', 'textarea[placeholder]', '[contenteditable="true"][role="textbox"]'],
      send: ['.send-btn', '.send-button'], assistant: ['.answer-content', '.answer-wrap'],
      user: ['.question-content', '.question-wrap'], stop: ['.stop-btn']
    },
    {
      id: 'zhipu', name: 'Z.ai / Qingyan', nameZh: '智谱清言 / Z.ai', icon: '智', group: 'cn', url: 'https://chatglm.cn', hosts: ['chatglm.cn', 'www.chatglm.cn', 'chat.z.ai'],
      input: ['textarea[placeholder]', '.input-box [contenteditable="true"]'], send: ['.send-btn', '.send-button'],
      assistant: ['.item.conversation-item.assistant', '.conversation-item.assistant', '[data-role="assistant"]'],
      user: ['.conversation-item.user', '[data-role="user"]'], stop: ['.stop-btn']
    },
    {
      id: 'nami', name: 'Nami AI', nameZh: '纳米 AI', icon: '纳', group: 'cn', url: 'https://www.n.cn', hosts: ['www.n.cn', 'n.cn'],
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
