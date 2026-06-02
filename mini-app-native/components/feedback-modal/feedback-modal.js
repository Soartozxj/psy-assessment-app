/**
 * feedback-modal — 评价反馈弹窗组件
 *
 * 星级评分 + 标签选择 + 文本输入 + 提交/取消
 * 属性：visible, recordId
 * 事件：onSubmit({rating, tags, text}), onCancel
 */

const api = require('../../utils/api.js');

Component({
  properties: {
    visible: { type: Boolean, value: false },
    recordId: { type: String, value: '' },
    presetTags: {
      type: Array,
      value: [
        { key: 'relax', label: '放松' },
        { key: 'anxiety', label: '焦虑' },
        { key: 'calm', label: '平静' },
        { key: 'inspired', label: '有启发' },
        { key: 'helpful', label: '有帮助' },
        { key: 'neutral', label: '一般' }
      ]
    }
  },

  data: {
    rating: 0,
    selectedTags: [],
    selectedTagsMap: {},
    feedbackText: '',
    submitting: false
  },

  observers: {
    visible: function (val) {
      if (!val) {
        this.setData({ rating: 0, selectedTags: [], selectedTagsMap: {}, feedbackText: '', submitting: false });
      }
    }
  },

  methods: {
    /** 更新标签选中状态 Map（WXML 不支持 .indexOf()） */
    _updateTagsMap: function () {
      const map = {};
      const tags = this.data.selectedTags;
      for (let i = 0; i < tags.length; i++) {
        map[tags[i]] = true;
      }
      this.setData({ selectedTagsMap: map });
    },

    onStarTap: function (e) {
      const star = e.currentTarget.dataset.star;
      this.setData({ rating: star });
    },

    onTagTap: function (e) {
      const key = e.currentTarget.dataset.key;
      const tags = this.data.selectedTags.slice();
      const idx = tags.indexOf(key);
      if (idx > -1) {
        tags.splice(idx, 1);
      } else {
        tags.push(key);
      }
      this.setData({ selectedTags: tags });
      this._updateTagsMap();
    },

    onTextInput: function (e) {
      this.setData({ feedbackText: e.detail.value });
    },

    onSubmit: function () {
      if (this.data.rating === 0) {
        wx.showToast({ title: '请选择评分', icon: 'none' });
        return;
      }
      if (this.data.submitting) {
        return;
      }
      this.setData({ submitting: true });

      const self = this;
      const payload = {
        recordId: this.properties.recordId,
        rating: this.data.rating,
        tags: this.data.selectedTags,
        text: this.data.feedbackText
      };

      api
        .submitFeedback(payload)
        .then(function () {
          self.setData({ submitting: false });
          self.triggerEvent('submit', payload);
        })
        .catch(function () {
          self.setData({ submitting: false });
          // 降级：仍触发事件
          self.triggerEvent('submit', payload);
        });
    },

    onCancel: function () {
      this.triggerEvent('cancel');
    },

    preventBubble: function () {}
  }
});
