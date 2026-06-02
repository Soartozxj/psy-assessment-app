/**
 * scale-card — 量表卡片组件
 *
 * 色条（左侧竖条）+ 标题 + 标签 + 描述 + 元数据
 * 触发事件：onTap
 */

Component({
  properties: {
    /** 量表数据 */
    scale: { type: Object, value: {} },
    /** 色条颜色 */
    color: { type: String, value: '#5b8fb9' },
    /** 是否已完成 */
    done: { type: Boolean, value: false }
  },

  data: {
    questionCount: 0,
    estimatedTime: '',
    participantCount: 0,
    emoji: '',
    title: '',
    description: '',
    badges: []
  },

  observers: {
    scale: function (s) {
      if (!s) {
        return;
      }
      const qCount = (s.questions || []).length || s.questionCount || 0;
      const eTime = s.estimatedTime || (qCount ? Math.ceil(qCount * 0.5) + '分钟' : '');
      const pCount = s.participantCount || s.usageCount || 0;

      // 展示名称：优先 displayName，fallback 到 name
      const displayName = s.displayName || s.name || s.title || '';
      let emoji = '';
      let title = displayName;
      // 兼容性写法：不使用 u 标志和 \u{} 语法
      let emojiMatch = displayName.match(/^([\uD83C-\uDBFF][\uDC00-\uDFFF])\s*/);
      if (!emojiMatch) {
        // 尝试匹配其他常见 emoji 范围
        emojiMatch = displayName.match(/^([\u2600-\u27BF])\s*/);
      }
      if (emojiMatch) {
        emoji = emojiMatch[1];
        title = displayName.substring(emojiMatch[0].length);
      }

      // 标签
      const badges = [];
      if (s.isPro) {
        badges.push({ label: '专业', cls: 'pro' });
      }
      if (s.isRecommended) {
        badges.push({ label: '推荐', cls: 'rec' });
      }
      if (this.properties.done) {
        badges.push({ label: '已完成', cls: 'done' });
      }

      this.setData({
        questionCount: qCount,
        estimatedTime: eTime,
        participantCount: pCount,
        emoji: emoji,
        title: title,
        description: s.shortDesc || s.desc || s.description || s.subtitle || '',
        badges: badges
      });
    }
  },

  methods: {
    onTap: function () {
      this.triggerEvent('scaletap', { scale: this.properties.scale });
    }
  }
});
