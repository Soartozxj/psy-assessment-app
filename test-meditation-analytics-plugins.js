const { chromium } = require('playwright');
const fs = require('fs');

async function testMeditationAndAnalyticsPlugins() {
  console.log('🧪 开始Meditation + Analytics插件验证...');

  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1400,900']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // 初始化所有结果变量（避免变量作用域问题）
  const meditationPluginExists = false;
  const meditationLoadResult = { success: false, error: '未执行加载' };
  const meditationExecuteResult = { success: false, error: '未执行' };

  const analyticsPluginExists = false;
  const analyticsLoadResult = { success: false, error: '未执行加载' };
  const analyticsExecuteResult = { success: false, error: '未执行' };

  try {
    // ==================== 测试1: Meditation插件验证 ====================
    console.log('\n📊 ========== 测试1: Meditation插件验证 ==========');

    // 访问管理页面
    console.log('📂 访问管理页面...');
    await page.goto('http://localhost:8000/mini-app-h5/backend/admin-legacy.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 等待页面加载完成
    await page.waitForTimeout(5000);

    console.log('✅ 管理页面加载完成');

    // 初始化结果变量
    let meditationPluginExists = false;
    let meditationLoadResult = { success: false, error: '未执行加载' };
    let meditationExecuteResult = { success: false, error: '未执行' };

    // 检查Meditation插件是否存在
    console.log('🔍 检查Meditation插件文件...');
    meditationPluginExists = await page.evaluate(() => {
      // 检查插件文件是否存在
      return fetch('/mini-app-h5/backend/plugins/optional/meditation-plugin.js')
        .then((response) => response.ok)
        .catch(() => false);
    });

    if (!meditationPluginExists) {
      console.log('⚠️ Meditation插件文件不存在，跳过验证');
      meditationLoadResult = { success: false, error: '插件文件不存在' };
    } else {
      console.log('✅ Meditation插件文件存在');

      // 尝试加载Meditation插件
      console.log('📦 尝试加载Meditation插件...');
      meditationLoadResult = await page.evaluate(async () => {
        try {
          await window.PluginLoader.load('meditation', false);
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const plugin = window.PluginLoader.get('meditation');
          if (plugin) {
            return { success: true, version: plugin.version, name: plugin.name };
          } else {
            return { success: false, error: '插件加载后未找到实例' };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      if (meditationLoadResult.success) {
        console.log(`✅ Meditation插件加载成功: ${meditationLoadResult.name} v${meditationLoadResult.version}`);

        // 测试插件执行
        console.log('🎯 测试Meditation插件执行...');
        meditationExecuteResult = await page.evaluate(async () => {
          try {
            const result = await window.PluginLoader.execute('meditation', { action: 'list' });
            return { success: true, result: result };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });

        if (meditationExecuteResult.success) {
          console.log('✅ Meditation插件执行成功');
          console.log(`   返回数据: ${JSON.stringify(meditationExecuteResult.result).substring(0, 100)}...`);
        } else {
          console.log(`❌ Meditation插件执行失败: ${meditationExecuteResult.error}`);
        }
      } else {
        console.log(`❌ Meditation插件加载失败: ${meditationLoadResult.error}`);
      }
    }

    // ==================== 测试2: Analytics插件验证 ====================
    console.log('\n📊 ========== 测试2: Analytics插件验证 ==========');

    // 初始化结果变量
    let analyticsPluginExists = false;
    let analyticsLoadResult = { success: false, error: '未执行加载' };
    let analyticsExecuteResult = { success: false, error: '未执行' };

    // 检查Analytics插件是否存在
    console.log('🔍 检查Analytics插件文件...');
    analyticsPluginExists = await page.evaluate(() => {
      return fetch('/mini-app-h5/backend/plugins/optional/analytics-plugin.js')
        .then((response) => response.ok)
        .catch(() => false);
    });

    if (!analyticsPluginExists) {
      console.log('⚠️ Analytics插件文件不存在，跳过验证');
      analyticsLoadResult = { success: false, error: '插件文件不存在' };
    } else {
      console.log('✅ Analytics插件文件存在');

      // 尝试加载Analytics插件
      console.log('📦 尝试加载Analytics插件...');
      analyticsLoadResult = await page.evaluate(async () => {
        try {
          await window.PluginLoader.load('analytics', false);
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const plugin = window.PluginLoader.get('analytics');
          if (plugin) {
            return { success: true, version: plugin.version, name: plugin.name };
          } else {
            return { success: false, error: '插件加载后未找到实例' };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      if (analyticsLoadResult.success) {
        console.log(`✅ Analytics插件加载成功: ${analyticsLoadResult.name} v${analyticsLoadResult.version}`);

        // 测试插件执行
        console.log('🎯 测试Analytics插件执行...');
        analyticsExecuteResult = await page.evaluate(async () => {
          try {
            const result = await window.PluginLoader.execute('analytics', { action: 'getStats' });
            return { success: true, result: result };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });

        if (analyticsExecuteResult.success) {
          console.log('✅ Analytics插件执行成功');
          console.log(`   返回数据: ${JSON.stringify(analyticsExecuteResult.result).substring(0, 100)}...`);
        } else {
          console.log(`❌ Analytics插件执行失败: ${analyticsExecuteResult.error}`);
        }
      } else {
        console.log(`❌ Analytics插件加载失败: ${analyticsLoadResult.error}`);
      }
    }

    // ==================== 测试3: 插件冲突检查 ====================
    console.log('\n📊 ========== 测试3: 插件冲突检查 ==========');

    const conflictCheck = await page.evaluate(() => {
      const plugins = window.PluginLoader.getPluginsInfo();
      const pluginNames = plugins.map((p) => p.name);

      // 检查是否有重复插件
      const duplicates = pluginNames.filter((name, index) => pluginNames.indexOf(name) !== index);

      // 检查插件依赖关系
      const dependencyIssues = [];

      // 检查Meditation和Analytics插件是否正常共存
      const hasMeditation = pluginNames.includes('meditation');
      const hasAnalytics = pluginNames.includes('analytics');

      return {
        totalPlugins: plugins.length,
        pluginNames: pluginNames,
        duplicates: duplicates,
        hasMeditation: hasMeditation,
        hasAnalytics: hasAnalytics,
        conflictDetected: duplicates.length > 0
      };
    });

    console.log(`📊 已加载插件总数: ${conflictCheck.totalPlugins}`);
    console.log(`📊 插件列表: ${conflictCheck.pluginNames.join(', ')}`);

    if (conflictCheck.conflictDetected) {
      console.log(`❌ 检测到插件冲突: ${conflictCheck.duplicates.join(', ')}`);
    } else {
      console.log('✅ 未检测到插件冲突');
    }

    if (conflictCheck.hasMeditation && conflictCheck.hasAnalytics) {
      console.log('✅ Meditation和Analytics插件可正常共存');
    }

    // ==================== 生成验证报告 ====================
    console.log('\n📊 ========== 生成验证报告 ==========');

    const report = {
      testDate: new Date().toLocaleDateString(),
      testTime: new Date().toLocaleTimeString(),
      testVersion: 'Meditation + Analytics 插件验证 v1.0.0',
      results: {
        meditationPlugin: {
          exists: meditationPluginExists,
          loaded: meditationLoadResult ? meditationLoadResult.success : false,
          executed: meditationExecuteResult ? meditationExecuteResult.success : false,
          error: meditationLoadResult ? meditationLoadResult.error : null
        },
        analyticsPlugin: {
          exists: analyticsPluginExists,
          loaded: analyticsLoadResult ? analyticsLoadResult.success : false,
          executed: analyticsExecuteResult ? analyticsExecuteResult.success : false,
          error: analyticsLoadResult ? analyticsLoadResult.error : null
        },
        conflictCheck: conflictCheck
      },
      summary: {
        totalTests: 3,
        passedTests: 0,
        failedTests: 0,
        passRate: 0
      }
    };

    // 计算通过率
    let passedTests = 0;
    if (report.results.meditationPlugin.exists && report.results.meditationPlugin.loaded) {
      passedTests++;
    }
    if (report.results.analyticsPlugin.exists && report.results.analyticsPlugin.loaded) {
      passedTests++;
    }
    if (!report.results.conflictCheck.conflictDetected) {
      passedTests++;
    }

    report.summary.passedTests = passedTests;
    report.summary.failedTests = report.summary.totalTests - passedTests;
    report.summary.passRate = ((passedTests / report.summary.totalTests) * 100).toFixed(2);

    console.log(`📊 验证结果: ${passedTests}/${report.summary.totalTests} 通过 (${report.summary.passRate}%)`);

    // 保存报告
    const reportPath = `/Users/rich/WorkBuddy/20260407113106/Meditation+Analytics插件验证报告_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 验证报告已保存: ${reportPath}`);

    // 截图
    await page.screenshot({
      path: '/Users/rich/WorkBuddy/20260407113106/meditation-analytics-verification-screenshot.png',
      fullPage: true
    });
    console.log('📸 验证截图已保存: meditation-analytics-verification-screenshot.png');

    return report;
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// 执行验证
testMeditationAndAnalyticsPlugins()
  .then((report) => {
    console.log('\n✅ Meditation + Analytics插件验证完成');

    if (report.summary.passRate === '100.00') {
      console.log('🎉 所有验证通过，插件可以上线！');
    } else if (report.summary.passRate >= '80.00') {
      console.log('⚠️ 大部分验证通过，建议修复问题后上线');
    } else {
      console.log('❌ 验证通过率较低，需要修复后重新验证');
    }

    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Meditation + Analytics插件验证失败:', error);
    process.exit(1);
  });
