const CAT_NAMES = {
  bond: '家庭与人际关系',
  personality: '人格特质评估',
  spirit: '心理健康筛查',
  stresscoping: '应激与应对',
  behaviorproblems: '行为问题',
  glow: '积极心理',
  comprehensive: '其他'
};

Page({
  data: {
    scaleCode: '',
    scores: {},
    dimensions: [],
    scaleName: '',
    categoryName: '',
    completedTime: ''
  },

  onLoad(options) {
    const code = options.code || '';
    let scores = {};
    let dimensions = [];

    try {
      scores = JSON.parse(decodeURIComponent(options.scores || '{}'));
      dimensions = JSON.parse(decodeURIComponent(options.dimensions || '[]'));
    } catch (e) {}

    const time = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    this.setData({
      scaleCode: code,
      scores: scores,
      dimensions: dimensions,
      completedTime: time
    });
  },

  onShareAppMessage() {
    return {
      title: '我在星蓝心镜完成了一项心理测评，来看看我的结果吧',
      path: '/pages/home/home'
    };
  },

  onTapShare() {
    wx.showShareMenu({});
  },
  onRetest() {
    wx.redirectTo({ url: '/pages/detail/detail?code=' + this.data.scaleCode });
  },
  onGoHome() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
