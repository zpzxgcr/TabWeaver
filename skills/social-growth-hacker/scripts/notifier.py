#!/usr/bin/env python3
"""
TabWeaver Social Growth - Notification & Alert Watchdog
Handles:
1. SMTP HTML Email sending (to zpzxgcr@163.com)
2. macOS System Desktop Notifications (osascript fallback)
3. Blocking alerts & daily execution digests
"""

import os
import json
import smtplib
import subprocess
import urllib.parse
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from datetime import datetime

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(CURRENT_DIR, "config.json")
SECRETS_FILE = os.path.join(CURRENT_DIR, ".secrets.json")
LOG_FILE = os.path.join(CURRENT_DIR, "reports", "email_outbox.log")

def load_config():
    cfg = {}
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    email_cfg = cfg.setdefault("email", {})
    # Prefer local untracked .secrets.json or environment variable to prevent accidental git leaks
    if not email_cfg.get("auth_code") and os.path.exists(SECRETS_FILE):
        try:
            with open(SECRETS_FILE, "r", encoding="utf-8") as sf:
                secrets = json.load(sf)
                if secrets.get("email_auth_code"):
                    email_cfg["auth_code"] = secrets["email_auth_code"]
        except Exception:
            pass
    if not email_cfg.get("auth_code") and os.environ.get("EMAIL_AUTH_CODE"):
        email_cfg["auth_code"] = os.environ["EMAIL_AUTH_CODE"]
    return cfg

def send_macos_notification(title, message, subtitle=""):
    """Trigger native macOS notification banner with sound."""
    try:
        script = f'display notification "{message}" with title "{title}"'
        if subtitle:
            script += f' subtitle "{subtitle}"'
        script += ' sound name "Hero"'
        subprocess.run(["osascript", "-e", script], check=False)
    except Exception as e:
        print(f"[Notifier] Failed to send macOS notification: {e}")

