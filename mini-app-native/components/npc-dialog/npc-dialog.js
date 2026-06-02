/**
 * npc-dialog — NPC 对话框组件
 *
 * 说话人名称 + 对话文本区域 + 选项区 + 确认按钮
 * 打字机效果（定时器逐字显示）
 * 支持 transition 语（过渡语）
 * 属性：speaker, text, options, showConfirm, npcMode
 */

Component({
  properties: {
    /** 说话人名称 */
    speaker: { type: String, value: '咨询师' },
    /** 完整对话文本 */
    text: { type: String, value: '' },
    /** 是否显示确认按钮 */
    showConfirm: { type: Boolean, value: false },
    /** 确认按钮是否可用 */
    confirmDisabled: { type: Boolean, value: true },
    /** 确认按钮文案 */
    confirmText: { type: String, value: '确认' },
    /** NPC 模式 */
    npcMode: { type: String, value: 'immersive' },
    /** 是否嵌入模式（融入外层卡片，去掉独立背景/圆角/阴影） */
    embedded: { type: Boolean, value: false }
  },

  data: {
    displayText: '',
    isTyping: false,
    typingTimer: null,
    _fullText: ''
  },

  observers: {
    text: function (newText) {
      if (this.properties.npcMode === 'immersive' && newText) {
        this._startTyping(newText);
      } else {
        this.setData({ displayText: newText || '', isTyping: false });
      }
    }
  },

  lifetimes: {
    detached: function () {
      if (this.data.typingTimer) {
        clearTimeout(this.data.typingTimer);
      }
    }
  },

  methods: {
    /** 启动打字机效果（批量更新，降低 setData 频率） */
    _startTyping: function (fullText) {
      const self = this;
      // 清理上一个定时器
      if (this.data.typingTimer) {
        clearTimeout(this.data.typingTimer);
      }

      let charIdx = 0;
      this.setData({ isTyping: true, displayText: '', _fullText: fullText });

      // 批量参数：每批次显示的字符数和间隔
      const batchSize = 3;
      const baseInterval = 80;

      function typeBatch() {
        if (charIdx < fullText.length) {
          // 本批次推进到哪个字符
          const end = Math.min(charIdx + batchSize, fullText.length);
          // 在标点处减速：如果当前批次最后字符是标点，减少本批数量并增加延迟
          let delay = baseInterval;
          const lastCh = fullText[end - 1];
          if ('，。！？、；：'.indexOf(lastCh) >= 0) {
            delay = 260;
          } else if ('…—'.indexOf(lastCh) >= 0) {
            delay = 200;
          }

          self.setData({
            displayText: fullText.substring(0, end)
          });
          charIdx = end;
          self.data.typingTimer = setTimeout(typeBatch, delay);
        } else {
          self.setData({ isTyping: false });
          self.triggerEvent('typingcomplete');
        }
      }
      typeBatch();
    },

    /** 跳过打字效果 */
    skipTyping: function () {
      if (this.data.typingTimer) {
        clearTimeout(this.data.typingTimer);
      }
      this.setData({
        displayText: this.properties.text || '',
        isTyping: false
      });
      this.triggerEvent('typingcomplete');
    },

    /** 确认按钮 */
    onConfirm: function () {
      this.triggerEvent('confirm');
    }
  }
});
