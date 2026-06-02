/**
 * 星蓝心镜 - 后端 API 服务
 *
 * 部署：腾讯云轻量服务器 /www/server/psy-api/
 * 端口：3100（Nginx 反向代理 /api → :3100）
 *
 * API 列表：
 *   健康检查：GET /
 *   测评记录：POST /api/submit, GET /api/history, GET /api/history/:id, DELETE /api/history/:id
 *   AI 诊断：POST /api/ai-diagnose
 *   评价反馈：POST /api/feedback, GET /api/feedback/:recordId
 *   管理员认证：GET /api/auth/qrcode, GET /api/auth/callback, GET /api/auth/check, GET /api/auth/verify
 *   量表配置：GET /api/scales, GET /api/scales/:id, PUT /api/scales/:id
 */

// 强制从脚本所在目录读取 .env（无论从哪里启动）
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3100;
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'psy-default-secret';
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 天

// CORS 白名单：从环境变量读取，默认允许本地和已有域名
// CORS 中间件
app.use(function (req, res, next) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// ====================================================
// MySQL 连接池
// ====================================================

let pool;
let dbReady = false;
async function getPool() {
  if (pool) {
    return pool;
  }
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'psy_assessment',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4'
  });
  // 测试连接（非致命，失败时降级）
  try {
    const conn = await pool.getConnection();
    console.log('[DB] MySQL 连接成功:', process.env.DB_NAME);
    conn.release();
    dbReady = true;
  } catch (e) {
    console.warn('[DB] MySQL 连接失败，将以无数据库模式运行:', e.code);
    dbReady = false;
  }
  return pool;
}

// ====================================================
// Token 工具
// ====================================================

function generateToken(openid, role) {
  const payload = {
    sub: openid,
    role: role || 'admin',
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('hex').substring(0, 16);
  return encoded + '.' + sig;
}

function verifyToken(token) {
  if (!token) {
    return null;
  }
  try {
    const [encoded, sig] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('hex').substring(0, 16);
    if (sig !== expectedSig) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    if (payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// 认证中间件
function authMiddleware(req, res, next) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ code: -3, message: '未登录或登录已过期' });
  }
  req.user = payload;
  next();
}

// ====================================================
// 扫码登录 - 待微信开放平台申请后启用
// ====================================================

const pendingLogins = new Map();

// 清理过期登录
setInterval(() => {
  const now = Date.now();
  for (const [scene, data] of pendingLogins) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      pendingLogins.delete(scene);
    }
  }
}, 60 * 1000);

app.get('/api/auth/qrcode', (req, res) => {
  if (!process.env.WECHAT_WEB_APPID) {
    return res.json({ code: -1, message: '微信开放平台未配置，请先申请网站应用' });
  }
  const scene = 'login_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
  pendingLogins.set(scene, { status: 'waiting', createdAt: Date.now() });
  res.json({
    code: 0,
    data: {
      scene,
      appid: process.env.WECHAT_WEB_APPID,
      redirect_uri: encodeURIComponent(process.env.WECHAT_WEB_REDIRECT_URI)
    }
  });
});

app.get('/api/auth/callback', async (req, res) => {
  const { code, state: scene } = req.query;
  if (!code || !process.env.WECHAT_WEB_APPID || !process.env.WECHAT_WEB_SECRET) {
    return res.redirect('/admin-legacy.html?auth=error&msg=config_missing');
  }
  try {
    // 用 code 换 access_token
    const tokenUrl =
      'https://api.weixin.qq.com/sns/oauth2/access_token?' +
      'appid=' +
      process.env.WECHAT_WEB_APPID +
      '&secret=' +
      process.env.WECHAT_WEB_SECRET +
      '&code=' +
      code +
      '&grant_type=authorization_code';
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.errcode) {
      return res.redirect('/admin-legacy.html?auth=error&msg=' + (tokenData.errmsg || 'token_exchange_failed'));
    }

    const webOpenid = tokenData.openid;
    const unionid = tokenData.unionid || '';

    // 检查是否为管理员
    const db = await getPool();
    const [admins] = await db.query('SELECT * FROM admins WHERE openid = ? OR (openid = ? AND openid != "") LIMIT 1', [
      unionid,
      webOpenid
    ]);

    if (admins.length === 0) {
      if (pendingLogins.has(scene)) {
        pendingLogins.get(scene).status = 'rejected';
      }
      return res.redirect('/admin-legacy.html?auth=rejected');
    }

    // 生成 token
    const admin = admins[0];
    const token = generateToken(admin.openid, admin.role);

    // 更新状态
    if (pendingLogins.has(scene)) {
      pendingLogins.get(scene).status = 'approved';
      pendingLogins.get(scene).token = token;
    }

    // 更新登录时间
    await db.query('UPDATE admins SET last_login_at = NOW() WHERE id = ?', [admin.id]);

    // 自动补填 unionid
    if (unionid && !admin.unionid) {
      // admins 表暂无 unionid 字段，后续扩展
    }

    res.redirect('/admin-legacy.html?auth=success&scene=' + scene);
  } catch (err) {
    console.error('[Auth Callback] 错误:', err);
    res.redirect('/admin-legacy.html?auth=error&msg=server_error');
  }
});

app.get('/api/auth/check', (req, res) => {
  const { scene } = req.query;
  const pending = pendingLogins.get(scene);
  if (!pending) {
    return res.json({ code: 0, data: { status: 'expired' } });
  }
  res.json({
    code: 0,
    data: {
      status: pending.status,
      token: pending.token || null
    }
  });
});

app.get('/api/auth/verify', (req, res) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  const payload = verifyToken(token);
  res.json({
    code: 0,
    data: { valid: !!payload, role: payload ? payload.role : null }
  });
});

// 密码登录（降级方案）
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  // 简易密码验证（后续替换为更安全的方式）
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  if (password === ADMIN_PASSWORD) {
    const token = generateToken('password-admin', 'super');
    res.json({ code: 0, data: { token, role: 'super' } });
  } else {
    res.status(401).json({ code: -1, message: '密码错误' });
  }
});

// ====================================================
// 小程序登录 API
// ====================================================

/**
 * POST /api/mp-login
 * 微信小程序登录：wx.login code → openid
 * 开发阶段：使用简易 openid 生成（不依赖微信 API）
 * 生产阶段：替换为 jscode2session 调用
 */
app.post('/api/mp-login', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ code: -1, message: '缺少 code 参数' });
  }

  try {
    // TODO: 生产环境替换为微信 jscode2session API
    // const wxRes = await axios.get(`https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`);
    // const openid = wxRes.data.openid;

    // 开发阶段：基于 code 生成确定性 openid（同 code 同 openid）
    const crypto = require('crypto');
    const openid = 'dev_' + crypto.createHash('md5').update(code).digest('hex').substring(0, 16);

    res.json({ code: 0, data: { openid, token: null } });
  } catch (err) {
    console.error('[mp-login] 错误:', err.message);
    res.status(500).json({ code: -1, message: '登录失败' });
  }
});

// ====================================================
// 测评记录 API
// ====================================================

/**
 * POST /api/submit
 * 提交测评记录
 */
