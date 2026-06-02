/**
 * 星蓝心镜 — wx.request 封装
 *
 * 替代 H5 的 cloud-api.js，提供统一的网络请求接口。
 * 功能：
 *   - 自动附加 openid（GET 通过 URL，POST 通过 body）
 *   - 超时控制
 *   - 错误处理 + 降级标记
 *   - 完整的 API 方法封装
 *
 * 使用方式：
 *   const api = require('./api.js');
 *   api.fetchScales().then(scales => { ... });
 */

const constants = require('./constants.js');

/** API 基础地址 */
let API_BASE = constants.API_BASE;

/** 普通超时 */
const TIMEOUT_MS = constants.TIMEOUT_MS;

/** AI 诊断超时 */
const AI_TIMEOUT_MS = constants.AI_TIMEOUT_MS;

/** 云端可用性标记 */
let _cloudAvailable = true;

/** 上次云端检测时间 */
let _lastCloudCheck = 0;

/**
 * 获取全局 openid
 * @returns {string}
 */
function _getOpenid() {
  try {
    const app = getApp();
    return (app && app.globalData && app.globalData.openid) || '';
  } catch (e) {
    return '';
  }
}

/**
 * 通用请求封装
 * @param {string} method - HTTP 方法 (GET/POST/DELETE)
 * @param {string} path - API 路径 (如 /api/login)
 * @param {object} [data] - 请求数据
 * @param {number} [customTimeout] - 自定义超时(毫秒)
 * @returns {Promise<object>} 响应 data 字段
 */
function request(method, path, data, customTimeout) {
  const openid = _getOpenid();
  let url = API_BASE + path;
  const timeout = customTimeout || TIMEOUT_MS;

  // GET/DELETE 请求：openid 通过 URL 参数传递
  if (openid && (method === 'GET' || method === 'DELETE')) {
    if (url.indexOf('openid=') === -1) {
      const sep = url.indexOf('?') !== -1 ? '&' : '?';
      url = url + sep + 'openid=' + encodeURIComponent(openid);
    }
  }

  // POST/DELETE 请求：openid 放入 body
  const requestData = data || {};
  if (openid && method !== 'GET') {
    if (!requestData.openid) {
      requestData.openid = openid;
    }
  }

  // GET 请求不需要 body
  let requestOption = {};
  if (method !== 'GET' && requestData) {
    requestOption = requestData;
  }

  return new Promise(function (resolve, reject) {
    wx.request({
      url: url,
      method: method,
      data: method === 'GET' ? data || {} : requestOption,
      header: {
        'content-type': 'application/json'
      },
      timeout: timeout,
      success: function (res) {
        // HTTP 状态码检查
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const httpErr = new Error('HTTP ' + res.statusCode);
          _cloudAvailable = false;
          reject(httpErr);
          return;
        }

        const json = res.data;
        // 业务码检查：code === 0 表示成功
        if (json.code !== undefined && json.code !== 0) {
          const bizErr = new Error(json.message || '接口错误');
          bizErr.code = json.code;
          reject(bizErr);
          return;
        }

        _cloudAvailable = true;
        _lastCloudCheck = Date.now();
        resolve(json.data !== undefined ? json.data : json);
      },
      fail: function (err) {
        console.warn('[API] 请求失败:', path, err.errMsg);
        _cloudAvailable = false;
        reject(new Error(err.errMsg || '网络请求失败'));
      }
    });
  });
}

// ====================================================
// 公开 API 方法
// ====================================================

/**
 * 微信登录
 * @param {string} code - wx.login 获取的 code
 * @returns {Promise<object>} {openid, token}
 */
function login(code) {
  return request('POST', '/api/mp-login', {
    code: code
  });
}

/**
 * 获取全量量表数据
 * GET /api/scales-json
 * @returns {Promise<Array>} Scale[]
 */
function fetchScales() {
  return request('GET', '/api/scales-json');
}

/**
 * 提交测评答案
 * POST /api/submit
 * @param {number|string} scaleId - 量表 ID
 * @param {object} answers - 答案对象 { questionId: answer }
 * @param {number} [duration] - 答题时长(秒)
 * @param {string} [recordId] - 记录 ID（不传则自动生成）
 * @param {object} [result] - 计分结果 { totalScore, maxScore, level, levelName, color, scaleName, categoryName, dimensions }
 * @returns {Promise<object>} {id, recordId}
 */
function submitAnswers(scaleId, answers, duration, recordId, result) {
  const body = {
    recordId: recordId || 'native-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
    scaleId: scaleId,
    answers: answers,
    duration: duration || 0
  };
  // 附加计分结果字段（服务端缺失时兜底写入）
  if (result) {
    if (result.totalScore !== undefined) {
      body.totalScore = result.totalScore;
    }
    if (result.maxScore !== undefined) {
      body.maxScore = result.maxScore;
    }
    if (result.level !== undefined) {
      body.level = result.level;
    }
    if (result.levelName !== undefined) {
      body.levelName = result.levelName;
    }
    if (result.color !== undefined) {
      body.color = result.color;
    }
    if (result.scaleName !== undefined) {
      body.scaleName = result.scaleName;
    }
    if (result.categoryName !== undefined) {
      body.categoryName = result.categoryName;
    }
    if (result.dimensions) {
      body.dimensions = result.dimensions;
    }
  }
  return request('POST', '/api/submit', body);
}

