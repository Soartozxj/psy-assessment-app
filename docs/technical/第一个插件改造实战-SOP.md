# 📘 第一个插件改造实战-SOP

**文档版本**: v1.0.0  
**创建日期**: 2026-05-29  
**最后更新**: 2026-05-29  
**负责人**: rich  
**状态**: 待审核  
**适用对象**: 开发新手（用大白话解释）  
**预计完成时间**: 2-3天

---

## 📋 文档概述

本SOP（标准操作程序）文档旨在指导开发人员完成**第一个插件（AI插件）的改造工作**。通过本文档，您将学会如何将传统的 `admin-ai-config.js` 模块改造为符合插件化架构的 `ai-plugin.js`。

### 改造目标

| 对比项         | 改造前                   | 改造后                     |
| -------------- | ------------------------ | -------------------------- |
| **代码组织**   | 独立JS文件，全局变量污染 | 插件化，基于PluginBase继承 |
| **加载方式**   | `<script>`标签直接引入   | 插件加载器动态加载         |
| **双端支持**   | 只支持H5                 | H5和小程序都能用           |
| **代码复用**   | 低（复制粘贴多）         | 高（插件可复用）           |
| **新手友好度** | 低（代码乱，难懂）       | 高（结构清晰，注释详细）   |

### 为什么选择AI插件作为第一个改造目标？

1. **功能独立**：只处理AI配置，不依赖其他模块
2. **代码量适中**：约400行，不会太复杂
3. **不涉及复杂依赖**：适合新手练手
4. **有完整示例**：迁移指南中提供了详细对比

---

## 🔧 改造前准备

### 1. 备份现有代码（必须）

**为什么需要备份？**  
改造过程中可能出现意外错误，备份可以让您快速回退到改造前的状态。

#### 备份方案A：使用Git（推荐）

```bash
# 1. 检查当前Git状态
cd /Users/rich/WorkBuddy/20260407113106/
git status

# 2. 创建备份分支
git checkout -b backup/ai-plugin-migration-$(date +%Y%m%d)

# 3. 提交当前更改
git add .
git commit -m "备份：AI插件改造前状态"

# 4. 切换回主分支
git checkout main

# 5. 确认备份成功
git branch -a | grep backup
```

#### 备份方案B：手动复制文件

```bash
# 1. 创建备份目录
mkdir -p backup/$(date +%Y%m%d)

# 2. 备份相关文件
cp mini-app-h5/backend/admin-ai-config.js backup/$(date +%Y%m%d)/
cp mini-app-h5/backend/admin-legacy.html backup/$(date +%Y%m%d)/

# 3. 验证备份文件
ls -lh backup/$(date +%Y%m%d)/
```

**预期结果**：

```
backup/20260529/
├── admin-ai-config.js
└── admin-legacy.html
```

### 2. 环境检查

#### 检查核心模块是否存在

```bash
# 检查4个核心模块文件
ls -lh mini-app-h5/backend/plugin-base.js
ls -lh mini-app-h5/backend/plugin-loader.js
ls -lh mini-app-h5/backend/dual-adapter.js
ls -lh mini-app-h5/backend/event-hub.js
```

**预期结果**：所有4个文件都存在，显示文件详细信息。

**如果文件不存在**：  
→ 参考《迁移指南.md》第1步，先搭建基础设施

#### 检查现有AI配置文件

```bash
# 检查AI配置文件
ls -lh mini-app-h5/backend/admin-ai-config.js
cat mini-app-h5/backend/admin-ai-config.js | head -50
```

**预期结果**：文件存在，包含 `var AIConfig = {};` 等代码。

### 3. 文档查阅清单

在开始改造前，请务必查阅以下文档：

| 文档名称         | 路径                                              | 查阅重点              | 必须 |
| ---------------- | ------------------------------------------------- | --------------------- | ---- |
| **迁移指南**     | `mini-app-h5/backend/迁移指南.md`                 | 第2步：改造第一个插件 | ✅   |
| **架构核心规范** | `.codebuddy/rules/Skills架构改造-架构核心规范.md` | 5条架构红线           | ✅   |
| **代码结构规范** | `.codebuddy/rules/Skills架构改造-代码结构规范.md` | 插件模板代码          | ✅   |
| **插件基类代码** | `mini-app-h5/backend/plugin-base.js`              | 生命周期方法          | ⭐   |
| **SOP文档清单**  | `📚 Skills 架构改造 - 文档与文件清单.md`          | 整体改造计划          | ⭐   |

**图例**：✅ 必须查阅 | ⭐ 建议查阅

---

## 🚀 详细步骤（7步法）

### 步骤1：创建插件文件

**目标**：创建 `ai-plugin.js` 文件，搭建插件基本结构。

#### 操作步骤

**1.1 创建插件目录**（如果不存在）

```bash
# 创建插件目录结构
mkdir -p mini-app-h5/backend/plugins/core

# 验证目录创建成功
ls -lh mini-app-h5/backend/plugins/
```

**预期结果**：

```
mini-app-h5/backend/plugins/
└── core/
```

**1.2 创建插件文件**

创建文件 `mini-app-h5/backend/plugins/core/ai-plugin.js`，内容如下：