app.post('/api/submit', async (req, res) => {
  try {
    const db = await getPool();
    const {
      recordId,
      scaleId,
      scaleName,
      totalScore,
      maxScore,
      level,
      levelName,
      color,
      emoji,
      answers,
      dimensions,
      aiDiagnosis,
      source,
      duration,
      categoryName
    } = req.body;

    if (!recordId || !scaleId) {
      return res.status(400).json({ code: -1, message: '参数错误：需要 recordId 和 scaleId' });
    }

    // 检查是否已存在
    const [existing] = await db.query('SELECT id FROM assessments WHERE record_id = ?', [recordId]);
    if (existing.length > 0) {
      return res.json({ code: 0, message: '记录已存在', data: { id: existing[0].id } });
    }

    const [result] = await db.query(
      `INSERT INTO assessments (record_id, openid, scale_id, scale_name, total_score, max_score, level, level_name, color, emoji, answers, dimensions, ai_diagnosis, source, duration, category_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recordId,
        req.body.openid || '',
        scaleId,
        scaleName || '',
        totalScore !== undefined ? totalScore : null,
        maxScore !== undefined ? maxScore : null,
        level || '',
        levelName || '',
        color || '',
        emoji || '',
        answers ? JSON.stringify(answers) : null,
        dimensions ? JSON.stringify(dimensions) : null,
        aiDiagnosis || null,
        source || 'web',
        duration || 0,
        categoryName || ''
      ]
    );

    res.json({ code: 0, data: { id: result.insertId, recordId } });
  } catch (err) {
    console.error('[Submit] 错误:', err);
    res.status(500).json({ code: -1, message: '提交失败: ' + err.message });
  }
});

/**
 * GET /api/history?page=1&pageSize=20&openid=xxx
 * 查询测评历史
 */
app.get('/api/history', async (req, res) => {
  try {
    const db = await getPool();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
    const openid = req.query.openid || '';
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params = [];
    if (openid) {
      where += ' AND openid = ?';
      params.push(openid);
    }

    const [list] = await db.query(
      `SELECT id, record_id, openid, scale_id, scale_name, total_score, max_score, level, level_name, color, emoji, dimensions, ai_diagnosis, source, duration, category_name, created_at
       FROM assessments ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM assessments ${where}`, params);

    // 解析 JSON 字段，对齐前端 record 对象结构
    const records = list.map((r) => ({
      id: r.record_id,
      scaleId: r.scale_id,
      scaleName: r.scale_name,
      emoji: r.emoji || '',
      score: r.total_score,
      maxScore: r.max_score,
      level: r.level,
      levelName: r.level_name,
      color: r.color,
      categoryName: r.category_name,
      dims: r.dimensions ? (typeof r.dimensions === 'string' ? JSON.parse(r.dimensions) : r.dimensions) : null,
      aiDiagnosis: r.ai_diagnosis,
      source: r.source,
      date: r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '',
      completedAt: r.created_at
    }));

    res.json({
      code: 0,
      data: {
        list: records,
        total: countResult[0].total,
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
 * GET /api/history/:id
 * 查询单条测评详情
 */
app.get('/api/history/:id', async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.query('SELECT * FROM assessments WHERE record_id = ? LIMIT 1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ code: -1, message: '记录不存在' });
    }
    const r = rows[0];
    res.json({
      code: 0,
      data: {
        id: r.record_id,
        scaleId: r.scale_id,
        scaleName: r.scale_name,
        score: r.total_score,
        maxScore: r.max_score,
        level: r.level,
        levelName: r.level_name,
        color: r.color,
        emoji: r.emoji || '',
        categoryName: r.category_name,
        answers: r.answers ? (typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers) : null,
        dims: r.dimensions ? (typeof r.dimensions === 'string' ? JSON.parse(r.dimensions) : r.dimensions) : null,
        aiDiagnosis: r.ai_diagnosis,
        source: r.source,
        duration: r.duration,
        completedAt: r.created_at
      }
    });
  } catch (err) {
    console.error('[HistoryDetail] 错误:', err);
    res.status(500).json({ code: -1, message: '查询失败: ' + err.message });
  }
});

/**
 * DELETE /api/history/:id — 需要管理员认证
 */
app.delete('/api/history/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const [result] = await db.query('DELETE FROM assessments WHERE record_id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: -1, message: '记录不存在' });
    }
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[Delete] 错误:', err);
    res.status(500).json({ code: -1, message: '删除失败: ' + err.message });
  }
});

// ====================================================
// AI 诊断 API（多 Key 轮询）
// ====================================================

/**
 * 多 Key 管理
 * .env 中支持 DASHSCOPE_API_KEY 和 DEEPSEEK_API_KEY（逗号分隔多个），遇到 401/429 自动切换
 * 也可通过 POST /api/ai-config 动态更新
 */
const _apiKeys = { dashscope: [], deepseek: [] };
const _keyIndex = { dashscope: 0, deepseek: 0 };

// 从 .env 加载（逗号分隔）
['DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY'].forEach(function (envKey) {
  const provider = envKey === 'DASHSCOPE_API_KEY' ? 'dashscope' : 'deepseek';
  if (process.env[envKey]) {
    process.env[envKey].split(/[,，]/).forEach(function (k) {
      const trimmed = k.trim();
      if (trimmed.length > 10) {
        _apiKeys[provider].push(trimmed);
      }
    });
  }
});
console.log(
  '[AI] 已加载 DashScope Key: ' + _apiKeys.dashscope.length + ' 个, DeepSeek Key: ' + _apiKeys.deepseek.length + ' 个'
);

/** 获取当前 Key（轮询） */
function _nextKey(provider) {
  const keys = _apiKeys[provider] || [];
  if (keys.length === 0) {
    return '';
  }
  const idx = _keyIndex[provider] || 0;
  const key = keys[idx % keys.length];
  _keyIndex[provider] = (idx + 1) % keys.length;
  return key;
}

/** 各 Provider 的 API 基础地址 */
const _PROVIDER_BASE_URL = {
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions'
};

/** 各 Provider 的默认模型 */
const _PROVIDER_DEFAULT_MODEL = {
  dashscope: 'qwen-plus',
  deepseek: 'deepseek-v4-flash'
};

/** 通用的 OpenAI 兼容格式 AI 调用（带 Key 轮询） */
async function _callAi(messages, model, temperature, maxTokens, provider, responseFormat) {
  const baseUrl = _PROVIDER_BASE_URL[provider];
  if (!baseUrl) {
    throw new Error('不支持的 AI 服务商: ' + provider);
  }

  const keys = _apiKeys[provider] || [];
  if (keys.length === 0) {
    throw new Error(
      'AI API Key 未配置（.env ' +
        (provider === 'deepseek' ? 'DEEPSEEK' : 'DASHSCOPE') +
        '_API_KEY 或 POST /api/ai-config）'
    );
  }

  let lastError = null;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(_keyIndex[provider] || 0) % keys.length];
    _keyIndex[provider] = ((_keyIndex[provider] || 0) + 1) % keys.length;
    console.log('[AI][' + provider + '] 尝试 Key #' + attempt + '/' + keys.length);

    try {
      // 添加超时处理（120秒，生成量表需要更长时间）
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.warn('[AI][' + provider + '] 请求超时（120秒），中止');
        controller.abort();
      }, 120000);

      console.log('[AI][' + provider + '] 开始 fetch()，model=' + model + ', messages.length=' + messages.length);
      const requestBody = { model, messages, max_tokens: maxTokens, temperature };
      if (responseFormat) {
        requestBody.response_format = responseFormat;
      }
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeout);
      console.log('[AI][' + provider + '] fetch() 完成，HTTP=' + response.status);

      const data = await response.json();
      console.log('[AI][' + provider + '] response.json() 完成，有 error=' + !!data.error);

      // 401/429 → 切换下一个 Key
      if (
        data.error &&
        (data.error.code === 'InvalidApiKey' ||
          data.error.code === 'InvalidParameter' ||
          response.status === 401 ||
          response.status === 429)
      ) {
        console.warn(
          '[AI][' + provider + '] Key 失效 (' + response.status + '): ' + (data.error.message || '') + '，切换下一个'
        );
        lastError = new Error(data.error.message || 'Key 失效 (HTTP ' + response.status + ')');
        continue;
      }

      if (data.error) {
        return { error: true, message: data.error.message || 'AI 调用失败' };
      }

      const result = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
      const finishReason = data.choices && data.choices[0] ? data.choices[0].finish_reason : 'unknown';
      const usage = data.usage || {};
      console.log('[AI][' + provider + '] 返回：finish_reason=' + finishReason + ', usage=' + JSON.stringify(usage));
      if (!result) {
        return { error: true, message: 'AI 返回为空' };
      }

      return { error: false, data: result, finishReason: finishReason };
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'AbortSignal') {
        console.warn('[AI][' + provider + '] 请求超时（120秒）');
        lastError = new Error('AI 请求超时（120秒），请检查网络或 API 服务状态');
      } else {
        console.warn('[AI][' + provider + '] 请求异常:', err.message);
        lastError = err;
      }
    }
  }

  // 所有 Key 都失败
  throw lastError || new Error('所有 API Key 均不可用');
}

/** 兼容旧代码的 _callDashScope 别名 */
function _callDashScope(messages, model, temperature, maxTokens) {
  return _callAi(messages, model, temperature, maxTokens, 'dashscope');
}

/**
 * 智能修复被截断的 JSON（常见于 AI 输出被 token 限制截断的情况）
 * 策略：金字塔式回退
 *   1. 先尝试直接解析或补全括号解析
 *   2. 失败则从末尾逐步删除不完整片段（到上一个逗号/闭合括号）
 *   3. 补全括号后再尝试解析
 * 最多回退 100 次，确保一定找到有效 JSON
 */
function _fixTruncatedJson(str) {
  if (!str || typeof str !== 'string') {
    return null;
  }

  // Remove trailing commas first
  str = str.replace(/,(\s*[}\]])/g, '$1');

  // Count brackets and find last valid structural point
  function _braceInfo(s, end) {
    end = end || s.length;
    let brace = 0,
      brack = 0,
      inStr = false,
      esc = false;
    // Track: last position of each brace level closing
    let lastCloseBraceAt = -1,
      lastCloseBrackAt = -1;
    for (let i = 0; i < end; i++) {
      const c = s[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\' && inStr) {
        esc = true;
        continue;
      }
      if (c === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) {
        continue;
      }
      if (c === '{') {
        brace++;
      } else if (c === '}') {
        brace--;
        lastCloseBraceAt = i;
      } else if (c === '[') {
        brack++;
      } else if (c === ']') {
        brack--;
        lastCloseBrackAt = i;
      }
    }
    return { brace, brack, lastCloseBraceAt, lastCloseBrackAt };
  }

  // Try to parse a candidate string by appending closing brackets
  function _tryParse(s) {
    const info = _braceInfo(s);
    let r = s;
    // Close any open string
    let inStr = false,
      esc = false;
    for (let i = 0; i < r.length; i++) {
      const c = r[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\' && inStr) {
        esc = true;
        continue;
      }
      if (c === '"') {
        inStr = !inStr;
        continue;
      }
    }
    if (inStr) {
      r += '"';
    }
    while (info.brack > 0) {
      r += ']';
      info.brack--;
    }
    while (info.brace > 0) {
      r += '}';
      info.brace--;
    }
    try {
      JSON.parse(r);
      return r;
    } catch (e) {
      return null;
    }
  }

  // Strategy: walk backward from end, find the last valid structural closing point
  // (a complete "}" or "]" that balances brackets at that position)
  for (let cut = str.length - 1; cut > 0; cut--) {
    // Only try cutting at structural boundaries: after , or } or ]
    const ch = str.charAt(cut);
    if (ch !== ',' && ch !== '}' && ch !== ']') {
      continue;
    }

    const candidate = str.substring(0, cut + 1);
    const info = _braceInfo(candidate);

    // Check: are braces/brackets in a closable state?
    // The remaining content should only have open braces/brackets (no over-closed)
    if (info.brace < 0 || info.brack < 0) {
      continue;
    }

    const result = _tryParse(candidate);
    if (result) {
      const parsed = JSON.parse(result);
      const qCount = (parsed.questions && parsed.questions.length) || 0;
      console.log('[fixTruncated] 修复成功！截断位置=' + cut + ', 保留题目=' + qCount);
      return result;
    }
  }

  console.warn('[fixTruncated] 无法修复截断的 JSON');
  return null;
}

app.post('/api/ai-diagnose', async (req, res) => {
  try {
    const { messages, provider, model, temperature, maxTokens, apiKey } = req.body;
    console.log(
      '[AI-DIAGNOSE] 收到请求: provider=' +
        (provider || 'undefined') +
        ', model=' +
        (model || 'undefined') +
        ', messages.length=' +
        (messages ? messages.length : 0)
    );
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ code: -1, message: '参数错误：需要 messages 数组' });
    }

    const effectiveProvider = provider || 'deepseek';
    const baseUrl = _PROVIDER_BASE_URL[effectiveProvider];
    if (!baseUrl) {
      return res.status(400).json({ code: -1, message: '不支持的 AI 服务商: ' + effectiveProvider });
    }
    const effectiveModel = model || _PROVIDER_DEFAULT_MODEL[effectiveProvider] || 'qwen-plus';
    const effectiveTemp = Math.max(0, Math.min(2, temperature !== undefined ? temperature : 0.7));
    const effectiveMaxTokens = Math.max(100, Math.min(32000, maxTokens || 2000));

    // 如果请求体带了单个 apiKey（前端直连场景），直接用，不走轮询
    if (apiKey) {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 120000);
      try {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
          body: JSON.stringify({
            model: effectiveModel,
            messages,
            max_tokens: effectiveMaxTokens,
            temperature: effectiveTemp
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        const data = await response.json();
        if (data.error) {
          return res.status(502).json({ code: -1, message: data.error.message || 'AI 调用失败' });
        }
        const result =
          data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
        if (!result) {
          return res.status(502).json({ code: -1, message: 'AI 返回为空' });
        }
        // Pre-warm TTS 缓存（异步，不阻塞响应）
        _prewarmTtsCache(result, '');
        return res.json({ code: 0, data: result });
      } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError' || err.name === 'AbortSignal') {
          return res.status(504).json({ code: -1, message: 'AI 请求超时（120秒）' });
        }
        throw err;
      }
    }

    // 服务端多 Key 轮询
    const result = await _callAi(messages, effectiveModel, effectiveTemp, effectiveMaxTokens, effectiveProvider);
    if (result.error) {
      return res.status(502).json({ code: -1, message: result.message });
    }
    // Pre-warm TTS 缓存（异步，不阻塞响应）
    _prewarmTtsCache(result.data || '', '');
    res.json({ code: 0, data: result.data });
  } catch (err) {
    console.error('[AI] 错误:', err);
    res.status(502).json({ code: -1, message: err.message || 'AI 调用失败' });
  }
});

// 管理员密钥验证中间件（用于 AI Key 等敏感接口）
// ADMIN_API_SECRET 环境变量，未设置则不验证（向后兼容）
function adminSecretMiddleware(req, res, next) {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) {
    return next();
  } // 未配置则放行
  const reqSecret = req.headers['x-admin-secret'] || req.query.admin_secret || '';
  if (reqSecret !== secret) {
    return res.status(403).json({ code: -1, message: '无管理员权限' });
  }
  next();
}

// 更新 AI Key 配置（管理员专用）
// body: { keys: string[] | string, provider?: 'dashscope' | 'deepseek' }
app.put('/api/ai-config', adminSecretMiddleware, async (req, res) => {
  try {
    const { keys, provider: reqProvider } = req.body;
    if (!keys) {
      return res.status(400).json({ code: -1, message: '需要 keys 参数' });
    }
    const provider = reqProvider || 'dashscope';
    if (!_apiKeys[provider]) {
      return res.status(400).json({ code: -1, message: '不支持的 provider: ' + provider });
    }

    const keyArr =
      typeof keys === 'string'
        ? keys
            .split(/[,，]/)
            .map((k) => k.trim())
            .filter((k) => k.length > 10)
        : keys.filter((k) => k.length > 10);
    if (keyArr.length === 0) {
      return res.status(400).json({ code: -1, message: '无有效 Key' });
    }

    _apiKeys[provider].length = 0;
    keyArr.forEach((k) => _apiKeys[provider].push(k));
    _keyIndex[provider] = 0;
    console.log('[AI][' + provider + '] Key 配置已更新，共 ' + _apiKeys[provider].length + ' 个');

    // 持久化到 .env 文件，防止服务重启丢失
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      let envContent = '';
      try {
        envContent = fs.readFileSync(envPath, 'utf-8');
      } catch (e) {
        /* 文件不存在则新建 */
      }
      const envLines = envContent.split('\n');
      const envKey = provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'DASHSCOPE_API_KEY';
      const newLine = envKey + '=' + keyArr.join(',');
      let found = false;
      for (let i = 0; i < envLines.length; i++) {
        if (envLines[i].startsWith(envKey + '=')) {
          envLines[i] = newLine;
          found = true;
          break;
        }
      }
      if (!found) {
        envLines.push(newLine);
      }
      fs.writeFileSync(envPath, envLines.join('\n'));
      console.log('[AI][' + provider + '] Key 已持久化到 .env');
    } catch (e) {
      console.warn('[AI] 持久化到 .env 失败:', e.message);
    }

    res.json({ code: 0, data: { count: _apiKeys.length } });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// 查询当前 AI Key 配置状态（脱敏，管理员专用）
app.get('/api/ai-config', adminSecretMiddleware, async (req, res) => {
  try {
    const result = {};
    ['dashscope', 'deepseek'].forEach(function (provider) {
      const keys = _apiKeys[provider] || [];
      result[provider] = {
        count: keys.length,
        keys: keys.map(function (k, i) {
          return {
            index: i + 1,
            key: k.substring(0, 8) + '***' + k.substring(k.length - 4),
            active: i === (_keyIndex[provider] || 0) % keys.length
          };
        })
      };
    });
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// ====================================================
// 运维监控配置 API
// ====================================================

// 从 .env 加载运维配置
function loadOpsConfig() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.startsWith('OPS_CONFIG=')) {
        const val = line.substring('OPS_CONFIG='.length).trim();
        if (val) {
          return JSON.parse(val);
        }
      }
    }
  } catch (e) {
    /* 文件不存在或解析失败 */
  }
  return null;
}

// 保存运维配置到 .env
function saveOpsConfigToEnv(config) {
  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf-8');
  } catch (e) {
    /* 新建 */
  }
  const newLine = 'OPS_CONFIG=' + JSON.stringify(config);
  const lines = envContent.split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('OPS_CONFIG=')) {
      lines[i] = newLine;
      found = true;
      break;
    }
  }
  if (!found) {
    lines.push(newLine);
  }
  fs.writeFileSync(envPath, lines.join('\n'));
  console.log('[OpsConfig] 已持久化到 .env');
}

// 获取运维监控配置（脱敏，管理员专用）
app.get('/api/ops-config', adminSecretMiddleware, (req, res) => {
  try {
    const config = loadOpsConfig();
    res.json({ code: 0, data: config || {} });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// 更新运维监控配置（管理员专用）
app.put('/api/ops-config', adminSecretMiddleware, (req, res) => {
  try {
    const config = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ code: -1, message: '需要配置对象' });
    }
    saveOpsConfigToEnv(config);
    res.json({ code: 0, message: '运维配置已保存' });
  } catch (err) {
    res.status(500).json({ code: -1, message: '保存失败：' + err.message });
  }
});

// ====================================================
// 评价反馈 API
// ====================================================

app.post('/api/feedback', async (req, res) => {
  try {
    const db = await getPool();
    const { recordId, scene, stars, tags, text, comment, source, scaleId, scaleName, assessmentData } = req.body;

    // 兼容新旧字段名：text → comment
    const feedbackComment = text || comment || null;

    if (!recordId || !scene) {
      return res.status(400).json({ code: -1, message: '参数错误：需要 recordId, scene' });
    }
    if (!['result', 'diag'].includes(scene)) {
      return res.status(400).json({ code: -1, message: 'scene 必须为 result 或 diag' });
    }

    // 检查是否已评价
    const [existing] = await db.query('SELECT id FROM feedback WHERE record_id = ? AND scene = ?', [recordId, scene]);
    if (existing.length > 0) {
      return res.json({ code: 0, message: '已评价过' });
    }

    const [result] = await db.query(
      `INSERT INTO feedback (record_id, openid, scene, stars, tags, comment, source, scale_id, scale_name, assessment_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        recordId,
        req.body.openid || '',
        scene,
        stars || 0,
        tags ? JSON.stringify(tags) : null,
        feedbackComment,
        source || scene,
        scaleId || '',
        scaleName || '',
        assessmentData ? JSON.stringify(assessmentData) : null
      ]
    );
    res.json({ code: 0, data: { id: result.insertId } });
  } catch (err) {
    console.error('[Feedback] 错误:', err);
    res.status(500).json({ code: -1, message: '反馈提交失败: ' + err.message });
  }
});

