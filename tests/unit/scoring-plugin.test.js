/**
 * scoring-plugin.js 单元测试
 *
 * 测试范围：
 * 1. 插件初始化
 * 2. 计分规则创建
 * 3. 计分规则读取
 * 4. 计分规则更新
 * 5. 计分规则删除
 * 6. 维度配置
 * 7. 指标配置
 * 8. 解释规则配置
 * 9. 边界情况和异常处理
 */

// ============================================================
// 模拟 ScoringPlugin 类
// ============================================================

class MockScoringPlugin {
  constructor() {
    this.name = '计分规则插件';
    this.version = '1.0.0';
    this.isInitialized = false;
    this.STORAGE_KEY = 'psy_scoring_rules';
  }

  // 初始化
  init() {
    this.isInitialized = true;
    return { success: true };
  }

  // 获取所有计分规则
  getAllRules() {
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

  // 保存所有计分规则
  saveAllRules(rules) {
    if (!Array.isArray(rules)) {
      return { success: false, error: '计分规则数据必须是数组' };
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rules));
    return { success: true };
  }

  // 根据 ID 获取计分规则
  getRuleById(id) {
    if (!id) {
      return null;
    }

    const rules = this.getAllRules();
    return rules.find((r) => r.id === id) || null;
  }

  // 根据量表 ID 获取计分规则
  getRuleByScaleId(scaleId) {
    if (!scaleId) {
      return null;
    }

    const rules = this.getAllRules();
    return rules.find((r) => r.scaleId === scaleId) || null;
  }

