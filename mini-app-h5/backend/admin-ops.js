/**
 * 星蓝心镜 · 运维管理模块 v1.1
 *
 * 功能：
 *   - 运维监控（到期倒计时、健康快检）
 *   - AI 接口状态检测（多 Provider 支持）
 *   - 运维手册管理
 *
 * @version 1.1.0
 * @updated 2026-05-20
 */

(function (global) {
  'use strict';

  // ====================================================
  // 常量定义
  // ====================================================
  const OPS_STORAGE_KEY = 'psy_ops_config_v2';

  // 运维监控默认配置
  const OPS_DEFAULT_ITEMS = [
    {
      id: 'domain',
      name: '域名备案',
      date: null,
      note: '请设置备案截止日期',
      warnDays: 90,
      urgentDays: 30,
      editable: true
    },
    {
      id: 'cloudbase',
      name: 'CloudBase',
      date: null,
      note: '请设置服务到期日',
      warnDays: 30,
      urgentDays: 7,
      editable: true
    },
    {
      id: 'ai-service',
      name: 'AI 服务',
      date: null,
      note: '请设置 API 额度续费日',
      warnDays: 30,
      urgentDays: 7,
      editable: true
    },
    {
      id: 'domain-https',
      name: 'SSL 证书',
      date: null,
      note: '请设置证书到期日',
      warnDays: 30,
      urgentDays: 7,
      editable: true
    },
    {
      id: 'miniprogram',
      name: '小程序认证',
      date: null,
      note: '请设置认证有效期',
      warnDays: 30,
      urgentDays: 7,
      editable: true
    },
    { id: 'server', name: '服务器', isStatus: true, note: '运行中', editable: false },
    { id: 'database', name: '数据库', isStatus: true, note: '连接正常', editable: false },
    { id: 'api', name: 'API 服务', isStatus: true, note: '正常', editable: false }
  ];

  // ====================================================
  // 运维手册内容（可考虑后续迁移到外部 Markdown 文件）
  // ====================================================
  const OPS_MANUAL_CONTENT = {
    title: '运维手册',
    sections: [
      {
        id: 'quick-start',
        title: '🚀 快速入门',
        content:
          '## 快速入门\n\n### 首次部署\n1. 配置 AI 接口密钥\n2. 导入量表数据\n3. 配置 NPC 场景\n4. 测试完整流程\n\n### 日常检查清单\n- [ ] 检查 AI 服务是否可用\n- [ ] 查看是否有新的用户反馈\n- [ ] 确认数据备份是否正常'
      },
      {
        id: 'ai-config',
        title: '🤖 AI 接口配置',
        content:
          '## AI 接口配置\n\n### DashScope（通义千问）\n1. 前往阿里云百炼平台申请 API Key\n2. 在后台「系统运维 → AI 接口配置」中填写 Key\n3. 选择模型（推荐 qwen-plus）\n4. 测试连接是否正常\n\n### Ollama（本地部署）\n1. 安装 Ollama 服务\n2. 拉取模型：`ollama pull qwen-plus`\n3. 配置本地地址：http://localhost:11434'
      },
      {
        id: 'data-backup',
        title: '💾 数据备份',
        content:
          '## 数据备份\n\n### 导出时机\n- 重大配置变更前\n- 每周定期导出\n- 量表数据更新后\n\n### 备份内容\n- 量表数据（含题目、计分规则）\n- NPC 场景配置\n- 系统提示词版本'
      },
      {
        id: 'troubleshooting',
        title: '🔧 故障排查',
        content:
          '## 故障排查\n\n### AI 服务无响应\n1. 检查 API Key 是否有效\n2. 确认网络连接\n3. 查看控制台错误信息\n\n### 数据不同步\n1. 清除浏览器缓存\n2. 手动触发同步\n3. 检查服务端日志'
      }
    ]
  };

  // ====================================================
  // 工具函数
  // ====================================================

  function escHtml(str) {
    if (str === null || str === undefined) {
      return '';
    }
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function opsLoadConfig() {
    try {
      const saved = localStorage.getItem(OPS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return OPS_DEFAULT_ITEMS.map(function (def) {
          const item = parsed.find(function (s) {
            return s.id === def.id;
          });
          if (item) {
            return Object.assign({}, def, item);
          }
          return Object.assign({}, def);
        });
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(OPS_DEFAULT_ITEMS));
  }

  function opsSaveConfig() {
    const items = opsLoadConfig();
    localStorage.setItem(OPS_STORAGE_KEY, JSON.stringify(items));
    if (typeof showToast === 'function') {
      showToast('监控配置已保存', 'success');
    }
  }

  function opsCalcDays(item) {
    if (!item.date) {
      if (item.isStatus) {
        return { cls: 'warning', text: item.note || '进行中', days: Infinity };
      }
      return { cls: 'expired', text: '未设置', days: -Infinity };
    }
    const target = new Date(item.date + 'T23:59:59');
    const now = new Date();
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) {
      return { cls: 'expired', text: '已过期 ' + Math.abs(diff) + ' 天', days: diff };
    }
    const urgent = item.urgentDays || 7;
    const warn = item.warnDays || 30;
    if (item.isStatus) {
      return { cls: 'safe', text: '预计 ' + item.date, days: diff };
    }
    if (diff <= urgent) {
      return { cls: 'urgent', text: '剩余 ' + diff + ' 天', days: diff };
    }
    if (diff <= warn) {
      return { cls: 'warning', text: '剩余 ' + diff + ' 天', days: diff };
    }
    return { cls: 'safe', text: '剩余 ' + diff + ' 天', days: diff };
  }

  function opsRenderCountdown() {
    const items = opsLoadConfig();
    const grid = document.getElementById('ops-countdown-grid');
    if (!grid) {
      return;
    }

    let html = '';
    items.forEach(function (item) {
      if (!item.editable && item.editable !== undefined) {
        return;
      }
      const status = opsCalcDays(item);
      html +=
        '<div class="ops-countdown-item ' +
        escHtml(status.cls) +
        '">' +
        '<span class="ops-countdown-emoji">' +
        escHtml(item.emoji || '📅') +
        '</span>' +
        '<div class="ops-countdown-info">' +
        '<div class="ops-countdown-name">' +
        escHtml(item.name) +
        '</div>' +
        '<div class="ops-countdown-days ' +
        escHtml(status.cls) +
        '">' +
        escHtml(status.text) +
        '</div>' +
        '<div class="ops-countdown-date" onclick="opsEditDate(\'' +
        escHtml(item.id) +
        '\')" title="点击修改日期">' +
        (item.date || item.note || '点击设置日期') +
        '</div></div></div>';
    });

    grid.innerHTML = html || '<div class="ops-loading">暂无监控项</div>';
  }

  function opsEditDate(id) {
    const items = opsLoadConfig();
    const item = items.find(function (i) {
      return i.id === id;
    });
    if (!item) {
      return;
    }

    const dateStr = prompt('设置「' + item.name + '」的到期日期：\n（格式：YYYY-MM-DD，留空清除）', item.date || '');
    if (dateStr === null) {
      return;
    }

    if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      if (typeof showToast === 'function') {
        showToast('日期格式不正确，请使用 YYYY-MM-DD', 'error');
      }
      return;
    }

    item.date = dateStr;
    localStorage.setItem(OPS_STORAGE_KEY, JSON.stringify(items));
    opsRenderCountdown();
  }

  function opsCheckAi() {
    const body = document.getElementById('ops-ai-body');
    if (!body) {
      return;
    }

    body.innerHTML = '<div class="ops-loading">检测中...</div>';

    let aiConfig = null;
    try {
      const stored = localStorage.getItem('psy_ai_config');
      if (stored) {
        aiConfig = JSON.parse(stored);
      }
    } catch (e) {}

    if (!aiConfig || !aiConfig.provider) {
      body.innerHTML = '<div class="ops-loading" style="color:var(--warning)">⚠️ 未检测到 AI 接口配置</div>';
      return;
    }

    const provider = aiConfig.provider;
    let html = '';

    const dsKey = (aiConfig.dashscope && aiConfig.dashscope.apiKey) || '';
    const dsModel = (aiConfig.dashscope && aiConfig.dashscope.model) || 'qwen-plus';
    html +=
      '<div class="ops-health-item">' +
      '<span class="ops-health-status">' +
      (provider === 'dashscope' ? '✅' : '⏸️') +
      '</span>' +
      '<div style="flex:1">' +
      '<div class="ops-health-name">DashScope（通义千问）' +
      (provider === 'dashscope' ? ' <span style="font-size:11px;color:var(--primary)">当前使用</span>' : '') +
      '</div>' +
      '<div class="ops-health-detail">Key: ' +
      (dsKey ? dsKey.substring(0, 6) + '****' + dsKey.substring(dsKey.length - 4) : '未配置') +
      '</div>' +
      '</div>' +
      '<div id="ops-ds-balance" style="text-align:right;min-width:100px"><span style="color:var(--text-muted)">--</span></div>' +
      '</div>';

    const ollamaUrl = (aiConfig.ollama && aiConfig.ollama.baseUrl) || '';
    html +=
      '<div class="ops-health-item">' +
      '<span class="ops-health-status">' +
      (provider === 'ollama' ? '✅' : '⏸️') +
      '</span>' +
      '<div style="flex:1">' +
      '<div class="ops-health-name">Ollama（本地）' +
      (provider === 'ollama' ? ' <span style="font-size:11px;color:var(--primary)">当前使用</span>' : '') +
      '</div>' +
      '<div class="ops-health-detail">' +
      (ollamaUrl ? escHtml(ollamaUrl) : '未配置') +
      '</div>' +
      '</div></div>';

    body.innerHTML = html;

    if (provider === 'dashscope' && dsKey) {
      opsCheckBalance(dsKey);
    }
  }

  function opsCheckBalance(apiKey) {
    const balanceEl = document.getElementById('ops-ds-balance');
    if (!balanceEl) {
      return;
    }
    balanceEl.innerHTML = '<span style="color:var(--text-muted)">余额查询中...</span>';
  }

  function opsRenderManual() {
    const container = document.getElementById('ops-manual-content');
    if (!container) {
      return;
    }

    let html = '<div class="ops-manual">';
    OPS_MANUAL_CONTENT.sections.forEach(function (section) {
      html += '<div class="ops-manual-section" id="ops-section-' + escHtml(section.id) + '">';
      html += '<h3>' + escHtml(section.title) + '</h3>';
      html +=
        '<pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:6px;">' +
        escHtml(section.content) +
        '</pre>';
      html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function getOpsManual() {
    return OPS_MANUAL_CONTENT;
  }

  function getOpsManualSection(sectionId) {
    return (
      OPS_MANUAL_CONTENT.sections.find(function (s) {
        return s.id === sectionId;
      }) || null
    );
  }

  // ====================================================
  // 导出到全局
  // ====================================================
  global.OpsModule = {
    version: '1.1.0',
    loadConfig: opsLoadConfig,
    saveConfig: opsSaveConfig,
    renderCountdown: opsRenderCountdown,
    editDate: opsEditDate,
    checkAi: opsCheckAi,
    renderManual: opsRenderManual,
    getManual: getOpsManual,
    getManualSection: getOpsManualSection,
    getDefaultItems: function () {
      return OPS_DEFAULT_ITEMS;
    }
  };

  console.log('[OpsModule] v1.1.0 已加载');

  // ====================================================
  // 向后兼容：导出全局函数
  // ====================================================
  global.opsLoadConfig = opsLoadConfig;
  global.opsSaveConfig = opsSaveConfig;
  global.opsCalcDays = opsCalcDays;
  global.opsRenderCountdown = opsRenderCountdown;
  global.opsEditDate = opsEditDate;
  global.opsCheckAi = opsCheckAi;
  global.opsCheckBalance = opsCheckBalance;
  global.opsRenderManual = opsRenderManual;
})(window);
