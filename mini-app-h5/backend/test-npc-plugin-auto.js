/**
 * test-npc-plugin-auto.js - npc-plugin 自动化测试脚本
 *
 * 测试内容：
 * 1. 插件加载测试
 * 2. list action 测试
 * 3. get action 测试
 * 4. switch-tab action 测试
 * 5. render action 测试
 * 6. add-counselor action 测试
 * 7. set-default-counselor action 测试
 * 8. 选项管理测试
 * 9. 配置保存测试
 * 10. 云端同步测试（模拟）
 *
 * @version 1.0.0
 * @date 2026-06-02
 */

console.log('🧪 开始 npc-plugin 自动化测试...');

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// 测试辅助函数
function assert(condition, testName) {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    console.log(`✅ ${testName} - 通过`);
    return true;
  } else {
    testResults.failed++;
    console.error(`❌ ${testName} - 失败`);
    return false;
  }
}

// ==================== 测试用例 ====================

// 测试1: 插件加载测试
async function testPluginLoading() {
  console.log('\n📋 测试1: 插件加载测试');

  // 检查 PluginLoader 是否可用
  assert(typeof PluginLoader !== 'undefined', 'PluginLoader 已定义');

  // 检查 NpcPlugin 类是否可用
  assert(typeof NpcPlugin !== 'undefined', 'NpcPlugin 类已定义');

  // 尝试获取插件实例
  try {
    const plugin = PluginLoader.get('npc');
    assert(plugin !== null, '插件实例已创建');
    assert(plugin.name === 'NPC配置插件', '插件名称正确');
    assert(plugin.version === '2.0.0', '插件版本正确');
  } catch (error) {
    testResults.errors.push(`插件加载失败: ${error.message}`);
    console.error(`❌ 插件加载失败: ${error.message}`);
  }
}

// 测试2: list action 测试
async function testListAction() {
  console.log('\n📋 测试2: list action 测试');

  try {
    const result = await PluginLoader.execute('npc', { action: 'list' });
    assert(typeof result === 'object', 'list 返回对象');
    assert(result.hasOwnProperty('counselorCount'), '返回有 counselorCount 字段');
    assert(result.hasOwnProperty('backgroundCount'), '返回有 backgroundCount 字段');
    assert(result.hasOwnProperty('transitionCount'), '返回有 transitionCount 字段');
  } catch (error) {
    testResults.errors.push(`list action 失败: ${error.message}`);
    console.error(`❌ list action 失败: ${error.message}`);
  }
}

// 测试3: get action 测试
async function testGetAction() {
  console.log('\n📋 测试3: get action 测试');

  try {
    const result = await PluginLoader.execute('npc', { action: 'get' });
    assert(result !== null, 'get 返回非空结果');
    assert(result.hasOwnProperty('counselors'), '返回有 counselors 字段');
    assert(result.hasOwnProperty('backgrounds'), '返回有 backgrounds 字段');
    assert(result.hasOwnProperty('transitions'), '返回有 transitions 字段');
  } catch (error) {
    testResults.errors.push(`get action 失败: ${error.message}`);
    console.error(`❌ get action 失败: ${error.message}`);
  }
}

// 测试4: switch-tab action 测试
async function testSwitchTabAction() {
  console.log('\n📋 测试4: switch-tab action 测试');

  try {
    // 测试切换到 counselor tab
    const result1 = await PluginLoader.execute('npc', { action: 'switch-tab', tabId: 'counselor' });
    assert(result1.success === true, '切换到 counselor tab 成功');

    // 检查插件状态
    const plugin = PluginLoader.get('npc');
    assert(plugin._currentTab === 'counselor', '插件 _currentTab 已更新为 counselor');

    // 测试切换到 background tab
    const result2 = await PluginLoader.execute('npc', { action: 'switch-tab', tabId: 'background' });
    assert(result2.success === true, '切换到 background tab 成功');
    assert(plugin._currentTab === 'background', '插件 _currentTab 已更新为 background');
  } catch (error) {
    testResults.errors.push(`switch-tab action 失败: ${error.message}`);
    console.error(`❌ switch-tab action 失败: ${error.message}`);
  }
}