// 管理后台获取全部评价列表
app.get('/api/feedback', async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.query(
      'SELECT id, record_id, openid, scene, stars, tags, comment, source, scale_id, scale_name, assessment_data, created_at FROM feedback ORDER BY id DESC'
    );
    const feedbackList = rows.map((r) => ({
      id: r.id,
      recordId: r.record_id,
      openid: r.openid,
      scene: r.scene,
      stars: r.stars,
      tags: r.tags ? (typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags) : null,
      comment: r.comment,
      source: r.source,
      scaleId: r.scale_id,
      scaleName: r.scale_name,
      assessmentData: r.assessment_data
        ? typeof r.assessment_data === 'string'
          ? JSON.parse(r.assessment_data)
          : r.assessment_data
        : null,
      createdAt: r.created_at
    }));
    res.json({ code: 0, data: feedbackList });
  } catch (err) {
    console.error('[FeedbackAll] 错误:', err);
    res.status(500).json({ code: -1, message: '查询失败: ' + err.message });
  }
});

app.get('/api/feedback/:recordId', async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.query(
      'SELECT scene, stars, tags, comment, source, scale_id, scale_name, assessment_data, created_at FROM feedback WHERE record_id = ?',
      [req.params.recordId]
    );
    // 解析 JSON 字段
    const feedbackList = rows.map((r) => ({
      scene: r.scene,
      stars: r.stars,
      tags: r.tags ? (typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags) : null,
      comment: r.comment,
      source: r.source,
      scaleId: r.scale_id,
      scaleName: r.scale_name,
      assessmentData: r.assessment_data
        ? typeof r.assessment_data === 'string'
          ? JSON.parse(r.assessment_data)
          : r.assessment_data
        : null,
      createdAt: r.created_at
    }));
    res.json({ code: 0, data: feedbackList });
  } catch (err) {
    console.error('[FeedbackList] 错误:', err);
    res.status(500).json({ code: -1, message: '查询失败: ' + err.message });
  }
});

