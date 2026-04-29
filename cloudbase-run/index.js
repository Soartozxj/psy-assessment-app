/**
 * 星蓝心镜 - 云托管 API 服务 v1.1.0
 * 
 * 提供以下 API：
 *   POST /api/submit       — 提交测评答案，云端计分，存历史
 *   GET  /api/history       — 查询测评历史
 *   DELETE /api/history/:id — 删除单条历史
 *   POST /api/ai-diagnose   — AI 诊断
 *   GET  /api/npc-config    — 获取 NPC 配置元数据（公开，不含图片）
 *   PUT  /api/npc-config    — 保存 NPC 配置（管理员）
 *   GET  /api/npc-images    — 获取所有图片 ID 列表
 *   GET  /api/npc-image     — 获取单张图片（?imageId=xxx）
 *   PUT  /api/npc-image     — 上传单张图片（独立文档存储）
 *   DELETE /api/npc-image   — 删除单张图片
 *   GET  /api/tts/voices    — TTS 语音列表
 *   POST /api/tts/segments  — TTS 批量合成
 * 
 * 部署方式：微信云托管（CloudBase Run）
 * 端口：由环境变量 PORT 指定（默认 80）
 * 
 * v1.1.0 变更：NPC 图片改为独立文档存储（config/npc_img_{id}），不再存 npc_config 内
 */

const express = require('express');
const cloudbase = require('@cloudbase/node-sdk');
const path = require('path');
const { execFile } = require('child_process');

// ====================================================
// 初始化
// ====================================================

const app = express();
// CORS 由云托管网关处理（安全域名白名单 + enableSafeDomain），Express 不再设置 CORS 头
app.use(express.json({ limit: '16mb' })); // 16mb 用于 NPC 配置（含 base64 图片）
app.use(express.urlencoded({ extended: true }));

// 从环境变量读取云开发环境 ID（硬编码兜底，防止云托管未配置环境变量）
const ENV_ID = process.env.TCB_ENV_ID || process.env.CLOUDBASE_ENV || 'cloud1-d8ggx8sqde8afa6a4';
const SECRET_ID = process.env.TENCENTCLOUD_SECRETID || '';
const SECRET_KEY = process.env.TENCENTCLOUD_SECRETKEY || '';

// 初始化 cloudbase SDK
let db;
try {
  const initOptions = { env: ENV_ID };
  // 如果提供了 secretId/secretKey，使用显式认证（绕过内网元数据服务）
  if (SECRET_ID && SECRET_KEY) {
    initOptions.secretId = SECRET_ID;
    initOptions.secretKey = SECRET_KEY;
    console.log('[API] 使用 secretId/secretKey 显式认证');
  }
  const app2 = cloudbase.init(initOptions);
  db = app2.database();
  console.log('[API] cloudbase 初始化成功, env:', ENV_ID || '(自动)');
} catch (e) {
  console.error('[API] cloudbase 初始化失败:', e.message);
  db = null;
}

const port = process.env.PORT || 80;

// ====================================================
// 计分引擎（Node.js 版，与前端 scoring-engine.js 逻辑一致）
// ====================================================

