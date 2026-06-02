/**
 * 星蓝心镜管理后台 - 共享数据访问层 v1.1
 *
 * 提供统一的数据访问接口，供所有管理页面使用
 * 职责：
 *   - 获取量表数据
 *   - 保存量表配置（含 System Prompt）
 *   - 管理用例库
 *   - 数据同步管理
 *
 * @version 1.1.0
 * @updated 2026-05-20
 */

(function () {
  'use strict';

  // ====================================================
  // 依赖检查
  // ====================================================
  if (typeof SharedData === 'undefined') {
    console.error('[AdminAPI] 依赖缺失: SharedData 未定义，请先引入 shared-data.js');
    return;
  }

  // ====================================================
  // 常量定义
  // ====================================================
  var STORAGE_KEYS = {
    TEST_SUITE: 'psy_test_suite_v1',
    AI_CONFIG: 'psy_ai_config',
    OPS_CONFIG: 'psy_ops_config',
    FB_COLLECT: 'psy_fb_collect_config',
    ADMIN_PASSWORD: 'psy_admin_password',
    ADMIN_AUTH: 'psy_admin_authed'
  };

  var API_ENDPOINTS = {
    SCALES_JSON: '/api/scales-json',
    FEEDBACK: '/api/feedback',
    OPS_CONFIG: '/api/ops-config',
    AI_BALANCE: '/api/ai-balance'
  };

  // ====================================================
  // AdminAPI 命名空间
  // ====================================================
  window.AdminAPI = {
    version: '1.1.0',
    storage: STORAGE_KEYS,
    endpoints: API_ENDPOINTS,

    // ====================================================
    // 量表数据访问
    // ====================================================

    /**
     * 获取所有量表列表
     * @returns {Promise<Array>} 量表数组
     */
    getScales: async function () {
      return await SharedData.getAllScales();
    },

    /**
     * 同步获取所有量表（需 SharedData 已初始化）
     * @returns {Array} 量表数组
     */
    getScalesSync: function () {
      return SharedData.getAllScales();
    },

    /**
     * 根据 ID 获取单个量表
     * @param {string|number} scaleId - 量表 ID
     * @returns {Promise<Object|null>} 量表对象
     */
    getScale: async function (scaleId) {
      var scales = await this.getScales();
      return (
        scales.find(function (s) {
          return String(s.id) === String(scaleId);
        }) || null
      );
    },

    /**
     * 根据 code 获取单个量表
     * @param {string} code - 量表代码
     * @returns {Promise<Object|null>} 量表对象
     */
    getScaleByCode: async function (code) {
      var scales = await this.getScales();
      return (
        scales.find(function (s) {
          return s.code === code;
        }) || null
      );
    },

    /**
     * 根据分类获取量表列表
     * @param {string} category - 分类名称
     * @returns {Promise<Array>} 筛选后的量表数组
     */
    getScalesByCategory: async function (category) {
      var scales = await this.getScales();
      return scales.filter(function (s) {
        return s.category === category;
      });
    },

    /**
     * 获取已上架的量表列表
     * @returns {Promise<Array>} 已上架量表数组
     */
    getPublishedScales: async function () {
      var scales = await this.getScales();
      return scales.filter(function (s) {
        return String(s.status) === '1';
      });
    },

    /**
     * 获取量表数量统计
     * @returns {Promise<Object>} 统计对象 { total, published, unpublished, draft }
     */
    getScalesStats: async function () {
      var scales = await this.getScales();
      return {
        total: scales.length,
        published: scales.filter(function (s) {
          return String(s.status) === '1';
        }).length,
        unpublished: scales.filter(function (s) {
          return String(s.status) === '0';
        }).length,
        draft: scales.filter(function (s) {
          return String(s.status) === '2';
        }).length
      };
    },

    /**
     * 获取量表当前计分配置（从表单数据构造）
     * @param {Object} scale - 量表对象
     * @param {Object} scoringData - 计分配置数据（从表单收集）
     * @returns {Object} 含计分配置的量表对象
     */
    getScaleWithScoring: function (scale, scoringData) {
      return { ...scale, scoring: scoringData };
    },

    // ====================================================
    // System Prompt 管理
    // ====================================================

    /**
     * 获取量表的 System Prompt
     * @param {string|number} scaleId - 量表 ID
     * @returns {Promise<Object|null>} aiDiag 配置
     */
    getSystemPrompt: async function (scaleId) {
      var scale = await this.getScale(scaleId);
      return scale ? scale.aiDiag || null : null;
    },

    /**
     * 保存 System Prompt 到量表
     * @param {string|number} scaleId - 量表 ID
     * @param {Object} promptConfig - { prompt, welcome, temperature, maxTokens }
     * @returns {Promise<boolean>} 是否成功
     */
    saveSystemPrompt: async function (scaleId, promptConfig) {
      try {
        var scales = await this.getScales();
        var idx = scales.findIndex(function (s) {
          return String(s.id) === String(scaleId);
        });

        if (idx < 0) {
          console.error('[AdminAPI] 保存失败: 量表不存在', scaleId);
          return false;
        }

        // 更新 aiDiag 配置
        scales[idx].aiDiag = {
          ...scales[idx].aiDiag,
          ...promptConfig,
          updatedAt: new Date().toISOString()
        };

        await SharedData.saveAllScales(scales);
        console.log('[AdminAPI] System Prompt 保存成功', scaleId);
        return true;
      } catch (err) {
        console.error('[AdminAPI] 保存失败:', err);
        return false;
      }
    },

    /**
     * 批量更新多个量表的 System Prompt
     * @param {Array<{scaleId, promptConfig}>} updates - 更新列表
     * @returns {Promise<{success: number, failed: number}>}
     */
    batchSaveSystemPrompt: async function (updates) {
      var success = 0,
        failed = 0;
      for (var i = 0; i < updates.length; i++) {
        var item = updates[i];
        var ok = await this.saveSystemPrompt(item.scaleId, item.promptConfig);
        ok ? success++ : failed++;
      }
      return { success: success, failed: failed };
    },

    // ====================================================
    // 计分配置管理
    // ====================================================

    /**
     * 获取量表计分配置（从量表数据结构中提取）
     * @param {string|number} scaleId - 量表 ID
     * @returns {Promise<Object|null>} scoring 配置
     */
    getScoringConfig: async function (scaleId) {
      var scale = await this.getScale(scaleId);
      return scale ? scale.scoring || null : null;
    },

    /**
     * 保存量表计分配置
     * @param {string|number} scaleId - 量表 ID
     * @param {Object} scoringData - 计分配置数据
     * @returns {Promise<boolean>} 是否成功
     */
    saveScoringConfig: async function (scaleId, scoringData) {
      try {
        var scales = await this.getScales();
        var idx = scales.findIndex(function (s) {
          return String(s.id) === String(scaleId);
        });

        if (idx < 0) {
          console.error('[AdminAPI] 保存计分失败: 量表不存在', scaleId);
          return false;
        }

        scales[idx].scoring = scoringData;
        await SharedData.saveAllScales(scales);
        console.log('[AdminAPI] 计分配置保存成功', scaleId);
        return true;
      } catch (err) {
        console.error('[AdminAPI] 保存计分失败:', err);
        return false;
      }
    },

    /**
     * 检查量表是否有完整的计分配置
     * @param {Object} scale - 量表对象
     * @returns {boolean}
     */
    hasCompleteScoring: function (scale) {
      if (!scale || !scale.scoring) return false;
      var sc = scale.scoring;
      return !!(sc.dimensions && sc.dimensions.length > 0);
    },

    // ====================================================
    // NPC 配置管理
    // ====================================================

    /**
     * 获取量表的 NPC 配置
     * @param {string|number} scaleId - 量表 ID
     * @returns {Promise<Object|null>} npcConfig
     */
    getNpcConfig: async function (scaleId) {
      var scale = await this.getScale(scaleId);
      return scale ? scale.npcConfig || null : null;
    },

    /**
     * 检查量表是否有完整的 NPC 配置
     * @param {Object} scale - 量表对象
     * @returns {boolean}
     */
    hasCompleteNpc: function (scale) {
      if (!scale || !scale.npcConfig) return false;
      return !!(scale.npcConfig.counselorId && scale.npcConfig.backgroundId);
    },

    // ====================================================
    // AI 配置管理
    // ====================================================

    /**
     * 获取 AI 配置
     * @returns {Object|null} AI 配置对象
     */
    getAiConfig: function () {
      try {
        var stored = localStorage.getItem(STORAGE_KEYS.AI_CONFIG);
        return stored ? JSON.parse(stored) : null;
      } catch (e) {
        return null;
      }
    },

    /**
     * 保存 AI 配置
     * @param {Object} config - AI 配置对象
     */
    saveAiConfig: function (config) {
      localStorage.setItem(STORAGE_KEYS.AI_CONFIG, JSON.stringify(config));
    },

    /**
     * 获取当前 AI Provider
     * @returns {string} 'dashscope' | 'ollama' | null
     */
    getCurrentProvider: function () {
      var config = this.getAiConfig();
      return config ? config.provider : null;
    },

    // ====================================================
    // 数据导出/导入
    // ====================================================

    /**
     * 导出所有量表数据（JSON 格式）
     * @returns {string} JSON 字符串
     */
    exportAllScales: function () {
      var scales = SharedData.getAllScales();
      var exportData = {
        version: '3.0',
        exportedAt: new Date().toISOString(),
        scales: scales
      };
      return JSON.stringify(exportData, null, 2);
    },

    /**
     * 导入量表数据
     * @param {string} jsonStr - JSON 字符串
     * @param {boolean} merge - 是否合并，false 则覆盖
     * @returns {Promise<{success: boolean, imported: number, message: string}>}
     */
    importScales: async function (jsonStr, merge) {
      try {
        var data = JSON.parse(jsonStr);
        var newScales = data.scales || [];

        if (!Array.isArray(newScales) || newScales.length === 0) {
          return { success: false, imported: 0, message: '无效的数据格式' };
        }

        var currentScales = SharedData.getAllScales();

        if (merge) {
          // 合并模式：按 ID 合并或追加
          var existingIds = currentScales.map(function (s) {
            return String(s.id);
          });
          newScales.forEach(function (ns) {
            var idx = existingIds.indexOf(String(ns.id));
            if (idx >= 0) {
              currentScales[idx] = ns;
            } else {
              currentScales.push(ns);
              existingIds.push(String(ns.id));
            }
          });
        } else {
          // 覆盖模式
          currentScales = newScales;
        }

        await SharedData.saveAllScales(currentScales);
        return {
          success: true,
          imported: newScales.length,
          message: '成功导入 ' + newScales.length + ' 个量表'
        };
      } catch (e) {
        return { success: false, imported: 0, message: '导入失败: ' + e.message };
      }
    },

    // ====================================================
    // 用例库管理
    // ====================================================

    /**
     * 获取测试用例库
     * @returns {Array} 用例数组
     */
    getTestSuite: function () {
      try {
        var stored = localStorage.getItem(STORAGE_KEYS.TEST_SUITE);
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    },

    /**
     * 保存测试用例库
     * @param {Array} suite - 用例数组
     */
    saveTestSuite: function (suite) {
      localStorage.setItem(STORAGE_KEYS.TEST_SUITE, JSON.stringify(suite));
    },

    /**
     * 添加测试用例
     * @param {Object} testCase - 用例对象
     */
    addTestCase: function (testCase) {
      var suite = this.getTestSuite();
      testCase.id = testCase.id || Date.now();
      testCase.createdAt = new Date().toISOString();
      suite.push(testCase);
      this.saveTestSuite(suite);
      return testCase;
    },

    /**
     * 删除测试用例
     * @param {number|string} id - 用例 ID
     */
    deleteTestCase: function (id) {
      var suite = this.getTestSuite();
      suite = suite.filter(function (tc) {
        return String(tc.id) !== String(id);
      });
      this.saveTestSuite(suite);
    },

    // ====================================================
    // 工具方法
    // ====================================================

    /**
     * 生成量表 ID（基于时间戳 + 随机数）
     * @returns {number}
     */
    generateScaleId: function () {
      return Date.now() + Math.floor(Math.random() * 1000);
    },

    /**
     * 验证量表数据完整性
     * @param {Object} scale - 量表对象
     * @returns {Object} { valid: boolean, errors: Array<string> }
     */
    validateScale: function (scale) {
      var errors = [];

      if (!scale.name || !scale.name.trim()) {
        errors.push('量表名称不能为空');
      }

      if (!scale.code || !scale.code.trim()) {
        errors.push('量表编码不能为空');
      }

      if (!scale.questions || !Array.isArray(scale.questions)) {
        errors.push('量表题目数据格式错误');
      } else if (scale.questions.length === 0) {
        errors.push('量表至少需要一道题目');
      }

      return {
        valid: errors.length === 0,
        errors: errors
      };
    },

    /**
     * 深拷贝对象（用于隔离修改）
     * @param {Object} obj - 待拷贝对象
     * @returns {Object}
     */
    deepClone: function (obj) {
      return JSON.parse(JSON.stringify(obj));
    },

    /**
     * 格式化日期为 YYYY-MM-DD
     * @param {Date|string} date - 日期
     * @returns {string}
     */
    formatDate: function (date) {
      var d = new Date(date);
      return (
        d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
      );
    },

    /**
     * 获取版本信息
     * @returns {Object}
     */
    getVersionInfo: function () {
      return {
        version: this.version,
        storageKeys: Object.keys(STORAGE_KEYS),
        endpoints: Object.keys(API_ENDPOINTS)
      };
    }
  };

  // ====================================================
  // 初始化日志
  // ====================================================
  console.log('[AdminAPI] v' + window.AdminAPI.version + ' 已加载');
})();
