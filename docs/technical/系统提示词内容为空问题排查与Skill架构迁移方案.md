# 系统提示词内容为空问题排查与 Skill 架构迁移方案

## 一、问题排查结果

### 1. 问题现象

访问 `http://localhost:8081/mini-app-h5/backend/admin-legacy.html` 的「系统提示词」模块时，所有提示词的内容区域显示为空，无法查看/复制提示词正文。

### 2. 根本原因

#### 直接原因

`mini-app-h5/backend/default-prompts.js` 中所有提示词对象的 `versions` 数组为空：

```javascript
// 当前 default-prompts.js 中的无效数据
{ id: 'scoring', name: '计分规则提取', icon: '🎯', versions: [], currentVersion: '' }
```

#### 间接原因

`build-prompts.py` 构建脚本的正则表达式无法正确匹配 `prompts/*.md` 源文件中的版本章节（如 `## ✅ v3.1 — 修复筛查条件`），导致版本 `content` 字段提取失败。

### 3. 与 Skill 架构重构的关联

**是架构变更直接导致**：

- 原系统提示词是静态硬编码在 `default-prompts.js` 中，重构为 Skill 架构后，提示词应作为独立 Skill 存在
- 原有加载/渲染逻辑未适配新 Skill 结构的解析规则，导致内容为空

---

## 二、完整迁移方案

以下方案实现**平滑迁移**：保留原有用户数据（localStorage），同时对接新 Skill 架构。

---

### 第一部分：数据结构映射（原有提示词 → 新 Skill 架构）

| 原有字段         | 原有含义       | 新 Skill 架构对应                  | 说明                                  |
| ---------------- | -------------- | ---------------------------------- | ------------------------------------- |
| `id`             | 提示词唯一标识 | `SkillMetadata.name`               | 采用 `kebab-case`，如 `scoring-v3.1`  |
| `name`           | 显示名称       | `SkillMetadata.description`        | 描述为「XX提示词」，供UI显示          |
| `icon`           | 图标           | `SkillMetadata.metadata.icon`      | 扩展字段存储                          |
| `note`           | 用途说明       | `SkillMetadata.metadata.note`      | 扩展字段存储                          |
| `flowSteps`      | 使用流程       | `SkillMetadata.metadata.flowSteps` | 扩展字段存储                          |
| `versions`       | 版本列表       | 独立 Skill 文件                    | **推荐**：每个版本对应一个 `.md` 文件 |
| `currentVersion` | 激活版本       | `SkillMetadata.version`            | 每个 Skill 对应一个版本               |

**推荐目录结构**（每个版本独立文件）：

```
skills/system-prompts/
├── scoring-v3.1.md   # 计分规则提取 v3.1（active）
├── scoring-v3.0.md   # 计分规则提取 v3.0（old）
├── csv-v3.0.md       # CSV生成提示词 v3.0
└── ...
```

---

### 第二部分：逻辑转换代码实现

#### 2.1 提示词加载逻辑改造（兼容 localStorage + SkillRegistry）

替换原有 `loadData` 函数，优先从 Skill 系统加载默认提示词，再合并用户本地自定义版本：