const ScoringEngine = (() => {
  function parseItems(items, totalQuestions) {
    if (items === 'ALL') return Array.from({ length: totalQuestions }, (_, i) => i + 1);
    if (Array.isArray(items)) return items;
    const result = [];
    const parts = String(items).split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-').map(s => parseInt(s.trim()));
        if (!isNaN(startStr) && !isNaN(endStr)) {
          for (let i = startStr; i <= endStr; i++) result.push(i);
        }
      } else {
        const num = parseInt(trimmed);
        if (!isNaN(num)) result.push(num);
      }
    }
    return result;
  }

  function collectScores(questions, itemIds, answers) {
    const scores = [];
    for (const qid of itemIds) {
      const q = questions.find(q => q.id == qid);
      if (!q) continue;
      const optIdx = answers[qid] !== undefined ? answers[qid] : answers[String(qid)];
      if (optIdx === undefined || optIdx === null) continue;
      let opt;
      if (typeof optIdx === 'number' && optIdx < q.options.length) {
        opt = q.options[optIdx];
      } else if (typeof optIdx === 'string') {
        opt = q.options.find(o => o.id === optIdx);
      } else {
        opt = q.options.find(o => o.id === optIdx);
      }
      if (opt) scores.push(opt.score || 0);
    }
    return scores;
  }

  function normalizeCondition(condition) {
    if (!condition) return null;
    if (condition.threshold !== undefined && condition.operator) {
      return { operator: condition.operator, value: Number(condition.threshold) };
    }
    const ops = ['>=', '<=', '!=', '==', '>', '<'];
    for (const op of ops) {
      if (condition[op] !== undefined) return { operator: op, value: Number(condition[op]) };
    }
    return null;
  }

  function compareValue(actual, operator, target) {
    switch (operator) {
      case '>=': return actual >= target;
      case '>':  return actual > target;
      case '<=': return actual <= target;
      case '<':  return actual < target;
      case '==': return actual == target;
      case '!=': return actual != target;
      default: return false;
    }
  }

  function applyFormula(formula, scores, condition) {
    if (scores.length === 0 && formula !== 'DERIVED') return 0;
    switch (formula) {
      case 'SUM': return scores.reduce((a, b) => a + b, 0);
      case 'AVG': return scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;
      case 'COUNT_IF': {
        const norm = normalizeCondition(condition);
        if (!norm) return scores.length;
        return scores.filter(s => compareValue(s, norm.operator, norm.value)).length;
      }
      case 'DERIVED': return 0;
      default: return scores.reduce((a, b) => a + b, 0);
    }
  }

  function applyTransform(value, transform) {
    if (!transform) return value;
    let expression;
    if (typeof transform === 'string') expression = transform;
    else if (transform.expression) expression = transform.expression;
    else return value;
    try {
      const expr = expression
        .replace(/x/gi, `(${value})`)
        .replace(/Math\.abs\(/g, '__ABS__(');
      const safeExpr = expr.replace(/[^\d+\-*/(). 　_]/g, '').replace(/__ABS__/g, 'Math.abs');
      const result = new Function('return ' + safeExpr)();
      return Math.round(result * 100) / 100;
    } catch (e) {
      console.warn('[ScoringEngine] 公式转换失败:', e.message);
      return value;
    }
  }

  function matchInterpretation(score, rules) {
    if (!rules || rules.length === 0) return null;
    for (const rule of rules) {
      if (rule.min !== undefined || rule.max !== undefined) {
        const minOk = rule.min === undefined || rule.min === null || score >= rule.min;
        const maxOk = rule.max === undefined || rule.max === null || score <= rule.max;
        if (minOk && maxOk) return rule;
      }
      if (rule.condition) {
        const parsed = parseConditionStr(rule.condition);
        if (parsed && compareValue(score, parsed.operator, parsed.value)) return rule;
      }
    }
    return null;
  }

  function parseConditionStr(str) {
    if (typeof str !== 'string') return null;
    const match = str.trim().match(/^(>=|<=|!=|==|>|<)\s*(-?\d+\.?\d*)$/);
    if (!match) return null;
    return { operator: match[1], value: Number(match[2]) };
  }

  function collectMaxScores(questions, itemIds) {
    const maxScores = [];
    for (const qid of itemIds) {
      const q = questions.find(q => q.id == qid);
      if (!q || !q.options || q.options.length === 0) continue;
      maxScores.push(Math.max(...q.options.map(o => o.score || 0)));
    }
    return maxScores;
  }

  function inferMaxFromInterpretation(interpretation) {
    if (!interpretation || interpretation.length === 0) return null;
    const allMax = interpretation.filter(r => r.max !== undefined && r.max !== null).map(r => r.max);
    return allMax.length > 0 ? Math.max(...allMax) : null;
  }

  function calcMaxScores(scoring, questions) {
    const dimsMax = {};
    let totalMax = null;
    if (scoring.dimensions && scoring.dimensions.length > 0) {
      for (const dim of scoring.dimensions) {
        if (dim.maxScore !== undefined && dim.maxScore > 0) { dimsMax[dim.key] = dim.maxScore; continue; }
        if (dim.interpretation && dim.interpretation.length > 0) {
          const interpMax = inferMaxFromInterpretation(dim.interpretation);
          if (interpMax !== null && interpMax > 0) { dimsMax[dim.key] = interpMax; continue; }
        }
        const itemIds = parseItems(dim.items, questions.length);
        const maxScores = collectMaxScores(questions, itemIds);
        let maxVal = applyFormula(dim.formula || 'SUM', maxScores, dim.condition);
        if (dim.transform) maxVal = applyTransform(maxVal, dim.transform);
        dimsMax[dim.key] = Math.round(maxVal * 100) / 100;
      }
    }
    if (scoring.metrics && scoring.metrics.length > 0) {
      let tsMetric = scoring.metrics.find(m =>
        (m.key || m.name) === 'totalScore' || (m.key || m.name) === 'total_score' || (m.key || m.name) === '总分'
      );
      if (tsMetric) {
        if (tsMetric.maxScore !== undefined && tsMetric.maxScore > 0) totalMax = tsMetric.maxScore;
        else {
          const tsKey = tsMetric.key || tsMetric.name;
          const tsRules = (scoring.interpretation || []).filter(r => r.metric === tsKey);
          if (tsRules.length > 0) {
            const interpMax = inferMaxFromInterpretation(tsRules);
            if (interpMax !== null && interpMax > 0) totalMax = interpMax;
          }
          if (totalMax === null && tsMetric.formula !== 'DERIVED') {
            const itemIds = parseItems(tsMetric.items, questions.length);
            const maxScores = collectMaxScores(questions, itemIds);
            let maxVal = applyFormula(tsMetric.formula || 'SUM', maxScores, tsMetric.condition);
            if (tsMetric.transform) maxVal = applyTransform(maxVal, tsMetric.transform);
            totalMax = Math.round(maxVal * 100) / 100;
          }
        }
      }
    }
    if (totalMax === null && scoring.interpretation && scoring.interpretation.length > 0) {
      const noMetricRules = scoring.interpretation.filter(r => !r.metric);
      const interpMax = inferMaxFromInterpretation(noMetricRules);
      if (interpMax !== null && interpMax > 0) totalMax = interpMax;
    }
    if (totalMax === null) {
      const allMax = questions.map(q => {
        if (!q.options || q.options.length === 0) return 0;
        return Math.max(...q.options.map(o => o.score || 0));
      });
      totalMax = allMax.reduce((a, b) => a + b, 0);
    }
    if (totalMax <= 0) totalMax = 100;
    return { total: totalMax, dimensions: dimsMax };
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function evaluateDerived(derivedMetrics, currentValues) {
    const results = {};
    for (const dm of derivedMetrics) {
      if (!dm.expression) { results[dm.key] = 0; continue; }
      try {
        let expr = dm.expression;
        const keys = Object.keys(currentValues).sort((a, b) => b.length - a.length);
        for (const k of keys) {
          const v = currentValues[k];
          if (typeof v === 'number') {
            const regex = new RegExp(escapeRegex(k), 'g');
            expr = expr.replace(regex, `(${v})`);
          }
        }
        expr = expr.replace(/Math\.abs\(/g, '__ABS__(');
        const safeExpr = expr.replace(/[^\d+\-*/(). 　_]/g, '').replace(/__ABS__/g, 'Math.abs');
        const val = new Function('return ' + safeExpr)();
        results[dm.key] = isNaN(val) ? 0 : Math.round(val * 100) / 100;
      } catch (e) {
        console.warn('[ScoringEngine] 派生指标计算失败:', dm.key, e.message);
        results[dm.key] = 0;
      }
    }
    return results;
  }

  function calculate(scale, answers) {
    const scoring = scale.scoring;
    const questions = (scale.questions || []).map((q, qi) => ({
      ...q,
      id: q.id || (qi + 1),
      options: (q.options || []).map((o, oi) => ({
        ...o,
        id: o.id !== undefined ? o.id : String.fromCharCode(65 + oi)
      }))
    }));

    if (!scoring) {
      const scores = questions.map(q => {
        const optIdx = answers[q.id];
        if (optIdx === undefined || optIdx === null) return 0;
        let opt;
        if (typeof optIdx === 'number' && optIdx < q.options.length) opt = q.options[optIdx];
        else opt = q.options.find(o => o.id === optIdx);
        return opt ? (opt.score || 0) : 0;
      });
      return {
        metrics: { totalScore: scores.reduce((a, b) => a + b, 0) },
        dimensions: [],
        interpretation: null,
        screening: { result: 'none', triggeredRules: [], matchedConditions: [] },
        maxScores: { total: scores.reduce((a, b) => a + b, 0), dimensions: {} },
        _fallback: true
      };
    }

    const result = {
      metrics: {},
      dimensions: [],
      interpretation: [],
      screening: { result: 'none', triggeredRules: [], matchedConditions: [] }
    };

    // 1. 维度分
    if (scoring.dimensions && scoring.dimensions.length > 0) {
      for (const dim of scoring.dimensions) {
        const itemIds = parseItems(dim.items, questions.length);
        const scores = collectScores(questions, itemIds, answers);
        let dimScore = applyFormula(dim.formula || 'SUM', scores, dim.condition);
        if (dim.transform) dimScore = applyTransform(dimScore, dim.transform);
        result.dimensions.push({
          key: dim.key,
          label: dim.label,
          score: Math.round(dimScore * 100) / 100,
          itemCount: itemIds.length,
          answeredCount: scores.length,
          interpretation: matchInterpretation(dimScore, dim.interpretation || [])
        });
      }
    }

    // 2. 指标分（先直接，再派生）
    const directMetrics = [], derivedMetrics = [];
    if (scoring.metrics && scoring.metrics.length > 0) {
      for (const metric of scoring.metrics) {
        if (metric.formula === 'DERIVED') derivedMetrics.push(metric);
        else directMetrics.push(metric);
      }
    }

    for (const metric of directMetrics) {
      const itemIds = parseItems(metric.items, questions.length);
      const scores = collectScores(questions, itemIds, answers);
      let metricValue = applyFormula(metric.formula || 'SUM', scores, metric.condition);
      if (metric.transform) metricValue = applyTransform(metricValue, metric.transform);
      result.metrics[metric.key || metric.name] = Math.round(metricValue * 100) / 100;
    }

    if (derivedMetrics.length > 0) {
      const valueMap = { ...result.metrics };
      for (const dm of directMetrics) {
        const k = dm.key || dm.name;
        if (dm.label || dm.name) valueMap[dm.label || dm.name] = result.metrics[k];
      }
      for (const dim of result.dimensions) {
        valueMap[dim.key] = dim.score;
        if (dim.label && dim.label !== dim.key) valueMap[dim.label] = dim.score;
      }
      const derivedResults = evaluateDerived(derivedMetrics, valueMap);
      for (const [k, v] of Object.entries(derivedResults)) result.metrics[k] = v;
    }

    // 3. 解释规则
    if (scoring.interpretation && scoring.interpretation.length > 0) {
      for (const rule of scoring.interpretation) {
        let score;
        if (rule.metric) {
          score = result.metrics[rule.metric];
          if (score === undefined) {
            for (const m of (scoring.metrics || [])) {
              if ((m.label || m.name) === rule.metric) { score = result.metrics[m.key || m.name]; break; }
            }
          }
          if (score === undefined) {
            const dim = result.dimensions.find(d => d.label === rule.metric);
            if (dim) score = dim.score;
          }
        } else {
          score = result.metrics.totalScore || result.metrics.total_score;
        }
        if (score !== undefined) {
          const matched = matchInterpretation(score, [rule]);
          if (matched) {
            result.interpretation.push({
              metric: rule.metric || '总分',
              score: Math.round(score * 100) / 100,
              label: matched.label,
              color: matched.color,
              text: matched.text || matched.advice || ''
            });
          }
        }
      }
    }

    // 4. 筛查
    if (scoring.screening && scoring.screening.conditions) {
      const screenValues = { ...result.metrics, _dimensions: result.dimensions };
      const results = scoring.screening.conditions.map(cond => {
        const metricName = cond.metric;
        const operator = cond.op || cond.operator;
        const threshold = cond.value !== undefined ? cond.value : cond.threshold;
        if (!metricName || operator === undefined || threshold === undefined) return false;
        let actual = screenValues[metricName];
        if (actual === undefined) {
          const dimResult = (screenValues._dimensions || []).find(d => d.label === metricName);
          if (dimResult) actual = dimResult.score;
        }
        if (actual === undefined) return false;
        return compareValue(Number(actual), operator, Number(threshold));
      });
      const triggered = [];
      scoring.screening.conditions.forEach((cond, i) => { if (results[i]) triggered.push(cond); });
      const logicFn = screening.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
      result.screening = {
        result: logicFn ? (screening.positiveLabel || '阳性') : (screening.negativeLabel || '阴性'),
        triggeredRules: triggered,
        matchedConditions: triggered
      };
    }

    // 5. 最大分
    result.maxScores = calcMaxScores(scoring, questions);
    return result;
  }

  return { calculate };
})();

// ====================================================
// API 路由
// ====================================================

// 健康检查
app.get('/', (req, res) => {
  res.json({ code: 0, message: '星蓝心镜 API', version: '1.0.2', env: ENV_ID, deployed: new Date().toISOString() });
});

/**
 * POST /api/submit
 * 提交测评答案
 * 
 * Body: { scaleId, answers, duration? }
 * Returns: { code, data: { id, score, maxScore, level, levelName, color, interp, dims, screening } }
 */
app.post('/api/submit', async (req, res) => {
  if (!db) return res.status(503).json({ code: -1, message: '数据库未初始化' });

  try {
    const { scaleId, answers, duration, _openid: clientOpenid } = req.body;
    if (!scaleId || !answers || typeof answers !== 'object') {
      return res.status(400).json({ code: -1, message: '参数错误：需要 scaleId 和 answers' });
    }
    const openid = clientOpenid || '';

    // 1. 从云数据库查量表配置
    const scaleRes = await db.collection('scales').where({ id: Number(scaleId) || scaleId }).limit(1).get();
    if (!scaleRes.data || scaleRes.data.length === 0) {
      return res.status(404).json({ code: -1, message: '量表不存在: ' + scaleId });
    }
    const scale = scaleRes.data[0];

    // 2. 云端计分
    const scoringResult = ScoringEngine.calculate(scale, answers);
    console.log('[Submit] 计分完成, scale:', scale.name, 'metrics:', Object.keys(scoringResult.metrics).join(','));

    // 3. 取总分
    let totalScore = scoringResult.metrics.totalScore || scoringResult.metrics.total_score || 0;
    const totalMaxScore = (scoringResult.maxScores && scoringResult.maxScores.total) || 100;

    // 4. 匹配解释
    let level = 'normal', levelName = '正常', color = '#4A90D9', interp = '';
    const interpTotal = (scoringResult.interpretation || []).find(r =>
      !r.metric || r.metric === '总分' || r.metric === 'totalScore' || r.metric === 'total_score'
    ) || (scoringResult.interpretation || [])[0];
    if (interpTotal) {
      level = interpTotal.label ? normalizeLevel(interpTotal.label) : 'normal';
      levelName = interpTotal.label || '正常';
      color = interpTotal.color || '#4A90D9';
      interp = interpTotal.text || '';
    }

    // 5. 维度数据
    const dimMaxScores = (scoringResult.maxScores && scoringResult.maxScores.dimensions) || {};
    const dims = (scoringResult.dimensions || []).map(d => {
      const dimMax = dimMaxScores[d.key] || 5;
      const pct = dimMax > 0 ? Math.min(100, Math.round((d.score / dimMax) * 100)) : 0;
      return {
        name: d.label,
        score: d.score,
        max: dimMax,
        pct,
        color: (d.interpretation && d.interpretation.color) || '',
        levelLabel: (d.interpretation && d.interpretation.label) || '',
        levelText: (d.interpretation && d.interpretation.text) || '',
        hasInterp: !!d.interpretation
      };
    });

    // 6. 筛查结果
    const screening = scoringResult.screening || { result: 'none' };

    // 7. 保存历史记录
    const recordId = Date.now();
    const historyRecord = {
      id: recordId,
      scaleId: scale.id,
      scaleName: scale.name || scale.scaleName || '',
      emoji: scale.icon || scale.emoji || '📋',
      score: Math.round(totalScore),
      maxScore: Math.round(totalMaxScore),
      level: level,
      levelName: levelName,
      color: color,
      categoryName: scale.categoryName || scale.category || '',
      date: new Date().toLocaleDateString('zh-CN'),
      dims: dims,
      answers: answers,
      duration: duration || 0,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    // 写入 _openid 用于按用户筛选（云数据库自动 _openid 需要 wx context，这里手动写入）
    if (openid) historyRecord._openid = openid;

    await db.collection('history').add({ data: historyRecord });

    // 8. 更新量表完成次数
    try {
      const _ = db.command;
      await db.collection('scales').where({ id: Number(scaleId) || scaleId }).update({
        data: { completedCount: _.inc(1), updatedAt: new Date().toISOString() }
      });
    } catch (e) {
      console.warn('[Submit] 更新完成次数失败:', e.message);
    }

    // 9. 返回结果
    res.json({
      code: 0,
      data: {
        id: recordId,
        score: Math.round(totalScore),
        maxScore: Math.round(totalMaxScore),
        level,
        levelName,
        color,
        interp,
        dims,
        screening,
        completedAt: historyRecord.completedAt
      }
    });
  } catch (err) {
    console.error('[Submit] 错误:', err);
    res.status(500).json({ code: -1, message: '提交失败: ' + err.message });
  }
});

/**
 * GET /api/history?page=1&pageSize=20&openid=xxx
 * 查询测评历史（按时间倒序）
 * openid 为必传参数，确保只能查自己的记录
 */
app.get('/api/history', async (req, res) => {
  if (!db) return res.status(503).json({ code: -1, message: '数据库未初始化' });

  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    // 必须传入 openid，防止遍历全表
    const openid = req.query.openid || '';
    if (!openid) {
      return res.status(403).json({ code: -1, message: '需要 openid 参数' });
    }
    const query = { _openid: openid };

    const [listRes, countRes] = await Promise.all([
      db.collection('history').where(query).orderBy('completedAt', 'desc').skip(skip).limit(pageSize).get(),
      db.collection('history').where(query).count()
    ]);

    res.json({
      code: 0,
      data: {
        list: listRes.data || [],
        total: countRes.total,
        page,
        pageSize
      }
    });
  } catch (err) {
    console.error('[History] 错误:', err);
    res.status(500).json({ code: -1, message: '查询失败: ' + err.message });
  }
});

/**
 * DELETE /api/history/:id
 * 删除单条历史（需要 openid 权限验证）
 */
app.delete('/api/history/:id', async (req, res) => {
  if (!db) return res.status(503).json({ code: -1, message: '数据库未初始化' });

  try {
    const id = req.params.id;
    const openid = req.query.openid || req.body.openid || '';
    if (!openid) {
      return res.status(403).json({ code: -1, message: '需要 openid 参数' });
    }

    const records = await db.collection('history').where({ id: Number(id) || id }).limit(1).get();
    if (records.data && records.data.length > 0) {
      // 权限校验：只能删除自己的记录（管理员 OpenID 放行）
      const record = records.data[0];
      const ADMIN_OPENIDS = (process.env.ADMIN_OPENIDS || '').split(',').map(s => s.trim()).filter(Boolean);
      if (record._openid && record._openid !== openid && !ADMIN_OPENIDS.includes(openid)) {
        return res.status(403).json({ code: -1, message: '无权删除此记录' });
      }
      await db.collection('history').doc(records.data[0]._id).remove();
      res.json({ code: 0, message: '删除成功' });
    } else {
      res.status(404).json({ code: -1, message: '记录不存在' });
    }
  } catch (err) {
    console.error('[Delete] 错误:', err);
    res.status(500).json({ code: -1, message: '删除失败: ' + err.message });
  }
});

/**
 * POST /api/ai-diagnose
 * AI 诊断（代理调用）
 */
app.post('/api/ai-diagnose', async (req, res) => {
  if (!db) return res.status(503).json({ code: -1, message: '数据库未初始化' });

  try {
    const { messages, provider, model, temperature, maxTokens, openid } = req.body;
    // 兼容 apiRequest 自动注入的 _openid 字段
    const effectiveOpenid = openid || req.body._openid || '';
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ code: -1, message: '参数错误：需要 messages 数组' });
    }
    // 必须传入 openid，防止匿名滥用 AI 额度（开发环境 localhost 豁免）
    if (!effectiveOpenid && req.headers.host && !req.headers.host.includes('localhost') && !req.headers.host.includes('127.0.0.1')) {
      return res.status(403).json({ code: -1, message: '需要 openid 参数' });
    }

    // 从云数据库读 AI 配置
    let aiConfig;
    try {
      const configRes = await db.collection('config').doc('ai_config').get();
      let aiConfigRaw = configRes.data;
      // 兼容数组格式 [{_id, data}]
      if (Array.isArray(aiConfigRaw) && aiConfigRaw.length > 0 && aiConfigRaw[0].data !== undefined) {
        aiConfigRaw = aiConfigRaw[0].data;
      }
      aiConfig = aiConfigRaw;
      console.log('[AI] config loaded, type:', typeof aiConfig, ', keys:', aiConfig ? Object.keys(aiConfig).join(',') : 'null', ', dashscope.apiKey:', (aiConfig && aiConfig.dashscope && aiConfig.dashscope.apiKey) ? '有(' + String(aiConfig.dashscope.apiKey).length + ')' : '无');
    } catch (e) {
      console.error('[AI] 读取配置失败:', e.message);
      // 不再直接返回错误，让后续逻辑使用兜底 apiKey
      aiConfig = null;
    }

    const effectiveProvider = provider || (aiConfig && aiConfig.provider) || 'dashscope';
    const effectiveModel = model || (aiConfig && aiConfig[effectiveProvider] || {}).model || 'qwen-plus';
    const effectiveTemp = Math.max(0, Math.min(2, temperature !== undefined ? temperature : (aiConfig && aiConfig.temperature || 0.7)));
    const effectiveMaxTokens = Math.max(100, Math.min(8000, maxTokens || (aiConfig && aiConfig.maxTokens || 2000)));

    let result = '';
    if (effectiveProvider === 'dashscope') {
      const apiKey = aiConfig.dashscope ? aiConfig.dashscope.apiKey : '';
      // 兜底：如果数据库配置读取失败（SDK 认证问题），使用硬编码的 Key
      const effectiveApiKey = apiKey || 'sk-b2c5ed670faf41568a7774a86ba8d448';
      if (!effectiveApiKey) {
        console.error('[AI] DashScope apiKey 为空, dashscope:', JSON.stringify((aiConfig && aiConfig.dashscope) || {}));
        return res.status(503).json({ code: -2, message: 'DashScope API Key 未配置（兜底也失败）' });
      }
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + effectiveApiKey },
        body: JSON.stringify({ model: effectiveModel, messages, max_tokens: effectiveMaxTokens, temperature: effectiveTemp })
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error('[AI] DashScope HTTP', response.status, errBody.slice(0, 200));
        return res.status(502).json({ code: -1, message: 'AI 服务返回错误: ' + response.status });
      }
      const data = await response.json();
      result = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
      if (!result) return res.status(502).json({ code: -1, message: data.error ? data.error.message : 'AI 返回为空' });
    } else {
      return res.status(400).json({ code: -1, message: '不支持的 AI 提供商: ' + effectiveProvider });
    }

    res.json({ code: 0, data: result });
  } catch (err) {
    console.error('[AI] 错误:', err);
    res.status(500).json({ code: -1, message: 'AI 调用失败: ' + err.message });
  }
});

