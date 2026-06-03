# Skill API 参考手册

**文档版本**: v1.0  
**创建日期**: 2026-06-03  
**目标读者**: 前端开发者、插件开发者、系统架构师

---

## 一、PluginBase 类参考

### 1.1 类定义

```javascript
class PluginBase {
  constructor(metadata = {})
}
```

### 1.2 构造函数参数

| 参数                   | 类型   | 必填 | 说明       |
| ---------------------- | ------ | ---- | ---------- |
| `metadata`             | Object | ✅   | 插件元数据 |
| `metadata.name`        | String | ✅   | 插件名称   |
| `metadata.version`     | String | ✅   | 插件版本   |
| `metadata.description` | String | ❌   | 插件描述   |

### 1.3 生命周期方法

#### `async onInit()`

**调用时机**: 插件初始化时  
**必须实现**: ✅ 是  
**典型操作**: 加载配置、注册事件、初始化UI

```javascript
async onInit() {
  console.log('🚀 [' + this.name + '] 开始初始化...');

  try {
    // 1. 加载配置
    this.config = this._loadConfig();

    // 2. 注册事件监听
    this._registerEvents();

    // 3. 初始化UI
    this._initUI();

    console.log('✅ [' + this.name + '] 初始化完成');
  } catch (error) {
    Adapter.logger.error('[' + this.name + '] 初始化失败:', error);
    throw error;
  }
}
```

#### `async onExecute(params = {})`

**调用时机**: 外部调用插件时  
**必须实现**: ✅ 是  
**参数**: `params` - 执行参数对象

```javascript
async onExecute(params = {}) {
  console.log('🎯 [' + this.name + '] 开始执行...', params);

  try {
    switch (params.action) {
      case 'load':
        return this._loadData();

      case 'save':
        if (!params.data) {
          throw new Error('缺少必要参数：data');
        }
        return this._saveData(params.data);

      default:
        throw new Error(`未知动作: ${params.action}`);
    }
  } catch (error) {
    Adapter.logger.error('[' + this.name + '] 执行失败:', error);
    return { success: false, error: error.message };
  }
}
```

#### `async onDestroy()`

**调用时机**: 插件销毁时  
**必须实现**: ❌ 否  
**典型操作**: 清理资源、移除事件监听

```javascript
async onDestroy() {
  console.log('🛑 [' + this.name + '] 开始销毁...');

  // 1. 移除事件监听
  this._unregisterEvents();

  // 2. 清理资源
  this.config = null;

  console.log('✅ [' + this.name + '] 销毁完成');
}
```

---

## 二、SkillRegistry 类参考

### 2.1 类定义

```javascript
class SkillRegistry {
  constructor()
}
```

### 2.2 静态方法

#### `SkillRegistry.discover()`

**功能**: 发现所有已注册的Skill  
**返回**: `Array<Object>` - Skill元数据列表

```javascript
const skills = SkillRegistry.discover();
console.log('发现', skills.length, '个Skill');
```

#### `SkillRegistry.get(skillId)`

**功能**: 获取指定Skill的详细信息  
**参数**: `skillId` - Skill ID  
**返回**: `Object|null` - Skill对象或null

```javascript
const skill = SkillRegistry.get('scale-plugin');
if (skill) {
  console.log('找到Skill:', skill.name);
}
```

#### `SkillRegistry.register(skillId, skillClass)`

**功能**: 注册Skill到注册表  
**参数**:

- `skillId` - Skill ID
- `skillClass` - Skill类（继承自PluginBase）

```javascript
SkillRegistry.register('my-plugin', MyPlugin);
```

#### `SkillRegistry.unregister(skillId)`

**功能**: 从注册表移除Skill  
**参数**: `skillId` - Skill ID

```javascript
SkillRegistry.unregister('my-plugin');
```

---

## 三、EventHub 类参考

### 3.1 类定义

```javascript
class EventHub {
  constructor()
}
```

### 3.2 实例方法

#### `EventHub.emit(eventName, data)`

**功能**: 发布事件  
**参数**:

- `eventName` - 事件名称
- `data` - 事件数据

```javascript
window.EventHub.emit('my-plugin-event', {
  data: 'some data',
  timestamp: Date.now()
});
```

#### `EventHub.on(eventName, callback)`

