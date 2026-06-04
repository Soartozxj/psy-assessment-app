# 后台管理系统 — 微信扫码登录完整架构方案

> 创建时间：2026-04-25
> 状态：规划阶段（待备案通过后实施）

## 一、方案概述

利用**微信开放平台网站扫码登录**能力，替换现有的前端密码验证机制，实现管理员通过微信扫码即可安全登录后台。

### 核心优势

- ✅ 无需记忆密码，杜绝密码泄露风险
- ✅ 复用现有云托管后端（`identity.soarto.com.cn`），无需额外搭建服务器
- ✅ 微信生态统一身份，与小程序管理权限天然打通
- ✅ 通过 unionid 关联小程序和网站，权限控制更精准

---

## 二、前置条件（按优先级排序）

| 序号 | 前置条件                          | 当前状态        | 预计完成时间         |
| ---- | --------------------------------- | --------------- | -------------------- |
| 1    | ICP 接入备案通过                  | ⏳ 审核中       | 约 1-2 周            |
| 2    | 微信开放平台注册并认证            | ❓ 待确认       | 1-3 个工作日         |
| 3    | 微信开放平台创建网站应用          | ❌ 待备案后     | 1-5 个工作日（审核） |
| 4    | SSL 证书申请（www.soarto.com.cn） | ❌ 需备案后申请 | 1 天                 |

### 关键说明

**微信开放平台与小程序的关系**：

- 你已有小程序 AppID：`wxb811fa4c960b0e0b`（主体：湖北索拓星蓝科技有限公司）
- 微信开放平台（`open.weixin.qq.com`）需要**同一个企业主体**注册并完成微信认证
- 认证费用：**300 元/年**
- 在开放平台绑定小程序后，可获取 `unionid`，用于跨应用识别同一用户

**为什么需要开放平台**：

- 网站扫码登录的接口是**微信开放平台**提供的，不是小程序后台
- 扫码登录获取的是 `openid`（网站应用维度），与小程序的 `openid`（小程序维度）不同
- 通过 `unionid` 可以关联两个身份，判断扫码者是否为管理员

---

## 三、系统架构

### 3.1 整体流程

```
┌─────────────────────────────────────────────────────────┐
│                    登录流程                                │
│                                                         │
│  管理员电脑               微信开放平台          后端 API   │
│  (admin页面)             (微信服务器)         (云托管)    │
│                                                         │
│  1. 页面加载                                         │
│     │                                                  │
│     ▼                                                  │
│  2. 展示二维码 ────GET /api/auth/qrcode────────▶        │
│     │             ◀─── { scene, qrcode_url } ─────      │
│     │                                                  │
│  3. 展示二维码图片                                        │
│     │          4. 管理员手机扫码 → 微信确认授权           │
│     │                     │                            │
│     │                     ▼                            │
│     │              微信服务器回调 ───POST /api/auth/callback──▶│
│     │                                  │               │
│     │                                  ▼               │
│     │                            验证 + 生成 token     │
│     │                                  │               │
│  5. 轮询状态 ────GET /api/auth/check?scene=xxx──▶       │
│     │             ◀─── { status, token } ─────         │
│     │                                                  │
│     ▼                                                  │
│  6. 存储 token，进入后台                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 二维码方案选型

**推荐方案：内嵌式二维码（`https://open.weixin.qq.com/connect/qrconnect`）**

这是微信官方提供的标准网站扫码登录方案：

```
https://open.weixin.qq.com/connect/qrconnect?
  appid=WEBSITE_APPID&
  redirect_uri=REDIRECT_URI&
  response_type=code&
  scope=snsapi_login&
  state=STATE
```

**两种展示方式**：

| 方式                            | 优点               | 缺点                     | 推荐度     |
| ------------------------------- | ------------------ | ------------------------ | ---------- |
| **跳转式**（直接跳转微信页面）  | 实现最简单         | 用户体验差，离开后台页面 | ⭐⭐       |
| **内嵌式**（iframe 嵌入二维码） | 体验好，不离开页面 | 需要微信 JS SDK          | ⭐⭐⭐⭐⭐ |

**最终选择：内嵌式**

前端通过微信 JS SDK `WxLogin` 对象直接在页面内生成二维码，用户扫码后微信回调到后端，后端交换 token 后通知前端。

