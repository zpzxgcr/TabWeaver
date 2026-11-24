---
name: social-growth-hacker
description: Autonomous social media & GEO growth hacker for Indie Hackers and SaaS developers. Automatically decomposes user product descriptions into target community mappings (X/Twitter and Reddit subreddits), generates high-converting content matrix and technical reply templates, and orchestrates anti-ban scheduled patrol, posting, and engagement workflows.
---

# Social Growth Hacker Skill

This skill guides AI agents in turning a single-sentence product pitch or README into a fully autonomous, anti-ban social media & Generative Engine Optimization (GEO) growth engine across **X (Twitter)** and **Reddit**.

---

## 🎯 When to Activate This Skill

Activate this skill when:
- The user says: *"Help me promote my project/tool on Reddit and X"*, *"Generate social posts and replies for my product"*, or gives a brief product description and wants overseas growth.
- The user wants to set up automated or human-in-the-loop social media promotion without getting accounts shadowbanned.
- The user wants to systematically build brand entity mentions (GEO) for LLM retrieval and search engines.

---

## 🧭 The 5-Phase Autonomous Growth Workflow

```
[Phase 1: Product Ingestion]
       ↓ (Extract Value Prop, Persona, Core Differentiator)
[Phase 2: Channel Mapping]
       ↓ (Map Subreddits, Flairs, X Search Queries)
[Phase 3: Content Bank Generation]
       ↓ (5-Angle Post Matrix + 3-Tier Technical Pain-point Replies)
[Phase 4: Anti-Ban State Machine & Execution]
       ↓ (24h Cooldown, Real Browser Emulation, Human-in-the-Loop)
[Phase 5: Automated Patrol & Blocker Alerts]
         (Daily 3-slot scheduler, SMTP digests, macOS banner alerts)
```

---

## Phase 1: Semantic Product Ingestion

When the user describes their product (or points to a URL/README):

1. **Extract Core Dimensions**:
   - **Product Name**: (e.g., `TabWeaver`)
   - **One-line Hook**: What problem does it solve in plain English?
   - **Technical Moat / Unique Value**: (e.g., 100% client-side Manifest V3, 0 token waste, zero backend relays)
   - **Call-to-Action Links**:
     - ⭐ GitHub Repository (high-trust for developers)
     - 🛒 Chrome Web Store / App Store (conversion)
     - 🌐 Official Website & Documentation
2. **Target Audience Persona**:
   - Primary: Developers, Indie Hackers, Heavy AI Chat users, Productivity geeks.
   - Core Pain Points: Token costs, privacy leaks, repetitive context pasting, clunky browser UI.

---

## Phase 2: Community & Channel Mapping

Map the product into high-affinity communities and search query vectors:

### 1. Reddit Subreddit Matrix
| Subreddit | Member Persona | Allowed Post Types / Flairs | Posting Frequency Rule |
| :--- | :--- | :--- | :--- |
| `r/chrome_extensions` | Extension developers & power users | `Self Promotion`, `Showcase` | Max 1 post / 7-14 days |
| `r/SideProject` | Indie hackers & builders | `Showcase`, `Feedback` | Max 1 post / 7 days |
| `r/webdev` | Professional web developers | Weekly Showcase Thread | Strict no direct self-promo in main posts |
| `r/ChatGPT` / `r/ClaudeAI` | AI tool enthusiasts | High-value technical solution replies | Strictly reply-only (crosspost when viral) |

### 2. X (Twitter) Search Queries & Hashtags
- **Search Query Vectors**:
  - `("summarize tab" OR "read tab") AI`
  - `("DOM" OR "HTML") LLM token -filter:links`
  - `chrome extension "AI assistant"`
- **Hashtags**: `#OpenSource #BuildInPublic #AI #IndieHacker #ChromeExtension`

---

## Phase 3: Content Bank Generation

Generate a structured content matrix (`content-bank.json`) with **5 Distinct Post Angles** and **3 Pain-point Reply Templates**:

### 1. The 5 Distinct Post Angles (Rotation Pool)
1. **Angle 1 (Cost & Token Wastage)**:
   - *Hook*: "Dumping raw HTML into LLMs wastes 80%+ of your tokens. Here is how we solved it with zero server relays."
2. **Angle 2 (Feature & Visual Interaction)**:
   - *Hook*: "What if your AI chat could browse your other tabs natively just by typing '#'? Meet [Product Name]."