// ====================================================
// 量表数据静态 JSON 同步（给前端 WebView 直接 fetch）
// ====================================================

const SCALES_JSON_PATH = process.env.SCALES_JSON_PATH || '/www/wwwroot/www.soarto.com.cn/scales-data.json';

/**
 * GET /api/scales-json — 公开接口，返回上架量表
 * 前端 WebView 启动时直接 fetch 此接口获取最新量表列表
 */
app.get('/api/scales-json', async (req, res) => {
  try {
    if (!fs.existsSync(SCALES_JSON_PATH)) {
      // 本地文件不存在，从远程服务器拉取
      try {
        const https = require('https');
        const remoteData = await new Promise((resolve, reject) => {
          https
            .get('https://www.soarto.com.cn/api/scales-json', (remoteRes) => {
              let body = '';
              remoteRes.on('data', (chunk) => (body += chunk));
              remoteRes.on('end', () => {
                try {
                  resolve(JSON.parse(body));
                } catch (e) {
                  reject(e);
                }
              });
            })
            .on('error', reject);
        });
        return res.json(remoteData);
      } catch (e) {
        return res.json({ code: 0, data: [], message: '暂无量表数据' });
      }
    }
    const raw = fs.readFileSync(SCALES_JSON_PATH, 'utf-8');
    const allScales = JSON.parse(raw);
    // 只返回上架的量表（status === 1 或未设置）
    const active = (Array.isArray(allScales) ? allScales : []).filter((s) => s.status === 1 || s.status === undefined);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ code: 0, data: active, total: active.length });
  } catch (err) {
    console.error('[ScalesJSON] 读取失败:', err.message);
    res.status(500).json({ code: -1, message: '读取量表数据失败' });
  }
});

/**
 * PUT /api/scales-json — 管理员专用，全量更新 scales-data.json
 * 后台保存时调用，覆盖写入
 */
app.put('/api/scales-json', adminSecretMiddleware, (req, res) => {
  try {
    const { scales } = req.body;
    if (!Array.isArray(scales)) {
      return res.status(400).json({ code: -1, message: '需要 scales 数组' });
    }
    const json = JSON.stringify(scales, null, 2);
    fs.writeFileSync(SCALES_JSON_PATH, json, 'utf-8');
    console.log('[ScalesJSON] 已更新，共', scales.length, '个量表');
    res.json({ code: 0, data: { total: scales.length } });
  } catch (err) {
    console.error('[ScalesJSON] 写入失败:', err.message);
    res.status(500).json({ code: -1, message: '写入量表数据失败' });
  }
});

// ====================================================
// AI 提示词生成 API
// ====================================================

/**
 * POST /api/generate-prompt — 根据量表信息生成 AI 测评报告提示词
 * body: { scaleName, scoring, dimensions, questions }
 */
app.post('/api/generate-prompt', async (req, res) => {
  try {
    const { scaleName, scoring, dimensions, questions, scaleCode } = req.body;

    if (!scaleName) {
      return res.status(400).json({ code: -1, message: '需要量表名称' });
    }

    console.log(
      '[GeneratePrompt] 收到请求:',
      scaleName,
      'dimensions:',
      (dimensions || scoring?.dimensions || []).length
    );

    // 构建量表信息摘要
    const dims = dimensions || scoring?.dimensions || [];
    const dimNames = dims.map((d) => d.name).filter(Boolean);
    const dimStr = dimNames.length > 0 ? dimNames.join('、') : '（未配置）';
    const maxScore = dims.reduce((sum, d) => sum + (d.maxScore || 0), 0) || '（未配置）';
    const totalQ = questions?.length || dims.reduce((sum, d) => sum + (d.questions?.length || 0), 0) || '（未配置）';

    // 系统提示词模板
    const systemPrompt = `你是星蓝心镜心理健康平台的 AI 测评分析师，专注于为用户提供专业、温暖的心理健康测评报告。

【量表信息】
量表名称：${scaleName}
${scaleCode ? '量表编码：' + scaleCode : ''}
计分维度：${dimStr}
维度满分：${maxScore}
题目数量：${totalQ}题

【报告生成要求】

1. 【综合评估】
   - 概述用户在该量表上的整体表现
   - 用温和、专业的语言描述心理状态
   - 给出 1-3 个关键词概括

2. 【各维度分析】
   - 对每个维度逐一分析（维度名称 + 得分解读 + 含义说明）
   - 结合中国文化背景和专业心理学理论
   - 区分不同得分区间的含义

3. 【风险提示】
   - 如有维度得分异常，温和提示关注
   - 强调报告仅供参考，不作为诊断依据
   - 建议有需要时寻求专业帮助

4. 【改善建议】
   - 根据维度得分给出 2-4 条具体、可操作的建议
   - 融入积极心理学理念
   - 语言亲切，易于理解

【语言风格】
- 温暖专业，以"你"称呼用户
- 避免专业术语堆砌，必要时解释
- 多用肯定性语言，关注用户优势
- 中文输出，段落清晰

【重要约束】
- 不提供任何医学诊断结论
- 不替代专业心理咨询
- 保护用户隐私，不追问个人信息`;

    // 使用 AI 优化提示词
    const userMsg = `请根据以下量表信息，帮我优化上面的系统提示词，使其更适合生成专业的测评报告：

量表名称：${scaleName}
${scaleCode ? '量表编码：' + scaleCode : ''}
计分维度（共${dimNames.length}个）：${dimStr}
${scoring?.metrics?.length ? '评估指标：' + scoring.metrics.map((m) => m.name).join('、') : ''}

请只输出优化后的系统提示词，不要解释。`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg }
    ];

    // 尝试调用 AI，如果失败则返回基础模板
    try {
      // 使用 deepseek（更擅长中文写作优化）
      const result = await _callAi(messages, 'deepseek-v4-flash', 0.7, 2000, 'deepseek');

      if (result.error) {
        console.warn('[GeneratePrompt] AI 调用失败，使用默认模板:', result.message);
        return res.json({
          code: 0,
          data: systemPrompt,
          message: 'AI 优化失败，返回基础模板'
        });
      }

      console.log('[GeneratePrompt] AI 生成成功，长度:', result.data.length);
      res.json({ code: 0, data: result.data });
    } catch (aiErr) {
      console.warn('[GeneratePrompt] AI 异常，使用默认模板:', aiErr.message);
      res.json({
        code: 0,
        data: systemPrompt,
        message: 'AI 服务不可用，返回基础模板'
      });
    }
  } catch (err) {
    console.error('[GeneratePrompt] 错误:', err);
    res.status(500).json({ code: -1, message: err.message || '生成失败' });
  }
});

/**
 * 将 AI 返回的数组尝试转换为量表对象
 * - 数组元素为字符串 → 作为 notice 字段
 * - 数组元素为对象（含 content/options）→ 作为 questions 字段
 * - 数组元素为对象（含 name/code）→ 取第一个作为量表对象
 */
function _arrayToScaleObject(arr, userText) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return null;
  }

  const first = arr[0];
  // 情况1：数组元素是量表对象 { name, code, questions, ... }
  if (first && typeof first === 'object' && !Array.isArray(first) && (first.name || first.code || first.questions)) {
    return first;
  }

  // 情况2：数组元素是题目对象 { content, options, ... }
  if (first && typeof first === 'object' && !Array.isArray(first) && (first.content || first.options)) {
    // 尝试从 userText 提取量表名称
    const nameMatch = userText.match(
      /([\u4e00-\u9fffA-Za-z0-9\s\-]{2,30})(?:量表|问卷|测评|Inventory|Scale|Questionnaire)/i
    );
    const scaleName = nameMatch
      ? nameMatch[1].trim() + (nameMatch[0].match(/(量表|问卷|测评|Inventory|Scale|Questionnaire)/i)?.[0] || '量表')
      : 'AI生成量表';
    return {
      name: scaleName,
      code: 'AI_GEN_' + Date.now().toString(36).toUpperCase(),
      category: 'unknown',
      questions: arr.map(function (q, i) {
        if (!q.id) {
          q.id = 'q' + (i + 1);
        }
        if (!q.options) {
          q.options = [];
        }
        return q;
      })
    };
  }

  // 情况3：数组元素是字符串 → 作为 notice 字段
  if (typeof first === 'string') {
    return {
      name: 'AI生成量表',
      code: 'AI_GEN_' + Date.now().toString(36).toUpperCase(),
      category: 'unknown',
      notice: arr,
      questions: [],
      _autoGenerated: true
    };
  }

  return null;
}

/**
 * 展开精简格式量表为标准格式
 * AI 输出用 _qs 压缩 questions 以减少 token 消耗
 * 映射：_qs[].t→content, _qs[].d→dimension, _opts→全局默认 options
 * 展开后删除所有 _* 字段，下游完全无感知
 */
