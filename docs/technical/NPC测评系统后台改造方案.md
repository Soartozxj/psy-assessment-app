# NPC测评系统后台改造方案 v2.0

> **文档版本**：v2.0（整合用户反馈，确认版）  
> **创建日期**：2026年4月16日  
> **基于版本**：v9.0（NPC对话风格测评页）  
> **模拟页面**：`mini-app-h5/backend/scale-edit-npc-mockup.html`

---

## 📋 改造目标

将当前硬编码的NPC测评体验升级为**后台可配置化**，实现：

1. **过渡语可管理** — 题目级过渡语控制 + 全局过渡语池管理
2. **立绘/背景可定制** — 素材库统一管理，量表级独立选择
3. **导入更安全** — 导入的量表默认为"待上架"状态

---

## 🏗️ 现状分析

### 当前硬编码的部分

| 硬编码项    | 位置                                  | 内容                            |
| ----------- | ------------------------------------- | ------------------------------- |
| 过渡语池    | `index.html` JS变量 `NPC_TRANSITIONS` | 12句固定文案                    |
| 咨询师立绘  | `index.html` CSS/HTML                 | 固定使用 `assets/counselor.png` |
| 场景背景    | `index.html` CSS                      | 固定渐变色 + CSS装饰            |
| 欢迎语文案  | `npcShowWelcome()` 函数               | 硬编码拼接                      |
| 量表NPC配置 | 不存在                                | 无量表级别NPC配置               |

### 当前数据流

```
前端 index.html
  └─ NPC_TRANSITIONS (硬编码12句)
  └─ assets/counselor.png (固定立绘)
  └─ CSS渐变背景 (固定背景)
  └─ npcShowWelcome() (硬编码欢迎语)
       ↓
  用户答题 → 无差异化体验
```

---

## 🎯 改造后数据流

```
后台 admin-legacy.html
  ┌─────────────────────────────────┐
  │ 🎭 NPC场景配置（全局）           │
  │  ├─ 立绘素材库 (上传/管理)       │
  │  ├─ 背景素材库 (上传/管理)       │
  │  └─ 过渡语池 (增/删/编辑)       │
  └─────────────────────────────────┘
  ┌─────────────────────────────────┐
  │ 📝 量表编辑弹窗                  │
  │  ├─ 基本信息                    │
  │  │   ├─ 🖼️ 咨询师立绘 → 从素材库选择│
  │  │   ├─ 🏠 场景背景 → 从素材库选择  │
  │  │   └─ 状态 → 已上架/待上架/草稿  │
  │  └─ 题目编辑                    │
  │      └─ 每题: 过渡语 → 随机/无/自定义│
  └─────────────────────────────────┘
       ↓ localStorage 同步
前端 index.html
  ├─ 读取量表 npcConfig (优先)
  ├─ 降级读取全局 NPC_CONFIG
  ├─ 最终降级使用内置默认值
       ↓
  用户答题 → 量表差异化体验
```

---

## 📊 数据结构变更

### 1. 全局NPC配置（新增 localStorage 键：`psy_npc_config`）

```json
{
  "defaultCounselorId": "counselor_001",
  "defaultBackgroundId": "bg_001",
  "transitions": [
    "接下来请你对下一项内容作答。",
    "我们按顺序进入下一个条目。",
    "下面继续完成下一项评估。",
    "请根据你的真实情况，看下一个问题。",
    "不着急，我们慢慢往下走。",
    "我们快完成啦，继续下一个。",
    "已经进行一部分了，我们接着往下。",
    "再坚持一下，我们看下一项。",
    "轻松一点，我们继续完成下一项。",
    "嗯，我了解了。",
    "好的，谢谢你的回答。",
    "明白了，请继续。"
  ],
  "counselors": [
    {
      "id": "counselor_001",
      "name": "温馨咨询师",
      "image": "assets/counselor.png",
      "uploadTime": "2026-04-16T00:00:00Z"
    }
  ],
  "backgrounds": [
    {
      "id": "bg_001",
      "name": "温馨咨询室（默认）",
      "type": "css",
      "value": "linear-gradient(180deg, #FFF8E1 0%, #FFECB3 40%, #FFE0B2 100%)",
      "uploadTime": "2026-04-16T00:00:00Z"
    }
  ]
}
```

