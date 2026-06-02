/**
 * question-text — 文字题组件
 *
 * textarea 多行输入 或 input 单行输入
 * 字数统计（maxlength）
 * 触发事件：onAnswer，携带 {questionId, answer: text}
 */

Component({
  properties: {
    question: { type: Object, value: {} },
    value: { type: String, value: '' },
    npcMode: { type: String, value: 'normal' },
    showIndex: { type: Boolean, value: true },
    index: { type: Number, value: 0 },
    disabled: { type: Boolean, value: false }
  },

  data: {
    textValue: '',
    charCount: 0,
    maxLength: 500,
    multiline: true
  },

  observers: {
    question: function (q) {
      if (!q) {
        return;
      }
      this.setData({
        maxLength: q.maxLength || q.maxlength || 500,
        multiline: q.multiline !== false,
        textValue: this.properties.value || '',
        charCount: (this.properties.value || '').length
      });
    },
    value: function (val) {
      this.setData({
        textValue: val || '',
        charCount: (val || '').length
      });
    }
  },

  methods: {
    onInput: function (e) {
      if (this.properties.disabled) {
        return;
      }
      const text = e.detail.value;
      this.setData({
        textValue: text,
        charCount: text.length
      });
      this.triggerEvent('answer', {
        questionId: this.properties.question.id,
        answer: text
      });
    }
  }
});