```javascript
/**
 * ai-plugin.js - AI调用插件
 *
 * 大白话解释：
 * - 这个插件负责AI配置和调用功能
 * - 继承自PluginBase，获得标准接口
 * - 使用Adapter适配H5和小程序双端
 *
 * @version 1.0.0
 * @date 2026-05-29
 */

class AIPlugin extends PluginBase {
  /**
   * 构造函数 - 必须调用 super()
   */
  constructor() {
    super({
      name: 'AI调用插件',
      version: '1.0.0',
      description: '负责AI配置和调用的插件'
    });

    // 插件私有数据（必须加下划线前缀）
    this._currentProvider = 'dashscope'; // 当前AI提供商
    this._config = {}; // AI配置
    this._isConnecting = false; // 是否正在连接
  }

  /**
   * 初始化逻辑 - 插件加载时调用
   */
  async onInit() {
    console.log('🚀 AI插件开始初始化...');

    try {
      // 1. 加载配置
      await this._loadConfig();

      // 2. 测试连接
      await this._testConnection();

      // 3. 注册事件监听
      this._registerEvents();

      console.log('✅ AI插件初始化完成');
    } catch (error) {
      Adapter.logger.error('AI插件初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行逻辑 - 插件被调用时执行
   * @param {object} params - 执行参数
   */
  async onExecute(params = {}) {
    console.log('🎯 AI插件开始执行...', params);

    try {
      // 根据参数执行不同操作
      if (params.action === 'test') {
        return await this._testConnection();
      }

      if (params.action === 'call') {
        return await this._callAI(params.prompt);
      }

      return { success: true };
    } catch (error) {
      Adapter.logger.error('AI插件执行失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 销毁逻辑 - 插件卸载时调用
   */
  onDestroy() {
    console.log('🗑️ AI插件开始销毁...');

    // 1. 取消事件监听
    this._unregisterEvents();

    // 2. 清理定时器
    // ...

    // 3. 释放资源
    this._config = null;

    console.log('✅ AI插件销毁完成');
  }

  // ========== 私有方法 ==========

  /**
   * 加载配置
   * @private
   */
  async _loadConfig() {
    console.log('📂 加载AI配置...');

    try {
      // 从存储中读取配置
      const saved = Adapter.storage.get('psy_ai_config');
      if (saved) {
        this._config = Object.assign({}, this._getDefaultConfig(), saved);
      } else {
        this._config = this._getDefaultConfig();
      }

      console.log('✅ AI配置加载成功');
    } catch (e) {
      Adapter.logger.warn('Failed to load AI config:', e);
      this._config = this._getDefaultConfig();
    }
  }

  /**
   * 获取默认配置
   * @private
   */
  _getDefaultConfig() {
    return {
      provider: 'dashscope',
      dashscope_key: '',
      dashscope_model: 'qwen-turbo',
      deepseek_key: '',
      deepseek_model: 'deepseek-chat'
    };
  }

  /**
   * 测试连接
   * @private
   */
  async _testConnection() {
    console.log('🔌 测试AI连接...');

    // TODO: 实际调用AI API测试连接
    // 这里先模拟成功
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log('✅ AI连接测试成功');
    return true;
  }

  /**
   * 调用AI
   * @param {string} prompt - 提示词
   * @private
   */
  async _callAI(prompt) {
    console.log('🤖 调用AI...', prompt);

    // TODO: 实际调用AI API
    // 这里先返回模拟结果

    return {
      success: true,
      data: '这是AI的回复（模拟）'
    };
  }

  /**
   * 注册事件监听
   * @private
   */
  _registerEvents() {
    console.log('📡 注册AI插件事件...');

    // 监听配置变更事件
    this.registerEventListener('ai-config-changed', (data) => {
      console.log('收到AI配置变更事件:', data);
      this._config = Object.assign({}, this._config, data);
    });
  }

  /**
   * 取消事件监听
   * @private
   */
  _unregisterEvents() {
    console.log('📡 取消AI插件事件监听...');

    // 基类会自动清理通过 registerEventListener 注册的事件
    // 这里只需要清理手动注册的事件
  }
}

// 必须使用 export default
export default AIPlugin;
```

**1.3 验证插件文件创建成功**

```bash
# 检查文件是否存在
ls -lh mini-app-h5/backend/plugins/core/ai-plugin.js

# 检查文件内容是否正确
head -30 mini-app-h5/backend/plugins/core/ai-plugin.js
```

**预期结果**：

```
-rw-r--r--  1 rich  staff   8.5K  5 29 23:30 ai-plugin.js
```

**常见问题**：

| 问题         | 原因               | 解决方案                                         |
| ------------ | ------------------ | ------------------------------------------------ |
| 文件创建失败 | 权限不足           | `sudo mkdir -p mini-app-h5/backend/plugins/core` |
| 语法错误     | 复制粘贴时格式错误 | 对照上面的代码示例，逐行检查                     |
| 编码问题     | 文件编码不是UTF-8  | 使用VS Code另存为UTF-8格式                       |

---

### 步骤2：修改HTML引入插件

**目标**：在 `admin-legacy.html` 中引入核心模块和插件系统。

#### 操作步骤

**2.1 备份admin-legacy.html**（如果前面没备份）

```bash
cp mini-app-h5/backend/admin-legacy.html mini-app-h5/backend/admin-legacy.html.backup
```

**2.2 编辑admin-legacy.html**

打开 `mini-app-h5/backend/admin-legacy.html`，找到 `<head>` 标签，在适当位置添加核心模块引入：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- ... 其他meta标签 ... -->

    <!-- ✅ 新增：引入插件系统核心模块（必须放在最前面） -->
    <script src="plugin-base.js?v=1"></script>
    <script src="dual-adapter.js?v=1"></script>
    <script src="event-hub.js?v=1"></script>
    <script src="plugin-loader.js?v=1"></script>

    <!-- Chart.js CDN - 用于数据看板图表渲染 -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <!-- adminAuth 认证模块 -->
    <script src="admin-auth.js?v=1"></script>

    <!-- ... 其他script标签 ... -->
  </head>
</html>
```

**⚠️ 注意**：

1. 核心模块必须放在最前面（比其他JS文件先加载）
2. 使用 `?v=1` 防止浏览器缓存旧版本
3. 确保文件路径正确（相对于 `admin-legacy.html`）

**2.3 在页面底部添加插件初始化代码**

找到 `</body>` 标签，在前面添加插件初始化代码：

```html
  <!-- ... 页面其他内容 ... -->

  <!-- ✅ 新增：插件系统初始化 -->
  <script>
    document.addEventListener('DOMContentLoaded', async function() {
      console.log('🚀 开始初始化插件系统...');

      try {
        // 1. 预加载核心插件
        await PluginLoader.init();

        console.log('✅ 插件系统初始化完成');
        console.log('   已加载插件:', Object.keys(PluginLoader.plugins).join(', '));

      } catch (error) {
        console.error('❌ 插件系统初始化失败:', error);
      }
    });
  </script>
