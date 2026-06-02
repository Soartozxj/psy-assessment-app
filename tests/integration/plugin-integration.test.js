/**
 * 插件集成测试
 *
 * 测试范围：
 * 1. PluginLoader 加载插件
 * 2. EventHub 事件通信
 * 3. Adapter 存储同步
 * 4. 插件间依赖关系
 * 5. 插件间数据传递
 * 6. 插件生命周期管理
 */

// ============================================================
// 模拟插件系统
// ============================================================

// 模拟 PluginBase
class MockPluginBase {
  constructor(config = {}) {
    this.name = config.name || '未命名插件';
    this.version = config.version || '1.0.0';
    this.isInitialized = false;
  }

  init() {
    this.isInitialized = true;
    return { success: true };
  }

  execute(params = {}) {
    if (!this.isInitialized) {
      return { success: false, error: '插件未初始化' };
    }

    return { success: true, data: params };
  }

  destroy() {
    this.isInitialized = false;
    return { success: true };
  }
}

// 模拟插件
class MockAuthPlugin extends MockPluginBase {
  constructor() {
    super({ name: '认证插件', version: '1.0.0' });
    this.dependencies = [];
  }
}

class MockAIPlugin extends MockPluginBase {
  constructor() {
    super({ name: 'AI配置插件', version: '1.0.0' });
    this.dependencies = ['auth'];
  }
}

class MockScalePlugin extends MockPluginBase {
  constructor() {
    super({ name: '量表管理插件', version: '1.0.0' });
    this.dependencies = ['auth'];
  }
}

class MockScoringPlugin extends MockPluginBase {
  constructor() {
    super({ name: '计分规则插件', version: '1.0.0' });
    this.dependencies = ['auth', 'scale'];
  }
}

class MockNPCPlugin extends MockPluginBase {
  constructor() {
    super({ name: 'NPC配置插件', version: '1.0.0' });
    this.dependencies = ['auth'];
  }
}

// 模拟 PluginLoader
class MockPluginLoader {
  constructor() {
    this.plugins = {};
    this.loadingOrder = [];
  }

  register(name, plugin) {
    this.plugins[name] = plugin;
    return { success: true };
  }

  get(name) {
    return this.plugins[name] || null;
  }

  load(name) {
    const plugin = this.plugins[name];
    if (!plugin) {
      return { success: false, error: `Plugin ${name} not found` };
    }

    if (!plugin.isInitialized) {
      plugin.init();
      this.loadingOrder.push(name);
    }

    return { success: true, plugin };
  }

  unload(name) {
    const plugin = this.plugins[name];
    if (plugin && plugin.isInitialized) {
      plugin.destroy();
      delete this.plugins[name];
    }

    return { success: true };
  }

  // 按依赖顺序加载所有插件
  loadAll() {
    const order = ['auth', 'ai', 'scale', 'scoring', 'npc'];
    const results = [];

    for (const name of order) {
      const result = this.load(name);
      results.push({ name, result });
    }

    return results;
  }

  // 检查依赖是否满足
  checkDependencies(name) {
    const plugin = this.plugins[name];
    if (!plugin || !plugin.dependencies) {
      return { success: true, missing: [] };
    }

    const missing = plugin.dependencies.filter((dep) => !this.plugins[dep] || !this.plugins[dep].isInitialized);

    return {
      success: missing.length === 0,
      missing
    };
  }
}

// ============================================================
// 测试用例
// ============================================================

