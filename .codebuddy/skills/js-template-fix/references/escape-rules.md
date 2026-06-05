# JavaScript 模板字符串转义修复指南

## 问题根因

JavaScript 模板字符串使用反引号（`` ` ``）作为边界。边界内的反引号和大括号需要转义：

| 字符 | 需转义为 | 说明 |
|------|----------|------|
| `` ` `` | `` \` `` | 反引号 |
| `{` | `\{` | 左大括号 |

## 错误模式（不要这样做）

### 错误1：重复执行同一修复 → 双转义
```
原始:    content = `...\`...`
第1次:   content = `...\\\`...`     ← 多了1个反斜杠
第2次:   content = `...\\\\\\`...`  ← 累积到6个
```
**结果**：`\\\\\\`` 被 JS 解析为 `\\\\`（2个反斜杠）+ `\\``（终止模板），字符串在错误位置截断。

### 错误2：转义外层边界
```
错误: content = \`...content...\`   ← 把外层反引号也转义了
正确: content = `...content...`    ← 外层不转义
```

## 正确做法：幂等性修复

使用 `fix_template_literal.py`，其逻辑：
1. **定位边界**：找到第一个 `` `* `` → 起始，找到最后一个 `` ` `` → 结束
2. **智能替换**：逐字符扫描中间内容，只替换**未转义**的 `` ` `` 和 `{`
3. **幂等保证**：已经 `\`` 的不会变成 `\\``，重复运行结果一致

```bash
python3 ~/.workbuddy/skills/js-template-fix/scripts/fix_template_literal.py <file_path>
node --check <file_path>
```

## 验证步骤

1. `node --check <file>` — 无错误
2. `node -e "const f = require('<file>')"` — 在 Node 中可加载（或输出 window is not defined 均可，只要不是 SyntaxError）
3. 检查修复后关键行确认只有 1 个反斜杠：`python3 -c "import re; f=open('<file>','rb').read(); print([m.group() for m in re.finditer(b'\\\\{2,}`', f)][:5])"`
   - 如果输出 `[]` 则说明没有 2+ 反斜杠的反引号，修复正确

## 预防原则

1. **不要对同一文件多次运行同一修复脚本**
2. **修复前先做备份**：`cp file file.bak`
3. **修复后立即验证**：`node --check`
4. **验证通过后再做其他操作**
