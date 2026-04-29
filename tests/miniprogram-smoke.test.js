// tests/miniprogram-smoke.test.js
// 微信小程序壳冒烟测试 — 通过 miniprogram-automator 驱动开发者工具
// 运行：NODE_PATH=/Users/rich/WorkBuddy/20260407113106/node_modules npx jest tests/miniprogram-smoke.test.js --runInBand

const automator = require('miniprogram-automator');
const assert = require('assert');

const CLI_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT_PATH = '/Users/rich/WorkBuddy/20260407113106/wechat-miniprogram';
const BASE_DOMAIN = 'rich.soarto.com.cn';
// 注意：不要指定 port，让 automator 自动分配空闲端口连接开发者工具

describe('星蓝心镜 — 小程序壳冒烟测试', () => {
  let miniProgram;
  let indexPage;   // 首页
  let webviewPage; // WebView 页面

  beforeAll(async () => {
    miniProgram = await automator.launch({
      cliPath: CLI_PATH,
      projectPath: PROJECT_PATH,
    });
  }, 60000);

  afterAll(async () => {
    if (miniProgram) await miniProgram.close();
  }, 10000);

  // ── 首页测试 ──

  describe('首页 (pages/index/index)', () => {
    beforeAll(async () => {
      indexPage = await miniProgram.reLaunch('/pages/index/index');
      await indexPage.waitFor(2000); // 等打字动画启动
    }, 15000);

    test('页面正常加载', async () => {
      assert.ok(indexPage, '首页应存在');
    });

    test('打字动画已启动 — typingLines 非空', async () => {
      const lines = await indexPage.data('typingLines');
      assert.ok(Array.isArray(lines) && lines.length > 0, 'typingLines 应有内容');
      assert.ok(lines[0].text.length > 0, '第一行应有文字');
    });

    test('版本号显示 — 来自 app.globalData', async () => {
      const version = await indexPage.data('version');
      assert.ok(version && version.startsWith('v'), '版本号应以 v 开头，实际: ' + version);
    });

    test('图片宽度初始 80%，加载后 60%', async () => {
      const width = await indexPage.data('imgDisplayWidth');
      // 初始80，onImgLoad后变60，测试环境可能图片加载慢
      assert.ok([60, 80].includes(width), '宽度应为 60 或 80，实际: ' + width);
    });

    test('「进入测评」按钮存在', async () => {
      const btn = await indexPage.$('.enter-btn');
      assert.ok(btn, '应找到 .enter-btn 按钮');
    });

    test('长按区域存在（管理入口）', async () => {
      const area = await indexPage.$('.character-area');
      assert.ok(area, '应找到 .character-area 长按区域');
    });
  });

  // ── WebView 页面测试 ──

  describe('WebView 页面 (pages/webview/webview)', () => {
    beforeAll(async () => {
      webviewPage = await miniProgram.reLaunch('/pages/webview/webview?type=front');
      await webviewPage.waitFor(3000); // 等 WebView 加载
    }, 15000);

    test('页面正常加载', async () => {
      assert.ok(webviewPage, 'WebView 页面应存在');
    });

    test('URL 指向正确域名', async () => {
      const url = await webviewPage.data('url');
      assert.ok(url && url.includes(BASE_DOMAIN), 'URL 应包含 ' + BASE_DOMAIN + '，实际: ' + url);
    });

    test('URL 包含 env=cloud 参数', async () => {
      const url = await webviewPage.data('url');
      assert.ok(url && url.includes('env=cloud'), 'URL 应包含 env=cloud，实际: ' + url);
    });

    test('URL 包含 envId', async () => {
      const url = await webviewPage.data('url');
      assert.ok(url && url.includes('envId='), 'URL 应包含 envId，实际: ' + url);
    });

    test('URL 包含版本破缓存参数', async () => {
      const url = await webviewPage.data('url');
      assert.ok(url && url.match(/[?&]v=\d+&t=\d+/), 'URL 应包含 v=&t= 破缓存参数，实际: ' + url);
    });

    test('web-view 组件存在', async () => {
      const wv = await webviewPage.$('#mainWebView');
      assert.ok(wv, '应找到 #mainWebView');
    });

    test('type=admin 时加载管理后台', async () => {
      const adminPage = await miniProgram.reLaunch('/pages/webview/webview?type=admin');
      await adminPage.waitFor(5000);
      const url = await adminPage.data('url');
      assert.ok(url && url.includes('admin-legacy.html'), 'admin 类型应加载 admin-legacy.html，实际: ' + url);
    }, 15000);
  });

  // ── app 全局数据测试 ──

  describe('App 全局配置', () => {
    test('envId 已配置', async () => {
      const globalData = await miniProgram.evaluate(() => {
        return getApp().globalData;
      });
      assert.ok(globalData && globalData.envId, 'envId 应存在');
      assert.strictEqual(globalData.envId, 'cloud1-d8ggx8sqde8afa6a4');
    });

    test('版本号格式正确', async () => {
      const globalData = await miniProgram.evaluate(() => {
        return getApp().globalData;
      });
      assert.ok(globalData.version && globalData.version.startsWith('v'), 
        '版本号应以 v 开头，实际: ' + globalData.version);
    });
  });
});
