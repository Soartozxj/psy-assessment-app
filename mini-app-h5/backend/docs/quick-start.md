# 快速入门指南

> 5分钟上手插件系统，从零到运行第一个插件。

---

## 前置条件

- 一个现代化的浏览器（Chrome/Edge/Firefox/Safari）
- 基础的 JavaScript 知识
- 一个简单的 HTTP 静态服务器（推荐 `live-server` 或 VS Code Live Server 插件）

---

## 第一步：引入插件系统

在 HTML 页面中引入插件基类和你需要的插件：

```html
<!-- 插件基类（必须第一个引入） -->
<script src="./plugins/core/plugin-base.js"></script>

<!-- 计分规则插件 -->
<script src="./plugins/core/scoring-plugin.js"></script>

<!-- NPC 配置插件 -->
<script src="./plugins/core/npc-plugin.js"></script>
```

> **⚠️ 注意引入顺序**：`plugin-base.js` 必须第一个引入，其他插件依赖于它。

---

## 第二步：初始化插件

```html
<script>
  // 等待页面加载完成
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // 1. 创建插件实例
      const scoringPlugin = new ScoringPlugin();
      const npcPlugin = new NpcPlugin();

      // 2. 初始化插件（加载数据、绑定事件）
      await scoringPlugin.init();
      await npcPlugin.init();

      console.log('✅ 插件系统初始化完成');

      // 3. 现在可以使用插件了
      // 列出所有量表
      const scales = scoringPlugin.execute({ action: 'list' });
      console.log('量表列表:', scales);
    } catch (error) {
      console.error('❌ 初始化失败:', error);
    }
  });
</script>
```

---

## 第三步：使用插件功能

### 示例1：列出所有量表

```javascript
// 执行插件的 list 动作
const result = scoringPlugin.execute({ action: 'list' });

if (result.success) {
  console.log('量表列表:', result.data);
} else {
  console.error('执行失败:', result.error);
}
```

### 示例2：查看量表详情

```javascript
const result = scoringPlugin.execute({
  action: 'view',
  id: 'SCL90' // 量表ID
});

if (result.success) {
  console.log('量表详情:', result.data);
}
```

### 示例3：编辑维度配置

```javascript
const result = scoringPlugin.execute({
  action: 'editDimension',
  idx: 0, // 维度索引
  field: 'label', // 要修改的字段
  value: '新的维度名称' // 新值
});

if (result.success) {
  console.log('✅ 修改成功');
}
```

---

## 第四步：在 HTML 页面中渲染 UI

插件本身不负责渲染 HTML，但提供了数据和方法。你需要自己编写渲染逻辑：

```javascript
// 1. 获取数据
const scales = scoringPlugin.execute({ action: 'list' }).data;

// 2. 渲染到页面
const container = document.getElementById('scale-list');
container.innerHTML = scales
  .map(
    (scale) => `
  <div class="scale-card">
    <h3>${scale.name}</h3>
    <p>题目数量: ${scale.questionCount}</p>
    <button onclick="viewScale('${scale.id}')">查看详情</button>
  </div>
`
  )
  .join('');
```

---

## 常见问题速查

| 问题                           | 解决方案                                  |
| ------------------------------ | ----------------------------------------- |
| `PluginBase is not defined`    | 确保 `plugin-base.js` 第一个引入          |
| `ScoringPlugin is not defined` | 确保 `scoring-plugin.js` 已引入           |
| `plugin.init() throws error`   | 检查浏览器控制台，查看具体错误            |
| 数据不显示                     | 确保调用了 `await plugin.init()` 后再使用 |

---

## 下一步

- 📖 阅读[用户使用手册](./user-manual.md)了解所有功能
- 💻 阅读[开发者指南](./developer-guide.md)学习如何扩展插件
- ⚡ 阅读[性能优化指南](./performance-optimization.md)优化你的应用
- ❓ 查看[常见问题解答](./faq.md)解决更多问题

---

## 完整示例

这里有一个最小可运行示例：

```html
<!DOCTYPE html>
<html>
  <head>
    <title>插件系统快速入门</title>
  </head>
  <body>
    <h1>量表列表</h1>
    <div id="scale-list">加载中...</div>

    <!-- 引入插件 -->
    <script src="./plugins/core/plugin-base.js"></script>
    <script src="./plugins/core/scoring-plugin.js"></script>

    <script>
      document.addEventListener('DOMContentLoaded', async () => {
        // 初始化插件
        const plugin = new ScoringPlugin();
        await plugin.init();

        // 获取数据
        const result = plugin.execute({ action: 'list' });

        // 渲染
        const container = document.getElementById('scale-list');
        if (result.success && result.data.length > 0) {
          container.innerHTML = result.data.map((s) => `<div>${s.name} (${s.questionCount}题)</div>`).join('');
        } else {
          container.innerHTML = '暂无数据';
        }
      });
    </script>
  </body>
</html>
```

打开这个 HTML 文件，你就能看到效果了！
