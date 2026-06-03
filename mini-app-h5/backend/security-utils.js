/**
 * 安全工具函数库 - XSS防护、输入验证、CSRF保护
 * 版本: 1.0.0
 * 创建时间: 2026-06-03
 */

const SecurityUtils = {
  /**
   * HTML实体编码 - 防止XSS攻击
   * @param {string} str - 需要编码的字符串
   * @returns {string} - 编码后的安全字符串
   */
  escapeHtml: function (str) {
    if (str === null || str === undefined) {
      return '';
    }
    if (typeof str !== 'string') {
      str = String(str);
    }

    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };

    return str.replace(/[&<>"'`=\/]/g, function (char) {
      return map[char];
    });
  },

  /**
   * 安全的innerHTML替代方案 - 使用textContent
   * @param {HTMLElement} element - 目标DOM元素
   * @param {string} text - 要设置的文本内容
   */
  safeSetText: function (element, text) {
    if (!element) {
      return;
    }
    element.textContent = this.escapeHtml(text);
  },

  /**
   * 安全的HTML插入 - 仅允许安全的HTML标签
   * @param {HTMLElement} element - 目标DOM元素
   * @param {string} html - 要插入的HTML（会被过滤）
   */
  safeSetHtml: function (element, html) {
    if (!element) {
      return;
    }
    // 简单的HTML过滤 - 仅允许基本格式标签
    const allowedTags = /<(b|i|em|strong|span|br|p|div)(?:\s[^>]*)?>.*?<\/\1>|<br\s*\/?>/gi;
    const filtered = html.replace(/<script[^>]*>.*?<\/script>|<iframe[^>]*>.*?<\/iframe>|on\w+\s*=/gi, '');
    element.innerHTML = filtered;
  },

  /**
   * 生成CSRF Token
   * @returns {string} - CSRF Token
   */
  generateCsrfToken: function () {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  },

  /**
   * 验证CSRF Token
   * @param {string} token - 要验证的token
   * @param {string} storedToken - 存储的token
   * @returns {boolean} - 是否有效
   */
  validateCsrfToken: function (token, storedToken) {
    if (!token || !storedToken) {
      return false;
    }
    return token === storedToken;
  },

  /**
   * 设置CSRF Token到meta标签
   */
  setupCsrfToken: function () {
    let token = sessionStorage.getItem('csrf_token');
    if (!token) {
      token = this.generateCsrfToken();
      sessionStorage.setItem('csrf_token', token);
    }

    let meta = document.querySelector('meta[name="csrf-token"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'csrf-token';
      document.head.appendChild(meta);
    }
    meta.content = token;

    return token;
  },

  /**
   * 为AJAX请求添加CSRF Token
   * @param {Object} headers - 请求头对象
   * @returns {Object} - 添加了CSRF Token的请求头
   */
  addCsrfHeader: function (headers) {
    headers = headers || {};
    const token = sessionStorage.getItem('csrf_token') || this.setupCsrfToken();
    headers['X-CSRF-Token'] = token;
    return headers;
  },

  /**
   * 验证输入是否为安全的字符串
   * @param {*} input - 要验证的输入
   * @param {number} maxLength - 最大长度
   * @returns {boolean} - 是否安全
   */
  isSafeString: function (input, maxLength) {
    maxLength = maxLength || 1000;
    if (typeof input !== 'string') {
      return false;
    }
    if (input.length > maxLength) {
      return false;
    }

    // 检查危险的HTML/JS模式
    const dangerousPatterns = [
      /<script[^>]*>/i,
      /<iframe[^>]*>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /Function\s*\(/i
    ];

    return !dangerousPatterns.some((pattern) => pattern.test(input));
  },

  /**
   * 清理用户输入
   * @param {string} input - 用户输入
   * @param {number} maxLength - 最大长度
   * @returns {string} - 清理后的输入
   */
  sanitizeInput: function (input, maxLength) {
    maxLength = maxLength || 1000;
    if (typeof input !== 'string') {
      return '';
    }

    // 移除控制字符
    let cleaned = input.replace(/[\x00-\x1F\x7F]/g, '');

    // 截断到最大长度
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength);
    }

    return cleaned.trim();
  },

  /**
   * 验证Email格式
   * @param {string} email - 邮箱地址
   * @returns {boolean} - 是否有效
   */
  isValidEmail: function (email) {
    if (typeof email !== 'string') {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  },

  /**
   * 验证URL格式（仅允许http/https）
   * @param {string} url - URL地址
   * @returns {boolean} - 是否有效
   */
  isValidUrl: function (url) {
    if (typeof url !== 'string') {
      return false;
    }
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },

  /**
   * 设置Content Security Policy
   */
  setCSP: function () {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');

    let meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      document.head.appendChild(meta);
    }
    meta.content = csp;
  }
};

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecurityUtils;
}

// 自动初始化CSRF Token
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    SecurityUtils.setupCsrfToken();
    SecurityUtils.setCSP();
  });
}
