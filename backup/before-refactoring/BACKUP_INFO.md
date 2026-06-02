# 代码备份信息

**备份时间**: 2026-05-29 22:54  
**备份版本**: 改造前原始版本  
**备份范围**: mini-app-h5/backend/ 全部JS文件

---

## 备份文件清单

```
backup/before-refactoring/mini-app-h5/backend/
├── admin-ai-config.js
├── admin-ai-diag.js
├── admin-api.js
├── admin-auth.js
├── admin-chart.js
├── admin-data.js
├── admin-event-delegation.js
├── admin-feedback.js
├── admin-npc.js
├── admin-ops.js
├── admin-scale-form.js
├── admin-scale-list.js
├── admin-scale-wizard.js
├── admin-scoring.js
├── admin-ui-utils.js
├── asset-storage.js
├── cloud-data.js
├── data-monitor.js
├── default-prompts.js
├── dual-adapter.js
├── event-hub.js
├── ops-manual-data.js
├── plugin-base.js
├── plugin-loader.js
├── scoring-engine.js
└── shared-data.js
```

---

## 回退方案

### 方案1：单个插件回退

适用于：单个插件改造失败，其他插件正常

**步骤**：

1. 打开 `plugin-loader.js`
2. 注释掉对应插件的 `export default`
3. 恢复原来的 `<script>` 引入方式

**示例**（回退AI插件）：

```javascript
// plugins/core/ai-plugin.js
// export default AIPlugin;  // 注释这行

// admin-legacy.html
// 恢复原来的引入
<script src="admin-ai-config.js"></script>
<script src="admin-ai-diag.js"></script>
```

---

### 方案2：全局回退

适用于：多个插件改造失败，需要完全恢复

**步骤**：

```bash
# 1. 删除改造后的文件
rm -f /Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/plugins/core/*.js
rm -f /Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/plugins/optional/*.js

# 2. 恢复备份
cp -r /Users/rich/WorkBuddy/20260407113106/backup/before-refactoring/mini-app-h5/backend/*.js \
      /Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/

# 3. 恢复 admin-legacy.html
# 需要从git恢复：git checkout admin-legacy.html
```

---

## 验证回退成功

回退后，执行以下检查：

```javascript
// 1. 检查插件系统是否禁用
console.log(typeof PluginLoader); // 应该输出 "undefined" 或报错

// 2. 检查原有功能是否正常
// - 登录功能
// - 量表管理
// - 计分规则
// - AI配置
```

---

## 注意事项

1. **渐进式改造**：改造一个插件，启用一个插件，没改造的保持原样
2. **备份优先**：每次改造前确保备份最新
3. **测试验证**：每次改造后必须测试原有功能
4. **快速回退**：单个插件问题只需注释 `export default`
