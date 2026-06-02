# ❓ 常见问题解答 (FAQ)

## 📋 概述

本文档汇总了**插件系统使用过程中常见的问题和解决方案**，包括：

- 插件加载问题
- 插件使用问题
- 性能优化问题
- 故障排除指南

---

## 🔧 插件加载问题

### Q1: 插件加载失败，控制台显示 "XXX is not defined"

**问题描述**：

- 在控制台中看到错误：`ScoringPlugin is not defined` 或 `NpcPlugin is not defined`
- 插件功能无法使用

**可能原因**：

1. 插件文件未正确引入
2. 插件文件路径错误
3. 插件文件加载顺序错误
4. 插件文件内容有语法错误

**解决方案**：

**步骤1: 检查插件文件是否引入**

在 `admin-legacy.html` 中检查是否正确引入了插件文件：

```html
<!-- ✅ 正确引入方式 -->
<script src="plugins/core/plugin-base.js"></script>
<script src="plugins/core/scoring-plugin.js"></script>
<script src="plugins/core/npc-plugin.js"></script>
```

**步骤2: 检查插件文件路径**

确认插件文件确实存在于指定路径：

```
/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/plugins/core/plugin-base.js
/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/plugins/core/scoring-plugin.js
/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/plugins/core/npc-plugin.js
```

**步骤3: 检查插件加载顺序**

插件加载顺序必须正确：

```
1. plugin-base.js (插件基类，必须先加载)
2. scoring-plugin.js (计分插件，依赖 PluginBase)
3. npc-plugin.js (NPC插件，依赖 PluginBase)
```

**步骤4: 检查插件文件语法**

打开浏览器开发者工具（F12），切换到 **Console** 标签页，查看是否有语法错误：

```
❌ 示例错误：
Uncaught SyntaxError: Unexpected token '}'
    at scoring-plugin.js:123
```

如果有语法错误，请修复后重新加载页面。

**步骤5: 清除缓存重试**

```bash
# Chrome: 清除缓存
Ctrl + Shift + Delete (Windows)
Cmd + Shift + Delete (Mac)
```

---

### Q2: 插件初始化失败，显示 "初始化失败"

**问题描述**：

- 调用 `plugin.init()` 返回 `{ success: false, error: "..." }`
- 插件功能无法使用

**可能原因**：

1. 依赖项未加载
2. 配置数据格式错误
3. 网络请求失败

**解决方案**：

**步骤1: 检查依赖项**

在插件初始化代码中，检查是否正确加载了依赖项：

```javascript
onInit() {
    this.log('初始化插件...');

    // 检查依赖项
    if (typeof UIUtils === 'undefined') {
        throw new Error('UIUtils 未定义，请先引入 ui-utils.js');
    }

    if (typeof ApiUtils === 'undefined') {
        throw new Error('ApiUtils 未定义，请先引入 api-utils.js');
    }

    // 初始化数据
    this.data = {};

    this.log('插件初始化完成');
    return { success: true };
}
```

**步骤2: 检查配置数据格式**

在 `admin-scales.js` 中检查量表数据格式是否正确：

```javascript
// ✅ 正确的数据格式
window.SCALES_CONFIG = [
  {
    id: 'SCL90',
    name: '症状自评量表',
    description: '心理健康症状自评量表',
    questionCount: 90,
    dimensions: [
      /* ... */
    ],
    metrics: [
      /* ... */
    ]
  }
  // ...
];
```

**步骤3: 检查网络请求**

打开浏览器开发者工具（F12），切换到 **Network** 标签页，查看是否有失败的网络请求：

```
❌ 示例错误：
GET https://api.psych-assess.com/scales 404 (Not Found)
```

如果有网络请求失败，请检查：

1. API 地址是否正确
2. 网络连接是否正常
3. 服务器是否正常运行

---

### Q3: 插件执行 action 时显示 "未知操作"

**问题描述**：

- 调用 `plugin.execute('some-action', params)` 时返回错误：`未知操作: some-action`
- 插件功能无法使用

**可能原因**：

1. action 名称拼写错误
2. action 未在 `onExecute` 方法中定义
3. 插件版本过旧，不支持该 action

**解决方案**：

**步骤1: 检查 action 名称拼写**

确认 action 名称拼写正确：

```javascript
// ❌ 错误的 action 名称
scoringPlugin.execute('add-dimention', {
  /* ... */
}); // 拼写错误

// ✅ 正确的 action 名称
scoringPlugin.execute('add-dimension', {
  /* ... */
});
```

