# Skill 开发指南

**文档版本**: v1.0  
**创建日期**: 2026-06-03  
**目标读者**: 前端开发者、插件开发者、系统架构师

---

## 一、Skill 架构介绍

### 1.1 什么是 Skill？

Skill（技能）是星蓝心镜系统中的**可复用功能模块**，每个Skill都是一个独立的插件，具有以下特点：

- **独立性**：每个Skill是一个独立的JavaScript类
- **可插拔**：可以动态加载和卸载
- **标准化**：所有Skill都继承 `PluginBase` 基类
- **事件驱动**：通过 `EventHub` 进行通信

### 1.2 Skill 架构优势

| 传统方式               | Skill 架构              |
| ---------------------- | ----------------------- |
| 代码耦合度高           | 模块完全独立            |
| 难以维护和测试         | 易于维护和测试          |
| 功能扩展需要修改主文件 | 新增功能只需添加新Skill |
| 代码重复               | 代码高度复用            |

### 1.3 Skill 生命周期

```
创建实例 → 初始化(onInit) → 执行(onExecute) → 销毁(onDestroy)
```

---

## 二、创建第一个 Skill 插件

### 2.1 创建插件文件

在 `mini-app-h5/backend/plugins/core/` 目录下创建新文件，例如 `my-first-plugin.js`：

```javascript
/**
 * my-first-plugin.js - 我的第一个 Skill 插件
 *
 * @version 1.0.0
 * @date 2026-06-03
 */

class MyFirstPlugin extends PluginBase {
  constructor() {
    super({
      name: '我的第一个插件',
      version: '1.0.0',
      description: '这是一个示例插件，展示 Skill 的基本结构'
    });

    // 插件私有状态
    this.myData = null;
    this.isInitialized = false;
  }

  /**
   * 初始化逻辑 - 插件加载时执行
   */
  async onInit() {
    console.log('🚀 我的第一个插件开始初始化...');

    try {
      // 1. 加载配置
      this.myData = this.loadConfig();

      // 2. 注册事件监听
      this._registerEvents();

      // 3. 初始化UI（如果需要）
      this._initUI();

      this.isInitialized = true;
      console.log('✅ 我的第一个插件初始化完成');

      // 触发事件
      window.EventHub.emit('my-first-plugin-initialized', {
        timestamp: Date.now()
      });
    } catch (error) {
      Adapter.logger.error('我的第一个插件初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行逻辑 - 插件标准接口
   *
   * @param {object} params - 执行参数
   * @param {string} params.action - 执行动作：load, save, process
   */
  async onExecute(params = {}) {
    console.log('🎯 我的第一个插件开始执行...', params);

    try {
      switch (params.action) {
        case 'load':
          return this.loadData();

        case 'save':
          if (!params.data) {
            throw new Error('缺少必要参数：data');
          }
          return this.saveData(params.data);

        case 'process':
          if (!params.input) {
            throw new Error('缺少必要参数：input');
          }
          return this.processData(params.input);

        default:
          throw new Error(`未知动作: ${params.action}`);
      }
    } catch (error) {
      Adapter.logger.error('我的第一个插件执行失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 销毁逻辑 - 插件卸载时执行
   */
  async onDestroy() {
    console.log('🛑 我的第一个插件开始销毁...');

    // 1. 移除事件监听
    this._unregisterEvents();

    // 2. 清理资源
    this.myData = null;
    this.isInitialized = false;

    // 3. 触发事件
    window.EventHub.emit('my-first-plugin-destroyed', {
      timestamp: Date.now()
    });

    console.log('✅ 我的第一个插件销毁完成');
  }

  // ====================================================
  // 私有方法
  // ====================================================

  /**
   * 加载配置
   */
  loadConfig() {
    try {
      const data = Adapter.storage.get('my_first_plugin_config');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('[MyFirstPlugin] 加载配置失败:', e);
      return {};
    }
  }

  /**
   * 保存数据
   */
  saveData(data) {
    try {
      Adapter.storage.set('my_first_plugin_data', JSON.stringify(data));
      this.myData = data;
      return { success: true };
    } catch (err) {
      Adapter.logger.error('保存数据失败:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 处理数据
   */
  processData(input) {
    // 示例：简单的数据处理
    const output = {
      original: input,
      processed: input.toUpperCase(),
      timestamp: Date.now()
    };
    return { success: true, data: output };
  }

  /**
   * 注册事件监听
   */
  _registerEvents() {
    // 示例：监听其他插件的事件
    window.EventHub.on('some-other-plugin-event', (data) => {
      console.log('收到事件:', data);
    });
  }

  /**
   * 移除事件监听
   */
  _unregisterEvents() {
    // 清理事件监听
    window.EventHub.off('some-other-plugin-event');
  }

  /**
   * 初始化UI
   */
  _initUI() {
    // 示例：创建插件自己的UI容器
    const container = document.createElement('div');
    container.id = 'my-first-plugin-container';
    container.style.display = 'none';
    document.body.appendChild(container);
  }
}

// 注册插件
window.PluginLoader.register('my-first-plugin', MyFirstPlugin);
console.log('🚀 我的第一个插件已注册');
```

