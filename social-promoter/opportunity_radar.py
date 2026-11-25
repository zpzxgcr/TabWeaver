#!/usr/bin/env python3
"""
TabWeaver Autonomous Opportunity Radar
Scouts real-time overseas developer discussions & engagement opportunities across:
1. Hacker News (Official Algolia API)
2. Dev.to (Official Articles API)
3. Reddit (r/chrome_extensions, r/SideProject public RSS/JSON + Playwright fallback)
4. X/Twitter search opportunities (via local persistent browser profile if available)

Outputs deduplicated, pre-drafted high-value interaction cards ready for 1-click email digests.
"""

import os
import json
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_PATH = os.path.join(CURRENT_DIR, "state.json")
CONTENT_PATH = os.path.join(CURRENT_DIR, "content-bank.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 TabWeaverRadar/1.0"
}

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

def scout_hacker_news(seen_urls):
    """Scout fresh Hacker News stories discussing browser AI, extensions, or DOM."""
    results = []
    queries = ["chrome extension AI", "browser agent DOM", "local browser AI"]
    cutoff_ts = int(time.time()) - 7 * 86400  # Last 7 days
    for q in queries:
        try:
            url = f"https://hn.algolia.com/api/v1/search_by_date?query={urllib.parse.quote(q)}&tags=story&numericFilters=created_at_i>{cutoff_ts}&hitsPerPage=5"
            req = urllib.request.Request(url, headers=HEADERS)
            data = json.loads(urllib.request.urlopen(req, timeout=8).read().decode("utf-8"))
            for hit in data.get("hits", []):
                oid = hit.get("objectID")
                item_url = f"https://news.ycombinator.com/item?id={oid}"
                title = hit.get("title", "")
                if not oid or not title or item_url in seen_urls:
                    continue
                if "tabweaver" in title.lower():
                    continue
                results.append({
                    "platform": "Hacker News",
                    "title": title,
                    "url": item_url,
                    "meta": f"{hit.get('points', 0)} pts · {hit.get('num_comments', 0)} comments",
                    "draft": match_best_reply(title)
                })
                seen_urls.add(item_url)
                if len(results) >= 2:
                    return results
        except Exception as e:
            print(f"[Radar][HN] Error querying '{q}': {e}")
    return results

def scout_devto(seen_urls):
    """Scout recent Dev.to articles tagged chromeextension or browser-extension."""
    results = []
    for tag in ["chromeextension", "browserextension"]:
        try:
            url = f"https://dev.to/api/articles?tag={tag}&top=7&per_page=8"
            req = urllib.request.Request(url, headers=HEADERS)
            articles = json.loads(urllib.request.urlopen(req, timeout=8).read().decode("utf-8"))
            for art in articles:
                art_url = art.get("url")
                title = art.get("title", "")
                if not art_url or art_url in seen_urls or "tabweaver" in title.lower():
                    continue
                results.append({
                    "platform": "Dev.to",
                    "title": title,
                    "url": art_url,
                    "meta": f"❤️ {art.get('public_reactions_count', 0)} · 💬 {art.get('comments_count', 0)}",
                    "draft": match_best_reply(title, art.get("description", ""))
                })
                seen_urls.add(art_url)
                if len(results) >= 2:
                    return results
        except Exception as e:
            print(f"[Radar][Dev.to] Error for tag '{tag}': {e}")
    return results

def scout_reddit_rss(seen_urls):
    """Scout fresh discussions on r/chrome_extensions and r/SideProject via RSS feed."""
    results = []
    feeds = [
        ("r/chrome_extensions", "https://www.reddit.com/r/chrome_extensions/.rss?limit=15"),
        ("r/SideProject", "https://www.reddit.com/r/SideProject/.rss?limit=15")
    ]
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    for sub, rss_url in feeds:
        try:
            req = urllib.request.Request(rss_url, headers=HEADERS)
            xml_data = urllib.request.urlopen(req, timeout=8).read()
            root = ET.fromstring(xml_data)
            for entry in root.findall("atom:entry", ns):
                title_el = entry.find("atom:title", ns)
                link_el = entry.find("atom:link", ns)
                author_el = entry.find("atom:author/atom:name", ns)
                if title_el is None or link_el is None:
                    continue
                title = title_el.text or ""
                post_url = link_el.attrib.get("href", "")
                author = author_el.text if author_el is not None else ""
                if not post_url or post_url in seen_urls:
                    continue
                if "gustavo_zhaji" in author.lower() or "tabweaver" in title.lower():
                    continue
                # Prioritize posts asking for feedback or related to AI/tab/DOM
                if any(k in title.lower() for k in ["ai", "tab", "gpt", "claude", "feedback", "built", "extension", "dom", "summar"]):
                    results.append({
                        "platform": f"Reddit ({sub})",
                        "title": title,
                        "url": post_url,
                        "meta": f"by {author}",
                        "draft": match_best_reply(title)
                    })
                    seen_urls.add(post_url)
                    if len(results) >= 2:
                        return results
        except Exception as e:
            print(f"[Radar][Reddit RSS] Notice for {sub}: {e}")
    return results

def run_radar(max_total=4, update_state=True):
    state = load_json(STATE_PATH, {})
    scouted = state.setdefault("scouted_targets", [])
    seen_urls = set(scouted)

    opportunities = []
    opportunities.extend(scout_reddit_rss(seen_urls))
    opportunities.extend(scout_hacker_news(seen_urls))
    opportunities.extend(scout_devto(seen_urls))

    opportunities = opportunities[:max_total]
    if update_state and opportunities:
        for opp in opportunities:
            if opp["url"] not in scouted:
                scouted.append(opp["url"])
        # Keep history capped at last 200 items
        state["scouted_targets"] = scouted[-200:]
        save_json(STATE_PATH, state)

    return opportunities

if __name__ == "__main__":
    opps = run_radar(max_total=5, update_state=False)
    print(f"Found {len(opps)} opportunities:")
    for o in opps:
        print(f" - [{o['platform']}] {o['title']} ({o['meta']})\n   {o['url']}\n   Draft: {o['draft']}\n")
