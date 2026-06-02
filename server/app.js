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

require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
const corsOrigins = (
  process.env.CORS_ORIGINS ||
  'https://www.soarto.com.cn,https://soarto.com.cn,http://localhost:8080,http://localhost:8081'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigins,
    credentials: true
  })
);

// ====================================================
// MySQL 连接池
// ====================================================

let pool;
async function getPool() {
  if (!pool) {
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
    // 测试连接
    const conn = await pool.getConnection();
    console.log('[DB] MySQL 连接成功:', process.env.DB_NAME);
    conn.release();
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
      `INSERT INTO assessments (record_id, openid, scale_id, scale_name, total_score, max_score, level, level_name, color, answers, dimensions, ai_diagnosis, source, duration, category_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      `SELECT id, record_id, openid, scale_id, scale_name, total_score, max_score, level, level_name, color, dimensions, ai_diagnosis, source, duration, category_name, created_at
       FROM assessments ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM assessments ${where}`, params);

    // 解析 JSON 字段，对齐前端 record 对象结构
    const records = list.map((r) => ({
      id: r.record_id,
      scaleId: r.scale_id,
      scaleName: r.scale_name,
      emoji: '',
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
 * .env 中 DASHSCOPE_API_KEY 支持逗号分隔多个 Key，遇到 401/429 自动切换
 * 也可通过 POST /api/ai-config 动态更新
 */
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
  deepseek: 'deepseek-chat'
};

/** 通用的 OpenAI 兼容格式 AI 调用（带 Key 轮询） */
async function _callAi(messages, model, temperature, maxTokens, provider) {
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
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature })
      });
      const data = await response.json();

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
      if (!result) {
        return { error: true, message: 'AI 返回为空' };
      }

      return { error: false, data: result };
    } catch (err) {
      console.warn('[AI][' + provider + '] 请求异常:', err.message);
      lastError = err;
    }
  }

  // 所有 Key 都失败
  throw lastError || new Error('所有 API Key 均不可用');
}

/** 兼容旧代码的 _callDashScope 别名 */
function _callDashScope(messages, model, temperature, maxTokens) {
  return _callAi(messages, model, temperature, maxTokens, 'dashscope');
}

app.post('/api/ai-diagnose', async (req, res) => {
  try {
    const { messages, provider, model, temperature, maxTokens, apiKey } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ code: -1, message: '参数错误：需要 messages 数组' });
    }

    const effectiveProvider = provider || 'dashscope';
    const baseUrl = _PROVIDER_BASE_URL[effectiveProvider];
    if (!baseUrl) {
      return res.status(400).json({ code: -1, message: '不支持的 AI 服务商: ' + effectiveProvider });
    }
    const effectiveModel = model || _PROVIDER_DEFAULT_MODEL[effectiveProvider] || 'qwen-plus';
    const effectiveTemp = Math.max(0, Math.min(2, temperature !== undefined ? temperature : 0.7));
    const effectiveMaxTokens = Math.max(100, Math.min(8000, maxTokens || 2000));

    // 如果请求体带了单个 apiKey（前端直连场景），直接用，不走轮询
    if (apiKey) {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: effectiveModel,
          messages,
          max_tokens: effectiveMaxTokens,
          temperature: effectiveTemp
        })
      });
      const data = await response.json();
      if (data.error) {
        return res.status(502).json({ code: -1, message: data.error.message || 'AI 调用失败' });
      }
      const result = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
      if (!result) {
        return res.status(502).json({ code: -1, message: 'AI 返回为空' });
      }
      return res.json({ code: 0, data: result });
    }

    // 服务端多 Key 轮询
    const result = await _callAi(messages, effectiveModel, effectiveTemp, effectiveMaxTokens, effectiveProvider);
    if (result.error) {
      return res.status(502).json({ code: -1, message: result.message });
    }
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

    res.json({ code: 0, data: { count: _apiKeys[provider].length } });
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
app.get('/api/scales-json', (req, res) => {
  try {
    if (!fs.existsSync(SCALES_JSON_PATH)) {
      return res.json({ code: 0, data: [], message: '暂无量表数据' });
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
 * 核心函数：文本 → MP3 Buffer
 * 使用 Python edge-tts 子进程（免费、稳定、高质量）
 */
async function _synthesizeToBuffer(text, voice, rate) {
  const tmpFile = path.join(os.tmpdir(), 'tts_' + Date.now() + '.mp3');
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
      args.push('--rate', rate);
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
 * POST /api/tts
 * 单段文本转 MP3 音频流
 * Body: { text: string, voice?: string, rate?: string }
 * Response: audio/mpeg
 */
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice, rate } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ code: -1, message: '文本不能为空' });
    }
    if (text.length > 5000) {
      return res.status(400).json({ code: -1, message: '文本过长（最多 5000 字）' });
    }

    const audioBuffer = await _synthesizeToBuffer(text.trim(), voice, rate);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=86400'
    });
    res.send(audioBuffer);
    console.log('[TTS] 单段合成完成 (' + text.trim().length + '字, ' + (audioBuffer.length / 1024).toFixed(0) + 'KB)');
  } catch (err) {
    console.error('[TTS] 错误:', err.message);
    res.status(500).json({ code: -1, message: '语音合成失败: ' + err.message });
  }
});

/**
 * POST /api/tts/segments
 * 批量分段合成，返回 base64 数组（前端拼接播放）
 * Body: { segments: string[], voice?: string, rate?: string }
 * Response: { code: 0, data: { audios: string[] } }
 */
app.post('/api/tts/segments', async (req, res) => {
  try {
    const { segments, voice, rate } = req.body;
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ code: -1, message: '需要 segments 数组' });
    }
    if (segments.length > 20) {
      return res.status(400).json({ code: -1, message: '最多支持 20 个段落' });
    }

    console.log('[TTS] 批量合成 ' + segments.length + ' 个段落...');
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
        const audioBuffer = await _synthesizeToBuffer(segText, voice, rate);
        audios.push(audioBuffer.toString('base64'));
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

// 本地 TTS 测试模式：跳过数据库
if (process.env.SKIP_DB) {
  console.log('[Local] SKIP_DB 模式，跳过数据库连接');
  app.listen(PORT, '127.0.0.1', () => {
    console.log('星蓝心镜 API 已启动（本地模式）');
    console.log('  地址: http://127.0.0.1:' + PORT);
    console.log('  ⚠️ 数据库未连接，仅 TTS 接口可用');
  });
} else {
  getPool()
    .then(() => {
      app.listen(PORT, '127.0.0.1', () => {
        console.log('星蓝心镜 API 已启动');
        console.log('  地址: http://127.0.0.1:' + PORT);
        console.log('  数据库: ' + (process.env.DB_NAME || 'psy_assessment'));
      });
    })
    .catch((err) => {
      console.error('数据库连接失败:', err);
      process.exit(1);
    });
}
