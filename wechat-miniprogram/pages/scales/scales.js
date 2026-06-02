const scalesSummary = [
  {
    name: '父母共同教养关系感知量表',
    code: 'PPCRS',
    category: 'bond',
    categoryName: '家庭与人际关系量表',
    emoji: '👨‍👩‍👧',
    questionCount: 15,
    duration: 7,
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
    tags: ['应对', ' coping']
  },
  {
    name: '青少年心理健康量表',
    code: 'CPTI',
    category: 'behaviorproblems',
    categoryName: '行为问题量表',
    emoji: '🎯',
    questionCount: 50,
    duration: 15,
    tags: ['青少年', '心理健康']
  },
  {
    name: '亲子关系诊断量表',
    code: 'PCRS',
    category: 'bond',
    categoryName: '家庭与人际关系量表',
    emoji: '👪',
    questionCount: 50,
    duration: 15,
    tags: ['亲子', '家庭']
  },
  {
    name: '儿童行为量表',
    code: 'CBCL',
    category: 'behaviorproblems',
    categoryName: '行为问题量表',
    emoji: '👶',
    questionCount: 113,
    duration: 20,
    tags: ['儿童', '行为']
  },
  {
    name: '艾森克人格问卷',
    code: 'EPQ',
    category: 'personality',
    categoryName: '人格特质评估量表',
    emoji: '🎭',
    questionCount: 88,
    duration: 20,
    tags: ['人格', 'Eysenck']
  }
];

const CAT_PALETTE = {
  bond: '#5C6BC0',
  personality: '#5C8A6E',
  spirit: '#c62828',
  stresscoping: '#EF6C00',
  behaviorproblems: '#1565C0',
  glow: '#00897B',
  comprehensive: '#37474F'
};

Page({
  data: {
    filtered: [],
    categoryFilter: '',
    searchText: '',
    categories: []
  },

  onLoad(options) {
    const cat = options.category || '';
    const cats = {};
    scalesSummary.forEach((s) => {
      const c = s.category || 'other';
      if (!cats[c]) {
        cats[c] = { id: c, name: s.categoryName || c, emoji: s.emoji || '📋', count: 0 };
      }
      cats[c].count++;
    });
    const enriched = scalesSummary.map((s) => ({
      ...s,
      catColor: CAT_PALETTE[s.category] || '#37474F'
    }));
    this.setData({
      filtered: enriched,
      categoryFilter: cat,
      categories: Object.values(cats)
    });
    if (cat) {
      this.filterByCategory(cat);
    }
  },

  onSearchInput(e) {
    const kw = (e.detail.value || '').toLowerCase();
    this.applyFilters(kw, this.data.categoryFilter);
  },

  onCategoryTap(e) {
    const cat = e.currentTarget.dataset.category;
    this.filterByCategory(cat === this.data.categoryFilter ? '' : cat);
  },

  applyFilters(kw, cat) {
    let list = scalesSummary.map((s) => ({ ...s, catColor: CAT_PALETTE[s.category] || '#37474F' }));
    if (cat) {
      list = list.filter((s) => s.category === cat);
    }
    if (kw) {
      list = list.filter((s) => (s.name || '').toLowerCase().includes(kw));
    }
    this.setData({ filtered: list, categoryFilter: cat, searchText: kw });
  },

  onSelectScale(e) {
    wx.navigateTo({ url: '/pages/detail/detail?code=' + e.currentTarget.dataset.code });
  }
});