### 2.2 使用插件

在HTML页面中使用刚创建的插件：

```html
<!DOCTYPE html>
<html>
  <head>
    <title>测试我的第一个插件</title>
  </head>
  <body>
    <button onclick="useMyPlugin()">测试插件</button>

    <script>
      // 动态加载插件
      async function loadMyPlugin() {
        await PluginLoader.load('my-first-plugin');
        console.log('✅ 插件加载完成');
      }

      // 使用插件
      async function useMyPlugin() {
        const plugin = PluginLoader.get('my-first-plugin');
        if (!plugin) {
          alert('插件未加载');
          return;
        }

        // 调用插件的 onExecute 方法
        const result = await plugin.onExecute({ action: 'process', input: 'hello world' });
        console.log('插件执行结果:', result);
        alert('处理结果: ' + JSON.stringify(result));
      }

      // 页面加载时自动加载插件
      window.addEventListener('DOMContentLoaded', loadMyPlugin);
    </script>
  </body>
</html>
```

---

## 三、Skill 生命周期管理

### 3.1 生命周期方法详解

| 方法                | 调用时机     | 必须实现 | 典型操作                          |
| ------------------- | ------------ | -------- | --------------------------------- |
| `constructor()`     | 创建实例时   | ✅ 是    | 初始化私有变量、调用 `super()`    |
| `onInit()`          | 插件初始化时 | ✅ 是    | 加载配置、注册事件、初始化UI      |
| `onExecute(params)` | 外部调用时   | ✅ 是    | 根据 `params.action` 执行不同逻辑 |
| `onDestroy()`       | 插件销毁时   | ❌ 否    | 清理资源、移除事件监听            |

### 3.2 初始化最佳实践

```javascript
async onInit() {
  console.log('🚀 [' + this.name + '] 开始初始化...');

  try {
    // 1. 加载配置（从存储中）
    this.config = this._loadConfig();

    // 2. 校验依赖（其他插件是否加载）
    if (!PluginLoader.get('required-plugin')) {
      throw new Error('依赖插件 required-plugin 未加载');
    }

    // 3. 注册事件监听
    this._registerEvents();

    // 4. 初始化UI
    this._initUI();

    // 5. 触发初始化完成事件
    window.EventHub.emit(this.name + '-initialized', {
      timestamp: Date.now()
    });

    console.log('✅ [' + this.name + '] 初始化完成');
  } catch (error) {
    Adapter.logger.error('[' + this.name + '] 初始化失败:', error);
    throw error; // 重新抛出，让调用者知道初始化失败
  }
}
```

### 3.3 执行方法最佳实践

```javascript
async onExecute(params = {}) {
  // 1. 参数校验
  if (!params.action) {
    throw new Error('缺少必要参数：action');
  }

  // 2. 根据 action 执行不同逻辑
  switch (params.action) {
    case 'load':
      return this._loadData();

    case 'save':
      if (!params.data) {
        throw new Error('缺少必要参数：data');
      }
      return this._saveData(params.data);

    case 'delete':
      if (!params.id) {
        throw new Error('缺少必要参数：id');
      }
      return this._deleteData(params.id);

    default:
      throw new Error(`未知动作: ${params.action}`);
  }
}
```

---

## 四、Skill 事件系统集成

### 4.1 EventHub 基本用法

```javascript
// 发布事件
window.EventHub.emit('my-plugin-event', {
  data: 'some data',
  timestamp: Date.now()
});

// 订阅事件（接收一次）
window.EventHub.once('other-plugin-event', (data) => {
  console.log('收到事件（仅一次）:', data);
});

// 订阅事件（持续接收）
window.EventHub.on('other-plugin-event', (data) => {
  console.log('收到事件（持续）:', data);
});

// 取消订阅
window.EventHub.off('other-plugin-event');
```

### 4.2 插件间通信示例

**插件A** 发布事件：

```javascript
// plugin-a.js
async onExecute(params = {}) {
  if (params.action === 'do-something') {
    // 发布事件，通知其他插件
    window.EventHub.emit('plugin-a-did-something', {
      result: 'some result',
      timestamp: Date.now()
    });
    return { success: true };
  }
}
```

**插件B** 订阅事件：

