App({
  globalData: {
    userInfo: null,
    envId: 'cloud1-d8ggx8sqde8afa6a4',
    version: 'v2.0.0'
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: this.globalData.envId,
      traceUser: true
    });
    console.log('CloudBase initialized, env:', this.globalData.envId);
  },

  callCloud(name, data) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: name,
        data: data || {},
        success(res) {
          if (res.result && res.result.code === 0) {
            resolve(res.result.data);
          } else {
            reject(new Error((res.result && res.result.message) || '调用失败'));
          }
        },
        fail(err) {
          reject(err);
        }
      });
    });
  }
});
