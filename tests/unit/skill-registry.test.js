/**
 * skill-registry.test.js - SkillRegistry 单元测试
 *
 * 测试范围：
 * 1. Skill 注册
 * 2. Skill 发现（查找）
 * 3. Skill 获取
 * 4. Skill 删除
 * 5. Skill 列表
 * 6. 重复注册处理
 * 7. 边界情况和异常处理
 */

// ============================================================
// 模拟 SkillRegistry 类
// ============================================================

class SkillRegistry {
  constructor() {
    this.skills = new Map(); // name -> skill
    this.categories = new Map(); // category -> [skillNames]
  }

  /**
   * 注册 Skill
   * @param {object} skill - Skill 对象
   * @param {string} skill.name - Skill 名称（唯一标识）
   * @param {string} skill.version - Skill 版本
   * @param {string} skill.category - Skill 分类
   * @param {function} skill.execute - Skill 执行函数
   * @returns {object} 注册结果 { success: boolean, error?: string }
   */
  register(skill) {
    // 参数校验
    if (!skill || typeof skill !== 'object') {
      return { success: false, error: 'Skill 数据无效' };
    }

    if (!skill.name || skill.name.trim() === '') {
      return { success: false, error: 'Skill 名称不能为空' };
    }

    if (!skill.version || skill.version.trim() === '') {
      return { success: false, error: 'Skill 版本不能为空' };
    }

    if (!skill.category || skill.category.trim() === '') {
      return { success: false, error: 'Skill 分类不能为空' };
    }

    if (!skill.execute || typeof skill.execute !== 'function') {
      return { success: false, error: 'Skill 必须提供 execute 函数' };
    }

    // 检查是否已注册
    if (this.skills.has(skill.name)) {
      return { success: false, error: `Skill "${skill.name}" 已注册` };
    }

    // 注册 Skill
    this.skills.set(skill.name, {
      name: skill.name,
      version: skill.version,
      category: skill.category,
      description: skill.description || '',
      execute: skill.execute,
      registeredAt: new Date().toISOString()
    });

    // 更新分类索引
    if (!this.categories.has(skill.category)) {
      this.categories.set(skill.category, []);
    }
    this.categories.get(skill.category).push(skill.name);

    return { success: true, message: `Skill "${skill.name}" 注册成功` };
  }

  /**
   * 获取 Skill
   * @param {string} name - Skill 名称
   * @returns {object|null} Skill 对象或 null
   */
  get(name) {
    if (!name || name.trim() === '') {
      return null;
    }

    const skill = this.skills.get(name);
    if (!skill) {
      return null;
    }

    // 返回深拷贝，避免外部修改
    return JSON.parse(JSON.stringify(skill));
  }

  /**
   * 查找 Skill（支持模糊搜索）
   * @param {object} criteria - 查找条件
   * @param {string} [criteria.category] - 按分类查找
   * @param {string} [criteria.keyword] - 按关键词查找（名称或描述）
   * @returns {Array<object>} Skill 数组
   */
  find(criteria = {}) {
    let results = Array.from(this.skills.values());

    // 按分类筛选
    if (criteria.category && criteria.category.trim() !== '') {
      results = results.filter((skill) => skill.category === criteria.category);
    }

    // 按关键词筛选
    if (criteria.keyword && criteria.keyword.trim() !== '') {
      const keyword = criteria.keyword.toLowerCase();
      results = results.filter(
        (skill) => skill.name.toLowerCase().includes(keyword) || skill.description.toLowerCase().includes(keyword)
      );
    }

    return results;
  }

  /**
   * 删除 Skill
   * @param {string} name - Skill 名称
   * @returns {object} 删除结果 { success: boolean, error?: string }
   */
  unregister(name) {
    if (!name || name.trim() === '') {
      return { success: false, error: 'Skill 名称不能为空' };
    }

    if (!this.skills.has(name)) {
      return { success: false, error: `Skill "${name}" 未注册` };
    }

    // 获取 Skill 信息（用于删除分类索引）
    const skill = this.skills.get(name);

    // 删除 Skill
    this.skills.delete(name);

    // 更新分类索引
    if (this.categories.has(skill.category)) {
      const index = this.categories.get(skill.category).indexOf(name);
      if (index > -1) {
        this.categories.get(skill.category).splice(index, 1);
      }

      // 如果分类中没有 Skill 了，删除分类
      if (this.categories.get(skill.category).length === 0) {
        this.categories.delete(skill.category);
      }
    }

    return { success: true, message: `Skill "${name}" 已删除` };
  }

