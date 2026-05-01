/**
 * cloud-data.js v8.1 - 云端数据代理版
 *
 * v8.0 改动：历史记录操作代理到 CloudAPI（HTTP 云端）
 *   - saveHistory: 双写（云端 + 本地 localStorage）
 *   - getHistory: 优先云端，降级本地
 *   - deleteHistory: 双删（云端 + 本地）
 *   - callAi: 继续桥接到 CloudAPI.aiDiagnose
 *   - 无 openid 时仅操作本地（降级模式）
 *
 * v8.1 改动：量表数据云端同步
 *   - syncScales: 管理员全量写入云端（PUT /api/scales）
 *   - loadCloudScales: 从云端拉取上架量表（GET /api/scales）
 *   - init: WebView 模式下自动从云端加载量表
 */
(function() {
  'use strict';

  // ====================================================
  // 环境检测
  // ====================================================
  function detectCloudEnv() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('env') === 'cloud') return params.get('envId') || 'default';
    if (window.__wxjs_environment === 'miniprogram') return 'default';
    if (/miniProgram/i.test(navigator.userAgent)) return 'default';
    return null;
  }

  var envId = detectCloudEnv();
  var isCloud = !!envId;

  // 暴露环境信息
  window.CloudEnv = {
    isCloud: isCloud,
    envId: envId,
    mode: isCloud ? 'cloud' : 'local',
    cloudData: null,
    dataReady: false
  };

  console.log('[CloudData v8.1] 环境:', isCloud ? 'WebView 云端模式 (' + envId + ')' : '本地模式');
  console.log('[CloudData v8] 量表数据由 shared-data.js 提供，历史记录代理到 CloudAPI');

  // ====================================================
  // 辅助：本地存储操作
  // ====================================================
  var STORAGE_KEY = 'psy_assessment_history';

  function getLocalHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch(e) { return []; }
  }

  function saveLocalHistory(record) {
    try {
      var arr = getLocalHistory();
      arr.unshift(record);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      return true;
    } catch(e) { return false; }
  }

  function deleteLocalHistory(id) {
    try {
      var arr = getLocalHistory().filter(function(h) { return h.id !== id; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      return true;
    } catch(e) { return false; }
  }

  // ====================================================
  // CloudData API
  // ====================================================
  window.CloudData = {
    ready: function() {
      return Promise.resolve(true);
    },

    init: function() {
      if (window.SharedData) {
        return Promise.resolve(window.SharedData.getActiveScales());
      }
      return Promise.resolve([]);
    },

    getAllScales: function() {
      if (window.SharedData) {
        return Promise.resolve(window.SharedData.getAllScales());
      }
      return Promise.resolve([]);
    },

    getScaleById: function(id) {
      if (window.SharedData) {
        return Promise.resolve(window.SharedData.getScaleById(id));
      }
      return Promise.resolve(null);
    },

    /**
     * 保存历史（双写：云端 + 本地）
     */
    saveHistory: function(record) {
      // 始终保存到本地
      saveLocalHistory(record);

      // 如果有 openid 且 CloudAPI 可用，同步到云端
      if (window.CloudAPI && CloudAPI.getOpenId() && CloudAPI.isAvailable()) {
        // 云端提交已由 submitAnswers API 完成（计分+存历史）
        // 这里不需要重复提交，只做本地保存即可
        console.log('[CloudData v8] 历史已保存（本地），云端由 submitAnswers 处理');
      }

      return Promise.resolve(record);
    },

    /**
     * 获取历史（优先云端，降级本地）
     */
    getHistory: function(page, pageSize) {
      // 如果有 openid 且 CloudAPI 可用，从云端拉取
      if (window.CloudAPI && CloudAPI.getOpenId()) {
        return CloudAPI.fetchHistory(page, pageSize)
          .then(function(cloudData) {
            console.log('[CloudData v8] 云端历史:', cloudData.list.length, '条');
            // 合并云端数据到本地（以云端为准）
            if (cloudData.list && cloudData.list.length > 0) {
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData.list));
              } catch(e) {}
            }
            return cloudData;
          })
          .catch(function(err) {
            console.warn('[CloudData v8] 云端拉取失败，降级本地:', err.message);
            return { list: getLocalHistory(), total: getLocalHistory().length };
          });
      }

      // 无 openid 或 CloudAPI 不可用，从本地读取
      return Promise.resolve({ list: getLocalHistory(), total: getLocalHistory().length });
    },

    /**
     * 删除历史（双删：云端 + 本地）
     */
    deleteHistory: function(id) {
      // 始终从本地删除
      deleteLocalHistory(id);

      // 如果有 openid 且 CloudAPI 可用，从云端删除
      if (window.CloudAPI && CloudAPI.getOpenId() && CloudAPI.isAvailable()) {
        return CloudAPI.deleteRecord(id)
          .then(function() {
            console.log('[CloudData v8] 云端删除成功');
            return true;
          })
          .catch(function(err) {
            console.warn('[CloudData v8] 云端删除失败（本地已删除）:', err.message);
            return true; // 本地已删除，返回成功
          });
      }

      return Promise.resolve(true);
    },

    /**
     * 同步量表到云端（管理员保存时调用）
     * PUT /api/scales — 全量覆盖云端量表数据
     */
    syncScales: function(scales) {
      if (!window.CloudAPI || !CloudAPI.isAvailable()) {
        console.warn('[CloudData] CloudAPI 不可用，跳过云端同步');
        return Promise.resolve(true);
      }
      var openid = CloudAPI.getOpenId();
      if (!openid) {
        console.warn('[CloudData] 无 openid，跳过云端同步');
        return Promise.resolve(true);
      }
      var apiBase = window.API_BASE || '';
      return fetch(apiBase + '/api/scales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scales: scales, openid: openid })
      })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.code === 0) {
          console.log('[CloudData] 量表同步云端成功:', result.saved, '/', result.total);
          return true;
        } else {
          console.warn('[CloudData] 量表同步云端失败:', result.message);
          return false;
        }
      })
      .catch(function(err) {
        console.warn('[CloudData] 量表同步云端异常:', err.message);
        return false;
      });
    },

    /**
     * 从云端拉取上架量表列表（前端 WebView 启动时调用）
     * 策略：先尝试云托管 API（/api/scales），失败则 fallback 到 LNMP 静态 JSON（/api/scales-json）
     * 成功后自动写入 localStorage（psy_scales_synced）
     */
    loadCloudScales: function() {
      // 优先 LNMP 静态 JSON（稳定可靠），云托管作为 fallback
      var lnmpPromise = this._loadFromLNMP();
      if (!window.CloudAPI || !CloudAPI.isAvailable()) {
        return lnmpPromise;
      }
      // LNMP 成功则直接返回，失败再尝试云托管
      return lnmpPromise.then(function(lnmpData) {
        if (lnmpData && lnmpData.length > 0) return lnmpData;
        console.log('[CloudData] LNMP 无数据，尝试云托管 fallback');
        var apiBase = window.API_BASE || '';
        return fetch(apiBase + '/api/scales', { signal: AbortSignal.timeout(5000) })
          .then(function(res) { return res.json(); })
          .then(function(result) {
            if (result.code === 0 && result.data && result.data.length > 0) {
              console.log('[CloudData] 从云托管加载量表:', result.data.length, '个');
              localStorage.setItem('psy_scales_synced', JSON.stringify(result.data));
              return result.data;
            }
            return null;
          })
          .catch(function(err) {
            console.warn('[CloudData] 云托管也失败:', err.message);
            return null;
          });
      });
    },

    /**
     * LNMP 静态 JSON fallback
     * 直接 fetch www.soarto.com.cn/api/scales-json（Nginx 反代到 psy-api）
     */
    _loadFromLNMP: function() {
      var lnmpBase = 'https://www.soarto.com.cn';
      return fetch(lnmpBase + '/api/scales-json', { signal: AbortSignal.timeout(5000) })
        .then(function(res) { return res.json(); })
        .then(function(result) {
          if (result.code === 0 && result.data && result.data.length > 0) {
            console.log('[CloudData] 从 LNMP 加载量表:', result.data.length, '个');
            localStorage.setItem('psy_scales_synced', JSON.stringify(result.data));
            return result.data;
          }
          console.log('[CloudData] LNMP 也无量表数据');
          return null;
        })
        .catch(function(err) {
          console.warn('[CloudData] LNMP 加载失败:', err.message);
          return null;
        });
    },

    /**
     * AI 诊断代理调用
     */
    callAi: function(messages, options) {
      if (window.CloudAPI && typeof window.CloudAPI.aiDiagnose === 'function') {
        return window.CloudAPI.aiDiagnose(messages, options);
      }
      return Promise.reject(new Error('CloudAPI 未加载，AI 诊断不可用'));
    }
  };

  window.CloudEnv.dataReady = true;
})();
