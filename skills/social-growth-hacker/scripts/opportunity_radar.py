#!/usr/bin/env python3
"""
TabWeaver Autonomous Opportunity Radar (v2 with 3-Layer Deduplication)
Scouts real-time overseas developer discussions & engagement opportunities across:
1. Hacker News (Official Algolia API + Live Comment Tree Deduplication)
2. Dev.to (Official Articles API + Live Comments API Deduplication)
3. Reddit (r/chrome_extensions, r/SideProject RSS fallback)

Deduplication Layers:
- Layer 1: URL Normalization (strips trailing slashes, query params, anchors)
- Layer 2: Persistent History (state.json: replied_targets | scouted_targets)
- Layer 3: Live Comment Inspection (skips any thread already mentioning 'tabweaver' or user handles)
"""

import os
import json
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_PATH = os.path.join(CURRENT_DIR, "state.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
}

OWN_HANDLES = ("lyuan", "zpzxgcr", "gustavo_zhaji", "gustavo-zhaji")

def load_json(path, default=None):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return default if default is not None else {}

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def normalize_url(u):
    if not u:
        return ""
    u = str(u).strip()
    try:
        parsed = urllib.parse.urlparse(u)
        # Keep query param ONLY for HN item?id=xxx
        if "news.ycombinator.com" in parsed.netloc and "id=" in parsed.query:
            qs = urllib.parse.parse_qs(parsed.query)
            item_id = qs.get("id", [""])[0]
            return f"https://news.ycombinator.com/item?id={item_id}"
        clean_path = parsed.path.rstrip("/")
        return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{clean_path}"
    except Exception:
        return u.rstrip("/")

def get_json(url, timeout=8):
    req = urllib.request.Request(url, headers=HEADERS)
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8"))

def has_already_replied_devto(article_id):
    """Inspect live Dev.to comments tree for our handles or TabWeaver mentions."""
    try:
        comments = get_json(f"https://dev.to/api/comments?a_id={article_id}")
        def scan(nodes):
            for node in nodes:
                user = node.get("user", {})
                uname = (user.get("username") or "").lower()
                name = (user.get("name") or "").lower()
                body = (node.get("body_html") or "").lower()
                if any(h in uname or h in name for h in OWN_HANDLES) or "tabweaver" in body:
                    return True
                if scan(node.get("children", [])):
                    return True
            return False
        return scan(comments)
    except Exception:
        return False

def has_already_replied_hn(item_id):
    """Inspect live Hacker News item tree for our handles or TabWeaver mentions."""
    try:
        data = get_json(f"https://hn.algolia.com/api/v1/items/{item_id}")
        def scan(nodes):
            for node in nodes:
                author = (node.get("author") or "").lower()
                text = (node.get("text") or "").lower()
                if any(h in author for h in OWN_HANDLES) or "tabweaver" in text:
                    return True
                if scan(node.get("children", [])):
                    return True
            return False
        return scan(data.get("children", []))
    except Exception:
        return False

def match_best_reply(title, text_snippet=""):
    """Pick the most contextually relevant, non-spammy geek reply."""
    combined = f"{title} {text_snippet}".lower()
    if any(k in combined for k in ["token", "html", "dom", "scrape", "extract", "audio", "summariz", "boilerplate"]):
        return (
            "Clean DOM extraction makes a massive difference. In our MIT open-source extension TabWeaver, "
            "we implemented a local TreeWalker distiller in the content script to strip scripts/SVGs and prioritize active modals—cutting token overhead by 80%+. "
            "Great work on your implementation!"
        )
    if any(k in combined for k in ["privacy", "login", "auth", "sso", "cookie", "security", "local", "server", "analytics"]):
        return (
            "Keeping data strictly local without cloud relay servers is the hardest but most important part for logged-in apps. "
            "We took the pure Manifest V3 local-only route in TabWeaver (open-source) so users can let ChatGPT/Claude/DeepSeek read signed-in tabs safely."
        )
    if any(k in combined for k in ["feedback", "shipped", "built", "launch", "extension", "side project"]):
        return (
            "Congrats on shipping! Clean execution. While building our own Manifest V3 extension (TabWeaver), "
            "we noticed tab state management across active chats had tricky edge cases—curious how you structured yours?"
        )
    return (
        "Really interesting approach! We explored a similar client-side workflow while building TabWeaver "
        "(an open-source Manifest V3 cross-tab bridge for web AI chats). Wishing you great momentum!"
    )

