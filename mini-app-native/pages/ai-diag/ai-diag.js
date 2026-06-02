/**
 * pages/ai-diag — AI 诊断页
 *
 * 三种状态：未获取 → 加载中 → 已完成
 * 完整 Markdown 渲染（对齐 H5 renderDiagReport）
 * 功能：语音播报、收藏、分享
 */

const api = require('../../utils/api.js');
const npcHelper = require('../../utils/npc-helper.js');
const assetManager = require('../../utils/asset-manager.js');
const storage = require('../../utils/storage.js');
const constants = require('../../utils/constants.js');

const app = getApp();

/** 格式约束（对齐 H5 output-format prompt） */
const FORMAT_CONSTRAINT =
  '【⚠️ 输出格式强制要求】\n' +
  '你只能使用以下 Markdown 语法，严禁使用任何 HTML 标签：\n' +
  '- 粗体用 **文字** ，斜体用 *文字*\n' +
  '- 标题用 ## 或 ### 开头，分隔线用独占一行的 ---\n' +
  '- 列表用 - 或数字编号 1. 2. 3. 开头\n' +
  '- 引用语用 > 开头\n' +
  '- **严禁**使用 <div>、<span>、<br>、<table>、<strong> 等 HTML 标签\n' +
  '- **严禁**使用 | 列 | 列 | Markdown 表格语法\n' +
  '- 如需呈现对比信息，请用列表或粗体标题+文字描述替代表格';

/**
 * 情感 Profile（对齐服务端 EMOTION_PROFILES）
 * 根据报告内容自动选择语气：
 *   - 积极/正常结果 → empathetic（共情温暖）
 *   - 关注/风险提示 → serious（严肃稳重）
 *   - 鼓励/建议 → gentle（温和鼓励）
 */
const EMOTION_MAP = {
  neutral: 'neutral',
  empathetic: 'empathetic',
  gentle: 'gentle',
  cheerful: 'cheerful',
  serious: 'serious',
  calm: 'calm'
};