**存储方式**：`localStorage.setItem('psy_npc_config', JSON.stringify(config))`

**读取函数**（新增）：

```javascript
function loadNpcConfig() {
  try {
    const data = localStorage.getItem('psy_npc_config');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('加载NPC配置失败:', e);
    return null;
  }
}

function saveNpcConfig(config) {
  localStorage.setItem('psy_npc_config', JSON.stringify(config));
}
```

### 2. 量表数据结构新增字段

在现有量表对象中新增 `npcConfig` 字段：

```json
{
  "id": 1,
  "name": "SCL-90 症状自评量表",
  "status": 1,
  "npcConfig": {
    "counselorId": "",
    "backgroundId": "",
    "welcomeText": ""
  },
  "questions": [
    {
      "id": 1,
      "content": "题目内容",
      "options": [...],
      "transition": "random"
    },
    {
      "id": 2,
      "content": "题目内容2",
      "options": [...],
      "transition": "none"
    },
    {
      "id": 3,
      "content": "题目内容3",
      "options": [...],
      "transition": "这道题比较重要，请认真思考哦"
    }
  ]
}
```

**字段说明**：

| 字段                     | 类型   | 默认值     | 说明                                |
| ------------------------ | ------ | ---------- | ----------------------------------- |
| `npcConfig.counselorId`  | string | `""`       | 量表专属立绘ID，空=使用全局默认     |
| `npcConfig.backgroundId` | string | `""`       | 量表专属背景ID，空=使用全局默认     |
| `npcConfig.welcomeText`  | string | `""`       | 量表专属欢迎语，空=使用默认拼接逻辑 |
| `questions[].transition` | string | `"random"` | 过渡语模式，见下表                  |

**`transition` 字段取值**：

| 值         | 效果                                 |
| ---------- | ------------------------------------ |
| `"random"` | 从全局过渡语池中随机抽取一句（默认） |
| `"none"`   | 不显示过渡语，直接进入下一题         |
| 其他字符串 | 使用该字符串作为过渡语（自定义）     |

### 3. 量表状态扩展

| 状态值 | 含义           | 前端可见 | 变更     |
| ------ | -------------- | -------- | -------- |
| `0`    | 已下架         | ❌       | 不变     |
| `1`    | 已上架         | ✅       | 不变     |
| `2`    | 待上架（草稿） | ❌       | **新增** |

---

## 🔧 配置优先级

```
量表级配置 > 全局NPC配置 > 系统内置默认值
```

具体解析逻辑（前端）：

```javascript
function resolveNpcSetting(scale) {
  var globalConfig = loadNpcConfig() || {};

  // 立绘：量表级 → 全局默认 → 内置默认
  var counselorId = scale.npcConfig?.counselorId || globalConfig.defaultCounselorId || '';
  var counselorImage = '';
  if (counselorId && globalConfig.counselors) {
    var c = globalConfig.counselors.find((x) => x.id === counselorId);
    if (c) counselorImage = c.image;
  }
  if (!counselorImage) counselorImage = 'assets/counselor.png'; // 内置默认

  // 背景：量表级 → 全局默认 → 内置CSS渐变
  var bgId = scale.npcConfig?.backgroundId || globalConfig.defaultBackgroundId || '';
  var bgStyle = '';
  if (bgId && globalConfig.backgrounds) {
    var b = globalConfig.backgrounds.find((x) => x.id === bgId);
    if (b) bgStyle = b.type === 'css' ? b.value : 'url(' + b.value + ')';
  }

  // 过渡语池：始终使用全局配置
  var transitions = globalConfig.transitions || NPC_TRANSITIONS; // 降级到硬编码

  // 欢迎语：量表级 → 默认拼接
  var welcomeText =
    scale.npcConfig?.welcomeText ||
    '你好，我是你的咨询师。接下来我会问你一些关于' + scale.name + '的问题，请根据真实感受来回答，没有对错之分。';

  return { counselorImage, bgStyle, transitions, welcomeText };
}
```

