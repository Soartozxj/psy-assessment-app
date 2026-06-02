# scoring-plugin.js 文档

## 📋 概述

`scoring-plugin.js` 是心理评估小程序后端管理系统的**计分规则插件**，负责量表的计分规则配置和管理。

### 核心功能

1. **量表管理** - 加载和展示所有量表
2. **维度配置** - 配置计分维度（如躯体化、强迫症状等）
3. **指标配置** - 配置计分指标（如总分、阳性项目数等）
4. **解释规则** - 配置分数解释的阈值分档
5. **筛查规则** - 配置多条件筛查判定
6. **模拟测试** - 用模拟数据测试计分规则

### 技术架构

- **继承**: `PluginBase`（获得标准插件接口）
- **适配**: 通过 `DualAdapter` 适配 H5 和小程序双端
- **通信**: 通过 `EventHub` 与其他插件通信
- **加载**: 通过 `PluginLoader` 动态加载

---

## 🚀 快速开始

### 1. 在 HTML 中引入插件

```html
<!-- 先引入基础架构 -->
<script src="plugins/core/plugin-base.js"></script>
<script src="plugins/core/dual-adapter.js"></script>
<script src="plugins/core/event-hub.js"></script>
<script src="plugins/core/plugin-loader.js"></script>

<!-- 再引入 scoring-plugin -->
<script src="plugins/core/scoring-plugin.js"></script>
```

### 2. 初始化插件

```javascript
// 插件会在 DOMContentLoaded 时自动注册到 PluginLoader
document.addEventListener('DOMContentLoaded', async () => {
  // 获取插件实例
  const scoringPlugin = PluginLoader.get('scoring');

  // 初始化插件
  await scoringPlugin.init();

  console.log('计分规则插件已就绪');
});
```

### 3. 基本使用

```javascript
// 获取所有量表列表
const scales = await PluginLoader.execute('scoring', { action: 'list' });
console.log(scales);

// 选择某个量表
await PluginLoader.execute('scoring', { action: 'select', scaleId: 1 });

// 渲染量表列表（左侧面板）
await PluginLoader.execute('scoring', { action: 'render-list' });

// 添加维度
await PluginLoader.execute('scoring', { action: 'add-dimension' });

// 添加指标
await PluginLoader.execute('scoring', { action: 'add-metric' });

// 保存配置
await PluginLoader.execute('scoring', { action: 'save' });
```

---

## 📚 API 详解

### `PluginLoader.execute('scoring', params)`

所有功能通过 `PluginLoader.execute()` 调用，传入 `action` 参数指定操作。

#### 1. `action: 'list'`

获取所有量表列表（包含计分规则配置状态）。

**参数**: 无

**返回**: `Array<ScaleSummary>`

```javascript
[
  {
    id: 1,
    name: 'PHQ-9 抑郁症筛查量表',
    code: 'PHQ-9',
    questionCount: 9,
    hasScoring: true // 是否已配置计分规则
  }
  // ...
];
```

#### 2. `action: 'get'`

获取单个量表的完整数据。

**参数**:

- `id` (Number) - 量表 ID

**返回**: `ScaleData`

#### 3. `action: 'select'`

选择某个量表，加载其计分规则配置。

**参数**:

- `scaleId` (Number) - 量表 ID

**效果**:

- 更新插件内部状态 `_currentScaleId`
- 高亮左侧列表项
- 显示右侧编辑区域
- 加载计分规则表单

#### 4. `action: 'render-list'`

渲染左侧量表列表（HTML）。

**参数**: 无

**效果**:

- 清空 `#scoring-scale-list` 容器
- 根据搜索关键词过滤量表
- 为每个量表生成列表项 HTML
- 标记已配置计分规则的量表

#### 5. `action: 'load-form'`

加载计分规则表单（内嵌模式）。

**参数**:

- `scaleId` (Number) - 量表 ID

**效果**:

- 构建 5 个步骤面板的 HTML
- 渲染已有维度、指标、解释规则、筛查规则
- 插入到 `#scoring-form-container` 容器

#### 6. `action: 'add-dimension'`

添加一个新的维度卡片。

**参数**: 无

**效果**:

- 在 `#sc-dims-list` 容器添加一个空的维度卡片
- 包含维度键名、名称、计算公式、题号、解释阈值等字段

#### 7. `action: 'add-metric'`

添加一个新的指标卡片。

**参数**: 无

**效果**:

- 在 `#sc-metrics-list` 容器添加一个空的指标卡片
- 包含指标键名、名称、计算公式、条件、派生表达式等字段

#### 8. `action: 'add-interp-rule'`

