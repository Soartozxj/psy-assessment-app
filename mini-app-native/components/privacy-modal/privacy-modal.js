/**
 * privacy-modal — 隐私确认弹窗组件
 *
 * 遮罩 + 弹窗卡片 + 隐私协议文本 + 同意/拒绝按钮
 * 触发事件：onAgree, onReject
 */

Component({
  properties: {
    /** 是否显示弹窗 */
    visible: { type: Boolean, value: false },
    /** 协议标题 */
    title: { type: String, value: '用户隐私保护提示' },
    /** 协议内容 */
    content: { type: String, value: '' }
  },

  data: {
    agreeChecked: false
  },

  methods: {
    onAgree: function () {
      this.setData({ agreeChecked: true });
      this.triggerEvent('agree');
    },

    onReject: function () {
      this.triggerEvent('reject');
    },

    /** 阻止冒泡（点击弹窗内容不关闭） */
    preventBubble: function () {}
  }
});
