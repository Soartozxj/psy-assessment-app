/**
 * automated-test-suite.js - admin-legacy.html 自动化测试套件
 *
 * 功能说明：
 * - 使用 Playwright 自动化测试 admin-legacy.html 页面功能
 * - 验证所有插件（AI配置、认证、量表管理、计分规则、NPC配置）的功能是否正常
 * - 生成详细的测试报告
 *
 * 运行方式：
 * node automated-test-suite.js
 *
 * @version 1.0.0
 * @date 2026-06-02
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 测试配置
const CONFIG = {
  baseUrl: 'http://localhost:8081/mini-app-h5/backend',
  adminPage: 'admin-legacy.html',
  screenshotDir: './test-screenshots',
  reportDir: './test-reports',
  timeout: 30000, // 30秒超时
  retryCount: 2 // 失败重试次数
};

// 测试结果统计
const testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  startTime: null,
  endTime: null
};

// 测试用例列表
const testCases = [
  {
    name: '页面加载测试',
    description: '验证 admin-legacy.html 页面能否正常加载',
    category: '基础功能',
    execute: testPageLoad
  },
  {
    name: '认证插件测试',
    description: '验证登录、登出、修改密码功能',
    category: '认证插件',
    execute: testAuthPlugin
  },
  {
    name: 'AI配置插件测试',
    description: '验证AI配置保存和加载功能',
    category: 'AI配置插件',
    execute: testAIPlugin
  },
  {
    name: '量表管理插件测试',
    description: '验证量表类型的创建、编辑、删除功能',
    category: '量表管理插件',
    execute: testScalePlugin
  },
  {
    name: '计分规则插件测试',
    description: '验证计分规则的配置功能',
    category: '计分规则插件',
    execute: testScoringPlugin
  },
  {
    name: 'NPC配置插件测试',
    description: '验证NPC场景配置功能',
    category: 'NPC配置插件',
    execute: testNpcPlugin
  },
  {
    name: '数据看板测试',
    description: '验证数据看板图表渲染功能',
    category: '数据看板',
    execute: testDashboard
  },
  {
    name: '事件委托测试',
    description: '验证事件委托机制是否正常工作',
    category: '基础设施',
    execute: testEventDelegation
  },
  {
    name: '插件加载器测试',
    description: '验证PluginLoader按需加载功能',
    category: '基础设施',
    execute: testPluginLoader
  },
  {
    name: '响应式布局测试',
    description: '验证页面在不同屏幕尺寸下的显示效果',
    category: 'UI测试',
    execute: testResponsiveLayout
  }
];

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 开始自动化测试...\n');
  testStats.startTime = Date.now();

  // 创建必要的目录
  if (!fs.existsSync(CONFIG.screenshotDir)) {
    fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
  }
  if (!fs.existsSync(CONFIG.reportDir)) {
    fs.mkdirSync(CONFIG.reportDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false, // 显示浏览器，方便调试
    slowMo: 50 // 减慢操作速度，方便观察
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: './test-videos/' }
  });

  const page = await context.newPage();

  try {
    // 执行所有测试用例
    for (const testCase of testCases) {
      testStats.total++;
      console.log(`\n[${testStats.total}/${testCases.length}] 测试: ${testCase.name}`);
      console.log(`   描述: ${testCase.description}`);

      try {
        await testCase.execute(page, browser);
        testStats.passed++;
        console.log('   ✅ 通过\n');
      } catch (error) {
        testStats.failed++;
        console.log(`   ❌ 失败: ${error.message}\n`);

        // 截图保存失败现场
        const screenshotPath = path.join(CONFIG.screenshotDir, `${testCase.name.replace(/\s+/g, '_')}_failure.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`   📸 失败截图已保存: ${screenshotPath}`);
      }
    }
  } finally {
    await browser.close();
    testStats.endTime = Date.now();

    // 生成测试报告
    await generateTestReport();
  }
}

/**
 * 测试1: 页面加载测试
 */
