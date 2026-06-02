/**
 * 星蓝心镜 — 日期/分数/时长/人数 格式化工具
 *
 * 提供统一的显示格式化函数，确保全应用一致的数字和日期展示。
 * 使用方式：const format = require('./format.js');
 */

/**
 * 日期格式化
 * @param {string|number|Date} date - 日期对象/时间戳/ISO字符串
 * @param {string} [fmt='yyyy-MM-dd'] - 格式字符串
 * @returns {string}
 */
function formatDate(date, fmt) {
  if (!date) {
    return '';
  }
  fmt = fmt || 'yyyy-MM-dd';

  let d;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'number') {
    d = new Date(date);
  } else if (typeof date === 'string') {
    // 兼容 ISO 字符串和常规格式
    d = new Date(date.replace(/-/g, '/'));
  } else {
    return '';
  }

  if (isNaN(d.getTime())) {
    return '';
  }

  const o = {
    'M+': d.getMonth() + 1,
    'd+': d.getDate(),
    'h+': d.getHours(),
    'm+': d.getMinutes(),
    's+': d.getSeconds(),
    'q+': Math.floor((d.getMonth() + 3) / 3),
    S: d.getMilliseconds()
  };

  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (d.getFullYear() + '').substr(4 - RegExp.$1.length));
  }

  const keys = Object.keys(o);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (new RegExp('(' + k + ')').test(fmt)) {
      const val = o[k] + '';
      fmt = fmt.replace(RegExp.$1, RegExp.$1.length === 1 ? val : ('00' + val).substr(val.length));
    }
  }

  return fmt;
}

/**
 * 友好时间显示
 * 1分钟内：刚刚
 * 1小时内：x分钟前
 * 今天内：今天 HH:mm
 * 昨天：昨天 HH:mm
 * 今年：M月d日 HH:mm
 * 更早：yyyy年M月d日
 * @param {string|number|Date} date - 日期
 * @returns {string}
 */
function formatTimeAgo(date) {
  if (!date) {
    return '';
  }
  let d;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'number') {
    d = new Date(date);
  } else {
    d = new Date((date + '').replace(/-/g, '/'));
  }
  if (isNaN(d.getTime())) {
    return '';
  }

  const now = Date.now();
  const diff = now - d.getTime();

  // 1分钟内
  if (diff < 60 * 1000) {
    return '刚刚';
  }

  // 1小时内
  if (diff < 60 * 60 * 1000) {
    return Math.floor(diff / (60 * 1000)) + '分钟前';
  }

  // 24小时内
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return hours + '小时前';
  }

  // 昨天
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const dateDay = new Date(d.getTime());
  dateDay.setHours(0, 0, 0, 0);
  if (dateDay.getTime() === yesterday.getTime()) {
    return '昨天 ' + formatDate(d, 'hh:mm');
  }

  // 今年
  if (d.getFullYear() === today.getFullYear()) {
    return formatDate(d, 'M月d日 hh:mm');
  }

  // 更早
  return formatDate(d, 'yyyy年M月d日');
}

/**
 * 分数格式化
 * 统一保留两位小数，去掉末尾不必要的零
 * @param {number} score - 分数值
 * @param {number} [maxScore] - 满分值（可选，用于生成分数字符串）
 * @returns {string}
 */
function formatScore(score, maxScore) {
  if (score === null || score === undefined || isNaN(score)) {
    return '0';
  }

  const result = Math.round(score * 100) / 100;
  const resultStr = result + '';

  if (maxScore !== undefined && maxScore !== null && !isNaN(maxScore) && maxScore > 0) {
    const maxResult = Math.round(maxScore * 100) / 100;
    return resultStr + '/' + maxResult;
  }

  return resultStr;
}

/**
 * 百分比格式化
 * @param {number} value - 当前值
 * @param {number} total - 总值
 * @param {number} [decimal=0] - 小数位数
 * @returns {string} 如 "85%"
 */
function formatPercent(value, total, decimal) {
  if (!total || total === 0 || isNaN(value) || isNaN(total)) {
    return '0%';
  }
  decimal = decimal || 0;
  let pct = (value / total) * 100;
  pct = Math.min(pct, 100);
  return pct.toFixed(decimal) + '%';
}

/**
 * 时长格式化
 * 将秒数转为友好的时长显示
 * @param {number} seconds - 秒数
 * @returns {string} 如 "5分30秒"、"1小时20分"
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0 || isNaN(seconds)) {
    return '0秒';
  }

  seconds = Math.round(seconds);

  if (seconds < 60) {
    return seconds + '秒';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    if (remainingSeconds === 0) {
      return minutes + '分钟';
    }
    return minutes + '分' + remainingSeconds + '秒';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return hours + '小时';
  }
  return hours + '小时' + remainingMinutes + '分';
}

/**
 * 答题预估时长格式化
 * @param {number} minutes - 预估分钟数
 * @returns {string} 如 "约5分钟"、"约1小时"
 */
