# 💻 开发者指南

## 📋 概述

本指南详细介绍如何**开发、调试、扩展**插件系统，包括：

- 插件架构说明
- 插件开发流程
- 插件调试技巧
- 插件扩展指南
- 最佳实践

---

## 🏗️ 插件架构说明

### 整体架构

插件系统采用**分层架构**：

```
┌─────────────────────────────────────┐
│         后台管理界面 (HTML)          │
├─────────────────────────────────────┤
│        插件调用层 (Plugin Caller)    │
├─────────────────────────────────────┤
│      插件基类 (PluginBase)           │
├─────────────────────────────────────┤
│   scoring-plugin.js  │  npc-plugin.js │
├─────────────────────────────────────┤
│       工具库 (UIUtils, ApiUtils)     │
├─────────────────────────────────────┤
│       云端服务 (CloudBase)           │
└─────────────────────────────────────┘
```

### 核心组件

#### 1. PluginBase (插件基类)

**文件位置**: `plugins/core/plugin-base.js`

**职责**：

- 定义插件标准接口
- 提供插件生命周期管理
- 提供通用工具方法

**核心方法**：

```javascript
class PluginBase {
  constructor(name, version) {
    this.name = name; // 插件名称
    this.version = version; // 插件版本
    this.isInitialized = false; // 初始化状态
  }

  // 生命周期方法（子类必须实现）
  onInit() {} // 初始化
  onExecute(action, params) {} // 执行操作
  onDestroy() {} // 销毁

  // 公共方法
  init() {} // 初始化插件
  execute(action, params) {} // 执行操作
  destroy() {} // 销毁插件
  log(message, type) {} // 日志记录
}
```

#### 2. ScoringPlugin (计分规则管理插件)

**文件位置**: `plugins/core/scoring-plugin.js`

**职责**：

- 管理量表的维度配置
- 管理量表的指标配置
- 管理量表的解释规则
- 管理量表的筛查规则
- 提供模拟测试功能

**支持的 Action**：
| Action | 功能描述 | 参数 |
|--------|---------|------|
| `list` | 获取所有量表 | 无 |
| `get` | 获取量表详情 | `{ scaleId }` |
| `select` | 选择量表 | `{ scaleId }` |
| `add-dimension` | 添加维度 | `{ name, description, items }` |
| `edit-dimension` | 编辑维度 | `{ id, name, description, items }` |
| `delete-dimension` | 删除维度 | `{ id }` |
| `add-metric` | 添加指标 | `{ name, formula, description }` |
| `edit-metric` | 编辑指标 | `{ id, name, formula, description }` |
| `delete-metric` | 删除指标 | `{ id }` |
| `add-interpretation` | 添加解释规则 | `{ metricName, min, max, text }` |
| `add-screening-rule` | 添加筛查规则 | `{ name, conditions, logic, decision }` |
| `save-config` | 保存配置 | 无 |
| `reset-config` | 重置配置 | 无 |

#### 3. NpcPlugin (NPC配置管理插件)

**文件位置**: `plugins/core/npc-plugin.js`

**职责**：

- 管理咨询师立绘
- 管理背景图片
- 管理过渡语
- 管理身份、风格选项
- 提供云端同步功能

**支持的 Action**：
| Action | 功能描述 | 参数 |
|--------|---------|------|
| `list` | 获取NPC配置 | 无 |
| `get` | 获取NPC配置详情 | 无 |
| `switch-tab` | 切换标签页 | `{ tab }` |
| `add-counselor` | 添加咨询师 | `{ name, identity, style, description }` |
| `edit-counselor` | 编辑咨询师 | `{ id, name, identity, style, description }` |
| `delete-counselor` | 删除咨询师 | `{ id }` |
| `set-default-counselor` | 设置默认咨询师 | `{ id }` |
| `add-background` | 添加背景图 | `{ name, description }` |
| `edit-background` | 编辑背景图 | `{ id, name, description }` |
| `delete-background` | 删除背景图 | `{ id }` |
| `set-default-background` | 设置默认背景图 | `{ id }` |
| `add-transition` | 添加过渡语 | `{ type, counselorId, content }` |
| `edit-transition` | 编辑过渡语 | `{ id, type, counselorId, content }` |
| `delete-transition` | 删除过渡语 | `{ id }` |
| `save-config` | 保存配置 | 无 |
| `sync-to-cloud` | 云端同步 | 无 |