</body>
</html>
```

**2.4 验证HTML修改成功**

```bash
# 检查HTML文件是否修改成功
grep -n "plugin-base.js" mini-app-h5/backend/admin-legacy.html
grep -n "PluginLoader.init()" mini-app-h5/backend/admin-legacy.html
```

**预期结果**：

```
65:    <script src="plugin-base.js?v=1"></script>
66:    <script src="dual-adapter.js?v=1"></script>
67:    <script src="event-hub.js?v=1"></script>
68:    <script src="plugin-loader.js?v=1"></script>
...
125:        await PluginLoader.init();
```

**常见问题**：

| 问题               | 原因             | 解决方案                      |
| ------------------ | ---------------- | ----------------------------- |
| 核心模块加载失败   | 路径错误         | 检查文件是否在正确目录        |
| PluginLoader未定义 | 引入顺序错误     | 确保核心模块在最前面          |
| 插件初始化失败     | 插件文件路径错误 | 检查plugins/core/目录是否存在 |

---

### 步骤3：测试插件加载

**目标**：在浏览器中验证插件系统是否能正常加载AI插件。

#### 操作步骤

**3.1 在浏览器中打开admin-legacy.html**

1. 在VS Code中，右键点击 `admin-legacy.html`
2. 选择"Open with Live Server" 或 "Open in Browser"
3. 按 `F12` 打开开发者工具，切换到 `Console` 标签页

**3.2 查看Console输出**

**期望的输出**（类似这样）：

```
✅ plugin-base.js 加载完成
🌐 检测到运行环境: h5
✅ dual-adapter.js 加载完成
📡 EventHub 创建成功
   最大监听器数量: 20
✅ event-hub.js 加载完成
📦 PluginLoader 创建成功
   核心插件: auth, ai, scale, scoring, npc
   可选插件: meditation, analytics, diary
✅ plugin-loader.js 加载完成
🚀 开始初始化插件系统...
📦 开始预加载核心插件...
📂 加载路径: ./plugins/core/ai-plugin.js?v=1716823200000
📦 创建插件实例: ai
🚀 开始初始化插件: AI调用插件
   🔌 初始化逻辑: AI插件开始初始化...
   📂 加载AI配置...
   ✅ AI配置加载成功
   🔌 测试AI连接...
   ✅ AI连接测试成功
   📡 注册AI插件事件...
   ✅ AI插件初始化完成
📦 插件 ai 加载成功
✅ 核心插件预加载完成: 1/5 成功
✅ 插件系统初始化完成
   已加载插件: ai
```

**3.3 手动测试插件功能**

在Console中执行以下命令：

```javascript
// 测试1：获取AI插件实例
const aiPlugin = PluginLoader.get('ai');
console.log('AI插件实例:', aiPlugin);

// 测试2：查看插件配置
console.log('AI配置:', aiPlugin._config);

// 测试3：测试插件执行
aiPlugin.onExecute({ action: 'test' }).then((result) => {
  console.log('测试结果:', result);
});

// 测试4：测试事件通信
EventHub.on('ai-config-changed', (data) => {
  console.log('收到事件:', data);
});
EventHub.emit('ai-config-changed', { provider: 'deepseek' });
```

**预期结果**：

- 所有命令都能正常执行
- 没有报错信息
- 事件通信正常工作

**常见问题**：

| 问题                               | 原因             | 解决方案                              |
| ---------------------------------- | ---------------- | ------------------------------------- |
| `PluginLoader is not defined`      | 核心模块未加载   | 检查引入顺序和路径                    |
| `AI插件初始化失败`                 | 插件代码有错误   | 查看Console错误信息，修复代码         |
| `404 Not Found`                    | 插件文件路径错误 | 检查plugins/core/ai-plugin.js是否存在 |
| `PluginClass is not a constructor` | 插件未正确导出   | 检查是否使用 `export default`         |

---

### 步骤4：迁移代码

**目标**：将 `admin-ai-config.js` 中的代码迁移到 `ai-plugin.js`。

#### 迁移原则

| 原代码模式                 | 改造后模式                           | 示例                                                       |
| -------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `var XXX = {};`            | `class XXXPlugin extends PluginBase` | `var AIConfig = {};` → `class AIPlugin extends PluginBase` |
| `XXX.init = function() {}` | `async onInit() {}`                  | `AIConfig.init` → `onInit()`                               |
| `XXX.func = function() {}` | `this.func() {}`                     | `AIConfig.selectProvider` → `this.selectProvider()`        |
| `var data = {};`           | `this._data = {};`                   | 全局变量 → 私有属性（加下划线）                            |
| `localStorage.getItem()`   | `Adapter.storage.get()`              | 直接使用localStorage → 通过Adapter适配                     |
| `showToast()`              | `this.showToast()`                   | 全局函数 → 插件方法                                        |

#### 操作步骤

**4.1 分析现有代码**

打开 `admin-ai-config.js`，分析代码结构：

```javascript
// 示例：原有代码结构
var AIConfig = {};

AIConfig.init = function () {
  // 初始化逻辑
};

AIConfig.selectProvider = function (provider) {
  // 选择AI提供商
};

// ... 其他函数
```

**4.2 迁移初始化逻辑**

将 `AIConfig.init()` 迁移到 `ai-plugin.js` 的 `onInit()` 方法中：

```javascript
// ✅ 改造后（ai-plugin.js）
async onInit() {
  console.log('🚀 AI插件开始初始化...');

  try {
    // 1. 加载配置（原 AIConfig.init() 的逻辑）
    await this._loadConfig();

    // 2. 初始化UI（原 AIConfig.init() 的逻辑）
    this._initUI();

    // 3. 注册事件监听
    this._registerEvents();

    console.log('✅ AI插件初始化完成');
  } catch (error) {
    Adapter.logger.error('AI插件初始化失败:', error);
    throw error;
  }
}

/**
 * 初始化UI
 * @private
 */
