#!/bin/bash
# 启动 南明：开一个本地服务器并打开浏览器。
# 用法：./play.sh [端口]
set -e
cd "$(dirname "$0")"
PORT="${1:-8110}"
if ! command -v node >/dev/null 2>&1; then
  echo "需要 Node.js 才能启动本地服务器。也可以直接在线玩：https://charrychen1024.github.io/games/nanming/dist/"
  exit 1
fi
if [ ! -f dist/index.html ]; then
  echo "首次运行：安装依赖并构建……"
  npm install --no-audit --no-fund
  npm run build
fi
URL="http://127.0.0.1:${PORT}/"
echo "南明：${URL}  （Ctrl+C 结束）"
( sleep 1; (command -v open >/dev/null && open "$URL") || (command -v xdg-open >/dev/null && xdg-open "$URL") || true ) &
node tools/serve.mjs "$PORT"
