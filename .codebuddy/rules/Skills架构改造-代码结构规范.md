# 📘 Skills架构改造 - 代码结构规范

**版本**: v2.0.0  
**日期**: 2026-05-28  
**状态**: 强制执行  
**适用对象**: 所有参与改造的开发人员  
**依赖规则**: `Skills架构改造-架构核心规范.md`

## 🚨 规则优先级声明

本文件是**Skills架构改造专用规范**，是架构改造的唯一权威规则。

**规则体系调整说明（2026-05-29）**：

- 通用代码风格规范已移出 `.codebuddy/rules/` 目录
- 原因：12个规则文件导致AI注意力分散，影响架构红线执行精度
- 调整方案：以架构改造规范为核心，通用规范仅作为参考
- 通用规范位置：`.codebuddy/备份-通用代码风格规范/`

**当本文件与其他规范冲突时，以本文件为准**。

---

## 🏗️ 代码结构规范

### 2.1 文件结构（强制）

## 🏗️ 代码结构规范

### 2.1 文件结构（强制）

**插件目录结构**：

```
mini-app-h5/backend/
├── plugin-base.js           ✅ 插件基类（禁止修改）
├── plugin-loader.js         ✅ 插件加载器（禁止修改）
├── dual-adapter.js         ✅ 双端适配器（禁止修改）
├── event-hub.js           ✅ 事件中心（禁止修改）
│
├── plugins/                 ✅ 插件目录（必须）
│   ├── core/               ✅ 核心插件（必须预加载）
│   │   ├── auth-plugin.js      ✅ 登录插件
│   │   ├── ai-plugin.js        ✅ AI插件
│   │   ├── scale-plugin.js     ✅ 量表插件
│   │   ├── scoring-plugin.js   ✅ 计分插件
│   │   └── npc-plugin.js      ✅ NPC插件
│   │
│   └── optional/          ✅ 可选插件（按需加载）
│       ├── meditation-plugin.js   🔲 冥想插件
│       └── analytics-plugin.js   🔲 分析插件
│
├── admin-legacy.html        ✅ 主页面（必须引入核心模块）
└── ... (其他文件)
```

**强制规则**：

1. 所有插件文件**必须**放在 `plugins/` 目录下
2. 核心插件**必须**放在 `plugins/core/` 目录
3. 可选插件**必须**放在 `plugins/optional/` 目录
4. 插件文件命名**必须**遵循 `{插件名}-plugin.js` 格式

### 2.2 命名规范（强制）

| 类型           | 规范                           | 正确示例                         | 错误示例                          |
| -------------- | ------------------------------ | -------------------------------- | --------------------------------- |
| **插件类名**   | PascalCase + `Plugin` 后缀     | `AIPlugin`                       | ❌ `aiPlugin`, `AI_plugin`        |
| **插件文件名** | kebab-case + `-plugin.js` 后缀 | `ai-plugin.js`                   | ❌ `AIPlugin.js`, `ai_plugin.js`  |
| **插件注册名** | camelCase（无后缀）            | `ai`, `scale`                    | ❌ `ai-plugin`, `AIPlugin`        |
| **配置键名**   | camelCase                      | `apiKey`, `maxRetries`           | ❌ `api_key`, `max-retries`       |
| **CSS类名**    | kebab-case                     | `admin-container`, `btn-primary` | ❌ `adminContainer`, `btnPrimary` |

**注意**：

1. **事件命名规范**参见《代码风格规范》第3.7节（以通用规范为准）。
2. **通用命名规则**与本条规则有重叠时，以本条规则为准。
3. **通用代码风格规范**参见 `.codebuddy/rules/代码风格规范-coding-style.md`。

### 2.3 代码组织（强制）

**插件代码结构模板**（必须遵循）：

```javascript
/**
 * {插件名称} - {插件描述}
 *
 * @version 1.0.0
 * @date 2026-05-27
 */

class XXXPlugin extends PluginBase {
  /**
   * 构造函数 - 必须调用 super()
   */
  constructor() {
    super({
      name: '{插件显示名称}',
      version: '1.0.0',
      description: '{插件描述}'
    });

    // 插件私有属性（必须加下划线前缀）
    this._data = null;
    this._isLoading = false;
  }

  /**
   * 初始化逻辑 - 必须实现
   */
  async onInit() {
    // 1. 加载配置
    // 2. 注册事件监听
    // 3. 初始化UI
  }

  /**
   * 执行逻辑 - 必须实现
   * @param {object} params - 执行参数
   */
  async onExecute(params = {}) {
    // 1. 参数校验
    // 2. 业务逻辑
    // 3. 返回结果
    return { success: true };
  }

  /**
   * 销毁逻辑 - 可选实现
   */
  onDestroy() {
    // 1. 取消事件监听
    // 2. 清理定时器
    // 3. 释放资源
  }
}

// 必须使用 export default
export default XXXPlugin;
```