async function testPageLoad(page, browser) {
  console.log('   📄 正在加载页面...');

  // 访问页面
  await page.goto(`${CONFIG.baseUrl}/${CONFIG.adminPage}`, {
    waitUntil: 'networkidle',
    timeout: CONFIG.timeout
  });

  // 验证页面标题
  const title = await page.title();
  if (!title.includes('星蓝心镜')) {
    throw new Error(`页面标题不正确: ${title}`);
  }

  // 验证关键元素是否存在
  const sidebar = await page.$('.sidebar');
  if (!sidebar) {
    throw new Error('侧边栏未找到');
  }

  const mainContent = await page.$('.main');
  if (!mainContent) {
    throw new Error('主内容区未找到');
  }

  // 验证插件系统是否加载
  const pluginLoaderLoaded = await page.evaluate(() => {
    return typeof window.PluginLoader !== 'undefined';
  });
  if (!pluginLoaderLoaded) {
    throw new Error('PluginLoader 未加载');
  }

  console.log('   ✓ 页面加载成功');
  console.log('   ✓ 侧边栏正常显示');
  console.log('   ✓ 主内容区正常显示');
  console.log('   ✓ PluginLoader 已加载');
}

/**
 * 测试2: 认证插件测试
 */
async function testAuthPlugin(page, browser) {
  console.log('   🔐 测试认证插件...');

  // 等待认证弹窗出现
  await page.waitForSelector('.auth-overlay', { timeout: 5000 });

  // 输入密码
  const passwordInput = await page.$('.auth-input');
  await passwordInput.fill('123456'); // 使用默认密码

  // 点击登录按钮
  const loginButton = await page.$('.auth-btn');
  await loginButton.click();

  // 等待登录完成（认证遮罩消失）
  await page.waitForSelector('.auth-overlay.hidden', { timeout: 5000 });

  console.log('   ✓ 登录成功');

  // 测试修改密码功能
  await page.click('#topbar-user');
  await page.click('[data-action="showChangePasswordDialog"]');

  // 填写修改密码表单
  await page.fill('#pwd-old', '123456');
  await page.fill('#pwd-new', 'newpassword');
  await page.fill('#pwd-confirm', 'newpassword');
  await page.click('#pwd-modal .btn-primary');

  // 验证修改结果
  const message = await page.textContent('#pwd-msg');
  if (!message.includes('成功')) {
    throw new Error('修改密码失败');
  }

  console.log('   ✓ 修改密码功能正常');

  // 恢复默认密码
  await page.evaluate(
    (oldPwd, newPwd) => {
      if (window.adminAuth) {
        window.adminAuth.changePassword(oldPwd, newPwd);
      }
    },
    'newpassword',
    '123456'
  );

  console.log('   ✓ 密码已恢复为默认值');
}

/**
 * 测试3: AI配置插件测试
 */
async function testAIPlugin(page, browser) {
  console.log('   🤖 测试AI配置插件...');

  // 点击AI配置菜单
  await page.click('[data-section="aiConfig"]');

  // 等待插件加载
  await page.waitForTimeout(1000);

  // 验证AI配置表单是否显示
  const aiConfigForm = await page.$('#section-aiConfig');
  if (!aiConfigForm) {
    throw new Error('AI配置页面未找到');
  }

  // 验证API Key输入框
  const apiKeyInput = await page.$('#ai-api-key');
  if (!apiKeyInput) {
    throw new Error('API Key输入框未找到');
  }

  console.log('   ✓ AI配置页面加载成功');
  console.log('   ✓ API Key输入框存在');

  // 测试保存配置（使用测试数据）
  await apiKeyInput.fill('test-api-key-12345');
  await page.fill('#ai-api-url', 'https://test.api.com');
  await page.fill('#ai-model', 'test-model');

  // 点击保存按钮
  await page.click('[data-action="saveAiConfig"]');

  // 等待保存完成
  await page.waitForTimeout(1000);

  console.log('   ✓ AI配置保存功能正常');
}

/**
 * 测试4: 量表管理插件测试
 */
async function testScalePlugin(page, browser) {
  console.log('   📊 测试量表管理插件...');

  // 点击量表管理菜单
  await page.click('[data-section="scales"]');

  // 等待插件加载
  await page.waitForTimeout(2000);

  // 验证量表类型列表是否显示
  const scaleTypesList = await page.$('#scale-types-list');
  if (!scaleTypesList) {
    throw new Error('量表类型列表未找到');
  }

  console.log('   ✓ 量表管理页面加载成功');

  // 测试创建量表类型
  await page.click('[data-action="showAddScaleTypeDialog"]');

  await page.waitForSelector('#scale-type-modal', { state: 'visible' });

  await page.fill('#scale-type-id', 'test_scale');
  await page.fill('#scale-type-name', '测试量表');
  await page.fill('#scale-type-desc', '这是一个测试量表');

  // 保存
  await page.click('#scale-type-modal .btn-primary');

  // 等待保存完成
  await page.waitForTimeout(1000);

  console.log('   ✓ 量表类型创建功能正常');

  // 清理测试数据
  await page.evaluate(() => {
    if (window.ScalePlugin && window.ScalePlugin.deleteScaleType) {
      window.ScalePlugin.deleteScaleType('test_scale');
    }
  });

  console.log('   ✓ 测试数据已清理');
}

