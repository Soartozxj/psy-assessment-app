# 自动化测试套件使用指南

## 📋 概述

本测试套件为心理评估小程序项目提供全面的自动化测试，覆盖所有插件的功能验证。

### 测试范围

1. **单元测试**：对每个插件的核心功能及边缘情况进行测试
2. **集成测试**：测试插件间的交互（PluginLoader、EventHub、Adapter）
3. **边界测试**：测试异常输入和边界条件的容错性

---

## 📂 测试文件结构

```
tests/
├── setup.js                          # 测试环境配置（模拟浏览器API）
├── unit/                            # 单元测试
│   ├── auth-plugin.test.js          # 认证插件测试
│   ├── ai-plugin.test.js           # AI配置插件测试
│   ├── scale-plugin.test.js         # 量表管理插件测试
│   ├── scoring-plugin.test.js       # 计分规则插件测试
│   └── npc-plugin.test.js         # NPC配置插件测试
├── integration/                     # 集成测试
│   └── plugin-integration.test.js  # 插件集成测试
└── boundary/                       # 边界测试
    └── plugin-boundary.test.js     # 插件边界测试

jest.config.js                       # Jest 配置文件
package.json                         # 测试脚本配置
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd /Users/rich/WorkBuddy/20260407113106
npm install
```

### 2. 运行所有测试

```bash
npm test
```

### 3. 运行特定类型的测试

```bash
# 只运行单元测试
npm run test:unit

# 只运行集成测试
npm run test:integration

# 只运行边界测试
npm run test:boundary

# 运行所有测试（按顺序）
npm run test:all
```

### 4. 生成覆盖率报告

```bash
npm run test:coverage
```

覆盖率报告将生成在 `coverage/` 目录。

### 5. 监听模式（开发时使用）

```bash
npm run test:watch
```

---

## 📊 测试详细说明

### 1. 单元测试 (`tests/unit/`)

#### **auth-plugin.test.js** - 认证插件测试

**测试范围**：

- ✅ 插件初始化
- ✅ 登录功能（正确密码、错误密码、空密码）
- ✅ 登出功能
- ✅ 修改密码功能（正确原密码、错误原密码、新密码太短）
- ✅ 锁定机制（连续5次错误密码锁定、锁定后等待时间）
- ✅ 边界情况（特殊字符密码、超长密码）
- ✅ 存储测试（localStorage、sessionStorage）

**运行命令**：

```bash
npm run test -- tests/unit/auth-plugin.test.js
```

---

#### **ai-plugin.test.js** - AI配置插件测试

**测试范围**：

- ✅ 插件初始化
- ✅ 配置加载（默认配置、存储的配置、无效配置）
- ✅ 配置保存（有效配置、空配置、缺少必填字段）
- ✅ 测试连接功能（有效配置、无效API Key、无效API URL）
- ✅ 重置配置
- ✅ 边界情况（特殊字符、Unicode字符、大数据）
- ✅ 存储测试

**运行命令**：

```bash
npm run test -- tests/unit/ai-plugin.test.js
```

---

#### **scale-plugin.test.js** - 量表管理插件测试

**测试范围**：

- ✅ 插件初始化
- ✅ 获取量表（空、有数据、根据ID获取、根据不存在的ID获取）
- ✅ 添加量表（有效量表、空数据、缺少必填字段、重复编码）
- ✅ 更新量表（有效更新、不存在的量表、空ID）
- ✅ 删除量表（现有量表、不存在的量表）
- ✅ 导入导出（有效数据、重复编码、非数组数据）
- ✅ 搜索量表
- ✅ 边界情况（特殊字符、Unicode字符、大数据）
- ✅ 存储测试

**运行命令**：

```bash
npm run test -- tests/unit/scale-plugin.test.js
```

---

#### **scoring-plugin.test.js** - 计分规则插件测试

**测试范围**：

- ✅ 插件初始化
- ✅ 获取计分规则（空、有数据、根据ID获取、根据量表ID获取）
- ✅ 添加计分规则（有效规则、空数据、缺少必填字段、重复量表ID）
- ✅ 维度配置（添加维度、不存在的规则、缺少名称）
- ✅ 指标配置（添加指标、不存在的维度）
- ✅ 解释规则配置（添加解释规则、缺少必填字段）
- ✅ 计算得分
- ✅ 边界情况
- ✅ 存储测试

**运行命令**：

```bash
npm run test -- tests/unit/scoring-plugin.test.js
```

---

#### **npc-plugin.test.js** - NPC配置插件测试

**测试范围**：

- ✅ 插件初始化
- ✅ 获取NPC配置（空、有数据、根据ID获取）
- ✅ 添加NPC配置（有效配置、空数据、缺少必填字段、重复名称）
- ✅ 更新NPC配置
- ✅ 删除NPC配置
- ✅ 图片压缩
- ✅ 云端同步
- ✅ 搜索配置
- ✅ 边界情况
- ✅ 存储测试

**运行命令**：

```bash
npm run test -- tests/unit/npc-plugin.test.js
```

---

### 2. 集成测试 (`tests/integration/`)

