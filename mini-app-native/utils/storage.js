/**
 * 星蓝心镜 — Storage 封装
 *
 * 替代 H5 的 localStorage / IndexedDB，使用 wx.setStorageSync / wx.getStorageSync。
 * 功能：
 *   - 量表数据缓存 + 版本管理
 *   - 历史记录管理
 *   - 用户配置管理
 *   - 统一的 key 管理（psy_ 前缀）
 */

const constants = require('./constants.js');

const STORAGE_KEYS = constants.STORAGE_KEYS;
const SCALES_CACHE_TTL = constants.SCALES_CACHE_TTL;

// ====================================================
// 通用读写
// ====================================================

/**
 * 同步读取 Storage
 * @param {string} key - Storage key
 * @param {*} [defaultValue] - 默认值
 * @returns {*} 存储值或默认值
 */
function get(key, defaultValue) {
  try {
    const value = wx.getStorageSync(key);
    if (value === '' || value === undefined || value === null) {
      return defaultValue !== undefined ? defaultValue : null;
    }
    return value;
  } catch (e) {
    console.warn('[Storage] 读取失败:', key, e.message);
    return defaultValue !== undefined ? defaultValue : null;
  }
}

/**
 * 同步写入 Storage
 * @param {string} key - Storage key
 * @param {*} value - 存储值
 * @returns {boolean} 是否成功
 */
function set(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    console.warn('[Storage] 写入失败:', key, e.message);
    return false;
  }
}

/**
 * 删除 Storage
 * @param {string} key - Storage key
 * @returns {boolean}
 */
function remove(key) {
  try {
    wx.removeStorageSync(key);
    return true;
  } catch (e) {
    console.warn('[Storage] 删除失败:', key, e.message);
    return false;
  }
}

/**
 * 清除所有 psy_ 前缀的 Storage
 * @returns {boolean}
 */
function clearAll() {
  try {
    const res = wx.getStorageInfoSync();
    const keys = res.keys || [];
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('psy_') === 0) {
        wx.removeStorageSync(keys[i]);
      }
    }
    return true;
  } catch (e) {
    console.warn('[Storage] 清除失败:', e.message);
    return false;
  }
}

// ====================================================
// 量表数据缓存
// ====================================================

/**
 * 获取缓存的量表数据
 * 会检查版本号和过期时间
 * @returns {Array|null} 量表数组或 null
 */
function getScalesCache() {
  try {
    let cached = wx.getStorageSync(STORAGE_KEYS.SCALES_DATA);
    if (!cached) {
      return null;
    }

    // 如果是字符串（旧格式），尝试解析
    if (typeof cached === 'string') {
      try {
        cached = JSON.parse(cached);
      } catch (e) {
        remove(STORAGE_KEYS.SCALES_DATA);
        return null;
      }
    }

    // 数组格式验证
    if (!Array.isArray(cached)) {
      remove(STORAGE_KEYS.SCALES_DATA);
      return null;
    }

    // 检查版本号/过期时间
    const versionInfo = wx.getStorageSync(STORAGE_KEYS.SCALES_VERSION);
    if (versionInfo) {
      const version = typeof versionInfo === 'string' ? JSON.parse(versionInfo) : versionInfo;
      if (version.timestamp) {
        const elapsed = Date.now() - version.timestamp;
        // 超过缓存过期时间，仍返回数据但标记为需要更新
        if (elapsed > SCALES_CACHE_TTL) {
          version.expired = true;
          set(STORAGE_KEYS.SCALES_VERSION, version);
        }
      }
    }

    return cached;
  } catch (e) {
    console.warn('[Storage] 获取量表缓存失败:', e.message);
    return null;
  }
}

/**
 * 保存量表数据到缓存
 * @param {Array} scales - 量表数组
 * @param {string} [version] - 数据版本号
 * @returns {boolean}
 */
function saveScalesCache(scales, version) {
  try {
    wx.setStorageSync(STORAGE_KEYS.SCALES_DATA, scales);

    // 记录版本信息
    const versionInfo = {
      timestamp: Date.now(),
      version: version || '',
      count: scales ? scales.length : 0
    };
    wx.setStorageSync(STORAGE_KEYS.SCALES_VERSION, versionInfo);

    // 同步到 SCALES_SYNC 键（兼容 cloud-data.js 的双写策略）
    let activeScales = scales;
    if (Array.isArray(scales)) {
      activeScales = scales.filter(function (s) {
        return s.status !== 0 && s.status !== false;
      });
    }
    wx.setStorageSync(STORAGE_KEYS.SCALES_SYNC, activeScales);

    return true;
  } catch (e) {
    console.warn('[Storage] 保存量表缓存失败:', e.message);
    return false;
  }
}