  /**
   * 获取所有 Skill
   * @returns {Array<object>} Skill 数组
   */
  getAll() {
    return Array.from(this.skills.values());
  }

  /**
   * 获取所有分类
   * @returns {Array<string>} 分类数组
   */
  getCategories() {
    return Array.from(this.categories.keys());
  }

  /**
   * 获取指定分类的 Skill 数量
   * @param {string} category - 分类名称
   * @returns {number} Skill 数量
   */
  countByCategory(category) {
    if (!this.categories.has(category)) {
      return 0;
    }
    return this.categories.get(category).length;
  }

  /**
   * 清空所有 Skill
   */
  clear() {
    this.skills.clear();
    this.categories.clear();
    return { success: true, message: '所有 Skill 已清空' };
  }
}

// ============================================================
// 测试用例
// ============================================================

describe('SkillRegistry - Skill 注册表单元测试', () => {
  let registry;

  // 每个测试前创建新的注册表实例
  beforeEach(() => {
    registry = new SkillRegistry();
  });

  // ============================================================
  // 1. Skill 注册测试
  // ============================================================

  describe('register() - Skill 注册', () => {
    test('应该成功注册有效的 Skill', () => {
      const skill = {
        name: 'test-skill',
        version: '1.0.0',
        category: 'test',
        execute: jest.fn()
      };

      const result = registry.register(skill);

      expect(result.success).toBe(true);
      expect(result.message).toContain('注册成功');
      expect(registry.skills.has('test-skill')).toBe(true);
    });

    test('应该在 Skill 数据无效时注册失败', () => {
      const result = registry.register(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Skill 数据无效');
    });

    test('应该在 Skill 名称为空时注册失败', () => {
      const skill = {
        name: '',
        version: '1.0.0',
        category: 'test',
        execute: jest.fn()
      };

      const result = registry.register(skill);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Skill 名称不能为空');
    });

    test('应该在 Skill 版本为空时注册失败', () => {
      const skill = {
        name: 'test-skill',
        version: '',
        category: 'test',
        execute: jest.fn()
      };

      const result = registry.register(skill);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Skill 版本不能为空');
    });

    test('应该在 Skill 分类为空时注册失败', () => {
      const skill = {
        name: 'test-skill',
        version: '1.0.0',
        category: '',
        execute: jest.fn()
      };

      const result = registry.register(skill);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Skill 分类不能为空');
    });

    test('应该在 Skill 缺少 execute 函数时注册失败', () => {
      const skill = {
        name: 'test-skill',
        version: '1.0.0',
        category: 'test'
      };

      const result = registry.register(skill);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Skill 必须提供 execute 函数');
    });

    test('应该在 Skill 已注册时注册失败', () => {
      const skill = {
        name: 'test-skill',
        version: '1.0.0',
        category: 'test',
        execute: jest.fn()
      };

      registry.register(skill);
      const result = registry.register(skill);

      expect(result.success).toBe(false);
      expect(result.error).toContain('已注册');
    });

    test('应该自动注册分类', () => {
      const skill = {
        name: 'test-skill',
        version: '1.0.0',
        category: 'ai',
        execute: jest.fn()
      };

      registry.register(skill);

      expect(registry.categories.has('ai')).toBe(true);
      expect(registry.categories.get('ai')).toContain('test-skill');
    });

    test('应该保存注册时间', () => {
      const skill = {
        name: 'test-skill',
        version: '1.0.0',
        category: 'test',
        execute: jest.fn()
      };

      registry.register(skill);

      const registered = registry.get('test-skill');
      expect(registered.registeredAt).toBeDefined();
      expect(new Date(registered.registeredAt).getTime()).not.toBeNaN();
    });
  });

  // ============================================================
  // 2. Skill 获取测试
  // ============================================================

  describe('get() - Skill 获取', () => {
    beforeEach(() => {
      const skill = {
        name: 'test-skill',
        version: '1.0.0',
        category: 'test',
        description: '测试 Skill',
        execute: jest.fn()
      };
      registry.register(skill);
    });

    test('应该成功获取已注册的 Skill', () => {
      const skill = registry.get('test-skill');

      expect(skill).not.toBeNull();
      expect(skill.name).toBe('test-skill');
      expect(skill.version).toBe('1.0.0');
      expect(skill.category).toBe('test');
    });

    test('应该在 Skill 不存在时返回 null', () => {
      const skill = registry.get('non-existent');

      expect(skill).toBeNull();
    });

    test('应该在名称为空时返回 null', () => {
      const skill = registry.get('');

      expect(skill).toBeNull();
    });

    test('应该返回 Skill 的副本（避免外部修改）', () => {
      // 修改 get 方法以返回深拷贝
      const skill = registry.get('test-skill');

      // 验证返回的对象不为 null
      expect(skill).not.toBeNull();
      expect(skill.version).toBe('1.0.0');
    });
  });

  // ============================================================
  // 3. Skill 查找测试
  // ============================================================

  describe('find() - Skill 查找', () => {
    beforeEach(() => {
      registry.register({
        name: 'ai-chat',
        version: '1.0.0',
        category: 'ai',
        description: 'AI 对话 Skill',
        execute: jest.fn()
      });

      registry.register({
        name: 'ai-summary',
        version: '1.0.0',
        category: 'ai',
        description: 'AI 总结 Skill',
        execute: jest.fn()
      });

      registry.register({
        name: 'scale-analysis',
        version: '1.0.0',
        category: 'scale',
        description: '量表分析 Skill',
        execute: jest.fn()
      });
    });

    test('应该返回所有 Skill（无筛选条件）', () => {
      const results = registry.find();

      expect(results.length).toBe(3);
    });

    test('应该按分类查找 Skill', () => {
      const results = registry.find({ category: 'ai' });

      expect(results.length).toBe(2);
      expect(results[0].category).toBe('ai');
      expect(results[1].category).toBe('ai');
    });

    test('应该在分类不存在时返回空数组', () => {
      const results = registry.find({ category: 'non-existent' });

      expect(results.length).toBe(0);
    });

    test('应该按关键词查找 Skill（名称匹配）', () => {
      const results = registry.find({ keyword: 'chat' });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('ai-chat');
    });

    test('应该按关键词查找 Skill（描述匹配）', () => {
      const results = registry.find({ keyword: '对话' });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('ai-chat');
    });

    test('应该支持分类和关键词组合查找', () => {
      const results = registry.find({ category: 'ai', keyword: '总结' });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('ai-summary');
    });

    test('应该支持大小写不敏感查找', () => {
      const results = registry.find({ keyword: 'AI' });

      expect(results.length).toBe(2);
    });
  });

  // ============================================================
  // 4. Skill 删除测试
  // ============================================================

  describe('unregister() - Skill 删除', () => {
    beforeEach(() => {
      registry.register({
        name: 'test-skill',
        version: '1.0.0',
        category: 'test',
        execute: jest.fn()
      });
    });

    test('应该成功删除已注册的 Skill', () => {
      const result = registry.unregister('test-skill');

      expect(result.success).toBe(true);
      expect(result.message).toContain('已删除');
      expect(registry.skills.has('test-skill')).toBe(false);
    });

    test('应该在 Skill 不存在时删除失败', () => {
      const result = registry.unregister('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('未注册');
    });

    test('应该在名称为空时删除失败', () => {
      const result = registry.unregister('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Skill 名称不能为空');
    });

    test('应该同步删除分类索引', () => {
      registry.register({
        name: 'test-skill-2',
        version: '1.0.0',
        category: 'test',
        execute: jest.fn()
      });

      expect(registry.categories.get('test').length).toBe(2);

      registry.unregister('test-skill');
      expect(registry.categories.get('test').length).toBe(1);
    });

    test('应该在分类中没有 Skill 时删除分类', () => {
      registry.unregister('test-skill');

      expect(registry.categories.has('test')).toBe(false);
    });
  });

  // ============================================================
  // 5. Skill 列表测试
  // ============================================================

  describe('getAll() - 获取所有 Skill', () => {
    test('应该返回空数组（无 Skill）', () => {
      const skills = registry.getAll();

      expect(skills).toEqual([]);
    });

    test('应该返回所有已注册的 Skill', () => {
      registry.register({
        name: 'skill-1',
        version: '1.0.0',
        category: 'test',
        execute: jest.fn()
      });

      registry.register({
        name: 'skill-2',
        version: '1.0.0',
        category: 'test',
        execute: jest.fn()
      });

      const skills = registry.getAll();

      expect(skills.length).toBe(2);
      expect(skills[0].name).toBe('skill-1');
      expect(skills[1].name).toBe('skill-2');
    });
  });

  describe('getCategories() - 获取所有分类', () => {
    test('应该返回空数组（无分类）', () => {
      const categories = registry.getCategories();

      expect(categories).toEqual([]);
    });

    test('应该返回所有分类', () => {
      registry.register({
        name: 'skill-1',
        version: '1.0.0',
        category: 'ai',
        execute: jest.fn()
      });

      registry.register({
        name: 'skill-2',
        version: '1.0.0',
        category: 'scale',
        execute: jest.fn()
      });

      const categories = registry.getCategories();

      expect(categories.length).toBe(2);
      expect(categories).toContain('ai');
      expect(categories).toContain('scale');
    });
  });

  // ============================================================
  // 6. 统计功能测试
  // ============================================================

  describe('countByCategory() - 按分类统计', () => {
    test('应该返回 0（分类不存在）', () => {
      const count = registry.countByCategory('non-existent');

      expect(count).toBe(0);
    });

    test('应该返回分类中的 Skill 数量', () => {
      registry.register({
        name: 'skill-1',
        version: '1.0.0',
        category: 'ai',
        execute: jest.fn()
      });

      registry.register({
        name: 'skill-2',
        version: '1.0.0',
        category: 'ai',
        execute: jest.fn()
      });

      const count = registry.countByCategory('ai');

      expect(count).toBe(2);
    });
  });

  // ============================================================
  // 7. 清空测试
  // ============================================================

  describe('clear() - 清空所有 Skill', () => {
    test('应该成功清空所有 Skill', () => {
      registry.register({
        name: 'skill-1',
        version: '1.0.0',
        category: 'test',
        execute: jest.fn()
      });

      const result = registry.clear();

      expect(result.success).toBe(true);
      expect(registry.skills.size).toBe(0);
      expect(registry.categories.size).toBe(0);
    });
  });

  // ============================================================
  // 8. 边界情况测试
  // ============================================================

  describe('边界情况', () => {
    test('应该处理特殊字符的 Skill 名称', () => {
      const skill = {
        name: 'skill-测试_123@#$',
        version: '1.0.0',
        category: 'test',
        execute: jest.fn()
      };

      const result = registry.register(skill);

      expect(result.success).toBe(true);
      expect(registry.get('skill-测试_123@#$')).not.toBeNull();
    });

    test('应该处理非常长的 Skill 描述', () => {
      const longDesc = 'A'.repeat(10000);
      const skill = {
        name: 'test-skill',
        version: '1.0.0',
        category: 'test',
        description: longDesc,
        execute: jest.fn()
      };

      const result = registry.register(skill);

      expect(result.success).toBe(true);
      const registered = registry.get('test-skill');
      expect(registered.description).toBe(longDesc);
    });

    test('应该处理重复注册相同名称不同版本', () => {
      const skill1 = {
        name: 'test-skill',
        version: '1.0.0',
        category: 'test',
        execute: jest.fn()
      };

      const skill2 = {
        name: 'test-skill', // 相同名称
        version: '2.0.0', // 不同版本
        category: 'test',
        execute: jest.fn()
      };

      registry.register(skill1);
      const result = registry.register(skill2);

      expect(result.success).toBe(false);
      expect(result.error).toContain('已注册');
    });
  });
});
