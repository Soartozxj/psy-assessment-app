# 🏗️ 简化版 Skills 架构 - 完整架构方案文档

**版本**: v2.0.0  
**日期**: 2026-05-24  
**状态**: 待实施  
**目标**: 降低维护成本，支持快速功能扩展，首屏加载<1s

---

## 一、架构概述

### 1.1 核心目标

| 目标             | 当前状态             | 目标状态       | 衡量标准           |
| ---------------- | -------------------- | -------------- | ------------------ |
| 添加新AI功能耗时 | 3-7天                | <1天           | 从需求到上线时间   |
| 修复代码质量问题 | 1-3天                | <1天           | Bug修复周期        |
| 首屏加载时间     | 2-5s                 | <1s            | Lighthouse评分>90  |
| 代码可维护性     | 低（单文件24k行）    | 高（模块化）   | 新成员上手时间<3天 |
| 未来功能扩展     | 困难（需改核心代码） | 简单（插件化） | 新增功能无需改核心 |

### 1.2 架构原则

1. **简单优先**: 使用ES6+基础语法，避免复杂设计模式
2. **插件化**: 所有功能封装为独立Plugin，支持动态加载
3. **性能优先**: 代码分割+动态导入，首屏<1s
4. **渐进升级**: 4-8周分阶段实施，不影响现有功能
5. **团队适配**: 提供详细文档+代码模板，降低认知负担

---

## 二、核心模块划分

### 2.1 模块架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    前端应用 (admin-legacy.html)              │
├─────────────────────────────────────────────────────────────┤
│  PluginManager (插件管理器)                                  │
│  ├─ 注册/卸载插件                                           │
│  ├─ 加载/执行插件                                           │
│  └─ 插件生命周期管理                                         │
├─────────────────────────────────────────────────────────────┤
│  核心插件层                                                  │
│  ├─ AiCallPlugin (AI调用)                                   │
│  ├─ JsonImporterPlugin (JSON导入)                           │
│  ├─ ScoringPlugin (计分引擎)                                │
│  ├─ MeditationPlugin (冥想音乐-未来)                         │
│  └─ DiaryPlugin (情绪日记-未来)                             │
├─────────────────────────────────────────────────────────────┤
│  基础设施层                                                  │
│  ├─ PluginContext (插件上下文)                               │
│  ├─ AIHelper (AI调用助手)                                   │
│  ├─ EventBus (事件总线)                                     │
│  └─ Storage (数据存储)                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块详细说明

#### 2.2.1 PluginManager (插件管理器)

**职责**: 负责插件的注册、加载、卸载和生命周期管理

**核心方法**:

```javascript
class PluginManager {
  // 注册插件
  register(plugin) {}

  // 卸载插件
  unregister(pluginName) {}

  // 加载插件
  async load(pluginName) {}

  // 执行插件
  async execute(pluginName, context) {}

  // 获取插件列表
  getPlugins() {}
}
```

**存储位置**: `mini-app-h5/backend/plugin-manager.js`

#### 2.2.2 PluginContext (插件上下文)

**职责**: 为插件提供统一的API接口，封装AI调用、数据读写等操作

**核心方法**:

```javascript
class PluginContext {
  // AI调用
  async callAI(prompt, options) {}

  // 数据读取
  async getData(key) {}

  // 数据写入
  async setData(key, value) {}

  // 事件触发
  emit(event, data) {}

  // 事件监听
  on(event, callback) {}
}
```

**存储位置**: `mini-app-h5/backend/plugin-context.js`

#### 2.2.3 AIHelper (AI调用助手)

**职责**: 封装DashScope/DeepSeek/Ollama调用逻辑，提供统一接口

**核心方法**:

```javascript
class AIHelper {
  // 调用AI模型
  async callModel(provider, prompt, options) {}

  // 获取可用模型列表
  getAvailableModels() {}

  // 测试连接
  async testConnection(provider) {}
}
```

**支持提供商**:

- DashScope (阿里云)
- DeepSeek (深度求索)
- Ollama (本地模型)

**存储位置**: `mini-app-h5/backend/ai-helper.js`

#### 2.2.4 EventBus (事件总线)

**职责**: 实现插件间事件通信，解耦插件依赖

**核心方法**:

```javascript
class EventBus {
  // 订阅事件
  on(event, callback) {}

  // 取消订阅
  off(event, callback) {}

  // 触发事件
  emit(event, data) {}

  // 一次性订阅
  once(event, callback) {}
}
```

**存储位置**: `mini-app-h5/backend/event-bus.js`

