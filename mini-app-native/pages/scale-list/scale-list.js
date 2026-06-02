/**
 * pages/scale-list — 量表列表页
 *
 * 顶部筛选 + 搜索 + 量表卡片列表 + 下拉刷新/触底加载
 */

const api = require('../../utils/api.js');
const storage = require('../../utils/storage.js');
const constants = require('../../utils/constants.js');

Page({
  data: {
    scales: [],
    filteredScales: [],
    keyword: '',
    category: '',
    categoryIndex: 0,
    sortIndex: 0,
    categoryList: ['全部分类'],
    categoryKeys: [''],
    sortList: ['默认排序', '最新发布', '最多测评', '最高评分'],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    emptyText: '暂无量表'
  },

  onLoad: function (options) {
    // 动态构建分类列表（从常量 + 数据补充）
    this._buildCategoryList();

    if (options.category) {
      const idx = this.data.categoryKeys.indexOf(options.category);
      if (idx > -1) {
        this.setData({ categoryIndex: idx, category: options.category });
      }
    }
    if (options.focus === 'search') {
      // 延迟聚焦搜索框
    }
    this._loadScales();
  },

  /** 动态构建分类列表 */
  _buildCategoryList: function () {
    const catList = ['全部分类'];
    const catKeys = [''];

    // 从常量获取基础分类
    constants.CATEGORIES.forEach(function (c) {
      catList.push(c.name);
      catKeys.push(c.key);
    });

    // 从缓存数据补充未覆盖的分类
    const cached = storage.getScalesCache();
    if (cached && cached.length > 0) {
      const existingKeys = {};
      catKeys.forEach(function (k) {
        if (k) {
          existingKeys[k] = true;
        }
      });
      const extraMap = {};
      cached.forEach(function (s) {
        const cat = s.category || '';
        if (cat && !existingKeys[cat] && !extraMap[cat]) {
          extraMap[cat] = s.categoryName || cat;
          catList.push(s.categoryName || cat);
          catKeys.push(cat);
        }
      });
    }

    this.setData({ categoryList: catList, categoryKeys: catKeys });
  },

  onPullDownRefresh: function () {
    this.setData({ page: 1, hasMore: true, scales: [] });
    this._loadScales().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this._loadScales();
    }
  },

  _loadScales: function () {
    const self = this;
    if (this.data.loading) {
      return Promise.resolve();
    }
    this.setData({ loading: true });

    const params = {
      page: this.data.page,
      pageSize: this.data.pageSize
    };
    if (this.data.category) {
      params.category = this.data.category;
    }

    return api
      .getScales()
      .then(function (scales) {
        let list = Array.isArray(scales) ? scales : scales.list || scales.data || [];
        // 客户端筛选分类
        if (self.data.category) {
          list = list.filter(function (s) {
            return s.category === self.data.category;
          });
        }
        const allScales = self.data.page === 1 ? list : self.data.scales.concat(list);
        self.setData({
          scales: allScales,
          filteredScales: self._filterScales(allScales, self.data.keyword),
          hasMore: list.length >= self.data.pageSize,
          page: self.data.page + 1,
          loading: false,
          emptyText: allScales.length === 0 ? '暂无量表' : '没有匹配的量表'
        });
        storage.saveScalesCache(allScales);
      })
      .catch(function () {
        // 降级：从缓存加载
        const cached = storage.getScalesCache() || [];
        self.setData({
          scales: cached,
          filteredScales: self._filterScales(cached, self.data.keyword),
          loading: false,
          emptyText: '网络异常，显示缓存数据'
        });
      });
  },

  _filterScales: function (scales, keyword) {
    if (!keyword) {
      return scales;
    }
    const kw = keyword.toLowerCase();
    return scales.filter(function (s) {
      return (
        (s.name || s.title || '').toLowerCase().indexOf(kw) > -1 || (s.description || '').toLowerCase().indexOf(kw) > -1
      );
    });
  },

  onSearchInput: function (e) {
    const keyword = e.detail.value;
    this.setData({
      keyword: keyword,
      filteredScales: this._filterScales(this.data.scales, keyword)
    });
  },

  onCategoryChange: function (e) {
    const idx = Number(e.detail.value);
    this.setData({
      categoryIndex: idx,
      category: this.data.categoryKeys[idx],
      page: 1,
      hasMore: true,
      scales: [],
      filteredScales: []
    });
    this._loadScales();
  },

  onSortChange: function (e) {
    this.setData({ sortIndex: Number(e.detail.value) });
  },

  onScaleTap: function (e) {
    const scale = e.detail.scale;
    if (!scale || !scale.id) {
      return;
    }
    getApp().globalData.currentScale = scale;
    wx.navigateTo({ url: '/pages/scale-detail/scale-detail?id=' + scale.id });
  }
});
