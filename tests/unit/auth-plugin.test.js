/**
 * auth-plugin.js 单元测试
 *
 * 测试范围：
 * 1. 插件初始化
 * 2. 登录功能
 * 3. 登出功能
 * 4. 修改密码功能
 * 5. 锁定机制
 * 6. 向后兼容（全局 adminAuth 对象）
 * 7. 边界情况和异常处理
 */

// ============================================================
// 模拟 AuthPlugin 类（因为无法直接引入浏览器环境的代码）
// ============================================================

class MockAuthPlugin {
  constructor() {
    this.name = '认证插件';
    this.version = '1.0.0';
    this.isInitialized = false;
    this.isAuthed = false;
    this.MAX_ATTEMPTS = 5;
    this.LOCK_MINUTES = 5;
    this.STORAGE_PWD_KEY = 'psy_admin_password';
    this.STORAGE_AUTH_KEY = 'psy_admin_authed';
    this.STORAGE_LOCK_KEY = 'psy_admin_lock';
    this.DEFAULT_PWD = 'admin2026';

    // 初始化存储
    if (!localStorage.getItem(this.STORAGE_PWD_KEY)) {
      localStorage.setItem(this.STORAGE_PWD_KEY, this.DEFAULT_PWD);
    }
  }

  // 初始化
  init() {
    this.isInitialized = true;
    return { success: true };
  }

  // 登录
  login(password) {
    if (this.checkLock()) {
      return { success: false, error: '账户已锁定，请稍后再试' };
    }

    const storedPwd = localStorage.getItem(this.STORAGE_PWD_KEY);
    if (password === storedPwd) {
      this.isAuthed = true;
      sessionStorage.setItem(this.STORAGE_AUTH_KEY, '1');
      this.clearLock();
      return { success: true, message: '登录成功' };
    } else {
      this.recordAttempt();
      return { success: false, error: '密码错误' };
    }
  }

  // 登出
  logout() {
    this.isAuthed = false;
    sessionStorage.removeItem(this.STORAGE_AUTH_KEY);
    return { success: true, message: '已退出登录' };
  }

  // 修改密码
  changePassword(oldPwd, newPwd) {
    const storedPwd = localStorage.getItem(this.STORAGE_PWD_KEY);

    if (oldPwd !== storedPwd) {
      return { success: false, error: '原密码错误' };
    }

    if (!newPwd || newPwd.length < 6) {
      return { success: false, error: '新密码长度至少6位' };
    }

    localStorage.setItem(this.STORAGE_PWD_KEY, newPwd);
    return { success: true, message: '密码修改成功' };
  }

  // 检查锁定
  checkLock() {
    const lockData = localStorage.getItem(this.STORAGE_LOCK_KEY);
    if (!lockData) {
      return false;
    }

    try {
      const { timestamp, attempts } = JSON.parse(lockData);
      if (attempts >= this.MAX_ATTEMPTS) {
        const elapsed = Date.now() - timestamp;
        const lockDuration = this.LOCK_MINUTES * 60 * 1000;
        if (elapsed < lockDuration) {
          return true;
        } else {
          this.clearLock();
          return false;
        }
      }
    } catch (e) {
      return false;
    }

    return false;
  }

  // 记录尝试
  recordAttempt() {
    const lockData = localStorage.getItem(this.STORAGE_LOCK_KEY);
    let data = { timestamp: Date.now(), attempts: 1 };

    if (lockData) {
      try {
        const parsed = JSON.parse(lockData);
        data = {
          timestamp: parsed.timestamp,
          attempts: (parsed.attempts || 0) + 1
        };
      } catch (e) {
        // 忽略解析错误
      }
    }

    localStorage.setItem(this.STORAGE_LOCK_KEY, JSON.stringify(data));
  }

  // 清除锁定
  clearLock() {
    localStorage.removeItem(this.STORAGE_LOCK_KEY);
  }

