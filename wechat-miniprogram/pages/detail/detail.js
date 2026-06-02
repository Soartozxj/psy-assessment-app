const scalesSummary = [
  {
    name: '父母共同教养关系感知量表',
    code: 'PPCRS',
    category: 'bond',
    categoryName: '家庭与人际关系量表',
    emoji: '👨‍👩‍👧',
    questionCount: 15,
    duration: 7,
    desc: '了解父母在教育过程中的共同参与、一致性和支持程度，帮助改善家庭教育方式。',
    tags: ['家庭教育', '关系评估']
  },
  {
    name: '大五人格简版',
    code: 'CBF_PI_B',
    category: 'personality',
    categoryName: '人格特质评估量表',
    emoji: '🧠',
    questionCount: 15,
    duration: 7,
    desc: '从五个人格维度评估个体特质，了解自己的开放、尽责、外向、宜人和神经质水平。',
    tags: ['人格', '特质']
  },
  {
    name: '焦虑自评量表',
    code: 'SAS',
    category: 'spirit',
    categoryName: '心理健康与精神病态量表',
    emoji: '😰',
    questionCount: 20,
    duration: 10,
    desc: '用于评估焦虑状态的自评工具，了解近一周的焦虑感受程度。',
    tags: ['焦虑', '情绪']
  },
  {
    name: '抑郁自评量表',
    code: 'SDS',
    category: 'spirit',
    categoryName: '心理健康与精神病态量表',
    emoji: '😔',
    questionCount: 20,
    duration: 10,
    desc: '用于评估抑郁状态的自评工具，了解近一周的情绪低落程度。',
    tags: ['抑郁', '情绪']
  },
  {
    name: '生活事件量表',
    code: 'LES',
    category: 'stresscoping',
    categoryName: '应激与应对量表',
    emoji: '📋',
    questionCount: 48,
    duration: 15,
    desc: '评估过去一年中经历的生活事件及其对个人的影响程度。',
    tags: ['生活事件', '应激']
  },
  {
    name: '简易应对方式问卷',
    code: 'SCSQ',
    category: 'stresscoping',
    categoryName: '应激与应对量表',
    emoji: '💪',
    questionCount: 20,
    duration: 8,
    desc: '评估您在面对压力时倾向采用的应对方式，分为积极和消极应对两个维度。',
    tags: ['应对', 'coping']
  },
  {
    name: '青少年心理健康量表',
    code: 'CPTI',
    category: 'behaviorproblems',
    categoryName: '行为问题量表',
    emoji: '🎯',
    questionCount: 50,
    duration: 15,
    desc: '专门针对青少年群体的心理健康评估工具，涵盖情绪、行为、社交等多方面。',
    tags: ['青少年', '心理健康']
  }
];

Page({
  data: {
    scale: null,
    emoji: '📋',
    showFullDesc: false,
    descTruncated: ''
  },

  onLoad(options) {
    const code = options.code;
    const s = scalesSummary.find(function (x) {
      return x.code === code;
    });
    if (s) {
      const desc = s.desc || '';
      const truncated = desc.length > 120 ? desc.substring(0, 120) + '...' : desc;
      this.setData({
        scale: s,
        emoji: s.emoji || '📋',
        descTruncated: truncated,
        showFullDesc: desc.length <= 120
      });
      wx.setNavigationBarTitle({ title: s.name });
    }
  },

  toggleDesc() {
    this.setData({ showFullDesc: !this.data.showFullDesc });
  },

  startAssessment() {
    const code = this.data.scale.code;
    wx.navigateTo({ url: '/pages/assessment/assessment?code=' + code });
  },

  onShareAppMessage() {
    return {
      title: this.data.scale.name + ' - 星蓝心镜',
      path: '/pages/detail/detail?code=' + this.data.scale.code
    };
  }
});
