// pages/meditation/history.js
const api = require('../../utils/api.js');

Page({
  data: {
    historyList: [],
    loading: true,
    totalSessions: 0,
    totalDuration: 0,
    completedSessions: 0,
    streakDays: 0
  },

  onLoad: function () {
    this._loadStats();
    this._loadHistory();
  },

  onShow: function () {
    this._loadStats();
    this._loadHistory();
  },

  onPullDownRefresh: function () {
    this._loadStats();
    this._loadHistory();
    wx.stopPullDownRefresh();
  },

  /** 加载统计数据 */
  _loadStats: function () {
    const self = this;

    api.fetchMeditationStats()
      .then(function (res) {
        if (res) {
          self.setData({
            totalSessions: res.totalSessions || 0,
            totalDuration: res.totalDuration || 0,
            completedSessions: res.completedSessions || 0,
            streakDays: res.streakDays || 0
          });
        }
      })
      .catch(function (err) {
        console.error('[MEDITATION-HISTORY] 加载统计失败:', err);
      });
  },

  /** 加载历史记录 */
  _loadHistory: function () {
    const self = this;
    self.setData({ loading: true });

    api.fetchMeditationHistory(1, 20)
      .then(function (res) {
        if (res && res.list) {
          const list = res.list.map(function (item) {
            return {
              id: item.id,
              dateStr: self._formatDate(item.created_at),
              audioTitle: item.audio_title || '冥想音频',
              durationStr: self._formatDuration(item.duration || 0),
              completed: item.completed === 1
            };
          });

          self.setData({
            historyList: list,
            loading: false
          });
        } else {
          self.setData({ loading: false });
        }
      })
      .catch(function (err) {
        console.error('[MEDITATION-HISTORY] 加载历史失败:', err);
        self.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  /** 格式化日期 */
  _formatDate: function (dateStr) {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${hours}:${minutes}`;
  },

  /** 格式化时长 */
  _formatDuration: function (seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  /** 分享 */
  onShareAppMessage: function () {
    return {
      title: '星蓝心镜 - 冥想历史',
      path: '/pages/meditation/history'
    };
  }
});
