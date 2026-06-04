// pages/diary/diary.js
const api = require('../../utils/api.js');
const storage = require('../../utils/storage.js');

const MOOD_LABELS = {
  0: '请选择心情',
  1: '😔 很低落',
  2: '😕 有点低落',
  3: '😐 一般般',
  4: '😊 还不错',
  5: '😄 很开心'
};

Page({
  data: {
    currentDate: '',
    moodScore: 0,
    moodLabel: MOOD_LABELS[0],
    content: '',
    recentAssessments: [],
    relatedAssessmentId: null,
    diaryList: [],
    saving: false
  },

  onLoad: function () {
    this._setCurrentDate();
    this._loadRecentAssessments();
    this._loadDiaryList();
  },

  onShow: function () {
    this._loadRecentAssessments();
    this._loadDiaryList();
  },

  onPullDownRefresh: function () {
    this._loadDiaryList();
    wx.stopPullDownRefresh();
  },

  _setCurrentDate: function () {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    this.setData({
      currentDate: year + '年' + month + '月' + day + '日'
    });
  },

  _loadRecentAssessments: function () {
    const records = storage.getLocalHistory().slice(0, 5);
    this.setData({
      recentAssessments: records
    });
  },

  _loadDiaryList: function () {
    const self = this;
    api.fetchDiaryEntries(1, 5)
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
          self.setData({ diaryList: list });
        }
      })
      .catch(function (err) {
        console.error('[DIARY] 加载日记列表失败:', err);
      });
  },

  _formatDate: function (dateStr) {
    const d = new Date(dateStr);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
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

  onStarTap: function (e) {
    const score = parseInt(e.currentTarget.dataset.score);
    this.setData({
      moodScore: score,
      moodLabel: MOOD_LABELS[score] || ''
    });
  },

  onContentInput: function (e) {
    this.setData({
      content: e.detail.value
    });
  },

  onAssessmentTap: function (e) {
    const id = e.currentTarget.dataset.id;
    const currentId = this.data.relatedAssessmentId;
    this.setData({
      relatedAssessmentId: currentId === id ? null : id
    });
  },

  onSaveTap: function () {
    if (this.data.saving) return;
    if (this.data.moodScore === 0) {
      wx.showToast({ title: '请选择心情评分', icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    const self = this;
    const data = {
      mood_score: this.data.moodScore,
      mood_emoji: this._getMoodEmoji(this.data.moodScore),
      content: this.data.content || null,
      related_assessment_id: this.data.relatedAssessmentId || null
    };

    api.createDiary(data)
      .then(function (res) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        self.setData({
          moodScore: 0,
          moodLabel: MOOD_LABELS[0],
          content: '',
          relatedAssessmentId: null,
          saving: false
        });
        self._loadDiaryList();
      })
      .catch(function (err) {
        wx.showToast({ title: '保存失败', icon: 'none' });
        self.setData({ saving: false });
      });
  },

  onCancelTap: function () {
    wx.navigateBack();
  },

  onShareAppMessage: function () {
    return {
      title: '星蓝心镜 - 记录每一天的心情',
      path: '/pages/diary/diary'
    };
  }
});
