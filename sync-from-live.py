#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
热修复回写脚本 — 将线上服务器文件和数据同步回本地
确保本地代码与线上实际运行版本保持一致

使用场景：
  1. 线上发现 bug 后直接修改了服务器文件，需要回写到本地保持同步
  2. 线上量表数据（scales-data.json）被后台修改后，同步回本地 scales-data.json
  3. 需要线上用户数据（assessments/feedback）到本地做测试

用法：
  python3 sync-from-live.py                  # 文件比对+同步（默认）
  python3 sync-from-live.py --check          # 仅比对文件，不修改
  python3 sync-from-live.py --force          # 强制同步文件，不询问确认
  python3 sync-from-live.py --data          # 同步线上 MySQL 数据到本地 JSON
  python3 sync-from-live.py --data --tables assessments,feedback  # 指定表
  python3 sync-from-live.py --data --output-dir ./tests/fixtures  # 指定输出目录

v2.0 | 2026-05-01
"""

import os
import sys
import subprocess
import hashlib
import argparse
import json
from datetime import datetime

# ============================================================
# 配置：线上服务器 ↔ 本地文件映射
# ============================================================

SSH_HOST = 'root@101.43.43.125'

# LNMP 服务器路径
LNMP_WWW_DIR = '/www/wwwroot/www.soarto.com.cn'

# 服务端路径
LNMP_SERVER_DIR = '/www/server/psy-api'

# 文件映射：[(远程路径, 本地路径), ...]
FILE_MAP = [
    # === 前端文件（LNMP 根目录 → mini-app-h5/）===
    (f'{LNMP_WWW_DIR}/index.html',           'mini-app-h5/frontend/index.html'),
    (f'{LNMP_WWW_DIR}/shared-data.js',       'mini-app-h5/shared-data.js'),
    (f'{LNMP_WWW_DIR}/cloud-data.js',        'mini-app-h5/cloud-data.js'),
    (f'{LNMP_WWW_DIR}/cloud-api.js',         'mini-app-h5/cloud-api.js'),
    (f'{LNMP_WWW_DIR}/scoring-engine.js',    'mini-app-h5/scoring-engine.js'),
    (f'{LNMP_WWW_DIR}/asset-storage.js',     'mini-app-h5/asset-storage.js'),
    (f'{LNMP_WWW_DIR}/data-monitor.js',      'mini-app-h5/data-monitor.js'),
    (f'{LNMP_WWW_DIR}/admin-legacy.html',    'mini-app-h5/backend/admin-legacy.html'),

    # === 数据文件（LNMP 根目录 → 项目根目录）===
    (f'{LNMP_WWW_DIR}/scales-data.json',    'scales-data.json'),

    # === 服务端文件 ===
    (f'{LNMP_SERVER_DIR}/app.js',            'server/psy-api.js'),
]

WORKSPACE = os.path.dirname(os.path.abspath(__file__))

# 上次同步记录（用于增量比对）
SYNC_RECORD_FILE = os.path.join(WORKSPACE, '.sync-from-live.json')


def md5_file(filepath):
    """计算本地文件 MD5"""
    h = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def remote_md5(remote_path):
    """计算远程文件 MD5"""
    try:
        result = subprocess.run(
            ['ssh', SSH_HOST, f'md5sum {remote_path}'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            # 输出格式: "hash  filename"
            return result.stdout.strip().split()[0]
    except Exception as e:
        pass
    return None


def load_sync_record():
    """加载上次同步记录"""
    if os.path.exists(SYNC_RECORD_FILE):
        with open(SYNC_RECORD_FILE, 'r') as f:
            return json.load(f)
    return {}


def save_sync_record(record):
    """保存同步记录"""
    record['_lastSync'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(SYNC_RECORD_FILE, 'w') as f:
        json.dump(record, f, ensure_ascii=False, indent=2)


def run_sync(check_only=False, force=False):
    print('=' * 60)
    print('🔄 热修复回写工具 v2.0')
    print(f'   服务器: {SSH_HOST}')
    print(f'   模式: {"仅比对" if check_only else "比对+同步"}')
    print('=' * 60)

    record = load_sync_record()
    diff_files = []
    unchanged = []
    error_files = []

    for remote_path, local_rel in FILE_MAP:
        local_path = os.path.join(WORKSPACE, local_rel)
        filename = os.path.basename(local_rel)

        # 获取远程 MD5
        r_md5 = remote_md5(remote_path)
        if r_md5 is None:
            error_files.append((filename, '远程文件不存在或 SSH 失败'))
            print(f'  ❌ {filename}: 无法获取远程 MD5')
            continue

        # 获取本地 MD5
        if not os.path.exists(local_path):
            l_md5 = ''
            status = 'NEW'
        else:
            l_md5 = md5_file(local_path)
            status = 'SAME' if l_md5 == r_md5 else 'DIFF'

        # 记录结果
        short_r = r_md5[:8]
        short_l = l_md5[:8] if l_md5 else '-----'

        if status == 'SAME':
            unchanged.append(filename)
            print(f'  ✅ {filename}: 一致 ({short_l})')
        else:
            tag = '新增' if status == 'NEW' else '差异'
            diff_files.append((remote_path, local_path, filename, status))
            print(f'  ⚡ {filename}: {tag}  (本地:{short_l} → 线上:{short_r})')

    # 输出汇总
    print(f'\n📊 比对结果: {len(unchanged)} 一致, {len(diff_files)} 差异, {len(error_files)} 错误')

    if not diff_files:
        print('✅ 本地与线上完全一致，无需同步')
        return

    if check_only:
        print('\n⚠️  --check 模式，以下文件需要同步:')
        for _, _, filename, status in diff_files:
            tag = '新增' if status == 'NEW' else '覆盖'
            print(f'   [{tag}] {filename}')
        return

    # 同步确认
    if not force:
        print(f'\n⚠️  即将同步 {len(diff_files)} 个文件:')
        for _, _, filename, status in diff_files:
            tag = '新增' if status == 'NEW' else '覆盖'
            print(f'   [{tag}] {filename}')
        confirm = input('\n确认同步？(y/N): ').strip().lower()
        if confirm != 'y':
            print('❌ 已取消')
            return

    # 执行同步
    print('\n📥 开始同步...')
    new_record = {}
    sync_ok = 0
    sync_fail = 0

    for remote_path, local_path, filename, status in diff_files:
        # 确保本地目录存在
        os.makedirs(os.path.dirname(local_path), exist_ok=True)

        try:
            result = subprocess.run(
                ['scp', f'{SSH_HOST}:{remote_path}', local_path],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                sync_ok += 1
                new_md5 = md5_file(local_path)
                new_record[filename] = {
                    'remotePath': remote_path,
                    'localPath': local_path,
                    'md5': new_md5,
                    'syncTime': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                print(f'  ✅ {filename} → {local_path}')
            else:
                sync_fail += 1
                print(f'  ❌ {filename}: scp 失败 - {result.stderr.strip()[:60]}')
        except Exception as e:
            sync_fail += 1
            print(f'  ❌ {filename}: {str(e)[:60]}')

    # 保存记录
    # 保留 unchanged 文件的旧记录
    for filename in unchanged:
        if filename in record:
            new_record[filename] = record[filename]
    save_sync_record(new_record)

    print(f'\n🎉 同步完成: {sync_ok} 成功, {sync_fail} 失败')
    print(f'   记录文件: {SYNC_RECORD_FILE}')

    # 后续建议
    if sync_ok > 0:
        print('\n💡 后续建议:')
        print('   1. 检查回写的文件，确认无冲突')
        print('   2. 如果 scales-data.json 被同步，本地代码已是最新，可直接继续开发')
        print('   3. 如果 index.html 被同步，确认路径引用与本地开发环境兼容')
        print('   4. 如需同步用户数据（assessments/feedback），使用 --data 参数')


def sync_data(tables=None, output_dir='.'):
    """
    从线上 MySQL 同步数据到本地 JSON 文件
    适用场景：本地测试需要真实用户数据

    实现方式：通过 SSH 在服务器上执行 Node.js 脚本查询 MySQL，
    将结果以 JSON 返回，写入本地文件
    """
    if tables is None:
        tables = ['assessments', 'feedback']

    print('=' * 60)
    print('📥 MySQL 数据同步')
    print(f'   服务器: {SSH_HOST}')
    print(f'   数据表: {", ".join(tables)}')
    print(f'   输出目录: {output_dir}')
    print('=' * 60)

    import tempfile

    # Node.js 导出脚本（复用服务端已有的 mysql2 依赖）
    export_js = (
        'const mysql = require("/www/server/psy-api/node_modules/mysql2/promise");\n'
        'const fs = require("fs");\n'
        'const env = {};\n'
        'fs.readFileSync("/www/server/psy-api/.env","utf8").split("\\n").forEach(line=>{\n'
        '  line=line.trim();\n'
        '  if(line&&!line.startsWith("#")&&line.includes("=")){\n'
        '    const i=line.indexOf("=");\n'
        '    env[line.substring(0,i).trim()]=line.substring(i+1).trim();\n'
        '  }\n'
        '});\n'
        'async function main(){\n'
        '  const pool=mysql.createPool({\n'
        '    host:env.DB_HOST||"localhost",port:parseInt(env.DB_PORT)||3306,\n'
        '    user:env.DB_USER||"root",password:env.DB_PASS||"",\n'
        '    database:env.DB_NAME||"psy_assessment"\n'
        '  });\n'
        '  const tables=process.argv.slice(2);\n'
        '  const result={};\n'
        '  for(const t of tables){const[rows]=await pool.query("SELECT * FROM "+t);result[t]=rows;}\n'
        '  console.log(JSON.stringify(result,null,2));\n'
        '  await pool.end();\n'
        '}\n'
        'main().catch(e=>{console.error(e);process.exit(1);});\n'
    )

    local_tmp = None
    try:
        # 1. 将导出脚本写到本地临时文件，再 SCP 到服务器
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
            f.write(export_js)
            local_tmp = f.name

        remote_js = '/tmp/sync_export.js'
        scp_result = subprocess.run(
            ['scp', local_tmp, f'{SSH_HOST}:{remote_js}'],
            capture_output=True, text=True, timeout=15
        )
        if scp_result.returncode != 0:
            print(f'  ❌ 无法上传导出脚本到服务器: {scp_result.stderr.strip()}')
            return

        # 2. 在服务器上执行导出脚本
        tables_arg = ' '.join(tables)
        result = subprocess.run(
            ['ssh', SSH_HOST, f'node {remote_js} {tables_arg}'],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            print(f'  ❌ 服务器导出失败: {result.stderr[:200]}')
            return

        # 3. 解析 JSON 输出
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            print(f'  ❌ 解析服务器返回数据失败: {e}')
            print(f'   原始输出（前 200 字符）: {result.stdout[:200]}')
            return

        # 4. 写入本地 JSON 文件
        os.makedirs(output_dir, exist_ok=True)
        for table_name, rows in data.items():
            output_file = os.path.join(output_dir, f'{table_name}.json')
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(rows, f, ensure_ascii=False, indent=2, default=str)
            print(f'  ✅ {table_name}: {len(rows)} 条记录 → {output_file}')

        print(f'\n🎉 数据同步完成，共 {len(tables)} 个表')

    except subprocess.TimeoutExpired:
        print('  ❌ 连接服务器超时')
    except Exception as e:
        print(f'  ❌ 数据同步异常: {e}')
    finally:
        # 5. 清理：删除服务器临时脚本 + 本地临时文件
        try:
            subprocess.run(['ssh', SSH_HOST, f'rm -f /tmp/sync_export.js'],
                           capture_output=True, timeout=10)
        except Exception:
            pass
        if local_tmp and os.path.exists(local_tmp):
            try:
                os.unlink(local_tmp)
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(description='热修复回写工具 v2.0 — 线上→本地同步')
    parser.add_argument('--check', action='store_true', help='仅比对文件，不修改')
    parser.add_argument('--force', action='store_true', help='强制同步文件，不询问确认')
    parser.add_argument('--data', action='store_true', help='同步线上 MySQL 数据到本地 JSON')
    parser.add_argument('--tables', type=str, default=None,
                        help='指定要同步的表（逗号分隔），默认: assessments,feedback')
    parser.add_argument('--output-dir', type=str, default='.',
                        help='本地 JSON 输出目录，默认当前目录')
    args = parser.parse_args()

    if args.data:
        tables = None
        if args.tables:
            tables = [t.strip() for t in args.tables.split(',')]
        sync_data(tables=tables, output_dir=args.output_dir)
    else:
        run_sync(check_only=args.check, force=args.force)


if __name__ == '__main__':
    main()
