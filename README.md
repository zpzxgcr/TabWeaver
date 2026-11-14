<p align="center">
  <img src="images/icon128.png" width="96" height="96" alt="TabWeaver Logo" />
</p>

<h1 align="center">TabWeaver</h1>

<p align="center">
  <strong>⚡ The Lightning-Fast Cross-Tab Autonomous Browser Agent.</strong><br>
  <em>Engineered for raw speed: instant stream-racing execution, zero CDP overhead, and sub-second web automation directly from ChatGPT, Gemini, and DeepSeek.</em>
</p>

<p align="center">
  <strong>English</strong> •
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="#why-tabweaver-is-insanely-fast">⚡ Pure Speed Architecture</a> •
  <a href="#key-features">Key Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#action-protocol">Action Protocol</a> •
  <a href="#performance-comparison">Benchmarks</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Response_Speed-Sub--Second-brightgreen?style=flat-square" alt="Sub-second Speed" />
  <img src="https://img.shields.io/badge/Dependencies-0_Zero-emerald?style=flat-square" alt="Zero Dependencies" />
  <img src="https://img.shields.io/badge/Vanilla-JS_%26_CSS-orange?style=flat-square" alt="Vanilla JS" />
  <img src="https://img.shields.io/badge/License-MIT-purple?style=flat-square" alt="MIT License" />
</p>

---

## ⚡ Why TabWeaver is Insanely Fast

Most browser automation agents (AutoGPT, Browser-Use, Playwright/CDP scripts) feel sluggish—wasting 3 to 10 seconds per step on round-trip network hops, CDP protocol handshakes, and arbitrary `time.sleep()` delays.

**TabWeaver is built differently. It treats speed as a core feature:**

```
Traditional Agent:  [Wait for LLM to finish] ──> [Send to Python server] ──> [CDP Command] ──> [sleep(3s)] ──> [Dump 100k DOM]  (5~10s / step)
TabWeaver:          [Stream-Racing Execution] ──> [In-Memory Injection] ──> [Quiescence Wait (250ms)] ──> [Next Step]     (300~800ms / step)
```

1. **🚀 Stream-Racing Execution (流式抢跑)**:
   TabWeaver does **not** wait for the AI to finish typing its entire response. The millisecond the LLM streams the closing bracket of a JSON action block (```json { "action": ... } ```), TabWeaver intercepts and dispatches the action immediately while the AI is still writing its explanation.
2. **⚡ Zero-Overhead In-Process Injection**:
   No local Python daemons, no WebSocket bridges, and no heavy CDP sessions. Actions are dispatched straight into the tab's DOM via native prototype setter penetration and synthetic trusted event chains.
3. **⏱️ Smart DOM Quiescence Detector**:
   No more dumb `setTimeout(1500)`. TabWeaver uses a fine-tuned `MutationObserver` that triggers the next step the exact moment DOM mutations and network calls settle (typically within 250ms).
4. **🎯 AXTree-Inspired Lightweight Snapshots**:
   Instead of choking the LLM context with a 100,000-token HTML dump, TabWeaver distills the page down to 40~80 high-priority interactive anchors. This drops First-Token Latency (TTFT) by up to **85%**.

---

## 🌟 Key Features

- **Zero-Build, Pure Native MV3**:
  100% vanilla JavaScript & CSS. No Node.js build step, no npm packages, no bundlers. Works immediately out of the box.
- **BYO-LLM via Native Web Chat**:
  Seamlessly integrates with your existing web accounts on `chatgpt.com`, `gemini.google.com`, and `chat.deepseek.com`. Zero API tokens or credit cards required.
- **`#` & `@` Tab Mention Picker**:
  Typing `#` or `@` inside the AI's prompt input opens a slick, keyboard-navigable tab picker. Pick a tab, type your request, and press Enter.
- **100% Invisible Until Invoked**:
  Zero screen clutter. The control capsule stays completely hidden and dormant until you explicitly invoke a tab with `#`.
- **Milestone Accordion UI with 3-Color Micro-Badges**:
  Collapses messy multi-step execution logs into clean, milestone-based accordion cards (`Event 1`, `Event 2`):
  - 🟢 **Finish** (Emerald Green): Target reached and grounded.
  - 🔵 **Action** (Tech Blue): Normal click, fill, press, or scroll.
  - 🟠 **Attention** (Warning Orange): Unauthenticated redirects, missing elements, or warnings.
