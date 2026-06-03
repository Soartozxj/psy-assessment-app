# 📘 Skills架构改造 - 异常处理与日志规范

**版本**: v4.0.0  
**日期**: 2026-05-29  
**状态**: 强制执行  
**适用对象**: 所有参与改造的开发人员  
**依赖规则**: `Skills架构改造-架构核心规范.md`, `Skills架构改造-代码结构规范.md`

---

## 🛡️ 异常处理规范

### 4.1 异常处理（强制）

**必须遵循的异常处理规则**：

1. **所有异步函数必须用 try-catch**

   ```javascript
   // ❌ 错误（没有异常处理）
   async onInit() {
     const config = await this._loadConfig();
   }

   // ✅ 正确（有异常处理）
   async onInit() {
     try {
       const config = await this._loadConfig();
       this._config = config;
     } catch (error) {
       console.error('❌ 加载配置失败:', error);
       this.showToast('加载配置失败', 'error');
       throw error; // 重新抛出，让调用者知道失败了
     }
   }
   ```

2. **禁止使用空的catch块**

   ```javascript
   // ❌ 错误（空的catch块）
   try {
     await this._loadConfig();
   } catch (error) {
     // 什么都没做
   }

   // ✅ 正确（至少记录日志）
   try {
     await this._loadConfig();
   } catch (error) {
     console.error('❌ 加载配置失败:', error);
     // 可以选择重试、显示错误提示、或使用默认值
   }
   ```

3. **必须区分可恢复错误和致命错误**
   ```javascript
   class AIPlugin extends PluginBase {
     async _testConnection() {
       try {
         const result = await this._callAPI();
         return result;
       } catch (error) {
         if (error.code === 'NETWORK_ERROR') {
           // 可恢复错误：提示用户检查网络
           this.showToast('网络错误，请检查网络连接', 'warning');
           return { success: false, error: 'NETWORK_ERROR' };
         } else {
           // 致命错误：记录并重新抛出
           console.error('❌ API调用失败:', error);
           throw error;
         }
       }
     }
   }
   ```

---

## 📊 日志记录规范

### 4.2 日志记录（强制）

**日志级别规范**：

| 级别      | 方法                     | 使用场景               | 示例                                            |
| --------- | ------------------------ | ---------------------- | ----------------------------------------------- |
| **DEBUG** | `Adapter.logger.debug()` | 调试信息（仅开发模式） | `Adapter.logger.debug('配置加载完成', config)`  |
| **INFO**  | `Adapter.logger.info()`  | 重要流程信息           | `Adapter.logger.info('用户登录成功', userId)`   |
| **WARN**  | `Adapter.logger.warn()`  | 警告信息               | `Adapter.logger.warn('API限流，等待重试')`      |
| **ERROR** | `Adapter.logger.error()` | 错误信息               | `Adapter.logger.error('数据库连接失败', error)` |

**强制规则**：

1. **禁止使用 `console.log()`**
   - 必须用 `Adapter.logger.xxx()` 替代
   - 原因：Adapter会自动根据环境决定是否输出

2. **关键操作必须记录日志**

   ```javascript
   class AIPlugin extends PluginBase {
     async _callAPI(prompt) {
       // 记录输入
       Adapter.logger.info('调用AI API', { promptLength: prompt.length });

       try {
         const result = await fetch('https://api.xxx.com/generate', {...});

         // 记录输出
         Adapter.logger.info('AI API调用成功', { resultLength: result.length });

         return result;
       } catch (error) {
         // 记录错误
         Adapter.logger.error('AI API调用失败', error);
         throw error;
       }
     }
   }
   ```

3. **日志必须包含关键上下文**

   ```javascript
   // ❌ 错误（缺少上下文）
   Adapter.logger.info('加载完成');

   // ✅ 正确（包含关键信息）
   Adapter.logger.info('配置加载完成', {
     pluginName: this.name,
     configKeys: Object.keys(this._config),
     loadTime: Date.now() - startTime + 'ms'
   });
   ```

