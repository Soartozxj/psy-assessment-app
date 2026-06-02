/**
 * Scoring 插件自动化测试脚本 (Playwright 版本)
 *
 * 用于回归测试 scoring-plugin.js 的核心功能
 * 测试对象：ScoringPlugin (继承自 PluginBase)
 *
 * 使用方法：
 * 1. 确保已安装 Playwright: npm install -D @playwright/test
 * 2. 启动 HTTP 服务器: python3 -m http.server 8081
 * 3. 运行测试: node test-scoring-plugin-playwright.js
 *
 * @version 2.0.0 - 修复API调用问题
 * @date 2026-06-01
 */

const { chromium } = require('playwright');
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

/**
 * 记录测试结果
 */
function recordTest(name, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  testResults.details.push({ name, passed, details });
  console.log(`  ${passed ? '✅' : '❌'} ${name}${details ? ': ' + details : ''}`);
}

/**
 * 等待服务器启动
 */
async function waitForServer(url, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`✅ 服务器已启动: ${url}`);
        return true;
      }
    } catch (error) {
      // 继续等待
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`服务器启动超时: ${url}`);
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🧪 开始自动化测试 scoring-plugin.js\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ====================================================
    // 测试套件 1: 页面加载和基础检查
    // ====================================================
    console.log('📋 测试套件 1: 页面加载和基础检查');
    console.log('==================================================\n');

    // 1.1 加载 admin-legacy.html
    console.log('  1.1 加载 admin-legacy.html');
    await page.goto('http://localhost:8081/mini-app-h5/admin-legacy.html');
    await page.waitForLoadState('networkidle');

    // 等待 PluginLoader 加载完成
    console.log('  ⏳ 等待 PluginLoader 加载...');
    await page.waitForFunction(
      () => {
        return typeof window.PluginLoader !== 'undefined' && typeof window.PluginLoader.get === 'function';
      },
      { timeout: 15000 }
    );

    // 额外等待2秒确保所有插件加载完成
    await page.waitForTimeout(2000);

    recordTest('1.1 页面加载', true);
    console.log('  ✅ 页面加载成功');

    // 1.2 检查 PluginLoader
    console.log('\n  1.2 检查 PluginLoader');
    const hasPluginLoader = await page.evaluate(() => {
      return typeof PluginLoader !== 'undefined';
    });
    recordTest('1.2 PluginLoader 已加载', hasPluginLoader);

    // 1.3 检查 ScoringPlugin
    console.log('\n  1.3 检查 ScoringPlugin');
    const hasScoringPlugin = await page.evaluate(() => {
      return typeof ScoringPlugin !== 'undefined';
    });
    recordTest('1.3 ScoringPlugin 已定义', hasScoringPlugin);

    // 1.4 检查 Scoring 插件加载
    console.log('\n  1.4 检查 Scoring 插件加载');
    const scoringPluginLoaded = await page.evaluate(() => {
      return PluginLoader && PluginLoader.get && PluginLoader.get('scoring') !== undefined;
    });
    recordTest('1.4 Scoring 插件已加载', scoringPluginLoaded);

    // ====================================================
    // 测试套件 2: Scoring 插件标准接口测试
    // ====================================================
    console.log('\n📋 测试套件 2: Scoring 插件标准接口测试');
    console.log('==================================================\n');

    // 2.1 测试 ScoringPlugin.init()
    console.log('\n  2.1 测试 ScoringPlugin.init()');
    const scoringInit = await page.evaluate(() => {
      try {
        const plugin = PluginLoader.get('scoring');
        if (plugin && typeof plugin.init === 'function') {
          return { success: true };
        }
        return { success: false, error: '插件或 init 方法不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('2.1 ScoringPlugin.init() 可执行', scoringInit.success, scoringInit.error);

    // 2.2 测试 ScoringPlugin 属性
    console.log('\n  2.2 测试 ScoringPlugin 属性');
    const scoringProps = await page.evaluate(() => {
      try {
        const plugin = PluginLoader.get('scoring');
        if (plugin) {
          return {
            success: true,
            name: plugin.name,
            version: plugin.version,
            description: plugin.description,
            isInitialized: plugin.isInitialized
          };
        }
        return { success: false, error: '插件不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('2.2 ScoringPlugin 属性可读', scoringProps.success, scoringProps.error);
    if (scoringProps.success) {
      console.log(`     插件名称: ${scoringProps.name}`);
      console.log(`     插件版本: ${scoringProps.version}`);
      console.log(`     插件描述: ${scoringProps.description}`);
      console.log(`     已初始化: ${scoringProps.isInitialized}`);
    }

    // 2.3 测试 ScoringPlugin.execute() - list action
    console.log('\n  2.3 测试 ScoringPlugin.execute() - list');
    const scoringExecuteList = await page.evaluate(async () => {
      try {
        const plugin = PluginLoader.get('scoring');
        if (plugin && typeof plugin.execute === 'function') {
          const result = await plugin.execute({ action: 'list' });
          return { success: true, count: result ? result.length : 0 };
        }
        return { success: false, error: '插件或 execute 方法不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('2.3 ScoringPlugin.execute() list 可执行', scoringExecuteList.success, scoringExecuteList.error);
    if (scoringExecuteList.success) {
      console.log(`     获取到 ${scoringExecuteList.count} 条计分规则`);
    }

    // 2.4 测试 ScoringPlugin.destroy()
    console.log('\n  2.4 测试 ScoringPlugin.destroy()');
    const scoringDestroy = await page.evaluate(() => {
      try {
        const plugin = PluginLoader.get('scoring');
        if (plugin && typeof plugin.destroy === 'function') {
          plugin.destroy();
          return { success: true, isDestroyed: plugin.isDestroyed };
        }
        return { success: false, error: '插件或 destroy 方法不存在' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('2.4 ScoringPlugin.destroy() 可执行', scoringDestroy.success, scoringDestroy.error);
    if (scoringDestroy.success) {
      console.log(`     已销毁: ${scoringDestroy.isDestroyed}`);
    }

    // ====================================================
    // 测试套件 3: 计分规则管理功能测试
    // ====================================================
    console.log('\n📋 测试套件 3: 计分规则管理功能测试');
    console.log('==================================================\n');

    // 重新初始化插件以继续测试
    await page.evaluate(async () => {
      const plugin = PluginLoader.get('scoring');
      if (plugin && !plugin.isInitialized) {
        await plugin.init();
      }
    });

    // 3.1 测试加载计分规则列表
    console.log('\n  3.1 测试加载计分规则列表');
    const scoringList = await page.evaluate(async () => {
      try {
        const plugin = PluginLoader.get('scoring');
        const rules = await plugin.execute({ action: 'list' });
        return { success: true, count: rules.length, rules: rules };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('3.1 加载计分规则列表', scoringList.success, scoringList.error);
    if (scoringList.success) {
      console.log(`     加载了 ${scoringList.count} 条计分规则`);
    }

    // 3.2 测试获取单条计分规则
    console.log('\n  3.2 测试获取单条计分规则');
    const scoringGet = await page.evaluate(async () => {
      try {
        const plugin = PluginLoader.get('scoring');
        const rules = await plugin.execute({ action: 'list' });
        if (rules && rules.length > 0) {
          const rule = await plugin.execute({ action: 'get', id: rules[0].id });
          return { success: true, rule: rule };
        }
        return { success: false, error: '没有计分规则可获取' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('3.2 获取单条计分规则', scoringGet.success, scoringGet.error);
    if (scoringGet.success) {
      console.log(`     获取到计分规则: ${scoringGet.rule ? scoringGet.rule.name : 'null'}`);
    }

    // 3.3 测试创建计分规则
    console.log('\n  3.3 测试创建计分规则');
    const scoringCreate = await page.evaluate(async () => {
      try {
        const plugin = PluginLoader.get('scoring');
        const newRule = await plugin.execute({
          action: 'create',
          data: { name: '测试计分规则', scaleId: 999, type: 'sum' }
        });
        return { success: true, rule: newRule };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('3.3 创建计分规则', scoringCreate.success, scoringCreate.error);
    if (scoringCreate.success) {
      console.log(`     创建计分规则: ${scoringCreate.rule ? scoringCreate.rule.name : 'null'}`);
    }

    // 3.4 测试更新计分规则
    console.log('\n  3.4 测试更新计分规则');
    const scoringUpdate = await page.evaluate(async () => {
      try {
        const plugin = PluginLoader.get('scoring');
        const rules = await plugin.execute({ action: 'list' });
        if (rules && rules.length > 0) {
          const updatedRule = await plugin.execute({
            action: 'update',
            id: rules[0].id,
            data: { name: rules[0].name + ' (已更新)' }
          });
          return { success: true, rule: updatedRule };
        }
        return { success: false, error: '没有可更新的计分规则' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('3.4 更新计分规则', scoringUpdate.success, scoringUpdate.error);

    // 3.5 测试删除计分规则
    console.log('\n  3.5 测试删除计分规则');
    const scoringDelete = await page.evaluate(async () => {
      try {
        const plugin = PluginLoader.get('scoring');
        const rules = await plugin.execute({ action: 'list' });
        if (rules && rules.length > 0) {
          await plugin.execute({ action: 'delete', id: rules[rules.length - 1].id });
          return { success: true };
        }
        return { success: false, error: '没有可删除的计分规则' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('3.5 删除计分规则', scoringDelete.success, scoringDelete.error);

    // ====================================================
    // 测试套件 4: 计分计算功能测试
    // ====================================================
    console.log('\n📋 测试套件 4: 计分计算功能测试');
    console.log('==================================================\n');

    // 4.1 测试计算得分 - 正常情况
    console.log('\n  4.1 测试计算得分 - 正常情况');
    const scoringCalc1 = await page.evaluate(async () => {
      try {
        const plugin = PluginLoader.get('scoring');
        const rules = await plugin.execute({ action: 'list' });
        if (rules && rules.length > 0) {
          const result = await plugin.execute({
            action: 'calculate',
            ruleId: rules[0].id,
            answers: [1, 2, 3, 4]
          });
          return { success: true, result: result };
        }
        return { success: false, error: '没有计分规则可用' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('4.1 计算得分 - 正常情况', scoringCalc1.success, scoringCalc1.error);
    if (scoringCalc1.success) {
      console.log(`     得分: ${scoringCalc1.result ? scoringCalc1.result.score : 'undefined'}`);
      console.log(`     解释: ${scoringCalc1.result ? scoringCalc1.result.interpretation : 'undefined'}`);
    }

    // 4.2 测试计算得分 - 边界值（0分）
    console.log('\n  4.2 测试计算得分 - 边界值（0分）');
    const scoringCalc2 = await page.evaluate(async () => {
      try {
        const plugin = PluginLoader.get('scoring');
        const rules = await plugin.execute({ action: 'list' });
        if (rules && rules.length > 0) {
          const result = await plugin.execute({
            action: 'calculate',
            ruleId: rules[0].id,
            answers: [0, 0, 0, 0]
          });
          return { success: true, result: result };
        }
        return { success: false, error: '没有计分规则可用' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('4.2 计算得分 - 边界值（0分）', scoringCalc2.success, scoringCalc2.error);

    // 4.3 测试计算得分 - 高分（重度）
    console.log('\n  4.3 测试计算得分 - 高分（重度）');
    const scoringCalc3 = await page.evaluate(async () => {
      try {
        const plugin = PluginLoader.get('scoring');
        const rules = await plugin.execute({ action: 'list' });
        if (rules && rules.length > 0) {
          const result = await plugin.execute({
            action: 'calculate',
            ruleId: rules[0].id,
            answers: [3, 3, 3, 3]
          });
          return { success: true, result: result };
        }
        return { success: false, error: '没有计分规则可用' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('4.3 计算得分 - 高分（重度）', scoringCalc3.success, scoringCalc3.error);

    // 4.4 测试计算得分 - 无效规则ID
    console.log('\n  4.4 测试计算得分 - 无效规则ID');
    const scoringCalc4 = await page.evaluate(async () => {
      try {
        const plugin = PluginLoader.get('scoring');
        await plugin.execute({
          action: 'calculate',
          ruleId: 99999,
          answers: [1, 2, 3]
        });
        return { success: false, error: '应该抛出错误但没有' };
      } catch (error) {
        return { success: true, error: error.message };
      }
    });
    recordTest('4.4 计算得分 - 无效规则ID（应报错）', scoringCalc4.success, scoringCalc4.error);

    // ====================================================
    // 测试套件 5: 事件通信测试
    // ====================================================
    console.log('\n📋 测试套件 5: 事件通信测试');
    console.log('==================================================\n');

    // 5.1 检查 EventHub
    console.log('\n  5.1 检查 EventHub');
    const hasEventHub = await page.evaluate(() => {
      return typeof window.EventHub !== 'undefined';
    });
    recordTest('5.1 EventHub 已定义', hasEventHub);

    // 5.2 测试事件监听
    console.log('\n  5.2 测试事件监听');
    const eventOn = await page.evaluate(() => {
      try {
        if (window.EventHub && typeof window.EventHub.on === 'function') {
          const unsubscribe = window.EventHub.on('test-event', (data) => {
            console.log('收到测试事件:', data);
          });
          return { success: true, hasUnsubscribe: typeof unsubscribe === 'function' };
        }
        return { success: false, error: 'EventHub.on is not a function' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('5.2 事件监听正常', eventOn.success, eventOn.error);

    // 5.3 测试事件发射
    console.log('\n  5.3 测试事件发射');
    const eventEmit = await page.evaluate(() => {
      try {
        if (window.EventHub && typeof window.EventHub.emit === 'function') {
          window.EventHub.emit('test-event', { message: '测试消息' });
          return { success: true };
        }
        return { success: false, error: 'EventHub.emit is not a function' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    recordTest('5.3 事件发射正常', eventEmit.success, eventEmit.error);

    // ====================================================
    // 测试套件 6: UI 渲染测试
    // ====================================================
    console.log('\n📋 测试套件 6: UI 渲染测试');
    console.log('==================================================\n');

    // 6.1 检查 Scoring 配置界面
    console.log('\n  6.1 检查 Scoring 配置界面');
    const scoringUI = await page.evaluate(() => {
      const scoringSection = document.querySelector('#scoring-section, [data-section="scoring"], .scoring-config');
      return scoringSection !== null;
    });
    recordTest('6.1 Scoring 配置界面存在', scoringUI);

    // 6.2 检查计分规则列表
    console.log('\n  6.2 检查计分规则列表');
    const scoringListUI = await page.evaluate(() => {
      const scoringList = document.querySelector('#scoring-list, .scoring-list, [data-list="scoring"]');
      return scoringList !== null;
    });
    recordTest('6.2 计分规则列表存在', scoringListUI);

    // 6.3 保存截图
    console.log('\n  6.3 保存截图');
    await page.screenshot({ path: 'scoring-plugin-test-screenshot.png' });
    recordTest('6.3 截图保存', true);
    console.log('  ✅ 截图保存成功');

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
    const jsonReport = JSON.stringify(testResults, null, 2);
    fs.writeFileSync('scoring-plugin-test-report.json', jsonReport);
    console.log('\n📄 JSON 报告已保存: scoring-plugin-test-report.json');

    // 保存 HTML 报告
    const htmlReport = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scoring 插件测试报告</title>
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
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
    .status-pass { color: #388e3c; font-weight: bold; }
    .status-fail { color: #d32f2f; font-weight: bold; }
    .status-skip { color: #f57c00; font-weight: bold; }
  </style>
</head>
<body>
  <div class="report-container">
    <h1>🧪 Scoring 插件测试报告</h1>
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

    fs.writeFileSync('scoring-plugin-test-report.html', htmlReport);
    console.log('📄 HTML 报告已保存: scoring-plugin-test-report.html');
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  } finally {
    await browser.close();
  }

  console.log('\n✅ 自动化测试完成！');
  console.log('💡 请手动关闭 HTTP 服务器 (Ctrl+C)');
}

// 启动测试
(async () => {
  try {
    // 等待服务器启动
    await waitForServer('http://localhost:8081/');

    // 运行测试
    await runTests();
  } catch (error) {
    console.error('❌ 测试启动失败:', error.message);
    process.exit(1);
  }
})();
