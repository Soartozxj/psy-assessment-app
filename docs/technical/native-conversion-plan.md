# 星蓝心镜 · H5 → 小程序全原生转换计划

> 2026-05-17 | 源: mini-app-h5/frontend/index.html | 目标: wechat-miniprogram/pages/

---

## 一、依赖分析

### 可复用的共享逻辑（不改）

| 文件                 | 用途                           | 小程序引用方式                           |
| -------------------- | ------------------------------ | ---------------------------------------- |
| `scoring-engine.js`  | 计分引擎（维度分、分组、反向） | `require` 或内联到 `utils/score-calc.js` |
| `shared-data.js`     | 量表数据 & 历史记录            | `require` 或转为云数据库调用             |
| `default-prompts.js` | Meta 提示词                    | AI 报告生成时云函数调用                  |

### 需适配的 API

| H5                         | 小程序等价                         | 位置                |
| -------------------------- | ---------------------------------- | ------------------- |
| `localStorage`             | `wx.setStorageSync/getStorageSync` | `utils/storage.js`  |
| `fetch()`                  | `wx.request` 或云函数              | `utils/api.js`      |
| `document.querySelector`   | `this.setData` + 数据绑定          | 所有页面            |
| `navigator.userAgent` 检测 | `wx.getSystemInfoSync()`           | `utils/platform.js` |
| `location.search`          | `options` 参数（onLoad）           | 路由参数            |

---

## 二、页面转换清单

### 1. 答题页 (pages/assessment/) — 完整对标 H5

**H5 源码位置**: `index.html` L8431-10600 (~2000 行)

**需实现（对标 H5 全部功能）**:

- [ ] **NPC 沉浸模式**：角色立绘（png 图片）+ 背景场景 + 对话气泡框
- [ ] **4 种题型 WXML**：single(单选芯片)、grouped(分组芯片)、matrix(矩阵表格)、parent-child(父子题)
- [ ] **选项芯片动画**：选中高亮、缩放反馈
- [ ] **确认按钮**：选中后显示"确认并继续"按钮条（保持 H5 交互）
- [ ] **题间过渡动画**：slide-up 效果（wx.createAnimation）
- [ ] **答案状态管理**：`answers = { qId: value }` 存入 `wx.setStorage`
- [ ] **进度条**：`当前题/总题数`（顶部或 NPC 对话中）
- [ ] **返回上一题 / 中断退出**
- [ ] **计分调用**：答题完成 → `scoring-engine.score(scale, answers)` → 存结果 → 跳报告页

**依赖**:

- `utils/score-calc.js`（包装 scoring-engine.js）
- `utils/storage.js`（答案持久化）
- `utils/api.js`（提交云数据库）
- NPC 立绘图片 & 场景背景图（从 H5 的 AssetStorage 复用）

**预估**: ~500 行 JS + ~350 行 WXML + ~200 行 WXSS

---

### 2. 量表列表页 (pages/scales/) — 已完成

**状态**: ✅ 已有搜索、分类筛选、卡片列表

**待优化**:

- [ ] 数据源从 `data/scales-summary.json` 切换到云函数 `data-sync`
- [ ] 加入"完成人次"统计

---

### 3. 量表详情页 (pages/detail/) — 已完成

**状态**: ✅ 已有介绍、标签、统计、开始按钮

**待优化**:

- [ ] 测前问卷表单（text/number/select/checkbox 输入类型）
- [ ] 从云数据库读完整量表信息（含 desc、notice、questions）

---

### 4. 测评报告页 (pages/report/) — 基础完成

**状态**: ✅ 已有维度分条形图、分享按钮

**待优化**:

- [ ] Canvas 评分圆环（替换纯文本分数）
- [ ] AI 报告入口（调用云函数 ai-call → 显示 markdown）
- [ ] 维度等级标签（高/中/低）

---

### 5. 历史记录页 (pages/history/) — 占位

**需实现**:

- [ ] 云数据库读取用户测评记录列表
- [ ] 每条记录：量表名 + 日期 + 总分 + 点击查看报告
- [ ] 空状态占位

**预估**: ~80 行 JS + ~50 行 WXML

---

### 6. 首页 (pages/home/) — 已完成

**状态**: ✅ 已有分类卡片、搜索入口

---

## 三、新工具文件

| 文件                  | 复用自              | 职责                                                               |
| --------------------- | ------------------- | ------------------------------------------------------------------ |
| `utils/score-calc.js` | `scoring-engine.js` | 包装：`score(scale, answers) → {total, dimensions}`                |
| `utils/storage.js`    | 新建                | `get(key)` `set(key,val)` `remove(key)` — 封装 `wx.setStorageSync` |
| `utils/api.js`        | `cloud-api.js`      | `fetchScales()` `saveRecord()` `getHistory()` — 封装云函数         |

---

## 四、执行顺序（按依赖关系）

```
Phase 2: 工具层
  ├── utils/storage.js      (0.2h)
  ├── utils/score-calc.js   (0.5h — 包装 scoring-engine)
  └── utils/api.js          (0.3h)

Phase 3: 增强已有页面
  ├── pages/detail 加测前问卷  (1h)
  ├── pages/scales 切换数据源   (0.3h)
  └── pages/report 加 Canvas   (0.5h)

Phase 4: 核心 — 答题页原生化（对标 H5 全部体验）
  ├── 题型渲染器 WXML (4种)     (2h)
  ├── 选项芯片 + 动画            (1h)
  ├── NPC 组件 (立绘+气泡+背景)  (1.5h)
  ├── 确认按钮条组件             (0.5h)
  ├── 答案状态管理               (1h)
  ├── 进度 & 导航 & 中断         (0.5h)
  └── 计分 & 结果跳转            (0.5h)

Phase 5: 补充页面
  ├── pages/history 记录列表    (0.5h)
  └── pages/home 数据源增强     (0h — 已内联)
```

---

## 五、风险点

| 风险                                | 缓解                                                           |
| ----------------------------------- | -------------------------------------------------------------- |
| WXML 不支持复杂 DOM 操作            | 全部改为数据绑定 + setData，不操作 DOM                         |
| scoring-engine.js 依赖 `SharedData` | 新建包装层，传入纯数据对象                                     |
| NPC 沉浸模式过于复杂                | 全量实现：NPC 立绘 + 背景场景 + 对话气泡 + 选项芯片 + 确认按钮 |
| 分组题（grouped）渲染复杂           | 先支持简单分组（EMBU），数组分组后续                           |

---

按此计划从 Phase 2 工具层开始？
