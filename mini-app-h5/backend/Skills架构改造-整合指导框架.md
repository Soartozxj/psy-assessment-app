# 🏗️ Skills架构改造 - 整合指导框架

**版本**: v3.0.0（整合版）  
**日期**: 2026-05-27  
**状态**: 待实施  
**作者**: 整合自《简化版Skills架构方案》+ 《迁移指南》  
**适用对象**: 开发新手（大白话解释）

---

## 📋 摘要（先看懂这个）

这份文档是**两份文档的整合版**：

- **文档1**（架构方案）：设计很好，但假设你有Webpack，你实际没有 ❌
- **文档2**（迁移指南）：步骤很详细，但架构规范不足 ⚠️

**整合后**：保留两份文档的优点，去掉缺点，给你一份**既规范又可落地**的方案。

---

## 一、改造目标（来自文档1，保留）

| 目标             | 当前状态             | 目标状态       | 衡量标准           |
| ---------------- | -------------------- | -------------- | ------------------ |
| 添加新AI功能耗时 | 3-7天                | <1天           | 从需求到上线时间   |
| 修复代码质量问题 | 1-3天                | <1天           | Bug修复周期        |
| 首屏加载时间     | 2-5s                 | <1s            | Lighthouse评分>90  |
| 代码可维护性     | 低（单文件24k行）    | 高（模块化）   | 新成员上手时间<3天 |
| 未来功能扩展     | 困难（需改核心代码） | 简单（插件化） | 新增功能无需改核心 |

---

## 二、核心架构设计（整合版）

### 2.1 架构图（简化但规范）

```
┌─────────────────────────────────────────────────────────────┐
│                    前端应用 (admin-legacy.html)              │
├─────────────────────────────────────────────────────────────┤
│  📦 插件加载器 (PluginLoader)                              │
│  ├─ 预加载核心插件（auth、ai、scale）                     │
│  └─ 按需加载可选插件（meditation、analytics）              │
├─────────────────────────────────────────────────────────────┤
│  🔌 插件层 (Plugins)                                    │
│  ├─ core/（核心插件 - 预加载）                            │
│  │  ├─ auth-plugin.js (登录)                             │
│  │  ├─ ai-plugin.js (AI调用)                             │
│  │  ├─ scale-plugin.js (量表管理)                         │
│  │  ├─ scoring-plugin.js (计分引擎)                      │
│  │  └─ npc-plugin.js (NPC配置)                           │
│  └─ optional/（可选插件 - 按需加载）                      │
│     ├─ meditation-plugin.js (冥想音乐)                     │
│     └─ analytics-plugin.js (高级分析)                      │
├─────────────────────────────────────────────────────────────┤
│  🛠️ 工具层 (Shared Utils)                               │
│  ├─ plugin-base.js (插件基类 - 所有插件都继承它)          │
│  ├─ dual-adapter.js (双端适配器 - H5/小程序差异屏蔽)     │
│  └─ event-hub.js (事件中心 - 插件间通信)                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 与文档1的关键差异

| 对比项       | 文档1（原方案）        | 整合版（本文档）                 |
| ------------ | ---------------------- | -------------------------------- |
| **构建工具** | 假设Webpack 5          | 无构建工具，`<script>`引入       |
| **插件基类** | Plugin + PluginContext | PluginBase（更简单）             |
| **插件通信** | EventBus               | EventHub（功能相同，命名更易懂） |
| **双端支持** | 无                     | DualAdapter（H5/小程序自适应）   |
| **加载方式** | 动态import()           | 混合模式（预加载+动态import）    |

---

## 三、核心模块详细说明

### 3.1 PluginBase（插件基类）

**大白话解释**：就像一个**插件模板**，所有插件都要"长这样"。

```javascript
/**
 * 插件基类 - 所有插件都要继承这个类
 *
 * 大白话：就像一个插件模板，保证每个插件都有相同的"接口"
 */
class PluginBase {
  constructor(config = {}) {
    this.name = config.name || '未命名插件';
    this.version = config.version || '1.0.0';
    this.isInitialized = false;
  }

  /**
   * 初始化插件（必须实现）
   */
  async init() {
    if (this.isInitialized) return;
    await this.onInit();
    this.isInitialized = true;
  }

  /**
   * 初始化时的具体逻辑（子类要实现这个方法）
   */
  async onInit() {
    // 子类重写这个方法
  }