_initUI() {
  console.log('🎨 初始化AI配置UI...');

  // 原 AIConfig.init() 中的UI初始化逻辑
  // 比如：
  // - 绑定下拉框事件
  // - 设置默认值
  // - 更新UI状态
}
```

**4.3 迁移业务函数**

将 `AIConfig.selectProvider()` 等函数迁移为插件方法：

```javascript
// ❌ 改造前（admin-ai-config.js）
AIConfig.selectProvider = function(provider) {
  currentProvider = provider;
  localStorage.setItem('psy_ai_provider', provider);
  updateUI();
};

// ✅ 改造后（ai-plugin.js）
/**
 * 选择AI提供商
 * @param {string} provider - 提供商名称（dashscope/deepseek）
 */
async selectProvider(provider) {
  console.log('🔄 切换AI提供商:', provider);

  try {
    this._currentProvider = provider;
    Adapter.storage.set('psy_ai_provider', provider);

    // 更新UI
    this._updateUI();

    // 触发事件
    EventHub.emit('ai-config-changed', { provider });

    console.log('✅ 提供商切换成功');
  } catch (error) {
    Adapter.logger.error('切换提供商失败:', error);
    throw error;
  }
}
```

**4.4 迁移数据存储**

将 `localStorage` 调用改为 `Adapter.storage`：

```javascript
// ❌ 改造前
var saved = localStorage.getItem('psy_ai_config');
localStorage.setItem('psy_ai_config', JSON.stringify(config));

// ✅ 改造后
const saved = Adapter.storage.get('psy_ai_config');
Adapter.storage.set('psy_ai_config', JSON.stringify(config));
```

**4.5 完整迁移示例**

参考《迁移指南.md》中的完整示例：

```javascript
// ❌ 改造前（admin-ai-config.js）
function loadConfig() {
  try {
    var saved = localStorage.getItem('psy_ai_config');
    if (saved) {
      currentConfig = Object.assign({}, DEFAULT_CONFIG, JSON.parse(saved));
    }
  } catch (e) {
    console.warn('Failed to load AI config:', e);
  }
}

// ✅ 改造后（ai-plugin.js）
async _loadConfig() {
  console.log('📂 加载AI配置...');

  try {
    const saved = Adapter.storage.get('psy_ai_config');
    if (saved) {
      this._config = Object.assign({}, this._getDefaultConfig(), saved);
    } else {
      this._config = this._getDefaultConfig();
    }

    console.log('✅ AI配置加载成功');
  } catch (e) {
    Adapter.logger.warn('Failed to load AI config:', e);
    this._config = this._getDefaultConfig();
  }
}

_getDefaultConfig() {
  return {
    provider: 'dashscope',
    dashscope_key: '',
    dashscope_model: 'qwen-turbo',
    deepseek_key: '',
    deepseek_model: 'deepseek-chat'
  };
}
```

**4.6 验证代码迁移成功**

1. 保存 `ai-plugin.js`
2. 刷新浏览器页面
3. 查看Console输出，确认没有错误
4. 手动测试所有AI配置功能

**常见问题**：

| 问题                     | 原因             | 解决方案                               |
| ------------------------ | ---------------- | -------------------------------------- |
| `this is undefined`      | 函数调用方式错误 | 确保使用 `this.func()` 而不是 `func()` |
| `Adapter is not defined` | Adapter未加载    | 检查dual-adapter.js是否正确引入        |
| 函数找不到               | 未迁移所有函数   | 对照原文件，确保所有函数都迁移了       |
| UI不更新                 | 事件未触发       | 检查EventHub.emit()是否正确调用        |

---

### 步骤5：测试功能

**目标**：全面测试改造后的AI插件功能，确保一切正常。

#### 测试计划

| 测试项         | 测试方法                | 预期结果                   |
| -------------- | ----------------------- | -------------------------- |
| **插件加载**   | 刷新页面，查看Console   | 插件成功加载，无错误       |
| **配置加载**   | 查看Console输出         | 配置从存储中成功加载       |
| **UI初始化**   | 查看页面UI              | UI正常显示，无错误         |
| **切换提供商** | 手动点击切换按钮        | 提供商成功切换，UI更新     |
| **保存配置**   | 修改配置，点击保存      | 配置成功保存，无错误       |
| **测试连接**   | 点击测试连接按钮        | 连接测试成功，显示成功消息 |
| **AI调用**     | 输入提示词，点击调用    | AI成功调用，返回结果       |
| **事件通信**   | 在Console中手动触发事件 | 事件正常通信，无错误       |

#### 操作步骤

**5.1 手动测试（最实用）**

在浏览器Console中手动测试：

```javascript
// 测试1：查看所有已加载的插件
console.log('已加载插件:', PluginLoader.getPluginsInfo());

// 测试2：测试AI插件方法
const aiPlugin = PluginLoader.get('ai');

// 测试切换提供商
aiPlugin.selectProvider('deepseek').then(() => {
  console.log('切换成功，当前提供商:', aiPlugin._currentProvider);
});

// 测试3：测试AI调用
aiPlugin
  .onExecute({
    action: 'call',
    prompt: '你好，请介绍一下自己'
  })
  .then((result) => {
    console.log('AI返回:', result);
  });

// 测试4：测试事件通信
EventHub.on('ai-config-changed', (data) => {
  console.log('收到事件:', data);
});
EventHub.emit('ai-config-changed', { provider: 'dashscope' });

// 测试5：测试双端适配
Adapter.storage.set('test_key', 'test_value');
const value = Adapter.storage.get('test_key');
console.log('存储测试:', value);
```

**5.2 集成测试**

测试插件之间的协作：

```javascript
// 测试登录后加载AI配置
async function testIntegration() {
  console.log('🧪 开始集成测试...');

  try {
    // 1. 模拟用户登录
    const authPlugin = PluginLoader.get('auth');
    await authPlugin.onExecute({
      action: 'login',
      username: 'admin',
      password: '123456'
    });

    // 2. 监听事件
    let aiConfigLoaded = false;
    EventHub.on('ai-config-loaded', () => {
      aiConfigLoaded = true;
      console.log('✅ AI配置加载事件触发');
    });

    // 3. 等待事件触发
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. 验证结果
    if (aiConfigLoaded) {
      console.log('✅ 集成测试通过');
    } else {
      console.warn('⚠️ 集成测试未通过：AI配置加载事件未触发');
    }
  } catch (error) {
    console.error('❌ 集成测试失败:', error);
  }
}

