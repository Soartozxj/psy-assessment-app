Page({
  data: {
    webviewUrl: ''
  },

  onLoad(options) {
    const code = options.code || '';
    // Dev: localhost, Prod: https://www.soarto.com.cn/frontend/index.html
    const baseUrl = 'http://localhost:8080/mini-app-h5/frontend/index.html';
    const params = '?code=' + code + '&from=miniapp';
    this.setData({ webviewUrl: baseUrl + params });
  },

  onWebviewLoad(e) {
    console.log('Webview loaded');
  },

  onWebviewError(e) {
    wx.showToast({ title: '页面加载失败', icon: 'none' });
  },

  onMessage(e) {
    const msgs = e.detail.data;
    if (!msgs || msgs.length === 0) {
      return;
    }
    const lastMsg = msgs[msgs.length - 1];

    if (lastMsg.event === 'assessment_done') {
      const data = lastMsg.data || {};
      wx.redirectTo({
        url:
          '/pages/report/report?code=' +
          (data.scaleCode || '') +
          '&scores=' +
          encodeURIComponent(JSON.stringify(data.scores || {})) +
          '&dimensions=' +
          encodeURIComponent(JSON.stringify(data.dimensions || []))
      });
    } else if (lastMsg.event === 'go_back') {
      wx.navigateBack();
    }
  }
});