---

## 📋 规则详解

### 异常处理详解

#### 1. 为什么所有异步函数必须用 try-catch？

**原因**：

- 异步操作容易失败（网络错误、API错误、超时等）
- 未捕获的异常会导致整个插件崩溃
- 必须优雅地处理错误，提供友好的用户提示

**最佳实践**：

```javascript
async function example() {
  try {
    const result = await asyncOperation();
    return result;
  } catch (error) {
    // 1. 记录错误
    Adapter.logger.error('操作失败', error);

    // 2. 显示用户提示
    this.showToast('操作失败，请重试', 'error');

    // 3. 决定是重新抛出还是返回错误对象
    // 如果是致命错误，重新抛出
    // 如果是可恢复错误，返回错误对象
    throw error; // 或 return { success: false, error: error.message };
  }
}
```

#### 2. 为什么禁止空的catch块？

**原因**：

- 空的catch块会吞掉错误，导致难以调试
- 至少应该记录日志，便于排查问题

**正确做法**：

```javascript
try {
  await this._loadConfig();
} catch (error) {
  // 至少记录日志
  Adapter.logger.error('加载配置失败', error);

  // 可以选择：
  // 1. 重试
  // 2. 使用默认值
  // 3. 显示错误提示
  // 4. 重新抛出
}
```

#### 3. 为什么必须区分可恢复错误和致命错误？

**原因**：

- 可恢复错误：可以提示用户，让用户决定是否重试
- 致命错误：必须抛出，让上层处理

**错误分类**：

- **可恢复错误**：网络错误、超时、API限流等
- **致命错误**：配置错误、代码错误、系统错误等

### 日志记录详解

#### 1. 为什么禁止使用 `console.log()`？

**原因**：

- `Adapter.logger` 会根据环境自动决定是否输出
- 在生产环境可以自动关闭日志，避免性能问题
- 提供统一的日志格式和级别控制

**正确做法**：

```javascript
// ❌ 错误
console.log('加载完成');
console.error('加载失败', error);

// ✅ 正确
Adapter.logger.info('加载完成');
Adapter.logger.error('加载失败', error);
```

#### 2. 为什么关键操作必须记录日志？

**原因**：

- 便于排查问题
- 了解系统运行状态
- 审计和监控

**必须记录日志的操作**：

- 插件初始化
- API调用
- 用户登录/登出
- 数据加载/保存
- 错误处理

#### 3. 为什么日志必须包含关键上下文？

**原因**：

- 仅凭一条日志无法判断问题所在
- 上下文信息有助于快速定位问题

**日志上下文示例**：

```javascript
Adapter.logger.info('配置加载完成', {
  pluginName: this.name, // 插件名称
  configKeys: Object.keys(config), // 配置项
  loadTime: elapsedTime + 'ms' // 加载时间
});
```

---

## 🔗 相关规则

- **架构核心规范**: 参见 `Skills架构改造-架构核心规范.md`（定义架构红线）
- **代码结构规范**: 参见 `Skills架构改造-代码结构规范.md`
- **安全规范**: 参见 `Skills架构改造-安全规范.md`

---

## ✅ 检查清单

### 异常处理检查

- [ ] 所有异步函数都有 `try-catch` 异常处理
- [ ] 没有使用空的catch块
- [ ] 区分了可恢复错误和致命错误
- [ ] 错误被正确记录并重新抛出或返回错误对象

### 日志记录检查

- [ ] 没有使用 `console.log()`（改用 `Adapter.logger`）
- [ ] 关键操作都记录了日志
- [ ] 日志包含了关键上下文信息
- [ ] 使用了正确的日志级别（DEBUG/INFO/WARN/ERROR）

---

**文档结束**

_本规范定义了 Skills 架构改造的异常处理与日志记录规则，所有开发人员必须严格遵守。_
