/**
 * pages/index — 首页（TabBar首页）
 *
 * 问候区 + 搜索框 + 分类网格 + 推荐量表 + 最近完成
 */

const storage = require('../../utils/storage.js');
const api = require('../../utils/api.js');
const constants = require('../../utils/constants.js');

const app = getApp();

/** 分类渐变色对定义 */
const CATEGORY_GRADIENTS = {
  bond: { color1: '#EF6C00', color2: '#FFB74D' },
  personality: { color1: '#6A1B9A', color2: '#BA68C8' },
  spirit: { color1: '#5C6BC0', color2: '#7986CB' },
  stresscoping: { color1: '#00897B', color2: '#4DB6AC' },
  behaviorproblems: { color1: '#c62828', color2: '#ef5350' },
  glow: { color1: '#F57F17', color2: '#FFEE58' }
};

Page({
  data: {
    greeting: '你好',
    userName: '',
    categories: [],
    recommendedScales: [],
    recentRecords: [],
    loading: true
  },

  onLoad: function () {
    this._initCategories();
    this._updateGreeting();
  },

  onShow: function () {
    this._loadRecommended();
    this._loadRecentRecords();
  },

  onPullDownRefresh: function () {
    this._loadRecommended();
    wx.stopPullDownRefresh();
  },

  /** 初始化分类网格（优先使用常量定义，支持动态补充） */
  _initCategories: function () {
    const cached = storage.getScalesCache() || [];

    // 统计每个分类下的量表数量
    const countMap = {};
    cached.forEach(function (s) {
      const cat = s.category || '';
      if (cat) {
        countMap[cat] = (countMap[cat] || 0) + 1;
      }
    });

    let baseCategories = constants.CATEGORIES.map(function (c) {
      const grad = CATEGORY_GRADIENTS[c.key] || { color1: '#5C6BC0', color2: '#7986CB' };
      return {
        key: c.key,
        name: c.name,
        emoji: c.icon,
        color: c.color,
        color1: grad.color1,
        color2: grad.color2,
        count: countMap[c.key] || 0
      };
    });

    // 如果已有量表缓存，检查是否有未覆盖的分类并追加
    if (cached.length > 0) {
      const existingKeys = {};
      baseCategories.forEach(function (c) {
        existingKeys[c.key] = true;
      });
      const catMap = {};
      cached.forEach(function (s) {
        const cat = s.category || '';
        if (cat && !existingKeys[cat] && !catMap[cat]) {
          catMap[cat] = {
            key: cat,
            name: s.categoryName || cat,
            emoji: '📋',
            color: '#4a90d9',
            color1: '#5C6BC0',
            color2: '#7986CB',
            count: countMap[cat] || 0
          };
        }
      });
      const extraCats = Object.values(catMap);
      if (extraCats.length > 0) {
        baseCategories = baseCategories.concat(extraCats);
      }
    }

    const totalCats = baseCategories.length;
    // 奇数分类时，最后一个横跨2列
    if (totalCats > 0 && totalCats % 2 === 1) {
      baseCategories[totalCats - 1].isWide = true;
    }

    this.setData({ categories: baseCategories });
  },

  /** 更新问候语和用户名 */
  _updateGreeting: function () {
    const hour = new Date().getHours();
    let greeting = '你好';
    if (hour < 6) {
      greeting = '夜深了';
    } else if (hour < 12) {
      greeting = '早上好';
    } else if (hour < 14) {
      greeting = '中午好';
    } else if (hour < 18) {
      greeting = '下午好';
    } else {
      greeting = '晚上好';
    }

    const profile = storage.getUserProfile() || {};
    this.setData({
      greeting: greeting,
      userName: profile.nickName || profile.name || ''
    });
  },

  /** 加载推荐量表 */
  _loadRecommended: function () {
    const self = this;
    // 先从缓存加载
    const cached = storage.getScalesCache();
    if (cached && cached.length > 0) {
      let recommended = cached
        .filter(function (s) {
          return s.isRecommended || s.recommend;
        })
        .slice(0, 6);
      if (recommended.length === 0) {
        recommended = cached.slice(0, 6);
      }
      self.setData({ recommendedScales: recommended, loading: false });
    }

    // 再从网络刷新
    api
      .getScales()
      .then(function (scales) {
        if (scales && scales.length > 0) {
          let recommended = scales
            .filter(function (s) {
              return s.isRecommended || s.recommend;
            })
            .slice(0, 6);
          if (recommended.length === 0) {
            recommended = scales.slice(0, 6);
          }
          self.setData({ recommendedScales: recommended, loading: false });
          storage.saveScalesCache(scales);
          // 网络数据返回后重新计算分类数量（修复：缓存刷新但分类计数未更新的问题）
          self._initCategories();
        }
      })
      .catch(function () {
        self.setData({ loading: false });
      });
  },

  /** 加载最近完成记录 */
  _loadRecentRecords: function () {
    const records = storage.getLocalHistory();
    this.setData({
      recentRecords: records.slice(0, 3)
    });
  },

  /** 搜索框点击 → 跳转量表列表 */
  onSearchTap: function () {
    wx.navigateTo({ url: '/pages/scale-list/scale-list?focus=search' });
  },

  /** 分类点击 → 跳转量表列表带分类 */
  onCategoryTap: function (e) {
    const key = e.currentTarget.dataset.key;
    wx.navigateTo({ url: '/pages/scale-list/scale-list?category=' + key });
  },

  /** 推荐量表卡片点击 → 跳转详情 */
  onScaleTap: function (e) {
    const scale = e.detail.scale;
    if (!scale || !scale.id) {
      return;
    }
    app.globalData.currentScale = scale;
    wx.navigateTo({ url: '/pages/scale-detail/scale-detail?id=' + scale.id });
  },

  /** 最近记录点击 */
  onRecentTap: function (e) {
    const record = e.currentTarget.dataset.record;
    if (!record) {
      return;
    }
    // 跳转历史详情
    wx.navigateTo({ url: '/pages/result/result?recordId=' + record.id });
  },

  /** 情绪日记入口 */
  onDiaryTap: function () {
    wx.showToast({ title: '情绪日记即将上线', icon: 'none' });
  },

  /** 测评记录入口 */
  onHistoryTap: function () {
    wx.switchTab({ url: '/pages/history/history' });
  },

  /** 个人中心入口 */
  onMineTap: function () {
    wx.switchTab({ url: '/pages/mine/mine' });
  },

  /** 分享给朋友 */
  onShareAppMessage: function () {
    return {
      title: '星蓝心镜 - 专业的心理健康测评工具',
      path: '/pages/index/index'
    };
  },

  /** 分享到朋友圈 */
  onShareTimeline: function () {
    return {
      title: '星蓝心镜 - 专业的心理健康测评工具'
    };
  }
});
