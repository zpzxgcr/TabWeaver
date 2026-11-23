<p align="center">
  <img src="images/icon128.png" width="96" height="96" alt="TabWeaver Logo" />
</p>

<h1 align="center">TabWeaver</h1>
<p align="center"><strong>Control another browser tab from an AI chat website</strong><br>Native Chrome Manifest V3 · No build step · No model API key</p>
<p align="center"><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a> · <a href="https://zpzxgcr.github.io/TabWeaver/"><strong>🌐 Official Website</strong></a></p>

## What does it do?

Type `#` or `@` in an AI chat composer, select a target tab, and describe a task. TabWeaver extracts a compact page snapshot, sends it through your existing chat session, executes the model's JSON actions, and feeds the updated page back into the conversation.

```text
Select tab → Extract page snapshot → Send to AI chat
               ↑                          ↓
        Return results + snapshot ← Execute JSON action
```

The extension does not provide a model service or bypass sign-in, subscriptions, quotas, or site restrictions. Automation requires no Python/Node server or CDP connection; execution uses Chrome APIs and injected DOM scripts. An optional local Node.js collector is available only for writing development logs to disk.

## Current release: 2.1.8

- **Quick Start Guide in Popup**: Integrated an intuitive 3-step usage instruction card inside the extension popup with interactive `<kbd>#</kbd>` & `<kbd>@</kbd>` badges and seamless English/Chinese bilingual adaptation.
- **18 configured AI chat platform entries** arranged in a clean, scroll-free matrix with official full-color vector SVG icons.
- Streamlined bilingual popup with automatic system dark/light theme detection and browser language auto-adaptation.
- Automatic local logging enabled by default with offline buffering and extension-to-disk write probe.
- Enter-send fallback on the original platforms, and capsule dragging restricted to the header's non-button area.
- **JSON commands remain visible in chat.** This release does not add automatic hiding/folding of assistant command blocks or replace the explicit `finish` protocol with natural-language completion guesses.

### Shared platform configuration

- **Shared DOM adapter:** composer lookup, send controls, assistant messages and streaming indicators live in `chat-dom.js`.
- **Configuration-driven integrations:** `platforms.js` holds domains and selectors. New sites do not need a copy of the agent loop, but their DOM differences still need configuration; complex editors may require additional work.
- **Streamlined popup:** 15 platform entries displayed directly without scrolling or search noise, current-platform highlighting, existing-tab reuse in the current window, and persistent language toggle. Entries come from the same registry as the content script.
- **Conservative failures:** no arbitrary SVG-button clicking. The original platforms can attempt one Enter submission when no send control is found. Submission is checked for site acknowledgement; failures and timeouts stop with a warning. An answer without a valid action does not automatically mean success.
- **Feedback pacing:** complete JSON actions can execute during streaming, but feedback waits for the previous response to settle before submission.

## Configured platforms and validation status

**These entries have injection rules and selector configurations, not verified end-to-end compatibility with signed-in websites.** The original three integrations also need regression testing after this shared-layer refactor. All new entries are experimental. Site versions, locale, authentication, editor changes and A/B tests can affect compatibility.

| Platform | Configured domains | Status |
| --- | --- | --- |
| DeepSeek | `chat.deepseek.com` | Supported |
| ChatGPT | `chatgpt.com`, `chat.openai.com` | Supported |
| Tencent Yuanbao | `yuanbao.tencent.com` | Supported |
| Kimi | `www.kimi.com`, `kimi.com`, `kimi.moonshot.cn` | Supported |
| Doubao | `www.doubao.com`, `doubao.com` | Supported |
| Qianwen / Tongyi | `www.qianwen.com`, `qianwen.com`, `tongyi.aliyun.com`, `tongyi.com`, `www.tongyi.com` | Supported |
| Claude | `claude.ai` | Supported |
| Gemini | `gemini.google.com` | Supported |
| Perplexity AI | `www.perplexity.ai`, `perplexity.ai` | Supported |
| Hailuo AI (MiniMax) | `hailuoai.com`, `www.hailuoai.com` | Supported |
| Grok | `grok.com` | Experimental; not Grok embedded in X |
| Qingyan / Z.ai | `chatglm.cn`, `www.chatglm.cn`, `chat.z.ai` | Supported |
| Wenxiaoyan / ERNIE | `yiyan.baidu.com`, `wenxiaoyan.com`, `www.wenxiaoyan.com` | Supported |
| iFlytek Spark | `xinghuo.xfyun.cn` | Supported |
| Qwen | `chat.qwen.ai` | Supported |

