# 📘 Skills架构改造 - 快速参考规范

**版本**: v2.0.0  
**日期**: 2026-05-28  
**状态**: 强制执行  
**适用对象**: 所有参与改造的开发人员  
**依赖规则**: `Skills架构改造-架构核心规范.md`, `Skills架构改造-代码结构规范.md`, `Skills架构改造-迁移标准规范.md`, `Skills架构改造-异常处理与日志规范.md`, `Skills架构改造-安全规范.md`, `Skills架构改造-改造禁止事项规范.md`, `Skills架构改造-检查清单规范.md`

---

## 📋 附录：快速参考

### A. 插件模板（复制粘贴用）

```javascript
/**
 * {插件名称} - {插件描述}
 *
 * @version 1.0.0
 * @date 2026-05-27
 */

class XXXPlugin extends PluginBase {
  constructor() {
    super({
      name: '{插件显示名称}',
      version: '1.0.0',
      description: '{插件描述}'
    });

    // 插件私有属性
    this._data = null;
  }

  async onInit() {
    // 初始化逻辑
  }

  async onExecute(params = {}) {
    // 执行逻辑
    return { success: true };
  }

  onDestroy() {
    // 清理逻辑
  }
}

export default XXXPlugin;
```

### B. 事件命名规范

| 事件类型         | 命名格式        | 示例                                                |
| ---------------- | --------------- | --------------------------------------------------- |
| **插件生命周期** | `plugin-{动作}` | `plugin-init`, `plugin-loaded`, `plugin-destroyed`  |
| **用户操作**     | `user-{动作}`   | `user-login`, `user-logout`, `user-click`           |
| **数据变化**     | `data-{动作}`   | `data-changed`, `data-loaded`, `data-saved`         |
| **UI交互**       | `ui-{动作}`     | `ui-modal-open`, `ui-toast-show`, `ui-button-click` |
| **API调用**      | `api-{动作}`    | `api-request`, `api-success`, `api-error`           |

### C. 常见错误和解决方案

| 错误                                  | 原因               | 解决方案                                                 |
| ------------------------------------- | ------------------ | -------------------------------------------------------- |
| `PluginLoader.get('xxx')` 返回 `null` | 插件未加载         | 先调用 `await PluginLoader.load('xxx')`                  |
| `EventHub.on()` 回调函数不执行        | 事件名称拼写错误   | 检查事件名称是否一致                                     |
| 插件加载后功能不正常                  | 没有调用 `init()`  | 确保在 `load()` 之后插件会自动调用 `init()`              |
| 内存泄漏                              | 事件监听器没有清理 | 使用 `registerEventListener()` 或在 `onDestroy()` 中清理 |

---

## 📋 规则详解

### 插件模板详解

#### 为什么需要插件模板？

**原因**：

- 确保所有插件结构一致
- 避免遗漏必要的方法
- 提供最佳实践示例

#### 模板各部分说明

1. **文件头注释**：
   - 使用 JSDoc 格式
   - 包含插件名称、描述、版本、日期

2. **构造函数**：
   - 必须调用 `super()` 并传入插件元数据
   - 初始化插件私有属性（加下划线前缀）

3. **`onInit()` 方法**：
   - 插件初始化逻辑
   - 加载配置、注册事件监听、初始化UI

4. **`onExecute()` 方法**：
   - 插件主要业务逻辑
   - 接收参数，执行操作，返回结果

5. **`onDestroy()` 方法**：
   - 插件销毁逻辑（可选实现）
   - 清理资源，避免内存泄漏

6. **导出语句**：
   - 必须使用 `export default`

### 事件命名规范详解

#### 为什么需要事件命名规范？

**原因**：

- 统一的事件命名便于维护
- 便于理解事件用途
- 避免事件名冲突

#### 事件类型说明

