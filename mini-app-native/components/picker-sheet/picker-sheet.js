/**
 * picker-sheet — 底部滑出选择器组件
 *
 * 底部弹出 + 选项列表 + 取消按钮
 * 触发事件：onSelect, onCancel
 * 属性：title, options, visible
 */

Component({
  properties: {
    /** 标题 */
    title: { type: String, value: '请选择' },
    /** 选项列表 [{label, value}] */
    options: { type: Array, value: [] },
    /** 是否显示 */
    visible: { type: Boolean, value: false }
  },

  data: {
    animClass: ''
  },

  observers: {
    visible: function (val) {
      if (val) {
        // 先设置 display，再触发动画
        const self = this;
        setTimeout(function () {
          self.setData({ animClass: 'show' });
        }, 30);
      } else {
        this.setData({ animClass: '' });
      }
    }
  },

  methods: {
    onSelect: function (e) {
      const idx = e.currentTarget.dataset.index;
      const opt = this.properties.options[idx];
      this.triggerEvent('select', { index: idx, option: opt });
    },

    onCancel: function () {
      this.setData({ animClass: '' });
      const self = this;
      setTimeout(function () {
        self.triggerEvent('cancel');
      }, 300);
    },

    onOverlayTap: function () {
      this.onCancel();
    },

    preventBubble: function () {}
  }
});
