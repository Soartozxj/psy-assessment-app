/**
 * auth-plugin.js - 认证插件
 *
 * 大白话解释：
 * - 这个插件负责管理员登录认证
 * - 支持防暴力破解锁定机制
 * - 继承自PluginBase，获得标准接口
 * - 保持向后兼容：保留全局 adminAuth 对象
 *
 * @version 1.0.0
 * @date 2026-05-31
 */

class AuthPlugin extends PluginBase {
  constructor() {
    super({
      name: '认证插件',
      version: '1.0.0',
      description: '负责管理员登录认证和密码管理'
    });

    // ====================================================
    // 常量定义（原 admin-auth.js 第28-33行）
    // ====================================================
    this.DEFAULT_PWD = 'admin2026';
    this.MAX_ATTEMPTS = 5;
    this.LOCK_MINUTES = 5;
    this.STORAGE_PWD_KEY = 'psy_admin_password';
    this.STORAGE_AUTH_KEY = 'psy_admin_authed';
    this.STORAGE_LOCK_KEY = 'psy_admin_lock';

    // ====================================================
    // 状态变量
    // ====================================================
    this.isAuthed = false;
    this.lockTimer = null;

    // ====================================================
    // 向后兼容：保留全局 adminAuth 对象
    // ====================================================
    this._setupGlobalAdapter();
  }

  /**
   * 设置全局适配器（向后兼容）
   *
   * 大白话：创建一个全局 adminAuth 对象，让旧代码可以继续调用 adminAuth.login() 等函数
   */
  _setupGlobalAdapter() {
    const self = this;

    // 创建全局 adminAuth 对象（兼容旧代码）
    window.adminAuth = {
      /**
       * 初始化认证模块（兼容 adminAuth.init()）
       */
      init: function () {
        return self.init.bind(self)();
      },

      /**
       * 登录（兼容 adminAuth.login()）
       */
      login: function () {
        return self.login.bind(self)();
      },

      /**
       * 修改密码（兼容 adminAuth.changePassword()）
       */
      changePassword: function (oldPwd, newPwd) {
        return self.changePassword.bind(self)(oldPwd, newPwd);
      },

      /**
       * 退出登录（兼容 adminAuth.logout()）
       */
      logout: function () {
        return self.logout.bind(self)();
      }
    };

    console.log('✅ 全局 adminAuth 对象已创建（向后兼容）');
  }

  /**
   * 初始化逻辑（对应原 adminAuth.init()）
   *
   * 大白话：检查用户是否已经登录，如果已经登录就直接进入后台；
   * 如果没有登录，就显示登录界面，并绑定回车键提交
   */
  async onInit() {
    console.log('🚀 认证插件开始初始化...');

    try {
      // 检查是否已认证（原第55行：var isAuthed = sessionStorage.getItem(STORAGE_AUTH_KEY) === '1'）
      // 改造：使用 Adapter.storage.getSession() 替代 sessionStorage.getItem()
      const isAuthed = Adapter.storage.getSession(this.STORAGE_AUTH_KEY) === '1';

      // 检查是否锁定（原第56行：var isLocked = checkLock()）
      const isLocked = this.checkLock();

      // 如果已认证且未锁定，直接进入后台
      if (isAuthed && !isLocked) {
        this.grantAccess();
      } else if (isLocked) {
        // 如果已锁定，显示锁定状态
        const remaining = this.getLockRemaining();
        this.showLockState(remaining);
      }

      // 绑定回车键（原第64-72行）
      const pwdInput = document.getElementById('authPassword');
      if (pwdInput) {
        pwdInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            // 兼容旧代码：调用全局 adminAuth.login()
            if (window.adminAuth && typeof window.adminAuth.login === 'function') {
              window.adminAuth.login();
            } else {
              this.login();
            }
          }
        });

