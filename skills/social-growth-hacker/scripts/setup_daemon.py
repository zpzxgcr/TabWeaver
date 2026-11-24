#!/usr/bin/env python3
"""
Cross-Platform Daemon Setup Tool
Registers daily 3-time patrol schedule (10:00, 15:00, 21:00)
Supports macOS (LaunchAgent) and Linux (crontab).
"""

import os
import sys
import platform
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DAEMON_SCRIPT = os.path.join(SCRIPT_DIR, "growth_daemon.py")
PYTHON_BIN = sys.executable

def setup_macos():
    plist_label = "com.user.social.growth"
    plist_dir = os.path.expanduser("~/Library/LaunchAgents")
    os.makedirs(plist_dir, exist_ok=True)
    plist_path = os.path.join(plist_dir, f"{plist_label}.plist")

    plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{plist_label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{PYTHON_BIN}</string>
        <string>{DAEMON_SCRIPT}</string>
    </array>
    <key>StartCalendarInterval</key>
    <array>
        <dict><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>15</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>21</integer><key>Minute</key><integer>0</integer></dict>
    </array>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
"""
    with open(plist_path, "w", encoding="utf-8") as f:
        f.write(plist_content)
    
    subprocess.run(["launchctl", "unload", plist_path], stderr=subprocess.DEVNULL)
    subprocess.run(["launchctl", "load", plist_path], check=True)
    print(f"✅ macOS LaunchAgent registered: {plist_path}")
    print("⏰ Scheduled daily at 10:00, 15:00, and 21:00.")

def setup_linux():
    cron_cmd = f"0 10,15,21 * * * {PYTHON_BIN} {DAEMON_SCRIPT} >/dev/null 2>&1"
    try:
        existing = subprocess.check_output(["crontab", "-l"], text=True)
    except Exception:
        existing = ""
    
    if DAEMON_SCRIPT not in existing:
        new_cron = existing.strip() + "\n" + cron_cmd + "\n"
        proc = subprocess.Popen(["crontab", "-"], stdin=subprocess.PIPE, text=True)
        proc.communicate(input=new_cron)
        print("✅ Linux crontab updated with 10:00, 15:00, 21:00 patrol schedule.")
    else:
        print("ℹ️ Linux crontab already configured.")

def main():
    os_name = platform.system().lower()
    if os_name == "darwin":
        setup_macos()
    elif os_name == "linux":
        setup_linux()
    else:
        print(f"⚠️ Automatic registration for {os_name} is not supported directly. Run '{PYTHON_BIN} {DAEMON_SCRIPT}' via Task Scheduler.")

if __name__ == "__main__":
    main()