```javascript
// admin-legacy.html 系统提示词模块改造
function loadSkillPrompts() {
  const SP_KEY = 'psy_sys_prompts';
  let spData = [];

  // 1. 从 SkillRegistry 加载默认提示词（对应原 default-prompts.js）
  if (window.skillRegistry) {
    const defaultPrompts = window.skillRegistry
      .getAllMetadata()
      .filter((meta) => meta.metadata && meta.metadata.type === 'system-prompt')
      .map((meta) => {
        const skill = window.skillRegistry.get(meta.name);
        return {
          id: meta.name,
          name: meta.description.replace('提示词', ''),
          icon: meta.metadata.icon || '📝',
          note: meta.metadata.note || '',
          flowSteps: meta.metadata.flowSteps || [],
          versions: skill
            ? [
                {
                  version: meta.version,
                  status: 'active',
                  content: skill.body,
                  date: new Date().toISOString().split('T')[0],
                  note: meta.metadata.note || ''
                }
              ]
            : [],
          currentVersion: meta.version
        };
      });
    spData = defaultPrompts;
  } else {
    // Fallback：无 SkillRegistry 时沿用原逻辑
    spData = JSON.parse(JSON.stringify(window.DEFAULT_PROMPTS || []));
  }

  // 2. 合并 localStorage 中用户自定义版本（兼容原有逻辑）
  try {
    const saved = localStorage.getItem(SP_KEY);
    if (saved) {
      const localPrompts = JSON.parse(saved);
      spData.forEach((defaultPt, idx) => {
        const localPt = localPrompts.find((lpt) => lpt.id === defaultPt.id);
        if (localPt) {
          // 合并用户新增的版本
          const mergedVersions = [...defaultPt.versions];
          localPt.versions.forEach((lv) => {
            if (!mergedVersions.some((v) => v.version === lv.version)) {
              mergedVersions.push(lv);
            }
          });
          spData[idx].versions = mergedVersions;
          spData[idx].currentVersion = localPt.currentVersion || defaultPt.currentVersion;
        }
      });
    }
  } catch (e) {
    console.warn('[SP] 合并本地版本失败:', e.message);
  }

  // 3. 归一化处理（去重、验证空内容）
  normalizeData(spData);
  return spData;
}

// 改造原有 spInit 函数
window.spInit = function () {
  spData = loadSkillPrompts();
  if (!spData || spData.length === 0) {
    console.error('[SystemPrompts] 无提示词数据，强制从 Skill 系统加载');
    spData = loadSkillPrompts();
  }
  renderTabs();
};
```

#### 2.2 提示词渲染逻辑改造（动态从 Skill 获取内容）

改造 `renderReadingArea`，当版本内容为空时自动从 Skill 系统获取：

```javascript
function renderReadingArea() {
  try {
    var pt = getPt(spCurrentType);
    // 新增：内容为空时从 Skill 系统动态获取
    if (
      !pt ||
      !pt.versions ||
      pt.versions.length === 0 ||
      (pt.versions.length > 0 && !pt.versions[pt.versions.length - 1].content)
    ) {
      if (window.skillRegistry) {
        try {
          const skill = window.skillRegistry.get(pt.id);
          if (skill && skill.body) {
            pt.versions = [
              {
                version: skill.metadata.version,
                status: 'active',
                content: skill.body,
                date: new Date().toISOString().split('T')[0],
                note: skill.metadata.metadata.note || ''
              }
            ];
            pt.currentVersion = skill.metadata.version;
            saveData(); // 保存到 localStorage
          }
        } catch (e) {
          console.warn('[SP] 从 Skill 系统获取内容失败:', e.message);
        }
      }
    }

    if (!pt || !pt.versions || pt.versions.length === 0) {
      document.getElementById('sp-reading-container').innerHTML =
        '<div style="padding:20px;color:var(--text-muted);text-align:center;">暂无提示词数据</div>';
      return;
    }

    // 后续渲染逻辑与原有一致
    var cv = pt.versions.find((v) => v.version === pt.currentVersion) || pt.versions[pt.versions.length - 1];
    if (!cv || !cv.content) {
      document.getElementById('sp-reading-container').innerHTML =
        '<div style="padding:20px;color:var(--text-muted);text-align:center;">版本内容为空，请检查提示词构建</div>';
      return;
    }

    // ... 原有渲染代码（省略）
  } catch (e) {
    console.error('[SP] renderReadingArea 异常:', e.message);
    document.getElementById('sp-reading-container').innerHTML =
      '<div style="padding:20px;color:#c00;text-align:center;">⚠️ 提示词渲染失败: ' + e.message + '</div>';
  }
}
```

#### 2.3 版本管理逻辑改造（支持同步到 Skill 系统）

改造 `spAddVersion`，支持将新版本同步到 Skill 系统：

