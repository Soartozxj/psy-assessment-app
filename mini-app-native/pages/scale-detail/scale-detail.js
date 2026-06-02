/**
 * pages/scale-detail — 量表详情页
 *
 * NPC场景 + 量表信息 + 模式选择 + 开始测评
 */

const api = require('../../utils/api.js');
const npcHelper = require('../../utils/npc-helper.js');
const assetManager = require('../../utils/asset-manager.js');
const storage = require('../../utils/storage.js');

const app = getApp();

Page({
  data: {
    scale: null,
    npcSettings: { counselorName: '', motto: '', welcomeText: '' },
    counselorImage: '',
    backgroundImage: '',
    questionCount: 0,
    estimatedTime: '',
    participantCount: 0,
    notices: [],
    tags: [],
    selectedMode: 'immersive',
    loading: true
  },

  onLoad: function (options) {
    const scale = app.globalData.currentScale;
    console.log(
      '[ScaleDetail] onLoad, globalScale:',
      scale ? scale.name || scale.title : 'null',
      'options.id:',
      options.id
    );
    if (!scale && options.id) {
      this._loadScale(options.id);
      return;
    }
    if (scale) {
      this._initWithScale(scale);
    } else {
      wx.showToast({ title: '量表不存在', icon: 'none' });
      setTimeout(function () {
        wx.navigateBack();
      }, 1500);
    }
  },

  _loadScale: function (id) {
    // 后端无单量表详情接口，从本地缓存中查找
    let scale = app.getScaleById(Number(id)) || app.getScaleById(id);
    if (scale) {
      this._initWithScale(scale);
    } else {
      // 尝试从缓存量表列表中匹配
      const cached = storage.getScalesCache() || [];
      for (let i = 0; i < cached.length; i++) {
        if (cached[i].id == id) {
          scale = cached[i];
          break;
        }
      }
      if (scale) {
        this._initWithScale(scale);
      } else {
        wx.showToast({ title: '量表不存在', icon: 'none' });
      }
    }
  },

  _initWithScale: function (scale) {
    app.globalData.currentScale = scale;
    const qCount = (scale.questions || []).length || scale.questionCount || 0;
    console.log(
      '[ScaleDetail] _initWithScale, name:',
      scale.name || scale.title,
      'questions:',
      (scale.questions || []).length,
      'qCount:',
      qCount
    );
    const eTime = scale.estimatedTime || (qCount ? Math.ceil(qCount * 0.5) + '分钟' : '');
    const pCount = scale.participantCount || scale.usageCount || 0;
    let notices = scale.notices || scale.notice || [];
    if (typeof notices === 'string') {
      notices = [notices];
    }

    // 解析标签
    let tags = scale.tags || [];
    if (!Array.isArray(tags) || tags.length === 0) {
      // 从分类名生成默认标签
      const catName = scale.categoryName || '';
      if (catName) {
        tags = [catName];
      }
    }

    // 解析 NPC 配置
    let npcSettings = npcHelper.resolveNpcSetting(scale, scale.name || scale.title);
    if (!npcSettings) {
      npcSettings = {};
    }
    npcSettings.counselorName = npcSettings.counselorName || '';
    npcSettings.motto = npcSettings.motto || '';
    npcSettings.welcomeText = npcSettings.welcomeText || '';

    // 先设置基础数据（不含 counselorImage，避免兜底图→真实图的两次重渲染）
    this.setData({
      scale: scale,
      npcSettings: npcSettings,
      questionCount: qCount,
      estimatedTime: eTime,
      participantCount: pCount,
      notices: notices,
      tags: tags,
      loading: false
    });

    // 加载 NPC 图片（加载成功后一次性设置 counselorImage）
    this._loadNpcAssets(npcSettings);
  },

  _loadNpcAssets: function (settings) {
    const self = this;
    console.log(
      '[ScaleDetail] _loadNpcAssets, counselorId:',
      settings.counselorId || '(空)',
      'bgId:',
      settings.bgId || '(空)'
    );
    if (settings.counselorId) {
      assetManager
        .getAssetPath(settings.counselorId)
        .then(function (path) {
          if (path) {
            console.log('[ScaleDetail] 咨询师图片缓存命中:', path.substring(0, 50));
            self.setData({ counselorImage: path });
          } else {
            // 缓存未命中，从云端下载
            console.log('[ScaleDetail] 咨询师图片缓存未命中，开始下载:', settings.counselorId);
            return assetManager
              .downloadAsset(settings.counselorId)
              .then(function (dlPath) {
                if (dlPath) {
                  console.log('[ScaleDetail] 咨询师图片下载成功:', dlPath.substring(0, 50));
                  self.setData({ counselorImage: dlPath });
                } else {
                  // 下载返回空路径，使用兜底图
                  console.warn('[ScaleDetail] 咨询师图片下载返回空，使用兜底图');
                  self.setData({ counselorImage: '/assets/images/counselor.png' });
                }
              })
              .catch(function (err) {
                console.warn('[ScaleDetail] 咨询师图片下载失败，使用兜底图:', err.message || err);
                self.setData({ counselorImage: '/assets/images/counselor.png' });
              });
          }
        })
        .catch(function (err) {
          console.warn('[ScaleDetail] 咨询师图片查询异常，使用兜底图:', err.message || err);
          self.setData({ counselorImage: '/assets/images/counselor.png' });
        });
    } else {
      // 没有配置 counselorId，直接使用兜底图
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
                console.warn('[ScaleDetail] 背景图下载失败:', err.message || err);
              });
          }
        })
        .catch(function (err) {
          console.warn('[ScaleDetail] 背景图查询异常:', err.message || err);
        });
    }
  },

  /** 模式选择 */
  onSelectMode: function (e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ selectedMode: mode });
  },

  /** 模式循环切换 */
  onToggleMode: function () {
    const next = this.data.selectedMode === 'immersive' ? 'normal' : 'immersive';
    this.setData({ selectedMode: next });
  },

  /** 开始测评 */
  onStartAssessment: function () {
    const scale = this.data.scale;
    const mode = this.data.selectedMode;
    if (!scale) {
      return;
    }

    // 清除旧进度，确保从头开始（而非恢复上次中断的位置）
    storage.clearAssessmentProgress();

    app.globalData.currentScale = scale;
    app.globalData.currentNpcMode = mode;

    if (scale.preQuestions && scale.preQuestions.length > 0) {
      wx.navigateTo({ url: '/pages/pre-questions/pre-questions' });
    } else {
      wx.navigateTo({ url: '/pages/assessment/assessment' });
    }
  },

  /** 分享给朋友 */
  onShareAppMessage: function () {
    const scale = this.data.scale;
    return {
      title: (scale ? scale.name || scale.title || '' : '心理测评') + ' - 星蓝心镜',
      path: '/pages/index/index'
    };
  }
});
