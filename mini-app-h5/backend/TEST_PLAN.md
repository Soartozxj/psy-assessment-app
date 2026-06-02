# Skills架构改造 - 测试计划

**版本**: 1.0.0  
**创建日期**: 2026-05-29  
**目标**: 确保插件架构改造后功能正常、无回归

---

## 1. 测试环境配置

### 1.1 浏览器测试环境

| 浏览器  | 最低版本 | 测试重点                             |
| ------- | -------- | ------------------------------------ |
| Chrome  | 60+      | 主测浏览器，EventHub、动态import支持 |
| Firefox | 55+      | 动态import、IndexedDB兼容性          |
| Safari  | 11+      | 动态import、localStorage行为         |

### 1.2 小程序测试环境

- **工具**: 微信开发者工具
- **版本**: 最新稳定版
- **测试账号**: 需配置测试用AppID

### 1.3 测试URL

```
本地开发: http://localhost:8080/mini-app-h5/backend/admin-legacy.html
```

---

## 2. 核心模块测试用例

### 2.1 PluginBase 测试用例

| 用例ID | 测试场景       | 预期结果                            |
| ------ | -------------- | ----------------------------------- |
| PB-001 | 创建插件实例   | 成功实例化，name/version正确        |
| PB-002 | 调用init()     | 打印初始化日志，状态变为initialized |
| PB-003 | 调用execute()  | 打印执行日志，状态变为running       |
| PB-004 | 调用destroy()  | 打印销毁日志，状态变为destroyed     |
| PB-005 | 添加事件监听器 | on() 正确注册回调                   |
| PB-006 | 触发事件       | emit() 正确触发回调                 |
| PB-007 | 移除事件监听器 | off() 正确移除回调                  |
| PB-008 | 获取配置       | getConfig() 返回合并后的配置        |

### 2.2 PluginLoader 测试用例

| 用例ID | 测试场景       | 预期结果                                        |
| ------ | -------------- | ----------------------------------------------- |
| PL-001 | 注册核心插件   | corePlugins 包含 auth/ai/scale/scoring/npc      |
| PL-002 | 注册可选插件   | optionalPlugins 包含 meditation/analytics/diary |
| PL-003 | 动态加载插件   | import() 成功加载JS文件                         |
| PL-004 | 双端路径适配   | H5用动态import，小程序用require                 |
| PL-005 | 插件初始化顺序 | 按依赖顺序初始化                                |

### 2.3 DualAdapter 测试用例

| 用例ID | 测试场景             | 预期结果                  |
| ------ | -------------------- | ------------------------- |
| DA-001 | 环境检测(H5)         | platform = 'h5'           |
| DA-002 | 环境检测(小程序)     | platform = 'miniprogram'  |
| DA-003 | storage.get (H5)     | 正确读取localStorage      |
| DA-004 | storage.set (H5)     | 正确写入localStorage      |
| DA-005 | storage.get (小程序) | 正确读取wx.getStorageSync |
| DA-006 | http.get (H5)        | 使用fetch API             |
| DA-007 | http.post (小程序)   | 使用wx.request            |
| DA-008 | ui.toast (H5)        | 调用showToast函数         |
| DA-009 | ui.confirm (小程序)  | 调用wx.showModal          |

### 2.4 EventHub 测试用例

| 用例ID | 测试场景   | 预期结果             |
| ------ | ---------- | -------------------- |
| EH-001 | 订阅事件   | on() 正确注册        |
| EH-002 | 发布事件   | emit() 触发所有回调  |
| EH-003 | 优先级排序 | 高优先级回调先执行   |
| EH-004 | 一次性监听 | once() 只触发一次    |
| EH-005 | 清除事件   | clear() 移除所有回调 |

---

## 3. 插件功能测试用例

### 3.1 Auth 插件 (待拆分)

| 用例ID   | 测试场景     | 预期结果                |
| -------- | ------------ | ----------------------- |
| AUTH-001 | 正确密码登录 | 跳转至主页面            |
| AUTH-002 | 错误密码登录 | 显示错误提示            |
| AUTH-003 | 暴力破解锁定 | 5次错误后锁定30分钟     |
| AUTH-004 | 退出登录     | 清除session，返回登录页 |

