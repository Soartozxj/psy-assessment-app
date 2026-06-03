# Skill 测试指南

**文档版本**: v1.0  
**创建日期**: 2026-06-03  
**目标读者**: 前端开发者、测试工程师、质量保证团队

---

## 一、测试概述

### 1.1 为什么需要测试？

| 问题       | 没有测试             | 有测试           |
| ---------- | -------------------- | ---------------- |
| 修改代码后 | 不知道是否破坏功能   | 自动检测回归错误 |
| 重构代码时 | 担心破坏现有功能     | 有信心地重构     |
| 团队协作时 | 怕别人的修改影响自己 | 持续集成自动测试 |
| 发布前     | 手动测试每个功能     | 自动化测试覆盖   |

### 1.2 测试类型

| 测试类型   | 测试对象      | 测试工具                | 覆盖率目标 |
| ---------- | ------------- | ----------------------- | ---------- |
| 单元测试   | 单个函数/方法 | Jest, Mocha             | 80%+       |
| 集成测试   | 多个模块协作  | Jest, Mocha             | 60%+       |
| 端到端测试 | 完整用户流程  | Playwright, Selenium    | 40%+       |
| 性能测试   | 系统响应时间  | Lighthouse, WebPageTest | -          |

---

## 二、单元测试编写

### 2.1 安装测试工具

#### 方案A: 使用 Jest（推荐）

```bash
# 安装 Jest
npm install --save-dev jest

# 在 package.json 中添加脚本
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

#### 方案B: 使用 Mocha

```bash
# 安装 Mocha
npm install --save-dev mocha chai

# 在 package.json 中添加脚本
{
  "scripts": {
    "test": "mocha",
    "test:watch": "mocha --watch"
  }
}
```

### 2.2 编写第一个单元测试

**测试文件**: `tests/unit/scale-plugin.test.js`

```javascript
/**
 * scale-plugin.test.js - 量表管理插件单元测试
 */

// 模拟浏览器环境
global.window = {
  EventHub: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn()
  },
  PluginLoader: {
    register: jest.fn(),
    load: jest.fn(),
    get: jest.fn(),
    unload: jest.fn(),
    list: jest.fn()
  },
  SharedData: {
    saveScalesData: jest.fn()
  }
};

// 模拟 Adapter
global.Adapter = {
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn()
  },
  ui: {
    toast: jest.fn()
  },
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
};

// 导入被测试的插件
const ScalePlugin = require('../../mini-app-h5/backend/plugins/core/scale-plugin.js');

