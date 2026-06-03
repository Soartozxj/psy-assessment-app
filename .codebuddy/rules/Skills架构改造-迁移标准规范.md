# 📘 Skills架构改造 - 迁移标准规范

**版本**: v2.0.0  
**日期**: 2026-05-28  
**状态**: 强制执行  
**适用对象**: 所有参与改造的开发人员  
**依赖规则**: `Skills架构改造-架构核心规范.md`, `Skills架构改造-代码结构规范.md`

---

## 🔄 旧代码迁移标准

### 3.1 迁移优先级（强制顺序）

**必须按照以下顺序迁移**（从简单到复杂）：

| 顺序 | 原文件                | 目标插件            | 难度     | 依赖关系     |
| ---- | --------------------- | ------------------- | -------- | ------------ |
| 1    | `admin-ai-config.js`  | `ai-plugin.js`      | ⭐⭐     | 无           |
| 2    | `admin-auth.js`       | `auth-plugin.js`    | ⭐⭐     | 无           |
| 3    | `admin-scale-list.js` | `scale-plugin.js`   | ⭐⭐⭐   | 依赖AI插件   |
| 4    | `admin-scoring.js`    | `scoring-plugin.js` | ⭐⭐⭐   | 依赖量表插件 |
| 5    | `admin-npc.js`        | `npc-plugin.js`     | ⭐⭐⭐⭐ | 依赖AI插件   |

**强制规则**：

1. 必须完成前一个插件改造，并通过测试后，才能开始下一个
2. 禁止跳过优先级直接改造复杂插件

### 3.2 迁移步骤（标准流程）

**每个插件改造必须遵循以下步骤**：

#### 步骤1：创建插件文件

```bash
# 在正确的目录创建文件
touch mini-app-h5/backend/plugins/core/{插件名}-plugin.js
```

#### 步骤2：复制模板代码

- 从架构文档复制插件模板
- 修改类名、插件名、版本号

#### 步骤3：迁移原代码

**必须按以下顺序迁移**：

1. **配置和状态变量** → 迁移到构造函数

   ```javascript
   // 原代码（admin-ai-config.js）
   let apiKey = '';
   let modelName = 'qwen-max';

   // 改造后（ai-plugin.js）
   constructor() {
     super({...});
     this._apiKey = '';
     this._modelName = 'qwen-max';
   }
   ```

2. **初始化逻辑** → 迁移到 `onInit()` 方法

   ```javascript
   // 原代码（admin-ai-config.js）
   document.addEventListener('DOMContentLoaded', function() {
     loadAIConfig();
   });

   // 改造后（ai-plugin.js）
   async onInit() {
     await this._loadConfig();
   }
   ```

3. **业务逻辑** → 迁移到 `onExecute()` 方法

   ```javascript
   // 原代码（admin-ai-config.js）
   function testConnection() { ... }

   // 改造后（ai-plugin.js）
   async onExecute(params = {}) {
     if (params.action === 'test') {
       return await this._testConnection();
     }
   }
   ```

4. **事件监听** → 使用 `registerEventListener()`

   ```javascript
   // 原代码（admin-ai-config.js）
   document.getElementById('btn-test').addEventListener('click', testConnection);

   // 改造后（ai-plugin.js）
   async onInit() {
     this.registerEventListener('ui-button-click', (data) => {
       if (data.buttonId === 'btn-test') {
         this._testConnection();
       }
     });
   }
   ```

#### 步骤4：删除内联onclick

**强制规则**：

- 禁止在HTML中使用内联 `onclick="xxx()"`
- 必须改用 `EventHub` 或 `addEventListener`

```html
<!-- ❌ 错误（原代码） -->
<button onclick="testConnection()">测试</button>

<!-- ✅ 正确（改造后） -->
<button data-action="test-connection">测试</button>

<script>
  // 在插件中注册事件
  this.registerEventListener('ui-button-click', (data) => {
    if (data.action === 'test-connection') {
      this._testConnection();
    }
  });
</script>
```

#### 步骤5：测试验证

**必须通过的测试**：

1. 插件加载测试：`PluginLoader.get('xxx')` 返回插件实例
2. 功能测试：所有原有功能正常工作
3. 事件通信测试：插件间通过EventHub通信正常
4. 双端适配测试：H5和小程序都能正常运行

### 3.3 兼容性要求（强制）

**向后兼容规则**：

1. **HTML文件必须同时保持新旧两种方式**

   ```html
   <!-- 改造后的页面必须同时支持 -->
   <script>
     document.addEventListener('DOMContentLoaded', async function () {
       // 尝试加载新插件
       await PluginLoader.load('ai', true);

       // 如果新插件加载失败，回退到旧方式
       if (!PluginLoader.get('ai')) {
         console.warn('⚠️ 新插件加载失败，使用旧方式');
         await loadScript('admin-ai-config.js');
       }
     });
   </script>
   ```