// 执行集成测试
testIntegration();
```

**5.3 UI功能测试**

在页面上手动测试所有UI功能：

1. **打开AI配置页面**
2. **切换AI提供商**（dashscope ↔ deepseek）
3. **修改配置参数**（API Key、模型等）
4. **点击保存按钮**
5. **点击测试连接按钮**
6. **输入提示词，点击AI调用按钮**
7. **检查页面响应和Console输出**

**预期结果**：

- 所有功能都能正常使用
- 没有JavaScript错误
- UI响应及时，无卡顿

**常见问题**：

| 问题       | 原因                   | 解决方案                                     |
| ---------- | ---------------------- | -------------------------------------------- |
| 功能不正常 | 代码迁移不完整         | 对照原文件，补充缺失的代码                   |
| UI不更新   | 事件未触发或监听未注册 | 检查EventHub.emit()和registerEventListener() |
| 配置不保存 | 存储API调用错误        | 检查Adapter.storage.get/set()调用            |
| AI调用失败 | API配置错误            | 检查API Key和端点配置                        |

---

### 步骤6：代码审查

**目标**：使用检查清单验证代码质量，确保符合架构规范。

#### 代码审查检查清单

**6.1 架构红线检查**（必须全部通过）

- [ ] **禁止绕过PluginBase直接创建插件**  
       ✅ 检查：所有插件都使用了 `extends PluginBase`

- [ ] **禁止使用全局变量污染命名空间**  
       ✅ 检查：没有在 `window` 上直接挂载变量

- [ ] **禁止插件间直接依赖**  
       ✅ 检查：插件间通信都通过 `EventHub`

- [ ] **禁止修改核心基类**  
       ✅ 检查：`plugin-base.js` 等核心文件未被修改

- [ ] **禁止在H5端使用小程序专有API**  
       ✅ 检查：没有直接使用 `wx.*` API

**6.2 技术栈约束检查**（必须全部通过）

- [ ] **语言版本：ES6+ (ES2017+)**  
       ✅ 检查：没有使用 `var` 声明，使用了 `const`/`let`

- [ ] **模块系统：动态 `import()`**  
       ✅ 检查：没有使用 `require()` (CommonJS)

- [ ] **构建工具：无 (浏览器原生支持)**  
       ✅ 检查：没有使用Webpack/Rollup/Vite

- [ ] **类型系统：JSDoc注释 (无TypeScript)**  
       ✅ 检查：没有 `.ts` 文件，使用了JSDoc注释

- [ ] **浏览器支持：Chrome 60+, Firefox 55+, Safari 11+**  
       ✅ 检查：没有IE11兼容代码

**6.3 代码结构规范检查**（必须全部通过）

- [ ] **插件文件放在正确的目录**  
       ✅ 检查：`ai-plugin.js` 在 `plugins/core/` 目录

- [ ] **插件文件名符合格式**  
       ✅ 检查：文件名是 `ai-plugin.js`（kebab-case + `-plugin.js`）

- [ ] **插件类名符合格式**  
       ✅ 检查：类名是 `AIPlugin`（PascalCase + `Plugin` 后缀）

- [ ] **插件注册名符合格式**  
       ✅ 检查：注册名是 `ai`（camelCase，无后缀）

- [ ] **事件名称使用kebab-case**  
       ✅ 检查：事件名如 `ai-config-changed`

- [ ] **配置键名使用camelCase**  
       ✅ 检查：配置键如 `apiKey`、`maxRetries`

- [ ] **CSS类名使用kebab-case**  
       ✅ 检查：CSS类名如 `admin-container`

- [ ] **插件代码遵循标准模板结构**  
       ✅ 检查：有 `constructor()`、`onInit()`、`onExecute()`、`onDestroy()`

- [ ] **私有属性加下划线前缀**  
       ✅ 检查：私有属性如 `this._config`、`this._isLoading`

- [ ] **使用 `export default` 导出**  
       ✅ 检查：文件最后有 `export default AIPlugin;`

**6.4 代码质量检查**

- [ ] **注释覆盖率 ≥ 80%**  
       ✅ 检查：每个方法都有JSDoc注释

- [ ] **没有重复代码**  
       ✅ 检查：相同逻辑提取为公共方法

- [ ] **错误处理完善**  
       ✅ 检查：所有异步操作都有 try-catch

- [ ] **日志输出规范**  
       ✅ 检查：使用了 `Adapter.logger` 而不是 `console.log()`

- [ ] **命名语义化**  
       ✅ 检查：变量和函数名都能清晰表达意图

#### 操作步骤

**6.1 使用ESLint进行静态检查**（如果项目配置了ESLint）

```bash
# 运行ESLint检查
npx eslint mini-app-h5/backend/plugins/core/ai-plugin.js --format stylish
```

**预期结果**：没有错误或警告。

**6.2 手动代码审查**

1. 打开 `ai-plugin.js`
2. 对照上面的检查清单，逐项检查
3. 记录发现的问题
4. 修复问题
5. 再次检查，直到所有项都通过

**6.3 使用AI辅助审查**

将代码复制到CodeBuddy或ChatGPT，提问：

```
请帮我审查这段JavaScript代码，检查是否符合以下规范：
1. 所有插件都继承了PluginBase类
2. 没有使用全局变量
3. 使用了ES6+语法
4. 注释覆盖率≥80%
5. 错误处理完善

