// pages/diary/stats.js
const api = require('../../utils/api.js');

Page({
  data: {
    currentPeriod: 'week',
    avgMood: 0,
    totalEntries: 0,
    bestMood: 0,
    worstMood: 0,
    chartData: [],
    distribution: []
  },

  onLoad: function () {
    this._loadStats();
  },

  onShow: function () {
    this._loadStats();
  },

  onPullDownRefresh: function () {
    this._loadStats();
    wx.stopPullDownRefresh();
  },

  /** 切换统计周期 */
  onPeriodTap: function (e) {
    const period = e.currentTarget.dataset.period;
    this.setData({ currentPeriod: period });
    this._loadStats();
  },

  /** 加载统计数据 */
  _loadStats: function () {
    const self = this;
    const period = this.data.currentPeriod;

    wx.showLoading({ title: '加载中...' });

    api.fetchDiaryStats(period)
      .then(function (res) {
        wx.hideLoading();

        if (res) {
          // 处理统计数据
          const summary = res.summary || {};
          const stats = res.stats || [];

          // 计算分布
          const distribution = self._calculateDistribution(stats);

          // 生成图表数据
          const chartData = self._generateChartData(stats, period);

          self.setData({
            avgMood: parseFloat(summary.avg_mood || 0).toFixed(1),
            totalEntries: summary.total_entries || 0,
            bestMood: summary.max_mood || 0,
            worstMood: summary.min_mood || 0,
            chartData: chartData,
            distribution: distribution
          });
        }
      })
      .catch(function (err) {
        wx.hideLoading();
        console.error('[DIARY-STATS] 加载失败:', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  /** 计算情绪分布 */
  _calculateDistribution: function (stats) {
    if (!stats || stats.length === 0) return [];

    // 按情绪评分分组
    const groups = {};
    stats.forEach(function (item) {
      const score = Math.round(item.avg_mood) || 3;
      groups[score] = (groups[score] || 0) + item.count;
    });

    // 转换为分布数据
    const total = stats.reduce(function (sum, item) { return sum + item.count; }, 0);
    const distribution = [];
    const emojiMap = { 1: '😔', 2: '😕', 3: '😐', 4: '😊', 5: '😄' };
    const colorMap = { 1: '#d0021b', 2: '#f5a623', 3: '#7ed321', 4: '#4a90d9', 5: '#9013fe' };

    for (let score = 1; score <= 5; score++) {
      const count = groups[score] || 0;
      distribution.push({
        mood: score,
        emoji: emojiMap[score],
        color: colorMap[score],
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      });
    }

    return distribution;
  },

  /** 生成图表数据 */
  _generateChartData: function (stats, period) {
    if (!stats || stats.length === 0) return [];

    // 根据周期确定显示天数
    let days = 7;
    if (period === 'month') days = 30;
    else if (period === 'year') days = 12; // 按月份显示

    const chartData = [];
    const maxScore = 5;

    // 生成日期标签和数据
    for (let i = 0; i < Math.min(stats.length, 7); i++) {
      const item = stats[i];
      const date = new Date(item.date);
      const label = (date.getMonth() + 1) + '/' + date.getDate();
      const height = Math.round((item.avg_mood / maxScore) * 200);

      let color = '#4a90d9';
      if (item.avg_mood <= 2) color = '#d0021b';
      else if (item.avg_mood <= 3) color = '#f5a623';
      else if (item.avg_mood >= 4) color = '#7ed321';

      chartData.push({
        date: item.date,
        label: label,
        height: height,
        color: color
      });
    }

    return chartData;
  },

  /** 分享 */
  onShareAppMessage: function () {
    return {
      title: '星蓝心镜 - 情绪统计',
      path: '/pages/diary/stats'
    };
  }
});
