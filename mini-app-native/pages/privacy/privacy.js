/**
 * pages/privacy — 隐私政策
 *
 * 隐私政策文本 + 同意/拒绝操作
 */

const storage = require('../../utils/storage.js');

Page({
  data: {
    isFromOnboard: false,
    agreed: false
  },

  onLoad: function (options) {
    // 从隐私弹窗跳转而来（首次启动）
    const fromOnboard = options.from === 'onboard';
    const alreadyAgreed = storage.isPrivacyAgreed();
    this.setData({
      isFromOnboard: fromOnboard,
      agreed: alreadyAgreed
    });
  },

  /** 同意隐私政策 */
  onAgree: function () {
    storage.setPrivacyAgreed();
    this.setData({ agreed: true });
    wx.showToast({ title: '已同意隐私政策', icon: 'success' });

    // 如果是从引导页来的，返回或跳转首页
    if (this.data.isFromOnboard) {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  /** 拒绝隐私政策 */
  onReject: function () {
    const self = this;
    wx.showModal({
      title: '提示',
      content: '拒绝隐私政策将无法使用本应用的功能，确定要拒绝吗？',
      confirmColor: '#d0021b',
      success: function (res) {
        if (res.confirm) {
          // 如果是首次启动且拒绝，退出小程序
          if (self.data.isFromOnboard) {
            wx.showModal({
              title: '无法使用',
              content: '您需要同意隐私政策才能使用星蓝心镜',
              showCancel: false,
              success: function () {
                wx.navigateBack();
              }
            });
          }
        }
      }
    });
  },

  /** 复制政策文本 */
  onCopyPolicy: function () {
    const text = this._getPolicyText();
    wx.setClipboardData({
      data: text,
      success: function () {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  },

  /** 获取政策纯文本 */
  _getPolicyText: function () {
    return (
      '星蓝心镜隐私政策\n\n' +
      '更新日期：2025年1月1日\n\n' +
      '一、信息收集\n' +
      '我们仅收集为您提供服务所必需的信息，包括：\n' +
      '1. 测评答案及结果：用于生成测评报告\n' +
      '2. 设备信息：用于适配不同设备\n' +
      '3. 使用记录：用于提供历史记录功能\n\n' +
      '二、信息存储\n' +
      '1. 您的数据主要存储在本地设备上\n' +
      '2. 部分数据可能同步至云端服务器，用于跨设备访问\n' +
      '3. 我们采用行业标准加密技术保护您的数据\n\n' +
      '三、信息使用\n' +
      '我们仅将您的信息用于：\n' +
      '1. 提供心理健康测评服务\n' +
      '2. 生成AI解读报告\n' +
      '3. 改善产品体验\n\n' +
      '四、信息保护\n' +
      '1. 我们不会将您的个人信息出售给第三方\n' +
      '2. 我们不会在未经您同意的情况下分享您的测评结果\n' +
      '3. 我们采用严格的技术手段保护数据安全\n\n' +
      '五、您的权利\n' +
      '1. 您可以随时查看、修改您的个人信息\n' +
      '2. 您可以随时删除您的测评记录\n' +
      '3. 您可以随时清除所有本地数据\n\n' +
      '六、未成年人保护\n' +
      '我们高度重视未成年人的隐私保护。如果您是未成年人，请在监护人陪同下使用本应用。\n\n' +
      '七、政策更新\n' +
      '我们可能会不时更新本隐私政策，更新后将在应用内通知您。\n\n' +
      '八、联系我们\n' +
      '如有任何疑问，请通过应用内反馈功能联系我们。'
    );
  }
});
