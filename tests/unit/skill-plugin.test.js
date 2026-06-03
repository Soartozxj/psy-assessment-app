/**
 * skill-plugin.test.js - PluginBase 单元测试
 *
 * 测试范围：
 * 1. 插件初始化
 * 2. 插件执行
 * 3. 插件销毁
 * 4. 参数校验
 * 5. 错误处理
 * 6. 日志记录
 * 7. 子类实现要求
 */

// ============================================================
// 模拟 PluginBase 基类
// ============================================================

class PluginBase {
  constructor(config = {}) {
    this.name = config.name || '未命名插件';
    this.version = config.version || '1.0.0';
    this.description = config.description || '';
    this.isInitialized = false;
    this._state = 'created';
  }

  init() {
    try {
      this.onInit();
      this.isInitialized = true;
      this._state = 'initialized';
      this.log('插件初始化完成');
      return { success: true };
    } catch (error) {
      this.log(`插件初始化失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  execute(params = {}) {
    if (!this.isInitialized) {
      return { success: false, error: '插件未初始化' };
    }

    try {
      this.log(`执行操作: ${params.action}`);
      const result = this.onExecute(params);
      return { success: true, data: result };
    } catch (error) {
      this.log(`操作失败: ${params.action} - ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  destroy() {
    try {
      this.onDestroy();
      this.isInitialized = false;
      this._state = 'destroyed';
      this.log('插件销毁完成');
      return { success: true };
    } catch (error) {
      this.log(`插件销毁失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const prefix = `[${this.name}]`;

    switch (level) {
      case 'error':
        console.error(`${timestamp} ${prefix} ${message}`);
        break;
      case 'warning':
        console.warn(`${timestamp} ${prefix} ${message}`);
        break;
      case 'debug':
        console.debug(`${timestamp} ${prefix} ${message}`);
        break;
      default:
        console.log(`${timestamp} ${prefix} ${message}`);
    }
  }

  validateParams(params, required = []) {
    for (const param of required) {
      if (params[param] === undefined || params[param] === null) {
        throw new Error(`缺少必需参数: ${param}`);
      }
    }
  }

  onInit() {
    throw new Error('子类必须实现 onInit() 方法');
  }

  onExecute(params = {}) {
    throw new Error('子类必须实现 onExecute() 方法');
  }

  onDestroy() {
    throw new Error('子类必须实现 onDestroy() 方法');
  }
}

// ============================================================
// 测试用例
// ============================================================

describe('PluginBase - 插件基类单元测试', () => {
  let plugin;
  let consoleSpy;

  // 每个测试前创建新的插件实例
  beforeEach(() => {
    plugin = new PluginBase({
      name: '测试插件',
      version: '1.0.0',
      description: '用于单元测试的插件'
    });

    // 模拟 console 方法
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation()
    };
  });

  // 每个测试后清理
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================================
  // 1. 构造函数测试
  // ============================================================

  describe('构造函数', () => {
    test('应该使用提供的配置', () => {
      expect(plugin.name).toBe('测试插件');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBe('用于单元测试的插件');
      expect(plugin.isInitialized).toBe(false);
      expect(plugin._state).toBe('created');
    });

    test('应该使用默认配置', () => {
      const defaultPlugin = new PluginBase();
      expect(defaultPlugin.name).toBe('未命名插件');
      expect(defaultPlugin.version).toBe('1.0.0');
      expect(defaultPlugin.description).toBe('');
    });
  });

  // ============================================================
  // 2. 初始化测试
  // ============================================================

  describe('init() - 初始化', () => {
    test('应该在子类实现 onInit 时成功初始化', () => {
      // 模拟子类实现
      plugin.onInit = jest.fn();

      const result = plugin.init();

      expect(result.success).toBe(true);
      expect(plugin.isInitialized).toBe(true);
      expect(plugin._state).toBe('initialized');
      expect(plugin.onInit).toHaveBeenCalled();
    });

    test('应该在 onInit 抛出异常时初始化失败', () => {
      // 模拟子类未实现 onInit（抛出错误）
      const result = plugin.init();

      expect(result.success).toBe(false);
      expect(result.error).toContain('子类必须实现 onInit() 方法');
      expect(plugin.isInitialized).toBe(false);
    });

    test('应该记录初始化日志', () => {
      plugin.onInit = jest.fn();

      plugin.init();

      // log 方法将时间戳、前缀和消息合并成一个字符串
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('插件初始化完成'));
    });
  });

  // ============================================================
  // 3. 执行测试
  // ============================================================

  describe('execute() - 执行', () => {
    beforeEach(() => {
      // 先初始化插件
      plugin.onInit = jest.fn();
      plugin.onExecute = jest.fn(() => ({ result: 'success' }));
      plugin.init();
    });

    test('应该在插件初始化后成功执行', () => {
      const result = plugin.execute({ action: 'test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'success' });
      expect(plugin.onExecute).toHaveBeenCalledWith({ action: 'test' });
    });

    test('应该在插件未初始化时执行失败', () => {
      const uninitializedPlugin = new PluginBase();
      const result = uninitializedPlugin.execute({ action: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('插件未初始化');
    });

    test('应该在 onExecute 抛出异常时执行失败', () => {
      plugin.onExecute = jest.fn(() => {
        throw new Error('执行错误');
      });

      const result = plugin.execute({ action: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('执行错误');
    });

    test('应该记录执行日志', () => {
      plugin.execute({ action: 'test' });

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('执行操作: test'));
    });
  });

  // ============================================================
  // 4. 销毁测试
  // ============================================================

  describe('destroy() - 销毁', () => {
    beforeEach(() => {
      // 先初始化插件
      plugin.onInit = jest.fn();
      plugin.init();
    });

    test('应该在子类实现 onDestroy 时成功销毁', () => {
      plugin.onDestroy = jest.fn();

      const result = plugin.destroy();

      expect(result.success).toBe(true);
      expect(plugin.isInitialized).toBe(false);
      expect(plugin._state).toBe('destroyed');
      expect(plugin.onDestroy).toHaveBeenCalled();
    });

    test('应该在 onDestroy 抛出异常时销毁失败', () => {
      // 不实现 onDestroy，使用默认实现（会抛出错误）
      const result = plugin.destroy();

      expect(result.success).toBe(false);
      expect(result.error).toContain('子类必须实现 onDestroy() 方法');
    });

    test('应该记录销毁日志', () => {
      plugin.onDestroy = jest.fn();
      plugin.destroy();

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('插件销毁完成'));
    });
  });

  // ============================================================
  // 5. 参数校验测试
  // ============================================================

  describe('validateParams() - 参数校验', () => {
    test('应该在所有必需参数都存在时通过校验', () => {
      const params = { name: 'test', age: 25 };
      expect(() => {
        plugin.validateParams(params, ['name', 'age']);
      }).not.toThrow();
    });

    test('应该在缺少必需参数时抛出错误', () => {
      const params = { name: 'test' };

      expect(() => {
        plugin.validateParams(params, ['name', 'age']);
      }).toThrow('缺少必需参数: age');
    });

    test('应该在参数为 null 时抛出错误', () => {
      const params = { name: null };

      expect(() => {
        plugin.validateParams(params, ['name']);
      }).toThrow('缺少必需参数: name');
    });

    test('应该在没有必需参数时通过校验', () => {
      const params = { name: 'test' };

      expect(() => {
        plugin.validateParams(params, []);
      }).not.toThrow();
    });
  });

  // ============================================================
  // 6. 日志记录测试
  // ============================================================

  describe('log() - 日志记录', () => {
    test('应该记录 info 级别日志', () => {
      plugin.log('测试信息');

      // log 方法将时间戳、前缀和消息合并成一个字符串
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('测试信息'));
    });

    test('应该记录 error 级别日志', () => {
      plugin.log('测试错误', 'error');

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('测试错误'));
    });

    test('应该记录 warning 级别日志', () => {
      plugin.log('测试警告', 'warning');

      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('测试警告'));
    });

    test('应该记录 debug 级别日志', () => {
      plugin.log('测试调试', 'debug');

      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('测试调试'));
    });

    test('应该使用正确的时间戳格式', () => {
      plugin.log('测试');

      // 验证日志包含时间戳格式 (HH:MM:SS)
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringMatching(/\d{2}:\d{2}:\d{2}/));
    });
  });

  // ============================================================
  // 7. 子类实现要求测试
  // ============================================================

  describe('子类实现要求', () => {
    test('onInit() 应该由子类实现', () => {
      const result = plugin.init();

      expect(result.success).toBe(false);
      expect(result.error).toContain('子类必须实现 onInit() 方法');
    });

    test('onExecute() 应该由子类实现', () => {
      plugin.onInit = jest.fn();
      plugin.init();

      const result = plugin.execute({ action: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('子类必须实现 onExecute() 方法');
    });

    test('onDestroy() 应该由子类实现', () => {
      plugin.onInit = jest.fn();
      plugin.init();

      const result = plugin.destroy();

      expect(result.success).toBe(false);
      expect(result.error).toContain('子类必须实现 onDestroy() 方法');
    });
  });

  // ============================================================
  // 8. 完整生命周期测试
  // ============================================================

  describe('完整生命周期', () => {
    test('应该完成 初始化 → 执行 → 销毁 完整流程', () => {
      // 模拟子类实现
      let initCalled = false;
      let executeCalled = false;
      let destroyCalled = false;

      plugin.onInit = jest.fn(() => {
        initCalled = true;
      });

      plugin.onExecute = jest.fn(() => {
        executeCalled = true;
        return { data: 'test' };
      });

      plugin.onDestroy = jest.fn(() => {
        destroyCalled = true;
      });

      // 初始化
      const initResult = plugin.init();
      expect(initResult.success).toBe(true);
      expect(initCalled).toBe(true);
      expect(plugin.isInitialized).toBe(true);

      // 执行
      const executeResult = plugin.execute({ action: 'test' });
      expect(executeResult.success).toBe(true);
      expect(executeCalled).toBe(true);

      // 销毁
      const destroyResult = plugin.destroy();
      expect(destroyResult.success).toBe(true);
      expect(destroyCalled).toBe(true);
      expect(plugin.isInitialized).toBe(false);
    });
  });

  // ============================================================
  // 9. 边界情况测试
  // ============================================================

  describe('边界情况', () => {
    test('应该处理空参数', () => {
      plugin.onInit = jest.fn();
      plugin.onExecute = jest.fn();
      plugin.init();

      const result = plugin.execute();

      expect(result.success).toBe(true);
      expect(plugin.onExecute).toHaveBeenCalledWith({});
    });

    test('应该处理特殊字符的插件名称', () => {
      const specialPlugin = new PluginBase({
        name: '插件-测试_123@#$',
        version: '2.0.0-beta'
      });

      expect(specialPlugin.name).toBe('插件-测试_123@#$');
      expect(specialPlugin.version).toBe('2.0.0-beta');
    });

    test('应该处理非常长的描述', () => {
      const longDesc = 'A'.repeat(10000);
      const pluginWithLongDesc = new PluginBase({
        name: '测试',
        description: longDesc
      });

      expect(pluginWithLongDesc.description).toBe(longDesc);
    });
  });
});
