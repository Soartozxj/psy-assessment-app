# 📘 Skills架构改造 - 安全规范

**版本**: v3.0.0  
**日期**: 2026-05-29  
**状态**: 强制执行  
**适用对象**: 所有参与改造的开发人员  
**依赖规则**: `Skills架构改造-架构核心规范.md`, `Skills架构改造-代码结构规范.md`

---

## 🔒 安全规范（强制）

### 4.3 安全规范（强制）

**安全检查清单**（每个插件必须检查）：

1. **输入验证**

   ```javascript
   class AIPlugin extends PluginBase {
     async onExecute(params = {}) {
       // 必须验证输入
       if (!params.prompt || typeof params.prompt !== 'string') {
         throw new Error('prompt 必须是非空字符串');
       }

       if (params.prompt.length > 10000) {
         throw new Error('prompt 长度不能超过10000字符');
       }

       // 防止注入攻击
       const sanitizedPrompt = this._sanitizeInput(params.prompt);

       return await this._callAPI(sanitizedPrompt);
     }

     _sanitizeInput(input) {
       // 移除可能的恶意代码
       return input
         .replace(/<script.*?>.*?<\/script>/gi, '')
         .replace(/javascript:/gi, '')
         .trim();
     }
   }
   ```

2. **API密钥保护**

   ```javascript
   class AIPlugin extends PluginBase {
     async _callAPI(prompt) {
       // ❌ 错误（硬编码密钥）
       const apiKey = 'sk-xxxxxxxxxxxxx';

       // ✅ 正确（从安全存储读取）
       const apiKey = Adapter.storage.get('ai_api_key');

       // ✅ 正确（不在日志中输出密钥）
       Adapter.logger.info('调用AI API', { promptLength: prompt.length });
       // 不要这样做：Adapter.logger.info('API Key:', apiKey);

       return await fetch('https://api.xxx.com/generate', {
         headers: {
           Authorization: `Bearer ${apiKey}`
         },
         body: JSON.stringify({ prompt })
       });
     }
   }
   ```

3. **XSS防护**
   ```javascript
   class ScalePlugin extends PluginBase {
     _renderScale(scaleData) {
       // ❌ 错误（直接插入HTML）
       document.getElementById('scale-content').innerHTML = scaleData.content;

       // ✅ 正确（使用textContent或转义）
       const contentEl = document.getElementById('scale-content');
       contentEl.textContent = scaleData.content; // 自动转义

       // 或者：如果需要支持HTML，必须转义
       const sanitizedHTML = this._escapeHTML(scaleData.content);
       contentEl.innerHTML = sanitizedHTML;
     }

     _escapeHTML(html) {
       const div = document.createElement('div');
       div.textContent = html;
       return div.innerHTML;
     }
   }
   ```

---

## 📋 规则详解

### 安全规范详解

#### 1. 为什么必须输入验证？

**原因**：

- 防止注入攻击（XSS、SQL注入等）
- 确保数据完整性和正确性
- 避免程序崩溃

**验证内容**：

- 类型验证（必须是字符串、数字等）
- 长度验证（不能超过最大长度）
- 格式验证（必须符合特定格式）
- 范围验证（必须在合理范围内）

#### 2. 为什么必须保护API密钥？

**原因**：

- API密钥是敏感信息，泄露会导致安全问题
- 硬编码密钥会被提交到代码仓库，造成泄露

**正确做法**：

- 从环境变量或安全存储读取
- 不在日志中输出密钥
- 定期轮换密钥

#### 3. 为什么必须XSS防护？

**原因**：

- XSS攻击可以窃取用户信息、执行恶意代码
- 直接插入HTML而不转义是常见的XSS漏洞

**正确做法**：

- 优先使用 `textContent` 而不是 `innerHTML`
- 如果必须使用 `innerHTML`，必须转义
- 使用安全的DOM操作方法

---

## 🔗 相关规则

- **架构核心规范**: 参见 `Skills架构改造-架构核心规范.md`
- **代码结构规范**: 参见 `Skills架构改造-代码结构规范.md`
- **异常处理规范**: 参见 `Skills架构改造-异常处理规范.md`
- **日志记录规范**: 参见 `Skills架构改造-日志记录规范.md`

---

## ✅ 检查清单

### 安全规范检查

- [ ] 所有用户输入都进行了验证和转义
- [ ] API密钥没有硬编码，存储在安全位置
- [ ] 没有XSS漏洞（正确使用 `textContent` 或转义）
- [ ] 没有SQL注入风险（使用参数化查询）

---

**文档结束**

_本规范定义了 Skills 架构改造的安全规则，所有开发人员必须严格遵守。_