// ====================================================
// TTS 语音合成（edge-tts 子进程）
// ====================================================

const TTS_TIMEOUT_MS = 30000; // 单段合成超时 30s
const TTS_MAX_TEXT_LEN = 2000; // 单段最大字符数

/**
 * 用 edge-tts 合成单段文本为 MP3，返回 Buffer
 */
function synthesizeTTS(text, voice, rate) {
  return new Promise((resolve, reject) => {
    if (!text || text.trim().length === 0) {
      return reject(new Error('文本为空'));
    }
    const safeText = text.trim().slice(0, TTS_MAX_TEXT_LEN);
    const args = [
      '--voice', voice || 'zh-CN-XiaoxiaoNeural',
      '--rate', rate || '+0%',
      '--text', safeText,
      '--write-media', '-' // 输出到 stdout
    ];

    const proc = execFile('python3', ['-m', 'edge_tts', ...args], {
      timeout: TTS_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      encoding: 'buffer' // 二进制输出
    }, (err, stdout, stderr) => {
      if (err) {
        console.error('[TTS] edge-tts 错误:', err.message);
        return reject(new Error('TTS 合成失败: ' + err.message));
      }
      if (stdout && stdout.length > 0) {
        resolve(stdout);
      } else {
        reject(new Error('TTS 合成结果为空'));
      }
    });
  });
}