```javascript
window.spAddVersion = function () {
  var pt = getPt(spCurrentType);
  var cur = pt.currentVersion;
  var parts = cur.split('.');
  var nv = parseInt(parts[0]) + '.' + (parseInt(parts[1]) + 1);
  var curObj = pt.versions.find((v) => v.version === cur);

  // 新增版本
  pt.versions.push({
    version: nv,
    status: 'draft',
    note: '基于 v' + cur + ' 创建',
    date: new Date().toISOString().split('T')[0],
    content: curObj ? curObj.content : ''
  });
  pt.currentVersion = nv;
  saveData();
  renderTabs();

  // 新逻辑：可选同步到 Skill 系统
  if (window.skillRegistry && confirm('是否将新版本同步到 Skill 系统？')) {
    const skillMeta = {
      name: pt.id + '-v' + nv,
      description: pt.name + ' v' + nv + ' 提示词',
      version: nv,
      metadata: {
        type: 'system-prompt',
        icon: pt.icon,
        note: '基于 v' + cur + ' 创建',
        flowSteps: pt.flowSteps
      }
    };
    // 调用后端 API 保存 Skill（需后端配合实现）
    fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: skillMeta, body: curObj.content })
    })
      .then((res) => {
        if (res.ok) showToast('已同步到 Skill 系统', 'success');
        else throw new Error('同步失败');
      })
      .catch((err) => showToast('同步失败: ' + err.message, 'error'));
  }

  showToast('✨ 已创建 v' + nv + '（基于 v' + cur + ' 克隆）', 'success');
};
```

---

### 第三部分：接口适配代码实现

#### 3.1 兼容原有全局接口

改造原有 `getPromptById`、`getPromptContent` 接口，优先从 Skill 系统获取：

```javascript
// 兼容原有 getPromptById 接口
window.getPromptById = function (id) {
  // 优先从 SkillRegistry 获取
  if (window.skillRegistry) {
    try {
      const skill = window.skillRegistry.get(id);
      if (skill) {
        return {
          id: skill.metadata.name,
          name: skill.metadata.description.replace('提示词', ''),
          icon: skill.metadata.metadata.icon || '📝',
          note: skill.metadata.metadata.note || '',
          flowSteps: skill.metadata.metadata.flowSteps || [],
          versions: [
            {
              version: skill.metadata.version,
              status: 'active',
              content: skill.body,
              date: new Date().toISOString().split('T')[0],
              note: skill.metadata.metadata.note || ''
            }
          ],
          currentVersion: skill.metadata.version
        };
      }
    } catch (e) {
      /* Skill 未找到，fallback */
    }
  }
  // Fallback 到原有 DEFAULT_PROMPTS
  return (window.DEFAULT_PROMPTS || []).find((p) => p.id === id) || null;
};

// 兼容原有 getPromptContent 接口
window.getPromptContent = function (id) {
  const prompt = window.getPromptById(id);
  if (!prompt) return '';
  const version =
    prompt.versions.find((v) => v.version === prompt.currentVersion) || prompt.versions[prompt.versions.length - 1];
  return version ? version.content : '';
};
```

#### 3.2 新增 Skill 架构专用接口

```javascript
// 新增：从 Skill 系统重新加载所有提示词
window.reloadPromptsFromSkill = function () {
  if (!window.skillRegistry) throw new Error('SkillRegistry 未初始化');
  window.skillRegistry.discover(); // 重新扫描 Skill 目录
  spData = loadSkillPrompts();
  renderTabs();
  showToast('已从 Skill 系统重新加载提示词', 'success');
};

// 新增：直接获取 Skill 正文内容
window.getPromptFromSkill = function (id) {
  if (!window.skillRegistry) throw new Error('SkillRegistry 未初始化');
  const skill = window.skillRegistry.get(id);
  return skill ? skill.body : '';
};
```

---

### 第四部分：构建脚本改造（`build-prompts.py`）

修复原构建脚本的正则匹配问题，并支持生成 Skill 格式文件：

