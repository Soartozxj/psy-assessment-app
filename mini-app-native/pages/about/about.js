/**
 * pages/about — 关于页面
 *
 * 应用信息 + 功能介绍 + 版权声明
 */

Page({
  data: {
    appName: '星蓝心镜',
    version: '1.0.0',
    description: '星蓝心镜是一款专业的心理健康测评工具，提供多种权威心理量表，帮助您了解自己的心理状态，获得专业建议。',
    features: [
      { icon: '🧠', title: '专业量表', desc: '涵盖焦虑、抑郁、人格、压力等多维度心理测评' },
      { icon: '🤖', title: 'AI 解读', desc: '基于人工智能的测评结果深度解读与建议' },
      { icon: '🎭', title: '沉浸体验', desc: 'NPC 陪伴式测评，让心理测评更轻松自然' },
      { icon: '🔒', title: '隐私保护', desc: '数据本地存储，严格保护您的隐私安全' }
    ],
    links: [
      { key: 'privacy', label: '隐私政策', url: '/pages/privacy/privacy' },
      { key: 'feedback', label: '意见反馈', url: '' },
      { key: 'update', label: '检查更新', url: '' }
    ]
  },

  /** 菜单项点击 */
  onLinkTap: function (e) {
    const key = e.currentTarget.dataset.key;
    const url = e.currentTarget.dataset.url;

    if (key === 'privacy' && url) {
      wx.navigateTo({ url: url });
      return;
    }

    if (key === 'feedback') {
      wx.navigateTo({ url: '/pages/ai-diag/ai-diag' });
      return;
    }

    if (key === 'update') {
      this._checkUpdate();
      return;
    }
  },

  /** 检查更新 */
  _checkUpdate: function () {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();
      updateManager.onCheckForUpdate(function (res) {
        if (res.hasUpdate) {
          wx.showModal({
            title: '发现新版本',
            content: '检测到新版本，是否立即更新？',
            success: function (modalRes) {
              if (modalRes.confirm) {
                updateManager.applyUpdate();
              }
            }
          });
        } else {
          wx.showToast({ title: '已是最新版本', icon: 'success' });
        }
      });
    } else {
      wx.showToast({ title: '当前版本不支持自动更新', icon: 'none' });
    }
  },

  /** 复制版本号 */
  onVersionLongPress: function () {
    wx.setClipboardData({
      data: this.data.version,
      success: function () {
        wx.showToast({ title: '版本号已复制', icon: 'success' });
      }
    });
  }
});
