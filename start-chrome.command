#!/usr/bin/env bash
# macOS 双击一键启动内置 TabWeaver 插件的 Chrome 浏览器
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ -f "$DIR/browser-agent-extension/manifest.json" ]; then
  EXT_DIR="$DIR/browser-agent-extension"
elif [ -f "$DIR/manifest.json" ]; then
  EXT_DIR="$DIR"
else
  EXT_DIR="$DIR/browser-agent-extension"
fi

CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE_DIR="$HOME/.tabweaver-chrome-profile"

if [ ! -f "$CHROME_PATH" ]; then
  echo "未找到 Google Chrome，请确认已安装在 /Applications/Google Chrome.app"
  exit 1
fi

echo "正在启动已加载 TabWeaver 扩展的 Google Chrome 浏览器..."
echo "扩展路径: $EXT_DIR"
echo "独立环境: $PROFILE_DIR (在此登录的 Google 账号将被永久保存)"

mkdir -p "$PROFILE_DIR"

"$CHROME_PATH" \
  --load-extension="$EXT_DIR" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "https://gemini.google.com/app" &

disown
exit 0