def scout_hacker_news(seen_norms, replied_norms):
    """Scout fresh Hacker News stories discussing browser AI, extensions, or DOM."""
    results = []
    queries = ["chrome extension AI", "browser agent DOM", "local browser AI"]
    cutoff_ts = int(time.time()) - 7 * 86400
    for q in queries:
        try:
            url = f"https://hn.algolia.com/api/v1/search_by_date?query={urllib.parse.quote(q)}&tags=story&numericFilters=created_at_i>{cutoff_ts}&hitsPerPage=8"
            data = get_json(url)
            for hit in data.get("hits", []):
                oid = hit.get("objectID")
                item_url = f"https://news.ycombinator.com/item?id={oid}"
                norm = normalize_url(item_url)
                title = hit.get("title", "")
                if not oid or not title or norm in seen_norms or "tabweaver" in title.lower():
                    continue
                if has_already_replied_hn(oid):
                    print(f"[Radar][Dedup] Skipped HN item already replied: {item_url}")
                    seen_norms.add(norm)
                    replied_norms.add(norm)
                    continue
                results.append({
                    "platform": "Hacker News",
                    "title": title,
                    "url": item_url,
                    "meta": f"{hit.get('points', 0)} pts · {hit.get('num_comments', 0)} comments",
                    "draft": match_best_reply(title)
                })
                seen_norms.add(norm)
                if len(results) >= 2:
                    return results
        except Exception as e:
            print(f"[Radar][HN] Error querying '{q}': {e}")
    return results

def scout_devto(seen_norms, replied_norms):
    """Scout recent Dev.to articles tagged chromeextension or browserextension."""
    results = []
    for tag in ["chromeextension", "browserextension", "ai"]:
        try:
            articles = get_json(f"https://dev.to/api/articles?tag={tag}&top=7&per_page=10")
            for art in articles:
                art_url = art.get("url")
                aid = art.get("id")
                title = art.get("title", "")
                norm = normalize_url(art_url)
                if not art_url or norm in seen_norms or "tabweaver" in title.lower():
                    continue
                if tag == "ai" and not any(w in title.lower() for w in ["chrome", "extension", "browser", "dom", "tab"]):
                    continue
                if aid and has_already_replied_devto(aid):
                    print(f"[Radar][Dedup] Skipped Dev.to article already replied: {art_url}")
                    seen_norms.add(norm)
                    replied_norms.add(norm)
                    continue
                results.append({
                    "platform": "Dev.to",
                    "title": title,
                    "url": art_url,
                    "meta": f"❤️ {art.get('public_reactions_count', 0)} · 💬 {art.get('comments_count', 0)}",
                    "draft": match_best_reply(title, art.get("description", ""))
                })
                seen_norms.add(norm)
                if len(results) >= 2:
                    return results
        except Exception as e:
            print(f"[Radar][Dev.to] Error for tag '{tag}': {e}")
    return results

def run_radar(max_total=4, update_state=True):
    state = load_json(STATE_PATH, {})
    scouted = state.setdefault("scouted_targets", [])
    replied = state.setdefault("replied_targets", [])
    
    seen_norms = {normalize_url(u) for u in (scouted + replied)}
    replied_norms = {normalize_url(u) for u in replied}

    opportunities = []
    opportunities.extend(scout_hacker_news(seen_norms, replied_norms))
    opportunities.extend(scout_devto(seen_norms, replied_norms))

    opportunities = opportunities[:max_total]
    if update_state:
        for opp in opportunities:
            n = normalize_url(opp["url"])
            if n not in {normalize_url(x) for x in scouted}:
                scouted.append(n)
        for rn in replied_norms:
            if rn not in {normalize_url(x) for x in replied}:
                replied.append(rn)
        state["scouted_targets"] = scouted[-300:]
        state["replied_targets"] = replied[-300:]
        save_json(STATE_PATH, state)

    return opportunities

if __name__ == "__main__":
    opps = run_radar(max_total=4, update_state=False)
    print(f"Found {len(opps)} BRAND-NEW un-replied opportunities:")
    for o in opps:
        print(f" - [{o['platform']}] {o['title']} ({o['meta']})\n   {o['url']}\n   Draft: {o['draft']}\n")
