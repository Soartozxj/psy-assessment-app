/**
 * scale-plugin.js - 量表管理插件
 *
 * 大白话解释：
 * - 这个插件负责量表的增删改查、导入导出等功能
 * - 继承自PluginBase，获得标准接口
 * - 保持向后兼容：保留全局函数（如 renderScaleList, openEditModal 等）
 * - 使用 Adapter 进行双端适配（localStorage → Adapter.storage）
 * - 使用 EventHub 进行事件通信
 *
 * @version 1.0.0
 * @date 2026-05-31
 */

class ScalePlugin extends PluginBase {
  constructor() {
    super({
      name: '量表管理插件',
      version: '1.0.0',
      description: '负责量表的增删改查、导入导出等功能'
    });

    // ====================================================
    // 常量定义（从 admin-legacy.html 迁移）
    // ====================================================
    this.STORAGE_KEY = 'psy_scales';
    this.SYNC_KEY = 'psy_scales_synced';

    // 量表数据缓存
    this.scales = [];
    this.filteredScales = [];

    // UI 状态
    this.isDragSortMode = false;
    this.currentScaleId = null;
    this._openDropdownId = null;

    // 筛选状态
    this.filterKeyword = '';
    this.filterCat = '';
    this.filterStatus = '';
    this.npcFilter = '';

    // 排序状态
    this.sortField = '';
    this.sortOrder = 'asc';

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

    // 保留全局函数（兼容旧代码）
    window.loadScales = function () {
      return self.loadScales.bind(self)();
    };

    window.saveScales = function (scales) {
      return self.saveScales.bind(self)(scales);
    };

    window.normalizeScaleBeforeSave = function (scale) {
      return self.normalizeScaleBeforeSave.bind(self)(scale);
    };

    window.renderScaleList = function () {
      return self.renderScaleList.bind(self)();
    };

    window.renderScaleTypes = function () {
      return self.renderScaleTypes.bind(self)();
    };

    window.openEditModal = function (id) {
      return self.openEditModal.bind(self)(id);
    };

    window.confirmDelete = function (scaleId) {
      return self.confirmDelete.bind(self)(scaleId);
    };

    window.toggleStatus = function (scaleId) {
      return self.toggleStatus.bind(self)(scaleId);
    };

    window.exportSingleScale = function (scaleId) {
      return self.exportSingleScale.bind(self)(scaleId);
    };

    // 添加缺失的向后兼容函数
    window.deleteScale = function (scaleId) {
      return self.deleteScale.bind(self)(scaleId);
    };

    window.editScale = function (scaleId) {
      return self.openEditModal.bind(self)(scaleId);
    };

    window.showScaleForm = function (scaleId) {
      // 如果没有传入scaleId，则新建；否则编辑
      if (scaleId) {
        return self.openEditModal.bind(self)(scaleId);
      } else {
        return self.openEditModal.bind(self)(null); // 新建量表
      }
    };

    window.hideScaleForm = function () {
      return self._closeModal.bind(self)();
    };

    window.exportScales = function () {
      return self.exportScales.bind(self)();
    };

    window.importScale = function (file) {
      return self.importScale.bind(self)(file);
    };

    window.filterScales = function () {
      return self.filterScales.bind(self)();
    };

    window.sortScales = function (field) {
      return self.sortScales.bind(self)(field);
    };

    window.toggleSortOrder = function () {
      return self.toggleSortOrder.bind(self)();
    };

    console.log('✅ 量表管理全局函数已创建（向后兼容）');
  }

