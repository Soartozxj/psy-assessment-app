/**
 * 星蓝心镜 — NPC 配置解析器
 *
 * 解析量表中的 npcConfig，生成完整的 NPC 场景配置。
 * 支持两种答题模式：
 *   - immersive（沉浸模式/NPC对话引导）
 *   - normal（普通模式/标准答题）
 *
 * NPC 配置层级：
 *   1. 量表级 npcConfig（counselorId, backgroundId, welcomeText）
 *   2. 全局默认配置（psy_npc_config）
 *   3. 内置兜底值
 *
 * 使用方式：
 *   var npcHelper = require('./npc-helper.js');
 *   var settings = npcHelper.resolveNpcSetting(scale);
 */

const storage = require('./storage.js');

/** Storage key for global NPC config */
const NPC_CONFIG_KEY = 'psy_npc_config';

/** 默认过渡语池 */
const DEFAULT_TRANSITIONS = [
  '接下来请你对下一项内容作答。',
  '我们按顺序进入下一个条目。',
  '下面继续完成下一项评估。',
  '请根据你的真实情况，看下一个问题。',
  '不着急，我们慢慢往下走。',
  '我们快完成啦，继续下一个。',
  '已经进行一部分了，我们接着往下。',
  '再坚持一下，我们看下一项。',
  '轻松一点，我们继续完成下一项。',
  '嗯，我了解了。',
  '好的，谢谢你的回答。',
  '明白了，请继续。'
];

/** 答题模式枚举 */
const NPC_MODES = {
  IMMERSIVE: 'immersive', // 沉浸模式：NPC对话引导答题
  NORMAL: 'normal' // 普通模式：标准答题
};

/**
 * 加载全局 NPC 配置
 * 优先从 Storage 读取，回退到 globalData.npcConfig（对齐 H5: localStorage → 云端缓存）
 * @returns {object|null} 全局配置对象
 */
function loadGlobalNpcConfig() {
  try {
    // 1. 优先从 Storage 读取（持久化缓存）
    const data = storage.get(NPC_CONFIG_KEY);
    if (data) {
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch (e) {
          // JSON 解析失败，继续尝试其他来源
        }
      } else if (typeof data === 'object') {
        return data;
      }
    }

    // 2. 回退到 globalData.npcConfig（内存缓存，_syncNpcConfigFromCloud 同步后设置）
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.npcConfig) {
        return app.globalData.npcConfig;
      }
    } catch (e) {
      // getApp 可能不在页面上下文中
    }

    return null;
  } catch (e) {
    console.warn('[NpcHelper] 加载全局NPC配置失败:', e.message);
    return null;
  }
}

/**
 * 保存全局 NPC 配置
 * @param {object} config - 配置对象
 * @returns {boolean}
 */
function saveGlobalNpcConfig(config) {
  return storage.set(NPC_CONFIG_KEY, config);
}

/**
 * 解析 NPC 过渡语
 * 支持纯文本数组和 {text, phase} 对象数组
 * @param {Array} [rawTransitions] - 原始过渡语数组
 * @returns {object} { texts: string[], raw: object[] }
 */
function parseTransitions(rawTransitions) {
  if (!rawTransitions || rawTransitions.length === 0) {
    return { texts: DEFAULT_TRANSITIONS.slice(), raw: [] };
  }

  const raw = [];
  const texts = [];

  for (let i = 0; i < rawTransitions.length; i++) {
    const t = rawTransitions[i];
    if (typeof t === 'string') {
      raw.push({ text: t, phase: '全部阶段' });
      texts.push(t);
    } else if (t && t.text) {
      raw.push({ text: t.text, phase: t.phase || '全部阶段' });
      texts.push(t.text);
    }
  }

  if (texts.length === 0) {
    return { texts: DEFAULT_TRANSITIONS.slice(), raw: [] };
  }

  return { texts: texts, raw: raw };
}

/**
 * 根据阶段过滤过渡语
 * @param {object[]} rawTransitions - 带阶段信息的过渡语
 * @param {string} phase - 目标阶段
 * @returns {string[]} 匹配的过渡语文本数组
 */
function filterTransitionsByPhase(rawTransitions, phase) {
  if (!rawTransitions || rawTransitions.length === 0 || !phase) {
    return DEFAULT_TRANSITIONS.slice();
  }

  const filtered = [];
  for (let i = 0; i < rawTransitions.length; i++) {
    const t = rawTransitions[i];
    if (t.phase === '全部阶段' || t.phase === phase || !t.phase) {
      filtered.push(t.text);
    }
  }

  return filtered.length > 0 ? filtered : DEFAULT_TRANSITIONS.slice();
}

/**
 * 解析量表的 NPC 配置
 * 从量表级 npcConfig → 全局默认 → 内置兜底 逐级查找
 *
 * @param {object} scale - 量表对象（含 npcConfig 字段）
 * @param {string} [displayName] - 量表显示名称（用于欢迎语）
 * @returns {object} NPC 场景配置
 *   {
 *     counselorId: string,    // 咨询师 ID（用于图片缓存查询）
 *     counselorImage: string, // 兜底图片路径
 *     counselorName: string,  // 咨询师名称
 *     motto: string,          // 咨询格言
 *     bio: string,            // 咨询师简介
 *     bgId: string,           // 背景 ID（用于图片缓存查询）
 *     bgStyle: string,        // 兜底背景样式
 *     transitions: string[],  // 过渡语池
 *     transitionsRaw: object[], // 带阶段信息的过渡语
 *     welcomeText: string     // 欢迎语
 *   }
 */