添加一条解释规则。

**参数**: 无

**效果**:

- 在 `#sc-interp-list` 容器添加一行解释规则
- 包含指标/维度选择、分数范围、等级、标签、颜色、解释文本

#### 9. `action: 'add-screen-cond'`

添加一条筛查条件。

**参数**: 无

**效果**:

- 在 `#sc-screen-conds` 容器添加一行筛查条件
- 包含指标/维度选择、操作符、阈值、标签

#### 10. `action: 'save'`

保存当前量表的计分规则配置。

**参数**: 无

**效果**:

1. 收集表单数据（`_collectScoringData()`）
2. 更新 `scales` 全局变量
3. 保存到 `localStorage`（`SharedData.saveScalesData()`）
4. 同步到前端（`SharedData.syncToFrontend()`）
5. 显示成功提示
6. 刷新量表列表标记

**数据结构**:

```javascript
{
  dimensions: [  // 维度配置
    {
      key: "somatization",
      label: "躯体化",
      formula: "AVG",  // SUM | AVG | COUNT_IF
      items: "1,2,3",  // 题号，或 "ALL"
      condition: { ">=": 2 },  // COUNT_IF 条件
      interpretation: [  // 维度解释阈值
        { min: 0, max: 1.0, level: "normal", label: "正常", color: "#52c41a", text: "..." }
      ],
      maxScore: 5  // 满分（可选，自动推导）
    }
  ],
  metrics: [  // 指标配置
    {
      key: "totalScore",
      label: "总分",
      formula: "SUM",
      items: "ALL",
      condition: null,
      transform: null,  // { type: "linear", expression: "1.25*x" }
      expression: null  // DERIVED 派生表达式
    }
  ],
  interpretation: [  // 解释规则
    {
      metric: "",  // 空表示总分
      min: 0,
      max: 4,
      level: "normal",
      label: "正常",
      color: "#52c41a",
      text: "..."
    }
  ],
  screening: {  // 筛查规则（可选）
    logic: "OR",  // OR | AND
    conditions: [
      { metric: "totalScore", op: ">=", value: 15, label: "中度及以上" }
    ],
    positiveLabel: "筛查阳性",
    negativeLabel: "筛查阴性"
  }
}
```

#### 11. `action: 'reset'`

重置当前量表的计分规则（删除配置）。

**参数**: 无

**效果**:

1. 确认提示（UIUtils.showConfirm）
2. 将 `scale.scoring` 设为 `null`
3. 保存到 localStorage
4. 重新加载表单（清空）
5. 刷新量表列表标记

#### 12. `action: 'run-test'`

运行模拟测试。

**参数**: 无

**效果**:

1. 收集当前表单数据（临时）
2. 生成模拟答案（全部选第一个选项）
3. 调用 `ScoringEngine.calculate()` 计算得分
4. 在 `#sc-test-area` 显示模拟结果
   - 指标得分
   - 解释结果（等级、标签、颜色、文本）
   - 维度得分（进度条）
   - 筛查结果

#### 13. `action: 'switch-panel'`

切换计分规则面板（5 个步骤）。

**参数**:

- `btn` (HTMLElement) - 点击的按钮
- `idx` (Number) - 面板索引（0-4）

**效果**:

- 更新按钮样式（高亮当前面板）
- 显示对应面板，隐藏其他面板

---

## 🎨 UI 结构

### 主界面布局

```
+------------------+-----------------------------------+
|  左侧量表列表      |  右侧计分规则配置                  |
|                  |                                    |
|  [搜索框]        |  [① 维度配置] [② 指标配置] ...    |
|  ┌────────────┐  |                                    |
|  │ 量表1  ✓   │  |  +----------------------------+    |
|  ├────────────┤  |  | 维度1: 躯体化               |    |
|  │ 量表2       │  |  | - 键名: somatization      |    |
|  └────────────┘  |  | - 公式: AVG                |    |
|                  |  | - 题号: 1,2,3              |    |
|                  |  +----------------------------+
+------------------+-----------------------------------+
```

### 5 个步骤面板

1. **① 维度配置** - 配置计分维度
2. **② 指标配置** - 配置计分指标
3. **③ 解释规则** - 配置分数解释
4. **④ 筛查规则** - 配置筛查判定
5. **⑤ 模拟测试** - 测试计分规则

---

## 🔧 私有方法

以下方法为插件内部使用，不推荐外部直接调用。

### `_loadScales()`

加载量表数据。

**数据源**:

- 优先使用全局变量 `scales`
- 回退到 `localStorage.getItem('scalesData')`

### `_getSelectedScale()`

获取当前选中的量表。

