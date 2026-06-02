#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
构建部署脚本 v2.0 — 数据内置方案
将后台导出的完整量表数据注入 shared-data.js，打包部署到 deploy/

使用流程：
  1. 后台页面导出量表数据 JSON（admin-legacy.html → 导出所有量表数据）
  2. 将 JSON 文件保存为 scales-data.json（与 build-deploy.py 同级）
  3. 运行: python3 build-deploy.py
  4. 上传 deploy/ 目录下所有文件到微信云开发静态网站托管
"""

import os
import re
import shutil
import json
import sys
import urllib.request

# ============================================================
# 配置
# ============================================================

WORKSPACE = os.path.dirname(os.path.abspath(__file__))
MINI_APP_DIR = os.path.join(WORKSPACE, 'mini-app-h5')
DEPLOY_DIR = os.path.join(WORKSPACE, 'deploy')

# 量表数据源文件（从后台导出的 JSON）
SCALES_DATA_FILE = os.path.join(WORKSPACE, 'scales-data.json')

# LNMP 量表 API（构建时自动拉取最新量表）
LNMP_SCALES_URL = 'https://www.soarto.com.cn/api/scales-json'

# LNMP 服务器配置（前端 JS 文件需同步到此服务器）
LNMP_SSH_HOST = 'root@101.43.43.125'
LNMP_WWW_DIR = '/www/wwwroot/www.soarto.com.cn'
LNMP_FRONTEND_FILES = ['shared-data.js', 'cloud-data.js', 'cloud-api.js', 'scoring-engine.js', 'asset-storage.js', 'data-monitor.js', 'index.html', 'admin-legacy.html', 'admin-data.js', 'admin-scale-list.js', 'admin-ai-diag.js', 'admin-feedback.js', 'scale-onboard.html', 'default-prompts.js', 'miniprogram-qr.png', 'counselor.png']

# AI 配置文件（DashScope API Key 等）
AI_CONFIG_FILE = os.path.join(WORKSPACE, 'ai-config.json')

# 量表类型配置文件
SCALE_TYPES_FILE = os.path.join(WORKSPACE, 'scale-types.json')

# 需要部署的文件（从 mini-app-h5/ 开始的相对路径）
DEPLOY_FILES = [
    'frontend/index.html',          # 前端页面
    'backend/admin-legacy.html',    # 后台管理（deploy → SCP → LNMP 服务器）
    'backend/admin-feedback.js',    # 用户评价模块（从 admin-legacy.html 提取）
    'backend/admin-data.js',        # 数据看板模块（从 admin-legacy.html 提取）
    'backend/admin-ai-diag.js',     # AI 诊断 + 一键配置模块
    'backend/admin-scale-list.js',  # 量表列表/筛选/排序模块
    'shared-data.js',               # 共享数据模块（将注入量表数据）
    'cloud-data.js',                # 云端数据适配层
    'cloud-api.js',                 # 云托管 HTTP API 通信模块（v11.0）
    'scoring-engine.js',            # 计分引擎
    'asset-storage.js',             # 资源存储模块
    'data-monitor.js',              # 数据监控模块
    'backend/default-prompts.js',   # 系统提示词（AI 生成量表功能）
    'backend/scale-onboard.html',   # 量表一键上架向导
    'frontend/assets/counselor.png', # 咨询师立绘（原始 PNG）
    'frontend/assets/miniprogram-qr.png' # 小程序码
]

# 根目录直接复制的配置文件（不经过路径替换，仅当文件存在时复制）
ROOT_COPY_FILES = [
    ('ai-config.json', AI_CONFIG_FILE),  # AI 配置文件（运维面板读取用）
]

# 不从源目录拷贝，直接从 deploy/ 保留的静态文件
STATIC_KEEP_FILES = [
    'fQJW4aYeSL.txt'              # 微信业务域名校验文件
]

# deploy/ 目录中 HTML 文件引用 JS 的路径映射
PATH_REPLACEMENTS = [
    ('../asset-storage.js',   'asset-storage.js'),
    ('../shared-data.js',     'shared-data.js'),
    ('../cloud-data.js',      'cloud-data.js'),
    ('../cloud-api.js',       'cloud-api.js'),
    ('../scoring-engine.js',  'scoring-engine.js'),
    ('../data-monitor.js',    'data-monitor.js'),
    ('../frontend/index.html',       'index.html'),
    ('../frontend/mini-program-demo.html', '#'),
    ("'../shared-data.js",     "'shared-data.js"),
    ("'../asset-storage.js",   "'asset-storage.js"),
    ("'../cloud-data.js",      "'cloud-data.js"),
    ("'../cloud-api.js",       "'cloud-api.js"),
    ("'../scoring-engine.js",  "'scoring-engine.js"),
    ("'../data-monitor.js",    "'data-monitor.js"),
    ('"../shared-data.js',     '"shared-data.js'),
    ('"../asset-storage.js',   '"asset-storage.js'),
    ('"../cloud-data.js',      '"cloud-data.js'),
    ('"../cloud-api.js',       '"cloud-api.js'),
    ('"../scoring-engine.js',  '"scoring-engine.js'),
    ('"../data-monitor.js',    '"data-monitor.js"'),
]

# index.html 中硬编码的 localhost URL 替换
LOCALHOST_REPLACEMENTS = [
    ('http://localhost:8080/mini-app-h5/backend/admin-legacy.html', 'admin-legacy.html'),
    ('http://localhost:8080/mini-app-h5/backend/index.html', 'admin-legacy.html'),
    ('http://localhost:8080/mini-app-h5/backend/admin-dashboard.html', '#'),
    ('http://localhost:8080/mini-app-h5/backend/scale-management.html', '#'),
    ('http://localhost:8080/mini-app-h5/frontend/mini-program-demo.html', '#'),
]

# 占位符：shared-data.js 中的数据注入点
SCALE_PLACEHOLDER = '__BUNDLED_SCALES__'
AI_CONFIG_PLACEHOLDER_START = '// @BUNDLED_AI_CONFIG_START\n    const DEFAULT_AI_CONFIG = null;\n    // @BUNDLED_AI_CONFIG_END'
AI_CONFIG_PLACEHOLDER_END = '// @BUNDLED_AI_CONFIG_END'

# 占位符：admin-legacy.html 中的量表类型注入点
SCALE_TYPES_PLACEHOLDER_START = '// @BUNDLED_SCALE_TYPES_START\nlet BUNDLED_SCALE_TYPES = null;\n// @BUNDLED_SCALE_TYPES_END'
SCALE_TYPES_PLACEHOLDER_END = '// @BUNDLED_SCALE_TYPES_END'


# ============================================================
# 数据注入
# ============================================================

def load_scales_data():
    """从 LNMP 拉取最新量表数据，失败则回退到本地 scales-data.json"""
    # 优先从 LNMP 拉取
    print('  📡 从 LNMP 拉取最新量表数据...')
    try:
        req = urllib.request.Request(LNMP_SCALES_URL, headers={'User-Agent': 'build-deploy/2.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode('utf-8'))
        if result.get('code') == 0 and result.get('data'):
            scales = result['data']
            # 同步保存到本地 scales-data.json
            with open(SCALES_DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(scales, f, ensure_ascii=False, indent=2)
            print(f'  ✅ LNMP 拉取成功: {len(scales)} 个量表，已同步到本地')
            return scales
        else:
            print('  ⚠️  LNMP 返回空数据，尝试本地文件')
    except Exception as e:
        print(f'  ⚠️  LNMP 拉取失败: {e}，尝试本地文件')

    # Fallback: 从本地 scales-data.json 读取
    if not os.path.exists(SCALES_DATA_FILE):
        print(f'  ⚠️  未找到 {SCALES_DATA_FILE}')
        print(f'  ⚠️  请先在后台点「同步至前端」再构建')
        return None

    with open(SCALES_DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if isinstance(data, list):
        scales = data
    elif isinstance(data, dict) and 'data' in data:
        scales = data['data']
    elif isinstance(data, dict) and 'scales' in data:
        scales = data['scales']
    else:
        print(f'  ⚠️  scales-data.json 格式不正确')
        return None

    print(f'  📁 从本地文件加载: {len(scales)} 个量表')
    return scales

    # 验证数据完整性
    for i, s in enumerate(scales):
        if 'questions' not in s or not s['questions']:
            print(f'  ⚠️  量表 #{i+1} "{s.get("name", "?")}" 没有题目！')
            return None
        # 确保 questionCount 正确
        if 'questionCount' not in s or s['questionCount'] != len(s['questions']):
            s['questionCount'] = len(s['questions'])

    return scales


def load_ai_config():
    """从 ai-config.json 读取 AI 配置"""
    if not os.path.exists(AI_CONFIG_FILE):
        print(f'  ⚠️  未找到 {AI_CONFIG_FILE}，AI 诊断功能将不可用')
        return None

    with open(AI_CONFIG_FILE, 'r', encoding='utf-8') as f:
        config = json.load(f)

    # 验证基本结构
    if not config.get('provider') or not config.get(config['provider']):
        print(f'  ⚠️  ai-config.json 格式不正确')
        return None

    return config


def load_scale_types():
    """从 scale-types.json 读取量表类型配置"""
    if not os.path.exists(SCALE_TYPES_FILE):
        print(f'  ⚠️  未找到 {SCALE_TYPES_FILE}，量表类型将使用代码内置默认值')
        return None

    with open(SCALE_TYPES_FILE, 'r', encoding='utf-8') as f:
        types = json.load(f)

    if not isinstance(types, list) or len(types) == 0:
        print(f'  ⚠️  scale-types.json 格式不正确或为空')
        return None

    # 验证每个类型都有必要字段
    for t in types:
        if not t.get('id') or not t.get('name'):
            print(f'  ⚠️  量表类型缺少 id 或 name 字段: {t}')
            return None
        t.setdefault('icon', '📋')
        t.setdefault('description', '')
        t.setdefault('color', '#4A90D9')
        t.setdefault('scaleIds', [])

    return types


def inject_scales_into_shared_data(content, scales, ai_config=None):
    """将量表数据 JSON 注入到 shared-data.js 的占位符位置"""
    import re as _re
    
    if SCALE_PLACEHOLDER in content:
        # 正常流程：占位符存在，替换
        scales_json = json.dumps(scales, ensure_ascii=False, indent=None, separators=(',', ':'))
        new_content = content.replace(SCALE_PLACEHOLDER, scales_json, 1)
        if new_content.count(SCALE_PLACEHOLDER) > 0:
            print(f'  ⚠️  占位符替换不完整，仍有残留')
            return content, False
        print(f'  ✅ 量表数据已注入（{len(scales)} 个量表）')
    else:
        # 占位符不存在，检查是否已内置数据并强制更新
        _match = _re.search(r'const DEFAULT_SCALES\s*=\s*(\[.+?\])\s*;', content, _re.DOTALL)
        if _match and len(_match.group(1).strip()) > 10:
            # 强制替换已有数据（修复：上次构建注入的可能是旧数据）
            old_scales_json = _match.group(1)
            scales_json = json.dumps(scales, ensure_ascii=False, indent=None, separators=(',', ':'))
            new_content = content.replace(old_scales_json, scales_json, 1)
            # 验证替换：用更精确的方式计数（查找顶层 scale 对象）
            _scale_count = scales_json.count('"shortName":')
            if _scale_count != len(scales):
                print(f'  ⚠️  注入后量表数量不匹配（期望 {len(scales)}，实际 {_scale_count}），回滚')
                return content, False
            print(f'  ✅ 量表数据已更新（{len(scales)} 个量表，替换旧数据）')
        else:
            print(f'  ⚠️  DEFAULT_SCALES 为空且无占位符，无法注入')
            return content, False

    # 注入 AI 配置（安全：清除 apiKey，前端通过 ai-call 云函数代理调用）
    if ai_config:
        safe_config = json.loads(json.dumps(ai_config))  # 深拷贝
        # 清除所有 apiKey，前端不应持有真实密钥
        for provider_key in ['dashscope', 'ollama']:
            if provider_key in safe_config and isinstance(safe_config[provider_key], dict):
                if 'apiKey' in safe_config[provider_key]:
                    safe_config[provider_key]['apiKey'] = ''
                if 'api_key' in safe_config[provider_key]:
                    safe_config[provider_key]['api_key'] = ''
        ai_json = json.dumps(safe_config, ensure_ascii=False, indent=None, separators=(',', ':'))
        ai_block = f'// @BUNDLED_AI_CONFIG_START\n    const DEFAULT_AI_CONFIG = {ai_json};\n    // @BUNDLED_AI_CONFIG_END'
        if AI_CONFIG_PLACEHOLDER_START in new_content:
            new_content = new_content.replace(AI_CONFIG_PLACEHOLDER_START, ai_block, 1)
            print(f'  ✅ AI 配置已注入（provider: {ai_config.get("provider")}，apiKey 已清除）')
        else:
            # 检查是否已内置，如果有 apiKey 则需要清除
            import re as _re2
            _replaced = _re2.sub(
                r'"apiKey"\s*:\s*"[^"]*"',
                '"apiKey":""',
                new_content
            )
            _replaced = _re2.sub(
                r'"api_key"\s*:\s*"[^"]*"',
                '"api_key":""',
                _replaced
            )
            if _replaced != new_content:
                new_content = _replaced
                print(f'  ✅ AI 配置已内置，apiKey 已清除')
            else:
                print(f'  ✅ AI 配置已内置，apiKey 为空，无需清除')
    else:
        print(f'  ⚠️  AI 配置文件不存在，AI 诊断功能将不可用')

    return new_content, True


# ============================================================
# 主流程
# ============================================================

def main():
    print('=' * 60)
    print('🚀 构建部署脚本 v2.0（数据内置方案）')
    print('=' * 60)

    # 0. 读取量表数据
    print('\n📊 读取量表数据:')
    scales = load_scales_data()
    if scales is None:
        print('\n❌ 无法继续构建，请先准备 scales-data.json')
        sys.exit(1)

    total_questions = sum(len(s.get('questions', [])) for s in scales)
    has_scoring = sum(1 for s in scales if s.get('scoring'))
    print(f'  ✅ 读取到 {len(scales)} 个量表，共 {total_questions} 题')
    print(f'  ✅ 含计分规则: {has_scoring}/{len(scales)} 个量表')

    # 数据标准化：确保各量表必有 shortName 字段（注入时按此字段计数校验）
    for s in scales:
        if not s.get('shortName'):
            s['shortName'] = s.get('displayName') or s.get('code') or s['name']
            print(f'  🔧 补全 shortName: {s["name"]} → {s["shortName"]}')

    # 0.5 读取 AI 配置
    print('\n🤖 读取 AI 配置:')
    ai_config = load_ai_config()
    if ai_config:
        print(f'  ✅ AI 提供商: {ai_config.get("provider")}')
        print(f'  ✅ 模型: {ai_config.get("dashscope", {}).get("model", "N/A")}')
        print(f'  ✅ API Key: {ai_config.get("dashscope", {}).get("apiKey", "")[:8]}...')
    else:
        print(f'  ⚠️  AI 配置未找到，将使用空配置')

    # 0.6 读取量表类型配置
    print('\n📂 读取量表类型配置:')
    scale_types = load_scale_types()
    if scale_types:
        print(f'  ✅ 读取到 {len(scale_types)} 个量表类型')
        for t in scale_types:
            print(f'     - {t["icon"]} {t["name"]} ({t["id"]})')
    else:
        print(f'  ⚠️  量表类型配置未找到，将使用代码内置默认值')

    # 1. 清理并创建 deploy/ 目录
    if os.path.exists(DEPLOY_DIR):
        print(f'\n📁 清理旧目录: {DEPLOY_DIR}')
        for f in os.listdir(DEPLOY_DIR):
            if f not in STATIC_KEEP_FILES:
                os.remove(os.path.join(DEPLOY_DIR, f))
    os.makedirs(DEPLOY_DIR, exist_ok=True)
    print(f'📁 创建部署目录: {DEPLOY_DIR}')
    if STATIC_KEEP_FILES:
        print(f'🔒 保留静态文件: {", ".join(STATIC_KEEP_FILES)}')

    # 2. 拷贝文件
    print('\n📦 拷贝文件:')
    deploy_file_map = {}
    for rel_path in DEPLOY_FILES:
        src = os.path.join(MINI_APP_DIR, rel_path)
        filename = os.path.basename(rel_path)
        dst = os.path.join(DEPLOY_DIR, filename)

        if not os.path.exists(src):
            print(f'  ⚠️  文件不存在，跳过: {rel_path}')
            continue

        shutil.copy2(src, dst)

        # 对 shared-data.js 注入量表数据和 AI 配置
        if filename == 'shared-data.js':
            with open(dst, 'r', encoding='utf-8') as f:
                js_content = f.read()
            js_content, ok = inject_scales_into_shared_data(js_content, scales, ai_config)
            if ok:
                with open(dst, 'w', encoding='utf-8') as f:
                    f.write(js_content)
                size_kb = os.path.getsize(dst) / 1024
                print(f'  ✅ {rel_path} → deploy/{filename} ({size_kb:.1f} KB) [已注入量表数据+AI配置]')
            else:
                print(f'  ❌ {rel_path} → 数据注入失败！')
                sys.exit(1)
        else:
            size_kb = os.path.getsize(dst) / 1024
            print(f'  ✅ {rel_path} → deploy/{filename} ({size_kb:.1f} KB)')

        deploy_file_map[filename] = rel_path

    # 2.5 复制根目录配置文件
    for filename, src_path in ROOT_COPY_FILES:
        if not os.path.exists(src_path):
            print(f'  ⚠️  配置文件不存在，跳过: {filename}')
            continue
        dst = os.path.join(DEPLOY_DIR, filename)
        shutil.copy2(src_path, dst)
        size_kb = os.path.getsize(dst) / 1024
        print(f'  ✅ {filename} → deploy/{filename} ({size_kb:.1f} KB) [配置文件]')

    # 3. 修改 HTML 中的路径引用
    print('\n🔧 修改 HTML 路径引用:')

    for html_file in ['index.html']:  # admin-legacy.html 仅部署到 www 服务器，不走此流程
        html_path = os.path.join(DEPLOY_DIR, html_file)
        if not os.path.exists(html_path):
            continue

        with open(html_path, 'r', encoding='utf-8') as f:
            content = f.read()

        modified = False
        for old_path, new_path in PATH_REPLACEMENTS:
            if old_path in content:
                count = content.count(old_path)
                content = content.replace(old_path, new_path)
                print(f'  ✅ {html_file}: "{old_path}" → "{new_path}" ({count} 处)')
                modified = True

        if html_file == 'index.html':
            # counselor.png 引用
            old = 'assets/counselor.png'
            new = 'counselor.png'
            if old in content:
                count = content.count(old)
                content = content.replace(old, new)
                print(f'  ✅ {html_file}: "{old}" → "{new}" ({count} 处)')
                modified = True

            # miniprogram-qr.png 引用
            old = 'assets/miniprogram-qr.png'
            new = 'miniprogram-qr.png'
            if old in content:
                count = content.count(old)
                content = content.replace(old, new)
                print(f'  ✅ {html_file}: "{old}" → "{new}" ({count} 处)')
                modified = True

            # 替换 localhost URL
            for old_url, new_url in LOCALHOST_REPLACEMENTS:
                if old_url in content:
                    count = content.count(old_url)
                    content = content.replace(old_url, new_url)
                    print(f'  ✅ {html_file}: "{old_url}" → "{new_url}" ({count} 处)')
                    modified = True

        if modified:
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(content)

    # 4. 生成部署清单
    manifest = {
        'version': '2.0',
        'buildTime': os.popen('date "+%Y-%m-%d %H:%M:%S"').read().strip(),
        'scalesCount': len(scales),
        'totalQuestions': total_questions,
        'files': {},
        'webviewConfig': {
            'frontendEntry': 'index.html',
            'adminEntry': 'admin-legacy.html',
            'envParams': 'env=cloud&envId=cloud1-d8ggx8sqde8afa6a4'
        }
    }

    print('\n📋 部署清单:')
    for filename in sorted(os.listdir(DEPLOY_DIR)):
        if filename == 'manifest.json':
            continue
        filepath = os.path.join(DEPLOY_DIR, filename)
        size_kb = os.path.getsize(filepath) / 1024
        manifest['files'][filename] = {
            'originalPath': deploy_file_map.get(filename, ''),
            'sizeKB': round(size_kb, 1)
        }
        print(f'  📄 {filename} ({size_kb:.1f} KB)')

    manifest_path = os.path.join(DEPLOY_DIR, 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f'  📄 manifest.json (部署配置)')

    # 5. 总结
    total_size = sum(
        os.path.getsize(os.path.join(DEPLOY_DIR, f))
        for f in os.listdir(DEPLOY_DIR)
    ) / 1024
    file_count = len(os.listdir(DEPLOY_DIR))

    print('\n' + '=' * 60)
    print(f'✅ 构建完成！共 {file_count} 个文件，总计 {total_size:.1f} KB')
    print(f'📊 已打包 {len(scales)} 个量表，{total_questions} 道题目')
    print(f'📂 部署目录: {DEPLOY_DIR}')

    # 自动部署到 LNMP 服务器（小程序 WebView 加载 www.soarto.com.cn/）
    print(f'\n🚀 同步前端文件到 LNMP 服务器（{LNMP_SSH_HOST}）...')
    import subprocess
    scp_files = [f for f in LNMP_FRONTEND_FILES if os.path.exists(os.path.join(DEPLOY_DIR, f))]
    scp_args = ['scp'] + [os.path.join(DEPLOY_DIR, f) for f in scp_files] + [f'{LNMP_SSH_HOST}:{LNMP_WWW_DIR}/']
    try:
        result = subprocess.run(scp_args, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print(f'  ✅ 已同步 {len(scp_files)} 个文件到 www.soarto.com.cn')
        else:
            print(f'  ⚠️  scp 失败: {result.stderr.strip()}')
    except Exception as e:
        print(f'  ⚠️  scp 异常: {e}')

    print('\n📤 后续步骤:')
    print('   1. 运行 tcb hosting deploy ./deploy  → 部署到云开发静态托管（rich.soarto.com.cn）')
    print('   2. LNMP 服务器已自动同步（www.soarto.com.cn）')
    print('   3. 真机退出小程序重新进入测试')
    print('=' * 60)


if __name__ == '__main__':
    main()
