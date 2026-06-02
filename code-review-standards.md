# 代码审查标准与流程指南 v3.0

> **更新日期**: 2026-05-16
> **维护者**: 技术团队
> **适用项目**: 星蓝心镜 · 心理健康测评系统 (知我心灵测评)
> **技术栈**: H5 · 微信小程序 · CloudBase 静态托管 · Node.js (psy-api) · Python (构建/部署)

---

## 目录

1. [审查目标与优先级](#审查目标与优先级)
2. [审查标准](#审查标准)
3. [本项目核心模块审查清单](#本项目核心模块审查清单)
4. [审查流程](#审查流程)
5. [评论规范](#评论规范)
6. [自动化与部署前检查](#自动化与部署前检查)

---

## 审查目标与优先级

代码审查的目标是**提升代码质量**和**防止线上故障**，不是找茬。

### 审查重点（按此顺序逐项检查）

| 优先级 | 关注点      | 说明                                 |
| ------ | ----------- | ------------------------------------ |
| 1      | 🔒 安全     | SQL注入、XSS、敏感信息泄露、认证绕过 |
| 2      | ✅ 正确性   | 逻辑是否正确、边界条件、错误处理     |
| 3      | 🔧 可维护性 | 命名清晰、职责单一、无死代码         |
| 4      | ⚡ 性能     | N+1查询、大循环、内存泄漏            |
| 5      | 🧪 测试     | 关键路径是否验证过                   |

---

## 审查标准

### 🔴 Blocker（必须修复才能合并）

**安全**：

- 用户输入未验证直接拼接到 SQL / HTML
- 密钥/token/密码硬编码在源码中
- `console.log` 泄露敏感信息到生产日志
- 缺少必要权限检查
- **本项目特有**：微信 openid / session_key 泄露到前端日志

**数据正确性**：

- 计分逻辑错误（维度分计算、分组求和、反向计分）
- 变量注入导致数据错乱
- 类型强转导致静默错误（如 `"1" + 1 = "11"`）

**部署安全**：

- 未经本地测试即部署
- 缺少部署前备份
- 生产环境路径（如 `SCALES_JSON_PATH`）未区分本地/生产

### 🟡 Suggestion（应该修复）

- 缺少输入校验
- 函数/变量命名不清晰
- 复杂逻辑缺少注释
- 重复代码未抽取
- 缺少错误处理（try-catch）
- 类型不一致（`===` vs `==` 混用导致数据类型比较 bug）

### 💭 Nit（可选修复）

- 注释与代码不一致
- 冗余变量/未使用导入
- 格式不一致（如果有 linter 则交给 linter）

---

## 本项目核心模块审查清单

### 🧠 Scoring Engine (`scoring-engine.js`)

| 检查项           | 说明                                                                 | 严重度 |
| ---------------- | -------------------------------------------------------------------- | ------ |
| grouped 分组计分 | 父亲/母亲分组是否独立计分（不能合并求和），`dimKey` 前缀匹配是否正确 | 🔴     |
| 反向计分         | `transform` 中 `reverse` / `R:` 逻辑是否覆盖所有逆向题               | 🔴     |
| 维度分精度       | `score: Math.round(score * 100) / 100` 是否保留两位小数              | 🟡     |
| 边界值           | 空答案、0分、全满分是否正常处理                                      | 🟡     |
| 矩阵题计分       | 分行求和逻辑是否正确                                                 | 🟡     |
| 特殊题型         | parent-child, grouped, matrix 各自的 `_collectSpecialScore` 分支     | 🔴     |

### 🎯 Meta Prompt & AI 管道

| 检查项     | 说明                                                                  | 严重度 |
| ---------- | --------------------------------------------------------------------- | ------ |
| 变量注入   | `{scaleName}` `{dimensions}` `{answers}` 等变量替换后 SP 结构是否完整 | 🔴     |
| 数据区分离 | SP 末尾是否包含 `{dimensions}` `{answers}` 数据区（代码层追加）       | 🟡     |
| 嵌套变量   | 禁止 `{dimensions['xx']['score']}` 格式（正则无法替换）               | 🔴     |
| SP 约束    | SP 正文是否包含冗余格式约束（已被代码层接管）                         | 🟡     |
| 角色边界   | 角色推导是否包含量表性质声明和非临床诊断声明                          | 🟡     |
| 可读文本   | `extractReadableVars` 输出的 dimensions/answers 格式是否人类可读      | 🟡     |

### 📊 Test Engine (`test-engine.js`)

| 检查项      | 说明                                                          | 严重度 |
| ----------- | ------------------------------------------------------------- | ------ |
| 答案生成    | `_generateGroupedAnswer` 父亲/母亲分组是否各自独立随机        | 🔴     |
| Grouped渲染 | 非数组 grouped（EMBU 风格）芯片高亮是否支持 ID 和数字两种答案 | 🔴     |
| 计分展示    | grouped 题分值是否分开展示父亲/母亲（非合并为一个数字）       | 🟡     |
| 预设计分    | Preset 答案的分数计算是否正确                                 | 🟡     |

### 🚢 部署相关

| 检查项     | 说明                                                | 严重度 |
| ---------- | --------------------------------------------------- | ------ |
| 文件清单   | 确认所有改动文件的部署目标（scp / build-deploy.py） | 🔴     |
| 生产路径   | `SCALES_JSON_PATH` 等环境变量是否区分本地/生产      | 🔴     |
| 部署前备份 | `cp file file.bak.$(date +%Y%m%d_%H%M)`             | 🔴     |
| JS 语法    | 所有 .js 文件 `node --check` 通过                   | 🔴     |
| HTML 结构  | 所有 .html 文件 div 平衡检查通过                    | 🟡     |
| 本地验证   | 改动后在 `localhost:8080` 完整跑一次功能流程        | 🔴     |
| 生产验证   | 部署后在 `www.soarto.com.cn` 手动验证关键功能       | 🔴     |

---

## 审查流程

### 标准流程（每轮改动）

```
0. 本地开发
   ├── 改动代码
   ├── JS 语法检查：node --check <file>
   ├── HTML 平衡：grep -o '<div[ >]' | wc -l vs grep -o '</div>' | wc -l
   └── 本地功能测试

1. 提交审查
   ├── 开发者标注改动范围
   ├── 附上本地测试结果
   └── 提供改动前后的对比说明

2. 审查
   ├── 审查者按清单逐项检查
   ├── 标记 Blocker / Suggestion / Nit
   └── 所有 Blocker 必须修复

3. 修复与确认
   ├── 开发者修复标记项
   └── 审查者确认修复

4. 部署
   ├── 创建备份
   ├── scp / build-deploy.py 部署
   └── 生产环境验证
```

### 改动量分级

| 级别  | 定义                   | 审查强度              |
| ----- | ---------------------- | --------------------- |
| Patch | 1-2 行修改、样式微调   | 快速审查              |
| Minor | 单函数修改、新增功能点 | 标准审查              |
| Major | 多文件改动、架构变更   | 深度审查 + 端到端测试 |

---

## 评论规范

### 好的评论特征

1. **指向具体行号**："第 42 行的 `innerHTML` 可能 XSS"
2. **解释为什么**："因为 `{dimensions}` 是可读文本不是 JSON，嵌套方括号会让正则匹配失败"
3. **给出修复方向**："建议改用 `getElementById` + `textContent`"
4. **标记优先度**：🔴 必改 / 🟡 应改 / 💭 可选

### 评论模板

```
🔴 **安全: 变量注入导致 SP 结构断裂**
`scale-onboard.html` 第 4441 行: `{answers}` 被替换为 15 行可读文本后撑爆了 `B. 变量盘点` 段落。

**原因**: JSON 时代的单行字符串 → 可读文本的多行格式，注入位置没变。

**建议**:
1. SP 末尾新增独立的 `【数据区】` 段落
2. 正文规则中不再内嵌 `{answers}` / `{dimensions}`，改为引用数据区
```

---

## 自动化与部署前检查

### 部署前必做的自动化检查

```bash
# 1. JS 语法检查（所有非 .html 的 JS 文件）
node --check mini-app-h5/backend/*.js
node --check mini-app-h5/scoring-engine.js
node --check mini-app-h5/shared-data.js

# 2. HTML 内 JS 语法（提取 script 标签内容）
node -e "
const h = require('fs').readFileSync('mini-app-h5/backend/admin-legacy.html','utf8');
const scripts = h.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
scripts.forEach(s => new Function(s.replace(/<\/?script[^>]*>/g,'')));
console.log('admin-legacy.html JS OK');
"

# 3. HTML div 平衡
for f in admin-legacy.html scale-onboard.html admin-test-center.html; do
  opens=$(grep -o '<div[ >]' "$f" | wc -l)
  closes=$(grep -o '</div>' "$f" | wc -l)
  [ "$opens" -eq "$closes" ] && echo "OK: $f" || echo "FAIL: $f diff=$((opens-closes))"
done

# 4. default-prompts.js JSON 有效性
node -e "JSON.parse(require('fs').readFileSync('mini-app-h5/backend/default-prompts.js','utf8').match(/\[([\s\S]*)\]/)[0])" && echo "OK"

# 5. 本地功能验证
open http://localhost:8080/mini-app-h5/backend/admin-test-center.html
# → 手动：选量表 → 随机答案 → 运行测试 → 检查计分正确性
# → 手动：预览 Prompt → 检查变量替换后 SP 完整
```

### 部署命令模板

```bash
# 备份
DATE=$(date +%Y%m%d_%H%M)
for f in admin-legacy.html scale-onboard.html test-engine.js default-prompts.js; do
  cp $f $f.bak.$DATE
done

# 部署（admin-legacy 等走 scp，frontend 走 build-deploy.py）
scp -i ~/.ssh/id_ed25519 mini-app-h5/backend/admin-legacy.html root@101.43.43.125:/www/wwwroot/www.soarto.com.cn/backend/
scp -i ~/.ssh/id_ed25519 mini-app-h5/backend/default-prompts.js root@101.43.43.125:/www/wwwroot/www.soarto.com.cn/backend/
scp -i ~/.ssh/id_ed25519 mini-app-h5/backend/scale-onboard.html root@101.43.43.125:/www/wwwroot/www.soarto.com.cn/backend/
scp -i ~/.ssh/id_ed25519 mini-app-h5/backend/test-engine.js root@101.43.43.125:/www/wwwroot/www.soarto.com.cn/backend/

# 生产验证
open https://www.soarto.com.cn/backend/admin-legacy.html
```
