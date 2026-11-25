# 🚀 TabWeaver 高杠杆零复制推广发行包（方案三）

> **产品核心定位**：无需 API Key、无需第三方云端服务器、原生复用已登录浏览器会话（适合内网/GA/私密网页总结与操作）的 MIT 开源 Chrome 扩展。
> - **GitHub 仓库**：`https://github.com/zpzxgcr/TabWeaver`
> - **Chrome 应用商店**：`https://chromewebstore.google.com/detail/tabweaver-cross-tab-ai-br/allofpdkpijflgipdonjfgicgeajelen`
> - **官方主页**：`https://zpzxgcr.github.io/TabWeaver/`

---

## 一、 Hacker News (`Show HN`) 一键预填发布包

### 1. 一键直达发布链接（点击即自动填好标题和地址，无需复制）
👉 **[点击打开已预填完毕的 Hacker News 提交页](https://news.ycombinator.com/submitlink?u=https%3A%2F%2Fgithub.com%2Fzpzxgcr%2FTabWeaver&t=Show%20HN%3A%20TabWeaver%20%E2%80%93%20Control%20and%20summarize%20logged-in%20tabs%20from%20your%20web%20AI%20chat)**

*   **Title**：`Show HN: TabWeaver – Control and summarize logged-in tabs from your web AI chat` (79 chars，严格符合 HN 不超 80 字符与克制去广告的规范)
*   **URL**：`https://github.com/zpzxgcr/TabWeaver`

### 2. 作者一楼技术自述评论（Maker's First Comment，发完后贴在一楼）
```text
Hi HN! I built TabWeaver because I kept running into two walls with existing browser AI agents:

1. They require piping your active webpage DOM (often behind corporate SSO, 2FA, or Google Analytics logins) through external cloud relay servers, or paying for separate API keys/subscriptions.
2. Dumping raw outerHTML into web LLM chats burns tens of thousands of tokens on SVG paths, scripts, and invisible boilerplate.

TabWeaver is an MIT-licensed, pure Manifest V3 Chrome extension with zero build step and zero backend servers. 

How it works:
- Open your existing ChatGPT, Claude, DeepSeek, Gemini, or Kimi web session.
- Type `#` or `@` in the composer to pick another open tab in the same browser window.
- A client-side TreeWalker DOM distiller (`dom-distiller.js`) runs locally via `chrome.scripting`, strips non-semantic boilerplate while prioritizing active modals/viewports, and feeds a compact interactive snapshot to your chat.
- Your chat outputs structured JSON actions (`click`, `fill`, `select`, `scroll`, `extract`, etc.), which execute natively inside your local Chrome sandbox.

Because it lives directly inside your authenticated browser session, it works on logged-in dashboards (like GA4, Jira, internal tools) without ever sending cookies or data to a third-party proxy.

Code (pure JS, no bundler): https://github.com/zpzxgcr/TabWeaver
Chrome Web Store (v2.1.8): https://chromewebstore.google.com/detail/tabweaver-cross-tab-ai-br/allofpdkpijflgipdonjfgicgeajelen

Would love technical feedback on the DOM distillation heuristic and our action JSON loop!
```

---

## 二、 Product Hunt 首发物料全包

*   **提交通道**：[https://www.producthunt.com/posts/new](https://www.producthunt.com/posts/new)
*   **Name**：`TabWeaver`
*   **Tagline (≤ 60 chars)**：`Control logged-in tabs directly from your AI chat, 100% local` (60 chars)
*   **Links**：`https://chromewebstore.google.com/detail/tabweaver-cross-tab-ai-br/allofpdkpijflgipdonjfgicgeajelen`
*   **Topics**：`Chrome Extensions`, `Artificial Intelligence`, `Open Source`, `Productivity`, `Developer Tools`
*   **Pricing**：`Free / Open Source (MIT)`
*   **Short Description (≤ 260 chars)**：
    ```text
    Type '#' in ChatGPT, Claude, DeepSeek, or Kimi to read, summarize, and automate any open tab locally. Zero backend servers, zero extra API keys, works safely on logged-in dashboards & internal tools via pure Chrome Manifest V3.
    ```
*   **已就位的本地高清视觉资产**：
    - **Logo (1254x1254 PNG)**：`images/newlogo.png`
    - **Gallery 大图 1~5 (均为 1280x800 PNG)**：`docs/assets/screenshots/01` ~ `05`
*   **Maker's First Comment**：
    ```text
    Hey Product Hunt! 👋

    I built TabWeaver to solve a simple privacy & workflow problem: why do browser AI agents require separate API subscriptions and send our private, logged-in webpages to external cloud servers?

    With TabWeaver (100% open-source under MIT):
    1️⃣ Use the web AI chats you already pay for or use daily (ChatGPT, Claude, DeepSeek, Gemini, Kimi, Perplexity — 18+ platforms supported).
    2️⃣ Type `#` or `@` to link any logged-in tab (Google Analytics, Jira, Notion, docs).
    3️⃣ Local-only DOM distillation strips boilerplate and saves 80%+ tokens—no cookies or page data ever touch a third-party backend.

    Now live on the Chrome Web Store with zero dependencies. Give it a try and let me know what workflows you automate first! 🚀
    ```

---

## 三、 GitHub 高星 Awesome 榜单 PR 收录清单（已确认本机 `gh` 登录正常）

经真实检索，以下三个累计 **13,700+ Stars** 的高权重开源汇总仓库均设有专属板块并接收 PR：

### 1. `sindresorhus/awesome-chatgpt` (⭐ 6,508)
*   **目标章节**：`## Browser extensions`
*   **合规条目文本**：
    `- [TabWeaver](https://github.com/zpzxgcr/TabWeaver) - Open-source Manifest V3 extension that lets ChatGPT and other web AI chats read, summarize, and automate other logged-in browser tabs locally.`

### 2. `mahseema/awesome-ai-tools` (⭐ 6,627)
*   **目标章节**：`### ChatGPT extensions`
*   **合规条目文本**：
    `- [TabWeaver](https://github.com/zpzxgcr/TabWeaver) - Open-source Chrome extension bridging web AI chats (ChatGPT, Claude, DeepSeek) to any open tab locally with zero cloud servers.`

### 3. `themeselection/best-chrome-extensions` (⭐ 600)
*   **目标章节**：`### 🤖 AI Copilots and Productivity Tools`（Markdown 表格末尾）
*   **合规条目文本**：
    `| 15 | [**TabWeaver - Cross-Tab AI Browser Automation**](https://chromewebstore.google.com/detail/tabweaver-cross-tab-ai-br/allofpdkpijflgipdonjfgicgeajelen) | Open-source local extension enabling ChatGPT, Claude & DeepSeek web chats to read and control logged-in tabs. |`

*(提示：如需直接通过 `gh` CLI 自动化 Fork 并提交这 3 个 Pull Request，确认授权后即可一键发起！)*

---

## 四、 国际高权重 AI 工具 & 插件导航站提交矩阵

| 平台名称 | 提交直达链接 | 收费模式选项 | 核心卖点切入 |
| :--- | :--- | :--- | :--- |
| **AlternativeTo** | https://alternativeto.net/manage/add-application/ | `Open Source` / `Free` | Alternative to Perplexity Comet / OpenAI Operator (Local-first) |
| **There's An AI For That** | https://theresanaiforthat.com/submit/ | `Free` | Chrome Extension / Browser Automation |
| **Futurepedia** | https://www.futurepedia.io/submit-tool | `Open Source` / `Free` | Productivity / AI Agents |
| **Toolify.ai** | https://www.toolify.ai/submit | `Free` | Browser Automation / Local AI Copilot |