2. **API接口必须保持兼容**

   ```javascript
   // 旧代码（admin-ai-config.js）
   function testConnection() { ... }
   window.testConnection = testConnection;

   // 新代码（ai-plugin.js）必须同时暴露相同的全局函数
   class AIPlugin extends PluginBase {
     async onInit() {
       // 兼容旧代码：暴露全局函数
       window.testConnection = this._testConnection.bind(this);
     }
   }
   ```

---

## 📋 规则详解

### 迁移优先级详解

#### 为什么必须按照顺序迁移？

1. **从简单到复杂**：
   - AI插件和Auth插件相对独立，依赖少，适合作为起点
   - 量表插件依赖AI插件（用于AI辅助计分）
   - 计分插件依赖量表插件
   - NPC插件依赖AI插件（用于AI对话）

2. **依赖关系管理**：
   - 先完成被依赖的插件，确保后续插件可以正常集成
   - 避免循环依赖

#### 迁移难度说明

| 难度     | 说明               | 预计时间 |
| -------- | ------------------ | -------- |
| ⭐⭐     | 独立插件，逻辑简单 | 1-2天    |
| ⭐⭐⭐   | 有依赖，逻辑中等   | 2-3天    |
| ⭐⭐⭐⭐ | 复杂依赖，逻辑复杂 | 3-5天    |

### 迁移步骤详解

#### 步骤1：创建插件文件

**为什么要在正确目录创建？**

- 核心插件必须放在 `plugins/core/` 目录
- 可选插件必须放在 `plugins/optional/` 目录
- 便于 PluginLoader 自动发现和加载

#### 步骤2：复制模板代码

**为什么使用模板？**

- 确保所有插件结构一致
- 避免遗漏必要的方法（如 `onInit()`, `onExecute()`）
- 提高开发效率

#### 步骤3：迁移原代码

**迁移顺序的重要性**：

1. **配置和状态变量** → 构造函数：确保插件实例化时状态正确
2. **初始化逻辑** → `onInit()`：确保插件初始化时完成必要设置
3. **业务逻辑** → `onExecute()`：确保插件可以响应外部调用
4. **事件监听** → `registerEventListener()`：确保插件可以响应事件

**关键变化**：

- 全局变量 → 插件私有属性（加下划线前缀）
- 全局函数 → 插件私有方法（加下划线前缀）
- 直接事件绑定 → 通过 EventHub 解耦

#### 步骤4：删除内联onclick

**为什么禁止内联onclick？**

- 内联事件处理难以维护和测试
- 与HTML结构耦合度高
- 无法通过 EventHub 统一管理

**正确做法**：

- 使用 `data-action` 属性标识按钮
- 在插件中通过 `registerEventListener()` 监听事件
- 通过 EventHub 解耦事件发送者和接收者

#### 步骤5：测试验证

**为什么需要测试验证？**

- 确保迁移后的插件功能正常
- 确保插件间通信正常
- 确保双端适配正常

**测试清单**：

- [ ] 插件加载测试
- [ ] 功能测试
- [ ] 事件通信测试
- [ ] 双端适配测试

### 兼容性要求详解

#### 为什么需要向后兼容？

1. **平滑迁移**：
   - 允许新旧代码共存，逐步迁移
   - 降低迁移风险

2. **回滚能力**：
   - 如果新插件出现问题，可以快速回滚到旧代码
   - 提高系统稳定性

#### 如何实现向后兼容？

1. **HTML文件同时支持新旧方式**：
   - 先尝试加载新插件
   - 如果失败，回退到旧方式

2. **API接口保持兼容**：
   - 新插件必须暴露与旧代码相同的全局函数
   - 确保外部调用不需要修改

---

## 🔗 相关规则

- **架构核心规范**: 参见 `Skills架构改造-架构核心规范.md`
- **代码结构规范**: 参见 `Skills架构改造-代码结构规范.md`
- **异常处理规范**: 参见 `Skills架构改造-异常处理规范.md`
- **日志记录规范**: 参见 `Skills架构改造-日志记录规范.md`
- **安全规范**: 参见 `Skills架构改造-安全规范.md`

---

## ✅ 检查清单

### 迁移前检查

- [ ] 已了解迁移优先级，按顺序迁移
- [ ] 已创建插件文件在正确目录
- [ ] 已复制插件模板代码

### 迁移中检查

- [ ] 配置和状态变量已迁移到构造函数
- [ ] 初始化逻辑已迁移到 `onInit()` 方法
- [ ] 业务逻辑已迁移到 `onExecute()` 方法
- [ ] 事件监听已使用 `registerEventListener()`
- [ ] 已删除内联 `onclick`

### 迁移后检查

- [ ] 插件加载测试通过
- [ ] 功能测试通过
- [ ] 事件通信测试通过
- [ ] 双端适配测试通过
- [ ] 向后兼容规则已遵循

---

**文档结束**

_本规范定义了 Skills 架构改造的旧代码迁移标准，所有开发人员必须严格遵守。_