**返回**: `ScaleData | null`

### `_buildScoringFormHTML(scaleId)`

构建计分规则表单的 HTML。

**返回**: `String` (HTML 字符串)

### `_renderDimension(dim, index)`

渲染单个维度卡片。

**参数**:

- `dim` (Object) - 维度数据
- `index` (Number) - 索引

### `_renderMetric(metric)`

渲染单个指标卡片。

**参数**:

- `metric` (Object) - 指标数据

### `_renderInterpRule(rule, index, metrics, dimensions)`

渲染单条解释规则行。

**参数**:

- `rule` (Object) - 解释规则数据
- `index` (Number) - 索引
- `metrics` (Array) - 指标列表（用于下拉框）
- `dimensions` (Array) - 维度列表（用于下拉框）

### `_renderScreening(screening, metrics, dimensions)`

渲染筛查规则区域。

**参数**:

- `screening` (Object | null) - 筛查规则数据
- `metrics` (Array) - 指标列表
- `dimensions` (Array) - 维度列表

### `_collectScoringData()`

收集表单数据（从 DOM 中读取）。

**返回**: `Object` (计分规则数据)

**收集内容**:

1. 维度（`.sc-dim-card`）
2. 指标（`#sc-metrics-list > div`）
3. 解释规则（`.sc-interp-row`）
4. 筛查规则（`.sc-screen-cond`）

### `_parseConditionStr(str)`

解析条件字符串。

**输入**: `" >=2, <=4 "`
**输出**: `{ ">=": 2, "<=": 4 }`

### `_escHtml(str)`

HTML 转义。

**输入**: `<script>alert('xss')</script>`
**输出**: `&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;`

---

## 🧪 测试

### 自动化测试脚本

使用 `test-scoring-plugin-auto.js` 进行自动化测试。

```html
<!-- 在测试页面中引入 -->
<script src="test-scoring-plugin-auto.js"></script>

<script>
  // 运行测试
  runScoringPluginTests().then((results) => {
    console.log('测试结果:', results);
  });
</script>
```

### 手动测试清单

1. **插件加载测试**
   - [ ] `PluginLoader.get('scoring')` 返回插件实例
   - [ ] 插件名称、版本正确

2. **list action 测试**
   - [ ] 返回数组
   - [ ] 数组长度 > 0
   - [ ] 每个元素有 `id`, `name`, `questionCount`, `hasScoring` 字段

3. **select action 测试**
   - [ ] 选择量表后，`_currentScaleId` 更新
   - [ ] 左侧列表项高亮
   - [ ] 右侧编辑区域显示

4. **维度配置测试**
   - [ ] 点击"添加维度"按钮，新增维度卡片
   - [ ] 填写维度信息，保存后数据正确
   - [ ] 删除维度，确认后维度卡片移除

5. **指标配置测试**
   - [ ] 点击"添加指标"按钮，新增指标卡片
   - [ ] 填写指标信息，保存后数据正确
   - [ ] 删除指标，确认后指标卡片移除

6. **解释规则测试**
   - [ ] 点击"添加分档"按钮，新增解释规则行
   - [ ] 填写解释规则，保存后数据正确
   - [ ] 删除解释规则，确认后移除

7. **筛查规则测试**
   - [ ] 点击"添加条件"按钮，新增筛查条件行
   - [ ] 填写筛查条件，保存后数据正确
   - [ ] 删除筛查条件，确认后移除

8. **模拟测试**
   - [ ] 点击"运行模拟测试"按钮，显示模拟结果
   - [ ] 模拟结果包含指标得分、解释、维度得分、筛查结果

9. **保存配置测试**
   - [ ] 点击"保存"按钮，数据保存到 localStorage
   - [ ] 刷新页面后，数据仍然存在
   - [ ] 左侧列表标记更新（显示"✅已配置"）

10. **重置配置测试**
    - [ ] 点击"重置"按钮，确认后配置删除
    - [ ] 刷新页面后，配置已删除
    - [ ] 左侧列表标记更新（移除"✅已配置"）

---

## ⚠️ 注意事项

### 1. 依赖项

`scoring-plugin.js` 依赖以下全局变量/函数：

- `scales` - 量表数据（全局变量）
- `SharedData` - 数据持久化工具
- `UIUtils` - UI 工具（showToast, showConfirm）
- `ScoringEngine` - 计分引擎（用于模拟测试）
- `PluginBase` - 插件基类
- `PluginLoader` - 插件加载器

### 2. DOM 元素 ID

插件需要以下 DOM 元素存在：