#### **plugin-integration.test.js** - 插件集成测试

**测试范围**：

- ✅ **PluginLoader 加载插件**（注册、加载、卸载、加载顺序）
- ✅ **插件依赖关系**（auth无依赖、scoring依赖auth和scale）
- ✅ **EventHub 事件通信**（注册监听器、移除监听器、插件间通信、认证事件）
- ✅ **Adapter 存储同步**（localStorage、sessionStorage、插件间共享数据）
- ✅ **插件生命周期**（初始化、销毁、执行）
- ✅ **插件间数据传递**（scale传递数据给scoring、auth传递认证状态）
- ✅ **错误处理**（插件执行出错、事件监听器出错）

**运行命令**：

```bash
npm run test -- tests/integration/plugin-integration.test.js
```

---

### 3. 边界测试 (`tests/boundary/`)

#### **plugin-boundary.test.js** - 插件边界测试

**测试范围**：

- ✅ **异常输入处理**（null、undefined、空字符串、非数组数据、无效ID）
- ✅ **边界条件处理**（最大尝试次数、超长API Key、空量表名称、最小/最大分数边界、图片大小边界）
- ✅ **容错性测试**（localStorage不可用、网络请求失败、JSON解析失败、事件监听器抛出异常）
- ✅ **极端情况测试**（非常大的数据集、非常多的插件实例、高频事件触发）
- ✅ **内存泄漏测试**（销毁后清除事件监听器、销毁后清除定时器、重复初始化）
- ✅ **性能边界测试**（初始化时间、大量并发请求、内存使用限制）

**运行命令**：

```bash
npm run test -- tests/boundary/plugin-boundary.test.js
```

---

## 🎯 测试覆盖目标

| 指标       | 目标值 | 当前值    |
| ---------- | ------ | --------- |
| 语句覆盖率 | ≥ 70%  | 🟡 待测试 |
| 分支覆盖率 | ≥ 70%  | 🟡 待测试 |
| 函数覆盖率 | ≥ 70%  | 🟡 待测试 |
| 行覆盖率   | ≥ 70%  | 🟡 待测试 |

**生成覆盖率报告**：

```bash
npm run test:coverage
```

---

## 📝 编写新测试

### 1. 创建测试文件

在相应的目录下创建新的测试文件：

- 单元测试：`tests/unit/`
- 集成测试：`tests/integration/`
- 边界测试：`tests/boundary/`

### 2. 测试文件模板

```javascript
/**
 * 插件名称 - 单元测试
 */

// 模拟插件类
class MockPlugin {
  // ...
}

// 测试用例
describe('PluginName - 插件名称单元测试', () => {
  let plugin;

  beforeEach(() => {
    plugin = new MockPlugin();
    plugin.init();
  });

  test('应该成功执行某操作', () => {
    const result = plugin.someMethod();
    expect(result.success).toBe(true);
  });
});
```

### 3. 运行新测试

```bash
npm run test -- tests/unit/your-new-test.test.js
```

---

## 🐛 调试测试

### 1. 使用 `console.log`

在测试代码中添加 `console.log` 语句：

```javascript
test('测试示例', () => {
  const result = someFunction();
  console.log('Result:', result);
  expect(result.success).toBe(true);
});
```

### 2. 使用 `--verbose` 参数

```bash
npm run test -- --verbose
```

### 3. 使用 `--no-coverage` 参数（加快测试速度）

```bash
npm run test -- --no-coverage
```

---

## 📈 持续集成 (CI)

### GitHub Actions 示例

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          file: ./coverage/lcov.info
```

---

## 📞 常见问题 (FAQ)

### Q1: 测试失败怎么办？

**A**: 检查以下几点：

1. 是否所有依赖都已安装？运行 `npm install`
2. 是否正确模拟了浏览器API？检查 `tests/setup.js`
3. 查看详细的错误输出，定位失败原因

### Q2: 如何只运行失败的测试？

**A**: 使用 `--onlyFailures` 参数：

```bash
npm run test -- --onlyFailures
```

### Q3: 如何更新快照？

**A**: 使用 `--updateSnapshot` 参数：

```bash
npm run test -- --updateSnapshot
```

### Q4: 测试运行太慢怎么办？

**A**:

1. 使用 `--testPathIgnorePatterns` 排除不必要的测试
2. 使用 `--maxWorkers` 限制并发工作线程数
3. 使用 `--no-coverage` 禁用覆盖率报告

---

## 📚 参考资料

- [Jest 官方文档](https://jestjs.io/)
- [Testing Library 官方文档](https://testing-library.com/)
- [JavaScript 测试最佳实践](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

## 🎉 总结

本测试套件提供了：

- ✅ **全面的测试覆盖**：单元测试、集成测试、边界测试
- ✅ **易于维护的测试结构**：清晰的目录结构、统一的测试风格
- ✅ **准确的反馈**：明确的断言逻辑、详细的错误输出
- ✅ **持续集成支持**：兼容 GitHub Actions 等 CI/CD 工具

**现在就开始运行测试吧！** 🚀

```bash
cd /Users/rich/WorkBuddy/20260407113106
npm test
```
