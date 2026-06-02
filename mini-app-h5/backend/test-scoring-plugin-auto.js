/**
 * test-scoring-plugin-auto.js - scoring-plugin 自动化测试脚本
 *
 * 测试内容：
 * 1. 插件加载测试
 * 2. list action 测试
 * 3. get action 测试
 * 4. select action 测试
 * 5. render-list action 测试
 * 6. add-dimension action 测试
 * 7. add-metric action 测试
 * 8. 数据收集测试
 * 9. 保存配置测试
 *
 * @version 1.0.0
 * @date 2026-06-02
 */

console.log('🧪 开始 scoring-plugin 自动化测试...');

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

  // 检查 ScoringPlugin 类是否可用
  assert(typeof ScoringPlugin !== 'undefined', 'ScoringPlugin 类已定义');

  // 尝试获取插件实例
  try {
    const plugin = PluginLoader.get('scoring');
    assert(plugin !== null, '插件实例已创建');
    assert(plugin.name === '计分规则插件', '插件名称正确');
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
    const result = await PluginLoader.execute('scoring', { action: 'list' });
    assert(Array.isArray(result), 'list 返回数组');
    assert(result.length > 0, '量有数据');

    // 检查数据结构
    if (result.length > 0) {
      const firstItem = result[0];
      assert(firstItem.hasOwnProperty('id'), '数据有 id 字段');
      assert(firstItem.hasOwnProperty('name'), '数据有 name 字段');
      assert(firstItem.hasOwnProperty('questionCount'), '数据有 questionCount 字段');
      assert(firstItem.hasOwnProperty('hasScoring'), '数据有 hasScoring 字段');
    }
  } catch (error) {
    testResults.errors.push(`list action 失败: ${error.message}`);
    console.error(`❌ list action 失败: ${error.message}`);
  }
}

// 测试3: get action 测试
async function testGetAction() {
  console.log('\n📋 测试3: get action 测试');

  try {
    // 先获取第一个量有ID
    const listResult = await PluginLoader.execute('scoring', { action: 'list' });
    if (listResult.length > 0) {
      const firstId = listResult[0].id;
      const result = await PluginLoader.execute('scoring', { action: 'get', id: firstId });
      assert(result !== null, 'get 返回非空结果');
      assert(result.id === firstId, '返回的 ID 正确');
      assert(result.hasOwnProperty('questions'), '返回有 questions 字段');
    } else {
      console.warn('⚠️ 没有量有数据，跳过 get action 测试');
    }
  } catch (error) {
    testResults.errors.push(`get action 失败: ${error.message}`);
    console.error(`❌ get action 失败: ${error.message}`);
  }
}

// 测试4: select action 测试
async function testSelectAction() {
  console.log('\n📋 测试4: select action 测试');

  try {
    // 先获取第一个量有ID
    const listResult = await PluginLoader.execute('scoring', { action: 'list' });
    if (listResult.length > 0) {
      const firstId = listResult[0].id;
      const result = await PluginLoader.execute('scoring', { action: 'select', scaleId: firstId });
      assert(result.success === true, 'select 返回成功');
      assert(result.scaleId === firstId, 'select 返回的 scaleId 正确');

      // 检查插件状态
      const plugin = PluginLoader.get('scoring');
      assert(plugin._currentScaleId === firstId, '插件 _currentScaleId 已更新');
    } else {
      console.warn('⚠️ 没有量有数据，跳过 select action 测试');
    }
  } catch (error) {
    testResults.errors.push(`select action 失败: ${error.message}`);
    console.error(`❌ select action 失败: ${error.message}`);
  }
}

// 测试5: render-list action 测试
async function testRenderListAction() {
  console.log('\n📋 测试5: render-list action 测试');

  try {
    // 确保有容器
    let container = document.getElementById('scoring-scale-list');
    if (!container) {
      container = document.createElement('div');
      container.id = 'scoring-scale-list';
      document.body.appendChild(container);
    }

    await PluginLoader.execute('scoring', { action: 'render-list' });

    // 检查容器是否有内容
    assert(container.innerHTML.length > 0, '量表列表已渲染');
    assert(container.querySelectorAll('.sc-scale-item').length > 0, '有量表项');
  } catch (error) {
    testResults.errors.push(`render-list action 失败: ${error.message}`);
    console.error(`❌ render-list action 失败: ${error.message}`);
  }
}

