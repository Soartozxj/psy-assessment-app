/**
 * 星蓝心镜 — 常量定义
 *
 * 包含：API 地址、分类列表、颜色、题型枚举、Storage key 前缀
 */

/** API 基础地址 */
const API_BASE = 'https://www.soarto.com.cn';

/** NPC 云托管 API 地址（H5 对应 identity.soarto.com.cn） */
const NPC_API_BASE = 'https://identity.soarto.com.cn';

/** 普通接口超时（毫秒） */
const TIMEOUT_MS = 15000;

/** AI 诊断接口超时（毫秒），DashScope 生成报告可能需 20s+ */
const AI_TIMEOUT_MS = 60000;

/** Storage key 前缀 */
const STORAGE_PREFIX = 'psy_';

/** Storage Keys */
const STORAGE_KEYS = {
  SCALES_DATA: 'psy_scales_data',
  SCALES_VERSION: 'psy_scales_version',
  SCALES_SYNC: 'psy_scales_synced',
  HISTORY_DATA: 'psy_assessment_history',
  USER_PROFILE: 'psy_user_profile',
  SETTINGS: 'psy_settings',
  FEEDBACK_LIST: 'psy_feedback_list',
  FEEDBACK_TAG_CONFIG: 'psy_feedback_tag_config',
  PRIVACY_AGREED: 'psy_privacy_agreed',
  FIRST_LAUNCH: 'psy_first_launch',
  NOTIFICATIONS: 'psy_notifications',
  FAVORITES: 'psy_favorites'
};

/**
 * 量表分类列表
 * key: 数据中的 category 字段值（与 scales-json 数据一致）
 * name: 分类简名（首页/列表页展示）
 * fullName: 分类全名（与 categoryName 一致）
 * color: 分类主色
 * icon: 分类 emoji
 */
const CATEGORIES = [
  { key: 'bond', name: '家庭关系', fullName: '家庭与人际关系量表', color: '#e2e52e', icon: '🏠' },
  { key: 'personality', name: '人格特质', fullName: '人格特质评估量表', color: '#d6582e', icon: '🧠' },
  { key: 'spirit', name: '心理健康', fullName: '心理健康与精神病态量表', color: '#5b8def', icon: '🌿' },
  { key: 'stresscoping', name: '压力应对', fullName: '应激与应对量表', color: '#43a047', icon: '💪' },
  { key: 'behaviorproblems', name: '行为问题', fullName: '行为问题量表', color: '#7e57c2', icon: '📱' },
  { key: 'glow', name: '积极心理', fullName: '积极心理相关量表', color: '#f5a623', icon: '✨' }
];

/**
 * 旧版分类映射（H5 CATEGORY_MAP 中定义）
 * 用于兼容首页分类网格展示
 */
const CATEGORY_MAP = {
  anxiety: { name: '焦虑评估', color: '#F5A623', icon: '😰' },
  depression: { name: '抑郁评估', color: '#5B8DEF', icon: '😔' },
  personality: { name: '人格测试', color: '#7ED321', icon: '🧠' },
  comprehensive: { name: '综合评估', color: '#4A90D9', icon: '🧬' },
  stress: { name: '压力自评', color: '#D0021B', icon: '😣' }
};

/**
 * 题型枚举
 */
const QUESTION_TYPES = {
  SINGLE: 'single', // 单选题 — radio-group
  MATRIX: 'matrix', // 矩阵题 — scroll-view + radio-group per row
  PARENT_CHILD: 'parent-child', // 父子题 — 主选项 radio + 子选项 checkbox
  GROUPED: 'grouped', // 分组下拉 — picker/芯片选择
  TEXT: 'text' // 文字题 — textarea / input
};

/** 默认题型（无 type 字段时的默认值） */
const DEFAULT_QUESTION_TYPE = QUESTION_TYPES.SINGLE;

/**
 * 测前问卷题型
 */
const PRE_QUESTION_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  SELECT: 'select',
  CHECKBOX: 'checkbox'
};

/**
 * 等级颜色映射（结果页使用）
 */
const LEVEL_COLORS = {
  normal: '#7ed321',
  mild: '#f5a623',
  moderate: '#f8a600',
  severe: '#d0021b',
  extremely_severe: '#8b0000'
};

/**
 * 通用颜色常量
 */
const COLORS = {
  PRIMARY: '#4a90d9',
  PRIMARY_LIGHT: '#6ba3e0',
  PRIMARY_DARK: '#3a7bc8',
  SECONDARY: '#f5a623',
  SUCCESS: '#7ed321',
  WARNING: '#f8a600',
  DANGER: '#d0021b',
  WHITE: '#ffffff',
  BG_LIGHT: '#f8f9fa',
  BG_GRAY: '#f0f2f5',
  TEXT: '#333333',
  TEXT_SEC: '#666666',
  TEXT_MUTED: '#999999',
  BORDER: '#e5e5e5',
  BORDER_LIGHT: '#f0f0f0'
};

/**
 * 分数环渐变角度
 */
const SCORE_RING_START_ANGLE = -Math.PI / 2;

/**
 * 历史记录分页默认值
 */
const DEFAULT_PAGE_SIZE = 20;

/**
 * 量表缓存过期时间（毫秒）— 24 小时
 */
const SCALES_CACHE_TTL = 24 * 60 * 60 * 1000;

module.exports = {
  API_BASE: API_BASE,
  NPC_API_BASE: NPC_API_BASE,
  TIMEOUT_MS: TIMEOUT_MS,
  AI_TIMEOUT_MS: AI_TIMEOUT_MS,
  STORAGE_PREFIX: STORAGE_PREFIX,
  STORAGE_KEYS: STORAGE_KEYS,
  CATEGORIES: CATEGORIES,
  CATEGORY_MAP: CATEGORY_MAP,
  QUESTION_TYPES: QUESTION_TYPES,
  DEFAULT_QUESTION_TYPE: DEFAULT_QUESTION_TYPE,
  PRE_QUESTION_TYPES: PRE_QUESTION_TYPES,
  LEVEL_COLORS: LEVEL_COLORS,
  COLORS: COLORS,
  SCORE_RING_START_ANGLE: SCORE_RING_START_ANGLE,
  DEFAULT_PAGE_SIZE: DEFAULT_PAGE_SIZE,
  SCALES_CACHE_TTL: SCALES_CACHE_TTL
};