---

## 三、插件系统设计

### 3.1 插件接口规范

所有插件必须实现以下接口:

```javascript
// 插件标准接口
class Plugin {
  // 插件名称 (必须)
  static get name() {
    return 'plugin-name';
  }

  // 插件版本 (必须)
  static get version() {
    return '1.0.0';
  }

  // 插件描述 (可选)
  static get description() {
    return '插件描述';
  }

  // 插件依赖 (可选)
  static get dependencies() {
    return [];
  }

  // 初始化方法 (必须)
  async init(context) {}

  // 执行方法 (必须)
  async execute(params) {}

  // 销毁方法 (可选)
  async destroy() {}
}
```

### 3.2 核心插件实现

#### 3.2.1 AiCallPlugin (AI调用插件)

**功能**: 封装现有AI调用逻辑，提供统一接口

**文件**: `mini-app-h5/backend/plugins/ai-call-plugin.js`

**示例代码**:

```javascript
class AiCallPlugin extends Plugin {
  static get name() {
    return 'ai-call';
  }
  static get version() {
    return '1.0.0';
  }

  async init(context) {
    this.context = context;
    this.aiHelper = context.getAIHelper();
  }

  async execute(params) {
    const { prompt, provider = 'dashscope' } = params;
    return await this.aiHelper.callModel(provider, prompt);
  }
}
```

#### 3.2.2 JsonImporterPlugin (JSON导入插件)

**功能**: 迁移现有JSON导入功能

**文件**: `mini-app-h5/backend/plugins/json-importer-plugin.js`

#### 3.2.3 ScoringPlugin (计分引擎插件)

**功能**: 迁移现有计分引擎逻辑

**文件**: `mini-app-h5/backend/plugins/scoring-plugin.js`

#### 3.2.4 MeditationPlugin (冥想音乐插件 - 未来)

**功能**: 未来冥想音乐生成功能

**文件**: `mini-app-h5/backend/plugins/meditation-plugin.js`

#### 3.2.5 DiaryPlugin (情绪日记插件 - 未来)

**功能**: 未来情绪日记功能

**文件**: `mini-app-h5/backend/plugins/diary-plugin.js`

### 3.3 插件注册与使用

**注册插件**:

```javascript
// 在 admin-legacy.html 中注册插件
import { PluginManager } from './plugin-manager.js';

const pluginManager = new PluginManager();

// 注册AI调用插件
pluginManager.register(AiCallPlugin);

// 注册JSON导入插件
pluginManager.register(JsonImporterPlugin);
```

**使用插件**:

```javascript
// 执行AI调用插件
const result = await pluginManager.execute('ai-call', {
  prompt: '生成心理评估量表',
  provider: 'dashscope'
});
```

---

## 四、数据流转逻辑

### 4.1 数据流转图

```
用户输入 → PluginManager → PluginContext → AIHelper → AI模型
                ↓              ↓             ↓
            事件触发 → EventBus → 其他插件 → 数据更新
                ↓              ↓
             UI更新 ← 数据绑定 ← Storage ← 数据持久化
```

### 4.2 关键数据流

#### 4.2.1 AI调用流程

1. 用户触发AI调用 (如点击"生成量表"按钮)
2. PluginManager找到对应插件 (AiCallPlugin)
3. 插件通过PluginContext调用AIHelper
4. AIHelper发送请求到AI模型 (DashScope/DeepSeek/Ollama)
5. 接收AI响应并返回给插件
6. 插件处理响应并更新UI

#### 4.2.2 事件通信流程

1. 插件A完成操作后通过EventBus触发事件
2. EventBus通知所有订阅该事件的插件
3. 插件B接收到事件后执行相应操作
4. 插件B可通过PluginContext更新共享数据

#### 4.2.3 数据持久化流程

1. 插件通过PluginContext调用setData()
2. PluginContext将数据存储到Storage (localStorage/indexedDB)
3. 其他插件可通过getData()读取共享数据
4. 页面刷新后自动从Storage恢复数据

---

## 五、性能优化方案

### 5.1 代码分割策略

**Webpack配置**:

```javascript
// webpack.config.js
module.exports = {
  entry: {
    main: './admin-legacy.html',
    plugins: ['./plugins/ai-call-plugin.js', './plugins/json-importer-plugin.js', './plugins/scoring-plugin.js']
  },
  output: {
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].chunk.js'
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  }
};
```

### 5.2 动态导入实现

**示例**:

```javascript
// 按需加载AI调用插件
async function loadAiCallPlugin() {
  const { AiCallPlugin } = await import('./plugins/ai-call-plugin.js');
  pluginManager.register(AiCallPlugin);
}
```

### 5.3 缓存策略

| 资源类型 | 缓存策略                 | 缓存时间     |
| -------- | ------------------------ | ------------ |
| HTML     | NetworkFirst             | 每次网络优先 |
| JS/CSS   | CacheFirst + ContentHash | 1年          |
| 图片     | CacheFirst               | 30天         |
| API响应  | NetworkFirst             | 5分钟        |

### 5.4 首屏加载优化

1. **关键CSS内联**: 将首屏关键CSS内联到HTML
2. **JS延迟加载**: 非关键JS使用defer/async
3. **图片懒加载**: 使用loading="lazy"属性
4. **预连接**: 对AI API域名使用`<link rel="preconnect">`
5. **Service Worker**: 缓存核心资源，支持离线访问

---

## 六、实施计划

### 6.1 分阶段实施

| 阶段    | 时间    | 任务         | 交付物                                           |
| ------- | ------- | ------------ | ------------------------------------------------ |
| Phase 1 | 第1-2周 | 基础设施搭建 | PluginManager, PluginContext, AIHelper, EventBus |
| Phase 2 | 第3-4周 | 核心插件迁移 | AiCallPlugin, JsonImporterPlugin, ScoringPlugin  |
| Phase 3 | 第5-6周 | 性能优化     | 代码分割, 动态导入, 缓存策略                     |
| Phase 4 | 第7-8周 | 测试与上线   | 单元测试, 集成测试, 上线部署                     |

### 6.2 风险与应对

| 风险                | 影响 | 应对措施               |
| ------------------- | ---- | ---------------------- |
| 团队不熟悉ES6+语法  | 中   | 提供培训+代码模板      |
| 插件间依赖复杂      | 低   | 使用EventBus解耦       |
| 性能优化效果不佳    | 中   | 使用Lighthouse持续监控 |
| 现有功能 regression | 高   | 完善测试覆盖           |

---

## 七、接口定义

### 7.1 PluginManager API

```javascript
interface PluginManager {
  register(plugin: Plugin): void;
  unregister(pluginName: string): void;
  load(pluginName: string): Promise<Plugin>;
  execute(pluginName: string, params: Object): Promise<any>;
  getPlugins(): Plugin[];
}
```

### 7.2 PluginContext API

```javascript
interface PluginContext {
  callAI(prompt: string, options?: Object): Promise<string>;
  getData(key: string): any;
  setData(key: string, value: any): void;
  emit(event: string, data?: any): void;
  on(event: string, callback: Function): void;
}
```

### 7.3 AIHelper API

```javascript
interface AIHelper {
  callModel(provider: string, prompt: string, options?: Object): Promise<string>;
  getAvailableModels(): string[];
  testConnection(provider: string): Promise<boolean>;
}
```

### 7.4 EventBus API

```javascript
interface EventBus {
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
  emit(event: string, data?: any): void;
  once(event: string, callback: Function): void;
}
```

---

## 八、附录

### 8.1 技术栈

- **语言**: ES6+ (不使用TypeScript)
- **构建工具**: Webpack 5
- **代码规范**: ESLint + Prettier
- **测试框架**: Jest + Playwright
- **浏览器支持**: Chrome 60+, Firefox 55+, Safari 11+ (无需IE11)

### 8.2 文件结构

```
mini-app-h5/backend/
├── plugin-manager.js           # 插件管理器
├── plugin-context.js           # 插件上下文
├── ai-helper.js                # AI调用助手
├── event-bus.js                # 事件总线
├── plugins/                    # 插件目录
│   ├── ai-call-plugin.js       # AI调用插件
│   ├── json-importer-plugin.js # JSON导入插件
│   ├── scoring-plugin.js       # 计分引擎插件
│   ├── meditation-plugin.js    # 冥想音乐插件(未来)
│   └── diary-plugin.js         # 情绪日记插件(未来)
├── admin-legacy.html           # 主页面(改造后)
└── webpack.config.js           # 构建配置
```

### 8.3 参考文档

- [Plugin Manager 设计文档](./plugin-manager-design.md)
- [插件开发指南](./plugin-development-guide.md)
- [性能优化指南](./performance-optimization-guide.md)
- [测试方案](./testing-plan.md)

---

**文档结束**

_本架构方案文档为简化版Skills架构的完整设计文档，包含所有核心模块划分、数据流转逻辑及接口定义，可直接用于开发计划制定与实施。_