  /**
   * 执行插件功能（必须实现）
   */
  async execute(params = {}) {
    if (!this.isInitialized) {
      throw new Error(`插件 ${this.name} 未初始化，请先调用 init()`);
    }
    return await this.onExecute(params);
  }

  /**
   * 执行时的具体逻辑（子类要实现这个方法）
   */
  async onExecute(params) {
    // 子类重写这个方法
  }

  /**
   * 销毁插件（清理资源）
   */
  destroy() {
    this.onDestroy();
    this.isInitialized = false;
  }

  /**
   * 销毁时的具体逻辑（子类可选实现）
   */
  onDestroy() {
    // 子类可以重写这个方法
  }
}

// 导出到全局
window.PluginBase = PluginBase;
```

---

### 3.2 PluginLoader（插件加载器）

**大白话解释**：就像一个**智能仓库管理员**，知道每个插件放在哪，需要时用`import()`动态加载。

```javascript
/**
 * 插件加载器 - 负责管理插件的加载和卸载
 *
 * 大白话：就像一个智能仓库管理员
 * - 预加载：提前把常用插件放到货架上
 * - 按需加载：需要时再去仓库拿
 */
class PluginLoader {
  constructor() {
    this.plugins = {}; // 存放所有已加载的插件（货架）
    this.corePlugins = ['auth', 'ai', 'scale']; // 核心插件（需要预加载）
    this.pluginBaseUrl = './plugins/'; // 插件存放的目录
  }

  /**
   * 初始化：预加载核心插件
   */
  async init() {
    console.log('🚀 开始预加载核心插件...');

    for (const pluginName of this.corePlugins) {
      await this.load(pluginName, true); // true表示静默加载（不报错）
    }

    console.log('✅ 核心插件预加载完成');
  }

  /**
   * 加载插件
   * @param {string} pluginName - 插件名称（如 'ai'）
   * @param {boolean} silent - 是否静默加载（失败时不报错）
   */
  async load(pluginName, silent = false) {
    // 如果已经加载过，直接返回
    if (this.plugins[pluginName]) {
      return this.plugins[pluginName];
    }

    try {
      // 动态加载JS文件（就像用<script>标签引入）
      const pluginModule = await import(`${this.pluginBaseUrl}${pluginName}-plugin.js`);
      const PluginClass = pluginModule.default;

      // 创建插件实例并初始化
      const pluginInstance = new PluginClass();
      await pluginInstance.init();

      // 放到货架上
      this.plugins[pluginName] = pluginInstance;

      console.log(`✅ 插件 ${pluginName} 加载成功`);
      return pluginInstance;
    } catch (error) {
      if (!silent) {
        console.error(`❌ 插件 ${pluginName} 加载失败:`, error);
        throw error;
      }
      return null;
    }
  }

  /**
   * 获取已加载的插件
   */
  get(pluginName) {
    return this.plugins[pluginName] || null;
  }

  /**
   * 执行插件
   */
  async execute(pluginName, params = {}) {
    const plugin = this.get(pluginName);
    if (!plugin) {
      throw new Error(`插件 ${pluginName} 未加载，请先调用 load('${pluginName}')`);
    }
    return await plugin.execute(params);
  }
}

// 导出到全局（单例模式）
window.PluginLoader = new PluginLoader();
```

---

### 3.3 DualAdapter（双端适配器）

**大白话解释**：就像一个**翻译官**，把H5和小程序的差异翻译成相同的接口。

> **完整代码已在前面的对话中提供，位置**：`/mini-app-h5/backend/dual-adapter.js`

**核心功能**：

- `Adapter.storage` - 统一localStorage（H5）和wx.setStorageSync（小程序）
- `Adapter.http` - 统一fetch（H5）和wx.request（小程序）
- `Adapter.ui` - 统一alert/confirm（H5）和wx.showModal（小程序）

---

### 3.4 EventHub（事件中心）

**大白话解释**：就像一个**广播站**，插件A做完一件事，可以"广播"出去，其他插件如果关心这件事，就会"听到"并做出反应。

> **完整代码已在前面的对话中提供，位置**：`/mini-app-h5/backend/event-hub.js`

**核心功能**：

- `EventHub.on(eventName, callback)` - 订阅事件（监听）
- `EventHub.emit(eventName, data)` - 触发事件（广播）
- `EventHub.off(eventName, callback)` - 取消订阅

---

## 四、插件接口规范（来自文档1，适配到ES6+）

所有插件必须继承 `PluginBase`，并实现以下方法：

```javascript
/**
 * 插件标准接口（ES6+版本，无TypeScript）
 */
