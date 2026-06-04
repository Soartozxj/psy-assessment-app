# admin-legacy.html 拆分方案设计

## 1. 现状分析

### 1.1 文件规模
- **总行数**: 25,801 行
- **文件大小**: ~1.2MB
- **功能模块**: 12 个 section
- **内联 onclick**: 91 处（已优化 206 处，原 297 处）

### 1.2 功能模块清单

| 序号 | Section ID | 行号 | 功能名称 | 依赖模块 | 优先级 |
|------|-----------|------|---------|---------|--------|
| 1 | `section-dashboard` | 4285 | 数据看板 | Chart.js, admin-chart.js | P0 |
| 2 | `section-scales` | 4348 | 量表管理 | scale 插件, admin-scale.js | P0 |
| 3 | `section-questions` | 5307 | 题库管理 | - | P2 |
| 4 | `section-users` | 5317 | 用户管理 | - | P2 |
| 5 | `section-records` | 5336 | 测评记录 | - | P2 |
| 6 | `section-npcScene` | 5360 | NPC场景配置 | npc 插件, admin-npc.js | P1 |
| 7 | `section-settings` | 5681 | 系统设置 | - | P2 |
| 8 | `section-aiConfig` | 5715 | AI配置 | AIConfig 模块 | P1 |
| 9 | `section-opsDashboard` | 5736 | 运维监控 | - | P3 |
| 10 | `section-scoring` | 5872 | 计分规则 | scoring 插件, admin-scoring.js | P1 |
| 11 | `section-sysPrompts` | 5985 | 系统提示词 | - | P2 |
| 12 | `section-feedback` | 6025 | 用户评价 | - | P2 |

### 1.3 依赖关系分析

```
dashboard (P0)
  ├── Chart.js (CDN)
  └── admin-chart.js

scales (P0)
  ├── scale 插件 (PluginLoader)
  ├── admin-scale.js
  └── AIConfig 模块 (部分功能)

npcScene (P1)
  ├── npc 插件 (PluginLoader)
  └── admin-npc.js

aiConfig (P1)
  └── AIConfig 模块

scoring (P1)
  ├── scoring 插件 (PluginLoader)
  └── admin-scoring.js

questions, users, records, settings, opsDashboard, sysPrompts, feedback (P2/P3)
  └── 无强依赖，可独立拆分
```

## 2. 拆分目标

### 2.1 性能目标
- **首屏加载时间**: 从 ~3.5s 降低到 < 1.5s
- **初始文件大小**: 从 ~1.2MB 减少到 ~200KB
- **Lighthouse 性能分**: 从 65 提升到 > 90
- **按需加载**: 仅加载当前激活的 section

### 2.2 代码质量目标
- **单文件行数**: 从 25,801 行减少到 < 500 行（主文件）
- **可维护性**: 每个 section 独立文件，便于维护
- **可测试性**: 每个 section 可独立测试

## 3. 拆分方案

### 3.1 目录结构

```
mini-app-h5/backend/
├── admin-legacy.html          # 主文件（仅保留骨架 + 仪表盘）
├── admin-sections/           # 拆分后的 section 文件
│   ├── dashboard.html        # 数据看板
│   ├── scales.html           # 量表管理
│   ├── questions.html        # 题库管理
│   ├── users.html            # 用户管理
│   ├── records.html          # 测评记录
│   ├── npc-scene.html       # NPC场景配置
│   ├── settings.html         # 系统设置
│   ├── ai-config.html       # AI配置
│   ├── ops-dashboard.html   # 运维监控
│   ├── scoring.html         # 计分规则
│   ├── sys-prompts.html     # 系统提示词
│   └── feedback.html        # 用户评价
├── admin-chart.js           # 图表模块（已独立）
├── admin-event-delegation.js # 事件委托（已独立）
├── admin-npc.js             # NPC模块（已独立）
├── admin-scale.js           # 量表模块（已独立）
├── admin-scoring.js         # 计分模块（已独立）
└── admin-ai-config.js      # AI配置模块（已独立）
```

### 3.2 主文件保留内容

`admin-legacy.html` 仅保留：
1. **HTML 骨架**: `<!DOCTYPE html>`, `<head>`, `<body>` 基本结构
2. **左侧菜单**: `.sidebar` 和 `.menu-item`
3. **顶部栏**: `.top-bar` 和 `.user-info`
4. **Dashboard section**: `section-dashboard`（首屏默认显示）
5. **核心脚本**: 插件系统、事件委托、Chart.js

**预估行数**: 从 25,801 行减少到 ~500 行

### 3.3 按需加载机制

#### 3.3.1 加载策略

```javascript
/**
 * 按需加载 section
 * @param {string} sectionName - section 名称 (e.g., 'scales', 'npcScene')
 */
async function loadSection(sectionName) {
  const sectionId = `section-${sectionName}`;
  const container = document.getElementById(sectionId);
  
  // 已加载
  if (container.getAttribute('data-loaded') === 'true') {
    return;
  }
  
  // 显示加载状态
  container.innerHTML = '<div class="loading-spinner">加载中...</div>';
  
  try {
    // 加载 HTML
    const htmlResponse = await fetch(`admin-sections/${sectionName}.html`);
    const html = await htmlResponse.text();
    
    // 插入 HTML
    container.innerHTML = html;
    container.setAttribute('data-loaded', 'true');
    
    // 加载依赖的 JS 模块
    await loadSectionScripts(sectionName);
    
    // 初始化 section
    initSection(sectionName);
    
  } catch (error) {
    console.error(`❌ 加载 section ${sectionName} 失败:`, error);
    container.innerHTML = '<div class="error">加载失败，请刷新重试</div>';
  }
}

/**
 * 加载 section 依赖的 JS 模块
 */
async function loadSectionScripts(sectionName) {
  const scriptMap = {
    'scales': ['scale'],
    'npcScene': ['npc'],
    'aiConfig': [],
    'scoring': ['scoring']
  };
  
  const plugins = scriptMap[sectionName] || [];
  for (const plugin of plugins) {
    await PluginLoader.load(plugin, false);
  }
}

/**
 * 初始化 section
 */
function initSection(sectionName) {
  switch (sectionName) {
    case 'scales':
      if (typeof renderScaleTypes === 'function') {
        renderScaleTypes();
      }
      break;
    case 'npcScene':
      if (typeof renderNpcConfig === 'function') {
        renderNpcConfig();
      }
      break;
    // ... 其他 section 初始化
  }
}
```

