#!/usr/bin/env python3
"""
Init Content Bank & Config from Product Description
Renders standard templates with user product metadata.
"""

import os
import sys
import json
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_ROOT = os.path.dirname(SCRIPT_DIR)
TEMPLATES_DIR = os.path.join(SKILL_ROOT, "templates")

def render_template(template_str, replacements):
    for k, v in replacements.items():
        template_str = template_str.replace(f"{{{{{k}}}}}", v)
    return template_str

def main():
    parser = argparse.ArgumentParser(description="Initialize Social Growth content bank for a product")
    parser.add_argument("--name", required=True, help="Product name (e.g. TabWeaver)")
    parser.add_argument("--tagline", default="Open-source browser AI automation", help="Short one-line hook")
    parser.add_argument("--github", default="", help="GitHub repository URL")
    parser.add_argument("--store", default="", help="Web Store URL")
    parser.add_argument("--website", default="", help="Website or docs URL")
    parser.add_argument("--email", default="", help="Notification recipient email")
    parser.add_argument("--output-dir", default=".", help="Target output directory")
    args = parser.parse_args()

    replacements = {
        "BRAND_NAME": args.name,
        "LINKS_GITHUB": args.github or f"https://github.com/your-username/{args.name}",
        "LINKS_STORE": args.store or "https://chromewebstore.google.com",
        "LINKS_WEBSITE": args.website or f"https://your-domain.com/{args.name}"
    }

    os.makedirs(args.output_dir, exist_ok=True)

    # 1. Render content-bank.json
    cb_template_path = os.path.join(TEMPLATES_DIR, "content-bank.template.json")
    with open(cb_template_path, "r", encoding="utf-8") as f:
        cb_raw = f.read()
    cb_rendered = render_template(cb_raw, replacements)
    
    out_cb = os.path.join(args.output_dir, "content-bank.json")
    with open(out_cb, "w", encoding="utf-8") as f:
        f.write(cb_rendered)
    print(f"✅ Generated: {out_cb}")

    # 2. Render config.json
    cfg_template_path = os.path.join(TEMPLATES_DIR, "config.template.json")
    with open(cfg_template_path, "r", encoding="utf-8") as f:
        cfg_data = json.load(f)

    cfg_data["brand"]["name"] = args.name
    cfg_data["brand"]["tagline"] = args.tagline
    cfg_data["links"]["github"] = replacements["LINKS_GITHUB"]
    cfg_data["links"]["store"] = replacements["LINKS_STORE"]
    cfg_data["links"]["website"] = replacements["LINKS_WEBSITE"]
    if args.email:
        cfg_data["email"]["recipient"] = args.email

    out_cfg = os.path.join(args.output_dir, "config.json")
    with open(out_cfg, "w", encoding="utf-8") as f:
        json.dump(cfg_data, f, indent=2, ensure_ascii=False)
    print(f"✅ Generated: {out_cfg}")

    # 3. Initialize state.json
    out_state = os.path.join(args.output_dir, "state.json")
    if not os.path.exists(out_state):
        initial_state = {
            "last_post": {},
            "today_replies_count": 0,
            "last_reply_date": "",
            "replied_targets": [],
            "current_topic_index": 1
        }
        with open(out_state, "w", encoding="utf-8") as f:
            json.dump(initial_state, f, indent=2)
        print(f"✅ Initialized: {out_state}")

if __name__ == "__main__":
    main()
