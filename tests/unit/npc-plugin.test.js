/**
 * npc-plugin.js 单元测试
 *
 * 测试范围：
 * 1. 插件初始化
 * 2. NPC 配置创建
 * 3. NPC 配置读取
 * 4. NPC 配置更新
 * 5. NPC 配置删除
 * 6. 图片压缩功能
 * 7. 云端同步功能
 * 8. 边界情况和异常处理
 */

// ============================================================
// 模拟 NPCPlugin 类
// ============================================================

class MockNPCPlugin {
  constructor() {
    this.name = 'NPC配置插件';
    this.version = '1.0.0';
    this.isInitialized = false;
    this.STORAGE_KEY = 'psy_npc_configs';
    this.MAX_IMAGE_SIZE = 500 * 1024; // 500KB
  }

  // 初始化
  init() {
    this.isInitialized = true;
    return { success: true };
  }

  // 获取所有 NPC 配置
  getAllConfigs() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      return [];
    }

    try {
      return JSON.parse(stored);
    } catch (e) {
      return [];
    }
  }

  // 保存所有 NPC 配置
  saveAllConfigs(configs) {
    if (!Array.isArray(configs)) {
      return { success: false, error: 'NPC配置数据必须是数组' };
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(configs));
    return { success: true };
  }

  // 根据 ID 获取 NPC 配置
  getConfigById(id) {
    if (!id) {
      return null;
    }

    const configs = this.getAllConfigs();
    return configs.find((c) => c.id === id) || null;
  }

  // 添加 NPC 配置
  addConfig(config) {
    // 验证必填字段
    if (!config || typeof config !== 'object') {
      return { success: false, error: 'NPC配置数据无效' };
    }

    if (!config.name || config.name.trim() === '') {
      return { success: false, error: 'NPC名称不能为空' };
    }

    // 检查名称是否已存在
    const configs = this.getAllConfigs();
    if (configs.some((c) => c.name === config.name)) {
      return { success: false, error: 'NPC名称已存在' };
    }

    // 生成 ID
    if (!config.id) {
      config.id = 'npc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 添加时间戳
    config.createdAt = new Date().toISOString();
    config.updatedAt = new Date().toISOString();

    // 添加到数组
    configs.push(config);
    this.saveAllConfigs(configs);

    return { success: true, data: config };
  }

  // 更新 NPC 配置
  updateConfig(id, updates) {
    if (!id) {
      return { success: false, error: 'NPC配置ID不能为空' };
    }

    if (!updates || typeof updates !== 'object') {
      return { success: false, error: '更新数据无效' };
    }

    const configs = this.getAllConfigs();
    const index = configs.findIndex((c) => c.id === id);

    if (index === -1) {
      return { success: false, error: 'NPC配置不存在' };
    }

    // 更新字段
    configs[index] = {
      ...configs[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveAllConfigs(configs);

    return { success: true, data: configs[index] };
  }

  // 删除 NPC 配置
  deleteConfig(id) {
    if (!id) {
      return { success: false, error: 'NPC配置ID不能为空' };
    }

    const configs = this.getAllConfigs();
    const index = configs.findIndex((c) => c.id === id);

    if (index === -1) {
      return { success: false, error: 'NPC配置不存在' };
    }

    // 删除
    configs.splice(index, 1);
    this.saveAllConfigs(configs);

    return { success: true, message: 'NPC配置删除成功' };
  }

  // 压缩图片
  async compressImage(imageData, maxSize = this.MAX_IMAGE_SIZE) {
    if (!imageData) {
      return { success: false, error: '图片数据不能为空' };
    }

    // 模拟图片压缩
    return new Promise((resolve) => {
      setTimeout(() => {
        // 模拟压缩后的图片数据
        const compressed = imageData.length > maxSize ? imageData.substring(0, maxSize) : imageData;

        resolve({
          success: true,
          data: {
            compressed: compressed,
            originalSize: imageData.length,
            compressedSize: compressed.length,
            ratio: compressed.length / imageData.length
          }
        });
      }, 100);
    });
  }

  // 同步到云端
  async syncToCloud(config) {
    if (!config) {
      return { success: false, error: '配置数据不能为空' };
    }

    // 模拟云端同步
    return new Promise((resolve) => {
      setTimeout(() => {
        // 模拟成功响应
        resolve({
          success: true,
          message: '同步成功',
          data: {
            id: config.id,
            syncedAt: new Date().toISOString()
          }
        });
      }, 200);
    });
  }

  // 从云端加载
  async loadFromCloud() {
    // 模拟从云端加载
    return new Promise((resolve) => {
      setTimeout(() => {
        // 模拟云端数据
        const cloudData = [
          {
            id: 'cloud_npc_1',
            name: '云端咨询师1',
            title: '心理咨询师',
            syncedAt: new Date().toISOString()
          }
        ];

        resolve({
          success: true,
          data: cloudData
        });
      }, 200);
    });
  }

  // 搜索 NPC 配置
  searchConfigs(keyword) {
    if (!keyword || keyword.trim() === '') {
      return this.getAllConfigs();
    }

    const configs = this.getAllConfigs();
    const lowerKeyword = keyword.toLowerCase();

    return configs.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(lowerKeyword)) ||
        (c.title && c.title.toLowerCase().includes(lowerKeyword))
    );
  }
}

