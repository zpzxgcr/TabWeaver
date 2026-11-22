/**
 * TabWeaver Official Landing Page Main Script
 * Includes: Automatic Browser Language Detection, i18n Switching,
 * Video Showcase Tabs, Lightbox Gallery, and FAQ Accordion.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // =========================================================================
  // 1. Multilingual i18n System (Automatic Browser Language Detection)
  // =========================================================================
  const LANG_NAMES = {
    'en': 'English',
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    'ja': '日本語',
    'ko': '한국어',
    'es': 'Español',
    'de': 'Deutsch',
    'fr': 'Français'
  };

  function detectUserLanguage() {
    // 1. Check local storage preference
    const saved = localStorage.getItem('tabweaver_lang');
    if (saved && I18N_DATA[saved]) {
      return saved;
    }

    // 2. Read browser language
    const navLangs = navigator.languages || [navigator.language || navigator.userLanguage || 'en'];
    for (const raw of navLangs) {
      const lower = raw.toLowerCase();
      if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-mo')) {
        return 'zh-TW';
      }
      if (lower.startsWith('zh')) {
        return 'zh-CN';
      }
      if (lower.startsWith('ja')) {
        return 'ja';
      }
      if (lower.startsWith('ko')) {
        return 'ko';
      }
      if (lower.startsWith('es')) {
        return 'es';
      }
      if (lower.startsWith('de')) {
        return 'de';
      }
      if (lower.startsWith('fr')) {
        return 'fr';
      }
      if (lower.startsWith('en')) {
        return 'en';
      }
    }

    // 3. Fallback to English
    return 'en';
  }

  let currentLang = detectUserLanguage();

  function applyLanguage(lang) {
    if (!I18N_DATA[lang]) {
      lang = 'en';
    }
    currentLang = lang;
    localStorage.setItem('tabweaver_lang', lang);
    document.documentElement.lang = lang;

    // Update label text
    const langLabel = document.getElementById('current-lang-text');
    if (langLabel) {
      langLabel.textContent = LANG_NAMES[lang] || 'English';
    }

    // Translate DOM elements
    const elements = document.querySelectorAll('[data-i18n]');
    const dict = I18N_DATA[lang] || I18N_DATA['en'];
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = dict[key];
        } else {
          el.textContent = dict[key];
        }
      }
    });

    // Re-render platforms names with localized labels if needed
    renderPlatforms();
  }

  // Language Dropdown Events
  const langBtn = document.getElementById('lang-btn');
  const langMenu = document.getElementById('lang-menu');

  if (langBtn && langMenu) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = langMenu.hasAttribute('hidden');
      if (isHidden) {
        langMenu.removeAttribute('hidden');
        langBtn.setAttribute('aria-expanded', 'true');
      } else {
        langMenu.setAttribute('hidden', '');
        langBtn.setAttribute('aria-expanded', 'false');
      }
    });

    langMenu.querySelectorAll('li').forEach(item => {
      item.addEventListener('click', () => {
        const selected = item.getAttribute('data-lang');
        if (selected) {
          applyLanguage(selected);
        }
        langMenu.setAttribute('hidden', '');
        langBtn.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', () => {
      langMenu.setAttribute('hidden', '');
      langBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // =========================================================================
  // 2. 18 Compatible Platforms Showcase (Official SVGs & Brand Badges)
  // =========================================================================
  const PLATFORMS_DATA = [
    { id: 'deepseek', nameEn: 'DeepSeek', nameZh: 'DeepSeek', color: '#4D6BFE', url: 'https://chat.deepseek.com' },
    { id: 'chatgpt', nameEn: 'ChatGPT', nameZh: 'ChatGPT', color: '#10A37F', url: 'https://chatgpt.com' },
    { id: 'claude', nameEn: 'Claude', nameZh: 'Claude', color: '#D97757', url: 'https://claude.ai' },
    { id: 'gemini', nameEn: 'Google Gemini', nameZh: 'Google Gemini', color: '#3186FF', url: 'https://gemini.google.com' },
    { id: 'kimi', nameEn: 'Kimi', nameZh: 'Kimi 月之暗面', color: '#00D2B4', url: 'https://kimi.moonshot.cn' },
    { id: 'yuanbao', nameEn: 'Tencent Yuanbao', nameZh: '腾讯元宝', color: '#0055E9', url: 'https://yuanbao.tencent.com' },
    { id: 'doubao', nameEn: 'Doubao', nameZh: '豆包', color: '#1E37FC', url: 'https://www.doubao.com' },
    { id: 'qianwen', nameEn: 'Tongyi Qianwen', nameZh: '通义千问', color: '#082DFF', url: 'https://www.tongyi.cn' },
    { id: 'grok', nameEn: 'Grok', nameZh: 'Grok (xAI)', color: '#0F172A', url: 'https://x.com/i/grok' },
    { id: 'perplexity', nameEn: 'Perplexity AI', nameZh: 'Perplexity AI', color: '#22B8CD', url: 'https://www.perplexity.ai' },
    { id: 'minimax', nameEn: 'Hailuo AI (MiniMax)', nameZh: '海螺 AI', color: '#FE603C', url: 'https://hailuoai.com' },
    { id: 'stepfun', nameEn: 'StepFun', nameZh: '跃问', color: '#6366F1', url: 'https://yuewen.cn' },
    { id: 'baichuan', nameEn: 'Baichuan', nameZh: '百小应', color: '#EC4899', url: 'https://ying.baichuan-ai.com' },
    { id: 'zhipu', nameEn: 'Zhipu Qingyan', nameZh: '智谱清言', color: '#3859FF', url: 'https://chatglm.cn' },
    { id: 'wenxiaoyan', nameEn: 'Wenxiaoyan (Baidu)', nameZh: '文小言 (文心一言)', color: '#0A51C3', url: 'https://yiyan.baidu.com' },
    { id: 'xinghuo', nameEn: 'iFlytek Spark', nameZh: '讯飞星火', color: '#1652D8', url: 'https://xinghuo.xfyun.cn' },
    { id: 'qwen', nameEn: 'Qwen AI', nameZh: 'Qwen 国际版', color: '#082DFF', url: 'https://chat.qwen.ai' },
    { id: 'nami', nameEn: 'Nami AI', nameZh: '纳米 AI', color: '#10B981', url: 'https://www.nami.ai' }
  ];

  function renderPlatforms() {
    const container = document.getElementById('platforms-container');
    if (!container) return;

    const isZh = currentLang.startsWith('zh');
    container.innerHTML = '';

    PLATFORMS_DATA.forEach(p => {
      const a = document.createElement('a');
      a.className = 'platform-badge';
      a.href = p.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      const dot = document.createElement('span');
      dot.style.cssText = `width: 10px; height: 10px; border-radius: 50%; background: ${p.color}; flex-shrink: 0; box-shadow: 0 0 8px ${p.color};`;

      const span = document.createElement('span');
      span.className = 'platform-name';
      span.textContent = isZh ? p.nameZh : p.nameEn;

      a.appendChild(dot);
      a.appendChild(span);
      container.appendChild(a);
    });
  }

  // =========================================================================
  // 3. Showcase Tabs & Video Player Logic
  // =========================================================================
  const tabBtns = document.querySelectorAll('.showcase-tab-btn');
  const panels = document.querySelectorAll('.showcase-panel');
  const video1 = document.getElementById('video-case1');
  const video2 = document.getElementById('video-case2');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const activePanel = document.getElementById(`content-${target}`);
      if (activePanel) {
        activePanel.classList.add('active');
      }

      // Handle video playback
      if (target === 'case1') {
        if (video1) { video1.currentTime = 0; video1.play().catch(() => {}); }
        if (video2) { video2.pause(); }
      } else if (target === 'case2') {
        if (video2) { video2.currentTime = 0; video2.play().catch(() => {}); }
        if (video1) { video1.pause(); }
      } else {
        if (video1) video1.pause();
        if (video2) video2.pause();
      }
    });
  });

  // =========================================================================
  // 4. Lightbox Modal for Process Gallery
  // =========================================================================
  const lightbox = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');

  document.querySelectorAll('.gallery-card').forEach(card => {
    card.addEventListener('click', () => {
      const src = card.getAttribute('data-img');
      if (src && lightbox && lightboxImg) {
        lightboxImg.src = src;
        lightbox.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  function closeLightbox() {
    if (lightbox) {
      lightbox.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }
  }

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target.classList.contains('lightbox-backdrop') || e.target === lightbox) {
        closeLightbox();
      }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && !lightbox.hasAttribute('hidden')) {
      closeLightbox();
    }
  });

  // =========================================================================
  // 5. FAQ Accordion Interaction
  // =========================================================================
  document.querySelectorAll('.faq-item').forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
        if (!isOpen) {
          item.classList.add('open');
        }
      });
    }
  });

  // =========================================================================
  // 6. Mobile Menu Drawer Toggle
  // =========================================================================
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
    });

    mobileMenu.querySelectorAll('.m-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
      });
    });
  }

  // =========================================================================
  // 7. Initialize Application
  // =========================================================================
  applyLanguage(currentLang);
});