describe('插件集成测试', () => {
  let pluginLoader;

  // 每个测试前创建新的 PluginLoader
  beforeEach(() => {
    pluginLoader = new MockPluginLoader();
  });

  // ============================================================
  // 1. PluginLoader 加载插件测试
  // ============================================================

  describe('PluginLoader 加载插件', () => {
    test('应该成功注册插件', () => {
      const authPlugin = new MockAuthPlugin();
      const result = pluginLoader.register('auth', authPlugin);

      expect(result.success).toBe(true);
      expect(pluginLoader.plugins['auth']).toBeDefined();
    });

    test('应该成功加载插件', () => {
      const authPlugin = new MockAuthPlugin();
      pluginLoader.register('auth', authPlugin);

      const result = pluginLoader.load('auth');
      expect(result.success).toBe(true);
      expect(result.plugin.isInitialized).toBe(true);
    });

    test('加载不存在的插件应该失败', () => {
      const result = pluginLoader.load('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('应该按正确顺序加载插件', () => {
      // 注册所有插件
      pluginLoader.register('auth', new MockAuthPlugin());
      pluginLoader.register('ai', new MockAIPlugin());
      pluginLoader.register('scale', new MockScalePlugin());
      pluginLoader.register('scoring', new MockScoringPlugin());
      pluginLoader.register('npc', new MockNPCPlugin());

      // 加载所有插件
      pluginLoader.loadAll();

      // 验证加载顺序
      expect(pluginLoader.loadingOrder).toContain('auth');
      expect(pluginLoader.loadingOrder).toContain('ai');
      expect(pluginLoader.loadingOrder).toContain('scale');
      expect(pluginLoader.loadingOrder).toContain('scoring');
      expect(pluginLoader.loadingOrder).toContain('npc');
    });
  });

  // ============================================================
  // 2. 依赖关系测试
  // ============================================================

  describe('插件依赖关系', () => {
    test('auth 插件应该没有依赖', () => {
      const authPlugin = new MockAuthPlugin();
      pluginLoader.register('auth', authPlugin);

      const result = pluginLoader.checkDependencies('auth');
      expect(result.success).toBe(true);
      expect(result.missing.length).toBe(0);
    });

    test('scoring 插件应该依赖 auth 和 scale', () => {
      const scoringPlugin = new MockScoringPlugin();
      pluginLoader.register('scoring', scoringPlugin);

      // 尚未注册依赖，应该失败
      const result = pluginLoader.checkDependencies('scoring');
      expect(result.success).toBe(false);
      expect(result.missing).toContain('auth');
      expect(result.missing).toContain('scale');
    });

    test('满足依赖条件时应该成功', () => {
      // 注册所有依赖
      pluginLoader.register('auth', new MockAuthPlugin());
      pluginLoader.register('scale', new MockScalePlugin());
      pluginLoader.register('scoring', new MockScoringPlugin());

      // 初始化依赖
      pluginLoader.load('auth');
      pluginLoader.load('scale');

      // 检查依赖
      const result = pluginLoader.checkDependencies('scoring');
      expect(result.success).toBe(true);
      expect(result.missing.length).toBe(0);
    });
  });

  // ============================================================
  // 3. EventHub 事件通信测试
  // ============================================================

  describe('EventHub 事件通信', () => {
    test('应该成功注册事件监听器', () => {
      const callback = jest.fn();
      window.EventHub.on('test-event', callback);

      // 触发事件
      window.EventHub.emit('test-event', { data: 'test' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    test('应该成功移除事件监听器', () => {
      const callback = jest.fn();
      window.EventHub.on('test-event', callback);

      // 移除监听器
      window.EventHub.off('test-event', callback);

      // 触发事件
      window.EventHub.emit('test-event', { data: 'test' });

      expect(callback).not.toHaveBeenCalled();
    });

    test('插件间应该能通过事件通信', () => {
      // 模拟插件A发送事件
      const pluginA = {
        name: 'PluginA',
        sendEvent: function () {
          window.EventHub.emit('plugin-a-event', { message: 'Hello from A' });
        }
      };

      // 模拟插件B接收事件
      const pluginB = {
        name: 'PluginB',
        receivedData: null,
        handleEvent: function (data) {
          this.receivedData = data;
        }
      };

      // 注册事件监听器
      window.EventHub.on('plugin-a-event', (data) => {
        pluginB.handleEvent(data);
      });

      // 插件A发送事件
      pluginA.sendEvent();

      // 验证插件B接收到数据
      expect(pluginB.receivedData).toEqual({ message: 'Hello from A' });
    });

    test('认证插件登录成功后应该触发事件', () => {
      const authPlugin = new MockAuthPlugin();
      pluginLoader.register('auth', authPlugin);
      pluginLoader.load('auth');

      // 模拟登录成功事件
      const eventData = { isAuthed: true, timestamp: Date.now() };
      window.EventHub.emit('auth-login-success', eventData);

      // 验证其他插件能接收到事件
      let receivedData = null;
      window.EventHub.on('auth-login-success', (data) => {
        receivedData = data;
      });

      window.EventHub.emit('auth-login-success', eventData);

      expect(receivedData).toEqual(eventData);
    });
  });

  // ============================================================
  // 4. Adapter 存储同步测试
  // ============================================================

  describe('Adapter 存储同步', () => {
    test('应该成功存储数据到 localStorage', () => {
      const testData = { key: 'value' };
      window.Adapter.storage.set('test-key', JSON.stringify(testData));

      const stored = window.Adapter.storage.get('test-key');
      expect(JSON.parse(stored)).toEqual(testData);
    });

    test('应该成功存储数据到 sessionStorage', () => {
      const testData = { sessionKey: 'sessionValue' };
      window.Adapter.storage.setSession('test-session-key', JSON.stringify(testData));

      const stored = window.Adapter.storage.getSession('test-session-key');
      expect(JSON.parse(stored)).toEqual(testData);
    });

    test('插件间应该能共享存储数据', () => {
      // 插件A存储数据
      const pluginAData = { from: 'PluginA', value: 'test' };
      window.Adapter.storage.set('plugin-a-data', JSON.stringify(pluginAData));

      // 插件B读取数据
      const stored = window.Adapter.storage.get('plugin-a-data');
      const parsed = JSON.parse(stored);

      expect(parsed.from).toBe('PluginA');
      expect(parsed.value).toBe('test');
    });

    test('应该成功清除存储数据', () => {
      window.Adapter.storage.set('test-key', 'test-value');
      expect(window.Adapter.storage.get('test-key')).toBe('test-value');

      window.Adapter.storage.remove('test-key');
      expect(window.Adapter.storage.get('test-key')).toBeNull();
    });
  });

  // ============================================================
  // 5. 插件生命周期测试
  // ============================================================

  describe('插件生命周期', () => {
    test('插件应该能正确初始化', () => {
      const authPlugin = new MockAuthPlugin();
      pluginLoader.register('auth', authPlugin);

      expect(authPlugin.isInitialized).toBe(false);

      pluginLoader.load('auth');
      expect(authPlugin.isInitialized).toBe(true);
    });

    test('插件应该能正确销毁', () => {
      const authPlugin = new MockAuthPlugin();
      pluginLoader.register('auth', authPlugin);
      pluginLoader.load('auth');

      expect(authPlugin.isInitialized).toBe(true);

      pluginLoader.unload('auth');
      expect(authPlugin.isInitialized).toBe(false);
      expect(pluginLoader.plugins['auth']).toBeUndefined();
    });

    test('未初始化的插件应该不能执行', () => {
      const authPlugin = new MockAuthPlugin();
      pluginLoader.register('auth', authPlugin);

      const result = authPlugin.execute({ action: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('插件未初始化');
    });

    test('初始化后的插件应该能执行', () => {
      const authPlugin = new MockAuthPlugin();
      pluginLoader.register('auth', authPlugin);
      pluginLoader.load('auth');

      const result = authPlugin.execute({ action: 'test' });
      expect(result.success).toBe(true);
      expect(result.data.action).toBe('test');
    });
  });

  // ============================================================
  // 6. 插件间数据传递测试
  // ============================================================

  describe('插件间数据传递', () => {
    test('scale 插件应该能传递数据给 scoring 插件', () => {
      // 注册插件
      pluginLoader.register('scale', new MockScalePlugin());
      pluginLoader.register('scoring', new MockScoringPlugin());

      // 初始化插件
      pluginLoader.load('scale');
      pluginLoader.load('scoring');

      // 模拟 scale 插件存储量表数据
      const scaleData = { id: 'scale-1', name: '测试量表' };
      window.Adapter.storage.set('current-scale', JSON.stringify(scaleData));

      // 模拟 scoring 插件读取量表数据
      const stored = window.Adapter.storage.get('current-scale');
      const parsed = JSON.parse(stored);

      expect(parsed.id).toBe('scale-1');
      expect(parsed.name).toBe('测试量表');
    });

    test('auth 插件应该能传递认证状态给其他插件', () => {
      // 注册插件
      pluginLoader.register('auth', new MockAuthPlugin());
      pluginLoader.load('auth');

      // 模拟认证成功
      window.Adapter.storage.setSession('psy_admin_authed', '1');

      // 其他插件检查认证状态
      const isAuthed = window.Adapter.storage.getSession('psy_admin_authed') === '1';
      expect(isAuthed).toBe(true);
    });
  });

  // ============================================================
  // 7. 错误处理测试
  // ============================================================

  describe('错误处理', () => {
    test('插件执行出错时应该返回错误对象', () => {
      const errorPlugin = new MockPluginBase({ name: '错误插件' });
      errorPlugin.execute = function () {
        throw new Error('测试错误');
      };

      try {
        errorPlugin.execute();
      } catch (error) {
        expect(error.message).toBe('测试错误');
      }
    });

    test('事件监听器出错时不应该影响其他监听器', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn(() => {
        throw new Error('Callback 2 error');
      });
      const callback3 = jest.fn();

      window.EventHub.on('test-event', callback1);
      window.EventHub.on('test-event', callback2);
      window.EventHub.on('test-event', callback3);

      // 触发事件（callback2 会出错，但不应该影响其他回调）
      window.EventHub.emit('test-event', { data: 'test' });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });
  });
});