function formatEstimatedDuration(minutes) {
  if (!minutes || minutes <= 0 || isNaN(minutes)) {
    return '约5分钟';
  }

  if (minutes < 60) {
    return '约' + minutes + '分钟';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return '约' + hours + '小时';
  }
  return '约' + hours + '小时' + remainingMinutes + '分';
}

/**
 * 人数格式化
 * 超过 10000 显示为 "1.0万+"
 * @param {number} count - 人数
 * @returns {string}
 */
function formatPeopleCount(count) {
  if (!count || count <= 0 || isNaN(count)) {
    return '0';
  }

  if (count >= 100000) {
    return (count / 10000).toFixed(1) + '万+';
  }

  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万';
  }

  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k';
  }

  return count + '';
}

/**
 * 题目数量格式化
 * @param {number} count - 题目数
 * @returns {string} 如 "14题"
 */
function formatQuestionCount(count) {
  if (!count || count <= 0 || isNaN(count)) {
    return '0题';
  }
  return count + '题';
}

/**
 * 等级名称格式化
 * 将后端返回的等级标识转为用户可读的中文
 * @param {string} level - 等级标识 (如 'normal', 'mild', 'moderate', 'severe')
 * @returns {string} 中文名称
 */
function formatLevel(level) {
  const levelMap = {
    normal: '正常',
    mild: '轻度',
    moderate: '中度',
    severe: '重度',
    extremely_severe: '极重度',
    low: '偏低',
    high: '偏高',
    very_high: '极高',
    very_low: '极低',
    positive: '阳性',
    negative: '阴性',
    abnormal: '异常',
    good: '良好',
    poor: '较差'
  };
  return levelMap[level] || level || '未知';
}

/**
 * 等级对应颜色
 * @param {string} level - 等级标识
 * @returns {string} 颜色值 (#rrggbb)
 */
function getLevelColor(level) {
  const colorMap = {
    normal: '#7ed321',
    mild: '#f5a623',
    moderate: '#f8a600',
    severe: '#d0021b',
    extremely_severe: '#8b0000',
    low: '#5b8def',
    high: '#f5a623',
    very_high: '#d0021b',
    very_low: '#7e57c2',
    positive: '#d0021b',
    negative: '#7ed321',
    abnormal: '#d0021b',
    good: '#7ed321',
    poor: '#d0021b'
  };
  return colorMap[level] || '#999999';
}

/**
 * 维度得分百分比（用于进度条宽度）
 * @param {number} score - 得分
 * @param {number} maxScore - 满分
 * @returns {number} 0~100 的百分比
 */
function getScorePercent(score, maxScore) {
  if (!maxScore || maxScore <= 0 || isNaN(score) || isNaN(maxScore)) {
    return 0;
  }
  const pct = (score / maxScore) * 100;
  return Math.min(Math.max(pct, 0), 100);
}

/**
 * 截断文本
 * @param {string} text - 原始文本
 * @param {number} [maxLength=50] - 最大长度
 * @param {string} [suffix='...'] - 截断后缀
 * @returns {string}
 */
function truncateText(text, maxLength, suffix) {
  if (!text) {
    return '';
  }
  maxLength = maxLength || 50;
  suffix = suffix !== undefined ? suffix : '...';
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + suffix;
}

/**
 * 分类名称查找
 * 根据 category key 获取中文名
 * @param {string} categoryKey - 分类 key
 * @returns {string}
 */
function getCategoryName(categoryKey) {
  const constants = require('./constants.js');
  const categories = constants.CATEGORIES;
  for (let i = 0; i < categories.length; i++) {
    if (categories[i].key === categoryKey) {
      return categories[i].name;
    }
  }
  // 尝试旧版分类映射
  const categoryMap = constants.CATEGORY_MAP;
  if (categoryMap[categoryKey]) {
    return categoryMap[categoryKey].name;
  }
  return categoryKey || '其他';
}

/**
 * 分类颜色查找
 * @param {string} categoryKey - 分类 key
 * @returns {string} 颜色值
 */
function getCategoryColor(categoryKey) {
  const constants = require('./constants.js');
  const categories = constants.CATEGORIES;
  for (let i = 0; i < categories.length; i++) {
    if (categories[i].key === categoryKey) {
      return categories[i].color;
    }
  }
  const categoryMap = constants.CATEGORY_MAP;
  if (categoryMap[categoryKey]) {
    return categoryMap[categoryKey].color;
  }
  return '#CCCCCC';
}

module.exports = {
  formatDate: formatDate,
  formatTimeAgo: formatTimeAgo,
  formatScore: formatScore,
  formatPercent: formatPercent,
  formatDuration: formatDuration,
  formatEstimatedDuration: formatEstimatedDuration,
  formatPeopleCount: formatPeopleCount,
  formatQuestionCount: formatQuestionCount,
  formatLevel: formatLevel,
  getLevelColor: getLevelColor,
  getScorePercent: getScorePercent,
  truncateText: truncateText,
  getCategoryName: getCategoryName,
  getCategoryColor: getCategoryColor
};
