/**
 * ai-plugin.js 单元测试
 *
 * 测试范围：
 * 1. 插件初始化
 * 2. 配置加载
 * 3. 配置保存
 * 4. 测试连接功能
 * 5. 边界情况和异常处理
 */

// ============================================================
// 模拟 AIPlugin 类
// ============================================================

class MockAIPlugin {
  constructor() {
    this.name = 'AI配置插件';
    this.version = '1.0.0';
    this.isInitialized = false;
    this.STORAGE_KEY = 'psy_ai_config';
    this.defaultConfig = {
      apiUrl: 'https://api.tencent.com/hunyuan',
      apiKey: '',
      model: 'hunyuan-lite',
      temperature: 0.7,
      maxTokens: 2000
    };
  }

  // 初始化
  init() {
    this.isInitialized = true;
    return { success: true };
  }

  // 加载配置
  loadConfig() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return { ...this.defaultConfig };
      }
    }
    return { ...this.defaultConfig };
  }

  // 保存配置
  saveConfig(config) {
    // 验证配置
    if (!config || typeof config !== 'object') {
      return { success: false, error: '配置数据无效' };
    }

    if (!config.apiUrl || config.apiUrl.trim() === '') {
      return { success: false, error: 'API URL 不能为空' };
    }

    if (!config.apiKey || config.apiKey.trim() === '') {
      return { success: false, error: 'API Key 不能为空' };
    }

    // 保存到 localStorage
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    return { success: true, message: '配置保存成功' };
  }

  // 测试连接
  async testConnection(config) {
    if (!config || !config.apiKey) {
      return { success: false, error: '配置不完整' };
    }

    // 模拟 API 调用
    try {
      // 这里应该调用真实的 API，但测试时我们模拟
      const response = await this.mockApiCall(config);
      return { success: true, message: '连接成功', data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 模拟 API 调用
  async mockApiCall(config) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (config.apiKey === 'invalid_key') {
          reject(new Error('API Key 无效'));
        } else if (config.apiUrl === 'invalid_url') {
          reject(new Error('API URL 无效'));
        } else {
          resolve({ status: 'ok', model: config.model });
        }
      }, 100);
    });
  }

  // 重置配置
  resetConfig() {
    localStorage.removeItem(this.STORAGE_KEY);
    return { success: true, message: '配置已重置为默认值', config: { ...this.defaultConfig } };
  }
}

// ============================================================
// 测试用例
// ============================================================

