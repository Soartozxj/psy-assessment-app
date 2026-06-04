// pages/meditation/meditation.js
const api = require('../../utils/api.js');

Page({
  data: {
    currentCategory: 'all',
    audioList: [],
    loading: true
  },

  onLoad: function () {
    this._loadAudioList();
  },

  onShow: function () {
    this._loadAudioList();
  },

  onPullDownRefresh: function () {
    this._loadAudioList();
    wx.stopPullDownRefresh();
  },

  /** 切换分类 */
  onCategoryTap: function (e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ currentCategory: category });
    this._loadAudioList();
  },

  /** 加载音频列表 */
  _loadAudioList: function () {
    const self = this;
    self.setData({ loading: true });

    const category = this.data.currentCategory;
    const query = category === 'all' ? '' : `?category=${category}`;

    api.get(`/api/meditation/audios${query}`)
      .then(function (res) {
        if (res && res.list) {
          const list = res.list.map(function (item) {
            return {
              id: item.id,
              title: item.title,
              description: item.description || '暂无描述',
              category: item.category,
              durationStr: self._formatDuration(item.duration),
              playCount: item.play_count || 0,
              coverUrl: item.cover_url || ''
            };
          });
          self.setData({
            audioList: list,
            loading: false
          });
        } else {
          self.setData({ loading: false });
        }
      })
      .catch(function (err) {
        console.error('[MEDITATION] 加载音频列表失败:', err);
        self.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  /** 格式化时长 */
  _formatDuration: function (seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  /** 点击音频 */
  onAudioTap: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/meditation/player?id=${id}`
    });
  },

  /** 分享 */
  onShareAppMessage: function () {
    return {
      title: '星蓝心镜 - 冥想放松',
      path: '/pages/meditation/meditation'
    };
  }
});
