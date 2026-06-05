name: js-template-fix
description: 修改 HTML/JS 文件的安全工作流。包含：改后自动语法检查、default-prompts.js 安全修改流程、git 安全回滚。
triggers:
  - 修改 HTML 文件后
  - 修改 JS 文件后
  - 修改 default-prompts.js
  - scale-onboard.html
  - admin-legacy.html
  - admin-test-center.html
  - psy-api.js
  - Invalid or unexpected token
  - SyntaxError
agent_created: true
---

# 修改 HTML/JS 文件的安全工作流

## 一、通用语法检查（每次 Edit/Write 后必须执行）

### HTML 文件检查

```bash
node -e "
var fs = require('fs');
var html = fs.readFileSync('mini-app-h5/backend/<文件名>.html', 'utf8');
var scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
scripts.forEach(function(s, i) {
  try { new Function(s.replace(/<script[^>]*>/, '').replace(/<\/script>/, '')); } catch(e) {
    if (e.message.indexOf('async') < 0) console.log('ERR', i, e.message.slice(0,80));
  }
});
console.log('OK');
"
```

### JS 文件检查

```bash
node --check <文件路径>
```

### 规则
1. Edit/Write 后 → 立即跑检查
2. 报错 → 立刻修复 → 再检查 → 通过后继续
3. `async` 关键字的 "Unexpected token" 为假阳性，忽略
4. 不依赖用户发现语法错误

---

## 二、default-prompts.js 安全修改流程（🚨 最高优先级）

`default-prompts.js` 是一个约 170KB 的单行文件，所有提示词以 JSON 嵌入。
**严禁**用 `String.replace()` 全局替换搜索文本——搜索串会误匹配其他提示词。

### 只能使用此流程：

```javascript
// Step 1: git stash（保护本地未提交修改）
// bash: cd <项目> && git stash push -m "backup before prompt edit" -- mini-app-h5/backend/default-prompts.js

// Step 2: 用 vm.runInContext 解析 JS 对象
var fs = require("fs"), vm = require("vm");
var raw = fs.readFileSync("mini-app-h5/backend/default-prompts.js", "utf8");
var ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(raw, ctx);
var data = ctx.window.DEFAULT_PROMPTS;

// Step 3: 精确修改目标提示词
var target = data.find(function(p) { return p.id === "scoring"; });
target.versions.push({
  version: "x.x",
  status: "active",
  date: "2026-xx-xx",
  note: "说明",
  content: "新内容（注意 \\n 转义）"
});
// 把旧 active 改为 old
target.versions.forEach(function(v) {
  if (v.version === "x.x" && v.status === "active" && v !== newVersion) v.status = "old";
});

// Step 4: 序列化 + 语法检查
var output = "window.DEFAULT_PROMPTS = " + JSON.stringify(data) + ";";
fs.writeFileSync("mini-app-h5/backend/default-prompts.js", output);
// 然后: node --check mini-app-h5/backend/default-prompts.js
```

### 禁止行为
- ❌ `String.replace(old, new)` — 搜索串不唯一
- ❌ `git checkout default-prompts.js` — 会丢失本地未 commit 的版本
- ❌ 用 Python 的 `json.loads` 解析（内容含转义字符，会报 Extra data）
- ❌ 在 template literal 中用 `${}` 拼接提示词内容（引号冲突极易出错）

---

## 三、回滚安全规则

1. 改前先 `git stash`（不是 `git checkout`）
2. 如果改坏了：`git stash pop` 恢复
3. 确认正确后再 `git stash drop`
4. `git checkout` 只用于 git 有 track 的文件版本

---

## 四、缓存版本号

修改 `default-prompts.js` 后，必须同时更新 `scale-onboard.html` 和 `admin-legacy.html` 中的引用版本号：

```bash
grep -n "default-prompts.js" mini-app-h5/backend/scale-onboard.html
grep -n "default-prompts.js" mini-app-h5/backend/admin-legacy.html
# 递增 ?v=N，通知用户硬刷
```