```javascript
// plugin-b.js
async onInit() {
  // 订阅插件A的事件
  window.EventHub.on('plugin-a-did-something', (data) => {
    console.log('插件B收到插件A的消息:', data);
    // 执行自己的逻辑
    this._handlePluginAEvent(data);
  });
}
```

---

## 五、Skill 最佳实践

### 5.1 命名规范

| 类型       | 规范              | 示例                                     |
| ---------- | ----------------- | ---------------------------------------- |
| 插件文件名 | 小写+连字符       | `scale-plugin.js`, `ai-config-plugin.js` |
| 插件类名   | 大驼峰+Plugin后缀 | `ScalePlugin`, `AIConfigPlugin`          |
| 注册名称   | 小写+连字符       | `scale`, `ai-config`                     |
| 事件名称   | 小写+连字符       | `scale-initialized`, `ai-config-saved`   |

### 5.2 错误处理

```javascript
async onExecute(params = {}) {
  try {
    // 1. 参数校验
    if (!params.action) {
      throw new Error('缺少必要参数：action');
    }

    // 2. 权限检查（如果需要）
    if (params.requiresAuth && !this._checkAuth()) {
      throw new Error('权限不足');
    }

    // 3. 执行核心逻辑
    const result = await this._doSomething(params);

    // 4. 返回标准结果格式
    return {
      success: true,
      data: result,
      timestamp: Date.now()
    };
  } catch (error) {
    // 5. 错误日志
    Adapter.logger.error('[' + this.name + '] 执行失败:', error);

    // 6. 返回标准错误格式
    return {
      success: false,
      error: error.message,
      timestamp: Date.now()
    };
  }
}
```

### 5.3 性能优化

```javascript
class OptimizedPlugin extends PluginBase {
  constructor() {
    super({ name: '优化示例插件', version: '1.0.0' });

    // 使用缓存避免重复计算
    this._cache = new Map();

    // 使用防抖避免频繁触发
    this._debouncedSave = this._debounce(this._save.bind(this), 500);
  }

  /**
   * 使用缓存优化读取
   */
  getData(key) {
    if (this._cache.has(key)) {
      console.log('从缓存读取:', key);
      return this._cache.get(key);
    }

    const data = Adapter.storage.get(key);
    this._cache.set(key, data);
    return data;
  }

  /**
   * 使用防抖优化写入
   */
  saveData(key, value) {
    this._cache.set(key, value);
    this._debouncedSave(key, value);
  }

  /**
   * 防抖函数
   */
  _debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}
```

---

## 六、调试技巧

### 6.1 日志规范

```javascript
async onInit() {
  console.log('🚀 [' + this.name + '] 开始初始化...');

  try {
    const config = this._loadConfig();
    console.log('📋 [' + this.name + '] 配置已加载:', config);

    this._registerEvents();
    console.log('👂 [' + this.name + '] 事件已注册');

    console.log('✅ [' + this.name + '] 初始化完成');
  } catch (error) {
    console.error('❌ [' + this.name + '] 初始化失败:', error);
    throw error;
  }
}
```

### 6.2 常用调试命令

```javascript
// 在浏览器控制台中执行

// 1. 查看所有已注册的插件
PluginLoader.list();

// 2. 获取指定插件
const plugin = PluginLoader.get('scale');

// 3. 手动调用插件方法
plugin.onExecute({ action: 'load' });

// 4. 查看事件监听
EventHub._events;

// 5. 模拟事件触发
EventHub.emit('test-event', { data: 'test' });
```

---

## 七、常见问题解答

### Q1: 插件加载失败怎么办？

**检查清单**：

1. 插件文件路径是否正确？
2. 插件类名是否正确？
3. 是否已调用 `PluginLoader.register()`？
4. 浏览器控制台是否有错误信息？

### Q2: 插件间如何共享数据？

**推荐方式**：

1. 使用 `EventHub` 进行事件通信
2. 使用 `Adapter.storage` 进行数据存储
3. 使用 `window.SharedData` 进行内存共享

### Q3: 插件初始化顺序如何控制？

**解决方案**：

1. 在 `onInit()` 中检查依赖插件是否已加载
2. 使用事件监听：`EventHub.on('dependency-plugin-initialized', () => { /* 初始化自己 */ })`

---

## 八、总结

通过本指南，您已经学会：

- ✅ 创建第一个 Skill 插件
- ✅ 理解 Skill 生命周期
- ✅ 使用 EventHub 进行事件通信
- ✅ 遵循 Skill 最佳实践
- ✅ 调试和优化 Skill 插件

**下一步**：

- 阅读 `skill-api-reference.md` 了解完整的API参考
- 阅读 `skill-testing-guide.md` 学习如何为Skill编写测试

---

**文档结束**

**后续更新计划**：

- 添加更多示例代码
- 添加性能优化技巧
- 添加安全防护最佳实践