**步骤2: 检查 action 是否已定义**

在插件文件中检查 `onExecute` 方法是否定义了该 action：

```javascript
onExecute(action, params = {}) {
    this.log(`执行操作: ${action}`, 'info');

    try {
        switch (action) {
            case 'list':
                return this.handleList(params);

            case 'add-dimension':   // ← 检查这里是否有定义
                return this.handleAddDimension(params);

            // ... 其他 action

            default:
                throw new Error(`未知操作: ${action}`);
        }
    } catch (error) {
        this.log(`操作失败: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}
```

**步骤3: 更新插件版本**

如果 action 是新版本插件才支持的，请更新插件到最新版本：

```bash
# 从版本控制系统更新插件
git pull origin main

# 或者手动下载最新版本插件文件
```

---

## 🎮 插件使用问题

### Q1: 计分规则管理插件 - 添加维度失败

**问题描述**：

- 在计分规则管理页面，点击 "添加维度" 按钮后无反应
- 或者显示错误：`缺少参数: name`

**可能原因**：

1. 表单验证失败
2. 网络请求失败
3. 服务器保存失败

**解决方案**：

**步骤1: 检查表单验证**

在点击 "添加维度" 按钮前，确认已填写所有必填字段：

| 字段名称 | 是否必填 | 格式要求                       |
| -------- | -------- | ------------------------------ |
| 维度名称 | ✅ 必填  | 不能为空                       |
| 维度描述 | ❌ 可选  | 无特殊要求                     |
| 题目编号 | ✅ 必填  | 用英文逗号分隔，如 "1,4,12,27" |

**步骤2: 检查网络请求**

打开浏览器开发者工具（F12），切换到 **Network** 标签页，查看是否有失败的网络请求：

```
❌ 示例错误：
POST https://api.psych-assess.com/scales/SCL90/dimensions 500 (Internal Server Error)
```

如果有网络请求失败，请检查：

1. API 地址是否正确
2. 网络连接是否正常
3. 服务器是否正常运行

**步骤3: 检查服务器日志**

查看服务器日志，确认是否有错误：

```bash
# 查看服务器日志
tail -f /var/log/psych-assess/api.log

# 示例错误日志
[2026-06-01 22:30:15] ERROR: 保存维度失败 - 数据库连接超时
```

根据服务器日志中的错误信息，采取相应的解决措施。

---

### Q2: 计分规则管理插件 - 模拟测试无结果

**问题描述**：

- 在计分规则管理页面，点击 "模拟测试" 按钮后，没有显示测试结果
- 或者显示错误：`计分失败 - 维度配置错误`

**可能原因**：

1. 未配置维度或指标
2. 维度配置的题目编号有误
3. 模拟数据格式错误

**解决方案**：

**步骤1: 检查维度配置**

在计分规则管理页面，确认已配置至少一个维度：

```
✅ 正确的维度配置：
维度名称: 躯体化
维度描述: 包括1、4、12、27、40、42、48、49、52、53、56、58共12题
题目编号: 1,4,12,27,40,42,48,49,52,53,56,58
```

**步骤2: 检查题目编号格式**

确认题目编号格式正确：

```
✅ 正确的格式：
1,4,12,27,40,42,48,49,52,53,56,58

❌ 错误的格式：
1、4、12、27、40、42、48、49、52、53、56、58  (中文逗号)
1 4 12 27 40 42 48 49 52 53 56 58          (空格分隔)
1-12,27,40-42,48-49,52-53,56,58           (范围表示法，不支持)
```

**步骤3: 检查模拟数据格式**

确认模拟数据格式正确：

```
✅ 正确的模拟数据：
题目1: 2
题目2: 1
题目3: 3
...

❌ 错误的模拟数据：
题目1: 5  (分数范围应该是 0-4)
题目2: -1 (分数不能为负数)
题目3: a  (分数必须是数字)
```

---

### Q3: NPC配置管理插件 - 上传图片失败

**问题描述**：

- 在NPC配置管理页面，上传咨询师立绘或背景图时失败
- 显示错误：`上传失败 - 图片大小超过限制`

**可能原因**：

1. 图片文件过大
2. 图片格式不支持
3. 网络上传速度慢，超时

**解决方案**：

**步骤1: 压缩图片**

使用图片压缩工具（如 TinyPNG）压缩图片：

```
✅ 推荐的图片大小：
- 咨询师立绘: < 500KB
- 背景图: < 1MB