class MyPlugin extends PluginBase {
  constructor() {
    super({
      name: '我的插件',
      version: '1.0.0',
      description: '插件描述'
    });
  }

  /**
   * 初始化逻辑（必须实现）
   */
  async onInit() {
    // TODO: 插件初始化逻辑
    // - 从服务端加载配置
    // - 注册事件监听
    // - 初始化UI
  }

  /**
   * 执行逻辑（必须实现）
   * @param {object} params - 传递给插件的参数
   */
  async onExecute(params = {}) {
    // TODO: 插件核心功能逻辑
    // - 处理用户请求
    // - 调用API
    // - 更新UI
    return { success: true };
  }

  /**
   * 销毁逻辑（可选实现）
   */
  onDestroy() {
    // TODO: 清理资源
    // - 取消事件监听
    // - 清理定时器
  }
}

// 必须使用 export default，这样PluginLoader才能找到
export default MyPlugin;
```

---

## 五、实施计划（整合版：渐进式 + 有明确时间表）

### 5.1 总体时间安排

| 阶段    | 时间      | 任务                     | 交付物          | 风险 |
| ------- | --------- | ------------------------ | --------------- | ---- |
| Phase 1 | 第1-2天   | 搭建基础设施             | 4个核心模块文件 | 低   |
| Phase 2 | 第3-5天   | 改造第一个插件（AI插件） | ai-plugin.js    | 中   |
| Phase 3 | 第6-15天  | 逐步改造其他模块         | 15个插件文件    | 中   |
| Phase 4 | 第16-20天 | 性能优化 + 测试          | 优化后的系统    | 低   |

### 5.2 Phase 1 详细步骤（搭建基础设施）

**目标**：把4个核心模块加入到现有项目

**步骤**：

1. **复制核心模块文件**（已创建好）

   ```bash
   # 确认文件存在
   ls -lh mini-app-h5/backend/plugin-base.js
   ls -lh mini-app-h5/backend/plugin-loader.js
   ls -lh mini-app-h5/backend/dual-adapter.js
   ls -lh mini-app-h5/backend/event-hub.js
   ```

2. **在 `admin-legacy.html` 中引入核心模块**

   ```html
   <!-- 在 <head> 标签内，其他JS文件之前添加 -->
   <script src="plugin-base.js?v=1"></script>
   <script src="dual-adapter.js?v=1"></script>
   <script src="event-hub.js?v=1"></script>
   <script src="plugin-loader.js?v=1"></script>
   ```

3. **测试是否加载成功**
   - 打开浏览器，按F12查看Console
   - 期望输出：`✅ plugin-base.js 加载完成` 等

**详细操作步骤**见《迁移指南》第1步。

### 5.3 Phase 2 详细步骤（改造第一个插件）

**目标**：把 `admin-ai-config.js` 改造为 `ai-plugin.js`

**步骤**：

1. 创建文件 `mini-app-h5/backend/plugins/core/ai-plugin.js`
2. 把 `admin-ai-config.js` 的代码迁移到 `ai-plugin.js`
3. 测试插件是否加载成功

**详细操作步骤**见《迁移指南》第2步。

### 5.4 Phase 3 详细步骤（逐步改造其他模块）

**改造顺序建议**（从简单到复杂）：

| 顺序 | 原文件                | 插件名称            | 难度     | 预计时间 |
| ---- | --------------------- | ------------------- | -------- | -------- |
| 1    | `admin-ai-config.js`  | `ai-plugin.js`      | ⭐⭐     | 2-3天    |
| 2    | `admin-auth.js`       | `auth-plugin.js`    | ⭐⭐     | 1-2天    |
| 3    | `admin-scale-list.js` | `scale-plugin.js`   | ⭐⭐⭐   | 3-4天    |
| 4    | `admin-scoring.js`    | `scoring-plugin.js` | ⭐⭐⭐   | 3-4天    |
| 5    | `admin-npc.js`        | `npc-plugin.js`     | ⭐⭐⭐⭐ | 4-5天    |

**改造模板**（复制粘贴即可）见《迁移指南》第3步。

---

## 六、性能优化方案（来自文档1，适配到无Webpack环境）

### 6.1 首屏加载优化

**目标**：首屏加载时间 < 1秒

**优化策略**：

1. **核心插件预加载**：页面加载时，只加载3个核心插件（auth、ai、scale）
2. **可选插件按需加载**：用户点击时再加载（如冥想音乐、高级分析）
3. **JS延迟加载**：非关键JS使用`defer`属性
   ```html
   <script src="non-critical.js" defer></script>
   ```
4. **图片懒加载**：使用`loading="lazy"`属性
   ```html
   <img src="large-image.jpg" loading="lazy" alt="..." />
   ```

### 6.2 缓存策略

| 资源类型 | 缓存策略            | 缓存时间     | 实现方式          |
| -------- | ------------------- | ------------ | ----------------- |
| HTML     | NetworkFirst        | 每次网络优先 | 无缓存            |
| JS/CSS   | CacheFirst + 版本号 | 1年          | `?v=1` 或内容hash |
| 图片     | CacheFirst          | 30天         | HTTP缓存头        |
| API响应  | NetworkFirst        | 5分钟        | 内存缓存          |

**实现方式**（无Service Worker，使用版本号）：

```html
<!-- 使用 ?v= 版本号，文件更新时修改版本号 -->
<script src="plugin-base.js?v=2"></script>
<script src="ai-plugin.js?v=1.0.1"></script>
```

### 6.3 代码分割策略（无Webpack，使用动态import）

**目标**：只加载当前页面需要的代码

**实现方式**：

```javascript
// 用户点击"冥想音乐"时，才加载冥想插件
async function onMeditationClick() {
  await PluginLoader.load('meditation', false); // 按需加载
  await PluginLoader.execute('meditation', { action: 'play' });
}
```

---

## 七、测试方案（整合版）

### 7.1 单元测试（可选，新手可以跳过）

**测试框架**：Jest（需要Node.js环境）

```javascript
// ai-plugin.test.js
describe('AI插件测试', () => {
  test('测试连接', async () => {
    const plugin = new AIPlugin();
    await plugin.init();

    const isConnected = await plugin.testConnection();
    expect(isConnected).toBe(true);
  });

  test('AI调用', async () => {
    const result = await PluginLoader.execute('ai', {
      prompt: '测试'
    });

    expect(result).not.toBeNull();
  });
});
```

### 7.2 集成测试（必须）

**测试插件之间的协作**：

```javascript
// integration.test.js
describe('插件协作测试', () => {
  test('登录后加载AI配置', async () => {
    // 1. 模拟用户登录
    await PluginLoader.execute('auth', {
      action: 'login',
      username: 'admin',
      password: '123456'
    });

    // 2. 监听事件
    let aiConfigLoaded = false;
    EventHub.on('ai-config-loaded', () => {
      aiConfigLoaded = true;
    });

    // 3. 等待事件触发
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. 验证结果
    expect(aiConfigLoaded).toBe(true);
  });
});
```

### 7.3 手动测试（最实用）

**在浏览器Console中手动测试**：

```javascript
// 测试1：查看所有已加载的插件
PluginLoader.getPluginsInfo();