function _expandCompactScale(data) {
  if (!data || typeof data !== 'object' || !data._qs) {
    return data;
  }

  const globalOpts = data._opts;
  const questions = [];

  for (let i = 0; i < data._qs.length; i++) {
    const q = data._qs[i];
    const question = {
      id: i + 1,
      content: q.t || '',
      dimension: q.d || ''
    };

    // Options: 题级 o 优先，否则用全局 _opts
    const opts = q.o || globalOpts;
    if (Array.isArray(opts) && Array.isArray(opts[0])) {
      // 紧凑格式 [["标签",score],...] → [{label,score},...]
      question.options = opts.map(function (o) {
        return { label: String(o[0] || ''), score: typeof o[1] === 'number' ? o[1] : 0 };
      });
    } else {
      question.options = [];
    }

    questions.push(question);
  }

  data.questions = questions;

  // 清除临时精简字段（保留 _sharedGroups 等业务字段）
  delete data._qs;
  delete data._opts;
  // 题级精简字段已通过 _qs 整体替换，无需额外清理
  // _sharedGroups / _dim 等业务字段不在此处删除

  return data;
}

/**
 * 展开 _sharedGroups → 每题 groups（共享评分维度注入每题）
 * 同时将选项从紧凑格式 [["标签",score],...] 转为标准格式 [{id,label,score},...]
 */
function _expandSharedGroups(data) {
  if (!data || !data._sharedGroups || !Array.isArray(data._sharedGroups)) {
    return data;
  }

  // 1. 将 _sharedGroups 的 options 从紧凑数组转为标准对象
  const groups = data._sharedGroups.map(function (grp) {
    const opts = (grp.options || []).map(function (o, i) {
      if (Array.isArray(o)) {
        return { id: grp.id + '_' + i, label: String(o[0] || ''), score: typeof o[1] === 'number' ? o[1] : 0 };
      }
      // 已是对象格式，补 id
      return { id: o.id || grp.id + '_' + i, label: o.label || '', score: typeof o.score === 'number' ? o.score : 0 };
    });
    return { id: grp.id, label: grp.label || grp.id, options: opts };
  });

  // 2. 注入每题
  (data.questions || []).forEach(function (q) {
    q.groups = groups;
    if (!q.type || q.type === 'single') {
      q.type = 'grouped';
    }
    // 保有 options 占位（validator 不会报错）
    if (!q.options && !q.groups.length) {
      q.options = [];
    }
  });

  // 3. 保留 _sharedGroups 顶层字段（预览用），options 已在上面转好
  data._sharedGroups = groups;

  return data;
}

/**
 * POST /api/generate-scale — 根据描述生成量表 JSON
 * body: { text: string, temperature?: number, systemPrompt?: string, model?: string }
 *   model 可选: 'deepseek-v4-flash'（默认）, 'deepseek-chat', 'deepseek-v4-pro'
 */