✅ 推荐的图片尺寸：
- 咨询师立绘: 400x800 像素
- 背景图: 750x1334 像素 (9:16)
```

**步骤2: 转换图片格式**

确认图片格式支持：

```
✅ 支持的格式：
- JPG/JPEG
- PNG
- WebP (推荐，压缩率更高)

❌ 不支持的格式：
- BMP
- TIFF
- PSD
```

**步骤3: 检查网络连接**

如果网络上传速度慢，可以：

1. 切换到更快的网络（如光纤宽带）
2. 使用图片压缩工具减小文件大小
3. 分片上传大文件（需要插件支持）

---

### Q4: NPC配置管理插件 - 云端同步失败

**问题描述**：

- 在NPC配置管理页面，点击 "云端同步" 按钮后失败
- 显示错误：`云端同步失败 - 网络超时`

**可能原因**：

1. 网络连接不稳定
2. 云端服务器故障
3. 数据冲突（本地数据和云端数据不一致）

**解决方案**：

**步骤1: 检查网络连接**

```bash
# 测试网络连接
ping api.psych-assess.com

# 示例输出（正常）：
PING api.psych-assess.com (192.168.1.100): 56 data bytes
64 bytes from 192.168.1.100: icmp_seq=0 ttl=64 time=12.345 ms

# 示例输出（异常）：
ping: cannot resolve api.psych-assess.com: Unknown host
```

**步骤2: 重试云端同步**

等待几分钟后，重新点击 "云端同步" 按钮。

**步骤3: 解决数据冲突**

如果提示数据冲突，可以选择：

1. **保留本地数据** - 用本地数据覆盖云端数据
2. **保留云端数据** - 用云端数据覆盖本地数据
3. **手动合并** - 手动选择要保留的数据

---

## ⚡ 性能优化问题

### Q1: 插件加载慢，首屏加载时间超过 3 秒

**问题描述**：

- 打开后台管理页面时，加载时间超过 3 秒
- 用户体验差

**可能原因**：

1. 插件文件过大，网络传输时间长
2. 插件数量过多，一次性加载所有插件
3. 服务器响应慢

**解决方案**：

**步骤1: 压缩插件文件**

使用 Terser 压缩插件文件：

```bash
# 安装 Terser
npm install --save-dev terser

# 压缩插件文件
npx terser plugins/core/scoring-plugin.js -o plugins/minified/scoring-plugin.js -c drop_console,drop_debugger -m

# 压缩结果
Before: 30.45KB
After:  12.18KB (压缩率: 60.00%)
```

**步骤2: 按需加载插件**

修改插件加载逻辑，只在需要时才加载插件：

```javascript
// ❌ 不好的做法（一次性加载所有插件）
import 'plugins/core/plugin-base.js';
import 'plugins/core/scoring-plugin.js';
import 'plugins/core/npc-plugin.js';

// ✅ 好的做法（按需加载插件）
import 'plugins/core/plugin-base.js';

document.getElementById('scoring-btn').addEventListener('click', async () => {
  const { ScoringPlugin } = await import('plugins/core/scoring-plugin.js');
  const plugin = new ScoringPlugin();
  plugin.init();
});
```

**步骤3: 使用 CDN 加速**

将插件文件上传到 CDN，加快网络传输速度：

```html
<!-- ❌ 不好的做法（从自己服务器加载） -->
<script src="https://www.psych-assess.com/plugins/core/scoring-plugin.js"></script>

<!-- ✅ 好的做法（从 CDN 加载） -->
<script src="https://cdn.psych-assess.com/plugins/core/scoring-plugin.js"></script>
```

---

### Q2: 列表渲染卡顿，滚动不流畅

**问题描述**：

- 在计分规则管理页面，量表列表渲染卡顿
- 滚动列表时掉帧，用户体验差

**可能原因**：

1. 列表数据量过大（100+ 项）
2. 一次性渲染所有数据
3. 没有使用虚拟滚动或分页加载

**解决方案**：

**步骤1: 使用虚拟滚动**

只渲染可见区域的数据，提升渲染性能：

```javascript
// 使用 VirtualList 实现虚拟滚动
class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.items = [];
    this.itemHeight = options.itemHeight || 50;
    this.visibleCount = Math.ceil(container.clientHeight / this.itemHeight) + 2;
    // ...
  }

  // ...
}

// 使用 VirtualList
const container = document.getElementById('scale-list');
const virtualList = new VirtualList(container, {
  itemHeight: 50
});

