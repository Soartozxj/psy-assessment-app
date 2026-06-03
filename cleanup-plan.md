# 项目文件清理计划

## 清理目标

移除项目中的冗余测试文件、临时文件和构建产物，减少干扰文件。

## 待清理文件清单

### 1. XSS测试冗余文件 (mini-app-h5/)

保留：

- `xss-test-final.cjs` (最终测试脚本)
- `XSS渗透测试报告-正确版.md` (最终报告)

删除（共14个文件）：

- xss-correct-test.cjs
- xss-final.cjs
- xss-penetration-test.js
- xss-simple-correct.cjs
- xss-simple-test.mjs
- xss-simple.cjs
- xss-test-fixed.mjs
- xss-test.cjs
- xss-verify.cjs
- XSS-TEST.html
- XSS渗透测试页面-修正版.html
- XSS渗透测试页面.html
- XSS渗透测试报告-验证版.md
- XSS渗透测试报告-最终版.md

### 2. 根目录临时测试文件

删除（共20+个文件）：

- test-\*.html (多个测试HTML)
- test-\*.js (多个测试JS)
- test*results*\*.json (测试结果)
- \*-snapshot.yaml (快照文件)
- ocr-out.txt

### 3. 构建和部署产物

删除：

- psy-service-deploy.zip
- coverage/ (测试覆盖率报告)

### 4. 一次性Python/Node脚本

评估后删除（如果不是构建必需）：

- build-\*.py
- cleanup-documents.py
- doc_cleaner\*.py
- document_cleaner\*.py
- fix_test.py
- gen_embu.py
- migrate_interp.py
- step3\_\*.py
- sync-from-live.py
- update-json-prompt.js
- upload-cloud.py
- verify_interp.py

## 执行步骤

1. 备份重要文件（如有需要）
2. 删除XSS测试冗余文件
3. 删除临时测试文件
4. 删除构建产物
5. 删除一次性脚本
6. 更新 .gitignore
7. 提交清理变更

## 预计清理文件数

- 约 40-50 个冗余文件
- 释放磁盘空间：约 10-50MB

## 风险控制

- 不删除源代码文件
- 不删除配置文件
- 不删除文档文件（\*.md）
- 保留最终版本的测试报告和脚本
