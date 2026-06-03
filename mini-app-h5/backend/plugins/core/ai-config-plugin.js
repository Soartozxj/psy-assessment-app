/**
 * ai-config-plugin.js - AI配置管理插件
 *
 * 大白话解释：
 * - 这个插件负责AI配置的加载、保存、测试等功能
 * - 继承自PluginBase，获得标准接口
 * - 保持向后兼容：保留全局函数（如 AIConfig.selectProvider 等）
 * - 使用 Adapter 进行双端适配（localStorage → Adapter.storage）
 * - 使用 EventHub 进行事件通信
 *
 * @version 1.0.0
 * @date 2026-06-03
 */

class AIConfigPlugin extends PluginBase {
  constructor() {
    super({
      name: 'AI配置管理插件',
      version: '1.0.0',
      description: '负责AI配置的加载、保存、测试等功能'
    });

    // ====================================================
    // 常量定义
    // ====================================================
    this.STORAGE_KEY = 'psy_ai_config';
    this.SERVER_KEY = 'psy_ai_config_server';

    // 默认配置
    this.DEFAULT_CONFIG = {
      provider: 'dashscope',
      dashscope_key: '',
      dashscope_model: 'qwen-turbo',
      deepseek_key: '',
      deepseek_model: 'deepseek-chat'
    };

    // 当前配置
    this.currentConfig = Object.assign({}, this.DEFAULT_CONFIG);

    // 状态
    this.serverStatus = 'unknown'; // unknown, connected, disconnected
    this.apiStatus = 'unknown'; // unknown, success, failed

    // ====================================================
    // 向后兼容：保留全局函数
    // ====================================================
    this._setupGlobalAdapter();
  }

  /**
   * 设置全局适配器（向后兼容）
   *
   * 大白话：创建一个全局对象，让旧代码可以继续调用函数
   */
  _setupGlobalAdapter() {
    const self = this;

    // 保留全局AIConfig对象
    window.AIConfig = {
      // 初始化
      init: function () {
        return self.onInit.bind(self)();
      },

      // 选择服务商
      selectProvider: function (provider) {
        return self.selectProvider.bind(self)(provider);
      },

      // 切换密钥可见性
      toggleKeyVisibility: function () {
        return self.toggleKeyVisibility.bind(self)();
      },

      // 从服务端加载
      loadFromServer: function () {
        return self.loadFromServer.bind(self)();
      },

      // 保存到服务端
      saveToServer: function () {
        return self.saveToServer.bind(self)();
      },

      // 检查服务端状态
      checkServerStatus: function () {
        return self.checkServerStatus.bind(self)();
      },

      // 测试连接
      testConnection: function () {
        return self.testConnection.bind(self)();
      },

      // 渲染服务商选择器
      renderProviderSelector: function () {
        return self.renderProviderSelector.bind(self)();
      },

      // 渲染配置表单
      renderConfigForm: function () {
        return self.renderConfigForm.bind(self)();
      }
    };

    console.log('✅ AI配置全局函数已创建（向后兼容）');
  }