/**
 * 检查量表缓存是否过期
 * @returns {boolean}
 */
function isScalesCacheExpired() {
  try {
    let versionInfo = wx.getStorageSync(STORAGE_KEYS.SCALES_VERSION);
    if (!versionInfo) {
      return true;
    }
    if (typeof versionInfo === 'string') {
      versionInfo = JSON.parse(versionInfo);
    }
    if (versionInfo.expired) {
      return true;
    }
    if (versionInfo.timestamp) {
      return Date.now() - versionInfo.timestamp > SCALES_CACHE_TTL;
    }
    return true;
  } catch (e) {
    return true;
  }
}

/**
 * 获取量表缓存版本信息
 * @returns {object|null}
 */
function getScalesVersion() {
  try {
    const versionInfo = wx.getStorageSync(STORAGE_KEYS.SCALES_VERSION);
    if (!versionInfo) {
      return null;
    }
    if (typeof versionInfo === 'string') {
      return JSON.parse(versionInfo);
    }
    return versionInfo;
  } catch (e) {
    return null;
  }
}

// ====================================================
// 历史记录
// ====================================================

/**
 * 获取本地历史记录
 * @returns {Array}
 */
function getLocalHistory() {
  try {
    const data = wx.getStorageSync(STORAGE_KEYS.HISTORY_DATA);
    if (!data) {
      return [];
    }
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[Storage] 获取本地历史失败:', e.message);
    return [];
  }
}

/**
 * 保存本地历史记录（全量覆盖）
 * @param {Array} records - 历史记录数组
 * @returns {boolean}
 */
function saveLocalHistory(records) {
  try {
    wx.setStorageSync(STORAGE_KEYS.HISTORY_DATA, records);
    return true;
  } catch (e) {
    console.warn('[Storage] 保存本地历史失败:', e.message);
    return false;
  }
}

/**
 * 追加一条历史记录（插入到数组头部）
 * @param {object} record - 历史记录对象
 * @returns {boolean}
 */
function addLocalHistory(record) {
  const records = getLocalHistory();
  records.unshift(record);
  return saveLocalHistory(records);
}

/**
 * 删除一条本地历史记录
 * @param {number|string} id - 记录 ID
 * @returns {boolean}
 */
function deleteLocalHistory(id) {
  const records = getLocalHistory();
  const filtered = records.filter(function (r) {
    return r.id !== id;
  });
  return saveLocalHistory(filtered);
}

/**
 * 获取本地历史记录总数
 * @returns {number}
 */
function getLocalHistoryCount() {
  return getLocalHistory().length;
}

// ====================================================
// 用户配置
// ====================================================

/**
 * 获取用户信息
 * @returns {object}
 */
function getUserProfile() {
  const defaultProfile = {
    nickname: '',
    avatarUrl: '',
    gender: 0,
    birthday: '',
    city: '',
    profession: ''
  };
  try {
    let data = wx.getStorageSync(STORAGE_KEYS.USER_PROFILE);
    if (!data) {
      return defaultProfile;
    }
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return defaultProfile;
      }
    }
    // 合并默认值，防止缺少字段
    const result = {};
    const keys = Object.keys(defaultProfile);
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = data[keys[i]] !== undefined ? data[keys[i]] : defaultProfile[keys[i]];
    }
    return result;
  } catch (e) {
    return defaultProfile;
  }
}

/**
 * 保存用户信息
 * @param {object} profile - 用户信息对象
 * @returns {boolean}
 */
function saveUserProfile(profile) {
  try {
    const current = getUserProfile();
    // 合并更新
    const keys = Object.keys(profile);
    for (let i = 0; i < keys.length; i++) {
      if (profile[keys[i]] !== undefined) {
        current[keys[i]] = profile[keys[i]];
      }
    }
    wx.setStorageSync(STORAGE_KEYS.USER_PROFILE, current);
    return true;
  } catch (e) {
    console.warn('[Storage] 保存用户信息失败:', e.message);
    return false;
  }
}

