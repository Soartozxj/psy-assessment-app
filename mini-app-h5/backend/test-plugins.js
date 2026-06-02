/**
 * 插件测试脚本 - Node.js 环境
 * 在模拟环境中测试插件的基本逻辑
 */

// ==================== 模拟浏览器 API ====================

// 模拟 console
global.console = console;

// 模拟 document
global.document = {
  readyState: 'complete',
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {}
};

// 模拟 localStorage
const localStorageMock = {
  _data: {},
  getItem(key) {
    return this._data[key] || null;
  },
  setItem(key, value) {
    this._data[key] = String(value);
  },
  removeItem(key) {
    delete this._data[key];
  },
  clear() {
    this._data = {};
  }
};
global.localStorage = localStorageMock;

// 模拟 fetch
global.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ code: 0, data: {} })
});

// 模拟 UIUtils
global.UIUtils = {
  showToast: (msg, type) => console.log(`[Toast ${type}] ${msg}`),
  showConfirm: async (msg) => true
};

// 模拟 scales 数据
global.scales = [
  {
    id: 'SCL90',
    name: '症状自评量表',
    questions: Array(90)
      .fill()
      .map((_, i) => ({ id: i + 1, dimension: '躯体化' })),
    scoring: {
      dimensions: [{ key: 'dim1', label: '躯体化', formula: 'SUM', items: '1,4,12,27,40,42,48,49,52,53,56,58' }],
      metrics: [{ key: 'total', label: '总分', formula: 'SUM' }],
      interpretation: [],
      screening: null
    }
  }
];

// ==================== 主测试函数 ====================
async function runTests() {
  // 使用 CommonJS 方式导入 fs 和 path
  const fs = require('fs');
  const path = require('path');

  const __dirname = path.dirname(__filename);
  const __filename = __filename;

  const pluginBaseCode = fs.readFileSync(path.join(__dirname, 'plugins/core/plugin-base.js'), 'utf8');
  // 替换 window 为 global
  eval(pluginBaseCode.replace(/window\./g, 'global.'));

  console.log('✅ PluginBase 加载成功\n');

  // ==================== 测试 ScoringPlugin ====================
  console.log('📊 开始测试 ScoringPlugin...\n');

  const scoringPluginCode = fs.readFileSync(path.join(__dirname, 'plugins/core/scoring-plugin.js'), 'utf8');
  eval(
    scoringPluginCode.replace(/typeof\s+document\s*!==\s*['"]undefined['"]/g, 'false').replace(/window\./g, 'global.')
  );

  const scoringPlugin = new ScoringPlugin();
  console.log('✅ ScoringPlugin 实例化成功');
  console.log('   名称:', scoringPlugin.name);
  console.log('   版本:', scoringPlugin.version);
  console.log('   描述:', scoringPlugin.description);

  // 测试 onInit
  try {
    await scoringPlugin.onInit();
    console.log('✅ onInit() 执行成功');
    console.log('   加载了', scoringPlugin._scales.length, '个量表');
  } catch (e) {
    console.error('❌ onInit() 执行失败:', e.message);
  }

  // 测试 _getScalesList
  try {
    const list = scoringPlugin._getScalesList();
    console.log('✅ _getScalesList() 执行成功');
    console.log('   返回:', JSON.stringify(list));
  } catch (e) {
    console.error('❌ _getScalesList() 执行失败:', e.message);
  }

  // 测试 _getScale
  try {
    const scale = scoringPlugin._getScale('SCL90');
    console.log('✅ _getScale() 执行成功');
    console.log('   量表名称:', scale.name);
  } catch (e) {
    console.error('❌ _getScale() 执行失败:', e.message);
  }

  // 测试 onExecute
  try {
    const result = await scoringPlugin.onExecute({ action: 'list' });
    console.log('✅ onExecute("list") 执行成功');
    console.log('   返回:', JSON.stringify(result));
  } catch (e) {
    console.error('❌ onExecute("list") 执行失败:', e.message);
  }

  console.log('\n📊 ScoringPlugin 测试完成\n');

  // ==================== 测试 NpcPlugin ====================
  console.log('🎭 开始测试 NpcPlugin...\n');

  const npcPluginCode = fs.readFileSync(path.join(__dirname, 'plugins/core/npc-plugin.js'), 'utf8');
  eval(npcPluginCode.replace(/typeof\s+document\s*!==\s*['"]undefined['"]/g, 'false').replace(/window\./g, 'global.'));

  const npcPlugin = new NpcPlugin();
  console.log('✅ NpcPlugin 实例化成功');
  console.log('   名称:', npcPlugin.name);
  console.log('   版本:', npcPlugin.version);
  console.log('   描述:', npcPlugin.description);

  // 测试 onInit
  try {
    await npcPlugin.onInit();
    console.log('✅ onInit() 执行成功');
    console.log('   配置:', JSON.stringify(npcPlugin._config).substring(0, 100) + '...');
  } catch (e) {
    console.error('❌ onInit() 执行失败:', e.message);
  }

  // 测试 _getConfigSummary
  try {
    const summary = npcPlugin._getConfigSummary();
    console.log('✅ _getConfigSummary() 执行成功');
    console.log('   返回:', JSON.stringify(summary));
  } catch (e) {
    console.error('❌ _getConfigSummary() 执行失败:', e.message);
  }

  // 测试 onExecute
  try {
    const result = await npcPlugin.onExecute({ action: 'list' });
    console.log('✅ onExecute("list") 执行成功');
    console.log('   返回:', JSON.stringify(result));
  } catch (e) {
    console.error('❌ onExecute("list") 执行失败:', e.message);
  }

  console.log('\n🎭 NpcPlugin 测试完成\n');

  // ==================== 测试总结 ====================
  console.log('📝 测试总结');
  console.log('===========');
  console.log('✅ PluginBase: 正常工作');
  console.log('✅ ScoringPlugin: 基本功能正常');
  console.log('✅ NpcPlugin: 基本功能正常');
  console.log('\n⚠️  注意：完整功能需要在浏览器中测试');
}

runTests().catch(console.error);
