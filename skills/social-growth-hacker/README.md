# 🚀 Social Growth Hacker Skill

> Turn a single-sentence product pitch into an autonomous, anti-ban overseas growth engine across **X (Twitter)** & **Reddit**.

---

## 🌟 What This Skill Does

1. **One-Prompt Product Ingestion**: Tell the agent what your product does, and it automatically extracts your core value proposition and target persona.
2. **Channel & Subreddit Mapping**: Automatically selects the best Reddit subreddits (`r/chrome_extensions`, `r/SideProject`, `r/webdev`) and X search queries.
3. **5-Angle Post Matrix + Reply Bank**: Auto-generates 5 distinct post angles (cost, features, privacy, architecture, benchmarks) and 3 high-value technical reply templates for community engagement.
4. **Anti-Ban State Machine**: Enforces strict 24-hour post cooldowns and platform safety guidelines to prevent account suspensions.
5. **Human-in-the-Loop & Autonomous Patrol**: Runs daily patrols at **10:00, 15:00, 21:00**, sending status digests to your email and desktop.

---

## 📂 Structure

```text
social-growth-hacker/
├── SKILL.md                     # Core Agent instructions & execution workflows
├── README.md                    # Quick start & developer overview
├── templates/
│   ├── config.template.json     # Configuration template
│   └── content-bank.template.json # 5-angle content bank template
├── references/
│   └── anti-ban-guidelines.md   # Production-tested anti-ban rules
└── scripts/
    ├── init_content_bank.py     # Auto-renders templates from product description
    ├── growth_daemon.py         # State-machine scheduler & patrol driver
    ├── notifier.py              # Email HTML digest & macOS banner alerts
    └── setup_daemon.py          # Cross-platform scheduler registrar
```

---

## 🚀 Quick Start

### 1. In Any AI Agent (Claude Code, Cursor, Antigravity)
Give the agent this instruction:
```text
"Read skills/social-growth-hacker/SKILL.md and set up overseas promotion for my product [Product Name]."
```

### 2. Standalone CLI Generation
```bash
python3 scripts/init_content_bank.py \
  --name "MyCoolTool" \
  --tagline "Fastest AI assistant" \
  --github "https://github.com/username/MyCoolTool" \
  --store "https://chromewebstore.google.com/detail/xxx" \
  --email "my_email@163.com"
```

### 3. Register Daily Background Patrol
```bash
python3 scripts/setup_daemon.py
```
This sets up automated silent patrols at **10:00, 15:00, and 21:00** every day.