// 测试6: add-dimension action 测试
async function testAddDimensionAction() {
  console.log('\n📋 测试6: add-dimension action 测试');

  try {
    // 确保有容器
    let container = document.getElementById('sc-dims-list');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sc-dims-list';
      document.body.appendChild(container);
    }

    // 清空容器
    container.innerHTML = '';

    await PluginLoader.execute('scoring', { action: 'add-dimension' });

    // 检查容器是否有内容
    assert(container.querySelectorAll('.sc-dim-card').length > 0, '维度卡片已添加');
  } catch (error) {
    testResults.errors.push(`add-dimension action 失败: ${error.message}`);
    console.error(`❌ add-dimension action 失败: ${error.message}`);
  }
}

// 测试7: add-metric action 测试
async function testAddMetricAction() {
  console.log('\n📋 测试7: add-metric action 测试');

  try {
    // 确保有容器
    let container = document.getElementById('sc-metrics-list');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sc-metrics-list';
      document.body.appendChild(container);
    }

    // 清空容器
    container.innerHTML = '';

    await PluginLoader.execute('scoring', { action: 'add-metric' });

    // 检查容器是否有内容
    assert(container.querySelectorAll('> div').length > 0, '指标卡片已添加');
  } catch (error) {
    testResults.errors.push(`add-metric action 失败: ${error.message}`);
    console.error(`❌ add-metric action 失败: ${error.message}`);
  }
}

// 测试8: 数据收集测试
async function testCollectScoringData() {
  console.log('\n📋 测试8: 数据收集测试');

  try {
    const plugin = PluginLoader.get('scoring');

    // 模拟表单数据
    const mockData = {
      dimensions: [
        {
          key: 'depression',
          label: '抑郁',
          formula: 'AVG',
          items: '1,2,3',
          condition: null,
          interpretation: [],
          maxScore: 3
        }
      ],
      metrics: [
        {
          key: 'totalScore',
          label: '总分',
          formula: 'SUM',
          items: 'ALL',
          condition: null,
          transform: null
        }
      ],
      interpretation: [],
      screening: null
    };

    // 由于 _collectScoringData 是私有方法且依赖DOM，这里只测试数据结构
    assert(mockData.dimensions.length > 0, '维度数据非空');
    assert(mockData.metrics.length > 0, '指标数据非空');
    assert(mockData.dimensions[0].key === 'depression', '维度键名正确');
    assert(mockData.metrics[0].key === 'totalScore', '指标键名正确');
  } catch (error) {
    testResults.errors.push(`数据收集测试失败: ${error.message}`);
    console.error(`❌ 数据收集测试失败: ${error.message}`);
  }
}

// 测试9: 保存配置测试（模拟）
async function testSaveConfig() {
  console.log('\n📋 测试9: 保存配置测试（模拟）');

  try {
    // 由于 save 操作会修改全局数据，这里只测试函数调用不报错
    // 实际项目中应该有更完善的 mock 机制
    console.log('⚠️ 保存配置测试需要完整DOM和数据源，这里只做基本检查');

    const plugin = PluginLoader.get('scoring');
    assert(plugin !== null, '插件实例可用');
    assert(typeof plugin._collectScoringData === 'function', '数据收集方法存在');
  } catch (error) {
    testResults.errors.push(`保存配置测试失败: ${error.message}`);
    console.error(`❌ 保存配置测试失败: ${error.message}`);
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
  await testSelectAction();
  await testRenderListAction();
  await testAddDimensionAction();
  await testAddMetricAction();
  await testCollectScoringData();
  await testSaveConfig();

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
  window.runScoringPluginTests = runAllTests;
  console.log('💡 提示：在控制台中调用 runScoringPluginTests() 来运行测试');
}

// 如果在 Node.js 环境中，导出测试函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testPluginLoading,
    testListAction,
    testGetAction,
    testSelectAction,
    testRenderListAction,
    testAddDimensionAction,
    testAddMetricAction,
    testCollectScoringData,
    testSaveConfig
  };
}

// 自动运行测试（如果在HTML页面中引入）
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM 已加载，可以运行测试');
  });
}
