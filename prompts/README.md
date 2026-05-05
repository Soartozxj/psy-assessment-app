# 提示词目录

> 最后更新: 2026-05-05

## 目录结构

```
prompts/
├── README.md                              # 本文件
├── CSV导入文件生成提示词.md                 # → CSV导入.md (待重命名)
├── JSON导入文件生成提示词.md                # → JSON导入.md (待重命名)
├── 计分规则提取提示词.md                    # → 计分提取.md (待重命名)
├── meta-prompt.md                         # ✅ Meta Prompt (已抽离)
├── runtime/
│   └── 计分规则解析模板.md
├── archive/                               # 历史版本和测试文件
│   ├── fix-prompt.js
│   └── ... (历史文件)
└── backup/                                # 构建前自动备份（待实现）
```

---

## 命名规范

### 文件命名：中文优先

```
✅ 计分提取.md              ← 一眼看懂
✅ JSON导入.md               ← 中文+英文混合
✅ meta-prompt.md            ← 纯英文（约定俗成）
❌ csv-import.md             ← 英文不直观
❌ CSV导入文件生成提示词.md   ← 太长
❌ 计分_v3.1.md              ← 不要版本号在文件名里
```

| 优先级 | 格式 | 适用场景 | 
|:---:|------|---------|
| 1 | **纯中文** | 功能明确，有共识中文名 |
| 2 | **中文-英文** | 需要补充技术含义 |
| 3 | **纯英文** | 技术术语无合适中文 |

### id vs name 职责分离

```yaml
# 文件: 计分提取.md
---
id: scoring-extract              # ← 英文，代码引用
name: "计分规则提取提示词"        # ← 中文，后台 UI 显示
---
```
- **文件名** → 给人看（中文）
- **id** → 给代码用（英文）  
- **name** → 给 UI 用（中文）

### 版本标记

| 标记 | 含义 | 格式 |
|------|------|------|
| `## ✅ v{major}.{minor} — {说明}` | 活跃版本 | `## ✅ v3.1 — 修复筛查条件` |
| `## 📦 v{major}.{minor} — {说明}` | 归档版本 | `## 📦 v1.0 — 初始版本` |

### 变量占位符

`{camelCase}` 语义清晰：`{scaleName}` `{score}` `{dimensions}` `{answers}`

详见项目文档 `ai-prompt-system-analysis.md` 第十五章。

---

## 源文件格式

每个 `.md` 文件使用 **YAML frontmatter + Markdown body** 格式，完整示例见 `ai-prompt-system-analysis.md`。

---

## 源文件 → 生成产物

```
prompts/*.md ──→ build-prompts.py ──→ mini-app-h5/backend/default-prompts.js
```

**编辑流程**：
1. 修改 `prompts/` 下的 `.md` 文件
2. 运行 `python3 build-prompts.py` 重新生成
3. 检查构建输出，确认无 ERROR
4. ⚠️ 不要直接编辑 `default-prompts.js`

---

## 当前提示词清单

| 文件 | ID | 版本 | 用途 |
|------|----|:---:|------|
| CSV导入文件生成提示词.md | csv | v3.0 | AI 生成 CSV 导入文件 |
| JSON导入文件生成提示词.md | json | v4.1 | AI 生成 JSON 导入文件 |
| 计分规则提取提示词.md | scoring | v3.1 | AI 从手册提取计分规则 |
| meta-prompt.md | meta | v1.0 | AI 诊断 System Prompt 生成规则 |