---

## 🚀 插件开发流程

### Step 1: 创建插件文件

在 `plugins/core/` 目录下创建新的插件文件，如 `my-plugin.js`：

```javascript
/**
 * 我的自定义插件
 * 功能: [插件功能描述]
 * 作者: [你的名字]
 * 版本: 1.0.0
 * 依赖: PluginBase
 */

class MyPlugin extends PluginBase {
  constructor() {
    super('my-plugin', '1.0.0');

    // 插件特定属性
    this.myData = null;
  }

  /**
   * 初始化插件
   */
  onInit() {
    this.log('初始化我的插件...');

    // 初始化数据
    this.myData = {
      items: [],
      config: {}
    };

    this.log('我的插件初始化完成');
    return { success: true };
  }

  /**
   * 执行操作
   * @param {string} action - 操作名称
   * @param {object} params - 操作参数
   */
  onExecute(action, params = {}) {
    this.log(`执行操作: ${action}`, 'info');

    try {
      switch (action) {
        case 'list':
          return this.handleList(params);

        case 'get':
          return this.handleGet(params);

        case 'add':
          return this.handleAdd(params);

        case 'edit':
          return this.handleEdit(params);

        case 'delete':
          return this.handleDelete(params);

        default:
          throw new Error(`未知操作: ${action}`);
      }
    } catch (error) {
      this.log(`操作失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * 销毁插件
   */
  onDestroy() {
    this.log('销毁我的插件...');

    // 清理数据
    this.myData = null;

    this.log('我的插件已销毁');
    return { success: true };
  }

  // ==================== 私有方法 ====================

  /**
   * 处理列表查询
   */
  handleList(params) {
    // 实现列表查询逻辑
    return { success: true, data: this.myData.items };
  }

  /**
   * 处理获取详情
   */
  handleGet(params) {
    const { id } = params;

    if (!id) {
      throw new Error('缺少参数: id');
    }

    const item = this.myData.items.find((item) => item.id === id);

    if (!item) {
      throw new Error(`未找到ID为 ${id} 的项目`);
    }

    return { success: true, data: item };
  }

  /**
   * 处理添加
   */
  handleAdd(params) {
    const { name, description } = params;

    if (!name) {
      throw new Error('缺少参数: name');
    }

    const newItem = {
      id: `item_${Date.now()}`,
      name,
      description: description || '',
      createdAt: new Date().toISOString()
    };

    this.myData.items.push(newItem);

    return { success: true, data: newItem };
  }

  /**
   * 处理编辑
   */
  handleEdit(params) {
    const { id, name, description } = params;

    if (!id) {
      throw new Error('缺少参数: id');
    }

    const item = this.myData.items.find((item) => item.id === id);

    if (!item) {
      throw new Error(`未找到ID为 ${id} 的项目`);
    }

    // 更新项目
    if (name) item.name = name;
    if (description !== undefined) item.description = description;
    item.updatedAt = new Date().toISOString();

    return { success: true, data: item };
  }

  /**
   * 处理删除
   */
  handleDelete(params) {
    const { id } = params;

    if (!id) {
      throw new Error('缺少参数: id');
    }

    const index = this.myData.items.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`未找到ID为 ${id} 的项目`);
    }

    // 删除项目
    this.myData.items.splice(index, 1);

    return { success: true, message: '删除成功' };
  }
}

// 导出插件
window.MyPlugin = MyPlugin;
```

### Step 2: 注册插件

在 `admin-legacy.html` 中引入插件：

```html
<!-- 引入插件基类 -->
<script src="plugins/core/plugin-base.js"></script>

<!-- 引入核心插件 -->
<script src="plugins/core/scoring-plugin.js"></script>
<script src="plugins/core/npc-plugin.js"></script>

