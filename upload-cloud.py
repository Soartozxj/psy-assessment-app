#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
云存储上传辅助脚本

微信云存储没有直接的 CLI 上传工具，此脚本提供两种上传方式：
1. 生成上传命令（需要通过微信开发者工具 GUI 操作）
2. 通过微信云开发 HTTP API 上传（需要 cloudAccessToken）

使用方法：
  python3 upload-cloud.py              # 显示上传指引
  python3 upload-cloud.py --list       # 列出待上传文件
  python3 upload-cloud.py --validate   # 验证上传后可访问性
"""

import os
import json
import sys

DEPLOY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'deploy')
MANIFEST_PATH = os.path.join(DEPLOY_DIR, 'manifest.json')
CLOUD_ENV_ID = 'cloud1-d8ggx8sqde8afa6a4'
CLOUD_STORAGE_DOMAIN = f'https://{CLOUD_ENV_ID}.tcb.qcloud.la'


def load_manifest():
    if not os.path.exists(MANIFEST_PATH):
        print('❌ manifest.json 不存在，请先运行 build-deploy.py')
        sys.exit(1)
    with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def list_files():
    manifest = load_manifest()
    print(f'\n📋 待上传文件清单 ({len(manifest["files"])} 个):\n')
    total_size = 0
    for filename, info in sorted(manifest['files'].items()):
        size = info['sizeKB']
        total_size += size
        size_str = f'{size:.1f} KB' if size < 1024 else f'{size/1024:.1f} MB'
        print(f'  📄 {filename:<25} {size_str:>10}')
    print(f'\n  总计: {total_size/1024:.1f} MB')
    print(f'\n  云存储域名: {CLOUD_STORAGE_DOMAIN}')


def show_upload_guide():
    print('''
╔══════════════════════════════════════════════════════════╗
║            微信云存储上传指引（GUI 方式）                  ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  方式一：微信开发者工具                                    ║
║  ─────────────────────                                    ║
║  1. 打开微信开发者工具                                     ║
║  2. 点击「云开发」按钮（顶部工具栏）                        ║
║  3. 进入「云存储」面板                                     ║
║  4. 点击「上传文件」或拖拽文件到面板                       ║
║  5. 将 deploy/ 目录下所有文件上传（保持根目录，不加前缀）   ║
║     - index.html                                          ║
║     - admin-legacy.html                                   ║
║     - shared-data.js                                      ║
║     - cloud-data.js                                       ║
║     - scoring-engine.js                                   ║
║     - asset-storage.js                                    ║
║     - data-monitor.js                                     ║
║     - counselor.png                                       ║
║                                                          ║
║  方式二：云开发控制台（Web端）                              ║
║  ────────────────────────                                ║
║  1. 访问 https://console.cloud.tencent.com/tcb            ║
║  2. 选择对应环境                                           ║
║  3. 进入「云存储」→「文件管理」                             ║
║  4. 批量上传 deploy/ 目录下的文件                          ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║                      ⚠️ 重要配置                           ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  1. 业务域名配置（必须）                                   ║
║     - 登录 mp.weixin.qq.com                               ║
║     - 开发管理 → 开发设置 → 业务域名                       ║
║     - 添加: cloud1-d8ggx8sqde8afa6a4.tcb.qcloud.la        ║
║     - 下载校验文件上传到 deploy/ 并重新构建部署             ║
║                                                          ║
║  2. 确认云存储域名                                         ║
║     - 云存储域名可能因环境不同而变化                        ║
║     - 在开发者工具 → 云开发 → 云存储 → 文件详情 中确认     ║
║     - 如果域名不同，修改 webview.js 中的 baseUrl            ║
║                                                          ║
║  3. WebView 组件要求                                       ║
║     - 个人号小程序：WebView 不可用                         ║
║     - 企业主体小程序：可直接使用                           ║
║     - 校验文件必须放在域名根目录可访问                     ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
''')


def validate_urls():
    import urllib.request
    import urllib.error

    manifest = load_manifest()
    print(f'\n🔍 验证文件可访问性 (域名: {CLOUD_STORAGE_DOMAIN})\n')

    check_files = ['index.html', 'shared-data.js', 'cloud-data.js', 'scoring-engine.js', 'counselor.png']
    success_count = 0

    for filename in check_files:
        url = f'{CLOUD_STORAGE_DOMAIN}/{filename}'
        try:
            req = urllib.request.Request(url, method='HEAD')
            req.add_header('User-Agent', 'Mozilla/5.0')
            resp = urllib.request.urlopen(req, timeout=10)
            status = resp.status
            if status == 200:
                print(f'  ✅ {filename} → 200 OK')
                success_count += 1
            else:
                print(f'  ⚠️  {filename} → HTTP {status}')
        except urllib.error.HTTPError as e:
            print(f'  ❌ {filename} → HTTP {e.code}')
        except Exception as e:
            print(f'  ❌ {filename} → {type(e).__name__}: {e}')

    print(f'\n  结果: {success_count}/{len(check_files)} 个文件可访问')
    if success_count == len(check_files):
        print('  🎉 所有文件上传验证通过！')
    else:
        print('  ⚠️  部分文件未上传或不可访问，请检查云存储')


def main():
    if len(sys.argv) < 2:
        show_upload_guide()
        list_files()
    elif sys.argv[1] == '--list':
        list_files()
    elif sys.argv[1] == '--validate':
        validate_urls()
    elif sys.argv[1] == '--guide':
        show_upload_guide()
    else:
        print('用法:')
        print('  python3 upload-cloud.py              # 显示上传指引')
        print('  python3 upload-cloud.py --list       # 列出待上传文件')
        print('  python3 upload-cloud.py --validate   # 验证上传后可访问性')


if __name__ == '__main__':
    main()
