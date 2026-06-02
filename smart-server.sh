#!/bin/bash
# smart-server.sh — 智能启动本地 HTTP 服务器
# 先杀掉占用 8080 的所有进程，再启动，避免端口冲突

PORT=8080
DIR="${1:-$(pwd)}"

echo "[smart-server] 检查端口 $PORT ..."

# 杀掉占用端口的进程（不报错）
PIDS=$(lsof -ti:$PORT 2>/dev/null)
if [ -n "$PIDS" ]; then
  echo "[smart-server] 发现占用进程: $PIDS，正在终止..."
  echo "$PIDS" | xargs kill -9 2>/dev/null
  sleep 1
fi

echo "[smart-server] 启动服务器: $DIR → http://localhost:$PORT"
cd "$DIR" && python3 -m http.server $PORT &
PID=$!
echo $PID > /tmp/workbuddy-http-server.pid
echo "[smart-server] 已启动 (PID: $PID)，PID 已保存到 /tmp/workbuddy-http-server.pid"
