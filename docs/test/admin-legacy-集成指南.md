# admin-legacy.html 集成指南

**目标**: 将以下优化模块集成到 `admin-legacy.html` 中：
1. Mock 系统（mock-server.js）
2. Hash 路由系统（router.js）
3. 表单校验（form-validator.js）
4. 统一异常处理（error-handler.js）

---

## 一、引入新模块

### 步骤 1：在 `<head>` 中添加脚本引用

在 `admin-legacy.html` 的 `<head>` 标签内，找到现有的 `<script>` 标签区域，在 `Chart.js CDN` 脚本之后添加以下代码：

```html
    <!-- Chart.js CDN - 用于数据看板图表渲染 -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

    <!-- ✅ 优化1：统一异常处理机制（报告 P0 级别） -->
    <script src="error-handler.js?v=2026060501"></script>

    <!-- ✅ 优化2：表单校验工具库（报告 P0 级别） -->
    <script src="form-validator.js?v=2026060501"></script>

    <!-- ✅ 优化3：Hash 路由系统（报告 P0 级别） -->
    <script src="router.js?v=2026060501"></script>

    <!-- ✅ 优化4：本地 Mock 系统（报告 P0 级别，开发环境用） -->
    <!-- 生产环境请删除此行 -->
    <script src="mock-server.js?v=2026060501"></script>

    <!-- ✅ 原有：认证插件（通过 PluginLoader 自动加载，保留向后兼容） -->
    <!-- 旧文件 admin-auth.js 已被 auth-plugin.js 替代 -->
```

**说明**：
- `error-handler.js` - 统一异常处理，所有 API 调用和业务流程的错误处理
- `form-validator.js` - 表单校验，用于量表表单、AI 配置表单等
- `router.js` - Hash 路由，支持浏览器前进/后退和深度链接
- `mock-server.js` - 本地 Mock 系统，拦截 API 请求返回模拟数据

---

## 二、启用本地 Mock 模式

### 步骤 2：设置 Mock 模式开关

在 `admin-legacy.html` 的 `<script>` 标签内，添加以下代码来启用 Mock 模式：

```javascript
    <script>
      // ✅ 优化4：启用本地 Mock 模式（报告 P0 级别）
      // 设置为 true 启用 Mock（本地测试无后端时使用）
      // 设置为 false 禁用 Mock（连接真实后端时使用）
      window.USE_MOCK = true; // 本地测试用 true，生产环境用 false

      // 生产环境禁用 Mock（URL 不包含 localhost 时自动禁用）
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        window.USE_MOCK = false;
      }
    </script>
```

**位置**：放在 `<head>` 标签内的其他 `<script>` 标签之前（确保在其他脚本加载前执行）。

---

## 三、初始化路由系统

### 步骤 3：在页面加载完成后初始化路由

在 `admin-legacy.html` 末尾的 `<script>` 标签内，添加路由初始化代码：

```javascript
    <script>
      // ✅ 优化2：初始化 Hash 路由系统（报告 P0 级别）
      document.addEventListener('DOMContentLoaded', function() {
        if (window.Router) {
          console.log('🧭 路由系统已启动');
          console.log('   当前路由：', Router.getCurrentRoute());
          console.log('   使用方法：');
          console.log('   - 跳转：Router.navigate("scales")');
          console.log('   - 浏览器直接输入：http://localhost:8080/admin-legacy.html#scales');
        }
      });
    </script>
```

**位置**：放在 `</body>` 标签之前。

---

## 四、集成表单校验

### 步骤 4：在量表表单页面集成校验

在 `admin-scale-form.js` 文件中，修改 `openScaleModal()` 函数，添加表单校验：

