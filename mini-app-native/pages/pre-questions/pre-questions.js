/**
 * pages/pre-questions — 测前问卷页
 *
 * 分页表单：text/number/select/checkbox 四种输入
 * 条件显示(showWhen) + 表单校验 + 上一步/下一步
 */

const npcHelper = require('../../utils/npc-helper.js');
const assetManager = require('../../utils/asset-manager.js');

const app = getApp();

Page({
  data: {
    scale: null,
    questions: [],
    visibleIds: [],
    pageIdx: 0,
    answers: {},
    answerLabels: {},
    counselorImage: '',
    backgroundImage: '',
    errors: [],
    canPrev: false,
    canNext: true,
    isLast: false
  },

  onLoad: function () {
    const scale = app.globalData.currentScale;
    if (!scale || !scale.preQuestions || scale.preQuestions.length === 0) {
      wx.redirectTo({ url: '/pages/assessment/assessment' });
      return;
    }
    app.globalData.preAnswers = {};

    const npcSettings = npcHelper.resolveNpcSetting(scale);
    this._loadNpcAssets(npcSettings);

    const visibleIds = this._getVisibleIds(scale.preQuestions, {});
    this.setData({
      scale: scale,
      questions: scale.preQuestions,
      visibleIds: visibleIds,
      isLast: visibleIds.length <= 1
    });
  },

  _loadNpcAssets: function (settings) {
    const self = this;
    if (settings.counselorId) {
      assetManager
        .getAssetPath(settings.counselorId)
        .then(function (path) {
          if (path) {
            self.setData({ counselorImage: path });
          } else {
            return assetManager
              .downloadAsset(settings.counselorId)
              .then(function (dlPath) {
                if (dlPath) {
                  self.setData({ counselorImage: dlPath });
                } else {
                  self.setData({ counselorImage: '/assets/images/counselor.png' });
                }
              })
              .catch(function (err) {
                console.warn('[PreQuestions] 咨询师图片下载失败，使用兜底图:', err);
                self.setData({ counselorImage: '/assets/images/counselor.png' });
              });
          }
        })
        .catch(function (err) {
          console.warn('[PreQuestions] 咨询师图片查询异常，使用兜底图:', err);
          self.setData({ counselorImage: '/assets/images/counselor.png' });
        });
    } else {
      self.setData({ counselorImage: '/assets/images/counselor.png' });
    }
    if (settings.bgId) {
      assetManager
        .getAssetPath(settings.bgId)
        .then(function (path) {
          if (path) {
            self.setData({ backgroundImage: path });
          } else {
            return assetManager
              .downloadAsset(settings.bgId)
              .then(function (dlPath) {
                if (dlPath) {
                  self.setData({ backgroundImage: dlPath });
                }
              })
              .catch(function (err) {
                console.warn('[PreQuestions] 背景图下载失败:', err);
              });
          }
        })
        .catch(function (err) {
          console.warn('[PreQuestions] 背景图查询异常:', err);
        });
    }
  },

  _getVisibleIds: function (questions, answers) {
    const ids = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.showWhen) {
        const depField = q.showWhen.field || q.showWhen.dependsOn;
        const depVal = answers[depField];
        const condVal = q.showWhen.eq !== undefined ? q.showWhen.eq : q.showWhen.equals;
        const show = condVal !== undefined ? depVal === condVal : !!depVal;
        if (!show) {
          continue;
        }
      }
      ids.push(q.id);
    }
    return ids;
  },

  _getCurrentQuestion: function () {
    const qid = this.data.visibleIds[this.data.pageIdx];
    const questions = this.data.questions;
    for (let i = 0; i < questions.length; i++) {
      if (questions[i].id === qid) {
        return questions[i];
      }
    }
    return null;
  },

  onInputChange: function (e) {
    const qid = e.currentTarget.dataset.qid;
    const val = e.detail.value;
    const answers = this.data.answers;
    answers[qid] = val;
    this.setData({ answers: answers });
    this._updateConditionals();
  },

  onPickerChange: function (e) {
    // 保留兼容，实际已由 onSelectOption 替代
  },

  /** 内联按钮组选择（替代原生picker） */
  onSelectOption: function (e) {
    const qid = e.currentTarget.dataset.qid;
    const value = e.currentTarget.dataset.value;
    const label = e.currentTarget.dataset.label;
    const answers = this.data.answers;
    // 存 value 字符串用于 WXML 比较，同时保留 label 在 answerLabels 中
    answers[qid] = value;
    const answerLabels = this.data.answerLabels || {};
    answerLabels[qid] = label;
    this.setData({ answers: answers, answerLabels: answerLabels });
    this._updateConditionals();
  },

  onCheckboxChange: function (e) {
    const qid = e.currentTarget.dataset.qid;
    const vals = e.detail.value;
    const answers = this.data.answers;
    answers[qid] = vals;
    this.setData({ answers: answers });
  },

  _updateConditionals: function () {
    const visibleIds = this._getVisibleIds(this.data.questions, this.data.answers);
    this.setData({
      visibleIds: visibleIds,
      isLast: this.data.pageIdx >= visibleIds.length - 1
    });
  },

  onPrev: function () {
    if (this.data.pageIdx > 0) {
      this.setData({
        pageIdx: this.data.pageIdx - 1,
        isLast: this.data.pageIdx - 1 >= this.data.visibleIds.length - 1
      });
    }
  },

  onNext: function () {
    const q = this._getCurrentQuestion();
    if (q && q.required !== false) {
      const val = this.data.answers[q.id];
      const empty = q.type === 'checkbox' ? !val || !Array.isArray(val) || val.length === 0 : !val;
      if (empty) {
        wx.showToast({ title: '请填写：' + (q.label || ''), icon: 'none' });
        return;
      }
    }

    if (this.data.pageIdx < this.data.visibleIds.length - 1) {
      this.setData({
        pageIdx: this.data.pageIdx + 1,
        isLast: this.data.pageIdx + 1 >= this.data.visibleIds.length - 1
      });
    }
  },

  /** 下一步或提交（WXML 不支持动态事件名，合并为一个方法） */
  onNextOrSubmit: function () {
    if (this.data.isLast) {
      this.onSubmit();
    } else {
      this.onNext();
    }
  },

  onSubmit: function () {
    // 校验所有必填
    const errors = [];
    const questions = this.data.questions;
    const answers = this.data.answers;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.showWhen) {
        const depField = q.showWhen.field || q.showWhen.dependsOn;
        const depVal = answers[depField];
        const condVal = q.showWhen.eq !== undefined ? q.showWhen.eq : q.showWhen.equals;
        const show = condVal !== undefined ? depVal === condVal : !!depVal;
        if (!show) {
          continue;
        }
      }
      const val = answers[q.id];
      const empty = q.type === 'checkbox' ? !val || !Array.isArray(val) || val.length === 0 : !val;
      if (q.required !== false && empty) {
        errors.push(q.label);
      }
    }
    if (errors.length > 0) {
      wx.showToast({ title: '请填写：' + errors.join('、'), icon: 'none' });
      return;
    }

    // 保存到 globalData，进入测评
    app.globalData.preAnswers = answers;
    wx.navigateTo({ url: '/pages/assessment/assessment' });
  }
});
