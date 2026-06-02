/**
 * admin-event-delegation.js - 事件委托优化模块
 *
 * @description 提供通用的事件处理函数，减少内联 onclick，支持事件委托模式
 * @version 2.2.1
 * @date 2026-05-21
 *
 * @example
 * // 使用 data-action 属性
 * <button data-action="remove-parent">删除</button>
 * <button data-action="switch-section" data-section="dashboard">切换</button>
 * <button data-action="filter-category" data-category="emotion">筛选</button>
 * <button data-action="refresh-status" data-provider="lnmp">刷新</button>
 *
 * @since admin-legacy.html v1.1.0
 */

(function (global) {
  'use strict';

  /**
   * @namespace EventDelegate
   * @description 事件委托管理器
   */
  var EventDelegate = {};

  // ====================================================
  // 初始化事件委托
  // ====================================================

  /**
   * 初始化事件委托
   * 在 document 层级绑定事件监听器
   */
  EventDelegate.init = function () {
    // 阻止默认行为（用于 <a> 标签）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-prevent]');
      if (target) {
        e.preventDefault();
      }
    });

    // 管理员登录
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="admin-login"]');
      if (target && typeof adminAuth !== 'undefined' && typeof adminAuth.login === 'function') {
        adminAuth.login();
      }
    });

    // 通用删除按钮 - 移除父元素
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="remove-parent"]');
      if (target) {
        var parent = target.parentElement;
        if (parent) {
          parent.remove();
        }
      }
    });

    // 通用切换类名
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="toggle-class"]');
      if (target) {
        var className = target.getAttribute('data-class');
        var targetSel = target.getAttribute('data-target');
        if (className && targetSel) {
          var el = document.querySelector(targetSel);
          if (el) {
            el.classList.toggle(className);
          }
        }
      }
    });

    // Tab 切换（通过 data-tab 属性）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-tab]');
      if (target) {
        var tabName = target.getAttribute('data-tab');
        var tabGroup = target.getAttribute('data-tab-group') || 'tab';

        // 移除同组中所有 active
        document.querySelectorAll('[data-tab="' + tabName + '"]').forEach(function (el) {
          el.classList.remove('active');
        });

        // 添加 active 到当前元素
        target.classList.add('active');

        // 隐藏同组所有面板
        document.querySelectorAll('[data-tab-panel]').forEach(function (panel) {
          if (panel.getAttribute('data-tab-group') === tabGroup) {
            panel.style.display = 'none';
          }
        });

        // 显示对应面板
        var panel = document.querySelector('[data-tab-panel="' + tabName + '"][data-tab-group="' + tabGroup + '"]');
        if (panel) {
          panel.style.display = '';
        }
      }
    });

    // 面板切换（显示/隐藏 + 图标文字切换）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="toggle-panel"]');
      if (target) {
        var panelId = target.getAttribute('data-panel');
        var iconOpen = target.getAttribute('data-icon-open') || '▼ 展开';
        var iconClose = target.getAttribute('data-icon-close') || '▲ 收起';
        var loadFn = target.getAttribute('data-load'); // 可选：切换时调用的函数名

        if (panelId) {
          var panel = document.getElementById(panelId);
          var iconEl =
            document.getElementById(panelId.replace('-panel', '-toggle-icon')) ||
            target.querySelector('.toggle-icon') ||
            target;

          if (panel.style.display === 'none') {
            panel.style.display = '';
            if (iconEl.textContent) iconEl.textContent = iconClose;
            // 可选：加载数据
            if (loadFn && typeof window[loadFn] === 'function') {
              window[loadFn]();
            }
          } else {
            panel.style.display = 'none';
            if (iconEl.textContent) iconEl.textContent = iconOpen;
          }
        }
      }
    });

    // 关闭当前弹窗（向上查找最近的 .modal 或 .overlay）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="close-this-modal"]');
      if (target) {
        var modal = target.closest('.modal, .overlay, [role="dialog"], [class*="modal"]');
        if (modal) {
          modal.classList.remove('open');
          modal.style.display = '';
          document.body.style.overflow = '';
        }
      }
    });

    // 导航切换（切换主面板）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="switch-section"]');
      if (target) {
        var section = target.getAttribute('data-section');
        var afterSwitch = target.getAttribute('data-after'); // 格式: "functionName" 或 "functionName:param"
        if (section && typeof switchSection === 'function') {
          switchSection(section);
        }
        if (afterSwitch) {
          var parts = afterSwitch.split(':');
          var fnName = parts[0];
          var fnArg = parts[1];
          if (fnName && typeof window[fnName] === 'function') {
            if (fnArg) {
              window[fnName](fnArg);
            } else {
              window[fnName]();
            }
          }
        }
      }
    });

    // Tab 切换（切换选项卡）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="switch-tab"]');
      if (target) {
        var tab = target.getAttribute('data-tab');
        if (tab && typeof switchTab === 'function') {
          switchTab(tab);
        }
      }
    });

    // NPC Tab 切换
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="switch-npc-tab"]');
      if (target) {
        var tab = target.getAttribute('data-tab');
        var group = target.closest('[data-npc-tab-group]');
        // 更新 active 状态
        if (group) {
          group.querySelectorAll('[data-action="switch-npc-tab"]').forEach(function (el) {
            el.classList.remove('active');
          });
        }
        target.classList.add('active');
        // 调用切换函数
        if (tab && typeof switchNpcTab === 'function') {
          switchNpcTab(tab);
        }
      }
    });

    // Ops Tab 切换
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="switch-ops-tab"]');
      if (target) {
        var tab = target.getAttribute('data-tab');
        var group = target.closest('[data-ops-tab-group]');
        // 更新 active 状态
        if (group) {
          group.querySelectorAll('[data-action="switch-ops-tab"]').forEach(function (el) {
            el.classList.remove('active');
          });
        }
        target.classList.add('active');
        // 调用切换函数
        if (tab && typeof switchOpsTab === 'function') {
          switchOpsTab(tab, target);
        }
      }
    });

    // 计分面板 Tab 切换
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="switch-sc-panel"]');
      if (target) {
        var index = parseInt(target.getAttribute('data-index'), 10);
        var container = target.closest('.sc-tab-container') || target.parentElement;
        // 更新 active 状态
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
        // 调用切换函数
        if (!isNaN(index) && typeof switchScPanel === 'function') {
          switchScPanel(target, index);
        }
      }
    });

    // 分类筛选（图标分类等）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="filter-category"]');
      if (target) {
        var category = target.getAttribute('data-category');
        // 更新 active 状态
        var group = target.closest('[data-category-group]') || target.parentElement;
        if (group) {
          group.querySelectorAll('[data-action="filter-category"]').forEach(function (el) {
            el.classList.remove('active');
          });
        }
        target.classList.add('active');
        // 调用筛选函数
        if (category && typeof filterIconsByCategory === 'function') {
          filterIconsByCategory(category);
        }
      }
    });

    // 刷新状态（AI密钥状态等）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="refresh-status"]');
      if (target) {
        var provider = target.getAttribute('data-provider');
        var model = target.getAttribute('data-model') || null;
        if (typeof refreshAiKeyStatus === 'function') {
          refreshAiKeyStatus(provider, model);
        }
      }
    });

    // 显示 Toast 提示
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="show-toast"]');
      if (target) {
        var message = target.getAttribute('data-message');
        var type = target.getAttribute('data-toast-type') || 'info';
        if (message && typeof showToast === 'function') {
          showToast(message, type);
        }
      }
    });

    // Ops: 刷新 AI 状态
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ops-check-ai"]');
      if (target && typeof opsCheckAi === 'function') {
        opsCheckAi();
      }
    });

    // Ops: 从服务端加载 AI Keys
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ops-load-keys"]');
      if (target && typeof opsLoadAiKeysFromServer === 'function') {
        opsLoadAiKeysFromServer();
      }
    });

    // Ops: 检查服务端 Keys 状态
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ops-check-server-keys"]');
      if (target && typeof opsCheckServerKeys === 'function') {
        opsCheckServerKeys();
      }
    });

    // Ops: 保存配置
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ops-save-config"]');
      if (target && typeof opsSaveConfig === 'function') {
        opsSaveConfig();
      }
    });

    // Ops: 健康检查
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ops-health-check"]');
      if (target && typeof opsHealthCheck === 'function') {
        opsHealthCheck();
      }
    });

    // Reset: AI 诊断提示词
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="reset-ai-diag"]');
      if (target && typeof resetAiDiagPrompt === 'function') {
        resetAiDiagPrompt();
      }
    });

    // Reset: 咨询师筛选
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="reset-counselor-filters"]');
      if (target && typeof resetCounselorFilters === 'function') {
        resetCounselorFilters();
      }
    });

    // Reset: 背景筛选
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="reset-background-filters"]');
      if (target && typeof resetBackgroundFilters === 'function') {
        resetBackgroundFilters();
      }
    });

    // Reset: 过渡语筛选
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="reset-transition-filters"]');
      if (target && typeof resetTransitionFilters === 'function') {
        resetTransitionFilters();
      }
    });

    // Modal: 打开新建量表弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="open-create-modal"]');
      if (target && typeof openCreateModal === 'function') {
        openCreateModal();
      }
    });

    // Modal: 打开新增类型弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="open-create-type-modal"]');
      if (target && typeof openCreateTypeModal === 'function') {
        openCreateTypeModal();
      }
    });

    // Modal: 打开过渡语弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="open-transition-modal"]');
      if (target && typeof openTransitionModal === 'function') {
        openTransitionModal();
      }
    });

    // 通用操作: 下载模板
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="download-template"]');
      if (target) {
        var templateType = target.getAttribute('data-template-type') || 'scale';
        if (typeof downloadTemplate === 'function') {
          downloadTemplate(templateType);
        }
      }
    });

    // 通用操作: 下载量表模板
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="download-scale-template"]');
      if (target && typeof downloadScaleTemplate === 'function') {
        downloadScaleTemplate();
      }
    });

    // 通用操作: 保存配置
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="save-config"]');
      if (target) {
        var configType = target.getAttribute('data-config-type');
        if (configType === 'ai-diag' && typeof saveAiDiagConfig === 'function') {
          saveAiDiagConfig();
        } else if (configType === 'ai' && typeof saveAiConfig === 'function') {
          saveAiConfig();
        } else if (configType === 'scoring' && typeof saveScoringConfig === 'function') {
          saveScoringConfig();
        }
      }
    });

    // 通用操作: 导出记录
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="export-records"]');
      if (target && typeof exportRecords === 'function') {
        exportRecords();
      }
    });

    // 通用操作: 同步到前端
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sync-frontend"]');
      if (target && typeof syncToFrontend === 'function') {
        syncToFrontend();
      }
    });

    // 通用操作: 从云端拉取
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="pull-cloud"]');
      if (target && typeof pullFromCloud === 'function') {
        pullFromCloud();
      }
    });

    // 通用操作: 导出所有数据
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="export-all"]');
      if (target && typeof exportAllData === 'function') {
        exportAllData();
      }
    });

    // 通用操作: 导入数据
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="import-data"]');
      if (target && typeof importData === 'function') {
        importData();
      }
    });

    // 通用操作: 保存编辑
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="save-edit"]');
      if (target) {
        var editType = target.getAttribute('data-edit-type');
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
      }
    });

    // 通用操作: 测试
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="test"]');
      if (target) {
        var testType = target.getAttribute('data-test-type');
        if (testType === 'ai-diag' && typeof testAiDiag === 'function') {
          testAiDiag();
        } else if (testType === 'ai-connection' && typeof testAiConnection === 'function') {
          testAiConnection();
        }
      }
    });

    // 通用操作: 生成
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="generate"]');
      if (target) {
        var genType = target.getAttribute('data-generate-type');
        if (genType === 'ai-diag' && typeof generateAiDiagPrompt === 'function') {
          generateAiDiagPrompt();
        }
      }
    });

    // 通用操作: 手动同步
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="manual-sync"]');
      if (target) {
        var syncType = target.getAttribute('data-sync-type');
        if (syncType === 'npc-images' && typeof manualSyncNpcImages === 'function') {
          manualSyncNpcImages();
        }
      }
    });

    // 通用操作: 切换拖拽排序模式
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="toggle-drag-sort"]');
      if (target && typeof toggleDragSortMode === 'function') {
        toggleDragSortMode();
      }
    });

    // 通用操作: 恢复/还原
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="restore"]');
      if (target) {
        var restoreType = target.getAttribute('data-restore-type');
        if (restoreType === 'npc-config' && typeof restoreNpcConfigFromCloud === 'function') {
          restoreNpcConfigFromCloud();
        } else if (restoreType === 'npc-images' && typeof restoreNpcImagesFromCloud === 'function') {
          restoreNpcImagesFromCloud();
        }
      }
    });

    // 通用操作: 确认操作
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="confirm-action"]');
      if (target) {
        var confirmType = target.getAttribute('data-confirm-type');
        if (confirmType === 'reset-data' && typeof confirmResetData === 'function') {
          confirmResetData();
        } else if (confirmType === 'counselor' && typeof confirmEditCounselor === 'function') {
          confirmEditCounselor();
        } else if (confirmType === 'bg' && typeof confirmEditBg === 'function') {
          confirmEditBg();
        } else if (confirmType === 'icon' && typeof confirmIconSelection === 'function') {
          confirmIconSelection();
        }
      }
    });

    // 通用操作: 显示弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="show-dialog"]');
      if (target) {
        var dialogType = target.getAttribute('data-dialog-type');
        if (dialogType === 'change-password' && typeof showChangePasswordDialog === 'function') {
          showChangePasswordDialog();
        }
      }
    });

    // 通用操作: 新增步骤
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="add-step"]');
      if (target && typeof spAddFlowStep === 'function') {
        spAddFlowStep();
      }
    });

    // 通用操作: 添加元素
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="add-item"]');
      if (target) {
        var addType = target.getAttribute('data-add-type');
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
      }
    });

    // 通用操作: 删除元素
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="delete-item"]');
      if (target) {
        var deleteType = target.getAttribute('data-delete-type');
        if (deleteType === 'transition' && typeof deleteTransitionFromEdit === 'function') {
          deleteTransitionFromEdit();
        } else if (deleteType === 'question' && typeof deleteQuestion === 'function') {
          deleteQuestion();
        } else if (deleteType === 'pre-question' && typeof deletePreQuestion === 'function') {
          deletePreQuestion();
        }
      }
    });

    // 评分配置: 添加维度/指标/分档
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sc-add"]');
      if (target) {
        var scType = target.getAttribute('data-sc-type');
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
      }
    });

    // ====================================================
    // 反馈系统事件委托
    // ====================================================

    // 反馈：切换主 Tab
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="fb-switch-main-tab"]');
      if (target && typeof fbSwitchMainTab === 'function') {
        fbSwitchMainTab(target);
      }
    });

    // 反馈：设置星级筛选
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="fb-admin-set-star-filter"]');
      if (target && typeof fbAdminSetStarFilter === 'function') {
        fbAdminSetStarFilter(target);
      }
    });

    // 反馈：切换标签场景
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="fb-tag-switch-scene"]');
      if (target && typeof fbTagSwitchScene === 'function') {
        fbTagSwitchScene(target);
      }
    });

    // 反馈：切换标签类型
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="fb-tag-switch-type"]');
      if (target && typeof fbTagSwitchType === 'function') {
        fbTagSwitchType(target);
      }
    });

    // 反馈：添加标签
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="fb-tag-add-tags"]');
      if (target && typeof fbTagAddTags === 'function') {
        fbTagAddTags();
      }
    });

    // 反馈：查看详情（动态生成按钮）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="fb-admin-show-detail"]');
      if (target) {
        var id = target.getAttribute('data-id');
        if (id && typeof fbAdminShowDetail === 'function') {
          fbAdminShowDetail(id);
        }
      }
    });

    // 反馈：删除（动态生成按钮）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="fb-admin-delete"]');
      if (target) {
        var id = target.getAttribute('data-id');
        if (id && typeof fbAdminDelete === 'function') {
          fbAdminDelete(id);
          // 关闭详情弹窗
          var overlay = document.getElementById('fb-detail-overlay');
          if (overlay) overlay.remove();
        }
      }
    });

    // 反馈：分页跳转（动态生成按钮）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="fb-admin-go-page"]');
      if (target) {
        var page = parseInt(target.getAttribute('data-page'), 10);
        if (!isNaN(page) && typeof fbAdminGoPage === 'function') {
          fbAdminGoPage(page);
        }
      }
    });

    // 反馈：删除标签（动态生成按钮）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="fb-tag-delete"]');
      if (target) {
        var id = target.getAttribute('data-id');
        if (id && typeof fbTagDelete === 'function') {
          fbTagDelete(id);
        }
      }
    });

    // ====================================================
    // 提示词管理事件委托
    // ====================================================

    // 提示词：关闭版本编辑弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sp-close-ver-edit"]');
      if (target && typeof spCloseVerEdit === 'function') {
        spCloseVerEdit();
      }
    });

    // 提示词：保存版本
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sp-save-ver-edit"]');
      if (target && typeof spSaveVerEdit === 'function') {
        spSaveVerEdit();
      }
    });

    // 提示词：关闭新建弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sp-close-new-prompt"]');
      if (target && typeof spCloseNewPrompt === 'function') {
        spCloseNewPrompt();
      }
    });

    // 提示词：创建新提示词
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sp-create-new-prompt"]');
      if (target && typeof spCreateNewPrompt === 'function') {
        spCreateNewPrompt();
      }
    });

    // 提示词：填充模板
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sp-fill-template"]');
      if (target) {
        var tpl = target.getAttribute('data-tpl');
        if (tpl && typeof spFillTemplate === 'function') {
          spFillTemplate(tpl);
        }
      }
    });

    // ====================================================
    // 向导与预设事件委托
    // ====================================================

    // 应用预设
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="apply-preset"]');
      if (target) {
        var preset = target.getAttribute('data-preset');
        if (preset && typeof applyPreset === 'function') {
          applyPreset(preset);
        }
      }
    });

    // 自动分配过渡语
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="auto-assign-transitions"]');
      if (target && typeof autoAssignTransitionsByPhase === 'function') {
        autoAssignTransitionsByPhase();
      }
    });

    // 打开编辑咨询师选择器
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="open-edit-counselor-picker"]');
      if (target && typeof openEditCounselorPicker === 'function') {
        openEditCounselorPicker();
      }
    });

    // 打开编辑背景选择器
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="open-edit-bg-picker"]');
      if (target && typeof openEditBgPicker === 'function') {
        openEditBgPicker();
      }
    });

    // 向导：上一步
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-prev-step"]');
      if (target && typeof wizardPrevStep === 'function') {
        wizardPrevStep();
      }
    });

    // 向导：下一步
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-next-step"]');
      if (target && typeof wizardNextStep === 'function') {
        wizardNextStep();
      }
    });

    // ====================================================
    // 计分规则事件委托
    // ====================================================

    // 关闭计分规则弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="close-scoring-modal"]');
      if (target && typeof closeScoringModal === 'function') {
        closeScoringModal();
      }
    });

    // 切换计分面板 Tab
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sc-switch-panel"]');
      if (target) {
        var index = parseInt(target.getAttribute('data-index'), 10);
        if (!isNaN(index) && typeof switchScPanel === 'function') {
          switchScPanel(target, index);
        }
      }
    });

    // 添加维度
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sc-add-dimension"]');
      if (target && typeof addDimension === 'function') {
        addDimension();
      }
    });

    // 添加指标
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sc-add-metric"]');
      if (target && typeof addMetric === 'function') {
        addMetric();
      }
    });

    // 自动推导分值范围
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sc-auto-fill-ranges"]');
      if (target && typeof autoFillScoreRanges === 'function') {
        autoFillScoreRanges();
      }
    });

    // 添加分档规则
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sc-add-interp-rule"]');
      if (target && typeof addInterpRule === 'function') {
        addInterpRule();
      }
    });

    // 添加筛查条件
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sc-add-screen-cond"]');
      if (target && typeof addScreenCond === 'function') {
        addScreenCond();
      }
    });

    // 删除测前调查题目
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="delete-pre-question"]');
      if (target) {
        var qi = parseInt(target.getAttribute('data-qi'), 10);
        if (!isNaN(qi) && typeof deletePreQuestion === 'function') {
          deletePreQuestion(qi);
        }
      }
    });

    // 添加测前调查选项
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="add-pre-q-opt"]');
      if (target) {
        var qi = parseInt(target.getAttribute('data-qi'), 10);
        if (!isNaN(qi) && typeof addPreQOpt === 'function') {
          addPreQOpt(qi);
        }
      }
    });

    // 添加维度解释
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sc-add-dim-interp"]');
      if (target && typeof addDimInterp === 'function') {
        addDimInterp(target);
      }
    });

    // 折叠/展开维度卡片
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sc-toggle-dim"]');
      if (target) {
        var nextEl = target.nextElementSibling;
        if (nextEl) {
          nextEl.style.display = nextEl.style.display === 'none' ? 'block' : 'none';
        }
      }
    });

    // 删除维度卡片
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sc-remove-dim"]');
      if (target) {
        var card = target.closest('.sc-dim-card');
        if (card) card.remove();
      }
    });

    // ====================================================
    // 提示词高级功能事件委托
    // ====================================================

    // 复制提示词内容
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sp-copy-content"]');
      if (target && typeof spCopyContent === 'function') {
        spCopyContent();
      }
    });

    // 添加版本
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sp-add-version"]');
      if (target && typeof spAddVersion === 'function') {
        spAddVersion();
      }
    });

    // 保存流程完成
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sp-save-flow-done"]');
      if (target && typeof showToast === 'function') {
        showToast('✓ 使用流程已保存', 'success');
      }
    });

    // ====================================================
    // 计分相关事件委托
    // ====================================================

    // 选择量表（计分）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="select-scoring-scale"]');
      if (target) {
        var scaleId = target.getAttribute('data-scale-id');
        if (scaleId && typeof selectScoringScale === 'function') {
          selectScoringScale(scaleId);
        }
      }
    });

    // 运行计分测试
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="sc-run-test"]');
      if (target && typeof runScoringTest === 'function') {
        runScoringTest();
      }
    });

    // ====================================================
    // NPC/背景管理事件委托
    // ====================================================

    // 保存 NPC 编辑
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="save-npc-edit"]');
      if (target && typeof saveNpcEditModal === 'function') {
        saveNpcEditModal();
      }
    });

    // 打开图标选择器
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="open-icon-picker"]');
      if (target && typeof openIconPicker === 'function') {
        openIconPicker();
      }
    });

    // ====================================================
    // 通用操作事件委托
    // ====================================================

    // 从云端拉取
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="pull-from-cloud"]');
      if (target && typeof pullFromCloud === 'function') {
        pullFromCloud();
      }
    });

    // 渲染选项列表
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="render-option-list"]');
      if (target && typeof renderOptionList === 'function') {
        renderOptionList();
      }
    });

    // 切换下拉菜单
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="toggle-dropdown"]');
      if (target && typeof toggleDropdown === 'function') {
        var dropdownId = target.getAttribute('data-dropdown-id');
        if (dropdownId) {
          toggleDropdown(e, dropdownId);
        }
      }
    });

    // 切换状态
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="toggle-status"]');
      if (target) {
        var id = target.getAttribute('data-id');
        if (id && typeof toggleStatus === 'function') {
          toggleStatus(id);
        }
      }
    });

    // ====================================================
    // Ops 事件委托
    // ====================================================

    // 测试 AI Key 配置
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ops-test-ai-key"]');
      if (target && typeof opsTestAiKeyConfig === 'function') {
        opsTestAiKeyConfig();
      }
    });

    // 保存 API Base
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ops-save-api-base"]');
      if (target && typeof opsSaveApiBase === 'function') {
        opsSaveApiBase();
      }
    });

    // 保存 AI Keys
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ops-save-ai-keys"]');
      if (target && typeof opsSaveAiKeys === 'function') {
        opsSaveAiKeys();
      }
    });

    // ====================================================
    // 量表管理事件委托
    // ====================================================

    // 查看量表类型
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="view-scale-type"]');
      if (target) {
        var typeId = target.getAttribute('data-type-id');
        if (typeId && typeof viewScaleType === 'function') {
          viewScaleType(typeId);
        }
      }
    });

    // 管理量表类型
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="manage-scale-type"]');
      if (target) {
        var typeId = target.getAttribute('data-type-id');
        if (typeId && typeof manageScaleType === 'function') {
          manageScaleType(typeId);
        }
      }
    });

    // 打开编辑弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="open-edit-modal"]');
      if (target) {
        var scaleId = target.getAttribute('data-scale-id');
        if (scaleId && typeof openEditModal === 'function') {
          openEditModal(scaleId);
        }
      }
    });

    // 切换 Tab
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="switch-tab"]');
      if (target) {
        var tabId = target.getAttribute('data-tab-id');
        if (tabId && typeof switchTab === 'function') {
          switchTab(tabId);
        }
      }
    });

    // 筛选图标
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="filter-icons"]');
      if (target) {
        var category = target.getAttribute('data-category');
        if (category && typeof filterIconsByCategory === 'function') {
          filterIconsByCategory(category);
        }
      }
    });

    // ====================================================
    // 反馈管理事件委托 (Feedback)
    // ====================================================

    // FB: 关闭详情弹窗（点击背景）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="fb-close-overlay"]');
      if (target && e.target === target) {
        target.remove();
      }
    });

    // FB: 移除详情弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="fb-remove-overlay"]');
      if (target) {
        var overlay = document.getElementById('fb-detail-overlay');
        if (overlay) overlay.remove();
      }
    });

    // ====================================================
    // AI 配置事件委托 (AI Config)
    // ====================================================

    // AIC: 选择提供商
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="aic-select-provider"]');
      if (target && window.AIConfig && typeof AIConfig.selectProvider === 'function') {
        var provider = target.getAttribute('data-provider');
        if (provider) {
          AIConfig.selectProvider(provider);
        }
      }
    });

    // AIC: 切换密钥可见性
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="aic-toggle-visibility"]');
      if (target && window.AIConfig && typeof AIConfig.toggleKeyVisibility === 'function') {
        AIConfig.toggleKeyVisibility();
      }
    });

    // AIC: 从服务端加载
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="aic-load-server"]');
      if (target && window.AIConfig && typeof AIConfig.loadFromServer === 'function') {
        AIConfig.loadFromServer();
      }
    });

    // AIC: 检查双端状态
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="aic-check-status"]');
      if (target && window.AIConfig && typeof AIConfig.checkServerStatus === 'function') {
        AIConfig.checkServerStatus();
      }
    });

    // AIC: 保存到服务端
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="aic-save-server"]');
      if (target && window.AIConfig && typeof AIConfig.saveToServer === 'function') {
        AIConfig.saveToServer();
      }
    });

    // ====================================================
    // 提示词查看器事件委托 (Prompt View)
    // ====================================================

    // PV: 复制正文
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="pv-copy-content"]');
      if (target && typeof copyContent === 'function') {
        copyContent();
      }
    });

    // PV: 重命名
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="pv-rename"]');
      if (target && typeof renamePrompt === 'function') {
        renamePrompt();
      }
    });

    // PV: 删除
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="pv-delete"]');
      if (target && typeof deletePrompt === 'function') {
        deletePrompt();
      }
    });

    // PV: 关闭编辑
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="pv-close-edit"]');
      if (target && typeof closeEdit === 'function') {
        closeEdit();
      }
    });

    // PV: 保存编辑
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="pv-save-edit"]');
      if (target && typeof saveEdit === 'function') {
        saveEdit();
      }
    });

    // PV: 切换版本
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="pv-switch-version"]');
      if (target) {
        var index = parseInt(target.getAttribute('data-index'), 10);
        if (!isNaN(index) && typeof switchVersion === 'function') {
          switchVersion(index);
        }
      }
    });

    // PV: 打开版本编辑
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="pv-open-edit"]');
      if (target) {
        e.stopPropagation();
        var index = parseInt(target.getAttribute('data-index'), 10);
        if (!isNaN(index) && typeof openEdit === 'function') {
          openEdit(index);
        }
      }
    });

    // PV: 删除版本
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="pv-del-version"]');
      if (target) {
        e.stopPropagation();
        var index = parseInt(target.getAttribute('data-index'), 10);
        if (!isNaN(index) && typeof delVersion === 'function') {
          delVersion(index);
        }
      }
    });

    // PV: 新增版本
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="pv-add-version"]');
      if (target && typeof addVersion === 'function') {
        addVersion();
      }
    });

    // ====================================================
    // AI 计分测试事件委托 (AI Scoring Test)
    // ====================================================

    // AST: 上传文件
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-upload-file"]');
      if (target) {
        var input = document.getElementById('file-upload');
        if (input) input.click();
      }
    });

    // AST: 开始提取
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-start-extract"]');
      if (target && typeof startExtract === 'function') {
        startExtract();
      }
    });

    // AST: 开始解析
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-start-parse"]');
      if (target && typeof startParse === 'function') {
        startParse();
      }
    });

    // AST: 清空
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-clear-all"]');
      if (target && typeof clearAll === 'function') {
        clearAll();
      }
    });

    // AST: 加载示例
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-load-example"]');
      if (target) {
        var example = target.getAttribute('data-example');
        if (example && typeof loadExample === 'function') {
          loadExample(example);
        }
      }
    });

    // AST: 切换 Prompt 面板
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-toggle-prompt-panel"]');
      if (target && typeof togglePromptPanel === 'function') {
        togglePromptPanel();
      }
    });

    // AST: 复制 Prompt
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-copy-prompt"]');
      if (target && typeof copyPromptText === 'function') {
        e.stopPropagation();
        copyPromptText();
      }
    });

    // AST: 切换编辑模式
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-toggle-edit"]');
      if (target && typeof togglePromptEdit === 'function') {
        e.stopPropagation();
        togglePromptEdit();
      }
    });

    // AST: 保存编辑
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-save-edit"]');
      if (target && typeof savePromptEdit === 'function') {
        e.stopPropagation();
        savePromptEdit();
      }
    });

    // AST: 取消编辑
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-cancel-edit"]');
      if (target && typeof cancelPromptEdit === 'function') {
        e.stopPropagation();
        cancelPromptEdit();
      }
    });

    // AST: 恢复默认
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-reset-prompt"]');
      if (target && typeof resetPromptToDefault === 'function') {
        e.stopPropagation();
        resetPromptToDefault();
      }
    });

    // AST: 切换调试信息
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-toggle-debug"]');
      if (target && typeof toggleDebug === 'function') {
        toggleDebug();
      }
    });

    // AST: 复制原始 JSON
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-copy-json"]');
      if (target && typeof copyJson === 'function') {
        copyJson();
      }
    });

    // AST: 标准化 + 验证
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-normalize-verify"]');
      if (target && typeof normalizeAndVerify === 'function') {
        normalizeAndVerify();
      }
    });

    // AST: 复制标准化 JSON
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="ast-copy-normalized"]');
      if (target && typeof copyNormalizedJson === 'function') {
        copyNormalizedJson();
      }
    });

    // ====================================================
    // 测试中心事件委托 (Test Center)
    // ====================================================

    // TC: 登录
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-login"]');
      if (target && typeof login === 'function') {
        login();
      }
    });

    // TC: 批量测试报告
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-show-batch-report"]');
      if (target && typeof showBatchReport === 'function') {
        showBatchReport();
      }
    });

    // TC: 导出用例
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-export-suite"]');
      if (target && typeof exportSuite === 'function') {
        exportSuite();
      }
    });

    // TC: 导入文件（触发隐藏的 file input）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-import-file"]');
      if (target) {
        var input = document.getElementById('importFile');
        if (input) input.click();
      }
    });

    // TC: 跳转计分配置页
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-go-config"]');
      if (target) {
        location.href = 'admin-legacy.html';
      }
    });

    // TC: 上一步
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-prev-step"]');
      if (target && typeof goToPrevStep === 'function') {
        goToPrevStep();
      }
    });

    // TC: 下一步
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-next-step"]');
      if (target && typeof goToNextStep === 'function') {
        goToNextStep();
      }
    });

    // TC: 显示保存用例弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-show-save-case"]');
      if (target && typeof showSaveCaseDialog === 'function') {
        showSaveCaseDialog();
      }
    });

    // TC: 切换 Tab
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-switch-tab"]');
      if (target) {
        var tabId = target.getAttribute('data-tab-id');
        if (tabId && typeof switchTab === 'function') {
          switchTab(tabId);
        }
      }
    });

    // TC: 运行测试
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-run-test"]');
      if (target && typeof runTest === 'function') {
        runTest();
      }
    });

    // TC: 清空答案
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-clear-answers"]');
      if (target && typeof clearAnswers === 'function') {
        clearAnswers();
      }
    });

    // TC: 保存为用例
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-save-as-case"]');
      if (target && typeof saveCurrentAsCase === 'function') {
        saveCurrentAsCase();
      }
    });

    // TC: AI 预览
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-ai-preview"]');
      if (target && typeof runAiPreview === 'function') {
        runAiPreview();
      }
    });

    // TC: 复制 Prompt
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-copy-prompt"]');
      if (target && typeof copyPrompt === 'function') {
        copyPrompt();
      }
    });

    // TC: 保存 Prompt 到量表
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-save-prompt"]');
      if (target && typeof savePromptToScale === 'function') {
        savePromptToScale();
      }
    });

    // TC: 复制 AI 报告
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-copy-ai-report"]');
      if (target && typeof copyAiReport === 'function') {
        copyAiReport();
      }
    });

    // TC: 关闭批量测试弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-close-batch-modal"]');
      if (target) {
        var modal = document.getElementById('batchModal');
        if (modal) modal.style.display = 'none';
      }
    });

    // TC: 取消保存用例
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-cancel-save-case"]');
      if (target) {
        var modal = document.getElementById('saveCaseModal');
        if (modal) modal.style.display = 'none';
      }
    });

    // TC: 确认保存用例
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-confirm-save-case"]');
      if (target && typeof confirmSaveCase === 'function') {
        confirmSaveCase();
      }
    });

    // TC: 应用预设（动态生成按钮）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-apply-preset"]');
      if (target) {
        var preset = target.getAttribute('data-preset');
        if (preset && typeof applyPreset === 'function') {
          applyPreset(preset);
        }
      }
    });

    // TC: 加载用例（动态生成）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="tc-load-case"]');
      if (target) {
        var caseId = target.getAttribute('data-case-id');
        if (caseId && typeof loadCase === 'function') {
          loadCase(caseId);
        }
      }
    });

    // ====================================================
    // 选项管理事件委托
    // ====================================================

    // 打开选项管理器
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="open-option-manager"]');
      if (target) {
        var type = target.getAttribute('data-option-type');
        if (type && typeof openOptionManager === 'function') {
          openOptionManager(type);
        }
      }
    });

    // ====================================================
    // 向导事件委托 (Wizard / Scale Onboard)
    // ====================================================

    // 向导：关闭窗口
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-close"]');
      if (target) {
        window.close();
      }
    });

    // 向导：清空量表文本
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-clear-text"]');
      if (target) {
        var el = document.getElementById('ai-gen-text');
        if (el) el.value = '';
        if (typeof updateStep1TextStats === 'function') {
          updateStep1TextStats();
        }
      }
    });

    // 向导：复制文本
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-copy"]');
      if (target) {
        var id = target.getAttribute('data-target');
        if (id && typeof copyText === 'function') {
          copyText(id);
        }
      }
    });

    // 向导：AI 生成量表
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-ai-generate"]');
      if (target && typeof generateScaleByAi === 'function') {
        generateScaleByAi();
      }
    });

    // 向导：显示 JSON 输入
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-show-json"]');
      if (target && typeof showJsonInput === 'function') {
        showJsonInput();
      }
    });

    // 向导：解析 JSON
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-parse-json"]');
      if (target && typeof parseJsonInput === 'function') {
        parseJsonInput();
      }
    });

    // 向导：格式化 JSON
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-format-json"]');
      if (target && typeof formatJsonInput === 'function') {
        formatJsonInput();
      }
    });

    // 向导：下载模板下拉
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-template-dropdown"]');
      if (target && typeof toggleDownloadDropdown === 'function') {
        toggleDownloadDropdown(e);
      }
    });

    // 向导：下载模板项
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-download-template"]');
      if (target) {
        var type = target.getAttribute('data-template');
        if (type && typeof downloadTemplate === 'function') {
          downloadTemplate(type);
          if (typeof toggleDownloadDropdown === 'function') {
            toggleDownloadDropdown();
          }
        }
      }
    });

    // 向导：清空 JSON
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-clear-json"]');
      if (target && typeof clearJsonInput === 'function') {
        clearJsonInput();
      }
    });

    // 向导：切换折叠
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-toggle-collapsible"]');
      if (target) {
        var id = target.getAttribute('data-id');
        if (id && typeof toggleCollapsible === 'function') {
          toggleCollapsible(id);
        }
      }
    });

    // 向导：生成计分说明
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-gen-sc-desc"]');
      if (target && typeof generateScoringDesc === 'function') {
        generateScoringDesc();
      }
    });

    // 向导：重新生成计分说明
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-regen-sc-desc"]');
      if (target && typeof regenerateScoringDesc === 'function') {
        regenerateScoringDesc();
      }
    });

    // 向导：清空计分说明
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-clear-sc-desc"]');
      if (target && typeof clearScoringDesc === 'function') {
        clearScoringDesc();
      }
    });

    // 向导：生成计分规则
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-gen-scoring"]');
      if (target && typeof generateScoring === 'function') {
        generateScoring();
      }
    });

    // 向导：预览计分提示词
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-preview-sc-prompt"]');
      if (target && typeof previewScoringPrompt === 'function') {
        previewScoringPrompt();
      }
    });

    // 向导：关闭计分提示词预览
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-close-sc-preview"]');
      if (target) {
        var el = document.getElementById('scoring-prompt-preview');
        if (el) el.style.display = 'none';
      }
    });

    // 向导：切换计分 Tab
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-switch-sc-tab"]');
      if (target) {
        var tab = target.getAttribute('data-tab');
        if (tab && typeof switchScoringTab === 'function') {
          switchScoringTab(target, tab);
        }
      }
    });

    // 向导：导入计分 JSON
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-import-scoring"]');
      if (target && typeof importScoringJson === 'function') {
        importScoringJson();
      }
    });

    // 向导：清空计分规则
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-clear-scoring"]');
      if (target && typeof clearScoring === 'function') {
        clearScoring();
      }
    });

    // 向导：添加维度
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-add-dim"]');
      if (target && typeof onboardAddDimension === 'function') {
        onboardAddDimension();
      }
    });

    // 向导：添加指标
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-add-metric"]');
      if (target && typeof onboardAddMetric === 'function') {
        onboardAddMetric();
      }
    });

    // 向导：自动推导范围
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-auto-fill-ranges"]');
      if (target && typeof onboardAutoFillScoreRanges === 'function') {
        onboardAutoFillScoreRanges();
      }
    });

    // 向导：添加分档规则
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-add-interp"]');
      if (target && typeof onboardAddInterpRule === 'function') {
        onboardAddInterpRule();
      }
    });

    // 向导：运行模拟测试
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-run-test"]');
      if (target && typeof onboardRunScoringTest === 'function') {
        onboardRunScoringTest();
      }
    });

    // 向导：保存计分规则
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-save-scoring"]');
      if (target && typeof saveOnboardScoring === 'function') {
        saveOnboardScoring();
      }
    });

    // 向导：重置计分规则
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-reset-scoring"]');
      if (target && typeof resetOnboardScoring === 'function') {
        resetOnboardScoring();
      }
    });

    // 向导：应用提示词版本
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-apply-prompt"]');
      if (target && typeof applySelectedPromptVersion === 'function') {
        applySelectedPromptVersion();
      }
    });

    // 向导：生成提示词
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-gen-prompt"]');
      if (target && typeof generatePrompt === 'function') {
        generatePrompt();
      }
    });

    // 向导：重置提示词
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-reset-prompt"]');
      if (target && typeof resetPrompt === 'function') {
        resetPrompt();
      }
    });

    // 向导：切换 Meta Prompt 面板
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-toggle-meta"]');
      if (target && typeof toggleMetaPromptPanel === 'function') {
        toggleMetaPromptPanel();
      }
    });

    // 向导：AI 优化发布字段
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-ai-optimize"]');
      if (target && typeof aiOptimizePublishFields === 'function') {
        aiOptimizePublishFields();
      }
    });

    // 向导：应用 AI 建议
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-apply-ai"]');
      if (target && typeof applyAiSuggestions === 'function') {
        applyAiSuggestions();
      }
    });

    // 向导：上一步
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-prev"]');
      if (target && typeof prevStep === 'function') {
        prevStep();
      }
    });

    // 向导：下一步
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-next"]');
      if (target && typeof nextStep === 'function') {
        nextStep();
      }
    });

    // 向导：发布
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-publish"]');
      if (target && typeof doPublish === 'function') {
        doPublish();
      }
    });

    // 向导：打开管理后台
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-open-admin"]');
      if (target && typeof openAdminPage === 'function') {
        openAdminPage();
      }
    });

    // 向导：开始新向导
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-new"]');
      if (target && typeof startNewOnboard === 'function') {
        startNewOnboard();
      }
    });

    // 向导：跳转到步骤
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-go-step"]');
      if (target) {
        var step = parseInt(target.getAttribute('data-step'), 10);
        if (!isNaN(step) && typeof goToStep === 'function') {
          goToStep(step);
        }
      }
    });

    // 向导：从弹窗跳转到步骤
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-go-step-modal"]');
      if (target) {
        var step = parseInt(target.getAttribute('data-step'), 10);
        if (!isNaN(step) && typeof goToStepFromModal === 'function') {
          goToStepFromModal(step);
        }
      }
    });

    // 向导：应用 AI 行样式
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-apply-row"]');
      if (target) {
        var style = target.getAttribute('data-style');
        if (style && typeof _applyAiRow === 'function') {
          _applyAiRow(style);
        }
      }
    });

    // 向导：折叠/展开维度卡片
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-toggle-dim"]');
      if (target) {
        var next = target.nextElementSibling;
        if (next) {
          next.style.display = next.style.display === 'none' ? 'block' : 'none';
        }
      }
    });

    // 向导：删除父元素（通用）
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-remove-self"]');
      if (target) {
        var parent = target.parentElement;
        if (parent) parent.remove();
      }
    });

    // 向导：添加维度解释
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-add-dim-interp"]');
      if (target && typeof onboardAddDimInterp === 'function') {
        onboardAddDimInterp(target);
      }
    });

    // 向导：添加筛查条件
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-add-screen-cond"]');
      if (target && typeof onboardAddScreenCond === 'function') {
        onboardAddScreenCond();
      }
    });

    // 向导：关闭弹窗
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action="wizard-close-modal"]');
      if (target) {
        var modalId = target.getAttribute('data-target');
        var modal = modalId ? document.getElementById(modalId) : target.closest('.modal');
        if (modal) {
          modal.classList.remove('open');
          modal.style.display = '';
        }
      }
    });

    console.log('[EventDelegate] v2.2.1 已初始化');
  };

  // ====================================================
  // 快捷函数（供旧代码调用）
  // ====================================================

  /**
   * 移除当前元素的父元素（替代内联 this.parentElement.remove()）
   */
  EventDelegate.removeParent = function (btn) {
    var parent = btn.parentElement;
    if (parent) {
      parent.remove();
    }
  };

  /**
   * 移除指定选择器的元素
   */
  EventDelegate.remove = function (selector) {
    var el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el) {
      el.remove();
    }
  };

  /**
   * 切换元素显示/隐藏
   */
  EventDelegate.toggle = function (selector) {
    var el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el) {
      el.style.display = el.style.display === 'none' ? '' : 'none';
    }
  };

  /**
   * 关闭弹窗（通用方法）
   * @param {HTMLElement|string} trigger - 触发元素或选择器
   * @param {string} modalSelector - 弹窗选择器，默认从 trigger 向上查找 .modal 或弹窗类
   */
  EventDelegate.closeModal = function (trigger, modalSelector) {
    var modal;
    if (typeof modalSelector === 'string') {
      modal = document.querySelector(modalSelector);
    } else if (modalSelector) {
      modal = modalSelector;
    }
    // 默认：从 trigger 向上查找最近的弹窗
    if (!modal && trigger) {
      var el = typeof trigger === 'string' ? document.querySelector(trigger) : trigger;
      modal = el ? el.closest('.modal, .overlay, [role="dialog"], [class*="modal"]') : null;
    }
    if (modal) {
      modal.classList.remove('open');
      modal.style.display = '';
      document.body.style.overflow = '';
    }
  };

  /**
   * 快捷关闭函数 - 关闭当前触发元素所在的弹窗
   */
  EventDelegate.closeThisModal = function (btn) {
    var modal = btn.closest('.modal, .overlay, [role="dialog"], [class*="modal"]');
    if (modal) {
      modal.classList.remove('open');
      modal.style.display = '';
      document.body.style.overflow = '';
    }
  };

  // ====================================================
  // 导出
  // ====================================================

  global.EventDelegate = EventDelegate;

  // 同时导出快捷方法到全局
  global.removeParent = EventDelegate.removeParent;
  global.removeEl = EventDelegate.remove;
  global.toggleEl = EventDelegate.toggle;
  global.closeModal = EventDelegate.closeModal;
  global.closeThisModal = EventDelegate.closeThisModal;

  console.log('[EventDelegate] v1.5.0 已加载');
})(window);