```javascript
// ✅ 优化3：集成表单校验（报告 P0 级别）
let scaleFormValidator = null;

function initScaleFormValidator() {
  // 创建校验器
  scaleFormValidator = createScaleFormValidator('scale-form');

  console.log('✅ 量表表单校验器初始化完成');
}

// 在 openScaleModal 函数中调用初始化
function openScaleModal(id) {
  // ... 原有代码 ...

  // ✅ 优化3：初始化表单校验（报告 P0 级别）
  if (!scaleFormValidator) {
    initScaleFormValidator();
  } else {
    scaleFormValidator.clearAllErrors();
  }

  // ... 原有代码 ...
}

// 修改 saveScale 函数，添加校验
async function saveScale() {
  // ✅ 优化3：表单校验（报告 P0 级别）
  if (scaleFormValidator && !scaleFormValidator.validate()) {
    console.warn('⚠️ 表单校验失败，请检查输入');
    return; // 校验失败，不保存
  }

  // ... 原有保存逻辑 ...
}
```

**文件**：`admin-scale-form.js`

---

## 五、集成统一异常处理

### 步骤 5：包装 API 调用

在 `admin-api.js` 文件中，修改 API 调用函数，使用统一异常处理：

```javascript
// ✅ 优化1：统一异常处理（报告 P0 级别）
// 原有代码：
// async function getScales() {
//   return await SharedData.getAllScales();
// }

// 修改后：
async function getScales() {
  try {
    const result = await SharedData.getAllScales();
    return result;
  } catch (error) {
    // 使用统一异常处理
    handleError(error, ERROR_TYPES.API, { function: 'getScales' });
    throw error; // 重新抛出，让调用者处理
  }
}

// ✅ 优化1：使用 wrapAPI 包装 API 函数（报告 P0 级别）
const wrappedGetScales = wrapAPI(getScales, { module: 'AdminAPI' });

// 在其他函数中调用时，使用包装后的函数
// await wrappedGetScales();
```

**文件**：`admin-api.js`

---

## 六、修改侧边栏导航

### 步骤 6：修改侧边栏链接，支持 Hash 路由

在 `admin-legacy.html` 中，找到侧边栏导航的 HTML，修改链接格式：

```html
<!-- 修改前 -->
<a href="#" onclick="showSection('section-dashboard')">📊 数据看板</a>

<!-- 修改后 -->
<a href="#dashboard" class="sidebar-link">📊 数据看板</a>
```

**说明**：
- 移除 `onclick` 属性
- `href` 设置为 `#路由名称`（如 `#dashboard`、`#scales`）
- 添加 `sidebar-link` 类名（用于 JS 绑定事件）

在 JS 中添加路由跳转逻辑：

```javascript
// ✅ 优化2：侧边栏导航使用 Hash 路由（报告 P0 级别）
document.querySelectorAll('.sidebar-link').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    const route = this.getAttribute('href').slice(1); // 去掉 # 号
    Router.navigate(route);
  });
});
```

---

## 七、完整集成示例

### 最终 `admin-legacy.html` 的 `<head>` 区域应该类似这样：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <title>星蓝心镜 · 后台管理</title>

    <!-- ✅ 新增：Mock 模式开关（必须放在最前面） -->
    <script>
      window.USE_MOCK = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    </script>

    <!-- 加载进度指示器 -->
    <style>
      /* ... 保持原有样式 ... */
    </style>

    <!-- ✅ 新增：引入插件系统核心模块（必须放在最前面） -->
    <script src="plugin-base.js?v=202606010950"></script>
    <script src="dual-adapter.js?v=202606010950"></script>
    <script src="event-hub.js?v=1"></script>
    <script src="plugin-loader.js?v=202606010950"></script>
    <!-- ✅ 新增：Skill 注册表（用于系统提示词 Skill 架构迁移） -->
    <script src="skill-registry.js?v=1"></script>

    <!-- ✅ 新增：安全工具库（XSS防护、CSRF保护） -->
    <script src="security-utils.js?v=2026060301"></script>

    <!-- Chart.js CDN - 用于数据看板图表渲染 -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

    <!-- ✅ 优化1：统一异常处理机制（报告 P0 级别） -->
    <script src="error-handler.js?v=2026060501"></script>

    <!-- ✅ 优化2：表单校验工具库（报告 P0 级别） -->
    <script src="form-validator.js?v=2026060501"></script>

    <!-- ✅ 优化3：Hash 路由系统（报告 P0 级别） -->
    <script src="router.js?v=2026060501"></script>

    <!-- ✅ 优化4：本地 Mock 系统（报告 P0 级别，开发环境用） -->
    <script src="mock-server.js?v=2026060501"></script>

    <!-- ✅ 原有：认证插件（通过 PluginLoader 自动加载，保留向后兼容） -->
    <!-- 旧文件 admin-auth.js 已被 auth-plugin.js 替代 -->

    <!-- ... 保持原有其他脚本 ... -->