These are **website integrations, not model API integrations**. Models within a site can usually share its configuration, but must still follow the action protocol. Arbitrary AI websites are not automatically supported; the chat controller is only injected on explicitly listed domains.

## Install and use

1. Download or clone the repository:
   ```bash
   git clone https://github.com/zpzxgcr/TabWeaver.git
   ```
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the `browser-agent-extension` directory. No dependencies or build step are required.
4. When updating an existing installation, **reload the extension and refresh open AI pages** so new domains and scripts take effect.

## Quick start (Goal-oriented: No step-by-step scripting needed)

TabWeaver uses an autonomous **Goal-Oriented** architecture. **You do not need to micromanage the AI with step-by-step instructions** (e.g. "click this button first, then type X, then scroll down"). Simply describe your ultimate objective in natural language, and the AI will autonomously analyze the page, locate inputs, dispatch clicks, scroll dynamically, and report verified conclusions.

### 1. Three steps to get started

1. **Prepare:** Open the **target webpage** and any **supported AI chat website** (such as DeepSeek, ChatGPT, Claude, Kimi, etc.) in the same browser window.
2. **Select:** Type `#` or `@` in the AI composer, and pick the target tab from the popup selector.
3. **Send goal:** Describe your objective directly and hit send.
   - The target webpage will immediately display a **neon-blue breathing halo** around its viewport edges to signal active automation.
   - The AI page displays an **integrated control capsule** in the bottom-right corner, streaming each round's action, timing, and pause/stop controls.

---

### 2. Typical examples (Ready to copy & paste)

#### 🛠️ Tech & open source research
```text
#GitHub Search for the "browser-use" project, click into the repository with the highest stars, and summarize its core capabilities and recommended installation commands.
```
```text
#npm Search for "fastify", find its latest stable version, weekly downloads, and core performance highlights.
```
```text
#HackerNews Browse today's Top 5 stories, and summarize the primary discussion points and top comments on the first story.
```

#### 🔍 Fact checking & encyclopedias
```text
#Wikipedia Search for "Deep Blue chess computer", find its 1997 match against Garry Kasparov, and extract the key match score and hardware specs.
```
```text
#BaiduBaike Search for "Chang'e 6", extract its launch date, landing site, and the weight of lunar samples returned.
```

#### 📊 Content digestion & media reviews
```text
#IMDb Browse the Top 250 movies list, open the #1 movie page, and summarize its director, release year, and top user reviews.
```

#### 🛒 Product specification & price comparison
```text
#Amazon Search for ergonomic office chairs, compare the price, core materials, and warranty details of the top 3 results.
```

---

### 3. Advanced & Complex Operation Scenarios (Self-Verification & Self-Healing)

TabWeaver includes a robust **Self-Healing and Verification** loop. You can use the following complex business goals to test multi-turn resilience, element recovery, and dynamic decision-making:

#### ✈️ Scenario A: Multi-step Flight Booking (Cascading inputs + Fuzzy select + Settle wait)
```text
#Qunar Search for a one-way flight from "Beijing" to "Shanghai" next Friday. Select "Business Class", wait for flight listings to settle, compare the departure time, airline, and lowest price of the first 3 flights, and recommend the best option.
```
> **Self-Healing & Verification**:
> - **Cascaded Form Inputs**: Dispatches trusted input/change events that penetrate React/Vue controlled form inputs and reset internal value trackers.
> - **Fuzzy Select Matching**: Resolves option values by partial display text when dropdown options use internal airport codes.
> - **Quiescence Detector**: Verifies network and DOM mutation stability before capturing new snapshots.

#### 🛍️ Scenario B: Multi-criteria Product Filtering (Hover triggers + Disabled guards)
```text
#BestBuy Search for "laptops", filter by "16GB RAM" and "512GB SSD" in the sidebar, sort by "Top Sales", and summarize the processor, weight, and discount prices of the top 2 models.
```
> **Self-Healing & Verification**:
> - **Hover Menu Navigation**: Natively fires `pointerover`/`mouseover`/`mouseenter` sequences to expose hidden submenus.
> - **Disabled State Guard**: Intercepts disabled buttons with contextual guidance (e.g. out-of-stock items) rather than blind repeated clicks.

#### 📋 Scenario C: Modal Dialog Interception & AXTree Prioritization
```text
#GitHub Go to any popular repository's Issues page and open the first issue. If an authentication modal or consent popup appears, close it first; then extract the issue title, author, and error logs, and summarize potential fixes.
```
> **Self-Healing & Verification**:
> - **Modal Weight Boost**: Elements within `<dialog open>` or `[aria-modal="true"]` automatically receive a +350 score boost in the AXTree snapshot, prioritizing modal resolution.
> - **Single-tab Containment**: Intercepts `target="_blank"` to keep all interactions within the controlled tab.