---

## 📝 后台改动清单

### 文件：`mini-app-h5/backend/admin-legacy.html`

#### 改动1：新增全局NPC配置管理区域

在后台页面新增一个独立的管理板块（可放在系统设置/数据管理区域）：

| 组件            | 功能                                        |
| --------------- | ------------------------------------------- |
| 📋 过渡语池管理 | 查看/添加/删除/编辑过渡语条目（文本列表）   |
| 🖼️ 立绘素材库   | 上传/预览/删除咨询师立绘图片，设置默认立绘  |
| 🏠 背景素材库   | 上传/预览/删除背景图片，设置默认背景        |
| 💾 保存配置     | 将配置写入 `localStorage('psy_npc_config')` |

**素材存储方式**：Base64 编码存入 localStorage（适合小型素材），或存为独立文件引用相对路径。

#### 改动2：量表编辑弹窗 — 基本信息

在现有基本信息表单（名称、编码、分类等）之后，新增"NPC测评场景配置"区块：

```
┌──────────────────────────────────────────┐
│ 🎭 NPC测评场景配置                        │
│ （可选，从素材库选择，留空则使用全局默认）    │
│                                          │
│ 🖼️ 咨询师立绘                             │
│ ┌──────┐  📂 从素材库选择                  │
│ │ 预览  │  ↩️ 使用默认                     │
│ │ 图框  │  已选：温馨咨询师                  │
│ └──────┘                                  │
│                                          │
│ 🏠 场景背景                               │
│ ┌──────────────┐  📂 从素材库选择          │
│ │  预览图框     │  ↩️ 使用默认              │
│ └──────────────┘  当前使用全局默认背景      │
└──────────────────────────────────────────┘
```

**关键交互**：

- 点击"📂 从素材库选择" → 弹出素材选择弹窗（展示素材库中的所有立绘/背景缩略图）
- 点击缩略图选中 → 高亮显示 → 点击"确认选择" → 回填到量表编辑表单
- 点击"↩️ 使用默认" → 清空量表级配置，降级使用全局默认

#### 改动3：量表编辑弹窗 — 题目编辑

每道题的标题行右侧新增「过渡语」下拉选择器：

```
┌──────────────────────────────────────────┐
│ 第1题                     过渡语: [🎲随机▼] │
│ ┌──────────────────────────────────┐      │
│ │ 题目内容...                      │      │
│ └──────────────────────────────────┘      │
│ 选项A: ...  分值: 1                       │
│ 选项B: ...  分值: 2                       │
├──────────────────────────────────────────┤
│ 第2题                     过渡语: [🔇无▼]  │
│ ...                                      │
├──────────────────────────────────────────┤
│ 第3题                     过渡语: [✏️自定义▼]│
│ ┌──────────────────────────────────┐      │
│ │ 题目内容...                      │      │
│ └──────────────────────────────────┘      │
│ 💬 自定义过渡语: [请认真思考下一题_______]  │ ← 选择"自定义"时展开
│ 选项A: ...  分值: 1                       │
└──────────────────────────────────────────┘
```

#### 改动4：保存量表 `saveScale()`

在 `scaleData` 构建中新增：

```javascript
const scaleData = {
  // ...现有字段保持不变...

  // 🆕 NPC配置
  npcConfig: {
    counselorId: document.getElementById('f-npc-counselor').value || '',
    backgroundId: document.getElementById('f-npc-bg').value || '',
    welcomeText: document.getElementById('f-npc-welcome').value || ''
  },

  // 🆕 题目过渡语
  questions: currentQuestions.map((q, i) => ({
    ...q,
    id: i + 1,
    transition: q.transition || 'random' // 新增字段，默认随机
  }))
};
```

#### 改动5：编辑回填 `openEditModal()`

在回填量表数据时，增加NPC配置的回填：

