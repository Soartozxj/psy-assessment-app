/**
 * admin-ui-utils.js - 统一 UI 组件工具库
 *
 * 提供统一的确认弹窗、Toast 通知、Modal 管理等组件
 * 解决 P2-14: 弹窗复用 confirm-modal hack 问题
 *
 * @version 1.0.0
 * @date 2026-05-20
 */

(function (global) {
  'use strict';

  // ====================================================
  // UIUtils 命名空间
  // ====================================================
  var UIUtils = {};

  // -------------------------------------------
  // 确认弹窗配置
  // -------------------------------------------
  var _confirmConfig = {
    title: '确认操作',
    message: '确定要执行此操作吗？',
    confirmText: '确认',
    cancelText: '取消',
    dangerMode: false,
    onConfirm: null,
    onCancel: null
  };

  var _confirmResolve = null;

  // -------------------------------------------
  // Toast 通知配置
  // -------------------------------------------
  var _toastContainer = null;

  // ====================================================
  // 确认弹窗 API (Promise 风格 + 回调风格兼容)
  // ====================================================

  /**
   * 显示确认弹窗（Promise 风格）
   * @param {Object} options - 配置选项
   * @param {string} options.title - 弹窗标题
   * @param {string} options.message - 确认消息
   * @param {string} [options.confirmText='确认'] - 确认按钮文字
   * @param {string} [options.cancelText='取消'] - 取消按钮文字
   * @param {boolean} [options.dangerMode=false] - 危险模式（红色确认按钮）
   * @returns {Promise<boolean>} 用户选择结果
   *
   * @example
   * // Promise 风格（推荐）
   * const confirmed = await UIUtils.showConfirm({
   *   title: '确认删除',
   *   message: '确定要删除此量表吗？',
   *   dangerMode: true
   * });
   * if (confirmed) {
   *   await deleteItem();
   * }
   *
   * @example
   * // 回调风格（兼容旧代码）
   * UIUtils.showConfirm({
   *   title: '确认发布',
   *   message: '确定要发布吗？',
   *   onConfirm: () => publish(),
   *   onCancel: () => cancel()
   * });
   */
  UIUtils.showConfirm = function (options) {
    // 兼容旧调用方式：showConfirm(title, message, onOk)
    if (typeof options === 'string') {
      options = {
        title: arguments[0],
        message: arguments[1],
        onConfirm: arguments[2]
      };
    }

    var config = Object.assign({}, _confirmConfig, options);

    // Promise 模式
    if (!config.onConfirm && !config.onCancel) {
      return new Promise(function (resolve) {
        _showConfirmModal(config, resolve);
      });
    }

    // 回调模式
    _showConfirmModal(config, function () {
      if (config.onConfirm) config.onConfirm();
    });
  };

  /**
   * 内部方法：显示确认弹窗
   */
  function _showConfirmModal(config, resolve) {
    var modal = document.getElementById('confirm-modal');
    var titleEl = document.getElementById('confirm-text');
    var messageEl = document.getElementById('confirm-sub');
    var okBtn = document.getElementById('confirm-ok-btn');

    if (!modal || !titleEl || !messageEl || !okBtn) {
      console.warn('Confirm modal elements not found');
      resolve(false);
      return;
    }

    // 设置内容
    titleEl.textContent = config.title || '确认操作';
    messageEl.textContent = config.message || '确定要执行此操作吗？';
    okBtn.textContent = config.confirmText || '确认';

    // 危险模式样式
    if (config.dangerMode) {
      okBtn.classList.add('btn-danger');
    } else {
      okBtn.classList.remove('btn-danger');
    }

    // 绑定确认按钮
    okBtn.onclick = function () {
      closeConfirmModal();
      if (resolve) resolve(true);
      if (config.onConfirm) config.onConfirm();
    };

    // 绑定取消按钮
    var cancelBtn = modal.querySelector('.btn-default');
    if (cancelBtn) {
      cancelBtn.onclick = function () {
        closeConfirmModal();
        if (resolve) resolve(false);
        if (config.onCancel) config.onCancel();
      };
    }

    // ESC 键关闭
    var escHandler = function (e) {
      if (e.key === 'Escape') {
        closeConfirmModal();
        if (resolve) resolve(false);
        if (config.onCancel) config.onCancel();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // 显示弹窗
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  /**
   * 关闭确认弹窗
   */
  function closeConfirmModal() {
    var modal = document.getElementById('confirm-modal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // 兼容旧 API
  UIUtils.closeConfirm = closeConfirmModal;

  // ====================================================
  // Toast 通知 API
  // ====================================================

  /**
   * 显示 Toast 通知
   * @param {string} message - 通知内容
   * @param {string} [type='info'] - 类型：success|error|warning|info
   * @param {number} [duration=3000] - 显示时长（毫秒）
   *
   * @example
   * UIUtils.toast('保存成功', 'success');
   * UIUtils.toast('网络错误', 'error');
   */
  UIUtils.toast = function (message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;

    if (!_toastContainer) {
      _toastContainer = _createToastContainer();
    }

    var toast = document.createElement('div');
    toast.className = 'ui-toast ui-toast-' + type;

    var icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    toast.innerHTML =
      '<span class="ui-toast-icon">' +
      (icons[type] || icons.info) +
      '</span>' +
      '<span class="ui-toast-message">' +
      message +
      '</span>';

    _toastContainer.appendChild(toast);

    // 动画效果
    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    // 自动移除
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  };

  /**
   * 创建 Toast 容器
   */
  function _createToastContainer() {
    var container = document.createElement('div');
    container.id = 'ui-toast-container';
    container.className = 'ui-toast-container';
    document.body.appendChild(container);
    return container;
  }

  // ====================================================
  // Modal 工具
  // ====================================================

  /**
   * 打开 Modal
   * @param {string} modalId - Modal 元素 ID
   */
  UIUtils.openModal = function (modalId) {
    var modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  };

  /**
   * 关闭 Modal
   * @param {string} modalId - Modal 元素 ID
   */
  UIUtils.closeModal = function (modalId) {
    var modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  /**
   * 关闭所有 Modal
   */
  UIUtils.closeAllModals = function () {
    document.querySelectorAll('.modal-overlay.open').forEach(function (modal) {
      modal.classList.remove('open');
    });
    document.body.style.overflow = '';
  };

  // ====================================================
  // 数据格式化工具
  // ====================================================

  /**
   * 格式化数字（带千分位）
   */
  UIUtils.formatNumber = function (num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  /**
   * 格式化文件大小
   */
  UIUtils.formatBytes = function (bytes) {
    if (bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * 格式化日期时间
   */
  UIUtils.formatDateTime = function (date) {
    if (!date) return '-';
    var d = new Date(date);
    var pad = function (n) {
      return n < 10 ? '0' + n : n;
    };
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  };

  /**
   * 相对时间（如：刚刚、5分钟前）
   */
  UIUtils.formatRelativeTime = function (date) {
    if (!date) return '-';
    var d = new Date(date);
    var now = new Date();
    var diff = now - d;

    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);

    if (seconds < 60) return '刚刚';
    if (minutes < 60) return minutes + ' 分钟前';
    if (hours < 24) return hours + ' 小时前';
    if (days < 7) return days + ' 天前';
    return UIUtils.formatDateTime(date);
  };

  // ====================================================
  // 防抖 & 节流
  // ====================================================

  /**
   * 防抖函数
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 延迟毫秒数
   */
  UIUtils.debounce = function (fn, delay) {
    var timer = null;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  };

  /**
   * 节流函数
   * @param {Function} fn - 要执行的函数
   * @param {number} limit - 间隔毫秒数
   */
  UIUtils.throttle = function (fn, limit) {
    var inThrottle = false;
    return function () {
      var context = this;
      var args = arguments;
      if (!inThrottle) {
        fn.apply(context, args);
        inThrottle = true;
        setTimeout(function () {
          inThrottle = false;
        }, limit);
      }
    };
  };

  // ====================================================
  // 导出
  // ====================================================

  // 挂载到全局
  global.UIUtils = UIUtils;

  // 同时导出便捷方法（兼容旧代码）
  global.showConfirm = UIUtils.showConfirm;
  global.closeConfirm = UIUtils.closeConfirm;
  global.showToast = UIUtils.toast;
})(window);

// ====================================================
// Toast 样式（内嵌，无需额外 CSS）
// ====================================================
(function () {
  if (document.getElementById('ui-toast-styles')) return;

  var style = document.createElement('style');
  style.id = 'ui-toast-styles';
  style.textContent = `
    .ui-toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ui-toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 14px;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    }
    .ui-toast.show {
      opacity: 1;
      transform: translateX(0);
    }
    .ui-toast-success { border-left: 4px solid #52c41a; }
    .ui-toast-error { border-left: 4px solid #ff4d4f; }
    .ui-toast-warning { border-left: 4px solid #faad14; }
    .ui-toast-info { border-left: 4px solid #1890ff; }
    .ui-toast-icon { font-size: 16px; }
    .ui-toast-message { color: #333; }
  `;
  document.head.appendChild(style);
})();