// 测试5: render action 测试
async function testRenderAction() {
  console.log('\n📋 测试5: render action 测试');

  try {
    // 确保有容器
    let container1 = document.getElementById('counselor-list');
    if (!container1) {
      container1 = document.createElement('div');
      container1.id = 'counselor-list';
      document.body.appendChild(container1);
    }

    let container2 = document.getElementById('background-list');
    if (!container2) {
      container2 = document.createElement('div');
      container2.id = 'background-list';
      document.body.appendChild(container2);
    }

    let container3 = document.getElementById('transition-list');
    if (!container3) {
      container3 = document.createElement('div');
      container3.id = 'transition-list';
      document.body.appendChild(container3);
    }

    await PluginLoader.execute('npc', { action: 'render' });

    // 检查容器是否有内容（如果数据不为空）
    const plugin = PluginLoader.get('npc');
    const config = plugin._config;

    if (config.counselors.length > 0) {
      assert(container1.children.length > 0, '咨询师列表已渲染');
    }

    if (config.backgrounds.length > 0) {
      assert(container2.children.length > 0, '背景列表已渲染');
    }

    if (config.transitions.length > 0) {
      assert(container3.children.length > 0, '过渡语列表已渲染');
    }
  } catch (error) {
    testResults.errors.push(`render action 失败: ${error.message}`);
    console.error(`❌ render action 失败: ${error.message}`);
  }
}

// 测试6: add-counselor action 测试（模拟）
async function testAddCounselorAction() {
  console.log('\n📋 测试6: add-counselor action 测试（模拟）');

  try {
    // 由于 add-counselor 会打开弹窗，这里只测试函数调用不报错
    const result = await PluginLoader.execute('npc', { action: 'add-counselor' });
    assert(result.success === true, 'add-counselor 返回成功');
    assert(result.id !== null, 'add-counselor 返回了临时 ID');

    // 检查插件状态
    const plugin = PluginLoader.get('npc');
    assert(plugin !== null, '插件实例可用');
  } catch (error) {
    testResults.errors.push(`add-counselor action 失败: ${error.message}`);
    console.error(`❌ add-counselor action 失败: ${error.message}`);
  }
}

// 测试7: set-default-counselor action 测试（模拟）
async function testSetDefaultCounselorAction() {
  console.log('\n📋 测试7: set-default-counselor action 测试（模拟）');

  try {
    const plugin = PluginLoader.get('npc');
    const config = plugin._config;

    if (config.counselors.length > 0) {
      const firstId = config.counselors[0].id;
      const result = await PluginLoader.execute('npc', { action: 'set-default-counselor', id: firstId });
      assert(result.success === true, 'set-default-counselor 返回成功');
      assert(config.defaultCounselorId === firstId, 'defaultCounselorId 已更新');
    } else {
      console.warn('⚠️ 没有咨询师数据，跳过 set-default-counselor action 测试');
    }
  } catch (error) {
    testResults.errors.push(`set-default-counselor action 失败: ${error.message}`);
    console.error(`❌ set-default-counselor action 失败: ${error.message}`);
  }
}

// 测试8: 选项管理测试
async function testOptionManagement() {
  console.log('\n📋 测试8: 选项管理测试');

  try {
    const plugin = PluginLoader.get('npc');
    const config = plugin._config;

    // 测试获取选项列表
    const roleOptions = config.roleOptions || [];
    assert(Array.isArray(roleOptions), 'roleOptions 是数组');

    const styleOptions = config.styleOptions || [];
    assert(Array.isArray(styleOptions), 'styleOptions 是数组');

    // 测试添加选项（模拟）
    console.log('⚠️ 选项管理测试需要完整DOM和事件，这里只做基本检查');
    assert(plugin._openOptionManager !== undefined, '选项管理器方法存在');
  } catch (error) {
    testResults.errors.push(`选项管理测试失败: ${error.message}`);
    console.error(`❌ 选项管理测试失败: ${error.message}`);
  }
}