---

## 四、技术实现细节

### 4.1 新增后端 API 端点

在现有 `cloudbase-run/index.js` 中新增 3 个路由：

#### 4.1.1 `GET /api/auth/qrcode` — 生成登录二维码参数

```javascript
// 返回前端需要的二维码参数
app.get('/api/auth/qrcode', (req, res) => {
  const scene = 'login_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  // 存储到内存 Map，有效期 5 分钟
  pendingLogins.set(scene, { status: 'waiting', createdAt: Date.now() });
  // 5 分钟后自动清除
  setTimeout(() => pendingLogins.delete(scene), 5 * 60 * 1000);

  res.json({
    code: 0,
    data: {
      scene: scene,
      // 前端用这些参数调用微信 WxLogin
      appid: process.env.WECHAT_WEB_APPID,
      redirect_uri: encodeURIComponent(process.env.WECHAT_WEB_REDIRECT_URI)
    }
  });
});
```

#### 4.1.2 `GET /api/auth/callback` — 微信回调端点

微信扫码确认后，会重定向到这个地址，带 `code` 和 `state` 参数：

```javascript
app.get('/api/auth/callback', async (req, res) => {
  const { code, state: scene } = req.query;

  // 1. 用 code 换取 access_token + openid + unionid
  const tokenRes = await fetch(
    'https://api.weixin.qq.com/sns/oauth2/access_token?' +
      'appid=' +
      process.env.WECHAT_WEB_APPID +
      '&secret=' +
      process.env.WECHAT_WEB_SECRET +
      '&code=' +
      code +
      '&grant_type=authorization_code'
  );
  const tokenData = await tokenRes.json();
  // tokenData = { access_token, expires_in, refresh_token, openid, scope, unionid }

  const webOpenid = tokenData.openid;
  const unionid = tokenData.unionid || '';

  // 2. 判断是否为管理员
  // 方案 A：直接检查 unionid 是否匹配（推荐）
  // 方案 B：从云数据库 admin_users 集合查询
  const isAdmin = await checkAdmin(unionid, webOpenid);

  if (!isAdmin) {
    // 更新状态为拒绝
    if (pendingLogins.has(scene)) {
      pendingLogins.get(scene).status = 'rejected';
    }
    return res.redirect('/admin-legacy.html?auth=rejected');
  }

  // 3. 生成会话 token
  const token = generateToken(webOpenid);

  // 4. 更新等待状态
  if (pendingLogins.has(scene)) {
    pendingLogins.get(scene).status = 'approved';
    pendingLogins.get(scene).token = token;
    pendingLogins.get(scene).userinfo = { unionid, webOpenid };
  }

  // 5. 重定向回前端页面
  res.redirect('/admin-legacy.html?auth=success&scene=' + scene);
});
```

#### 4.1.3 `GET /api/auth/check` — 前端轮询登录状态

```javascript
app.get('/api/auth/check', (req, res) => {
  const { scene } = req.query;
  const pending = pendingLogins.get(scene);

  if (!pending) {
    return res.json({ code: 0, data: { status: 'expired' } });
  }

  res.json({
    code: 0,
    data: {
      status: pending.status, // 'waiting' | 'approved' | 'rejected' | 'expired'
      token: pending.token || null
    }
  });
});
```

#### 4.1.4 `GET /api/auth/verify` — 验证 token 有效性

```javascript
// 用于页面刷新时验证已有 token
app.get('/api/auth/verify', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const isValid = verifyToken(token);

  res.json({
    code: 0,
    data: { valid: isValid }
  });
});
```

### 4.2 前端改造（admin-legacy.html）

#### 4.2.1 替换登录遮罩层

将现有的密码输入框替换为二维码展示区域：

```html
<!-- 扫码登录区域 -->
<div class="auth-overlay" id="authOverlay">
  <div class="auth-card">
    <div class="auth-logo">🧠</div>
    <div class="auth-title">星蓝心镜</div>
    <div class="auth-subtitle">后台管理系统</div>

    <!-- 二维码容器（由微信 JS SDK 填充） -->
    <div id="wechatQrcodeContainer" class="qrcode-container">
      <div class="qrcode-loading">加载二维码中...</div>
    </div>

    <div class="auth-status" id="authStatus">
      <div class="qrcode-hint">请使用微信扫描二维码登录</div>
    </div>

    <!-- 降级：密码登录入口 -->
    <div class="auth-fallback">
      <a href="javascript:void(0)" onclick="showPasswordLogin()">密码登录</a>
    </div>
  </div>
</div>
```

