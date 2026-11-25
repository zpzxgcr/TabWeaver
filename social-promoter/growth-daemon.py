#!/usr/bin/env python3
"""
TabWeaver Autonomous Growth Daemon
Runs 3 times a day (Morning ~10:00, Afternoon ~15:00, Evening ~21:00).
Autonomous capabilities:
1. Evaluates post timing (24-hour cooldown, optimal engagement windows)
2. Executes post publishing or community engagement/replies (蹭评/热点答疑)
3. Monitors blockers (CAPTCHA, logout) and sends high-priority email alerts
4. Sends execution digest emails to zpzxgcr@163.com
"""

import os
import sys
import json
import time
import random
import argparse
from datetime import datetime, timedelta

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(CURRENT_DIR, "config.json")
STATE_PATH = os.path.join(CURRENT_DIR, "state.json")
CONTENT_PATH = os.path.join(CURRENT_DIR, "content-bank.json")

import notifier
import opportunity_radar

def load_json(path, default=None):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default or {}

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def determine_current_slot():
    now = datetime.now()
    hour = now.hour
    if 6 <= hour < 12:
        return "morning"
    elif 12 <= hour < 18:
        return "afternoon"
    else:
        return "evening"

def should_publish_post(platform, state, config, slot):
    """
    Decide whether to publish a new main post:
    1. Must have passed >= 24 hours cooldown
    2. Morning or afternoon slots preferred for global engagement
    """
    last_info = state.get("last_post", {}).get(platform, {})
    last_time_str = last_info.get("timestamp")
    
    if not last_time_str:
        return True, "首发就绪（无历史发帖记录）"
        
    last_time = datetime.fromisoformat(last_time_str)
    elapsed_hours = (datetime.now() - last_time).total_seconds() / 3600.0
    cooldown = config.get("policy", {}).get("post_interval_hours", 24)
    
    if elapsed_hours < cooldown:
        return False, f"冷却中（距离上次发帖仅 {elapsed_hours:.1f} 小时，要求 >= {cooldown} 小时）"
        
    if slot == "evening":
        return False, "晚间时段适合互动答疑与复盘，主帖顺延至明日上午黄金时段发布"
        
    return True, f"时机成熟（已冷却 {elapsed_hours:.1f} 小时，黄金时段）"

def select_next_topic(content_bank, state):
    topics = content_bank.get("topics", [])
    if not topics:
        return None
    curr_idx = state.get("current_topic_index", 1)
    next_idx = (curr_idx % len(topics)) + 1
    for t in topics:
        if t.get("id") == next_idx:
            return t
    return topics[0]

def execute_growth_cycle(slot=None, force_post=False, dry_run=False):
    config = load_json(CONFIG_PATH)
    state = load_json(STATE_PATH, {
        "last_post": {},
        "today_replies_count": 0,
        "last_reply_date": "",
        "replied_targets": [],
        "current_topic_index": 1
    })
    content_bank = load_json(CONTENT_PATH)
    
    active_slot = slot or determine_current_slot()
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # Reset daily counters at start of day
    if state.get("last_reply_date") != today_str:
        state["last_reply_date"] = today_str
        state["today_replies_count"] = 0
        
    print(f"============================================================")
    print(f"[Growth Daemon] 触发时段: {active_slot.upper()} | 当前时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"============================================================")

    # 1. Evaluate X Platform
    can_post_x, x_reason = should_publish_post("x", state, config, active_slot)
    if force_post:
        can_post_x = True
        x_reason = "强制发帖模式激活"
        
    print(f"👉 [X/Twitter 决策]: {'【发布新帖】' if can_post_x else '【热点答疑/蹭评】'} - {x_reason}")

    # 2. Evaluate Reddit Platform
    reddit_policy = config.get("policy", {}).get("reddit", {})
    enable_reddit_post = reddit_policy.get("enable_main_post", False)
    
    if enable_reddit_post:
        can_post_reddit, reddit_reason = should_publish_post("reddit", state, config, active_slot)
        if force_post:
            can_post_reddit = True
            reddit_reason = "强制发帖模式激活"
    else:
        can_post_reddit = False
        reddit_reason = "安全策略已停用主帖，聚焦关键词痛点蹭评 (零外链 · 自然植入 TabWeaver 品牌词)"
        
    print(f"👉 [Reddit 决策]: {'【发布新帖】' if can_post_reddit else '【关键词痛点蹭评 (零外链+品牌词)】'} - {reddit_reason}")

    execution_results = {
        "时段槽位": active_slot.upper(),
        "X (Twitter) 决策": "发布新帖" if can_post_x else f"热点互动 ({x_reason})",
        "Reddit 决策": "发布新帖" if can_post_reddit else "关键词痛点答疑 (零外链 · TabWeaver 品牌词渗透)",
        "今日已互动回复数": f"{state.get('today_replies_count', 0)} / {config.get('policy', {}).get('max_daily_replies', 5)} 条",
        "最新发布资产": f"X: {state.get('last_post', {}).get('x', {}).get('url', '无')}<br>Reddit: {state.get('last_post', {}).get('reddit', {}).get('url', '无')}"
    }

    # If action required, pick next topic
    if can_post_x or can_post_reddit:
        topic = select_next_topic(content_bank, state)
        if topic:
            execution_results["备选发帖主题"] = f"Topic #{topic.get('id')}: {topic.get('angle')} ({topic.get('hook')[:40]}...)"
            if not dry_run:
                state["current_topic_index"] = topic.get("id")

    # Scout fresh real-time opportunities from HN, Dev.to, Reddit
    print("[Growth Daemon] 正在全网雷达巡检最新推广/交流机会 (HN / Dev.to / Reddit)...")
    try:
        opps = opportunity_radar.run_radar(max_total=3, update_state=not dry_run)
        if opps:
            for idx, opp in enumerate(opps, 1):
                key = f"🔥 今日发现机会 #{idx} [{opp['platform']}]"
                summary = f"<b>{opp['title']}</b> <span style='color:#64748b;'>({opp['meta']})</span>"
                execution_results[key] = notifier.build_platform_action_html(opp["platform"], opp["url"], opp["draft"], summary)
        else:
            execution_results["🔥 今日机会雷达"] = "本轮暂未发现新的未读匹配讨论，将在下一白天时段继续扫描。"
    except Exception as e:
        print(f"[Growth Daemon] 机会雷达扫描异常: {e}")

    # Save state
    save_json(STATE_PATH, state)

    # Send success/status digest to email
    print(f"[Growth Daemon] 正在同步本次执行状态至邮箱: {config.get('email', {}).get('recipient')}...")
    notifier.report_digest(f"{active_slot.upper()} 巡检决策就绪", execution_results)
    
    print("[Growth Daemon] 本轮巡检与调度决策顺利完成！")
    return execution_results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TabWeaver Autonomous Growth Daemon")
    parser.add_argument("--slot", choices=["morning", "afternoon", "evening"], help="Manually specify slot")
    parser.add_argument("--force-post", action="store_true", help="Force post action ignoring cooldown")
    parser.add_argument("--dry-run", action="store_true", help="Dry run without updating state")
    args = parser.parse_args()

    execute_growth_cycle(slot=args.slot, force_post=args.force_post, dry_run=args.dry_run)
