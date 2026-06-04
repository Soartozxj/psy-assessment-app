---
name: Skills架构改造收尾与质量提升实施计划（2周冲刺·整合版）
overview: 在2周冲刺周期内完成：1) 冗余文件清理与插件化收尾；2) 安全修复验证(P0/P1)；3) 测试覆盖率从0%提升到85%（含Skill新架构本地全面测试）；4) admin-legacy.html性能优化与拆分；5) 微信小程序开发计划制定；6) "情绪日记"与"冥想"两项核心功能开发（功能设计、接口对接、前端实现）。
design:
  styleKeywords:
    - Minimalism
    - Clean
    - Soothing
  fontSystem:
    fontFamily: System Default
    heading:
      size: 32rpx
      weight: 600
    subheading:
      size: 28rpx
      weight: 500
    body:
      size: 28rpx
      weight: 400
  colorSystem:
    primary:
      - "#4a90d9"
      - "#6ba3e0"
      - "#3a7bc8"
    background:
      - "#ffffff"
      - "#f8f9fa"
    text:
      - "#333333"
      - "#666666"
    functional:
      - "#7ed321"
      - "#f5a623"
      - "#d0021b"
todos:
  - id: t01-cleanup
    content: 清理冗余文件（删除admin-auth.js等已迁移的旧文件），完成插件化收尾
    status: completed
  - id: t02-security
    content: 验证P1安全修复（eval()→vm、输入验证、HTTPS配置），输出安全验证报告
    status: completed
    dependencies:
      - t01-cleanup
  - id: t03-test-refactor
    content: 重构测试框架，移除Mock类，引入实际业务代码，覆盖率提升到50%
    status: completed
    dependencies:
      - t02-security
  - id: t04-coverage
    content: 补充边界和集成测试，覆盖率提升到85%，更新jest.config.js
    status: completed
    dependencies:
      - t03-test-refactor
  - id: t05-arch-test
    content: 编写Skill架构本地测试用例（PluginBase、PluginLoader、EventHub、DualAdapter）
    status: completed
    dependencies:
      - t04-coverage
  - id: t06-onclick
    content: 优化内联onclick第一批（减少100处），使用data-action属性替代
    status: completed
    dependencies:
      - t05-arch-test
  - id: t07-split-design
    content: 设计admin-legacy.html拆分方案，制定按需加载机制
    status: completed
    dependencies:
      - t06-onclick
  - id: t08-split-impl
    content: 实施admin-legacy.html拆分（dashboard + scale管理section）
    status: completed
    dependencies:
      - t07-split-design
  - id: t09-split-complete
    content: 完成admin-legacy.html拆分（NPC、AI、计分section），验证无回归
    status: completed
    dependencies:
      - t08-split-impl
  - id: t10-miniapp-plan
    content: 制定微信小程序开发计划，规划整体开发与上线路径
    status: completed
    dependencies:
      - t09-split-complete
  - id: t11-diary-design
    content: 设计"情绪日记"功能（功能设计、接口定义、数据流）
    status: completed
    dependencies:
      - t10-miniapp-plan
  - id: t12-diary-api
    content: 实现"情绪日记"后端API（/api/diary端点）
    status: completed
    dependencies:
      - t11-diary-design
  - id: t13-diary-frontend
    content: 实现"情绪日记"前端页面（pages/diary/*）
    status: completed
    dependencies:
      - t12-diary-api
  - id: t14-meditation-design
    content: 设计"冥想"功能（功能设计、音频管理、播放器设计）
    status: completed
    dependencies:
      - t13-diary-frontend
  - id: t15-meditation-api
    content: 实现"冥想"后端API（/api/meditation端点）
    status: completed
    dependencies:
      - t14-meditation-design
  - id: t16-meditation-frontend
    content: 实现"冥想"前端页面（pages/meditation/* + 全屏播放器）
    status: completed
    dependencies:
      - t15-meditation-api
  - id: t17-index-entry
    content: 在首页新增"情绪日记"和"冥想"入口（修改pages/index/*）
    status: completed
    dependencies:
      - t16-meditation-frontend
  - id: t18-full-test
    content: 执行全面的本地测试，确保Skill新架构和新增功能运行稳定
    status: completed
    dependencies:
      - t17-index-entry
  - id: t19-perf-verify
    content: 性能优化验证（Lighthouse>90，首屏
    status: completed
    dependencies:
      - t18-full-test
---

## 需求分析

### 原始需求

对项目的当前技术栈、业务进展及存在的痛点进行全面分析，制定详细的下一步实施计划，包含任务拆解、时间节点、预期目标和所需的技术与资源支持。

### 补充需求

1. 增加本地测试环节，针对Skill新架构编写并执行全面的本地测试用例
2. 纳入微信小程序的开发计划，规划整体开发与上线路径
3. 新增微信小程序"情绪日记"与"冥想"两项核心功能的开发任务

### 已确认的优先级

- 冗余文件清理与插件化收尾
- 性能优化（admin-legacy.html拆分）
- 测试覆盖率提升（从0%到85%）
- 安全修复验证（P0/P1级别）

### 约束条件

- 时间范围：2周（一个冲刺周期）
- 团队资源：1人全职

## 技术栈

### 现有技术栈

- **后端**：Node.js + Express（ES6+，无TypeScript）
- **前端**：原生ES Module（无Webpack）
- **测试**：Jest 30.3.0 + Playwright 1.59.1
- **小程序**：微信小程序原生开发
- **代码质量**：ESLint + Prettier + Husky

### 核心实施方案

#### 1. 冗余文件清理

删除已迁移的旧文件：`admin-auth.js`、`admin-ai-config.js`、`admin-npc.js`、`admin-scoring.js`

#### 2. 安全修复验证

- 验证`eval()`是否已使用`vm`模块替代
- 验证`express-validator`是否已正确配置
- 准备HTTPS配置指南

#### 3. 测试覆盖率提升

重构测试文件，移除Mock，引入实际业务代码，更新`jest.config.js`阈值到85%

#### 4. admin-legacy.html拆分

按section拆分，实现Ajax动态加载，首屏仅加载核心CSS/JS

#### 5. Skill架构本地测试

编写PluginBase、PluginLoader、EventHub、DualAdapter的单元测试和集成测试

#### 6. 微信小程序开发

- 新增`pages/diary/`和`pages/meditation/`页面
- 新增`utils/diary-helper.js`和`utils/meditation-helper.js`
- 新增后端API：`/api/diary`和`/api/meditation`

#### 7. "情绪日记"功能

- 功能：记录每日情绪（1-5星）、文字描述、关联测评结果
- 接口：`createDiaryEntry`、`fetchDiaryEntries`、`fetchDiaryStats`
- 前端：`pages/diary/diary.wxml`（星星评分 + textarea + 历史列表）

#### 8. "冥想"功能

- 功能：冥想音频列表、定时设置、后台播放、历史记录
- 接口：`fetchMeditationList`、`createMeditationRecord`、`fetchMeditationStats`
- 前端：`pages/meditation/meditation.wxml`（列表 + 全屏播放器）

### 目录结构

```
mini-app-native/
├── app.json (新增diary和meditation页面)
├── utils/
│   ├── api.js (新增diary和meditation接口)
│   ├── diary-helper.js (新增)
│   └── meditation-helper.js (新增)
├── pages/
│   ├── index/ (修改，新增入口)
│   ├── diary/ (新增)
│   └── meditation/ (新增)
└── server/
    └── routes/
        ├── diary.js (新增)
        └── meditation.js (新增)
```

## 设计风格

### 整体风格

- 遵循微信小程序设计指南，与现有小程序保持一致
- 沿用品牌色`#4a90d9`体系
- 系统默认字体，标题32rpx/正文28rpx/辅助24rpx

### "情绪日记"页面

- 垂直滚动布局：日期 + 星星评分 + textarea + 历史列表
- 柔和渐变色背景，卡片式设计
- 保存成功Toast提示，评分星星缩放动画

### "冥想"页面

- 列表展示冥想音频，点击后全屏播放器
- 自然背景图，半透明播放器控件
- 播放器淡入淡出，进度条平滑更新

### 首页改造

- 在问候区下方新增"情绪日记"和"冥想"入口按钮
- 使用emoji图标（📒 情绪日记，🧘 冥想）

## 使用的扩展

### Skill

- **design-to-code-workflows**：将UI设计转换为小程序代码组件

### SubAgent

- **code-explorer**：探索现有代码库，了解架构模式