/**
 * GET /api/tts/voices — 获取可用中文语音列表
 */
app.get('/api/tts/voices', async (req, res) => {
  try {
    const result = await new Promise((resolve, reject) => {
      execFile('python3', ['-m', 'edge_tts', '--list-voices'], {
        timeout: 15000,
        maxBuffer: 1024 * 1024,
        encoding: 'utf-8'
      }, (err, stdout) => {
        if (err) return reject(err);
        try {
          const lines = stdout.trim().split('\n').slice(2); // 跳过表头
          const voices = lines
            .map(line => {
              const parts = line.split(/\s{2,}/);
              return parts.length >= 2 ? { name: parts[0], locale: parts[1] } : null;
            })
            .filter(v => v && v.locale && v.locale.startsWith('zh-'));
          resolve(voices);
        } catch (e) {
          reject(e);
        }
      });
    });
    res.json({ code: 0, data: result });
  } catch (err) {
    console.error('[TTS] voices 错误:', err.message);
    res.status(500).json({ code: -1, message: '获取语音列表失败' });
  }
});

/**
 * POST /api/tts/segments — 批量分段合成，返回 base64 数组
 * Body: { segments: [{ text: string, voice?: string, rate?: string }], voice?: string, rate?: string }
 */
app.post('/api/tts/segments', async (req, res) => {
  try {
    const { segments, voice: globalVoice, rate: globalRate } = req.body;
    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ code: -1, message: 'segments 不能为空' });
    }
    if (segments.length > 20) {
      return res.status(400).json({ code: -1, message: 'segments 最多 20 段' });
    }

    console.log('[TTS] 开始合成', segments.length, '段');
    const startTime = Date.now();

    const results = await Promise.all(segments.map(async (seg, i) => {
      try {
        const audioBuf = await synthesizeTTS(seg.text, seg.voice || globalVoice, seg.rate || globalRate);
        return {
          index: i,
          success: true,
          audio: 'data:audio/mp3;base64,' + audioBuf.toString('base64'),
          duration: Math.round(audioBuf.length / 4000) // 粗估时长（128kbps mp3）
        };
      } catch (e) {
        console.error('[TTS] 段', i, '合成失败:', e.message);
        return { index: i, success: false, error: e.message };
      }
    }));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const successCount = results.filter(r => r.success).length;
    console.log('[TTS] 合成完成:', successCount + '/' + segments.length, '段,', elapsed + 's');

    res.json({
      code: 0,
      data: results,
      stats: { total: segments.length, success: successCount, elapsed: parseFloat(elapsed) }
    });
  } catch (err) {
    console.error('[TTS] segments 错误:', err.message);
    res.status(500).json({ code: -1, message: 'TTS 批量合成失败: ' + err.message });
  }
});

