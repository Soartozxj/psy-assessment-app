// pages/diary/list.js
const api = require('../../utils/api.js');

Page({
  data: {
    diaryList: [],
    loading: true,
    totalEntries: 0,
    avgMood: 0,
    streakDays: 0,
    page: 1,
    hasMore: true
  },

  onLoad: function () {
    this._loadDiaryList();
    this._loadStats();
  },

  onShow: function () {
    this._loadDiaryList();
    this._loadStats();
  },

  onReachBottom: function () {
    if (this.data.hasMore) {
      this._loadMore();
    }
  },

  onPullDownRefresh: function () {
    this.setData({ page: 1, hasMore: true });
    this._loadDiaryList();
    this._loadStats();
    wx.stopPullDownRefresh();
  },

  _loadDiaryList: function () {
    const self = this;
    self.setData({ loading: true });

    api.fetchDiaryEntries(self.data.page, 20)
      .then(function (res) {
        if (res && res.list) {
          const list = res.list.map(function (item) {
            return {
              id: item.id,
              dateStr: self._formatDate(item.created_at),
              moodScore: item.mood_score,
              moodEmoji: item.mood_emoji || self._getMoodEmoji(item.mood_score),
              content: item.content || ''
            };
          });

          self.setData({
            diaryList: list,
            totalEntries: res.total || 0,
            hasMore: list.length >= 20,
            loading: false
          });
        } else {
          self.setData({ loading: false });
        }
      })
      .catch(function (err) {
        console.error('[DIARY-LIST] 加载失败:', err);
        self.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  _loadMore: function () {
    const self = this;
    const nextPage = self.data.page + 1;

    api.fetchDiaryEntries(nextPage, 20)
      .then(function (res) {
        if (res && res.list && res.list.length > 0) {
          const newList = res.list.map(function (item) {
            return {
              id: item.id,
              dateStr: self._formatDate(item.created_at),
              moodScore: item.mood_score,
              moodEmoji: item.mood_emoji || self._getMoodEmoji(item.mood_score),
              content: item.content || ''
            };
          });

          self.setData({
            diaryList: self.data.diaryList.concat(newList),
            page: nextPage,
            hasMore: newList.length >= 20
          });
        } else {
          self.setData({ hasMore: false });
        }
      })
      .catch(function (err) {
        console.error('[DIARY-LIST] 加载更多失败:', err);
      });
  },

  _loadStats: function () {
    const self = this;

    api.fetchDiaryStats('week')
      .then(function (res) {
        if (res && res.summary) {
          self.setData({
            avgMood: parseFloat(res.summary.avg_mood || 0).toFixed(1),
            streakDays: self._calculateStreak(res.stats || [])
          });
        }
      })
      .catch(function (err) {
        console.error('[DIARY-STATS] 加载失败:', err);
      });
  },

  _calculateStreak: function (stats) {
    if (!stats || stats.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      const hasEntry = stats.some(function (stat) {
        return stat.date === dateStr;
      });

      if (hasEntry) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  },

  _formatDate: function (dateStr) {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return month + '月' + day + '日';
  },

  _getMoodEmoji: function (score) {
    const emojiMap = {
      1: '😔',
      2: '😕',
      3: '😐',
      4: '😊',
      5: '😄'
    };
    return emojiMap[score] || '😐';
  },

  onDiaryTap: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/diary/diary?id=' + id
    });
  },

  onDeleteTap: function (e) {
    const id = e.currentTarget.dataset.id;
    const self = this;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条日记吗？',
      success: function (res) {
        if (res.confirm) {
          api.deleteDiary(id)
            .then(function () {
              wx.showToast({ title: '删除成功', icon: 'success' });
              self._loadDiaryList();
              self._loadStats();
            })
            .catch(function (err) {
              wx.showToast({ title: '删除失败', icon: 'none' });
            });
        }
      }
    });
  },

  onAddTap: function () {
    wx.navigateTo({
      url: '/pages/diary/diary'
    });
  },

  onShareAppMessage: function () {
    return {
      title: '星蓝心镜 - 情绪日记',
      path: '/pages/diary/list'
    };
  }
});
