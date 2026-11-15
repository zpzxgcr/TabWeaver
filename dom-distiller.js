/**
 * dom-distiller.js (视口与层叠无障碍感知蒸馏器 - AXTree 哲学实现)
 * 核心升级：
 * 1. 深度对齐官方 AXTree 思想：优先聚焦当前视口（Viewport）与顶层活动模态框（Modal/Dialog/Popover/Overlay）；
 * 2. 当用户点击按钮弹出搜索浮层或弹窗时，浮层内元素自动拥有最高优先级，彻底杜绝被页面静态导航栏截断；
 * 3. 焦点元素（document.activeElement）绝对置顶保护；
 * 4. 彻底过滤无意义的空 <a> 标签、埋点图标、版权法律等冗余噪音；
 * 5. 输出页面真实 URL 与 Title，为大模型提供精确事实锚点。
 */
(() => {
  function distillPageDOM() {
    // 1. 清理上一轮执行遗留的高亮和定位标识
    document.querySelectorAll('[data-ext-elem-id]').forEach(el => {
      el.removeAttribute('data-ext-elem-id');
    });

    const vWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
    const vHeight = window.innerHeight || document.documentElement.clientHeight || 768;

    const isVisible = (el) => {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      return true;
    };

    // 交互候选选择器集合
    const interactiveSelectors = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'textarea',
      'select',
      'details > summary',
      '[contenteditable="true"]',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="tab"]',
      '[role="combobox"]',
      '[role="option"]',
      '[role="menuitem"]',
      '[tabindex]:not([tabindex="-1"])'
    ];

    const rawElements = Array.from(document.querySelectorAll(interactiveSelectors.join(',')));

    // 2. 冗余层级压缩与折叠：如果父级已是按钮或链接，避免将其内部碎片 span/i 单独提取
    const validElements = [];
    for (const el of rawElements) {
      if (!isVisible(el)) continue;

      let ancestorInteractive = false;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        if (validElements.includes(parent) && (parent.tagName === 'BUTTON' || parent.tagName === 'A')) {
          ancestorInteractive = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!ancestorInteractive) {
        validElements.push(el);
      }
    }

    // 3. 深度清洗过滤（剔除无内容无意义的空 a 链接、版权噪音）
    const noiseRegex = /京公网安备|京ICP证|信息网络传播|使用百度前必读|帮助中心|企业推广|About Baidu|版权所有|免责声明/i;

    const filteredElements = [];
    for (const el of validElements) {
      const tag = el.tagName.toLowerCase();
      let directText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

      // 如果自身没有文本，提取包裹子图的 alt / title
      if (!directText) {
        const subImg = el.querySelector('img');
        if (subImg) {
          directText = subImg.getAttribute('alt') || subImg.getAttribute('title') || '';
        }
      }

      const title = el.getAttribute('title') || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const placeholder = el.getAttribute('placeholder') || '';
      const name = el.getAttribute('name') || '';

      // a 标签若没有任何可见文字或提示，视为纯装饰，予以过滤
      if (tag === 'a' && !directText && !title && !ariaLabel) {
        continue;
      }

      // 过滤页脚版权等固定噪音
      if (noiseRegex.test(directText) || noiseRegex.test(title)) {
        continue;
      }

      filteredElements.push({ el, tag, directText, title, ariaLabel, placeholder, name });
    }

    // 4. 智能视口与层叠权重计算（AXTree 思想）
    const activeEl = document.activeElement;

    // 检测页面是否存在活跃模态框/弹出层
    const activeModal = document.querySelector('dialog[open], [role="dialog"]:not([aria-hidden="true"]), [aria-modal="true"], .modal.show, .modal.open, .Overlay--open');

    const scoredElements = filteredElements.map((item, originalIndex) => {
      let score = 0;
      const { el, tag } = item;
      const rect = el.getBoundingClientRect();

      // 规则 A：当前聚焦元素（如点击后激活的搜索输入框）绝对最高优先级
      if (el === activeEl) {
        score += 500;
      }

      // 规则 B：处于活动模态框/浮动层内部
      const isInModal = activeModal ? activeModal.contains(el) : !!el.closest('dialog, [role="dialog"], [aria-modal="true"], [popover], .modal, .Overlay, [role="combobox"]');
      if (isInModal) {
        score += 350;
      }

      // 规则 C：视口可见性加成（在首屏可见视口内的元素天然优先于屏幕外未滚动的元素）
      const isInViewport = rect.top < vHeight && rect.bottom > 0 && rect.left < vWidth && rect.right > 0;
      if (isInViewport) {
        score += 100;
      } else {
        score -= 50; // 屏幕外滚动区域扣分
      }

      // 规则 D：表单输入控件（搜索框、文本框、单选/复选）
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) {
        score += 80;
        const type = el.getAttribute('type') || '';
        const name = el.getAttribute('name') || '';
        const placeholder = el.getAttribute('placeholder') || '';
        if (/search|query|kw|q|wd|搜索/i.test(`${name} ${placeholder} ${type} ${el.id}`)) {
          score += 60; // 搜索核心控件加成
        }
      }

      // 规则 E：主要交互按钮
      if (tag === 'button' || el.getAttribute('role') === 'button' || el.id === 'su' || el.getAttribute('type') === 'submit') {
        score += 40;
      }

      return { ...item, score, originalIndex };
    });

    // 限制单页最大抓取数量为 80 个高优交互元素
    const MAX_ELEMENTS = 80;

    let truncatedElements = [];
    if (scoredElements.length <= MAX_ELEMENTS) {
      truncatedElements = scoredElements;
    } else {
      // 优先保留最高分元素（聚焦框、浮层、视口内表单按钮）
      const sortedByScore = [...scoredElements].sort((a, b) => b.score - a.score);
      const topSelected = sortedByScore.slice(0, MAX_ELEMENTS);
      // 保持原始页面几何排布顺序，确保编号逻辑连贯
      truncatedElements = topSelected.sort((a, b) => a.originalIndex - b.originalIndex);
    }

    // 敏感字段检测
    const sensitiveRegex = /password|passwd|passcode|verify[-_]?code|otp|cvv|credit[-_]?card|支付密码|验证码/i;

    const items = [];

    truncatedElements.forEach((item, idx) => {
      const index = idx + 1;
      const { el, tag, title, ariaLabel, placeholder, name } = item;
      let directText = item.directText;

      el.setAttribute('data-ext-elem-id', String(index));

      const type = el.getAttribute('type') || '';
      const role = el.getAttribute('role') || '';

      if (directText.length > 75) {
        directText = directText.slice(0, 72) + '...';
      }

      const attrs = [];
      if (type) attrs.push(`type="${type}"`);
      if (role) attrs.push(`role="${role}"`);
      if (placeholder) attrs.push(`placeholder="${placeholder}"`);
      if (ariaLabel) attrs.push(`aria-label="${ariaLabel}"`);
      if (title && title !== directText) attrs.push(`title="${title}"`);
      if (name) attrs.push(`name="${name}"`);

      const combinedInfo = `${name} ${placeholder} ${ariaLabel} ${title} ${directText}`;
      const isSensitive = sensitiveRegex.test(combinedInfo) || type === 'password';

      let valDesc = '';
      if (tag === 'input' || tag === 'textarea') {
        if (type === 'checkbox' || type === 'radio') {
          valDesc = el.checked ? ' [选中]' : ' [未选中]';
        } else if (isSensitive) {
          valDesc = ' [已输入敏感内容]';
        } else if (el.value) {
          const valSlice = el.value.length > 25 ? el.value.slice(0, 22) + '...' : el.value;
          valDesc = ` 当前值: "${valSlice}"`;
        }
      } else if (tag === 'select') {
        const selectedText = el.selectedOptions?.[0]?.text || '';
        valDesc = ` 当前选择: "${selectedText}"`;
      }

      const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
      const textStr = directText ? ` "${directText}"` : '';
      const sensitiveTag = isSensitive ? ' [敏感字段]' : '';

      items.push(`[${index}] <${tag}${attrStr}>${textStr}${valDesc}${sensitiveTag}`);
    });

    // Interactive controls alone omit KPI cards, paragraphs and table values.
    const contentRoot = document.querySelector('main, [role="main"], #main, .main-content, #content') || document.body;
    const textParts = [];
    let textChars = 0;
    let scanned = 0;
    if (contentRoot) {
      const walker = document.createTreeWalker(contentRoot, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode()) && scanned++ < 12000 && textChars < 14000) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style, noscript, textarea, input, [contenteditable="true"], .agent-integrated-capsule, .tab-mention-picker') || !isVisible(parent)) continue;
        const text = node.textContent.replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const part = text.slice(0, 14000 - textChars);
        textParts.push(part);
        textChars += part.length;
      }
    }
    const canvasCount = Array.from(document.querySelectorAll('canvas')).filter(isVisible).length;
    const scrollRoot = document.scrollingElement || document.documentElement;
    const scrollContainers = Array.from(document.querySelectorAll('body *')).filter(el => {
      return el.clientHeight > 100 && el.scrollHeight > el.clientHeight + 4 && isVisible(el) && /auto|scroll|overlay/.test(getComputedStyle(el).overflowY);
    }).sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth).slice(0, 4);
    const scrollState = [scrollRoot, ...scrollContainers.filter(el => el !== scrollRoot)].map(el => ({
      container: el === scrollRoot ? 'document' : el.tagName.toLowerCase(), top: Math.round(el.scrollTop), max: Math.max(0, el.scrollHeight - el.clientHeight)
    }));
    const isTruncated = filteredElements.length > MAX_ELEMENTS;
    const summaryText = [
      `=== 目标网页上下文 ===`,
      `页面标题: ${document.title || '无标题'}`,
      `页面地址: ${location.href}`,
      `核心交互元素: 共 ${filteredElements.length} 个${isTruncated ? ` (已优选展示前 ${MAX_ELEMENTS} 个核心焦点)` : ''}`,
      `滚动位置: ${JSON.stringify(scrollState)}`,
      `\n=== 页面正文与表格文本（最多 14000 字符，可能截断，不含输入框值） ===`,
      textParts.join('\n') || '(未提取到可读正文)',
      canvasCount ? `注意：页面含 ${canvasCount} 个 canvas，图表内部数值不能靠 DOM 文本可靠读取；不要推测未展示的数据。` : '',
      `\n=== 可交互元素清单 ===`,
      items.length > 0 ? items.join('\n') : '(当前页面未检测到可交互的表单或按钮控件)',
      `\n=======================`
    ].join('\n');

    return {
      title: document.title,
      url: location.href,
      totalCount: filteredElements.length,
      textChars,
      canvasCount,
      scrollState,
      snapshotText: summaryText
    };
  }

  return distillPageDOM();
})();