        // 自动聚焦（原第74-76行）
        if (!isAuthed) {
          pwdInput.focus();
        }
      }

      console.log('✅ 认证插件初始化完成');

      // 触发事件（插件间通信）
      window.EventHub.emit('auth-initialized', {
        isAuthed: this.isAuthed,
        isLocked: isLocked,
        timestamp: Date.now()
      });
    } catch (error) {
      Adapter.logger.error('认证插件初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行逻辑（插件标准接口）
   *
   * @param {object} params - 执行参数
   * @param {string} params.action - 执行动作：login、logout、changePassword
   * @param {string} [params.oldPwd] - 原密码（changePassword时用）
   * @param {string} [params.newPwd] - 新密码（changePassword时用）
   */
  async onExecute(params = {}) {
    console.log('🎯 认证插件开始执行...', params);

    try {
      switch (params.action) {
        case 'login':
          return await this.login();

        case 'logout':
          return await this.logout();

        case 'changePassword':
          if (!params.oldPwd || !params.newPwd) {
            throw new Error('缺少必要参数：oldPwd 或 newPwd');
          }
          return this.changePassword(params.oldPwd, params.newPwd);

        default:
          throw new Error(`未知动作: ${params.action}`);
      }
    } catch (error) {
      Adapter.logger.error('认证插件执行失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取密码（对应原 getPassword() 函数，第83-85行）
   *
   * 大白话：从存储中获取管理员密码，如果还没有设置过密码，就使用默认密码
   * @returns {string} 当前密码
   */
  getPassword() {
    // 原代码：return localStorage.getItem(STORAGE_PWD_KEY) || DEFAULT_PWD;
    // 改造：使用 Adapter.storage.get() 替代 localStorage.getItem()
    return Adapter.storage.get(this.STORAGE_PWD_KEY) || this.DEFAULT_PWD;
  }

  /**
   * 登录（对应原 adminAuth.login() 函数，第93-150行）
   *
   * 大白话：验证用户输入的密码是否正确，
   * 如果正确就进入后台，如果错误就记录失败次数，失败次数过多就锁定账户
   * @returns {object} 登录结果 {success: boolean, error?: string}
   */
  async login() {
    // 获取DOM元素（原第94-96行）
    const errorEl = document.getElementById('authError');
    const attemptsEl = document.getElementById('authAttempts');
    const pwdInput = document.getElementById('authPassword');

    // 清空错误信息（原第97-98行）
    if (errorEl) {
      errorEl.textContent = '';
    }
    if (attemptsEl) {
      attemptsEl.textContent = '';
    }

    // 检查锁定状态（原第101-105行）
    if (this.checkLock()) {
      const remaining = this.getLockRemaining();
      if (errorEl) {
        errorEl.textContent = '账户已锁定，请 ' + remaining + ' 后再试';
      }
      return { success: false, error: '账户已锁定' };
    }

    // 获取用户输入的密码（原第107-112行）
    const inputPwd = (pwdInput.value || '').trim();
    if (!inputPwd) {
      if (errorEl) {
        errorEl.textContent = '请输入密码';
      }
      if (pwdInput) {
        pwdInput.focus();
      }
      return { success: false, error: '请输入密码' };
    }

    // 验证密码（原第114-149行）
    const correctPwd = this.getPassword();
    if (inputPwd === correctPwd) {
      // 密码正确：清除错误计数，设置认证状态，进入后台
      // 原代码：sessionStorage.removeItem(STORAGE_LOCK_KEY)
      // 改造：使用 Adapter.storage.removeSession()
      Adapter.storage.removeSession(this.STORAGE_LOCK_KEY);

      // 原代码：sessionStorage.setItem(STORAGE_AUTH_KEY, '1')
      // 改造：使用 Adapter.storage.setSession()
      Adapter.storage.setSession(this.STORAGE_AUTH_KEY, '1');

      this.isAuthed = true;
      this.grantAccess();

      // 触发事件
      window.EventHub.emit('auth-login-success', {
        timestamp: Date.now()
      });

      return { success: true, message: '登录成功' };
    } else {
      // 密码错误：记录失败次数
      // 原代码：var failCount = getFailCount() + 1
      // 改造：使用 this.getFailCount()
      const failCount = this.getFailCount() + 1;
      const lockInfo = { count: failCount, time: Date.now() };

      // 原代码：sessionStorage.setItem(STORAGE_LOCK_KEY, JSON.stringify(lockInfo))
      // 改造：使用 Adapter.storage.setSession()
      Adapter.storage.setSession(this.STORAGE_LOCK_KEY, JSON.stringify(lockInfo));

      if (failCount >= this.MAX_ATTEMPTS) {
        // 失败次数达到上限：锁定账户
        const remaining = this.getLockRemaining();
        if (errorEl) {
          errorEl.textContent = '密码错误次数过多，已锁定 ' + remaining;
        }
        if (attemptsEl) {
          attemptsEl.textContent = '';
        }
        if (pwdInput) {
          pwdInput.disabled = true;
        }

        // 自动解锁检查（原第132-141行）
        const lockUntil = lockInfo.time + this.LOCK_MINUTES * 60 * 1000;
        const waitMs = lockUntil - Date.now();

        this.lockTimer = setTimeout(() => {
          // 原代码：sessionStorage.removeItem(STORAGE_LOCK_KEY)
          // 改造：使用 Adapter.storage.removeSession()
          Adapter.storage.removeSession(this.STORAGE_LOCK_KEY);
          if (pwdInput) {
            pwdInput.disabled = false;
          }
          if (pwdInput) {
            pwdInput.value = '';
          }
          if (pwdInput) {
            pwdInput.focus();
          }
          if (errorEl) {
            errorEl.textContent = '锁定已解除，请重新输入密码';
          }
          if (attemptsEl) {
            attemptsEl.textContent = '';
          }
        }, waitMs);

        // 触发事件
        window.EventHub.emit('auth-login-failed', {
          reason: 'locked',
          remaining: remaining,
          timestamp: Date.now()
        });

        return { success: false, error: '账户已锁定' };
      } else {
        // 失败次数未达上限：提示剩余次数
        const left = this.MAX_ATTEMPTS - failCount;
        if (errorEl) {
          errorEl.textContent = '密码错误';
        }
        if (attemptsEl) {
          attemptsEl.textContent = '剩余尝试次数：' + left + ' 次';
        }
        if (pwdInput) {
          pwdInput.value = '';
        }
        if (pwdInput) {
          pwdInput.focus();
        }

        // 触发事件
        window.EventHub.emit('auth-login-failed', {
          reason: 'wrong_password',
          remainingAttempts: left,
          timestamp: Date.now()
        });

        return { success: false, error: '密码错误' };
      }
    }
  }

  /**
   * 获取失败次数（对应原 getFailCount() 函数，第156-159行）
   *
   * 大白话：从存储中读取之前的登录失败次数
   * @returns {number} 失败次数
   */
  getFailCount() {
    // 原代码：var lockInfo = JSON.parse(sessionStorage.getItem(STORAGE_LOCK_KEY) || '{}')
    // 改造：使用 Adapter.storage.getSession()
    const lockInfo = JSON.parse(Adapter.storage.getSession(this.STORAGE_LOCK_KEY) || '{}');
    return lockInfo.count || 0;
  }

  /**
   * 检查锁定状态（对应原 checkLock() 函数，第161-173行）
   *
   * 大白话：检查用户是否因为多次输入错误密码而被锁定
   * @returns {boolean} 是否锁定
   */
  checkLock() {
    const failCount = this.getFailCount();
    if (failCount >= this.MAX_ATTEMPTS) {
      // 原代码：var lockInfo = JSON.parse(sessionStorage.getItem(STORAGE_LOCK_KEY) || '{}')
      // 改造：使用 Adapter.storage.getSession()
      const lockInfo = JSON.parse(Adapter.storage.getSession(this.STORAGE_LOCK_KEY) || '{}');
      const lockUntil = lockInfo.time + this.LOCK_MINUTES * 60 * 1000;

      if (Date.now() < lockUntil) {
        return true;
      }

      // 锁定已过期，自动清除
      // 原代码：sessionStorage.removeItem(STORAGE_LOCK_KEY)
      // 改造：使用 Adapter.storage.removeSession()
      Adapter.storage.removeSession(this.STORAGE_LOCK_KEY);
    }
    return false;
  }

  /**
   * 获取锁定剩余时间（对应原 getLockRemaining() 函数，第175-184行）
   *
   * 大白话：计算账户还有多长时间解锁
   * @returns {string} 剩余时间（如 "5 分 30 秒"）
   */
  getLockRemaining() {
    // 原代码：var lockInfo = JSON.parse(sessionStorage.getItem(STORAGE_LOCK_KEY) || '{}')
    // 改造：使用 Adapter.storage.getSession()
    const lockInfo = JSON.parse(Adapter.storage.getSession(this.STORAGE_LOCK_KEY) || '{}');
    const lockUntil = lockInfo.time + this.LOCK_MINUTES * 60 * 1000;
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

  /**
   * 显示锁定状态（对应原 showLockState() 函数，第186-209行）
   *
   * 大白话：当账户被锁定时，显示锁定界面，并定时刷新剩余时间
   * @param {string} remaining - 剩余时间
   */
  showLockState(remaining) {
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

    // 定时刷新剩余时间（原第195-208行）
    this.lockTimer = setInterval(() => {
      if (!this.checkLock()) {
        clearInterval(this.lockTimer);
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
        errorEl.textContent = '账户已锁定，请 ' + this.getLockRemaining() + ' 后再试';
      }
    }, 1000);
  }

  /**
   * 认证通过（对应原 grantAccess() 函数，第215-226行）
   *
   * 大白话：用户登录成功后，隐藏登录界面，显示后台管理界面
   */
  grantAccess() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
    // 确保主内容区可见（覆盖 HTML 中的内联 display:none）
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.style.display = 'block';
    }
    document.body.classList.add('authenticated');

    this.isAuthed = true;

    // 认证通过后初始化页面（如果尚未初始化）（原第220-225行）
    if (!window._adminInitialized) {
      window._adminInitialized = true;
      if (typeof switchSection === 'function') {
        switchSection('dashboard');
      }
    }

    // 触发事件
    window.EventHub.emit('auth-granted', {
      timestamp: Date.now()
    });
  }

  /**
   * 修改密码（对应原 adminAuth.changePassword() 函数，第240-246行）
   *
   * 大白话：允许用户修改登录密码，需要验证原密码，新密码至少6位
   * @param {string} oldPwd - 原密码
   * @param {string} newPwd - 新密码
   * @returns {{ok: boolean, msg: string}} 操作结果
   */
  changePassword(oldPwd, newPwd) {
    // 验证原密码（原第241行）
    if (oldPwd !== this.getPassword()) {
      return { ok: false, msg: '原密码不正确' };
    }

    // 验证新密码长度（原第242行）
    if (!newPwd || newPwd.length < 6) {
      return { ok: false, msg: '新密码至少 6 位' };
    }

    // 验证新密码不能与原密码相同（原第243行）
    if (newPwd === oldPwd) {
      return { ok: false, msg: '新密码不能与原密码相同' };
    }

    // 保存新密码（原第244行）
    // 原代码：localStorage.setItem(STORAGE_PWD_KEY, newPwd)
    // 改造：使用 Adapter.storage.set()
    Adapter.storage.set(this.STORAGE_PWD_KEY, newPwd);

    // 触发事件
    window.EventHub.emit('auth-password-changed', {
      timestamp: Date.now()
    });

    return { ok: true, msg: '密码修改成功' };
  }

  /**
   * 退出登录（对应原 adminAuth.logout() 函数，第254-272行）
   *
   * 大白话：清除用户的登录状态，回到登录界面
   * @returns {object} 退出结果
   */
  async logout() {
    // 清除认证状态（原第255-256行）
    // 原代码：sessionStorage.removeItem(STORAGE_AUTH_KEY)
    // 改造：使用 Adapter.storage.removeSession()
    Adapter.storage.removeSession(this.STORAGE_AUTH_KEY);
    Adapter.storage.removeSession(this.STORAGE_LOCK_KEY);

    // 显示登录界面（原第257-259行）
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
    }
    document.body.classList.remove('authenticated');

    // 重置表单（原第260-271行）
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

    this.isAuthed = false;

    // 触发事件
    window.EventHub.emit('auth-logout', {
      timestamp: Date.now()
    });

    return { success: true, message: '已退出登录' };
  }

  /**
   * 销毁逻辑（插件标准接口）
   *
   * 大白话：清理定时器、事件监听等资源
   */
  onDestroy() {
    console.log('🗑️ 认证插件开始销毁...');

    // 清理定时器（原第132-141行、第195-208行）
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      clearInterval(this.lockTimer);
      this.lockTimer = null;
    }

    // 清理事件监听（如果需要）
    const pwdInput = document.getElementById('authPassword');
    if (pwdInput) {
      // 注意：这里需要保存事件处理函数的引用才能移除
      // 为简化，这里暂不实现
    }

    // 清理全局对象
    if (window.adminAuth) {
      delete window.adminAuth;
    }

    console.log('✅ 认证插件销毁完成');
  }
}

// 导出插件类
window.AuthPlugin = AuthPlugin;

console.log('[AuthPlugin] v1.0.0 已加载');
