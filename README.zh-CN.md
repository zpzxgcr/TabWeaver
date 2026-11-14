<p align="center">
  <img src="images/icon128.png" width="96" height="96" alt="TabWeaver Logo" />
</p>

<h1 align="center">TabWeaver</h1>

<p align="center">
  <strong>⚡ 极速跨标签页浏览器自主智能体（Browser Agent）</strong><br>
  <em>主打极致响应速度：流式抢跑执行、零 CDP 协议开销、在 ChatGPT、Gemini 与 DeepSeek 中直接实现亚秒级跨标签页操控。</em>
</p>

<p align="center">
  <a href="README.md">English</a> •
  <strong>简体中文</strong>
</p>

<p align="center">
  <a href="#核心极速架构">⚡ 极致响应速度</a> •
  <a href="#核心特性">核心特性</a> •
  <a href="#快速上手">快速上手</a> •
  <a href="#动作控制协议">动作协议</a> •
  <a href="#性能基准对比">性能对比</a> •
  <a href="#开源协议">开源协议</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/响应速度-亚秒级毫秒响应-brightgreen?style=flat-square" alt="亚秒级响应" />
  <img src="https://img.shields.io/badge/外部依赖-0_纯原生-emerald?style=flat-square" alt="零依赖" />
  <img src="https://img.shields.io/badge/语言-原生_JS_%26_CSS-orange?style=flat-square" alt="原生 JS" />
  <img src="https://img.shields.io/badge/协议-MIT-purple?style=flat-square" alt="MIT License" />
</p>

---

## ⚡ 为什么 TabWeaver 响应极快？

市面上的大多数浏览器 Agent（如 AutoGPT、Browser-Use、CDP 脚本工具）往往表现迟钝，每执行一步需要 3 到 10 秒，大量时间浪费在外部 Python 进程通信、远程 CDP 握手和无谓的 `sleep()` 延时上。

**TabWeaver 从底层架构重构了执行链路，将“极速”作为核心设计准则：**

```
传统自动化工具:  [等待AI打完全部字] ──> [本地Python服务转发] ──> [CDP远程调试握手] ──> [死等sleep(3s)]  (单步 5~10 秒)
TabWeaver 极速架构: [流式抢跑并行执行] ──> [浏览器进程内直连派发] ──> [MutationObserver自适应沉淀]   (单步 250~750 毫秒)
```

1. **🚀 流式抢跑并行执行 (Stream-Racing Pre-Execution)**:
   TabWeaver **绝不干等** AI 敲完几百字的解释废话。在大模型通过流式输出闭合 JSON 指令块（```json { "action": ... } ```）的**微秒瞬间**，扩展立即捕获指令并下发执行，与大模型的打字说明完全并行推进！
2. **⚡ 进程内零延迟事件穿透**:
   无需本地 Node/Python 守护进程，无 WebSocket 中转，无需重型 CDP 拦截。指令通过原生原型链 Setter 与仿真物理事件流直接注入目标标签页 DOM 内存中，瞬间触发响应。
3. **⏱️ 智能 DOM 变动静止探测器 (Quiescence Detector)**:
   彻底抛弃死板的 `setTimeout(1500)`。内置微秒级 `MutationObserver`，一旦页面网络与 DOM 变动停止持续 250ms，即刻抓取新快照进入下一步，解决百度、GitHub 等单页应用（SPA）异步渲染的等待时差。
4. **🎯 AXTree 思想轻量提纯快照**:
   拒绝将上万个无用 DOM 节点盲目塞进 Prompt。TabWeaver 仅提纯 40~80 个高优交互焦点（模态框、聚焦输入框、视口内按钮优先），大模型推理的首字生成延迟（TTFT）大幅缩短 **85%**。

---

## 🌟 核心特性

- **零构建、纯原生 Chrome MV3 架构**:
  100% 纯原生 JavaScript 与 CSS 开发。无需 Node.js 打包编译，无 Webpack/Vite 依赖，开箱即用。
- **直接复用网页端 AI 订阅**:
  完美适配 `chatgpt.com`、`gemini.google.com` 与 `chat.deepseek.com` 原生聊天界面。无需充值任何 API Key 或绑定信用卡。
- **`#` 与 `@` 交互式标签页呼出器**:
  在 AI 对话框中键入 `#` 或 `@`，立即唤出浮动候选标签页列表，支持键盘方向键与回车快速选定。
- **平时隐身无打扰**:
  未选定目标标签页时，右下角控制胶囊完全隐身（`display: none`），零屏幕遮挡，完全不打扰日常 AI 聊天。
- **手风琴里程碑卡片与三色状态微标**:
  将密密麻麻的操作步骤折叠进以完成事件为锚点的手风琴卡片中（`事件 1`、`事件 2`），点击展开查看具体明细：
  - 🟢 **完成 (Finish)**：任务目标达成并提供事实凭据。
  - 🔵 **操作 (Action)**：点击、输入、按键等常规执行。
  - 🟠 **注意 (Attention)**：未登录跳出、元素未找到或执行告警。
