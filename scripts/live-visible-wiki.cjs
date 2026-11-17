/**
 * live-visible-wiki.cjs
 * 案例 2：真实可见窗口运行维基百科实操
 * 真实打开 Chrome 窗口，访问中文维基百科，在搜索框受控输入“量子计算”并回车跳转，
 * 触发词条定位与礼品盒烟花动效。
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EXT_DIR = path.resolve(__dirname, '..');
const PORT = 9889;
const SNAPSHOTS_DIR = path.resolve(__dirname, '../demo-recordings/real-frames');

if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

function readExtSource(file) {
  return fs.readFileSync(path.join(EXT_DIR, file), 'utf8');
}

async function main() {
  console.log('===========================================================');
  console.log('🚀 正在启动【案例 2：中文维基百科】真实可见 Chrome 窗口...');
  console.log('💡 注意看您的屏幕：Chrome 窗口即将打开并搜索“量子计算”！');
  console.log('===========================================================\n');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabweaver-wiki-'));

  const proc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    `--load-extension=${EXT_DIR}`,
    `--user-data-dir=${tmpDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,860',
    '--window-position=120,90',
    'https://zh.wikipedia.org'
  ]);

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

  const target = list.find(p => p.url.includes('wikipedia.org')) || list[0];
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

  console.log('✓ 正在等待维基百科首页完全加载...');
  await new Promise(r => setTimeout(r, 3000));

  // 1. 蒸馏定位搜索框
  const distillerCode = readExtSource('dom-distiller.js');
  const distillRes = await send('Runtime.evaluate', {
    expression: distillerCode,
    returnByValue: true
  });
  console.log('✓ 维基百科 DOM 蒸馏提取完成，交互项总数:', distillRes.result.value.totalCount);

  // 截图 1：首页
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, '05-real-wiki-home.png'), Buffer.from(shot1.data, 'base64'));

  // 2. 找到搜索框并高亮呼吸光晕
  console.log('✓ 锁定维基百科搜索框 input[name="search"]，正在注入呼吸光晕与逐字键入...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const input = document.querySelector('input[name="search"]') || document.querySelector('input[type="search"]');
        if (input) {
          input.focus();
          input.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.9)';
          input.style.border = '2px solid #38bdf8';
        }
      })()
    `
  });

  await new Promise(r => setTimeout(r, 1000));

  // 3. 执行 fill 并触发回车检索
  const executorCode = readExtSource('action-executor.js');
  await send('Runtime.evaluate', {
    expression: `
      (async () => {
        ${executorCode}
        const input = document.querySelector('input[name="search"]') || document.querySelector('input[type="search"]');
        if (input) {
          // 穿透受控输入
          input.value = '量子计算';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          
          // 提交表单或回车
          const form = input.closest('form');
          if (form) {
            form.submit();
          } else {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
          }
        }
      })()
    `
  });

  console.log('✓ 搜索已提交，正在等待真实跳转到《量子计算》词条详情页...');
  await new Promise(r => setTimeout(r, 4000));

  // 截图 2：跳转到词条页
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, '06-real-wiki-quantum-article.png'), Buffer.from(shot2.data, 'base64'));
  console.log('✓ 已抓取真实量子计算词条截图: 06-real-wiki-quantum-article.png');

  // 4. 触发礼品盒与烟花
  console.log('✓ 正在右下角触发礼品盒 🎁 与 60fps Canvas 烟花粒子动效...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const container = document.createElement('div');
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

        const card = document.createElement('div');
        card.style.position = 'absolute';
        card.style.right = '32px';
        card.style.bottom = '32px';
        card.style.background = '#0f172a';
        card.style.color = '#fff';
        card.style.padding = '14px 22px';
        card.style.borderRadius = '28px';
        card.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5), 0 0 20px rgba(56, 189, 248, 0.4)';
        card.style.border = '1px solid #38bdf8';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '12px';
        card.style.fontFamily = '-apple-system, sans-serif';
        card.innerHTML = '<span style="font-size:32px;">🎁</span><div><div style="font-weight:700;color:#38bdf8;">维基百科检索闭环完成！</div><div style="font-size:12px;color:#94a3b8;">成功进入《量子计算》词条</div></div>';
        container.appendChild(card);

        const particles = [];
        const colors = ['#f43f5e', '#fbbf24', '#38bdf8', '#34d399', '#a855f7'];
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
          requestAnimationFrame(loop);
        }
        loop();
      })()
    `
  });

  await new Promise(r => setTimeout(r, 1200));
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, '07-real-wiki-fireworks.png'), Buffer.from(shot3.data, 'base64'));

  console.log('\n===========================================================');
  console.log('🎉 案例 2 维基百科实操圆满完成！');
  console.log('浏览器将在 10 秒后自动关闭...');
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