// 测试2：测试AI调用
PluginLoader.execute('ai', {
  prompt: '生成一个焦虑量表'
}).then((result) => {
  console.log('结果:', result);
});

// 测试3：测试事件通信
EventHub.on('test-event', (data) => {
  console.log('收到事件:', data);
});
EventHub.emit('test-event', { msg: 'Hello!' });

// 测试4：测试双端适配
Adapter.storage.set('test', 'Hello World');
const value = Adapter.storage.get('test');
console.log('存储测试:', value);
```

---

## 八、风险与应对

| 风险                     | 影响 | 应对措施                     | 责任方     |
| ------------------------ | ---- | ---------------------------- | ---------- |
| 改造过程中现有功能不可用 | 高   | 渐进式改造，改造一个启用一个 | 开发者     |
| 插件间依赖复杂           | 中   | 使用EventHub解耦             | 开发者     |
| 性能优化效果不佳         | 中   | 使用Lighthouse持续监控       | 开发者     |
| 团队成员不熟悉新架构     | 中   | 提供培训+代码模板            | 技术负责人 |
| 双端适配出现问题         | 高   | 在H5和小程序两端都进行测试   | 测试人员   |

---

## 九、常见问题解答（FAQ）

### Q1：改造过程中，现有功能还能用吗？

**A**：能！采用**渐进式改造**，改造一个插件，就启用一个插件，没改造的模块继续保持原样。

**示例**：

```html
<script>
  document.addEventListener('DOMContentLoaded', async function() {
    // 只加载已改造完成的插件
    await PluginLoader.load('ai', true);  // AI插件已改造，加载
    // await PluginLoader.load('scale', true);  // 量表插件未改造，暂不加载

    // 未改造的模块继续保持原样
    // <script src="admin-scale-list.js?v=3"></script>  <!-- 保持原样 -->
  });
