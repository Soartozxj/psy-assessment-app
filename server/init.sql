-- ============================================================
-- 星蓝心镜 - MySQL 数据库初始化脚本
-- 版本: 1.0.0
-- 数据库: psy_assessment
-- 字符集: utf8mb4（支持 emoji）
-- ============================================================

CREATE DATABASE IF NOT EXISTS `psy_assessment`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `psy_assessment`;

-- ============================================================
-- 1. 测评记录表 (assessments)
-- 对接前端 record 对象 + CloudAPI.submitAnswers
-- ============================================================
DROP TABLE IF EXISTS `assessments`;
CREATE TABLE `assessments` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `record_id`       VARCHAR(64)     NOT NULL COMMENT '前端记录ID（Date.now() 或云端返回的 id）',
  `openid`          VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '用户 openid（小程序用户标识）',
  `scale_id`        VARCHAR(64)     NOT NULL COMMENT '量表 ID（如 ppcrs, faces, scl90）',
  `scale_name`      VARCHAR(128)    NOT NULL DEFAULT '' COMMENT '量表名称（如 亲子关系量表）',
  `total_score`     DECIMAL(8,2)    DEFAULT NULL COMMENT '总分',
  `max_score`       DECIMAL(8,2)    DEFAULT NULL COMMENT '满分',
  `level`           VARCHAR(32)     NOT NULL DEFAULT '' COMMENT '等级标识（normal/mild/moderate/severe）',
  `level_name`      VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '等级名称（如 正常/轻度/中度/重度）',
  `color`           VARCHAR(16)     NOT NULL DEFAULT '' COMMENT '等级颜色（如 #4A90D9）',
  `answers`         TEXT            DEFAULT NULL COMMENT '作答数据 {questionId: optionId}',
  `dimensions`      TEXT            DEFAULT NULL COMMENT '维度得分 [{key, label, score, maxScore}]',
  `ai_diagnosis`    TEXT            DEFAULT NULL COMMENT 'AI 诊断报告文本',
  `source`          VARCHAR(16)     NOT NULL DEFAULT 'web' COMMENT '来源：web/miniapp/admin',
  `duration`        INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '答题时长（秒）',
  `category_name`   VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '分类名称',
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_record_id` (`record_id`),
  KEY `idx_openid` (`openid`),
  KEY `idx_scale_id` (`scale_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测评记录表';