<!-- 引入你的自定义插件 -->
<script src="plugins/core/my-plugin.js"></script>
```

### Step 3: 使用插件

在 JavaScript 代码中使用插件：

```javascript
// 初始化插件
const myPlugin = new MyPlugin();
const result = myPlugin.init();

if (result.success) {
  console.log('插件初始化成功');

  // 使用插件
  myPlugin.execute('add', { name: '测试项目', description: '这是一个测试项目' });
  myPlugin.execute('list');

  // 销毁插件
  myPlugin.destroy();
} else {
  console.error('插件初始化失败:', result.error);
}
```

### Step 4: 测试插件

创建测试文件 `test-my-plugin.js`：

```javascript
/**
 * 我的插件测试脚本
 */

async function runMyPluginTests() {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  // 测试1: 插件加载
  results.total++;
  try {
    if (typeof MyPlugin === 'undefined') {
      throw new Error('MyPlugin 类未定义');
    }
    results.passed++;
    results.details.push({ test: '插件加载', status: 'passed' });
  } catch (error) {
    results.failed++;
    results.details.push({ test: '插件加载', status: 'failed', error: error.message });
  }

  // 测试2: 初始化
  results.total++;
  try {
    const myPlugin = new MyPlugin();
    const result = myPlugin.init();

    if (!result.success) {
      throw new Error(result.error || '初始化失败');
    }

    results.passed++;
    results.details.push({ test: '初始化', status: 'passed' });

    // 测试3: 添加项目
    results.total++;
    try {
      const addResult = myPlugin.execute('add', {
        name: '测试项目',
        description: '这是一个测试项目'
      });

      if (!addResult.success) {
        throw new Error(addResult.error || '添加失败');
      }

      results.passed++;
      results.details.push({ test: '添加项目', status: 'passed' });
    } catch (error) {
      results.failed++;
      results.details.push({ test: '添加项目', status: 'failed', error: error.message });
    }

    // 销毁插件
    myPlugin.destroy();
  } catch (error) {
    results.failed++;
    results.details.push({ test: '初始化', status: 'failed', error: error.message });
  }

  // 返回测试结果
  return results;
}

