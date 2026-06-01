/**
 * dual-adapter.js - 双端适配器（翻译官）
 *
 * 大白话解释：
 * - 就像一个翻译官，屏蔽H5和小程序的运行环境差异
 * - H5端用浏览器API（localStorage、fetch等）
 * - 小程序端用微信API（wx.setStorageSync、wx.request等）
 * - 插件代码只需要写一次，适配器会自动适配两端
 *
 * @version 1.0.0
 * @date 2026-05-27
 */

class DualAdapter {
  /**
   * 构造函数 - 自动检测当前运行环境
   */
  constructor() {
    // 自动检测当前运行环境
    this.platform = this.detectPlatform();
    this.isDev = this.checkDevMode();

    console.log(`🌐 检测到运行环境: ${this.platform}`);
    if (this.isDev) {
      console.log('   🔧 开发模式已开启');
    }
  }

  /**
   * 检测当前运行环境
   * 大白话：判断是H5网页还是微信小程序
   *
   * @returns {string} 'miniprogram' | 'h5' | 'unknown'
   */
  detectPlatform() {
    // 小程序环境有 `wx` 对象
    if (typeof wx !== 'undefined' && wx.getSystemInfo) {
      return 'miniprogram';
    }

    // H5环境有 `window` 和 `document` 对象
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      return 'h5';
    }

