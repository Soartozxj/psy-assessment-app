---
name: Skills架构改造-改造前准备工作
overview: 执行Skills架构改造前的7项准备工作，包括：核心模块文件确认、目录结构创建、技术栈环境确认、现有代码分析、双端适配准备、测试环境准备、回退方案准备。预计时间4-5天，不含MCP和SKILL配置。
todos:
  - id: verify-core-modules
    content: 验证4个核心模块文件存在且语法正确
    status: pending
  - id: create-plugin-dirs
    content: 创建插件目录结构（plugins/core/、plugins/optional/）
    status: pending
  - id: verify-tech-stack
    content: 验证技术栈环境符合ES6+要求，无禁止语法
    status: pending
  - id: analyze-code-size
    content: 分析admin-legacy.html代码规模和模块划分
    status: pending
    dependencies:
      - verify-core-modules
  - id: analyze-api-diff
    content: 分析H5/小程序双端API差异，验证DualAdapter
    status: pending
  - id: prepare-test-env
    content: 准备浏览器和小程序测试环境，编写测试用例
    status: pending
  - id: create-backup-plan
    content: 创建代码备份和回退方案，确保可快速恢复
    status: pending
    dependencies:
      - analyze-code-size
---

## 产品概述

Skills架构改造的改造前准备工作，为从单文件架构（24k行）到插件化架构的改造奠定基础。基于《Skills架构改造-整合指导框架.md》文档，完成7项关键准备工作，并设计**自动化任务管理方案**以解决任务管理混乱问题，确保改造过程可控、可回退、风险可控。

**核心创新**：采用 **Markdown + YAML front matter** 定义任务，通过 **CodeBuddy AI Agent** 自动解析并生成结构化任务列表，利用 `todo_write` 工具实现任务流转与状态追踪，无需引入spec-kit等外部工具。

## 核心功能

### 1. 核心模块文件确认

- 验证4个核心模块文件（plugin-base.js、plugin-loader.js、dual-adapter.js、event-hub.js）已创建且语法正确
- 确认文件大小 > 0，无语法错误

### 2. 目录结构创建

- 创建插件目录结构（plugins/core/、plugins/optional/）
- 确保目录结构符合架构设计

### 3. 技术栈环境确认

- 验证开发环境符合ES6+要求
- 检查代码中是否使用禁止的语法（var、require、.ts文件、IE11兼容代码）
- 确认浏览器支持范围（Chrome 60+、Firefox 55+、Safari 11+）

### 4. 现有代码分析

- 统计admin-legacy.html的代码规模（约24,000行）
- 识别可插件化的功能模块（auth、ai、scale、scoring、npc、meditation、analytics）
- 分析全局变量和插件间依赖关系

### 5. 双端适配准备

- 识别H5端和小程序端的API差异
- 验证DualAdapter是否已实现所有需要的适配接口
- 确保禁止在H5端直接使用小程序专有API

### 6. 测试环境准备

- 准备浏览器测试环境（Chrome、Firefox、Safari）
- 准备小程序测试环境（微信开发者工具）
- 准备手动测试用例（PluginLoader、EventHub、Adapter）

### 7. 回退方案准备

- 备份现有代码（backup/before-refactoring/）
- 设计渐进式改造方案（改造一个启用一个）
- 设计单个插件改造失败的回退机制

## 关键约束

- 禁止绕过PluginBase直接创建插件
- 禁止插件间直接依赖（必须通过EventHub通信）
- 禁止使用全局变量污染命名空间
- 禁止在H5端使用小程序专有API（必须通过Adapter）
- 采用渐进式改造，改造过程中现有功能保持可用

## Tech Stack Selection

**当前技术栈**：

- 语言：ES6+ (ES2017+)
- 构建工具：无（使用`<script>`标签引入 + 动态`import()`）
- 代码规范：ESLint + Prettier（可选）
- 测试框架：Jest + Playwright（可选）
- 浏览器支持：Chrome 60+, Firefox 55+, Safari 11+ (无需IE11)
- 规则文件格式：Markdown (.md)
- 规则加载机制：CodeBuddy AI Agent 自动加载 `.codebuddy/rules/` 目录下的所有规则文件
- 字符限制：单个规则文件 ≤ 10,000 字符

**验证工具**：

- Node.js（用于JavaScript语法检查：`node --check`）
- Unix命令行工具（ls、grep、find、tree、wc）
- 浏览器开发者工具（Console）
- 微信开发者工具

## Implementation Approach

### 核心策略：分阶段准备，降低改造风险

**准备工作的逻辑顺序**：

1. **基础设施验证**（任务1-3）：确认核心模块文件、目录结构、技术栈环境
2. **代码分析**（任务4-5）：分析现有代码规模、模块划分、双端API差异
3. **环境与风险控制**（任务6-7）：准备测试环境、制定回退方案

