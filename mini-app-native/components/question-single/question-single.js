/**
 * question-single — 单选题组件
 *
 * 渲染 radio-group + 选项卡片（色条+文字+分值标签）
 * 支持 NPC 对话模式的普通模式
 * 触发事件：onAnswer，携带 {questionId, answer}
 */

Component({
  properties: {
    /** 题目对象 */
    question: { type: Object, value: {} },
    /** 当前已选答案（optionId 或 index） */
    value: { type: null, value: null },
    /** NPC 模式：immersive / normal */
    npcMode: { type: String, value: 'normal' },
    /** 是否显示题号 */
    showIndex: { type: Boolean, value: true },
    /** 当前题序号（从1开始） */
    index: { type: Number, value: 0 },
    /** 是否禁用（已提交后不可更改） */
    disabled: { type: Boolean, value: false }
  },

  data: {
    selectedIndex: -1,
    renderedOptions: []
  },

  observers: {
    'question.options': function (opts) {
      if (!opts || !opts.length) {
        this.setData({ renderedOptions: [] });
        return;
      }
      const rendered = opts.map(function (o, i) {
        return {
          idx: i,
          id: o.id !== undefined ? o.id : String.fromCharCode(65 + i),
          letter: String.fromCharCode(65 + i),
          label: o.label || '',
          score: o.score || 0
        };
      });
      this.setData({ renderedOptions: rendered });
      this._syncSelection();
    },
    value: function () {
      this._syncSelection();
    }
  },

  methods: {
    /** 同步外部 value 到内部 selectedIndex */
    _syncSelection: function () {
      const val = this.properties.value;
      const opts = this.data.renderedOptions;
      if (val === null || val === undefined) {
        this.setData({ selectedIndex: -1 });
        return;
      }
      for (let i = 0; i < opts.length; i++) {
        if (opts[i].id == val || i == val) {
          this.setData({ selectedIndex: i });
          return;
        }
      }
      this.setData({ selectedIndex: -1 });
    },

    /** 选项点击 */
    onSelectOption: function (e) {
      if (this.properties.disabled) {
        return;
      }
      const idx = e.currentTarget.dataset.index;
      const opts = this.data.renderedOptions;
      if (idx < 0 || idx >= opts.length) {
        return;
      }

      this.setData({ selectedIndex: idx });
      this.triggerEvent('answer', {
        questionId: this.properties.question.id,
        answer: opts[idx].id
      });
    }
  }
});
