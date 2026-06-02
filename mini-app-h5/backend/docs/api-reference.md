# API 参考手册

> 完整的插件系统 API 文档，供开发者查阅。

---

## 目录

1. [PluginBase API](#pluginbase-api)
2. [ScoringPlugin API](#scoringplugin-api)
3. [NpcPlugin API](#npcplugin-api)
4. [通用返回格式](#通用返回格式)
5. [事件系统](#事件系统)

---

## PluginBase API

所有插件的基类，提供标准接口。

### 构造函数

```javascript
const plugin = new PluginBase({
  name: '插件名称',
  version: '1.0.0',
  description: '插件描述'
});
```

### 属性

| 属性            | 类型      | 说明                 |
| --------------- | --------- | -------------------- |
| `name`          | `string`  | 插件名称（只读）     |
| `version`       | `string`  | 插件版本（只读）     |
| `description`   | `string`  | 插件描述（只读）     |
| `isInitialized` | `boolean` | 是否已初始化（只读） |

### 方法

#### `init()`

初始化插件，调用 `onInit()` 模板方法。

```javascript
await plugin.init();
```

#### `execute(params)`

执行插件动作，调用 `onExecute(params)` 模板方法。

```javascript
const result = plugin.execute({ action: 'list' });
```

#### `destroy()`

销毁插件，调用 `onDestroy()` 模板方法，清理资源。

```javascript
plugin.destroy();
```

#### `onInit()` （模板方法，子类重写）

初始化逻辑，子类必须重写。

```javascript
// 在 ScoringPlugin 中
async onInit() {
  await this._loadScales();
}
```

#### `onExecute(params)` （模板方法，子类重写）

执行逻辑，子类必须重写。

```javascript
// 在 ScoringPlugin 中
onExecute(params) {
  switch (params.action) {
    case 'list':
      return this._getScalesList();
    // ...
  }
}
```

#### `onDestroy()` （模板方法，子类重写）

清理逻辑，子类可选重写。

```javascript
// 在 ScoringPlugin 中
onDestroy() {
  this._scales = null;
}
```

---

## ScoringPlugin API

计分规则插件，管理量表的计分规则。

### 构造

```javascript
const plugin = new ScoringPlugin();
```

### 支持的 Action

#### `list`

获取所有量表的简要信息。

```javascript
const result = plugin.execute({ action: 'list' });
// 返回: { success: true, data: [{ id, name, questionCount, hasScoring }] }
```

#### `view`

获取指定量表的详细信息。

```javascript
const result = plugin.execute({ action: 'view', id: 'SCL90' });
// 返回: { success: true, data: { id, name, scoring: {...} } }
```

#### `editDimension`

修改维度配置。

```javascript
const result = plugin.execute({
  action: 'editDimension',
  idx: 0, // 维度索引
  field: 'label', // 字段名: 'label' | 'formula' | 'items'
  value: '新名称' // 新值
});
```

#### `addDimension`

添加新维度。

```javascript
const result = plugin.execute({ action: 'addDimension' });
// 返回: { success: true, data: { newIndex: 3 } }
```

#### `removeDimension`

删除维度。

```javascript
const result = plugin.execute({
  action: 'removeDimension',
  idx: 0 // 要删除的维度索引
});
```

#### `editMetric`

修改指标配置。

```javascript
const result = plugin.execute({
  action: 'editMetric',
  idx: 0,
  field: 'label',
  value: '新指标名称'
});
```

#### `addMetric`

添加新指标。

```javascript
const result = plugin.execute({ action: 'addMetric' });
```

#### `removeMetric`

删除指标。

```javascript
const result = plugin.execute({
  action: 'removeMetric',
  idx: 0
});
```

#### `editInterpretation`

修改解释规则。

```javascript
const result = plugin.execute({
  action: 'editInterpretation',
  idx: 0,
  field: 'min', // 'min' | 'max' | 'label' | 'suggestion'
  value: 50
});
```

#### `addInterpretation`

添加解释规则。

```javascript
const result = plugin.execute({ action: 'addInterpretation' });
```

#### `removeInterpretation`

删除解释规则。

```javascript
const result = plugin.execute({
  action: 'removeInterpretation',
  idx: 0
});
```

#### `editScreening`

修改筛查规则。

```javascript
const result = plugin.execute({
  action: 'editScreening',
  field: 'enabled', // 'enabled' | 'threshold' | 'action'
  value: true
});
```

#### `simulateScore`

模拟计分。

```javascript
const result = plugin.execute({
  action: 'simulateScore',
  answers: [1, 2, 3, ...]  // 答题数组
});
// 返回: { success: true, data: { dimensionScores, metricScores, interpretations } }
```

#### `save`

保存计分规则。

```javascript
const result = plugin.execute({ action: 'save' });
```

---

## NpcPlugin API

NPC 配置插件，管理咨询师、背景、过渡语配置。

### 构造

```javascript
const plugin = new NpcPlugin();
```

### 支持的 Action

#### `list`

获取配置摘要。

```javascript
const result = plugin.execute({ action: 'list' });
// 返回: { success: true, data: { counselorCount, backgroundCount, ... } }
```

#### `getConfig`

获取完整配置。

```javascript
const result = plugin.execute({ action: 'getConfig' });
// 返回: { success: true, data: { counselors, backgrounds, transitions } }
```

#### `addCounselor`

添加咨询师。

```javascript
const result = plugin.execute({
  action: 'addCounselor',
  counselor: {
    id: 'c001',
    name: '张咨询师',
    avatar: 'data:image/...', // Base64 或 URL
    x: 100,
    y: 200,
    width: 300,
    height: 400
  }
});
```

#### `updateCounselor`

更新咨询师信息。

```javascript
const result = plugin.execute({
  action: 'updateCounselor',
  id: 'c001',
  updates: { name: '新名字', x: 150 }
});
```

#### `removeCounselor`

删除咨询师。

```javascript
const result = plugin.execute({
  action: 'removeCounselor',
  id: 'c001'
});
```

#### `setDefaultCounselor`

设置默认咨询师。

```javascript
const result = plugin.execute({
  action: 'setDefaultCounselor',
  id: 'c001'
});
```

#### `addBackground`

添加背景。

```javascript
const result = plugin.execute({
  action: 'addBackground',
  background: {
    id: 'b001',
    name: '咨询室',
    url: 'data:image/...',
    thumbnail: 'data:image/...'
  }
});
```

#### `updateBackground`

更新背景信息。

```javascript
const result = plugin.execute({
  action: 'updateBackground',
  id: 'b001',
  updates: { name: '新名字' }
});
```

#### `removeBackground`

删除背景。

```javascript
const result = plugin.execute({
  action: 'removeBackground',
  id: 'b001'
});
```

#### `setDefaultBackground`

设置默认背景。

```javascript
const result = plugin.execute({
  action: 'setDefaultBackground',
  id: 'b001'
});
```

#### `addTransition`

添加过渡语。

```javascript
const result = plugin.execute({
  action: 'addTransition',
  text: '你好，我是你的咨询师'
});
```

#### `updateTransition`

更新过渡语。

```javascript
const result = plugin.execute({
  action: 'updateTransition',
  idx: 0,
  text: '新的过渡语'
});
```

#### `removeTransition`

删除过渡语。

```javascript
const result = plugin.execute({
  action: 'removeTransition',
  idx: 0
});
```

#### `reorderTransition`

调整过渡语顺序。

```javascript
const result = plugin.execute({
  action: 'reorderTransition',
  fromIndex: 0,
  toIndex: 2
});
```

#### `uploadImage`

上传图片（咨询师立绘或背景）。

```javascript
const result = plugin.execute({
  action: 'uploadImage',
  file: FileObject, // 从 <input type="file"> 获取
  type: 'counselor' // 'counselor' | 'background'
});
```

#### `compressImage`

压缩图片。

```javascript
const result = plugin.execute({
  action: 'compressImage',
  dataUrl: 'data:image/...',
  maxWidth: 800,
  quality: 0.8
});
// 返回: { success: true, data: 'data:image/jpeg;base64,...' }
```

#### `save`

保存 NPC 配置。

```javascript
const result = plugin.execute({ action: 'save' });
```

#### `exportConfig`

导出配置为 JSON 文件。

```javascript
const result = plugin.execute({ action: 'exportConfig' });
```

#### `importConfig`

从 JSON 文件导入配置。

```javascript
const result = plugin.execute({
  action: 'importConfig',
  file: FileObject
});
```

---

## 通用返回格式

所有 `execute()` 方法返回统一格式：

```javascript
{
  success: true,   // 是否成功
  data: {...}      // 返回数据（可选）
}
```

失败时：

```javascript
{
  success: false,
  error: '错误描述'
}
```

---

## 事件系统

插件通过 `EventHub` 触发事件（如果已加载 `event-hub.js`）。

### 支持的事件

| 事件名               | 说明           | 参数                                     |
| -------------------- | -------------- | ---------------------------------------- |
| `plugin:initialized` | 插件初始化完成 | `{ pluginName, pluginVersion }`          |
| `plugin:action`      | 执行了某个动作 | `{ pluginName, action, params, result }` |
| `plugin:error`       | 发生错误       | `{ pluginName, error }`                  |
| `plugin:destroyed`   | 插件被销毁     | `{ pluginName }`                         |

### 监听事件

```javascript
// 如果已加载 EventHub
EventHub.on('plugin:action', (data) => {
  console.log(`${data.pluginName} 执行了 ${data.action}`);
});
```

---

## 数据类型定义

### Scale（量表）

```typescript
interface Scale {
  id: string;
  name: string;
  questions: Question[];
  scoring: {
    dimensions: Dimension[];
    metrics: Metric[];
    interpretation: Interpretation[];
    screening: Screening | null;
  };
}
```

### Dimension（维度）

```typescript
interface Dimension {
  key: string; // 唯一标识
  label: string; // 显示名称
  formula: string; // 'SUM' | 'AVG' | 'MAX' | 'MIN' | 'CUSTOM'
  items: string; // 题目编号，逗号分隔，如 "1,4,12"
  customFormula?: string; // 自定义公式（当 formula='CUSTOM' 时）
}
```

### Metric（指标）

```typescript
interface Metric {
  key: string;
  label: string;
  formula: string;
}
```

### Interpretation（解释规则）

```typescript
interface Interpretation {
  min: number;
  max: number;
  label: string;
  suggestion: string;
}
```

### Screening（筛查规则）

```typescript
interface Screening {
  enabled: boolean;
  threshold: number;
  action: string; // 'warn' | 'block' | 'refer'
}
```

### Counselor（咨询师）

```typescript
interface Counselor {
  id: string;
  name: string;
  avatar: string; // Base64 或 URL
  x: number; // 位置 X
  y: number; // 位置 Y
  width: number;
  height: number;
}
```

### Background（背景）

```typescript
interface Background {
  id: string;
  name: string;
  url: string; // 原图 Base64 或 URL
  thumbnail: string; // 缩略图 Base64 或 URL
}
```

---

## 完整示例

### 场景1：加载量表，修改维度，保存

```javascript
const plugin = new ScoringPlugin();
await plugin.init();

// 1. 查看所有量表
const listResult = plugin.execute({ action: 'list' });
console.log('量表:', listResult.data);

// 2. 选择第一个量表
const scaleId = listResult.data[0].id;
plugin.execute({ action: 'view', id: scaleId });

// 3. 修改第一个维度的名称
plugin.execute({
  action: 'editDimension',
  idx: 0,
  field: 'label',
  value: '新的维度名称'
});

// 4. 保存
const saveResult = plugin.execute({ action: 'save' });
if (saveResult.success) {
  console.log('✅ 保存成功');
}
```

### 场景2：添加咨询师，设置默认

```javascript
const plugin = new NpcPlugin();
await plugin.init();

// 1. 添加咨询师
const addResult = await plugin.execute({
  action: 'addCounselor',
  counselor: {
    id: 'c_' + Date.now(),
    name: '新咨询师',
    avatar: 'data:image/...',
    x: 100,
    y: 200,
    width: 300,
    height: 400
  }
});
const newId = addResult.data.id;

// 2. 设置为默认
plugin.execute({
  action: 'setDefaultCounselor',
  id: newId
});

// 3. 保存
plugin.execute({ action: 'save' });
```

---

## 相关文档

- [快速入门指南](./quick-start.md)
- [用户使用手册](./user-manual.md)
- [开发者指南](./developer-guide.md)
- [常见问题解答](./faq.md)