describe('ScalePlugin', () => {
  let plugin;

  // 每个测试前创建新实例
  beforeEach(() => {
    plugin = new ScalePlugin();
  });

  // 每个测试后清理
  afterEach(() => {
    plugin = null;
    jest.clearAllMocks();
  });

  // ====================================================
  // 测试1: 插件初始化
  // ====================================================
  describe('constructor()', () => {
    test('应该正确设置元数据', () => {
      expect(plugin.name).toBe('量表管理插件');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBe('负责量表的增删改查、导入导出等功能');
    });

    test('应该初始化私有变量', () => {
      expect(plugin.STORAGE_KEY).toBe('psy_scales');
      expect(plugin.scales).toEqual([]);
      expect(plugin.filteredScales).toEqual([]);
    });

    test('应该创建全局函数（向后兼容）', () => {
      expect(window.loadScales).toBeDefined();
      expect(window.saveScales).toBeDefined();
      expect(window.renderScaleList).toBeDefined();
    });
  });

  // ====================================================
  // 测试2: onInit() 方法
  // ====================================================
  describe('onInit()', () => {
    test('应该成功初始化', async () => {
      // 模拟 loadScales 返回测试数据
      plugin.loadScales = jest.fn().mockReturnValue([{ id: 1, name: '测试量表', status: 1 }]);
      plugin.renderScaleList = jest.fn();
      plugin.renderScaleTypes = jest.fn();
      plugin._bindEvents = jest.fn();

      await plugin.onInit();

      expect(plugin.scales).toHaveLength(1);
      expect(plugin.renderScaleList).toHaveBeenCalled();
      expect(plugin.renderScaleTypes).toHaveBeenCalled();
      expect(plugin._bindEvents).toHaveBeenCalled();
      expect(window.EventHub.emit).toHaveBeenCalledWith('scale-initialized', expect.any(Object));
    });

    test('应该处理初始化失败', async () => {
      // 模拟加载失败
      plugin.loadScales = jest.fn().mockImplementation(() => {
        throw new Error('加载失败');
      });

      await expect(plugin.onInit()).rejects.toThrow('加载失败');
    });
  });

  // ====================================================
  // 测试3: onExecute() 方法
  // ====================================================
  describe('onExecute()', () => {
    test('应该处理 load 动作', async () => {
      plugin.loadScales = jest.fn().mockReturnValue([{ id: 1, name: '测试' }]);

      const result = await plugin.onExecute({ action: 'load' });

      expect(result).toEqual([{ id: 1, name: '测试' }]);
      expect(plugin.loadScales).toHaveBeenCalled();
    });

    test('应该处理 save 动作', async () => {
      const scale = { id: 1, name: '测试量表' };
      plugin.saveScales = jest.fn();

      const result = await plugin.onExecute({ action: 'save', scale });

      expect(result.success).toBe(true);
      expect(plugin.saveScales).toHaveBeenCalledWith([scale]);
    });

    test('save 动作应该校验参数', async () => {
      const result = await plugin.onExecute({ action: 'save' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('缺少必要参数：scale');
    });

    test('应该处理 delete 动作', async () => {
      plugin.deleteScale = jest.fn();

      const result = await plugin.onExecute({ action: 'delete', scaleId: 1 });

      expect(result.success).toBe(true);
      expect(plugin.deleteScale).toHaveBeenCalledWith(1);
    });

    test('应该处理未知动作', async () => {
      const result = await plugin.onExecute({ action: 'unknown' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('未知动作');
    });
  });

  // ====================================================
  // 测试4: loadScales() 方法
  // ====================================================
  describe('loadScales()', () => {
    test('应该从存储中加载量表', () => {
      const mockData = JSON.stringify([
        { id: 1, name: '量表1' },
        { id: 2, name: '量表2' }
      ]);
      Adapter.storage.get.mockReturnValue(mockData);

      const result = plugin.loadScales();

      expect(result).toHaveLength(2);
      expect(Adapter.storage.get).toHaveBeenCalledWith('psy_scales');
    });

    test('存储为空时应该使用默认量表', () => {
      Adapter.storage.get.mockReturnValue(null);
      global.window.DEFAULT_SCALES = [{ id: 1, name: '默认量表' }];

      const result = plugin.loadScales();

      expect(result).toHaveLength(1);
      expect(Adapter.storage.set).toHaveBeenCalled();
    });

    test('应该处理 JSON 解析失败', () => {
      Adapter.storage.get.mockReturnValue('invalid json');

      const result = plugin.loadScales();

      expect(result).toBeDefined();
      expect(Adapter.logger.warn).toHaveBeenCalled();
    });
  });

  // ====================================================
  // 测试5: saveScales() 方法
  // ====================================================
  describe('saveScales()', () => {
    test('应该保存量表到存储', () => {
      const scales = [
        { id: 1, name: '量表1' },
        { id: 2, name: '量表2' }
      ];

      plugin.saveScales(scales);

      expect(Adapter.storage.set).toHaveBeenCalledWith('psy_scales', JSON.stringify(scales));
      expect(window.SharedData.saveScalesData).toHaveBeenCalledWith(scales);
    });

    test('应该同步到前端', () => {
      const scales = [{ id: 1, name: '量表1', status: 1 }];
      plugin.syncToFrontend = jest.fn();

      plugin.saveScales(scales);

      expect(plugin.syncToFrontend).toHaveBeenCalled();
    });

    test('应该处理保存失败', () => {
      Adapter.storage.set.mockImplementation(() => {
        throw new Error('存储空间不足');
      });

      plugin.saveScales([{ id: 1 }]);

      expect(Adapter.ui.toast).toHaveBeenCalledWith(expect.stringContaining('保存失败'), 'error');
    });
  });

  // ====================================================
  // 测试6: normalizeScaleBeforeSave() 方法
  // ====================================================
  describe('normalizeScaleBeforeSave()', () => {
    test('应该规范化量表数据', () => {
      const input = {
        name: '测试量表',
        code: 'TEST_001'
      };

      const result = plugin.normalizeScaleBeforeSave(input);

      expect(result.name).toBe('测试量表');
      expect(result.code).toBe('TEST_001');
      expect(result.status).toBe(1); // 默认值
      expect(result.sortOrder).toBe(0); // 默认值
    });

    test('应该生成 tags（如果为空）', () => {
      const input = {
        name: '抑郁自评量表'
      };

      const result = plugin.normalizeScaleBeforeSave(input);

      expect(result.tags).toContain('抑郁');
    });

    test('应该确保有 id', () => {
      const input = { name: '测试' };

      const result = plugin.normalizeScaleBeforeSave(input);

      expect(result.id).toBeDefined();
    });
  });
});
```

### 2.3 运行测试

```bash
# 运行所有测试
npm test

# 运行单个测试文件
npx jest tests/unit/scale-plugin.test.js

# 监视模式（文件变化时自动运行）
npm run test:watch

# 生成覆盖率报告
npx jest --coverage
```

---

## 三、集成测试编写

### 3.1 测试 PluginLoader 与插件集成

**测试文件**: `tests/integration/plugin-loader.test.js`

```javascript
/**
 * plugin-loader.test.js - PluginLoader 集成测试
 */

// 模拟浏览器环境
global.window = {
  EventHub: {
    emit: jest.fn(),
    on: jest.fn()
  }
};

describe('PluginLoader 集成测试', () => {
  // ====================================================
  // 测试1: 注册和加载插件
  // ====================================================
  describe('注册和加载', () => {
    test('应该成功注册插件', () => {
      class TestPlugin extends PluginBase {
        async onInit() {}
        async onExecute() {}
      }

      PluginLoader.register('test-plugin', TestPlugin);

      expect(PluginLoader.list()).toContain('test-plugin');
    });

    test('应该成功加载插件', async () => {
      await PluginLoader.load('test-plugin');

      const plugin = PluginLoader.get('test-plugin');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('TestPlugin');
    });

    test('加载未注册的插件应该失败', async () => {
      await expect(PluginLoader.load('non-existent')).rejects.toThrow();
    });
  });

  // ====================================================
  // 测试2: 插件通信
  // ====================================================
  describe('插件通信', () => {
    test('插件应该能通过 EventHub 通信', async () => {
      class PluginA extends PluginBase {
        async onInit() {
          window.EventHub.on('plugin-b-event', (data) => {
            this.receivedData = data;
          });
        }
      }

      class PluginB extends PluginBase {
        async onExecute(params) {
          if (params.action === 'notify') {
            window.EventHub.emit('plugin-b-event', { message: 'hello' });
          }
        }
      }

      PluginLoader.register('plugin-a', PluginA);
      PluginLoader.register('plugin-b', PluginB);

      await PluginLoader.load('plugin-a');
      await PluginLoader.load('plugin-b');

      const pluginB = PluginLoader.get('plugin-b');
      await pluginB.onExecute({ action: 'notify' });

      const pluginA = PluginLoader.get('plugin-a');
      expect(pluginA.receivedData).toEqual({ message: 'hello' });
    });
  });

  // ====================================================
  // 测试3: 插件销毁
  // ====================================================
  describe('插件销毁', () => {
    test('应该成功销毁插件', async () => {
      await PluginLoader.load('test-plugin');

      const plugin = PluginLoader.get('test-plugin');
      plugin.onDestroy = jest.fn();

      await PluginLoader.unload('test-plugin');

      expect(plugin.onDestroy).toHaveBeenCalled();
      expect(PluginLoader.get('test-plugin')).toBeNull();
    });
  });
});
```

---

## 四、端到端测试编写

### 4.1 使用 Playwright（推荐）

**安装 Playwright**:

```bash
# 安装 Playwright
npm init playwright@latest

# 选择以下选项：
# - 测试目录: tests/e2e
# - 是否添加 GitHub Actions: Yes
# - 是否安装浏览器: Yes
```

### 4.2 编写第一个端到端测试

**测试文件**: `tests/e2e/admin-scale.spec.js`

```javascript
/**
 * admin-scale.spec.js - 量表管理页面端到端测试
 */

const { test, expect } = require('@playwright/test');

test.describe('量表管理页面', () => {
  // 每个测试前访问页面
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8088/mini-app-h5/backend/admin-scale.html');
  });

  // ====================================================
  // 测试1: 页面加载
  // ====================================================
  test('应该正确加载页面', async ({ page }) => {
    // 检查标题
    await expect(page.locator('.title')).toHaveText('📋 量表管理');

    // 检查工具栏按钮
    await expect(page.locator('button:has-text("新增量表")')).toBeVisible();
    await expect(page.locator('button:has-text("刷新")')).toBeVisible();
  });

  // ====================================================
  // 测试2: 新增量表
  // ====================================================
  test('应该成功新增量表', async ({ page }) => {
    // 点击新增按钮
    await page.click('button:has-text("新增量表")');

    // 等待弹窗出现
    await page.waitForSelector('#edit-modal');

    // 填写表单
    await page.fill('#scale-name', '测试量表');
    await page.fill('#scale-code', 'TEST_001');
    await page.fill('#scale-desc', '这是一个测试量表');

    // 点击保存
    await page.click('button:has-text("保存")');

    // 等待弹窗关闭
    await page.waitForSelector('#edit-modal', { state: 'hidden' });

    // 检查列表中出现新量表
    await expect(page.locator('.scale-name')).toContainText('测试量表');
  });

  // ====================================================
  // 测试3: 编辑量表
  // ====================================================
  test('应该成功编辑量表', async ({ page }) => {
    // 假设已有一个量表
    await page.click('.scale-card:first-child');

    // 等待弹窗出现
    await page.waitForSelector('#edit-modal');

    // 修改名称
    await page.fill('#scale-name', '修改后的量表名称');

    // 点击保存
    await page.click('button:has-text("保存")');

    // 检查列表中的名称已更新
    await expect(page.locator('.scale-name')).toContainText('修改后的量表名称');
  });

  // ====================================================
  // 测试4: 删除量表
  // ====================================================
  test('应该成功删除量表', async ({ page }) => {
    // 获取第一个量表的名称
    const scaleName = await page.locator('.scale-name').first().textContent();

    // 点击删除按钮
    await page.click('button:has-text("删除")');

    // 确认删除
    await page.click('button:has-text("确定")');

    // 检查量表中不再显示
    await expect(page.locator('.scale-name')).not.toContainText(scaleName);
  });

  // ====================================================
  // 测试5: 搜索量表
  // ====================================================
  test('应该成功搜索量表', async ({ page }) => {
    // 在搜索框中输入关键词
    await page.fill('.search-input', '测试');

    // 检查列表中只显示匹配的量表
    const visibleCards = await page.locator('.scale-card:visible').count();
    expect(visibleCards).toBeGreaterThan(0);
  });
});
```

### 4.3 运行端到端测试

```bash
# 运行所有端到端测试
npx playwright test

# 运行单个测试文件
npx playwright test tests/e2e/admin-scale.spec.js

# 调试模式（逐步执行）
npx playwright test --debug

# 查看测试报告
npx playwright show-report
```

---

## 五、自动化测试套件使用

### 5.1 使用现有测试套件

项目中已有一个自动化测试套件 `test-skill-sync.js`，可以测试 Skill 双向同步功能。

**运行测试套件**:

```bash
# 确保后端服务正在运行
node server/psy-api.js &

# 运行测试套件
node test-skill-sync.js
```

**测试套件输出示例**:

```
🧪  Skill 双向同步测试套件
===================================================

✅ 测试 1 通过: 新增版本应该同步到 Skill 系统
✅ 测试 2 通过: 编辑版本应该同步到 Skill 系统
✅ 测试 3 通过: 删除版本应该同步到 Skill 系统

===================================================
测试结果: 3/3 通过
```

### 5.2 创建自定义测试套件

**测试文件**: `tests/custom-test-suite.js`

```javascript
/**
 * custom-test-suite.js - 自定义测试套件
 */

const axios = require('axios');

const API_BASE = 'http://127.0.0.1:3100/api';
let passed = 0;
let failed = 0;

async function test(description, fn) {
  try {
    await fn();
    console.log(`✅ 测试通过: ${description}`);
    passed++;
  } catch (err) {
    console.error(`❌ 测试失败: ${description}`);
    console.error(`   错误: ${err.message}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('🧪  自定义测试套件');
  console.log('===================================================\n');

  // 测试1: Health Check
  await test('GET / 应该返回 API 状态', async () => {
    const res = await axios.get(`${API_BASE}/../`);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    if (res.data.status !== 'ok') throw new Error('状态异常');
  });

  // 测试2: 获取 Skill 列表
  await test('GET /api/skills 应该返回 Skill 列表', async () => {
    const res = await axios.get(`${API_BASE}/skills`);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    if (!res.data.data || !Array.isArray(res.data.data)) {
      throw new Error('返回格式错误');
    }
  });

  // 测试3: 创建 Skill
  await test('POST /api/skills 应该成功创建 Skill', async () => {
    const newSkill = {
      id: 'test-skill-' + Date.now(),
      name: '测试 Skill',
      version: '1.0.0',
      description: '这是一个测试 Skill',
      content: 'console.log("Hello World");',
      metadata: {
        type: 'system-prompt',
        icon: '🧪'
      }
    };

    const res = await axios.post(`${API_BASE}/skills`, newSkill);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    if (res.data.code !== 0) throw new Error(res.data.message);
  });

  console.log('\n===================================================');
  console.log(`测试结果: ${passed}/${passed + failed} 通过`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('测试套件执行失败:', err);
  process.exit(1);
});
```

---

## 六、Mock 工具使用

### 6.1 使用 Jest Mock

```javascript
// 模拟 Adapter.storage
const mockStorage = {
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn()
};

global.Adapter = {
  storage: mockStorage,
  ui: {
    toast: jest.fn()
  },
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
};

// 在测试中使用
test('应该调用 storage.get', () => {
  mockStorage.get.mockReturnValue('test data');

  const result = plugin.loadData();

  expect(mockStorage.get).toHaveBeenCalledWith('key');
  expect(result).toBe('test data');
});
```

### 6.2 使用 Sinon（更强大的 Mock 库）

```javascript
const sinon = require('sinon');

// 创建 mock
const mockStorage = {
  get: sinon.stub(),
  set: sinon.stub()
};

// 设置返回值
mockStorage.get.withArgs('key').returns('value');

// 断言调用
sinon.assert.calledWith(mockStorage.get, 'key');
```

---

## 七、持续集成 (CI/CD)

### 7.1 使用 GitHub Actions

**配置文件**: `.github/workflows/test.yml`

```yaml
name: 测试

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: 设置 Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: 安装依赖
        run: npm install

      - name: 运行单元测试
        run: npm test

      - name: 运行集成测试
        run: npm run test:integration

      - name: 生成覆盖率报告
        run: npm run test:coverage

      - name: 上传覆盖率报告
        uses: codecov/codecov-action@v3
```

### 7.2 使用 Coding CI

**配置文件**: `.coding-ci.yml`

```yaml
name: 测试

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: 设置 Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: 安装依赖
        run: npm install

      - name: 运行所有测试
        run: npm test
```

---

## 八、测试最佳实践

### 8.1 单元测试最佳实践

1. **测试覆盖率 > 80%**
   - 使用 `jest --coverage` 生成覆盖率报告
   - 重点关注核心业务逻辑

2. **每个测试只测试一件事**

   ```javascript
   // ❌ 错误：一个测试测试多件事
   test('测试 load 和 save', async () => {
     await plugin.load();
     await plugin.save();
   });

   // ✅ 正确：每个测试只测试一件事
   test('应该成功 load', async () => {
     await plugin.load();
   });

   test('应该成功 save', async () => {
     await plugin.save();
   });
   ```

3. **使用 Mock 隔离依赖**
   ```javascript
   // 模拟外部依赖
   jest.mock('axios');
   const axios = require('axios');
   axios.get.mockResolvedValue({ data: {} });
   ```

### 8.2 集成测试最佳实践

1. **测试真实场景**
   - 测试插件间通信
   - 测试数据流完整性

2. **使用测试数据库**
   ```javascript
   // 测试前清空数据库
   beforeEach(async () => {
     await db.clear();
   });
   ```

### 8.3 端到端测试最佳实践

1. **测试关键用户流程**
   - 登录 → 操作 → 退出

2. **使用 Page Object Model**

   ```javascript
   class LoginPage {
     constructor(page) {
       this.page = page;
     }

     async login(username, password) {
       await this.page.fill('#username', username);
       await this.page.fill('#password', password);
       await this.page.click('button:has-text("登录")');
     }
   }
   ```

---

## 九、常见问题解答

### Q1: 测试运行缓慢怎么办？

**解决方案**:

1. 使用 `--testTimeout=10000` 增加超时时间
2. 使用 `--maxWorkers=4` 限制并行worker数量
3. 只运行修改过的文件的测试：`jest --onlyChanged`

### Q2: 如何调试失败的测试？

**解决方案**:

1. 使用 `jest --verbose` 查看详细输出
2. 在测试代码中添加 `console.log`
3. 使用 VSCode 调试器：`.vscode/launch.json`

### Q3: 如何模拟浏览器 API？

**解决方案**:
使用 `jsdom`：

```javascript
/**
 * setupTests.js - 测试 setup 文件
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
```

在 `package.json` 中配置：

```json
{
  "jest": {
    "setupFilesAfterEnv": ["<rootDir>/setupTests.js"]
  }
}
```

---

## 十、总结

通过本指南，您已经学会：

- ✅ 编写单元测试（使用 Jest）
- ✅ 编写集成测试（测试模块协作）
- ✅ 编写端到端测试（使用 Playwright）
- ✅ 使用 Mock 工具（Jest Mock, Sinon）
- ✅ 设置持续集成（GitHub Actions, Coding CI）
- ✅ 遵循测试最佳实践

**下一步**:

- 为所有插件编写单元测试（目标覆盖率 80%+）
- 为关键用户流程编写端到端测试
- 设置 CI/CD 自动运行测试

---

**文档结束**

**后续更新计划**:

- 添加更多测试示例
- 添加性能测试指南
- 添加安全测试指南