1. **插件生命周期事件**：
   - `plugin-init`: 插件初始化时触发
   - `plugin-loaded`: 插件加载完成时触发
   - `plugin-destroyed`: 插件销毁时触发

2. **用户操作事件**：
   - `user-login`: 用户登录时触发
   - `user-logout`: 用户登出时触发
   - `user-click`: 用户点击时触发

3. **数据变化事件**：
   - `data-changed`: 数据变化时触发
   - `data-loaded`: 数据加载完成时触发
   - `data-saved`: 数据保存完成时触发

4. **UI交互事件**：
   - `ui-modal-open`: 模态框打开时触发
   - `ui-toast-show`: Toast显示时触发
   - `ui-button-click`: 按钮点击时触发

5. **API调用事件**：
   - `api-request`: API请求发送时触发
   - `api-success`: API请求成功时触发
   - `api-error`: API请求失败时触发

### 常见错误和解决方案详解

#### 1. `PluginLoader.get('xxx')` 返回 `null`

**原因**：

- 插件未加载
- 插件名拼写错误

**解决方案**：

```javascript
// 先加载插件
await PluginLoader.load('xxx');

// 再获取插件
const plugin = PluginLoader.get('xxx');
```

#### 2. `EventHub.on()` 回调函数不执行

**原因**：

- 事件名称拼写错误
- 事件未触发

**解决方案**：

```javascript
// 确保事件名称一致
EventHub.on('plugin-loaded', callback); // 正确
EventHub.on('pluginLoaded', callback); // 错误（命名不规范）

// 确保事件已触发
EventHub.emit('plugin-loaded', data);
```

#### 3. 插件加载后功能不正常

**原因**：

- 没有调用 `init()` 方法
- 初始化逻辑有错误

**解决方案**：

```javascript
// PluginLoader.load() 会自动调用 init()
await PluginLoader.load('xxx');

// 确保 onInit() 方法正确实现
async onInit() {
  // 初始化逻辑
}
```

#### 4. 内存泄漏

**原因**：

- 事件监听器没有清理
- 定时器没有清除

**解决方案**：

```javascript
// 使用 registerEventListener() 自动清理
this.registerEventListener('event-name', callback);

// 手动清理事件监听器
onDestroy() {
  EventHub.off('event-name', callback);
}

// 清除定时器
onDestroy() {
  clearInterval(this._intervalId);
}
```

---

## 🔗 相关规则

- **架构核心规范**: 参见 `Skills架构改造-架构核心规范.md`
- **代码结构规范**: 参见 `Skills架构改造-代码结构规范.md`
- **迁移标准规范**: 参见 `Skills架构改造-迁移标准规范.md`
- **异常处理规范**: 参见 `Skills架构改造-异常处理规范.md`
- **日志记录规范**: 参见 `Skills架构改造-日志记录规范.md`
- **安全规范**: 参见 `Skills架构改造-安全规范.md`
- **改造禁止事项规范**: 参见 `Skills架构改造-改造禁止事项规范.md`
- **检查清单规范**: 参见 `Skills架构改造-检查清单规范.md`

---

## 📖 快速查阅指南

### 按场景查阅

| 场景             | 查阅内容           |
| ---------------- | ------------------ |
| 创建新插件       | 插件模板           |
| 定义事件名       | 事件命名规范       |
| 调试插件加载问题 | 常见错误和解决方案 |
| 调试事件通信问题 | 常见错误和解决方案 |
| 调试内存泄漏问题 | 常见错误和解决方案 |

### 按问题查阅

| 问题           | 查阅内容              |
| -------------- | --------------------- |
| 插件加载失败   | 常见错误和解决方案 #1 |
| 事件回调不执行 | 常见错误和解决方案 #2 |
| 插件功能不正常 | 常见错误和解决方案 #3 |
| 内存泄漏       | 常见错误和解决方案 #4 |

---

**文档结束**

_本规范提供了 Skills 架构改造的快速参考，便于开发人员快速查阅和使用。_