#### 4.2.2 微信 JS SDK 引入

```html
<script src="https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js"></script>
```

#### 4.2.3 登录流程 JavaScript

```javascript
var wechatLogin = {
  scene: null,
  pollTimer: null,
  token: null,

  // 初始化扫码登录
  init: function () {
    // 先检查 localStorage 中是否有有效 token
    var savedToken = localStorage.getItem('psy_admin_token');
    if (savedToken) {
      this.verifyToken(savedToken);
      return;
    }
    this.requestQrcode();
  },

  // 请求二维码
  requestQrcode: function () {
    var self = this;
    fetch('https://identity.soarto.com.cn/api/auth/qrcode')
      .then((r) => r.json())
      .then((data) => {
        if (data.code !== 0) return;
        self.scene = data.data.scene;
        self.renderQrcode(data.data);
        self.startPolling();
      });
  },

  // 渲染二维码
  renderQrcode: function (params) {
    var obj = new WxLogin({
      self_redirect: false,
      id: 'wechatQrcodeContainer',
      appid: params.appid,
      scope: 'snsapi_login',
      redirect_uri: 'https://identity.soarto.com.cn/api/auth/callback?state=' + this.scene,
      state: this.scene,
      style: 'black',
      href: '' // 可自定义二维码页面样式
    });
  },

  // 轮询登录状态
  startPolling: function () {
    var self = this;
    this.pollTimer = setInterval(function () {
      fetch('https://identity.soarto.com.cn/api/auth/check?scene=' + self.scene)
        .then((r) => r.json())
        .then((data) => {
          if (data.data.status === 'approved') {
            clearInterval(self.pollTimer);
            self.token = data.data.token;
            localStorage.setItem('psy_admin_token', self.token);
            adminAuth.grantAccess();
          } else if (data.data.status === 'rejected') {
            clearInterval(self.pollTimer);
            document.getElementById('authStatus').innerHTML =
              '<div style="color:var(--danger)">非管理员账号，登录被拒绝</div>';
          } else if (data.data.status === 'expired') {
            clearInterval(self.pollTimer);
            self.requestQrcode(); // 重新生成
          }
        });
    }, 2000); // 每 2 秒轮询一次
  },

  // 验证已有 token
  verifyToken: function (token) {
    fetch('https://identity.soarto.com.cn/api/auth/verify', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.data.valid) {
          this.token = token;
          adminAuth.grantAccess();
        } else {
          localStorage.removeItem('psy_admin_token');
          this.requestQrcode();
        }
      })
      .catch(function () {
        // API 不可用时降级到密码登录
      });
  },

  // 清除登录状态
  logout: function () {
    localStorage.removeItem('psy_admin_token');
    this.token = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
  }
};
```

### 4.3 管理员身份验证

#### 方案 A：unionid 硬编码（最简单，当前阶段推荐）

```javascript
// cloudbase-run/index.js
const ADMIN_UNIONIDS = ['MANAGER_UNIONID_HERE']; // 需要首次扫码后获取

async function checkAdmin(unionid, webOpenid) {
  // 优先检查 unionid
  if (unionid && ADMIN_UNIONIDS.includes(unionid)) return true;
  // 备用：检查 webOpenid（首次绑定前）
  if (ADMIN_WEB_OPENIDS && ADMIN_WEB_OPENIDS.includes(webOpenid)) return true;
  return false;
}
```

**首次绑定流程**：

1. 管理员先用密码登录（降级方案）
2. 扫码一次，后端记录该 unionid 和 webOpenid
3. 将 unionid 添加到管理员列表
4. 后续可以直接扫码登录

#### 方案 B：云数据库管理员表（推荐长期方案）

