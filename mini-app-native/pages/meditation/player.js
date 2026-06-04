// pages/meditation/player.js
const api = require('../../utils/api.js');

Page({
  data: {
    audioId: null,
    recordId: null,
    title: '',
    coverUrl: '',
    duration: 0,
    currentTime: 0,
    currentTimeStr: '0:00',
    durationStr: '0:00',
    isPlaying: false,
    showTimerModal: false,
    timerMinutes: 0,
    timerText: '定时'
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ audioId: parseInt(options.id) });
      this._loadAudioInfo(options.id);
    }
  },

  onShow: function () {
    this._initAudio();
  },

  onHide: function () {
    this._pauseAudio();
  },

  onUnload: function () {
    this._destroyAudio();
  },

  _loadAudioInfo: function (audioId) {
    const self = this;
    api.fetchMeditationAudios('all')
      .then(function (res) {
        if (res && res.list && res.list.length > 0) {
          // 查找匹配的音频
          const audio = res.list.find(function (a) { return a.id === parseInt(audioId); });
          if (audio) {
            self.setData({
              title: audio.title,
              coverUrl: audio.cover_url || '',
              duration: audio.duration || 0,
              durationStr: self._formatTime(audio.duration || 0)
            });
          }

          // 记录播放开始
          self._startMeditation(audioId);
        }
      })
      .catch(function (err) {
        console.error('[PLAYER] 加载音频信息失败:', err);
      });
  },

  _initAudio: function () {
    if (this.audioContext) return;

    this.audioContext = wx.createInnerAudioContext();
    this.audioContext.obeyMuteSwitch = false;

    const self = this;

    this.audioContext.onTimeUpdate(() => {
      const currentTime = Math.floor(self.audioContext.currentTime);
      self.setData({
        currentTime: currentTime,
        currentTimeStr: self._formatTime(currentTime)
      });
    });

    this.audioContext.onEnded(() => {
      self._onPlayEnd();
    });

    this.audioContext.onError((err) => {
      console.error('[PLAYER] 播放错误:', err);
      wx.showToast({ title: '播放失败', icon: 'none' });
    });
  },

  _startMeditation: function (audioId) {
    const self = this;
    api.startMeditation(audioId)
      .then(function (res) {
        if (res && res.data && res.data.recordId) {
          self.setData({ recordId: res.data.recordId });
        }
      })
      .catch(function (err) {
        console.error('[PLAYER] 记录冥想开始失败:', err);
      });
  },

  onPlayTap: function () {
    if (this.data.isPlaying) {
      this._pauseAudio();
    } else {
      this._playAudio();
    }
  },

  _playAudio: function () {
    if (!this.audioContext) return;

    // 设置音频源（这里需要实际音频URL，暂时使用占位）
    // TODO: 从服务器获取实际音频URL
    const audioUrl = 'https://example.com/meditation-audio.mp3';
    this.audioContext.src = audioUrl;
    this.audioContext.play();

    this.setData({ isPlaying: true });

    // 启动定时器
    this._startTimer();
  },

  _pauseAudio: function () {
    if (!this.audioContext) return;

    this.audioContext.pause();
    this.setData({ isPlaying: false });

    // 清除定时器
    this._clearTimer();
  },

  _onPlayEnd: function () {
    this.setData({ isPlaying: false });
    this._completeMeditation();
    this._clearTimer();

    wx.showToast({ title: '冥想完成', icon: 'success' });
  },

  _completeMeditation: function () {
    if (!this.data.recordId) return;

    const self = this;
    api.completeMeditation(this.data.recordId, this.data.currentTime)
      .then(function () {
        console.log('[PLAYER] 冥想完成记录成功');
      })
      .catch(function (err) {
        console.error('[PLAYER] 记录冥想完成失败:', err);
      });
  },

  _startTimer: function () {
    const minutes = this.data.timerMinutes;
    if (minutes <= 0) return;

    this._clearTimer();

    const timerDuration = minutes * 60 * 1000;
    this.timer = setTimeout(() => {
      this._onTimerEnd();
    }, timerDuration);
  },

  _clearTimer: function () {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  },

  _onTimerEnd: function () {
    this._pauseAudio();
    wx.showToast({ title: '定时结束', icon: 'none' });
  },

  onTimerTap: function () {
    this.setData({ showTimerModal: true });
  },

  onTimerMaskTap: function () {
    this.setData({ showTimerModal: false });
  },

  onTimerOptionTap: function (e) {
    const minutes = parseInt(e.currentTarget.dataset.minutes);
    let timerText = '定时';
    if (minutes > 0) {
      timerText = minutes + '分钟';
    }

    this.setData({
      timerMinutes: minutes,
      timerText: timerText,
      showTimerModal: false
    });

    // 如果正在播放，重启定时器
    if (this.data.isPlaying) {
      this._startTimer();
    }
  },

  onSliderChange: function (e) {
    if (!this.audioContext) return;

    const value = e.detail.value;
    this.audioContext.seek(value);
    this.setData({
      currentTime: value,
      currentTimeStr: this._formatTime(value)
    });
  },

  onSliderChanging: function (e) {
    const value = e.detail.value;
    this.setData({
      currentTime: value,
      currentTimeStr: this._formatTime(value)
    });
  },

  onCloseTap: function () {
    this._destroyAudio();
    wx.navigateBack();
  },

  onBackTap: function () {
    this._destroyAudio();
    wx.navigateBack();
  },

  _destroyAudio: function () {
    this._clearTimer();
    if (this.audioContext) {
      this.audioContext.stop();
      this.audioContext.destroy();
      this.audioContext = null;
    }
  },

  _formatTime: function (seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const secsStr = secs < 10 ? '0' + secs : '' + secs;
    return mins + ':' + secsStr;
  },

  onShareAppMessage: function () {
    return {
      title: '星蓝心镜 - 冥想播放器',
      path: '/pages/meditation/player?id=' + this.data.audioId
    };
  }
});
