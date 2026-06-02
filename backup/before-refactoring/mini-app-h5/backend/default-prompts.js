/**
 * 星蓝心镜 · 默认提示词配置文件
 *
 * 用法：
 *   - 引入此文件后，通过 window.DEFAULT_PROMPTS 访问所有提示词
 *   - 通过 window.getPromptById(id) 获取指定提示词
 *   - 通过 window.updatePromptVersion(id, content) 更新提示词版本
 *
 * 版本历史：
 *   - 3ae2ffba: 初始版本（2026-05）
 */

(function (global) {
  'use strict';

  // ============================================
  // 提示词数据定义
  // ============================================
  var DEFAULT_PROMPTS_DATA = [
    {
      id: 'csv',
      name: '量表 CSV 生成',
      icon: '📊',
      note: '用于 AI 生成量表 CSV 导入文件',
      flowSteps: [
        {
          num: '1',
          color: 'success',
          title: '📝 复制提示词',
          desc: '后台 → 系统提示词 → CSV 导入文件生成 → 点「📋 复制正文」'
        },
        {
          num: '2',
          color: 'success',
          title: '📄 追加手册原文',
          desc: '在「[量表手册原文在下方]」后粘贴手册全文 + 补充关键信息（量表数量、题目数、反向计分题号）'
        },
        {
          num: '3',
          color: 'success',
          title: '📥 获取 CSV 文件',
          desc: '核对摘要无误后下载 CSV 文件（或复制代码块另存为 .csv）'
        },
        {
          num: '4',
          color: 'highlight-success',
          title: '📋 后台导入量表',
          desc: '后台量表管理 → 导入量表 → CSV 格式 → 粘贴 → 解析预览 → 确认导入'
        }
      ],
      versions: [],
      currentVersion: ''
    },
    {
      id: 'json',
      name: '量表 JSON 生成',
      icon: '📋',
      note: '用于 AI 生成量表 JSON 导入文件，支持全部题型',
      flowSteps: [],
      versions: [],
      currentVersion: ''
    },
    {
      id: 'displayname-gen',
      name: '展示名称与展示简介生成规则',
      icon: '💡',
      note: 'v1.3：维度只选1个 + 禁止"依赖"硬规则',
      flowSteps: [],
      versions: [],
      currentVersion: ''
    },
    {
      id: 'meta',
      name: '报告结构化生成',
      icon: '🤖',
      note: '告诉 AI 如何根据量表信息生成 AI 诊断用的 System Prompt',
      flowSteps: [],
      versions: [],
      currentVersion: ''
    },
    {
      id: 'system-templates',
      name: '系统提示词模板',
      icon: '📝',
      note: '后台「系统提示词」Tab 填充模板按钮使用的初始文本',
      flowSteps: [],
      versions: [],
      currentVersion: ''
    },
    {
      id: 'scoring-merge',
      name: '计分合并提示词（一步到位）',
      icon: '⚡',
      note: '用于 AI 一步生成量表计分规则 JSON，替代原有的两步流程',
      flowSteps: [],
      versions: [],
      currentVersion: ''
    },
    {
      id: 'scoring',
      name: '计分规则提取',
      icon: '🎯',
      note: '用于 AI 生成量表计分规则（两步法第1步：提取→人工核实→解析）',
      flowSteps: [
        { num: '1', color: 'primary', title: '🤖 AI 一键配置', desc: '量表管理 → 选中量表 → AI 一键配置' },
        { num: '2', color: 'primary', title: '📎 上传文档', desc: '上传 .docx/.txt/.md 手册文件，或直接粘贴文字' },
        {
          num: '3',
          color: 'highlight',
          title: '✨ AI 提取 → 解析 → 导入',
          desc: 'AI 智能提取计分规则 → 检查结果 → 开始解析 → 导入量表'
        }
      ],
      versions: [],
      currentVersion: ''
    },
    {
      id: 'scoring-parse',
      name: '计分 JSON 解析',
      icon: '🧮',
      note: 'AI 解析计分规则文字 → 输出评分引擎 JSON',
      flowSteps: [],
      versions: [],
      currentVersion: ''
    },
    {
      id: 'output-format',
      name: '输出格式规范',
      icon: '📝',
      note: '追加到 AI 诊断 System Prompt 末尾，确保输出纯 Markdown',
      flowSteps: [],
      versions: [],
      currentVersion: ''
    }
  ];

  // ============================================
  // 工具函数
  // ============================================

  /**
   * 根据 ID 获取提示词
   * @param {string} id - 提示词 ID
   * @returns {Object|null} 提示词对象
   */
  function getPromptById(id) {
    return (
      DEFAULT_PROMPTS_DATA.find(function (p) {
        return p.id === id;
      }) || null
    );
  }

  /**
   * 获取提示词的当前活动版本内容
   * @param {string} id - 提示词 ID
   * @returns {string} 当前版本内容，空字符串表示未设置
   */
  function getPromptContent(id) {
    var prompt = getPromptById(id);
    if (!prompt) return '';

    // 优先使用当前版本
    if (prompt.currentVersion) {
      var version = prompt.versions.find(function (v) {
        return v.version === prompt.currentVersion;
      });
      if (version) return version.content;
    }

    // Fallback: 使用最新版本
    if (prompt.versions && prompt.versions.length > 0) {
      var lastVersion = prompt.versions[prompt.versions.length - 1];
      // 检查是否有 active 状态版本
      var activeVersion = prompt.versions.find(function (v) {
        return v.status === 'active';
      });
      return (activeVersion || lastVersion).content;
    }

    return '';
  }

  /**
   * 获取所有提示词 ID 列表
   * @returns {Array<string>} 提示词 ID 数组
   */
  function getAllPromptIds() {
    return DEFAULT_PROMPTS_DATA.map(function (p) {
      return p.id;
    });
  }

  /**
   * 验证提示词 ID 是否存在
   * @param {string} id - 提示词 ID
   * @returns {boolean}
   */
  function hasPrompt(id) {
    return DEFAULT_PROMPTS_DATA.some(function (p) {
      return p.id === id;
    });
  }

  /**
   * 生成新版本号（基于时间戳）
   * @returns {string} 版本号字符串
   */
  function generateVersion() {
    return 'v' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Date.now().toString(36);
  }

  // ============================================
  // 导出到全局
  // ============================================
  global.DEFAULT_PROMPTS = DEFAULT_PROMPTS_DATA;
  global.PROMPTS_VERSION = '3ae2ffba';

  // 工具函数导出
  global.getPromptById = getPromptById;
  global.getPromptContent = getPromptContent;
  global.getAllPromptIds = getAllPromptIds;
  global.hasPrompt = hasPrompt;
  global.generatePromptVersion = generateVersion;
})(window);