-- ============================================================
-- 2. 评价反馈表 (feedback)
-- 对接前端 fbModalSubmit → SharedData.saveFeedback
-- ============================================================
DROP TABLE IF EXISTS `feedback`;
CREATE TABLE `feedback` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `record_id`       VARCHAR(64)     NOT NULL COMMENT '关联的测评记录 ID',
  `openid`          VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '用户 openid',
  `scene`           VARCHAR(16)     NOT NULL COMMENT '评价场景：result（测评简报）/ diag（AI诊断报告）',
  `stars`           TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '星级评分 1-5',
  `tags`            TEXT            DEFAULT NULL COMMENT '标签数组 ["准确", "有帮助"]',
  `comment`         VARCHAR(500)    DEFAULT NULL COMMENT '文字评价',
  `source`          VARCHAR(16)     NOT NULL DEFAULT 'result' COMMENT '来源（同 scene，用于区分）',
  `scale_id`        VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '量表 ID',
  `scale_name`      VARCHAR(128)    NOT NULL DEFAULT '' COMMENT '量表名称',
  `assessment_data` TEXT            DEFAULT NULL COMMENT '附带测评结果数据 {totalScore, maxScore, levelName, color, dims, aiDiagText}',
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '评价时间',
  PRIMARY KEY (`id`),
  KEY `idx_record_scene` (`record_id`, `scene`),
  KEY `idx_openid` (`openid`),
  KEY `idx_scale_id` (`scale_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评价反馈表';

-- ============================================================
-- 3. 管理员表 (admins)
-- 对接后台扫码登录 / 密码登录
-- ============================================================
DROP TABLE IF EXISTS `admins`;
CREATE TABLE `admins` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `openid`          VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '微信 openid',
  `unionid`         VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '微信 unionid（跨平台标识）',
  `nickname`        VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '昵称',
  `role`            VARCHAR(16)     NOT NULL DEFAULT 'admin' COMMENT '角色：super/admin/readonly',
  `last_login_at`   DATETIME        DEFAULT NULL COMMENT '最后登录时间',
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表';

-- ============================================================
-- 4. 量表配置表 (scales) — 可选，后续扩展
-- 当前量表数据内置在前端 shared-data.js 中，此表为后台动态管理预留
-- ============================================================
DROP TABLE IF EXISTS `scales`;
CREATE TABLE `scales` (
  `id`              VARCHAR(64)     NOT NULL COMMENT '量表 ID（如 ppcrs）',
  `name`            VARCHAR(128)    NOT NULL DEFAULT '' COMMENT '量表名称',
  `category`        VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '分类',
  `icon`            VARCHAR(32)     NOT NULL DEFAULT '' COMMENT '图标/emoji',
  `description`     TEXT            DEFAULT NULL COMMENT '量表说明',
  `question_count`  INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '题目数量',
  `scoring_rules`   TEXT            DEFAULT NULL COMMENT '计分规则配置',
  `ai_config`       TEXT            DEFAULT NULL COMMENT 'AI 诊断配置',
  `is_active`       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '是否启用',
  `sort_order`      INT             NOT NULL DEFAULT 0 COMMENT '排序权重',
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='量表配置表';

-- ============================================================
-- 初始数据
-- ============================================================

-- 插入默认管理员（密码登录用，小程序 OpenID）
INSERT INTO `admins` (`openid`, `role`, `nickname`) VALUES
  ('oyORU3XImvO_rYAWBUTMNm89-3v0', 'super', 'Rich');

-- ============================================================
-- 5. TTS 音频缓存表 (tts_cache)
-- 用于 TTS 合并音频的缓存管理，支持 MySQL 索引快速查找
-- ============================================================
DROP TABLE IF EXISTS `tts_cache`;
CREATE TABLE `tts_cache` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `content_hash`  VARCHAR(32) UNIQUE NOT NULL COMMENT 'MD5(segments.join("|") + emotion + rate + voice)',
  `scale_id`      VARCHAR(64) NOT NULL DEFAULT '' COMMENT '关联量表ID',
  `emotion`       VARCHAR(20) NOT NULL DEFAULT 'empathetic' COMMENT '情感语气',
  `rate`          VARCHAR(10) NOT NULL DEFAULT '+0%' COMMENT '语速',
  `voice`         VARCHAR(64) NOT NULL DEFAULT 'zh-CN-XiaoxiaoNeural' COMMENT '语音ID',
  `has_bgm`       TINYINT(1) UNSIGNED NOT NULL DEFAULT 0 COMMENT '是否含BGM',
  `bgm_name`      VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'BGM文件名',
  `duration`      INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '音频时长（秒）',
  `file_size`     INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '文件大小（字节）',
  `file_path`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '磁盘绝对路径',
  `play_count`    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '播放次数',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `expires_at`    DATETIME DEFAULT NULL COMMENT '过期时间（NULL=永不过期）',
  PRIMARY KEY (`id`),
  KEY `idx_scale` (`scale_id`),
  KEY `idx_expires` (`expires_at`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='TTS音频文件缓存';

-- ============================================================
-- 5. 情绪日记表 (diary_entries)
-- 用于记录用户每日情绪状态
-- ============================================================
DROP TABLE IF EXISTS `diary_entries`;
CREATE TABLE `diary_entries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `openid` VARCHAR(64) NOT NULL COMMENT '用户openid',
  `mood_score` TINYINT UNSIGNED NOT NULL COMMENT '情绪评分1-5',
  `mood_emoji` VARCHAR(16) DEFAULT '' COMMENT '情绪emoji',
  `content` TEXT DEFAULT NULL COMMENT '文字描述',
  `related_assessment_id` VARCHAR(64) DEFAULT NULL COMMENT '关联的测评记录ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_openid` (`openid`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='情绪日记记录表';

-- ============================================================
-- 6. 冥想音频表 (meditation_audios)
-- 用于存储冥想音频资源
-- ============================================================
DROP TABLE IF EXISTS `meditation_audios`;
CREATE TABLE `meditation_audios` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `title` VARCHAR(128) NOT NULL COMMENT '音频标题',
  `description` TEXT DEFAULT NULL COMMENT '音频描述',
  `category` VARCHAR(64) NOT NULL DEFAULT 'sleep' COMMENT '分类：sleep/focus/relax',
  `audio_url` VARCHAR(255) NOT NULL COMMENT '音频URL',
  `duration` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '时长（秒）',
  `cover_url` VARCHAR(255) DEFAULT NULL COMMENT '封面图URL',
  `play_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '播放次数',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序权重',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='冥想音频表';

-- ============================================================
-- 7. 冥想记录表 (meditation_records)
-- 用于记录用户冥想历史
-- ============================================================
DROP TABLE IF EXISTS `meditation_records`;
CREATE TABLE `meditation_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `openid` VARCHAR(64) NOT NULL COMMENT '用户openid',
  `audio_id` BIGINT UNSIGNED NOT NULL COMMENT '音频ID',
  `duration` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '实际冥想时长（秒）',
  `completed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否完成',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_openid` (`openid`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='冥想记录表';

-- 验证
SELECT '✅ 数据库初始化完成' AS status;
SELECT CONCAT('assessments 表: ', COUNT(*), ' 条记录') AS info FROM `assessments`;
SELECT CONCAT('admins 表: ', COUNT(*), ' 条记录') AS info FROM `admins`;
SELECT CONCAT('tts_cache 表: ', COUNT(*), ' 条记录') AS info FROM `tts_cache`;
SELECT CONCAT('diary_entries 表: 新增') AS info;
SELECT CONCAT('meditation_audios 表: 新增') AS info;
SELECT CONCAT('meditation_records 表: 新增') AS info;