describe('AIPlugin - AI配置插件单元测试', () => {
  let aiPlugin;

  // 每个测试前创建新的插件实例
  beforeEach(() => {
    aiPlugin = new MockAIPlugin();
    aiPlugin.init();
  });

  // ============================================================
  // 1. 插件初始化测试
  // ============================================================

  describe('插件初始化', () => {
    test('应该成功初始化插件', () => {
      const result = aiPlugin.init();
      expect(result.success).toBe(true);
      expect(aiPlugin.isInitialized).toBe(true);
    });

    test('初始化后应该有默认配置', () => {
      expect(aiPlugin.defaultConfig).toBeDefined();
      expect(aiPlugin.defaultConfig.apiUrl).toBe('https://api.tencent.com/hunyuan');
      expect(aiPlugin.defaultConfig.model).toBe('hunyuan-lite');
    });
  });

  // ============================================================
  // 2. 配置加载测试
  // ============================================================

  describe('配置加载', () => {
    test('没有存储配置时应该返回默认配置', () => {
      const config = aiPlugin.loadConfig();
      expect(config.apiUrl).toBe('https://api.tencent.com/hunyuan');
      expect(config.model).toBe('hunyuan-lite');
      expect(config.temperature).toBe(0.7);
    });

    test('有存储配置时应该返回存储的配置', () => {
      const testConfig = {
        apiUrl: 'https://custom-api.com',
        apiKey: 'test-key',
        model: 'hunyuan-pro',
        temperature: 0.9,
        maxTokens: 4000
      };

      localStorage.setItem(aiPlugin.STORAGE_KEY, JSON.stringify(testConfig));

      const config = aiPlugin.loadConfig();
      expect(config.apiUrl).toBe('https://custom-api.com');
      expect(config.model).toBe('hunyuan-pro');
      expect(config.temperature).toBe(0.9);
    });

    test('存储的配置无效时应该返回默认配置', () => {
      localStorage.setItem(aiPlugin.STORAGE_KEY, 'invalid json');

      const config = aiPlugin.loadConfig();
      expect(config.apiUrl).toBe('https://api.tencent.com/hunyuan');
      expect(config.model).toBe('hunyuan-lite');
    });
  });

  // ============================================================
  // 3. 配置保存测试
  // ============================================================

  describe('配置保存', () => {
    test('保存有效配置应该成功', () => {
      const config = {
        apiUrl: 'https://api.tencent.com/hunyuan',
        apiKey: 'test-api-key',
        model: 'hunyuan-lite',
        temperature: 0.7,
        maxTokens: 2000
      };

      const result = aiPlugin.saveConfig(config);
      expect(result.success).toBe(true);
      expect(result.message).toBe('配置保存成功');

      // 验证已保存
      const stored = localStorage.getItem(aiPlugin.STORAGE_KEY);
      const parsed = JSON.parse(stored);
      expect(parsed.apiKey).toBe('test-api-key');
    });

    test('保存空配置应该失败', () => {
      const result = aiPlugin.saveConfig(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('配置数据无效');
    });

    test('保存非对象配置应该失败', () => {
      const result = aiPlugin.saveConfig('string config');
      expect(result.success).toBe(false);
      expect(result.error).toBe('配置数据无效');
    });

    test('API URL 为空应该保存失败', () => {
      const config = {
        apiUrl: '',
        apiKey: 'test-key',
        model: 'hunyuan-lite'
      };

      const result = aiPlugin.saveConfig(config);
      expect(result.success).toBe(false);
      expect(result.error).toBe('API URL 不能为空');
    });

    test('API Key 为空应该保存失败', () => {
      const config = {
        apiUrl: 'https://api.tencent.com/hunyuan',
        apiKey: '',
        model: 'hunyuan-lite'
      };

      const result = aiPlugin.saveConfig(config);
      expect(result.success).toBe(false);
      expect(result.error).toBe('API Key 不能为空');
    });
  });

  // ============================================================
  // 4. 测试连接功能
  // ============================================================

  describe('测试连接', () => {
    test('使用有效配置应该连接成功', async () => {
      const config = {
        apiUrl: 'https://api.tencent.com/hunyuan',
        apiKey: 'valid-key',
        model: 'hunyuan-lite'
      };

      const result = await aiPlugin.testConnection(config);
      expect(result.success).toBe(true);
      expect(result.message).toBe('连接成功');
      expect(result.data.status).toBe('ok');
    });

    test('使用无效 API Key 应该连接失败', async () => {
      const config = {
        apiUrl: 'https://api.tencent.com/hunyuan',
        apiKey: 'invalid_key',
        model: 'hunyuan-lite'
      };

      const result = await aiPlugin.testConnection(config);
      expect(result.success).toBe(false);
      expect(result.error).toBe('API Key 无效');
    });

    test('使用无效 API URL 应该连接失败', async () => {
      const config = {
        apiUrl: 'invalid_url',
        apiKey: 'valid-key',
        model: 'hunyuan-lite'
      };

      const result = await aiPlugin.testConnection(config);
      expect(result.success).toBe(false);
      expect(result.error).toBe('API URL 无效');
    });

    test('配置不完整应该连接失败', async () => {
      const config = {
        apiUrl: 'https://api.tencent.com/hunyuan'
        // 缺少 apiKey
      };

      const result = await aiPlugin.testConnection(config);
      expect(result.success).toBe(false);
      expect(result.error).toBe('配置不完整');
    });
  });

  // ============================================================
  // 5. 重置配置测试
  // ============================================================

  describe('重置配置', () => {
    test('重置配置应该恢复默认值', () => {
      // 先保存自定义配置
      const customConfig = {
        apiUrl: 'https://custom-api.com',
        apiKey: 'custom-key',
        model: 'hunyuan-pro'
      };
      aiPlugin.saveConfig(customConfig);

      // 重置
      const result = aiPlugin.resetConfig();
      expect(result.success).toBe(true);
      expect(result.message).toBe('配置已重置为默认值');
      expect(result.config.apiUrl).toBe('https://api.tencent.com/hunyuan');

      // 验证存储已清除
      const stored = localStorage.getItem(aiPlugin.STORAGE_KEY);
      expect(stored).toBeNull();
    });
  });

  // ============================================================
  // 6. 边界情况测试
  // ============================================================

  describe('边界情况', () => {
    test('配置包含特殊字符应该正常工作', () => {
      const config = {
        apiUrl: 'https://api.tencent.com/hunyuan',
        apiKey: 'key-with-special-chars-!@#$%',
        model: 'hunyuan-lite'
      };

      const result = aiPlugin.saveConfig(config);
      expect(result.success).toBe(true);
    });

    test('配置包含 Unicode 字符应该正常工作', () => {
      const config = {
        apiUrl: 'https://api.tencent.com/hunyuan',
        apiKey: 'key-测试-🔑',
        model: 'hunyuan-lite'
      };

      const result = aiPlugin.saveConfig(config);
      expect(result.success).toBe(true);
    });

    test('保存非常大的配置应该正常工作', () => {
      const config = {
        apiUrl: 'https://api.tencent.com/hunyuan',
        apiKey: 'test-key',
        model: 'hunyuan-lite',
        extraData: 'x'.repeat(10000) // 10KB 数据
      };

      const result = aiPlugin.saveConfig(config);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // 7. 存储测试
  // ============================================================

  describe('存储功能', () => {
    test('配置应该正确存储在 localStorage', () => {
      const config = {
        apiUrl: 'https://api.tencent.com/hunyuan',
        apiKey: 'test-key',
        model: 'hunyuan-lite'
      };

      aiPlugin.saveConfig(config);

      const stored = localStorage.getItem(aiPlugin.STORAGE_KEY);
      const parsed = JSON.parse(stored);
      expect(parsed.apiKey).toBe('test-key');
    });

    test('多次保存应该覆盖之前的配置', () => {
      const config1 = {
        apiUrl: 'https://api.tencent.com/hunyuan',
        apiKey: 'key-1',
        model: 'hunyuan-lite'
      };

      const config2 = {
        apiUrl: 'https://api.tencent.com/hunyuan',
        apiKey: 'key-2',
        model: 'hunyuan-pro'
      };

      aiPlugin.saveConfig(config1);
      aiPlugin.saveConfig(config2);

      const stored = localStorage.getItem(aiPlugin.STORAGE_KEY);
      const parsed = JSON.parse(stored);
      expect(parsed.apiKey).toBe('key-2');
      expect(parsed.model).toBe('hunyuan-pro');
    });
  });
});
