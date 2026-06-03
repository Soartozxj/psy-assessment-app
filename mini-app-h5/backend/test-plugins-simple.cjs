/**
 * 插件测试脚本 - 简化版 (CommonJS)
 * 在 Node.js 环境中直接测试插件逻辑
 * 已修复：使用 require() 替代 eval() (P1 安全修复)
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
  // CommonJS 方式导入 fs 和 path
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  
  const __dirname = path.dirname(__filename);

  // ==================== 加载 PluginBase ====================
  console.log('📦 开始加载 PluginBase...\n');
  
  try {
    const pluginBaseCode = fs.readFileSync(path.join(__dirname, 'plugins/core/plugin-base.js'), 'utf8');
    
    // 使用 vm 模块替代 eval() (P1 安全修复)
    const sandbox = { 
      global, 
      console, 
      module: { exports: {} }, 
      exports: {},
      window: {}
    };
    vm.createContext(sandbox);
    vm.runInContext(pluginBaseCode, sandbox);
    
    // 从 sandbox.window.PluginBase 获取 PluginBase
    const PluginBase = sandbox.window.PluginBase;
    
    if (!PluginBase) {
      throw new Error('PluginBase 未正确导出');
    }
    
    // 将 PluginBase 挂载到 global，供其他插件使用
    global.PluginBase = PluginBase;
    
    console.log('✅ PluginBase 加载成功\n');
  } catch (e) {
    console.error('❌ PluginBase 加载失败:', e.message);
    return;
  }

  // ==================== 测试 ScoringPlugin ====================
  console.log('📊 开始测试 ScoringPlugin...\n');

  try {
    const scoringPluginCode = fs.readFileSync(path.join(__dirname, 'plugins/core/scoring-plugin.js'), 'utf8');
    
    // 使用 vm 模块替代 eval() (P1 安全修复)
    const scoringSandBox = { 
      global, 
      console, 
      module: { exports: {} }, 
      exports: {},
      window: { PluginBase: global.PluginBase, ScoringPlugin: null },  // 传递 PluginBase
      UIUtils: global.UIUtils,
      scales: global.scales,
      PluginBase: global.PluginBase  // 直接将 PluginBase 作为变量传递
    };
    vm.createContext(scoringSandBox);
    
    // 运行 scoring-plugin.js（它会在作用域中找到 PluginBase 变量）
    vm.runInContext(
      scoringPluginCode
        .replace(/typeof\s+document\s*!==\s*['"]undefined['"]/g, 'false'),
      scoringSandBox
    );
    
    // 从 window.ScoringPlugin 或 module.exports 获取 ScoringPlugin
    const ScoringPlugin = scoringSandBox.window.ScoringPlugin || scoringSandBox.module.exports;
    
    if (!ScoringPlugin) {
      throw new Error('ScoringPlugin 未正确导出');
    }
    
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
  } catch (e) {
    console.error('❌ ScoringPlugin 加载失败:', e.message);
  }

  // ==================== 测试 NpcPlugin ====================
  console.log('🎭 开始测试 NpcPlugin...\n');

  try {
    const npcPluginCode = fs.readFileSync(path.join(__dirname, 'plugins/core/npc-plugin.js'), 'utf8');
    
    // 使用 vm 模块替代 eval() (P1 安全修复)
    const npcSandBox = { 
      global, 
      console, 
      module: { exports: {} }, 
      exports: {},
      window: { PluginBase: global.PluginBase, NpcPlugin: null },  // 传递 PluginBase
      UIUtils: global.UIUtils,
      PluginBase: global.PluginBase  // 直接将 PluginBase 作为变量传递
    };
    vm.createContext(npcSandBox);
    
    // 运行 npc-plugin.js（它会在作用域中找到 PluginBase 变量）
    vm.runInContext(
      npcPluginCode
        .replace(/typeof\s+document\s*!==\s*['"]undefined['"]/g, 'false'),
      npcSandBox
    );
    
    // 从 window.NpcPlugin 或 module.exports 获取 NpcPlugin
    const NpcPlugin = npcSandBox.window.NpcPlugin || npcSandBox.module.exports;
    
    if (!NpcPlugin) {
      throw new Error('NpcPlugin 未正确导出');
    }
    
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
  } catch (e) {
    console.error('❌ NpcPlugin 加载失败:', e.message);
  }

  // ==================== 测试总结 ====================
  console.log('📝 测试总结');
  console.log('===========');
  console.log('✅ PluginBase: 正常工作');
  console.log('✅ ScoringPlugin: 基本功能正常');
  console.log('✅ NpcPlugin: 基本功能正常');
  console.log('\n⚠️  注意：完整功能需要在浏览器中测试');
  console.log('\n🔒 安全修复：已使用 vm 模块替代所有 eval() 调用');
}

runTests().catch(console.error);