**通用代码风格参考**:

- 代码格式化规则参见《代码风格规范》第2章
- 注释与文档标准参见《代码风格规范》第4章
- 语言特定最佳实践参见《代码风格规范》第5章
- 详细代码风格规范参见：`.codebuddy/rules/代码风格规范-coding-style.md`

---

## 📋 规则详解

### 文件结构详解

#### 1. 核心插件 vs 可选插件

**核心插件**：

- 必须预加载（在页面加载时立即加载）
- 提供基础功能，其他插件可能依赖它们
- 放在 `plugins/core/` 目录

**可选插件**：

- 按需加载（用户触发某个功能时才加载）
- 提供增强功能，不是所有用户都需要
- 放在 `plugins/optional/` 目录

#### 2. 文件命名规范

**为什么使用 kebab-case？**

- 在文件系统中，kebab-case 最友好（避免空格、下划线等）
- 与 HTML/CSS 命名习惯一致
- 在 URL 中友好（自动小写，连字符分隔）

**错误示例分析**：

- `AIPlugin.js`：使用 PascalCase，不符合文件系统命名习惯
- `ai_plugin.js`：使用 snake_case，与前端社区习惯不符

### 命名规范详解

#### 1. 插件类名：PascalCase + `Plugin` 后缀

**原因**：

- PascalCase 是 JavaScript 类名的标准约定
- `Plugin` 后缀明确表示这是一个插件类

**正确示例**：

```javascript
class AIPlugin extends PluginBase { ... }
class ScalePlugin extends PluginBase { ... }
class ScoringPlugin extends PluginBase { ... }
```

#### 2. 插件文件名：kebab-case + `-plugin.js` 后缀

**原因**：

- kebab-case 在文件系统中最友好
- `-plugin.js` 后缀明确标识这是一个插件文件

**正确示例**：

```
ai-plugin.js
scale-plugin.js
scoring-plugin.js
npc-plugin.js
```

#### 3. 插件注册名：camelCase（无后缀）

**原因**：

- camelCase 是 JavaScript 变量/属性命名的标准约定
- 无后缀更简洁，便于在代码中使用

**正确示例**：

```javascript
// 注册插件
PluginLoader.register('ai', AIPlugin);

// 获取插件
const aiPlugin = PluginLoader.get('ai');
```

#### 4. 事件名称：kebab-case

**原因**：

- kebab-case 在事件命名中更常见（如 `click`, `DOMContentLoaded`）
- 与 CSS 类名、HTML 属性名风格一致

**正确示例**：

```javascript
EventHub.on('plugin-loaded', callback);
EventHub.on('user-login', callback);
EventHub.on('data-changed', callback);
```

### 代码组织详解

#### 1. 插件代码结构模板

**为什么需要模板？**

- 确保所有插件结构一致，便于维护
- 明确插件生命周期（init → execute → destroy）
- 提供最佳实践示例

**模板各部分说明**：

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

#### 2. 私有属性命名

**为什么加下划线前缀？**

- 明确表示这是私有属性，外部不应该直接访问
- 与公共方法/属性区分开

**正确示例**：

```javascript
class AIPlugin extends PluginBase {
  constructor() {
    super({...});
    this._apiKey = '';      // 私有属性
    this._isLoading = false; // 私有属性
  }

  // 公共方法
  getAPIKey() {
    return this._apiKey;
  }
}
```

---

## 🔗 相关规则

- **架构核心规范**: 参见 `Skills架构改造-架构核心规范.md`
- **迁移标准规范**: 参见 `Skills架构改造-迁移标准规范.md`
- **通用代码风格规范**: 参见 `.codebuddy/rules/代码风格规范-coding-style.md` 第3.4、3.6、3.7节

---

## ✅ 检查清单

- [ ] 插件文件放在正确的目录（`core/` 或 `optional/`）
- [ ] 插件文件名符合 `{插件名}-plugin.js` 格式
- [ ] 插件类名符合 `XXXPlugin` 格式
- [ ] 插件注册名符合 `xxx` 格式
- [ ] 事件名称使用 kebab-case
- [ ] 配置键名使用 camelCase
- [ ] CSS 类名使用 kebab-case
- [ ] 插件代码遵循标准模板结构
- [ ] 私有属性加下划线前缀
- [ ] 使用 `export default` 导出

---

**文档结束**

_本规范定义了 Skills 架构改造的代码结构规则，所有开发人员必须严格遵守。_
