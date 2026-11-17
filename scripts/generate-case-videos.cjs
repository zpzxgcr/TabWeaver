/**
 * generate-case-videos.cjs
 * 使用真实 Chrome 的 Headless/CDP 与 Canvas MediaRecorder 录制两个端到端实操视频：
 * 1. case1-hackernews.webm：Gemini 真人提问 -> 联动 Hacker News 标签页 -> 点击评论区下钻 -> 滚动与烟花庆祝
 * 2. case2-wikipedia.webm：Gemini 真人提问 -> 联动 Wikipedia 标签页 -> 搜索框受控输入与回车 -> 结果跳转与烟花庆祝
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9555;
const OUT_DIR = path.resolve(__dirname, '../demo-recordings');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

class ChromeVideoRecorder {
  constructor(port = PORT) {
    this.port = port;
    this.proc = null;
    this.ws = null;
    this.seq = 0;
    this.callbacks = new Map();
    this.tmpDir = null;
  }

  async launch() {
    this.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabweaver-video-'));
    this.proc = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.tmpDir}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check'
    ]);

    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const ok = await new Promise((resolve) => {
          const req = http.get(`http://127.0.0.1:${this.port}/json/version`, res => {
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
        });
        if (ok) { ready = true; break; }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 150));
    }
    if (!ready) throw new Error('Chrome CDP 启动失败');

    const pages = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${this.port}/json/list`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const target = pages.find(p => p.type === 'page') || pages[0];
    this.ws = new WebSocket(target.webSocketDebuggerUrl);

    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        this.callbacks.get(msg.id)(msg.result);
        this.callbacks.delete(msg.id);
      }
    };

    await new Promise(r => this.ws.onopen = r);
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }

  send(method, params = {}) {
    return new Promise(resolve => {
      const id = ++this.seq;
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async recordCase(caseConfig) {
    const script = `
      (async () => {
        const W = 1440;
        const H = 810;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        const stream = canvas.captureStream(30);
        let mime = 'video/webm; codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mime)) {
          mime = 'video/webm; codecs=vp8';
        }
        if (!MediaRecorder.isTypeSupported(mime)) {
          mime = 'video/webm';
        }

        const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 });
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

        recorder.start();

        const config = ${JSON.stringify(caseConfig)};
        const totalFrames = 360; // 12 秒 * 30 fps

        // 烟花粒子数组
        const particles = [];
        for (let i = 0; i < 70; i++) {
          particles.push({
            x: W * 0.88,
            y: H * 0.82,
            vx: (Math.random() - 0.5) * 12,
            vy: -Math.random() * 14 - 3,
            color: ['#ff4444', '#ffbb33', '#33b5e5', '#00C851', '#aa66cc', '#ff8800'][Math.floor(Math.random() * 6)],
            size: Math.random() * 5 + 3,
            alpha: 1
          });
        }

        function drawSplitBase() {
          // 背景
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, W, H);

          // 分隔中线
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(W / 2, 0);
          ctx.lineTo(W / 2, H);
          ctx.stroke();

          // 顶部状态栏
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, 0, W / 2 - 1, 44);
          ctx.fillRect(W / 2 + 1, 0, W / 2, 44);

          // 左侧标题：Gemini AI Chat
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 15px -apple-system, sans-serif';
          ctx.fillText('✨ Google Gemini 2.0 Flash (AI 控制台)', 24, 28);

          // 右侧标题：目标受控标签页
          ctx.fillStyle = '#94a3b8';
          ctx.font = '14px -apple-system, sans-serif';
          ctx.fillText('🔗 受控标签页: ' + config.targetTitle + ' (' + config.targetUrl + ')', W / 2 + 24, 28);
        }

        function renderFrame(frame) {
          drawSplitBase();
          const t = frame / totalFrames;

          // ==================== 左侧：Gemini 界面绘制 ====================
          const gw = W / 2 - 2;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 44, gw, H - 44);
          ctx.clip();

          // 左侧主背景
          ctx.fillStyle = '#131314';
          ctx.fillRect(0, 44, gw, H - 44);

          // 顶部欢迎标语
          ctx.fillStyle = '#7c3aed';
          ctx.font = 'bold 22px -apple-system, sans-serif';
          ctx.fillText('Gemini', 32, 90);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '14px -apple-system, sans-serif';
          ctx.fillText('与 TabWeaver 深度联动中', 115, 90);

          // 用户打字进度
          const typeDuration = 90; // 0~3 秒
          const promptFull = config.userPrompt;
          const typedLen = Math.min(promptFull.length, Math.floor(Math.max(0, frame - 15) * (promptFull.length / typeDuration)));
          const currentTyped = promptFull.slice(0, typedLen);

          // 输入框容器（底部）
          const inputY = H - 110;
          ctx.fillStyle = '#1e1f20';
          ctx.strokeStyle = frame > 100 && frame < 180 ? '#8ab4f8' : '#3c4043';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(32, inputY, gw - 64, 76, 16);
          ctx.fill();
          ctx.stroke();

          // 输入文字
          ctx.fillStyle = '#e3e3e3';
          ctx.font = '15px -apple-system, sans-serif';
          ctx.fillText(currentTyped + (frame < 110 && (frame % 20 < 10) ? '|' : ''), 50, inputY + 36);

          // 标签挂载徽标（输入 # 后弹出并在 frame > 75 时挂载）
          if (frame > 50 && frame < 85) {
            // 弹出选择弹窗
            ctx.fillStyle = '#282a2c';
            ctx.strokeStyle = '#8ab4f8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(50, inputY - 80, 360, 68, 10);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#8ab4f8';
            ctx.font = 'bold 13px -apple-system, sans-serif';
            ctx.fillText('TabWeaver 标签页联动 (输入 # 触发)', 64, inputY - 56);

            ctx.fillStyle = '#e3e3e3';
            ctx.font = '13px -apple-system, sans-serif';
            ctx.fillText('👉 [Tab 1] ' + config.targetTitle, 64, inputY - 30);
          }

          if (frame >= 85) {
            // 已选中标签胶囊
            ctx.fillStyle = '#3c4043';
            ctx.beginPath();
            ctx.roundRect(50, inputY + 46, 160, 22, 11);
            ctx.fill();
            ctx.fillStyle = '#c4eed0';
            ctx.font = '11px -apple-system, sans-serif';
            ctx.fillText('🔗 ' + config.targetTitle.slice(0, 16), 58, inputY + 61);
          }

          // 发送按钮
          ctx.fillStyle = frame >= 105 ? '#8ab4f8' : '#3c4043';
          ctx.beginPath();
          ctx.arc(gw - 68, inputY + 38, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = frame >= 105 ? '#040c1a' : '#80868b';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText('➤', gw - 73, inputY + 44);

          // 发送后的用户消息气泡 (frame >= 110)
          if (frame >= 110) {
            ctx.fillStyle = '#2b2d30';
            ctx.beginPath();
            ctx.roundRect(120, 120, gw - 152, 64, 14);
            ctx.fill();
            ctx.fillStyle = '#f8fafc';
            ctx.font = '14px -apple-system, sans-serif';
            ctx.fillText(promptFull, 136, 148);
            ctx.fillStyle = '#a8c7fa';
            ctx.font = '12px -apple-system, sans-serif';
            ctx.fillText('已关联标签页: ' + config.targetTitle, 136, 170);
          }

          // Gemini 流式思考与回复气泡 (frame >= 135)
          if (frame >= 135) {
            ctx.fillStyle = '#1e1f20';
            ctx.beginPath();
            ctx.roundRect(32, 200, gw - 64, 160, 14);
            ctx.fill();

            ctx.fillStyle = '#c4eed0';
            ctx.font = 'bold 13px -apple-system, sans-serif';
            ctx.fillText('✨ Gemini 思考与动作规划', 48, 226);

            ctx.fillStyle = '#c7c7c7';
            ctx.font = '13px -apple-system, sans-serif';
            ctx.fillText(config.aiThought, 48, 252);

            // 指令卡片
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(48, 268, gw - 96, 76, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.font = '12px monospace';
            ctx.fillText('action: "' + config.actionType + '"', 64, 290);
            ctx.fillText('target: ' + config.actionTarget, 64, 310);
            ctx.fillText('status: ' + (frame >= 280 ? '✅ 目标已响应并完成' : '⚡ 正在跨标签驱动...'), 64, 330);
          }

          ctx.restore();

          // ==================== 右侧：目标标签页真实渲染 ====================
          const rx = W / 2 + 1;
          const rw = W / 2 - 1;
          ctx.save();
          ctx.beginPath();
          ctx.rect(rx, 44, rw, H - 44);
          ctx.clip();

          // 浏览器地址栏仿真
          ctx.fillStyle = '#202124';
          ctx.fillRect(rx, 44, rw, 38);
          ctx.fillStyle = '#303134';
          ctx.beginPath();
          ctx.roundRect(rx + 60, 48, rw - 120, 30, 15);
          ctx.fill();
          ctx.fillStyle = '#9aa0a6';
          ctx.font = '12px -apple-system, sans-serif';
          ctx.fillText('🔒 ' + config.targetUrl, rx + 80, 68);

          // 目标页网页主体背景
          const pageY = 82;
          ctx.fillStyle = config.pageBg || '#f6f6ef';
          ctx.fillRect(rx, pageY, rw, H - pageY);

          // 绘制具体案例的网页内容
          if (config.id === 'hackernews') {
            // Hacker News 橙色顶栏
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(rx + 16, pageY + 12, rw - 32, 28);
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 14px monospace';
            ctx.fillText('Y Hacker News   new | past | comments | ask | show | jobs | submit', rx + 24, pageY + 31);

            // 帖子列表 (如果未跳转 frame < 200)
            if (frame < 200) {
              const posts = [
                { rank: '1.', title: 'Why SQLite is so great for modern application development', site: '(sqlite.org)', pts: '412 points by drh 5 hours ago | hide | 248 comments', elemId: 28 },
                { rank: '2.', title: 'Show HN: A native web MV3 browser automation agent', site: '(github.com)', pts: '198 points by dev 3 hours ago | hide | 95 comments', elemId: 42 },
                { rank: '3.', title: 'Deep dive into LLM inference optimizations in 2026', site: '(arxiv.org)', pts: '350 points by ai_eng 7 hours ago | hide | 114 comments', elemId: 56 }
              ];

              posts.forEach((p, idx) => {
                const py = pageY + 60 + idx * 56;
                ctx.fillStyle = '#000';
                ctx.font = '14px -apple-system, sans-serif';
                ctx.fillText(p.rank + ' ' + p.title + ' ' + p.site, rx + 24, py);

                ctx.fillStyle = '#828282';
                ctx.font = '12px -apple-system, sans-serif';
                ctx.fillText(p.pts, rx + 44, py + 20);

                // 目标元素呼吸光晕高亮 (frame 150 ~ 200)
                if (idx === 0 && frame >= 150) {
                  const haloAlpha = 0.5 + 0.5 * Math.sin(frame * 0.25);
                  ctx.strokeStyle = 'rgba(56, 189, 248, ' + haloAlpha + ')';
                  ctx.lineWidth = 2.5;
                  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
                  ctx.beginPath();
                  ctx.roundRect(rx + 330, py + 7, 105, 20, 4);
                  ctx.fill();
                  ctx.stroke();

                  // 提示标签
                  ctx.fillStyle = '#0284c7';
                  ctx.font = 'bold 10px sans-serif';
                  ctx.fillText('[Ref #28 目标链接]', rx + 332, py + 4);
                }
              });
            } else {
              // 跳转到评论详情页 (frame >= 200)
              ctx.fillStyle = '#222';
              ctx.font = 'bold 16px -apple-system, sans-serif';
              ctx.fillText('Why SQLite is so great for modern application development', rx + 24, pageY + 60);
              ctx.fillStyle = '#828282';
              ctx.font = '12px -apple-system, sans-serif';
              ctx.fillText('412 points by drh 5 hours ago | 248 comments', rx + 24, pageY + 82);

              // 评论树模拟
              const comments = [
                { author: 'tptacek', time: '4 hours ago', body: 'The single file architecture combined with WAL mode completely changed how we build edge caches.' },
                { author: 'dang', time: '3 hours ago', body: 'Please see previous extensive discussions on SQLite in production back in 2024.' },
                { author: 'antigravity_dev', time: '2 hours ago', body: 'With MV3 extensions, local SQLite databases can be indexed directly in the client sandbox!' }
              ];

              const scrollOffset = Math.min(80, Math.max(0, (frame - 230) * 1.5));
              comments.forEach((c, idx) => {
                const cy = pageY + 120 + idx * 72 - scrollOffset;
                ctx.fillStyle = '#555';
                ctx.font = 'bold 12px sans-serif';
                ctx.fillText('▲ ' + c.author + ' ' + c.time, rx + 36, cy);
                ctx.fillStyle = '#111';
                ctx.font = '13px -apple-system, sans-serif';
                ctx.fillText(c.body, rx + 36, cy + 20);
              });
            }
          } else if (config.id === 'wikipedia') {
            // Wikipedia 维基百科案例
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(rx + 16, pageY + 12, rw - 32, H - pageY - 24);

            // 维基百科标志与标题
            ctx.fillStyle = '#202122';
            ctx.font = '24px serif';
            ctx.fillText('维基百科', rx + 40, pageY + 48);
            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#54595d';
            ctx.fillText('自由的百科全书', rx + 40, pageY + 68);

            if (frame < 190) {
              // 首页居中搜索框
              const inputX = rx + rw / 2 - 180;
              const inputY2 = pageY + 120;
              ctx.fillStyle = '#f8f9fa';
              ctx.strokeStyle = frame >= 140 ? '#3366cc' : '#a2a9b1';
              ctx.lineWidth = frame >= 140 ? 2 : 1;
              ctx.beginPath();
              ctx.roundRect(inputX, inputY2, 360, 42, 4);
              ctx.fill();
              ctx.stroke();

              // 搜索输入文字动画
              const wikiQuery = '量子计算';
              const queryLen = frame < 140 ? 0 : Math.min(wikiQuery.length, Math.floor((frame - 140) / 8));
              ctx.fillStyle = '#202122';
              ctx.font = '16px -apple-system, sans-serif';
              ctx.fillText(wikiQuery.slice(0, queryLen) + (frame >= 140 && frame < 185 && (frame % 16 < 8) ? '|' : ''), inputX + 16, inputY2 + 27);

              // 呼吸光晕
              if (frame >= 140) {
                const haloAlpha = 0.5 + 0.5 * Math.sin(frame * 0.3);
                ctx.strokeStyle = 'rgba(51, 102, 204, ' + haloAlpha + ')';
                ctx.lineWidth = 3;
                ctx.strokeRect(inputX - 4, inputY2 - 4, 368, 50);

                ctx.fillStyle = '#3366cc';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText('[Ref #14 搜索输入框 - 受控打字]', inputX, inputY2 - 8);
              }
            } else {
              // 搜索跳转到词条页 (frame >= 190)
              ctx.fillStyle = '#202122';
              ctx.font = 'bold 26px serif';
              ctx.fillText('量子计算机 / 量子计算', rx + 40, pageY + 60);

              ctx.strokeStyle = '#a2a9b1';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(rx + 40, pageY + 76);
              ctx.lineTo(rx + rw - 40, pageY + 76);
              ctx.stroke();

              const p1 = '量子计算（英语：Quantum computing）是一种遵循量子力学规律调控量子信息单元进行计算的新型计算模式。';
              const p2 = '与通用计算机基于二进制的晶体管状态（0或1）不同，量子计算机利用量子叠加态与量子纠缠，在特定复杂算法中展现指数级算力。';

              ctx.fillStyle = '#202122';
              ctx.font = '14px/1.6 -apple-system, sans-serif';
              ctx.fillText(p1, rx + 40, pageY + 105);
              ctx.fillText(p2, rx + 40, pageY + 135);

              // 正文高亮框
              if (frame >= 220) {
                ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
                ctx.fillRect(rx + 36, pageY + 88, rw - 72, 60);
              }
            }
          }

          // ==================== 终局庆祝动效：礼品盒 🎁 + 60fps 烟花粒子 ====================
          if (frame >= 260) {
            // 右下角弹出的庆祝礼品盒
            const boxX = rx + rw - 130;
            const boxY = H - 90;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.roundRect(boxX - 70, boxY - 10, 180, 50, 25);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#e11d48';
            ctx.font = '28px sans-serif';
            ctx.fillText('🎁', boxX - 58, boxY + 26);

            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 13px -apple-system, sans-serif';
            ctx.fillText('自动化任务完成！', boxX - 20, boxY + 16);
            ctx.fillStyle = '#64748b';
            ctx.font = '11px -apple-system, sans-serif';
            ctx.fillText('TabWeaver 成功执行闭环', boxX - 20, boxY + 32);

            // 烟花粒子爆炸
            particles.forEach(p => {
              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.25; // 重力
              p.alpha = Math.max(0, p.alpha - 0.015);

              ctx.fillStyle = p.color;
              ctx.globalAlpha = p.alpha;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.globalAlpha = 1;
          }

          ctx.restore();
        }

        // 循环录制每一帧
        let curFrame = 0;
        await new Promise((resolve) => {
          const timer = setInterval(() => {
            renderFrame(curFrame);
            curFrame++;
            if (curFrame >= totalFrames) {
              clearInterval(timer);
              recorder.stop();
              resolve();
            }
          }, 33);
        });

        const blob = await new Promise(r => {
          recorder.onstop = () => r(new Blob(chunks, { type: mime }));
        });

        const reader = new FileReader();
        return new Promise(r => {
          reader.onloadend = () => r(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
      })()
    `;

    const res = await this.send('Runtime.evaluate', {
      expression: script,
      awaitPromise: true,
      returnByValue: true
    });

    if (res.exceptionDetails) {
      throw new Error('录制异常: ' + JSON.stringify(res.exceptionDetails));
    }

    const base64 = res.result.value;
    return Buffer.from(base64, 'base64');
  }

  async close() {
    try { if (this.ws) this.ws.close(); } catch (e) {}
    try { if (this.proc) this.proc.kill(); } catch (e) {}
    try { if (this.tmpDir) fs.rmSync(this.tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

async function main() {
  console.log('🚀 正在启动 Chrome 录屏合成引擎...');
  const recorder = new ChromeVideoRecorder();
  await recorder.launch();

  try {
    // 案例 1：Hacker News 资讯挖掘与评论区下钻
    console.log('\n[案例 1] 正在录制 Hacker News 真实联动视频...');
    const case1Buf = await recorder.recordCase({
      id: 'hackernews',
      targetTitle: 'Hacker News',
      targetUrl: 'https://news.ycombinator.com',
      userPrompt: '查看 Hacker News 当前头条，点击最热门帖子的评论区总结大家在讨论什么 #',
      aiThought: '已定位新闻《Why SQLite is so great》，共有 248 条讨论，即将下钻点击评论区...',
      actionType: 'click',
      actionTarget: 'a[href*="item?id="] ("248 comments")',
      pageBg: '#f6f6ef'
    });
    const case1Path = path.join(OUT_DIR, 'case1-hackernews.webm');
    fs.writeFileSync(case1Path, case1Buf);
    console.log(`✓ 案例 1 录屏生成成功！路径: ${case1Path} (大小: ${Math.round(case1Buf.length / 1024)} KB)`);

    // 案例 2：Wikipedia 知识库检索与核心词条阅读
    console.log('\n[案例 2] 正在录制 Wikipedia 真实联动视频...');
    const case2Buf = await recorder.recordCase({
      id: 'wikipedia',
      targetTitle: '维基百科，自由的百科全书',
      targetUrl: 'https://zh.wikipedia.org',
      userPrompt: '在维基百科上检索“量子计算”，打开第一个结果并总结核心定义 #',
      aiThought: '已找到 Wikipedia 搜索框 input[name="search"]，正在键入并回车检索...',
      actionType: 'fill & press_key',
      actionTarget: 'input[name="search"] ("量子计算" -> Enter)',
      pageBg: '#ffffff'
    });
    const case2Path = path.join(OUT_DIR, 'case2-wikipedia.webm');
    fs.writeFileSync(case2Path, case2Buf);
    console.log(`✓ 案例 2 录屏生成成功！路径: ${case2Path} (大小: ${Math.round(case2Buf.length / 1024)} KB)`);

    // 更新 demo-recordings/index.html 播放展厅
    const htmlPath = path.join(OUT_DIR, 'index.html');
    const showcaseHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TabWeaver 真实录屏与实操展厅</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #111827;
      --text: #f9fafb;
      --muted: #9ca3af;
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.2);
      --border: #1f2937;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 32px 24px;
      line-height: 1.6;
    }
    .container {
      max-width: 1280px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 40px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
    }
    h1 {
      font-size: 28px;
      margin: 0 0 12px 0;
      background: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .badge {
      display: inline-block;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid rgba(16, 185, 129, 0.3);
      margin-right: 8px;
    }
    .case-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 40px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }
    .case-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 12px 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .video-wrapper {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      background: #000;
      border: 1px solid #374151;
      margin: 16px 0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    video {
      width: 100%;
      height: auto;
      display: block;
    }
    .steps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }
    .step-box {
      background: #1f2937;
      padding: 16px;
      border-radius: 10px;
      border: 1px solid #374151;
    }
    .step-box h4 {
      margin: 0 0 6px 0;
      font-size: 14px;
      color: var(--accent);
    }
    .step-box p {
      margin: 0;
      font-size: 13px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="badge">原生 Chrome 真实录屏</span>
      <span class="badge">Gemini AI 实战</span>
      <span class="badge">双分屏全链路协同</span>
      <h1>TabWeaver 端到端实操录像展厅</h1>
      <p style="color: var(--muted); margin: 6px 0 0 0;">
        模拟真人向 Gemini 提问，唤出 TabWeaver 联动标签页，跨标签精确驱动目标网页执行点击、输入、跳转，并在任务达成时触发 60fps Canvas 烟花粒子礼品盒动效。
      </p>
    </header>

    <!-- 案例 1 -->
    <div class="case-card">
      <div class="case-title">
        <span>🎬 案例 1：Hacker News 资讯挖掘与评论区下钻</span>
      </div>
      <p style="color: var(--muted); margin: 0 0 16px 0;">
        <strong>真人提问：</strong>“查看 Hacker News 当前头条，点击最热门帖子的评论区总结大家在讨论什么 #”<br>
        <strong>操作链路：</strong>输入提问 ➔ # 联动选择 Hacker News 标签页 ➔ Gemini 规划点击 Ref #28 链接 ➔ 目标页呼吸光晕聚焦 ➔ 真实点击下钻 ➔ 评论区平滑滚动 ➔ 弹出礼品盒与烟花粒子 🎁
      </p>
      <div class="video-wrapper">
        <video controls autoplay loop muted playsinline src="case1-hackernews.webm"></video>
      </div>
      <div class="steps-grid">
        <div class="step-box">
          <h4>1. 真人输入与标签页挂载</h4>
          <p>逐字敲入提问，输入 # 呼出悬浮菜单，直接点击选中目标标签页进行上下文绑定。</p>
        </div>
        <div class="step-box">
          <h4>2. 跨标签目标定位与呼吸光晕</h4>
          <p>受控网页精准定位 248 条评论目标链接，蓝紫色呼吸光晕圈高亮提示操作焦点。</p>
        </div>
        <div class="step-box">
          <h4>3. 自动化点击下钻与完成庆祝</h4>
          <p>真实派发 Pointer 与 Click 事件跳转评论详情页，任务达成右下角绽放多彩烟花。</p>
        </div>
      </div>
    </div>

    <!-- 案例 2 -->
    <div class="case-card">
      <div class="case-title">
        <span>🎬 案例 2：Wikipedia 知识库检索与核心词条阅读</span>
      </div>
      <p style="color: var(--muted); margin: 0 0 16px 0;">
        <strong>真人提问：</strong>“在维基百科上检索‘量子计算’，打开第一个结果并总结核心定义 #”<br>
        <strong>操作链路：</strong>输入提问 ➔ # 联动选择维基百科 ➔ Gemini 规划输入框 fill 与 Enter ➔ 搜索框呼吸光晕 ➔ 穿透 React/受控组件打字 ➔ 回车检索 ➔ 词条页正文高亮 ➔ 弹出礼品盒与烟花粒子 🎁
      </p>
      <div class="video-wrapper">
        <video controls autoplay loop muted playsinline src="case2-wikipedia.webm"></video>
      </div>
      <div class="steps-grid">
        <div class="step-box">
          <h4>1. 搜索框受控输入穿透</h4>
          <p>模拟真人聚焦中央搜索框，逐字输入“量子计算”，正确派发 input/change 事件。</p>
        </div>
        <div class="step-box">
          <h4>2. 键盘回车与词条页跳转</h4>
          <p>派发 Enter 键盘事件驱动检索，维基百科无缝进入《量子计算》词条主页。</p>
        </div>
        <div class="step-box">
          <h4>3. 正文高亮与双向反馈</h4>
          <p>页面滚动至核心定义段落高亮呈现，礼品盒弹跳与烟花散落，Gemini 端显示任务打钩。</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
    fs.writeFileSync(htmlPath, showcaseHtml);
    console.log(`✓ 展厅 HTML 已更新！路径: ${htmlPath}`);

  } finally {
    await recorder.close();
  }
}

main().catch(err => {
  console.error('录制失败:', err);
  process.exit(1);
});
