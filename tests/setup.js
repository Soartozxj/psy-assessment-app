/**
 * 测试环境设置文件
 *
 * 大白话解释：
 * - 这个文件在每个测试文件运行前执行
 * - 用于模拟浏览器 API（localStorage, sessionStorage, EventHub 等）
 * - 创建全局测试工具和辅助函数
 */

// ============================================================
// 1. 模拟浏览器 API
// ============================================================

// 模拟 localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index) => {
      return Object.keys(store)[index] || null;
    })
  };
})();

// 模拟 sessionStorage
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index) => {
      return Object.keys(store)[index] || null;
    })
  };
})();

// 设置全局对象
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

// ============================================================
// 2. 模拟 EventHub（事件通信）
// ============================================================

class EventHub {
  constructor() {
    this.events = {};
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
          console.error(`EventHub error in ${event}:`, error);
        }
      });
    }
  }

  clear() {
    this.events = {};
  }
}

// 创建全局 EventHub 实例
window.EventHub = new EventHub();

// ============================================================
// 3. 模拟 Adapter（存储适配器）
// ============================================================

window.Adapter = {
  storage: {
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: (key) => localStorage.removeItem(key),
    clear: () => localStorage.clear(),

    getSession: (key) => sessionStorage.getItem(key),
    setSession: (key, value) => sessionStorage.setItem(key, value),
    removeSession: (key) => sessionStorage.removeItem(key),
    clearSession: () => sessionStorage.clear()
  },

  logger: {
    log: (...args) => console.log(...args),
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    info: (...args) => console.info(...args)
  },

  http: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
};

// ============================================================
// 4. 模拟 PluginLoader
// ============================================================

window.PluginLoader = {
  plugins: {},

  register: function (name, plugin) {
    this.plugins[name] = plugin;
    return { success: true };
  },

  get: function (name) {
    return this.plugins[name] || null;
  },

  load: jest.fn(async (name, forceReload = false) => {
    // 模拟加载插件
    if (window.PluginLoader.plugins[name]) {
      return { success: true, plugin: window.PluginLoader.plugins[name] };
    }
    return { success: false, error: `Plugin ${name} not found` };
  }),

  unload: function (name) {
    delete this.plugins[name];
    return { success: true };
  },

  list: function () {
    return Object.keys(this.plugins);
  }
};

// ============================================================
// 5. 全局测试工具函数
// ============================================================

// 断言工具
global.expectToBeTruthy = (value, message) => {
  if (!value) {
    throw new Error(message || 'Expected value to be truthy');
  }
};

global.expectToEqual = (actual, expected, message) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

global.expectToThrow = (fn, expectedError) => {
  let thrown = false;
  try {
    fn();
  } catch (error) {
    thrown = true;
    if (expectedError && !error.message.includes(expectedError)) {
      throw new Error(`Expected error message to include "${expectedError}", got "${error.message}"`);
    }
  }
  if (!thrown) {
    throw new Error('Expected function to throw an error');
  }
};

// 测试数据生成器
global.TestDataGenerator = {
  // 生成随机字符串
  randomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // 生成随机数字
  randomNumber: (min = 0, max = 100) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // 生成量表测试数据
  generateScale: (overrides = {}) => {
    return {
      id: global.TestDataGenerator.randomString(10),
      name: '测试量表',
      code: 'TEST001',
      category: 'anxiety',
      questions: [
        {
          id: 1,
          content: '测试题目1',
          options: [
            { id: 'A', label: '选项A', score: 0 },
            { id: 'B', label: '选项B', score: 1 }
          ]
        }
      ],
      ...overrides
    };
  },

  // 生成计分规则测试数据
  generateScoringRule: (overrides = {}) => {
    return {
      id: global.TestDataGenerator.randomString(10),
      scaleId: 'TEST001',
      scaleName: '测试量表',
      dimensions: [
        {
          id: 'dim1',
          name: '维度1',
          description: '维度描述',
          indicators: [
            {
              id: 'ind1',
              name: '指标1',
              type: 'sum',
              questionIds: [1],
              options: { A: 0, B: 1 }
            }
          ]
        }
      ],
      interpretations: [
        {
          id: 'interp1',
          dimensionId: 'dim1',
          minScore: 0,
          maxScore: 10,
          level: 'low',
          text: '低风险'
        }
      ],
      ...overrides
    };
  },

  // 生成 NPC 配置测试数据
  generateNpcConfig: (overrides = {}) => {
    return {
      id: global.TestDataGenerator.randomString(10),
      name: '测试咨询师',
      title: '心理咨询师',
      avatar: '',
      background: '',
      greeting: '你好，我是心理咨询师',
      transition: '让我们开始测试吧',
      ...overrides
    };
  }
};

// ============================================================
// 6. 测试前清理
// ============================================================

beforeEach(() => {
  // 清理存储
  localStorage.clear();
  sessionStorage.clear();

  // 清理 EventHub
  window.EventHub.clear();

  // 清理 PluginLoader
  window.PluginLoader.plugins = {};

  // 清理 DOM
  document.body.innerHTML = '';

  // 清理控制台 mock
  jest.clearAllMocks();
});

// ============================================================
// 7. 控制台输出测试开始/结束
// ============================================================

console.log('🧪 测试环境初始化完成');
console.log('='.repeat(50));
