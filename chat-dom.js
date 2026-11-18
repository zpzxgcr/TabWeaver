/** Shared DOM adapter. Site differences live in platforms.js, not in the agent loop. */
(() => {
  'use strict';
  const registry = globalThis.TabWeaverPlatforms;
  const internal = '.tab-mention-picker, .agent-integrated-capsule, .agent-folded-container';
  const common = {
    input: [
      'textarea[placeholder]',
      '[contenteditable="true"][role="textbox"]',
      '.ProseMirror[contenteditable="true"]',
      'textarea:not([readonly])',
      '[contenteditable="true"]',
      '[contenteditable="plaintext-only"]',
      '[role="textbox"]'
    ],
    send: [
      'button[aria-label="Send message"]', 'button[aria-label="Send prompt"]', 'button[aria-label="Send"]',
      'button[aria-label="Submit"]', 'button[aria-label="发送"]', 'button[aria-label="发送消息"]',
      '[role="button"][aria-label="发送"]', 'button[data-testid="send-button"]', 'button[title="发送"]'
    ],
    stop: [
      'button[aria-label="Stop"]', 'button[aria-label="Stop generating"]', 'button[aria-label="Stop streaming"]',
      'button[aria-label="Stop response"]', 'button[aria-label="停止"]', 'button[aria-label="停止生成"]',
      'button[aria-label="停止回答"]', 'button[aria-label="停止响应"]'
    ],
    assistant: ['[data-message-author-role="assistant"]', '[data-message-role="assistant"]', '[data-role="assistant"]', '.assistant-message'],
    user: ['[data-message-author-role="user"]', '[data-message-role="user"]', '[data-role="user"]', '.user-message']
  };
  function visible(el) {
    if (!el || el.closest(internal) || el.closest('[hidden], [aria-hidden="true"]')) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
  }
  function query(root, selector) {
    try { return Array.from(root.querySelectorAll(selector)); } catch { return []; }
  }
  function firstVisible(selectors, root = document) {
    for (const selector of selectors) {
      const node = query(root, selector).find(visible);
      if (node) return node;
    }
    return null;
  }
  function profile() { return registry.findByHostname(location.hostname); }
  function selectors(kind) { return [...(profile()?.[kind] || []), ...(common[kind] || [])]; }
  function getInput() {
    if (!profile()) return null;
    // Do not treat the tab picker's search box or a site's search field as the composer.
    return firstVisible(selectors('input'));
  }
  function getSendButton() {
    const input = getInput();
    if (!input) return null;
    // Prefer controls in the composer's own form, then explicit site/accessible selectors.
    const form = input.closest('form');
    if (form) {
      const local = firstVisible(selectors('send'), form) || firstVisible(['button[type="submit"]'], form);
      if (local) return local;
    }
    return firstVisible(selectors('send'));
  }
  function getMessages(kind) {
    if (!profile()) return [];
    const userSelectors = selectors('user').join(',');
    // Use one selector family to avoid nested markdown blocks changing the message count.
    for (const selector of selectors(kind)) {
      const nodes = query(document, selector).filter(node => {
        if (node.closest(internal)) return false;
        if (kind === 'assistant' && node.closest(userSelectors)) return false;
        return true;
      });
      if (nodes.length) return nodes.filter(node => !nodes.some(other => other !== node && other.contains(node)));
    }
    return [];
  }
  function getMessageText(node) {
    if (!node) return '';
    const copy = node.cloneNode(true);
    copy.querySelectorAll('button, [data-testid="thinking-content"], .ds-think-content, .thinking-content, .reasoning-content, [class*="think-content"], [class*="reasoning-content"]').forEach(el => el.remove());
    return (copy.innerText || copy.textContent || '').trim();
  }
  function isStreaming() { return !!firstVisible(selectors('stop')); }
  function isEnabled(button) {
    return !!button && visible(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
  }
  function describe() {
    const input = getInput();
    const send = getSendButton();
    return {
      platform: profile()?.id, inputFound: !!input, inputTag: input?.tagName,
      sendFound: !!send, sendEnabled: isEnabled(send), streaming: isStreaming(),
      assistantCount: getMessages('assistant').length, userCount: getMessages('user').length,
      visibility: document.visibilityState,
      assistantSelectors: selectors('assistant').map(selector => ({ selector, count: query(document, selector).length }))
    };
  }
  globalThis.TabWeaverChatDOM = Object.freeze({ profile, getInput, getSendButton, getMessages, getMessageText, isStreaming, isEnabled, describe });
})();
