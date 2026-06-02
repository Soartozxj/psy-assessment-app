/**
 * admin-auth.js - 后台登录认证模块
 *
 * @description 管理员密码登录认证，支持防暴力破解锁定机制
 * @version 1.0.0
 * @date 2026-05-21
 *
 * @storage
 * - localStorage('psy_admin_password'): 管理员密码，首版默认值: admin2026
 * - sessionStorage('psy_admin_authed'): 认证状态，关闭浏览器自动失效
 * - sessionStorage('psy_admin_lock'): 锁定信息，防暴力破解用
 *
 * @example
 * adminAuth.init();
 * adminAuth.login();
 * adminAuth.changePassword(oldPwd, newPwd);
 * adminAuth.logout();
 *
 * @since admin-legacy.html v1.1.0
 */

(function (global) {
  'use strict';

  // ====================================================
  // 常量定义
  // ====================================================
  const DEFAULT_PWD = 'admin2026';
  const MAX_ATTEMPTS = 5;
  const LOCK_MINUTES = 5;
  const STORAGE_PWD_KEY = 'psy_admin_password';
  const STORAGE_AUTH_KEY = 'psy_admin_authed';
  const STORAGE_LOCK_KEY = 'psy_admin_lock';

  // ====================================================
  // adminAuth 命名空间
  // ====================================================
  /**
   * @namespace adminAuth
   * @description 认证管理器
   */
  const adminAuth = {};

  // ====================================================
  // 初始化
  // ====================================================

  /**
   * 初始化认证模块
   * @function init
   * @memberof adminAuth
   * @description 检查是否已认证，已认证则直接进入；绑定回车键提交
   */
  adminAuth.init = function () {
    const isAuthed = sessionStorage.getItem(STORAGE_AUTH_KEY) === '1';
    const isLocked = checkLock();
    if (isAuthed && !isLocked) {
      grantAccess();
    } else if (isLocked) {
      const remaining = getLockRemaining();
      showLockState(remaining);
    }
    // 绑定回车键
    const pwdInput = document.getElementById('authPassword');
    if (pwdInput) {
      pwdInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          adminAuth.login();
        }
      });
    }
    // 自动聚焦
    if (pwdInput && !isAuthed) {
      pwdInput.focus();
    }
  };

  // ====================================================
  // 登录逻辑
  // ====================================================

  function getPassword() {
    return localStorage.getItem(STORAGE_PWD_KEY) || DEFAULT_PWD;
  }

  /**
   * 执行登录
   * @function login
   * @memberof adminAuth
   * @description 验证密码，正确则进入后台，错误则计数/锁定
   */
  adminAuth.login = function () {
    const errorEl = document.getElementById('authError');
    const attemptsEl = document.getElementById('authAttempts');
    const pwdInput = document.getElementById('authPassword');
    errorEl.textContent = '';
    attemptsEl.textContent = '';

    // 检查锁定状态
    if (checkLock()) {
      var remaining = getLockRemaining();
      errorEl.textContent = '账户已锁定，请 ' + remaining + ' 后再试';
      return;
    }

    const inputPwd = (pwdInput.value || '').trim();
    if (!inputPwd) {
      errorEl.textContent = '请输入密码';
      pwdInput.focus();
      return;
    }

    const correctPwd = getPassword();
    if (inputPwd === correctPwd) {
      // 清除错误计数
      sessionStorage.removeItem(STORAGE_LOCK_KEY);
      sessionStorage.setItem(STORAGE_AUTH_KEY, '1');
      grantAccess();
    } else {
      // 记录失败次数
      const failCount = getFailCount() + 1;
      const lockInfo = { count: failCount, time: Date.now() };
      sessionStorage.setItem(STORAGE_LOCK_KEY, JSON.stringify(lockInfo));

      if (failCount >= MAX_ATTEMPTS) {
        var remaining = getLockRemaining();
        errorEl.textContent = '密码错误次数过多，已锁定 ' + remaining;
        attemptsEl.textContent = '';
        pwdInput.disabled = true;
        // 自动解锁检查
        const lockUntil = lockInfo.time + LOCK_MINUTES * 60 * 1000;
        const waitMs = lockUntil - Date.now();
        setTimeout(function () {
          sessionStorage.removeItem(STORAGE_LOCK_KEY);
          pwdInput.disabled = false;
          pwdInput.value = '';
          pwdInput.focus();
          errorEl.textContent = '锁定已解除，请重新输入密码';
          attemptsEl.textContent = '';
        }, waitMs);
      } else {
        const left = MAX_ATTEMPTS - failCount;
        errorEl.textContent = '密码错误';
        attemptsEl.textContent = '剩余尝试次数：' + left + ' 次';
        pwdInput.value = '';
        pwdInput.focus();
      }
    }
  };

  // ====================================================
  // 锁定逻辑
  // ====================================================

  function getFailCount() {
    const lockInfo = JSON.parse(sessionStorage.getItem(STORAGE_LOCK_KEY) || '{}');
    return lockInfo.count || 0;
  }

  function checkLock() {
    const failCount = getFailCount();
    if (failCount >= MAX_ATTEMPTS) {
      const lockInfo = JSON.parse(sessionStorage.getItem(STORAGE_LOCK_KEY) || '{}');
      const lockUntil = lockInfo.time + LOCK_MINUTES * 60 * 1000;
      if (Date.now() < lockUntil) {
        return true;
      }
      // 锁定已过期，自动清除
      sessionStorage.removeItem(STORAGE_LOCK_KEY);
    }
    return false;
  }

  function getLockRemaining() {
    const lockInfo = JSON.parse(sessionStorage.getItem(STORAGE_LOCK_KEY) || '{}');
    const lockUntil = lockInfo.time + LOCK_MINUTES * 60 * 1000;
    const remainMs = lockUntil - Date.now();
    if (remainMs <= 0) {
      return '0 秒';
    }
    const minutes = Math.floor(remainMs / 60000);
    const seconds = Math.ceil((remainMs % 60000) / 1000);
    if (minutes > 0) {
      return minutes + ' 分 ' + seconds + ' 秒';
    }
    return seconds + ' 秒';
  }

  function showLockState(remaining) {
    const errorEl = document.getElementById('authError');
    const attemptsEl = document.getElementById('authAttempts');
    const pwdInput = document.getElementById('authPassword');
    const loginBtn = document.getElementById('authLoginBtn');
    if (errorEl) {
      errorEl.textContent = '账户已锁定，请 ' + remaining + ' 后再试';
    }
    if (pwdInput) {
      pwdInput.disabled = true;
    }
    if (loginBtn) {
      loginBtn.disabled = true;
    }
    // 定时刷新剩余时间
    var timer = setInterval(function () {
      if (!checkLock()) {
        clearInterval(timer);
        if (pwdInput) {
          pwdInput.disabled = false;
        }
        if (loginBtn) {
          loginBtn.disabled = false;
        }
        if (errorEl) {
          errorEl.textContent = '锁定已解除，请重新输入密码';
        }
        if (pwdInput) {
          pwdInput.value = '';
          pwdInput.focus();
        }
        return;
      }
      if (errorEl) {
        errorEl.textContent = '账户已锁定，请 ' + getLockRemaining() + ' 后再试';
      }
    }, 1000);
  }

  // ====================================================
  // 认证通过
  // ====================================================

  function grantAccess() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
    document.body.classList.add('authenticated');
    // 认证通过后初始化页面（如果尚未初始化）
    if (!window._adminInitialized) {
      window._adminInitialized = true;
      if (typeof switchSection === 'function') {
        switchSection('dashboard');
      }
    }
  }

  // ====================================================
  // 密码管理
  // ====================================================

  /**
   * 修改密码
   * @function changePassword
   * @memberof adminAuth
   * @param {string} oldPwd - 原密码
   * @param {string} newPwd - 新密码（至少6位）
   * @returns {{ok: boolean, msg: string}} 操作结果
   */
  adminAuth.changePassword = function (oldPwd, newPwd) {
    if (oldPwd !== getPassword()) {
      return { ok: false, msg: '原密码不正确' };
    }
    if (!newPwd || newPwd.length < 6) {
      return { ok: false, msg: '新密码至少 6 位' };
    }
    if (newPwd === oldPwd) {
      return { ok: false, msg: '新密码不能与原密码相同' };
    }
    localStorage.setItem(STORAGE_PWD_KEY, newPwd);
    return { ok: true, msg: '密码修改成功' };
  };

  /**
   * 退出登录
   * @function logout
   * @memberof adminAuth
   * @description 清除认证状态，显示登录界面
   */
  adminAuth.logout = function () {
    sessionStorage.removeItem(STORAGE_AUTH_KEY);
    sessionStorage.removeItem(STORAGE_LOCK_KEY);
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
    }
    document.body.classList.remove('authenticated');
    const pwdInput = document.getElementById('authPassword');
    const errorEl = document.getElementById('authError');
    const attemptsEl = document.getElementById('authAttempts');
    const loginBtn = document.getElementById('authLoginBtn');
    if (pwdInput) {
      pwdInput.value = '';
      pwdInput.disabled = false;
      pwdInput.focus();
    }
    if (errorEl) {
      errorEl.textContent = '';
    }
    if (attemptsEl) {
      attemptsEl.textContent = '';
    }
    if (loginBtn) {
      loginBtn.disabled = false;
    }
  };

  // ====================================================
  // 导出
  // ====================================================

  global.adminAuth = adminAuth;

  console.log('[adminAuth] v1.0.0 已加载');
})(window);