</script>
```

### Q2：如果改造失败，能回退吗？

**A**：能！因为每个插件是独立的文件，改造失败只需要：

1. 把插件文件的 `export default` 注释掉
2. 恢复原来的 `<script>` 引入方式

### Q3：改造后的性能会提升吗？

**A**：会！主要有3个提升：

1. **首屏加载更快**：核心插件预加载，可选插件按需加载
2. **内存占用更少**：不用的插件可以卸载（`PluginLoader.unload('xxx')`）
3. **代码复用更高**：插件可以在H5和小程序两端复用

### Q4：新手能完成改造吗？

**A**：能！只要按照这个指南的**3步走**策略：

1. 第1步：搭建基础设施（复制粘贴即可）
2. 第2步：改造第一个插件（有详细示例）
3. 第3步：逐步改造其他模块（有模板可用）

**预计总时间**：2-3周（每天2-3小时）

---

## 十、附录

### 10.1 文件结构（改造后）

```
mini-app-h5/backend/
├── plugin-base.js           ✅ 插件基类
├── plugin-loader.js         ✅ 插件加载器
├── dual-adapter.js         ✅ 双端适配器
├── event-hub.js           ✅ 事件中心
│
├── plugins/                 ✅ 插件目录
│   ├── core/               ✅ 核心插件（预加载）
│   │   ├── auth-plugin.js      ✅ 登录插件
│   │   ├── ai-plugin.js        ✅ AI插件
│   │   ├── scale-plugin.js     ✅ 量表插件
│   │   ├── scoring-plugin.js   ✅ 计分插件
│   │   └── npc-plugin.js      ✅ NPC插件
│   │
│   └── optional/          ✅ 可选插件（按需加载）
│       ├── meditation-plugin.js   🔲 冥想插件（未改造）
│       └── analytics-plugin.js   🔲 分析插件（未改造）
│
├── admin-legacy.html        ✅ 主页面（已改造）
└── ... (其他文件)
```

### 10.2 技术栈

- **语言**: ES6+ (不使用TypeScript)
- **构建工具**: 无（使用`<script>`标签引入 + 动态`import()`）
- **代码规范**: ESLint + Prettier（可选）
- **测试框架**: Jest + Playwright（可选）
- **浏览器支持**: Chrome 60+, Firefox 55+, Safari 11+ (无需IE11)

### 10.3 参考文档

- [Plugin Base 设计文档](./plugin-base.js)
- [Plugin Loader 设计文档](./plugin-loader.js)
- [Dual Adapter 设计文档](./dual-adapter.js)
- [Event Hub 设计文档](./event-hub.js)
- [插件开发模板](./迁移指南.md#改造模板)

---

## 🎯 总结

这份**整合指导框架**融合了：

1. **文档1的优点**：
   - 明确的目标和衡量标准
   - 规范的架构设计思想
   - 完整的性能优化方案

2. **文档2的优点**：
   - 渐进式迁移策略（风险低）
   - 双端适配方案（DualAdapter）
   - 新手友好的大白话解释

3. **整合后的改进**：
   - **去除了文档1的不实假设**（Webpack 5 → 无构建工具）
   - **补充了文档2的不足**（架构规范、性能优化）
   - **提供了完整的实施路径**（4个Phase，共20天）

**下一步**：按照这份整合框架，开始Phase 1（搭建基础设施）。

---

**文档结束**

_本整合框架融合了《简化版Skills架构方案》的规范设计和《迁移指南》的落地路径，提供一份既规范又可落地的改造方案。_
