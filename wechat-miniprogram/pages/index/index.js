// pages/index/index.js
const lines = [
  '你好呀，欢迎来到星蓝心镜～',
  '在这里，你可以完成专业量表测评，',
  '获取多维分析报告，',
  '还有 AI 辅助分析。',
  '准备好了吗？',
  '让我们一起探索内心世界吧！'
];

Page({
  data: {
    typingLines: [],
    imgDisplayWidth: 80, // 默认宽度百分比
    version: '' // 版本号，从 app.globalData 获取
  },

  lineIdx: 0,
  charIdx: 0,
  timer: null,

  onLoad() {
    this.setData({ version: getApp().globalData.version });
    this.startTyping();
  },

  // 图片加载完成 - 固定 60% 宽度，让图片自然撑满空间
  onImgLoad(e) {
    // 固定 60% 宽度，mode="widthFix" 会自动保持宽高比
    this.setData({ imgDisplayWidth: 60 });
  },

  onImgError(e) {
    console.error('图片加载失败:', e);
  },

  startTyping() {
    const speed = 45;
    const lineDelay = 500;
    const self = this;

    function startLine() {
      if (self.lineIdx >= lines.length) {
        return;
      }

      const currentLines = self.data.typingLines.slice();
      currentLines.push({ text: '', visible: false });
      self.setData({ typingLines: currentLines }, function () {
        // 触发重排后加 visible
        setTimeout(function () {
          const updatedLines = self.data.typingLines;
          updatedLines[updatedLines.length - 1].visible = true;
          self.setData({ typingLines: updatedLines });
        }, 50);
      });

      self.charIdx = 0;
      typeChar();
    }

    function typeChar() {
      const line = lines[self.lineIdx];
      if (self.charIdx >= line.length) {
        self.lineIdx++;
        self.timer = setTimeout(startLine, lineDelay);
        return;
      }

      const updatedLines = self.data.typingLines;
      updatedLines[updatedLines.length - 1].text += line[self.charIdx];
      self.setData({ typingLines: updatedLines });
      self.charIdx++;
      self.timer = setTimeout(typeChar, speed);
    }

    setTimeout(startLine, 600);
  },

  onShareAppMessage() {
    return {
      title: '星蓝心镜 - 探索你的内心世界',
      path: '/pages/index/index'
    };
  },

  // 进入前端测评页面
  goToFront() {
    wx.navigateTo({
      url: '/pages/webview/webview?type=front'
    });
  },

  // 进入管理后台（长按触发）
  onLongPress() {
    wx.navigateTo({
      url: '/pages/webview/webview?type=admin'
    });
  },

  onUnload() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
});