// ====================================================
// NPC 配置管理（含 base64 图片）
// ====================================================

/**
 * GET /api/npc-config
 * 获取 NPC 配置元数据（公开接口，所有用户可读）
 * 注意：不再返回 images 字段（图片已迁移到独立文档），请用 GET /api/npc-images 获取图片列表
 */
app.get('/api/npc-config', async (req, res) => {
  if (!db) return res.status(503).json({ code: -1, message: '数据库未初始化' });
  try {
    const configRes = await db.collection('config').doc('npc_config').get();
    let configData = configRes.data;
    if (Array.isArray(configData) && configData.length > 0 && configData[0].data !== undefined) {
      configData = configData[0].data;
    }
    // 移除 images 字段（已迁移到独立文档），避免传输大量 base64 数据
    if (configData && configData.images) {
      delete configData.images;
    }
    res.json({ code: 0, data: configData });
    console.log('[NPC-Config] 读取成功（不含图片）');
  } catch (e) {
    if (e.message && e.message.includes('not exist')) {
      res.json({ code: 0, data: null });
    } else {
      console.error('[NPC-Config] 读取失败:', e.message);
      res.status(500).json({ code: -1, message: '读取 NPC 配置失败: ' + e.message });
    }
  }
});

/**
 * PUT /api/npc-config
 * 保存 NPC 配置（管理员权限）
 * Body: { counselors, backgrounds, transitions, ... }
 * 注意：不再处理 images 字段（图片已迁移到独立文档）
 */
