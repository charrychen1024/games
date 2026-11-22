#!/bin/bash
# 启动《烽烟录》：开本地服务器并打开浏览器。用法：./play.sh [端口]
set -e
cd "$(dirname "$0")"
PORT="${1:-8088}"
if ! command -v node >/dev/null 2>&1; then
  echo "没找到 node，直接用浏览器打开 index.html 也能玩。"; open index.html 2>/dev/null || true; exit 0
fi
node tools/serve.js "$PORT" &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT INT TERM
sleep 1
open "http://127.0.0.1:$PORT/" 2>/dev/null || true
echo "已启动：http://127.0.0.1:$PORT/   关掉终端或按 Ctrl+C 结束。"
wait $PID
