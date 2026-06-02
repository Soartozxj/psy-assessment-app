/**
 * score-ring — 分数环组件（Canvas 2D）
 *
 * Canvas 2D 绘制圆弧进度 + 中心分数文字
 * 属性：score, maxScore, color, size
 * 动画效果：从0到目标值渐变
 */

Component({
  properties: {
    score: { type: Number, value: 0 },
    maxScore: { type: Number, value: 100 },
    color: { type: String, value: '#5b8fb9' },
    size: { type: Number, value: 200 },
    /** 等级标签 */
    levelLabel: { type: String, value: '' }
  },

  data: {
    displayScore: 0,
    pctText: '0',
    canvasId: ''
  },

  lifetimes: {
    attached: function () {
      this.setData({ canvasId: 'scoreRing_' + this.getInstanceId() });
    },
    ready: function () {
      this._animateDraw();
    }
  },

  observers: {
    'score, maxScore, color': function () {
      this._animateDraw();
    }
  },

  methods: {
    _animateDraw: function () {
      const self = this;
      const target = this.properties.score;
      const current = this.data.displayScore || 0;
      const steps = 30;
      const step = (target - current) / steps;
      let i = 0;

      function tick() {
        i++;
        if (i >= steps) {
          self.setData({ displayScore: target, pctText: self._calcPct(target) });
          self._drawRing(target);
          return;
        }
        const val = Math.round(current + step * i);
        self.setData({ displayScore: val, pctText: self._calcPct(val) });
        self._drawRing(val);
        setTimeout(tick, 20);
      }
      tick();
    },

    _drawRing: function (score) {
      let maxScore = this.properties.maxScore;
      const color = this.properties.color;
      const size = this.properties.size;
      if (maxScore <= 0) {
        maxScore = 1;
      }

      const query = this.createSelectorQuery();
      query
        .select('#scoreRingCanvas')
        .fields({ node: true, size: true })
        .exec(function (res) {
          if (!res || !res[0] || !res[0].node) {
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getWindowInfo().pixelRatio || 2;
          canvas.width = size * dpr;
          canvas.height = size * dpr;
          ctx.scale(dpr, dpr);

          const cx = size / 2;
          const cy = size / 2;
          const lineW = Math.max(8, size * 0.08);
          const radius = Math.max(10, size / 2 - lineW / 2 - 4);
          const pct = Math.min(1, Math.max(0, score / maxScore));
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + 2 * Math.PI * pct;

          // 清空
          ctx.clearRect(0, 0, size, size);

          // 背景环
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
          ctx.strokeStyle = 'rgba(0,0,0,0.06)';
          ctx.lineWidth = lineW;
          ctx.lineCap = 'round';
          ctx.stroke();

          // 进度弧
          if (pct > 0.003) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.strokeStyle = color;
            ctx.lineWidth = lineW;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
        });
    },

    getInstanceId: function () {
      if (!this._instanceId) {
        this._instanceId = Math.random().toString(36).substring(2, 8);
      }
      return this._instanceId;
    },

    _calcPct: function (score) {
      const max = this.properties.maxScore;
      if (!max || max <= 0) {
        return '0';
      }
      return Math.round((score / max) * 100).toString();
    }
  }
});
