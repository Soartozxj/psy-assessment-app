/**
 * 星蓝心镜 — 微信小程序入口
 * onLaunch: 登录 → 获取 openid → 加载量表数据(缓存优先) → 加载历史记录
 */
const api = require('./utils/api.js');
const storage = require('./utils/storage.js');
const assetManager = require('./utils/asset-manager.js');
const npcHelper = require('./utils/npc-helper.js');
const constants = require('./utils/constants.js');

App({
  /** 全局数据（架构文档 3.2 节） */
  globalData: {
    openid: '', // 微信 openid
    scales: [], // 全部量表数据
    historyRecords: [], // 历史记录
    userProfile: {}, // 用户信息
    currentScale: null, // 当前测评量表
    currentAnswers: {}, // 当前答题答案
    currentPreAnswers: {}, // 当前测前问卷答案
    lastAssessmentResult: null, // 最近一次测评结果
    lastHistoryRecordId: null, // 最近一次记录 ID
    npcSettings: {}, // 当前 NPC 配置
    cloudAvailable: true, // 云端可用性标记
    systemInfo: null // 系统信息
  },

  /**
   * 小程序启动时执行
   * 流程：wx.login → 获取 openid → 加载量表 → 加载历史
   */
  onLaunch: function () {
    const that = this;

    // 获取系统信息（新 API 替代已废弃的 wx.getSystemInfoSync）
    try {
      const deviceInfo = wx.getDeviceInfo();
      const windowInfo = wx.getWindowInfo();
      const appBaseInfo = wx.getAppBaseInfo();
      this.globalData.systemInfo = {
        model: deviceInfo.model || '',
        pixelRatio: windowInfo.pixelRatio || 2,
        windowWidth: windowInfo.windowWidth || 375,
        windowHeight: windowInfo.windowHeight || 667,
        screenWidth: windowInfo.screenWidth || 375,
        screenHeight: windowInfo.screenHeight || 667,
        statusBarHeight: windowInfo.statusBarHeight || 20,
        platform: deviceInfo.platform || 'unknown',
        version: appBaseInfo.version || '',
        system: deviceInfo.system || '',
        SDKVersion: appBaseInfo.SDKVersion || ''
      };
    } catch (e) {
      console.warn('[App] 获取系统信息失败:', e.message);
    }

    // 登录获取 openid
    this.loginAndGetOpenid()
      .then(function (openid) {
        if (openid) {
          that.globalData.openid = openid;
          console.log('[App] 登录成功, openid:', openid);
        }
        // 无论登录是否成功，都尝试加载数据
        return that.loadScalesData();
      })
      .then(function () {
        // 并行：加载历史记录 + 同步 NPC 配置
        // NPC 配置越早同步越好，页面 resolveNpcSetting 依赖此配置
        const historyPromise = that.loadHistoryRecords();
        const npcConfigPromise = that._syncNpcConfigFromCloud();

        return Promise.all([historyPromise, npcConfigPromise]);
      })
      .then(function (results) {
        console.log(
          '[App] 初始化完成, 量表数:',
          that.globalData.scales.length,
          ', 历史记录数:',
          that.globalData.historyRecords.length
        );

        // NPC 配置同步完成后，再预同步图片
        assetManager
          .syncFromCloud()
          .then(function (count) {
            if (count > 0) {
              console.log('[App] NPC 图片预同步完成, 新下载:', count, '张');
            }
          })
          .catch(function (err) {
            console.warn('[App] NPC 图片预同步失败:', err.message);
          });
      })
      .catch(function (err) {
        console.error('[App] 初始化异常:', err.message);
      });
  },

  /**
   * 微信登录并获取 openid
   * wx.login → 发送 code 到后端 /api/login → 获取 openid
   * @returns {Promise<string>} openid
   */
  loginAndGetOpenid: function () {
    return new Promise(function (resolve) {
      wx.login({
        success: function (loginRes) {
          if (loginRes.code) {
            api
              .login(loginRes.code)
              .then(function (data) {
                resolve(data.openid || '');
              })
              .catch(function (err) {
                console.warn('[App] 登录接口失败:', err.message);
                resolve('');
              });
          } else {
            console.warn('[App] wx.login 未返回 code');
            resolve('');
          }
        },
        fail: function () {
          console.warn('[App] wx.login 调用失败');
          resolve('');
        }
      });
    });
  },

  /**
   * 加载量表数据（缓存优先策略）
   * 1. 先读本地缓存
   * 2. 有缓存：立即使用，后台静默更新
   * 3. 无缓存：阻塞等待网络请求
   */
  loadScalesData: function () {
    const that = this;

    // 尝试从缓存读取
    const cached = storage.getScalesCache();
    if (cached && cached.length > 0) {
      this.globalData.scales = cached;
      console.log('[App] 使用缓存量表数据:', cached.length, '个');

      // 后台静默更新
      api
        .fetchScales()
        .then(function (latestScales) {
          if (latestScales && latestScales.length > 0) {
            that.globalData.scales = latestScales;
            storage.saveScalesCache(latestScales);
            console.log('[App] 后台更新量表数据:', latestScales.length, '个');
          }
        })
        .catch(function (err) {
          console.warn('[App] 后台更新量表失败:', err.message);
        });

      return Promise.resolve();
    }

    // 无缓存，网络请求
    return api
      .fetchScales()
      .then(function (scales) {
        if (scales && scales.length > 0) {
          that.globalData.scales = scales;
          storage.saveScalesCache(scales);
          console.log('[App] 从网络加载量表数据:', scales.length, '个');
        } else {
          console.warn('[App] 网络返回的量表数据为空');
        }
      })
      .catch(function (err) {
        console.warn('[App] 网络加载量表失败:', err.message);
        // 降级：尝试使用缓存（可能存在部分缓存）
        const fallback = storage.getScalesCache();
        if (fallback && fallback.length > 0) {
          that.globalData.scales = fallback;
          console.log('[App] 降级使用缓存量表:', fallback.length, '个');
        }
      });
  },

  /**
   * 加载历史记录
   * 优先从云端获取，失败则使用本地缓存
   */
  loadHistoryRecords: function () {
    const that = this;

    return api
      .fetchHistory(1, 100)
      .then(function (result) {
        const list = result.list || [];
        that.globalData.historyRecords = list;
        // 同步到本地缓存
        storage.saveLocalHistory(list);
        console.log('[App] 云端历史记录:', list.length, '条');
      })
      .catch(function (err) {
        console.warn('[App] 云端历史加载失败，降级本地:', err.message);
        const localHistory = storage.getLocalHistory();
        that.globalData.historyRecords = localHistory;
      });
  },

  /**
   * 获取指定 ID 的量表
   * @param {number} scaleId - 量表 ID
   * @returns {object|null} 量表对象
   */
  getScaleById: function (scaleId) {
    const scales = this.globalData.scales;
    for (let i = 0; i < scales.length; i++) {
      if (scales[i].id === scaleId) {
        return scales[i];
      }
    }
    return null;
  },

  /**
   * 获取指定分类的量表列表
   * @param {string} category - 分类 key
   * @returns {Array} 量表数组
   */
  getScalesByCategory: function (category) {
    if (!category) {
      return this.globalData.scales;
    }
    return this.globalData.scales.filter(function (s) {
      return s.category === category;
    });
  },

  /**
   * 从云托管同步 NPC 全局配置（对齐 H5 的 _syncNpcConfigFromCloud）
   * 请求 identity.soarto.com.cn/api/npc-config → 存入 storage(psy_npc_config)
   * 必须在 syncFromCloud 之前执行，因为 resolveNpcSetting 依赖此配置
   * @returns {Promise<object|null>} NPC 配置对象或 null
   */
  _syncNpcConfigFromCloud: function () {
    const that = this;
    return new Promise(function (resolve) {
      const NPC_API = constants.NPC_API_BASE;
      const configUrl = NPC_API + '/api/npc-config';

      wx.request({
        url: configUrl,
        method: 'GET',
        header: { 'content-type': 'application/json' },
        timeout: constants.TIMEOUT_MS,
        success: function (res) {
          if (res.statusCode !== 200 || !res.data || res.data.code !== 0) {
            console.warn('[App] NPC 配置接口返回异常:', res.statusCode);
            resolve(null);
            return;
          }

          const result = res.data.data;
          if (!result || typeof result !== 'object') {
            console.log('[App] NPC 配置云端无数据，使用本地默认');
            resolve(null);
            return;
          }

          // 存 NPC 元数据到 storage（对齐 H5: localStorage.setItem('psy_npc_config')）
          npcHelper.saveGlobalNpcConfig(result);
          console.log(
            '[App] NPC 配置已同步, 咨询师:',
            (result.counselors && result.counselors.length) || 0,
            '个, 背景:',
            (result.backgrounds && result.backgrounds.length) || 0,
            '个'
          );

          // 同时缓存到 globalData 供页面直接使用
          that.globalData.npcConfig = result;
          resolve(result);
        },
        fail: function (err) {
          console.warn('[App] NPC 配置网络请求失败:', err.errMsg || 'unknown');
          resolve(null);
        }
      });
    });
  }
});
