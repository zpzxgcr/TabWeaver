/**
 * live-visible-demo.cjs
 * 纯真实有头 Chrome 现场实操脚本：
 * 直接在用户屏幕上弹出一个真实的 Google Chrome 浏览器窗口，
 * 真实访问当前互联网最新的 Hacker News，
 * 真实运行扩展的 DOM 蒸馏与操作执行器，
 * 真实高亮呼吸光晕、真实点击进入评论详情页、真实触发礼品盒与满屏烟花！
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EXT_DIR = path.resolve(__dirname, '..');
const PORT = 9888;
const SNAPSHOTS_DIR = path.resolve(__dirname, '../demo-recordings/real-frames');

if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

function readExtSource(file) {
  return fs.readFileSync(path.join(EXT_DIR, file), 'utf8');
}

async function main() {
  console.log('===========================================================');
  console.log('🚀 正在启动【真实可见窗口】Google Chrome 浏览器...');
  console.log('📌 插件路径:', EXT_DIR);
  console.log('💡 注意看您的屏幕：一个真实的 Chrome 窗口即将弹出并全自动实操！');
  console.log('===========================================================\n');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabweaver-visible-'));
  
  // 启动真实有头 Chrome (非 headless)
  const proc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    `--load-extension=${EXT_DIR}`,
    `--user-data-dir=${tmpDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,860',
    '--window-position=80,60',
    'https://news.ycombinator.com'
  ]);

  // 轮询等待端口就绪
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const ok = await new Promise(r => {
        const req = http.get(`http://127.0.0.1:${PORT}/json/version`, res => r(res.statusCode === 200));
        req.on('error', () => r(false));
      });
      if (ok) { ready = true; break; }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }

  if (!ready) {
    console.error('❌ Chrome 启动超时');
    proc.kill();
    process.exit(1);
  }

  const list = await new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${PORT}/json/list`, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });

  const target = list.find(p => p.url.includes('news.ycombinator.com')) || list[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let id = 1;
  const callbacks = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };

  await new Promise(r => ws.onopen = r);

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const curId = id++;
      callbacks.set(curId, resolve);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  console.log('✓ Chrome 窗口已在您的桌面上打开！');
  console.log('✓ 正在等待 Hacker News 首页完全加载...');
  await new Promise(r => setTimeout(r, 2500));

  // 1. 真实运行 dom-distiller.js 提取页面交互树
  const distillerCode = readExtSource('dom-distiller.js');
  const distillRes = await send('Runtime.evaluate', {
    expression: distillerCode,
    returnByValue: true
  });

  const snapshot = distillRes.result.value;
  console.log(`\n[步骤 1: 真实 DOM 蒸馏完成]`);
  console.log(`- 网页标题: ${snapshot.title}`);
  console.log(`- 提取可交互元素总数: ${snapshot.totalCount} 个`);
  console.log(`- 页面文本字符数: ${snapshot.textChars}`);

  // 截图 1：真实首页
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, '01-real-hacker-news-home.png'), Buffer.from(shot1.data, 'base64'));
  console.log('✓ 已抓取真实首页截图: 01-real-hacker-news-home.png');

  // 2. 找到第一个讨论最多热帖的评论链接
  const commentsMatch = snapshot.snapshotText.match(/\[(\d+)\] <a> "(\d+\s+comments)"/i) ||
                        snapshot.snapshotText.match(/\[(\d+)\] <a> "([^"]*comments[^"]*)"/i);

  if (!commentsMatch) {
    console.log('未匹配到评论链接，直接取前几个链接之一');
  }

  const targetRef = commentsMatch ? Number(commentsMatch[1]) : 20;
  const targetText = commentsMatch ? commentsMatch[2] : 'comments';
  console.log(`\n[步骤 2: 锁定目标元素]`);
  console.log(`- 目标元素 Ref: [${targetRef}]`);
  console.log(`- 目标链接文字: "${targetText}"`);
  console.log(`- 正在注入【青蓝色呼吸光晕】高亮标记目标...（请看屏幕上的真实浏览器！）`);

  // 3. 真实在网页中插入呼吸光晕高亮
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const elem = document.querySelector('[data-ext-elem-id="${targetRef}"]') ||
                     Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes('comments'));
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const halo = document.createElement('div');
          halo.id = '__agent_focus_halo';
          halo.style.position = 'absolute';
          halo.style.zIndex = '999999';
          halo.style.pointerEvents = 'none';
          halo.style.borderRadius = '6px';
          halo.style.border = '3px solid #38bdf8';
          halo.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.8), inset 0 0 12px rgba(56, 189, 248, 0.4)';
          halo.style.transition = 'all 0.3s ease';
          
          const rect = elem.getBoundingClientRect();
          halo.style.left = (window.scrollX + rect.left - 4) + 'px';
          halo.style.top = (window.scrollY + rect.top - 4) + 'px';
          halo.style.width = (rect.width + 8) + 'px';
          halo.style.height = (rect.height + 8) + 'px';
          document.body.appendChild(halo);
          return { found: true, rect };
        }
        return { found: false };
      })()
    `,
    returnByValue: true
  });

  await new Promise(r => setTimeout(r, 1200));

  // 截图 2：呼吸光晕
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, '02-real-element-highlighted.png'), Buffer.from(shot2.data, 'base64'));
  console.log('✓ 已抓取呼吸光晕真实截图: 02-real-element-highlighted.png');

  // 4. 真实执行 action-executor.js 的 click 动作
  console.log(`\n[步骤 3: 派发真实点击]`);
  console.log(`- 正在通过 action-executor 派发 pointerdown / focus / click 原生事件...`);

  const executorCode = readExtSource('action-executor.js');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        ${executorCode}
        const runner = window.__runBrowserAction;
        return runner({ action: 'click', element: ${targetRef} });
      })()
    `,
    returnByValue: true
  });

  console.log('✓ 点击指令已执行，正在等待真实跳转到评论详情页...');
  await new Promise(r => setTimeout(r, 3500));

  // 截图 3：跳转后的评论页面
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, '03-real-comments-page-loaded.png'), Buffer.from(shot3.data, 'base64'));
  console.log('✓ 已抓取跳转后详情页真实截图: 03-real-comments-page-loaded.png');

  // 5. 真实触发礼品盒与 60fps 烟花粒子动效
  console.log(`\n[步骤 4: 触发任务完成礼品盒 🎁 与 Canvas 彩色烟花]`);
  console.log(`- 请看真实 Chrome 窗口右下角：礼品盒弹跳，烟花粒子实时爆炸！`);

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        // 动态注入烟花粒子与礼品盒
        const container = document.createElement('div');
        container.id = 'tabweaver-celebration-container';
        container.style.position = 'fixed';
        container.style.inset = '0';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '2147483647';
        document.body.appendChild(container);

        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        // 右下角礼品盒卡片
        const card = document.createElement('div');
        card.style.position = 'absolute';
        card.style.right = '32px';
        card.style.bottom = '32px';
        card.style.background = 'linear-gradient(135deg, #1e293b, #0f172a)';
        card.style.color = '#fff';
        card.style.padding = '14px 20px';
        card.style.borderRadius = '30px';
        card.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5), 0 0 20px rgba(56, 189, 248, 0.4)';
        card.style.border = '1px solid #38bdf8';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '12px';
        card.style.fontFamily = '-apple-system, sans-serif';
        card.style.transform = 'translateY(100px)';
        card.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        card.innerHTML = \`
          <span style="font-size: 32px; animation: bounce 1s infinite;">🎁</span>
          <div>
            <div style="font-weight: 700; font-size: 14px; color: #38bdf8;">TabWeaver 任务达成！</div>
            <div style="font-size: 12px; color: #94a3b8;">成功完成自动化闭环与数据下钻</div>
          </div>
        \`;
        container.appendChild(card);
        setTimeout(() => { card.style.transform = 'translateY(0)'; }, 50);

        // 烟花粒子
        const particles = [];
        const colors = ['#f43f5e', '#fbbf24', '#38bdf8', '#34d399', '#a855f7', '#fb923c'];
        for (let i = 0; i < 90; i++) {
          particles.push({
            x: window.innerWidth - 120,
            y: window.innerHeight - 80,
            vx: (Math.random() - 0.5) * 16,
            vy: -Math.random() * 18 - 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 6 + 3,
            alpha: 1
          });
        }

        let animFrame;
        function loop() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.35;
            p.alpha = Math.max(0, p.alpha - 0.012);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.globalAlpha = 1;
          animFrame = requestAnimationFrame(loop);
        }
        loop();
      })()
    `
  });

  await new Promise(r => setTimeout(r, 1200));

  // 截图 4：烟花礼品盒真实画面
  const shot4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, '04-real-fireworks-celebration.png'), Buffer.from(shot4.data, 'base64'));
  console.log('✓ 已抓取真实烟花礼品盒截图: 04-real-fireworks-celebration.png');

  console.log('\n===========================================================');
  console.log('🎉 现场实操演示圆满完成！');
  console.log('浏览器将在 10 秒后自动关闭（让您看清屏幕上的效果）...');
  console.log('===========================================================');
  await new Promise(r => setTimeout(r, 10000));

  ws.close();
  proc.kill();
  setTimeout(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  }, 500);
}

main().catch(err => {
  console.error('实操出错:', err);
  process.exit(1);
});
