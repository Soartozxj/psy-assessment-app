#!/usr/bin/env node
/**
 * API 接口自动化测试
 *
 * 用法：node tests/api-test.cjs [--local] [--remote]
 *   --local   测试本地 localhost:8080（默认）
 *   --remote  测试线上 www.soarto.com.cn
 *
 * 覆盖：
 *   1. 前端静态资源加载（HTML/JS/CSS）
 *   2. 后端 API 健康检查
 *   3. API 接口功能测试（需要服务器运行）
 *   4. HTTPS 证书检查
 *   5. 域名可达性
 */

const https = require('https');
const http = require('http');
const assert = require('assert');

let passed = 0,
  failed = 0;
const results = [];
const IS_CI = process.env.CI === 'true';
const args = process.argv.slice(2);
const MODE = args.includes('--remote') ? 'remote' : 'local';

const CONFIG = {
  local: {
    base: 'http://localhost:8080',
    apiBase: 'http://localhost:3100',
    label: '本地'
  },
  remote: {
    base: 'https://www.soarto.com.cn',
    apiBase: 'https://www.soarto.com.cn',
    label: '线上'
  }
};

const cfg = CONFIG[MODE];

function log(msg) {
  console.log(msg);
}

function test(name, fn) {
  return fn()
    .then(() => {
      passed++;
      results.push(`  ✅ ${name}`);
    })
    .catch((e) => {
      failed++;
      results.push(`  ❌ ${name}: ${e.message}`);
    });
}

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(
      url,
      { method: options.method || 'GET', timeout: 8000, headers: options.headers || {} },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

(async () => {
  log(`\nAPI 测试环境：${cfg.label} (${cfg.base})\n`);

  // ===== 1. 静态资源 =====
  console.log('=== 1. 静态资源加载 ===\n');

  await test('首页 HTML 200', async () => {
    const { status } = await fetch(cfg.base + '/mini-app-h5/frontend/index.html');
    assert.strictEqual(status, 200, `HTTP ${status}`);
  });

  await test('后台 HTML 200', async () => {
    const { status } = await fetch(cfg.base + '/mini-app-h5/backend/admin-legacy.html');
    assert.strictEqual(status, 200);
  });

  await test('shared-data.js 200', async () => {
    const { status } = await fetch(cfg.base + '/mini-app-h5/shared-data.js');
    assert.strictEqual(status, 200);
  });

  await test('scoring-engine.js 200', async () => {
    const { status } = await fetch(cfg.base + '/mini-app-h5/scoring-engine.js');
    assert.strictEqual(status, 200);
  });

  await test('cloud-data.js 200', async () => {
    const { status } = await fetch(cfg.base + '/mini-app-h5/cloud-data.js');
    assert.strictEqual(status, 200);
  });

  await test('cloud-api.js 200', async () => {
    const { status } = await fetch(cfg.base + '/mini-app-h5/cloud-api.js');
    assert.strictEqual(status, 200);
  });

  await test('HTML Content-Type', async () => {
    const { headers } = await fetch(cfg.base + '/mini-app-h5/frontend/index.html');
    assert.ok(headers['content-type'].includes('text/html'), `Content-Type: ${headers['content-type']}`);
  });

  await test('JS Content-Type', async () => {
    const { headers } = await fetch(cfg.base + '/mini-app-h5/shared-data.js');
    assert.ok(headers['content-type'].includes('javascript'), `Content-Type: ${headers['content-type']}`);
  });

  await test('首页 HTML 包含 ScoringEngine 引用', async () => {
    const { body } = await fetch(cfg.base + '/mini-app-h5/frontend/index.html');
    assert.ok(body.includes('scoring-engine.js'), '首页应引用 scoring-engine.js');
  });

  await test('首页 HTML 包含 shared-data.js 引用', async () => {
    const { body } = await fetch(cfg.base + '/mini-app-h5/frontend/index.html');
    assert.ok(body.includes('shared-data.js'), '首页应引用 shared-data.js');
  });

  await test('首页包含 _pageLevels 定义', async () => {
    const { body } = await fetch(cfg.base + '/mini-app-h5/frontend/index.html');
    assert.ok(body.includes('_pageLevels'), '首页应包含 _pageLevels');
  });

  await test('首页包含 _levelTargets 定义', async () => {
    const { body } = await fetch(cfg.base + '/mini-app-h5/frontend/index.html');
    assert.ok(body.includes('_levelTargets'), '首页应包含 _levelTargets');
  });

  // ===== 2. HTTPS / 域名 =====
  console.log('\n=== 2. HTTPS 与域名 ===\n');

  if (MODE === 'remote') {
    await test('SSL 证书有效（HTTPS 200）', async () => {
      const { status } = await fetch('https://www.soarto.com.cn/mini-app-h5/frontend/index.html');
      assert.strictEqual(status, 200);
    });

    await test('rich.soarto.com.cn 可达', async () => {
      const { status } = await fetch('https://rich.soarto.com.cn/index.html');
      assert.ok(status < 400, `rich.soarto.com.cn 返回 ${status}`);
    });
  } else {
    log('  ⏭️  跳过 HTTPS 测试（本地模式）');
    log('  ⏭️  跳过域名可达性测试（本地模式）');
  }

  // ===== 3. 后端 API（仅远程模式） =====
  console.log('\n=== 3. 后端 API 接口 ===\n');

  if (MODE === 'remote') {
    await test('GET / 健康检查', async () => {
      const { status, body } = await fetch(cfg.apiBase + '/api/');
      assert.ok(status === 200 || status === 404, `API 根路径返回 ${status}`);
    });

    await test('GET /api/scales 量表列表', async () => {
      const { status, body } = await fetch(cfg.apiBase + '/api/scales');
      assert.strictEqual(status, 200);
      const data = JSON.parse(body);
      assert.ok(Array.isArray(data), '应返回数组');
    });

    await test('GET /api/scales/:id 单个量表', async () => {
      const { status } = await fetch(cfg.apiBase + '/api/scales/1');
      assert.ok(status === 200 || status === 404, `返回 ${status}`);
    });

    await test('POST /api/submit 无参数不崩溃', async () => {
      const { status } = await fetch(cfg.apiBase + '/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      assert.ok(status < 500, `不应 500，实际 ${status}`);
    });

    await test('GET /api/history 无参数不崩溃', async () => {
      const { status } = await fetch(cfg.apiBase + '/api/history');
      assert.ok(status < 500, `不应 500，实际 ${status}`);
    });

    await test('CORS 头存在', async () => {
      const { headers } = await fetch(cfg.apiBase + '/api/scales');
      const acao = headers['access-control-allow-origin'];
      assert.ok(acao, `缺少 CORS 头，access-control-allow-origin: ${acao}`);
    });
  } else {
    log('  ⏭️  跳过 API 接口测试（本地模式无后端）');
  }

  // ===== 4. 性能基线 =====
  console.log('\n=== 4. 性能基线 ===\n');

  await test('首页加载 < 3s', async () => {
    const start = Date.now();
    await fetch(cfg.base + '/mini-app-h5/frontend/index.html');
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 3000, `加载耗时 ${elapsed}ms，超过 3s`);
  });

  await test('shared-data.js < 5s', async () => {
    const start = Date.now();
    await fetch(cfg.base + '/mini-app-h5/shared-data.js');
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 5000, `加载耗时 ${elapsed}ms，超过 5s`);
  });

  // 汇总
  console.log('\n' + '='.repeat(50));
  console.log(`API 测试结果（${cfg.label}）：${passed} 通过 / ${failed} 失败 / 共 ${passed + failed} 项`);
  console.log('='.repeat(50));
  results.forEach((r) => log(r));
  if (failed > 0) process.exit(1);
})();