function resolveNpcSetting(scale, displayName) {
  const globalConfig = loadGlobalNpcConfig() || {};

  // 立绘：量表级 → 全局默认 → 内置
  const npcConfig = (scale && scale.npcConfig) || {};
  const counselorId = npcConfig.counselorId || globalConfig.defaultCounselorId || '';
  const counselorImage = 'counselor.png';

  // 咨询师元信息
  let counselorData = null;
  if (counselorId && globalConfig.counselors) {
    for (let i = 0; i < globalConfig.counselors.length; i++) {
      if (globalConfig.counselors[i].id === counselorId) {
        counselorData = globalConfig.counselors[i];
        break;
      }
    }
  }
  const counselorName = (counselorData && counselorData.counselorName) || '';
  const motto = (counselorData && counselorData.motto) || '每一种感受，都值得被温柔以待';
  const bio = (counselorData && counselorData.bio) || '';

  // 背景：量表级 → 全局默认 → 内置CSS渐变
  const bgId = npcConfig.backgroundId || globalConfig.defaultBackgroundId || '';
  const bgStyle = '';

  // 过渡语池
  const parsedTransitions = parseTransitions(globalConfig.transitions);

  // 欢迎语
  const name = counselorName || '咨询师';
  const scaleName = displayName || (scale && scale.name) || '这个量表';
  const welcomeText =
    npcConfig.welcomeText ||
    '你好，我是你的' + name + '。接下来我会问你一些关于' + scaleName + '的问题，请根据真实感受来回答，没有对错之分。';

  return {
    counselorId: counselorId,
    counselorImage: counselorImage,
    counselorName: counselorName,
    motto: motto,
    bio: bio,
    bgId: bgId,
    bgStyle: bgStyle,
    transitions: parsedTransitions.texts,
    transitionsRaw: parsedTransitions.raw,
    welcomeText: welcomeText
  };
}

/**
 * 获取随机过渡语
 * @param {object} npcSettings - resolveNpcSetting 返回的配置
 * @param {string} [phase] - 当前阶段
 * @returns {string}
 */
function getRandomTransition(npcSettings, phase) {
  let pool;
  if (phase && npcSettings.transitionsRaw && npcSettings.transitionsRaw.length > 0) {
    pool = filterTransitionsByPhase(npcSettings.transitionsRaw, phase);
  } else {
    pool = npcSettings.transitions || DEFAULT_TRANSITIONS;
  }
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

/**
 * 构造问题显示文本
 * 根据答题模式生成 NPC 对话文本
 *
 * @param {object} question - 题目对象
 * @param {string} mode - 'immersive' | 'normal'
 * @param {number} currentIndex - 当前题号（从1开始）
 * @param {number} totalCount - 总题数
 * @param {string} [transition] - 过渡语
 * @returns {object} { text: string, showTransition: boolean }
 */
function buildQuestionText(question, mode, currentIndex, totalCount, transition) {
  let text = '';
  let showTransition = false;

  if (mode === NPC_MODES.IMMERSIVE) {
    // 沉浸模式：NPC 口语化提问
    if (transition && currentIndex > 1) {
      text = transition + '\n\n';
      showTransition = true;
    }
    text += question.content;
  } else {
    // 普通模式：直接展示题目
    text = question.content;
  }

  return { text: text, showTransition: showTransition };
}

/**
 * 构造欢迎语
 * @param {object} npcSettings - NPC 配置
 * @param {object} scale - 量表对象
 * @returns {string}
 */
function buildWelcomeText(npcSettings, scale) {
  if (npcSettings.welcomeText) {
    return npcSettings.welcomeText;
  }
  const name = npcSettings.counselorName || '咨询师';
  const scaleName = (scale && scale.name) || '这个量表';
  return (
    '你好，我是你的' + name + '。接下来我会问你一些关于' + scaleName + '的问题，请根据真实感受来回答，没有对错之分。'
  );
}

/**
 * 从问题 transition 字段提取阶段
 * transition 格式：'phase:开始阶段' 或 'phase:中间阶段' 等
 * @param {string} transition - 题目的 transition 字段
 * @returns {string|null} 阶段名称
 */
function extractPhase(transition) {
  if (!transition || typeof transition !== 'string') {
    return null;
  }
  const match = transition.match(/^phase:(.+)$/);
  return match ? match[1] : null;
}

/**
 * 获取当前问题所属阶段的过渡语
 * @param {object} npcSettings - NPC 配置
 * @param {string} questionTransition - 题目 transition 字段
 * @returns {string}
 */
function getTransitionForQuestion(npcSettings, questionTransition) {
  const phase = extractPhase(questionTransition);
  return getRandomTransition(npcSettings, phase);
}

module.exports = {
  NPC_MODES: NPC_MODES,
  DEFAULT_TRANSITIONS: DEFAULT_TRANSITIONS,
  loadGlobalNpcConfig: loadGlobalNpcConfig,
  saveGlobalNpcConfig: saveGlobalNpcConfig,
  parseTransitions: parseTransitions,
  filterTransitionsByPhase: filterTransitionsByPhase,
  resolveNpcSetting: resolveNpcSetting,
  getRandomTransition: getRandomTransition,
  buildQuestionText: buildQuestionText,
  buildWelcomeText: buildWelcomeText,
  extractPhase: extractPhase,
  getTransitionForQuestion: getTransitionForQuestion
};
