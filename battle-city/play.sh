#!/bin/bash
# 启动 BATTLE CITY 90：开一个本地服务器并打开浏览器。
# 用法：./play.sh [端口]
set -e
cd "$(dirname "$0")"

PORT="${1:-8099}"

if ! command -v node >/dev/null 2>&1; then
  echo "没找到 node，直接用浏览器打开 index.html 也可以玩（关卡保存会退化为仅本次有效）。"
  open index.html 2>/dev/null || true
  exit 0
fi

node tools/serve.js "$PORT" &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT INT TERM

sleep 1
URL="http://127.0.0.1:$PORT/"
echo "已启动：$URL"
if command -v open >/dev/null 2>&1; then open "$URL"; fi
echo "关掉这个终端或按 Ctrl+C 结束。"
wait $SERVER_PID