// 运行测试
runMyPluginTests().then((results) => {
  console.log('测试结果:', results);
  console.log(`总测试数: ${results.total}`);
  console.log(`通过: ${results.passed}`);
  console.log(`失败: ${results.failed}`);
  console.log(`成功率: ${Math.round((results.passed / results.total) * 100)}%`);
});
```

在浏览器中运行测试：

```javascript
// 在浏览器控制台中运行
runMyPluginTests().then((results) => {
  console.log('测试结果:', results);
});
```

---

## 🔧 插件调试技巧

### 1. 使用浏览器开发者工具

**Chrome DevTools**：

1. 按 `F12` 打开开发者工具
2. 切换到 **Console** 标签页
3. 查看插件日志

**日志示例**：

```
[MyPlugin] 初始化我的插件...
[MyPlugin] 我的插件初始化完成
[MyPlugin] 执行操作: add
[MyPlugin] 操作失败: 缺少参数: name
```

### 2. 使用 PluginBase 的 log 方法

在插件代码中添加日志：

```javascript
onExecute(action, params) {
    this.log(`执行操作: ${action}`, 'info');
    this.log(`参数: ${JSON.stringify(params)}`, 'debug');

    try {
        // 执行操作
        const result = this.doSomething(params);
        this.log(`操作成功: ${JSON.stringify(result)}`, 'info');
        return { success: true, data: result };
    } catch (error) {
        this.log(`操作失败: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}
```

### 3. 使用断点调试

在插件代码中添加断点：

```javascript
onExecute(action, params) {
    debugger; // 添加断点

    try {
        // 执行操作
        const result = this.doSomething(params);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
```

**调试步骤**：

1. 在浏览器中打开页面
2. 按 `F12` 打开开发者工具
3. 切换到 **Sources** 标签页
4. 找到插件文件（如 `my-plugin.js`）
5. 点击行号添加断点
6. 触发插件操作，代码会在断点处暂停

### 4. 使用单元测试

创建单元测试文件 `test-my-plugin-unit.js`：

```javascript
/**
 * 我的插件单元测试
 */

describe('MyPlugin', () => {
  let myPlugin;

  // 每个测试前初始化插件
  beforeEach(() => {
    myPlugin = new MyPlugin();
    myPlugin.init();
  });

  // 每个测试后销毁插件
  afterEach(() => {
    myPlugin.destroy();
  });

  // 测试1: 初始化
  test('应该成功初始化', () => {
    const result = myPlugin.init();
    expect(result.success).toBe(true);
    expect(myPlugin.isInitialized).toBe(true);
  });

  // 测试2: 添加项目
  test('应该成功添加项目', () => {
    const result = myPlugin.execute('add', {
      name: '测试项目',
      description: '这是一个测试项目'
    });

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('测试项目');
  });

  // 测试3: 添加项目失败（缺少参数）
  test('应该失败（缺少参数）', () => {
    const result = myPlugin.execute('add', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('缺少参数');
  });
});
```

运行单元测试：

```bash
# 安装 Jest
npm install --save-dev jest

# 运行测试
npx jest test-my-plugin-unit.js
```

---

## 📦 插件扩展指南

### 扩展现有插件

**场景**: 给 `ScoringPlugin` 添加新功能（如导出PDF报告）

**步骤**：

#### 1. 在 `ScoringPlugin` 类中添加新方法

```javascript
/**
 * 导出PDF报告
 * @param {object} params - 导出参数
 * @param {string} params.scaleId - 量表ID
 * @param {string} params.format - 导出格式 (pdf, excel, csv)
 */
handleExportReport(params) {
    const { scaleId, format = 'pdf' } = params;

    if (!scaleId) {
        throw new Error('缺少参数: scaleId');
    }

    // 获取量表数据
    const scaleData = this.getScaleData(scaleId);

    // 根据格式导出
    switch (format) {
        case 'pdf':
            return this.exportToPdf(scaleData);

        case 'excel':
            return this.exportToExcel(scaleData);

        case 'csv':
            return this.exportToCsv(scaleData);

        default:
            throw new Error(`不支持的导出格式: ${format}`);
    }
}

/**
 * 导出为PDF
 */
exportToPdf(scaleData) {
    // 实现PDF导出逻辑
    this.log('导出为PDF...', 'info');

    // 使用 jsPDF 库
    const doc = new jsPDF();

    // 添加标题
    doc.text(scaleData.name, 10, 10);

    // 添加维度数据
    scaleData.dimensions.forEach((dim, index) => {
        doc.text(`${dim.name}: ${dim.score}`, 10, 20 + index * 10);
    });

    // 保存PDF
    doc.save(`${scaleData.name}_报告.pdf`);

    return { success: true, message: 'PDF报告已生成' };
}
```

#### 2. 在 `onExecute` 方法中添加新 action

```javascript
onExecute(action, params = {}) {
    this.log(`执行操作: ${action}`, 'info');

    try {
        switch (action) {
            // ... 现有 action

            case 'export-report':
                return this.handleExportReport(params);

            default:
                throw new Error(`未知操作: ${action}`);
        }
    } catch (error) {
        this.log(`操作失败: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}
```

#### 3. 使用新功能

```javascript
// 导出PDF报告
scoringPlugin.execute('export-report', {
  scaleId: 'SCL90',
  format: 'pdf'
});
```

### 创建新插件

**场景**: 创建一个 `report-plugin.js`，用于生成和导出报告

**步骤**：

#### 1. 创建插件文件

```javascript
/**
 * 报告插件
 * 功能: 生成和导出报告
 * 作者: [你的名字]
 * 版本: 1.0.0
 * 依赖: PluginBase
 */

class ReportPlugin extends PluginBase {
  constructor() {
    super('report-plugin', '1.0.0');

    // 插件特定属性
    this.reportTemplates = [];
  }

  /**
   * 初始化插件
   */
  onInit() {
    this.log('初始化报告插件...');

    // 加载报告模板
    this.loadReportTemplates();

    this.log('报告插件初始化完成');
    return { success: true };
  }

  /**
   * 加载报告模板
   */
  loadReportTemplates() {
    // 从服务器加载报告模板
    // ...

    this.reportTemplates = [
      { id: 'template1', name: '标准报告模板', format: 'pdf' },
      { id: 'template2', name: '详细报告模板', format: 'pdf' },
      { id: 'template3', name: '简洁报告模板', format: 'excel' }
    ];
  }

  /**
   * 执行操作
   */
  onExecute(action, params = {}) {
    this.log(`执行操作: ${action}`, 'info');

    try {
      switch (action) {
        case 'list-templates':
          return this.handleListTemplates(params);

        case 'generate-report':
          return this.handleGenerateReport(params);

        case 'export-report':
          return this.handleExportReport(params);

        default:
          throw new Error(`未知操作: ${action}`);
      }
    } catch (error) {
      this.log(`操作失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理列出模板
   */
  handleListTemplates(params) {
    return { success: true, data: this.reportTemplates };
  }

  /**
   * 处理生成报告
   */
  handleGenerateReport(params) {
    const { templateId, data } = params;

    if (!templateId) {
      throw new Error('缺少参数: templateId');
    }

    if (!data) {
      throw new Error('缺少参数: data');
    }

    // 生成报告
    const template = this.reportTemplates.find((t) => t.id === templateId);

    if (!template) {
      throw new Error(`未找到ID为 ${templateId} 的模板`);
    }

    const report = {
      id: `report_${Date.now()}`,
      templateId,
      data,
      createdAt: new Date().toISOString()
    };

    this.log(`报告生成成功: ${report.id}`, 'info');

    return { success: true, data: report };
  }

  /**
   * 处理导出报告
   */
  handleExportReport(params) {
    const { reportId, format } = params;

    if (!reportId) {
      throw new Error('缺少参数: reportId');
    }

    // 导出报告
    // ...

    this.log(`报告导出成功: ${reportId}`, 'info');

    return { success: true, message: `报告已导出为 ${format} 格式` };
  }

  /**
   * 销毁插件
   */
  onDestroy() {
    this.log('销毁报告插件...');

    // 清理数据
    this.reportTemplates = null;

    this.log('报告插件已销毁');
    return { success: true };
  }
}

// 导出插件
window.ReportPlugin = ReportPlugin;
```

#### 2. 注册插件

在 `admin-legacy.html` 中引入插件：

```html
<script src="plugins/core/report-plugin.js"></script>
```

#### 3. 使用插件

```javascript
// 初始化插件
const reportPlugin = new ReportPlugin();
reportPlugin.init();

// 列出模板
const templates = reportPlugin.execute('list-templates');

// 生成报告
const report = reportPlugin.execute('generate-report', {
  templateId: 'template1',
  data: {
    patientName: '张三',
    scaleName: 'SCL-90',
    score: 180
  }
});

// 导出报告
reportPlugin.execute('export-report', {
  reportId: report.data.id,
  format: 'pdf'
});

// 销毁插件
reportPlugin.destroy();
```

---

## 💡 最佳实践

### 1. 命名规范

**插件名称**：

- 使用小写字母和连字符
- 描述性名称
- 示例: `scoring-plugin`, `npc-plugin`, `report-plugin`

**Action 名称**：

- 使用小写字母和连字符
- 动词+名词格式
- 示例: `add-dimension`, `delete-counselor`, `export-report`

**方法名称**：

- 使用驼峰命名法
- 动词+名词格式
- 示例: `handleAddDimension`, `deleteCounselor`, `exportReport`

### 2. 错误处理

**始终使用 try-catch**：

```javascript
onExecute(action, params = {}) {
    try {
        switch (action) {
            case 'add':
                return this.handleAdd(params);
            // ...
        }
    } catch (error) {
        this.log(`操作失败: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}
```

**提供有用的错误信息**：

```javascript
// ❌ 不好的错误信息
throw new Error('错误');

// ✅ 好的错误信息
throw new Error('缺少必需参数: scaleId');
throw new Error(`未找到ID为 ${id} 的量表`);
throw new Error(`不支持的导出格式: ${format}`);
```

### 3. 参数验证

**始终验证参数**：

```javascript
handleAdd(params) {
    const { name, scaleId } = params;

    // 验证必需参数
    if (!name) {
        throw new Error('缺少必需参数: name');
    }

    if (!scaleId) {
        throw new Error('缺少必需参数: scaleId');
    }

    // 验证参数格式
    if (typeof name !== 'string') {
        throw new Error('参数 name 必须是字符串');
    }

    if (name.trim() === '') {
        throw new Error('参数 name 不能为空');
    }

    // 执行操作
    // ...
}
```

### 4. 日志记录

**使用 PluginBase 的 log 方法**：

```javascript
onExecute(action, params) {
    this.log(`执行操作: ${action}`, 'info');

    try {
        // 执行操作
        const result = this.doSomething(params);

        this.log(`操作成功: ${JSON.stringify(result)}`, 'info');
        return { success: true, data: result };
    } catch (error) {
        this.log(`操作失败: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}
```

**日志级别**：

- `info` - 信息日志（默认）
- `warning` - 警告日志
- `error` - 错误日志
- `debug` - 调试日志（开发时使用）

### 5. 文档注释

**使用 JSDoc 注释**：

```javascript
/**
 * 添加维度
 * @param {object} params - 参数对象
 * @param {string} params.name - 维度名称
 * @param {string} params.description - 维度描述
 * @param {string} params.items - 题目编号（逗号分隔）
 * @returns {object} 操作结果
 * @returns {boolean} returns.success - 是否成功
 * @returns {object} [returns.data] - 维度数据（成功时）
 * @returns {string} [returns.error] - 错误信息（失败时）
 */
handleAddDimension(params) {
    // ...
}
```

### 6. 版本管理

**使用语义化版本号**：

```
主版本.次版本.修订号

示例:
1.0.0 - 初始版本
1.1.0 - 添加新功能（向后兼容）
1.1.1 - 修复bug（向后兼容）
2.0.0 - 重大改动（不向后兼容）
```

**在插件头部注明版本信息**：

```javascript
/**
 * 计分规则管理插件
 * 功能: 管理量表的计分规则
 * 作者: CodeBuddy AI
 * 版本: 2.0.0
 * 依赖: PluginBase
 * 更新日期: 2026-06-01
 */
```

### 7. 性能优化

**按需加载**：

```javascript
// ❌ 不好的做法（一次性加载所有数据）
constructor() {
    super('my-plugin', '1.0.0');
    this.allData = this.loadAllData(); // 加载所有数据
}

// ✅ 好的做法（按需加载数据）
constructor() {
    super('my-plugin', '1.0.0');
    this.cachedData = null; // 缓存数据
}

getData() {
    if (!this.cachedData) {
        this.cachedData = this.loadData(); // 按需加载
    }
    return this.cachedData;
}
```

**使用事件委托**：

```javascript
// ❌ 不好的做法（每个按钮都绑定事件）
document.querySelectorAll('.delete-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    // 删除项目
  });
});

// ✅ 好的做法（事件委托）
document.querySelector('.list-container').addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    // 删除项目
  }
});
```

**使用数据缓存**：

```javascript
// ✅ 好的做法（缓存计算结果）
calculateScore(data) {
    const cacheKey = JSON.stringify(data);

    if (this.scoreCache[cacheKey]) {
        return this.scoreCache[cacheKey];
    }

    const score = this.doCalculateScore(data);
    this.scoreCache[cacheKey] = score;

    return score;
}
```

---

## 📞 技术支持

如果遇到无法解决的问题，请联系技术支持：

- **技术支持邮箱**: support@psych-assess.com
- **技术支持电话**: 400-123-4567
- **在线文档**: https://docs.psych-assess.com

---

## 📝 更新日志

| 版本 | 日期       | 更新内容                                                       |
| ---- | ---------- | -------------------------------------------------------------- |
| v1.0 | 2026-06-01 | 初始版本，包含插件架构、开发流程、调试技巧、扩展指南和最佳实践 |

---

** happy coding!**