```

---

## 八、测试验证

### 验证步骤

1. **启动本地服务器**
   ```bash
   cd /Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend
   python3 -m http.server 8080
   ```

2. **访问后台页面**
   ```
   http://localhost:8080/admin-legacy.html
   ```

3. **检查 Mock 系统是否启用**
   - 打开浏览器开发者工具（F12）
   - 查看 Console 标签页
   - 应该看到 `[Mock] ✅ Mock 系统初始化完成` 日志

4. **测试路由功能**
   - 点击侧边栏的"量表管理"
   - URL 应该变为 `http://localhost:8080/admin-legacy.html#scales`
   - 刷新页面，应该仍然停留在"量表管理"页面

5. **测试表单校验**
   - 点击"新建量表"
   - 不填写名称，直接点击保存
   - 应该看到错误提示："量表名称不能为空"

6. **测试异常处理**
   - 在 Console 中执行：
     ```javascript
     handleError(new Error('测试错误'), ERROR_TYPES.API);
     ```
   - 应该看到错误提示 Toast

---

## 九、回滚方案

如果集成后出现问题，可以按以下方式回滚：

### 方案 1：禁用 Mock 系统
```javascript
// 在浏览器 Console 中执行
window.MockServer.disable();
```

### 方案 2：移除新模块
注释或删除 `admin-legacy.html` 中新增的 `<script>` 标签：
```html
<!-- <script src="error-handler.js?v=2026060501"></script> -->
<!-- <script src="form-validator.js?v=2026060501"></script> -->
<!-- <script src="router.js?v=2026060501"></script> -->
<!-- <script src="mock-server.js?v=2026060501"></script> -->
```

### 方案 3：恢复原始文件
```bash
cd /Users/rich/WorkBuddy/20260407113106
git checkout mini-app-h5/backend/admin-legacy.html
```

---

## 十、常见问题

### Q1：Mock 系统会影响真实 API 调用吗？
**A**：不会。只有在 `window.USE_MOCK = true` 时才会拦截 API 请求。生产环境会自动禁用。

### Q2：路由系统会影响现有功能吗？
**A**：不会。路由系统是增量改进，现有的 `showSection()` 函数仍然可以使用。

### Q3：表单校验会破坏现有逻辑吗？
**A**：不会。校验是可选的，只有在调用 `validator.validate()` 时才会触发。

### Q4：如何确认优化是否生效？
**A**：查看浏览器 Console，应该看到以下日志：
- `[Mock] ✅ Mock 系统初始化完成`
- `🧭 Router 创建成功`
- `✅ form-validator.js 加载完成`
- `🛡️ ErrorHandler 创建成功`

---

## 十一、总结

通过以上步骤，您已经将以下优化集成到 `admin-legacy.html` 中：

| 优化项 | 文件 | 报告对应条目 | 状态 |
|--------|------|----------------|------|
| 本地 Mock 系统 | `mock-server.js` | P0 - 无本地 Mock 系统 | ✅ 完成 |
| Hash 路由系统 | `router.js` | P0 - 路由系统不完善 | ✅ 完成 |
| 表单校验 | `form-validator.js` | P0 - 表单校验不完整 | ✅ 完成 |
| 统一异常处理 | `error-handler.js` | P0 - 异常处理不一致 | ✅ 完成 |

**下一步**：
1. 按照"八、测试验证"中的步骤测试所有功能
2. 如果测试通过，可以开始本地测试
3. 如果测试失败，参考"九、回滚方案"进行回滚

---

**文档版本**: 1.0.0  
**创建日期**: 2026-06-05  
**作者**: CodeBuddy AI Assistant