3. **Angle 3 (Privacy & Security First)**:
   - *Hook*: "Why do browser AI tools need your login credentials or cloud servers? They don't. 🛡️"
4. **Angle 4 (Developer Journey & Architecture)**:
   - *Hook*: "Building a pure client-side Manifest V3 extension in 2026 was surprisingly tough. Here is the architecture."
5. **Angle 5 (Community Benchmark / Comparison)**:
   - *Hook*: "We benchmarked DOM extraction across 15 popular websites. Here is the cleanest way to strip boilerplates."

### 2. Strict X (Twitter) Post Constraints
- **Length**: Maximum 280 characters for main tweet (aim for 220–260 chars for safety).
- **Format**:
  - Line 1: Strong hook with emoji.
  - Line 2: Empty line.
  - Lines 3-6: 3 bullet points with ❌ or 👉 highlighting benefits.
  - Line 7: Concluding takeaway statement.
- **Thread Reply (CTA)**: Always place links in the 1st reply (Thread) to maximize Twitter algorithm reach (tweets with external links in main body suffer reduced impression distribution).

### 3. High-Value Technical Reply Matrix (for 蹭评 / Community Engagement)
Never post low-effort marketing spam. Every comment must follow the **Value-First Formula**:
- **Sentence 1-2**: Provide genuine, deep technical diagnosis or solution to the author's question.
- **Sentence 3**: Contextual transition: *"We encountered the exact same challenge when building [Product Name]..."*
- **Sentence 4**: Natural reference: *"We open-sourced our client-side solution under MIT if you want to inspect how we avoided the cloud bottleneck: github.com/[org]/[repo]"*.

---

## Phase 4: Anti-Ban State Machine & Browser Emulation

Strict adherence to platform safety policies is mandatory to prevent account suspensions:

### 🛡️ Safety Red Lines & Cooldown Rules
1. **24-Hour Post Cooldown**: Never publish more than 1 main post per platform in any 24-hour rolling window.
2. **Engagement Manipulation Prohibition**:
   - Never use scripts to blindly bulk-post comments under 3rd-party threads (triggers `POLICY_REFUSAL_ENGAGEMENT_ABUSE` and immediate platform shadowbans).
   - Use the **Human-in-the-Loop Workflow**: The engine searches hot target threads, drafts the tailored technical reply, and displays a 1-click preview link for the user to submit in their authenticated browser.
3. **Browser Fingerprint Hygiene**:
   - Use the user's existing authenticated browser profile / persistent session.
   - Emulate human delays: random typing speed (50-120ms/char), random pauses (1-3s between steps), and smooth viewport scrolling.

---

## Phase 5: Automated Scheduler & Watchdog

1. **Daily Patrol Slots**:
   - **10:00 (Morning)**: Keyword opportunity detection & engagement draft dispatch.
   - **15:00 (Afternoon)**: Peak global engagement window — evaluate 24h cooldown; publish scheduled post angle if ready.
   - **21:00 (Evening)**: Post-day digest, metrics harvesting (views, impressions, upvote rate), and recap.
2. **Notifications & Alerts**:
   - **HTML Digest**: Delivered via SMTP to configured email address.
   - **Desktop Alert**: Native OS banner sound notification upon completion or blocker detection.
   - **Blocker Watchdog**: Immediate alert if CAPTCHA or re-login is required.

---

## 🛠️ Step-by-Step Execution Guide for Agents

When a user invokes this skill:

1. **Step 1 - Ask or Read Product Info**:
   If product details are in the workspace (e.g. `README.md` or `manifest.json`), read them automatically. Otherwise, ask the user for product name, value hook, and links.
2. **Step 2 - Generate Configuration Files**:
   Create or update:
   - `config.json` (email, schedule, brand name, links)
   - `content-bank.json` (populated with 5 topic angles and tailored reply matrix)
   - `state.json` (initialize post timestamps and reply counters)
3. **Step 3 - Register Background Patrol**:
   Execute `scripts/setup_daemon.py` to register the native system scheduler (macOS LaunchAgent, Linux cron, or Windows Task).
4. **Step 4 - Perform Immediate Health Check**:
   Run `scripts/growth_daemon.py --dry-run` to verify schedule parsing, state calculation, and notification dispatch.
