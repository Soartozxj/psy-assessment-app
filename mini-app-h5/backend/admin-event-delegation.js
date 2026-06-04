/**
 * admin-event-delegation.js - 事件委托优化模块（性能优化版 v3.0.0）
 *
 * @description 提供通用的事件处理函数，减少内联 onclick，支持事件委托模式
 * @version 3.0.0 (性能优化版)
 * @date 2026-06-03
 *
 * 🚀 性能优化点：
 * 1. 单一事件监听器：只绑定一个 click 事件，而不是 50+ 个
 * 2. 处理器映射表：使用 Map 存储事件处理器，O(1) 查找
 * 3. 事件委托：利用事件冒泡，减少事件监听器数量
 * 4. 条件短路：找到匹配的处理器后立即返回，避免不必要的检查
 *
 * @example
 * // 使用 data-action 属性
 * <button data-action="remove-parent">删除</button>
 * <button data-action="switch-section" data-section="dashboard">切换</button>
 */

(function (global) {
  'use strict';

  /**
   * @namespace EventDelegate
   * @description 事件委托管理器（性能优化版）
   */
  const EventDelegate = {};

  // ====================================================
  // 🚀 性能优化：事件处理器映射表（使用 Map，O(1) 查找）
  // ====================================================

  const actionHandlers = new Map();

  // ====================================================
  // 注册事件处理器的辅助函数
  // ====================================================

  /**
   * 注册事件处理器
   * @param {string} action - data-action 值
   * @param {function} handler - 处理函数，接收 (target, event) 参数
   */
  function registerHandler(action, handler) {
    if (typeof action !== 'string' || !action) {
      console.warn('[EventDelegate] 无效的 action:', action);
      return;
    }
    if (typeof handler !== 'function') {
      console.warn('[EventDelegate] 无效的 handler for action:', action);
      return;
    }
    actionHandlers.set(action, handler);
  }

  // ====================================================
  // 批量注册所有事件处理器
  // ====================================================

  // 1. 管理员登录
  registerHandler('admin-login', function (target) {
    if (typeof adminAuth !== 'undefined' && typeof adminAuth.login === 'function') {
      adminAuth.login();
    }
  });

  // 2. 通用删除按钮 - 移除父元素
  registerHandler('remove-parent', function (target) {
    const parent = target.parentElement;
    if (parent) {
      parent.remove();
    }
  });

  // 3. 通用切换类名
  registerHandler('toggle-class', function (target) {
    const className = target.getAttribute('data-class');
    const targetSel = target.getAttribute('data-target');
    if (className && targetSel) {
      const el = document.querySelector(targetSel);
      if (el) {
        el.classList.toggle(className);
      }
    }
  });

  // 4. 面板切换（显示/隐藏 + 图标文字切换）
  registerHandler('toggle-panel', function (target) {
    const panelId = target.getAttribute('data-panel');
    const iconOpen = target.getAttribute('data-icon-open') || '▼ 展开';
    const iconClose = target.getAttribute('data-icon-close') || '▲ 收起';
    const loadFn = target.getAttribute('data-load');

    if (panelId) {
      const panel = document.getElementById(panelId);
      const iconEl =
        document.getElementById(panelId.replace('-panel', '-toggle-icon')) ||
        target.querySelector('.toggle-icon') ||
        target;

      if (panel.style.display === 'none') {
        panel.style.display = '';
        if (iconEl.textContent) {
          iconEl.textContent = iconClose;
        }
        if (loadFn && typeof window[loadFn] === 'function') {
          window[loadFn]();
        }
      } else {
        panel.style.display = 'none';
        if (iconEl.textContent) {
          iconEl.textContent = iconOpen;
        }
      }
    }
  });

  // 5. 关闭当前弹窗
  registerHandler('close-this-modal', function (target) {
    const modal = target.closest('.modal, .overlay, [role="dialog"], [class*="modal"]');
    if (modal) {
      modal.classList.remove('open');
      modal.style.display = '';
      document.body.style.overflow = '';
    }
  });

  // 6. 导航切换（切换主面板）
  registerHandler('switch-section', function (target) {
    const section = target.getAttribute('data-section');
    const afterSwitch = target.getAttribute('data-after');

    if (section && typeof switchSection === 'function') {
      switchSection(section);
    }

    if (afterSwitch) {
      const parts = afterSwitch.split(':');
      const fnName = parts[0];
      const fnArg = parts[1];
      if (fnName && typeof window[fnName] === 'function') {
        if (fnArg) {
          window[fnName](fnArg);
        } else {
          window[fnName]();
        }
      }
    }
  });

  // 7. Tab 切换（切换选项卡）
  registerHandler('switch-tab', function (target) {
    const tab = target.getAttribute('data-tab');
    if (tab && typeof switchTab === 'function') {
      switchTab(tab);
    }
  });

  // 8. NPC Tab 切换
  registerHandler('switch-npc-tab', function (target) {
    const tab = target.getAttribute('data-tab');
    const group = target.closest('[data-npc-tab-group]');

    if (group) {
      group.querySelectorAll('[data-action="switch-npc-tab"]').forEach(function (el) {
        el.classList.remove('active');
      });
    }

    target.classList.add('active');

    if (tab && typeof switchNpcTab === 'function') {
      switchNpcTab(tab);
    }
  });

  // 9. Ops Tab 切换
  registerHandler('switch-ops-tab', function (target) {
    const tab = target.getAttribute('data-tab');
    const group = target.closest('[data-ops-tab-group]');

    if (group) {
      group.querySelectorAll('[data-action="switch-ops-tab"]').forEach(function (el) {
        el.classList.remove('active');
      });
    }

    target.classList.add('active');

    if (tab && typeof switchOpsTab === 'function') {
      switchOpsTab(tab, target);
    }
  });

  // 10. 计分面板 Tab 切换
  registerHandler('switch-sc-panel', function (target) {
    const index = parseInt(target.getAttribute('data-index'), 10);
    const container = target.closest('.sc-tab-container') || target.parentElement;

    if (container) {
      container.querySelectorAll('[data-action="switch-sc-panel"]').forEach(function (el) {
        el.classList.remove('active');
        el.style.background = '#fff';
        el.style.color = 'var(--text)';
      });
    }

    target.classList.add('active');
    target.style.background = 'var(--primary)';
    target.style.color = '#fff';

    if (!isNaN(index) && typeof switchScPanel === 'function') {
      switchScPanel(target, index);
    }
  });

  // 11. 分类筛选
  registerHandler('filter-category', function (target) {
    const category = target.getAttribute('data-category');
    const group = target.closest('[data-category-group]') || target.parentElement;

    if (group) {
      group.querySelectorAll('[data-action="filter-category"]').forEach(function (el) {
        el.classList.remove('active');
      });
    }

    target.classList.add('active');

    if (category && typeof filterIconsByCategory === 'function') {
      filterIconsByCategory(category);
    }
  });

  // 12. 刷新状态
  registerHandler('refresh-status', function (target) {
    const provider = target.getAttribute('data-provider');
    const model = target.getAttribute('data-model') || null;

    if (typeof refreshAiKeyStatus === 'function') {
      refreshAiKeyStatus(provider, model);
    }
  });

  // 13. 显示 Toast 提示
  registerHandler('show-toast', function (target) {
    const message = target.getAttribute('data-message');
    const type = target.getAttribute('data-toast-type') || 'info';

    if (message && typeof showToast === 'function') {
      showToast(message, type);
    }
  });

  // 14. Ops: 刷新 AI 状态
  registerHandler('ops-check-ai', function (target) {
    if (typeof opsCheckAi === 'function') {
      opsCheckAi();
    }
  });

  // 15. Ops: 从服务端加载 AI Keys
  registerHandler('ops-load-keys', function (target) {
    if (typeof opsLoadAiKeysFromServer === 'function') {
      opsLoadAiKeysFromServer();
    }
  });

  // 16. Ops: 检查服务端 Keys 状态
  registerHandler('ops-check-server-keys', function (target) {
    if (typeof opsCheckServerKeys === 'function') {
      opsCheckServerKeys();
    }
  });

  // 17. Ops: 保存配置
  registerHandler('ops-save-config', function (target) {
    if (typeof opsSaveConfig === 'function') {
      opsSaveConfig();
    }
  });

  // 18. Ops: 健康检查
  registerHandler('ops-health-check', function (target) {
    if (typeof opsHealthCheck === 'function') {
      opsHealthCheck();
    }
  });

  // 19. Reset: AI 诊断提示词
  registerHandler('reset-ai-diag', function (target) {
    if (typeof resetAiDiagPrompt === 'function') {
      resetAiDiagPrompt();
    }
  });

  // 20. Reset: 咨询师筛选
  registerHandler('reset-counselor-filters', function (target) {
    if (typeof resetCounselorFilters === 'function') {
      resetCounselorFilters();
    }
  });

  // 21. Reset: 背景筛选
  registerHandler('reset-background-filters', function (target) {
    if (typeof resetBackgroundFilters === 'function') {
      resetBackgroundFilters();
    }
  });

  // 22. Reset: 过渡语筛选
  registerHandler('reset-transition-filters', function (target) {
    if (typeof resetTransitionFilters === 'function') {
      resetTransitionFilters();
    }
  });

  // 23. Modal: 打开新建量表弹窗
  registerHandler('open-create-modal', function (target) {
    if (typeof openCreateModal === 'function') {
      openCreateModal();
    }
  });

  // 24. Modal: 打开新增类型弹窗
  registerHandler('open-create-type-modal', function (target) {
    if (typeof openCreateTypeModal === 'function') {
      openCreateTypeModal();
    }
  });

  // 25. Modal: 打开过渡语弹窗
  registerHandler('open-transition-modal', function (target) {
    if (typeof openTransitionModal === 'function') {
      openTransitionModal();
    }
  });

  // 26. 通用操作: 下载模板
  registerHandler('download-template', function (target) {
    const templateType = target.getAttribute('data-template-type') || 'scale';
    if (typeof downloadTemplate === 'function') {
      downloadTemplate(templateType);
    }
  });

  // 27. 通用操作: 下载量表模板
  registerHandler('download-scale-template', function (target) {
    if (typeof downloadScaleTemplate === 'function') {
      downloadScaleTemplate();
    }
  });

  // 28. 通用操作: 保存配置
  registerHandler('save-config', function (target) {
    const configType = target.getAttribute('data-config-type');
    if (configType === 'ai-diag' && typeof saveAiDiagConfig === 'function') {
      saveAiDiagConfig();
    } else if (configType === 'ai' && typeof saveAiConfig === 'function') {
      saveAiConfig();
    } else if (configType === 'scoring' && typeof saveScoringConfig === 'function') {
      saveScoringConfig();
    }
  });

  // 29. 通用操作: 导出记录
  registerHandler('export-records', function (target) {
    if (typeof exportRecords === 'function') {
      exportRecords();
    }
  });

  // 30. 通用操作: 同步到前端
  registerHandler('sync-frontend', function (target) {
    if (typeof syncToFrontend === 'function') {
      syncToFrontend();
    }
  });

  // 31. 通用操作: 从云端拉取
  registerHandler('pull-cloud', function (target) {
    if (typeof pullFromCloud === 'function') {
      pullFromCloud();
    }
  });

  // 32. 通用操作: 导出所有数据
  registerHandler('export-all', function (target) {
    if (typeof exportAllData === 'function') {
      exportAllData();
    }
  });

  // 33. 通用操作: 导入数据
  registerHandler('import-data', function (target) {
    if (typeof importData === 'function') {
      importData();
    }
  });

  // 34. 通用操作: 保存编辑
  registerHandler('save-edit', function (target) {
    const editType = target.getAttribute('data-edit-type');
    if (editType === 'transition' && typeof saveTransitionEdit === 'function') {
      saveTransitionEdit();
    } else if (editType === 'npc' && typeof saveNpcEditModal === 'function') {
      saveNpcEditModal();
    } else if (editType === 'bg' && typeof saveBgEditModal === 'function') {
      saveBgEditModal();
    } else if (editType === 'type' && typeof saveType === 'function') {
      saveType();
    } else if (editType === 'scale' && typeof saveScale === 'function') {
      saveScale();
    }
  });

  // 35. 通用操作: 测试
  registerHandler('test', function (target) {
    const testType = target.getAttribute('data-test-type');
    if (testType === 'ai-diag' && typeof testAiDiag === 'function') {
      testAiDiag();
    } else if (testType === 'ai-connection' && typeof testAiConnection === 'function') {
      testAiConnection();
    }
  });

  // 36. 通用操作: 生成
  registerHandler('generate', function (target) {
    const genType = target.getAttribute('data-generate-type');
    if (genType === 'ai-diag' && typeof generateAiDiagPrompt === 'function') {
      generateAiDiagPrompt();
    }
  });

  // 37. 通用操作: 手动同步
  registerHandler('manual-sync', function (target) {
    const syncType = target.getAttribute('data-sync-type');
    if (syncType === 'npc-images' && typeof manualSyncNpcImages === 'function') {
      manualSyncNpcImages();
    }
  });

  // 38. 通用操作: 切换拖拽排序模式
  registerHandler('toggle-drag-sort', function (target) {
    if (typeof toggleDragSortMode === 'function') {
      toggleDragSortMode();
    }
  });

  // 39. 通用操作: 恢复/还原
  registerHandler('restore', function (target) {
    const restoreType = target.getAttribute('data-restore-type');
    if (restoreType === 'npc-config' && typeof restoreNpcConfigFromCloud === 'function') {
      restoreNpcConfigFromCloud();
    } else if (restoreType === 'npc-images' && typeof restoreNpcImagesFromCloud === 'function') {
      restoreNpcImagesFromCloud();
    }
  });

  // 40. 通用操作: 确认操作
  registerHandler('confirm-action', function (target) {
    const confirmType = target.getAttribute('data-confirm-type');
    if (confirmType === 'reset-data' && typeof confirmResetData === 'function') {
      confirmResetData();
    } else if (confirmType === 'counselor' && typeof confirmEditCounselor === 'function') {
      confirmEditCounselor();
    } else if (confirmType === 'bg' && typeof confirmEditBg === 'function') {
      confirmEditBg();
    } else if (confirmType === 'icon' && typeof confirmIconSelection === 'function') {
      confirmIconSelection();
    }
  });

  // 41. 通用操作: 显示弹窗
  registerHandler('show-dialog', function (target) {
    const dialogType = target.getAttribute('data-dialog-type');
    if (dialogType === 'change-password' && typeof showChangePasswordDialog === 'function') {
      showChangePasswordDialog();
    }
  });

  // 42. 通用操作: 新增步骤
  registerHandler('add-step', function (target) {
    if (typeof spAddFlowStep === 'function') {
      spAddFlowStep();
    }
  });

  // 43. 通用操作: 添加元素
  registerHandler('add-item', function (target) {
    const addType = target.getAttribute('data-add-type');
    if (addType === 'transition' && typeof addTransitionFromModal === 'function') {
      addTransitionFromModal();
    } else if (addType === 'notice' && typeof addNoticeItem === 'function') {
      addNoticeItem();
    } else if (addType === 'question' && typeof addQuestion === 'function') {
      addQuestion();
    } else if (addType === 'pre-question' && typeof addPreQuestion === 'function') {
      addPreQuestion();
    } else if (addType === 'option-item' && typeof addOptionItem === 'function') {
      addOptionItem();
    } else if (addType === 'counselor' && typeof addCounselor === 'function') {
      addCounselor();
    }
  });

  // 44. 通用操作: 删除元素
  registerHandler('delete-item', function (target) {
    const deleteType = target.getAttribute('data-delete-type');
    if (deleteType === 'transition' && typeof deleteTransitionFromEdit === 'function') {
      deleteTransitionFromEdit();
    } else if (deleteType === 'question' && typeof deleteQuestion === 'function') {
      deleteQuestion();
    } else if (deleteType === 'pre-question' && typeof deletePreQuestion === 'function') {
      deletePreQuestion();
    }
  });

  // 45. 评分配置: 添加维度/指标/分档
  registerHandler('sc-add', function (target) {
    const scType = target.getAttribute('data-sc-type');
    if (scType === 'dimension' && typeof addDimension === 'function') {
      addDimension();
    } else if (scType === 'metric' && typeof addMetric === 'function') {
      addMetric();
    } else if (scType === 'interp' && typeof addInterpRule === 'function') {
      addInterpRule();
    } else if (scType === 'dim-interp' && typeof addDimInterp === 'function') {
      addDimInterp(target);
    } else if (scType === 'screen-cond' && typeof addScreenCond === 'function') {
      addScreenCond();
    }
  });

  // ====================================================
  // 反馈系统事件委托
  // ====================================================

  // 46. 反馈：切换主 Tab
  registerHandler('fb-switch-main-tab', function (target) {
    if (typeof fbSwitchMainTab === 'function') {
      fbSwitchMainTab(target);
    }
  });

  // 47. 反馈：设置星级筛选
  registerHandler('fb-admin-set-star-filter', function (target) {
    if (typeof fbAdminSetStarFilter === 'function') {
      fbAdminSetStarFilter(target);
    }
  });

  // 48. 反馈：切换标签场景
  registerHandler('fb-tag-switch-scene', function (target) {
    if (typeof fbTagSwitchScene === 'function') {
      fbTagSwitchScene(target);
    }
  });

  // 49. 反馈：切换标签类型
  registerHandler('fb-tag-switch-type', function (target) {
    if (typeof fbTagSwitchType === 'function') {
      fbTagSwitchType(target);
    }
  });

  // 50. 反馈：添加标签
  registerHandler('fb-tag-add-tags', function (target) {
    if (typeof fbTagAddTags === 'function') {
      fbTagAddTags();
    }
  });

  // 51. 反馈：查看详情（动态生成按钮）
  registerHandler('fb-admin-show-detail', function (target) {
    const id = target.getAttribute('data-id');
    if (id && typeof fbAdminShowDetail === 'function') {
      fbAdminShowDetail(id);
    }
  });

  // 52. 反馈：删除（动态生成按钮）
  registerHandler('fb-admin-delete', function (target) {
    const id = target.getAttribute('data-id');
    if (id && typeof fbAdminDelete === 'function') {
      fbAdminDelete(id);
      // 关闭详情弹窗
      const overlay = document.getElementById('fb-detail-overlay');
      if (overlay) {
        overlay.remove();
      }
    }
  });

  // 53. 反馈：分页跳转（动态生成按钮）
  registerHandler('fb-admin-go-page', function (target) {
    const page = parseInt(target.getAttribute('data-page'), 10);
    if (!isNaN(page) && typeof fbAdminGoPage === 'function') {
      fbAdminGoPage(page);
    }
  });

  // 54. 反馈：删除标签（动态生成按钮）
  registerHandler('fb-tag-delete', function (target) {
    const id = target.getAttribute('data-id');
    if (id && typeof fbTagDelete === 'function') {
      fbTagDelete(id);
    }
  });

  // ====================================================
  // 提示词管理事件委托
  // ====================================================

  // 55. 提示词：关闭版本编辑弹窗
  registerHandler('sp-close-ver-edit', function (target) {
    if (typeof spCloseVerEdit === 'function') {
      spCloseVerEdit();
    }
  });

  // 56. 提示词：保存版本
  registerHandler('sp-save-ver-edit', function (target) {
    if (typeof spSaveVerEdit === 'function') {
      spSaveVerEdit();
    }
  });

  // 57. 提示词：关闭新建弹窗
  registerHandler('sp-close-new-prompt', function (target) {
    if (typeof spCloseNewPrompt === 'function') {
      spCloseNewPrompt();
    }
  });

  // 58. 提示词：创建新提示词
  registerHandler('sp-create-new-prompt', function (target) {
    if (typeof spCreateNewPrompt === 'function') {
      spCreateNewPrompt();
    }
  });

  // 59. 提示词：填充模板
  registerHandler('sp-fill-template', function (target) {
    const tpl = target.getAttribute('data-tpl');
    if (tpl && typeof spFillTemplate === 'function') {
      spFillTemplate(tpl);
    }
  });

  // ====================================================
  // 向导与预设事件委托
  // ====================================================

  // 60. 应用预设
  registerHandler('apply-preset', function (target) {
    const preset = target.getAttribute('data-preset');
    if (preset && typeof applyPreset === 'function') {
      applyPreset(preset);
    }
  });

  // 61. 自动分配过渡语
  registerHandler('auto-assign-transitions', function (target) {
    if (typeof autoAssignTransitionsByPhase === 'function') {
      autoAssignTransitionsByPhase();
    }
  });

  // 62. 打开编辑咨询师选择器
  registerHandler('open-edit-counselor-picker', function (target) {
    if (typeof openEditCounselorPicker === 'function') {
      openEditCounselorPicker();
    }
  });

  // 63. 打开编辑背景选择器
  registerHandler('open-edit-bg-picker', function (target) {
    if (typeof openEditBgPicker === 'function') {
      openEditBgPicker();
    }
  });

  // 64. 向导：上一步
  registerHandler('wizard-prev-step', function (target) {
    if (typeof wizardPrevStep === 'function') {
      wizardPrevStep();
    }
  });

  // 65. 向导：下一步
  registerHandler('wizard-next-step', function (target) {
    if (typeof wizardNextStep === 'function') {
      wizardNextStep();
    }
  });

  // ====================================================
  // 计分规则事件委托
  // ====================================================

  // 66. 关闭计分规则弹窗
  registerHandler('close-scoring-modal', function (target) {
    if (typeof closeScoringModal === 'function') {
      closeScoringModal();
    }
  });

  // 67. 切换计分面板 Tab
  registerHandler('sc-switch-panel', function (target) {
    const index = parseInt(target.getAttribute('data-index'), 10);
    if (!isNaN(index) && typeof switchScPanel === 'function') {
      switchScPanel(target, index);
    }
  });

  // 68. 添加维度
  registerHandler('sc-add-dimension', function (target) {
    if (typeof addDimension === 'function') {
      addDimension();
    }
  });

  // 69. 添加指标
  registerHandler('sc-add-metric', function (target) {
    if (typeof addMetric === 'function') {
      addMetric();
    }
  });

  // 70. 自动推导分值范围
  registerHandler('sc-auto-fill-ranges', function (target) {
    if (typeof autoFillScoreRanges === 'function') {
      autoFillScoreRanges();
    }
  });

  // 71. 添加分档规则
  registerHandler('sc-add-interp-rule', function (target) {
    if (typeof addInterpRule === 'function') {
      addInterpRule();
    }
  });

  // 72. 添加筛查条件
  registerHandler('sc-add-screen-cond', function (target) {
    if (typeof addScreenCond === 'function') {
      addScreenCond();
    }
  });

  // 73. 删除测前调查题目
  registerHandler('delete-pre-question', function (target) {
    const qi = parseInt(target.getAttribute('data-qi'), 10);
    if (!isNaN(qi) && typeof deletePreQuestion === 'function') {
      deletePreQuestion(qi);
    }
  });

  // 74. 添加测前调查选项
  registerHandler('add-pre-q-opt', function (target) {
    const qi = parseInt(target.getAttribute('data-qi'), 10);
    if (!isNaN(qi) && typeof addPreQOpt === 'function') {
      addPreQOpt(qi);
    }
  });

  // 75. 添加维度解释
  registerHandler('sc-add-dim-interp', function (target) {
    if (typeof addDimInterp === 'function') {
      addDimInterp(target);
    }
  });

  // 76. 折叠/展开维度卡片
  registerHandler('sc-toggle-dim', function (target) {
    const nextEl = target.nextElementSibling;
    if (nextEl) {
      nextEl.style.display = nextEl.style.display === 'none' ? 'block' : 'none';
    }
  });

  // 77. 删除维度卡片
  registerHandler('sc-remove-dim', function (target) {
    const card = target.closest('.sc-dim-card');
    if (card) {
      card.remove();
    }
  });

  // ====================================================
  // 提示词高级功能事件委托
  // ====================================================

  // 78. 复制提示词内容
  registerHandler('sp-copy-content', function (target) {
    if (typeof spCopyContent === 'function') {
      spCopyContent();
    }
  });

  // 79. 添加版本
  registerHandler('sp-add-version', function (target) {
    if (typeof spAddVersion === 'function') {
      spAddVersion();
    }
  });

  // 80. 保存流程完成
  registerHandler('sp-save-flow-done', function (target) {
    if (typeof showToast === 'function') {
      showToast('✓ 使用流程已保存', 'success');
    }
  });

  // ====================================================
  // 计分相关事件委托
  // ====================================================

  // 81. 选择量表（计分）
  registerHandler('select-scoring-scale', function (target) {
    const scaleId = target.getAttribute('data-scale-id');
    if (scaleId && typeof selectScoringScale === 'function') {
      selectScoringScale(scaleId);
    }
  });

  // 82. 运行计分测试
  registerHandler('sc-run-test', function (target) {
    if (typeof runScoringTest === 'function') {
      runScoringTest();
    }
  });

  // ====================================================
  // NPC/背景管理事件委托
  // ====================================================

  // 83. 保存 NPC 编辑
  registerHandler('save-npc-edit', function (target) {
    if (typeof saveNpcEditModal === 'function') {
      saveNpcEditModal();
    }
  });

  // 84. 打开图标选择器
  registerHandler('open-icon-picker', function (target) {
    if (typeof openIconPicker === 'function') {
      openIconPicker();
    }
  });

  // ====================================================
  // 通用操作事件委托
  // ====================================================

  // 85. 从云端拉取
  registerHandler('pull-from-cloud', function (target) {
    if (typeof pullFromCloud === 'function') {
      pullFromCloud();
    }
  });

  // 86. 渲染选项列表
  registerHandler('render-option-list', function (target) {
    if (typeof renderOptionList === 'function') {
      renderOptionList();
    }
  });

  // 87. 切换下拉菜单
  registerHandler('toggle-dropdown', function (target, e) {
    const dropdownId = target.getAttribute('data-dropdown-id');
    if (dropdownId && typeof toggleDropdown === 'function') {
      toggleDropdown(e, dropdownId);
    }
  });

  // 88. 切换状态
  registerHandler('toggle-status', function (target) {
    const id = target.getAttribute('data-id');
    if (id && typeof toggleStatus === 'function') {
      toggleStatus(id);
    }
  });

  // ====================================================
  // Ops 事件委托
  // ====================================================

  // 89. 测试 AI Key 配置
  registerHandler('ops-test-ai-key', function (target) {
    if (typeof opsTestAiKeyConfig === 'function') {
      opsTestAiKeyConfig();
    }
  });

  // 90. 保存 API Base
  registerHandler('ops-save-api-base', function (target) {
    if (typeof opsSaveApiBase === 'function') {
      opsSaveApiBase();
    }
  });

  // 91. 保存 AI Keys
  registerHandler('ops-save-ai-keys', function (target) {
    if (typeof opsSaveAiKeys === 'function') {
      opsSaveAiKeys();
    }
  });

  // ====================================================
  // 量表管理事件委托
  // ====================================================

  // 92. 查看量表类型
  registerHandler('view-scale-type', function (target) {
    const typeId = target.getAttribute('data-type-id');
    if (typeId && typeof viewScaleType === 'function') {
      viewScaleType(typeId);
    }
  });

  // 93. 管理量表类型
  registerHandler('manage-scale-type', function (target) {
    const typeId = target.getAttribute('data-type-id');
    if (typeId && typeof manageScaleType === 'function') {
      manageScaleType(typeId);
    }
  });

  // 94. 打开编辑弹窗
  registerHandler('open-edit-modal', function (target) {
    const scaleId = target.getAttribute('data-scale-id');
    if (scaleId && typeof openEditModal === 'function') {
      openEditModal(scaleId);
    }
  });

  // 95. 切换 Tab
  registerHandler('switch-tab', function (target) {
    const tabId = target.getAttribute('data-tab-id');
    if (tabId && typeof switchTab === 'function') {
      switchTab(tabId);
    }
  });

  // 96. 筛选图标
  registerHandler('filter-icons', function (target) {
    const category = target.getAttribute('data-category');
    if (category && typeof filterIconsByCategory === 'function') {
      filterIconsByCategory(category);
    }
  });

  // ====================================================
  // 反馈管理事件委托 (Feedback)
  // ====================================================

  // 97. FB: 关闭详情弹窗（点击背景）
  registerHandler('fb-close-overlay', function (target, e) {
    if (e.target === target) {
      target.remove();
    }
  });

  // 98. FB: 移除详情弹窗
  registerHandler('fb-remove-overlay', function (target) {
    const overlay = document.getElementById('fb-detail-overlay');
    if (overlay) {
      overlay.remove();
    }
  });

  // ====================================================
  // AI 配置事件委托 (AI Config)
  // ====================================================

  // 99. AIC: 选择提供商
  registerHandler('aic-select-provider', function (target) {
    const provider = target.getAttribute('data-provider');
    if (provider && window.AIConfig && typeof AIConfig.selectProvider === 'function') {
      AIConfig.selectProvider(provider);
    }
  });

  // 100. AIC: 切换密钥可见性
  registerHandler('aic-toggle-visibility', function (target) {
    if (window.AIConfig && typeof AIConfig.toggleKeyVisibility === 'function') {
      AIConfig.toggleKeyVisibility();
    }
  });

  // 101. AIC: 从服务端加载
  registerHandler('aic-load-server', function (target) {
    if (window.AIConfig && typeof AIConfig.loadFromServer === 'function') {
      AIConfig.loadFromServer();
    }
  });

  // 102. AIC: 检查双端状态
  registerHandler('aic-check-status', function (target) {
    if (window.AIConfig && typeof AIConfig.checkServerStatus === 'function') {
      AIConfig.checkServerStatus();
    }
  });

  // 103. AIC: 保存到服务端
  registerHandler('aic-save-server', function (target) {
    if (window.AIConfig && typeof AIConfig.saveToServer === 'function') {
      AIConfig.saveToServer();
    }
  });

  // ====================================================
  // 量表管理事件委托 (Scale Management)
  // ====================================================

  // 104. SM: 新增量表
  registerHandler('scale-create', function (target) {
    if (typeof showScaleForm === 'function') {
      showScaleForm(null);
    } else if (typeof openEditModal === 'function') {
      openEditModal(null);
    } else {
      location.href = 'admin-scale.html?action=create';
    }
  });

  // 105. SM: 编辑量表
  registerHandler('scale-edit', function (target) {
    const scaleId = target.getAttribute('data-id');
    if (typeof showScaleForm === 'function') {
      showScaleForm(scaleId);
    } else if (typeof openEditModal === 'function') {
      openEditModal(scaleId);
    } else {
      location.href = 'admin-scale.html?action=edit&id=' + scaleId;
    }
  });

  // 106. SM: 删除量表
  registerHandler('scale-delete', function (target) {
    const scaleId = target.getAttribute('data-id');
    if (typeof confirmDelete === 'function') {
      confirmDelete(scaleId);
    } else if (typeof deleteScale === 'function') {
      deleteScale(scaleId);
    } else {
      if (confirm('确定要删除这个量表吗？')) {
        const scales = JSON.parse(localStorage.getItem('psy_scales') || '[]');
        const filtered = scales.filter((s) => s.id != scaleId);
        localStorage.setItem('psy_scales', JSON.stringify(filtered));
        if (typeof renderScaleList === 'function') {
          renderScaleList();
        }
      }
    }
  });

  // 107. SM: 切换量表状态（上架/下架）
  registerHandler('scale-toggle', function (target) {
    const scaleId = target.getAttribute('data-id');
    if (typeof toggleStatus === 'function') {
      toggleStatus(scaleId);
    } else {
      const scales = JSON.parse(localStorage.getItem('psy_scales') || '[]');
      const scale = scales.find((s) => s.id == scaleId);
      if (scale) {
        scale.status = scale.status === 1 ? 0 : 1;
        localStorage.setItem('psy_scales', JSON.stringify(scales));
        if (typeof renderScaleList === 'function') {
          renderScaleList();
        }
      }
    }
  });

  // 108. SM: 导出量表
  registerHandler('export-scales', function (target) {
    if (typeof exportScales === 'function') {
      exportScales();
    }
  });

  // 109. SM: 导入量表
  registerHandler('import-scale', function (target) {
    if (typeof importScale === 'function') {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.onchange = function (e) {
        importScale(e.target.files[0]);
      };
      fileInput.click();
    }
  });

  // ====================================================
  // 提示词查看器事件委托 (Prompt View)
  // ====================================================

  // 110. PV: 复制正文
  registerHandler('pv-copy-content', function (target) {
    if (typeof copyContent === 'function') {
      copyContent();
    }
  });

  // 111. PV: 重命名
  registerHandler('pv-rename', function (target) {
    if (typeof renamePrompt === 'function') {
      renamePrompt();
    }
  });

  // 112. PV: 删除
  registerHandler('pv-delete', function (target) {
    if (typeof deletePrompt === 'function') {
      deletePrompt();
    }
  });

  // 113. PV: 关闭编辑
  registerHandler('pv-close-edit', function (target) {
    if (typeof window.closeEdit === 'function') {
      window.closeEdit();
    }
  });

  // 114. PV: 保存编辑
  registerHandler('pv-save-edit', function (target) {
    if (typeof window.saveEdit === 'function') {
      window.saveEdit();
    }
  });

  // 115. PV: 切换版本
  registerHandler('pv-switch-version', function (target) {
    const index = parseInt(target.getAttribute('data-index'), 10);
    if (!isNaN(index) && typeof window.switchVersion === 'function') {
      window.switchVersion(index);
    }
  });

  // 116. PV: 打开版本编辑
  registerHandler('pv-open-edit', function (target) {
    e.stopPropagation();
    const index = parseInt(target.getAttribute('data-index'), 10);
    if (!isNaN(index) && typeof window.openEdit === 'function') {
      window.openEdit(index);
    }
  });

  // 117. PV: 删除版本
  registerHandler('pv-del-version', function (target) {
    e.stopPropagation();
    const index = parseInt(target.getAttribute('data-index'), 10);
    if (!isNaN(index) && typeof window.delVersion === 'function') {
      window.delVersion(index);
    }
  });

  // 118. PV: 新增版本
  registerHandler('pv-add-version', function (target) {
    if (typeof window.addVersion === 'function') {
      try {
        window.addVersion();
      } catch (err) {
        console.error('[EventDelegate] Error calling window.addVersion():', err);
      }
    }
  });

  // ====================================================
  // AI 计分测试事件委托 (AI Scoring Test)
  // ====================================================

  // 119. AST: 上传文件
  registerHandler('ast-upload-file', function (target) {
    const input = document.getElementById('file-upload');
    if (input) {
      input.click();
    }
  });

  // 120. AST: 开始提取
  registerHandler('ast-start-extract', function (target) {
    if (typeof startExtract === 'function') {
      startExtract();
    }
  });

  // 121. AST: 开始解析
  registerHandler('ast-start-parse', function (target) {
    if (typeof startParse === 'function') {
      startParse();
    }
  });

  // 122. AST: 清空
  registerHandler('ast-clear-all', function (target) {
    if (typeof clearAll === 'function') {
      clearAll();
    }
  });

  // 123. AST: 加载示例
  registerHandler('ast-load-example', function (target) {
    const example = target.getAttribute('data-example');
    if (example && typeof loadExample === 'function') {
      loadExample(example);
    }
  });

  // 124. AST: 切换 Prompt 面板
  registerHandler('ast-toggle-prompt-panel', function (target) {
    if (typeof togglePromptPanel === 'function') {
      togglePromptPanel();
    }
  });

  // 125. AST: 复制 Prompt
  registerHandler('ast-copy-prompt', function (target) {
    e.stopPropagation();
    if (typeof copyPromptText === 'function') {
      copyPromptText();
    }
  });

  // 126. AST: 切换编辑模式
  registerHandler('ast-toggle-edit', function (target) {
    e.stopPropagation();
    if (typeof togglePromptEdit === 'function') {
      togglePromptEdit();
    }
  });

  // 127. AST: 保存编辑
  registerHandler('ast-save-edit', function (target) {
    e.stopPropagation();
    if (typeof savePromptEdit === 'function') {
      savePromptEdit();
    }
  });

  // 128. AST: 取消编辑
  registerHandler('ast-cancel-edit', function (target) {
    e.stopPropagation();
    if (typeof cancelPromptEdit === 'function') {
      cancelPromptEdit();
    }
  });

  // 129. AST: 恢复默认
  registerHandler('ast-reset-prompt', function (target) {
    e.stopPropagation();
    if (typeof resetPromptToDefault === 'function') {
      resetPromptToDefault();
    }
  });

  // 130. AST: 切换调试信息
  registerHandler('ast-toggle-debug', function (target) {
    if (typeof toggleDebug === 'function') {
      toggleDebug();
    }
  });

  // 131. AST: 复制原始 JSON
  registerHandler('ast-copy-json', function (target) {
    if (typeof copyJson === 'function') {
      copyJson();
    }
  });

  // 132. AST: 标准化 + 验证
  registerHandler('ast-normalize-verify', function (target) {
    if (typeof normalizeAndVerify === 'function') {
      normalizeAndVerify();
    }
  });

  // 133. AST: 复制标准化 JSON
  registerHandler('ast-copy-normalized', function (target) {
    if (typeof copyNormalizedJson === 'function') {
      copyNormalizedJson();
    }
  });

  // ====================================================
  // 测试中心事件委托 (Test Center)
  // ====================================================

  // 134. TC: 登录
  registerHandler('tc-login', function (target) {
    if (typeof login === 'function') {
      login();
    }
  });

  // 135. TC: 批量测试报告
  registerHandler('tc-show-batch-report', function (target) {
    if (typeof showBatchReport === 'function') {
      showBatchReport();
    }
  });

  // 136. TC: 导出用例
  registerHandler('tc-export-suite', function (target) {
    if (typeof exportSuite === 'function') {
      exportSuite();
    }
  });

  // 137. TC: 导入文件（触发隐藏的 file input）
  registerHandler('tc-import-file', function (target) {
    const input = document.getElementById('importFile');
    if (input) {
      input.click();
    }
  });

  // 138. TC: 跳转计分配置页
  registerHandler('tc-go-config', function (target) {
    location.href = 'admin-legacy.html';
  });

  // 139. TC: 上一步
  registerHandler('tc-prev-step', function (target) {
    if (typeof goToPrevStep === 'function') {
      goToPrevStep();
    }
  });

  // 140. TC: 下一步
  registerHandler('tc-next-step', function (target) {
    if (typeof goToNextStep === 'function') {
      goToNextStep();
    }
  });

  // 141. TC: 显示保存用例弹窗
  registerHandler('tc-show-save-case', function (target) {
    if (typeof showSaveCaseDialog === 'function') {
      showSaveCaseDialog();
    }
  });

  // 142. TC: 切换 Tab
  registerHandler('tc-switch-tab', function (target) {
    const tabId = target.getAttribute('data-tab-id');
    if (tabId && typeof switchTab === 'function') {
      switchTab(tabId);
    }
  });

  // 143. TC: 运行测试
  registerHandler('tc-run-test', function (target) {
    if (typeof runTest === 'function') {
      runTest();
    }
  });

  // 144. TC: 清空答案
  registerHandler('tc-clear-answers', function (target) {
    if (typeof clearAnswers === 'function') {
      clearAnswers();
    }
  });

  // 145. TC: 保存为用例
  registerHandler('tc-save-as-case', function (target) {
    if (typeof saveCurrentAsCase === 'function') {
      saveCurrentAsCase();
    }
  });

  // 146. TC: AI 预览
  registerHandler('tc-ai-preview', function (target) {
    if (typeof runAiPreview === 'function') {
      runAiPreview();
    }
  });

  // 147. TC: 复制 Prompt
  registerHandler('tc-copy-prompt', function (target) {
    if (typeof copyPrompt === 'function') {
      copyPrompt();
    }
  });

  // 148. TC: 保存 Prompt 到量表
  registerHandler('tc-save-prompt', function (target) {
    if (typeof savePromptToScale === 'function') {
      savePromptToScale();
    }
  });

  // 149. TC: 复制 AI 报告
  registerHandler('tc-copy-ai-report', function (target) {
    if (typeof copyAiReport === 'function') {
      copyAiReport();
    }
  });

  // 150. TC: 关闭批量测试弹窗
  registerHandler('tc-close-batch-modal', function (target) {
    const modal = document.getElementById('batchModal');
    if (modal) {
      modal.style.display = 'none';
    }
  });

  // 151. TC: 取消保存用例
  registerHandler('tc-cancel-save-case', function (target) {
    const modal = document.getElementById('saveCaseModal');
    if (modal) {
      modal.style.display = 'none';
    }
  });

  // 152. TC: 确认保存用例
  registerHandler('tc-confirm-save-case', function (target) {
    if (typeof confirmSaveCase === 'function') {
      confirmSaveCase();
    }
  });

  // 153. TC: 应用预设（动态生成按钮）
  registerHandler('tc-apply-preset', function (target) {
    const preset = target.getAttribute('data-preset');
    if (preset && typeof applyPreset === 'function') {
      applyPreset(preset);
    }
  });

  // 154. TC: 加载用例（动态生成）
  registerHandler('tc-load-case', function (target) {
    const caseId = target.getAttribute('data-case-id');
    if (caseId && typeof loadCase === 'function') {
      loadCase(caseId);
    }
  });

  // ====================================================
  // 选项管理事件委托
  // ====================================================

  // 155. 打开选项管理器
  registerHandler('open-option-manager', function (target) {
    const type = target.getAttribute('data-option-type');
    if (type && typeof openOptionManager === 'function') {
      openOptionManager(type);
    }
  });

  // ====================================================
  // 向导事件委托 (Wizard / Scale Onboard)
  // ====================================================

  // 156. 向导：关闭窗口
  registerHandler('wizard-close', function (target) {
    window.close();
  });

  // 157. 向导：清空量表文本
  registerHandler('wizard-clear-text', function (target) {
    const el = document.getElementById('ai-gen-text');
    if (el) {
      el.value = '';
    }
    if (typeof updateStep1TextStats === 'function') {
      updateStep1TextStats();
    }
  });

  // 158. 向导：复制文本
  registerHandler('wizard-copy', function (target) {
    const id = target.getAttribute('data-target');
    if (id && typeof copyText === 'function') {
      copyText(id);
    }
  });

  // 159. 向导：AI 生成量表
  registerHandler('wizard-ai-generate', function (target) {
    if (typeof generateScaleByAi === 'function') {
      generateScaleByAi();
    }
  });

  // 160. 向导：显示 JSON 输入
  registerHandler('wizard-show-json', function (target) {
    if (typeof showJsonInput === 'function') {
      showJsonInput();
    }
  });

  // 161. 向导：解析 JSON
  registerHandler('wizard-parse-json', function (target) {
    if (typeof parseJsonInput === 'function') {
      parseJsonInput();
    }
  });

  // 162. 向导：格式化 JSON
  registerHandler('wizard-format-json', function (target) {
    if (typeof formatJsonInput === 'function') {
      formatJsonInput();
    }
  });

  // 163. 向导：下载模板下拉
  registerHandler('wizard-template-dropdown', function (target, e) {
    if (typeof toggleDownloadDropdown === 'function') {
      toggleDownloadDropdown(e);
    }
  });

  // 164. 向导：下载模板项
  registerHandler('wizard-download-template', function (target) {
    const type = target.getAttribute('data-template');
    if (type && typeof downloadTemplate === 'function') {
      downloadTemplate(type);
      if (typeof toggleDownloadDropdown === 'function') {
        toggleDownloadDropdown();
      }
    }
  });

  // 165. 向导：清空 JSON
  registerHandler('wizard-clear-json', function (target) {
    if (typeof clearJsonInput === 'function') {
      clearJsonInput();
    }
  });

  // 166. 向导：切换折叠
  registerHandler('wizard-toggle-collapsible', function (target) {
    const id = target.getAttribute('data-id');
    if (id && typeof toggleCollapsible === 'function') {
      toggleCollapsible(id);
    }
  });

  // 167. 向导：生成计分说明
  registerHandler('wizard-gen-sc-desc', function (target) {
    if (typeof generateScoringDesc === 'function') {
      generateScoringDesc();
    }
  });

  // 168. 向导：重新生成计分说明
  registerHandler('wizard-regen-sc-desc', function (target) {
    if (typeof regenerateScoringDesc === 'function') {
      regenerateScoringDesc();
    }
  });

  // 169. 向导：清空计分说明
  registerHandler('wizard-clear-sc-desc', function (target) {
    if (typeof clearScoringDesc === 'function') {
      clearScoringDesc();
    }
  });

  // 170. 向导：生成计分规则
  registerHandler('wizard-gen-scoring', function (target) {
    if (typeof generateScoring === 'function') {
      generateScoring();
    }
  });

  // 171. 向导：预览计分提示词
  registerHandler('wizard-preview-sc-prompt', function (target) {
    if (typeof previewScoringPrompt === 'function') {
      previewScoringPrompt();
    }
  });

  // 172. 向导：关闭计分提示词预览
  registerHandler('wizard-close-sc-preview', function (target) {
    const el = document.getElementById('scoring-prompt-preview');
    if (el) {
      el.style.display = 'none';
    }
  });

  // 173. 向导：切换计分 Tab
  registerHandler('wizard-switch-sc-tab', function (target) {
    const tab = target.getAttribute('data-tab');
    if (tab && typeof switchScoringTab === 'function') {
      switchScoringTab(target, tab);
    }
  });

  // 174. 向导：导入计分 JSON
  registerHandler('wizard-import-scoring', function (target) {
    if (typeof importScoringJson === 'function') {
      importScoringJson();
    }
  });

  // 175. 向导：清空计分规则
  registerHandler('wizard-clear-scoring', function (target) {
    if (typeof clearScoring === 'function') {
      clearScoring();
    }
  });

  // 176. 向导：添加维度
  registerHandler('wizard-add-dim', function (target) {
    if (typeof onboardAddDimension === 'function') {
      onboardAddDimension();
    }
  });

  // 177. 向导：添加指标
  registerHandler('wizard-add-metric', function (target) {
    if (typeof onboardAddMetric === 'function') {
      onboardAddMetric();
    }
  });

  // 178. 向导：自动推导范围
  registerHandler('wizard-auto-fill-ranges', function (target) {
    if (typeof onboardAutoFillScoreRanges === 'function') {
      onboardAutoFillScoreRanges();
    }
  });

  // 179. 向导：添加分档规则
  registerHandler('wizard-add-interp', function (target) {
    if (typeof onboardAddInterpRule === 'function') {
      onboardAddInterpRule();
    }
  });

  // 180. 向导：运行模拟测试
  registerHandler('wizard-run-test', function (target) {
    if (typeof onboardRunScoringTest === 'function') {
      onboardRunScoringTest();
    }
  });

  // 181. 向导：保存计分规则
  registerHandler('wizard-save-scoring', function (target) {
    if (typeof saveOnboardScoring === 'function') {
      saveOnboardScoring();
    }
  });

  // 182. 向导：重置计分规则
  registerHandler('wizard-reset-scoring', function (target) {
    if (typeof resetOnboardScoring === 'function') {
      resetOnboardScoring();
    }
  });

  // 183. 向导：应用提示词版本
  registerHandler('wizard-apply-prompt', function (target) {
    if (typeof applySelectedPromptVersion === 'function') {
      applySelectedPromptVersion();
    }
  });

  // 184. 向导：生成提示词
  registerHandler('wizard-gen-prompt', function (target) {
    if (typeof generatePrompt === 'function') {
      generatePrompt();
    }
  });

  // 185. 向导：重置提示词
  registerHandler('wizard-reset-prompt', function (target) {
    if (typeof resetPrompt === 'function') {
      resetPrompt();
    }
  });

  // 186. 向导：切换 Meta Prompt 面板
  registerHandler('wizard-toggle-meta', function (target) {
    if (typeof toggleMetaPromptPanel === 'function') {
      toggleMetaPromptPanel();
    }
  });

  // 187. 向导：AI 优化发布字段
  registerHandler('wizard-ai-optimize', function (target) {
    if (typeof aiOptimizePublishFields === 'function') {
      aiOptimizePublishFields();
    }
  });

  // 188. 向导：应用 AI 建议
  registerHandler('wizard-apply-ai', function (target) {
    if (typeof applyAiSuggestions === 'function') {
      applyAiSuggestions();
    }
  });

  // 189. 向导：上一步
  registerHandler('wizard-prev', function (target) {
    if (typeof prevStep === 'function') {
      prevStep();
    }
  });

  // 190. 向导：下一步
  registerHandler('wizard-next', function (target) {
    if (typeof nextStep === 'function') {
      nextStep();
    }
  });

  // 191. 向导：发布
  registerHandler('wizard-publish', function (target) {
    if (typeof doPublish === 'function') {
      doPublish();
    }
  });

  // 192. 向导：打开管理后台
  registerHandler('wizard-open-admin', function (target) {
    if (typeof openAdminPage === 'function') {
      openAdminPage();
    }
  });

  // 193. 向导：开始新向导
  registerHandler('wizard-new', function (target) {
    if (typeof startNewOnboard === 'function') {
      startNewOnboard();
    }
  });

  // 194. 向导：跳转到步骤
  registerHandler('wizard-go-step', function (target) {
    const step = parseInt(target.getAttribute('data-step'), 10);
    if (!isNaN(step) && typeof goToStep === 'function') {
      goToStep(step);
    }
  });

  // 195. 向导：从弹窗跳转到步骤
  registerHandler('wizard-go-step-modal', function (target) {
    const step = parseInt(target.getAttribute('data-step'), 10);
    if (!isNaN(step) && typeof goToStepFromModal === 'function') {
      goToStepFromModal(step);
    }
  });

  // 196. 向导：应用 AI 行样式
  registerHandler('wizard-apply-row', function (target) {
    const style = target.getAttribute('data-style');
    if (style && typeof _applyAiRow === 'function') {
      _applyAiRow(style);
    }
  });

  // 197. 向导：折叠/展开维度卡片
  registerHandler('wizard-toggle-dim', function (target) {
    const next = target.nextElementSibling;
    if (next) {
      next.style.display = next.style.display === 'none' ? 'block' : 'none';
    }
  });

  // 198. 向导：删除父元素（通用）
  registerHandler('wizard-remove-self', function (target) {
    const parent = target.parentElement;
    if (parent) {
      parent.remove();
    }
  });

  // 199. 向导：添加维度解释
  registerHandler('wizard-add-dim-interp', function (target) {
    if (typeof onboardAddDimInterp === 'function') {
      onboardAddDimInterp(target);
    }
  });

  // 200. 向导：添加筛查条件
  registerHandler('wizard-add-screen-cond', function (target) {
    if (typeof onboardAddScreenCond === 'function') {
      onboardAddScreenCond();
    }
  });

  // 201. 向导：关闭弹窗
  registerHandler('wizard-close-modal', function (target) {
    const modalId = target.getAttribute('data-target');
    const modal = modalId ? document.getElementById(modalId) : target.closest('.modal');
    if (modal) {
      modal.classList.remove('open');
      modal.style.display = '';
    }
  });

  // ====================================================
  // Skill 管理事件委托
  // ====================================================

  // 202. Skill: 新增
  registerHandler('skill-add', function (target) {
    location.href = 'admin-skill-edit.html';
  });

  // 203. Skill: 编辑
  registerHandler('skill-edit', function (target) {
    const skillId = target.dataset.id;
    if (skillId) {
      location.href = 'admin-skill-edit.html?id=' + skillId;
    }
  });

  // 204. Skill: 查看
  registerHandler('skill-view', function (target) {
    const skillId = target.dataset.id;
    if (skillId) {
      location.href = 'admin-skill-view.html?id=' + skillId;
    }
  });

  // 205. Skill: 删除
  registerHandler('skill-delete', function (target) {
    const skillId = target.dataset.id;
    if (skillId && confirm('确定要删除这个 Skill 吗？')) {
      fetch('http://127.0.0.1:3100/api/skills/' + skillId, {
        method: 'DELETE'
      })
        .then(function (res) {
          if (res.ok) {
            showToast('✅ Skill 已删除', 'success');
            setTimeout(() => location.reload(), 1000);
          } else {
            showToast('❌ 删除失败', 'warning');
          }
        })
        .catch(function () {
          showToast('❌ 删除失败', 'warning');
        });
    }
  });

  // 206. Skill: 测试
  registerHandler('skill-test', function (target) {
    const skillId = target.dataset.id;
    if (skillId) {
      location.href = 'admin-skill-test.html?id=' + skillId;
    }
  });

  // ====================================================
  // 🚀 性能优化：单一事件监听器（只绑定一个 click 事件）
  // ====================================================

  /**
   * 初始化事件委托（性能优化版）
   * 🚀 优化点：
   * 1. 只绑定一个 click 事件监听器（而不是 50+ 个）
   * 2. 使用处理器映射表，O(1) 查找
   * 3. 事件委托，利用事件冒泡
   * 4. 条件短路，找到匹配的处理器后立即返回
   */
  EventDelegate.init = function () {
    console.log('🚀 初始化优化版事件委托 (v3.0.0)...');
    console.log(`   已注册 ${actionHandlers.size} 个事件处理器`);

    // 🚀 性能优化：只绑定一个 click 事件监听器
    document.addEventListener('click', function (e) {
      // 1. 阻止默认行为（用于 <a> 标签）
      const preventTarget = e.target.closest('[data-prevent]');
      if (preventTarget) {
        e.preventDefault();
      }

      // 2. 处理 data-action 属性
      const actionTarget = e.target.closest('[data-action]');
      if (actionTarget) {
        const action = actionTarget.getAttribute('data-action');
        const handler = actionHandlers.get(action);

        if (handler) {
          try {
            handler(actionTarget, e);
          } catch (err) {
            console.error(`[EventDelegate] 处理器执行失败 (action: ${action}):`, err);
          }
          return; // 🚀 找到处理器后就返回，避免继续检查
        }
      }

      // 3. 处理 data-tab 属性（Tab 切换）
      const tabTarget = e.target.closest('[data-tab]');
      if (tabTarget) {
        const tabName = tabTarget.getAttribute('data-tab');
        const tabGroup = tabTarget.getAttribute('data-tab-group') || 'tab';

        // 移除同组中所有 active
        document.querySelectorAll('[data-tab="' + tabName + '"]').forEach(function (el) {
          el.classList.remove('active');
        });

        // 添加 active 到当前元素
        tabTarget.classList.add('active');

        // 隐藏同组所有面板
        document.querySelectorAll('[data-tab-panel]').forEach(function (panel) {
          if (panel.getAttribute('data-tab-group') === tabGroup) {
            panel.style.display = 'none';
          }
        });

        // 显示对应面板
        const panel = document.querySelector('[data-tab-panel="' + tabName + '"][data-tab-group="' + tabGroup + '"]');
        if (panel) {
          panel.style.display = '';
        }

        return; // 🚀 处理完 tab 后返回
      }
    });

    console.log('✅ 优化版事件委托初始化完成');
    console.log('   📊 性能提升：事件监听器数量从 50+ 减少到 1 个');
    console.log('   📊 查找速度：从 O(n) 提升到 O(1)');
  };

  // ====================================================
  // 快捷函数（供旧代码调用）
  // ====================================================

  EventDelegate.removeParent = function (btn) {
    const parent = btn.parentElement;
    if (parent) {
      parent.remove();
    }
  };

  EventDelegate.remove = function (selector) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el) {
      el.remove();
    }
  };

  EventDelegate.toggle = function (selector) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el) {
      el.style.display = el.style.display === 'none' ? '' : 'none';
    }
  };

  EventDelegate.closeModal = function (trigger, modalSelector) {
    let modal;
    if (typeof modalSelector === 'string') {
      modal = document.querySelector(modalSelector);
    } else if (modalSelector) {
      modal = modalSelector;
    }

    if (!modal && trigger) {
      const el = typeof trigger === 'string' ? document.querySelector(trigger) : trigger;
      modal = el ? el.closest('.modal, .overlay, [role="dialog"], [class*="modal"]') : null;
    }

    if (modal) {
      modal.classList.remove('open');
      modal.style.display = '';
      document.body.style.overflow = '';
    }
  };

  EventDelegate.closeThisModal = function (btn) {
    const modal = btn.closest('.modal, .overlay, [role="dialog"], [class*="modal"]');
    if (modal) {
      modal.classList.remove('open');
      modal.style.display = '';
      document.body.style.overflow = '';
    }
  };

  // 200. 通用：新窗口打开
  registerHandler('open-blank', function (target) {
    const url = target.getAttribute('data-url');
    if (url) {
      window.open(url, '_blank');
    }
  });

  // ====================================================
  // 导出
  // ====================================================

  global.EventDelegate = EventDelegate;

  global.removeParent = EventDelegate.removeParent;
  global.removeEl = EventDelegate.remove;
  global.toggleEl = EventDelegate.toggle;
  global.closeModal = EventDelegate.closeModal;
  global.closeThisModal = EventDelegate.closeThisModal;

  console.log('🚀 EventDelegate v3.0.0 (性能优化版) 已加载');
  console.log(`   📊 已注册 ${actionHandlers.size} 个事件处理器`);
  console.log('   📊 性能提升：事件监听器数量从 50+ 减少到 1 个');
  console.log('   📊 查找速度：从 O(n) 提升到 O(1)');
})(window);
