/**
 * question-parent-child — 父子题组件
 *
 * 主选项 radio-group + 动画展开子选项 checkbox-group
 * 子选项支持 hasInput（"其他"项带输入框）
 * 触发事件：onAnswer，携带 {questionId, answer: {main: index, subs: [indices]}}
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
    mainOptions: [],
    subOptions: [],
    selectedMain: -1,
    selectedSubs: [],
    selectedSubsMap: {},
    showSubs: false,
    otherText: ''
  },

  observers: {
    question: function (q) {
      if (!q) {
        return;
      }
      // 主选项：question.options 中 type !== 'sub' 的项
      const mains = [];
      let subs = [];
      if (q.options) {
        for (let i = 0; i < q.options.length; i++) {
          if (q.options[i].type === 'sub') {
            subs.push(q.options[i]);
          } else {
            // 补全 idx（用于 data-index 绑定）和 letter
            const opt = Object.assign({}, q.options[i]);
            if (opt.idx === undefined) {
              opt.idx = i;
            }
            if (!opt.letter) {
              opt.letter = String.fromCharCode(65 + i);
            } // A, B, C...
            mains.push(opt);
          }
        }
      }
      // 兼容 subOptions 字段，同时补全 idx
      if (q.subOptions && q.subOptions.length > 0) {
        subs = q.subOptions.map(function (opt, i) {
          const o = Object.assign({}, opt);
          if (o.idx === undefined) {
            o.idx = i;
          }
          return o;
        });
      }
      this.setData({
        mainOptions: mains,
        subOptions: subs
      });
      this._syncValue();
    },
    value: function () {
      this._syncValue();
    }
  },

  methods: {
    /** 更新子选项选中状态的 Map（WXML 不支持 .indexOf()） */
    _updateSubsMap: function () {
      const map = {};
      const subs = this.data.selectedSubs;
      for (let i = 0; i < subs.length; i++) {
        map[subs[i]] = true;
      }
      this.setData({ selectedSubsMap: map });
    },

    _syncValue: function () {
      const val = this.properties.value;
      if (!val || typeof val !== 'object') {
        return;
      }
      if (val.main !== undefined) {
        this.setData({
          selectedMain: Number(val.main),
          showSubs: Number(val.main) !== 0
        });
      }
      if (val.subs && Array.isArray(val.subs)) {
        this.setData({ selectedSubs: val.subs });
        this._updateSubsMap();
      }
    },

    onSelectMain: function (e) {
      if (this.properties.disabled) {
        return;
      }
      const idx = e.currentTarget.dataset.index;
      this.setData({
        selectedMain: idx,
        showSubs: idx !== 0,
        selectedSubs: []
      });
      this._updateSubsMap();
      this._emitAnswer();
    },

    onCheckSub: function (e) {
      if (this.properties.disabled) {
        return;
      }
      const idx = Number(e.currentTarget.dataset.index);
      const subs = this.data.selectedSubs.slice();
      const pos = subs.indexOf(idx);
      if (pos > -1) {
        subs.splice(pos, 1);
      } else {
        subs.push(idx);
      }
      this.setData({ selectedSubs: subs });
      this._updateSubsMap();
      this._emitAnswer();
    },

    onOtherInput: function (e) {
      this.setData({ otherText: e.detail.value });
      this._emitAnswer();
    },

    _emitAnswer: function () {
      const answer = {
        main: this.data.selectedMain,
        subs: this.data.selectedSubs
      };
      if (this.data.otherText) {
        answer.otherText = this.data.otherText;
      }
      this.triggerEvent('answer', {
        questionId: this.properties.question.id,
        answer: answer
      });
    }
  }
});