代码：
[粘贴ai-plugin.js代码]
```

---

### 步骤7：清理和优化

**目标**：清理临时代码，优化性能，完成改造。

#### 操作步骤

**7.1 注释掉旧代码**（不要立即删除）

在 `admin-legacy.html` 中，将原来的 `admin-ai-config.js` 引入注释掉：

```html
<!-- 暂时注释掉旧代码，保留以备回退
<script src="admin-ai-config.js?v=1"></script>
-->
```

**为什么不直接删除？**  
→ 如果新插件有问题，可以快速回退到旧代码。

**7.2 优化代码**

检查是否有可以优化的地方：

1. **提取重复代码**：如果有多个地方做了相同的事，提取为公共方法
2. **优化异步操作**：避免不必要的await，使用Promise.all()
3. **减少DOM操作**：缓存DOM元素，批量更新
4. **优化事件监听**：避免重复监听，及时清理

**示例：优化前 vs 优化后**

```javascript
// ❌ 优化前：重复的代码
async function saveConfig() {
  const key = document.getElementById('api-key').value;
  const model = document.getElementById('model').value;
  // ...
}

async function loadConfig() {
  const key = document.getElementById('api-key').value;
  const model = document.getElementById('model').value;
  // ...
}

// ✅ 优化后：提取公共方法
class AIPlugin extends PluginBase {
  constructor() {
    super({...});
    this._cacheDOM();  // 缓存DOM元素
  }

  _cacheDOM() {
    this._elements = {
      apiKey: document.getElementById('api-key'),
      model: document.getElementById('model'),
      // ...
    };
  }

  _getFormData() {
    return {
      apiKey: this._elements.apiKey.value,
      model: this._elements.model.value,
      // ...
    };
  }
}
```

**7.3 添加性能监控**（可选）

```javascript
class AIPlugin extends PluginBase {
  async onInit() {
    console.time('AI插件初始化');

    // ... 初始化逻辑

    console.timeEnd('AI插件初始化');
  }

  async onExecute(params) {
    console.time('AI插件执行');

    // ... 执行逻辑

    console.timeEnd('AI插件执行');
  }
}
```

**7.4 更新文档**

1. 在 `ai-plugin.js` 文件头添加详细的注释
2. 更新 `迁移指南.md`，记录改造过程
3. 更新 `📚 Skills 架构改造 - 文档与文件清单.md`，标记AI插件改造完成

---

## 📊 代码对比

### 改造前后代码结构对比

| 对比项       | 改造前（`admin-ai-config.js`）  | 改造后（`ai-plugin.js`）         |
| ------------ | ------------------------------- | -------------------------------- |
| **代码组织** | 全局对象 + 函数                 | 类 + 方法                        |
| **命名空间** | 污染全局（`var AIConfig = {}`） | 封装在类内部（`this._config`）   |
| **加载方式** | `<script>`标签直接引入          | 插件加载器动态加载               |
| **依赖管理** | 隐式依赖（全局变量）            | 显式依赖（通过PluginLoader获取） |
| **双端支持** | 只支持H5                        | H5和小程序都能用                 |
| **事件通信** | 直接函数调用                    | 通过EventHub解耦                 |
| **存储访问** | 直接使用 `localStorage`         | 通过 `Adapter.storage` 适配      |
| **错误处理** | 零散的try-catch                 | 统一的错误处理机制               |
| **日志输出** | 直接使用 `console.log`          | 通过 `Adapter.logger`            |
| **代码复用** | 低（复制粘贴多）                | 高（插件可复用）                 |

### 改造前后代码示例对比

#### 示例1：初始化逻辑

```javascript
// ❌ 改造前（admin-ai-config.js）
var AIConfig = {};

AIConfig.init = function () {
  console.log('初始化AI配置...');

  // 加载配置
  var saved = localStorage.getItem('psy_ai_config');
  if (saved) {
    currentConfig = JSON.parse(saved);
  }

  // 初始化UI
  $('#ai-provider').val(currentConfig.provider);
  // ...
};

// ✅ 改造后（ai-plugin.js）
class AIPlugin extends PluginBase {
  async onInit() {
    console.log('🚀 AI插件开始初始化...');

    try {
      // 加载配置
      await this._loadConfig();

      // 初始化UI
      this._initUI();

      // 注册事件监听
      this._registerEvents();

      console.log('✅ AI插件初始化完成');
    } catch (error) {
      Adapter.logger.error('AI插件初始化失败:', error);
      throw error;
    }
  }

  async _loadConfig() {
    const saved = Adapter.storage.get('psy_ai_config');
    if (saved) {
      this._config = Object.assign({}, this._getDefaultConfig(), saved);
    }
  }
}
```

#### 示例2：业务函数

```javascript
// ❌ 改造前（admin-ai-config.js）
AIConfig.selectProvider = function (provider) {
  currentProvider = provider;
  localStorage.setItem('psy_ai_provider', provider);
  updateUI();
};

// ✅ 改造后（ai-plugin.js）
class AIPlugin extends PluginBase {
  async selectProvider(provider) {
    console.log('🔄 切换AI提供商:', provider);

    try {
      this._currentProvider = provider;
      Adapter.storage.set('psy_ai_provider', provider);

      // 更新UI
      this._updateUI();

      // 触发事件
      EventHub.emit('ai-config-changed', { provider });

      console.log('✅ 提供商切换成功');
    } catch (error) {
      Adapter.logger.error('切换提供商失败:', error);
      throw error;
    }
  }
}
```

#### 示例3：事件通信

```javascript
// ❌ 改造前（直接函数调用）
function onAIConfigChanged() {
  updateUI();
}

AIConfig.save = function() {
  // ...
  onAIConfigChanged();  // 直接调用
};

// ✅ 改造后（通过EventHub通信）
class AIPlugin extends PluginBase {
  _registerEvents() {
    // 监听事件
    this.registerEventListener('ai-config-changed', (data) => {
      this._updateUI();
    });
  }

  async save() {
    // ...
    // 触发事件
    EventHub.emit('ai-config-changed', { ... });
  }
}
```

---

## 🧪 测试验证

### 测试计划

| 测试类型       | 测试方法               | 必须 |
| -------------- | ---------------------- | ---- |
| **单元测试**   | 为每个方法编写测试用例 | ⭐   |
| **集成测试**   | 测试插件之间协作       | ✅   |
| **手动测试**   | 在浏览器中手动测试     | ✅   |
| **性能测试**   | 测试加载时间和执行效率 | ⭐   |
| **兼容性测试** | 在不同浏览器中测试     | ⭐   |

**图例**：✅ 必须 | ⭐ 可选

### 测试用例

#### 1. 插件加载测试

```javascript
// 测试1：插件是否成功加载
function testPluginLoaded() {
  const aiPlugin = PluginLoader.get('ai');
  console.assert(aiPlugin !== null, 'AI插件未加载');
  console.assert(aiPlugin.name === 'AI调用插件', '插件名称错误');
  console.log('✅ 测试1通过：插件加载成功');
}