#### 📊 Scenario D: Deep Table Scrolling with Boundary Guard
```text
#HackerNews Search for "browser automation", scroll down 3 times to load more submissions, and extract the top 3 items by upvote count.
```
> **Self-Healing & Verification**:
> - **Physical Displacement Verification**: Halts dead-end scrolling with `NO_SCROLL_MOVEMENT` if the viewport reaches boundary or is not scrollable.
> - **Celebration Gift & Fireworks**: Emits a celebratory gift box 🎁 and confetti fireworks on `finish`, synchronized across both the AI controller and controlled tabs.

---

### Limitations and troubleshooting

- Browser-internal pages such as `chrome://` cannot be controlled. Cross-origin frames, closed shadow roots, CAPTCHAs and controls requiring trusted user events may not work.
- If the tab picker does not appear, reload the extension, refresh the AI page, check its domain, and focus the chat composer.
- Missing composer/send controls may indicate a website change, disabled controls, sign-in requirements or exhausted quota. Stop retrying and report the domain, locale and a sanitized DOM snippet.
- If the model does not return valid JSON, automation stops. Try a model that follows the protocol. Speed depends on model generation, page load and settling time; there is no fixed sub-second latency guarantee.
- Generic detection does not replace per-site live testing. This release does not cover every AI website in China or elsewhere.

## Developer mode: diagnose stalled runs

1. Reload the extension in `chrome://extensions/` and refresh the AI chat page after updating.
2. Run `node scripts/debug-collector.cjs` from the project root (Node.js 18+), or double-click `start-debug.cmd` on Windows. Keep the terminal open. The optional collector binds only to `127.0.0.1:17321`; normal extension use does not require it.
3. Enable **Developer logs** in the popup and click **Test disk logging**. Wait for **Probe written** to confirm extension-to-disk delivery before reproducing a task. Events automatically append to `debug-logs/runtime-*.jsonl`. The popup displays state, not a diagnostic timeline. `collector.started` and `diagnostics.probe` are startup/self-test events, not evidence of real task execution. Follow the evidence-first workflow in [AGENTS.md](AGENTS.md) before changing core behavior.
4. Optionally enable **Include page text, prompts and replies** to inspect what the model saw. This is off by default and can expose private business data; use non-sensitive test pages.
5. Reproduce the task and ask your coding assistant to read the newest file in `debug-logs/`. No repeated manual export is needed. Files must actually have been written by the running collector: assistants cannot directly read browser storage.
6. Disable logging and stop the collector with Ctrl+C afterward. **Clear browser cache** does not delete disk files. Stop the collector before manually deleting `debug-logs/`. Manual export remains available as a fallback.

Records contain task `runId`, turn `round`, RPC `requestId`, timestamps, phase, timing, selector match counts, response detection, action parsing/results, scroll positions, snapshot sizes and errors. Full page text/prompts/replies are omitted unless enabled; error strings and paths can still identify business data, so sanitize before sharing. Logs go only to the local loopback collector, not an external logging service. The Git-ignored directory retains up to 10 JSONL segments of approximately 8 MiB each. The browser buffers the latest 400 events / approximately 700,000 characters while offline, then replays retained events when reconnected; overwritten history cannot be recovered. Large fields are truncated. Ordinary webpage origins are rejected; local processes are trusted. Do not expose the collector port externally.

### Fixes for “the model emitted an action, then nothing happened”

- New replies no longer require message counts to increase, allowing SPA message-node reuse/replacement.
- RPCs time out after 25 seconds; stalled responses after 90 seconds without changes. Snapshot, send and watcher failures surface a reason rather than returning silently.
- Snapshots include body text, KPI cards, table text and scroll positions, not just interactive controls. Canvas limitations are explicit: **this is not visual chart recognition**.
- Scrolling selects the main scrollable region and verifies position changes. Boundaries report no movement, not success. Clicks no longer fire twice.
- Three unchanged snapshots or the 80-step safety limit block the run with a visible warning instead of looping indefinitely. A supervised retry reads the page again.
- Version 2.1.2 restores the original Enter-send fallback on ChatGPT, Gemini and DeepSeek when send controls cannot be identified, while verifying site acknowledgement. It does not bypass known disabled controls or blindly resubmit.
- Only the capsule header/title area starts a left-button drag, never the body, warning rows or buttons.

These changes have local regression tests; **they do not mean every real-world stall is resolved**. Verify log delivery, then use real task events to establish the root cause before changing core execution. A background navigation implementation independent of the target document has not been added.

## Action protocol

Each model turn should contain a closed JSON action block:

