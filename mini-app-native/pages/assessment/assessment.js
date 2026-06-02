/**
 * pages/assessment — 答题页（核心页面）
 *
 * 5种题型动态渲染 + NPC两种模式 + 答案收集 + 进度保存 + 计分提交
 */

const ScoringEngine = require('../../utils/scoring-engine.js');
const npcHelper = require('../../utils/npc-helper.js');
const assetManager = require('../../utils/asset-manager.js');
const storage = require('../../utils/storage.js');
const api = require('../../utils/api.js');
const format = require('../../utils/format.js');

const app = getApp();

Page({
  data: {
    scale: null,
    questions: [],
    currentIndex: 0,
    totalQuestions: 0,
    answers: {},
    preAnswers: {},
    currentQuestion: null,
    currentType: '',
    currentAnswer: null,

    // NPC
    npcMode: 'immersive',
    npcSettings: { counselorName: '', motto: '', welcomeText: '' },
    counselorImage: '',
    backgroundImage: '',
    dialogText: '',
    showNpcDialog: true,
    showConfirm: false,
    confirmDisabled: true,
    confirmText: '确认并继续',
    transitionText: '',

    // 进度
    progress: 0,
    startTime: 0,

    // UI state
    submitting: false,
    selectedAnswer: null,
    showOptions: false,
    welcomePhaseDone: false,
    _typingPhase: 'question',
    pendingTransition: '',
    isLastQuestion: false
  },

  onLoad: function () {
    let scale = app.globalData.currentScale;
    console.log(
      '[Assessment] onLoad, scale:',
      scale ? scale.name || scale.title : 'null',
      'questions:',
      scale ? (scale.questions || []).length : 0
    );
    if (!scale) {
      // 尝试恢复进度
      const progress = storage.getAssessmentProgress();
      if (progress) {
        scale = this._findScaleById(progress.scaleId) || this._findScaleByCode(progress.scaleCode);
      }
    }

    if (!scale) {
      wx.showToast({ title: '未选择量表', icon: 'none' });
      setTimeout(function () {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 规范化 questions
    const questions = scale.questions || [];
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].groups && questions[i].parents) {
        questions[i].groups = questions[i].parents;
        delete questions[i].parents;
      }
    }

    const npcMode = app.globalData.currentNpcMode || 'immersive';
    let npcSettings = npcHelper.resolveNpcSetting(scale, scale.name || scale.title);
    const themeColor = scale.color || scale.themeColor || '#5b8fb9';

    // 确保 npcSettings 所有字符串属性非 null（小程序组件不接受 null）
    if (!npcSettings) {
      npcSettings = {};
    }
    npcSettings.counselorName = npcSettings.counselorName || '';
    npcSettings.motto = npcSettings.motto || '';
    npcSettings.welcomeText = npcSettings.welcomeText || '';

    // === 合并所有初始 setData 为一次，避免短时间多次 setData 导致消息队列拥堵 ===

    // 恢复进度（优先使用已保存答案）
    const savedProgress = storage.getAssessmentProgress(scale.id);
    const savedAnswers = savedProgress && savedProgress.answers ? savedProgress.answers : {};
    const startIdx = savedProgress && savedProgress.currentIndex ? savedProgress.currentIndex : 0;

    // 预计算第一题的数据（合并 _showQuestion 逻辑）
    const firstQ = questions[startIdx] || questions[0];
    let firstQType = firstQ.type || 'single';
    if (firstQ.groups && !firstQ.type) {
      firstQType = 'grouped';
    }
    let firstAnswer = savedAnswers[firstQ.id];
    if (firstAnswer === undefined || firstAnswer === null) {
      firstAnswer = firstQType === 'matrix' || firstQType === 'parent-child' ? {} : '';
    }
    const isFirstLast = startIdx >= questions.length - 1;
    const firstProgress = Math.round(((startIdx + 1) / questions.length) * 100);

    // 沉浸模式第一题欢迎语
    const isImmersive = npcMode === 'immersive';
    let initialDialogText = '【第' + (startIdx + 1) + '题】' + (firstQ.content || '');
    let welcomePhaseDone = true;
    if (isImmersive && startIdx === 0 && npcSettings.welcomeText) {
      initialDialogText = npcSettings.welcomeText;
      welcomePhaseDone = false;
    }

    this.setData({
      scale: scale,
      questions: questions,
      totalQuestions: questions.length,
      npcMode: npcMode,
      npcSettings: npcSettings,
      themeColor: themeColor,
      startTime: Date.now(),
      preAnswers: app.globalData.preAnswers || app.globalData.currentPreAnswers || {},
      counselorImage: '', // 先留空，_loadNpcAssets 加载成功后一次性设置
      // 恢复进度
      answers: savedAnswers,
      currentIndex: startIdx,
      // 预计算的第一题数据
      currentQuestion: firstQ,
      currentType: firstQType,
      currentAnswer: firstAnswer,
      progress: firstProgress,
      selectedAnswer: null,
      showOptions: !isImmersive,
      showConfirm: !isImmersive,
      confirmDisabled: savedAnswers[firstQ.id] === undefined || savedAnswers[firstQ.id] === null,
      confirmText: isImmersive && startIdx === 0 ? '确认并开始' : isFirstLast ? '确认并提交' : '确认并继续',
      dialogText: initialDialogText,
      welcomePhaseDone: welcomePhaseDone,
      isLastQuestion: isFirstLast
    });

    console.log('[Assessment] setData完成, totalQuestions:', questions.length, 'npcMode:', npcMode);

    this._loadNpcAssets(npcSettings);
  },

  onUnload: function () {
    // 保存进度
    if (this.data.scale && Object.keys(this.data.answers).length > 0) {
      storage.saveAssessmentProgress({
        scaleId: this.data.scale.id,
        scaleCode: this.data.scale.code || this.data.scale.scaleCode || '',
        answers: this.data.answers,
        currentIndex: this.data.currentIndex,
        startTime: this.data.startTime,
        npcMode: this.data.npcMode
      });
    }
  },

  _loadNpcAssets: function (settings) {
    const self = this;
    let assetUpdates = {};
    let pendingCount = 0;

    console.log(
      '[Assessment] _loadNpcAssets, counselorId:',
      settings.counselorId || '(空)',
      'bgId:',
      settings.bgId || '(空)'
    );

    function tryApply() {
      if (pendingCount <= 0 && Object.keys(assetUpdates).length > 0) {
        self.setData(assetUpdates);
        assetUpdates = {};
      }
    }

    // 加载咨询师立绘
    if (settings.counselorId) {
      pendingCount++;
      assetManager
        .getAssetPath(settings.counselorId)
        .then(function (path) {
          if (path) {
            assetUpdates.counselorImage = path;
          } else {
            return assetManager
              .downloadAsset(settings.counselorId)
              .then(function (dlPath) {
                if (dlPath) {
                  assetUpdates.counselorImage = dlPath;
                } else {
                  assetUpdates.counselorImage = '/assets/images/counselor.png';
                }
              })
              .catch(function (err) {
                console.warn('[Assessment] 咨询师图片下载失败，使用兜底图:', err.message || err);
                assetUpdates.counselorImage = '/assets/images/counselor.png';
              });
          }
        })
        .then(function () {
          pendingCount--;
          tryApply();
        })
        .catch(function (err) {
          console.warn('[Assessment] 咨询师图片查询异常:', err.message || err);
          assetUpdates.counselorImage = '/assets/images/counselor.png';
          pendingCount--;
          tryApply();
        });
    } else {
      // 没有配置 counselorId，使用兜底图
      assetUpdates.counselorImage = '/assets/images/counselor.png';
      tryApply();
    }
    // 加载背景图
    if (settings.bgId) {
      pendingCount++;
      assetManager
        .getAssetPath(settings.bgId)
        .then(function (path) {
          if (path) {
            assetUpdates.backgroundImage = path;
          } else {
            return assetManager
              .downloadAsset(settings.bgId)
              .then(function (dlPath) {
                if (dlPath) {
                  assetUpdates.backgroundImage = dlPath;
                }
              })
              .catch(function (err) {
                console.warn('[Assessment] 背景图下载失败:', err.message || err);
              });
          }
        })
        .then(function () {
          pendingCount--;
          tryApply();
        })
        .catch(function (err) {
          console.warn('[Assessment] 背景图查询异常:', err.message || err);
          pendingCount--;
          tryApply();
        });
    }
  },

  _findScaleById: function (id) {
    const cached = storage.getScalesCache() || [];
    for (let i = 0; i < cached.length; i++) {
      if (cached[i].id === id) {
        return cached[i];
      }
    }
    return null;
  },

  _findScaleByCode: function (code) {
    if (!code) {
      return null;
    }
    const cached = storage.getScalesCache() || [];
    for (let i = 0; i < cached.length; i++) {
      if (cached[i].code === code || cached[i].scaleCode === code) {
        return cached[i];
      }
    }
    return null;
  },

  /** 展示指定索引的题目 */
  _showQuestion: function (idx, transition) {
    if (idx < 0 || idx >= this.data.questions.length) {
      console.warn('[Assessment] _showQuestion invalid idx:', idx, 'total:', this.data.questions.length);
      return;
    }

    const q = this.data.questions[idx];
    const isLast = idx >= this.data.questions.length - 1;
    const progress = Math.round(((idx + 1) / this.data.questions.length) * 100);

    // 确定题型
    let qType = q.type || 'single';
    console.log('[Assessment] showQ:', idx, 'type:', qType, 'content:', (q.content || '').substring(0, 20));
    if (q.groups && !q.type) {
      qType = 'grouped';
    }

    // 构造当前答案（WXML 不支持 || {} 或 || '' 字面量，且 setData 不允许 undefined）
    let curAnswer = this.data.answers[q.id];
    if (curAnswer === undefined || curAnswer === null) {
      if (qType === 'matrix' || qType === 'parent-child') {
        curAnswer = {};
      } else if (qType === 'text') {
        curAnswer = '';
      } else {
        curAnswer = '';
      }
    }

    // 沉浸模式：打字效果未完成前不显示选项和确认按钮
    // 普通模式：立即显示选项和确认按钮
    const isImmersive = this.data.npcMode === 'immersive';
    const showOptions = !isImmersive;
    const showConfirm = !isImmersive;

    // 沉浸模式欢迎语阶段（第一题）：打字完成后只显示"确认并开始"，不显示选项
    let confirmText = isLast ? '确认并提交' : '确认并继续';
    if (isImmersive && idx === 0) {
      confirmText = '确认并开始';
    }

    // 构造题目文本
    const questionText = '【第' + (idx + 1) + '题】' + (q.content || '');

    const prevAnswer = this.data.answers[q.id];

    // 保存过渡语到 data，供两阶段打字使用
    const pendingTransition = isImmersive && transition ? transition : '';

    this.setData({
      currentIndex: idx,
      currentQuestion: q,
      currentType: qType,
      currentAnswer: curAnswer,
      progress: progress,
      selectedAnswer: null,
      showOptions: showOptions,
      showConfirm: showConfirm,
      confirmDisabled: prevAnswer === undefined || prevAnswer === null,
      confirmText: confirmText,
      pendingTransition: pendingTransition,
      transitionText: '',
      isLastQuestion: isLast
    });

    // 沉浸模式：两阶段打字（对齐 H5 时序）
    // 阶段1：过渡语单独打字 → 完成后延迟400ms → 阶段2：题目文本打字
    // 无过渡语时直接打题目文本
    if (isImmersive) {
      if (pendingTransition) {
        // 先打过渡语
        this.setData({ dialogText: pendingTransition, _typingPhase: 'transition' });
      } else {
        // 无过渡语，直接打题目文本
        this.setData({ dialogText: questionText, _typingPhase: 'question' });
      }
    } else {
      // 普通模式：直接显示题目文本
      this.setData({ dialogText: questionText });
    }

    // 沉浸模式欢迎语（覆盖第一题的对话文本）
    if (idx === 0 && this.data.npcMode === 'immersive' && this.data.npcSettings) {
      const welcome = this.data.npcSettings.welcomeText;
      if (welcome) {
        this.setData({ dialogText: welcome, welcomePhaseDone: false, _typingPhase: 'welcome' });
      } else {
        this.setData({ welcomePhaseDone: true, _typingPhase: 'question' });
      }
    }

    // 保存进度
    storage.saveAssessmentProgress({
      scaleId: this.data.scale.id,
      scaleCode: this.data.scale.code || '',
      answers: this.data.answers,
      currentIndex: idx,
      startTime: this.data.startTime,
      npcMode: this.data.npcMode
    });
  },

  /** 题型组件答案回调 */
  onAnswer: function (e) {
    const detail = e.detail;
    const qid = detail.questionId;
    const answer = detail.answer;

    const answers = this.data.answers;
    answers[qid] = answer;

    this.setData({
      answers: answers,
      confirmDisabled: false,
      selectedAnswer: answer
    });
  },

  /** 确认按钮 */
  onConfirm: function () {
    if (this.data.confirmDisabled) {
      return;
    }

    // 沉浸模式第一题欢迎阶段：切换到实际题目文本，不跳题
    if (this.data.npcMode === 'immersive' && this.data.currentIndex === 0 && !this.data.welcomePhaseDone) {
      const q = this.data.questions[0];
      const dialogText = '【第1题】' + (q.content || '');
      this.setData({
        welcomePhaseDone: true,
        dialogText: dialogText,
        showOptions: false,
        showConfirm: false,
        _typingPhase: 'question'
      });
      return;
    }

    this._goNext();
  },

  /** 沉浸模式打字完成回调（对齐 H5 时序：两阶段打字） */
  onTypingComplete: function () {
    if (this.data.npcMode !== 'immersive') {
      return;
    }

    const phase = this.data._typingPhase || 'question';

    // 阶段1：过渡语打字完成 → 延迟400ms后打题目文本（对齐 H5）
    if (phase === 'transition') {
      const self = this;
      const questionText = '【第' + (this.data.currentIndex + 1) + '题】' + (this.data.currentQuestion.content || '');
      setTimeout(function () {
        self.setData({ dialogText: questionText, _typingPhase: 'question' });
      }, 400);
      return;
    }

    // 阶段2：题目文本打字完成 → 显示选项+确认按钮
    const updateData = { showConfirm: true };

    // 欢迎语阶段（idx===0 且 welcomePhaseDone=false）：确认按钮无需答案即可点击
    if (!this.data.welcomePhaseDone && this.data.currentIndex === 0) {
      updateData.confirmDisabled = false;
    }

    // 答题阶段（welcomePhaseDone=true 或 idx>0）：显示选项+确认按钮
    if (this.data.welcomePhaseDone || this.data.currentIndex > 0) {
      updateData.showOptions = true;
    }

    this.setData(updateData);
  },

  _goNext: function () {
    const isLast = this.data.currentIndex >= this.data.questions.length - 1;

    if (isLast) {
      this._submitAssessment();
      return;
    }

    // 沉浸模式：先隐藏选项和确认栏（对齐 H5：确认答案后立即清除选项区）
    if (this.data.npcMode === 'immersive') {
      this.setData({ showOptions: false, showConfirm: false });
    }

    // 下一题
    const nextIdx = this.data.currentIndex + 1;

    // 沉浸模式过渡语：传递给 _showQuestion 做两阶段打字
    let pendingTransition = '';
    if (this.data.npcMode === 'immersive') {
      const transition = npcHelper.getTransitionForQuestion(
        this.data.npcSettings,
        this.data.questions[nextIdx] ? this.data.questions[nextIdx].transition : null
      );
      pendingTransition = transition || '';
    }

    this._showQuestion(nextIdx, pendingTransition);
  },

  /** 上一题 */
  onPrev: function () {
    if (this.data.currentIndex > 0) {
      this._showQuestion(this.data.currentIndex - 1);
    }
  },

  /** 模式切换 */
  onSwitchMode: function (e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.npcMode) {
      return;
    }
    this.setData({ npcMode: mode });
    // 重新展示当前题目
    this._showQuestion(this.data.currentIndex);
  },

  /** 退出测评（对齐H5: confirmExit） */
  onExit: function () {
    wx.showModal({
      title: '退出测评',
      content: '确定要退出当前测评吗？已作答的内容将不会保存。',
      confirmText: '退出',
      cancelText: '继续答题',
      success: function (res) {
        if (res.confirm) {
          wx.navigateBack();
        }
      }
    });
  },

  /** 提交测评 */
  _submitAssessment: function () {
    if (this.data.submitting) {
      return;
    }
    this.setData({ submitting: true });

    const scale = this.data.scale;
    const answers = this.data.answers;

    // 计分
    let result;
    try {
      result = ScoringEngine.calculate(scale, answers);
    } catch (e) {
      console.error('[Assessment] 计分失败:', e);
      result = {
        metrics: { totalScore: 0 },
        dimensions: [],
        interpretation: [],
        screening: { result: 'none' },
        rawAnswers: answers
      };
    }

    // 构造结果
    // totalScore 优先取 metric，若量表未定义则从维度累加
    const rawTotal = result.metrics
      ? result.metrics.totalScore ||
        result.metrics.total_score ||
        result.metrics['总分'] ||
        result.metrics.metric_total_score
      : null;
    let totalScore = 0;
    if (rawTotal !== null && rawTotal !== undefined && rawTotal !== 0) {
      totalScore = rawTotal;
    } else if (result.dimensions && result.dimensions.length > 0) {
      // 从维度累加总分
      for (let _si = 0; _si < result.dimensions.length; _si++) {
        totalScore += result.dimensions[_si].score || 0;
      }
    }
    const totalMaxScore = (result.maxScores && result.maxScores.total) || 100;
    const interp = result.interpretation && result.interpretation.length > 0 ? result.interpretation[0] : null;
    const level = interp ? interp.level || '' : '';
    const levelName = interp ? interp.label || '' : '';
    const sColor = interp ? interp.color || '#5b8fb9' : '#5b8fb9';
    const levelText = interp ? interp.text || '' : '';

    const dims = result.dimensions.map(function (d) {
      const dimMax = d.max || 5;
      const dimInterp = d.interpretation || null;
      return {
        name: d.label || d.key,
        key: d.key,
        score: d.score,
        max: dimMax,
        pct: dimMax > 0 ? Math.round((d.score / dimMax) * 100) : 0,
        color: (dimInterp && dimInterp.color) || sColor,
        levelLabel: d.levelLabel || (dimInterp ? dimInterp.label || '' : ''),
        levelText: d.levelText || (dimInterp ? dimInterp.text || '' : ''),
        hasInterp: d.hasInterp !== undefined ? d.hasInterp : !!dimInterp
      };
    });

    // 判断是否显示总分展示区：仅当计分规则显式定义了 totalScore metric 时显示
    const scoring = scale.scoring || {};
    const metrics = scoring.metrics || [];
    const hasExplicitTotal = metrics.some(function (m) {
      const k = m.key || m.name || '';
      return k === 'totalScore' || k === 'total_score' || k === '总分' || k === 'metric_total_score';
    });
    const showTotalScore = hasExplicitTotal || dims.length === 0;

    const assessmentResult = {
      scaleId: scale.id,
      scaleName: scale.name || scale.title || '',
      emoji: scale.icon || scale.emoji || '📋',
      totalScore: totalScore,
      totalMaxScore: totalMaxScore,
      level: level,
      levelName: levelName,
      color: sColor,
      levelText: levelText,
      interp: levelText,
      dims: dims,
      showTotalScore: showTotalScore,
      screeningResult: result.screening || { result: 'none' },
      rawAnswers: answers,
      preAnswers: this.data.preAnswers,
      completedAt: new Date().toISOString()
    };

    // 清除进度
    storage.clearAssessmentProgress();

    // 保存到 globalData
    app.globalData.lastAssessmentResult = assessmentResult;

    // 尝试云端提交
    const durationSec = Math.round((Date.now() - this.data.startTime) / 1000);
    const resultPayload = {
      totalScore: totalScore,
      maxScore: totalMaxScore,
      level: level,
      levelName: levelName,
      color: sColor,
      scaleName: scale.displayName || scale.name || assessmentResult.scaleName,
      scaleNameOriginal: scale.name || scale.title || '',
      emoji: scale.icon || scale.emoji || '📋',
      categoryName: scale.categoryName || scale.category || '',
      dimensions: dims
    };
    api
      .submitAssessment(scale.id, answers, durationSec, null, resultPayload)
      .then(function (cloudResult) {
        console.log('[Assessment] 提交成功, cloudResult:', JSON.stringify(cloudResult));
        if (cloudResult && cloudResult.id) {
          assessmentResult.id = cloudResult.id;
          if (cloudResult.completedAt) {
            assessmentResult.completedAt = cloudResult.completedAt;
          }
        }
        app.globalData.lastAssessmentResult = assessmentResult;
        // 本地历史（补全 dims/screeningResult，否则从历史记录进入结果页维度/筛查不展示）
        storage.addLocalHistory({
          id: assessmentResult.id || Date.now(),
          scaleId: scale.id,
          scaleName: assessmentResult.scaleName,
          emoji: assessmentResult.emoji,
          score: totalScore,
          maxScore: totalMaxScore,
          level: level,
          levelName: levelName,
          color: sColor,
          categoryName: scale.categoryName || scale.category || '',
          date: format.formatDate(new Date()),
          completedAt: assessmentResult.completedAt,
          dims: dims,
          screeningResult: result.screening || { result: 'none' },
          showTotalScore: showTotalScore
        });
      })
      .catch(function (err) {
        console.warn('[Assessment] 提交失败，降级本地保存:', err.message || err);
        // 降级：仅本地保存（同样补全 dims/screeningResult）
        storage.addLocalHistory({
          id: Date.now(),
          scaleId: scale.id,
          scaleName: assessmentResult.scaleName,
          emoji: assessmentResult.emoji,
          score: totalScore,
          maxScore: totalMaxScore,
          level: level,
          levelName: levelName,
          color: sColor,
          categoryName: scale.categoryName || scale.category || '',
          date: format.formatDate(new Date()),
          completedAt: assessmentResult.completedAt,
          dims: dims,
          screeningResult: result.screening || { result: 'none' },
          showTotalScore: showTotalScore
        });
      });

    // 跳转结果页
    wx.redirectTo({ url: '/pages/result/result' });
  }
});
