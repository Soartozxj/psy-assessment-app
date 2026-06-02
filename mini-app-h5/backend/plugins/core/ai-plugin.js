/**
 * ai-plugin.js - AI调用插件
 *
 * 大白话解释：
 * - 这个插件负责AI配置和调用功能
 * - 继承自PluginBase，获得标准接口
 * - 使用Adapter适配H5和小程序双端
 * - 使用EventHub进行事件通信
 *
 * @version 1.0.0
 * @date 2026-05-30
 */

class AiPlugin extends PluginBase {
  /**
   * 构造函数 - 必须调用 super()
   */
  constructor() {
    super({
      name: 'AI调用插件',
      version: '1.0.0',
      description: '负责AI配置和调用的插件'
    });

    // 插件私有属性（必须加下划线前缀）
    this._currentProvider = 'dashscope'; // 当前AI提供商
    this._config = {}; // AI配置
    this._isConnecting = false; // 是否正在连接

    // DOM元素缓存
    this._elements = {};
  }

  /**
   * 初始化逻辑 - 插件加载时调用
   */
  async onInit() {
    console.log('🚀 AI插件开始初始化...');

    try {
      // 1. 加载配置
      await this._loadConfig();

      // 2. 初始化UI
      this._initUI();

      // 3. 注册事件监听
      this._registerEvents();

      console.log('✅ AI插件初始化完成');
    } catch (error) {
      Adapter.logger.error('AI插件初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行逻辑 - 插件被调用时执行
   * @param {object} params - 执行参数
   */
  async onExecute(params = {}) {
    console.log('🎯 AI插件开始执行...', params);

    try {
      // 根据参数执行不同操作
      if (params.action === 'test') {
        return await this._testConnection();
      }

      if (params.action === 'call') {
        return await this._callAI(params.prompt);
      }

      if (params.action === 'loadConfig') {
        await this._loadConfig();
        return { success: true, config: this._config };
      }

      if (params.action === 'saveConfig') {
        return await this.saveToServer(params.apiKey, params.model);
      }

      return { success: true };
    } catch (error) {
      Adapter.logger.error('AI插件执行失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 销毁逻辑 - 插件卸载时调用
   */
  onDestroy() {
    console.log('🗑️ AI插件开始销毁...');

    // 1. 取消事件监听
    this._unregisterEvents();

    // 2. 清理定时器
    // ...

    // 3. 释放资源
    this._config = null;
    this._elements = null;

    console.log('✅ AI插件销毁完成');
  }

  // ========== 私有方法 ==========

  /**
   * 加载配置
   * @private
   */
  async _loadConfig() {
    console.log('📂 加载AI配置...');

    try {
      const saved = Adapter.storage.get('psy_ai_config');
      if (saved) {
        this._config = Object.assign({}, this._getDefaultConfig(), saved);
      } else {
        this._config = this._getDefaultConfig();
      }

      this._currentProvider = this._config.provider || 'dashscope';

      console.log('✅ AI配置加载成功');

      // 触发事件（如果EventHub可用）
      if (window.EventHub && typeof window.EventHub.emit === 'function') {
        await window.EventHub.emit('ai-config-loaded', { config: this._config });
      } else {
        console.warn('⚠️ EventHub 不可用，跳过事件触发');
      }
    } catch (e) {
      Adapter.logger.warn('Failed to load AI config:', e);
      this._config = this._getDefaultConfig();
    }
  }

  /**
   * 获取默认配置
   * @private
   */
  _getDefaultConfig() {
    return {
      provider: 'dashscope',
      dashscope_key: '',
      dashscope_model: 'qwen-turbo',
      deepseek_key: '',
      deepseek_model: 'deepseek-chat'
    };
  }

  /**
   * 初始化UI
   * @private
   */
  _initUI() {
    console.log('🎨 初始化AI配置UI...');

    // 缓存DOM元素
    this._cacheElements();

    // 渲染Provider选择器
    this._renderProviderSelector();

    // 渲染配置表单
    this._renderConfigForm();

    // 绑定事件委托（使用EventHub或原生事件）
    this._bindEvents();
  }

  /**
   * 绑定事件委托
   * @private
   */
  _bindEvents() {
    console.log('📡 绑定AI配置事件...');

    // 使用事件委托，监听整个AI配置区域
    const container = document.getElementById('ai-config-container') || document;

    // 防止重复绑定
    if (this._eventsBound) {
      console.log('⚠️ 事件已绑定，跳过');
      return;
    }

    // 监听所有data-action为aic-开头的元素点击
    container.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) {
        return;
      }

      const action = target.getAttribute('data-action');

      // 只处理aic-开头的动作
      if (!action.startsWith('aic-')) {
        return;
      }

      console.log(`🖱️ AI插件收到动作: ${action}`);

      try {
        switch (action) {
          case 'aic-select-provider':
            const provider = target.getAttribute('data-provider');
            await this.selectProvider(provider);
            break;

          case 'aic-toggle-visibility':
            this.toggleKeyVisibility();
            break;

          case 'aic-load-server':
            await this.loadFromServer();
            break;

          case 'aic-save-server':
            await this.saveToServer();
            break;

          case 'aic-test-connection':
            await this.testConnection();
            break;

          case 'aic-check-status':
            await this.checkServerStatus();
            break;

          case 'aic-model-change':
            const model = target.value;
            this.onModelChange(model);
            break;
        }
      } catch (error) {
        Adapter.logger.error('AI插件动作执行失败:', error);
        this.showToast('操作失败：' + error.message, 'error');
      }
    });

    // 监听模型选择变化（select的change事件）
    container.addEventListener('change', (e) => {
      if (e.target.getAttribute('data-action') === 'aic-model-change') {
        const model = e.target.value;
        this.onModelChange(model);
      }
    });

    this._eventsBound = true;
    console.log('✅ AI配置事件绑定完成');
  }

  /**
   * 缓存DOM元素
   * @private
   */
  _cacheElements() {
    this._elements = {
      providerSelector: document.getElementById('ai-provider-selector'),
      configForm: document.getElementById('ai-config-form'),
      statusPanel: document.getElementById('ai-status-panel'),
      apiKey: document.getElementById('ai-api-key'),
      modelSelect: document.getElementById('ai-model-select'),
      loadStatus: document.getElementById('ai-load-status'),
      saveStatus: document.getElementById('ai-save-status'),
      testResult: document.getElementById('ai-test-result'),
      statusResult: document.getElementById('ai-status-result')
    };
  }

  /**
   * 渲染Provider选择器
   * @private
   */
  _renderProviderSelector() {
    const container = this._elements.providerSelector;
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="ai-provider-grid">
        <div class="ai-provider-card ${this._currentProvider === 'dashscope' ? 'active' : ''}" 
             data-action="aic-select-provider" data-provider="dashscope">
          <div class="provider-icon">🚀</div>
          <div class="provider-name">阿里云 DashScope</div>
          <div class="provider-model">qwen-turbo / qwen-plus</div>
          <div class="provider-check ${this._currentProvider === 'dashscope' ? 'show' : ''}">✓</div>
        </div>
        <div class="ai-provider-card ${this._currentProvider === 'deepseek' ? 'active' : ''}" 
             data-action="aic-select-provider" data-provider="deepseek">
          <div class="provider-icon">🧠</div>
          <div class="provider-name">DeepSeek</div>
          <div class="provider-model">deepseek-chat / deepseek-coder</div>
          <div class="provider-check ${this._currentProvider === 'deepseek' ? 'show' : ''}">✓</div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染配置表单
   * @private
   */
  _renderConfigForm() {
    const container = this._elements.configForm;
    if (!container) {
      return;
    }

    const isDashscope = this._currentProvider === 'dashscope';
    const isDeepseek = this._currentProvider === 'deepseek';

    container.innerHTML = `
      <div class="ai-form-section">
        <h4 class="ai-form-title">🔑 API 密钥配置</h4>
        <div class="ai-form-row">
          <label class="ai-form-label">
            ${isDashscope ? 'DashScope' : isDeepseek ? 'DeepSeek' : 'AI'} API Key
          </label>
          <div class="ai-form-input-wrap">
            <input type="password" id="ai-api-key" class="ai-form-input" 
                   value="${this._config[this._currentProvider + '_key'] || ''}"
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
          <select id="ai-model-select" class="ai-form-select" data-action="aic-model-change">
            ${
              isDashscope
                ? `
              <option value="qwen-turbo" ${this._config.dashscope_model === 'qwen-turbo' ? 'selected' : ''}>qwen-turbo（快速响应）</option>
              <option value="qwen-plus" ${this._config.dashscope_model === 'qwen-plus' ? 'selected' : ''}>qwen-plus（更强推理）</option>
              <option value="qwen-max" ${this._config.dashscope_model === 'qwen-max' ? 'selected' : ''}>qwen-max（最强能力）</option>
            `
                : isDeepseek
                  ? `
              <option value="deepseek-chat" ${this._config.deepseek_model === 'deepseek-chat' ? 'selected' : ''}>deepseek-chat（通用对话）</option>
              <option value="deepseek-coder" ${this._config.deepseek_model === 'deepseek-coder' ? 'selected' : ''}>deepseek-coder（代码专用）</option>
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
   * @private
   */
  _renderStatusPanel(status) {
    const container = this._elements.statusPanel;
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

  // ========== 公共方法 ==========

  /**
   * 选择AI提供商
   * @param {string} provider - 提供商名称（dashscope/deepseek）
   */
  async selectProvider(provider) {
    console.log('🔄 切换AI提供商:', provider);

    try {
      this._currentProvider = provider;
      this._config.provider = provider;
      Adapter.storage.set('psy_ai_config', this._config);

      // 更新UI
      this._renderProviderSelector();
      this._renderConfigForm();

      // 触发事件（使用window.EventHub确保访问全局实例）
      if (window.EventHub && typeof window.EventHub.emit === 'function') {
        window.EventHub.emit('ai-config-changed', { provider });
      } else {
        console.warn('⚠️ EventHub 不可用，跳过事件触发');
      }

      this.showToast('已切换到 ' + (provider === 'dashscope' ? '阿里云 DashScope' : 'DeepSeek'), 'info');

      console.log('✅ 提供商切换成功');
    } catch (error) {
      Adapter.logger.error('切换提供商失败:', error);
      throw error;
    }
  }

  /**
   * 模型变更
   * @param {string} model - 模型名称
   */
  onModelChange(model) {
    console.log('🤖 模型变更:', model);

    const provider = this._currentProvider;
    this._config[provider + '_model'] = model;
    Adapter.storage.set('psy_ai_config', this._config);
  }

  /**
   * 切换密钥可见性
   */
  toggleKeyVisibility() {
    const input = this._elements.apiKey;
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  }

  /**
   * 从服务端加载配置
   */
  async loadFromServer() {
    try {
      if (this._elements.loadStatus) {
        this._elements.loadStatus.textContent = '正在加载...';
      }

      const res = await Adapter.http.get('/api/ai-config');
      const data = await res.json();

      if (data.code === 0 && data.data) {
        this._config = Object.assign({}, this._getDefaultConfig(), data.data);
        Adapter.storage.set('psy_ai_config', this._config);
        this._renderConfigForm();

        this.showToast('配置已从服务端加载', 'success');
        if (this._elements.loadStatus) {
          this._elements.loadStatus.textContent = '✅ 已加载';
        }
      } else {
        if (this._elements.loadStatus) {
          this._elements.loadStatus.textContent = '⚠️ 服务端无配置';
        }
        this.showToast('服务端暂无配置，请手动填写后保存', 'warning');
      }
    } catch (e) {
      Adapter.logger.error('Failed to load config:', e);
      this.showToast('加载失败：' + e.message, 'error');
    }
  }

  /**
   * 保存配置到服务端
   * @param {string} apiKey - API密钥
   * @param {string} model - 模型名称
   */
  async saveToServer(apiKey, model) {
    const key = apiKey || (this._elements.apiKey ? this._elements.apiKey.value.trim() : '');
    const selectedModel = model || (this._elements.modelSelect ? this._elements.modelSelect.value : '');

    if (!key) {
      this.showToast('请输入 API Key', 'warning');
      return { success: false, error: '请输入API Key' };
    }

    const provider = this._currentProvider;
    this._config[provider + '_key'] = key;
    this._config[provider + '_model'] = selectedModel;
    Adapter.storage.set('psy_ai_config', this._config);

    try {
      if (this._elements.saveStatus) {
        this._elements.saveStatus.textContent = '正在保存...';
      }

      const res = await Adapter.http.post('/api/ai-config', {
        provider: provider,
        api_key: key,
        model: selectedModel
      });

      const data = await res.json();

      if (data.code === 0) {
        if (this._elements.saveStatus) {
          this._elements.saveStatus.textContent = '✅ 已保存';
        }
        this.showToast('配置已保存到服务端', 'success');
        return { success: true };
      } else {
        throw new Error(data.message || '保存失败');
      }
    } catch (e) {
      Adapter.logger.error('Failed to save config:', e);
      this.showToast('保存失败：' + e.message, 'error');
      return { success: false, error: e.message };
    }
  }

  /**
   * 检查服务端状态
   */
  async checkServerStatus() {
    if (this._elements.statusResult) {
      this._elements.statusResult.innerHTML = '<span class="ai-loading">🔄 检查中...</span>';
    }

    try {
      const res = await Adapter.http.get('/api/ai-config/status');
      const data = await res.json();

      if (data.code === 0) {
        this._renderStatusPanel(data.data);
      } else {
        if (this._elements.statusResult) {
          this._elements.statusResult.innerHTML = '<span class="ai-error">❌ 检查失败</span>';
        }
      }
    } catch (e) {
      Adapter.logger.error('Failed to check status:', e);
      if (this._elements.statusResult) {
        this._elements.statusResult.innerHTML = '<span class="ai-error">❌ 网络错误</span>';
      }
    }
  }

  /**
   * 测试API连接
   */
  async testConnection() {
    if (this._elements.testResult) {
      this._elements.testResult.innerHTML = '<span class="ai-loading">🔄 测试中...</span>';
    }

    try {
      const res = await Adapter.http.post('/api/ai-config/test', {});
      const data = await res.json();

      if (data.code === 0 && data.data.ok) {
        if (this._elements.testResult) {
          this._elements.testResult.innerHTML = `<span class="ai-success">✅ 连接成功 · 延迟 ${data.data.latency}ms</span>`;
        }
        this.showToast('API 连接测试成功', 'success');
        return { success: true, latency: data.data.latency };
      } else {
        throw new Error(data.data?.error || '测试失败');
      }
    } catch (e) {
      Adapter.logger.error('Test failed:', e);
      if (this._elements.testResult) {
        this._elements.testResult.innerHTML = `<span class="ai-error">❌ ${e.message}</span>`;
      }
      this.showToast('测试失败：' + e.message, 'error');
      return { success: false, error: e.message };
    }
  }

  /**
   * 调用AI
   * @param {string} prompt - 提示词
   * @private
   */
  async _callAI(prompt) {
    console.log('🤖 调用AI...', prompt);

    // TODO: 实际调用AI API
    // 这里先返回模拟结果

    return {
      success: true,
      data: '这是AI的回复（模拟）'
    };
  }

  /**
   * 测试连接
   * @private
   */
  async _testConnection() {
    console.log('🔌 测试AI连接...');

    // TODO: 实际调用AI API测试连接
    // 这里先模拟成功
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log('✅ AI连接测试成功');
    return true;
  }

  /**
   * 注册事件监听
   * @private
   */
  _registerEvents() {
    console.log('📡 注册AI插件事件...');

    // 监听配置变更事件
    this.registerEventListener('ai-config-changed', (data) => {
      console.log('收到AI配置变更事件:', data);
      this._config = Object.assign({}, this._config, data);
    });
  }

  /**
   * 取消事件监听
   * @private
   */
  _unregisterEvents() {
    console.log('📡 取消AI插件事件监听...');

    // 基类会自动清理通过 registerEventListener 注册的事件
    // 这里只需要清理手动注册的事件
  }
}

// 通过 <script> 标签加载时，注册到全局
// 命名规则：{capitalize(pluginName)}Plugin -> window.AiPlugin
// 注意：plugin-loader.js 会用 _capitalize(pluginName) + 'Plugin' 查找
window.AiPlugin = AiPlugin;

console.log('✅ ai-plugin.js 加载完成');