def send_email(subject, html_body, text_body="", image_path=None):
    """
    Send an email via SMTP.
    Falls back gracefully to logging & desktop banner if auth_code is not configured.
    """
    cfg = load_config().get("email", {})
    recipient = cfg.get("recipient", "zpzxgcr@163.com")
    sender = cfg.get("sender", "zpzxgcr@163.com")
    server = cfg.get("smtp_server", "smtp.163.com")
    port = cfg.get("smtp_port", 465)
    use_ssl = cfg.get("use_ssl", True)
    auth_code = cfg.get("auth_code", "").strip()

    # Always log the notification locally
    os.makedirs(os.path.join(CURRENT_DIR, "reports"), exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as log:
        log.write(f"\n[{datetime.now().isoformat()}] SUBJECT: {subject}\nTO: {recipient}\n{text_body or html_body}\n")

    if not auth_code:
        print(f"[Notifier] Notice: Email auth_code not set. Notification recorded in {LOG_FILE}.")
        send_macos_notification("TabWeaver 增长任务提醒", subject, "未配置邮箱授权码，已记录日志")
        return False

    msg = MIMEMultipart("related")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = recipient

    part_text = MIMEText(text_body or "Please view this email in an HTML-capable client.", "plain", "utf-8")
    part_html = MIMEText(html_body, "html", "utf-8")
    msg.attach(part_text)
    msg.attach(part_html)

    if image_path and os.path.exists(image_path):
        with open(image_path, "rb") as img_f:
            img = MIMEImage(img_f.read())
            img.add_header("Content-Disposition", "attachment", filename=os.path.basename(image_path))
            msg.attach(img)

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(server, port, timeout=10) as s:
                s.login(sender, auth_code)
                s.send_message(msg)
        else:
            with smtplib.SMTP(server, port, timeout=10) as s:
                s.starttls()
                s.login(sender, auth_code)
                s.send_message(msg)
        print(f"[Notifier] Email successfully delivered to {recipient}!")
        return True
    except Exception as e:
        print(f"[Notifier] SMTP Send failed: {e}")
        send_macos_notification("TabWeaver 邮件发送失败", f"错误: {e}")
        return False

def alert_blocked(platform, reason, action_needed="请在右侧内置浏览器中协助处理", screenshot_path=None):
    """Send immediate high-priority alert when automation is blocked."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    subject = f"🚨【紧急阻塞报警】TabWeaver 社媒任务在 {platform} 遇到阻断！"
    
    html = f"""
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #fee2e2; border-left: 5px solid #ef4444; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="color: #b91c1c; margin: 0 0 8px;">🚨 TabWeaver 社媒全自动任务阻塞提醒</h2>
            <p style="margin: 0; font-size: 14px; color: #7f1d1d;">发生时间：<b>{now_str}</b></p>
        </div>

        <p>尊敬的开发者，</p>
        <p>TabWeaver 自动化守护引擎在执行 <b>{platform}</b> 任务时遇到了外部安全检查或需要人工介入的情况：</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: 600; width: 100px;">阻断平台：</td>
                <td style="padding: 8px;">{platform}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: 600;">原因类型：</td>
                <td style="padding: 8px; color: #dc2626;">{reason}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: 600;">建议操作：</td>
                <td style="padding: 8px; color: #2563eb;"><b>{action_needed}</b></td>
            </tr>
        </table>

        <p style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px;">
            💡 <b>处理提示</b>：打开 Antigravity 右侧内置浏览器面板，完成滑块验证或登录后，守护引擎将自动无缝恢复执行，无需重启！
        </p>
    </body>
    </html>
    """
    
    text = f"【TabWeaver 阻塞报警】\n时间：{now_str}\n平台：{platform}\n原因：{reason}\n建议：{action_needed}"
    
    # 1. 触发桌面原生弹窗
    send_macos_notification(f"TabWeaver 遇到阻断 ({platform})", reason, action_needed)
    # 2. 发送邮件
    return send_email(subject, html, text, screenshot_path)

def report_digest(title, details_dict, screenshot_path=None):
    """Send execution success digest email."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    subject = f"✅【TabWeaver 战报】{title} ({now_str})"
    
    rows = ""
    for k, v in details_dict.items():
        rows += f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px; font-weight: 600; color: #475569;">{k}</td>
            <td style="padding: 8px; color: #0f172a;">{v}</td>
        </tr>
        """
        
    html = f"""
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #ecfdf5; border-left: 5px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="color: #065f46; margin: 0 0 8px;">🚀 TabWeaver 海外增长执行成果</h2>
            <p style="margin: 0; font-size: 13px; color: #047857;">执行时间：<b>{now_str}</b></p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
            {rows}
        </table>

        <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
            TabWeaver Autonomous Growth Engine · Generative Engine Optimization (GEO)
        </div>
    </body>
    </html>
    """
    
    text = f"【TabWeaver 战报】\n时间：{now_str}\n" + "\n".join([f"{k}: {v}" for k, v in details_dict.items()])
    send_macos_notification("TabWeaver 增长任务执行完成", title)
    return send_email(subject, html, text, screenshot_path)

def build_x_intent_html(tweet_id_or_url, reply_text, summary=""):
    """Build a zero-copy-paste 1-click X Web Intent HTML action card for emails."""
    tweet_id = str(tweet_id_or_url).rstrip("/").split("/")[-1]
    encoded = urllib.parse.quote(reply_text)
    intent_url = f"https://twitter.com/intent/tweet?in_reply_to={tweet_id}&text={encoded}"
    raw_url = tweet_id_or_url if str(tweet_id_or_url).startswith("http") else f"https://x.com/i/status/{tweet_id}"
    prefix = f"<div style='margin-bottom:6px;color:#334155;'>{summary}</div>" if summary else ""
    return (
        f"{prefix}"
        f"<div style='background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;margin-bottom:8px;font-size:13px;color:#1e293b;'>"
        f"{reply_text}"
        f"</div>"
        f"<a href='{intent_url}' target='_blank' style='display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:8px 14px;border-radius:6px;font-weight:600;font-size:13px;margin-right:8px;'>👉 点我直接弹出写好字的回复框</a>"
        f"<a href='{raw_url}' target='_blank' style='color:#2563eb;font-size:12px;text-decoration:underline;'>查看原推文</a>"
    )

def build_platform_action_html(platform, post_url, reply_text, summary=""):
    """Build a platform-accurate quick-reply card for emails."""
    p_lower = platform.lower()
    if "hacker news" in p_lower:
        bg_box, border_box, btn_bg, btn_label = "#fff7ed", "#fdba74", "#ff6600", "🟠 打开 Hacker News 原帖交流"
    elif "dev.to" in p_lower:
        bg_box, border_box, btn_bg, btn_label = "#f8fafc", "#cbd5e1", "#0f172a", "📝 打开 Dev.to 文章底部交流"
    elif "x" == p_lower or "twitter" in p_lower:
        return build_x_intent_html(post_url, reply_text, summary)
    else:
        bg_box, border_box, btn_bg, btn_label = "#fff7ed", "#fed7aa", "#ea580c", f"🔗 打开 {platform} 原帖回复"

    prefix = f"<div style='margin-bottom:6px;color:#334155;'>{summary}</div>" if summary else ""
    return (
        f"{prefix}"
        f"<div style='background:{bg_box};border:1px solid {border_box};padding:10px;border-radius:6px;margin-bottom:8px;font-size:13px;color:#1e293b;user-select:all;'>"
        f"{reply_text}"
        f"</div>"
        f"<a href='{post_url}' target='_blank' style='display:inline-block;background:{btn_bg};color:#ffffff;text-decoration:none;padding:8px 14px;border-radius:6px;font-weight:600;font-size:13px;'>{btn_label}</a>"
    )

def build_reddit_action_html(post_url, reply_text, summary=""):
    return build_platform_action_html("Reddit", post_url, reply_text, summary)

if __name__ == "__main__":
    print("[Notifier] Testing notification module...")
    send_macos_notification("TabWeaver 测试", "通知与报警系统模块自检正常！")
    print("[Notifier] Self-test complete.")