// ====================================================
// 系统设置
// ====================================================

/**
 * 获取系统设置
 * @returns {object}
 */
function getSettings() {
  const defaultSettings = {
    theme: 'light',
    fontSize: 'normal',
    voiceEnabled: true,
    notificationEnabled: true
  };
  try {
    let data = wx.getStorageSync(STORAGE_KEYS.SETTINGS);
    if (!data) {
      return defaultSettings;
    }
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return defaultSettings;
      }
    }
    const result = {};
    const keys = Object.keys(defaultSettings);
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = data[keys[i]] !== undefined ? data[keys[i]] : defaultSettings[keys[i]];
    }
    return result;
  } catch (e) {
    return defaultSettings;
  }
}

/**
 * 保存系统设置
 * @param {object} settings - 设置对象
 * @returns {boolean}
 */
function saveSettings(settings) {
  try {
    const current = getSettings();
    const keys = Object.keys(settings);
    for (let i = 0; i < keys.length; i++) {
      if (settings[keys[i]] !== undefined) {
        current[keys[i]] = settings[keys[i]];
      }
    }
    wx.setStorageSync(STORAGE_KEYS.SETTINGS, current);
    return true;
  } catch (e) {
    console.warn('[Storage] 保存设置失败:', e.message);
    return false;
  }
}

// ====================================================
// 隐私协议 + 首次启动
// ====================================================

/**
 * 是否已同意隐私政策
 * @returns {boolean}
 */
function isPrivacyAgreed() {
  try {
    return !!wx.getStorageSync(STORAGE_KEYS.PRIVACY_AGREED);
  } catch (e) {
    return false;
  }
}

/**
 * 标记已同意隐私政策
 * @returns {boolean}
 */
function setPrivacyAgreed() {
  return set(STORAGE_KEYS.PRIVACY_AGREED, true);
}

/**
 * 是否首次启动
 * @returns {boolean}
 */
function isFirstLaunch() {
  try {
    return !wx.getStorageSync(STORAGE_KEYS.FIRST_LAUNCH);
  } catch (e) {
    return true;
  }
}

/**
 * 标记非首次启动
 * @returns {boolean}
 */
function setFirstLaunchDone() {
  return set(STORAGE_KEYS.FIRST_LAUNCH, true);
}

// ====================================================
// 评价反馈
// ====================================================

/**
 * 获取评价列表
 * @returns {Array}
 */
function getFeedbackList() {
  try {
    const data = wx.getStorageSync(STORAGE_KEYS.FEEDBACK_LIST);
    if (!data) {
      return [];
    }
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

/**
 * 保存评价
 * @param {object} feedback - 评价对象
 * @returns {boolean}
 */
function addFeedback(feedback) {
  const list = getFeedbackList();
  feedback.id = feedback.id || Date.now();
  feedback.createdAt = feedback.createdAt || new Date().toISOString();
  list.unshift(feedback);
  return set(STORAGE_KEYS.FEEDBACK_LIST, list);
}

/**
 * 获取评价标签配置
 * @returns {object}
 */
function getFeedbackTagConfig() {
  const defaultConfig = {
    emotion: ['放松', '焦虑', '平静', '烦躁', '安心', '担忧'],
    understanding: ['清晰', '模糊', '有启发', '需要解读'],
    overall: ['有帮助', '一般', '无帮助']
  };
  try {
    const data = wx.getStorageSync(STORAGE_KEYS.FEEDBACK_TAG_CONFIG);
    if (!data) {
      return defaultConfig;
    }
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        return defaultConfig;
      }
    }
    return data;
  } catch (e) {
    return defaultConfig;
  }
}

// ====================================================
// 答题进度保存/恢复（断点续答）
// ====================================================

/** 答题进度 Storage key */
const PROGRESS_KEY = 'psy_assessment_progress';

/**
 * 保存答题进度
 * @param {object} progress - 进度数据
 *   { scaleId, scaleCode, answers, preAnswers, currentIndex, startTime, npcMode }
 * @returns {boolean}
 */
