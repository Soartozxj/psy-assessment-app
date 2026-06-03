# 📘 Skills架构改造 - 架构核心规范

**版本**: v2.0.0  
**日期**: 2026-05-28  
**状态**: 强制执行  
**适用对象**: 所有参与改造的开发人员  
**依赖规则**: 无

---

## 🚨 核心原则（不可违反）

### 1.1 架构红线（绝对禁止）

❌ **以下行为严格禁止**：

1. **禁止绕过PluginBase直接创建插件**
   - 所有插件**必须**继承 `PluginBase` 类
   - 禁止直接使用 `class XXXPlugin {}` 而不继承

2. **禁止使用全局变量污染命名空间**
   - 禁止在 `window` 上直接挂载变量
   - 所有全局对象必须通过架构提供的单例（PluginLoader、EventHub、Adapter）

3. **禁止插件间直接依赖**
   - 插件A**不能**直接 `import` 或引用插件B
   - 插件间通信**必须**通过 `EventHub` 解耦

4. **禁止修改核心基类**
   - `plugin-base.js`、`plugin-loader.js`、`dual-adapter.js`、`event-hub.js` 属于核心基础设施
   - 禁止修改这些文件的接口和核心逻辑

5. **禁止在H5端使用小程序专有API**
   - 禁止直接使用 `wx.*` API
   - 必须通过 `Adapter` 适配器访问

### 1.2 技术栈约束

✅ **强制技术标准**：

| 技术项         | 规范要求                            | 违规示例                             |
| -------------- | ----------------------------------- | ------------------------------------ |
| **语言版本**   | ES6+ (ES2017+)                      | ❌ `var` 声明 (必须用 `const`/`let`) |
| **模块系统**   | 动态 `import()`                     | ❌ `require()` (CommonJS)            |
| **构建工具**   | 无 (浏览器原生支持)                 | ❌ Webpack/Rollup/Vite               |
| **类型系统**   | JSDoc注释 (无TypeScript)            | ❌ `.ts` 文件                        |
| **浏览器支持** | Chrome 60+, Firefox 55+, Safari 11+ | ❌ IE11兼容代码                      |

---

## 📋 规则说明

### 架构红线详解

#### 1. 禁止绕过PluginBase直接创建插件

**原因**：PluginBase 提供了插件生命周期管理、事件监听自动清理、日志等基础设施。绕过它会导致插件行为不一致。

**正确做法**：

```javascript
// ✅ 正确
class AIPlugin extends PluginBase {
  constructor() {
    super({ name: 'AI插件', version: '1.0.0' });
  }
}

// ❌ 错误
class AIPlugin {
  constructor() { ... }
}
```

#### 2. 禁止使用全局变量污染命名空间

**原因**：全局变量会导致命名冲突、难以追踪的依赖关系、测试困难。

**正确做法**：

```javascript
// ❌ 错误
let apiKey = '';
function testConnection() { ... }
window.testConnection = testConnection;

// ✅ 正确
class AIPlugin extends PluginBase {
  constructor() {
    super({...});
    this._apiKey = '';
  }

  _testConnection() { ... }
}
```

#### 3. 禁止插件间直接依赖

**原因**：直接依赖会导致插件耦合度高，难以独立测试和替换。

**正确做法**：

```javascript
// ❌ 错误（插件A直接调用插件B）
class PluginA extends PluginBase {
  async onExecute() {
    const pluginB = PluginLoader.get('b');
    return pluginB.doSomething();
  }
}

// ✅ 正确（通过EventHub通信）
class PluginA extends PluginBase {
  async onExecute() {
    EventHub.emit('plugin-b-do-something', { data: ... });
  }
}

class PluginB extends PluginBase {
  async onInit() {
    this.registerEventListener('plugin-b-do-something', (data) => {
      this._doSomething(data);
    });
  }
}
```

#### 4. 禁止修改核心基类

**原因**：核心基类是所有插件的基础，修改会导致所有插件失效。

**正确做法**：

- 如果需要扩展功能，在插件内部实现
- 如果需要修改核心基类，先提出PR，经过团队讨论和测试

#### 5. 禁止在H5端使用小程序专有API

**原因**：H5端需要运行在浏览器环境，不能使用小程序专有API。

**正确做法**：

```javascript
// ❌ 错误
wx.request({ ... });

// ✅ 正确
Adapter.request({ ... }); // Adapter会根据环境自动选择wx.request或fetch
```

### 技术栈约束详解

#### 1. 语言版本：ES6+ (ES2017+)

**必须使用**：

- `const`/`let` 声明变量
- 箭头函数
- 模板字符串
- 解构赋值
- `async`/`await`
- `class` 语法

**禁止使用**：

- `var` 声明
- `function` 关键字（优先使用箭头函数）
- 回调地狱（优先使用 Promise/async/await）

#### 2. 模块系统：动态 `import()`

**原因**：浏览器原生支持动态 `import()`，无需构建工具。

**正确做法**：

```javascript
// ✅ 正确
const module = await import('./module.js');

// ❌ 错误
const module = require('./module.js');
```

#### 3. 构建工具：无 (浏览器原生支持)

**原因**：动态 `import()` 是 ES2017+ 标准，浏览器原生支持。

**禁止使用**：

- Webpack
- Rollup
- Vite
- 其他构建工具

#### 4. 类型系统：JSDoc注释 (无TypeScript)

**原因**：JSDoc 可以提供类型提示，无需编译步骤。

**正确做法**：

```javascript
/**
 * 测试连接
 * @param {string} url - 测试URL
 * @returns {Promise<boolean>} 是否连接成功
 */
async _testConnection(url) {
  // ...
}
```

#### 5. 浏览器支持：Chrome 60+, Firefox 55+, Safari 11+

**原因**：这些浏览器版本都支持 ES2017+ 特性。

**禁止使用**：

- IE11 兼容代码
- 已进入标准阶段的 polyfill（如 `Promise`、`async/await`）

---

## 🔗 相关规则

- **代码结构规范**: 参见 `Skills架构改造-代码结构规范.md`
- **迁移标准规范**: 参见 `Skills架构改造-迁移标准规范.md`
- **异常处理规范**: 参见 `Skills架构改造-异常处理规范.md`
- **日志记录规范**: 参见 `Skills架构改造-日志记录规范.md`
- **安全规范**: 参见 `Skills架构改造-安全规范.md`

---

## ✅ 检查清单

- [ ] 所有插件都继承了 PluginBase 类
- [ ] 没有在 window 上直接挂载变量
- [ ] 插件间没有直接依赖（通过 EventHub 通信）
- [ ] 没有修改核心基类文件
- [ ] 没有在 H5 端使用小程序专有 API
- [ ] 使用了 ES6+ 语法
- [ ] 使用了动态 `import()`
- [ ] 没有使用构建工具
- [ ] 使用了 JSDoc 注释
- [ ] 没有兼容 IE11 的代码

---

**文档结束**

_本规范定义了 Skills 架构改造的架构核心规则，所有开发人员必须严格遵守。_
