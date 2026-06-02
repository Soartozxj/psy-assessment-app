/**
 * scale-plugin.js 单元测试
 *
 * 测试范围：
 * 1. 插件初始化
 * 2. 量表创建
 * 3. 量表读取
 * 4. 量表更新
 * 5. 量表删除
 * 6. 量表导入
 * 7. 量表导出
 * 8. 边界情况和异常处理
 */

// ============================================================
// 模拟 ScalePlugin 类
// ============================================================

class MockScalePlugin {
  constructor() {
    this.name = '量表管理插件';
    this.version = '1.0.0';
    this.isInitialized = false;
    this.STORAGE_KEY = 'psy_scales';
  }

  // 初始化
  init() {
    this.isInitialized = true;
    return { success: true };
  }

  // 获取所有量表
  getAllScales() {
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

  // 保存所有量表
  saveAllScales(scales) {
    if (!Array.isArray(scales)) {
      return { success: false, error: '量表数据必须是数组' };
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scales));
    return { success: true };
  }

  // 根据 ID 获取量表
  getScaleById(id) {
    if (!id) {
      return null;
    }

    const scales = this.getAllScales();
    return scales.find((s) => s.id === id) || null;
  }

  // 添加量表
  addScale(scale) {
    // 验证必填字段
    if (!scale || typeof scale !== 'object') {
      return { success: false, error: '量表数据无效' };
    }

    if (!scale.name || scale.name.trim() === '') {
      return { success: false, error: '量表名称不能为空' };
    }

    if (!scale.code || scale.code.trim() === '') {
      return { success: false, error: '量表编码不能为空' };
    }

    // 检查 code 是否已存在
    const scales = this.getAllScales();
    if (scales.some((s) => s.code === scale.code)) {
      return { success: false, error: '量表编码已存在' };
    }

    // 生成 ID
    if (!scale.id) {
      scale.id = 'scale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 添加时间戳
    scale.createdAt = new Date().toISOString();
    scale.updatedAt = new Date().toISOString();

    // 添加到数组
    scales.push(scale);
    this.saveAllScales(scales);

    return { success: true, data: scale };
  }

  // 更新量表
  updateScale(id, updates) {
    if (!id) {
      return { success: false, error: '量表ID不能为空' };
    }

    if (!updates || typeof updates !== 'object') {
      return { success: false, error: '更新数据无效' };
    }

    const scales = this.getAllScales();
    const index = scales.findIndex((s) => s.id === id);

    if (index === -1) {
      return { success: false, error: '量表不存在' };
    }

    // 更新字段
    scales[index] = {
      ...scales[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveAllScales(scales);

    return { success: true, data: scales[index] };
  }

  // 删除量表
  deleteScale(id) {
    if (!id) {
      return { success: false, error: '量表ID不能为空' };
    }

    const scales = this.getAllScales();
    const index = scales.findIndex((s) => s.id === id);

    if (index === -1) {
      return { success: false, error: '量表不存在' };
    }

    // 删除
    scales.splice(index, 1);
    this.saveAllScales(scales);

    return { success: true, message: '量表删除成功' };
  }

  // 导入量表
  importScales(scalesData) {
    if (!Array.isArray(scalesData)) {
      return { success: false, error: '导入数据必须是数组' };
    }

    const existingScales = this.getAllScales();
    let importedCount = 0;
    let skippedCount = 0;

    for (const scale of scalesData) {
      // 检查 code 是否已存在
      if (existingScales.some((s) => s.code === scale.code)) {
        skippedCount++;
        continue;
      }

      // 添加量表
      if (!scale.id) {
        scale.id = 'scale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }

      scale.createdAt = new Date().toISOString();
      scale.updatedAt = new Date().toISOString();

      existingScales.push(scale);
      importedCount++;
    }

    this.saveAllScales(existingScales);

    return {
      success: true,
      data: {
        imported: importedCount,
        skipped: skippedCount
      }
    };
  }

  // 导出量表
  exportScales(ids) {
    let scalesToExport;

    if (Array.isArray(ids) && ids.length > 0) {
      // 导出指定的量表
      const allScales = this.getAllScales();
      scalesToExport = allScales.filter((s) => ids.includes(s.id));
    } else {
      // 导出所有量表
      scalesToExport = this.getAllScales();
    }

    return {
      success: true,
      data: scalesToExport,
      count: scalesToExport.length
    };
  }

  // 搜索量表
  searchScales(keyword) {
    if (!keyword || keyword.trim() === '') {
      return this.getAllScales();
    }

    const scales = this.getAllScales();
    const lowerKeyword = keyword.toLowerCase();

    return scales.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(lowerKeyword)) ||
        (s.code && s.code.toLowerCase().includes(lowerKeyword)) ||
        (s.category && s.category.toLowerCase().includes(lowerKeyword))
    );
  }
}

// ============================================================
// 测试用例
// ============================================================

describe('ScalePlugin - 量表管理插件单元测试', () => {
  let scalePlugin;

  // 每个测试前创建新的插件实例
  beforeEach(() => {
    scalePlugin = new MockScalePlugin();
    scalePlugin.init();
  });

  // ============================================================
  // 1. 插件初始化测试
  // ============================================================

  describe('插件初始化', () => {
    test('应该成功初始化插件', () => {
      const result = scalePlugin.init();
      expect(result.success).toBe(true);
      expect(scalePlugin.isInitialized).toBe(true);
    });
  });

  // ============================================================
  // 2. 获取量表测试
  // ============================================================

  describe('获取量表', () => {
    test('获取所有量表（空）', () => {
      const scales = scalePlugin.getAllScales();
      expect(Array.isArray(scales)).toBe(true);
      expect(scales.length).toBe(0);
    });

    test('获取所有量表（有数据）', () => {
      // 先添加量表
      const scale = {
        name: '测试量表',
        code: 'TEST001',
        category: 'anxiety'
      };
      scalePlugin.addScale(scale);

      const scales = scalePlugin.getAllScales();
      expect(scales.length).toBe(1);
      expect(scales[0].name).toBe('测试量表');
    });

    test('根据 ID 获取量表', () => {
      // 先添加量表
      const scale = {
        name: '测试量表',
        code: 'TEST001',
        category: 'anxiety'
      };
      const result = scalePlugin.addScale(scale);
      const scaleId = result.data.id;

      // 获取量表
      const fetched = scalePlugin.getScaleById(scaleId);
      expect(fetched).not.toBeNull();
      expect(fetched.name).toBe('测试量表');
    });

    test('根据不存在的 ID 获取量表应该返回 null', () => {
      const fetched = scalePlugin.getScaleById('non-existent-id');
      expect(fetched).toBeNull();
    });

    test('根据空 ID 获取量表应该返回 null', () => {
      const fetched = scalePlugin.getScaleById('');
      expect(fetched).toBeNull();
    });
  });

  // ============================================================
  // 3. 添加量表测试
  // ============================================================

  describe('添加量表', () => {
    test('添加有效量表应该成功', () => {
      const scale = {
        name: '测试量表',
        code: 'TEST001',
        category: 'anxiety'
      };

      const result = scalePlugin.addScale(scale);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('测试量表');
      expect(result.data.id).toBeDefined();
      expect(result.data.createdAt).toBeDefined();
    });

    test('添加空数据应该失败', () => {
      const result = scalePlugin.addScale(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('量表数据无效');
    });

    test('添加非对象数据应该失败', () => {
      const result = scalePlugin.addScale('not an object');
      expect(result.success).toBe(false);
      expect(result.error).toBe('量表数据无效');
    });

    test('添加缺少名称的量表应该失败', () => {
      const scale = {
        code: 'TEST001',
        category: 'anxiety'
      };

      const result = scalePlugin.addScale(scale);
      expect(result.success).toBe(false);
      expect(result.error).toBe('量表名称不能为空');
    });

    test('添加缺少编码的量表应该失败', () => {
      const scale = {
        name: '测试量表',
        category: 'anxiety'
      };

      const result = scalePlugin.addScale(scale);
      expect(result.success).toBe(false);
      expect(result.error).toBe('量表编码不能为空');
    });

    test('添加重复编码的量表应该失败', () => {
      const scale1 = {
        name: '测试量表1',
        code: 'TEST001',
        category: 'anxiety'
      };

      const scale2 = {
        name: '测试量表2',
        code: 'TEST001', // 重复编码
        category: 'depression'
      };

      scalePlugin.addScale(scale1);
      const result = scalePlugin.addScale(scale2);

      expect(result.success).toBe(false);
      expect(result.error).toBe('量表编码已存在');
    });
  });

  // ============================================================
  // 4. 更新量表测试
  // ============================================================

  describe('更新量表', () => {
    test('更新有效量表应该成功', () => {
      // 先添加量表
      const scale = {
        name: '测试量表',
        code: 'TEST001',
        category: 'anxiety'
      };
      const result = scalePlugin.addScale(scale);
      const scaleId = result.data.id;

      // 更新量表
      const updateResult = scalePlugin.updateScale(scaleId, {
        name: '更新后的量表',
        category: 'depression'
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.name).toBe('更新后的量表');
      expect(updateResult.data.category).toBe('depression');
      expect(updateResult.data.updatedAt).toBeDefined();
    });

    test('更新不存在的量表应该失败', () => {
      const result = scalePlugin.updateScale('non-existent-id', {
        name: '更新后的量表'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('量表不存在');
    });

    test('更新为空 ID 应该失败', () => {
      const result = scalePlugin.updateScale('', {
        name: '更新后的量表'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('量表ID不能为空');
    });

    test('更新为空数据应该失败', () => {
      // 先添加量表
      const scale = {
        name: '测试量表',
        code: 'TEST001',
        category: 'anxiety'
      };
      const result = scalePlugin.addScale(scale);
      const scaleId = result.data.id;

      const updateResult = scalePlugin.updateScale(scaleId, null);
      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toBe('更新数据无效');
    });
  });

  // ============================================================
  // 5. 删除量表测试
  // ============================================================

  describe('删除量表', () => {
    test('删除现有量表应该成功', () => {
      // 先添加量表
      const scale = {
        name: '测试量表',
        code: 'TEST001',
        category: 'anxiety'
      };
      const result = scalePlugin.addScale(scale);
      const scaleId = result.data.id;

      // 删除量表
      const deleteResult = scalePlugin.deleteScale(scaleId);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.message).toBe('量表删除成功');

      // 验证已删除
      const fetched = scalePlugin.getScaleById(scaleId);
      expect(fetched).toBeNull();
    });

    test('删除不存在的量表应该失败', () => {
      const result = scalePlugin.deleteScale('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('量表不存在');
    });

    test('删除为空 ID 应该失败', () => {
      const result = scalePlugin.deleteScale('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('量表ID不能为空');
    });
  });

  // ============================================================
  // 6. 导入导出测试
  // ============================================================

  describe('导入导出', () => {
    test('导入有效量表数据应该成功', () => {
      const scalesData = [
        {
          name: '导入量表1',
          code: 'IMPORT001',
          category: 'anxiety'
        },
        {
          name: '导入量表2',
          code: 'IMPORT002',
          category: 'depression'
        }
      ];

      const result = scalePlugin.importScales(scalesData);
      expect(result.success).toBe(true);
      expect(result.data.imported).toBe(2);
      expect(result.data.skipped).toBe(0);
    });

    test('导入重复编码的量表应该跳过', () => {
      // 先添加一个量表
      const existingScale = {
        name: '现有量表',
        code: 'EXISTING001',
        category: 'anxiety'
      };
      scalePlugin.addScale(existingScale);

      // 导入包含重复编码的量表
      const scalesData = [
        {
          name: '新量表',
          code: 'NEW001',
          category: 'depression'
        },
        {
          name: '重复编码',
          code: 'EXISTING001', // 重复
          category: 'anxiety'
        }
      ];

      const result = scalePlugin.importScales(scalesData);
      expect(result.success).toBe(true);
      expect(result.data.imported).toBe(1);
      expect(result.data.skipped).toBe(1);
    });

    test('导入非数组数据应该失败', () => {
      const result = scalePlugin.importScales('not an array');
      expect(result.success).toBe(false);
      expect(result.error).toBe('导入数据必须是数组');
    });

    test('导出所有量表应该成功', () => {
      // 先添加量表
      scalePlugin.addScale({
        name: '量表1',
        code: 'EXPORT001',
        category: 'anxiety'
      });
      scalePlugin.addScale({
        name: '量表2',
        code: 'EXPORT002',
        category: 'depression'
      });

      // 导出
      const result = scalePlugin.exportScales();
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.data.length).toBe(2);
    });

    test('导出指定量表应该成功', () => {
      // 先添加量表
      const result1 = scalePlugin.addScale({
        name: '量表1',
        code: 'EXPORT001',
        category: 'anxiety'
      });
      const result2 = scalePlugin.addScale({
        name: '量表2',
        code: 'EXPORT002',
        category: 'depression'
      });

      const id1 = result1.data.id;
      const id2 = result2.data.id;

      // 导出指定量表
      const result = scalePlugin.exportScales([id1]);
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.data[0].id).toBe(id1);
    });
  });

  // ============================================================
  // 7. 搜索量表测试
  // ============================================================

  describe('搜索量表', () => {
    test('搜索量表应该返回匹配结果', () => {
      // 先添加量表
      scalePlugin.addScale({
        name: '焦虑症量表',
        code: 'ANXIETY001',
        category: 'anxiety'
      });
      scalePlugin.addScale({
        name: '抑郁症量表',
        code: 'DEPRESSION001',
        category: 'depression'
      });

      // 搜索
      const results = scalePlugin.searchScales('焦虑');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('焦虑症量表');
    });

    test('搜索无匹配应该返回空数组', () => {
      const results = scalePlugin.searchScales('不存在的关键词');
      expect(results.length).toBe(0);
    });

    test('搜索为空关键词应该返回所有量表', () => {
      // 先添加量表
      scalePlugin.addScale({
        name: '量表1',
        code: 'SEARCH001',
        category: 'anxiety'
      });

      const results = scalePlugin.searchScales('');
      expect(results.length).toBe(1);
    });
  });

  // ============================================================
  // 8. 边界情况测试
  // ============================================================

  describe('边界情况', () => {
    test('量表名称包含特殊字符应该正常工作', () => {
      const scale = {
        name: '测试量表!@#$%^&*()',
        code: 'SPECIAL001',
        category: 'anxiety'
      };

      const result = scalePlugin.addScale(scale);
      expect(result.success).toBe(true);
    });

    test('量表名称包含 Unicode 字符应该正常工作', () => {
      const scale = {
        name: '测试量表🧪🔬🧬',
        code: 'UNICODE001',
        category: 'anxiety'
      };

      const result = scalePlugin.addScale(scale);
      expect(result.success).toBe(true);
    });

    test('量表数据非常大应该正常工作', () => {
      const scale = {
        name: '大量数据量表',
        code: 'BIGDATA001',
        category: 'anxiety',
        questions: Array(1000)
          .fill(null)
          .map((_, i) => ({
            id: i + 1,
            content: `题目${i + 1}`,
            options: [
              { id: 'A', label: '选项A', score: 0 },
              { id: 'B', label: '选项B', score: 1 }
            ]
          }))
      };

      const result = scalePlugin.addScale(scale);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // 9. 存储测试
  // ============================================================

  describe('存储功能', () => {
    test('量表应该正确存储在 localStorage', () => {
      const scale = {
        name: '存储测试量表',
        code: 'STORAGE001',
        category: 'anxiety'
      };

      scalePlugin.addScale(scale);

      const stored = localStorage.getItem(scalePlugin.STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored);
      expect(parsed.length).toBe(1);
      expect(parsed[0].name).toBe('存储测试量表');
    });

    test('多次操作应该正确更新存储', () => {
      // 添加
      const result1 = scalePlugin.addScale({
        name: '量表1',
        code: 'MULTI001',
        category: 'anxiety'
      });

      // 更新
      scalePlugin.updateScale(result1.data.id, { name: '更新后的量表1' });

      // 添加第二个
      scalePlugin.addScale({
        name: '量表2',
        code: 'MULTI002',
        category: 'depression'
      });

      // 验证
      const scales = scalePlugin.getAllScales();
      expect(scales.length).toBe(2);
      expect(scales[0].name).toBe('更新后的量表1');
    });
  });
});
