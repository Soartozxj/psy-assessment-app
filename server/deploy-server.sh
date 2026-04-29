#!/bin/bash
# ============================================================
# 星蓝心镜 - 后端服务部署脚本
# 目标服务器: 腾讯云轻量应用服务器 101.43.43.125
# 部署路径: /www/server/psy-api/
# 前置条件: MySQL 已安装、Node.js 已安装、宝塔面板已配置
# ============================================================

set -e

# ---- 配置 ----
REMOTE_USER="root"
REMOTE_HOST="101.43.43.125"
REMOTE_DIR="/www/server/psy-api"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================================================"
echo "  星蓝心镜 - 后端部署"
echo "  本地: ${LOCAL_DIR}"
echo "  远程: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
echo "================================================"

# ---- 步骤 1: 检查本地文件 ----
echo ""
echo "[1/6] 检查本地文件..."
if [ ! -f "${LOCAL_DIR}/app.js" ]; then
  echo "❌ app.js 不存在，请确认路径"
  exit 1
fi
if [ ! -f "${LOCAL_DIR}/package.json" ]; then
  echo "❌ package.json 不存在"
  exit 1
fi
echo "✅ 本地文件检查通过"

# ---- 步骤 2: 上传文件到服务器 ----
echo ""
echo "[2/6] 上传文件到服务器..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}"
scp "${LOCAL_DIR}/app.js" "${LOCAL_DIR}/package.json" "${LOCAL_DIR}/init.sql" "${LOCAL_DIR}/.env.example" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
echo "✅ 文件上传完成"

# ---- 步骤 3: 服务器上安装依赖 ----
echo ""
echo "[3/6] 安装 Node.js 依赖..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && npm install --production"
echo "✅ 依赖安装完成"

# ---- 步骤 4: 配置环境变量 ----
echo ""
echo "[4/6] 配置环境变量..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "
  if [ ! -f ${REMOTE_DIR}/.env ]; then
    cp ${REMOTE_DIR}/.env.example ${REMOTE_DIR}/.env
    echo '⚠️  .env 已从模板创建，请手动编辑填写实际值：'
    echo '   ssh root@${REMOTE_HOST}'
    echo '   vi ${REMOTE_DIR}/.env'
  else
    echo '✅ .env 已存在，跳过'
  fi
"

# ---- 步骤 5: 初始化数据库（可选） ----
echo ""
echo "[5/6] 数据库初始化..."
read -p "是否执行数据库初始化？(首次部署选 y) [y/N] " init_db
if [ "$init_db" = "y" ] || [ "$init_db" = "Y" ]; then
  echo "请输入 MySQL root 密码:"
  ssh "${REMOTE_USER}@${REMOTE_HOST}" "mysql -u root -p < ${REMOTE_DIR}/init.sql"
  echo "✅ 数据库初始化完成"
else
  echo "⏭️  跳过数据库初始化"
fi

# ---- 步骤 6: 配置 PM2 进程管理 ----
echo ""
echo "[6/6] 配置 PM2..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "
  cd ${REMOTE_DIR}
  # 使用 PM2 管理进程
  if command -v pm2 &> /dev/null; then
    pm2 delete psy-api 2>/dev/null || true
    pm2 start app.js --name psy-api
    pm2 save
    pm2 startup 2>/dev/null || true
    echo '✅ PM2 进程已启动'
  else
    echo '⚠️  PM2 未安装，建议安装: npm install -g pm2'
    echo '   临时启动: cd ${REMOTE_DIR} && node app.js'
    echo '   后台运行: nohup node app.js > /www/wwwlogs/psy-api.log 2>&1 &'
  fi
"

echo ""
echo "================================================"
echo "  ✅ 部署完成！"
echo ""
echo "  后续步骤："
echo "  1. 编辑 .env 填写数据库密码等配置"
echo "  2. 配置 Nginx 反向代理（见 nginx.conf.example）"
echo "  3. 访问 http://${REMOTE_HOST}:3100 验证 API"
echo "  4. 备案通过后申请 SSL 证书"
echo "================================================"
