/**
 * cloud-data.js v8.0 - 云端数据代理版
 *
 * v7.0 改动：彻底移除 URL hash / evaluateJavascript 数据传输
 * 量表数据已内置在 shared-data.js 的 DEFAULT_SCALES 中
 *
 * v8.0 改动：历史记录操作代理到 CloudAPI（HTTP 云端）
 *   - saveHistory: 双写（云端 + 本地 localStorage）
 *   - getHistory: 优先云端，降级本地
 *   - deleteHistory: 双删（云端 + 本地）
 *   - callAi: 继续桥接到 CloudAPI.aiDiagnose
 *   - 无 openid 时仅操作本地（降级模式）
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

  console.log('[CloudData v8] 环境:', isCloud ? 'WebView 云端模式 (' + envId + ')' : '本地模式');
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

    syncScales: function(scales) {
      return Promise.resolve(true);
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