app.put('/api/npc-config', async (req, res) => {
  if (!db) return res.status(503).json({ code: -1, message: '数据库未初始化' });
  try {
    const openid = req.body._openid || req.body.openid || '';
    const ADMIN_OPENIDS = (process.env.ADMIN_OPENIDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ADMIN_OPENIDS.includes(openid)) {
      return res.status(403).json({ code: -1, message: '无管理员权限' });
    }

    // 提取纯配置数据（不含 _openid 和 images）
    const { _openid, openid: _, images: __, ...newData } = req.body;

    // 直接写入新配置（images 已迁移到独立文档，不再保留在此文档中）
    await db.collection('config').doc('npc_config').set({ data: newData });

    res.json({ code: 0, message: 'NPC 配置已保存' });
    console.log('[NPC-Config] 保存成功, size:', JSON.stringify(newData).length, 'bytes');
  } catch (e) {
    console.error('[NPC-Config] 保存失败:', e.message);
    res.status(500).json({ code: -1, message: '保存 NPC 配置失败: ' + e.message });
  }
});

/**
 * GET /api/npc-images
 * 获取所有 NPC 图片 ID 列表（公开接口）
 * 返回 { code: 0, data: { imageIds: [...], count: N } }
 */
app.get('/api/npc-images', async (req, res) => {
  if (!db) return res.status(503).json({ code: -1, message: '数据库未初始化' });
  try {
    // CloudBase where 子句不支持对 _id 使用正则/startsWith，改为全量扫描 + 内存过滤
    const queryRes = await db.collection('config').limit(200).get();
    
    let ids = [];
    if (queryRes.data && Array.isArray(queryRes.data)) {
      ids = queryRes.data
        .filter(doc => doc._id && doc._id.startsWith('npc_img_'))
        .map(doc => doc._id.replace('npc_img_', ''));
    }
    
    console.log('[NPC-Images] 查询到', ids.length, '张图片');
    res.json({ code: 0, data: { imageIds: ids, count: ids.length } });
  } catch (e) {
    console.error('[NPC-Images] 查询失败:', e.message);
    res.json({ code: 0, data: { imageIds: [], count: 0 } });
  }
});