#### 3.3.2 切换逻辑修改

修改 `switchSection()` 函数：

```javascript
async function switchSection(name) {
  // 1. 隐藏所有 section
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  
  // 2. 显示目标 section
  const targetSection = document.getElementById('section-' + name);
  if (targetSection) {
    targetSection.classList.add('active');
  }
  
  // 3. 更新菜单激活状态
  // ... (保持不变)
  
  // 4. 按需加载 section
  await loadSection(name);
  
  // 5. 执行原有逻辑（插件加载、数据渲染等）
  // ... (保持不变)
}
```

### 3.4 Section 文件格式

每个 `admin-sections/*.html` 文件仅包含该 section 的内容，不包含 `<html>`, `<head>`, `<body>` 标签。

**示例**: `admin-sections/scales.html`

```html
<!-- 量表管理 section -->
<div class="section-header">
  <h2>量表管理</h2>
  <div class="section-actions">
    <button class="btn btn-primary" data-action="scale-create">新增量表</button>
    <button class="btn btn-default" data-action="import-scale">导入</button>
  </div>
</div>

<!-- 标签页切换 -->
<div class="tab-container">
  <button class="tab-btn active" data-action="switch-tab" data-tab="scale-list">量表列表</button>
  <button class="tab-btn" data-action="switch-tab" data-tab="scale-types">量表类型</button>
  <button class="tab-btn" data-action="switch-tab" data-tab="ai-diag">AI诊断</button>
</div>

<!-- 标签页内容 -->
<div class="tab-content-section" id="tab-scale-list">
  <!-- 量表列表内容 -->
</div>

<div class="tab-content-section" id="tab-scale-types" style="display: none;">
  <!-- 量表类型内容 -->
</div>

<div class="tab-content-section" id="tab-ai-diag" style="display: none;">
  <!-- AI诊断内容 -->
</div>

<!-- 内联脚本（仅该 section 需要的初始化逻辑） -->
<script>
  // 该 section 加载完成后执行
  if (typeof renderScaleTypes === 'function') {
    setTimeout(() => renderScaleTypes(), 100);
  }
</script>
```

## 4. 实施步骤

### 4.1 第一阶段：准备（1天）

1. **创建目录结构**
   ```bash
   mkdir -p mini-app-h5/backend/admin-sections
   ```

2. **修改 `switchSection()` 函数**
   - 添加 `loadSection()` 调用
   - 添加加载状态提示

3. **测试按需加载机制**
   - 创建测试 section 文件
   - 验证加载、渲染、交互正常

### 4.2 第二阶段：拆分 P0/P1 模块（2天）

按优先级拆分：
1. **Day 1**: 拆分 `scales` (P0) 和 `dashboard` (P0)
2. **Day 2**: 拆分 `npcScene` (P1), `aiConfig` (P1), `scoring` (P1)

### 4.3 第三阶段：拆分 P2/P3 模块（1天）

1. 拆分剩余的 P2/P3 模块
2. 每个 section 独立测试

### 4.4 第四阶段：优化与验证（1天）

1. **性能测试**
   - Lighthouse 跑分
   - 首屏加载时间对比

2. **功能验证**
   - 所有 section 切换正常
   - 所有功能交互正常
   - 无回归 bug

3. **代码清理**
   - 删除 `admin-legacy.html` 中的冗余代码
   - 更新文档

## 5. 风险评估

### 5.1 技术风险

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 按需加载失败 | 页面空白 | 添加错误处理 + 重试机制 |
| 插件加载顺序错误 | 功能异常 | 明确插件依赖关系，按序加载 |
| 事件委托失效 | 交互无响应 | 确保动态加载的 HTML 正确绑定事件委托 |
| 跨域问题（fetch）| 加载失败 | 使用相对路径，确保同源策略 |

### 5.2 进度风险

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 拆分工作量超预期 | 延期 1-2 天 | 优先拆分 P0/P1，P2/P3 可延后 |
| 兼容性问题 | 部分浏览器异常 | 使用现代浏览器 API，添加 polyfill |

## 6. 成功标准

### 6.1 性能指标

- ✅ 首屏加载时间 < 1.5s
- ✅ 初始文件大小 < 200KB
- ✅ Lighthouse 性能分 > 90
- ✅ 按需加载成功率 100%

### 6.2 代码质量指标

- ✅ 主文件行数 < 500 行
- ✅ 每个 section 独立文件
- ✅ 所有功能模块可独立测试

### 6.3 功能指标

- ✅ 所有 section 切换正常
- ✅ 所有功能交互正常
- ✅ 无回归 bug

## 7. 后续优化方向

1. **预加载**: 预测用户行为，提前加载相邻 section
2. **缓存策略**: 使用 localStorage 缓存已加载的 section
3. **代码分割**: 进一步拆分大型 JS 模块
4. **Service Worker**: 离线缓存支持

---

**文档版本**: v1.0  
**创建日期**: 2026-06-03  
**作者**: CodeBuddy AI  
**审核状态**: 待审核