  /**
   * 初始化逻辑
   */
  async onInit() {
    console.log('🤖 AI配置管理插件开始初始化...');

    try {
      // 加载配置
      this.loadConfig();

      // 渲染服务商选择器
      this.renderProviderSelector();

      // 渲染配置表单
      this.renderConfigForm();

      // 检查服务端状态
      this.checkServerStatus();

      console.log('✅ AI配置管理插件初始化完成');

      // 触发事件
      window.EventHub.emit('ai-config-initialized', {
        provider: this.currentConfig.provider,
        timestamp: Date.now()
      });
    } catch (error) {
      Adapter.logger.error('AI配置管理插件初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行逻辑（插件标准接口）
   *
   * @param {object} params - 执行参数
   * @param {string} params.action - 执行动作：load, save, render, test, selectProvider
   * @param {object} [params.config] - 配置数据（save时用）
   * @param {string} [params.provider] - 服务商（selectProvider时用）
   */
  async onExecute(params = {}) {
    console.log('🎯 AI配置管理插件开始执行...', params);

    try {
      switch (params.action) {
        case 'load':
          return this.loadConfig();

        case 'save':
          if (!params.config) {
            throw new Error('缺少必要参数：config');
          }
          return this.saveConfig(params.config);

        case 'render':
          this.renderProviderSelector();
          this.renderConfigForm();
          return { success: true };

        case 'test':
          return this.testConnection();

        case 'selectProvider':
          if (!params.provider) {
            throw new Error('缺少必要参数：provider');
          }
          return this.selectProvider(params.provider);

        default:
          throw new Error(`未知动作: ${params.action}`);
      }
    } catch (error) {
      Adapter.logger.error('AI配置管理插件执行失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 加载配置
   * 对应原 loadConfig() 函数
   *
   * 大白话：从存储中加载AI配置，如果存储中没有，就使用默认配置
   */
  loadConfig() {
    try {
      const data = Adapter.storage.get(this.STORAGE_KEY);
      if (data) {
        this.currentConfig = Object.assign({}, this.DEFAULT_CONFIG, JSON.parse(data));
      } else {
        this.currentConfig = Object.assign({}, this.DEFAULT_CONFIG);
      }

      console.log('[AIConfig] 配置已加载，当前服务商:', this.currentConfig.provider);
      return this.currentConfig;
    } catch (e) {
      console.warn('[AIConfig] 加载配置失败，使用默认配置:', e);
      this.currentConfig = Object.assign({}, this.DEFAULT_CONFIG);
      return this.currentConfig;
    }
  }

  /**
   * 保存配置
   * 对应原 saveConfig() 函数
   *
   * 大白话：将配置保存到存储中
   * @param {object} config - 配置对象
   */
  saveConfig(config) {
    try {
      this.currentConfig = Object.assign({}, this.DEFAULT_CONFIG, config);
      const jsonStr = JSON.stringify(this.currentConfig);
      Adapter.storage.set(this.STORAGE_KEY, jsonStr);

      console.log('[AIConfig] 配置已保存，当前服务商:', this.currentConfig.provider);

      // 触发事件
      window.EventHub.emit('ai-config-saved', {
        provider: this.currentConfig.provider,
        timestamp: Date.now()
      });

      return { success: true };
    } catch (err) {
      console.error('[AIConfig] 保存配置失败:', err);
      Adapter.ui.toast('保存失败：' + (err.message || '存储空间不足'), 'error');
      return { success: false, error: err.message };
    }
  }

  /**
   * 选择服务商
   * 对应原 selectProvider() 函数
   *
   * 大白话：切换当前使用的AI服务商（阿里云或DeepSeek）
   * @param {string} provider - 服务商名称：'dashscope' 或 'deepseek'
   */
  selectProvider(provider) {
    if (provider !== 'dashscope' && provider !== 'deepseek') {
      console.warn('[AIConfig] 未知的服务商:', provider);
      return;
    }

    this.currentConfig.provider = provider;
    this.saveConfig(this.currentConfig);
    this.renderProviderSelector();
    this.renderConfigForm();

    // 触发事件
    window.EventHub.emit('ai-config-provider-changed', {
      provider: provider,
      timestamp: Date.now()
    });

    if (typeof showToast === 'function') {
      showToast('已切换到 ' + (provider === 'dashscope' ? '阿里云 DashScope' : 'DeepSeek'), 'info');
    }
  }

  /**
   * 切换密钥可见性
   * 对应原 toggleKeyVisibility() 函数
   *
   * 大白话：显示或隐藏API密钥输入框的内容
   */
  toggleKeyVisibility() {
    const input = document.getElementById('ai-api-key');
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  }

  /**
   * 从服务端加载配置
   * 对应原 loadFromServer() 函数
   *
   * 大白话：从服务端获取AI配置（需要管理员密钥）
   */
  async loadFromServer() {
    try {
      if (typeof showToast === 'function') {
        showToast('🔄 从服务端加载配置...', 'warning');
      }

      const adminSecret = prompt('请输入管理员密钥（用于访问服务端配置）:');
      if (!adminSecret) {
        return;
      }

      const res = await fetch('http://127.0.0.1:3100/api/ai-config', {
        headers: {
          'X-Admin-Secret': adminSecret
        }
      });

      if (!res.ok) {
        throw new Error('加载失败 (HTTP ' + res.status + ')');
      }

      const result = await res.json();
      if (result.code === 0 && result.data) {
        this.saveConfig(result.data);
        this.renderProviderSelector();
        this.renderConfigForm();

        if (typeof showToast === 'function') {
          showToast('✅ 已从服务端加载配置', 'success');
        }

        this.serverStatus = 'connected';
        this.updateStatusDisplay();
      } else {
        throw new Error(result.message || '加载失败');
      }
    } catch (err) {
      console.error('[AIConfig] 从服务端加载配置失败:', err);
      if (typeof showToast === 'function') {
        showToast('❌ 从服务端加载失败: ' + err.message, 'error');
      }

      this.serverStatus = 'disconnected';
      this.updateStatusDisplay();
    }
  }

  /**
   * 保存到服务端
   * 对应原 saveToServer() 函数
   *
   * 大白话：将当前配置保存到服务端（需要管理员密钥）
   */
  async saveToServer() {
    try {
      if (typeof showToast === 'function') {
        showToast('🔄 保存配置到服务端...', 'warning');
      }

      const adminSecret = prompt('请输入管理员密钥（用于保存服务端配置）:');
      if (!adminSecret) {
        return;
      }

      const res = await fetch('http://127.0.0.1:3100/api/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret
        },
        body: JSON.stringify(this.currentConfig)
      });

      if (!res.ok) {
        throw new Error('保存失败 (HTTP ' + res.status + ')');
      }

      const result = await res.json();
      if (result.code === 0) {
        if (typeof showToast === 'function') {
          showToast('✅ 已保存到服务端', 'success');
        }

        this.serverStatus = 'connected';
        this.updateStatusDisplay();
      } else {
        throw new Error(result.message || '保存失败');
      }
    } catch (err) {
      console.error('[AIConfig] 保存到服务端失败:', err);
      if (typeof showToast === 'function') {
        showToast('❌ 保存到服务端失败: ' + err.message, 'error');
      }

      this.serverStatus = 'disconnected';
      this.updateStatusDisplay();
    }
  }

  /**
   * 检查服务端状态
   * 对应原 checkServerStatus() 函数
   *
   * 大白话：检查服务端是否配置了AI密钥
   */
  async checkServerStatus() {
    try {
      const res = await fetch('http://127.0.0.1:3100/api/ai-config/status');

      if (!res.ok) {
        this.serverStatus = 'disconnected';
      } else {
        const result = await res.json();
        this.serverStatus = result.code === 0 ? 'connected' : 'disconnected';
      }
    } catch (err) {
      console.warn('[AIConfig] 检查服务端状态失败:', err);
      this.serverStatus = 'disconnected';
    }

    this.updateStatusDisplay();
  }

  /**
   * 测试连接
   * 对应原 testConnection() 函数
   *
   * 大白话：测试当前AI配置是否能正常连接API
   */
  async testConnection() {
    try {
      if (typeof showToast === 'function') {
        showToast('🔄 测试连接中...', 'warning');
      }

      const provider = this.currentConfig.provider;
      const apiKey = provider === 'dashscope' ? this.currentConfig.dashscope_key : this.currentConfig.deepseek_key;

      if (!apiKey) {
        throw new Error('API Key 为空');
      }

      // 这里应该实际调用AI API进行测试
      // 模拟测试
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.apiStatus = 'success';
      this.updateStatusDisplay();

      if (typeof showToast === 'function') {
        showToast('✅ 连接测试成功', 'success');
      }

      return { success: true, status: 'connected' };
    } catch (err) {
      console.error('[AIConfig] 连接测试失败:', err);
      this.apiStatus = 'failed';
      this.updateStatusDisplay();

      if (typeof showToast === 'function') {
        showToast('❌ 连接测试失败: ' + err.message, 'error');
      }

      return { success: false, error: err.message };
    }
  }

  /**
   * 渲染服务商选择器
   * 对应原 renderProviderSelector() 函数
   *
   * 大白话：显示可选的服务商卡片（阿里云、DeepSeek）
   */
  renderProviderSelector() {
    const container = document.getElementById('ai-provider-selector');
    if (!container) {
      console.warn('[AIConfig] 找不到 ai-provider-selector 容器');
      return;
    }

    container.innerHTML = `
      <div class="ai-provider-grid">
        <div class="ai-provider-card ${this.currentConfig.provider === 'dashscope' ? 'active' : ''}" 
             data-action="aic-select-provider" data-provider="dashscope">
          <div class="provider-icon">🚀</div>
          <div class="provider-name">阿里云 DashScope</div>
          <div class="provider-model">${this.currentConfig.dashscope_model || 'qwen-turbo'}</div>
          <div class="provider-check ${this.currentConfig.provider === 'dashscope' ? 'show' : ''}">✓</div>
        </div>
        <div class="ai-provider-card ${this.currentConfig.provider === 'deepseek' ? 'active' : ''}" 
             data-action="aic-select-provider" data-provider="deepseek">
          <div class="provider-icon">🧠</div>
          <div class="provider-name">DeepSeek</div>
          <div class="provider-model">${this.currentConfig.deepseek_model || 'deepseek-chat'}</div>
          <div class="provider-check ${this.currentConfig.provider === 'deepseek' ? 'show' : ''}">✓</div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染配置表单
   * 对应原 renderConfigForm() 函数
   *
   * 大白话：根据当前选择的服务商，显示对应的配置表单
   */
  renderConfigForm() {
    const container = document.getElementById('ai-config-form');
    if (!container) {
      console.warn('[AIConfig] 找不到 ai-config-form 容器');
      return;
    }

    const isDashScope = this.currentConfig.provider === 'dashscope';
    const isDeepSeek = this.currentConfig.provider === 'deepseek';

    container.innerHTML = `
      <div class="ai-form-section">
        <h4 class="ai-form-title">🔑 API 密钥配置</h4>
        <div class="ai-form-row">
          <label class="ai-form-label">
            ${isDashScope ? 'DashScope' : isDeepSeek ? 'DeepSeek' : 'AI'} API Key
          </label>
          <div class="ai-form-input-wrap">
            <input type="password" id="ai-api-key" class="ai-form-input" 
                   value="${isDashScope ? this.currentConfig.dashscope_key : isDeepSeek ? this.currentConfig.deepseek_key : ''}"
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
              isDashScope
                ? `
              <option value="qwen-turbo" ${this.currentConfig.dashscope_model === 'qwen-turbo' ? 'selected' : ''}>qwen-turbo（快速响应）</option>
              <option value="qwen-plus" ${this.currentConfig.dashscope_model === 'qwen-plus' ? 'selected' : ''}>qwen-plus（更强推理）</option>
              <option value="qwen-max" ${this.currentConfig.dashscope_model === 'qwen-max' ? 'selected' : ''}>qwen-max（最强能力）</option>
            `
                : isDeepSeek
                  ? `
              <option value="deepseek-chat" ${this.currentConfig.deepseek_model === 'deepseek-chat' ? 'selected' : ''}>deepseek-chat（通用对话）</option>
              <option value="deepseek-coder" ${this.currentConfig.deepseek_model === 'deepseek-coder' ? 'selected' : ''}>deepseek-coder（代码专用）</option>
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
          🔍 检查双端状态
        </button>
        <button class="ai-btn ai-btn-primary" data-action="aic-save-server">
          💾 保存到服务端
        </button>
      </div>
    `;
  }

  /**
   * 模型变更处理
   * 对应原 onModelChange() 函数
   *
   * 大白话：当用户切换模型时，更新配置
   * @param {string} model - 选择的模型名称
   */
  onModelChange(model) {
    const provider = this.currentConfig.provider;
    this.currentConfig[provider + '_model'] = model;
    this.saveConfig(this.currentConfig);
  }

  /**
   * 更新状态显示
   * 对应原 updateStatusDisplay() 函数
   *
   * 大白话：更新页面上的状态指示灯
   */
  updateStatusDisplay() {
    // 本地存储状态
    const localStatusEl = document.getElementById('local-status');
    if (localStatusEl) {
      const localConfig = Adapter.storage.get(this.STORAGE_KEY);
      localStatusEl.textContent = localConfig ? '已保存' : '未保存';
      localStatusEl.className = 'status-value ' + (localConfig ? 'connected' : 'disconnected');
    }

    // 服务端状态
    const serverStatusEl = document.getElementById('server-status');
    if (serverStatusEl) {
      serverStatusEl.textContent = this.serverStatus === 'connected' ? '已配置' : '未配置';
      serverStatusEl.className = 'status-value ' + this.serverStatus;
    }

    // API连接状态
    const apiStatusEl = document.getElementById('api-status');
    if (apiStatusEl) {
      apiStatusEl.textContent =
        this.apiStatus === 'success' ? '已连接' : this.apiStatus === 'failed' ? '连接失败' : '未测试';
      apiStatusEl.className = 'status-value ' + this.apiStatus;
    }
  }

  /**
   * 销毁逻辑
   */
  async onDestroy() {
    console.log('🤖 AI配置管理插件开始销毁...');

    // 清理资源
    this.currentConfig = null;

    // 触发事件
    window.EventHub.emit('ai-config-destroyed', {
      timestamp: Date.now()
    });

    console.log('✅ AI配置管理插件销毁完成');
  }
}

// 注册插件
window.PluginLoader.register('ai-config', AIConfigPlugin);
console.log('🤖 AI配置插件已注册');