/**
 * GET /api/npc-image
 * 获取单张 NPC 图片（公开接口）
 * 参数: imageId (query string)
 * 返回 { code: 0, data: { imageId, base64 } }
 */
app.get('/api/npc-image', async (req, res) => {
  if (!db) return res.status(503).json({ code: -1, message: '数据库未初始化' });
  try {
    const { imageId } = req.query;
    if (!imageId) {
      return res.status(400).json({ code: -1, message: '缺少 imageId 参数' });
    }

    const docId = 'npc_img_' + imageId;
    const imgRes = await db.collection('config').doc(docId).get();
    let imgData = imgRes.data;
    if (Array.isArray(imgData) && imgData.length > 0 && imgData[0].data !== undefined) {
      imgData = imgData[0].data;
    }
    
    if (!imgData || !imgData.base64) {
      return res.status(404).json({ code: -1, message: '图片不存在' });
    }
    
    res.json({ code: 0, data: { imageId, base64: imgData.base64 } });
  } catch (e) {
    if (e.message && e.message.includes('not exist')) {
      res.status(404).json({ code: -1, message: '图片不存在' });
    } else {
      console.error('[NPC-Image-GET] 获取失败:', e.message);
      res.status(500).json({ code: -1, message: '获取图片失败: ' + e.message });
    }
  }
});

/**
 * PUT /api/npc-image
 * 上传/更新单张 NPC 图片（管理员权限）— 存储为独立文档
 * Body: { _openid, imageId, base64 }
 */
