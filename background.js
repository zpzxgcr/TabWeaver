/**
 * background.js (企业级跨标签页调度与页面静止态内核)
 * 核心升级：
 * 1. 深度对齐官方 Playwright/AXTree 沉淀哲学：实现页面静止态等待（Quiescence Detector），
 *    彻底根除“点击后页面还在跳转/异步渲染，就提前抓取快照导致 AI 重复点击或找不到元素”的致命根因；
 * 2. 全局持久化受控会话（chrome.storage.session），生命周期绝对锁定，杜绝前端刷新/聚焦漂移导致的目标丢失；
 * 3. 实时追踪目标标签页 URL/Title 变动，并注入到回执上下文中，提供强事实闭环。
 */

importScripts('debug-store.js');
const diagnostics = globalThis.TabWeaverDebug;

// 默认开启全链路日志可观测性
diagnostics?.configure?.({ enabled: true, captureContent: true })?.catch?.(() => {});
chrome.runtime?.onInstalled?.addListener(() => {
  diagnostics?.configure?.({ enabled: true, captureContent: true })?.catch?.(() => {});
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
    // 1. 获取当前窗口中可被控制的所有候选标签页
    case 'GET_WINDOW_TABS': {
      const currentTabId = sender.tab?.id;
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        const candidateTabs = (tabs || [])
          .filter(t => t.id !== currentTabId && isNormalWebUrl(t.url))
          .map(t => ({
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

    default:
      return false;
  }
});