```javascript
// 在云数据库中创建 admin_users 集合
// { unionid, webOpenid, nickname, role: 'admin'|'viewer', createdAt }

async function checkAdmin(unionid, webOpenid) {
  if (!db) return false;
  if (unionid) {
    const res = await db.collection('admin_users').where({ unionid: unionid, role: 'admin' }).limit(1).get();
    if (res.data.length > 0) return true;
  }
  // 兼容：按 webOpenid 查找
  if (webOpenid) {
    const res = await db.collection('admin_users').where({ webOpenid: webOpenid, role: 'admin' }).limit(1).get();
    if (res.data.length > 0) {
      // 自动补填 unionid
      if (unionid) {
        await db
          .collection('admin_users')
          .where({ webOpenid: webOpenid })
          .update({ data: { unionid: unionid } });
      }
      return true;
    }
  }
  return false;
}
```

### 4.4 环境变量新增

需要在云托管服务中配置以下环境变量：

| 变量名                    | 值                                                 | 说明                             |
| ------------------------- | -------------------------------------------------- | -------------------------------- |
| `WECHAT_WEB_APPID`        | 网站应用 AppID                                     | 微信开放平台创建网站应用后获得   |
| `WECHAT_WEB_SECRET`       | 网站应用 AppSecret                                 | 与 AppID 配对                    |
| `WECHAT_WEB_REDIRECT_URI` | `https://identity.soarto.com.cn/api/auth/callback` | 回调地址，必须与开放平台配置一致 |

### 4.5 Token 机制

```javascript
// 简易 JWT 风格 token（无第三方依赖）
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'psy-admin-' + ENV_ID;
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 天

function generateToken(openid) {
  const payload = {
    sub: openid,
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY
  };
  // Base64 编码（非标准 JWT，但够用）
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = require('crypto').createHmac('sha256', TOKEN_SECRET).update(encoded).digest('hex').substr(0, 16);
  return encoded + '.' + signature;
}

function verifyToken(token) {
  try {
    const [encoded, signature] = token.split('.');
    const expectedSig = require('crypto')
      .createHmac('sha256', TOKEN_SECRET)
      .update(encoded)
      .digest('hex')
      .substr(0, 16);
    if (signature !== expectedSig) return false;
    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString());
    return payload.exp > Date.now();
  } catch (e) {
    return false;
  }
}
```

---

## 五、降级与兼容

### 5.1 密码登录降级

保留现有的 `adminAuth` 密码验证模块作为降级方案：

- 扫码登录区域底部保留"密码登录"链接
- 点击后切换到密码输入框
- API 不可用时（`identity.soarto.com.cn` 无法访问）自动显示密码登录
- 新管理员首次绑定前必须用密码登录

### 5.2 登录方式优先级

```
1. 检查 localStorage 中是否有有效 token → 验证通过则直接进入
2. 尝试加载微信扫码二维码 → 展示给用户
3. 如果微信 SDK 加载失败或 API 不可用 → 降级到密码登录
```

### 5.3 双版本兼容

- `mini-app-h5/backend/admin-legacy.html`（源码版）：同时支持扫码 + 密码
- `deploy/admin-legacy.html`（部署版）：`build-deploy.py` 构建时同步

---

## 六、安全加固

### 6.1 当前已知安全问题（扫码登录方案中一并解决）

| 问题                           | 严重性 | 扫码方案中的处理                                   |
| ------------------------------ | ------ | -------------------------------------------------- |
| DELETE /api/history/:id 无认证 | 🔴 高  | 所有写操作增加 token 验证中间件                    |
| POST /api/ai-diagnose 无认证   | 🟡 中  | 增加 token 或频率限制                              |
| OpenID 客户端传入可伪造        | 🔴 高  | 扫码后由后端获取真实 openid，前端无法伪造          |
| CORS 全开放                    | 🟡 中  | 限制为 `rich.soarto.com.cn` 和 `www.soarto.com.cn` |
| 密码明文 localStorage          | 🟡 中  | 密码降级方案中改用 SHA-256 哈希存储                |

### 6.2 新增认证中间件

```javascript
// cloudbase-run/index.js
function authMiddleware(req, res, next) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ code: -3, message: '未登录或登录已过期' });
  }
  req.user = decodeToken(token);
  next();
}

// 需要认证的写操作
app.delete('/api/history/:id', authMiddleware, async (req, res) => { ... });
app.post('/api/ai-diagnose', authMiddleware, async (req, res) => { ... });

// 读操作保持开放（前端需要匿名访问历史）
// 但可以加 rate limiting
```

---

## 七、微信开放平台注册步骤

### 7.1 注册并认证

