# 故障排除指南

> 排查和解决插件系统常见问题的系统化方法。

---

## 目录

1. [问题诊断流程](#问题诊断流程)
2. [常见错误及解决方案](#常见错误及解决方案)
3. [调试技巧](#调试技巧)
4. [日志收集](#日志收集)
5. [回滚方案](#回滚方案)

---

## 问题诊断流程

### 第一步：确认问题范围

```
问题范围多维度检查清单：
├── 是所有插件都有问题，还是某个插件？
├── 是所有浏览器都有问题，还是某个浏览器？
├── 是刚出现的问题，还是一直有问题？
└── 是本地有问题，还是线上有问题？
```

### 第二步：检查浏览器控制台

打开浏览器开发者工具（F12），查看：

1. **Console 标签页**：查看错误和警告
2. **Network 标签页**：查看文件是否加载成功
3. **Sources 标签页**：查看代码是否被正确加载

### 第三步：使用诊断脚本

在控制台中运行：

```javascript
// 检查插件系统状态
function diagnosePluginSystem() {
  const result = {
    PluginBase: typeof PluginBase !== 'undefined',
    ScoringPlugin: typeof ScoringPlugin !== 'undefined',
    NpcPlugin: typeof NpcPlugin !== 'undefined',
    scoringPluginInstance: null,
    npcPluginInstance: null,
    errors: []
  };

  // 检查计分插件实例
  if (window.scoringPlugin) {
    result.scoringPluginInstance = {
      isInitialized: window.scoringPlugin.isInitialized,
      scalesCount: window.scoringPlugin._scales?.length || 0
    };
  }

  // 检查 NPC 插件实例
  if (window.npcPlugin) {
    result.npcPluginInstance = {
      isInitialized: window.npcPlugin.isInitialized,
      configLoaded: window.npcPlugin._config !== null
    };
  }

  console.table(result);
  return result;
}

diagnosePluginSystem();
```

---

## 常见错误及解决方案

### 错误1：`PluginBase is not defined`

**原因**：`plugin-base.js` 没有加载，或加载顺序不对。

**解决方案**：

1. 检查 `plugin-base.js` 是否在最前面引入：

   ```html
   <!-- ✅ 正确 -->
   <script src="plugins/core/plugin-base.js"></script>
   <script src="plugins/core/scoring-plugin.js"></script>
   ```

2. 检查文件路径是否正确：

   ```javascript
   // 在控制台运行
   console.log(PluginBase);
   // 如果输出 undefined，说明文件没加载
   ```

3. 检查网络请求：
   - 打开 F12 -> Network 标签
   - 刷新页面
   - 查看 `plugin-base.js` 的状态码（应该是 200）

---

### 错误2：`ScoringPlugin is not defined`

**原因**：`scoring-plugin.js` 没有加载，或依赖于 `PluginBase` 但 `PluginBase` 没加载完。

**解决方案**：

1. 确保引入顺序正确（见错误1）
2. 在控制台检查：
   ```javascript
   console.log(ScoringPlugin);
   // 如果输出是一个类，说明加载成功
   // 如果输出 undefined，说明文件没加载
   ```

---

### 错误3：`plugin.init() throws error`

**原因**：初始化过程中发生错误（可能是数据加载失败、API 请求失败等）。

**解决方案**：

1. 查看具体的错误信息：

   ```javascript
   try {
     await plugin.init();
   } catch (error) {
     console.error('初始化失败:', error);
     console.error('错误堆栈:', error.stack);
   }
   ```

2. 检查网络请求（如果是从云端加载数据）
3. 检查 `scales-data.json` 是否存在且格式正确

---

### 错误4：数据不显示 / 页面空白

**原因**：多种可能，需要逐步排查。

**解决方案**：

1. **检查数据是否加载成功**：

   ```javascript
   const result = plugin.execute({ action: 'list' });
   console.log('查询结果:', result);
   ```

2. **检查 DOM 元素是否存在**：

   ```javascript
   const el = document.getElementById('my-element');
   console.log('元素:', el);
   // 如果输出 null，说明元素不存在
   ```

3. **检查渲染逻辑是否正确**：
   ```javascript
   // 手动测试渲染
   const testData = [{ id: 'test', name: '测试' }];
   const html = testData.map((item) => `<div>${item.name}</div>`).join('');
   console.log('渲染HTML:', html);
   ```

---

### 错误5：修改数据后保存失败

**原因**：保存逻辑有问题，或存储后端不可用。

**解决方案**：

1. 检查保存逻辑：

   ```javascript
   const result = plugin.execute({ action: 'save' });
   console.log('保存结果:', result);
   ```

2. 如果是保存到 `localStorage`：

   ```javascript
   // 检查 localStorage 是否可用
   try {
     localStorage.setItem('test', 'test');
     localStorage.removeItem('test');
     console.log('✅ localStorage 可用');
   } catch (e) {
     console.error('❌ localStorage 不可用:', e);
   }
   ```

3. 如果是保存到云端：
   - 检查网络连接
   - 检查 API 地址是否正确
   - 检查 API 返回的状态码

---

### 错误6：图片上传/压缩失败

**原因**：图片格式不支持，或图片过大。

**解决方案**：

1. 检查图片格式：

   ```javascript
   // 在 <input type="file"> 的 onchange 事件中
   const file = event.target.files[0];
   console.log('文件类型:', file.type);
   // 应该是 'image/jpeg', 'image/png' 等
   ```

2. 检查图片大小：

   ```javascript
   console.log('文件大小:', file.size, 'bytes');
   // 如果超过 5MB，可能需要压缩
   ```

3. 使用插件提供的压缩功能：
   ```javascript
   const result = plugin.execute({
     action: 'compressImage',
     dataUrl: dataUrl,
     maxWidth: 800,
     quality: 0.8
   });
   ```

---

### 错误7：事件不触发 / 事件委托失效

**原因**：事件委托的 `data-action` 属性没写对，或事件委托没注册。

**解决方案**：

1. 检查 HTML 是否正确使用了 `data-action`：

   ```html
   <!-- ✅ 正确 -->
   <button data-action="save">保存</button>

   <!-- ❌ 错误：少了 data- 前缀 -->
   <button action="save">保存</button>
   ```

2. 检查事件委托是否注册：

   ```javascript
   // 在插件初始化后，检查事件委托
   console.log('事件委托已注册');
   // 可以临时在事件委托处理器中加入 console.log
   ```

3. 如果是动态生成的元素，确保它们在事件委托注册**之后**才插入 DOM。

---

## 调试技巧

### 技巧1：使用 `console.table()` 美化输出

```javascript
// 不美观
console.log(scales);

// 美观
console.table(scales, ['id', 'name', 'questionCount']);
```

### 技巧2：使用断点调试

在代码中加入 `debugger;` 语句，页面加载后会自动在这里暂停：

```javascript
onExecute(params) {
  debugger; // 执行到这里会自动暂停
  switch (params.action) {
    // ...
  }
}
```

### 技巧3：使用 `performance.now()` 测量性能

```javascript
const start = performance.now();
// 执行某些操作
const end = performance.now();
console.log(`操作耗时: ${(end - start).toFixed(2)}ms`);
```

### 技巧4：临时禁用缓存

在开发过程中，禁用浏览器缓存可以避免加载旧版本文件：

1. 打开 F12
2. 打开 Settings（齿轮图标）
3. 勾选 **Disable cache (while DevTools is open)**

### 技巧5：使用 Source Map（如果有的话）

如果插件代码被压缩了，加载 Source Map 可以看到原始代码：

1. 确保压缩时生成了 `.map` 文件
2. 在 Sources 标签中可以看到原始代码结构

---

## 日志收集

### 自动收集日志

在插件中加入日志收集逻辑：

```javascript
// 在 plugin-base.js 中加入
class PluginBase {
  constructor(options) {
    // ...
    this._logs = [];
  }

  _log(level, message, data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level, // 'info', 'warn', 'error'
      message,
      data
    };
    this._logs.push(logEntry);

    // 同时输出到控制台
    console[level](`[${this.name}] ${message}`, data);
  }

  getLogs() {
    return this._logs;
  }

  exportLogs() {
    const logs = this.getLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plugin-logs-${Date.now()}.json`;
    a.click();
  }
}
```

### 手动收集日志

在控制台中运行：

```javascript
// 收集控制台日志
const logs = [];
const originalConsoleLog = console.log;
console.log = function (...args) {
  logs.push({ type: 'log', args });
  originalConsoleLog.apply(console, args);
};

// ... 执行操作 ...

// 导出日志
const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'console-logs.json';
a.click();
```

---

## 回滚方案

### 如果插件更新后出现问题

1. **保留旧版本**：在更新前，备份旧版本文件
2. **使用 Git 回滚**：

   ```bash
   # 查看提交历史
   git log --oneline

   # 回滚到上一个版本
   git revert HEAD

   # 或者回滚到指定提交
   git reset --hard <commit-hash>
   ```

3. **使用 CDN 回滚**（如果用了 CDN）：
   - 修改 HTML 中的版本号
   - 清里 CDN 缓存

### 如果数据损坏

1. **从备份恢复**：

   ```javascript
   // 假设备份存在 localStorage 中
   const backup = localStorage.getItem('scoring_backup');
   if (backup) {
     localStorage.setItem('scoring', backup);
     console.log('✅ 已从备份恢复');
   }
   ```

2. **从云端恢复**（如果有云端备份）：
   ```javascript
   const response = await fetch('/api/backup/latest');
   const backup = await response.json();
   // 恢复数据...
   ```

---

## 获取帮助

如果以上方法都无法解决问题，请按以下步骤获取帮助：

1. **收集信息**：
   - 浏览器版本
   - 操作系统
   - 插件版本
   - 错误截图
   - 控制台错误日志

2. **查找已知问题**：
   - 查看 [GitHub Issues](链接)
   - 查看 [常见问题解答](./faq.md)

3. **提交问题**：
   - 在 GitHub Issues 中提交问题
   - 附上所有收集的信息
   - 描述复现步骤

---

## 相关文档

- [快速入门指南](./quick-start.md)
- [API 参考手册](./api-reference.md)
- [开发者指南](./developer-guide.md)
- [性能优化指南](./performance-optimization.md)