Page({
  data: {
    state: 'idle', // idle | loading | done
    diagText: '',
    parsedBlocks: [], // 解析后的 Markdown 块
    errorMessage: '',
    npcSettings: { counselorName: '', motto: '', welcomeText: '' },
    counselorImage: '',
    backgroundImage: '',
    // 头部信息
    scaleName: '',
    scoreText: '',
    levelName: '',
    themeColor: '#667eea',
    // TTS
    ttsPlaying: false,
    ttsLoading: false,
    ttsRate: 1.0,
    ttsProgress: 0, // 0-100 播放进度
    ttsDuration: 0, // 总时长（秒）
    ttsCurrentTime: 0, // 当前时间（秒）
    ttsEmotion: 'empathetic', // 默认共情语气
    // 收藏
    isFavorited: false,
    // 免责声明
    disclaimerText: '本系统生成的测评报告，仅供参考，不构成医疗诊断',
    // 生成时间
    diagTime: ''
  },

  _diagLoading: false,
  _ttsMgr: null, // wx.getBackgroundAudioManager() 后台音频管理器（单例，锁屏继续播放）
  _ttsAudioUrl: '', // 当前播放的音频 URL（CDN 地址）
  _ttsDuration: 0, // 总时长（秒，供进度计算用）

  onLoad: function () {
    const scale = app.globalData.currentScale;
    const result = app.globalData.lastAssessmentResult;
    if (!scale || !result) {
      wx.showToast({ title: '缺少测评数据', icon: 'none' });
      return;
    }

    let npcSettings = npcHelper.resolveNpcSetting(scale);
    if (!npcSettings) {
      npcSettings = {};
    }
    npcSettings.counselorName = npcSettings.counselorName || '';
    npcSettings.motto = npcSettings.motto || '';
    npcSettings.welcomeText = npcSettings.welcomeText || '';
    this._loadNpcAssets(npcSettings);

    // 头部信息
    const sColor = scale.color || scale.themeColor || '#667eea';
    const scoreStr = result.totalScore !== undefined ? result.totalScore : '--';
    const maxStr = result.totalMaxScore !== undefined ? '/' + result.totalMaxScore : '';

    this.setData({
      npcSettings: npcSettings,
      scaleName: scale.name || scale.scaleName || '',
      scoreText: scoreStr + maxStr,
      levelName: result.levelName || '--',
      themeColor: sColor
    });

    // 检查是否已有收藏
    this._checkFavorite();
  },

  onUnload: function () {
    this._stopTts();
  },

  _loadNpcAssets: function (settings) {
    const self = this;
    if (settings.counselorId) {
      assetManager.getAssetPath(settings.counselorId).then(function (path) {
        if (path) {
          self.setData({ counselorImage: path });
        }
      });
    }
    if (settings.bgId) {
      assetManager.getAssetPath(settings.bgId).then(function (path) {
        if (path) {
          self.setData({ backgroundImage: path });
        }
      });
    }
  },

  // ====================================================
  // AI 诊断核心逻辑（对齐 H5 requestAiDiagnosis）
  // ====================================================

  /** 开始 AI 诊断 */
  onStartDiag: function () {
    // 防抖
    if (this._diagLoading) {
      return;
    }
    this._diagLoading = true;

    const self = this;
    const scale = app.globalData.currentScale;
    const result = app.globalData.lastAssessmentResult;
    if (!scale || !result) {
      this._diagLoading = false;
      return;
    }

    // 检查 aiDiag 配置
    const diag = scale.aiDiag || {};
    if (!diag.enabled && !diag.prompt) {
      this._diagLoading = false;
      wx.showToast({ title: '该量表暂未配置测评详情', icon: 'none' });
      return;
    }

    this.setData({ state: 'loading', errorMessage: '' });

    /** 安全拼接字段 */
    const safe = function (v, fallback) {
      if (v === undefined || v === null) {
        return fallback || '';
      }
      return v;
    };

    // ---- 构建系统提示词（对齐 H5 优先级：aiDiagPrompt > aiDiag.prompt） ----
    // scale.aiDiagPrompt：独立 SP 提示词（已含变量展开内容，部分量表如 LES 有此字段）
    // scale.aiDiag.prompt：模板提示词（含 {scaleName}/{score} 等占位符）
    const standalonePrompt = scale.aiDiagPrompt || '';
    const templatePrompt = diag.prompt || '';

    // 预处理数据（供嵌套变量替换使用）
    const dimsObj = this._dimsToObj(result.dims);
    const preqObj = this._formatPrequAnswersObj(result.preAnswers, scale);

    /** 统一替换入口（处理嵌套变量如 {dimensions['家庭相关问题']}） */
    const expand = function (text) {
      return (
        text
          // 1. 先处理嵌套变量 {dimensions['键']} / {answers['题号']} / {preqAnswers['键']} / {demographics['键']}
          // 模式：(['"])...\1 利用反向引用确保前后引号一致
          // 注意：键不存在时返回原始字符串（如 SP 说明文字 "不要用{dimensions['xx']}" 会被保留）
          .replace(/\{dimensions\[(['"])([^'"]+)\1\]}/g, function (m, quote, key) {
            const v = dimsObj[key];
            if (v !== undefined && v !== null) {
              if (typeof v === 'object') {
                return v.value !== undefined ? v.value : JSON.stringify(v);
              }
              return v;
            }
            return m; // 键不存在，保留原文本（可能是 SP 说明文字）
          })
          .replace(
            /\{answers\[(['"])([^'"]+)\1\]}/g,
            function (m, quote, qid) {
              const humAns = this._humanizeAnswers(result.rawAnswers, scale);
              const v = (humAns || {})[qid];
              if (v !== undefined) {
                return JSON.stringify(v);
              }
              return m;
            }.bind(this)
          )
          .replace(/\{preqAnswers\[(['"])([^'"]+)\1\]}/g, function (m, quote, key) {
            const v = preqObj[key];
            if (v !== undefined) {
              return v;
            }
            return m;
          })
          .replace(/\{demographics\[(['"])([^'"]+)\1\]}/g, function (m, quote, key) {
            const v = preqObj[key];
            if (v !== undefined) {
              return v;
            }
            return m;
          })
          // 2. 再处理扁平变量
          .replace(/\{scaleName\}/g, safe(scale.name || scale.scaleName))
          .replace(/\{score\}/g, result.totalScore || 0)
          .replace(/\{level\}/g, safe(result.levelName, '未知'))
          .replace(/\{dimensions\}/g, JSON.stringify(result.dims || []))
          .replace(/\{answers\}/g, JSON.stringify(this._humanizeAnswers(result.rawAnswers, scale)))
          .replace(/\{demographics\}/g, this._formatDemographics(result.preAnswers, scale))
          // 3. 兜底：未匹配的 {preqAnswers} 整体替换为格式化文本
          .replace(/\{preqAnswers\}/g, this._formatDemographics(result.preAnswers, scale))
      );
    }.bind(this);

    const rawPrompt = standalonePrompt.trim() ? standalonePrompt : templatePrompt;
    let systemPrompt = expand(rawPrompt);
    console.log('[AIDiag] 使用 ' + (standalonePrompt.trim() ? 'aiDiagPrompt' : 'aiDiag.prompt') + '（模板提示词）');

    // 追加格式约束
    systemPrompt += '\n\n' + FORMAT_CONSTRAINT;

    const messages = [{ role: 'system', content: systemPrompt }];
    console.log('[AIDiag] systemPrompt 首100字:', systemPrompt.substring(0, 100));

    // 添加 user 消息
    if (diag.welcome) {
      messages.push({ role: 'user', content: diag.welcome });
    } else {
      messages.push({ role: 'user', content: '请根据以上信息，为我生成测评分析报告。' });
    }

    const temperature = diag.temperature || 0.7;
    const maxTokens = diag.maxTokens || 2000;

    console.log('[AIDiag] 发送 messages:', JSON.stringify(messages).substring(0, 500));

    api
      .aiDiagnose(messages, { provider: 'dashscope', temperature: temperature, maxTokens: maxTokens })
      .then(function (res) {
        self._diagLoading = false;
        // request() 已提取 json.data，res 可能是字符串（AI 文本）或对象
        let text = typeof res === 'string' ? res : res.content || res.text || res.data || '';
        if (typeof text !== 'string') {
          text = JSON.stringify(text);
        }

        const now = new Date();
        const timeStr =
          now.getFullYear() +
          '-' +
          (now.getMonth() + 1) +
          '-' +
          now.getDate() +
          ' ' +
          now.getHours() +
          ':' +
          (now.getMinutes() < 10 ? '0' : '') +
          now.getMinutes();

        self.setData({
          state: 'done',
          diagText: text,
          parsedBlocks: self._parseMarkdown(text),
          diagTime: timeStr,
          disclaimerText: '本系统生成的测评报告，仅供参考，不构成医疗诊断\n生成时间：' + timeStr
        });

        // 保存到本地收藏记录（可查看）
        self._saveReportToLocal(text, timeStr);
      })
      .catch(function (err) {
        self._diagLoading = false;
        self.setData({
          state: 'idle',
          errorMessage: 'AI诊断请求失败，请稍后重试'
        });
        wx.showToast({ title: '请求失败', icon: 'none' });
      });
  },

  /** 将 dims 数组转为 {名称: 值} 对象（供嵌套变量 {dimensions['键']} 使用） */
  _dimsToObj: function (dims) {
    if (!dims) {
      return {};
    }
    if (Array.isArray(dims)) {
      const obj = {};
      dims.forEach(function (d) {
        if (d && d.name !== undefined) {
          obj[d.name] = d.value !== undefined ? d.value : d.score !== undefined ? d.score : d;
        }
      });
      return obj;
    }
    // 已是对象
    return dims;
  },

  /** 格式化测前问卷答案为对象（供嵌套引用 {preqAnswers['键']} 使用） */
  _formatPrequAnswersObj: function (preqAnswers, scale) {
    if (!preqAnswers || Object.keys(preqAnswers).length === 0) {
      return {};
    }
    if (!scale || !scale.preQuestions) {
      return preqAnswers;
    }
    const obj = {};
    (scale.preQuestions || []).forEach(function (q) {
      const val = preqAnswers[q.id];
      if (val === undefined || val === null || val === '') {
        return;
      }
      if (q.type === 'select') {
        const opt = (q.options || []).find(function (o) {
          return o.value === val;
        });
        obj[q.label] = opt ? opt.label : val;
      } else if (q.type === 'checkbox') {
        const labels = (q.options || [])
          .filter(function (o) {
            return Array.isArray(val) && val.indexOf(o.value) >= 0;
          })
          .map(function (o) {
            return o.label;
          });
        obj[q.label] = labels.length > 0 ? labels.join('、') : val;
      } else {
        obj[q.label] = val;
      }
    });
    return obj;
  },

  /** 将 grouped/allowRepeat 题型编码值转为人类可读标签（对齐 H5 _humanizeAnswers） */
  _humanizeAnswers: function (answers, scale) {
    if (!answers || !scale || !scale.questions) {
      return answers || {};
    }
    const labelMaps = {};
    let hasGrouped = false;
    (scale.questions || []).forEach(function (q) {
      if (q.type === 'grouped' && q.groups) {
        hasGrouped = true;
        labelMaps[q.id] = {};
        q.groups.forEach(function (g) {
          labelMaps[q.id][g.id] = {};
          (g.options || []).forEach(function (o) {
            if (o.label) {
              labelMaps[q.id][g.id][o.id] = o.label;
            }
          });
        });
      }
    });
    if (!hasGrouped) {
      return answers;
    }
    const result = {};
    Object.keys(answers).forEach(function (qid) {
      const val = answers[qid];
      const maps = labelMaps[qid];
      if (!maps) {
        result[qid] = val;
        return;
      }
      if (Array.isArray(val)) {
        result[qid] = val.map(function (item) {
          const mapped = {};
          Object.keys(item).forEach(function (k) {
            if (k === 'name' || !maps[k]) {
              mapped[k] = item[k];
            } else {
              mapped[k] = maps[k] && maps[k][item[k]] ? maps[k][item[k]] : item[k];
            }
          });
          return mapped;
        });
      } else if (typeof val === 'object' && val !== null) {
        const mapped = {};
        Object.keys(val).forEach(function (k) {
          if (maps[k] && maps[k][val[k]]) {
            mapped[k] = maps[k][val[k]];
          } else {
            mapped[k] = val[k];
          }
        });
        result[qid] = mapped;
      } else {
        result[qid] = val;
      }
    });
    return result;
  },

  /** 格式化测前问卷答案为可读文本（对齐 H5 _formatDemographics） */
  _formatDemographics: function (preqAnswers, scale) {
    if (!preqAnswers || Object.keys(preqAnswers).length === 0) {
      return '';
    }
    if (!scale || !scale.preQuestions) {
      return JSON.stringify(preqAnswers);
    }
    const lines = [];
    scale.preQuestions.forEach(function (q) {
      const val = preqAnswers[q.id];
      if (val === undefined || val === null || val === '') {
        return;
      }
      if (q.type === 'select') {
        const opt = (q.options || []).find(function (o) {
          return o.value === val;
        });
        lines.push(q.label + '：' + (opt ? opt.label : val));
      } else if (q.type === 'checkbox') {
        const labels = (q.options || [])
          .filter(function (o) {
            return Array.isArray(val) && val.indexOf(o.value) >= 0;
          })
          .map(function (o) {
            return o.label;
          });
        lines.push(q.label + '：' + (labels.length > 0 ? labels.join('、') : val));
      } else {
        lines.push(q.label + '：' + val);
      }
    });
    return lines.length > 0 ? lines.join('；') : JSON.stringify(preqAnswers);
  },

  // ====================================================
  // Markdown 渲染（对齐 H5 renderDiagReport 纯 MD 路径）
  // ====================================================

  /** 增强版 Markdown 解析 */
  _parseMarkdown: function (text) {
    if (!text) {
      return [];
    }
    // 先转换表格（| ... | → card）
    text = this._convertMdTables(text);

    const lines = text.split('\n');
    const blocks = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 空行
      if (!trimmed) {
        continue;
      }

      // 分隔线 ---
      if (/^---+$/.test(trimmed)) {
        blocks.push({ type: 'hr' });
        continue;
      }

      // 四级标题 ####
      const h4m = trimmed.match(/^####\s+(.*)$/);
      if (h4m) {
        blocks.push({ type: 'heading', level: 4, text: h4m[1] });
        continue;
      }

      // 三级标题 ###
      const h3m = trimmed.match(/^###\s+(.*)$/);
      if (h3m) {
        blocks.push({ type: 'heading', level: 3, text: h3m[1] });
        continue;
      }

      // 二级标题 ##
      const h2m = trimmed.match(/^##\s+(.*)$/);
      if (h2m) {
        blocks.push({ type: 'heading', level: 2, text: h2m[1] });
        continue;
      }

      // 一级标题 #
      const h1m = trimmed.match(/^#\s+(.*)$/);
      if (h1m) {
        blocks.push({ type: 'heading', level: 1, text: h1m[1] });
        continue;
      }

      // 引用块 >
      const bqm = trimmed.match(/^>\s?(.*)$/);
      if (bqm) {
        blocks.push({ type: 'quote', text: bqm[1] });
        continue;
      }

      // 无序列表 - * +
      const ulm = trimmed.match(/^[-*+]\s+(.*)$/);
      if (ulm) {
        blocks.push({ type: 'list', text: ulm[1] });
        continue;
      }

      // 有序列表 1. 2. 3.
      const olm = trimmed.match(/^\d+\.\s+(.*)$/);
      if (olm) {
        blocks.push({ type: 'olist', text: olm[1] });
        continue;
      }

      // 管道表格（以 | 开头，含 3+ 分隔符）
      if (/^\|/.test(trimmed)) {
        const stdParts = trimmed
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map(function (s) {
            return s.trim();
          })
          .filter(function (s) {
            return s !== '' && !/^[-:]+$/.test(s);
          });
        if (stdParts.length >= 2) {
          blocks.push({ type: 'tablerow', cells: stdParts });
          continue;
        }
      }

      // 行内管道表格（非 | 开头，含 3+ 管道）
      const pipeParts = trimmed.split('|').map(function (s) {
        return s.trim();
      });
      if (pipeParts.length >= 4 && !/^\|/.test(trimmed)) {
        blocks.push({ type: 'tablerow', cells: pipeParts });
        continue;
      }

      // 普通段落：处理行内格式 **粗体** *斜体* ~~删除线~~ `代码`
      blocks.push({ type: 'paragraph', parts: this._parseInline(trimmed) });
    }
    return blocks;
  },

  /** 解析行内 Markdown 格式 */
  _parseInline: function (line) {
    const parts = [];
    // 使用正则逐段匹配 **粗体** *斜体* ~~删除线~~ `代码`
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`([^`]+)`)/g;
    let lastIdx = 0;
    let match;
    while ((match = regex.exec(line)) !== null) {
      // 前置普通文本
      if (match.index > lastIdx) {
        parts.push({ type: 'text', text: line.substring(lastIdx, match.index) });
      }
      if (match[2]) {
        parts.push({ type: 'bold', text: match[2] });
      } else if (match[3]) {
        parts.push({ type: 'italic', text: match[3] });
      } else if (match[4]) {
        parts.push({ type: 'del', text: match[4] });
      } else if (match[5]) {
        parts.push({ type: 'code', text: match[5] });
      }
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < line.length) {
      parts.push({ type: 'text', text: line.substring(lastIdx) });
    }
    if (parts.length === 0) {
      parts.push({ type: 'text', text: line });
    }
    return parts;
  },

  /** 将 Markdown 表格转换为卡片行（对齐 H5 convertMdTables） */
  _convertMdTables: function (text) {
    // 标准 Markdown 表格（表头 + 分隔行 + 数据行）
    const tableRe = /(\|[^\n]+\|\s*\n\|[\s:|-]+\|(?:\s*\n((\|[^\n]+\|\s*\n?)*))?)/g;
    text = text.replace(tableRe, function (match) {
      return _buildTableLines(match);
    });
    // 无分隔行的连续管道表格
    const looseTableRe = /((?:^\|[^\n]+\|[ \t]*$\n?){2,})/gm;
    text = text.replace(looseTableRe, function (match) {
      return _buildTableLines(match);
    });
    return text;
  },

  // ====================================================
  // 功能：TTS / 收藏 / 分享
  // ====================================================

  /** 语音播报切换 */
  onToggleTts: function () {
    if (this.data.ttsLoading) {
      return;
    } // 合成中不可切换
    if (this.data.ttsPlaying) {
      this._stopTts();
    } else {
      this._startTts();
    }
  },

  /** 设置语速 */
  onSetTtsRate: function (e) {
    const rate = parseFloat(e.currentTarget.dataset.rate);
    if (isNaN(rate)) {
      return;
    }
    this.setData({ ttsRate: rate });
    if (this._ttsMgr) {
      this._ttsMgr.playbackRate = rate;
    }
  },

  /** 切换情感模式 */
  onSetTtsEmotion: function (e) {
    const emotion = e.currentTarget.dataset.emotion;
    if (!EMOTION_MAP[emotion]) {
      return;
    }
    this.setData({ ttsEmotion: emotion });
    // 如果正在播放，需要重新合成
    if (this.data.ttsPlaying) {
      this._stopTts();
      this._startTts();
    }
  },

  /** 分析报告内容，自动选择最佳情感语气 */
  _autoDetectEmotion: function (text) {
    if (!text) {
      return 'empathetic';
    }
    const lower = text.toLowerCase();
    // 风险/警告关键词 → serious
    if (/风险|警告|危险|严重|自杀|自伤|抑郁倾向|焦虑障碍|需要.*专业/.test(lower)) {
      return 'serious';
    }
    // 积极/恭喜关键词 → cheerful
    if (/恭喜|优秀|非常好|心理健康.*良好|表现优异|值得肯定/.test(lower)) {
      return 'cheerful';
    }
    // 建议/鼓励关键词 → gentle
    if (/建议|可以尝试|不妨|推荐|鼓励|慢慢来/.test(lower)) {
      return 'gentle';
    }
    // 默认 → empathetic（共情温暖，适合大多数心理咨询场景）
    return 'empathetic';
  },

  /**
   * 启动 TTS 语音播报（URL 流式播放模式）
   * 架构：POST /api/tts/merged → 服务端合成+ffmpeg合并+MySQL缓存 → 返回 CDN URL
   *       客户端直接 src=URL 流式播放，无需写本地文件，不触发存储限制
   *
   * 旧方案（已废弃）：POST /api/tts/segments → base64[] → 逐段写临时文件播放
   * 新方案（当前）：POST /api/tts/merged → { url, duration } → InnerAudioContext.src = url
   */
  _startTts: function () {
    const text = this.data.diagText;
    if (!text) {
      wx.showToast({ title: '暂无报告内容', icon: 'none' });
      return;
    }

    const self = this;

    // 自动检测情感（如果用户没手动改过）
    const emotion = this.data.ttsEmotion || this._autoDetectEmotion(text);
    this.setData({ ttsLoading: true, ttsEmotion: emotion });

    // 1. 转换为口语化文本
    const speechText = this._convertReportToSpeechText(text);
    // 2. 分段
    const segments = this._splitTextToSegments(speechText);
    if (segments.length === 0) {
      this.setData({ ttsLoading: false });
      wx.showToast({ title: '无可朗读内容', icon: 'none' });
      return;
    }

    // 3. 调用服务端合并+缓存端点（返回 CDN URL）
    const rateStr = '+' + Math.round((this.data.ttsRate - 1) * 100) + '%';
    const apiBase = constants.API_BASE;

    wx.request({
      url: apiBase + '/api/tts/merged',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        segments: segments,
        rate: rateStr,
        emotion: emotion,
        silenceMs: 500
      },
      success: function (res) {
        if (res.statusCode !== 200 || !res.data || res.data.code !== 0 || !res.data.data) {
          const msg = (res.data && res.data.message) || 'HTTP ' + res.statusCode;
          console.error('[TTS] 合成失败:', msg);
          self.setData({ ttsLoading: false });
          wx.showToast({ title: '语音合成失败', icon: 'none' });
          return;
        }

        const result = res.data.data;
        const audioUrl = result.url;
        const duration = result.duration || 0;

        console.log(
          '[TTS] 合成完成，cached=' +
            result.cached +
            '，duration=' +
            duration +
            's，url=' +
            audioUrl.substring(0, 80) +
            '...'
        );

        // 4. 直接设置 src 为 CDN URL 流式播放（不写本地文件）
        self._ttsAudioUrl = audioUrl;
        self._ttsDuration = duration;
        self._playFromUrl(audioUrl, duration);
      },
      fail: function (err) {
        console.error('[TTS] 请求失败:', err);
        self.setData({ ttsLoading: false });
        wx.showToast({ title: '网络请求失败', icon: 'none' });
      }
    });
  },

  /**
   * 从 CDN URL 启动后台音频播放（支持锁屏继续播放）
   * 使用 BackgroundAudioManager（单例）：
   *   - 锁屏时微信自动显示系统播放控件（标题/暂停按钮）
   *   - 页面销毁后继续播放，不中断
   *   - 无需 destroy/recreate，切换 src 即可
   */
  _playFromUrl: function (url, duration) {
    const self = this;

    // 复用已有管理器（BackgroundAudioManager 是单例）
    let mgr = this._ttsMgr;
    const isNew = !mgr;
    if (isNew) {
      mgr = wx.getBackgroundAudioManager();
      this._ttsMgr = mgr;
    } else {
      // 停止当前播放，解除旧事件监听（防止重复触发）
      mgr.stop();
    }

    // 设置锁屏显示信息（必须先于 src，iOS 需要）
    mgr.title = '测评报告语音播报';
    mgr.epname = '知我心灵测评';
    mgr.singer = '心理咨询师';
    mgr.coverImageUrl = '';

    // 音频源
    mgr.src = url;
    mgr.playbackRate = this.data.ttsRate;
    this._ttsDuration = duration || 0;

    // ---- 事件监听（每次重新绑定，防止页面切换后残留） ----

    // 监听函数引用，用于移除旧监听
    const _onTimeUpdate = function () {
      const current = mgr.currentTime || 0;
      const total = self._ttsDuration || mgr.duration || 1;
      const progress = Math.round((current / total) * 100);
      self.setData({
        ttsCurrentTime: Math.round(current),
        ttsProgress: Math.min(progress, 99)
      });
    };

    const _onEnded = function () {
      self.setData({
        ttsPlaying: false,
        ttsProgress: 100,
        ttsCurrentTime: 0
      });
    };

    const _onError = function (err) {
      console.error('[TTS] 播放错误:', err);
      self.setData({ ttsPlaying: false, ttsLoading: false });
      wx.showToast({ title: '音频播放失败', icon: 'none' });
    };

    // 移除旧监听（防止多次绑定累积）
    if (isNew) {
      mgr.onTimeUpdate(_onTimeUpdate);
      mgr.onEnded(_onEnded);
      mgr.onError(_onError);
    }

    // 音频加载中（首次设置 src 时会触发）
    mgr.onCanplay(function () {
      // 若之前没有时长信息，以管理器返回的为准
      if (!self._ttsDuration && mgr.duration) {
        self._ttsDuration = mgr.duration;
      }
      self.setData({
        ttsPlaying: true,
        ttsLoading: false,
        ttsDuration: self._ttsDuration
      });
    });

    // 等待/缓冲中
    mgr.onWaiting(function () {
      // 不改变 ttsPlaying 状态，保持播放中
    });
  },

  _stopTts: function () {
    // 停止后台音频管理器（BackgroundAudioManager 单例，stop 即可）
    if (this._ttsMgr) {
      this._ttsMgr.stop();
    }
    this._ttsAudioUrl = '';

    this.setData({
      ttsPlaying: false,
      ttsLoading: false,
      ttsProgress: 0,
      ttsCurrentTime: 0
    });
  },

  /**
   * 将 Markdown 诊断报告转换为口语化朗读文本
   * 对齐 H5 _convertReportToSpeechText
   */
  _convertReportToSpeechText: function (mdText) {
    if (!mdText) {
      return '';
    }
    let text = mdText;
    // 移除 Emoji
    text = text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
    text = text.replace(/[\u2600-\u27BF\u2B50\u2934-\u2BFF\uFE00-\uFEFF\u200D]/g, '');
    // 去掉 Markdown 标记
    text = text.replace(/^#{1,4}\s+/gm, '');
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');
    text = text.replace(/\*(.+?)\*/g, '$1');
    text = text.replace(/_{2}(.+?)_{2}/g, '$1');
    text = text.replace(/_(.+?)_/g, '$1');
    text = text.replace(/~~(.+?)~~/g, '$1');
    text = text.replace(/^>\s+/gm, '');
    text = text.replace(/^[-*+]\s+/gm, '，');
    text = text.replace(/^\d+\.\s+/gm, '');
    text = text.replace(/^---+$/gm, '');
    text = text.replace(/`(.+?)`/g, '$1');
    // 清理残留
    text = text.replace(/_+/g, '');
    text = text.replace(/\*+/g, '');
    text = text.replace(/#+/g, '');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();
    return text;
  },

  /**
   * 将文本按段落分割（对齐 H5 _splitTextToSegments）
   */
  _splitTextToSegments: function (text) {
    if (!text) {
      return [];
    }
    const paragraphs = text.split(/\n\n+/).filter(function (p) {
      return p.trim();
    });
    const segments = [];
    let buffer = '';
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i].trim();
      if (!p) {
        continue;
      }
      if ((buffer + '\n\n' + p).length > 300 && buffer) {
        segments.push(buffer.trim());
        buffer = p;
      } else {
        buffer = buffer ? buffer + '\n\n' + p : p;
      }
    }
    if (buffer.trim()) {
      segments.push(buffer.trim());
    }
    return segments;
  },

  /** 简单字符串哈希 */
  _hashCode: function (str) {
    let hash = 0;
    if (!str) {
      return hash;
    }
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  },

  /** 格式化时间 m:ss */
  _formatTime: function (sec) {
    if (!sec || isNaN(sec)) {
      return '0:00';
    }
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  },

  /** 收藏/取消收藏 */
  onToggleFavorite: function () {
    const key = 'psy_diag_fav_' + (app.globalData.currentScale || {}).id;
    if (this.data.isFavorited) {
      try {
        wx.removeStorageSync(key);
      } catch (e) {}
      this.setData({ isFavorited: false });
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    } else {
      const data = {
        scaleName: this.data.scaleName,
        scoreText: this.data.scoreText,
        levelName: this.data.levelName,
        diagText: this.data.diagText,
        diagTime: this.data.diagTime
      };
      try {
        wx.setStorageSync(key, JSON.stringify(data));
      } catch (e) {}
      this.setData({ isFavorited: true });
      wx.showToast({ title: '已收藏', icon: 'none' });
    }
  },

  _checkFavorite: function () {
    const key = 'psy_diag_fav_' + (app.globalData.currentScale || {}).id;
    try {
      const saved = wx.getStorageSync(key);
      this.setData({ isFavorited: !!saved });
    } catch (e) {}
  },

  /** 保存报告到本地 */
  _saveReportToLocal: function (text, timeStr) {
    const key = 'psy_diag_report_' + (app.globalData.currentScale || {}).id;
    try {
      wx.setStorageSync(
        key,
        JSON.stringify({
          text: text,
          time: timeStr,
          scaleName: this.data.scaleName,
          scoreText: this.data.scoreText,
          levelName: this.data.levelName
        })
      );
    } catch (e) {}
  },

  /** 分享报告 */
  onShareAppMessage: function () {
    return {
      title: '我的' + (this.data.scaleName || '') + '测评详情报告',
      path: '/pages/index/index',
      imageUrl: ''
    };
  },

  /** 重新诊断 */
  onRetry: function () {
    this._stopTts();
    this.setData({ state: 'idle', diagText: '', parsedBlocks: [], isFavorited: false });
  },

  /** 返回结果 */
  onBackToResult: function () {
    this._stopTts();
    wx.navigateBack();
  }
});

/** 辅助：将表格匹配文本转为逐行格式（保留 | 分隔符以便后续逐行解析） */
function _buildTableLines(match) {
  const lines = match.trim().split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // 跳过分隔行 |---|---|
    if (/^\|[\s:|-]+\|$/.test(line)) {
      continue;
    }
    result.push(line);
  }
  return result.join('\n');
}