function saveAssessmentProgress(progress) {
  try {
    const data = {
      scaleId: progress.scaleId,
      scaleCode: progress.scaleCode || '',
      answers: progress.answers || {},
      preAnswers: progress.preAnswers || {},
      currentIndex: progress.currentIndex || 0,
      startTime: progress.startTime || Date.now(),
      npcMode: progress.npcMode || 'immersive',
      savedAt: Date.now()
    };
    wx.setStorageSync(PROGRESS_KEY, data);
    return true;
  } catch (e) {
    console.warn('[Storage] 保存答题进度失败:', e.message);
    return false;
  }
}

/**
 * 获取答题进度
 * @param {number} [scaleId] - 可选，按量表ID筛选
 * @returns {object|null} 进度数据或 null
 */
function getAssessmentProgress(scaleId) {
  try {
    let data = wx.getStorageSync(PROGRESS_KEY);
    if (!data) {
      return null;
    }
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    // 如果指定了 scaleId，检查是否匹配
    if (scaleId !== undefined && data.scaleId !== scaleId) {
      return null;
    }
    // 检查是否过期（超过24小时的进度视为过期）
    const elapsed = Date.now() - (data.savedAt || 0);
    if (elapsed > 24 * 60 * 60 * 1000) {
      clearAssessmentProgress();
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * 清除答题进度
 * @returns {boolean}
 */
function clearAssessmentProgress() {
  return remove(PROGRESS_KEY);
}

/**
 * 检查是否有未完成的答题进度
 * @returns {boolean}
 */
function hasAssessmentProgress() {
  return getAssessmentProgress() !== null;
}

// ====================================================
// 历史记录筛选
// ====================================================

/**
 * 按分类筛选本地历史记录
 * @param {string} [category] - 分类 key，为空返回全部
 * @returns {Array}
 */
function getLocalHistoryByCategory(category) {
  const records = getLocalHistory();
  if (!category) {
    return records;
  }
  return records.filter(function (r) {
    return r.categoryName === category || r.category === category;
  });
}

/**
 * 按日期范围筛选本地历史记录
 * @param {string} startDate - 起始日期 (yyyy-MM-dd)
 * @param {string} endDate - 结束日期 (yyyy-MM-dd)
 * @returns {Array}
 */
function getLocalHistoryByDateRange(startDate, endDate) {
  const records = getLocalHistory();
  if (!startDate && !endDate) {
    return records;
  }
  return records.filter(function (r) {
    const date = r.completedAt || r.date || '';
    // 兼容不同日期格式
    const dateStr = date.substring(0, 10);
    if (startDate && dateStr < startDate) {
      return false;
    }
    if (endDate && dateStr > endDate) {
      return false;
    }
    return true;
  });
}

/**
 * 分页获取本地历史记录
 * @param {number} page - 页码（从1开始）
 * @param {number} pageSize - 每页条数
 * @param {string} [category] - 分类筛选
 * @returns {object} { list, total, page, pageSize }
 */
function getLocalHistoryPaged(page, pageSize, category) {
  const all = category ? getLocalHistoryByCategory(category) : getLocalHistory();
  const p = page || 1;
  const ps = pageSize || 20;
  const start = (p - 1) * ps;
  const list = all.slice(start, start + ps);
  return {
    list: list,
    total: all.length,
    page: p,
    pageSize: ps
  };
}

// ====================================================
// 通知
// ====================================================

/**
 * 获取通知列表
 * @returns {Array}
 */
function getNotifications() {
  try {
    const data = wx.getStorageSync(STORAGE_KEYS.NOTIFICATIONS);
    if (!data) {
      return [];
    }
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

/**
 * 添加通知
 * @param {object} notification - {type, title, body, url, relatedId}
 * @returns {boolean}
 */
function addNotification(notification) {
  const list = getNotifications();
  notification.id = notification.id || Date.now();
  notification.read = false;
  notification.createdAt = notification.createdAt || new Date().toISOString();
  list.unshift(notification);
  return set(STORAGE_KEYS.NOTIFICATIONS, list);
}

/**
 * 标记通知已读
 * @param {number|string} id - 通知 ID
 * @returns {boolean}
 */
function markNotificationRead(id) {
  const list = getNotifications();
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i].read = true;
      break;
    }
  }
  return set(STORAGE_KEYS.NOTIFICATIONS, list);
}

/**
 * 标记全部通知已读
 * @returns {boolean}
 */
function markAllNotificationsRead() {
  const list = getNotifications();
  for (let i = 0; i < list.length; i++) {
    list[i].read = true;
  }
  return set(STORAGE_KEYS.NOTIFICATIONS, list);
}

/**
 * 删除通知
 * @param {number|string} id - 通知 ID
 * @returns {boolean}
 */
function deleteNotification(id) {
  const list = getNotifications();
  const filtered = list.filter(function (n) {
    return n.id !== id;
  });
  return set(STORAGE_KEYS.NOTIFICATIONS, filtered);
}

/**
 * 清空通知
 * @returns {boolean}
 */
function clearNotifications() {
  return set(STORAGE_KEYS.NOTIFICATIONS, []);
}

/**
 * 获取未读通知数量
 * @returns {number}
 */
function getUnreadNotificationCount() {
  const list = getNotifications();
  let count = 0;
  for (let i = 0; i < list.length; i++) {
    if (!list[i].read) {
      count++;
    }
  }
  return count;
}

// ====================================================
// 收藏报告
// ====================================================

/**
 * 获取收藏列表
 * @returns {Array}
 */
function getFavorites() {
  try {
    const data = wx.getStorageSync(STORAGE_KEYS.FAVORITES);
    if (!data) {
      return [];
    }
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

/**
 * 添加收藏
 * @param {object} record - 收藏的记录对象
 * @returns {boolean}
 */
function addFavorite(record) {
  const list = getFavorites();
  // 去重
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === record.id) {
      return true;
    }
  }
  list.unshift(record);
  return set(STORAGE_KEYS.FAVORITES, list);
}

/**
 * 取消收藏
 * @param {number|string} id - 记录 ID
 * @returns {boolean}
 */
function removeFavorite(id) {
  const list = getFavorites();
  const filtered = list.filter(function (r) {
    return r.id !== id;
  });
  return set(STORAGE_KEYS.FAVORITES, filtered);
}

/**
 * 检查是否已收藏
 * @param {number|string} id - 记录 ID
 * @returns {boolean}
 */
function isFavorite(id) {
  const list = getFavorites();
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      return true;
    }
  }
  return false;
}