```javascript
// 回填NPC配置
if (scale.npcConfig) {
  document.getElementById('f-npc-counselor').value = scale.npcConfig.counselorId || '';
  document.getElementById('f-npc-bg').value = scale.npcConfig.backgroundId || '';
  document.getElementById('f-npc-welcome').value = scale.npcConfig.welcomeText || '';
  updateNpcPreview('counselor'); // 更新立绘预览
  updateNpcPreview('background'); // 更新背景预览
}

// 回填题目过渡语
currentQuestions = scale.questions.map((q) => ({
  ...q,
  transition: q.transition || 'random'
}));
```

#### 改动6：导入验证 `confirmImport()`

在导入逻辑中，将导入的量表状态强制设为 `2`（待上架）：

```javascript
// 现有代码
scale.status = parseInt(scale.status) || 1; // ← 改为 2

// 改为
scale.status = 2; // 导入的量表默认为"待上架"
scale.npcConfig = scale.npcConfig || {}; // 确保npcConfig存在
```

#### 改动7：`normalizeScaleBeforeSave()` 扩展

```javascript
function normalizeScaleBeforeSave(scale) {
  const normalized = { ...scale };
  // ...现有规范化逻辑保持不变...

  // 🆕 NPC配置规范化
  if (!normalized.npcConfig) {
    normalized.npcConfig = { counselorId: '', backgroundId: '', welcomeText: '' };
  }

  // 🆕 题目过渡语规范化
  if (normalized.questions && Array.isArray(normalized.questions)) {
    normalized.questions = normalized.questions.map((q) => ({
      ...q,
      transition: q.transition || 'random'
    }));
  }

  return normalized;
}
```

#### 改动8：状态筛选扩展

量表列表的筛选/标签增加"待上架"选项：

```javascript
// 状态映射
const STATUS_MAP = {
  0: { label: '已下架', color: '#999', badge: '⏸️' },
  1: { label: '已上架', color: '#4CAF50', badge: '✅' },
  2: { label: '待上架', color: '#FF9800', badge: '⏳' } // 新增
};
```

#### 改动9：新建量表默认状态

新建量表时，状态默认值改为 `2`（待上架）：

```javascript
// 现有：编辑模态框中状态默认 1
// 改为：新建时默认 2，编辑时保持原状态
if (!editingId) {
  document.getElementById('f-status').value = '2'; // 新建默认待上架
}
```

---

## 📱 前端改动清单

### 文件：`mini-app-h5/frontend/index.html`

#### 改动1：启动测评时加载量表NPC配置

修改 `startAssessment()` 函数：

```javascript
function startAssessment() {
  const s = SCALES.find((s) => s.id === currentDetailId);
  if (!s) return;
  currentAssessScale = s;
  currentQuestionIndex = 0;
  answers = {};

  // 🆕 解析当前量表的NPC配置
  currentNpcSettings = resolveNpcSetting(s);

  prevPageStack.push(currentPage);
  showPage('assessment', false);

  // 隐藏底部TabBar
  var tabBar = document.getElementById('fixed-tab-bar');
  if (tabBar) tabBar.style.display = 'none';

  // 🆕 应用场景配置
  applyNpcScene(currentNpcSettings);

  updateNpcProgress();
  npcShowWelcome(s);
}
```

#### 改动2：应用NPC场景配置

新增函数，动态设置立绘和背景：

```javascript
function applyNpcScene(settings) {
  // 更新咨询师立绘
  var charImg = document.querySelector('.npc-character-area img');
  if (charImg && settings.counselorImage) {
    charImg.src = settings.counselorImage;
  }

  // 更新场景背景
  var scene = document.querySelector('.npc-scene');
  if (scene && settings.bgStyle) {
    if (settings.bgStyle.startsWith('url(')) {
      scene.style.backgroundImage = settings.bgStyle;
      scene.style.backgroundSize = 'cover';
    } else {
      scene.style.background = settings.bgStyle;
    }
  }
}
```

#### 改动3：过渡语根据题目配置决定

修改 `npcPickOption()` 函数中的过渡语逻辑：

