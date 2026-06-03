#!/usr/bin/env python3
"""
build-skills.py — 从 default-prompts.js 生成 Skill 架构文件
用法: python3 build-skills.py
输出: skills/system-prompts/*.md
"""

import json
import os
import re
import hashlib
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PROMPTS_FILE = os.path.join(SCRIPT_DIR, 'mini-app-h5', 'backend', 'default-prompts.js')
SKILL_OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'skills', 'system-prompts')

def parse_default_prompts():
    """解析 default-prompts.js 文件，提取 JSON 数据"""
    with open(DEFAULT_PROMPTS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取 JSON 部分
    start = content.find('window.DEFAULT_PROMPTS = ') + len('window.DEFAULT_PROMPTS = ')
    end = content.find(';', start)
    json_str = content[start:end]
    
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f'❌ JSON 解析失败: {e}')
        # 尝试修复常见的 JS 字符串引号问题
        json_str = json_str.replace("'", '"')  # 单引号转双引号
        return json.loads(json_str)

def generate_skill_file(pt, version_data, output_path):
    """为单个提示词版本生成 Skill .md 文件"""
    # 构建 frontmatter
    frontmatter = f"""---
id: {pt['id']}-v{version_data['version'].replace('.', '_')}
name: {pt['name']} v{version_data['version']}
description: {pt['name']} 提示词 v{version_data['version']}
version: "{version_data['version']}"
metadata:
  type: system-prompt
  icon: "{pt.get('icon', '📝')}"
  note: "{version_data.get('note', '')}"
  original_id: {pt['id']}
---
"""
    
    # 添加正文内容
    content = version_data.get('content', '')
    
    # 写入文件
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(frontmatter)
        f.write(content)
    
    print(f'  ✅ 生成: {os.path.basename(output_path)} ({len(content)} 字符)')

def main():
    print('=== 生成 Skill 架构文件 ===')
    
    # 1. 解析 default-prompts.js
    if not os.path.exists(DEFAULT_PROMPTS_FILE):
        print(f'❌ 文件不存在: {DEFAULT_PROMPTS_FILE}')
        print('   请先运行 build-prompts.py 生成 default-prompts.js')
        return 1
    
    prompts = parse_default_prompts()
    print(f'✅ 解析 {len(prompts)} 个提示词类型')
    
    # 2. 创建输出目录
    os.makedirs(SKILL_OUTPUT_DIR, exist_ok=True)
    print(f'✅ 输出目录: {SKILL_OUTPUT_DIR}')
    
    # 3. 为每个提示词版本生成 Skill 文件
    total_skills = 0
    for pt in prompts:
        pt_id = pt.get('id', 'unknown')
        pt_name = pt.get('name', '未知')
        versions = pt.get('versions', [])
        
        print(f'\n📝 {pt_id}: {pt_name} ({len(versions)} 个版本)')
        
        if not versions:
            print(f'  ⚠️  无版本数据，跳过')
            continue
        
        for v in versions:
            version = v.get('version', '1.0')
            status = v.get('status', 'active')
            
            # 生成文件名
            file_name = f"{pt_id}-v{version.replace('.', '_')}.md"
            output_path = os.path.join(SKILL_OUTPUT_DIR, file_name)
            
            # 生成 Skill 文件
            generate_skill_file(pt, v, output_path)
            total_skills += 1
    
    print(f'\n=== 生成完成 ===')
    print(f'总计: {total_skills} 个 Skill 文件')
    print(f'输出目录: {SKILL_OUTPUT_DIR}')
    
    return 0

if __name__ == '__main__':
    exit(main())