virtualList.setItems(scaleList);
```

**步骤2: 使用分页加载**

每次只加载一页数据（如 20 条），减少一次性渲染的数量：

```javascript
// 使用 PagedList 实现分页加载
class PagedList {
  constructor(container, options = {}) {
    this.container = container;
    this.pageSize = options.pageSize || 20;
    this.currentPage = 1;
    this.hasMore = true;
    // ...
  }

  // ...
}

// 使用 PagedList
const container = document.getElementById('scale-list');
const pagedList = new PagedList(container, {
  pageSize: 20
});

// 滚动到底部时，自动加载下一页
container.addEventListener('scroll', () => {
  if (container.scrollHeight - container.scrollTop - container.clientHeight < 50) {
    pagedList.loadNextPage();
  }
});
```

---

### Q3: 内存占用高，浏览器卡顿

**问题描述**：

- 使用插件一段时间后，浏览器内存占用超过 500MB
- 浏览器响应变慢，甚至卡死

**可能原因**：

1. 插件持有大量数据未释放
2. 事件监听器未正确移除，导致内存泄漏
3. 插件销毁时未清理资源

**解决方案**：

**步骤1: 及时释放不需要的数据**

```javascript
class MyPlugin extends PluginBase {
  constructor() {
    super('my-plugin', '1.0.0');
    this.cachedData = null; // 缓存数据
  }

  /**
   * 获取数据（按需加载）
   */
  async getData() {
    if (!this.cachedData) {
      this.cachedData = await this.loadData();
    }
    return this.cachedData;
  }

  /**
   * 释放数据
   */
  releaseData() {
    this.cachedData = null;
  }

  /**
   * 销毁插件
   */
  onDestroy() {
    this.log('销毁插件，释放内存...');
    this.releaseData(); // 释放数据
    this.log('插件已销毁');
    return { success: true };
  }
}
```

**步骤2: 正确移除事件监听器**

```javascript
class MyPlugin extends PluginBase {
  constructor() {
    super('my-plugin', '1.0.0');
    this.eventListeners = []; // 保存事件监听器引用
  }

  /**
   * 添加事件监听器（保存引用）
   */
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  /**
   * 移除所有事件监听器
   */
  removeAllEventListeners() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }

  /**
   * 销毁插件
   */
  onDestroy() {
    this.log('销毁插件，移除事件监听器...');
    this.removeAllEventListeners(); // 移除所有事件监听器
    this.log('插件已销毁');
    return { success: true };
  }
}
```

---

## 🔍 故障排除指南

### 步骤1: 收集信息

当遇到问题时，首先收集以下信息：

1. **错误信息** - 控制台中的错误信息
2. **网络请求** - Network 标签页中的请求信息
3. **性能数据** - Performance 标签页中的性能数据
4. **插件日志** - 插件自己记录的日志

### 步骤2: 分析问题

根据收集到的信息，分析问题的可能原因：

1. **JavaScript 错误** - 查看 Console 标签页
2. **网络错误** - 查看 Network 标签页
3. **性能瓶颈** - 查看 Performance 标签页
4. **插件逻辑错误** - 查看插件日志

### 步骤3: 解决问题

根据问题的可能原因，采取相应的解决措施：

1. **修复 JavaScript 错误** - 修改代码，修复语法错误或逻辑错误
2. **修复网络错误** - 检查网络连接，修复 API 地址或服务器问题
3. **优化性能瓶颈** - 使用虚拟滚动、分页加载等技术优化性能
4. **修复插件逻辑错误** - 修改插件代码，修复逻辑错误

### 步骤4: 验证解决方案

修复问题后，验证解决方案是否有效：

1. **重新测试** - 重新执行之前失败的操作
2. **查看日志** - 查看控制台和插件日志，确认没有错误
3. **性能测试** - 查看 Performance 标签页，确认性能有提升

---

## 📞 技术支持

如果无法解决问题，请联系技术支持：

- **技术支持邮箱**: support@psych-assess.com
- **技术支持电话**: 400-123-4567
- **在线文档**: https://docs.psych-assess.com

**联系技术支持时，请提供以下信息**：

1. 错误截图
2. 控制台错误信息
3. 网络请求信息
4. 插件日志
5. 操作步骤（如何重现问题）

---

## 📝 更新日志

| 版本 | 日期       | 更新内容                                                       |
| ---- | ---------- | -------------------------------------------------------------- |
| v1.0 | 2026-06-01 | 初始版本，包含插件加载、使用、性能优化、故障排除等常见问题解答 |

---

** hope this helps!**