app.post('/api/generate-scale', async (req, res) => {
  try {
    const {
      text,
      temperature = 0.3,
      systemPrompt: customPrompt,
      model: requestedModel,
      maxTokens: requestedMaxTokens
    } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 5) {
      return res.status(400).json({ code: -1, message: '请提供量表描述（至少5个字）' });
    }

    console.log('[GenerateScale] 收到请求，长度:', text.length, 'model:', requestedModel || 'default');

    // 直接使用前端传入的完整 systemPrompt
    // 前端 default-prompts.js 中的 version 5.3 prompt 包含完整的 JSON 格式说明，必须保留以确保量表正确解析
    const systemPrompt =
      customPrompt && typeof customPrompt === 'string' && customPrompt.trim().length > 50
        ? customPrompt
        : '你是心理测量学专家，根据量表文档生成量表 JSON，直接输出代码块：```json{"name":"","code":"","questions":[{"id":1,"content":"","dimension":"","options":[{"label":"","score":0}]}]}```';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text.trim() }
    ];

    // temperature 限制在 0.1~1.5 之间
    const effectiveTemp = Math.max(0.1, Math.min(1.5, temperature));
    // maxTokens：优先使用前端传入的值，限制在 100~64000 之间，默认 16000
    const effectiveMaxTokens = Math.max(100, Math.min(64000, requestedMaxTokens || 16000));
    const result = await _callAi(messages, 'deepseek-chat', effectiveTemp, effectiveMaxTokens, 'deepseek');

    if (result.error) {
      console.warn('[GenerateScale] AI 调用失败:', result.message);
      return res.status(502).json({ code: -1, message: result.message });
    }

    let raw = result.data;

    // 检测 AI 输出是否被截断（finish_reason=length 表示输出 token 用完）
    if (result.finishReason === 'length') {
      const qCount = (raw.match(/"id"\s*:\s*\d+/g) || []).length;
      console.warn(
        '[GenerateScale] AI 输出被截断 (finish_reason=length)，已生成约 ' +
          qCount +
          ' 题，maxTokens=' +
          effectiveMaxTokens
      );
      return res.status(502).json({
        code: -1,
        message:
          'AI 输出被截断，仅生成了约 ' + qCount + ' 题（未完成全部题目）。请点击「重新生成」，或尝试降低 Temperature。'
      });
    }

    console.log('[GenerateScale] AI 原始响应长度:', raw.length);
    console.log('[GenerateScale] AI 响应后300字符:', JSON.stringify(raw.slice(-300)));

    // 提取 ```json ... ``` 代码块中的内容
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      raw = jsonMatch[1].trim();
    }

    // 去掉 markdown 多余前缀（两阶段：先找对象，找不到再找数组；避免第二步破坏第一步结果）
    const objMatch = raw.match(/^[\s\S]*?(\{[\s\S]*)$/);
    if (objMatch) {
      raw = objMatch[1]; // 找到 { 开头的内容，保留
    } else {
      raw = raw.replace(/^[\s\S]*?(\[[\s\S]*)$/, '$1'); // 只有没 { 时才找 [
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.warn('[GenerateScale] JSON 解析失败，尝试修复...');
      console.warn('[GenerateScale] 原始内容前500字符:', raw.substring(0, 500));
      console.warn('[GenerateScale] 原始内容后300字符:', raw.substring(Math.max(0, raw.length - 300)));
      // 尝试修复常见格式问题
      let fixed = raw.replace(/,(\s*[}\]])/g, '$1'); // 去除尾随逗号
      // 修复：去除行首空格/制表符（AI 可能在 ```json 后加了缩进）
      fixed = fixed.replace(/^[\t ]+/gm, '');
      // 修复：去除行尾的未闭合反引号
      fixed = fixed.replace(/`+$/, '');
      // 尝试修复数组中混入 key:value 的畸形格式（AI 常见错误）
      // 例如：["notice1","notice2","duration":8,...] → 提取为对象
      if (!fixed.startsWith('{')) {
        // 尝试将数组转为对象：提取字符串元素作为 notice，提取键值对作为元数据
        try {
          const arr = JSON.parse(fixed);
          if (Array.isArray(arr)) {
            parsed = _arrayToScaleObject(arr, text);
            if (parsed) {
              console.log('[GenerateScale] 数组修复为量表对象成功');
              return res.json({ code: 0, data: parsed });
            }
          }
        } catch {}
      }
      try {
        parsed = JSON.parse(fixed);
      } catch {
        // AI 输出完全无法解析：尝试截断修复（可能是 token 限制导致 JSON 被截断）
        console.warn('[GenerateScale] JSON 修复失败，尝试截断补全...');
        const truncated = _fixTruncatedJson(fixed);
        if (truncated) {
          try {
            parsed = JSON.parse(truncated);
            console.log('[GenerateScale] 截断补全成功！');
          } catch {
            console.warn('[GenerateScale] 截断补全也失败');
            // 返回原始错误
            console.warn('[GenerateScale] 无法解析 JSON，原始前500字符:', raw.substring(0, 500));
            console.warn('[GenerateScale] 原始后300字符:', raw.substring(Math.max(0, raw.length - 300)));
            return res.json({
              code: -1,
              message: 'AI 生成的内容不是有效的 JSON 格式，请重试或降低 Temperature 参数',
              rawPreview: raw.substring(0, 2000)
            });
          }
        } else {
          console.warn('[GenerateScale] 无法解析 JSON，原始前500字符:', raw.substring(0, 500));
          console.warn('[GenerateScale] 原始后300字符:', raw.substring(Math.max(0, raw.length - 300)));
          return res.json({
            code: -1,
            message: 'AI 生成的内容不是有效的 JSON 格式，请重试或降低 Temperature 参数',
            rawPreview: raw.substring(0, 2000)
          });
        }
      }
    }

    // 精简格式展开：_qs → questions（AI 输出压缩格式时自动转换）
    if (parsed && parsed._qs) {
      parsed = _expandCompactScale(parsed);
      console.log('[GenerateScale] 精简格式已展开，题目数:', parsed.questions?.length || 0);
    }

    // 共享分组展开：_sharedGroups → 每题 groups（LES 等共享评分维度）
    if (parsed && parsed._sharedGroups && parsed._sharedGroups.length > 0) {
      parsed = _expandSharedGroups(parsed);
      console.log('[GenerateScale] 共享分组已展开，组数:', parsed._sharedGroups?.length || 0);
    }

    // 结构验证：必须是对象（非数组），且包含 name/questions 字段
    if (Array.isArray(parsed)) {
      console.log('[GenerateScale] 解析结果是数组，尝试转换为量表对象');
      const converted = _arrayToScaleObject(parsed, text);
      if (converted) {
        console.log('[GenerateScale] 数组转换为量表对象成功，题目数:', converted.questions?.length || 0);
        return res.json({ code: 0, data: converted });
      }
      return res.json({
        code: -1,
        message: 'AI 生成的 JSON 是数组格式，无法转换为量表对象。请检查提示词或重试。',
        rawPreview: JSON.stringify(parsed).substring(0, 300)
      });
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.json({
        code: -1,
        message: 'AI 生成的内容不是 JSON 对象格式',
        rawPreview: String(parsed).substring(0, 300)
      });
    }

    console.log('[GenerateScale] 生成成功，题目数:', parsed.questions?.length || '?');
    return res.json({ code: 0, data: parsed });
  } catch (err) {
    console.error('[GenerateScale] 错误:', err);
    res.status(502).json({ code: -1, message: err.message || '生成失败' });
  }
});

// ====================================================
// 健康检查
// ====================================================

app.get('/', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const db = await getPool();
    await db.query('SELECT 1');
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'error: ' + e.message;
  }
  res.json({
    code: 0,
    message: '星蓝心镜 API',
    version: '1.0.0',
    db: dbStatus,
    uptime: process.uptime()
  });
});

// ====================================================
// 错误处理
// ====================================================

// ====================================================
// TTS 语音合成代理（Edge TTS，免费微软语音）
// ====================================================

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const fs = require('fs');
const os = require('os');

/**
 * 情感语气 Profile（通过 prosody 参数模拟）
 * Edge TTS 公共端点不支持 mstts:express-as SSML，
 * 但可通过 rate/pitch/volume 组合模拟情感效果
 */
const EMOTION_PROFILES = {
  neutral: { rate: '+0%', pitch: '+0Hz', volume: '+0%' }, // 中性（默认）
  empathetic: { rate: '-10%', pitch: '-2Hz', volume: '-5%' }, // 共情：慢、低沉、柔和
  gentle: { rate: '-8%', pitch: '+1Hz', volume: '-10%' }, // 温和：略慢、稍高、轻柔
  cheerful: { rate: '+10%', pitch: '+3Hz', volume: '+5%' }, // 开朗：快、明亮、响亮
  serious: { rate: '-15%', pitch: '-5Hz', volume: '+5%' }, // 严肃：很慢、深沉、坚定
  calm: { rate: '-5%', pitch: '+0Hz', volume: '-8%' } // 平静：略慢、正常音高、轻声
};

// ====================================================
// TTS 缓存配置（服务端合并 + URL 播放架构）
// ====================================================

const TTS_CACHE_DIR = process.env.TTS_CACHE_DIR || '/www/server/psy-api/tts_cache';
const BGM_DIR = process.env.BGM_DIR || '/www/server/psy-api/bgm';
const TTS_URL_BASE = process.env.TTS_URL_BASE || 'https://www.soarto.com.cn/api/tts/audio';
const TTS_CACHE_TTL_DAYS = parseInt(process.env.TTS_CACHE_TTL_DAYS) || 30; // 默认30天过期

// 确保缓存目录存在
(function ensureCacheDirs() {
  try {
    if (!fs.existsSync(TTS_CACHE_DIR)) {
      fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
      console.log('[TTS] 创建缓存目录:', TTS_CACHE_DIR);
    }
    if (!fs.existsSync(BGM_DIR)) {
      fs.mkdirSync(BGM_DIR, { recursive: true });
      console.log('[TTS] 创建BGM目录:', BGM_DIR);
    }
  } catch (e) {
    console.error('[TTS] 缓存目录创建失败:', e.message);
  }
})();

/**
 * Pre-warm 并发控制：最多2个并发合成任务
 */
let _prewarmCount = 0;
const MAX_PREWARM = 2;

/**
 * 计算 TTS 内容哈希（缓存键）
 * @param {string[]} segments - 文本段落数组
 * @param {string} emotion - 情感
 * @param {string} rate - 语速
 * @param {string} voice - 语音ID
 * @returns {string} MD5 hash
 */
function _ttsContentHash(segments, emotion, rate, voice) {
  const raw =
    (segments || []).join('|') +
    '||' +
    (emotion || 'neutral') +
    '||' +
    (rate || '+0%') +
    '||' +
    (voice || 'zh-CN-XiaoxiaoNeural');
  return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * 获取音频文件时长（秒）
 * @param {string} filePath
 * @returns {Promise<number>}
 */
async function _getAudioDuration(filePath) {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath],
      { timeout: 10000 }
    );
    return Math.round(parseFloat(stdout.trim()) || 0);
  } catch (e) {
    return 0;
  }
}

/**
 * 用 ffmpeg 合并多个 MP3 段落为一个文件
 * @param {Buffer[]} buffers - 各段 MP3 Buffer 数组
 * @param {number} silenceMs - 段间静音毫秒数
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<void>}
 */
async function _mergeSegmentsToMp3(buffers, silenceMs, outputPath) {
  const silenceSec = (silenceMs || 500) / 1000;

  // 写入各段和静音到临时文件（ffmpeg concat 需要文件列表）
  const listFile = outputPath + '.concat.txt';
  let listContent = '';

  for (let i = 0; i < buffers.length; i++) {
    const segFile = outputPath + '.seg_' + i + '.mp3';
    fs.writeFileSync(segFile, buffers[i]);
    listContent += "file '" + segFile + "'\n";
    // 非最后一段后加静音
    if (i < buffers.length - 1 && silenceSec > 0) {
      const silenceFile = outputPath + '.silence_' + i + '.mp3';
      // 用 ffmpeg 生成静音段
      await execFileAsync(
        'ffmpeg',
        ['-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(silenceSec), '-q:a', '9', '-y', silenceFile],
        { timeout: 10000 }
      );
      listContent += "file '" + silenceFile + "'\n";
    }
  }

  // 写入 concat 列表文件
  fs.writeFileSync(listFile, listContent);

  // ffmpeg concat 合并
  await execFileAsync('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-y', outputPath], {
    timeout: 60000
  });

  // 清理临时文件
  const cleanup = (f) => {
    try {
      fs.unlinkSync(f);
    } catch (e) {}
  };
  cleanup(listFile);
  for (let i = 0; i < buffers.length; i++) {
    cleanup(outputPath + '.seg_' + i + '.mp3');
    cleanup(outputPath + '.silence_' + i + '.mp3');
  }
}

/**
 * 混合 TTS 音频与背景音乐
 * @param {string} ttsPath - TTS 文件路径
 * @param {string} bgmName - BGM 文件名
 * @param {string} outputPath - 输出路径
 * @param {number} [bgmVolume] - BGM 音量（0-1，默认0.15）
 * @returns {Promise<void>}
 */
async function _mixWithBgm(ttsPath, bgmName, outputPath, bgmVolume) {
  const vol = bgmVolume !== undefined ? bgmVolume : 0.15;
  const bgmPath = path.join(BGM_DIR, bgmName);
  if (!fs.existsSync(bgmPath)) {
    throw new Error('BGM 文件不存在: ' + bgmPath);
  }
  await execFileAsync(
    'ffmpeg',
    [
      '-i',
      ttsPath,
      '-i',
      bgmPath,
      '-filter_complex',
      '[1:a]volume=' + vol + '[bg];[0:a][bg]amix=inputs=2:duration=longest',
      '-c:a',
      'libmp3lame',
      '-q:a',
      '4',
      '-y',
      outputPath
    ],
    { timeout: 60000 }
  );
}

/**
 * 核心 TTS 合成+缓存函数（供 /api/tts/merged 和 Pre-warm 共用）
 * @param {Object} params
 * @param {string[]} params.segments - 文本段落
 * @param {string} params.emotion - 情感
 * @param {string} params.rate - 语速
 * @param {string} params.voice - 语音ID
 * @param {string} params.scaleId - 量表ID
 * @param {number} params.silenceMs - 段间静音
 * @param {string} [params.bgmName] - BGM文件名
 * @returns {Promise<{url: string, bgmUrl: string|null, duration: number, cached: boolean}>}
 */
async function _synthesizeAndCache(params) {
  const { segments, emotion, rate, voice, scaleId, silenceMs, bgmName } = params;
  const effectiveVoice = voice || 'zh-CN-XiaoxiaoNeural';
  const effectiveEmotion = emotion || 'neutral';
  const effectiveRate = rate || '+0%';
  const effectiveGap = typeof silenceMs === 'number' && silenceMs >= 0 ? silenceMs : 500;
  const contentHash = _ttsContentHash(segments, effectiveEmotion, effectiveRate, effectiveVoice);

  // 1. 查 MySQL 缓存
  try {
    const db = await getPool();
    const [rows] = await db.query('SELECT * FROM tts_cache WHERE content_hash = ? LIMIT 1', [contentHash]);
    if (rows.length > 0) {
      const cached = rows[0];
      if (fs.existsSync(cached.file_path)) {
        // 更新播放计数
        await db.query('UPDATE tts_cache SET play_count = play_count + 1 WHERE id = ?', [cached.id]);
        const url = TTS_URL_BASE + '/' + contentHash + '.mp3';
        const bgmUrl = cached.has_bgm ? TTS_URL_BASE + '/' + contentHash + '_bgm.mp3' : null;
        return { url, bgmUrl, duration: cached.duration, cached: true };
      } else {
        // 文件丢失，删除过期记录
        await db.query('DELETE FROM tts_cache WHERE id = ?', [cached.id]);
      }
    }
  } catch (dbErr) {
    console.warn('[TTS] MySQL 缓存查询失败:', dbErr.message);
    // MySQL 不可用时继续合成（降级为无缓存模式）
  }

  // 2. Cache MISS：合成所有段落
  const prosody = _getEmotionProsody(effectiveEmotion, effectiveRate);
  const buffers = [];
  for (const segText of segments) {
    const text = (segText || '').trim().replace(/[\r\n]+/g, '。');
    if (!text) {
      continue;
    }
    const buf = await _synthesizeToBuffer(text, effectiveVoice, prosody.rate, {
      pitch: prosody.pitch,
      volume: prosody.volume
    });
    buffers.push(buf);
  }
  if (buffers.length === 0) {
    throw new Error('所有段落为空');
  }

  // 3. 合并为单文件
  const mergedPath = path.join(TTS_CACHE_DIR, contentHash + '.mp3');
  await _mergeSegmentsToMp3(buffers, effectiveGap, mergedPath);
  const duration = await _getAudioDuration(mergedPath);
  const fileSize = fs.statSync(mergedPath).size;

  // 4. 混合 BGM（如有）
  let bgmUrl = null;
  if (bgmName) {
    const bgmPath = path.join(TTS_CACHE_DIR, contentHash + '_bgm.mp3');
    try {
      await _mixWithBgm(mergedPath, bgmName, bgmPath);
      bgmUrl = TTS_URL_BASE + '/' + contentHash + '_bgm.mp3';
    } catch (bgmErr) {
      console.warn('[TTS] BGM混合失败（非致命）:', bgmErr.message);
    }
  }

  // 5. 写入 MySQL 缓存
  const expiresAt = new Date(Date.now() + TTS_CACHE_TTL_DAYS * 86400000);
  try {
    const db = await getPool();
    await db.query(
      `INSERT INTO tts_cache (content_hash, scale_id, emotion, rate, voice, has_bgm, bgm_name, duration, file_size, file_path, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         play_count = play_count + 1,
         expires_at = VALUES(expires_at)`,
      [
        contentHash,
        scaleId || '',
        effectiveEmotion,
        effectiveRate,
        effectiveVoice,
        bgmName ? 1 : 0,
        bgmName || '',
        duration,
        fileSize,
        mergedPath,
        expiresAt
      ]
    );
  } catch (dbErr) {
    console.warn('[TTS] MySQL 缓存写入失败:', dbErr.message);
  }

  const url = TTS_URL_BASE + '/' + contentHash + '.mp3';
  return { url, bgmUrl, duration, cached: false };
}

/**
 * 文本预处理（对齐小程序端 _convertReportToSpeechText）
 */
function _convertReportToSpeechText(mdText) {
  if (!mdText) {
    return '';
  }
  let text = mdText;
  text = text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
  text = text.replace(/[\u2600-\u27BF\u2B50\u2934-\u2BFF\uFE00-\uFEFF\u200D]/g, '');
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
  text = text.replace(/_+/g, '');
  text = text.replace(/\*+/g, '');
  text = text.replace(/#+/g, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/**
 * 文本分段（对齐小程序端 _splitTextToSegments）
 */
function _splitTextToSegments(text) {
  if (!text) {
    return [];
  }
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  const segments = [];
  let buffer = '';
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) {
      continue;
    }
    if ((buffer + '\n\n' + trimmed).length > 300 && buffer) {
      segments.push(buffer.trim());
      buffer = trimmed;
    } else {
      buffer = buffer ? buffer + '\n\n' + trimmed : trimmed;
    }
  }
  if (buffer.trim()) {
    segments.push(buffer.trim());
  }
  return segments;
}

/**
 * 自动检测报告情感（对齐小程序端 _autoDetectEmotion）
 */
function _autoDetectEmotion(text) {
  if (!text) {
    return 'empathetic';
  }
  const lower = text.toLowerCase();
  if (/风险|警告|危险|严重|自杀|自伤|抑郁倾向|焦虑障碍|需要.*专业/.test(lower)) {
    return 'serious';
  }
  if (/鼓励|建议|积极|正常|良好|不错|加油/.test(lower)) {
    return 'gentle';
  }
  if (/开心|快乐|满意|感谢/.test(lower)) {
    return 'cheerful';
  }
  return 'empathetic';
}

/**
 * Pre-warm TTS 缓存（在 AI 诊断完成后异步触发）
 */
function _prewarmTtsCache(diagText, scaleId) {
  if (_prewarmCount >= MAX_PREWARM) {
    console.log('[TTS] Pre-warm 队列已满，跳过');
    return;
  }
  _prewarmCount++;
  setImmediate(async () => {
    try {
      const speechText = _convertReportToSpeechText(diagText);
      const segments = _splitTextToSegments(speechText);
      if (segments.length === 0) {
        return;
      }
      const emotion = _autoDetectEmotion(diagText);
      await _synthesizeAndCache({
        segments,
        emotion,
        rate: '+0%',
        voice: 'zh-CN-XiaoxiaoNeural',
        scaleId: scaleId || '',
        silenceMs: 500
      });
      console.log('[TTS] Pre-warm 完成，scaleId=' + scaleId + '，共' + segments.length + '段');
    } catch (err) {
      console.warn('[TTS] Pre-warm 失败（非致命）:', err.message);
    } finally {
      _prewarmCount--;
    }
  });
}

/**
 * 根据情感 profile 获取 prosody 参数
 * @param {string} emotion - 情感名称（neutral/empathetic/gentle/cheerful/serious/calm）
 * @param {string} baseRate - 基础语速（如 "+20%"）
 * @returns {{ rate: string, pitch: string, volume: string }}
 */
function _getEmotionProsody(emotion, baseRate) {
  const profile = EMOTION_PROFILES[emotion] || EMOTION_PROFILES.neutral;
  // 合成基础语速 + 情感偏移
  let rate = profile.rate;
  if (baseRate && baseRate !== '+0%') {
    const baseNum = parseInt(baseRate) || 0;
    const emotionNum = parseInt(profile.rate) || 0;
    const combined = baseNum + emotionNum;
    rate = (combined >= 0 ? '+' : '') + combined + '%';
  }
  return { rate, pitch: profile.pitch, volume: profile.volume };
}

/**
 * 核心函数：文本 → MP3 Buffer
 * 使用 Python edge-tts 子进程（免费、稳定、高质量）
 * @param {string} text - 要合成的文本
 * @param {string} [voice] - 语音ID
 * @param {string} [rate] - 语速（如 "+20%"）
 * @param {object} [options] - 可选参数
 * @param {string} [options.pitch] - 音高（如 "+2Hz"）
 * @param {string} [options.volume] - 音量（如 "+5%"）
 */
async function _synthesizeToBuffer(text, voice, rate, options) {
  const opts = options || {};
  const tmpFile = path.join(os.tmpdir(), 'tts_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.mp3');
  try {
    const args = [
      '-m',
      'edge_tts',
      '--voice',
      voice || 'zh-CN-XiaoxiaoNeural',
      '--text',
      text,
      '--write-media',
      tmpFile
    ];
    if (rate && rate !== '+0%') {
      args.push('--rate=' + rate);
    }
    if (opts.pitch && opts.pitch !== '+0Hz') {
      args.push('--pitch=' + opts.pitch);
    }
    if (opts.volume && opts.volume !== '+0%') {
      args.push('--volume=' + opts.volume);
    }
    const { stdout, stderr } = await execFileAsync('python3', args, {
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    if (!fs.existsSync(tmpFile)) {
      throw new Error('TTS 输出文件未生成');
    }
    const buffer = fs.readFileSync(tmpFile);
    return buffer;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch (e) {}
  }
}

/**
 * 生成静音 MP3 Buffer（用于段落间停顿）
 * @param {number} durationMs - 静音时长（毫秒）
 * @returns {Buffer}
 */
function _generateSilenceMp3(durationMs) {
  // 最小有效 MP3 帧（约 26ms @ 128kbps）
  // 包含 MP3 头 (ID3) + 有效帧
  const silenceFrame = Buffer.from(
    'fff34c0400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    'hex'
  );
  const framesNeeded = Math.ceil(durationMs / 26);
  const buffers = [];
  // MP3 同步头 + 侧信息
  for (let i = 0; i < framesNeeded; i++) {
    buffers.push(silenceFrame);
  }
  return Buffer.concat(buffers);
}

/**
 * POST /api/tts
 * 单段文本转 MP3 音频流
 * Body: { text: string, voice?: string, rate?: string, emotion?: string, pitch?: string, volume?: string }
 * Response: audio/mpeg
 */
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice, rate, emotion, pitch, volume } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ code: -1, message: '文本不能为空' });
    }
    if (text.length > 5000) {
      return res.status(400).json({ code: -1, message: '文本过长（最多 5000 字）' });
    }

    let prosody = {};
    if (emotion && EMOTION_PROFILES[emotion]) {
      prosody = _getEmotionProsody(emotion, rate);
    } else {
      prosody = { rate: rate || '+0%', pitch: pitch || '+0Hz', volume: volume || '+0%' };
    }

    const audioBuffer = await _synthesizeToBuffer(text.trim(), voice, prosody.rate, {
      pitch: prosody.pitch,
      volume: prosody.volume
    });
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=86400'
    });
    res.send(audioBuffer);
    console.log(
      '[TTS] 单段合成完成 (' +
        text.trim().length +
        '字, ' +
        (audioBuffer.length / 1024).toFixed(0) +
        'KB, emotion=' +
        (emotion || 'neutral') +
        ')'
    );
  } catch (err) {
    console.error('[TTS] 错误:', err.message);
    res.status(500).json({ code: -1, message: '语音合成失败: ' + err.message });
  }
});

/**
 * GET /api/tts/file
 * 小程序专用：文本转 MP3 文件下载
 * Query: text, voice?, rate?, emotion?, pitch?, volume?
 * Response: audio/mpeg 文件流
 */
app.get('/api/tts/file', async (req, res) => {
  try {
    const { text, voice, rate, emotion, pitch, volume } = req.query;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ code: -1, message: '文本不能为空' });
    }
    if (text.length > 5000) {
      return res.status(400).json({ code: -1, message: '文本过长（最多 5000 字）' });
    }

    let prosody = {};
    if (emotion && EMOTION_PROFILES[emotion]) {
      prosody = _getEmotionProsody(emotion, rate);
    } else {
      prosody = { rate: rate || '+0%', pitch: pitch || '+0Hz', volume: volume || '+0%' };
    }

    const audioBuffer = await _synthesizeToBuffer(decodeURIComponent(text).trim(), voice, prosody.rate, {
      pitch: prosody.pitch,
      volume: prosody.volume
    });
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=86400',
      'Content-Disposition': 'inline; filename="tts_' + Date.now() + '.mp3"'
    });
    res.send(audioBuffer);
    console.log(
      '[TTS] 文件下载合成完成 (' + text.trim().length + '字, ' + (audioBuffer.length / 1024).toFixed(0) + 'KB)'
    );
  } catch (err) {
    console.error('[TTS] 文件下载错误:', err.message);
    res.status(500).json({ code: -1, message: '语音合成失败: ' + err.message });
  }
});

/**
 * POST /api/tts/segments
 * 批量分段合成，返回 base64 数组（前端拼接播放）
 * Body: { segments: string[], voice?: string, rate?: string, emotion?: string, silenceMs?: number }
 *   - emotion: 情感语气（neutral/empathetic/gentle/cheerful/serious/calm）
 *   - silenceMs: 段落间静音时长（毫秒，默认500）
 * Response: { code: 0, data: { audios: string[] } }
 */
app.post('/api/tts/segments', async (req, res) => {
  try {
    const { segments, voice, rate, emotion, silenceMs } = req.body;
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ code: -1, message: '需要 segments 数组' });
    }
    if (segments.length > 20) {
      return res.status(400).json({ code: -1, message: '最多支持 20 个段落' });
    }

    const gap = typeof silenceMs === 'number' && silenceMs >= 0 ? silenceMs : 500;
    const prosody = _getEmotionProsody(emotion || 'neutral', rate);

    console.log(
      '[TTS] 批量合成 ' + segments.length + ' 个段落, emotion=' + (emotion || 'neutral') + ', silence=' + gap + 'ms...'
    );
    const audios = [];
    for (let i = 0; i < segments.length; i++) {
      let segText = (segments[i] || '').trim();
      if (segText.length === 0) {
        audios.push('');
        continue;
      }
      // 将换行替换为句号，避免 edge-tts 命令行参数问题
      segText = segText.replace(/[\r\n]+/g, '。');
      try {
        const audioBuffer = await _synthesizeToBuffer(segText, voice, prosody.rate, {
          pitch: prosody.pitch,
          volume: prosody.volume
        });
        let resultBase64 = audioBuffer.toString('base64');
        // 段落间插入静音（非最后一段）
        if (gap > 0 && i < segments.length - 1) {
          const silenceBuffer = _generateSilenceMp3(gap);
          resultBase64 += silenceBuffer.toString('base64');
        }
        audios.push(resultBase64);
        console.log(
          '[TTS]   段 ' +
            (i + 1) +
            '/' +
            segments.length +
            ' (' +
            segText.length +
            '字, ' +
            (audioBuffer.length / 1024).toFixed(0) +
            'KB)'
        );
      } catch (segErr) {
        console.error('[TTS]   段 ' + (i + 1) + ' 合成失败，跳过:', segErr.message.slice(0, 100));
        audios.push(''); // 跳过失败段落，继续合成后续段落
      }
    }
    console.log('[TTS] 批量合成完成');

    res.json({ code: 0, data: { audios } });
  } catch (err) {
    console.error('[TTS] 批量错误:', err.message);
    res.status(500).json({ code: -1, message: '语音合成失败: ' + err.message });
  }
});

/**
 * POST /api/tts/merged
 * 服务端合并音频 + MySQL 缓存 + URL 返回
 *
 * Body: {
 *   segments: string[]   - 文本段落（每段≤500字）
 *   emotion?: string     - 情感语气（neutral/empathetic/gentle/cheerful/serious/calm）
 *   rate?: string        - 语速（如 "+0%"）
 *   voice?: string       - 语音ID
 *   scaleId?: string     - 量表ID（用于缓存分组）
 *   silenceMs?: number    - 段间静音毫秒（默认500）
 *   bgmName?: string     - BGM文件名（可选）
 * }
 *
 * Response: { code: 0, data: { url, bgmUrl?, duration, cached } }
 *
 * 流程：
 *   1. contentHash = MD5(segments + emotion + rate + voice)
 *   2. 查询 MySQL tts_cache — 命中则返回 URL
 *   3. Cache MISS → 合成所有段 → ffmpeg 合并 → 存文件 → 写 MySQL → 返回 URL
 */
app.post('/api/tts/merged', async (req, res) => {
  try {
    const { segments, emotion, rate, voice, scaleId, silenceMs, bgmName } = req.body;
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ code: -1, message: '需要 segments 数组' });
    }
    if (segments.length > 20) {
      return res.status(400).json({ code: -1, message: '最多支持 20 个段落' });
    }

    console.log(
      '[TTS] /merged 请求: ' +
        segments.length +
        '段, emotion=' +
        (emotion || 'neutral') +
        ', cached=' +
        (bgmName ? 'no(BGM)' : 'auto')
    );

    const result = await _synthesizeAndCache({
      segments,
      emotion,
      rate,
      voice,
      scaleId: scaleId || '',
      silenceMs: silenceMs !== undefined ? silenceMs : 500,
      bgmName
    });

    console.log('[TTS] /merged 完成: cached=' + result.cached + ', duration=' + result.duration + 's');
    res.json({ code: 0, data: result });
  } catch (err) {
    console.error('[TTS] /merged 错误:', err.message);
    res.status(500).json({ code: -1, message: '合成失败: ' + err.message });
  }
});

/**
 * GET /api/tts/audio/:hash.mp3
 * 流式播放 TTS 缓存音频（过渡方案，后续由 Nginx location /tts_cache/ 替代）
 *
 * 访问：GET https://www.soarto.com.cn/api/tts/audio/<hash>.mp3
 *
 * URL 格式：TTS_URL_BASE/<contentHash>.mp3
 * BGM 版本：TTS_URL_BASE/<contentHash>_bgm.mp3
 */
app.get('/api/tts/audio/:hash.mp3', async (req, res) => {
  try {
    // 校验 hash 格式（32位MD5）
    const hash = (req.params.hash || '').replace(/[^a-f0-9]/gi, '');
    if (hash.length !== 32) {
      return res.status(400).json({ code: -1, message: '无效的音频标识' });
    }

    const filePath = path.join(TTS_CACHE_DIR, hash + '.mp3');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ code: -1, message: '音频文件不存在' });
    }

    const stat = fs.statSync(filePath);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': stat.size,
      'Content-Disposition': 'inline; filename="tts_' + hash + '.mp3"',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('[TTS] 流传输错误:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ code: -1, message: '流传输失败' });
      }
    });
    stream.pipe(res);
  } catch (err) {
    console.error('[TTS] /audio 错误:', err.message);
    res.status(500).json({ code: -1, message: err.message });
  }
});

/**
 * GET /api/tts/bgm-list
 * 列出可用的背景音乐文件
 *
 * Response: { code: 0, data: [{ name: string, label: string }] }
 */
app.get('/api/tts/bgm-list', (req, res) => {
  try {
    if (!fs.existsSync(BGM_DIR)) {
      return res.json({ code: 0, data: [] });
    }
    const files = fs
      .readdirSync(BGM_DIR)
      .filter((f) => f.endsWith('.mp3') || f.endsWith('.wav'))
      .map((f) => ({
        name: f,
        label: f.replace(/\.(mp3|wav)$/, '').replace(/[-_]/g, ' ')
      }));
    res.json({ code: 0, data: files });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

/**
 * GET /api/tts/voices
 * 获取可用的中文语音列表
 */
app.get('/api/tts/voices', async (req, res) => {
  const voices = [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', desc: '温暖女声，适合心理咨询场景（推荐）' },
    { id: 'zh-CN-YunxiNeural', name: '云希', desc: '阳光男声，清新自然' },
    { id: 'zh-CN-YunjianNeural', name: '云健', desc: '沉稳男声，新闻播报风格' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓依', desc: '活泼女声，年轻活力' },
    { id: 'zh-CN-YunyangNeural', name: '云扬', desc: '专业男声，适合正式报告' },
    { id: 'zh-CN-XiaomengNeural', name: '晓梦', desc: '温柔女声，轻柔舒缓' },
    { id: 'zh-CN-XiaozhenNeural', name: '晓甄', desc: '知性女声，沉稳大方' }
  ];
  res.json({ code: 0, data: voices });
});

app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({ code: -1, message: '服务器内部错误' });
});

// ====================================================
// 启动
// ====================================================

// 启动 HTTP 服务，并设置超时（生成量表可能需要 2-3 分钟）
function startServer() {
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log('  地址: http://127.0.0.1:' + PORT);
  });
  server.setTimeout(300000); // 5 分钟，支持长文本生成
  return server;
}

// 本地 TTS 测试模式：跳过数据库
if (process.env.SKIP_DB) {
  console.log('[Local] SKIP_DB 模式，跳过数据库连接');
  startServer();
  console.log('星蓝心镜 API 已启动（本地模式）');
  console.log('  地址: http://127.0.0.1:' + PORT);
  console.log('  ⚠️ 数据库未连接，仅 TTS 接口可用');
} else {
  getPool()
    .then(() => {
      startServer();
      console.log('星蓝心镜 API 已启动');
      console.log('  地址: http://127.0.0.1:' + PORT);
      console.log('  数据库: ' + (process.env.DB_NAME || 'psy_assessment'));
    })
    .catch((err) => {
      console.error('数据库连接失败:', err);
      process.exit(1);
    });
}
