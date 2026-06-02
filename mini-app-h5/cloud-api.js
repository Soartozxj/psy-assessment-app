/**
 * cloud-api.js v3.4 - 云托管 HTTP API 通信模块
 *
 * v3.4 改动：
 *   - ping() 改用 /api/scales 替代 /（避免 CDN 缓存根路径导致 CORS 头丢失）
 *
 * v3.3 改动：
 *   - WebView 模式下也跳过 URL 参数 apiBase，强制同域（H5 与 API 同在 www.soarto.com.cn）
 *   - 修复 WebView AI 诊断 403（apiBase=https://identity.soarto.com.cn 导致请求发到云托管）
 *
 * v3.2 改动：
 *   - AI 诊断超时从 8s 增加到 60s（DashScope 生成报告可能需 20s+）
 *   - 移除 WebView 自动推断 API 地址的旧逻辑
 *
 * v3.0 改动：
 *   - 默认 API_BASE 改为空字符串（同域部署，前端与 API 同域名）
 *   - 去掉 WebView 模式的禁用逻辑，WebView 内 H5 可以正常调用
 *   - 自动从 URL 参数解析 openid 并附加到所有请求
 *   - submitAnswers 自动传入 openid
 *   - fetchHistory 自动传入 openid（按用户筛选）
 *   - 修正 API 路径前缀：/api/submit, /api/history 等
 *
 * 降级策略：云端不可用时自动降级到本地 localStorage + 本地计分引擎
 *
 * 配置优先级：localStorage('psy_api_base') > URL 参数(apiBase) > 默认值
 */

