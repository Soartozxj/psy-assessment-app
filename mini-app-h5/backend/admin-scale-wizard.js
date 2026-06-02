/**
 * admin-scale-wizard.js
 * 量表编辑分步向导模块
 *
 * 功能：
 * 1. 将量表编辑弹窗拆分为 4 步向导
 * 2. 支持步骤导航和状态保存
 * 3. 向后兼容：保持原有函数接口
 *
 * @author CodeBuddy AI
 * @date 2026-05-20
 */

(function () {
  'use strict';

  // ====================================================
  // 向导状态管理
  // ====================================================
  var ScaleWizard = {
    currentStep: 1,
    totalSteps: 4,
    steps: [
      { id: 1, name: '基本信息', icon: '📝' },
      { id: 2, name: '题目设置', icon: '❓' },
      { id: 3, name: 'NPC配置', icon: '🎭' },
      { id: 4, name: '预览确认', icon: '✅' }
    ],

    // 初始化向导
    init: function () {
      this.renderStepNav();
      this.bindEvents();
      this.showStep(1);
    },

    // 渲染步骤导航
    renderStepNav: function () {
      const nav = document.getElementById('scale-wizard-nav');
      if (!nav) {
        return;
      }

      nav.innerHTML = this.steps
        .map(function (step) {
          const isActive = step.id === ScaleWizard.currentStep;
          const isCompleted = step.id < ScaleWizard.currentStep;
          const statusClass = isActive ? 'active' : isCompleted ? 'completed' : '';

          return (
            '<div class="wizard-step ' +
            statusClass +
            '" data-step="' +
            step.id +
            '">' +
            '<span class="wizard-step-num">' +
            (isCompleted ? '✓' : step.id) +
            '</span>' +
            '<span class="wizard-step-icon">' +
            step.icon +
            '</span>' +
            '<span class="wizard-step-name">' +
            step.name +
            '</span>' +
            '</div>'
          );
        })
        .join('');

      // 更新底部按钮文字
      this.updateFooterButtons();
    },

    // 绑定步骤点击事件（仅已完成步骤可点击）
    bindEvents: function () {
      const self = this;
      const nav = document.getElementById('scale-wizard-nav');
      if (!nav) {
        return;
      }

      nav.addEventListener('click', function (e) {
        const stepEl = e.target.closest('.wizard-step');
        if (!stepEl) {
          return;
        }

        const targetStep = parseInt(stepEl.dataset.step, 10);
        // 只能跳转到已完成或当前步骤
        if (targetStep < self.currentStep) {
          self.goToStep(targetStep);
        }
      });
    },

    // 跳转到指定步骤
    goToStep: function (stepNum) {
      if (stepNum < 1 || stepNum > this.totalSteps) {
        return;
      }

      // 保存当前步骤数据
      this.saveStepData(this.currentStep);

      this.currentStep = stepNum;
      this.showStep(stepNum);
      this.renderStepNav();

      // 滚动到顶部
      const modalBody = document.querySelector('#scale-modal .modal-body');
      if (modalBody) {
        modalBody.scrollTop = 0;
      }
    },

    // 显示指定步骤内容
    showStep: function (stepNum) {
      const steps = ['step-basic', 'step-questions', 'step-npc', 'step-preview'];
      let i;

      for (i = 0; i < steps.length; i++) {
        const el = document.getElementById(steps[i]);
        if (el) {
          el.style.display = i + 1 === stepNum ? 'block' : 'none';
        }
      }

      // 第四步预览时刷新预览数据
      if (stepNum === 4) {
        this.renderPreview();
      }
    },

    // 保存当前步骤数据（用于临时保存）
    saveStepData: function (stepNum) {
      // 基本信息步骤：触发自动计算
      if (stepNum === 1 && typeof autoCalcDuration === 'function') {
        autoCalcDuration();
      }
    },

    // 更新底部按钮
    updateFooterButtons: function () {
      const prevBtn = document.getElementById('wizard-prev-btn');
      const nextBtn = document.getElementById('wizard-next-btn');
      const saveBtn = document.getElementById('wizard-save-btn');

      if (this.currentStep === 1) {
        if (prevBtn) {
          prevBtn.style.display = 'none';
        }
      } else {
        if (prevBtn) {
          prevBtn.style.display = '';
        }
      }

      if (this.currentStep === this.totalSteps) {
        if (nextBtn) {
          nextBtn.style.display = 'none';
        }
        if (saveBtn) {
          saveBtn.style.display = '';
        }
      } else {
        if (nextBtn) {
          nextBtn.style.display = '';
        }
        if (saveBtn) {
          saveBtn.style.display = 'none';
        }
      }
    },

    // 下一步
    nextStep: function () {
      // 验证当前步骤
      if (!this.validateStep(this.currentStep)) {
        return;
      }

      if (this.currentStep < this.totalSteps) {
        this.goToStep(this.currentStep + 1);
      }
    },

    // 上一步
    prevStep: function () {
      if (this.currentStep > 1) {
        this.goToStep(this.currentStep - 1);
      }
    },

    // 验证当前步骤
    validateStep: function (stepNum) {
      switch (stepNum) {
        case 1:
          return this.validateBasicInfo();
        case 2:
          return this.validateQuestions();
        case 3:
          return true; // NPC 配置可选
        case 4:
          return true; // 预览步骤无需验证
        default:
          return true;
      }
    },

    // 验证基本信息
    validateBasicInfo: function () {
      const name = document.getElementById('f-name');
      const code = document.getElementById('f-code');
      const category = document.getElementById('f-category');

      if (!name || !name.value.trim()) {
        this.highlightField('f-name', '请填写量表名称');
        return false;
      }
      if (!code || !code.value.trim()) {
        this.highlightField('f-code', '请填写量表编码');
        return false;
      }
      if (!category || !category.value) {
        this.highlightField('f-category', '请选择所属分类');
        return false;
      }

      return true;
    },

    // 验证题目
    validateQuestions: function () {
      if (typeof currentQuestions !== 'undefined' && currentQuestions.length === 0) {
        if (typeof showToast === 'function') {
          showToast('请至少添加一道题目', 'warning');
        }
        return false;
      }
      return true;
    },

    // 高亮错误字段
    highlightField: function (fieldId, message) {
      const field = document.getElementById(fieldId);
      if (!field) {
        return;
      }

      field.style.borderColor = '#ff4d4f';
      field.focus();

      setTimeout(function () {
        field.style.borderColor = '';
      }, 3000);

      if (typeof showToast === 'function') {
        showToast(message, 'error');
      }
    },

    // 渲染预览
    renderPreview: function () {
      const preview = document.getElementById('scale-preview-content');
      if (!preview) {
        return;
      }

      // 基本信息预览
      const name = document.getElementById('f-name').value || '-';
      const shortName = document.getElementById('f-shortname').value || name;
      const code = document.getElementById('f-code').value || '-';
      const emoji = document.getElementById('f-emoji').value || '📋';
      const color = document.getElementById('f-color').value || '#4A90D9';
      const desc = document.getElementById('f-desc').value || '暂无描述';
      const category = document.getElementById('f-category');
      const categoryName = category ? category.options[category.selectedIndex].text : '-';

      // 题目统计
      const qCount = typeof currentQuestions !== 'undefined' ? currentQuestions.length : 0;
      const preqCount = typeof currentPreQuestions !== 'undefined' ? currentPreQuestions.length : 0;

      // NPC 配置预览
      const counselorEl = document.getElementById('edit-counselor-info');
      const counselorName = counselorEl ? counselorEl.querySelector('.edit-select-name').textContent : '全局默认';

      const bgEl = document.getElementById('edit-bg-info');
      const bgName = bgEl ? bgEl.querySelector('.edit-select-name').textContent : '全局默认';

      preview.innerHTML =
        '<div class="preview-section">' +
        '<h5>📋 基本信息</h5>' +
        '<div class="preview-grid">' +
        '<div class="preview-item"><span class="preview-label">量表名称</span><span class="preview-value">' +
        this.escapeHtml(name) +
        '</span></div>' +
        '<div class="preview-item"><span class="preview-label">量表简称</span><span class="preview-value">' +
        this.escapeHtml(shortName) +
        '</span></div>' +
        '<div class="preview-item"><span class="preview-label">量表编码</span><span class="preview-value">' +
        this.escapeHtml(code) +
        '</span></div>' +
        '<div class="preview-item"><span class="preview-label">所属分类</span><span class="preview-value">' +
        this.escapeHtml(categoryName) +
        '</span></div>' +
        '<div class="preview-item"><span class="preview-label">预计时长</span><span class="preview-value">' +
        (document.getElementById('f-duration').value || '0') +
        ' 分钟</span></div>' +
        '<div class="preview-item"><span class="preview-label">状态</span><span class="preview-value">' +
        this.getStatusText() +
        '</span></div>' +
        '</div>' +
        '<div class="preview-desc">' +
        '<span class="preview-label">量表描述</span>' +
        '<p>' +
        this.escapeHtml(desc) +
        '</p>' +
        '</div>' +
        '</div>' +
        '<div class="preview-section">' +
        '<h5>❓ 题目设置</h5>' +
        '<div class="preview-stats">' +
        '<div class="preview-stat"><span class="stat-num">' +
        qCount +
        '</span><span class="stat-label">测评题目</span></div>' +
        '<div class="preview-stat"><span class="stat-num">' +
        preqCount +
        '</span><span class="stat-label">测前调查</span></div>' +
        '</div>' +
        '</div>' +
        '<div class="preview-section">' +
        '<h5>🎭 NPC 配置</h5>' +
        '<div class="preview-grid">' +
        '<div class="preview-item"><span class="preview-label">咨询师</span><span class="preview-value">' +
        this.escapeHtml(counselorName) +
        '</span></div>' +
        '<div class="preview-item"><span class="preview-label">场景背景</span><span class="preview-value">' +
        this.escapeHtml(bgName) +
        '</span></div>' +
        '</div>' +
        '</div>';
    },

    // 获取状态文本
    getStatusText: function () {
      const status = document.getElementById('f-status');
      if (!status) {
        return '-';
      }
      const options = status.options;
      for (let i = 0; i < options.length; i++) {
        if (options[i].value === status.value) {
          return options[i].text;
        }
      }
      return '-';
    },

    // HTML 转义
    escapeHtml: function (str) {
      if (!str) {
        return '';
      }
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    // 重置到第一步
    reset: function () {
      this.currentStep = 1;
      this.renderStepNav();
      this.showStep(1);
    }
  };

  // ====================================================
  // 向导样式（内联）
  // ====================================================
  const wizardStyles = document.createElement('style');
  wizardStyles.textContent = `
    /* 量表编辑向导样式 */
    .scale-wizard-nav {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: linear-gradient(to bottom, #fafbfc, #f5f6f8);
      border-bottom: 1px solid var(--border);
      margin: -16px -20px 16px -20px;
    }
    
    .wizard-step {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      color: var(--text-muted);
      background: white;
      border: 1px solid var(--border);
      cursor: default;
      transition: all 0.2s ease;
      position: relative;
    }
    
    .wizard-step:not(:last-child)::after {
      content: '›';
      position: absolute;
      right: -14px;
      color: var(--text-light);
      font-size: 16px;
    }
    
    .wizard-step.active {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(74, 144, 217, 0.3);
    }
    
    .wizard-step.completed {
      background: #f6ffed;
      border-color: #52c41a;
      color: #52c41a;
      cursor: pointer;
    }
    
    .wizard-step.completed:hover {
      background: #d9f7be;
    }
    
    .wizard-step-num {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: currentColor;
      color: white;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }
    
    .wizard-step.active .wizard-step-num {
      background: rgba(255,255,255,0.3);
    }
    
    .wizard-step.completed .wizard-step-num {
      background: #52c41a;
    }
    
    .wizard-step-icon {
      font-size: 14px;
    }
    
    .wizard-step-name {
      white-space: nowrap;
    }
    
    /* 步骤内容区 */
    .wizard-step-content {
      display: none;
    }
    
    .wizard-step-content.active {
      display: block;
    }
    
    /* 预览样式 */
    .preview-section {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px dashed var(--border);
    }
    
    .preview-section:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }
    
    .preview-section h5 {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-sec);
      margin-bottom: 12px;
    }
    
    .preview-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    
    .preview-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .preview-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .preview-value {
      font-size: 13px;
      color: var(--text);
      font-weight: 500;
    }
    
    .preview-desc {
      margin-top: 12px;
    }
    
    .preview-desc p {
      font-size: 13px;
      color: var(--text-sec);
      line-height: 1.5;
      margin: 4px 0 0 0;
    }
    
    .preview-stats {
      display: flex;
      gap: 20px;
    }
    
    .preview-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 24px;
      background: linear-gradient(135deg, #f0f5ff, #e6f4ff);
      border-radius: var(--radius);
    }
    
    .stat-num {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
    }
    
    .stat-label {
      font-size: 11px;
      color: var(--text-muted);
    }
    
    /* 向导底部按钮 */
    .wizard-footer {
      display: flex;
      justify-content: space-between;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      margin-top: 16px;
    }
    
    .wizard-footer-left {
      display: flex;
      gap: 8px;
    }
  `;

  // ====================================================
  // 向导辅助函数（全局）
  // ====================================================

  // 初始化向导（由 openScaleModal 调用）
  window.initScaleWizard = function () {
    if (ScaleWizard.currentStep !== 1) {
      ScaleWizard.reset();
    }
    ScaleWizard.renderStepNav();
    ScaleWizard.showStep(1);
  };

  // 向导下一步
  window.wizardNextStep = function () {
    ScaleWizard.nextStep();
  };

  // 向导上一步
  window.wizardPrevStep = function () {
    ScaleWizard.prevStep();
  };

  // 跳转到指定步骤（对外接口）
  window.goToWizardStep = function (step) {
    ScaleWizard.goToStep(step);
  };

  // 保存并关闭（覆盖原 closeModal）
  const _originalCloseModal = window.closeModal;
  window.closeModal = function () {
    ScaleWizard.reset();
    if (typeof _originalCloseModal === 'function') {
      _originalCloseModal();
    }
  };

  // ====================================================
  // 初始化
  // ====================================================
  function init() {
    document.head.appendChild(wizardStyles);
    ScaleWizard.init();
    console.log('[ScaleWizard] 量表编辑向导初始化完成');
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 导出命名空间
  window.ScaleWizard = ScaleWizard;
})();
