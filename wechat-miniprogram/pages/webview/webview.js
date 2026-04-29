// pages/webview/webview.js
// v12.3 - 纯 web-view，H5 内部管理导航
// 注意：wx.createWebViewContext / evaluateJavascript 不存在（AI 幻觉），不可使用
// 小程序原生返回 = 直接退出 WebView，H5 内部的 .sub-back 按钮负责子页面导航

Page({
  data: {
    url: ''
  },

  // 分享信息
  shareTitle: '星蓝心镜',
  sharePath: '/pages/index/index',

  onLoad(options) {
    const type = options.type || 'front'
    const baseUrl = 'https://www.soarto.com.cn'
    const envId = getApp().globalData.envId || ''

    let htmlFile = 'index.html'
    let title = '星蓝心镜'
    if (type === 'admin') {
      htmlFile = 'admin-legacy.html'
      title = '管理后台'
    }

    wx.setNavigationBarTitle({ title: title })

    // 获取 openid（确保 globalData.userInfo 已就绪）
    this.loadWithOpenid(baseUrl, htmlFile, envId)
  },

  loadWithOpenid(baseUrl, htmlFile, envId) {
    const userInfo = getApp().globalData.userInfo
    const openid = (userInfo && (userInfo._openid || userInfo.userId)) || ''

    if (openid || this._retryCount >= 10) {
      // 拿到 openid 或已重试 10 次（约 2 秒），不再等待
      const timestamp = Date.now()
      var url = baseUrl + '/' + htmlFile + '?env=cloud&envId=' + envId + '&apiBase=https://identity.soarto.com.cn&v=34&t=' + timestamp
      if (openid) {
        url += '&openid=' + openid
      }
      console.log('[WebView v12.3] 加载:', htmlFile, ', openid:', openid ? '有' : '无')
      this.setData({ url: url })
    } else {
      // 等待 openid 获取完成（getOpenId 是异步的）
      this._retryCount = (this._retryCount || 0) + 1
      setTimeout(() => this.loadWithOpenid(baseUrl, htmlFile, envId), 200)
    }
  },

  onPullDownRefresh() {
    wx.stopPullDownRefresh()
  },

  onShareAppMessage() {
    return { title: this.shareTitle, path: this.sharePath }
  },

  onMessage(e) {
    var data = e.detail && e.detail.data;
    if (data && data.length > 0) {
      var last = data[data.length - 1];
      if (last && last.action === 'h5error') {
        console.error('[H5 错误]', last.error);
        wx.showToast({ title: '页面错误: ' + last.error, icon: 'none', duration: 5000 });
      }
      if (last && last.action === 'shareInfo') {
        if (last.title) this.shareTitle = last.title;
        if (last.path) this.sharePath = last.path;
      }
    }
  },

  onError(e) {
    console.error('[WebView] 加载错误:', e.detail)
    wx.showToast({ title: '页面加载失败', icon: 'none' })
  }
})