(function () {
  'use strict';

  // ====================================================
  // 配置
  // ====================================================

  const urlParams = new URLSearchParams(window.location.search);

  // OpenID（从小程序 WebView URL 参数传入）
  const _openid = urlParams.get('openid') || '';

  // API 基础地址
  // WebView 模式（env=cloud）下强制同域（H5 与 API 同在 www.soarto.com.cn），
  // 忽略 URL 参数 apiBase 和 localStorage 残留配置（防止请求发到云托管返回 403）
  let customBase = null;
  let storedBase = null;
  if (urlParams.get('env') !== 'cloud' && !/MicroMessenger/i.test(navigator.userAgent)) {
    customBase = urlParams.get('apiBase');
    try {
      storedBase = localStorage.getItem('psy_api_base');
    } catch (e) {}
  }

  // 本地开发默认走生产 API（python http.server 不支持 POST）
  // 可通过 URL 参数 ?apiBase=http://localhost:3100 切换到本地 API
  // CloudBase 静态托管（rich.soarto.com.cn）也没有后端，需指向 LNMP 服务器
  const isCloudBaseHosting =
    window.location.hostname.endsWith('.tcloudbaseapp.com') || window.location.hostname === 'rich.soarto.com.cn';
  const localFallback =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || isCloudBaseHosting
      ? 'https://www.soarto.com.cn'
      : '';
  let API_BASE = storedBase || customBase || localFallback;
  const TIMEOUT_MS = 15000; // 普通接口 15 秒
  const AI_TIMEOUT_MS = 60000; // AI 诊断 60 秒（DashScope 生成报告可能需 20s+）

  // 云端是否可用（降级标记）
  let _cloudAvailable = true;
  let _lastCloudCheck = 0;

  /**
   * 通用 fetch 封装
   * @param {string} method - HTTP 方法
   * @param {string} path - API 路径
   * @param {object} data - 请求数据
   * @param {number} [customTimeout] - 自定义超时（毫秒）
   */
  function apiRequest(method, path, data, customTimeout) {
    let url = API_BASE + path;
    // 自动附加 openid 查询参数（GET 和 DELETE 都通过 URL 传递）
    if (_openid && (method === 'GET' || method === 'DELETE') && !path.includes('openid=')) {
      const sep = url.includes('?') ? '&' : '?';
      url = url + sep + 'openid=' + encodeURIComponent(_openid);
    }
    const timeout = customTimeout || TIMEOUT_MS;
    const options = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data && method !== 'GET') {
      // POST/DELETE 请求将 openid 放在 body 中
      if (_openid) {
        data._openid = _openid;
      }
      options.body = JSON.stringify(data);
    }

    // 超时控制
    const controller = new AbortController();
    options.signal = controller.signal;
    const timer = setTimeout(function () {
      controller.abort();
    }, timeout);

    return fetch(url, options)
      .then(function (resp) {
        clearTimeout(timer);
        if (!resp.ok) {
          throw new Error('HTTP ' + resp.status);
        }
        return resp.json();
      })
      .then(function (json) {
        if (json.code !== 0) {
          throw new Error(json.message || '接口错误');
        }
        return json.data;
      })
      .catch(function (err) {
        clearTimeout(timer);
        console.warn('[CloudAPI] 请求失败:', path, err.message);
        _cloudAvailable = false;
        throw err;
      });
  }

  // ====================================================
  // 公开 API
  // ====================================================

  window.CloudAPI = {
    /**
     * 检查云端是否可用
     */
    isAvailable: function () {
      return _cloudAvailable;
    },

    /**
     * 获取当前 openid
     */
    getOpenId: function () {
      return _openid;
    },

    /**
     * 测试云端连接（GET /api/scales）
     * 注：改用 /api/scales 而非 /，因为 / 被 CDN 缓存后返回的响应不含 CORS 头
     */
    ping: function () {
      return apiRequest('GET', '/api/scales')
        .then(function (data) {
          _cloudAvailable = true;
          _lastCloudCheck = Date.now();
          return true;
        })
        .catch(function () {
          _cloudAvailable = false;
          return false;
        });
    },

    /**
     * 提交测评答案（云端计分 + 存历史）
     * @param {number|string} scaleId - 量表 ID
     * @param {object} answers - 答案 { questionId: optionId }
     * @param {number} duration - 答题时长（秒）
     * @returns {Promise<object>} { id, score, maxScore, level, levelName, color, interp, dims }
     */
    submitAnswers: function (scaleId, answers, duration) {
      return apiRequest('POST', '/api/submit', {
        scaleId: scaleId,
        answers: answers,
        duration: duration || 0
      });
    },

    /**
     * 查询测评历史
     * @param {number} page - 页码（从1开始）
     * @param {number} pageSize - 每页条数
     * @returns {Promise<object>} { list, total, page, pageSize }
     */
    fetchHistory: function (page, pageSize) {
      return apiRequest('GET', '/api/history?page=' + (page || 1) + '&pageSize=' + (pageSize || 20));
    },

    /**
     * 删除单条历史
     * @param {number|string} id - 记录 ID
     * @returns {Promise<boolean>}
     */
    deleteRecord: function (id) {
      return apiRequest('DELETE', '/api/history/' + id);
    },

    /**
     * AI 诊断
     * @param {Array} messages - 消息数组
     * @param {object} options - { provider, model, temperature, maxTokens }
     * @returns {Promise<string>} 诊断文本
     */
    aiDiagnose: function (messages, options) {
      const body = {
        messages: messages,
        provider: options && options.provider,
        model: options && options.model,
        temperature: options && options.temperature,
        maxTokens: options && options.maxTokens
      };
      if (_openid) {
        body.openid = _openid;
      }
      return apiRequest('POST', '/api/ai-diagnose', body, AI_TIMEOUT_MS);
    },

    /**
     * 获取/设置 API 基础地址
     */
    getBaseUrl: function () {
      return API_BASE;
    },
    setBaseUrl: function (url) {
      API_BASE = url;
      try {
        localStorage.setItem('psy_api_base', url);
      } catch (e) {}
    },

    /**
     * 通用 GET 请求（NPC 配置等需要自定义路径的场景使用）
     * @param {string} path - API 路径（如 '/api/npc-config'）
     * @returns {Promise<object>} 响应 data
     */
    get: function (path) {
      return apiRequest('GET', path);
    },

    /**
     * 通用 POST 请求（评价反馈等场景使用）
     * @param {string} path - API 路径（如 '/api/feedback'）
     * @param {object} body - 请求体
     * @returns {Promise<object>} 响应 data
     */
    post: function (path, body) {
      return apiRequest('POST', path, body);
    },

    /**
     * 重置降级状态（下次请求重新尝试云端）
     */
    resetAvailability: function () {
      _cloudAvailable = true;
    }
  };

  // 启动时静默检测云端连接（3秒后，不阻塞页面）
  // v3.0: 同域部署，前端和 API 在同一域名下（www.soarto.com.cn）
  setTimeout(function () {
    window.CloudAPI.ping().then(function (ok) {
      console.log('[CloudAPI v3] 云端连接', ok ? '正常' : '不可用，已启用本地降级', ', openid:', _openid || '(无)');
    });
  }, 3000);

  console.log('[CloudAPI v3.2] 初始化, base:', API_BASE || '(同域)', ', openid:', _openid || '(无)');
})();