```javascript
function npcPickOption(q, opt, area, btn) {
  answers[q.id] = opt.id;
  // 禁用其他选项
  var all = area.querySelectorAll('.npc-option-btn');
  for (var i = 0; i < all.length; i++) {
    all[i].style.pointerEvents = 'none';
    all[i].style.opacity = '0.5';
  }
  btn.classList.add('selected');
  btn.style.opacity = '1';

  setTimeout(function () {
    area.classList.remove('active');
    var dt = document.getElementById('npc-dialog-text');

    // 🆕 根据题目配置决定过渡语行为
    var transitionMode = q.transition || 'random';
    var trans = currentNpcSettings.transitions || NPC_TRANSITIONS;

    if (transitionMode === 'none') {
      // 无过渡语：直接进入下一题
      currentQuestionIndex++;
      updateNpcProgress();
      npcShowQuestion(currentQuestionIndex);
      return;
    }

    var reply;
    if (transitionMode === 'random') {
      reply = trans[Math.floor(Math.random() * trans.length)];
    } else {
      reply = transitionMode; // 自定义文本
    }

    dt.innerHTML =
      '<span style="color:#5b8fb9;font-size:12px;">正在输入</span><span class="npc-typing-dot"><span></span><span></span><span></span></span>';
    setTimeout(function () {
      npcTypeText(reply, function () {
        setTimeout(function () {
          currentQuestionIndex++;
          updateNpcProgress();
          npcShowQuestion(currentQuestionIndex);
        }, 500);
      });
    }, 400);
  }, 400);
}
```

#### 改动4：欢迎语支持自定义

修改 `npcShowWelcome()` 函数：

```javascript
function npcShowWelcome(scale) {
  // 🆕 优先使用量表自定义欢迎语
  var welcomeText =
    currentNpcSettings.welcomeText ||
    '你好，我是你的咨询师。接下来我会问你一些关于' + scale.name + '的问题，请根据真实感受来回答，没有对错之分。';

  npcTypeText(welcomeText, function () {
    setTimeout(function () {
      npcShowQuestion(0);
    }, 800);
  });
}
```

#### 改动5：加载全局NPC配置

在页面初始化时加载全局NPC配置：

```javascript
// 在 DOMContentLoaded 或页面初始化代码中新增
function loadGlobalNpcConfig() {
  try {
    var data = localStorage.getItem('psy_npc_config');
    if (data) {
      var config = JSON.parse(data);
      // 用全局配置覆盖硬编码的过渡语池（如果有）
      if (config.transitions && config.transitions.length > 0) {
        NPC_TRANSITIONS = config.transitions;
      }
    }
  } catch (e) {
    console.warn('加载全局NPC配置失败，使用内置默认值:', e);
  }
}
```

---

## 🔄 素材管理机制

### 素材上传与存储

```
后台 NPC场景配置页面
  ├─ 上传立绘/背景图片
  │   ├─ 选择本地文件 (PNG/JPG)
  │   ├─ 前端压缩/缩放（可选，限制文件大小）
  │   ├─ FileReader 转 Base64
  │   └─ 存入 psy_npc_config.counselors/backgrounds 数组
  │
  ├─ 管理素材
  │   ├─ 重命名素材
  │   ├─ 设置为默认
  │   ├─ 删除素材（检查是否有量表引用）
  │   └─ 预览素材
  │
  └─ 管理过渡语
      ├─ 添加新过渡语
      ├─ 编辑现有过渡语
      ├─ 删除过渡语
      └─ 拖拽排序（可选）
```

### 存储容量考虑

| 存储方式     | 单张大小 | localStorage 限制 | 建议                  |
| ------------ | -------- | ----------------- | --------------------- |
| Base64 内嵌  | ~200KB   | ~5MB              | 立绘和背景压缩后存入  |
| 文件路径引用 | 0        | 无                | 存放到 `assets/` 目录 |

**建议方案**：图片存储为文件（`assets/npc-counselors/`、`assets/npc-backgrounds/`），配置中只存路径引用。

### 素材库选择弹窗

量表编辑页面中点击"从素材库选择"时弹出的选择器：

