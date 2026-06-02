/**
 * share-canvas — Canvas 分享图生成组件
 *
 * Canvas 2D 绘制分享卡片：量表名称、分数、等级、品牌标识
 * 方法：generateImage() → 返回临时图片路径
 */

Component({
  properties: {
    scaleName: { type: String, value: '' },
    score: { type: Number, value: 0 },
    maxScore: { type: Number, value: 100 },
    levelName: { type: String, value: '' },
    color: { type: String, value: '#5b8fb9' }
  },

  data: {
    canvasId: ''
  },

  lifetimes: {
    attached: function () {
      this.setData({ canvasId: 'shareCanvas_' + Math.random().toString(36).substring(2, 8) });
    }
  },

  methods: {
    /** 生成分享图片，返回临时文件路径 */
    generateImage: function () {
      const self = this;
      return new Promise(function (resolve, reject) {
        const query = self.createSelectorQuery();
        query
          .select('#shareCanvas')
          .fields({ node: true, size: true })
          .exec(function (res) {
            if (!res || !res[0] || !res[0].node) {
              reject(new Error('Canvas node not found'));
              return;
            }
            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');
            const dpr = wx.getWindowInfo().pixelRatio || 2;
            const w = 600;
            const h = 480;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.scale(dpr, dpr);

            try {
              self._drawCard(ctx, w, h);
              // 导出图片
              setTimeout(function () {
                wx.canvasToTempFilePath({
                  canvas: canvas,
                  success: function (res2) {
                    resolve(res2.tempFilePath);
                  },
                  fail: function (err) {
                    reject(err);
                  }
                });
              }, 200);
            } catch (e) {
              reject(e);
            }
          });
      });
    },

    _drawCard: function (ctx, w, h) {
      const color = this.properties.color;
      const scaleName = this.properties.scaleName || '测评结果';
      const score = this.properties.score;
      const maxScore = this.properties.maxScore || 100;
      const levelName = this.properties.levelName || '';

      // 背景
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#ffffff');
      bgGrad.addColorStop(1, '#f5f7fa');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // 顶部色带
      const topGrad = ctx.createLinearGradient(0, 0, w, 0);
      topGrad.addColorStop(0, color);
      topGrad.addColorStop(1, color + 'aa');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, w, 120);

      // 量表名称
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(scaleName, w / 2, 72);

      // 分数
      ctx.fillStyle = color;
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(score), w / 2, 240);

      // 满分
      ctx.fillStyle = '#999999';
      ctx.font = '20px sans-serif';
      ctx.fillText('/ ' + maxScore, w / 2, 272);

      // 等级
      if (levelName) {
        const pct = maxScore > 0 ? Math.min(100, Math.round((score / maxScore) * 100)) : 0;
        ctx.fillStyle = '#666666';
        ctx.font = '22px sans-serif';
        ctx.fillText(levelName + ' · ' + pct + '%', w / 2, 320);
      }

      // 分割线
      ctx.strokeStyle = '#eeeeee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, 360);
      ctx.lineTo(w - 60, 360);
      ctx.stroke();

      // 品牌标识
      ctx.fillStyle = '#cccccc';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('星蓝心镜 · 专业心理测评', w / 2, 400);

      // 二维码占位
      ctx.strokeStyle = '#dddddd';
      ctx.lineWidth = 1;
      ctx.strokeRect(w / 2 - 40, 410, 80, 80);
      ctx.fillStyle = '#eeeeee';
      ctx.font = '12px sans-serif';
      ctx.fillText('小程序码', w / 2, 455);
    },

    /** 保存到相册 */
    saveToAlbum: function () {
      const self = this;
      this.generateImage().then(function (path) {
        wx.saveImageToPhotosAlbum({
          filePath: path,
          success: function () {
            wx.showToast({ title: '已保存到相册', icon: 'success' });
            self.triggerEvent('saved', { path: path });
          },
          fail: function (err) {
            if (err.errMsg && err.errMsg.indexOf('auth deny') > -1) {
              wx.showToast({ title: '请授权保存图片', icon: 'none' });
            }
          }
        });
      });
    }
  }
});