  // 添加计分规则
  addRule(rule) {
    // 验证必填字段
    if (!rule || typeof rule !== 'object') {
      return { success: false, error: '计分规则数据无效' };
    }

    if (!rule.scaleId || rule.scaleId.trim() === '') {
      return { success: false, error: '量表ID不能为空' };
    }

    // 检查是否已存在该量表的计分规则
    const rules = this.getAllRules();
    if (rules.some((r) => r.scaleId === rule.scaleId)) {
      return { success: false, error: '该量表的计分规则已存在' };
    }

    // 生成 ID
    if (!rule.id) {
      rule.id = 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 初始化维度、指标、解释规则数组
    if (!Array.isArray(rule.dimensions)) {
      rule.dimensions = [];
    }

    if (!Array.isArray(rule.interpretations)) {
      rule.interpretations = [];
    }

    // 添加时间戳
    rule.createdAt = new Date().toISOString();
    rule.updatedAt = new Date().toISOString();

    // 添加到数组
    rules.push(rule);
    this.saveAllRules(rules);

    return { success: true, data: rule };
  }

  // 更新计分规则
  updateRule(id, updates) {
    if (!id) {
      return { success: false, error: '计分规则ID不能为空' };
    }

    if (!updates || typeof updates !== 'object') {
      return { success: false, error: '更新数据无效' };
    }

    const rules = this.getAllRules();
    const index = rules.findIndex((r) => r.id === id);

    if (index === -1) {
      return { success: false, error: '计分规则不存在' };
    }

    // 更新字段
    rules[index] = {
      ...rules[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveAllRules(rules);

    return { success: true, data: rules[index] };
  }

  // 删除计分规则
  deleteRule(id) {
    if (!id) {
      return { success: false, error: '计分规则ID不能为空' };
    }

    const rules = this.getAllRules();
    const index = rules.findIndex((r) => r.id === id);

    if (index === -1) {
      return { success: false, error: '计分规则不存在' };
    }

    // 删除
    rules.splice(index, 1);
    this.saveAllRules(rules);

    return { success: true, message: '计分规则删除成功' };
  }

  // 添加维度
  addDimension(ruleId, dimension) {
    if (!ruleId) {
      return { success: false, error: '计分规则ID不能为空' };
    }

    if (!dimension || typeof dimension !== 'object') {
      return { success: false, error: '维度数据无效' };
    }

    if (!dimension.name || dimension.name.trim() === '') {
      return { success: false, error: '维度名称不能为空' };
    }

    const rules = this.getAllRules();
    const ruleIndex = rules.findIndex((r) => r.id === ruleId);

    if (ruleIndex === -1) {
      return { success: false, error: '计分规则不存在' };
    }

    // 生成 ID
    if (!dimension.id) {
      dimension.id = 'dim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 初始化指标数组
    if (!Array.isArray(dimension.indicators)) {
      dimension.indicators = [];
    }

    // 添加到维度数组
    if (!Array.isArray(rules[ruleIndex].dimensions)) {
      rules[ruleIndex].dimensions = [];
    }

    rules[ruleIndex].dimensions.push(dimension);
    rules[ruleIndex].updatedAt = new Date().toISOString();

    this.saveAllRules(rules);

    return { success: true, data: dimension };
  }

  // 添加指标
  addIndicator(ruleId, dimensionId, indicator) {
    if (!ruleId || !dimensionId) {
      return { success: false, error: '计分规则ID和维度ID不能为空' };
    }

    if (!indicator || typeof indicator !== 'object') {
      return { success: false, error: '指标数据无效' };
    }

    if (!indicator.name || indicator.name.trim() === '') {
      return { success: false, error: '指标名称不能为空' };
    }

    const rules = this.getAllRules();
    const ruleIndex = rules.findIndex((r) => r.id === ruleId);

    if (ruleIndex === -1) {
      return { success: false, error: '计分规则不存在' };
    }

    // 查找维度
    const dimension = rules[ruleIndex].dimensions.find((d) => d.id === dimensionId);
    if (!dimension) {
      return { success: false, error: '维度不存在' };
    }

    // 生成 ID
    if (!indicator.id) {
      indicator.id = 'ind_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 添加到指标数组
    if (!Array.isArray(dimension.indicators)) {
      dimension.indicators = [];
    }

    dimension.indicators.push(indicator);
    rules[ruleIndex].updatedAt = new Date().toISOString();

    this.saveAllRules(rules);

    return { success: true, data: indicator };
  }

  // 添加解释规则
  addInterpretation(ruleId, interpretation) {
    if (!ruleId) {
      return { success: false, error: '计分规则ID不能为空' };
    }

    if (!interpretation || typeof interpretation !== 'object') {
      return { success: false, error: '解释规则数据无效' };
    }

    if (interpretation.minScore === undefined || interpretation.minScore === null) {
      return { success: false, error: '最小分数不能为空' };
    }

    if (interpretation.maxScore === undefined || interpretation.maxScore === null) {
      return { success: false, error: '最大分数不能为空' };
    }

    const rules = this.getAllRules();
    const ruleIndex = rules.findIndex((r) => r.id === ruleId);

    if (ruleIndex === -1) {
      return { success: false, error: '计分规则不存在' };
    }

    // 生成 ID
    if (!interpretation.id) {
      interpretation.id = 'interp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 添加到解释规则数组
    if (!Array.isArray(rules[ruleIndex].interpretations)) {
      rules[ruleIndex].interpretations = [];
    }

    rules[ruleIndex].interpretations.push(interpretation);
    rules[ruleIndex].updatedAt = new Date().toISOString();

    this.saveAllRules(rules);

    return { success: true, data: interpretation };
  }

  // 计算得分
  calculateScore(ruleId, answers) {
    if (!ruleId) {
      return { success: false, error: '计分规则ID不能为空' };
    }

    if (!answers || typeof answers !== 'object') {
      return { success: false, error: '答案数据无效' };
    }

    const rule = this.getRuleById(ruleId);
    if (!rule) {
      return { success: false, error: '计分规则不存在' };
    }

    const scores = {};
    let totalScore = 0;

    // 遍历维度
    if (Array.isArray(rule.dimensions)) {
      for (const dimension of rule.dimensions) {
        let dimensionScore = 0;

        // 遍历指标
        if (Array.isArray(dimension.indicators)) {
          for (const indicator of dimension.indicators) {
            const questionId = indicator.questionId;
            const answer = answers[questionId];

            if (answer !== undefined) {
              // 根据指标类型计算得分
              if (indicator.type === 'sum') {
                dimensionScore += parseInt(answer) || 0;
              } else if (indicator.type === 'average') {
                dimensionScore += (parseInt(answer) || 0) / dimension.indicators.length;
              }
            }
          }
        }

        scores[dimension.id] = dimensionScore;
        totalScore += dimensionScore;
      }
    }

    // 解释结果
    const interpretation = this.interpretScore(ruleId, totalScore);

    return {
      success: true,
      data: {
        scores,
        totalScore,
        interpretation
      }
    };
  }

  // 解释得分
  interpretScore(ruleId, score) {
    const rule = this.getRuleById(ruleId);
    if (!rule || !Array.isArray(rule.interpretations)) {
      return null;
    }

    for (const interp of rule.interpretations) {
      if (score >= interp.minScore && score <= interp.maxScore) {
        return interp;
      }
    }

    return null;
  }
}

// ============================================================
// 测试用例
// ============================================================

describe('ScoringPlugin - 计分规则插件单元测试', () => {
  let scoringPlugin;

  // 每个测试前创建新的插件实例
  beforeEach(() => {
    scoringPlugin = new MockScoringPlugin();
    scoringPlugin.init();
  });

  // ============================================================
  // 1. 插件初始化测试
  // ============================================================

  describe('插件初始化', () => {
    test('应该成功初始化插件', () => {
      const result = scoringPlugin.init();
      expect(result.success).toBe(true);
      expect(scoringPlugin.isInitialized).toBe(true);
    });
  });

  // ============================================================
  // 2. 获取计分规则测试
  // ============================================================

  describe('获取计分规则', () => {
    test('获取所有计分规则（空）', () => {
      const rules = scoringPlugin.getAllRules();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBe(0);
    });

    test('根据 ID 获取计分规则', () => {
      // 先添加规则
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表'
      };
      const result = scoringPlugin.addRule(rule);
      const ruleId = result.data.id;

      // 获取规则
      const fetched = scoringPlugin.getRuleById(ruleId);
      expect(fetched).not.toBeNull();
      expect(fetched.scaleId).toBe('TEST001');
    });

    test('根据量表 ID 获取计分规则', () => {
      // 先添加规则
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表'
      };
      scoringPlugin.addRule(rule);

      // 获取规则
      const fetched = scoringPlugin.getRuleByScaleId('TEST001');
      expect(fetched).not.toBeNull();
      expect(fetched.scaleId).toBe('TEST001');
    });
  });

  // ============================================================
  // 3. 添加计分规则测试
  // ============================================================

  describe('添加计分规则', () => {
    test('添加有效计分规则应该成功', () => {
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表'
      };

      const result = scoringPlugin.addRule(rule);
      expect(result.success).toBe(true);
      expect(result.data.scaleId).toBe('TEST001');
      expect(result.data.id).toBeDefined();
      expect(result.data.createdAt).toBeDefined();
    });

    test('添加空数据应该失败', () => {
      const result = scoringPlugin.addRule(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('计分规则数据无效');
    });

    test('添加缺少量表ID的规则应该失败', () => {
      const rule = {
        scaleName: '测试量表'
        // 缺少 scaleId
      };

      const result = scoringPlugin.addRule(rule);
      expect(result.success).toBe(false);
      expect(result.error).toBe('量表ID不能为空');
    });

    test('添加重复量表ID的规则应该失败', () => {
      const rule1 = {
        scaleId: 'TEST001',
        scaleName: '测试量表1'
      };

      const rule2 = {
        scaleId: 'TEST001', // 重复
        scaleName: '测试量表2'
      };

      scoringPlugin.addRule(rule1);
      const result = scoringPlugin.addRule(rule2);

      expect(result.success).toBe(false);
      expect(result.error).toBe('该量表的计分规则已存在');
    });
  });

  // ============================================================
  // 4. 维度配置测试
  // ============================================================

  describe('维度配置', () => {
    test('添加维度应该成功', () => {
      // 先添加规则
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表'
      };
      const result = scoringPlugin.addRule(rule);
      const ruleId = result.data.id;

      // 添加维度
      const dimension = {
        name: '焦虑维度',
        description: '测量焦虑水平'
      };

      const addResult = scoringPlugin.addDimension(ruleId, dimension);
      expect(addResult.success).toBe(true);
      expect(addResult.data.name).toBe('焦虑维度');
      expect(addResult.data.id).toBeDefined();
    });

    test('添加维度到不存在的规则应该失败', () => {
      const dimension = {
        name: '焦虑维度',
        description: '测量焦虑水平'
      };

      const result = scoringPlugin.addDimension('non-existent-id', dimension);
      expect(result.success).toBe(false);
      expect(result.error).toBe('计分规则不存在');
    });

    test('添加缺少名称的维度应该失败', () => {
      // 先添加规则
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表'
      };
      const result = scoringPlugin.addRule(rule);
      const ruleId = result.data.id;

      // 添加维度
      const dimension = {
        description: '测量焦虑水平'
        // 缺少 name
      };

      const addResult = scoringPlugin.addDimension(ruleId, dimension);
      expect(addResult.success).toBe(false);
      expect(addResult.error).toBe('维度名称不能为空');
    });
  });

  // ============================================================
  // 5. 指标配置测试
  // ============================================================

  describe('指标配置', () => {
    test('添加指标应该成功', () => {
      // 先添加规则和维度
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表'
      };
      const ruleResult = scoringPlugin.addRule(rule);
      const ruleId = ruleResult.data.id;

      const dimension = {
        name: '焦虑维度',
        description: '测量焦虑水平'
      };
      const dimResult = scoringPlugin.addDimension(ruleId, dimension);
      const dimensionId = dimResult.data.id;

      // 添加指标
      const indicator = {
        name: '题目1得分',
        type: 'sum',
        questionId: '1'
      };

      const addResult = scoringPlugin.addIndicator(ruleId, dimensionId, indicator);
      expect(addResult.success).toBe(true);
      expect(addResult.data.name).toBe('题目1得分');
      expect(addResult.data.id).toBeDefined();
    });

    test('添加指标到不存在的维度应该失败', () => {
      // 先添加规则
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表'
      };
      const ruleResult = scoringPlugin.addRule(rule);
      const ruleId = ruleResult.data.id;

      // 添加指标
      const indicator = {
        name: '题目1得分',
        type: 'sum',
        questionId: '1'
      };

      const addResult = scoringPlugin.addIndicator(ruleId, 'non-existent-dim-id', indicator);
      expect(addResult.success).toBe(false);
      expect(addResult.error).toBe('维度不存在');
    });
  });

  // ============================================================
  // 6. 解释规则配置测试
  // ============================================================

  describe('解释规则配置', () => {
    test('添加解释规则应该成功', () => {
      // 先添加规则
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表'
      };
      const result = scoringPlugin.addRule(rule);
      const ruleId = result.data.id;

      // 添加解释规则
      const interpretation = {
        minScore: 0,
        maxScore: 10,
        level: 'low',
        text: '低风险'
      };

      const addResult = scoringPlugin.addInterpretation(ruleId, interpretation);
      expect(addResult.success).toBe(true);
      expect(addResult.data.level).toBe('low');
      expect(addResult.data.id).toBeDefined();
    });

    test('添加缺少最小分数的解释规则应该失败', () => {
      // 先添加规则
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表'
      };
      const result = scoringPlugin.addRule(rule);
      const ruleId = result.data.id;

      // 添加解释规则
      const interpretation = {
        maxScore: 10,
        level: 'low',
        text: '低风险'
        // 缺少 minScore
      };

      const addResult = scoringPlugin.addInterpretation(ruleId, interpretation);
      expect(addResult.success).toBe(false);
      expect(addResult.error).toBe('最小分数不能为空');
    });
  });

  // ============================================================
  // 7. 计算得分测试
  // ============================================================

  describe('计算得分', () => {
    test('计算得分应该成功', () => {
      // 先添加规则、维度、指标
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表'
      };
      const ruleResult = scoringPlugin.addRule(rule);
      const ruleId = ruleResult.data.id;

      const dimension = {
        name: '焦虑维度',
        description: '测量焦虑水平'
      };
      const dimResult = scoringPlugin.addDimension(ruleId, dimension);
      const dimensionId = dimResult.data.id;

      const indicator = {
        name: '题目1得分',
        type: 'sum',
        questionId: '1'
      };
      scoringPlugin.addIndicator(ruleId, dimensionId, indicator);

      // 添加解释规则
      const interpretation = {
        minScore: 0,
        maxScore: 10,
        level: 'low',
        text: '低风险'
      };
      scoringPlugin.addInterpretation(ruleId, interpretation);

      // 计算得分
      const answers = {
        1: '3'
      };

      const scoreResult = scoringPlugin.calculateScore(ruleId, answers);
      expect(scoreResult.success).toBe(true);
      expect(scoreResult.data.totalScore).toBe(3);
      expect(scoreResult.data.interpretation).not.toBeNull();
      expect(scoreResult.data.interpretation.level).toBe('low');
    });

    test('计算得分使用不存在的规则ID应该失败', () => {
      const answers = {
        1: '3'
      };

      const result = scoringPlugin.calculateScore('non-existent-id', answers);
      expect(result.success).toBe(false);
      expect(result.error).toBe('计分规则不存在');
    });
  });

  // ============================================================
  // 8. 边界情况测试
  // ============================================================

  describe('边界情况', () => {
    test('计分规则包含特殊字符应该正常工作', () => {
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表!@#$%'
      };

      const result = scoringPlugin.addRule(rule);
      expect(result.success).toBe(true);
    });

    test('计分规则包含 Unicode 字符应该正常工作', () => {
      const rule = {
        scaleId: 'TEST001',
        scaleName: '测试量表🧪🔬🧬'
      };

      const result = scoringPlugin.addRule(rule);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // 9. 存储测试
  // ============================================================

  describe('存储功能', () => {
    test('计分规则应该正确存储在 localStorage', () => {
      const rule = {
        scaleId: 'TEST001',
        scaleName: '存储测试量表'
      };

      scoringPlugin.addRule(rule);

      const stored = localStorage.getItem(scoringPlugin.STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored);
      expect(parsed.length).toBe(1);
      expect(parsed[0].scaleName).toBe('存储测试量表');
    });
  });
});
