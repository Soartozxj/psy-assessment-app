# 云端数据打通落地计划

> 创建时间：2026-04-24
> 状态：代码改造完成，待真机测试

## 一、背景

当前 WebView 内 H5 的测评数据只存在 localStorage，用户换设备或清缓存后历史记录丢失。需要打通云端数据持久化，让测评历史在多端同步。

## 二、方案选型

**选定方案：HTTP 公网调用云托管**

经调研确认：
- 小程序 web-view 内 H5 **不支持** callContainer 内网调用
- 小程序 web-view 内 H5 **只能走公网 HTTP**
- 云托管自定义域名 1 域名绑定 1 服务，**不支持路径映射**

架构：
```
静态网站托管:    rich.soarto.com.cn    →  H5 页面（已部署）
云托管 API 服务:  identity.soarto.com.cn →  API 服务（已配置 ✅）
```

## 三、第一阶段：域名配置（已完成 ✅）

### DNS 解析 ✅
```
记录类型:  CNAME
主机记录:  identity
记录值:    identity.soarto.com.cn.tcbaccess.tencentcloudbase.com
TTL:       默认（600）
```

### SSL 证书 ✅
- 阿里云免费 DV 证书（DigiCert，90 天有效）
- 到期时间：2026-07-23
- 已上传到腾讯云 SSL 证书管理（备注名：星蓝心镜-identity）

### 腾讯云 CloudBase 绑定 ✅
- HTTP 访问服务 → 域名管理 → identity.soarto.com.cn
- 证书关联：identity.soarto.com.cn
- 路由：`/` → psy-service（云托管服务）

### 连通性验证 ✅
```bash
curl https://identity.soarto.com.cn/
# 返回: {"code":0,"message":"星蓝心镜 API","version":"1.0.0","env":"cloud1-d8ggx8sqde8afa6a4"}
```

---

## 四、第二阶段：代码改造（已完成 ✅）

### 4.1 cloud-api.js v2.0 ✅
- [x] 去掉 WebView 禁用逻辑
- [x] `API_BASE` 改为 `https://identity.soarto.com.cn`
- [x] 从 URL 参数自动解析 `openid`，附加到所有请求
- [x] GET 请求：openid 放 URL 参数
- [x] POST/DELETE 请求：openid 放 body 的 `_openid` 字段
- [x] 修正 API 路径前缀：`/api/submit`, `/api/history` 等

### 4.2 cloud-data.js v8.0 ✅
- [x] `saveHistory`：双写（云端由 submitAnswers 处理，本地 localStorage 也存一份）
- [x] `getHistory`：优先 `CloudAPI.fetchHistory`，失败降级 localStorage
- [x] `deleteHistory`：双删（`CloudAPI.deleteRecord` + localStorage）
- [x] 无 openid 时仅操作本地（降级模式）

### 4.3 webview.js v8.0 ✅
- [x] 从 `app.globalData.userInfo._openid` 获取 openid
- [x] URL 加上 `openid=xxx` 参数
- [x] 版本号升级到 v=22

### 4.4 cloudbase-run/index.js ✅
- [x] `/api/submit` 从请求 body 读取 `_openid`，写入历史记录的 `_openid` 字段
- [x] 按 openid 筛选历史记录

### 4.5 index.html 前端改造 ✅
- [x] `npcSubmitAssessment`：WebView 模式也走 `CloudAPI.submitAnswers`
- [x] `renderHistory`：WebView + 有 openid 时优先从 `CloudData.getHistory` 异步加载
- [x] `confirmDelete`：WebView + 有 openid 时走 `CloudData.deleteHistory` 云端删除
- [x] WebView 保存历史后同步更新 `historyRecords` 数组

---

## 五、第三阶段：测试验证（待执行 ⏳）

### 真机测试清单
- [ ] WebView 内 H5 能正常 fetch `https://identity.soarto.com.cn/`（不触发安全中间页）
- [ ] 提交测评后，历史记录写入云端数据库
- [ ] 刷新页面后历史记录从云端加载
- [ ] 网络断开时降级到 localStorage，不影响使用
- [ ] 删除历史记录同步云端删除
- [ ] AI 诊断走云端代理（API Key 安全）

### 回滚方案

如果 WebView 内跨域 fetch 被微信拦截（触发安全中间页）：
1. cloud-api.js 恢复 WebView 禁用逻辑
2. 改用 postMessage + evaluateJavascript 方案（备选）
