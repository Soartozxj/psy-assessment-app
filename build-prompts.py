#!/usr/bin/env python3
"""
build-prompts.py — 从 prompts/*.md 合并生成 default-prompts.js
用法: python3 build-prompts.py
输出: mini-app-h5/backend/default-prompts.js

Markdown 文件格式:
  ---
  id: json
  name: JSON 导入文件生成提示词
  icon: 📋
  currentVersion: "4.0"
  flowSteps (JSON array)
  versions (inline key: value pairs, - list items)
  ---
  ## v4.0 — note text
  prompt content...
  ## v1.0 — note text
  ...
"""

import json
import os
import glob
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(SCRIPT_DIR, 'prompts')
OUTPUT_FILE = os.path.join(SCRIPT_DIR, 'mini-app-h5', 'backend', 'default-prompts.js')


def parse_frontmatter(text):
    """Parse simple YAML-like frontmatter into a dict."""
    data = {}
    lines = text.strip().split('\n')
    i = 0
    
    def peek(): return lines[i] if i < len(lines) else ''
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        if not stripped or stripped.startswith('#'):
            i += 1
            continue
        
        if ':' in stripped:
            key, _, val = stripped.partition(':')
            key = key.strip()
            val = val.strip()
            
            # Check if next lines are indented (multi-line array/object)
            next_i = i + 1
            multiline_lines = []
            while next_i < len(lines) and (lines[next_i].startswith('  ') or lines[next_i].startswith('\t')):
                multiline_lines.append(lines[next_i])
                next_i += 1
            
            if multiline_lines:
                multiline_text = '\n'.join(multiline_lines)
                # Try to parse as JSON first
                try:
                    parsed = json.loads('{' + key + ': ' + val + '\n' + multiline_text + '\n}')
                    data[key] = parsed[key]
                except:
                    # Try to parse as YAML-like list of dicts
                    data[key] = _parse_yaml_list(multiline_lines)
                i = next_i
            else:
                # Simple value
                data[key] = val.strip('"').strip("'")
                i += 1
        else:
            i += 1
    
    return data


def _parse_yaml_list(lines):
    """Parse YAML-like list of simple dicts like:
      - key: value
        key2: value2
    """
    items = []
    current = {}
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('- '):
            if current:
                items.append(current)
            current = {}
            rest = stripped[2:]
            if ':' in rest:
                k, _, v = rest.partition(':')
                current[k.strip()] = v.strip().strip('"').strip("'")
        elif ':' in stripped and not stripped.startswith('-'):
            k, _, v = stripped.partition(':')
            current[k.strip()] = v.strip().strip('"').strip("'")
    if current:
        items.append(current)
    return items


def parse_markdown_body(text):
    """Parse markdown body to extract versioned content sections.
    Format: ## ✅ v{VERSION} — {note}\\n\\n{content}\\n\\n---
    """
    versions = []
    # Split by version headers
    sections = re.split(r'\n##\s+(✅|📦)\s+v([\d.]+)(?:\s*[—–-]\s*(.*?))?\n', text)
    # sections: [before_first_header, status1, version1, note1, content1, status2, version2, note2, content2, ...]
    
    i = 1  # skip text before first header
    while i + 1 < len(sections):
        status = sections[i].strip()
        version = sections[i + 1].strip()
        note = sections[i + 2].strip() if i + 2 < len(sections) and not sections[i + 2].startswith('\n') else ''
        content = sections[i + 3].strip() if i + 3 < len(sections) else ''
        
        # Remove trailing --- if present
        if content.endswith('\n---'):
            content = content[:-4]
        
        versions.append({
            'version': version,
            'status': 'active' if '✅' in status else 'old',
            'note': note,
            'content': content
        })
        i += 4
    
    return versions


def load_prompt_md(fpath):
    """Load a prompt from a .md file with frontmatter."""
    with open(fpath, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Extract frontmatter between --- delimiters
    fm_match = re.match(r'^---\n(.*?)\n---', text, re.DOTALL)
    if not fm_match:
        raise ValueError(f"No frontmatter found in {fpath}")
    
    metadata = parse_frontmatter(fm_match.group(1))
    body = text[fm_match.end():]  # 保留前导 \n，否则直接以 ## 开头的版本标题匹配不到 regex
    
    # Parse versioned content from body
    versions = parse_markdown_body(body)
    
    # Merge: use metadata for versions list (order, date, etc.), body for content
    # metadata.versions has the version metadata (version, status, note, date)
    # body.versions has the content text
    result = {
        'id': metadata.get('id', ''),
        'name': metadata.get('name', ''),
        'icon': metadata.get('icon', ''),
        'note': metadata.get('note', ''),
    }
    
    # Parse flowSteps if present as JSON string
    flow_steps_raw = metadata.get('flowSteps', '[]')
    if isinstance(flow_steps_raw, str):
        try:
            result['flowSteps'] = json.loads(flow_steps_raw)
        except:
            result['flowSteps'] = []
    else:
        result['flowSteps'] = flow_steps_raw
    
    # Build versions list from metadata versions + body content
    meta_versions = metadata.get('versions', [])
    result_versions = []
    
    for mv in meta_versions:
        v_data = {'version': mv.get('version', '')}
        if 'status' in mv:
            v_data['status'] = mv['status']
        if 'note' in mv:
            v_data['note'] = mv['note']
        if 'date' in mv:
            v_data['date'] = mv['date']
        
        # Find matching content from body
        for bv in versions:
            if bv['version'] == v_data['version']:
                v_data['content'] = bv['content']
                break
        
        result_versions.append(v_data)
    
    result['versions'] = result_versions
    result['currentVersion'] = metadata.get('currentVersion', '')
    
    return result


def main():
    md_files = sorted(glob.glob(os.path.join(PROMPTS_DIR, '*.md')))
    
    if not md_files:
        print(f'ERROR: No .md files found in {PROMPTS_DIR}/')
        return 1
    
    prompts = []
    for fpath in md_files:
        fname = os.path.basename(fpath)
        # Skip README
        if fname.lower() == 'readme.md':
            continue
        try:
            data = load_prompt_md(fpath)
            prompts.append(data)
            print(f'  Loaded: {fname} ({data.get("id", "?")}) - {len(data.get("versions", []))} versions')
        except Exception as e:
            print(f'  ERROR loading {fname}: {e}')
            import traceback
            traceback.print_exc()
            return 1
    
    # 构建后验证：确保每个版本的 content 非空
    errors = []
    for p in prompts:
        for v in p.get('versions', []):
            if not v.get('content') or len(v['content'].strip()) == 0:
                errors.append(f"  ❌ {p['id']} v{v['version']}: content 为空！检查 Markdown 是否有对应的 ## ✅ v{v['version']} 章节")
    if errors:
        print('\n'.join(errors))
        print('\n⚠️ 构建中止：发现空 content，请修复后重试')
        return 1
    
    js_content = 'window.DEFAULT_PROMPTS = ' + json.dumps(prompts, ensure_ascii=False, separators=(',', ':')) + ';\n'
    
    # 自动生成版本号（MD5），每次内容变化自动更新，无需手动维护
    import hashlib
    md5 = hashlib.md5(js_content.encode('utf-8')).hexdigest()[:8]
    js_content += f'window.PROMPTS_VERSION = "{md5}";\n'
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f'\nDone: {len(prompts)} prompt types -> {OUTPUT_FILE}')
    return 0


if __name__ == '__main__':
    exit(main())