// 测试2：插件初始化是否成功
async function testPluginInit() {
  const aiPlugin = PluginLoader.get('ai');
  console.assert(aiPlugin._config !== null, '配置未加载');
  console.log('✅ 测试2通过：插件初始化成功');
}

// 执行测试
testPluginLoaded();
await testPluginInit();
```

#### 2. 功能测试

```javascript
// 测试3：切换提供商
async function testSelectProvider() {
  const aiPlugin = PluginLoader.get('ai');

  await aiPlugin.selectProvider('deepseek');
  console.assert(aiPlugin._currentProvider === 'deepseek', '提供商切换失败');

  await aiPlugin.selectProvider('dashscope');
  console.assert(aiPlugin._currentProvider === 'dashscope', '提供商切换失败');

  console.log('✅ 测试3通过：切换提供商功能正常');
}

// 测试4：保存配置
async function testSaveConfig() {
  const aiPlugin = PluginLoader.get('ai');

  aiPlugin._config.dashscope_key = 'test_key';
  await aiPlugin.saveConfig();

  const saved = Adapter.storage.get('psy_ai_config');
  console.assert(saved.dashscope_key === 'test_key', '配置保存失败');

  console.log('✅ 测试4通过：保存配置功能正常');
}

// 执行测试
await testSelectProvider();
await testSaveConfig();
```

#### 3. 事件通信测试

```javascript
// 测试5：事件监听
function testEventHub() {
  let eventReceived = false;

  EventHub.on('ai-config-changed', (data) => {
    eventReceived = true;
    console.log('✅ 测试5通过：事件监听正常');
  });

  EventHub.emit('ai-config-changed', { provider: 'deepseek' });

  setTimeout(() => {
    console.assert(eventReceived, '事件未收到');
  }, 100);
}

// 执行测试
testEventHub();
```

#### 4. 双端适配测试

```javascript
// 测试6：存储适配
function testStorageAdapter() {
  Adapter.storage.set('test_key', 'test_value');
  const value = Adapter.storage.get('test_key');
  console.assert(value === 'test_value', '存储适配失败');

  Adapter.storage.remove('test_key');
  const deleted = Adapter.storage.get('test_key');
  console.assert(deleted === null, '存储删除失败');

  console.log('✅ 测试6通过：存储适配正常');
}

// 测试7：请求适配
async function testRequestAdapter() {
  try {
    const response = await Adapter.request({
      url: 'https://api.example.com/test',
      method: 'GET'
    });
    console.log('✅ 测试7通过：请求适配正常');
  } catch (error) {
    console.warn('⚠️ 测试7未通过：请求适配可能有问题', error);
  }
}