  /**
   * 初始化逻辑
   */
  async onInit() {
    console.log('🚀 量表管理插件开始初始化...');

    try {
      // 加载量表数据
      this.scales = this.loadScales();

      // 渲染量表列表
      this.renderScaleList();

      // 渲染量表类型
      this.renderScaleTypes();

      // 绑定事件
      this._bindEvents();

      console.log(`✅ 量表管理插件初始化完成，共加载 ${this.scales.length} 个量表`);

      // 触发事件
      window.EventHub.emit('scale-initialized', {
        count: this.scales.length,
        timestamp: Date.now()
      });
    } catch (error) {
      Adapter.logger.error('量表管理插件初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行逻辑（插件标准接口）
   *
   * @param {object} params - 执行参数
   * @param {string} params.action - 执行动作：load, save, render, delete, export
   * @param {object} [params.scale] - 量表数据（save/delete时用）
   * @param {number} [params.scaleId] - 量表ID（delete/export时用）
   */
  async onExecute(params = {}) {
    console.log('🎯 量表管理插件开始执行...', params);

    try {
      switch (params.action) {
        case 'load':
          return this.loadScales();

        case 'save':
          if (!params.scale) {
            throw new Error('缺少必要参数：scale');
          }
          return this.saveScales([params.scale]);

        case 'render':
          return this.renderScaleList();

        case 'delete':
          if (!params.scaleId) {
            throw new Error('缺少必要参数：scaleId');
          }
          return this.deleteScale(params.scaleId);

        case 'export':
          if (!params.scaleId) {
            throw new Error('缺少必要参数：scaleId');
          }
          return this.exportSingleScale(params.scaleId);

        default:
          throw new Error(`未知动作: ${params.action}`);
      }
    } catch (error) {
      Adapter.logger.error('量表管理插件执行失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 加载量表数据
   * 对应原 loadScales() 函数（admin-legacy.html 第12809行）
   *
   * 大白话：从存储中加载所有量表数据，如果存储中没有，就使用默认量表
   * @returns {Array<object>} 量表数组
   */
  loadScales() {
    try {
      const data = Adapter.storage.get(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 调试：检查是否有量表包含 preQuestions
          const scalesWithPreQ = parsed.filter((s) => s.preQuestions && s.preQuestions.length > 0);
          if (scalesWithPreQ.length > 0) {
            console.log(
              '[loadScales] 找到',
              scalesWithPreQ.length,
              '个量表包含 preQuestions:',
              scalesWithPreQ.map((s) => s.name + '(' + s.preQuestions.length + '道)').join(', ')
            );
          }

          // 合并 DEFAULT_SCALES 中的 aiDiag 配置（localStorage 旧数据可能缺失）
          let needSave = false;
          parsed.forEach((item) => {
            const def = window.DEFAULT_SCALES?.find((d) => d.id === item.id || d.code === item.code);
            if (def && def.aiDiag) {
              if (!item.aiDiag || !item.aiDiag.prompt) {
                item.aiDiag = JSON.parse(JSON.stringify(def.aiDiag));
                needSave = true;
              }
            }
          });

          // 确保导入的新量表也有 npcConfig 等必要字段
          parsed.forEach((item) => {
            if (!item.npcConfig) {
              item.npcConfig = { counselorId: '', backgroundId: '' };
            }
            if (item.completedCount === undefined) {
              item.completedCount = 0;
            }
            if (item.rating === undefined) {
              item.rating = 5.0;
            }

            // 计算 questionCount（列表页依赖此字段）
            if (item.questions && item.questions.length > 0) {
              item.questionCount = item.questions.length;
            } else if (item.questionCount === undefined) {
              item.questionCount = 0;
            }

            // 确保每个量表都有 id
            if (!item.id) {
              item.id = Date.now() + Math.floor(Math.random() * 1000);
            }
          });

          if (needSave) {
            Adapter.storage.set(this.STORAGE_KEY, JSON.stringify(parsed));
          }

          return parsed;
        }
      }
    } catch (e) {
      console.warn('[loadScales] 加载失败:', e);
    }

    // 如果存储中没有数据，使用默认量表
    const defaults = Array.isArray(window.DEFAULT_SCALES) ? window.DEFAULT_SCALES : [];
    defaults.forEach((item) => {
      if (!item.id) {
        item.id = Date.now() + Math.floor(Math.random() * 1000);
      }
    });
    Adapter.storage.set(this.STORAGE_KEY, JSON.stringify(defaults));
    return JSON.parse(JSON.stringify(defaults));
  }

  /**
   * 保存量表数据
   * 对应原 saveScales() 函数（admin-legacy.html 第12863行）
   *
   * 大白话：将量表数据保存到存储中，并同步到前端
   * @param {Array<object>} scales - 量表数组
   */
  saveScales(scales) {
    try {
      // 在保存前确保所有量表都有完整的字段
      const normalizedScales = scales.map((scale) => this.normalizeScaleBeforeSave(scale));
      const jsonStr = JSON.stringify(normalizedScales);
      Adapter.storage.set(this.STORAGE_KEY, jsonStr);

      // 同步到 SharedData
      if (window.SharedData && window.SharedData.saveScalesData) {
        window.SharedData.saveScalesData(normalizedScales);
      }

      // 同步到前端
      this.syncToFrontend();
    } catch (err) {
      console.error('[saveScales] 保存失败:', err);
      Adapter.ui.toast('保存失败：' + (err.message || '存储空间不足'), 'error');
    }
  }

  /**
   * 规范化量表数据（保存前）
   * 对应原 normalizeScaleBeforeSave() 函数（admin-legacy.html 第12876行）
   *
   * 大白话：确保量表的每个字段都有合理的值
   * @param {object} scale - 原始量表数据
   * @returns {object} 规范化后的量表数据
   */
  normalizeScaleBeforeSave(scale) {
    const normalized = { ...scale };

    // 确保所有必要字段都有值
    normalized.name = normalized.name || normalized.scaleName || '未命名量表';
    normalized.shortName = normalized.shortName || normalized.name;
    normalized.code = normalized.code || 'SCALE_' + Date.now();
    normalized.desc = normalized.desc || normalized.description || '';

    // 图标处理：优先使用 icon，然后使用 emoji，最后使用默认图标
    normalized.emoji = normalized.icon || normalized.emoji || '📋';

    // 颜色处理：优先使用 color，然后使用 themeColor，最后使用默认颜色
    normalized.color = normalized.color || normalized.themeColor || '#4A90D9';

    normalized.duration = parseInt(normalized.duration) || 10;
    normalized.status = parseInt(normalized.status) || 1;
    normalized.sortOrder = parseInt(normalized.sortOrder) || 0;
    normalized.rating = parseFloat(normalized.rating) || 5.0;
    normalized.completedCount = parseInt(normalized.completedCount) || 0;

    // 题目数量
    normalized.questionCount =
      normalized.questions && normalized.questions.length > 0
        ? normalized.questions.length
        : parseInt(normalized.questionCount) || 0;

    // 分类信息
    normalized.category = normalized.category || 'other';
    normalized.categoryName = this.getCategoryInfo(normalized.category).name;

    // 标签处理
    if (!normalized.tags || normalized.tags.length === 0) {
      normalized.tags = this.generateTagsFromScaleName(normalized.name);
    } else if (typeof normalized.tags === 'string') {
      normalized.tags = normalized.tags
        .split(/[,，;；]/)
        .map((t) => t.trim())
        .filter(Boolean);
    }

    // NPC配置规范化
    if (!normalized.npcConfig) {
      normalized.npcConfig = { counselorId: '', backgroundId: '' };
    }

    // 确保有 id（没有则自动生成）
    if (!normalized.id) {
      normalized.id = Date.now() + Math.floor(Math.random() * 1000);
    }

    // 题目过渡语规范化
    if (normalized.questions && Array.isArray(normalized.questions)) {
      normalized.questions = normalized.questions.map((q) => ({
        ...q,
        transition: q.transition || 'random'
      }));
    }

    return normalized;
  }

  /**
   * 同步到前端
   * 对应原 syncToFrontend() 函数
   *
   * 大白话：将上架的量表数据同步到前端页面使用的存储中
   */
  syncToFrontend() {
    const activeScales = this.scales.filter((s) => s.status === 1 || s.status === undefined);
    Adapter.storage.set(this.SYNC_KEY, JSON.stringify(activeScales));
  }

  /**
   * 渲染量表列表
   * 对应原 renderScaleTable() 函数（admin-scale-list.js 第92行）
   *
   * 大白话：根据筛选条件和排序规则，渲染量表表格
   */
  renderScaleList() {
    // 筛选量表
    this.filteredScales = this.scales.filter((s) => {
      const kw =
        !this.filterKeyword ||
        s.name.toLowerCase().includes(this.filterKeyword) ||
        (s.code || '').toLowerCase().includes(this.filterKeyword);

      const cat = !this.filterCat || s.category === this.filterCat;
      const stat = this.filterStatus === '' || String(s.status) === this.filterStatus;
      const npcOk = s.npcConfig && s.npcConfig.counselorId && s.npcConfig.backgroundId;
      const npc = !this.npcFilter || (this.npcFilter === 'yes' ? npcOk : !npcOk);

      return kw && cat && stat && npc;
    });

    // 排序
    if (this.isDragSortMode) {
      this.filteredScales.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    } else if (this.sortField) {
      this.filteredScales.sort((a, b) => {
        let va = a[this.sortField];
        let vb = b[this.sortField];

        if (this.sortField === 'updatedAt') {
          va = va ? new Date(va).getTime() : 0;
          vb = vb ? new Date(vb).getTime() : 0;
        }

        if (this.sortField === 'rating') {
          va = parseFloat(va) || 0;
          vb = parseFloat(vb) || 0;
        }

        if (va === vb) {
          return 0;
        }
        const cmp = va > vb ? 1 : -1;
        return this.sortOrder === 'desc' ? -cmp : cmp;
      });
    }

    // 渲染表格
    const tbody = document.getElementById('scale-table-body');
    if (!tbody) {
      return;
    }

    if (this.filteredScales.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无量表数据</div><div class="empty-sub">点击「新建量表」创建第一个量表</div></div></td></tr>';
      const pagination = document.getElementById('scale-pagination');
      if (pagination) {
        pagination.textContent = '';
      }
      return;
    }

    // 渲染每一行
    tbody.innerHTML = this.filteredScales
      .map((s, idx) => {
        const cat = this.getCategoryInfo(s.category);
        const statusMap = {
          1: ['已上架', 'badge-success'],
          0: ['已下架', 'badge-default'],
          2: ['草稿', 'badge-warning']
        };
        const [statusText, statusClass] = statusMap[s.status] || ['未知', 'badge-default'];

        // NPC 配置状态
        const npcOk = s.npcConfig && s.npcConfig.counselorId && s.npcConfig.backgroundId;
        const npcStatus = npcOk
          ? '<span style="color:var(--success);">✅ 已配置</span>'
          : '<span style="color:var(--danger);">❌ 未配置</span>';

        // 拖拽属性
        const dragAttrs = this.isDragSortMode
          ? 'draggable="true" data-scale-id="' +
            s.id +
            '" ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondragenter="onDragEnter(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)"'
          : '';

        return (
          '<tr ' +
          dragAttrs +
          ' style="' +
          (this.isDragSortMode ? 'cursor:grab;' : '') +
          '">' +
          '<td>' +
          '<div class="scale-cell">' +
          (this.isDragSortMode
            ? '<span class="drag-sort-handle" style="cursor:grab;margin-right:6px;font-size:14px;color:#999;user-select:none">⠿</span>'
            : '') +
          (this.isDragSortMode
            ? '<span class="drag-sort-index" style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:6px;background:#f0f0f0;font-size:11px;font-weight:600;color:#666;margin-right:6px">' +
              (idx + 1) +
              '</span>'
            : '') +
          '<div class="scale-avatar" style="background:' +
          (s.color || '#ccc') +
          '18">' +
          (s.emoji || '📋') +
          '</div>' +
          '<div style="min-width:0">' +
          '<div class="scale-cell-name">' +
          s.name +
          ' <span class="cat-tag" style="background:' +
          cat.color +
          '15;color:' +
          cat.color +
          ';font-size:10px;padding:1px 6px;border-radius:3px;margin-left:6px;">' +
          cat.name +
          '</span>' +
          '</div>' +
          '</div>' +
          '</div>' +
          '</td>' +
          '<td>' +
          (s.questionCount || 0) +
          '</td>' +
          '<td>' +
          (s.duration ? s.duration + '分钟' : '-') +
          '</td>' +
          '<td>' +
          (s.completedCount || 0).toLocaleString() +
          '</td>' +
          '<td>⭐ ' +
          parseFloat(s.rating || 0).toFixed(1) +
          '</td>' +
          '<td style="font-size:12px;color:var(--text-muted);white-space:nowrap">' +
          (s.updatedAt ? this.formatTime(s.updatedAt) : '-') +
          '</td>' +
          '<td><span class="badge ' +
          statusClass +
          '">' +
          statusText +
          '</span></td>' +
          '<td style="font-size:12px;">' +
          npcStatus +
          '</td>' +
          '<td>' +
          '<div class="dropdown-wrap" id="dw-' +
          s.id +
          '">' +
          '<button class="dropdown-trigger" onclick="toggleDropdown(event, ' +
          s.id +
          ')">⋯</button>' +
          '<div class="dropdown-menu" id="dm-' +
          s.id +
          '">' +
          '<div class="dropdown-item" onclick="openEditModal(' +
          s.id +
          ')">✏️ 编辑量表</div>' +
          (s.status === 1
            ? '<div class="dropdown-item" onclick="toggleStatus(' + s.id + ')">📥 下架</div>'
            : '<div class="dropdown-item" style="color:var(--success);font-weight:500;" onclick="toggleStatus(' +
              s.id +
              ')">📤 上架</div>') +
          '<div class="dropdown-item" onclick="exportSingleScale(' +
          s.id +
          ')">📤 导出</div>' +
          '<div class="dropdown-divider"></div>' +
          '<div class="dropdown-item danger" onclick="confirmDelete(' +
          s.id +
          ')">🗑️ 删除量表</div>' +
          '</div>' +
          '</div>' +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    const pagination = document.getElementById('scale-pagination');
    if (pagination) {
      pagination.innerHTML =
        '共 <strong>' +
        this.filteredScales.length +
        '</strong> 条记录 / 全部 <strong>' +
        this.scales.length +
        '</strong> 个量表';
    }
  }

  /**
   * 格式化时间
   * @param {string|number} time - 时间字符串或时间戳
   * @returns {string} 格式化后的时间字符串
   */
  formatTime(time) {
    if (!time) {
      return '-';
    }
    const date = new Date(time);
    if (isNaN(date.getTime())) {
      return '-';
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
      return '刚刚';
    }
    if (minutes < 60) {
      return minutes + '分钟前';
    }
    if (hours < 24) {
      return hours + '小时前';
    }
    if (days < 7) {
      return days + '天前';
    }

    return (
      date.getFullYear() +
      '-' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getDate()).padStart(2, '0')
    );
  }

  /**
   * 渲染量表类型
   * 对应原 renderScaleTypes() 函数（admin-legacy.html 第13327行）
   *
   * 大白话：渲染量表分类列表，显示每个分类有多少个量表
   */
  renderScaleTypes() {
    const grid = document.getElementById('scale-types-grid');
    if (!grid) {
      console.warn('[renderScaleTypes] 找不到 scale-types-grid 元素');
      return;
    }

    const scales = this.loadScales();

    grid.innerHTML = (window.SCALE_TYPES || [])
      .map((type) => {
        const typeScales = scales.filter((scale) => type.scaleIds.includes(scale.id));
        const activeCount = typeScales.filter((s) => s.status === 1).length;

        return `
        <div class="scale-type-card">
          <div class="scale-type-header">
            <div class="scale-type-icon" style="background: linear-gradient(135deg, ${type.color}, ${type.color}80);">
              ${type.icon}
            </div>
            <div>
              <div class="scale-type-name">${type.name}</div>
              <div class="scale-type-scales">${activeCount}/${typeScales.length}个量表</div>
            </div>
          </div>
          <p class="scale-type-description">${type.description}</p>
          <div class="function-actions">
            <button class="action-btn action-btn-primary" onclick="viewScaleType('${type.id}')">
              <span>👁️</span>
              <span>查看量表</span>
            </button>
            <button class="action-btn action-btn-secondary" onclick="manageScaleType('${type.id}')">
              <span>⚙️</span>
              <span>管理类型</span>
            </button>
          </div>
        </div>
      `;
      })
      .join('');

    // 同步量表列表表头分类下拉
    this._refreshScaleListCategoryFilter();

    console.log('[ScalePlugin] renderScaleTypes() 完成');
  }

  /**
   * 刷新量表列表表头分类筛选下拉框
   * 对应原 refreshScaleListCategoryFilter() 函数（admin-legacy.html 第13366行）
   */
  _refreshScaleListCategoryFilter() {
    const catFilterHdr = document.getElementById('cat-filter-hdr');
    if (!catFilterHdr) {
      return;
    }

    const cur = catFilterHdr.value;
    const all = (window.SCALE_TYPES || []).map(function (t) {
      return { value: t.id, label: t.name };
    });

    catFilterHdr.innerHTML =
      '<option value="">全部分类</option>' +
      all
        .map(function (o) {
          return '<option value="' + o.value + '"' + (o.value === cur ? ' selected' : '') + '>' + o.label + '</option>';
        })
        .join('');
  }

  /**
   * 打开编辑弹窗
   * 对应原 openScaleModal() 函数（admin-legacy.html 第17139行）
   *
   * 大白话：打开一个弹窗，用于编辑量表的详细信息
   * @param {number} id - 量表ID（为null时表示新建）
   */
  openEditModal(id) {
    this.currentScaleId = id || null;

    if (id) {
      // 编辑模式
      const s = this.scales.find((s) => s.id === id);
      if (!s) {
        return;
      }

      document.getElementById('modal-title').textContent = '编辑量表：' + s.name;
      document.getElementById('f-name').value = s.name || '';
      document.getElementById('f-shortname').value = s.shortName || '';
      document.getElementById('f-code').value = s.code || '';
      this._refreshCategorySelect(s.category || '');
      document.getElementById('f-emoji').value = s.emoji || '';
      document.getElementById('f-color').value = s.color || '#4A90D9';
      document.getElementById('f-duration').value = s.duration || '';
      document.getElementById('f-question-time').value = s.questionTime || 30;
      document.getElementById('f-applicable').value = s.applicablePeople || '';
      document.getElementById('f-desc').value = s.desc || '';
      document.getElementById('f-display-name').value = s.displayName || '';
      document.getElementById('f-display-summary').value = s.displaySummary || '';
      document.getElementById('f-instruction').value = s.instruction || '';

      let noticeItems = s.notice || [];
      if (noticeItems.length === 0) {
        noticeItems = ['请根据您过去一周的真实感受作答'];
      }
      document.getElementById('f-notice').value = JSON.stringify(noticeItems);
      this._renderNoticeEditor(noticeItems);

      document.getElementById('f-tags').value = (s.tags || []).join(', ');
      document.getElementById('f-status').value = String(s.status || 1);
      document.getElementById('f-sort').value = s.sortOrder || 0;

      // NPC配置
      if (s.npcConfig) {
        document.getElementById('f-npc-counselor').value = s.npcConfig.counselorId || '';
        document.getElementById('f-npc-bg').value = s.npcConfig.backgroundId || '';
        this._updateNpcSelectPreview();
      }

      this.currentQuestions = JSON.parse(JSON.stringify(s.questions || []));
      this.currentPreQuestions = JSON.parse(JSON.stringify(s.preQuestions || []));
      console.log('[openEditModal] 量表 preQuestions:', s.preQuestions?.length || 0, '道');
    } else {
      // 新建模式
      document.getElementById('modal-title').textContent = '新建量表';
      this._clearForm();
      this.currentQuestions = [{ id: 1, content: '', options: this._getPresetOptions('freq4') }];
      this.currentPreQuestions = [];
    }

    // 渲染题目编辑器（如果方法存在）
    if (typeof this._renderQEditor === 'function') {
      this._renderQEditor();
    }
    if (typeof this._renderPreQEditor === 'function') {
      this._renderPreQEditor();
    }
    this._autoCalcDuration();
    this._openModal();

    // 初始化量表编辑向导
    if (typeof initScaleWizard === 'function') {
      initScaleWizard();
    }

    console.log('[ScalePlugin] openEditModal() 完成, id:', id);
  }

  /**
   * 刷新分类下拉框
   * @param {string} selectedValue - 当前选中的值
   */
  _refreshCategorySelect(selectedValue) {
    const catSelect = document.getElementById('f-category');
    if (!catSelect) {
      return;
    }

    const all = (window.SCALE_TYPES || []).map(function (t) {
      return { value: t.id, label: t.name };
    });

    catSelect.innerHTML =
      '<option value="">请选择分类</option>' +
      all
        .map(function (o) {
          return (
            '<option value="' +
            o.value +
            '"' +
            (o.value === selectedValue ? ' selected' : '') +
            '>' +
            o.label +
            '</option>'
          );
        })
        .join('');
  }

  /**
   * 清空表单
   */
  _clearForm() {
    ['f-name', 'f-shortname', 'f-code', 'f-applicable', 'f-desc', 'f-instruction', 'f-tags'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = '';
      }
    });
    document.getElementById('f-category').value = '';
    document.getElementById('f-emoji').value = '📋';
    document.getElementById('f-color').value = '#4A90D9';
    document.getElementById('f-duration').value = '';
    document.getElementById('f-question-time').value = 30;
    document.getElementById('f-status').value = '2';
    document.getElementById('f-sort').value = '0';

    // 清除NPC配置
    if (document.getElementById('f-npc-counselor')) {
      document.getElementById('f-npc-counselor').value = '';
    }
    if (document.getElementById('f-npc-bg')) {
      document.getElementById('f-npc-bg').value = '';
    }
    if (document.getElementById('npc-counselor-preview')) {
      document.getElementById('npc-counselor-preview').innerHTML = '';
    }
    if (document.getElementById('npc-bg-preview')) {
      document.getElementById('npc-bg-preview').innerHTML = '';
    }

    // 初始化答题须知编辑器
    const defaultNoticeItems = ['请根据您过去一周的真实感受作答'];
    document.getElementById('f-notice').value = JSON.stringify(defaultNoticeItems);
    this._renderNoticeEditor(defaultNoticeItems);
  }

  /**
   * 自动计算预计时长
   */
  _autoCalcDuration() {
    const qt = parseInt(document.getElementById('f-question-time').value) || 30;
    const count = this.currentQuestions.length || 0;
    const minutes = Math.ceil((qt * count) / 60);
    document.getElementById('f-duration').value = minutes;
    const formula = document.getElementById('duration-formula');
    if (formula) {
      formula.textContent = '⌈' + qt + 's × ' + count + '题 ÷ 60⌉ = ' + minutes + ' 分钟';
    }
  }

  /**
   * 打开模态框
   */
  _openModal() {
    document.getElementById('scale-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  /**
   * 关闭模态框
   */
  _closeModal() {
    document.getElementById('scale-modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  /**
   * 渲染答题须知编辑器
   * @param {Array<string>} noticeItems - 须知项目数组
   */
  _renderNoticeEditor(noticeItems) {
    const container = document.getElementById('notice-editor');
    if (!container) {
      return;
    }

    container.innerHTML =
      noticeItems
        .map((item, idx) => {
          return `
        <div class="notice-item" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:12px;color:var(--text-muted);min-width:20px;">${idx + 1}.</span>
          <input type="text" value="${item}" style="flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;" onchange="window.ScalePlugin._updateNoticeItem(${idx}, this.value)" />
          <button type="button" style="padding:4px 8px;font-size:12px;color:#EF4444;border:1px solid #EF4444;border-radius:4px;cursor:pointer;background:transparent;" onclick="window.ScalePlugin._removeNoticeItem(${idx})">✕</button>
        </div>
      `;
        })
        .join('') +
      `
      <button type="button" style="padding:4px 12px;font-size:12px;color:#4A90D9;border:1px solid #4A90D9;border-radius:4px;cursor:pointer;background:transparent;" onclick="window.ScalePlugin._addNoticeItem()">＋ 添加须知</button>
    `;
  }

  /**
   * 更新答题须知项目
   */
  _updateNoticeItem(idx, value) {
    const noticeItems = JSON.parse(document.getElementById('f-notice').value || '[]');
    noticeItems[idx] = value;
    document.getElementById('f-notice').value = JSON.stringify(noticeItems);
    this._renderNoticeEditor(noticeItems);
  }

  /**
   * 移除答题须知项目
   */
  _removeNoticeItem(idx) {
    const noticeItems = JSON.parse(document.getElementById('f-notice').value || '[]');
    noticeItems.splice(idx, 1);
    document.getElementById('f-notice').value = JSON.stringify(noticeItems);
    this._renderNoticeEditor(noticeItems);
  }

  /**
   * 添加答题须知项目
   */
  _addNoticeItem() {
    const noticeItems = JSON.parse(document.getElementById('f-notice').value || '[]');
    noticeItems.push('');
    document.getElementById('f-notice').value = JSON.stringify(noticeItems);
    this._renderNoticeEditor(noticeItems);
  }

  /**
   * 获取预设选项
   * @param {string} presetName - 预设名称
   * @returns {Array<object>} 选项数组
   */
  _getPresetOptions(presetName) {
    const presets = {
      freq4: [
        { label: '从不', score: 1 },
        { label: '偶尔', score: 2 },
        { label: '经常', score: 3 },
        { label: '总是', score: 4 }
      ],
      yesno: [
        { label: '是', score: 1 },
        { label: '否', score: 0 }
      ]
    };

    return presets[presetName] || presets['freq4'];
  }

  /**
   * 确认删除量表
   * 对应原 confirmDelete() 函数
   *
   * 大白话：弹出确认对话框，确认后删除指定量表
   * @param {number} scaleId - 量表ID
   */
  confirmDelete(scaleId) {
    const scale = this.scales.find((s) => s.id === scaleId);
    if (!scale) {
      return;
    }

    if (!confirm(`确定要删除「${scale.name}」吗？`)) {
      return;
    }

    const idx = this.scales.findIndex((s) => s.id === scaleId);
    if (idx >= 0) {
      this.scales.splice(idx, 1);
      this.saveScales(this.scales);
      this.renderScaleList();

      Adapter.ui.toast('量表已删除', 'success');

      // 触发事件
      window.EventHub.emit('scale-deleted', {
        scaleId: scaleId,
        scaleName: scale.name,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 切换量表上架/下架状态
   * 对应原 toggleStatus() 函数
   *
   * 大白话：如果量表已上架，就下架；如果已下架，就上架
   * @param {number} scaleId - 量表ID
   */
  toggleStatus(scaleId) {
    const scale = this.scales.find((s) => s.id === scaleId);
    if (!scale) {
      return;
    }

    scale.status = scale.status === 1 ? 0 : 1;

    const idx = this.scales.findIndex((s) => s.id === scaleId);
    if (idx >= 0) {
      this.scales[idx] = scale;
    }

    this.saveScales(this.scales);
    this.renderScaleList();

    const statusText = scale.status === 1 ? '已上架' : '已下架';
    Adapter.ui.toast(`量表${statusText}`, 'success');

    // 触发事件
    window.EventHub.emit('scale-status-changed', {
      scaleId: scaleId,
      scaleName: scale.name,
      status: scale.status,
      timestamp: Date.now()
    });
  }

  /**
   * 导出单个量表
   * 对应原 exportSingleScale() 函数（admin-legacy.html 第14076行）
   *
   * 大白话：将指定量表导出为 JSON 或 CSV 格式
   * @param {number} scaleId - 量表ID
   */
  exportSingleScale(scaleId) {
    const scale = this.scales.find((s) => s.id === scaleId);

    if (!scale) {
      Adapter.ui.alert('未找到指定的量表数据');
      return;
    }

    // 询问用户选择导出格式
    const exportModal = document.createElement('div');
    exportModal.id = 'export-single-modal';
    exportModal.innerHTML = `
      <div class="modal-overlay" id="export-single-modal-overlay">
        <div class="modal" style="width: 400px;">
          <div class="modal-header">
            <span class="modal-title">导出格式选择</span>
            <button class="modal-close" onclick="document.getElementById('export-single-modal').remove()">✕</button>
          </div>
          <div class="modal-body" style="padding: 20px; text-align: center;">
            <div style="margin-bottom: 20px; color: var(--text-sec);">
              请选择要导出的格式，将导出量表："${scale.name}"
            </div>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <button class="btn btn-primary" onclick="window.ScalePlugin._exportSingleScaleFormat(${scaleId}, 'json'); document.getElementById('export-single-modal').remove();">
                <span>📄</span> JSON格式
              </button>
              <button class="btn btn-default" onclick="window.ScalePlugin._exportSingleScaleFormat(${scaleId}, 'csv'); document.getElementById('export-single-modal').remove();">
                <span>📊</span> CSV格式
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(exportModal);

    console.log('[ScalePlugin] exportSingleScale() 完成, scaleId:', scaleId);
  }

  /**
   * 以指定格式导出单个量表
   * 对应原 exportSingleScaleFormat() 函数（admin-legacy.html 第14115行）
   *
   * 大白话：实际执行导出操作，支持 JSON 和 CSV 两种格式
   * @param {number} scaleId - 量表ID
   * @param {string} format - 导出格式：'json' 或 'csv'
   */
  _exportSingleScaleFormat(scaleId, format) {
    const scale = this.scales.find((s) => s.id === scaleId);

    if (!scale) {
      Adapter.ui.alert('未找到指定的量表数据');
      return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `${scale.code || scale.name}_${dateStr}`;

    if (format === 'json') {
      // JSON格式导出单个量表
      const exportData = {
        exportTime: new Date().toISOString(),
        version: '1.0',
        scale: scale
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Adapter.ui.toast(`导出成功！量表"${scale.name}"已导出为JSON格式`, 'success');
    } else if (format === 'csv') {
      // CSV格式导出单个量表 - 26字段格式
      const statusMap = { 1: '已上架', 0: '已下架', 2: '草稿' };
      const status = statusMap[scale.status] || '未知';

      // 转义CSV中的特殊字符（逗号和引号）
      const escapeCSV = (str) => {
        if (str === null || str === undefined) {
          return '';
        }
        str = String(str);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      // 处理标签数组，转换为逗号分隔的字符串
      const tagsStr = Array.isArray(scale.tags) ? scale.tags.join(',') : scale.tags || '';

      // 获取题目数据
      const questions = scale.questions || [];
      const questionCount = questions.length;

      // 计算量表中最多选项数量，动态生成表头
      const maxOptions = questions.reduce((max, q) => Math.max(max, (q.options || []).length), 0);
      let headerBase =
        '量表名称,量表简称,量表编码,所属分类,图标emoji,主题色,预计时长(分钟),适用人群,量表描述,指导语,标签,状态,排序权重,题目数量,题号,题目内容,维度';
      for (let oi = 0; oi < maxOptions; oi++) {
        const letter = String.fromCharCode(65 + oi);
        headerBase += `,选项${letter}文本,选项${letter}分值`;
      }
      let csvContent = headerBase + '\n';

      // 为每个题目生成一行数据
      questions.forEach((question, index) => {
        // 基础信息字段（每个题目行重复）
        csvContent += `${escapeCSV(scale.name)},`; // 量表名称
        csvContent += `${escapeCSV(scale.shortName || '')},`; // 量表简称
        csvContent += `${escapeCSV(scale.code)},`; // 量表编码
        csvContent += `${escapeCSV(scale.categoryName || scale.category)},`; // 所属分类
        csvContent += `${escapeCSV(scale.emoji || '📋')},`; // 图标emoji
        csvContent += `${escapeCSV(scale.color || '#4A90D9')},`; // 主题色
        csvContent += `${scale.duration || 10},`; // 预计时长(分钟)
        csvContent += `${escapeCSV(scale.applicablePeople || '')},`; // 适用人群
        csvContent += `${escapeCSV(scale.desc || '')},`; // 量表描述
        csvContent += `${escapeCSV(scale.instruction || '')},`; // 指导语
        csvContent += `${escapeCSV(tagsStr)},`; // 标签
        csvContent += `${escapeCSV(status)},`; // 状态
        csvContent += `${scale.sortOrder || 0},`; // 排序权重
        csvContent += `${questionCount},`; // 题目数量
        csvContent += `${index + 1},`; // 题号
        csvContent += `${escapeCSV(question.text || question.content || '')},`; // 题目内容
        csvContent += `${escapeCSV(question.dimension || '')},`; // 维度（新增）

        // 选项数据（动态输出，按实际选项数量）
        const options = question.options || [];
        for (let optIdx = 0; optIdx < maxOptions; optIdx++) {
          const isLast = optIdx === maxOptions - 1;
          csvContent += `${escapeCSV(options[optIdx]?.label || '')},`; // 选项文本
          csvContent += `${options[optIdx]?.score || 0}`; // 选项分值
          if (!isLast) {
            csvContent += ',';
          }
        }
        csvContent += '\n';
      });

      // 创建CSV文件
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}_26fields.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Adapter.ui.toast(
        `导出成功！量表"${scale.name}"已导出为CSV格式（${questionCount}个题目，最多${maxOptions}个选项）`,
        'success'
      );
    }

    console.log('[ScalePlugin] _exportSingleScaleFormat() 完成, format:', format);
  }

  /**
   * 获取分类信息
   * 对应原 getCategoryInfo() 函数
   *
   * 大白话：根据分类ID获取分类的名称和颜色
   * @param {string} categoryId - 分类ID
   * @returns {object} 分类信息 {name, color}
   */
  getCategoryInfo(categoryId) {
    // 先从 SCALE_TYPES 中查找
    const type = window.SCALE_TYPES?.find((t) => t.id === categoryId);
    if (type) {
      return { name: type.name, color: type.color || '#4A90D9' };
    }

    // 再从 CAT_MAP 中查找
    const cat = window.CAT_MAP?.[categoryId];
    if (cat) {
      return { name: cat.name, color: cat.color || '#999' };
    }

    // 默认返回
    return { name: categoryId || '其他', color: '#999' };
  }

  /**
   * 从量表名称生成标签
   * 对应原 generateTagsFromScaleName() 函数（admin-legacy.html 第14040行）
   *
   * 大白话：根据量表名称自动生成一些标签，方便后续搜索和分类
   * @param {string} scaleName - 量表名称
   * @returns {Array<string>} 标签数组
   */
  generateTagsFromScaleName(scaleName) {
    const tags = [];
    const name = scaleName.toLowerCase();

    if (name.includes('抑郁')) {
      tags.push('抑郁');
    }
    if (name.includes('焦虑')) {
      tags.push('焦虑');
    }
    if (name.includes('压力')) {
      tags.push('压力');
    }
    if (name.includes('自尊')) {
      tags.push('自尊');
    }
    if (name.includes('人际')) {
      tags.push('人际');
    }
    if (name.includes('睡眠')) {
      tags.push('睡眠');
    }
    if (name.includes('职业')) {
      tags.push('职业');
    }
    if (name.includes('婚姻')) {
      tags.push('婚姻');
    }
    if (name.includes('家庭')) {
      tags.push('家庭');
    }
    if (name.includes('情绪')) {
      tags.push('情绪');
    }
    if (name.includes('性格')) {
      tags.push('性格');
    }

    return tags;
  }

  /**
   * 绑定事件
   * 大白话：绑定页面上的各种事件（点击、输入、拖拽等）
   */
  _bindEvents() {
    // 绑定搜索框输入事件
    const searchInput = document.getElementById('scale-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.filterKeyword = searchInput.value.toLowerCase();
        this.renderScaleList();
      });
    }

    // 绑定分类筛选
    const catFilter = document.getElementById('scale-cat-filter');
    if (catFilter) {
      catFilter.addEventListener('change', () => {
        this.filterCat = catFilter.value;
        this.renderScaleList();
      });
    }

    // 绑定状态筛选
    const statusFilter = document.getElementById('scale-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        this.filterStatus = statusFilter.value;
        this.renderScaleList();
      });
    }

    // 绑定拖拽排序按钮
    const dragSortBtn = document.getElementById('btn-drag-sort');
    if (dragSortBtn) {
      dragSortBtn.addEventListener('click', () => {
        this.toggleDragSortMode();
      });
    }

    // 点击页面空白处关闭下拉菜单
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown-wrap')) {
        this.closeAllDropdowns();
      }
    });

    console.log('✅ 量表管理事件已绑定');
  }

  /**
   * 切换拖拽排序模式
   * 对应原 toggleDragSortMode() 函数（admin-scale-list.js 第1行）
   */
  toggleDragSortMode() {
    this.isDragSortMode = !this.isDragSortMode;
    const btn = document.getElementById('btn-drag-sort');

    if (this.isDragSortMode) {
      btn.className = 'btn btn-primary';
      btn.innerHTML = '<span>✅</span> 完成排序';
      Adapter.ui.toast('拖拽排序模式已开启，拖动量表行调整顺序', 'success');
    } else {
      btn.className = 'btn btn-default';
      btn.innerHTML = '<span>↕️</span> 拖拽排序';
      Adapter.ui.toast('排序已保存，前端将按新顺序显示', 'success');
    }

    this.renderScaleList();
  }

  /**
   * 关闭所有下拉菜单
   * 对应原 closeAllDropdowns() 函数（admin-scale-list.js 第303行）
   */
  closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu.open').forEach((m) => {
      m.classList.remove('open');
    });
    this._openDropdownId = null;
  }

  /**
   * 销毁逻辑
   */
  async onDestroy() {
    console.log('🗑️ 量表管理插件开始销毁...');

    // 清理事件监听
    // 注意：这里需要保存事件处理函数的引用才能移除
    // 为简化，这里暂不实现

    // 清理数据
    this.scales = [];
    this.filteredScales = [];

    // 清理全局函数
    delete window.loadScales;
    delete window.saveScales;
    delete window.normalizeScaleBeforeSave;
    delete window.renderScaleList;
    delete window.renderScaleTypes;
    delete window.openEditModal;
    delete window.confirmDelete;
    delete window.toggleStatus;
    delete window.exportSingleScale;
    delete window.deleteScale;
    delete window.editScale;
    delete window.showScaleForm;
    delete window.hideScaleForm;
    delete window.exportScales;
    delete window.importScale;
    delete window.filterScales;
    delete window.sortScales;
    delete window.toggleSortOrder;

    console.log('✅ 量表管理插件销毁完成');
  }

  // ====================================================
  // 标准插件接口方法
  // ====================================================

  /**
   * 初始化插件（标准接口）
   */
  init() {
    console.log('🔧 ScalePlugin.init() 被调用');
    return this.onInit();
  }

  /**
   * 安装插件（标准接口）
   */
  install() {
    console.log('📦 ScalePlugin.install() 被调用');
    this._installed = true;
    return { success: true, message: '量表管理插件安装成功' };
  }

  /**
   * 卸载插件（标准接口）
   */
  uninstall() {
    console.log('🗑️ ScalePlugin.uninstall() 被调用');
    this._installed = false;
    return this.onDestroy();
  }

  /**
   * 获取插件信息（标准接口）
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      installed: this._installed || false
    };
  }

  /**
   * 检查插件是否已安装（标准接口）
   */
  isInstalled() {
    return this._installed || false;
  }

  // ====================================================
  // 内部方法（用于测试）
  // ====================================================

  /**
   * 保存量表数据到存储（内部方法）
   * @param {Array} scales - 量表数组
   */
  _saveScales(scales) {
    try {
      Adapter.storage.set(this.STORAGE_KEY, JSON.stringify(scales));
      console.log(`✅ 已保存 ${scales.length} 个量表到存储`);
      return true;
    } catch (e) {
      console.error('❌ 保存量表失败:', e);
      return false;
    }
  }

  /**
   * 从存储加载量表数据（内部方法）
   * @returns {Array} 量表数组
   */
  _loadScales() {
    try {
      const data = Adapter.storage.get(this.STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (e) {
      console.error('❌ 加载量表失败:', e);
      return [];
    }
  }

  // ====================================================
  // 缺失方法实现（从 admin-legacy.html 简化迁移）
  // ====================================================

  /**
   * 渲染题目编辑器（简化版）
   */
  _renderQEditor() {
    const container = document.getElementById('q-editor');
    if (!container) {
      return;
    }

    container.innerHTML =
      this.currentQuestions
        .map((q, idx) => {
          return `
        <div class="q-item" data-q-id="${q.id}" style="border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-weight:600; color:var(--primary);">第 ${idx + 1} 题</span>
            <button type="button" onclick="window.ScalePlugin._removeQuestion(${idx})" style="padding:4px 8px; font-size:12px; color:#EF4444; border:1px solid #EF4444; border-radius:4px; cursor:pointer; background:transparent;">🗑️ 删除</button>
          </div>
          <div style="margin-bottom:8px;">
            <input type="text" value="${q.content || ''}" placeholder="请输入题目内容" 
                   onchange="window.ScalePlugin._updateQuestion(${idx}, this.value)"
                   style="width:100%; padding:8px 12px; border:1px solid #e2e8f0; border-radius:6px; font-size:14px;" />
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${(q.options || [])
              .map((opt, oi) => {
                return `
                <div style="display:flex; align-items:center; gap:4px;">
                  <span style="font-size:12px; color:var(--text-muted);">${String.fromCharCode(65 + oi)}.</span>
                  <input type="text" value="${opt.label || ''}" placeholder="选项${String.fromCharCode(65 + oi)}" 
                         onchange="window.ScalePlugin._updateOption(${idx}, ${oi}, this.value)"
                         style="width:80px; padding:4px 8px; border:1px solid #e2e8f0; border-radius:4px; font-size:12px;" />
                  <input type="number" value="${opt.score || 0}" placeholder="分值" 
                         onchange="window.ScalePlugin._updateOptionScore(${idx}, ${oi}, this.value)"
                         style="width:60px; padding:4px 8px; border:1px solid #e2e8f0; border-radius:4px; font-size:12px;" />
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
      `;
        })
        .join('') +
      `
      <button type="button" onclick="window.ScalePlugin._addQuestion()" 
              style="width:100%; padding:12px; border:2px dashed #4A90D9; border-radius:8px; color:#4A90D9; background:transparent; cursor:pointer; font-size:14px;">
        ＋ 添加题目
      </button>
    `;
  }

  /**
   * 渲染前置题目编辑器（简化版）
   */
  _renderPreQEditor() {
    const container = document.getElementById('pre-q-editor');
    if (!container) {
      return;
    }

    if (!this.currentPreQuestions || this.currentPreQuestions.length === 0) {
      container.innerHTML =
        '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">暂无前置题目，前置题目用于筛查</div>';
      return;
    }

    container.innerHTML = this.currentPreQuestions
      .map((q, idx) => {
        return `
        <div class="pre-q-item" style="border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:600; font-size:13px;">前置题 ${idx + 1}</span>
            <button type="button" onclick="window.ScalePlugin._removePreQuestion(${idx})" style="padding:2px 6px; font-size:11px; color:#EF4444; border:1px solid #EF4444; border-radius:4px; cursor:pointer; background:transparent;">✕</button>
          </div>
          <input type="text" value="${q.content || ''}" placeholder="请输入前置题目内容" 
                 onchange="window.ScalePlugin._updatePreQuestion(${idx}, this.value)"
                 style="width:100%; padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px;" />
        </div>
      `;
      })
      .join('');
  }

  /**
   * 更新题目内容
   */
  _updateQuestion(idx, content) {
    if (this.currentQuestions[idx]) {
      this.currentQuestions[idx].content = content;
      this._autoCalcDuration();
    }
  }

  /**
   * 更新选项标签
   */
  _updateOption(qIdx, oIdx, label) {
    if (this.currentQuestions[qIdx] && this.currentQuestions[qIdx].options[oIdx]) {
      this.currentQuestions[qIdx].options[oIdx].label = label;
    }
  }

  /**
   * 更新选项分值
   */
  _updateOptionScore(qIdx, oIdx, score) {
    if (this.currentQuestions[qIdx] && this.currentQuestions[qIdx].options[oIdx]) {
      this.currentQuestions[qIdx].options[oIdx].score = parseInt(score) || 0;
    }
  }

  /**
   * 添加题目
   */
  _addQuestion() {
    const newId = this.currentQuestions.length > 0 ? Math.max(...this.currentQuestions.map((q) => q.id)) + 1 : 1;
    this.currentQuestions.push({
      id: newId,
      content: '',
      options: this._getPresetOptions('freq4')
    });
    this._renderQEditor();
    this._autoCalcDuration();
  }

  /**
   * 删除题目
   */
  _removeQuestion(idx) {
    this.currentQuestions.splice(idx, 1);
    this._renderQEditor();
    this._autoCalcDuration();
  }

  /**
   * 更新前置题目内容
   */
  _updatePreQuestion(idx, content) {
    if (this.currentPreQuestions[idx]) {
      this.currentPreQuestions[idx].content = content;
    }
  }

  /**
   * 删除前置题目
   */
  _removePreQuestion(idx) {
    this.currentPreQuestions.splice(idx, 1);
    this._renderPreQEditor();
  }

  /**
   * 更新NPC选择预览（空实现，避免报错）
   */
  _updateNpcSelectPreview() {
    console.log('[ScalePlugin] _updateNpcSelectPreview() 被调用（空实现）');
    // TODO: 从 admin-legacy.html 迁移完整实现
  }
}

// 导出插件类
window.ScalePlugin = ScalePlugin;

console.log('[ScalePlugin] v1.0.1 已加载（包含题目编辑器方法）');
