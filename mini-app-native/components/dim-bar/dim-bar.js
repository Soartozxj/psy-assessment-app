/**
 * dim-bar — 维度进度条组件
 *
 * 水平进度条 + 百分比 + 等级标签 + 颜色
 * 属性：label, score, maxScore, level, color
 * 支持 collapse/expand 折叠详情
 */

Component({
  properties: {
    label: { type: String, value: '' },
    score: { type: Number, value: 0 },
    maxScore: { type: Number, value: 100 },
    level: { type: String, value: '' },
    levelLabel: { type: String, value: '' },
    color: { type: String, value: '#5b8fb9' },
    detail: { type: String, value: '' },
    expandable: { type: Boolean, value: false }
  },

  data: {
    expanded: false,
    percent: 0
  },

  observers: {
    'score, maxScore': function (score, maxScore) {
      const ms = maxScore || 1;
      const pct = Math.min(100, Math.max(0, Math.round((score / ms) * 100)));
      this.setData({ percent: pct });
    }
  },

  methods: {
    onToggle: function () {
      if (!this.properties.expandable) {
        return;
      }
      this.setData({ expanded: !this.data.expanded });
    }
  }
});