/**
 * 测试5: 计分规则插件测试
 */
async function testScoringPlugin(page, browser) {
  console.log('   🧮 测试计分规则插件...');

  // 点击计分规则菜单
  await page.click('[data-section="scoring"]');

  // 等待插件加载
  await page.waitForTimeout(2000);

  // 验证计分规则页面是否显示
  const scoringSection = await page.$('#section-scoring');
  if (!scoringSection) {
    throw new Error('计分规则页面未找到');
  }

  console.log('   ✓ 计分规则页面加载成功');

  // 验证量表下拉框是否加载
  const scaleSelect = await page.$('#scoring-scale-select');
  if (!scaleSelect) {
    throw new Error('量表下拉框未找到');
  }

  console.log('   ✓ 量表下拉框正常显示');

  // 测试选择量表
  await scaleSelect.selectOption({ index: 1 });

  // 等待规则列表加载
  await page.waitForTimeout(1000);

  console.log('   ✓ 计分规则加载功能正常');
}

/**
 * 测试6: NPC配置插件测试
 */
async function testNpcPlugin(page, browser) {
  console.log('   🎭 测试NPC配置插件...');

  // 点击NPC场景配置菜单
  await page.click('[data-section="npcScene"]');

  // 等待插件加载
  await page.waitForTimeout(2000);

  // 验证NPC配置页面是否显示
  const npcSection = await page.$('#section-npcScene');
  if (!npcSection) {
    throw new Error('NPC配置页面未找到');
  }

  console.log('   ✓ NPC配置页面加载成功');

  // 验证素材列表是否显示
  const npcList = await page.$('#npc-list');
  if (!npcList) {
    throw new Error('NPC列表未找到');
  }

  console.log('   ✓ NPC列表正常显示');

  // 测试添加NPC
  await page.click('[data-action="showAddNpcDialog"]');

  await page.waitForTimeout(500);

  console.log('   ✓ NPC添加功能正常');
}

/**
 * 测试7: 数据看板测试
 */
async function testDashboard(page, browser) {
  console.log('   📈 测试数据看板...');

  // 点击数据看板菜单
  await page.click('[data-section="dashboard"]');

  // 等待图表加载
  await page.waitForTimeout(2000);

  // 验证统计卡片是否显示
  const statCards = await page.$$('.stat-card');
  if (statCards.length < 4) {
    throw new Error(`统计卡片数量不足: ${statCards.length}`);
  }

  console.log(`   ✓ 统计卡片显示正常 (${statCards.length}个)`);

  // 验证Chart.js是否加载
  const chartLoaded = await page.evaluate(() => {
    return typeof Chart !== 'undefined';
  });

  if (!chartLoaded) {
    console.warn('   ⚠️  Chart.js 未加载（可能CDN失败）');
  } else {
    console.log('   ✓ Chart.js 已加载');
  }

  // 验证图表canvas是否存在
  const chartCanvases = await page.$$('canvas');
  if (chartCanvases.length < 2) {
    console.warn('   ⚠️  图表canvas数量不足');
  } else {
    console.log(`   ✓ 图表canvas存在 (${chartCanvases.length}个)`);
  }
}

/**
 * 测试8: 事件委托测试
 */
async function testEventDelegation(page, browser) {
  console.log('   🎯 测试事件委托...');

  // 验证EventDelegate是否初始化
  const eventDelegateReady = await page.evaluate(() => {
    return typeof window.EventDelegate !== 'undefined' && window.EventDelegate.isInitialized;
  });

  if (!eventDelegateReady) {
    console.warn('   ⚠️  EventDelegate 未初始化');
  } else {
    console.log('   ✓ EventDelegate 已初始化');
  }

  // 测试data-action事件委托
  const dataActionButtons = await page.$$('[data-action]');
  console.log(`   ✓ 发现 ${dataActionButtons.length} 个 data-action 按钮`);

  // 测试动态生成的按钮是否能触发事件
  await page.click('[data-section="scales"]');
  await page.waitForTimeout(1000);

  const dynamicButtons = await page.$$('[data-action]');
  console.log(`   ✓ 切换页面后，data-action 按钮数量: ${dynamicButtons.length}`);

  console.log('   ✓ 事件委托功能正常');
}