**关键决策**：

1. **为什么先验证核心模块文件？**

- 核心模块是插件架构的基础，必须首先确认其存在和正确性
- 如果核心模块文件缺失或语法错误，后续改造无法进行

2. **为什么采用渐进式改造？**

- 改造过程中现有功能必须保持可用（文档第9节Q1）
- 改造一个插件，就启用一个插件，没改造的模块继续保持原样
- 降低改造风险，避免"大爆炸"式改造

3. **为什么需要回退方案？**

- 改造失败时能够快速回退（文档第9节Q2）
- 单个插件改造失败时，只需注释掉`export default`并恢复原来的`<script>`引入方式

### 性能与可靠性考虑

- **验证效率**：使用Node.js的`--check`参数快速验证JavaScript语法，无需执行
- **代码分析精度**：使用grep和正则表达式识别全局变量和函数调用，确保分析结果准确
- **回退方案可靠性**：使用`cp -r`完整备份，使用`diff -r`验证备份完整性

## Implementation Notes

### 性能优化

- **核心模块验证**：使用`node --check`快速验证语法，无需执行代码
- **代码规模统计**：使用`wc -l`快速统计行数，使用`grep -c`统计script标签数量
- **技术栈验证**：使用`grep -r`快速识别禁止的语法（var、require、.ts文件）

### 日志记录

- 在备份目录创建`BACKUP_INFO.md`，记录备份时间、文件列表、回退步骤
- 在测试环境准备完成后，输出测试环境信息（浏览器版本、小程序工具版本）

### blast半径控制

- **渐进式改造**：改造一个插件，就启用一个插件，避免一次性改造所有模块
- **回退方案**：每个插件独立，改造失败只需回退单个插件，不影响其他模块
- **禁止修改核心基类**：plugin-base.js、plugin-loader.js、dual-adapter.js、event-hub.js属于核心基础设施，禁止修改其接口和核心逻辑

## Architecture Design

### 改造前准备工作的逻辑关系

```
改造前准备工作
├── 1. 基础设施验证
│   ├── 任务1：确认核心模块文件
│   ├── 任务2：创建插件目录结构
│   └── 任务3：验证技术栈环境
│
├── 2. 代码分析
│   ├── 任务4：分析现有代码规模和模块
│   └── 任务5：分析双端API差异
│
└── 3. 环境与风险控制
    ├── 任务6：准备测试环境
    └── 任务7：制定回退方案
```

### 准备工作与改造阶段的关系

```
改造前准备工作（本计划）
    ↓
Phase 1：搭建基础设施（文档第5.2节）
    ↓
Phase 2：改造第一个插件（AI插件）（文档第5.3节）
    ↓
Phase 3：逐步改造其他模块（文档第5.4节）
    ↓
Phase 4：性能优化 + 测试（文档第5.1节）
```

**关键点**：

- 改造前准备工作完成后，才能开始Phase 1（搭建基础设施）
- 如果准备工作发现问题（如核心模块文件缺失），必须先解决问题，再开始改造

## Directory Structure

### 改造前准备工作的文件操作

```
/Users/rich/WorkBuddy/20260407113106/
├── mini-app-h5/backend/
│   ├── plugin-base.js           [VERIFY] 验证文件存在且语法正确
│   ├── plugin-loader.js         [VERIFY] 验证文件存在且语法正确
│   ├── dual-adapter.js         [VERIFY] 验证文件存在且语法正确
│   ├── event-hub.js           [VERIFY] 验证文件存在且语法正确
│   │
│   ├── plugins/                 [CREATE] 创建插件目录
│   │   ├── core/               [CREATE] 创建核心插件目录
│   │   └── optional/          [CREATE] 创建可选插件目录
│   │
│   ├── admin-legacy.html        [ANALYZE] 分析代码规模和模块划分
│   └── ... (其他文件)
│
└── backup/
    └── before-refactoring/      [CREATE] 创建备份目录
        ├── mini-app-h5/backend/  [BACKUP] 备份整个backend目录
        └── BACKUP_INFO.md       [CREATE] 记录备份信息
```

## Key Code Structures

### 无关键代码结构体

**说明**：改造前准备工作主要涉及文件验证、目录创建、代码分析、环境准备，不涉及具体的代码开发。因此，无需生成接口定义或类型定义。

**相关代码文件**（仅列出，不生成代码）：

1. **plugin-base.js**：插件基类，所有插件都要继承这个类
2. **plugin-loader.js**：插件加载器，负责管理插件的加载和卸载
3. **dual-adapter.js**：双端适配器，屏蔽H5/小程序差异
4. **event-hub.js**：事件中心，插件间通信

**这些文件在任务1中验证，在Phase 1中引入到admin-legacy.html。**