### 3.2 AI 插件 ✅ (已完成)

| 用例ID | 测试场景     | 预期结果                 |
| ------ | ------------ | ------------------------ |
| AI-001 | 切换Provider | UI正确更新               |
| AI-002 | 保存配置     | 写入localStorage和服务端 |
| AI-003 | 测试连接     | 返回连接成功/失败        |
| AI-004 | 一键导入     | 正确解析计分规则         |

### 3.3 Scale 插件 (待拆分)

| 用例ID    | 测试场景 | 预期结果             |
| --------- | -------- | -------------------- |
| SCALE-001 | 创建量表 | 保存到shared-data.js |
| SCALE-002 | 编辑量表 | 正确加载题目数据     |
| SCALE-003 | 删除量表 | 确认后删除           |
| SCALE-004 | 导入CSV  | 正确解析CSV数据      |

### 3.4 Scoring 插件 (待拆分)

| 用例ID | 测试场景     | 预期结果             |
| ------ | ------------ | -------------------- |
| SC-001 | 创建计分规则 | 保存到shared-data.js |
| SC-002 | 添加维度     | 维度配置正确         |
| SC-003 | 模拟测试     | 计分引擎正确计算     |
| SC-004 | 导出规则     | 生成正确JSON         |

---

## 4. 手动测试步骤

### 4.1 核心模块手动测试

```bash
# 1. 启动本地服务器
cd /Users/rich/WorkBuddy/20260407113106/mini-app-h5
python3 -m http.server 8080

# 2. 打开浏览器访问
open http://localhost:8080/backend/admin-legacy.html

# 3. 打开控制台，检查：
#    - PluginBase 是否已加载
#    - PluginLoader 是否已加载
#    - DualAdapter 是否已加载
#    - EventHub 是否已加载
```

### 4.2 控制台测试命令

```javascript
// 测试 PluginBase
console.log(typeof PluginBase); // 应该输出 "function"

// 测试 PluginLoader
console.log(typeof PluginLoader); // 应该输出 "function"
const loader = new PluginLoader();
console.log(loader.corePlugins); // 应该输出数组

// 测试 DualAdapter
console.log(typeof Adapter); // 应该输出 "object"
console.log(Adapter.platform); // 应该输出 "h5"

// 测试 EventHub
console.log(typeof EventHub); // 应该输出 "function"
const hub = new EventHub();
hub.on('test', () => console.log('test event'));
hub.emit('test'); // 应该输出 "test event"
```

---

## 5. 回退测试

### 5.1 单插件回退测试

| 测试场景      | 操作步骤                                  | 预期结果           |
| ------------- | ----------------------------------------- | ------------------ |
| 回退AI插件    | 注释掉 `export default AIPlugin`          | AI功能恢复为原实现 |
| 回退Scale插件 | 恢复 `<script src="admin-scale-list.js">` | 量表功能正常       |

### 5.2 全局回退测试

```bash
# 1. 恢复备份
cp -r backup/before-refactoring/* ./

# 2. 验证功能正常
open http://localhost:8080/backend/admin-legacy.html
```

---

## 6. 性能测试

| 指标         | 改造前 | 改造后 | 目标         |
| ------------ | ------ | ------ | ------------ |
| 页面加载时间 | -      | -      | < 3秒        |
| 首次交互时间 | -      | -      | < 5秒        |
| 内存占用     | -      | -      | < 100MB      |
| 插件加载时间 | -      | -      | < 500ms/插件 |

---

## 7. 测试检查清单

- [ ] PluginBase 单元测试通过
- [ ] PluginLoader 单元测试通过
- [ ] DualAdapter 单元测试通过
- [ ] EventHub 单元测试通过
- [ ] Auth 插件功能测试通过
- [ ] AI 插件功能测试通过
- [ ] Scale 插件功能测试通过
- [ ] Scoring 插件功能测试通过
- [ ] NPC 插件功能测试通过
- [ ] 回退方案验证通过
- [ ] 性能测试通过
