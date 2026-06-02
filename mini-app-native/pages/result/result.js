/**
 * pages/result — 结果页
 *
 * 分数环 + 总分/等级 + 维度分析 + 筛查 + 操作栏
 */

const app = getApp();
const storage = require('../../utils/storage.js');
const npcHelper = require('../../utils/npc-helper.js');
const assetManager = require('../../utils/asset-manager.js');
const format = require('../../utils/format.js');

Page({
  data: {
    result: null,
    scaleName: '',
    emoji: '',
    totalScore: 0,
    totalMaxScore: 100,
    levelName: '',
    sColor: '#5b8fb9',
    levelText: '',
    dims: [],
    screeningResult: null,
    hasScreening: false,
    isScreeningPositive: false,

    // NPC
    npcSettings: { counselorName: '', motto: '', welcomeText: '' },
    counselorImage: '',
    backgroundImage: '',

    // 总分展示区条件渲染
    showTotalScore: true,

    // 操作
    showShareMenu: false
  },

  onLoad: function (options) {
    let result = app.globalData.lastAssessmentResult;

    // 当 globalData 中无结果时，尝试通过 recordId 从本地历史中查找
    if (!result && options && options.recordId) {
      const history = storage.getLocalHistory();
      const recordId = options.recordId;
      for (let i = 0; i < history.length; i++) {
        if (String(history[i].id) === String(recordId)) {
          result = history[i];
          break;
        }
      }
    }

    if (!result) {
      wx.showToast({ title: '无测评结果', icon: 'none' });
      setTimeout(function () {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 映射历史记录字段到结果页期望的字段
    // dims = 本地命名，dimensions = 服务端命名，需兼容
    if (result.dimensions !== undefined && result.dims === undefined) {
      // 服务端返回的是 dimensions，统一映射到 dims
      let rawDims = result.dimensions;
      if (typeof rawDims === 'string') {
        try {
          rawDims = JSON.parse(rawDims);
        } catch (e) {
          rawDims = [];
        }
      }
      result.dims = rawDims || [];
    }
    if (result.score !== undefined && result.totalScore === undefined) {
      result.totalScore = result.score;
    }
    if (result.maxScore !== undefined && result.totalMaxScore === undefined) {
      result.totalMaxScore = result.maxScore;
    }
    // 兼容服务端返回的 screeningResult（可能是字符串）
    if (result.screeningResult && typeof result.screeningResult === 'string') {
      try {
        result.screeningResult = JSON.parse(result.screeningResult);
      } catch (e) {}
    }

    const hasScreening = result.screeningResult && result.screeningResult.result !== 'none';
    const isPositive = hasScreening && result.screeningResult.result !== '阴性';

    // 加载 NPC 资源
    const scale = app.globalData.currentScale || {};
    let npcSettings = npcHelper.resolveNpcSetting(scale, result.scaleName);
    if (!npcSettings) {
      npcSettings = {};
    }
    npcSettings.counselorName = npcSettings.counselorName || '';
    npcSettings.motto = npcSettings.motto || '';
    npcSettings.welcomeText = npcSettings.welcomeText || '';
    this._loadNpcAssets(npcSettings);

    this.setData({
      result: result,
      scaleName: result.scaleName,
      emoji: result.emoji || '📋',
      totalScore: result.totalScore,
      totalMaxScore: result.totalMaxScore,
      levelName: result.levelName || '',
      sColor: result.color || '#5b8fb9',
      levelText: result.levelText || result.interp || '',
      dims: result.dims || [],
      showTotalScore: result.showTotalScore !== undefined ? result.showTotalScore : true,
      screeningResult: result.screeningResult,
      hasScreening: hasScreening,
      isScreeningPositive: isPositive,
      npcSettings: npcSettings,
      counselorImage: '' // 先留空，_loadNpcAssets 加载成功后一次性设置
    });
  },

  _loadNpcAssets: function (settings) {
    const self = this;
    console.log(
      '[Result] _loadNpcAssets, counselorId:',
      settings.counselorId || '(空)',
      'bgId:',
      settings.bgId || '(空)'
    );
    if (settings.counselorId) {
      assetManager
        .getAssetPath(settings.counselorId)
        .then(function (path) {
          if (path) {
            self.setData({ counselorImage: path });
          } else {
            return assetManager
              .downloadAsset(settings.counselorId)
              .then(function (dlPath) {
                if (dlPath) {
                  self.setData({ counselorImage: dlPath });
                } else {
                  self.setData({ counselorImage: '/assets/images/counselor.png' });
                }
              })
              .catch(function (err) {
                console.warn('[Result] 咨询师图片下载失败，使用兜底图:', err.message || err);
                self.setData({ counselorImage: '/assets/images/counselor.png' });
              });
          }
        })
        .catch(function (err) {
          console.warn('[Result] 咨询师图片查询异常，使用兜底图:', err.message || err);
          self.setData({ counselorImage: '/assets/images/counselor.png' });
        });
    } else {
      self.setData({ counselorImage: '/assets/images/counselor.png' });
    }
    if (settings.bgId) {
      assetManager
        .getAssetPath(settings.bgId)
        .then(function (path) {
          if (path) {
            self.setData({ backgroundImage: path });
          } else {
            return assetManager
              .downloadAsset(settings.bgId)
              .then(function (dlPath) {
                if (dlPath) {
                  self.setData({ backgroundImage: dlPath });
                }
              })
              .catch(function (err) {
                console.warn('[Result] 背景图下载失败:', err.message || err);
              });
          }
        })
        .catch(function (err) {
          console.warn('[Result] 背景图查询异常:', err.message || err);
        });
    }
  },

  /** AI 诊断 */
  onAiDiag: function () {
    wx.navigateTo({ url: '/pages/ai-diag/ai-diag' });
  },

  /** 重新测评 */
  onRetake: function () {
    const scale = app.globalData.currentScale;
    if (scale) {
      // 清除旧进度，确保从头开始（而非恢复上次中断的位置）
      storage.clearAssessmentProgress();
      wx.redirectTo({ url: '/pages/assessment/assessment' });
    } else {
      wx.navigateBack();
    }
  },

  /** 查看历史 */
  onViewHistory: function () {
    wx.switchTab({ url: '/pages/history/history' });
  },

  /** 分享 */
  onShareAppMessage: function () {
    return {
      title: '我的' + this.data.scaleName + '测评结果',
      path: '/pages/index/index'
    };
  },

  /** 评价反馈 */
  onFeedback: function () {
    const result = this.data.result;
    if (!result) {
      return;
    }

    const self = this;
    const tagOptions = [
      { label: '有帮助', scene: 'overall' },
      { label: '一般', scene: 'overall' },
      { label: '无帮助', scene: 'overall' }
    ];

    wx.showActionSheet({
      itemList: ['有帮助', '一般', '无帮助'],
      success: function (res) {
        const tags = [tagOptions[res.tapIndex].label];
        storage.addFeedback({
          recordId: result.id || Date.now(),
          scene: 'result',
          tags: tags,
          rating: res.tapIndex === 0 ? 5 : res.tapIndex === 1 ? 3 : 1
        });
        wx.showToast({ title: '感谢您的反馈！', icon: 'success' });
      }
    });
  }
});