1. 访问 https://open.weixin.qq.com
2. 使用企业主体（湖北索拓星蓝科技有限公司）注册
3. 完成微信认证（300 元/年，需要对公打款验证）
4. 认证通过后创建"网站应用"

### 7.2 创建网站应用

1. 管理中心 → 网站应用 → 创建网站应用
2. 填写信息：
   - 应用名称：星蓝心镜管理后台
   - 应用简介：心理健康测评系统后台管理
   - 应用官网：`https://www.soarto.com.cn`
3. **授权回调域**：`identity.soarto.com.cn`（注意不带 https://）
4. 提交审核（1-5 个工作日）

### 7.3 绑定小程序（获取 unionid）

1. 开放平台管理中心 → 第三方账号绑定 → 绑定小程序
2. 绑定 AppID：`wxb811fa4c960b0e0b`
3. 绑定后，扫码登录获取的 unionid 与小程序用户 unionid 一致

---

## 八、实施路线图

### 阶段 0：等待前置条件 ⏳（当前）

- [ ] ICP 接入备案审核通过
- [ ] 注册/登录微信开放平台
- [ ] 完成企业微信认证（300 元/年）

### 阶段 1：开放平台配置（预计 1 周）

- [ ] 创建网站应用
- [ ] 配置授权回调域 `identity.soarto.com.cn`
- [ ] 获取 AppID 和 AppSecret
- [ ] 绑定小程序获取 unionid 互通能力

### 阶段 2：后端开发（预计 2-3 天）

- [ ] `cloudbase-run/index.js` 新增 4 个 auth 路由
- [ ] 实现 token 生成和验证
- [ ] 实现管理员身份校验（先用硬编码 unionid）
- [ ] 添加认证中间件保护写操作
- [ ] 配置环境变量（WECHAT_WEB_APPID / SECRET / REDIRECT_URI）
- [ ] 测试二维码生成 + 扫码回调 + token 签发

### 阶段 3：前端改造（预计 1-2 天）

- [ ] `admin-legacy.html` 替换登录遮罩为二维码区域
- [ ] 引入微信 JS SDK（`wxLogin.js`）
- [ ] 实现轮询逻辑
- [ ] 保留密码登录降级
- [ ] CSS 样式适配

### 阶段 4：测试与部署（预计 1 天）

- [ ] 本地测试完整登录流程
- [ ] `build-deploy.py` 构建部署
- [ ] 云托管更新环境变量
- [ ] 线上验证

### 阶段 5：长期优化（按需）

- [ ] 云数据库 `admin_users` 集合管理（多管理员支持）
- [ ] 后台"管理员管理"界面
- [ ] 登录日志记录
- [ ] Session 过期自动跳转登录

---

## 九、成本估算

| 项目                   | 费用             | 频率 |
| ---------------------- | ---------------- | ---- |
| 微信开放平台认证       | 300 元           | 每年 |
| 开发工作量             | 0 元（自主开发） | —    |
| 服务器资源（复用现有） | 0 元             | —    |
| **总计**               | **300 元/年**    |      |

---

## 十、风险与应对

| 风险                | 概率 | 应对措施                              |
| ------------------- | ---- | ------------------------------------- |
| ICP 备案不通过      | 低   | 准备好齐全材料，真实信息填报          |
| 微信开放平台审核慢  | 中   | 提前准备材料，审核期间继续用密码登录  |
| 管理员手机微信被封  | 极低 | 保留密码降级方案                      |
| 二维码 SDK 加载失败 | 低   | 超时后自动降级到密码登录              |
| unionid 获取失败    | 低   | 先用 webOpenid 匹配，后续补填 unionid |

---

## 附录：文件改动清单

| 文件                                    | 改动类型 | 改动内容                                 |
| --------------------------------------- | -------- | ---------------------------------------- |
| `cloudbase-run/index.js`                | 新增路由 | 4 个 auth 端点 + token + 中间件          |
| `mini-app-h5/backend/admin-legacy.html` | UI 替换  | 登录遮罩 → 二维码 + 轮询 JS              |
| `cloudbase-run/package.json`            | 无改动   | 无新依赖（token 用 Node.js 内置 crypto） |
| `Dockerfile`                            | 无改动   | 无新依赖                                 |
| `build-deploy.py`                       | 无改动   | 构建流程不变                             |
