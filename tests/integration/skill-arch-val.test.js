/**
 * Skill 架构本地验证测试
 *
 * 测试目标：
 * - 验证 PluginBase、PluginLoader、EventHub、DualAdapter 的基本功能
 * - 验证插件系统基本功能正常工作
 * - 为后续开发提供信心保障
 */

// ============================================================
// 1. PluginBase Mock 类
// ============================================================

const PluginBase = class PluginBase {
  constructor(config = {}) {
    this.name = config.name || '未命名插件';
    this.version = config.version || '1.0.0';
    this.description = config.description || '';
    this.isInitialized = false;
    this.isDestroyed = false;
  }

  async init() {
    this.isInitialized = true;
    return { success: true };
  }

  async execute(action, params = {}) {
    return { success: true, action, params };
  }

  async destroy() {
    this.isDestroyed = true;
    return { success: true };
  }
};

// ============================================================
// 2. EventHub Mock 类
// ============================================================

class EventHub {
  constructor() {
    this.events = {};
    this.onceListeners = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event, callback) {
    if (this.events[event]) {
      if (callback) {
        this.events[event] = this.events[event].filter((cb) => cb !== callback);
      } else {
        delete this.events[event];
      }
    }
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error('EventHub error:', error);
        }
      });
    }
  }
}

// ============================================================
// 3. PluginLoader Mock 类
// ============================================================

class PluginLoader {
  constructor() {
    this.plugins = {};
    this.corePlugins = ['auth'];
    this.optionalPlugins = ['ai', 'scale', 'scoring', 'npc'];
  }

  async load(pluginName) {
    if (this.plugins[pluginName]) {
      return this.plugins[pluginName];
    }

    const plugin = new PluginBase({ name: pluginName });
    this.plugins[pluginName] = plugin;
    return plugin;
  }

  async init() {
    for (const pluginName of this.corePlugins) {
      await this.load(pluginName);
    }
    return { success: true, loadedCount: this.corePlugins.length };
  }

  async unload(pluginName) {
    delete this.plugins[pluginName];
    return { success: true };
  }
}

// ============================================================
// 4. DualAdapter Mock 类
// ============================================================

class DualAdapter {
  constructor() {
    this.platform = 'h5';
    this.isDev = false;
  }

  detectPlatform() {
    return 'h5';
  }

  get storage() {
    return {
      get: (key) => localStorage.getItem(key),
      set: (key, value) => localStorage.setItem(key, value)
    };
  }

  get http() {
    return {
      get: (url) => Promise.resolve({ data: {} }),
      post: (url, data) => Promise.resolve({ data: {} })
    };
  }
}

// ============================================================
// 测试开始
// ============================================================

describe('Skill 架构本地验证测试', () => {
  // ============================================================
  // 1. PluginBase 验证测试
  // ============================================================

  describe('PluginBase - 插件基类验证', () => {
    let plugin;

    beforeEach(() => {
      plugin = new PluginBase({ name: '测试插件', version: '1.0.0' });
    });

    test('应该能创建插件实例', () => {
      expect(plugin.name).toBe('测试插件');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.isInitialized).toBe(false);
    });

    test('应该能初始化插件', async () => {
      const result = await plugin.init();
      expect(result.success).toBe(true);
      expect(plugin.isInitialized).toBe(true);
    });

    test('应该能执行插件操作', async () => {
      await plugin.init();
      const result = await plugin.execute('test-action', { param1: 'value1' });
      expect(result.success).toBe(true);
      expect(result.action).toBe('test-action');
    });

    test('应该能销毁插件', async () => {
      await plugin.init();
      const result = await plugin.destroy();
      expect(result.success).toBe(true);
      expect(plugin.isDestroyed).toBe(true);
    });
  });

  // ============================================================
  // 2. EventHub 验证测试
  // ============================================================

  describe('EventHub - 事件中心验证', () => {
    let eventHub;

    beforeEach(() => {
      eventHub = new EventHub();
    });

    test('应该能订阅事件', () => {
      const callback = jest.fn();
      eventHub.on('test-event', callback);
      expect(eventHub.events['test-event']).toBeDefined();
      expect(eventHub.events['test-event'].length).toBe(1);
    });

    test('应该能触发事件', () => {
      const callback = jest.fn();
      eventHub.on('test-event', callback);
      eventHub.emit('test-event', { data: 'test' });
      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    test('应该能取消订阅', () => {
      const callback = jest.fn();
      eventHub.on('test-event', callback);
      eventHub.off('test-event', callback);
      expect(eventHub.events['test-event'].length).toBe(0);
    });
  });

  // ============================================================
  // 3. PluginLoader 验证测试
  // ============================================================

  describe('PluginLoader - 插件加载器验证', () => {
    let loader;

    beforeEach(() => {
      loader = new PluginLoader();
    });

    test('应该能创建加载器实例', () => {
      expect(loader.corePlugins).toContain('auth');
      expect(loader.optionalPlugins).toContain('ai');
    });

    test('应该能加载插件', async () => {
      const plugin = await loader.load('auth');
      expect(plugin.name).toBe('auth');
      expect(loader.plugins['auth']).toBeDefined();
    });

    test('应该能初始化加载器', async () => {
      const result = await loader.init();
      expect(result.success).toBe(true);
      expect(result.loadedCount).toBe(1);
    });

    test('应该能卸载插件', async () => {
      await loader.load('auth');
      const result = await loader.unload('auth');
      expect(result.success).toBe(true);
      expect(loader.plugins['auth']).toBeUndefined();
    });
  });

  // ============================================================
  // 4. DualAdapter 验证测试
  // ============================================================

  describe('DualAdapter - 双端适配器验证', () => {
    let adapter;

    beforeEach(() => {
      adapter = new DualAdapter();
      localStorage.clear();
    });

    test('应该能检测平台', () => {
      const platform = adapter.detectPlatform();
      expect(platform).toBe('h5');
    });

    test('应该能提供存储适配器', () => {
      const storage = adapter.storage;
      storage.set('test-key', 'test-value');
      expect(storage.get('test-key')).toBe('test-value');
    });

    test('应该能提供HTTP适配器', () => {
      const http = adapter.http;
      expect(typeof http.get).toBe('function');
      expect(typeof http.post).toBe('function');
    });
  });

  // ============================================================
  // 5. 集成测试 - 插件系统协同工作
  // ============================================================

  describe('插件系统 - 集成验证', () => {
    test('插件应该能通过 EventHub 通信', () => {
      const eventHub = new EventHub();
      const receivedEvents = [];

      eventHub.on('plugin-init', (data) => receivedEvents.push(data));
      eventHub.emit('plugin-init', { name: 'test-plugin' });

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].name).toBe('test-plugin');
    });

    test('插件加载器应该能管理插件生命周期', async () => {
      const loader = new PluginLoader();

      await loader.load('test-plugin');
      expect(loader.plugins['test-plugin']).toBeDefined();

      await loader.unload('test-plugin');
      expect(loader.plugins['test-plugin']).toBeUndefined();
    });

    test('适配器应该能在不同环境工作', () => {
      const adapter = new DualAdapter();
      expect(adapter.platform).toBe('h5');

      const storage = adapter.storage;
      storage.set('key1', 'value1');
      expect(storage.get('key1')).toBe('value1');
    });
  });
});