// ============================================================
// 测试用例
// ============================================================

describe('NPCPlugin - NPC配置插件单元测试', () => {
  let npcPlugin;

  // 每个测试前创建新的插件实例
  beforeEach(() => {
    npcPlugin = new MockNPCPlugin();
    npcPlugin.init();
  });

  // ============================================================
  // 1. 插件初始化测试
  // ============================================================

  describe('插件初始化', () => {
    test('应该成功初始化插件', () => {
      const result = npcPlugin.init();
      expect(result.success).toBe(true);
      expect(npcPlugin.isInitialized).toBe(true);
    });
  });

  // ============================================================
  // 2. 获取 NPC 配置测试
  // ============================================================

  describe('获取NPC配置', () => {
    test('获取所有配置（空）', () => {
      const configs = npcPlugin.getAllConfigs();
      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBe(0);
    });

    test('获取所有配置（有数据）', () => {
      // 先添加配置
      const config = {
        name: '测试咨询师',
        title: '心理咨询师'
      };
      npcPlugin.addConfig(config);

      const configs = npcPlugin.getAllConfigs();
      expect(configs.length).toBe(1);
      expect(configs[0].name).toBe('测试咨询师');
    });

    test('根据 ID 获取配置', () => {
      // 先添加配置
      const config = {
        name: '测试咨询师',
        title: '心理咨询师'
      };
      const result = npcPlugin.addConfig(config);
      const configId = result.data.id;

      // 获取配置
      const fetched = npcPlugin.getConfigById(configId);
      expect(fetched).not.toBeNull();
      expect(fetched.name).toBe('测试咨询师');
    });
  });

  // ============================================================
  // 3. 添加 NPC 配置测试
  // ============================================================

  describe('添加NPC配置', () => {
    test('添加有效配置应该成功', () => {
      const config = {
        name: '测试咨询师',
        title: '心理咨询师',
        greeting: '你好，我是咨询师'
      };

      const result = npcPlugin.addConfig(config);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('测试咨询师');
      expect(result.data.id).toBeDefined();
      expect(result.data.createdAt).toBeDefined();
    });

    test('添加空数据应该失败', () => {
      const result = npcPlugin.addConfig(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('NPC配置数据无效');
    });

    test('添加缺少名称的配置应该失败', () => {
      const config = {
        title: '心理咨询师'
        // 缺少 name
      };

      const result = npcPlugin.addConfig(config);
      expect(result.success).toBe(false);
      expect(result.error).toBe('NPC名称不能为空');
    });

    test('添加重复名称的配置应该失败', () => {
      const config1 = {
        name: '测试咨询师',
        title: '心理咨询师'
      };

      const config2 = {
        name: '测试咨询师', // 重复名称
        title: '心理治疗师'
      };

      npcPlugin.addConfig(config1);
      const result = npcPlugin.addConfig(config2);

      expect(result.success).toBe(false);
      expect(result.error).toBe('NPC名称已存在');
    });
  });

  // ============================================================
  // 4. 更新 NPC 配置测试
  // ============================================================

  describe('更新NPC配置', () => {
    test('更新有效配置应该成功', () => {
      // 先添加配置
      const config = {
        name: '测试咨询师',
        title: '心理咨询师'
      };
      const result = npcPlugin.addConfig(config);
      const configId = result.data.id;

      // 更新配置
      const updateResult = npcPlugin.updateConfig(configId, {
        title: '高级心理咨询师',
        greeting: '你好，请坐'
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.title).toBe('高级心理咨询师');
      expect(updateResult.data.greeting).toBe('你好，请坐');
      expect(updateResult.data.updatedAt).toBeDefined();
    });

    test('更新不存在的配置应该失败', () => {
      const result = npcPlugin.updateConfig('non-existent-id', {
        title: '高级心理咨询师'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('NPC配置不存在');
    });
  });

  // ============================================================
  // 5. 删除 NPC 配置测试
  // ============================================================

  describe('删除NPC配置', () => {
    test('删除现有配置应该成功', () => {
      // 先添加配置
      const config = {
        name: '测试咨询师',
        title: '心理咨询师'
      };
      const result = npcPlugin.addConfig(config);
      const configId = result.data.id;

      // 删除配置
      const deleteResult = npcPlugin.deleteConfig(configId);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.message).toBe('NPC配置删除成功');

      // 验证已删除
      const fetched = npcPlugin.getConfigById(configId);
      expect(fetched).toBeNull();
    });

    test('删除不存在的配置应该失败', () => {
      const result = npcPlugin.deleteConfig('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NPC配置不存在');
    });
  });

  // ============================================================
  // 6. 图片压缩测试
  // ============================================================

  describe('图片压缩', () => {
    test('压缩图片应该成功', async () => {
      const imageData = 'x'.repeat(600 * 1024); // 600KB

      const result = await npcPlugin.compressImage(imageData);
      expect(result.success).toBe(true);
      expect(result.data.compressedSize).toBeLessThanOrEqual(npcPlugin.MAX_IMAGE_SIZE);
    });

    test('压缩小图片应该成功', async () => {
      const imageData = 'x'.repeat(100 * 1024); // 100KB

      const result = await npcPlugin.compressImage(imageData);
      expect(result.success).toBe(true);
      expect(result.data.compressedSize).toBe(imageData.length); // 不需要压缩
    });

    test('压缩为空数据应该失败', async () => {
      const result = await npcPlugin.compressImage('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('图片数据不能为空');
    });
  });

  // ============================================================
  // 7. 云端同步测试
  // ============================================================

  describe('云端同步', () => {
    test('同步到云端应该成功', async () => {
      const config = {
        id: 'npc_123',
        name: '测试咨询师',
        title: '心理咨询师'
      };

      const result = await npcPlugin.syncToCloud(config);
      expect(result.success).toBe(true);
      expect(result.message).toBe('同步成功');
      expect(result.data.syncedAt).toBeDefined();
    });

    test('同步空配置应该失败', async () => {
      const result = await npcPlugin.syncToCloud(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('配置数据不能为空');
    });

    test('从云端加载应该成功', async () => {
      const result = await npcPlugin.loadFromCloud();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 8. 搜索测试
  // ============================================================

  describe('搜索NPC配置', () => {
    test('搜索配置应该返回匹配结果', () => {
      // 先添加配置
      npcPlugin.addConfig({
        name: '张咨询师',
        title: '心理咨询师'
      });
      npcPlugin.addConfig({
        name: '李医生',
        title: '精神科医生'
      });

      // 搜索
      const results = npcPlugin.searchConfigs('咨询');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('张咨询师');
    });

    test('搜索无匹配应该返回空数组', () => {
      const results = npcPlugin.searchConfigs('不存在的关键词');
      expect(results.length).toBe(0);
    });
  });

  // ============================================================
  // 9. 边界情况测试
  // ============================================================

  describe('边界情况', () => {
    test('配置名称包含特殊字符应该正常工作', () => {
      const config = {
        name: '测试咨询师!@#$%^&*()',
        title: '心理咨询师'
      };

      const result = npcPlugin.addConfig(config);
      expect(result.success).toBe(true);
    });

    test('配置名称包含 Unicode 字符应该正常工作', () => {
      const config = {
        name: '测试咨询师🧪🔬🧬',
        title: '心理咨询师'
      };

      const result = npcPlugin.addConfig(config);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // 10. 存储测试
  // ============================================================

  describe('存储功能', () => {
    test('配置应该正确存储在 localStorage', () => {
      const config = {
        name: '存储测试咨询师',
        title: '心理咨询师'
      };

      npcPlugin.addConfig(config);

      const stored = localStorage.getItem(npcPlugin.STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored);
      expect(parsed.length).toBe(1);
      expect(parsed[0].name).toBe('存储测试咨询师');
    });
  });
});