```
┌────────────────────────────────────────┐
│  🖼️ 选择咨询师立绘                  ✕  │
├────────────────────────────────────────┤
│  ┌────┐  ┌────┐  ┌────┐              │
│  │ 🧑 │  │ 👩 │  │ 🐻 │              │
│  │ ✓  │  │    │  │    │              │
│  └────┘  └────┘  └────┘              │
│  温馨咨询  专业咨询  卡通小熊           │
│                                        │
│  ┌────┐  ┌────┐                       │
│  │ 👴 │  │    │                       │
│  │    │  │ ＋ │  ← 新增素材            │
│  └────┘  └────┘                       │
│  年长专家  上传新素材                   │
├────────────────────────────────────────┤
│  已上传 4 个立绘 · 在NPC场景配置管理   │
│              [取消]  [✓ 确认选择]       │
└────────────────────────────────────────┘
```

---

## 📋 实施步骤

### Phase 1：后台 — 全局NPC配置管理

1. 新增 `psy_npc_config` 存储键和 CRUD 函数
2. 在后台页面新增"NPC场景配置"管理区域
3. 实现过渡语池的增/删/改功能
4. 实现立绘/背景素材库的上传/管理功能
5. 设置默认立绘和默认背景

### Phase 2：后台 — 量表编辑弹窗改造

1. 在基本信息区域新增NPC场景配置区块
2. 实现素材库选择弹窗
3. 在题目编辑区域新增过渡语下拉选择器
4. 修改 `saveScale()` 保存新字段
5. 修改 `openEditModal()` 回填新字段
6. 修改 `normalizeScaleBeforeSave()` 规范化新字段

### Phase 3：后台 — 导入与状态管理

1. 修改 `confirmImport()` 导入后默认 `status = 2`
2. 新建量表默认 `status = 2`
3. 状态筛选增加"待上架"选项
4. 状态标签增加"待上架"样式

### Phase 4：前端 — 配置化适配

1. 新增 `loadGlobalNpcConfig()` 加载全局配置
2. 新增 `resolveNpcSetting()` 配置优先级解析
3. 修改 `startAssessment()` 应用量表NPC配置
4. 修改 `npcPickOption()` 根据题目过渡语配置执行
5. 修改 `npcShowWelcome()` 支持自定义欢迎语
6. 新增 `applyNpcScene()` 动态应用立绘和背景

### Phase 5：测试与验证

1. 全局NPC配置管理功能测试
2. 量表编辑弹窗新字段保存/回填测试
3. 素材库选择弹窗交互测试
4. 前端配置化渲染测试（不同量表的差异化体验）
5. 导入量表默认状态测试
6. 降级测试（无NPC配置时使用默认值）

---

## 📁 涉及文件清单

| 文件                                             | 改动类型  | 说明                                 |
| ------------------------------------------------ | --------- | ------------------------------------ |
| `mini-app-h5/backend/admin-legacy.html`          | 🔧 大改   | 后台核心：NPC配置管理 + 量表编辑改造 |
| `mini-app-h5/frontend/index.html`                | 🔧 中改   | 前端适配：配置化NPC场景              |
| `mini-app-h5/shared-data.js`                     | 🔧 小改   | 数据同步：NPC配置存储键定义          |
| `mini-app-h5/backend/scale-edit-npc-mockup.html` | ✨ 已创建 | 模拟页面（设计确认用）               |

---

## ⚠️ 兼容性保障

1. **向后兼容**：现有量表无 `npcConfig` 和 `transition` 字段时，全部降级到内置默认值
2. **评分算法不变**：NPC配置只影响视觉呈现，不影响评分逻辑
3. **手机外壳布局不变**：NPC场景配置只改变内容，不改变布局结构
4. **硬编码降级**：即使 `psy_npc_config` 不存在，`NPC_TRANSITIONS` 硬编码仍可工作
5. **TabBar隐藏/恢复不变**：测评期间自动隐藏TabBar的逻辑不受影响

---

> 💡 **设计理念**：通过"全局配置 + 量表级覆盖"的两层架构，实现灵活的NPC测评体验管理，同时保持系统简洁和向后兼容。