app.put('/api/npc-image', async (req, res) => {
  if (!db) return res.status(503).json({ code: -1, message: '数据库未初始化' });
  try {
    const openid = req.body._openid || req.body.openid || '';
    const ADMIN_OPENIDS = (process.env.ADMIN_OPENIDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ADMIN_OPENIDS.includes(openid)) {
      return res.status(403).json({ code: -1, message: '无管理员权限' });
    }

    const { imageId, base64 } = req.body;
    if (!imageId || !base64) {
      return res.status(400).json({ code: -1, message: '缺少 imageId 或 base64' });
    }

    console.log('[NPC-Image] 收到上传请求:', imageId, ', base64 size:', base64.length, 'B');

    // 存储为独立文档（不再合并到 npc_config，避免单文档 16MB 限制）
    const docId = 'npc_img_' + imageId;
    await db.collection('config').doc(docId).set({ 
      data: { imageId, base64, uploadTime: new Date().toISOString() }
    });

    res.json({ code: 0, message: '图片已保存', imageId, size: base64.length });
    console.log('[NPC-Image] 图片已保存:', imageId, ', size:', base64.length, 'B');
  } catch (e) {
    console.error('[NPC-Image] 保存失败:', e.message, e.stack);
    res.status(500).json({ code: -1, message: '保存图片失败: ' + e.message });
  }
});

/**
 * DELETE /api/npc-image
 * 删除单张 NPC 图片（管理员权限）
 * Body: { _openid, imageId }
 * 删除独立文档（不再操作 npc_config）
 */
app.delete('/api/npc-image', async (req, res) => {
  if (!db) return res.status(503).json({ code: -1, message: '数据库未初始化' });
  try {
    const openid = req.body._openid || req.body.openid || '';
    const ADMIN_OPENIDS = (process.env.ADMIN_OPENIDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ADMIN_OPENIDS.includes(openid)) {
      return res.status(403).json({ code: -1, message: '无管理员权限' });
    }

    const { imageId } = req.body;
    if (!imageId) {
      return res.status(400).json({ code: -1, message: '缺少 imageId' });
    }

    const docId = 'npc_img_' + imageId;
    try {
      await db.collection('config').doc(docId).remove();
      res.json({ code: 0, message: '图片已删除', imageId });
      console.log('[NPC-Image] 图片已删除:', imageId);
    } catch (e) {
      res.json({ code: 0, message: '图片不存在', imageId });
    }
  } catch (e) {
    console.error('[NPC-Image] 删除失败:', e.message);
    res.status(500).json({ code: -1, message: '删除图片失败: ' + e.message });
  }
});

// ====================================================
// 等级标签标准化
// ====================================================
function normalizeLevel(label) {
  if (!label) return 'normal';
  const lower = label.toLowerCase();
  if (/^(low|normal|none|minimal)$/i.test(lower.trim())) return 'normal';
  if (/^(mild|slight|light)$/i.test(lower.trim())) return 'mild';
  if (/^(medium|moderate|middle)$/i.test(lower.trim())) return 'moderate';
  if (/^(high|severe|extreme|heavy)$/i.test(lower.trim())) return 'severe';
  if (/正常|健康|无|良好/.test(lower)) return 'normal';
  if (/轻度|轻微|偏轻/.test(lower)) return 'mild';
  if (/中度|中等|明显/.test(lower)) return 'moderate';
  if (/重度|严重|极端|偏重/.test(lower)) return 'severe';
  return 'normal';
}

// ====================================================
// 启动
// ====================================================
app.listen(port, () => {
  console.log('星蓝心镜 API 已启动, 端口:', port, ', 环境:', ENV_ID || '(自动)');
  // 自动迁移：启动时检查 npc_config 是否还有 images 字段，如有则迁移到独立文档
  migrateImagesFromConfig();
});

/**
 * 一次性迁移：将 npc_config.images 中的图片迁移到独立文档
 * 迁移完成后清除 npc_config 的 images 字段
 */
async function migrateImagesFromConfig() {
  try {
    if (!db) return;
    const configRes = await db.collection('config').doc('npc_config').get();
    let configData = configRes.data;
    if (Array.isArray(configData) && configData.length > 0 && configData[0].data !== undefined) {
      configData = configData[0].data;
    }
    if (!configData || !configData.images || Object.keys(configData.images).length === 0) {
      console.log('[Migrate] npc_config 无 images 字段，跳过迁移');
      return;
    }

    const images = configData.images;
    const imageIds = Object.keys(images);
    console.log('[Migrate] 发现', imageIds.length, '张图片需要迁移...');

    let migrated = 0;
    let failed = 0;
    for (const id of imageIds) {
      try {
        const base64 = images[id];
        if (!base64 || typeof base64 !== 'string') continue;
        const docId = 'npc_img_' + id;
        await db.collection('config').doc(docId).set({
          data: { imageId: id, base64, uploadTime: new Date().toISOString() }
        });
        migrated++;
        console.log('[Migrate] 迁移成功:', id, '(' + Math.round(base64.length / 1024) + 'KB)');
      } catch (e) {
        failed++;
        console.error('[Migrate] 迁移失败:', id, e.message);
      }
    }

    // 清除 npc_config 的 images 字段
    delete configData.images;
    await db.collection('config').doc('npc_config').set({ data: configData });
    console.log('[Migrate] 迁移完成！成功', migrated, '张，失败', failed, '张，已清除 npc_config.images');
  } catch (e) {
    console.error('[Migrate] 迁移过程出错:', e.message);
  }
}
