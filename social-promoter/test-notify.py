#!/usr/bin/env python3
"""
Test mail notification & dry-run simulation for TabWeaver Growth Daemon.
"""

import os
import sys
import json
from datetime import datetime

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CURRENT_DIR)

import notifier
import growth_daemon

def run_test_suite():
    print("============================================================")
    print("🧪 1. 正在向 zpzxgcr@163.com 发起邮件与系统通知测试...")
    print("============================================================")
    
    test_data = {
        "测试类型": "TabWeaver 增长引擎连通性自检",
        "目标邮箱": "zpzxgcr@163.com",
        "Chrome 扩展版本": "v2.1.8 (已提审待审核)",
        "已发布 X 推文": "https://x.com/Gustavo_zhaji/status/2124726174786211875",
        "已发布 Reddit 贴": "https://www.reddit.com/r/chrome_extensions/comments/1y3bafg/showcase_native_crosstab_dom_distiller_for_web_ai/",
        "守护进程状态": "macOS LaunchAgent 已激活 (每日 10:00 / 15:00 / 21:00)",
        "状态机冷却判定": "运行正常 (24h 保护中)"
    }
    
    result = notifier.report_digest("增长引擎连通性自检测试", test_data)
    if result:
        print("✅ 真实 SMTP 邮件已成功投递至 zpzxgcr@163.com！")
    else:
        print("ℹ️ 邮件测试内容已记录至本地日志，桌面原生弹窗已触发！")
        print("💡 如需收到真实邮件，请提供 163 邮箱客户端授权码（16位字母）。")

    print("\n============================================================")
    print("🤖 2. 模拟走一次完整的守护调度决策链路 (Simulation Run)...")
    print("============================================================")
    
    growth_daemon.execute_growth_cycle(dry_run=True)
    
    print("\n============================================================")
    print("🎉 测试与全流程模拟执行完毕！")
    print("============================================================")

if __name__ == "__main__":
    run_test_suite()
