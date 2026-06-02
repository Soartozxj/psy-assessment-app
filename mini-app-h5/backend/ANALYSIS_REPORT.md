# Skills架构改造 - 代码分析报告

**生成时间**: 2026-05-29  
**分析范围**: `/mini-app-h5/backend/` 目录

---

## 1. 文件清单与规模统计

| 文件                          | 大小      | 估计行数 | 类型             |
| ----------------------------- | --------- | -------- | ---------------- |
| admin-legacy.html             | -         | 24,767   | 主入口（待拆分） |
| admin-auth.js                 | 9.08 KB   | ~280     | 认证模块         |
| admin-ai-config.js            | 12.35 KB  | ~390     | AI配置           |
| admin-ai-diag.js              | 24.16 KB  | ~430     | AI诊断           |
| admin-api.js                  | 14.66 KB  | ~500     | 数据访问层       |
| admin-chart.js                | 9.55 KB   | ~350     | 图表渲染         |
| admin-data.js                 | 8.26 KB   | ~210     | 数据管理         |
| admin-event-delegation.js     | 70.36 KB  | ~1300    | 事件委托         |
| admin-feedback.js             | 27.49 KB  | ~600     | 反馈管理         |
| admin-npc.js                  | 94.93 KB  | ~2000    | NPC配置          |
| admin-ops.js                  | 10.97 KB  | ~270     | 运维管理         |
| admin-scale-form.js           | 3.04 KB   | ~50      | 量表表单         |
| admin-scale-list.js           | 18.98 KB  | ~450     | 量表列表         |
| admin-scale-wizard.js         | 16.11 KB  | ~400     | 量表向导         |
| admin-scoring.js              | 46.31 KB  | ~780     | 计分规则         |
| admin-ui-utils.js             | 11.51 KB  | ~300     | UI工具库         |
| asset-storage.js              | 9.26 KB   | ~250     | IndexedDB存储    |
| cloud-data.js                 | 9.72 KB   | ~300     | 云端数据         |
| data-monitor.js               | 11.92 KB  | ~350     | 数据监控         |
| default-prompts.js            | 6.13 KB   | ~190     | 默认提示词       |
| dual-adapter.js               | 15.2 KB   | ~400     | 双端适配器 ✅    |
| event-hub.js                  | 10.86 KB  | ~370     | 事件中心 ✅      |
| plugin-base.js                | 6.92 KB   | ~250     | 插件基类 ✅      |
| plugin-loader.js              | 9.7 KB    | ~330     | 插件加载器 ✅    |
| scoring-engine.js             | 56.27 KB  | ~1100    | 计分引擎         |
| shared-data.js                | 708.79 KB | ~15000+  | 共享数据         |
| ops-manual-data.js            | 28.38 KB  | ~400     | 运维手册         |
| **plugins/core/ai-plugin.js** | 9.86 KB   | ~335     | AI插件 ✅        |

---

## 2. 可插件化功能模块

### 已规划（plugin-loader.js）

```javascript
this.corePlugins = ['auth', 'ai', 'scale', 'scoring', 'npc'];
this.optionalPlugins = ['meditation', 'analytics', 'diary'];
```

### 插件拆分建议

| 插件名               | 源文件                              | 优先级 | 状态           |
| -------------------- | ----------------------------------- | ------ | -------------- |
| **auth-plugin**      | admin-auth.js                       | 高     | 待拆分         |
| **ai-plugin**        | ai-plugin.js                        | 高     | ✅ 已完成      |
| **scale-plugin**     | admin-scale-\*.js, admin-api.js     | 高     | 待拆分         |
| **scoring-plugin**   | admin-scoring.js, scoring-engine.js | 高     | 待拆分         |
| **npc-plugin**       | admin-npc.js, asset-storage.js      | 中     | 待拆分         |
| **feedback-plugin**  | admin-feedback.js                   | 中     | 待拆分         |
| **analytics-plugin** | admin-chart.js, admin-data.js       | 低     | 待拆分（可选） |
| **ops-plugin**       | admin-ops.js                        | 低     | 待拆分         |

---

## 3. DualAdapter 覆盖度分析

### 3.1 Adapter 已提供的能力

| 类别        | 方法                                        | H5实现               | 小程序实现        |
| ----------- | ------------------------------------------- | -------------------- | ----------------- |
| **storage** | get/set/remove/clear                        | localStorage         | wx.setStorageSync |
| **http**    | get/post/put/delete                         | fetch API            | wx.request        |
| **ui**      | alert/confirm/toast/showLoading/hideLoading | window.alert/confirm | wx.showModal      |
| **logger**  | log/info/warn/error/debug                   | console.\*           | console.\*        |

### 3.2 未通过Adapter的API调用（需改造）

| 文件               | 直接调用                       | 应使用Adapter             |
| ------------------ | ------------------------------ | ------------------------- |
| admin-ai-config.js | `localStorage.getItem/setItem` | `Adapter.storage.get/set` |
| admin-ai-config.js | `fetch()`                      | `Adapter.http.get/post`   |
| admin-api.js       | `localStorage.getItem/setItem` | `Adapter.storage.get/set` |
| admin-auth.js      | `localStorage/SessionStorage`  | `Adapter.storage`         |
| admin-ai-diag.js   | `showToast()`                  | `Adapter.ui.toast()`      |

**结论**: DualAdapter 已完整覆盖双端差异，但现有代码未统一使用，改造时需迁移。

---

## 4. 依赖关系图

```
plugin-base.js ← plugin-loader.js (继承)
plugin-base.js ← ai-plugin.js (继承)
event-hub.js ← plugin-base.js (事件通信)

dual-adapter.js ← ai-plugin.js
dual-adapter.js ← cloud-data.js

shared-data.js ← admin-api.js
shared-data.js ← admin-scoring.js
shared-data.js ← admin-scale-*.js

admin-event-delegation.js → 各模块（事件委托）
```

---

## 5. 技术栈验证结果

| 检查项        | 结果    | 说明                                                |
| ------------- | ------- | --------------------------------------------------- |
| **var 语法**  | ❌ 存在 | admin-ai-config.js 使用 `var`，需改造为 `let/const` |
| **require()** | ✅ 通过 | 仅注释提及，实际代码使用动态 `import()`             |
| **.ts 文件**  | ✅ 通过 | 无TypeScript文件                                    |
| **IE11兼容**  | ✅ 通过 | 无IE11兼容代码                                      |
| **ES6+语法**  | ✅ 支持 | 可使用 `class`, `async/await`, `import()`           |

---

## 6. 改造风险评估

| 风险项                         | 等级 | 应对措施                   |
| ------------------------------ | ---- | -------------------------- |
| shared-data.js 过大（708KB）   | 中   | 拆分数据文件，改为动态加载 |
| 全局函数依赖                   | 高   | 使用事件中心(EventHub)解耦 |
| 内联onclick（94处）            | 中   | 逐步迁移到事件委托         |
| admin-event-delegation.js 过大 | 中   | 拆分到各插件内部           |
| 直接API调用                    | 中   | 统一迁移到DualAdapter      |

---

## 7. 下一步建议

1. **优先完成核心插件拆分**: auth → scale → scoring → npc
2. **统一API调用**: 全部迁移到 DualAdapter
3. **事件解耦**: 使用 EventHub 替代全局函数调用
4. **拆分 shared-data.js**: 将数据与逻辑分离
5. **参考 ai-plugin.js**: 作为插件开发模板