```json
{ "action": "fill", "element": 2, "value": "TabWeaver", "pressEnter": true }
```

| Action | Parameters | Purpose |
| --- | --- | --- |
| `click` | `element: number` | Click an element ID from the snapshot |
| `fill` | `element: number`, `value: string`, `pressEnter?: boolean` | Enter text, optionally followed by Enter |
| `press` | `key: string`, `element?: number` | Simulate a key such as Enter or Escape |
| `scroll` | `direction: "up" / "down" / "top" / "bottom"` | Scroll the page |
| `back` / `forward` / `reload` | None | Browser navigation |
| `navigate` | `url: string` | Navigate to a URL |
| `finish` | `reason: string` | End the task with supporting facts |

`finish` means the model reported completion, not that the result was independently verified. Assistant JSON command blocks are currently left visible, with the human-readable answer, tables and evidence following them. Users should verify the result. Existing context folding applies only to technical user messages sent by the extension, not assistant command blocks.

DOM events are synthetic, not trusted physical input, and some websites reject them. Target-page navigation is constrained to the controlled tab to reduce unexpected new tabs.

## Security and privacy

- **Extracted target-page content is sent to your selected AI chat service** and is subject to its data policies. Do not use pages containing passwords, keys, confidential documents or other data that must not leave your browser.
- `tabs` lists and identifies tabs; `scripting` and `<all_urls>` allow extraction/execution in the user-selected target page; `storage` saves language/session state; `activeTab` grants active-tab access. The chat controller auto-injects only on AI domains listed in the manifest.
- Models can make mistakes, and webpages can contain prompt injection. There is currently no mandatory per-action confirmation for purchases, deletion or sending messages. Avoid irreversible or sensitive workflows.

## Project structure

```text
TabWeaver/
├── AGENTS.md           # Evidence-first, real-log-driven debugging workflow
├── manifest.json       # Domain matches, permissions and script loading order
├── platforms.js        # Shared website registry for content scripts and popup
├── chat-dom.js         # Shared chat DOM adapter
├── content-chat.js     # Tab picker, prompts, action loop and control UI
├── background.js       # Cross-tab dispatch and DOM settling detection
├── debug-store.js      # Local buffer, loopback transport and offline replay
├── scripts/debug-collector.cjs # Dependency-free JSONL log collector
├── start-debug.cmd     # Windows collector launcher
├── debug-logs/         # Automatic disk logs (Git-ignored)
├── dom-distiller.js    # Page content and interactive-element extraction
├── action-executor.js  # Action execution and navigation interception
├── popup.html          # Searchable platform launcher
├── popup.js            # Bilingual UI, registry rendering and tab reuse
├── styles.css
├── tests/              # Dependency-free local checks
└── images/
```

### Add a platform and validate

1. Add its hosts, URL and `input`, `send`, `assistant`, `user`, `stop` selectors to `platforms.js`. Prefer stable semantic attributes over generated classes.
2. Add its HTTPS hosts to `content_scripts.matches` in `manifest.json`. The popup entry is generated automatically.
3. Run local automated tests and live browser E2E checks:
   ```bash
   # Run all 42 local automated and self-healing regression tests
   node --test tests/celebration.test.cjs tests/collector-drag.test.cjs tests/complex-scenarios.test.cjs tests/diagnostics-flow.test.cjs tests/platforms.test.cjs tests/send.test.cjs

   # Launch real Chrome browser to run live E2E scenarios across the Internet (Hacker News / GitHub / Wikipedia)
   node --test tests/live-e2e.test.cjs
   ```
4. Validate on the actual site: ordinary chat remains unaffected → select a tab → send initial prompt → read only assistant output → execute action → send updated snapshot → next turn → `finish`. Also test IME input, streaming, disabled buttons, pause/stop and navigation.

There are currently **42 local automated tests** and **3 live Internet E2E suites** covering registry/manifest consistency, simulated composer/reply selection, Enter fallback, single submission and acknowledgement, scrolling/clicking, header-only dragging, log buffering/replay, loopback HTTP collector writes, celebratory fireworks/gift modals, and 7 advanced complex scenarios including cascading form inputs, fuzzy dropdown matching, hover submenus, contenteditable rich text, self-healing corrupted JSON parsing, modal AXTree boost, and high-risk action guards. In addition, `tests/live-e2e.test.cjs` automates real Google Chrome instances to execute live single-tab navigation, multi-level scrolling, and data extraction across public websites.

These tests **are not signed-in AI website compatibility tests or end-to-end task acceptance tests**. Issues and pull requests with sanitized diagnostic evidence are welcome.

## License

[MIT](LICENSE)
