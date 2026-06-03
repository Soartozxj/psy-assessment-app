# 📘 Skills架构改造 - 改造禁止事项规范

**版本**: v2.0.0  
**日期**: 2026-05-28  
**状态**: 强制执行  
**适用对象**: 所有参与改造的开发人员  
**依赖规则**: `Skills架构改造-架构核心规范.md`, `Skills架构改造-代码结构规范.md`, `Skills架构改造-迁移标准规范.md`, `Skills架构改造-异常处理与日志规范.md`, `Skills架构改造-安全规范.md`

---

## 🚫 改造禁止事项（红线）

### 5.1 架构层面禁止

❌ **以下行为严格禁止**（详见《架构核心规范》第1.1节）：

1. **禁止修改核心基类**
   - 详见《架构核心规范》第1.1节"架构红线"
   - 核心基类列表：`plugin-base.js`、`plugin-loader.js`、`dual-adapter.js`、`event-hub.js`

   **本规范补充**：修改核心基类的影响和正确做法参见《架构核心规范》第1.1节

2. **禁止创建新的基类或加载器**
   - 详见《架构核心规范》第1.1节"架构红线"
   - 必须使用架构提供的标准基类

3. **禁止插件间直接通信**
   - 详见《架构核心规范》第1.1节"架构红线"
   - 必须通过 `EventHub` 解耦

### 5.2 代码层面禁止

❌ **以下代码模式严格禁止**（详见《代码风格规范》相关章节）：

1. **禁止使用全局变量**
   - 详见《架构核心规范》第1.1节"架构红线"
   - 详见《代码风格规范》第6.1节"反模式与禁止事项"

   **本规范补充**：全局变量的危害和正确做法参见《架构核心规范》详解

2. **禁止使用 `eval()` 或 `Function()` 构造函数**
   - 详见《代码风格规范》第6.1节"反模式与禁止事项"

   **本规范补充**：安全风险说明参见下文"为什么禁止"部分

3. **禁止使用同步的API调用**
   - 详见《代码风格规范》第5.6节"异步编程最佳实践"

   **本规范补充**：性能影响说明参见下文"为什么禁止"部分

### 5.3 性能层面禁止

❌ **以下性能陷阱严格禁止**：

1. **禁止在循环中进行DOM操作**

   ```javascript
   // ❌ 错误（每次循环都操作DOM）
   for (const item of items) {
     const div = document.createElement('div');
     div.textContent = item.name;
     document.getElementById('container').appendChild(div);
   }

   // ✅ 正确（使用文档片段或innerHTML）
   const fragment = document.createDocumentFragment();
   for (const item of items) {
     const div = document.createElement('div');
     div.textContent = item.name;
     fragment.appendChild(div);
   }
   document.getElementById('container').appendChild(fragment);
   ```

2. **禁止频繁触发重排/重绘**

   ```javascript
   // ❌ 错误（多次修改样式触发多次重排）
   element.style.width = '100px';
   element.style.height = '200px';
   element.style.backgroundColor = 'red';

   // ✅ 正确（使用class或cssText批量修改）
   element.className = 'new-style'; // 提前定义好CSS类
   // 或者
   element.style.cssText = 'width:100px;height:200px;background-color:red;';
   ```

3. **禁止内存泄漏**

   ```javascript
   // ❌ 错误（事件监听器没有清理）
   class MyPlugin extends PluginBase {
     async onInit() {
       document.getElementById('btn').addEventListener('click', () => {
         this._handleClick();
       });
     }
     // 忘记在 onDestroy() 中移除监听器
   }

   // ✅ 正确（使用 registerEventListener 自动清理）
   class MyPlugin extends PluginBase {
     async onInit() {
       this.registerEventListener('ui-button-click', (data) => {
         if (data.buttonId === 'btn') {
           this._handleClick();
         }
       });
     }

     onDestroy() {
       // registerEventListener 注册的事件会自动清理
       // 只需要清理手动添加的监听器
     }
   }
   ```

---

## 📋 规则详解

### 架构层面禁止详解

#### 1. 为什么禁止修改核心基类？

**原因**：

- 核心基类是所有插件的基础
- 修改会导致所有插件失效
- 破坏架构的稳定性

**正确做法**：

- 如果需要扩展功能，在插件内部实现
- 如果需要修改核心基类，先提出PR，经过团队讨论和测试

#### 2. 为什么禁止创建新的基类或加载器？

**原因**：

- 导致架构不统一，增加维护成本
- 其他开发人员会感到困惑

**正确做法**：

- 使用架构提供的标准基类
- 如果标准基类不满足需求，提出改进建议

#### 3. 为什么禁止插件间直接通信？

**原因**：

- 导致插件耦合度高，难以独立测试和替换
- 破坏插件的独立性

**正确做法**：

- 使用 `EventHub` 进行插件间通信
- 定义清晰的事件接口

### 代码层面禁止详解

（本部分详解已移至《代码风格规范》第6章"反模式与禁止事项"）

#### 1. 为什么禁止使用全局变量？

**详见**《架构核心规范》第1.1节"架构红线"和《代码风格规范》第6.1节。

#### 2. 为什么禁止使用内联事件处理

**详见**《代码风格规范》第3.5节"事件处理"和《迁移标准规范》第3.2节"步骤4：删除内联onclick"。

#### 3. 为什么禁止使用 `eval()` 或 `Function()` 构造函数？

**详见**《代码风格规范》第6.3节"禁止使用 `eval()`"。

#### 4. 为什么禁止使用同步的API调用？

**详见**《代码风格规范》第5.6节"异步编程最佳实践"。

### 性能层面禁止详解

（本部分详解已移至《代码风格规范》第5章"语言特定最佳实践"）

#### 1. 为什么禁止在循环中进行DOM操作？

**详见**《代码风格规范》第5.7节"DOM操作最佳实践"。

#### 2. 为什么禁止频繁触发重排/重绘？

**详见**《代码风格规范》第5.7节"DOM操作最佳实践"。

#### 3. 为什么禁止内存泄漏？

**详见**《异常处理与日志规范》第4.3节"安全规范"和《代码结构规范》第2.3节"代码组织"。

---

## 🔗 相关规则

- **架构核心规范**: 参见 `Skills架构改造-架构核心规范.md`
- **代码结构规范**: 参见 `Skills架构改造-代码结构规范.md`
- **迁移标准规范**: 参见 `Skills架构改造-迁移标准规范.md`
- **异常处理规范**: 参见 `Skills架构改造-异常处理规范.md`
- **日志记录规范**: 参见 `Skills架构改造-日志记录规范.md`
- **安全规范**: 参见 `Skills架构改造-安全规范.md`

---

## ✅ 检查清单

### 架构层面检查

- [ ] 没有修改核心基类文件
- [ ] 没有创建新的基类或加载器
- [ ] 插件间没有直接通信（通过 EventHub 通信）

### 代码层面检查

- [ ] 没有使用全局变量
- [ ] 没有使用内联事件处理
- [ ] 没有使用 `eval()` 或 `Function()` 构造函数
- [ ] 没有使用同步的API调用

### 性能层面检查

- [ ] 没有在循环中进行DOM操作
- [ ] 没有频繁触发重排/重绘
- [ ] 没有内存泄漏（事件监听器正确清理）

---

**文档结束**

_本规范定义了 Skills 架构改造的禁止事项，所有开发人员必须严格遵守。_
