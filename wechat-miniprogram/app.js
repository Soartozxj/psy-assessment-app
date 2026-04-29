// app.js
App({
  globalData: {
    userInfo: null,
    envId: 'cloud1-d8ggx8sqde8afa6a4',  // 云开发环境 ID
    version: 'v1.1.0'  // 正式发布版本
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: this.globalData.envId,
      traceUser: true
    })

    // 获取用户 OpenID
    this.getOpenId()
  },

  // 获取用户 OpenID
  getOpenId() {
    const that = this
    wx.cloud.callFunction({
      name: 'data-user',
      data: { action: 'get' },
      success(res) {
        if (res.result && res.result.code === 0) {
          that.globalData.userInfo = res.result.data
          console.log('用户信息:', res.result.data)
        }
      },
      fail(err) {
        console.warn('获取用户信息失败（云函数可能未部署）:', err)
      }
    })
  },

  // 调用云函数的通用方法
  callCloud(name, data) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: name,
        data: data || {},
        success(res) {
          if (res.result && res.result.code === 0) {
            resolve(res.result.data)
          } else {
            reject(new Error((res.result && res.result.message) || '云函数调用失败'))
          }
        },
        fail(err) {
          reject(err)
        }
      })
    })
  }
})
