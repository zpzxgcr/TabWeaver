/**
 * action-executor.js (高仿真事件执行与诊断引擎)
 * 核心升级：
 * 1. 拦截 target="_blank" 与 window.open，强制在当前受控标签页单页内跳转，杜绝搜索引擎多开乱弹窗；
 * 2. 深度仿真指针与表单事件序列，穿透 React/Vue/Angular/Svelte 受控组件；
 * 3. 增强按键序列支持（press / pressEnter）；
 * 4. 丰富诊断回执：若元素未找到，返回当前页面真实 URL 与 Title，让 AI 明确获知页面是否已跳转。
 */
(() => {
  // 劫持并单页化处理：禁止页面点击弹出外部新标签
  function keepNavigationInCurrentTab(el) {
    if (!el) return;

    const anchor = el.closest('a');
    if (anchor && anchor.getAttribute('target') === '_blank') {
      anchor.setAttribute('target', '_self');
    }

    const form = el.closest('form');
    if (form && form.getAttribute('target') === '_blank') {
      form.setAttribute('target', '_self');
    }

    if (!window.__ext_window_open_patched) {
      window.__ext_window_open_patched = true;
      const originalOpen = window.open;
      window.open = function(url, target, features) {
        if (url && (target === '_blank' || !target)) {
          window.location.href = url;
          return window;
        }
        return originalOpen.apply(this, arguments);
      };
    }
  }

  async function runAction(action) {
    if (!action || !action.action) {
      return { success: false, error: '缺少有效的操作指令' };
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const findElement = (index) => {
      if (index == null) return null;
      return document.querySelector(`[data-ext-elem-id="${index}"]`);
    };

    const highlightElement = (el, color = '#1677ff') => {
      if (!el) return;
      const prevOutline = el.style.outline;
      const prevTransition = el.style.transition;
      el.style.transition = 'outline 0.2s ease-in-out';
      el.style.outline = `3px solid ${color}`;
      setTimeout(() => {
        el.style.outline = prevOutline;
        el.style.transition = prevTransition;
      }, 1200);
    };

    switch (action.action.toLowerCase()) {
      case 'click': {
        const el = findElement(action.element);
        if (!el) {
          return {
            success: false,
            error: `未找到编号为 [${action.element}] 的元素。页面当前标题为 "${document.title}"，URL 为 "${location.href}"，元素可能已随页面更新而刷新，请查看最新快照重新确认。`
          };
        }

        keepNavigationInCurrentTab(el);

        if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
          return {
            success: false,
            error: `目标元素 [${action.element}] 当前处于禁用状态 (disabled)，无法点击。请检查页面是否有前置项未完成（如未填写必填项或未勾选协议）。`,
            currentUrl: location.href,
            pageTitle: document.title
          };
        }

        const text = (el.innerText || el.textContent || el.value || '').trim();
        const type = el.getAttribute('type') || '';
        const isHighRisk = type === 'submit' && /支付|确认付款|删除账户|注销|购买/i.test(text);

        if (isHighRisk && action.skipConfirm !== true) {
          return {
            success: false,
            needConfirm: true,
            elementIndex: action.element,
            elementText: text || el.tagName.toLowerCase(),
            warning: `即将触发具有副作用的高危操作: "${text || el.tagName}"`
          };
        }

        highlightElement(el, '#1677ff');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(150);

        // 派发仿真指针与鼠标事件序列
        const mouseEvents = ['pointerdown', 'mousedown', 'pointerup', 'mouseup'];
        let prevented = false;
        for (const evName of mouseEvents) {
          const ev = new MouseEvent(evName, {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window
          });
          el.dispatchEvent(ev);
          if (ev.defaultPrevented) prevented = true;
        }

        // Exactly one click. A synthetic click plus el.click() used to toggle controls twice.
        if (typeof el.click === 'function') el.click();
        else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window }));

        return {
          success: true,
          message: `已点击 [${action.element}] "${text.slice(0, 25)}"`,
          currentUrl: location.href,
          pageTitle: document.title
        };
      }

      case 'fill':
      case 'input':
      case 'type': {
        const el = findElement(action.element);
        if (!el) {
          return {
            success: false,
            error: `未找到编号为 [${action.element}] 的输入元素。页面当前标题为 "${document.title}"，URL 为 "${location.href}"，可能页面已跳转。`
          };
        }

        highlightElement(el, '#52c41a');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        await sleep(80);

        const val = action.value != null ? String(action.value) : (action.text != null ? String(action.text) : '');

        // 处理 React / Vue 受控组件原生 setter 与 tracker
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          const prototype = (el instanceof HTMLTextAreaElement || el.tagName === 'TEXTAREA')
            ? HTMLTextAreaElement.prototype 
            : HTMLInputElement.prototype;
          
          const prevVal = el.value;
          const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(el, val);
          } else {
            el.value = val;
          }

          if (el._valueTracker) {
            el._valueTracker.setValue(prevVal);
          }

          el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        } else if (el.isContentEditable) {
          el.innerText = val;
          el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        } else if (el instanceof HTMLSelectElement || el.tagName === 'SELECT') {
          let matched = false;
          if (el.options && el.options.length > 0) {
            for (let i = 0; i < el.options.length; i++) {
              if (el.options[i].value === val || el.options[i].text.trim().includes(val)) {
                el.selectedIndex = i;
                matched = true;
                break;
              }
            }
          }
          if (!matched) el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        }

        // 自动回车提交
        if (action.pressEnter === true) {
          await sleep(100);
          const enterInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
          el.dispatchEvent(new KeyboardEvent('keydown', enterInit));
          el.dispatchEvent(new KeyboardEvent('keypress', enterInit));
          el.dispatchEvent(new KeyboardEvent('keyup', enterInit));

          const form = el.closest('form');
          if (form) {
            try {
              if (typeof form.requestSubmit === 'function') form.requestSubmit();
            } catch (e) {}
          }
        }

        return {
          success: true,
          message: `已填入 [${action.element}]: "${val.slice(0, 30)}"${action.pressEnter ? ' (已回车提交)' : ''}`,
          currentUrl: location.href,
          pageTitle: document.title
        };
      }

      case 'press': {
        const key = action.key || 'Enter';
        const el = action.element ? findElement(action.element) : (document.activeElement || document.body);
        if (!el) {
          return { success: false, error: '未找到按键派发目标' };
        }

        highlightElement(el, '#722ed1');
        if (typeof el.focus === 'function') el.focus();
        await sleep(50);

        const keyCode = key === 'Enter' ? 13 : key === 'Escape' ? 27 : key === 'Tab' ? 9 : 0;
        const keyInit = {
          key: key,
          code: key === 'Enter' ? 'Enter' : key,
          keyCode: keyCode,
          which: keyCode,
          bubbles: true,
          cancelable: true,
          composed: true
        };

        el.dispatchEvent(new KeyboardEvent('keydown', keyInit));
        el.dispatchEvent(new KeyboardEvent('keypress', keyInit));
        el.dispatchEvent(new KeyboardEvent('keyup', keyInit));

        if (key === 'Enter') {
          const form = el.closest('form');
          if (form) {
            try {
              if (typeof form.requestSubmit === 'function') form.requestSubmit();
            } catch (e) {}
          }
        }

        await sleep(100);
        return {
          success: true,
          message: `已在目标上发送按键 [${key}]`,
          currentUrl: location.href,
          pageTitle: document.title
        };
      }

      case 'select': {
        const el = findElement(action.element);
        if (!el) {
          return { success: false, error: `未找到编号为 [${action.element}] 的下拉选择元素` };
        }
        highlightElement(el, '#52c41a');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        await sleep(80);

        const targetOption = String(action.value ?? action.option ?? action.text ?? '');
        if (el instanceof HTMLSelectElement || el.tagName === 'SELECT') {
          let matched = false;
          if (el.options && el.options.length > 0) {
            for (let i = 0; i < el.options.length; i++) {
              if (el.options[i].value === targetOption || el.options[i].text.trim().includes(targetOption)) {
                el.selectedIndex = i;
                matched = true;
                break;
              }
            }
          }
          if (!matched && el.options && el.options.length > 0) el.value = targetOption;
          el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          return {
            success: true,
            message: `已选中下拉项: "${el.selectedOptions?.[0]?.text || targetOption}"`,
            currentUrl: location.href,
            pageTitle: document.title
          };
        } else {
          if (typeof el.click === 'function') el.click();
          return {
            success: true,
            message: `已激活下拉菜单 [${action.element}]`,
            currentUrl: location.href,
            pageTitle: document.title
          };
        }
      }

      case 'hover': {
        const el = findElement(action.element);
        if (!el) {
          return { success: false, error: `未找到编号为 [${action.element}] 的悬停元素` };
        }
        highlightElement(el, '#722ed1');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(80);
        const evTypes = ['pointerover', 'mouseover', 'pointerenter', 'mouseenter', 'mousemove'];
        for (const name of evTypes) {
          el.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true, composed: true, view: window }));
        }
        await sleep(150);
        const text = (el.innerText || el.textContent || '').trim();
        return {
          success: true,
          message: `已悬停于 [${action.element}] "${text.slice(0, 25)}"`,
          currentUrl: location.href,
          pageTitle: document.title
        };
      }

      case 'wait':
      case 'sleep': {
        const ms = Math.min(Math.max(Number(action.duration || action.ms || (action.seconds ? action.seconds * 1000 : 1000)), 100), 8000);
        await sleep(ms);
        return {
          success: true,
          message: `已等待 ${ms}ms，页面已处于最新状态`,
          currentUrl: location.href,
          pageTitle: document.title
        };
      }

      case 'scroll': {
        const dir = (action.direction || 'down').toLowerCase();
        if (!['up', 'down', 'top', 'bottom'].includes(dir)) return { success: false, error: '无效滚动方向' };
        const root = document.scrollingElement || document.documentElement;
        let target = action.element ? findElement(action.element) : null;
        if (action.element && !target) return { success: false, error: '未找到指定滚动元素' };
        if (!target) {
          const candidates = Array.from(document.querySelectorAll('body *')).filter(el => {
            if (el === root || el.scrollHeight <= el.clientHeight + 4 || el.clientHeight < 100) return false;
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return /auto|scroll|overlay/.test(style.overflowY) && style.visibility !== 'hidden' &&
              rect.width > 100 && rect.height > 100 && rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0;
          });
          if (root.scrollHeight > root.clientHeight + 4) candidates.push(root);
          const score = el => {
            const rect = el === root ? { width: innerWidth, height: innerHeight } : el.getBoundingClientRect();
            return Math.min(rect.width, innerWidth) * Math.min(rect.height, innerHeight);
          };
          target = candidates.sort((a, b) => score(b) - score(a))[0] || root;
        }
        const before = target.scrollTop;
        const max = Math.max(0, target.scrollHeight - target.clientHeight);
        const delta = Math.max(100, target.clientHeight * 0.75) * (dir === 'up' ? -1 : 1);
        const desired = dir === 'top' ? 0 : dir === 'bottom' ? max : Math.max(0, Math.min(max, before + delta));
        target.scrollTo({ top: desired, behavior: 'instant' });
        await sleep(120);
        const after = target.scrollTop;
        const moved = Math.abs(after - before) > 1;
        const scroll = { container: target === root ? 'document' : target.tagName.toLowerCase(), before, after, max, moved, atBoundary: after <= 1 || after >= max - 1 };
        return { success: moved, scroll, message: moved ? `向 ${dir} 滚动：${Math.round(before)} → ${Math.round(after)}` : '滚动位置未变化（已到边界或容器不可滚动），请勿重复同一动作', error: moved ? undefined : 'NO_SCROLL_MOVEMENT' };
      }

      case 'extract': {
        const el = findElement(action.element);
        if (!el) {
          return { success: false, error: `未找到编号为 [${action.element}] 的元素` };
        }
        highlightElement(el, '#722ed1');
        const content = (el.innerText || el.textContent || el.value || '').trim();
        return {
          success: true,
          message: `提取内容成功`,
          extractedText: content.slice(0, 1000)
        };
      }

      case 'back': {
        window.history.back();
        await sleep(200);
        return {
          success: true,
          message: '已执行浏览器后退 (Go Back)',
          currentUrl: location.href,
          pageTitle: document.title
        };
      }

      case 'forward': {
        window.history.forward();
        await sleep(200);
        return {
          success: true,
          message: '已执行浏览器前进 (Go Forward)',
          currentUrl: location.href,
          pageTitle: document.title
        };
      }

      case 'reload': {
        window.location.reload();
        await sleep(200);
        return {
          success: true,
          message: '已执行刷新页面 (Reload)',
          currentUrl: location.href,
          pageTitle: document.title
        };
      }

      case 'navigate':
      case 'goto': {
        const destUrl = action.url;
        if (!destUrl || typeof destUrl !== 'string') {
          return { success: false, error: '缺少有效的目标跳转 URL' };
        }
        window.location.href = destUrl;
        await sleep(200);
        return {
          success: true,
          message: `已跳转至指定网址: "${destUrl}"`,
          currentUrl: destUrl,
          pageTitle: document.title
        };
      }

      case 'finish': {
        return { success: true, isFinish: true, message: action.reason || 'AI 判定任务已完成' };
      }

      default:
        return { success: false, error: `未知操作指令: "${action.action}"` };
    }
  }

  window.__runBrowserAction = runAction;
  return runAction;
})();
