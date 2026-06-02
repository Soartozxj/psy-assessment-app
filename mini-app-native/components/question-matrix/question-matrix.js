/**
 * question-matrix — 矩阵题组件
 *
 * scroll-view 横滑 + 表格布局
 * 行头固定，每行一个 radio-group
 * 列头为选项标签，行头为维度标签
 * 触发事件：onAnswer，携带 {questionId, answer: {rowId: colIndex}}
 */

Component({
  properties: {
    question: { type: Object, value: {} },
    value: { type: Object, value: {} },
    npcMode: { type: String, value: 'normal' },
    showIndex: { type: Boolean, value: true },
    index: { type: Number, value: 0 },
    disabled: { type: Boolean, value: false }
  },

  data: {
    rows: [],
    cols: [],
    answers: {}
  },

  observers: {
    question: function (q) {
      if (!q) {
        return;
      }
      this.setData({
        rows: q.rows || [],
        cols: q.options || []
      });
    },
    value: function (val) {
      if (val && typeof val === 'object') {
        this.setData({ answers: val });
      }
    }
  },

  methods: {
    onRadioChange: function (e) {
      if (this.properties.disabled) {
        return;
      }
      const rowId = e.currentTarget.dataset.rowId;
      const colIdx = Number(e.detail.value);
      const answers = this.data.answers;
      answers[rowId] = colIdx;
      this.setData({ answers: answers });
      this.triggerEvent('answer', {
        questionId: this.properties.question.id,
        answer: answers
      });
    }
  }
});