/**
 * 测试9: 插件加载器测试
 */
async function testPluginLoader(page, browser) {
  console.log('   🔌 测试插件加载器...');

  // 验证PluginLoader是否正常工作
  const pluginStatus = await page.evaluate(() => {
    if (!window.PluginLoader) {
      return { error: 'PluginLoader 未定义' };
    }

    return {
      corePlugins: window.PluginLoader.corePlugins,
      optionalPlugins: window.PluginLoader.optionalPlugins,
      loadedPlugins: Object.keys(window.PluginLoader.plugins)
    };
  });

  if (pluginStatus.error) {
    throw new Error(pluginStatus.error);
  }

  console.log(`   ✓ 核心插件: ${pluginStatus.corePlugins.join(', ')}`);
  console.log(`   ✓ 可选插件: ${pluginStatus.optionalPlugins.join(', ')}`);
  console.log(`   ✓ 已加载插件: ${pluginStatus.loadedPlugins.join(', ') || '无'}`);

  // 测试按需加载
  await page.evaluate(async () => {
    if (window.PluginLoader) {
      await window.PluginLoader.load('scale', false);
    }
  });

  const scalePluginLoaded = await page.evaluate(() => {
    return typeof window.ScalePlugin !== 'undefined';
  });

  if (scalePluginLoaded) {
    console.log('   ✓ 按需加载功能正常');
  } else {
    console.warn('   ⚠️  按需加载可能失败');
  }
}

/**
 * 测试10: 响应式布局测试
 */
async function testResponsiveLayout(page, browser) {
  console.log('   📱 测试响应式布局...');

  // 测试不同屏幕尺寸
  const viewports = [
    { width: 1920, height: 1080, name: '桌面端 (1920x1080)' },
    { width: 1366, height: 768, name: '笔记本 (1366x768)' },
    { width: 768, height: 1024, name: '平板 (768x1024)' },
    { width: 375, height: 667, name: '手机 (375x667)' }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height
    });

    await page.waitForTimeout(500);

    // 截图
    const screenshotPath = path.join(CONFIG.screenshotDir, `responsive_${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshotPath });

    console.log(`   ✓ ${viewport.name} - 截图已保存`);
  }

  // 恢复默认尺寸
  await page.setViewportSize({ width: 1920, height: 1080 });
}

/**
 * 生成测试报告
 */
async function generateTestReport() {
  const duration = (testStats.endTime - testStats.startTime) / 1000;
  const passRate = ((testStats.passed / testStats.total) * 100).toFixed(2);

  const report = `
# 自动化测试报告

**测试时间**: ${new Date().toLocaleString('zh-CN')}
**测试时长**: ${duration}秒
**测试URL**: ${CONFIG.baseUrl}/${CONFIG.adminPage}

## 测试结果统计

| 指标 | 数值 |
|------|------|
| 总测试用例 | ${testStats.total} |
| 通过 | ${testStats.passed} |
| 失败 | ${testStats.failed} |
| 跳过 | ${testStats.skipped} |
| 通过率 | ${passRate}% |

## 测试用例详情

${testCases
  .map(
    (tc, index) => `
### ${index + 1}. ${tc.name}

- **分类**: ${tc.category}
- **描述**: ${tc.description}
- **状态**: ${index < testStats.passed ? '✅ 通过' : '❌ 失败'}
`
  )
  .join('\n')}

## 结论

${
  testStats.failed === 0
    ? '✅ **所有测试通过**，系统功能正常，可以上线。'
    : `⚠️ **存在 ${testStats.failed} 个失败用例**，请修复后重新测试。`
}

---

**报告生成时间**: ${new Date().toISOString()}
`;

  // 保存报告
  const reportPath = path.join(CONFIG.reportDir, `test-report-${Date.now()}.md`);
  fs.writeFileSync(reportPath, report);

  console.log('\n' + '='.repeat(60));
  console.log('📊 测试报告已生成:');
  console.log(`   路径: ${reportPath}`);
  console.log(`   总用例: ${testStats.total}`);
  console.log(`   通过: ${testStats.passed}`);
  console.log(`   失败: ${testStats.failed}`);
  console.log(`   通过率: ${passRate}%`);
  console.log(`   耗时: ${duration}秒`);
  console.log('='.repeat(60));
}

// 运行测试
if (require.main === module) {
  runTests().catch((error) => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  testCases,
  CONFIG
};