    // 其他环境（比如Node.js）
    return 'unknown';
  }

  /**
   * 检测是否为开发模式
   * 大白话：判断是否开启了调试模式
   */
  checkDevMode() {
    if (this.platform === 'miniprogram') {
      // 小程序：检查是否开启了调试
      try {
        const accountInfo = wx.getAccountInfoSync();
        return accountInfo.miniProgram.envVersion === 'develop';
      } catch (e) {
        return false;
      }
    } else {
      // H5：检查URL是否有 debug=1 参数
      if (typeof window !== 'undefined' && window.location) {
        return window.location.search.includes('debug=1');
      }
      return false;
    }
  }

  /**
   * 数据存储适配器
   * 大白话：统一H5的localStorage和小程序的wx.setStorageSync
   */
  get storage() {
    if (this.platform === 'miniprogram') {
      // 小程序端：用微信的存储API
      return {
        /**
         * 读取数据
         * @param {string} key - 键名
         * @returns {*} 存储的值（自动JSON.parse）
         */
        get(key) {
          try {
            const data = wx.getStorageSync(key);
            return data || null;
          } catch (e) {
            console.error('[Adapter] 读取存储失败:', key, e);
            return null;
          }
        },

        /**
         * 写入数据
         * @param {string} key - 键名
         * @param {*} value - 值（自动JSON.stringify）
         */
        set(key, value) {
          try {
            wx.setStorageSync(key, value);
          } catch (e) {
            console.error('[Adapter] 写入存储失败:', key, e);
          }
        },

        /**
         * 删除数据
         * @param {string} key - 键名
         */
        remove(key) {
          try {
            wx.removeStorageSync(key);
          } catch (e) {
            console.error('[Adapter] 删除存储失败:', key, e);
          }
        },

        /**
         * 清空所有数据
         */
        clear() {
          try {
            wx.clearStorageSync();
          } catch (e) {
            console.error('[Adapter] 清空存储失败:', e);
          }
        },

        /**
         * 读取会话数据（临时存储，关闭小程序后失效）
         * 注意：小程序没有真正的 sessionStorage，这里用内存存储模拟
         */
        getSession(key) {
          try {
            // 小程序用内存存储模拟 session
            if (!this._session) {
              this._session = {};
            }
            return this._session[key] || null;
          } catch (e) {
            console.error('[Adapter] 读取会话存储失败:', key, e);
            return null;
          }
        },

        /**
         * 写入会话数据
         */
        setSession(key, value) {
          try {
            if (!this._session) {
              this._session = {};
            }
            this._session[key] = value;
          } catch (e) {
            console.error('[Adapter] 写入会话存储失败:', key, e);
          }
        },

        /**
         * 删除会话数据
         */
        removeSession(key) {
          try {
            if (this._session) {
              delete this._session[key];
            }
          } catch (e) {
            console.error('[Adapter] 删除会话存储失败:', key, e);
          }
        }
      };
    } else {
      // H5端：用浏览器的localStorage + sessionStorage
      return {
        /**
         * 读取数据
         */
        get(key) {
          try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
          } catch (e) {
            console.error('[Adapter] 读取存储失败:', key, e);
            return null;
          }
        },

        /**
         * 写入数据
         */
        set(key, value) {
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch (e) {
            console.error('[Adapter] 写入存储失败:', key, e);
          }
        },

        /**
         * 删除数据
         */
        remove(key) {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            console.error('[Adapter] 删除存储失败:', key, e);
          }
        },

        /**
         * 清空所有数据
         */
        clear() {
          try {
            localStorage.clear();
          } catch (e) {
            console.error('[Adapter] 清空存储失败:', e);
          }
        },

        /**
         * 读取会话数据（sessionStorage）
         * 大白话：临时存储，关闭浏览器标签页后自动清除
         */
        getSession(key) {
          try {
            const data = sessionStorage.getItem(key);
            return data ? JSON.parse(data) : null;
          } catch (e) {
            console.error('[Adapter] 读取会话存储失败:', key, e);
            return null;
          }
        },

        /**
         * 写入会话数据
         */
        setSession(key, value) {
          try {
            sessionStorage.setItem(key, JSON.stringify(value));
          } catch (e) {
            console.error('[Adapter] 写入会话存储失败:', key, e);
          }
        },

        /**
         * 删除会话数据
         */
        removeSession(key) {
          try {
            sessionStorage.removeItem(key);
          } catch (e) {
            console.error('[Adapter] 删除会话存储失败:', key, e);
          }
        }
      };
    }
  }

  /**
   * 网络请求适配器
   * 大白话：统一H5的fetch和小程序的wx.request
   */
  get http() {
    if (this.platform === 'miniprogram') {
      // 小程序端：用微信的请求API
      return {
        /**
         * GET 请求
         * @param {string} url - 请求地址
         * @param {object} params - URL参数
         * @returns {Promise<object>} 响应数据
         */
        async get(url, params = {}) {
          return new Promise((resolve, reject) => {
            // 拼接URL参数
            const query = Object.keys(params)
              .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
              .join('&');
            const fullUrl = query ? `${url}?${query}` : url;

            wx.request({
              url: fullUrl,
              method: 'GET',
              header: { 'content-type': 'application/json' },
              success: (res) => {
                if (res.statusCode === 200) {
                  resolve(res.data);
                } else {
                  reject(new Error(`HTTP ${res.statusCode}`));
                }
              },
              fail: (err) => reject(err)
            });
          });
        },

        /**
         * POST 请求
         * @param {string} url - 请求地址
         * @param {object} data - 请求数据
         * @returns {Promise<object>} 响应数据
         */
        async post(url, data = {}) {
          return new Promise((resolve, reject) => {
            wx.request({
              url: url,
              method: 'POST',
              header: { 'content-type': 'application/json' },
              data: data,
              success: (res) => {
                if (res.statusCode === 200) {
                  resolve(res.data);
                } else {
                  reject(new Error(`HTTP ${res.statusCode}`));
                }
              },
              fail: (err) => reject(err)
            });
          });
        },

        /**
         * PUT 请求
         */
        async put(url, data = {}) {
          return new Promise((resolve, reject) => {
            wx.request({
              url: url,
              method: 'PUT',
              header: { 'content-type': 'application/json' },
              data: data,
              success: (res) => {
                if (res.statusCode === 200) {
                  resolve(res.data);
                } else {
                  reject(new Error(`HTTP ${res.statusCode}`));
                }
              },
              fail: (err) => reject(err)
            });
          });
        },

        /**
         * DELETE 请求
         */
        async delete(url, params = {}) {
          return new Promise((resolve, reject) => {
            const query = Object.keys(params)
              .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
              .join('&');
            const fullUrl = query ? `${url}?${query}` : url;

            wx.request({
              url: fullUrl,
              method: 'DELETE',
              header: { 'content-type': 'application/json' },
              success: (res) => {
                if (res.statusCode === 200) {
                  resolve(res.data);
                } else {
                  reject(new Error(`HTTP ${res.statusCode}`));
                }
              },
              fail: (err) => reject(err)
            });
          });
        }
      };
    } else {
      // H5端：用浏览器的fetch API
      return {
        /**
         * GET 请求
         */
        async get(url, params = {}) {
          try {
            const query = new URLSearchParams(params).toString();
            const fullUrl = query ? `${url}?${query}` : url;

            const response = await fetch(fullUrl, {
              method: 'GET',
              headers: { 'content-type': 'application/json' }
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
          } catch (e) {
            console.error('[Adapter] GET请求失败:', url, e);
            throw e;
          }
        },

        /**
         * POST 请求
         */
        async post(url, data = {}) {
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(data)
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
          } catch (e) {
            console.error('[Adapter] POST请求失败:', url, e);
            throw e;
          }
        },

        /**
         * PUT 请求
         */
        async put(url, data = {}) {
          try {
            const response = await fetch(url, {
              method: 'PUT',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(data)
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
          } catch (e) {
            console.error('[Adapter] PUT请求失败:', url, e);
            throw e;
          }
        },

        /**
         * DELETE 请求
         */
        async delete(url, params = {}) {
          try {
            const query = new URLSearchParams(params).toString();
            const fullUrl = query ? `${url}?${query}` : url;

            const response = await fetch(fullUrl, {
              method: 'DELETE',
              headers: { 'content-type': 'application/json' }
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
          } catch (e) {
            console.error('[Adapter] DELETE请求失败:', url, e);
            throw e;
          }
        }
      };
    }
  }

  /**
   * UI弹窗适配器
   * 大白话：统一H5的alert/confirm和小程序的wx.showModal
   */
  get ui() {
    if (this.platform === 'miniprogram') {
      // 小程序端：用微信的弹窗API
      return {
        /**
         * 显示提示框（只有确定按钮）
         * @param {string} message - 提示内容
         * @returns {Promise<void>}
         */
        async alert(message) {
          return new Promise((resolve) => {
            wx.showModal({
              title: '提示',
              content: message,
              showCancel: false,
              success: () => resolve()
            });
          });
        },

        /**
         * 显示确认框（有确定和取消按钮）
         * @param {string} message - 确认内容
         * @returns {Promise<boolean>} 用户是否点击确定
         */
        async confirm(message) {
          return new Promise((resolve) => {
            wx.showModal({
              title: '确认',
              content: message,
              success: (res) => resolve(res.confirm)
            });
          });
        },

        /**
         * 显示Toast提示
         * @param {string} message - 提示内容
         * @param {string} icon - 图标类型（success/error/loading/none）
         */
        toast(message, icon = 'none') {
          wx.showToast({
            title: message,
            icon: icon,
            duration: 2000
          });
        },

        /**
         * 显示加载中
         * @param {string} title - 加载提示文字
         */
        showLoading(title = '加载中...') {
          wx.showLoading({
            title: title,
            mask: true
          });
        },

        /**
         * 隐藏加载中
         */
        hideLoading() {
          wx.hideLoading();
        }
      };
    } else {
      // H5端：用浏览器的弹窗
      return {
        /**
         * 显示提示框
         */
        async alert(message) {
          return new Promise((resolve) => {
            window.alert(message);
            resolve();
          });
        },

        /**
         * 显示确认框
         */
        async confirm(message) {
          return new Promise((resolve) => {
            const result = window.confirm(message);
            resolve(result);
          });
        },

        /**
         * 显示Toast提示
         * @param {string} message - 提示内容
         * @param {string} type - 类型（info/success/warning/error）
         */
        toast(message, type = 'info') {
          // 使用现有的showToast函数（如果有的话）
          if (typeof showToast === 'function') {
            showToast(message, type);
          } else {
            // 如果没有，用console代替
            const colors = {
              info: '#17a2b8',
              success: '#28a745',
              warning: '#ffc107',
              error: '#dc3545'
            };
            console.log(`%c[Toast] ${message}`, `color: ${colors[type] || colors.info}`);
          }
        },

        /**
         * 显示加载中
         */
        showLoading(title = '加载中...') {
          // 简单的加载提示（可以替换为更好的UI库）
          if (typeof showToast === 'function') {
            showToast(title, 'info');
          } else {
            console.log(`[Loading] ${title}`);
          }
        },

        /**
         * 隐藏加载中
         */
        hideLoading() {
          // 如果有loading，这里可以隐藏
          console.log('[Loading] 隐藏加载');
        }
      };
    }
  }

  /**
   * 日志适配器
   * 大白话：统一H5和小程序的日志输出
   */
  get logger() {
    const isDev = this.isDev;
    const platform = this.platform;

    return {
      /**
       * 普通日志
       */
      log(...args) {
        if (isDev || platform === 'h5') {
          console.log(...args);
        }
      },

      /**
       * 信息日志
       */
      info(...args) {
        if (isDev || platform === 'h5') {
          console.info(...args);
        }
      },

      /**
       * 警告日志
       */
      warn(...args) {
        if (isDev || platform === 'h5') {
          console.warn(...args);
        }
      },

      /**
       * 错误日志
       */
      error(...args) {
        // 错误日志即使在生产环境也输出
        console.error(...args);
      },

      /**
       * 调试日志
       */
      debug(...args) {
        if (isDev) {
          console.debug(...args);
        }
      }
    };
  }
}

// 导出到全局（单例模式，全局只有一个适配器实例）
window.Adapter = new DualAdapter();

console.log('✅ dual-adapter.js 加载完成');
