/**
 * pages/mine — 我的（TabBar页面）
 *
 * 用户信息 + 测评统计 + 菜单列表
 */

const storage = require('../../utils/storage.js');

const app = getApp();

Page({
  data: {
    userInfo: null,
    nickName: '',
    avatarUrl: '',
    totalDone: 0,
    recentDone: 0,
    favoritesCount: 0,
    menuList: [
      { key: 'profile', icon: '👤', label: '我的资料', url: '/pages/profile-edit/profile-edit' },
      { key: 'favorites', icon: '⭐', label: '收藏报告', url: '/pages/report-favorites/report-favorites' },
      { key: 'notification', icon: '🔔', label: '通知', url: '/pages/notification/notification' },
      { key: 'about', icon: 'ℹ️', label: '关于', url: '/pages/about/about' },
      { key: 'privacy', icon: '🔒', label: '隐私政策', url: '/pages/privacy/privacy' }
    ]
  },

  onShow: function () {
    this._loadUserInfo();
    this._loadStats();
  },

  _loadUserInfo: function () {
    const profile = storage.getUserProfile() || {};
    this.setData({
      userInfo: profile,
      nickName: profile.nickName || profile.name || '未设置',
      avatarUrl: profile.avatarUrl || ''
    });
  },

  _loadStats: function () {
    const history = storage.getLocalHistory();
    const totalDone = history.length;
    // 最近7天
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    let recentDone = 0;
    for (let i = 0; i < history.length; i++) {
      const ts = new Date(history[i].completedAt || history[i].date).getTime();
      if (ts > weekAgo) {
        recentDone++;
      }
    }
    const settings = storage.getSettings() || {};
    const favCount = (settings.favorites || []).length;

    this.setData({
      totalDone: totalDone,
      recentDone: recentDone,
      favoritesCount: favCount
    });
  },

  onMenuTap: function (e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.navigateTo({ url: url });
    }
  },

  onEditProfile: function () {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' });
  }
});
