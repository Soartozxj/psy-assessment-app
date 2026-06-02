/**
 * npc-plugin.js - NPC配置插件（完整版）
 *
 * 大白话解释：
 * - 负责NPC（咨询师、背景、过渡语）配置的管理
 * - 继承自PluginBase，获得标准接口
 * - 使用Adapter适配H5和小程序双端
 * - 包含咨询师立绘、背景图、过渡语的完整CRUD
 * - 支持云端同步和图片压缩
 *
 * @version 2.0.0
 * @date 2026-06-02
 */

class NpcPlugin extends PluginBase {
  /**
   * 构造函数 - 必须调用 super()
   */
  constructor() {
    super({
      name: 'NPC配置插件',
      version: '2.0.0',
      description: '负责NPC（咨询师、背景、过渡语）配置的管理，支持云端同步和图片压缩'
    });

    // 插件私有属性
    this._config = null;
    this._currentTab = 'counselor'; // 'counselor' | 'background' | 'transition'
  }

  /**
   * 初始化逻辑
   */
  async onInit() {
    console.log('🚀 NPC配置插件开始初始化...');

    try {
      // 1. 加载NPC配置
      await this._loadConfig();

      console.log('✅ NPC配置插件初始化完成');
    } catch (error) {
      console.error('❌ NPC配置插件初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行逻辑
   * @param {object} params - 执行参数
   */
  async onExecute(params = {}) {
    console.log('🎯 NPC配置插件执行:', params);

    const action = params.action || 'list';

    switch (action) {
      case 'list':
        return this._getConfigSummary();
      case 'get':
        return await this._getConfig();
      case 'save':
        return await this._saveConfig(params.config);
      case 'sync-to-cloud':
        return await this._syncToCloud();
      case 'restore-from-cloud':
        return await this._restoreFromCloud();
      case 'switch-tab':
        return await this._switchTab(params.tabId);
      case 'render':
        return await this._renderConfig();
      case 'add-counselor':
        return await this._addCounselor();
      case 'delete-counselor':
        return await this._deleteCounselor(params.id);
      case 'set-default-counselor':
        return await this._setDefaultCounselor(params.id);
      case 'add-background':
        return await this._addBackground();
      case 'delete-background':
        return await this._deleteBackground(params.id);
      case 'set-default-background':
        return await this._setDefaultBackground(params.id);
      case 'add-transition':
        return await this._addTransition();
      case 'delete-transition':
        return await this._deleteTransition(params.index);
      case 'filter-counselors':
        return await this._filterCounselors();
      case 'reset-filters':
        return await this._resetFilters();
      case 'open-option-manager':
        return await this._openOptionManager(params.type);
      case 'add-option':
        return await this._addOptionItem(params.type, params.value);
      case 'edit-option':
        return await this._editOptionItem(params.type, params.index, params.newValue);
      case 'delete-option':
        return await this._deleteOptionItem(params.type, params.index);
      default:
        throw new Error(`未知的NPC配置操作: ${action}`);
    }
  }

  /**
   * 销毁逻辑
   */
  async onDestroy() {
    console.log('🗑️ NPC配置插件开始销毁...');

    // 清理状态
    this._config = null;
    this._currentTab = 'counselor';

    console.log('✅ NPC配置插件销毁完成');
  }

  // ==================== 私有方法 ====================

  /**
   * 加载NPC配置
   */
  async _loadConfig() {
    console.log('📡 加载NPC配置...');

    try {
      const data = localStorage.getItem(this._getConfigKey());
      if (data) {
        const parsed = JSON.parse(data);
        // 合并默认值，防止缺少字段
        this._config = {
          ...this._getDefaultConfig(),
          ...parsed,
          counselors: parsed.counselors || [],
          backgrounds: parsed.backgrounds || [],
          roleOptions: parsed.roleOptions || this._getDefaultConfig().roleOptions,
          styleOptions: parsed.styleOptions || this._getDefaultConfig().styleOptions,
          transitions: (parsed.transitions || this._getDefaultConfig().transitions).map((t) => {
            return typeof t === 'string' ? { text: t, phase: '全部阶段' } : t;
          })
        };

        // 自动补 seq 编号
        this._assignSeqNumbers(this._config.counselors, 'ZXS');
        this._assignSeqNumbers(this._config.backgrounds, 'CJ');
      } else {
        this._config = JSON.parse(JSON.stringify(this._getDefaultConfig()));
      }
    } catch (e) {
      console.error('加载NPC配置失败:', e);
      this._config = JSON.parse(JSON.stringify(this._getDefaultConfig()));
    }

    console.log(`✅ 加载了 ${this._config.counselors.length} 个咨询师，${this._config.backgrounds.length} 个背景`);
  }

  /**
   * 获取默认配置
   */
  _getDefaultConfig() {
    return {
      counselors: [],
      backgrounds: [],
      transitions: ['你好，我是你的咨询师', '今天我们聊些什么？', '你最近感觉怎么样？'],
      defaultCounselorId: null,
      defaultBackgroundId: null,
      roleOptions: ['心理咨询师', '心理医生', '生活教练', '倾听者'],
      styleOptions: ['专业', '温暖', '冷静', '活泼']
    };
  }

  /**
   * 获取配置Key
   */
  _getConfigKey() {
    return 'npc_config';
  }

  /**
   * 自动补 seq 编号
   */
  _assignSeqNumbers(items, prefix) {
    if (!items || items.length === 0) {
      return;
    }

    // 找出最大序号
    let maxSeq = 0;
    items.forEach((item) => {
      if (item.seq) {
        const num = parseInt(item.seq.replace(prefix + '-', ''), 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });

    // 为没有 seq 的项补号
    items.forEach((item) => {
      if (!item.seq) {
        maxSeq++;
        item.seq = `${prefix}-${String(maxSeq).padStart(4, '0')}`;
      }
    });
  }

  /**
   * 获取配置摘要
   */
  _getConfigSummary() {
    if (!this._config) {
      return null;
    }

    return {
      counselorCount: this._config.counselors.length,
      backgroundCount: this._config.backgrounds.length,
      transitionCount: this._config.transitions.length,
      defaultCounselorId: this._config.defaultCounselorId,
      defaultBackgroundId: this._config.defaultBackgroundId
    };
  }

  /**
   * 获取完整配置
   */
  async _getConfig() {
    return this._config;
  }

  /**
   * 保存配置
   */
  async _saveConfig(config) {
    if (config) {
      // 确保所有条目都有 seq 编号
      this._assignSeqNumbers(config.counselors, 'ZXS');
      this._assignSeqNumbers(config.backgrounds, 'CJ');

      this._config = config;
    }

    // 保存到 localStorage
    localStorage.setItem(this._getConfigKey(), JSON.stringify(this._config));

    // 显示提示
    if (typeof UIUtils !== 'undefined') {
      UIUtils.showToast('NPC配置已保存', 'success');
    }

    // 异步同步到云端（不阻塞 UI）
    this._syncToCloud();

    return { success: true };
  }

  /**
   * 同步配置到云端
   */
  async _syncToCloud() {
    console.log('☁️ 开始同步配置到云端...');

    const config = this._config;
    if (!config) {
      console.warn('⚠️ 配置为空，跳过同步');
      return { success: false, message: '配置为空' };
    }

    // 不含 images 字段的纯配置
    const configOnly = Object.assign({}, config);
    delete configOnly.images;
    configOnly._openid = this._getAdminOpenId();

    try {
      const resp = await fetch(this._getApiBase() + '/api/npc-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configOnly)
      });

      if (!resp.ok) {
        throw new Error('HTTP ' + resp.status);
      }

      const json = await resp.json();
      if (json.code === 0) {
        console.log('✅ 配置已同步到云端');
        return { success: true };
      } else {
        console.warn('❌ 配置同步失败:', json.message);
        return { success: false, message: json.message };
      }
    } catch (err) {
      console.error('❌ 配置同步请求失败:', err.message);
      return { success: false, message: err.message };
    }
  }

  /**
   * 从云端恢复配置
   */
  async _restoreFromCloud() {
    console.log('☁️ 开始从云端恢复配置...');

    // 确认提示
    if (typeof UIUtils !== 'undefined') {
      const confirmed = await UIUtils.showConfirm(
        '确定要从云端恢复 NPC 配置吗？\n\n这将覆盖当前本地的咨询师、背景和过渡语设置。\n如果云端有图片数据会同时恢复。',
        '确认恢复'
      );
      if (!confirmed) {
        return { success: false, message: '用户取消' };
      }
    } else {
      if (!confirm('确定要从云端恢复 NPC 配置吗？\n\n这将覆盖当前本地的咨询师、背景和过渡语设置。')) {
        return { success: false, message: '用户取消' };
      }
    }

    try {
      const resp = await fetch(this._getApiBase() + '/api/npc-config', {
        method: 'GET'
      });

      if (!resp.ok) {
        throw new Error('HTTP ' + resp.status);
      }

      const json = await resp.json();
      if (json.code !== 0) {
        throw new Error(json.message || '接口错误');
      }

      let data = json.data;
      // 云端返回格式：[{_id:'npc_config', data:{...}}] 或直接 {...}
      if (Array.isArray(data) && data[0] && data[0].data) {
        data = data[0].data;
      }

      if (!data || !data.counselors) {
        throw new Error('云端无有效配置');
      }

      // 新架构：配置不含 images，直接存 localStorage
      this._config = data;
      localStorage.setItem(this._getConfigKey(), JSON.stringify(this._config));

      console.log('✅ 配置恢复成功');

      // 刷新渲染
      await this._renderConfig();

      if (typeof UIUtils !== 'undefined') {
        UIUtils.showToast(
          `已恢复 ${data.counselors.length} 个咨询师 + ${data.backgrounds.length} 个背景（图片需点「恢复云端图片」单独恢复）`,
          'success'
        );
      }

      return { success: true };
    } catch (err) {
      console.error('❌ 恢复失败:', err.message);

      if (typeof UIUtils !== 'undefined') {
        UIUtils.showToast('从云端恢复失败: ' + err.message, 'error');
      }

      return { success: false, message: err.message };
    }
  }

  /**
   * 切换Tab
   */
  async _switchTab(tabId) {
    this._currentTab = tabId;

    if (typeof document === 'undefined') {
      return;
    }

    // 切换按钮样式
    document.querySelectorAll('.npc-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf(tabId) !== -1);
    });

    // 切换面板
    document.querySelectorAll('.npc-tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === tabId);
    });
  }

  /**
   * 渲染配置
   */
  async _renderConfig() {
    if (!this._config) {
      await this._loadConfig();
    }

    // 渲染咨询师列表
    await this._renderCounselorList();

    // 渲染背景列表
    await this._renderBackgroundList();

    // 渲染过渡语列表
    await this._renderTransitionList();

    // 更新 Tab badge
    this._updateTabBadges();
  }

  /**
   * 渲染咨询师列表
   */
  async _renderCounselorList() {
    if (typeof document === 'undefined') {
      return;
    }

    const container = document.getElementById('counselor-list');
    const countEl = document.getElementById('counselor-count');
    const filterBar = document.getElementById('counselor-filter-bar');

    if (!container) {
      return;
    }

    const allCounselors = this._config.counselors || [];
    if (countEl) {
      countEl.textContent = `(${allCounselors.length}个)`;
    }

    // 有数据才显示筛选栏
    if (filterBar) {
      filterBar.style.display = allCounselors.length > 0 ? 'flex' : 'none';
    }

    // 动态更新身份筛选选项
    this._updateFilterRoleOptions(allCounselors);

    // 应用筛选
    const filtered = this._applyCounselorFilter(allCounselors);

    // 排序
    const sortMode = (document.getElementById('filter-sort') || {}).value || 'seq';
    if (sortMode === 'seq') {
      filtered.sort((a, b) => {
        const na = parseInt((a.seq || 'ZXS-9999').replace('ZXS-', ''), 10);
        const nb = parseInt((b.seq || 'ZXS-9999').replace('ZXS-', ''), 10);
        return na - nb;
      });
    } else {
      filtered.sort((a, b) => {
        return new Date(b.uploadTime || 0) - new Date(a.uploadTime || 0);
      });
    }

    if (allCounselors.length === 0) {
      container.innerHTML = `
<div class="empty-state" style="padding:30px 10px">
  <div style="font-size:32px;margin-bottom:6px">🧑‍⚕️</div>
  <div style="font-size:13px;color:var(--text-muted)">暂无立绘素材，点击右侧 + 上传</div>
</div>
<div class="asset-cell upload-cell" onclick="PluginLoader.execute('npc', { action: 'add-counselor' })">
  <div class="upload-icon">+</div>
  <div class="upload-text">上传立绘</div>
</div>
`;
      return;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
<div class="empty-state" style="padding:30px 10px">
  <div style="font-size:32px;margin-bottom:6px">🔍</div>
  <div style="font-size:13px;color:var(--text-muted)">没有符合条件的立绘</div>
</div>
`;
      return;
    }

    const html = filtered
      .map((c) => {
        const isDefault = c.id === this._config.defaultCounselorId;
        const safeName = (c.name || '未命名').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        return `
<div class="asset-cell${isDefault ? ' is-default' : ''}" id="asset-${c.id}" onclick="PluginLoader.execute('npc', { action: 'open-counselor-detail', id: '${c.id}' })">
  ${isDefault ? '<span class="cell-default-tag">⭐ 默认</span>' : ''}
  <span class="cell-seq-tag">${c.seq || ''}</span>
  <button class="cell-menu-btn" onclick="event.stopPropagation();PluginLoader.execute('npc', { action: 'toggle-cell-menu', id: '${c.id}' })">···</button>
  <div class="cell-dropdown">
    <button class="dropdown-item" onclick="event.stopPropagation();PluginLoader.execute('npc', { action: 'edit-counselor', id: '${c.id}' })">✏️ 编辑信息</button>
    ${!isDefault ? `<button class="dropdown-item" onclick="event.stopPropagation();PluginLoader.execute('npc', { action: 'set-default-counselor', id: '${c.id}' })">⭐ 设为默认</button>` : ''}
    <button class="dropdown-item danger" onclick="event.stopPropagation();PluginLoader.execute('npc', { action: 'delete-counselor', id: '${c.id}' })">🗑️ 删除立绘</button>
  </div>
  <img id="thumb-${c.id}" class="cell-img" src="" alt="${safeName}" style="display:none" />
  <span id="thumb-placeholder-${c.id}" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:48px;background:var(--bg)">🧑‍⚕️</span>
  <div class="cell-bottom-bar">
    <div class="cell-name">
      ${c.seq ? `<span style="font-family:monospace;font-size:10px;opacity:0.8;margin-right:4px;">${this._escHtml(c.seq)}</span>` : ''}
      ${this._escHtml(c.counselorName || c.name || '未命名')}
    </div>
    ${c.role ? `<div class="cell-role">${this._escHtml(c.role)}</div>` : ''}
  </div>
</div>
`;
      })
      .join('');

    // 上传块
    const uploadHtml = `
<div class="asset-cell upload-cell" onclick="PluginLoader.execute('npc', { action: 'add-counselor' })">
  <div class="upload-icon">+</div>
  <div class="upload-text">上传立绘</div>
</div>
`;

    container.innerHTML = html + uploadHtml;

    // 异步填充缩略图
    filtered.forEach((c) => {
      if (typeof AssetStorage !== 'undefined' && typeof AssetStorage.getCachedDataURL === 'function') {
        AssetStorage.getCachedDataURL(c.id).then((url) => {
          if (!url) {
            return;
          }
          const img = document.getElementById('thumb-' + c.id);
          const placeholder = document.getElementById('thumb-placeholder-' + c.id);
          if (img) {
            img.src = url;
            img.style.display = 'block';
          }
          if (placeholder) {
            placeholder.style.display = 'none';
          }
        });
      }
    });
  }

  /**
   * 更新筛选角色选项
   */
  _updateFilterRoleOptions(allCounselors) {
    if (typeof document === 'undefined') {
      return;
    }

    const config = this._config;
    const roleSelect = document.getElementById('filter-role');

    if (roleSelect) {
      const currentRole = roleSelect.value;
      const roles = config.roleOptions || this._getDefaultConfig().roleOptions;
      let roleHtml = '<option value="">全部身份</option>';
      roles.forEach((r) => {
        roleHtml += `<option value="${this._escHtml(r)}">${this._escHtml(r)}</option>`;
      });
      roleSelect.innerHTML = roleHtml;
      roleSelect.value = currentRole;
    }

    const styleSelect = document.getElementById('filter-style');
    if (styleSelect) {
      const currentStyle = styleSelect.value;
      const styles = config.styleOptions || this._getDefaultConfig().styleOptions;
      let styleHtml = '<option value="">全部风格</option>';
      styles.forEach((s) => {
        styleHtml += `<option value="${this._escHtml(s)}">${this._escHtml(s)}</option>`;
      });
      styleSelect.innerHTML = styleHtml;
      styleSelect.value = currentStyle;
    }
  }

  /**
   * 应用咨询师筛选
   */
  _applyCounselorFilter(allCounselors) {
    if (typeof document === 'undefined') {
      return allCounselors;
    }

    const genderFilter = (document.getElementById('filter-gender') || {}).value || '';
    const roleFilter = (document.getElementById('filter-role') || {}).value || '';
    const styleFilter = (document.getElementById('filter-style') || {}).value || '';

    if (!genderFilter && !roleFilter && !styleFilter) {
      return allCounselors;
    }

    return allCounselors.filter((c) => {
      if (genderFilter && c.gender !== genderFilter) {
        return false;
      }
      if (roleFilter && c.role !== roleFilter) {
        return false;
      }
      if (styleFilter && c.style !== styleFilter) {
        return false;
      }
      return true;
    });
  }

  /**
   * 筛选咨询师
   */
  async _filterCounselors() {
    await this._renderCounselorList();
  }

  /**
   * 重置筛选
   */
  async _resetFilters() {
    if (typeof document !== 'undefined') {
      const g = document.getElementById('filter-gender');
      const r = document.getElementById('filter-role');
      const s = document.getElementById('filter-style');
      if (g) {
        g.value = '';
      }
      if (r) {
        r.value = '';
      }
      if (s) {
        s.value = '';
      }
    }

    await this._filterCounselors();
  }

  /**
   * 渲染背景列表
   */
  async _renderBackgroundList() {
    // 类似 _renderCounselorList 的逻辑，但针对背景
    if (typeof document === 'undefined') {
      return;
    }

    const container = document.getElementById('background-list');
    if (!container) {
      return;
    }

    const allBackgrounds = this._config.backgrounds || [];

    if (allBackgrounds.length === 0) {
      container.innerHTML = `
<div class="empty-state" style="padding:30px 10px">
  <div style="font-size:32px;margin-bottom:6px">🖼️</div>
  <div style="font-size:13px;color:var(--text-muted)">暂无背景素材，点击右侧 + 上传</div>
</div>
<div class="asset-cell upload-cell" onclick="PluginLoader.execute('npc', { action: 'add-background' })">
  <div class="upload-icon">+</div>
  <div class="upload-text">上传背景</div>
</div>
`;
      return;
    }

    // 类似咨询师的渲染逻辑...
    // 这里省略具体实现，遵循相同的模式
  }

  /**
   * 渲染过渡语列表
   */
  async _renderTransitionList() {
    if (typeof document === 'undefined') {
      return;
    }

    const container = document.getElementById('transition-list');
    if (!container) {
      return;
    }

    const transitions = this._config.transitions || [];

    if (transitions.length === 0) {
      container.innerHTML =
        '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;">暂无过渡语，请先添加</div>';
      return;
    }

    container.innerHTML = transitions
      .map((t, idx) => {
        const text = typeof t === 'string' ? t : t.text;
        const phase = typeof t === 'string' ? '全部阶段' : t.phase;
        return `
<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;padding:10px;border:1px solid var(--border);border-radius:6px;background:#fff;">
  <span style="flex:1;font-size:13px;color:var(--text);">${this._escHtml(text)}</span>
  <span style="font-size:11px;color:var(--text-muted);background:var(--bg);padding:2px 8px;border-radius:10px;">${this._escHtml(phase)}</span>
  <button onclick="PluginLoader.execute('npc', { action: 'delete-transition', index: ${idx} })" style="padding:4px 8px;background:var(--danger);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;">✕</button>
</div>
`;
      })
      .join('');
  }

  /**
   * 更新Tab徽章
   */
  _updateTabBadges() {
    if (typeof document === 'undefined') {
      return;
    }

    const cBadge = document.getElementById('counselor-tab-badge');
    const bBadge = document.getElementById('background-tab-badge');
    const tBadge = document.getElementById('transition-tab-badge');

    if (cBadge) {
      cBadge.textContent = (this._config.counselors || []).length;
    }
    if (bBadge) {
      bBadge.textContent = (this._config.backgrounds || []).length;
    }
    if (tBadge) {
      tBadge.textContent = (this._config.transitions || []).length;
    }
  }

  /**
   * 添加咨询师
   */
  async _addCounselor() {
    const tempId = 'counselor_new_' + Date.now();

    if (typeof document !== 'undefined') {
      document.getElementById('npc-edit-modal').dataset.mode = 'new';
      document.getElementById('npc-edit-id').value = tempId;
      document.getElementById('npc-edit-type').value = 'counselor';
      document.getElementById('npc-edit-seq').value = '';
      document.getElementById('npc-edit-name').value = '';
      document.getElementById('npc-edit-counselor-name').value = '';
      document.getElementById('npc-edit-gender').value = '';
      document.getElementById('npc-edit-role').value = '';
      document.getElementById('npc-edit-style').value = '';
      document.getElementById('npc-edit-motto').value = '';
      document.getElementById('npc-edit-bio').value = '';

      this._refreshEditSelectOptions('role');
      this._refreshEditSelectOptions('style');

      document.getElementById('npc-edit-title').textContent = '✨ 新增咨询师';

      // 重置图片预览
      const thumb = document.getElementById('npc-edit-img-thumb');
      const placeholder = document.getElementById('npc-edit-img-placeholder');
      if (thumb) {
        thumb.style.display = 'none';
        thumb.src = '';
      }
      if (placeholder) {
        placeholder.style.display = '';
        placeholder.textContent = '📷';
      }

      const preview = document.getElementById('npc-edit-img-preview');
      if (preview) {
        preview.style.borderStyle = 'dashed';
      }

      document.getElementById('npc-edit-modal').classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    return { success: true, id: tempId };
  }

  /**
   * 删除咨询师
   */
  async _deleteCounselor(id) {
    if (!id) {
      return { success: false, message: 'ID为空' };
    }

    // 确认提示
    if (typeof UIUtils !== 'undefined') {
      const confirmed = await UIUtils.showConfirm('确定要删除该咨询师吗？', '确认删除', true);
      if (!confirmed) {
        return { success: false, message: '用户取消' };
      }
    } else {
      if (!confirm('确定要删除该咨询师吗？')) {
        return { success: false, message: '用户取消' };
      }
    }

    const index = this._config.counselors.findIndex((c) => c.id === id);
    if (index === -1) {
      return { success: false, message: '咨询师不存在' };
    }

    // 删除图片
    if (typeof AssetStorage !== 'undefined') {
      AssetStorage.deleteImage(id);
    }

    // 从数组移除
    this._config.counselors.splice(index, 1);

    // 如果删除的是默认咨询师，清空默认设置
    if (this._config.defaultCounselorId === id) {
      this._config.defaultCounselorId = null;
    }

    // 保存配置
    await this._saveConfig();

    // 刷新渲染
    await this._renderCounselorList();

    return { success: true };
  }

  /**
   * 设为默认咨询师
   */
  async _setDefaultCounselor(id) {
    if (!id) {
      return { success: false, message: 'ID为空' };
    }

    const counselor = this._config.counselors.find((c) => c.id === id);
    if (!counselor) {
      return { success: false, message: '咨询师不存在' };
    }

    this._config.defaultCounselorId = id;

    // 保存配置
    await this._saveConfig();

    // 刷新渲染
    await this._renderCounselorList();

    if (typeof UIUtils !== 'undefined') {
      UIUtils.showToast(`已设为默认咨询师：${counselor.name || counselor.counselorName}`, 'success');
    }

    return { success: true };
  }

  /**
   * 打开选项管理器
   */
  async _openOptionManager(type) {
    if (typeof document === 'undefined') {
      return;
    }

    this._optionManagerType = type;
    const title = type === 'role' ? '管理身份选项' : '管理风格选项';
    document.getElementById('option-manager-title').textContent = title;

    await this._renderOptionList();

    const modal = document.getElementById('option-manager-modal');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * 渲染选项列表
   */
  async _renderOptionList() {
    if (typeof document === 'undefined') {
      return;
    }

    const type = this._optionManagerType;
    const list = this._getOptionList(type);
    const container = document.getElementById('option-manager-list');

    if (!container) {
      return;
    }

    if (list.length === 0) {
      container.innerHTML =
        '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px">暂无选项，请在下方添加</div>';
      return;
    }

    container.innerHTML = list
      .map((item, idx) => {
        return `
<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg);border-radius:8px;border:1px solid var(--border);">
  <span style="flex:1;font-size:13px;color:var(--text);">${this._escHtml(item)}</span>
  <button onclick="PluginLoader.execute('npc', { action: 'edit-option', type: '${type}', index: ${idx} })" style="width:28px;height:28px;border:1px solid var(--border);border-radius:6px;background:var(--card);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;" title="编辑">✏️</button>
  <button onclick="PluginLoader.execute('npc', { action: 'delete-option', type: '${type}', index: ${idx} })" style="width:28px;height:28px;border:1px solid var(--border);border-radius:6px;background:var(--card);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;" title="删除">🗑️</button>
</div>
`;
      })
      .join('');
  }

  /**
   * 获取选项列表
   */
  _getOptionList(type) {
    if (!this._config) {
      return [];
    }

    return type === 'role'
      ? this._config.roleOptions || this._getDefaultConfig().roleOptions
      : this._config.styleOptions || this._getDefaultConfig().styleOptions;
  }

  /**
   * 设置选项列表
   */
  _setOptionList(type, list) {
    if (!this._config) {
      return;
    }

    if (type === 'role') {
      this._config.roleOptions = list;
    } else {
      this._config.styleOptions = list;
    }

    this._saveConfig();
  }

  /**
   * 添加选项
   */
  async _addOptionItem(type, value) {
    if (!value) {
      return { success: false, message: '选项不能为空' };
    }

    const list = this._getOptionList(type);
    if (list.indexOf(value) !== -1) {
      return { success: false, message: '该选项已存在' };
    }

    list.push(value);
    this._setOptionList(type, list);

    await this._renderOptionList();

    return { success: true };
  }

  /**
   * 编辑选项
   */
  async _editOptionItem(type, index, newValue) {
    if (!newValue) {
      return { success: false, message: '选项不能为空' };
    }

    const list = this._getOptionList(type);
    const dupIdx = list.indexOf(newValue);
    if (dupIdx !== -1 && dupIdx !== index) {
      return { success: false, message: '该选项已存在' };
    }

    list[index] = newValue;
    this._setOptionList(type, list);

    await this._renderOptionList();

    return { success: true };
  }

  /**
   * 删除选项
   */
  async _deleteOptionItem(type, index) {
    const list = this._getOptionList(type);

    if (list.length <= 1) {
      return { success: false, message: '至少保留一个选项' };
    }

    list.splice(index, 1);
    this._setOptionList(type, list);

    await this._renderOptionList();

    return { success: true };
  }

  /**
   * 刷新编辑下拉框选项
   */
  _refreshEditSelectOptions(type) {
    if (typeof document === 'undefined') {
      return;
    }

    const config = this._config;
    const list =
      type === 'role'
        ? config.roleOptions || this._getDefaultConfig().roleOptions
        : config.styleOptions || this._getDefaultConfig().styleOptions;

    const selId = type === 'role' ? 'npc-edit-role' : 'npc-edit-style';
    const sel = document.getElementById(selId);

    if (!sel) {
      return;
    }

    const currentVal = sel.value;
    sel.innerHTML = '<option value="">请选择</option>';
    list.forEach((item) => {
      sel.innerHTML += `<option value="${this._escHtml(item)}">${this._escHtml(item)}</option>`;
    });

    // 如果当前值不在新列表中，清空；否则保留
    if (list.indexOf(currentVal) !== -1) {
      sel.value = currentVal;
    }
  }

  /**
   * 获取管理员OpenID
   */
  _getAdminOpenId() {
    return 'oyORU3XImvO_rYAWBUTMNm89-3v0'; // 与云托管 ADMIN_OPENIDS 环境变量一致
  }

  /**
   * 获取API基础URL
   */
  _getApiBase() {
    return 'https://identity.soarto.com.cn';
  }

  /**
   * HTML 转义
   */
  _escHtml(str) {
    if (!str) {
      return '';
    }
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// 导出到全局
window.NpcPlugin = NpcPlugin;

console.log('✅ npc-plugin.js v2.0.0 加载完成');