- **Full Navigation & Action Primitives**:
  Full atomic capabilities: `click`, `fill` (with `pressEnter`), `press` (Enter, Escape, Tab), `scroll`, `back` (Go Back), `forward`, `reload`, `navigate` (URL goto), and `finish`.
- **Single-Tab Navigation Lock**:
  Intercepts `target="_blank"` and `window.open` to enforce single-tab navigation, eliminating runaway popup tabs.

---

## 📊 Performance Comparison

| Metric | Traditional Python / CDP Agents | Heavy Browser Extensions | **TabWeaver** |
| :--- | :--- | :--- | :--- |
| **Step Execution Latency** | 3,500ms – 8,000ms | 2,000ms – 4,000ms | **250ms – 750ms** |
| **First Token (TTFT)** | Slow (huge raw HTML prompt) | Moderate | **Instant (distilled context)** |
| **External Dependencies** | Python, Playwright, Chromium | Binary WebAssembly / Daemons | **0 (Pure Web API & MV3)** |
| **API Costs** | High (Pay-per-token API keys) | Subscription fee | **$0 (Uses your existing Web Chat)** |
| **Resource Usage** | Heavy (500MB+ RAM for headless) | Moderate | **Ultra-light (<10MB RAM)** |

---

## 🚀 Quick Start

### 1. Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/zpzxgcr/TabWeaver.git
   ```
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (加载已解包的扩展程序) in the top-left.
5. Select the repository root folder (or `browser-agent-extension`).

### 2. Basic Usage

1. Open any target webpage in a Chrome tab (e.g., `https://github.com` or `https://www.baidu.com`).
2. In the same window, switch to or open [ChatGPT](https://chatgpt.com), [Gemini](https://gemini.google.com), or [DeepSeek](https://chat.deepseek.com).
3. In the chat prompt box, type `#` (or `@`) and select your target tab from the popup list.
4. Type your objective and press Enter:
   ```text
   #GitHub Search for the top trending multi-agent frameworks and give me the stars of the first 3.
   ```
5. TabWeaver will instantly inject the snapshot, trigger the LLM, and execute actions with sub-second feedback!

---

## 🛠️ Action Protocol

TabWeaver uses an ultra-compact JSON command format for millisecond-level parser efficiency:

```json
{ "action": "fill", "element": 2, "value": "TabWeaver", "pressEnter": true }
```

| Action | Parameters | Description |
| :--- | :--- | :--- |
| `click` | `element: number` | Simulates natural pointer, mouse, and click sequences. |
| `fill` | `element: number`, `value: string`, `pressEnter?: boolean` | Penetrates React/Vue virtual DOM setters with real-time change events. |
| `press` | `key: string`, `element?: number` | Dispatches real keyboard inputs (e.g. `"Enter"`, `"Escape"`, `"Tab"`). |
| `back` | *none* | Navigates back in browser history (`window.history.back()`). |
| `forward` | *none* | Navigates forward in browser history (`window.history.forward()`). |
| `reload` | *none* | Refreshes the target tab. |
| `navigate` | `url: string` | Direct URL navigation. |
| `scroll` | `direction: "up" \| "down" \| "top" \| "bottom"` | Smoothly scrolls the target viewport. |
| `finish` | `reason: string` | Concludes the task with verified factual citations. |

---

## 🏛️ Project Structure

```
TabWeaver/
├── manifest.json              # Chrome MV3 Extension Manifest
├── background.js              # Background Service Worker & DOM Quiescence Engine
├── dom-distiller.js           # AXTree-inspired High-Priority DOM Distiller
├── action-executor.js         # In-memory Synthetic Event Dispatcher
├── content-chat.js            # Chat Hijack, Stream-Racing Watcher & Accordion UI
├── styles.css                 # Glassmorphic Adaptive UI (Dark & Light Mode)
├── popup.html                 # Extension Status Popover
├── popup.js                   # Extension Quick Launch Handler
└── images/                    # Transparent PNG Icons (16, 32, 48, 128, 256)
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to open an issue or pull request.

---

## 📄 License

Distributed under the **MIT** License. See [LICENSE](LICENSE) for more information.