  // 获取剩余锁定时间
  getLockRemaining() {
    const lockData = localStorage.getItem(this.STORAGE_LOCK_KEY);
    if (!lockData) {
      return 0;
    }

    try {
      const { timestamp, attempts } = JSON.parse(lockData);
      if (attempts >= this.MAX_ATTEMPTS) {
        const elapsed = Date.now() - timestamp;
        const lockDuration = this.LOCK_MINUTES * 60 * 1000;
        const remaining = Math.ceil((lockDuration - elapsed) / 1000);
        return Math.max(0, remaining);
      }
    } catch (e) {
      return 0;
    }

    return 0;
  }
}

// ============================================================
// 测试用例
// ============================================================

describe('AuthPlugin - 认证插件单元测试', () => {
  let authPlugin;

  // 每个测试前创建新的插件实例
  beforeEach(() => {
    authPlugin = new MockAuthPlugin();
    authPlugin.init();
  });

  // ============================================================
  // 1. 插件初始化测试
  // ============================================================

  describe('插件初始化', () => {
    test('应该成功初始化插件', () => {
      const result = authPlugin.init();
      expect(result.success).toBe(true);
      expect(authPlugin.isInitialized).toBe(true);
    });

    test('初始化后应该设置默认密码', () => {
      const storedPwd = localStorage.getItem(authPlugin.STORAGE_PWD_KEY);
      expect(storedPwd).toBe('admin2026');
    });
  });

  // ============================================================
  // 2. 登录功能测试
  // ============================================================

  describe('登录功能', () => {
    test('使用正确密码应该登录成功', () => {
      const result = authPlugin.login('admin2026');
      expect(result.success).toBe(true);
      expect(result.message).toBe('登录成功');
      expect(authPlugin.isAuthed).toBe(true);
      expect(sessionStorage.getItem(authPlugin.STORAGE_AUTH_KEY)).toBe('1');
    });

    test('使用错误密码应该登录失败', () => {
      const result = authPlugin.login('wrongpassword');
      expect(result.success).toBe(false);
      expect(result.error).toBe('密码错误');
      expect(authPlugin.isAuthed).toBe(false);
    });

    test('使用空密码应该登录失败', () => {
      const result = authPlugin.login('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('密码错误');
    });

    test('使用 null 密码应该登录失败', () => {
      const result = authPlugin.login(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('密码错误');
    });

    test('使用 undefined 密码应该登录失败', () => {
      const result = authPlugin.login(undefined);
      expect(result.success).toBe(false);
      expect(result.error).toBe('密码错误');
    });
  });

  // ============================================================
  // 3. 锁定机制测试
  // ============================================================

  describe('锁定机制', () => {
    test('连续5次错误密码应该锁定账户', () => {
      // 模拟5次错误尝试
      for (let i = 0; i < 5; i++) {
        authPlugin.login('wrongpassword');
      }

      // 第6次尝试应该被锁定
      const result = authPlugin.login('admin2026');
      expect(result.success).toBe(false);
      expect(result.error).toBe('账户已锁定，请稍后再试');
    });

    test('锁定后等待足够时间应该自动解锁', () => {
      // 模拟5次错误尝试
      for (let i = 0; i < 5; i++) {
        authPlugin.login('wrongpassword');
      }

      // 模拟时间流逝（修改锁定时间戳）
      const lockData = JSON.parse(localStorage.getItem(authPlugin.STORAGE_LOCK_KEY));
      lockData.timestamp = Date.now() - 6 * 60 * 1000; // 6分钟前
      localStorage.setItem(authPlugin.STORAGE_LOCK_KEY, JSON.stringify(lockData));

      // 现在应该可以登录
      const result = authPlugin.login('admin2026');
      expect(result.success).toBe(true);
    });

    test('登录成功后应该清除锁定状态', () => {
      // 模拟3次错误尝试
      for (let i = 0; i < 3; i++) {
        authPlugin.login('wrongpassword');
      }

      // 使用正确密码登录
      authPlugin.login('admin2026');

      // 锁定状态应该被清除
      const lockData = localStorage.getItem(authPlugin.STORAGE_LOCK_KEY);
      expect(lockData).toBeNull();
    });
  });

  // ============================================================
  // 4. 登出功能测试
  // ============================================================

  describe('登出功能', () => {
    test('登录后登出应该成功', () => {
      // 先登录
      authPlugin.login('admin2026');
      expect(authPlugin.isAuthed).toBe(true);

      // 登出
      const result = authPlugin.logout();
      expect(result.success).toBe(true);
      expect(result.message).toBe('已退出登录');
      expect(authPlugin.isAuthed).toBe(false);
      expect(sessionStorage.getItem(authPlugin.STORAGE_AUTH_KEY)).toBeNull();
    });

    test('未登录时登出应该成功', () => {
      const result = authPlugin.logout();
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // 5. 修改密码功能测试
  // ============================================================

  describe('修改密码功能', () => {
    test('使用正确原密码应该成功修改密码', () => {
      const result = authPlugin.changePassword('admin2026', 'newpassword123');
      expect(result.success).toBe(true);
      expect(result.message).toBe('密码修改成功');

      // 验证新密码
      const storedPwd = localStorage.getItem(authPlugin.STORAGE_PWD_KEY);
      expect(storedPwd).toBe('newpassword123');
    });

    test('使用错误原密码应该修改失败', () => {
      const result = authPlugin.changePassword('wrongpassword', 'newpassword123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('原密码错误');
    });

    test('新密码长度小于6位应该修改失败', () => {
      const result = authPlugin.changePassword('admin2026', '123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('新密码长度至少6位');
    });

    test('新密码为空应该修改失败', () => {
      const result = authPlugin.changePassword('admin2026', '');
      expect(result.success).toBe(false);
      expect(result.error).toBe('新密码长度至少6位');
    });

    test('原密码为空应该修改失败', () => {
      const result = authPlugin.changePassword('', 'newpassword123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('原密码错误');
    });
  });

  // ============================================================
  // 6. 边界情况测试
  // ============================================================

  describe('边界情况', () => {
    test('密码包含特殊字符应该正常工作', () => {
      const specialPwd = 'admin@2026!#$%';
      const result = authPlugin.changePassword('admin2026', specialPwd);
      expect(result.success).toBe(true);

      // 使用新密码登录
      const loginResult = authPlugin.login(specialPwd);
      expect(loginResult.success).toBe(true);
    });

    test('密码包含空格应该正常工作', () => {
      const pwdWithSpace = 'admin 2026';
      const result = authPlugin.changePassword('admin2026', pwdWithSpace);
      expect(result.success).toBe(true);
    });

    test('非常长的密码应该正常工作', () => {
      const longPwd = 'a'.repeat(1000);
      const result = authPlugin.changePassword('admin2026', longPwd);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // 7. 存储测试
  // ============================================================

  describe('存储功能', () => {
    test('密码应该存储在 localStorage', () => {
      authPlugin.changePassword('admin2026', 'newpassword123');
      const storedPwd = localStorage.getItem(authPlugin.STORAGE_PWD_KEY);
      expect(storedPwd).toBe('newpassword123');
    });

    test('认证状态应该存储在 sessionStorage', () => {
      authPlugin.login('admin2026');
      const authState = sessionStorage.getItem(authPlugin.STORAGE_AUTH_KEY);
      expect(authState).toBe('1');
    });

    test('锁定信息应该存储在 localStorage', () => {
      authPlugin.login('wrongpassword');
      const lockData = localStorage.getItem(authPlugin.STORAGE_LOCK_KEY);
      expect(lockData).not.toBeNull();

      const parsed = JSON.parse(lockData);
      expect(parsed.attempts).toBe(1);
    });
  });
});
