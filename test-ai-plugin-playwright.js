const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 测试结果收集
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

// 记录测试结果
function recordTest(name, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`  ✅ ${name}`);
  } else {
    testResults.failed++;
    console.log(`  ❌ ${name}${details ? ': ' + details : ''}`);
  }
  testResults.details.push({ name, passed, details });
}

// 注意：请先手动启动 HTTP 服务器
// 在另一个终端运行: cd /Users/rich/WorkBuddy/20260407113106 && python3 -m http.server 8081
// 然后再运行此脚本: node test-ai-plugin-playwright.js

async function waitForServer(url, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`✅ 服务器已启动: ${url}`);
        return true;
      }
    } catch (e) {
      // 继续等待
    }
    console.log(`⏳ 等待服务器启动... (${i + 1}/${maxRetries})`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('服务器启动超时');
}

// 主测试函数
async function runTests() {
  console.log('🧪 开始自动化测试 ai-plugin.js\n');

  // 等待服务器启动
  await waitForServer('http://localhost:8081/');

  // 启动浏览器
  const browser = await chromium.launch({
    headless: false, // 显示浏览器，方便调试
    slowMo: 100 // 减慢操作，方便观察
  });

  const page = await browser.newPage();

  try {
    // ====================================================
    // 测试套件 1: 页面加载和基础检查
    // ====================================================
    console.log('\n📋 测试套件 1: 页面加载和基础检查');
    console.log('==================================================\n');

    // 1.1 加载 admin-legacy.html
    console.log('  1.1 加载 admin-legacy.html');
    try {
      await page.goto('http://localhost:8081/mini-app-h5/backend/admin-legacy.html');
      await page.waitForLoadState('networkidle');
      console.log('  ✅ 页面加载成功');
      recordTest('1.1 页面加载', true);
    } catch (error) {
      recordTest('1.1 页面加载', false, error.message);
    }

    // 1.2 检查 PluginLoader
    console.log('\n  1.2 检查 PluginLoader');
    const hasPluginLoader = await page.evaluate(() => {
      return typeof PluginLoader !== 'undefined';
    });
    recordTest('1.2 PluginLoader 已加载', hasPluginLoader);

    // 1.3 检查 AIPlugin
    console.log('\n  1.3 检查 AIPlugin');
    const hasAIPlugin = await page.evaluate(() => {
      return typeof AIPlugin !== 'undefined';
    });
    recordTest('1.3 AIPlugin 已定义', hasAIPlugin);

    // 1.4 检查 AI 插件加载
    console.log('\n  1.4 检查 AI 插件加载');
    const aiPluginLoaded = await page.evaluate(() => {
      return PluginLoader && PluginLoader.get && PluginLoader.get('ai') !== undefined;
    });
    recordTest('1.4 AI 插件已加载', aiPluginLoaded);

    // ====================================================
    // 测试套件 2: AI 插件标准接口测试
    // ====================================================
    console.log('\n📋 测试套件 2: AI 插件标准接口测试');
    console.log('==================================================\n');

    // 2.1 测试 AIPlugin.init()
    console.log('\n  2.1 测试 AIPlugin.init()');
    const aiInit = await page.evaluate(() => {
      try {
        const plugin = PluginLoader.get('ai');
        if (plugin && typeof plugin.init === 'function') {
          plugin.init();
          return { success: true };
        }
        return { success: false, error: '插件或 init 方法不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('2.1 AIPlugin.init() 可执行', aiInit.success, aiInit.error);

    // 2.2 测试 AIPlugin.getInfo()
    console.log('\n  2.2 测试 AIPlugin.getInfo()');
    const aiGetInfo = await page.evaluate(() => {
      try {
        const plugin = PluginLoader.get('ai');
        if (plugin && typeof plugin.getInfo === 'function') {
          const info = plugin.getInfo();
          return { success: true, info: info };
        }
        return { success: false, error: '插件或 getInfo 方法不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('2.2 AIPlugin.getInfo() 可执行', aiGetInfo.success, aiGetInfo.error);
    if (aiGetInfo.success) {
      console.log(`     插件信息: ${JSON.stringify(aiGetInfo.info)}`);
    }

    // 2.3 测试 AIPlugin.isInstalled()
    console.log('\n  2.3 测试 AIPlugin.isInstalled()');
    const aiIsInstalled = await page.evaluate(() => {
      try {
        const plugin = PluginLoader.get('ai');
        if (plugin && typeof plugin.isInstalled === 'function') {
          const installed = plugin.isInstalled();
          return { success: true, installed: installed };
        }
        return { success: false, error: '插件或 isInstalled 方法不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('2.3 AIPlugin.isInstalled() 可执行', aiIsInstalled.success, aiIsInstalled.error);

    // 2.4 测试 AIPlugin.install()
    console.log('\n  2.4 测试 AIPlugin.install()');
    const aiInstall = await page.evaluate(() => {
      try {
        const plugin = PluginLoader.get('ai');
        if (plugin && typeof plugin.install === 'function') {
          plugin.install();
          return { success: true };
        }
        return { success: false, error: '插件或 install 方法不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('2.4 AIPlugin.install() 可执行', aiInstall.success, aiInstall.error);

    // 2.5 测试 AIPlugin.uninstall()
    console.log('\n  2.5 测试 AIPlugin.uninstall()');
    const aiUninstall = await page.evaluate(() => {
      try {
        const plugin = PluginLoader.get('ai');
        if (plugin && typeof plugin.uninstall === 'function') {
          plugin.uninstall();
          return { success: true };
        }
        return { success: false, error: '插件或 uninstall 方法不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('2.5 AIPlugin.uninstall() 可执行', aiUninstall.success, aiUninstall.error);

    // ====================================================
    // 测试套件 3: AI 配置功能测试
    // ====================================================
    console.log('\n📋 测试套件 3: AI 配置功能测试');
    console.log('==================================================\n');

    // 3.1 测试加载配置
    console.log('\n  3.1 测试加载配置');
    const loadConfig = await page.evaluate(() => {
      try {
        const plugin = PluginLoader.get('ai');
        if (plugin && typeof plugin.onExecute === 'function') {
          const result = plugin.onExecute({ action: 'loadConfig' });
          return { success: true, result: result };
        }
        return { success: false, error: '插件或 onExecute 方法不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('3.1 加载AI配置', loadConfig.success, loadConfig.error);

    // 3.2 测试保存配置
    console.log('\n  3.2 测试保存配置');
    const saveConfig = await page.evaluate(() => {
      try {
        const plugin = PluginLoader.get('ai');
        if (plugin && typeof plugin.onExecute === 'function') {
          const result = plugin.onExecute({
            action: 'saveConfig',
            apiKey: 'test-api-key',
            model: 'test-model'
          });
          return { success: true, result: result };
        }
        return { success: false, error: '插件或 onExecute 方法不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('3.2 保存AI配置', saveConfig.success, saveConfig.error);

    // 3.3 测试测试连接
    console.log('\n  3.3 测试测试连接');
    const testConnection = await page.evaluate(() => {
      try {
        const plugin = PluginLoader.get('ai');
        if (plugin && typeof plugin.onExecute === 'function') {
          const result = plugin.onExecute({ action: 'test' });
          return { success: true, result: result };
        }
        return { success: false, error: '插件或 onExecute 方法不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('3.3 测试AI连接', testConnection.success, testConnection.error);

    // ====================================================
    // 测试套件 4: 事件通信测试
    // ====================================================
    console.log('\n📋 测试套件 4: 事件通信测试');
    console.log('==================================================\n');

    // 4.1 检查 EventHub
    console.log('\n  4.1 检查 EventHub');
    const hasEventHub = await page.evaluate(() => {
      return typeof EventHub !== 'undefined';
    });
    recordTest('4.1 EventHub 已定义', hasEventHub);

    // 4.2 测试事件监听
    console.log('\n  4.2 测试事件监听');
    const eventListen = await page.evaluate(() => {
      try {
        const result = EventHub.on('ai-config-changed', () => {});
        return { success: true, result: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('4.2 事件监听正常', eventListen.success, eventListen.error);

    // 4.3 测试 AI 插件事件发射
    console.log('\n  4.3 测试 AI 插件事件发射');
    const eventEmit = await page.evaluate(() => {
      try {
        const result = EventHub.emit('ai-config-changed', { test: true });
        return { success: true, result: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('4.3 AI 插件事件发射正常', eventEmit.success, eventEmit.error);

    // ====================================================
    // 测试套件 5: UI 渲染测试
    // ====================================================
    console.log('\n📋 测试套件 5: UI 渲染测试');
    console.log('==================================================\n');

    // 5.1 检查 AI 配置界面
    console.log('\n  5.1 检查 AI 配置界面');
    const aiUI = await page.evaluate(() => {
      const aiSection = document.querySelector('[data-section="ai"]');
      return aiSection !== null;
    });
    recordTest('5.1 AI 配置界面存在', aiUI);

    // 5.2 检查 API Key 输入框
    console.log('\n  5.2 检查 API Key 输入框');
    const apiKeyInput = await page.evaluate(() => {
      const input = document.getElementById('aiApiKey');
      return input !== null;
    });
    recordTest('5.2 API Key 输入框存在', apiKeyInput);

    // 5.3 保存截图
    console.log('\n  5.3 保存截图');
    try {
      await page.screenshot({ path: 'ai-plugin-test-screenshot.png' });
      console.log('  ✅ 截图保存成功');
      recordTest('5.3 截图保存', true);
    } catch (error) {
      recordTest('5.3 截图保存', false, error.message);
    }

    // ====================================================
    // 生成测试报告
    // ====================================================
    console.log('\n📊 测试报告');
    console.log('==================================================\n');
    console.log(`总测试数: ${testResults.total}`);
    console.log(`✅ 通过: ${testResults.passed}`);
    console.log(`❌ 失败: ${testResults.failed}`);
    console.log(`⏭️  跳过: ${testResults.skipped}`);
    console.log(`通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    // 保存 JSON 报告
    fs.writeFileSync('ai-plugin-test-report.json', JSON.stringify(testResults, null, 2));
    console.log('\n📄 JSON 报告已保存: ai-plugin-test-report.json');

    // 保存 HTML 报告
    const htmlReport = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 插件测试报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1200px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
    .report-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #4a90d9; padding-bottom: 10px; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .summary-item { flex: 1; padding: 20px; border-radius: 8px; text-align: center; }
    .summary-item.total { background: #e3f2fd; color: #1976d2; }
    .summary-item.passed { background: #e8f5e9; color: #388e3c; }
    .summary-item.failed { background: #ffebee; color: #d32f2f; }
    .summary-item.skipped { background: #fff3e0; color: #f57c00; }
    .summary-item .number { font-size: 48px; font-weight: bold; margin: 10px 0; }
    .summary-item .label { font-size: 14px; }
    .pass-rate { font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; padding: 20px; border-radius: 8px; }
    .pass-rate.high { background: #e8f5e9; color: #388e3c; }
    .pass-rate.medium { background: #fff3e0; color: #f57c00; }
    .pass-rate.low { background: #ffebee; color: #d32f2f; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
    .status-pass { color: #388e3c; font-weight: bold; }
    .status-fail { color: #d32f2f; font-weight: bold; }
    .status-skip { color: #f57c00; font-weight: bold; }
  </style>
</head>
<body>
  <div class="report-container">
    <h1>🧪 AI 插件测试报告</h1>
    <p>测试时间: ${new Date().toLocaleString('zh-CN')}</p>
    
    <div class="summary">
      <div class="summary-item total">
        <div class="number">${testResults.total}</div>
        <div class="label">总测试数</div>
      </div>
      <div class="summary-item passed">
        <div class="number">${testResults.passed}</div>
        <div class="label">通过</div>
      </div>
      <div class="summary-item failed">
        <div class="number">${testResults.failed}</div>
        <div class="label">失败</div>
      </div>
      <div class="summary-item skipped">
        <div class="number">${testResults.skipped}</div>
        <div class="label">跳过</div>
      </div>
    </div>
    
    <div class="pass-rate ${testResults.passed / testResults.total >= 0.95 ? 'high' : testResults.passed / testResults.total >= 0.8 ? 'medium' : 'low'}">
      通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%
    </div>
    
    <h2>📋 详细结果</h2>
    <table>
      <tr>
        <th>测试用例</th>
        <th>状态</th>
        <th>详情</th>
      </tr>
      ${testResults.details
        .map(
          (d) => `
        <tr>
          <td>${d.name}</td>
          <td class="${d.passed ? 'status-pass' : 'status-fail'}">${d.passed ? '✅ 通过' : '❌ 失败'}</td>
          <td>${d.details || '-'}</td>
        </tr>
      `
        )
        .join('')}
    </table>
  </div>
</body>
</html>
    `.trim();

    fs.writeFileSync('ai-plugin-test-report.html', htmlReport);
    console.log('📄 HTML 报告已保存: ai-plugin-test-report.html');

    console.log('\n✅ 自动化测试完成！');
    console.log('💡 请手动关闭 HTTP 服务器 (Ctrl+C)');
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
  } finally {
    await browser.close();
  }
}

// 运行测试
runTests().catch(console.error);
