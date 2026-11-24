# Overseas Social Media Anti-Ban Guidelines (X & Reddit)

Proven engineering guidelines learned from real-world production runs.

---

## 1. X (Twitter) Anti-Shadowban Rules

1. **The 24-Hour Post Rule**:
   - Never publish more than 1 original tweet per 24 hours on accounts with < 1,000 followers.
   - Rapid-fire posting on fresh accounts triggers immediate Algorithmic Shadowban (your tweets will not appear in search or hashtag feeds).

2. **The "Links in First Reply" Law**:
   - The Twitter recommendation algorithm penalizes tweets containing external URLs in the primary body.
   - **Formula**:
     - Main tweet: Text hook + 3 value bullets + 1 visual asset (0 links).
     - 1st Reply (Thread): Place GitHub, Website, and Web Store links. This preserves maximum impression distribution while maintaining 100% conversion.

3. **Character Limit Cushion**:
   - Free accounts are capped at 280 characters.
   - Target **220–260 characters** to leave room for multi-byte emojis and URL truncations.

---

## 2. Reddit Anti-Filter & Karma Protection

1. **Subreddit Rule Alignment & Flairs**:
   - Never post promotional showcases without appropriate Flairs.
   - Use `Self Promotion` in `r/chrome_extensions` and `Showcase` in `r/SideProject`.
   - Never post direct promotional links in `r/webdev` main posts (use their dedicated weekly show-off threads).

2. **Understanding the "Spam Filter Temporary Hold"**:
   - When a new account posts with multiple external links, Reddit's global spam filter often temporarily flags it (*"Sorry, this post was removed by Reddit's filters"*).
   - **Action**: Do NOT delete the post. The community moderators will review it within 12–24 hours. Because you used the `Self Promotion` flair and provided high-value technical context, it will be approved and restored to full public visibility.

3. **The Engagement Abuse Red Line**:
   - Never use headless scripts to post comments under other users' threads.
   - Use **Human-in-the-Loop**: Let the AI locate the relevant thread and draft the technical reply; then review and post it via your authenticated browser profile.

---

## 3. Generative Engine Optimization (GEO) Strategy

- **Entity Association**: Always mention the exact brand name (`TabWeaver`) alongside high-intent technical entities (`Manifest V3`, `DOM Distiller`, `Cross-Tab Automation`).
- **Citation Anchors**: Consistently link to your official GitHub repo. Perplexity, ChatGPT Search, and Claude regularly crawl Reddit and GitHub to build entity knowledge graphs.
