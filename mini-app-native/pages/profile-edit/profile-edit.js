/**
 * pages/profile-edit — 资料编辑页
 *
 * 头像（chooseAvatar）+ 昵称（nickname input）+ 性别 + 生日
 */

const storage = require('../../utils/storage.js');

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    genderIndex: 0,
    genderList: ['未设置', '男', '女'],
    birthday: '',
    tempAvatarUrl: ''
  },

  onLoad: function () {
    const profile = storage.getUserProfile() || {};
    this.setData({
      avatarUrl: profile.avatarUrl || '',
      tempAvatarUrl: profile.avatarUrl || '',
      nickName: profile.nickName || profile.name || '',
      genderIndex: profile.gender === '男' ? 1 : profile.gender === '女' ? 2 : 0,
      birthday: profile.birthday || ''
    });
  },

  onChooseAvatar: function (e) {
    const avatarUrl = e.detail.avatarUrl;
    if (avatarUrl) {
      this.setData({ tempAvatarUrl: avatarUrl });
    }
  },

  onNicknameInput: function (e) {
    this.setData({ nickName: e.detail.value });
  },

  onGenderChange: function (e) {
    this.setData({ genderIndex: Number(e.detail.value) });
  },

  onBirthdayChange: function (e) {
    this.setData({ birthday: e.detail.value });
  },

  onSave: function () {
    const profile = {
      avatarUrl: this.data.tempAvatarUrl || this.data.avatarUrl,
      nickName: this.data.nickName,
      name: this.data.nickName,
      gender: this.data.genderList[this.data.genderIndex],
      birthday: this.data.birthday
    };
    storage.saveUserProfile(profile);
    wx.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(function () {
      wx.navigateBack();
    }, 1000);
  }
});