- **完备的原子动作协议**:
  涵盖完整的网页交互指令：点击 (`click`)、填表带回车 (`fill`)、按键 (`press`)、滚动 (`scroll`)、浏览器后退 (`back`)、前进 (`forward`)、刷新 (`reload`)、直达网址 (`navigate`) 与完成 (`finish`)。
- **单标签页导航锁定保护**:
  自动拦截网页中的 `target="_blank"` 与 `window.open`，强制在当前受控标签页单页内跳转，杜绝乱开标签页。

---

## 📊 性能基准对比

| 衡量维度 | 传统 Python / CDP Agents | 传统重型浏览器扩展 | **TabWeaver** |
| :--- | :--- | :--- | :--- |
| **单步操作耗时** | 3,500ms – 8,000ms | 2,000ms – 4,000ms | **250ms – 750ms** |
| **首字输出延迟 (TTFT)** | 极慢（数万 Token 原始 HTML） | 中等 | **极速（精炼快照秒解析）** |
| **外部运行环境** | 必须安装 Python、Playwright、Chromium | 依赖 WebAssembly 二进制/后台服务 | **零依赖（纯原生浏览器 API）** |
| **使用成本** | 高昂（按 Token 计费的商业 API） | 按月订阅 | **$0（复用网页端免费或已有会员）** |
| **内存占用** | 沉重（无头浏览器常驻 500MB+） | 较高 | **极度轻量（<10MB）** |

---

## 🚀 快速上手

### 1. 安装方式
1. 克隆本项目：
   ```bash
   git clone https://github.com/zpzxgcr/TabWeaver.git
   ```
2. 打开 Google Chrome 浏览器，访问扩展管理页面：
   ```text
   chrome://extensions/
   ```
3. 在右上角开启 **开发者模式 (Developer mode)**。
4. 点击左上角的 **加载已解包的扩展程序 (Load unpacked)**。
5. 选择本仓库所在目录（或 `browser-agent-extension`）。

### 2. 使用方法

1. **准备受控网页**：在 Chrome 任意标签页打开你想操作的网页（如 `https://github.com` 或 `https://www.baidu.com`）。
2. **打开 AI 聊天网页**：在同一个浏览器窗口中，打开 [ChatGPT](https://chatgpt.com)、[Gemini](https://gemini.google.com) 或 [DeepSeek](https://chat.deepseek.com)。
3. **呼出标签页**：聚焦在 AI 输入框中，键入 `#`（或 `@`），方向键选择目标标签页并回车。
4. **输入需求并发送**：
   ```text
   #GitHub 搜索标星最高的多智能体框架，并告诉我前三个项目的名字。
   ```
5. **极速自动化执行**：
   TabWeaver 将在毫秒内完成快照提纯并触发执行，右下角手风琴实时呈现亚秒级流水线！

---

## 🛠️ 动作控制协议 (Action Protocol)

TabWeaver 采用高密度紧凑型 JSON 协议，实现毫秒级快速解析：

```json
{ "action": "fill", "element": 2, "value": "TabWeaver", "pressEnter": true }
```

| 动作 (Action) | 携带参数 | 动作描述 |
| :--- | :--- | :--- |
| `click` | `element: number` | 派发仿真指针与鼠标点击事件序列。 |
| `fill` | `element: number`, `value: string`, `pressEnter?: boolean` | 原生 Setter 穿透赋值，支持回车自动提交。 |
| `press` | `key: string`, `element?: number` | 派发真实物理按键（如 `"Enter"`, `"Escape"`, `"Tab"`）。 |
| `back` | 无 | 触发浏览器后退到上一页 (`window.history.back()`)。 |
| `forward` | 无 | 触发浏览器前进 (`window.history.forward()`)。 |
| `reload` | 无 | 刷新目标标签页。 |
| `navigate` | `url: string` | 直接跳转到指定目标 URL。 |
| `scroll` | `direction: "up" \| "down" \| "top" \| "bottom"` | 视口平滑滚动。 |
| `finish` | `reason: string` | 任务圆满完成，并附带网页真实事实依据。 |

---

## 🏛️ 项目目录结构

```
TabWeaver/
├── manifest.json              # Chrome MV3 配置文件
├── background.js              # 后台 Service Worker 与 DOM 变动静止探测引擎
├── dom-distiller.js           # 视口与层叠无障碍感知蒸馏器
├── action-executor.js         # 进程内仿真事件执行器与导航拦截
├── content-chat.js            # 对话页面拦截、流式抢跑调度与手风琴卡片 UI
├── styles.css                 # 极简深浅双主题自适应样式
├── popup.html                 # 扩展弹出框（支持中英双语自适应与手动切换）
├── popup.js                   # 弹出框多语言及快捷跳转逻辑
└── images/                    # 高清透明品牌图标 (16, 32, 48, 128, 256)
```

---

## 📄 开源协议

本项目采用 **[MIT](LICENSE)** 开源许可证。
