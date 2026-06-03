/**
 * 安全中间件 - 权限控制、CSRF保护
 * 版本: 1.0.0
 * 创建时间: 2026-06-03
 */

const crypto = require('crypto');
const SECURITY_CONFIG = {
  // CSRF Token 配置
  CSRF_TOKEN_LENGTH: 32,
  CSRF_TOKEN_EXPIRY: 60 * 60 * 1000, // 1小时

  // 角色权限定义
  ROLES: {
    super: ['*'], // 超级管理员拥有所有权限
    admin: [
      'scales:read',
      'scales:write',
      'users:read',
      'users:write',
      'records:read',
      'records:export',
      'ai:read',
      'ai:write',
      'npc:read',
      'npc:write',
      'feedback:read',
      'feedback:export'
    ],
    viewer: ['scales:read', 'users:read', 'records:read', 'ai:read', 'npc:read', 'feedback:read']
  }
};

/**
 * 生成CSRF Token
 */
function generateCsrfToken() {
  return crypto.randomBytes(SECURITY_CONFIG.CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * 验证CSRF Token
 */
function validateCsrfToken(req) {
  // 从请求头或body中获取CSRF Token
  const token = req.headers['x-csrf-token'] || (req.body && req.body._csrf);

  if (!token) {
    return { valid: false, message: '缺少CSRF Token' };
  }

  // 从session或Redis中获取存储的token（这里简化为从内存中获取）
  // 实际生产环境应该使用redis或session存储
  const storedToken = req.app.locals.csrfTokens ? req.app.locals.csrfTokens.get(token) : null;

  if (!storedToken) {
    return { valid: false, message: 'CSRF Token无效或已过期' };
  }

  // 检查是否过期
  if (Date.now() > storedToken.expiry) {
    req.app.locals.csrfTokens.delete(token);
    return { valid: false, message: 'CSRF Token已过期' };
  }

  return { valid: true, message: 'CSRF Token有效' };
}

/**
 * CSRF 保护中间件
 */
function csrfProtection(req, res, next) {
  // 仅对状态修改操作进行CSRF检查
  const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  if (!unsafeMethods.includes(req.method)) {
    return next();
  }

  // 排除登录接口
  const excludePaths = ['/api/auth/login', '/api/mp-login', '/api/auth/callback'];
  if (excludePaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  const validation = validateCsrfToken(req);

  if (!validation.valid) {
    return res.status(403).json({
      code: -10,
      message: 'CSRF验证失败: ' + validation.message
    });
  }

  next();
}

/**
 * 角色验证中间件工厂
 * @param {string|Array} requiredPermissions - 需要的权限
 * @returns {Function} Express中间件
 */
function requireRole(requiredPermissions) {
  return function (req, res, next) {
    // 先通过authMiddleware验证token
    if (!req.user) {
      return res.status(401).json({ code: -3, message: '未登录或登录已过期' });
    }

    const userRole = req.user.role || 'viewer';
    const userPermissions = SECURITY_CONFIG.ROLES[userRole] || [];

    // 超级管理员拥有所有权限
    if (userPermissions.includes('*')) {
      return next();
    }

    // 检查所需权限
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

    const hasPermission = permissions.some((permission) => userPermissions.includes(permission));

    if (!hasPermission) {
      return res.status(403).json({
        code: -11,
        message: '权限不足，无法执行此操作'
      });
    }

    next();
  };
}

/**
 * 增强的认证中间件（包含角色验证）
 */
function enhancedAuthMiddleware(requiredPermissions) {
  return [
    // 基础认证
    function (req, res, next) {
      const token = (req.headers['authorization'] || '').replace('Bearer ', '');

      // 验证token逻辑（简化版，实际应从psy-api.js中导入）
      if (!token) {
        return res.status(401).json({ code: -3, message: '未登录或登录已过期' });
      }

      try {
        const [encoded, sig] = token.split('.');
        const TOKEN_SECRET = process.env.TOKEN_SECRET || 'psy-default-secret';
        const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('hex').substring(0, 16);

        if (sig !== expectedSig) {
          return res.status(401).json({ code: -3, message: 'Token无效' });
        }

        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());

        if (payload.exp < Date.now()) {
          return res.status(401).json({ code: -3, message: '登录已过期' });
        }

        req.user = payload;
        next();
      } catch (e) {
        return res.status(401).json({ code: -3, message: 'Token解析失败' });
      }
    },

    // 角色验证（如果指定了所需权限）
    ...(requiredPermissions ? [requireRole(requiredPermissions)] : [])
  ];
}

/**
 * 初始化CSRF Token存储
 */
function initCsrfTokenStorage(app) {
  app.locals.csrfTokens = new Map();

  // 定期清理过期的Token
  setInterval(
    () => {
      const now = Date.now();
      for (const [token, data] of app.locals.csrfTokens) {
        if (now > data.expiry) {
          app.locals.csrfTokens.delete(token);
        }
      }
    },
    10 * 60 * 1000
  ); // 每10分钟清理一次
}

/**
 * 提供CSRF Token给前端
 */
function csrfTokenEndpoint(req, res) {
  const token = generateCsrfToken();
  const expiry = Date.now() + SECURITY_CONFIG.CSRF_TOKEN_EXPIRY;

  if (!req.app.locals.csrfTokens) {
    req.app.locals.csrfTokens = new Map();
  }

  req.app.locals.csrfTokens.set(token, {
    expiry: expiry,
    createdAt: Date.now()
  });

  res.json({
    code: 0,
    data: {
      csrfToken: token,
      expiry: expiry
    }
  });
}

module.exports = {
  generateCsrfToken,
  validateCsrfToken,
  csrfProtection,
  requireRole,
  enhancedAuthMiddleware,
  initCsrfTokenStorage,
  csrfTokenEndpoint,
  SECURITY_CONFIG
};