- `#scoring-scale-list` - 左侧量表列表容器
- `#scoring-scale-search` - 搜索输入框
- `#scoring-empty` - 空状态提示
- `#scoring-editor` - 编辑区域
- `#scoring-form-container` - 表单容器
- `#sc-dims-list` - 维度列表容器
- `#sc-metrics-list` - 指标列表容器
- `#sc-interp-list` - 解释规则列表容器
- `#sc-screening-area` - 筛查规则区域容器
- `#sc-test-area` - 模拟测试结果容器
- `#sc-panel-0` ~ `#sc-panel-4` - 5 个步骤面板

### 3. 数据结构

计分规则数据保存在 `scale.scoring` 字段中，结构如下：

```javascript
scale.scoring = {
  dimensions: [], // 维度配置
  metrics: [], // 指标配置
  interpretation: [], // 解释规则
  screening: null // 筛查规则（可选）
};
```

### 4. 向后兼容

为了向后兼容，插件保留了以下全局函数（在 `admin-legacy.html` 中定义）：

- `manageScoringRules()`
- `closeScoringModal()`
- `renderScoringScaleList()`
- `filterScoringScaleList()`
- `selectScoringScale(scaleId)`
- `loadScoringFormInline(scaleId)`
- `switchScPanel(btn, idx)`
- `saveScoringConfig()`
- `resetScoring()`
- `addDimension()`
- `addMetric()`
- `addInterpRule()`
- `addScreenCond()`
- `runScoringTest()`

这些函数内部调用 `PluginLoader.execute('scoring', { action: '...' })`。

---

## 📊 性能优化

### 1. 按需加载

计分规则插件是**核心插件**，在 `admin-legacy.html` 中预加载：

```html
<script src="plugins/core/scoring-plugin.js"></script>
```

### 2. 事件委托

插件使用事件委托处理动态生成的 DOM 元素：

```javascript
document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;
  switch (action) {
    case 'sc-add-dimension':
      PluginLoader.execute('scoring', { action: 'add-dimension' });
      break;
    // ...
  }
});
```

### 3. 数据缓存

插件内部缓存了量表数据（`this._scales`），避免频繁读取 localStorage。

---

## 🐛 常见问题

### 1. 插件加载失败

**症状**: `PluginLoader.get('scoring')` 返回 `null`

**原因**:

- `scoring-plugin.js` 未正确引入
- 插件初始化失败（如依赖缺失）

**解决**:

1. 检查 `<script>` 标签顺序，确保先引入 `plugin-base.js`, `plugin-loader.js`
2. 检查浏览器控制台，查看错误信息
3. 确保 `PluginBase` 和 `PluginLoader` 已全局可用

### 2. 量表列表为空

**症状**: `action: 'list'` 返回空数组

**原因**:

- `scales` 全局变量未定义
- `localStorage` 中没有 `scalesData`

**解决**:

1. 确保先加载 `admin-scales.js` 或 `scale-plugin.js`，初始化 `scales` 变量
2. 检查 `localStorage.getItem('scalesData')` 是否有数据

### 3. 保存配置后数据丢失

**症状**: 刷新页面后，计分规则配置丢失

**原因**:

- `SharedData.saveScalesData()` 调用失败
- `localStorage` 被禁用或清除

**解决**:

1. 检查浏览器是否禁用了 `localStorage`
2. 检查 `SharedData` 是否正确定义
3. 手动检查 `localStorage.getItem('scalesData')` 是否有数据

### 4. 模拟测试无结果

**症状**: 点击"运行模拟测试"后无反应或报错

**原因**:

- `ScoringEngine` 未定义
- 计分规则配置错误

**解决**:

1. 确保 `ScoringEngine` 已全局可用（引入 `scoring-engine.js`）
2. 检查计分规则配置是否正确（维度、指标、公式等）

---

## 📖 参考资料

- [PluginBase 文档](../plugins/core/plugin-base.js)
- [PluginLoader 文档](../plugins/core/plugin-loader.js)
- [DualAdapter 文档](../plugins/core/dual-adapter.js)
- [EventHub 文档](../plugins/core/event-hub.js)
- [ScoringEngine 文档](../utils/scoring-engine.js)

---

## 📝 更新日志

### v2.0.0 (2026-06-02)

- 🎉 初始版本，从 `admin-scoring.js` 迁移
- ✅ 完整实现维度配置、指标配置、解释规则、筛查规则、模拟测试
- ✅ 适配 PluginBase 架构
- ✅ 支持事件委托
- ✅ 向后兼容全局函数

---

**文档版本**: 1.0.0  
**最后更新**: 2026-06-02  
**作者**: Rich  
**维护者**: Rich