/**
 * 获取历史记录
 * GET /api/history
 * @param {number} [page=1] - 页码
 * @param {number} [pageSize=20] - 每页条数
 * @returns {Promise<object>} {list, total, page, pageSize}
 */
function fetchHistory(page, pageSize) {
  const p = page || 1;
  const ps = pageSize || constants.DEFAULT_PAGE_SIZE;
  return request('GET', '/api/history?page=' + p + '&pageSize=' + ps);
}

/**
 * 删除历史记录
 * DELETE /api/history/:id
 * @param {number|string} id - 记录 ID
 * @returns {Promise<object>} {success}
 */
function deleteRecord(id) {
  return request('DELETE', '/api/history/' + id);
}

/**
 * AI 诊断
 * POST /api/ai-diagnose
 * @param {Array} messages - 消息数组
 * @param {object} [options] - {provider, model, temperature, maxTokens}
 * @returns {Promise<string>} 诊断文本
 */
function aiDiagnose(messages, options) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Promise.reject(new Error('aiDiagnose: messages 必须是非空数组'));
  }
  const body = {
    messages: messages
  };
  if (options) {
    if (options.provider) {
      body.provider = options.provider;
    }
    if (options.model) {
      body.model = options.model;
    }
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.maxTokens) {
      body.maxTokens = options.maxTokens;
    }
  }
  console.log('[API] aiDiagnose 请求体:', JSON.stringify(body).substring(0, 300));
  return request('POST', '/api/ai-diagnose', body, AI_TIMEOUT_MS);
}

/**
 * 提交评价反馈
 * POST /api/feedback
 * @param {object} params - {recordId, scene, rating, tags, text}
 * @returns {Promise<object>} {success}
 */
function submitFeedback(params) {
  return request('POST', '/api/feedback', {
    recordId: params.recordId,
    scene: params.scene,
    rating: params.rating,
    tags: params.tags,
    text: params.text
  });
}

/**
 * 获取 NPC 配置
 * GET /api/npc-config/:id
 * @param {string|number} id - NPC 配置 ID
 * @returns {Promise<object>} {counselorId, backgroundId, ...}
 */
function fetchNpcConfig(id) {
  return request('GET', '/api/npc-config/' + id);
}

/**
 * 通用 GET 请求（自定义路径场景）
 * @param {string} path - API 路径 (如 /api/npc-config)
 * @returns {Promise<object>}
 */
function get(path) {
  return request('GET', path);
}

/**
 * 通用 POST 请求（自定义路径场景）
 * @param {string} path - API 路径 (如 /api/feedback)
 * @param {object} body - 请求体
 * @returns {Promise<object>}
 */
function post(path, body) {
  return request('POST', path, body);
}

/**
 * 测试云端连接
 * GET /
 * @returns {Promise<boolean>}
 */
function ping() {
  return request('GET', '/')
    .then(function () {
      _cloudAvailable = true;
      _lastCloudCheck = Date.now();
      return true;
    })
    .catch(function () {
      _cloudAvailable = false;
      return false;
    });
}

/**
 * 检查云端是否可用
 * @returns {boolean}
 */
function isAvailable() {
  return _cloudAvailable;
}

/**
 * 重置降级状态（下次请求重新尝试云端）
 */
function resetAvailability() {
  _cloudAvailable = true;
}

/**
 * 获取当前 API 基础地址
 * @returns {string}
 */
function getBaseUrl() {
  return API_BASE;
}

/**
 * 设置 API 基础地址（调试用）
 * @param {string} url - 新的 API 地址
 */
function setBaseUrl(url) {
  API_BASE = url;
}

module.exports = {
  // 核心请求方法
  request: request,

  // 业务 API
  login: login,
  fetchScales: fetchScales,
  submitAnswers: submitAnswers,
  fetchHistory: fetchHistory,
  deleteRecord: deleteRecord,
  aiDiagnose: aiDiagnose,
  submitFeedback: submitFeedback,
  fetchNpcConfig: fetchNpcConfig,

  // 别名（兼容页面调用）
  getScales: fetchScales,
  getScaleDetail: function (id) {
    return get('/scales/' + id);
  },
  submitAssessment: submitAnswers,

  // 通用方法
  get: get,
  post: post,
  ping: ping,

  // 状态查询
  isAvailable: isAvailable,
  resetAvailability: resetAvailability,
  getBaseUrl: getBaseUrl,
  setBaseUrl: setBaseUrl
};
