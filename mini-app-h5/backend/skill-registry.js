/**
 * SkillRegistry - 前端 Skill 注册表（简化版）
 *
 * 功能：
 * 1. 扫描 skills/ 目录中的 .md 文件
 * 2. 解析 frontmatter 元数据
 * 3. 提供 get/getAllMetadata 接口
 *
 * 注意：由于浏览器安全限制，无法直接扫描本地文件系统。
 * 实际部署时，应通过后端 API 获取 Skill 列表。
 * 本实现提供模拟数据和接口，方便前端开发和测试。
 */

class SkillRegistry {
  constructor() {
    this.skills = new Map(); // name -> { metadata, body }
    this.initialized = false;

    // 🚀 性能优化：添加索引和缓存
    this.nameIndex = new Map(); // name -> skill (快速查找)
    this.idIndex = new Map(); // id -> skill (模糊查找)
    this.categoryIndex = new Map(); // category -> [skills] (分类查找)
    this.cache = new Map(); // 查询缓存
    this.lastScanTime = null; // 上次扫描时间
    this.cacheExpiry = 5 * 60 * 1000; // 缓存有效期：5分钟
  }

  /**
   * 初始化：扫描 Skill 目录（已优化：添加索引构建和缓存）
   * @param {string[]} directories - 要扫描的目录列表（后端API路径）
   * @param {boolean} forceRefresh - 是否强制刷新缓存
   */
  async discover(directories = ['/api/skills'], forceRefresh = false) {
    console.log('[SkillRegistry] 开始扫描 Skill 目录...');

    // 🚀 性能优化1：检查缓存是否有效
    if (!forceRefresh && this.lastScanTime && Date.now() - this.lastScanTime < this.cacheExpiry) {
      console.log(`[SkillRegistry] 使用缓存 (${this.skills.size} 个 Skill)`);
      this.initialized = true;
      return;
    }

    try {
      // 方式1：从后端 API 获取 Skill 列表
      if (directories.includes('/api/skills')) {
        const response = await fetch('/api/skills');
        if (response.ok) {
          const raw = await response.json();
          // 兼容包装格式: { code: 0, data: [...] } 或直接 []
          const skills = Array.isArray(raw.data) ? raw.data : (Array.isArray(raw) ? raw : []);
          skills.forEach((skill) => {
            this.skills.set(skill.name, {
              metadata: skill.metadata || { type: skill.type, category: skill.category, icon: skill.icon, note: skill.note },
              body: skill.body || ''
            });
          });

          // 🚀 性能优化2：构建索引
          this._buildIndexes();

          this.initialized = true;
          this.lastScanTime = Date.now();
          console.log(`[SkillRegistry] 从 API 加载了 ${skills.length} 个 Skill`);
          return;
        }
      }

      // 方式2：从 localStorage 加载（开发环境 fallback）
      this._loadFromLocalStorage();

      // 方式3：从预定义数据加载（演示用）
      if (this.skills.size === 0) {
        this._loadDemoData();
      }

      // 🚀 性能优化2：构建索引
      this._buildIndexes();

      this.initialized = true;
      this.lastScanTime = Date.now();
      console.log(`[SkillRegistry] 初始化完成，共 ${this.skills.size} 个 Skill`);
    } catch (error) {
      console.error('[SkillRegistry] 初始化失败:', error);
      // Fallback：加载演示数据
      this._loadDemoData();
      this._buildIndexes();
      this.initialized = true;
      this.lastScanTime = Date.now();
    }
  }

  /**
   * 构建索引（内部方法）
   * 🚀 性能优化：为快速查找构建索引
   */
  _buildIndexes() {
    console.log('[SkillRegistry] 开始构建索引...');

    // 清空旧索引
    this.nameIndex.clear();
    this.idIndex.clear();
    this.categoryIndex.clear();

    // 遍历所有 Skill，构建索引
    this.skills.forEach((value, key) => {
      // 名称索引
      this.nameIndex.set(key, value);

      // ID 索引（模糊查找用）
      if (value.metadata && value.metadata.id) {
        this.idIndex.set(value.metadata.id, value);
      }

      // 分类索引
      if (value.metadata && value.metadata.category) {
        const category = value.metadata.category;
        if (!this.categoryIndex.has(category)) {
          this.categoryIndex.set(category, []);
        }
        this.categoryIndex.get(category).push({ name: key, ...value });
      }
    });

    console.log(
      `[SkillRegistry] 索引构建完成: ${this.nameIndex.size} 个名称索引, ${this.idIndex.size} 个ID索引, ${this.categoryIndex.size} 个分类索引`
    );
  }

