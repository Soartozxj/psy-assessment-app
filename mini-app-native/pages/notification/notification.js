/**
 * pages/notification — 通知中心
 *
 * 通知列表 + 已读/未读标记 + 全部已读 + 删除
 */

const storage = require('../../utils/storage.js');

Page({
  data: {
    notifications: [],
    unreadCount: 0,
    emptyText: '暂无通知'
  },

  onShow: function () {
    this._loadNotifications();
  },

  _loadNotifications: function () {
    const list = storage.getNotifications();
    let unread = 0;
    for (let i = 0; i < list.length; i++) {
      if (!list[i].read) {
        unread++;
      }
    }
    this.setData({
      notifications: list,
      unreadCount: unread,
      emptyText: list.length === 0 ? '暂无通知' : ''
    });
  },

  /** 点击单条通知 */
  onNotificationTap: function (e) {
    const id = e.currentTarget.dataset.id;
    const notifications = this.data.notifications;
    let target = null;
    for (let i = 0; i < notifications.length; i++) {
      if (notifications[i].id === id) {
        target = notifications[i];
        break;
      }
    }
    if (!target) {
      return;
    }

    // 标记已读
    if (!target.read) {
      storage.markNotificationRead(id);
      this._loadNotifications();
    }

    // 跳转
    if (target.url) {
      wx.navigateTo({ url: target.url });
    } else if (target.relatedId) {
      wx.navigateTo({ url: '/pages/result/result?recordId=' + target.relatedId });
    }
  },

  /** 全部已读 */
  onMarkAllRead: function () {
    if (this.data.unreadCount === 0) {
      wx.showToast({ title: '无未读通知', icon: 'none' });
      return;
    }
    storage.markAllNotificationsRead();
    this._loadNotifications();
    wx.showToast({ title: '已全部标记为已读', icon: 'success' });
  },

  /** 删除单条通知 */
  onDeleteNotification: function (e) {
    const id = e.currentTarget.dataset.id;
    storage.deleteNotification(id);
    this._loadNotifications();
  },

  /** 清空全部通知 */
  onClearAll: function () {
    const self = this;
    wx.showModal({
      title: '确认清空',
      content: '确定清空所有通知吗？',
      success: function (res) {
        if (res.confirm) {
          storage.clearNotifications();
          self._loadNotifications();
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      }
    });
  }
});