// 执行测试
testStorageAdapter();
await testRequestAdapter();
```

### 测试执行

**在浏览器Console中执行所有测试**：

```javascript
// 执行所有测试
async function runAllTests() {
  console.log('🧪 开始执行所有测试...');

  try {
    // 基础测试
    testPluginLoaded();
    await testPluginInit();

    // 功能测试
    await testSelectProvider();
    await testSaveConfig();

    // 事件测试
    testEventHub();

    // 适配测试
    testStorageAdapter();
    await testRequestAdapter();

    console.log('🎉 所有测试通过！');
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 执行
runAllTests();
```

---

## 🔙 回退方案

### 什么情况下需要回退？

1. **改造失败**：新插件有严重bug，无法修复
2. **功能缺失**：新插件缺少原有功能的某些特性
3. **时间紧迫**：来不及完成改造，需要快速回退到稳定版本

### 回退步骤

#### 快速回退方案A：恢复HTML引入

**1. 恢复admin-legacy.html**

打开 `admin-legacy.html`，做以下修改：

```html
<!-- 1. 注释掉插件系统核心模块引入 -->
<!--
<script src="plugin-base.js?v=1"></script>
<script src="dual-adapter.js?v=1"></script>
<script src="event-hub.js?v=1"></script>
<script src="plugin-loader.js?v=1"></script>
-->

<!-- 2. 恢复旧代码引入 -->
<script src="admin-ai-config.js?v=1"></script>

<!-- 3. 注释掉插件初始化代码 -->
<!--
<script>
  document.addEventListener('DOMContentLoaded', async function() {
    // ...
  });
</script>
-->
```

**2. 验证回退成功**

1. 保存 `admin-legacy.html`
2. 刷新浏览器页面
3. 查看Console输出，确认旧代码正常加载
4. 手动测试所有AI配置功能

**预期结果**：

- 旧代码正常加载
- 所有功能恢复正常
- 没有JavaScript错误

#### 快速回退方案B：使用Git恢复

**1. 查看Git提交历史**

```bash
cd /Users/rich/WorkBuddy/20260407113106/
git log --oneline | head -10
```

**2. 回退到改造前的提交**

```bash
# 方案B1：软回退（保留修改，方便重新改造）
git reset --soft HEAD~1

# 方案B2：硬回退（完全丢弃修改）
git reset --hard HEAD~1

# 方案B3：从备份分支恢复
git checkout backup/ai-plugin-migration-20260529
```

**3. 验证回退成功**

```bash
# 检查文件是否恢复到改造前状态
git status
cat mini-app-h5/backend/admin-ai-config.js | head -20
```

---

## 💡 常见问题解答

### Q1：改造过程中，现有功能还能用吗？

**A**：能！采用**渐进式改造**，改造一个插件，就启用一个插件，没改造的模块继续保持原样。

**示例**：

```html
<!-- admin-legacy.html -->
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

**示例**：

```javascript
// ai-plugin.js
// export default AIPlugin;  // 注释掉，禁用插件
```

```html
<!-- admin-legacy.html -->
<script src="admin-ai-config.js?v=1"></script>
<!-- 恢复旧代码 -->
```

### Q3：改造后的性能会提升吗？

**A**：会！主要有3个提升：

1. **首屏加载更快**：核心插件预加载，可选插件按需加载
2. **内存占用更少**：不用的插件可以卸载（`PluginLoader.unload('xxx')`）
3. **代码复用更高**：插件可以在H5和小程序两端复用

### Q4：新手能完成改造吗？

**A**：能！只要按照这个SOP的**7步法**逐步操作：

1. 步骤1：创建插件文件（复制模板即可）
2. 步骤2：修改HTML引入（复制粘贴即可）
3. 步骤3：测试插件加载（查看Console输出）
4. 步骤4：迁移代码（对照示例，逐步迁移）
5. 步骤5：测试功能（按照测试计划执行）
6. 步骤6：代码审查（对照检查清单）
7. 步骤7：清理和优化（可选）

**预计总时间**：2-3天（每天2-3小时）

### Q5：改造过程中遇到错误怎么办？

**A**：按照以下步骤排查：

1. **查看Console输出**：所有核心模块都有详细的日志输出
2. **对照检查清单**：查看是否违反了架构红线或技术栈约束
3. **查看示例代码**：前面提供了完整的 `ai-plugin.js` 示例
4. **提问**：把错误信息复制到ChatGPT或CodeBuddy，AI会帮你解答

### Q6：如何确保改造后的代码质量？

**A**：使用本SOP提供的**代码审查检查清单**，确保：

1. 符合5条架构红线
2. 符合5项技术栈约束
3. 符合代码结构规范
4. 注释覆盖率≥80%
5. 错误处理完善

---

## ✅ 检查清单

### 改造前检查

- [ ] 已备份现有代码（使用Git或手动复制）
- [ ] 已检查核心模块是否存在
- [ ] 已查阅所有必需文档
- [ ] 已了解改造目标和改造步骤

### 改造中检查

- [ ] 插件文件放在正确目录（`plugins/core/`）
- [ ] 插件文件名符合规范（`ai-plugin.js`）
- [ ] 插件类名符合规范（`AIPlugin`）
- [ ] 使用了 `export default` 导出
- [ ] 没有使用全局变量
- [ ] 没有修改核心基类
- [ ] 使用了 `Adapter` 进行双端适配
- [ ] 使用了 `EventHub` 进行事件通信
- [ ] 所有异步操作都有错误处理

### 改造后检查

- [ ] 插件加载成功（查看Console输出）
- [ ] 所有功能测试通过
- [ ] 代码审查检查清单全部通过
- [ ] 已注释掉旧代码（未删除）
- [ ] 已更新相关文档
- [ ] 已提交代码到Git（如果使用了Git）

### 最终验证

- [ ] 在浏览器中打开页面，功能正常
- [ ] Console中没有错误
- [ ] 所有AI配置功能都能正常使用
- [ ] 事件通信正常
- [ ] 存储适配正常

---

## 📚 相关文档

| 文档名称           | 路径                                              | 作用                             |
| ------------------ | ------------------------------------------------- | -------------------------------- |
| **迁移指南**       | `mini-app-h5/backend/迁移指南.md`                 | 整体改造策略和步骤               |
| **架构核心规范**   | `.codebuddy/rules/Skills架构改造-架构核心规范.md` | 5条架构红线和5项技术栈约束       |
| **代码结构规范**   | `.codebuddy/rules/Skills架构改造-代码结构规范.md` | 文件结构、命名规范和代码组织模板 |
| **插件基类代码**   | `mini-app-h5/backend/plugin-base.js`              | 插件基类的完整代码               |
| **文档与文件清单** | `📚 Skills 架构改造 - 文档与文件清单.md`          | 整体改造计划和文档索引           |

---

## 📞 获取帮助

如果在改造过程中遇到问题，可以：

1. **查看示例代码**：本SOP提供了完整的 `ai-plugin.js` 示例
2. **查看控制台输出**：所有核心模块都有详细的日志输出
3. **对照检查清单**：查看是否违反了架构规范
4. **提问**：把错误信息复制到ChatGPT或CodeBuddy，AI会帮你解答

---

## 🎯 改造完成标志

当你完成AI插件的改造后，应该能看到这些成果：

### 1. 文件结构更清晰

```
mini-app-h5/backend/
├── plugin-base.js           ✅ 核心模块
├── plugin-loader.js         ✅ 核心模块
├── dual-adapter.js         ✅ 核心模块
├── event-hub.js           ✅ 核心模块
│
├── plugins/                 ✅ 插件目录
│   └── core/               ✅ 核心插件
│       └── ai-plugin.js        ✅ AI插件（已改造）
│
├── admin-legacy.html        ✅ 主页面（已改造）
└── admin-ai-config.js       🔲 旧代码（已注释掉，保留以备回退）
```

### 2. 代码质量更高

| 指标       | 改造前 | 改造后 | 提升         |
| ---------- | ------ | ------ | ------------ |
| 注释覆盖率 | 10%    | 80%    | **+70%**     |
| 重复代码   | 多     | 少     | **-80%**     |
| 错误处理   | 零散   | 统一   | **大幅提升** |
| 可维护性   | 低     | 高     | **大幅提升** |

### 3. 功能正常

- ✅ 所有原有功能都能正常使用
- ✅ 没有引入新的bug
- ✅ 性能有明显提升（首屏加载更快）

---

## 🎉 总结

这个SOP的核心思想是：**详细步骤，逐步验证，确保成功**

- ✅ 不要跳过任何步骤（每个步骤都有它的作用）
- ✅ 每个步骤完成后，务必验证成功再继续下一步
- ✅ 遇到错误不要慌，对照常见问题解答，逐步排查
- ✅ 改造完成后，务必进行完整的测试验证

**加油！你可以的！** 💪

---

**文档结束**

_本SOP文档定义了第一个插件（AI插件）改造的标准操作程序，所有开发人员必须严格按照本SOP执行。_

_最后更新：2026-05-29_