**功能**: 订阅事件（持续接收）  
**参数**:

- `eventName` - 事件名称
- `callback` - 回调函数

```javascript
window.EventHub.on('my-plugin-event', (data) => {
  console.log('收到事件:', data);
});
```

#### `EventHub.once(eventName, callback)`

**功能**: 订阅事件（仅接收一次）  
**参数**:

- `eventName` - 事件名称
- `callback` - 回调函数

```javascript
window.EventHub.once('my-plugin-event', (data) => {
  console.log('收到事件（仅一次）:', data);
});
```

#### `EventHub.off(eventName, callback)`

**功能**: 取消订阅事件  
**参数**:

- `eventName` - 事件名称
- `callback` - 回调函数（可选，不传则移除所有监听）

```javascript
const myHandler = (data) => {
  console.log('收到事件:', data);
};

// 订阅
window.EventHub.on('my-plugin-event', myHandler);

// 取消订阅
window.EventHub.off('my-plugin-event', myHandler);

// 移除所有监听
window.EventHub.off('my-plugin-event');
```

---

## 四、PluginLoader 类参考

### 4.1 类定义

```javascript
class PluginLoader {
  constructor()
}
```

### 4.2 静态方法

#### `PluginLoader.register(skillId, pluginClass)`

**功能**: 注册插件  
**参数**:

- `skillId` - 插件ID
- `pluginClass` - 插件类（继承自PluginBase）

```javascript
class MyPlugin extends PluginBase {
  // ...
}

PluginLoader.register('my-plugin', MyPlugin);
```

#### `PluginLoader.load(skillId, autoInit = true)`

**功能**: 加载插件  
**参数**:

- `skillId` - 插件ID
- `autoInit` - 是否自动初始化（默认true）

```javascript
await PluginLoader.load('my-plugin');
console.log('✅ 插件加载完成');
```

#### `PluginLoader.get(skillId)`

**功能**: 获取已加载的插件实例  
**参数**: `skillId` - 插件ID  
**返回**: `Object|null` - 插件实例或null

```javascript
const plugin = PluginLoader.get('my-plugin');
if (plugin) {
  await plugin.onExecute({ action: 'load' });
}
```

#### `PluginLoader.unload(skillId)`

**功能**: 卸载插件  
**参数**: `skillId` - 插件ID

```javascript
await PluginLoader.unload('my-plugin');
console.log('✅ 插件卸载完成');
```

#### `PluginLoader.list()`

**功能**: 列出所有已加载的插件  
**返回**: `Array<String>` - 插件ID列表

```javascript
const plugins = PluginLoader.list();
console.log('已加载的插件:', plugins);
```

---

## 五、Adapter 对象参考

### 5.1 对象定义

```javascript
const Adapter = {
  storage: { ... },
  ui: { ... },
  logger: { ... }
};
```

### 5.2 Adapter.storage 方法

#### `Adapter.storage.get(key)`

**功能**: 从存储中获取数据  
**参数**: `key` - 存储键名  
**返回**: `String|null` - 存储的数据或null

```javascript
const data = Adapter.storage.get('my_plugin_config');
if (data) {
  const config = JSON.parse(data);
}
```

#### `Adapter.storage.set(key, value)`

**功能**: 保存数据到存储  
**参数**:

- `key` - 存储键名
- `value` - 要保存的数据（字符串）

```javascript
const config = { name: 'test', version: '1.0' };
Adapter.storage.set('my_plugin_config', JSON.stringify(config));
```

#### `Adapter.storage.remove(key)`

**功能**: 从存储中删除数据  
**参数**: `key` - 存储键名

```javascript
Adapter.storage.remove('my_plugin_config');
```

### 5.3 Adapter.ui 方法

#### `Adapter.ui.toast(message, type = 'info')`

**功能**: 显示Toast提示  
**参数**:

- `message` - 提示消息
- `type` - 提示类型（'info', 'success', 'warning', 'error'）

```javascript
Adapter.ui.toast('保存成功', 'success');
Adapter.ui.toast('保存失败', 'error');
```

### 5.4 Adapter.logger 方法

#### `Adapter.logger.log(message)`

**功能**: 输出普通日志  
**参数**: `message` - 日志消息

