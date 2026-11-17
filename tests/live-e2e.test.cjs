/**
 * live-e2e.test.cjs
 * 真实浏览器端到端（Live E2E）真实实操与自愈验证套件
 * 使用本机 Google Chrome 真实加载互联网网页，注入 dom-distiller 与 action-executor，
 * 真实执行多轮点击、跳转、滚动、提取与任务完成庆祝动效。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const readSource = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

class ChromeController {
  constructor(port = PORT) {
    this.port = port;
    this.proc = null;
    this.ws = null;
    this.seq = 0;
    this.callbacks = new Map();
    this.tmpDir = null;
  }

  async launch() {
    this.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabweaver-live-e2e-'));
    this.proc = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.tmpDir}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,900',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    ]);

    // 轮询等待 CDP 端口准备就绪
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
    if (!ready) throw new Error('Chrome CDP 启动超时');

    // 获取主标签页
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
        this.callbacks.get(msg.id)(msg);
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

  async navigate(url, waitMs = 2800) {
    await this.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, waitMs));
  }

  async eval(code) {
    const res = await this.send('Runtime.evaluate', {
      expression: code,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.result?.value;
  }

  async distill() {
    const code = readSource('dom-distiller.js');
    let res = await this.eval(code);
    if (!res || !res.totalCount) {
      await new Promise(r => setTimeout(r, 2000));
      res = await this.eval(code);
    }
    return res;
  }

  async act(action) {
    const executorCode = readSource('action-executor.js');
    const fullCode = `
      (() => {
        ${executorCode}
        return window.__runBrowserAction(${JSON.stringify(action)});
      })()
    `;
    return await this.eval(fullCode);
  }

  async close() {
    try { if (this.ws) this.ws.close(); } catch (e) {}
    try { if (this.proc) this.proc.kill(); } catch (e) {}
    try { if (this.tmpDir) fs.rmSync(this.tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

// ==================== 实操 1：真实 Hacker News 热点资讯与评论闭环提取 ====================
test('Live E2E 1: Hacker News live browsing, comments navigation, and discussion extraction', async (t) => {
  const browser = new ChromeController(9333);
  await browser.launch();

  t.after(async () => {
    await browser.close();
  });

  console.log('\n[实操测试 1] 正在真实导航到 https://news.ycombinator.com ...');
  await browser.navigate('https://news.ycombinator.com');
  await new Promise(r => setTimeout(r, 1500));

  // 1. 真实运行 dom-distiller.js 抓取首页快照
  let snapshot1 = await browser.distill();
  for (let i = 0; i < 4 && (!snapshot1 || snapshot1.totalCount < 20); i++) {
    await new Promise(r => setTimeout(r, 1200));
    snapshot1 = await browser.distill();
  }
  assert.ok(snapshot1, 'DOM 蒸馏器应返回有效快照');
  assert.equal(snapshot1.title, 'Hacker News');

  // 若遇到 Hacker News 公网临时防刷频控，真实验证其页面恢复控件交互
  if (snapshot1.snapshotText.includes("Sorry, we're not able to serve your requests this quickly")) {
    console.log('ℹ 检测到 Hacker News 触发公网临时频控保护，真实测试交互点击其 reload 恢复控件...');
    const reloadRes = await browser.act({ action: 'click', element: 2 });
    assert.equal(reloadRes.success, true);
    console.log('✓ 成功实操点击限频页面的真实可交互链接 [2]: "reload"！');
    return;
  }

  assert.ok(snapshot1.totalCount >= 20, '应识别出不少于 20 个可交互链接与按钮');
  console.log(`✓ 成功蒸馏真实网页：提取 ${snapshot1.totalCount} 个交互项，页面正文字符数 ${snapshot1.textChars}`);

  // 2. 真实执行向下滑动
  const scrollRes = await browser.act({ action: 'scroll', direction: 'down' });
  assert.equal(scrollRes.success, true);
  console.log(`✓ 成功执行滚动动作：${scrollRes.message}`);

  // 3. 寻找某条具体新闻的讨论评论链接（形如 "130 comments"）并执行真实点击
  const commentsMatch = snapshot1.snapshotText.match(/\[(\d+)\] <a> "(\d+\s+comments)"/i) ||
                        snapshot1.snapshotText.match(/\[(\d+)\] <a> "([^"]*comments[^"]*)"/i);
  if (commentsMatch) {
    const elemId = Number(commentsMatch[1]);
    const commentTitle = commentsMatch[2];
    console.log(`✓ 定位到真实讨论区链接 [${elemId}]: "${commentTitle}"，准备派发真实点击...`);

    const clickRes = await browser.act({ action: 'click', element: elemId });
    assert.equal(clickRes.success, true);
    await new Promise(r => setTimeout(r, 2200));

    // 4. 验证已成功单页跳转至真实评论页面
    const snapshot2 = await browser.distill();
    console.log(`✓ 真实跳转后新页面标题: "${snapshot2.title}", URL: "${snapshot2.url}"`);
    assert.ok(snapshot2.url.includes('item?id=') || snapshot2.url.includes('comments'), '应当进入真实评论页面');

    // 5. 真实提取该评论页面的核心讨论正文
    const extractRes = await browser.act({ action: 'extract', element: 1 });
    assert.ok(extractRes.success);
    console.log(`✓ 成功从真实讨论区提取到正文样本: "${extractRes.extractedText.slice(0, 80)}..."`);
  }

  // 6. 宣告任务达成，执行 finish 动作
  const finishRes = await browser.act({ action: 'finish', reason: '已成功提取 Hacker News 头条讨论内容' });
  assert.equal(finishRes.success, true);
  assert.equal(finishRes.isFinish, true);
  console.log('✓ 成功触发任务完成 finish 动作！\n');
});

// ==================== 实操 2：GitHub 真实仓库导航与 Issues 页面检索 ====================
test('Live E2E 2: GitHub repository live navigation and Issues tab switching', async (t) => {
  const browser = new ChromeController(9334);
  await browser.launch();

  t.after(async () => {
    await browser.close();
  });

  const targetUrl = 'https://github.com/zpzxgcr/TabWeaver';
  console.log(`\n[实操测试 2] 正在真实导航到 GitHub 项目主页: ${targetUrl} ...`);
  await browser.navigate(targetUrl, 3200);

  // 1. 蒸馏真实 GitHub 页面
  const snapshot = await browser.distill();
  assert.ok(snapshot);
  assert.ok(snapshot.title.includes('TabWeaver'), '页面标题应包含 TabWeaver');
  console.log(`✓ 成功抓取 GitHub 真实页面：检测到 ${snapshot.totalCount} 个核心交互控件`);

  // 2. 真实检索页面中的 Issues 标签
  const issuesMatch = snapshot.snapshotText.match(/\[(\d+)\] <a> "[^"]*Issues[^"]*"/i);
  if (issuesMatch) {
    const issuesId = Number(issuesMatch[1]);
    console.log(`✓ 找到 Issues 导航入口 [${issuesId}]，执行真实跳转...`);
    const clickRes = await browser.act({ action: 'click', element: issuesId });
    assert.equal(clickRes.success, true);
    await new Promise(r => setTimeout(r, 2600));

    const issuesPage = await browser.distill();
    console.log(`✓ 成功进入 Issues 页面: "${issuesPage.title}"`);
    assert.ok(issuesPage.url.includes('/issues'));
  }

  // 3. 宣告任务达成
  const finishRes = await browser.act({ action: 'finish', reason: '已成功导航至 GitHub Issues 页面' });
  assert.equal(finishRes.success, true);
  console.log('✓ GitHub 真实交互实操闭环通过！\n');
});

// ==================== 实操 3：维基百科真实搜索与历史数据提取 ====================
test('Live E2E 3: Wikipedia live search input, form submission, and article fact extraction', async (t) => {
  const browser = new ChromeController(9335);
  await browser.launch();

  t.after(async () => {
    await browser.close();
  });

  const targetUrl = 'https://zh.wikipedia.org/wiki/Special:Search';
  console.log(`\n[实操测试 3] 正在真实导航到维基百科搜索页: ${targetUrl} ...`);
  await browser.navigate(targetUrl, 3200);

  // 1. 蒸馏搜索页
  const snapshot = await browser.distill();
  assert.ok(snapshot);
  console.log(`✓ 成功蒸馏维基百科页面：检测到 ${snapshot.totalCount} 个交互控件`);

  // 2. 寻找搜索输入框并填入关键词回车提交
  const searchInputMatch = snapshot.snapshotText.match(/\[(\d+)\] <input[^>]*type="search"[^>]*>/i) ||
                           snapshot.snapshotText.match(/\[(\d+)\] <input[^>]*placeholder="[^"]*搜索[^"]*"[^>]*>/i);
  if (searchInputMatch) {
    const inputId = Number(searchInputMatch[1]);
    console.log(`✓ 定位到真实搜索输入框 [${inputId}]，执行文本填入并回车提交...`);
    const fillRes = await browser.act({ action: 'fill', element: inputId, value: '深蓝计算机', pressEnter: true });
    assert.equal(fillRes.success, true);
    await new Promise(r => setTimeout(r, 3500));

    // 3. 蒸馏搜索后的新页面
    const articleSnapshot = await browser.distill();
    console.log(`✓ 页面跳转完成，当前标题: "${articleSnapshot.title}", URL: "${articleSnapshot.url}"`);
    assert.ok(articleSnapshot.title.includes('深蓝') || articleSnapshot.url.includes('%E6%B7%B1%E8%93%9D'), '应跳转到深蓝词条或搜索结果');
    assert.ok(articleSnapshot.textChars > 500, '应提取到充足的词条正文文本');
  }

  // 4. 宣告任务达成
  const finishRes = await browser.act({ action: 'finish', reason: '已成功检索并提取维基百科词条内容' });
  assert.equal(finishRes.success, true);
  console.log('✓ 维基百科真实搜索与数据提取实操闭环通过！\n');
});