  /**
   * 从 localStorage 加载 Skill
   */
  _loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('psy_skills');
      if (saved) {
        const skills = JSON.parse(saved);
        skills.forEach((skill) => {
          this.skills.set(skill.name, {
            metadata: skill.metadata,
            body: skill.body
          });
        });
        console.log(`[SkillRegistry] 从 localStorage 加载了 ${skills.length} 个 Skill`);
      }
    } catch (error) {
      console.warn('[SkillRegistry] 从 localStorage 加载失败:', error);
    }
  }

  /**
   * 加载演示数据（开发环境用）
   */
  _loadDemoData() {
    const demoSkills = [
      {
        name: 'scoring-v3.1',
        metadata: {
          id: 'scoring',
          name: '计分规则提取',
          description: '计分规则提取提示词',
          version: '3.1',
          icon: '🎯',
          note: '修复筛查条件',
          flowSteps: [
            { num: '1', color: 'primary', title: '📝 复制提示词', desc: '点击「📋 复制正文」' },
            { num: '2', color: 'primary', title: '📄 追加内容', desc: '在 AI 对话中追加手册原文' },
            { num: '3', color: 'highlight', title: '📋 使用 AI 输出', desc: '获取 AI 输出结果' }
          ],
          metadata: {
            type: 'system-prompt',
            icon: '🎯',
            note: '修复筛查条件',
            flowSteps: []
          }
        },
        body: '你是一位心理测量学专家，精通各类心理评估量表的计分方法、维度结构、划界标准与解释体系...\n\n（演示内容，实际应从 Skill 文件加载）'
      }
    ];

    demoSkills.forEach((skill) => {
      this.skills.set(skill.name, {
        metadata: skill.metadata,
        body: skill.body
      });
    });
    console.log(`[SkillRegistry] 加载了 ${demoSkills.length} 个演示 Skill`);
  }

  /**
   * 获取所有 Skill 的元数据
   * @returns {object[]} 元数据数组
   */
  getAllMetadata() {
    if (!this.initialized) {
      console.warn('[SkillRegistry] 未初始化，请先调用 discover()');
      return [];
    }

    const result = [];
    this.skills.forEach((value, key) => {
      result.push({
        name: key,
        ...value.metadata
      });
    });
    return result;
  }

  /**
   * 根据名称获取 Skill
   * @param {string} name - Skill 名称
   * @returns {object|null} { metadata, body }
   */
  get(name) {
    if (!this.initialized) {
      console.warn('[SkillRegistry] 未初始化，请先调用 discover()');
      return null;
    }

    return this.skills.get(name) || null;
  }

  /**
   * 根据 ID 查找 Skill（模糊匹配）
   * @param {string} id - 提示词 ID（如 'scoring'）
   * @returns {object|null} { metadata, body }
   */
  getById(id) {
    if (!this.initialized) {
      return null;
    }

    // 精确匹配
    const exact = this.get(id);
    if (exact) {
      return exact;
    }

    // 模糊匹配：查找名称包含 id 的 Skill
    let result = null;
    this.skills.forEach((value, key) => {
      if (key.includes(id) || (value.metadata && value.metadata.id === id)) {
        result = { metadata: value.metadata, body: value.body };
      }
    });
    return result;
  }

  /**
   * 注册 Skill（动态添加）
   * @param {string} name - Skill 名称
   * @param {object} metadata - 元数据
   * @param {string} body - 正文内容
   */
  register(name, metadata, body) {
    this.skills.set(name, { metadata, body });
    console.log(`[SkillRegistry] 注册 Skill: ${name}`);
  }

  /**
   * 保存到 localStorage
   */
  saveToLocalStorage() {
    try {
      const skills = [];
      this.skills.forEach((value, key) => {
        skills.push({
          name: key,
          metadata: value.metadata,
          body: value.body
        });
      });
      localStorage.setItem('psy_skills', JSON.stringify(skills));
      console.log(`[SkillRegistry] 已保存 ${skills.length} 个 Skill 到 localStorage`);
    } catch (error) {
      console.error('[SkillRegistry] 保存到 localStorage 失败:', error);
    }
  }

  /**
   * 清空注册表
   */
  clear() {
    this.skills.clear();
    this.initialized = false;
    console.log('[SkillRegistry] 已清空');
  }
}

// 导出到全局
window.SkillRegistry = SkillRegistry;
console.log('[SkillRegistry] 类已加载');
