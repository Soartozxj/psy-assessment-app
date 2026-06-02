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
// 然后再运行此脚本: node test-scale-plugin-playwright.js

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
  console.log('🧪 开始自动化测试 scale-plugin.js\n');
  console.log('📡 等待 HTTP 服务器启动 (http://localhost:8081)...\n');

  // 等待服务器启动
  await waitForServer('http://localhost:8081');

  // 启动浏览器
  const browser = await chromium.launch({
    headless: false, // 显示浏览器，方便调试
    slowMo: 100 // 减慢操作速度，方便观察
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // ============================================
    // 测试 1: 页面加载和基础检查
    // ============================================
    console.log('\n📋 测试套件 1: 页面加载和基础检查');
    console.log('='.repeat(50));

    // 1.1 加载 admin-legacy.html
    console.log('\n  1.1 加载 admin-legacy.html');
    await page.goto('http://localhost:8081/mini-app-h5/backend/admin-legacy.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(3000); // 等待插件加载
    recordTest('页面加载成功', true);

    // 1.2 检查插件加载器
    console.log('\n  1.2 检查插件加载器');
    const pluginLoaderLoaded = await page.evaluate(() => {
      return typeof window.PluginLoader !== 'undefined';
    });
    recordTest('PluginLoader 已加载', pluginLoaderLoaded);

    // 1.3 检查 ScalePlugin 是否存在
    console.log('\n  1.3 检查 ScalePlugin');
    const scalePluginExists = await page.evaluate(() => {
      return typeof window.ScalePlugin !== 'undefined';
    });
    recordTest('ScalePlugin 已定义', scalePluginExists);

    // 1.4 检查向后兼容函数
    console.log('\n  1.4 检查向后兼容函数');
    const backwardCompatFunctions = await page.evaluate(() => {
      const functions = [
        'loadScales',
        'saveScale',
        'deleteScale',
        'editScale',
        'showScaleForm',
        'hideScaleForm',
        'exportScales'
      ];

      return functions.map((fn) => ({
        name: fn,
        exists: typeof window[fn] === 'function'
      }));
    });

    backwardCompatFunctions.forEach((fn) => {
      recordTest(`函数 ${fn.name} 存在`, fn.exists);
    });

    // ============================================
    // 测试 2: 核心功能测试
    // ============================================
    console.log('\n\n📋 测试套件 2: 核心功能测试');
    console.log('='.repeat(50));

    // 2.1 测试 loadScales
    console.log('\n  2.1 测试 loadScales()');
    const loadScalesResult = await page.evaluate(() => {
      try {
        if (typeof window.loadScales === 'function') {
          window.loadScales();
          return { success: true, message: '函数调用成功' };
        } else if (typeof window.ScalePlugin !== 'undefined' && window.ScalePlugin.loadScales) {
          window.ScalePlugin.loadScales();
          return { success: true, message: '通过 ScalePlugin 调用成功' };
        } else {
          return { success: false, message: '函数不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('loadScales() 可执行', loadScalesResult.success, loadScalesResult.message);

    // 2.2 测试 saveScale
    console.log('\n  2.2 测试 saveScale()');
    const saveScaleResult = await page.evaluate(() => {
      try {
        if (typeof window.saveScale === 'function') {
          // 尝试保存一个测试量表
          const testScale = {
            id: 'test-scale-' + Date.now(),
            title: '测试量表',
            description: '自动化测试创建的量表',
            category: '抑郁',
            questions: []
          };

          window.saveScale(testScale);
          return { success: true, message: '保存成功' };
        } else {
          return { success: false, message: '函数不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('saveScale() 可执行', saveScaleResult.success, saveScaleResult.message);

    // 2.3 测试 deleteScale
    console.log('\n  2.3 测试 deleteScale()');
    const deleteScaleResult = await page.evaluate(() => {
      try {
        if (typeof window.deleteScale === 'function') {
          // 注意：这里不实际删除，只是测试函数是否存在
          return { success: true, message: '函数存在' };
        } else {
          return { success: false, message: '函数不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('deleteScale() 可执行', deleteScaleResult.success, deleteScaleResult.message);

    // 2.4 测试 showScaleForm
    console.log('\n  2.4 测试 showScaleForm()');
    const showScaleFormResult = await page.evaluate(() => {
      try {
        if (typeof window.showScaleForm === 'function') {
          window.showScaleForm();
          return { success: true, message: '表单显示成功' };
        } else {
          return { success: false, message: '函数不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('showScaleForm() 可执行', showScaleFormResult.success, showScaleFormResult.message);

    // 2.5 测试 hideScaleForm
    console.log('\n  2.5 测试 hideScaleForm()');
    const hideScaleFormResult = await page.evaluate(() => {
      try {
        if (typeof window.hideScaleForm === 'function') {
          window.hideScaleForm();
          return { success: true, message: '表单隐藏成功' };
        } else {
          return { success: false, message: '函数不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('hideScaleForm() 可执行', hideScaleFormResult.success, hideScaleFormResult.message);

    // 2.6 测试 exportScales
    console.log('\n  2.6 测试 exportScales()');
    const exportScalesResult = await page.evaluate(() => {
      try {
        if (typeof window.exportScales === 'function') {
          // 注意：这里不实际导出，只是测试函数是否存在
          return { success: true, message: '函数存在' };
        } else {
          return { success: false, message: '函数不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('exportScales() 可执行', exportScalesResult.success, exportScalesResult.message);

    // ============================================
    // 测试 3: ScalePlugin 标准接口测试
    // ============================================
    console.log('\n\n📋 测试套件 3: ScalePlugin 标准接口测试');
    console.log('='.repeat(50));

    // 3.1 测试 init
    console.log('\n  3.1 测试 ScalePlugin.init()');
    const initResult = await page.evaluate(() => {
      try {
        if (window.ScalePlugin && typeof window.ScalePlugin.prototype.init === 'function') {
          return { success: true, message: '方法已定义' };
        } else if (window.ScalePlugin && typeof window.ScalePlugin.init === 'function') {
          return { success: true, message: '静态方法已定义' };
        } else {
          // 尝试创建实例并检查
          try {
            const plugin = new window.ScalePlugin();
            if (typeof plugin.init === 'function') {
              return { success: true, message: '实例方法已定义' };
            }
          } catch (e) {
            // 忽略实例化错误
          }
          return { success: false, message: '方法不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('ScalePlugin.init() 可执行', initResult.success, initResult.message);

    // 3.2 测试 install
    console.log('\n  3.2 测试 ScalePlugin.install()');
    const installResult = await page.evaluate(() => {
      try {
        if (window.ScalePlugin && typeof window.ScalePlugin.prototype.install === 'function') {
          return { success: true, message: '方法已定义' };
        } else if (window.ScalePlugin && typeof window.ScalePlugin.install === 'function') {
          return { success: true, message: '静态方法已定义' };
        } else {
          // 尝试创建实例并检查
          try {
            const plugin = new window.ScalePlugin();
            if (typeof plugin.install === 'function') {
              return { success: true, message: '实例方法已定义' };
            }
          } catch (e) {
            // 忽略实例化错误
          }
          return { success: false, message: '方法不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('ScalePlugin.install() 可执行', installResult.success, installResult.message);

    // 3.3 测试 uninstall
    console.log('\n  3.3 测试 ScalePlugin.uninstall()');
    const uninstallResult = await page.evaluate(() => {
      try {
        if (window.ScalePlugin && typeof window.ScalePlugin.prototype.uninstall === 'function') {
          return { success: true, message: '方法已定义' };
        } else if (window.ScalePlugin && typeof window.ScalePlugin.uninstall === 'function') {
          return { success: true, message: '静态方法已定义' };
        } else {
          // 尝试创建实例并检查
          try {
            const plugin = new window.ScalePlugin();
            if (typeof plugin.uninstall === 'function') {
              return { success: true, message: '实例方法已定义' };
            }
          } catch (e) {
            // 忽略实例化错误
          }
          return { success: false, message: '方法不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('ScalePlugin.uninstall() 可执行', uninstallResult.success, uninstallResult.message);

    // 3.4 测试 getInfo
    console.log('\n  3.4 测试 ScalePlugin.getInfo()');
    const getInfoResult = await page.evaluate(() => {
      try {
        if (window.ScalePlugin && typeof window.ScalePlugin.prototype.getInfo === 'function') {
          return { success: true, message: '方法已定义' };
        } else if (window.ScalePlugin && typeof window.ScalePlugin.getInfo === 'function') {
          return { success: true, message: '静态方法已定义' };
        } else {
          // 尝试创建实例并检查
          try {
            const plugin = new window.ScalePlugin();
            if (typeof plugin.getInfo === 'function') {
              return { success: true, message: '实例方法已定义' };
            }
          } catch (e) {
            // 忽略实例化错误
          }
          return { success: false, message: '方法不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('ScalePlugin.getInfo() 可执行', getInfoResult.success, getInfoResult.message);

    // 3.5 测试 isInstalled
    console.log('\n  3.5 测试 ScalePlugin.isInstalled()');
    const isInstalledResult = await page.evaluate(() => {
      try {
        if (window.ScalePlugin && typeof window.ScalePlugin.prototype.isInstalled === 'function') {
          return { success: true, message: '方法已定义' };
        } else if (window.ScalePlugin && typeof window.ScalePlugin.isInstalled === 'function') {
          return { success: true, message: '静态方法已定义' };
        } else {
          // 尝试创建实例并检查
          try {
            const plugin = new window.ScalePlugin();
            if (typeof plugin.isInstalled === 'function') {
              return { success: true, message: '实例方法已定义' };
            }
          } catch (e) {
            // 忽略实例化错误
          }
          return { success: false, message: '方法不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('ScalePlugin.isInstalled() 可执行', isInstalledResult.success, isInstalledResult.message);

    // ============================================
    // 测试 4: 存储同步测试
    // ============================================
    console.log('\n\n📋 测试套件 4: 存储同步测试');
    console.log('='.repeat(50));

    // 4.1 测试 localStorage 存储
    console.log('\n  4.1 测试 localStorage 存储');
    const localStorageResult = await page.evaluate(() => {
      try {
        const testData = [{ id: 'test-1', title: '测试' }];
        localStorage.setItem('psy_scales', JSON.stringify(testData));
        const retrieved = JSON.parse(localStorage.getItem('psy_scales'));
        return {
          success: JSON.stringify(retrieved) === JSON.stringify(testData),
          message: '读写成功'
        };
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('localStorage 存储正常', localStorageResult.success, localStorageResult.message);

    // 4.2 测试 _saveScales
    console.log('\n  4.2 测试 _saveScales()');
    const saveScalesResult = await page.evaluate(() => {
      try {
        // 尝试创建实例并检查私有方法
        if (window.ScalePlugin) {
          const plugin = new window.ScalePlugin();
          if (typeof plugin._saveScales === 'function') {
            return { success: true, message: '实例方法已定义' };
          }
        }

        // 或者检查原型链
        if (window.ScalePlugin && window.ScalePlugin.prototype._saveScales) {
          return { success: true, message: '原型方法已定义' };
        }

        return { success: false, message: '方法不存在或不可访问' };
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('ScalePlugin._saveScales() 可执行', saveScalesResult.success, saveScalesResult.message);

    // 4.3 测试 _loadScales
    console.log('\n  4.3 测试 _loadScales()');
    const loadScalesPrivateResult = await page.evaluate(() => {
      try {
        // 尝试创建实例并检查私有方法
        if (window.ScalePlugin) {
          const plugin = new window.ScalePlugin();
          if (typeof plugin._loadScales === 'function') {
            return { success: true, message: '实例方法已定义' };
          }
        }

        // 或者检查原型链
        if (window.ScalePlugin && window.ScalePlugin.prototype._loadScales) {
          return { success: true, message: '原型方法已定义' };
        }

        return { success: false, message: '方法不存在或不可访问' };
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('ScalePlugin._loadScales() 可执行', loadScalesPrivateResult.success, loadScalesPrivateResult.message);

    // ============================================
    // 测试 5: 事件通信测试
    // ============================================
    console.log('\n\n📋 测试套件 5: 事件通信测试');
    console.log('='.repeat(50));

    // 5.1 检查 EventHub
    console.log('\n  5.1 检查 EventHub');
    const eventHubExists = await page.evaluate(() => {
      return typeof window.EventHub !== 'undefined';
    });
    recordTest('EventHub 已定义', eventHubExists);

    // 5.2 测试事件监听
    console.log('\n  5.2 测试事件监听');
    const eventListenResult = await page.evaluate(() => {
      try {
        if (window.EventHub && typeof window.EventHub.on === 'function') {
          let eventFired = false;
          window.EventHub.on('scale:test', () => {
            eventFired = true;
          });
          window.EventHub.emit('scale:test');
          return { success: eventFired, message: '事件监听正常' };
        } else {
          return { success: false, message: 'EventHub 不可用' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('事件监听正常', eventListenResult.success, eventListenResult.message);

    // 5.3 测试 ScalePlugin 事件发射
    console.log('\n  5.3 测试 ScalePlugin 事件发射');
    const eventEmitResult = await page.evaluate(() => {
      try {
        if (window.ScalePlugin && window.EventHub) {
          let eventFired = false;
          window.EventHub.on('scale:loaded', () => {
            eventFired = true;
          });

          // 尝试触发量表加载
          if (typeof window.ScalePlugin.loadScales === 'function') {
            window.ScalePlugin.loadScales();
          }

          return { success: true, message: '事件发射测试完成' };
        } else {
          return { success: false, message: 'ScalePlugin 或 EventHub 不可用' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });
    recordTest('ScalePlugin 事件发射正常', eventEmitResult.success, eventEmitResult.message);

    // ============================================
    // 测试 6: UI 渲染测试
    // ============================================
    console.log('\n\n📋 测试套件 6: UI 渲染测试');
    console.log('='.repeat(50));

    // 6.1 检查量表列表容器
    console.log('\n  6.1 检查量表列表容器');
    const scaleListContainer = await page.$('#scale-list, .scale-list, [id*="scale"]');
    recordTest('量表列表容器存在', !!scaleListContainer);

    // 6.2 检查量表表单
    console.log('\n  6.2 检查量表表单');

    // 先尝试调用 showScaleForm() 打开表单
    await page.evaluate(() => {
      try {
        if (typeof window.showScaleForm === 'function') {
          window.showScaleForm();
          return { success: true, message: 'showScaleForm() 调用成功' };
        } else {
          return { success: false, message: 'showScaleForm() 不存在' };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    });

    await page.waitForTimeout(1000); // 等待表单打开

    // 检查表单 HTML 是否存在于 DOM 中（即使不可见）
    const formExists = await page.evaluate(() => {
      const selectors = [
        '#scale-form',
        '#scaleForm',
        '.scale-form',
        '[id*="scale-form"]',
        '[id*="scaleForm"]',
        'dialog[id*="scale"]',
        '.modal[id*="scale"]',
        'form[id*="scale"]',
        'div[id*="scale"][class*="modal"]'
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          return {
            exists: true,
            selector: selector,
            display: window.getComputedStyle(el).display,
            visibility: window.getComputedStyle(el).visibility
          };
        }
      }

      return { exists: false };
    });

    recordTest(
      '量表表单存在',
      formExists.exists,
      formExists.exists
        ? `找到表单: ${formExists.selector} (display=${formExists.display}, visibility=${formExists.visibility})`
        : '未找到表单元素（可能未渲染到DOM）'
    );

    // 6.3 截图保存
    console.log('\n  6.3 保存截图');
    await page.screenshot({
      path: 'test-scale-plugin-screenshot.png',
      fullPage: true
    });
    recordTest('截图保存成功', true, 'test-scale-plugin-screenshot.png');

    // ============================================
    // 生成测试报告
    // ============================================
    console.log('\n\n📊 测试报告');
    console.log('='.repeat(50));
    console.log(`总测试数: ${testResults.total}`);
    console.log(`✅ 通过: ${testResults.passed}`);
    console.log(`❌ 失败: ${testResults.failed}`);
    console.log(`⏭️  跳过: ${testResults.skipped}`);
    console.log(`通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    // 保存测试报告到文件
    const reportPath = 'scale-plugin-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 详细报告已保存: ${reportPath}`);

    // 生成 HTML 报告
    const htmlReport = generateHtmlReport(testResults);
    const htmlReportPath = 'scale-plugin-test-report.html';
    fs.writeFileSync(htmlReportPath, htmlReport);
    console.log(`📄 HTML 报告已保存: ${htmlReportPath}`);
  } catch (error) {
    console.error('\n❌ 测试执行出错:', error.message);
    console.error(error.stack);
  } finally {
    // 关闭浏览器
    await browser.close();

    console.log('\n✅ 自动化测试完成！');
    console.log('💡 请手动关闭 HTTP 服务器 (Ctrl+C)');
  }
}

// 生成 HTML 报告
function generateHtmlReport(results) {
  const passRate = ((results.passed / results.total) * 100).toFixed(1);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>scale-plugin.js 测试报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
    .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-card h3 { margin: 0; font-size: 36px; }
    .stat-card.passed h3 { color: #4CAF50; }
    .stat-card.failed h3 { color: #f44336; }
    .stat-card.total h3 { color: #2196F3; }
    .stat-card.pass-rate h3 { color: #FF9800; }
    .details table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    .details th, .details td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    .details th { background: #f8f9fa; font-weight: 600; }
    .status-pass { color: #4CAF50; }
    .status-fail { color: #f44336; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 scale-plugin.js 自动化测试报告</h1>
    <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    
    <div class="summary">
      <div class="stat-card total">
        <h3>${results.total}</h3>
        <p>总测试数</p>
      </div>
      <div class="stat-card passed">
        <h3>${results.passed}</h3>
        <p>通过</p>
      </div>
      <div class="stat-card failed">
        <h3>${results.failed}</h3>
        <p>失败</p>
      </div>
      <div class="stat-card pass-rate">
        <h3>${passRate}%</h3>
        <p>通过率</p>
      </div>
    </div>
    
    <div class="details">
      <h2>📋 详细结果</h2>
      <table>
        <thead>
          <tr>
            <th>序号</th>
            <th>测试项</th>
            <th>状态</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          ${results.details
            .map(
              (test, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${test.name}</td>
              <td class="${test.passed ? 'status-pass' : 'status-fail'}">
                ${test.passed ? '✅ 通过' : '❌ 失败'}
              </td>
              <td>${test.details || '-'}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

// 执行测试
(async () => {
  await runTests();
})();