/**
 * 清空收藏
 * @returns {boolean}
 */
function clearFavorites() {
  return set(STORAGE_KEYS.FAVORITES, []);
}

module.exports = {
  // 通用读写
  get: get,
  set: set,
  remove: remove,
  clearAll: clearAll,

  // 量表缓存
  getScalesCache: getScalesCache,
  saveScalesCache: saveScalesCache,
  isScalesCacheExpired: isScalesCacheExpired,
  getScalesVersion: getScalesVersion,

  // 历史记录
  getLocalHistory: getLocalHistory,
  saveLocalHistory: saveLocalHistory,
  addLocalHistory: addLocalHistory,
  deleteLocalHistory: deleteLocalHistory,
  getLocalHistoryCount: getLocalHistoryCount,
  getLocalHistoryByCategory: getLocalHistoryByCategory,
  getLocalHistoryByDateRange: getLocalHistoryByDateRange,
  getLocalHistoryPaged: getLocalHistoryPaged,

  // 用户配置
  getUserProfile: getUserProfile,
  saveUserProfile: saveUserProfile,

  // 系统设置
  getSettings: getSettings,
  saveSettings: saveSettings,

  // 隐私 + 首次启动
  isPrivacyAgreed: isPrivacyAgreed,
  setPrivacyAgreed: setPrivacyAgreed,
  isFirstLaunch: isFirstLaunch,
  setFirstLaunchDone: setFirstLaunchDone,

  // 评价反馈
  getFeedbackList: getFeedbackList,
  addFeedback: addFeedback,
  getFeedbackTagConfig: getFeedbackTagConfig,

  // 答题进度
  saveAssessmentProgress: saveAssessmentProgress,
  getAssessmentProgress: getAssessmentProgress,
  clearAssessmentProgress: clearAssessmentProgress,
  hasAssessmentProgress: hasAssessmentProgress,

  // 通知
  getNotifications: getNotifications,
  addNotification: addNotification,
  markNotificationRead: markNotificationRead,
  markAllNotificationsRead: markAllNotificationsRead,
  deleteNotification: deleteNotification,
  clearNotifications: clearNotifications,
  getUnreadNotificationCount: getUnreadNotificationCount,

  // 收藏
  getFavorites: getFavorites,
  addFavorite: addFavorite,
  removeFavorite: removeFavorite,
  isFavorite: isFavorite,
  clearFavorites: clearFavorites
};
