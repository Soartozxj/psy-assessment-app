const CATEGORIES = [
  { id: 'bond', name: '家庭与人际关系', emoji: '👨‍👩‍👧', count: 5, c1: '#5C6BC0', c2: '#7986CB' },
  { id: 'personality', name: '人格特质评估', emoji: '🧠', count: 7, c1: '#5C8A6E', c2: '#81C784' },
  { id: 'spirit', name: '心理健康筛查', emoji: '❤️', count: 3, c1: '#c62828', c2: '#ef5350' },
  { id: 'stresscoping', name: '应激与应对', emoji: '🌊', count: 4, c1: '#EF6C00', c2: '#FFB74D' },
  { id: 'behaviorproblems', name: '行为问题', emoji: '🎯', count: 8, c1: '#1565C0', c2: '#64B5F6' },
  { id: 'glow', name: '积极心理', emoji: '✨', count: 2, c1: '#00897B', c2: '#4DB6AC' },
  { id: 'comprehensive', name: '其他量表', emoji: '📋', count: 1, c1: '#37474F', c2: '#78909C' }
];

function buildRows(list, size) {
  const rows = [];
  for (let i = 0; i < list.length; i += size) {
    rows.push(list.slice(i, i + size));
  }
  // 标记最后一行为奇数时最后一个卡片全宽
  if (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    if (lastRow.length === 1 && size === 2) {
      lastRow[0].isLastFull = true;
    }
  }
  return rows;
}

Page({
  data: {
    catRows: buildRows(CATEGORIES, 2)
  },

  onCategoryTap(e) {
    const cat = e.currentTarget.dataset.category;
    wx.navigateTo({ url: '/pages/scales/scales?category=' + cat });
  },

  onSearchTap() {
    wx.navigateTo({ url: '/pages/scales/scales' });
  }
});