```python
#!/usr/bin/env python3
import json, os, glob, re, hashlib
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(SCRIPT_DIR, 'prompts')
OUTPUT_FILE = os.path.join(SCRIPT_DIR, 'mini-app-h5', 'backend', 'default-prompts.js')
SKILL_OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'skills', 'system-prompts')

def parse_markdown_body(text):
    """修复正则匹配，正确提取版本内容"""
    versions = []
    # 支持 ✅/📦 开头、中文破折号、任意数量空格
    pattern = r'\n##\s+(✅|📦)\s+v([\d.]+)\s*[—–-]\s*(.*?)\n'
    sections = re.split(pattern, text)
    i = 1
    while i + 3 < len(sections):
        status_icon = sections[i].strip()
        version = sections[i+1].strip()
        note = sections[i+2].strip()
        content = sections[i+3].strip()
        # 移除末尾的 --- 分隔符
        if content.endswith('\n---'):
            content = content[:-4].strip()
        versions.append({
            'version': version,
            'status': 'active' if status_icon == '✅' else 'old',
            'note': note,
            'content': content,
            'date': datetime.now().strftime('%Y-%m-%d')
        })
        i += 4
    return versions

def generate_skill_files(prompts):
    """为每个提示词版本生成独立的 Skill .md 文件"""
    os.makedirs(SKILL_OUTPUT_DIR, exist_ok=True)
    for pt in prompts:
        for ver in pt.get('versions', []):
            filename = f"{pt['id']}-v{ver['version'].replace('.', '_')}.md"
            filepath = os.path.join(SKILL_OUTPUT_DIR, filename)
            frontmatter = f"""---
id: {pt['id']}-v{ver['version']}
name: {pt['name']} v{ver['version']}
description: {pt['name']} 提示词 v{ver['version']}
version: "{ver['version']}"
metadata:
  type: system-prompt
  icon: "{pt.get('icon', '📝')}"
  note: "{ver.get('note', '')}"
  flowSteps: {json.dumps(pt.get('flowSteps', []), ensure_ascii=False)}
---
{ver['content']}
"""
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(frontmatter)
            print(f'✅ 生成 Skill 文件: {filepath}')

def main():
    # 1. 加载 prompts/*.md 源文件
    md_files = sorted(glob.glob(os.path.join(PROMPTS_DIR, '*.md')))
    prompts = [load_prompt_md(fp) for fp in md_files if not os.path.basename(fp).lower() == 'readme.md']

    # 2. 验证：确保 active 版本 content 非空
    for pt in prompts:
        for v in pt.get('versions', []):
            if v.get('status') == 'active' and not v.get('content', '').strip():
                raise ValueError(f"❌ {pt['id']} v{v['version']} (active) content 为空")

    # 3. 生成 default-prompts.js（兼容旧逻辑）
    js_content = 'window.DEFAULT_PROMPTS = ' + json.dumps(prompts, ensure_ascii=False, separators=(',', ':')) + ';\n'
    md5 = hashlib.md5(js_content.encode('utf-8')).hexdigest()[:8]
    js_content += f'window.PROMPTS_VERSION = "{md5}";\n'
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f'✅ 生成 {OUTPUT_FILE} ({len(prompts)} 个提示词)')

    # 4. 生成 Skill .md 文件（新架构）
    generate_skill_files(prompts)
    return 0

if __name__ == '__main__':
    exit(main())
```

---

## 三、部署验证步骤

1. **修复构建脚本**：用上述改造后的 `build-prompts.py` 替换原有脚本
2. **重新构建**：运行 `python3 build-prompts.py`，确认无 ERROR 且生成了 `skills/system-prompts/*.md`
3. **初始化 SkillRegistry**：在 `admin-legacy.html` 中新增初始化代码：
   ```javascript
   // 在页面加载时初始化 SkillRegistry
   window.addEventListener('DOMContentLoaded', function () {
     window.skillRegistry = new SkillRegistry();
     window.skillRegistry.discover([os.path.join(SCRIPT_DIR, 'skills', 'system-prompts')]);
     // 初始化系统提示词模块
     spInit();
   });
   ```
4. **测试验证**：
   - 访问系统提示词模块，确认内容正常显示
   - 测试新增/删除版本，确认 localStorage 兼容
   - 测试 `reloadPromptsFromSkill` 接口，确认能从 Skill 系统重新加载

---

**预期效果**：系统提示词内容为空问题修复，同时完成向 Skill 架构的平滑迁移，保留所有原有功能。
