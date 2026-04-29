# 微信小程序真机自动化测试方案

## 概述

使用微信官方 `miniprogram-automator` 工具实现小程序端真机自动化测试。

## 前置条件

1. **微信开发者工具** ≥ 1.06.2306280
2. **Node.js** ≥ 14
3. **真机或模拟器** 已连接开发者工具

## 安装

```bash
npm install miniprogram-automator --save-dev
```

## 项目配置

在 `project.config.json` 中添加：

```json
{
  "setting": {
    "urlCheck": false,
    "es6": true,
    "enhance": true,
    "compileHotReLoad": true,
    "miniprogramNpmDistDir": "./miniprogram_npm"
  },
  "miniprogramRoot": "./",
  "compileType": "miniprogram"
}
```

## 测试脚本示例

### `tests/miniprogram-smoke.test.js`

```javascript
const automator = require('miniprogram-automator');

describe('星蓝心镜小程序', () => {
  let miniProgram;
  let page;

  beforeAll(async () => {
    miniProgram = automator.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/Users/rich/WorkBuddy/20260407113106/wechat-miniprogram',
      // Windows: cliPath: 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
    });
    page = await miniProgram.reLaunch('/pages/index/index');
    await page.waitFor(3000); // 等待小程序启动完成
  }, 30000);

  afterAll(async () => {
    if (miniProgram) await miniProgram.close();
  });

  test('首页加载成功', async () => {
    const title = await page.data('pageTitle');
    expect(title).toBeDefined();
  });

  test('首页 WebView 组件存在', async () => {
    const webView = await page.$('web-view');
    expect(webView).toBeDefined();
  });

  test('WebView src 指向正确域名', async () => {
    const src = await page.data('webViewSrc');
    expect(src).toContain('rich.soarto.com.cn');
  });

  test('小程序壳页面渲染正常', async () => {
    const welcomeText = await page.data('welcomeVisible');
    expect(welcomeText).toBe(true);
  });
});
```

### `tests/miniprogram-webview.test.js`

```javascript
describe('WebView 集成测试', () => {
  let miniProgram;
  let page;

  beforeAll(async () => {
    miniProgram = automator.launch({ cliPath: '...', projectPath: '...' });
    page = await miniProgram.reLaunch('/pages/index/index');
    await page.waitFor(5000); // 等待 WebView 加载
  }, 30000);

  afterAll(async () => {
    if (miniProgram) await miniProgram.close();
  });

  test('WebView 通信通道正常', async () => {
    // 测试 postMessage 通道
    const result = await miniProgram.evaluate(() => {
      const webView = getCurrentPages()[0].selectComponent('#main-webview');
      return { hasWebView: !!webView };
    });
    expect(result.hasWebView).toBe(true);
  });

  test('open-id 参数传递', async () => {
    // 验证 webview URL 包含 openid 参数
    const src = await page.data('webViewSrc');
    if (src.includes('env=cloud')) {
      // 云端模式应包含 openid
      expect(src).toMatch(/openid=/);
    }
  });
});
```

## 运行

```bash
# 确保微信开发者工具已打开
npx jest tests/miniprogram-smoke.test.js --runInBand
```

## 限制与注意事项

1. **web-view 组件**：automator 可以检测 web-view 是否存在，但无法直接操作 web-view 内的 DOM
2. **WebView 调试**：可通过 `miniProgram.evaluate()` 在小程序上下文执行代码，但无法深入 web-view 内部
3. **真机 vs 模拟器**：真机测试更准确但速度较慢；模拟器速度快但可能有兼容性差异
4. **登录态**：需要先手动扫码登录，测试时才有 openid
5. **WebView 内部测试**：web-view 内部的 H5 页面测试建议用 Playwright 直接测 H5，不需要走小程序壳

## 测试范围建议

| 优先级 | 测试项 | 方式 |
|--------|--------|------|
| P0 | 小程序启动 → WebView 加载 | automator |
| P1 | WebView URL 参数（openid/env） | automator |
| P2 | 系统返回键 WebView 行为 | 真机手动 |
| P2 | 不同机型适配 | 真机矩阵 |
| P3 | 小程序内存/启动速度 | 开发者工具性能面板 |

## 当前状态

> ⚠️ 此方案为规划文档，尚未实现。需要先安装 miniprogram-automator 并配置开发者工具路径。
> 
> H5 页面内的测试已由 `e2e-regression.cjs` + `webview-back.test.js` 覆盖，小程序壳仅做冒烟测试。