```javascript
Adapter.logger.log('插件初始化完成');
```

#### `Adapter.logger.warn(message)`

**功能**: 输出警告日志  
**参数**: `message` - 警告消息

```javascript
Adapter.logger.warn('配置缺失，使用默认值');
```

#### `Adapter.logger.error(message)`

**功能**: 输出错误日志  
**参数**: `message` - 错误消息

```javascript
Adapter.logger.error('插件初始化失败:', error);
```

---

## 六、后端 API 参考

### 6.1 Skill API 端点

#### `GET /api/skills`

**功能**: 获取所有Skill元数据列表  
**返回格式**:

```json
{
  "code": 0,
  "data": [
    {
      "id": "scale-plugin",
      "name": "量表管理插件",
      "version": "1.0.0",
      "description": "负责量表的增删改查、导入导出等功能",
      "type": "plugin",
      "icon": "📋",
      "updatedAt": "2026-06-03T16:00:00.000Z"
    }
  ],
  "total": 1
}
```

#### `GET /api/skills/:id`

**功能**: 获取单个Skill完整内容  
**返回格式**:

```json
{
  "code": 0,
  "data": {
    "id": "scale-plugin",
    "name": "量表管理插件",
    "version": "1.0.0",
    "description": "负责量表的增删改查、导入导出等功能",
    "content": "class ScalePlugin extends PluginBase { ... }",
    "metadata": {
      "type": "plugin",
      "icon": "📋",
      "original_id": "scale"
    }
  }
}
```

#### `POST /api/skills`

**功能**: 同步Skill到后端  
**请求格式**:

```json
{
  "id": "my-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "description": "插件描述",
  "content": "class MyPlugin extends PluginBase { ... }",
  "metadata": {
    "type": "plugin",
    "icon": "🚀"
  }
}
```

**返回格式**:

```json
{
  "code": 0,
  "message": "Skill 同步成功",
  "data": {
    "id": "my-plugin",
    "version": "1.0.0"
  }
}
```

#### `PUT /api/skills/:id`

**功能**: 更新Skill内容  
**请求格式**: 同 `POST /api/skills`  
**返回格式**: 同 `POST /api/skills`

#### `DELETE /api/skills/:id`

**功能**: 删除Skill  
**返回格式**:

```json
{
  "code": 0,
  "message": "Skill 删除成功"
}
```

#### `POST /api/skills/:id/test`

**功能**: 测试Skill执行  
**请求格式**:

```json
{
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

**返回格式**:

```json
{
  "code": 0,
  "data": {
    "skillId": "scale-plugin",
    "skillName": "量表管理插件",
    "version": "1.0.0",
    "startTime": "2026-06-03T16:00:00.000Z",
    "endTime": "2026-06-03T16:00:01.000Z",
    "duration": 1000,
    "status": "success",
    "output": {
      "type": "plugin",
      "message": "插件执行成功（模拟）",
      "functions": ["loadScales", "saveScales", "renderScaleList"]
    },
    "errorMessage": null
  }
}
```

---

## 七、前端事件委托参考

### 7.1 通用事件 Action

| Action                         | 说明         | 使用示例                                                                                         |
| ------------------------------ | ------------ | ------------------------------------------------------------------------------------------------ |
| `data-action="switch-section"` | 切换页面区域 | `<button data-action="switch-section" data-section="dashboard">数据看板</button>`                |
| `data-action="toggle-class"`   | 切换CSS类    | `<button data-action="toggle-class" data-class="active" data-target="#my-element">切换</button>` |
| `data-action="remove-parent"`  | 移除父元素   | `<button data-action="remove-parent">删除</button>`                                              |
| `data-action="save-edit"`      | 保存编辑     | `<button data-action="save-edit" data-edit-type="scale">保存</button>`                           |
| `data-action="test"`           | 测试功能     | `<button data-action="test" data-test-type="ai-connection">测试连接</button>`                    |

### 7.2 Skill 管理事件

| Action                       | 说明      | 使用示例                                                                  |
| ---------------------------- | --------- | ------------------------------------------------------------------------- |
| `data-action="skill-add"`    | 新增Skill | `<button data-action="skill-add">+ 新增 Skill</button>`                   |
| `data-action="skill-edit"`   | 编辑Skill | `<button data-action="skill-edit" data-id="scale-plugin">编辑</button>`   |
| `data-action="skill-view"`   | 查看Skill | `<button data-action="skill-view" data-id="scale-plugin">查看</button>`   |
| `data-action="skill-delete"` | 删除Skill | `<button data-action="skill-delete" data-id="scale-plugin">删除</button>` |
| `data-action="skill-test"`   | 测试Skill | `<button data-action="skill-test" data-id="scale-plugin">测试</button>`   |

### 7.3 量表管理事件

| Action                        | 说明     | 使用示例                                                            |
| ----------------------------- | -------- | ------------------------------------------------------------------- |
| `data-action="scale-create"`  | 新增量表 | `<button data-action="scale-create">+ 新增量表</button>`            |
| `data-action="scale-edit"`    | 编辑量表 | `<button data-action="scale-edit" data-id="1">编辑</button>`        |
| `data-action="scale-delete"`  | 删除量表 | `<button data-action="scale-delete" data-id="1">删除</button>`      |
| `data-action="scale-toggle"`  | 切换状态 | `<button data-action="scale-toggle" data-id="1">上架/下架</button>` |
| `data-action="export-scales"` | 导出量表 | `<button data-action="export-scales">导出</button>`                 |
| `data-action="import-scale"`  | 导入量表 | `<button data-action="import-scale">导入</button>`                  |

### 7.4 AI 配置事件

| Action                                  | 说明           | 使用示例                                                                        |
| --------------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `data-action="aic-select-provider"`     | 选择服务商     | `<div data-action="aic-select-provider" data-provider="dashscope">阿里云</div>` |
| `data-action="aic-toggle-visibility"`   | 切换密钥可见性 | `<button data-action="aic-toggle-visibility">👁️</button>`                       |
| `data-action="aic-load-server"`         | 从服务端加载   | `<button data-action="aic-load-server">加载</button>`                           |
| `data-action="aic-save-server"`         | 保存到服务端   | `<button data-action="aic-save-server">保存</button>`                           |
| `data-action="aic-check-server-status"` | 检查服务端状态 | `<button data-action="aic-check-server-status">检查</button>`                   |
| `data-action="aic-test-connection"`     | 测试连接       | `<button data-action="aic-test-connection">测试</button>`                       |

---

## 八、常见问题解答

### Q1: 如何获取插件实例？

```javascript
// 方式1: 通过 PluginLoader.get()
const plugin = PluginLoader.get('scale');
if (plugin) {
  await plugin.onExecute({ action: 'load' });
}

// 方式2: 通过 window 全局变量（向后兼容）
if (typeof window.ScalePlugin !== 'undefined') {
  window.ScalePlugin.onExecute({ action: 'load' });
}
```

### Q2: 如何调试插件？

```javascript
// 1. 查看所有已注册的插件
console.log(PluginLoader.list());

// 2. 查看插件实例
console.log(PluginLoader.get('scale'));

// 3. 手动调用插件方法
const plugin = PluginLoader.get('scale');
plugin.onExecute({ action: 'load' }).then((result) => {
  console.log('执行结果:', result);
});

// 4. 查看事件监听
console.log(window.EventHub._events);
```

### Q3: 插件间如何通信？

**推荐方式**: 使用 `EventHub` 进行事件通信

```javascript
// 插件A: 发布事件
window.EventHub.emit('plugin-a-event', {
  data: 'some data',
  timestamp: Date.now()
});

// 插件B: 订阅事件
window.EventHub.on('plugin-a-event', (data) => {
  console.log('插件B收到插件A的消息:', data);
});
```

---

## 九、总结

通过本参考手册，您可以：

- ✅ 查找 `PluginBase` 生命周期方法
- ✅ 使用 `SkillRegistry` 管理Skill
- ✅ 使用 `EventHub` 进行事件通信
- ✅ 使用 `PluginLoader` 加载/卸载插件
- ✅ 使用 `Adapter` 进行存储/UI/日志操作
- ✅ 调用后端 Skill API
- ✅ 使用前端事件委托

**下一步**: 阅读 `skill-testing-guide.md` 学习如何为Skill编写测试

---

**文档结束**

**后续更新计划**:

- 添加更多API示例
- 添加错误代码表
- 添加性能优化建议