// 测试9: 配置保存测试（模拟）
async function testSaveConfig() {
  console.log('\n📋 测试9: 配置保存测试（模拟）');

  try {
    const plugin = PluginLoader.get('npc');
    const config = plugin._config;

    // 修改配置
    const originalCount = config.transitions.length;
    config.transitions.push('测试过渡语');

    // 保存配置
    const result = await PluginLoader.execute('npc', { action: 'save', config: config });
    assert(result.success === true, 'save 返回成功');

    // 验证保存结果
    const savedConfig = JSON.parse(localStorage.getItem(plugin._getConfigKey()));
    assert(savedConfig.transitions.length === originalCount + 1, '配置已保存到 localStorage');

    // 恢复配置
    config.transitions.pop();
    await PluginLoader.execute('npc', { action: 'save', config: config });
  } catch (error) {
    testResults.errors.push(`配置保存测试失败: ${error.message}`);
    console.error(`❌ 配置保存测试失败: ${error.message}`);
  }
}

// 测试10: 云端同步测试（模拟）
async function testSyncToCloud() {
  console.log('\n📋 测试10: 云端同步测试（模拟）');

  try {
    // 由于云端同步需要网络请求，这里只测试函数调用不报错
    console.log('⚠️ 云端同步测试需要网络连接，这里只做基本检查');

    const plugin = PluginLoader.get('npc');
    assert(plugin !== null, '插件实例可用');
    assert(typeof plugin._syncToCloud === 'function', '云端同步方法存在');
    assert(typeof plugin._getApiBase === 'function', 'API base URL 方法存在');
  } catch (error) {
    testResults.errors.push(`云端同步测试失败: ${error.message}`);
    console.error(`❌ 云端同步测试失败: ${error.message}`);
  }
}

// ==================== 运行所有测试 ====================

async function runAllTests() {
  console.log('🚀 开始运行所有测试...\n');

  // 等待插件加载完成
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 运行测试
  await testPluginLoading();
  await testListAction();
  await testGetAction();
  await testSwitchTabAction();
  await testRenderAction();
  await testAddCounselorAction();
  await testSetDefaultCounselorAction();
  await testOptionManagement();
  await testSaveConfig();
  await testSyncToCloud();

  // 输出测试报告
  console.log('\n===============================');
  console.log('📊 测试报告');
  console.log('===============================');
  console.log(`总测试数: ${testResults.total}`);
  console.log(`通过: ${testResults.passed}`);
  console.log(`失败: ${testResults.failed}`);
  console.log(`通过率: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);

  if (testResults.errors.length > 0) {
    console.log('\n❌ 错误详情:');
    testResults.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }

  console.log('\n🎉 测试完成！');

  // 返回测试结果（供自动化工具使用）
  return {
    success: testResults.failed === 0,
    total: testResults.total,
    passed: testResults.passed,
    failed: testResults.failed,
    errors: testResults.errors
  };
}

// 如果在浏览器环境中，自动运行测试
if (typeof window !== 'undefined') {
  window.runNpcPluginTests = runAllTests;
  console.log('💡 提示：在控制台中调用 runNpcPluginTests() 来运行测试');
}

// 如果在 Node.js 环境中，导出测试函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testPluginLoading,
    testListAction,
    testGetAction,
    testSwitchTabAction,
    testRenderAction,
    testAddCounselorAction,
    testSetDefaultCounselorAction,
    testOptionManagement,
    testSaveConfig,
    testSyncToCloud
  };
}

// 自动运行测试（如果在 HTML 页面中引入）
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM 已加载，可以运行测试');
  });
}
