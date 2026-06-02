/**
 * admin-ai-config.js - AI 配置独立页面模块
 *
 * 解决 P1-1: AI Key 管理从运维页分离，作为独立菜单
 *
 * @version 1.0.0
 * @date 2026-05-20
 */

(function (global) {
  'use strict';

  // ====================================================
  // AIConfig 命名空间
  // ====================================================
  const AIConfig = {};

  // 默认配置
  const DEFAULT_CONFIG = {
    provider: 'dashscope',
    dashscope_key: '',
    dashscope_model: 'qwen-turbo',
    deepseek_key: '',
    deepseek_model: 'deepseek-chat'
  };

  // 当前配置
  let currentConfig = Object.assign({}, DEFAULT_CONFIG);

  // ====================================================
  // 初始化
  // ====================================================

  /**
   * 初始化 AI 配置页面
   */
  AIConfig.init = function () {
    loadConfig();
    renderProviderSelector();
    renderConfigForm();
  };

  /**
   * 加载配置（从 localStorage 或服务端）
   */
  function loadConfig() {
    try {
      const saved = localStorage.getItem('psy_ai_config');
      if (saved) {
        currentConfig = Object.assign({}, DEFAULT_CONFIG, JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load AI config:', e);
    }
  }

  /**
   * 保存配置到 localStorage
   */
  function saveConfig() {
    try {
      localStorage.setItem('psy_ai_config', JSON.stringify(currentConfig));
    } catch (e) {
      console.warn('Failed to save AI config:', e);
    }
  }

  // ====================================================
  // 渲染方法
  // ====================================================

  /**
   * 渲染 Provider 选择器
   */
  function renderProviderSelector() {
    const container = document.getElementById('ai-provider-selector');
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="ai-provider-grid">
        <div class="ai-provider-card ${currentConfig.provider === 'dashscope' ? 'active' : ''}" 
             data-action="aic-select-provider" data-provider="dashscope">
          <div class="provider-icon">🚀</div>
          <div class="provider-name">阿里云 DashScope</div>
          <div class="provider-model">qwen-turbo / qwen-plus</div>
          <div class="provider-check ${currentConfig.provider === 'dashscope' ? 'show' : ''}">✓</div>
        </div>
        <div class="ai-provider-card ${currentConfig.provider === 'deepseek' ? 'active' : ''}" 
             data-action="aic-select-provider" data-provider="deepseek">
          <div class="provider-icon">🧠</div>
          <div class="provider-name">DeepSeek</div>
          <div class="provider-model">deepseek-chat / deepseek-coder</div>
          <div class="provider-check ${currentConfig.provider === 'deepseek' ? 'show' : ''}">✓</div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染配置表单
   */
  function renderConfigForm() {
    const container = document.getElementById('ai-config-form');
    if (!container) {
      return;
    }

    const isDashscope = currentConfig.provider === 'dashscope';
    const isDeepseek = currentConfig.provider === 'deepseek';

    container.innerHTML = `
      <div class="ai-form-section">
        <h4 class="ai-form-title">🔑 API 密钥配置</h4>
        <div class="ai-form-row">
          <label class="ai-form-label">
            ${isDashscope ? 'DashScope' : isDeepseek ? 'DeepSeek' : 'AI'} API Key
          </label>
          <div class="ai-form-input-wrap">
            <input type="password" id="ai-api-key" class="ai-form-input" 
                   value="${currentConfig[currentConfig.provider + '_key'] || ''}"
                   placeholder="输入 API Key（不会在前端保存，仅发送到服务端）"
                   autocomplete="off" />
            <button class="ai-form-toggle" data-action="aic-toggle-visibility" 
                    title="显示/隐藏密钥">👁️</button>
          </div>
        </div>
        <div class="ai-form-hint">
          💡 API Key 仅存储在服务端（LNMP .env），前端不持有密钥明文。
        </div>
      </div>

      <div class="ai-form-section">
        <h4 class="ai-form-title">🤖 模型选择</h4>
        <div class="ai-form-row">
          <label class="ai-form-label">使用模型</label>
          <select id="ai-model-select" class="ai-form-select" onchange="AIConfig.onModelChange(this.value)">
            ${
              isDashscope
                ? `
              <option value="qwen-turbo" ${currentConfig.dashscope_model === 'qwen-turbo' ? 'selected' : ''}>qwen-turbo（快速响应）</option>
              <option value="qwen-plus" ${currentConfig.dashscope_model === 'qwen-plus' ? 'selected' : ''}>qwen-plus（更强推理）</option>
              <option value="qwen-max" ${currentConfig.dashscope_model === 'qwen-max' ? 'selected' : ''}>qwen-max（最强能力）</option>
            `
                : isDeepseek
                  ? `
              <option value="deepseek-chat" ${currentConfig.deepseek_model === 'deepseek-chat' ? 'selected' : ''}>deepseek-chat（通用对话）</option>
              <option value="deepseek-coder" ${currentConfig.deepseek_model === 'deepseek-coder' ? 'selected' : ''}>deepseek-coder（代码专用）</option>
            `
                  : ''
            }
          </select>
        </div>
        <div class="ai-form-hint">
          💡 选择适合的模型，Turbo 速度快、Plus 质量高、Max 最强但成本较高。
        </div>
      </div>

      <div class="ai-form-actions">
        <button class="ai-btn ai-btn-secondary" data-action="aic-load-server">
          📂 从服务端加载
        </button>
        <button class="ai-btn ai-btn-secondary" data-action="aic-check-status">
          🌐 检查双端状态
        </button>
        <button class="ai-btn ai-btn-primary" data-action="aic-save-server">
          💾 保存到服务端
        </button>
      </div>
    `;
  }

  /**
   * 渲染状态面板
   */
  function renderStatusPanel(status) {
    const container = document.getElementById('ai-status-panel');
    if (!container) {
      return;
    }

    const statusClass = status.ok ? 'success' : 'error';
    const statusIcon = status.ok ? '✅' : '❌';

    container.innerHTML = `
      <div class="ai-status-card ${statusClass}">
        <div class="ai-status-header">
          <span class="ai-status-icon">${statusIcon}</span>
          <span class="ai-status-title">${status.provider}</span>
        </div>
        <div class="ai-status-body">
          <div class="ai-status-row">
            <span class="ai-status-label">当前模型：</span>
            <span class="ai-status-value">${status.model || '未配置'}</span>
          </div>
          <div class="ai-status-row">
            <span class="ai-status-label">服务端状态：</span>
            <span class="ai-status-value">${status.serverOk ? '✅ 已配置' : '❌ 未配置'}</span>
          </div>
          <div class="ai-status-row">
            <span class="ai-status-label">本地缓存：</span>
            <span class="ai-status-value">${status.localOk ? '✅ 已保存' : '⚠️ 未保存'}</span>
          </div>
        </div>
      </div>
    `;
  }

  // ====================================================
  // 事件处理
  // ====================================================

  /**
   * 选择 Provider
   */
  AIConfig.selectProvider = function (provider) {
    currentConfig.provider = provider;
    saveConfig();
    renderProviderSelector();
    renderConfigForm();

    if (typeof showToast === 'function') {
      showToast('已切换到 ' + (provider === 'dashscope' ? '阿里云 DashScope' : 'DeepSeek'), 'info');
    }
  };

  /**
   * 模型变更
   */
  AIConfig.onModelChange = function (model) {
    const provider = currentConfig.provider;
    currentConfig[provider + '_model'] = model;
    saveConfig();
  };

  /**
   * 切换密钥可见性
   */
  AIConfig.toggleKeyVisibility = function () {
    const input = document.getElementById('ai-api-key');
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  };

  /**
   * 从服务端加载配置
   */
  AIConfig.loadFromServer = async function () {
    try {
      const statusEl = document.getElementById('ai-load-status');
      if (statusEl) {
        statusEl.textContent = '正在加载...';
      }

      const res = await fetch('/api/ai-config');
      const data = await res.json();

      if (data.code === 0 && data.data) {
        currentConfig = Object.assign({}, DEFAULT_CONFIG, data.data);
        saveConfig();
        renderConfigForm();

        if (typeof showToast === 'function') {
          showToast('配置已从服务端加载', 'success');
        }
        if (statusEl) {
          statusEl.textContent = '✅ 已加载';
        }
      } else {
        if (statusEl) {
          statusEl.textContent = '⚠️ 服务端无配置';
        }
        if (typeof showToast === 'function') {
          showToast('服务端暂无配置，请手动填写后保存', 'warning');
        }
      }
    } catch (e) {
      console.error('Failed to load config:', e);
      if (typeof showToast === 'function') {
        showToast('加载失败：' + e.message, 'error');
      }
    }
  };

  /**
   * 保存配置到服务端
   */
  AIConfig.saveToServer = async function () {
    const apiKey = document.getElementById('ai-api-key');
    const modelSelect = document.getElementById('ai-model-select');

    if (!apiKey || !modelSelect) {
      return;
    }

    const key = apiKey.value.trim();
    const model = modelSelect.value;

    if (!key) {
      if (typeof showToast === 'function') {
        showToast('请输入 API Key', 'warning');
      }
      return;
    }

    const provider = currentConfig.provider;
    currentConfig[provider + '_key'] = key;
    currentConfig[provider + '_model'] = model;
    saveConfig();

    try {
      const statusEl = document.getElementById('ai-save-status');
      if (statusEl) {
        statusEl.textContent = '正在保存...';
      }

      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider,
          api_key: key,
          model: model
        })
      });

      const data = await res.json();

      if (data.code === 0) {
        if (statusEl) {
          statusEl.textContent = '✅ 已保存';
        }
        if (typeof showToast === 'function') {
          showToast('配置已保存到服务端', 'success');
        }
      } else {
        throw new Error(data.message || '保存失败');
      }
    } catch (e) {
      console.error('Failed to save config:', e);
      if (typeof showToast === 'function') {
        showToast('保存失败：' + e.message, 'error');
      }
    }
  };

  /**
   * 检查服务端状态
   */
  AIConfig.checkServerStatus = async function () {
    const statusEl = document.getElementById('ai-status-result');
    if (statusEl) {
      statusEl.innerHTML = '<span class="ai-loading">🔄 检查中...</span>';
    }

    try {
      const res = await fetch('/api/ai-config/status');
      const data = await res.json();

      if (data.code === 0) {
        renderStatusPanel(data.data);
      } else {
        if (statusEl) {
          statusEl.innerHTML = '<span class="ai-error">❌ 检查失败</span>';
        }
      }
    } catch (e) {
      console.error('Failed to check status:', e);
      if (statusEl) {
        statusEl.innerHTML = '<span class="ai-error">❌ 网络错误</span>';
      }
    }
  };

  /**
   * 测试 API 连接
   */
  AIConfig.testConnection = async function () {
    const statusEl = document.getElementById('ai-test-result');
    if (statusEl) {
      statusEl.innerHTML = '<span class="ai-loading">🔄 测试中...</span>';
    }

    try {
      const res = await fetch('/api/ai-config/test', { method: 'POST' });
      const data = await res.json();

      if (data.code === 0 && data.data.ok) {
        if (statusEl) {
          statusEl.innerHTML = `<span class="ai-success">✅ 连接成功 · 延迟 ${data.data.latency}ms</span>`;
        }
        if (typeof showToast === 'function') {
          showToast('API 连接测试成功', 'success');
        }
      } else {
        throw new Error(data.data?.error || '测试失败');
      }
    } catch (e) {
      console.error('Test failed:', e);
      if (statusEl) {
        statusEl.innerHTML = `<span class="ai-error">❌ ${e.message}</span>`;
      }
      if (typeof showToast === 'function') {
        showToast('测试失败：' + e.message, 'error');
      }
    }
  };

  // ====================================================
  // 导出
  // ====================================================
  global.AIConfig = AIConfig;
})(window);
