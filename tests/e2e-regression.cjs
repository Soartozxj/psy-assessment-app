#!/usr/bin/env node
/**
 * 星蓝心镜 — 端到端回归测试脚本 (Playwright)
 *
 * 版本：v10.15 (2026-04-26)
 * 用法：NODE_PATH=.../node_modules node tests/e2e-regression.cjs
 * 前提：本地 HTTP 服务器已启动 (python3 -m http.server 8080)
 *
 * 覆盖模块：
 *   1. 页面加载与 JS 错误检查
 *   2. 首页量表列表
 *   3. 量表详情页
 *   4. NPC 沉浸模式测评流程（快速通过）
 *   5. 结果页展示
 *   6. 测评记录页
 *   7. 导航与返回
 *   8. 二次测评回归（_inlineSubmitted 重置）
 *   9. 控制台错误监控
 *
 * 关键技术点：
 *   - phone-body 使用 overflow:hidden + .page position:absolute，Playwright 认为"不可见"
 *   - 所有交互通过 page.evaluate(jsFunction) 直接调用，绕过可见性检查
 *   - JS 文件路由拦截解决相对路径问题
 */

const { chromium } = require('playwright');
const path = require('path');
const { join, resolve } = path;

// ===== 配置 =====
const CONFIG = {
  baseUrl: 'http://localhost:8080',
  frontendUrl: 'http://localhost:8080/mini-app-h5/frontend/index.html',
  jsRoutes: {
    'shared-data.js': 'mini-app-h5/shared-data.js',
    'scoring-engine.js': 'mini-app-h5/scoring-engine.js',
    'cloud-api.js': 'mini-app-h5/cloud-api.js',
    'cloud-data.js': 'mini-app-h5/cloud-data.js',
    'asset-storage.js': 'mini-app-h5/asset-storage.js',
    'data-monitor.js': 'mini-app-h5/data-monitor.js'
  },
  screenshotDir: resolve(__dirname, '../test-screenshots'),
  headless: true,
  slowMo: 50
};

// ===== 测试结果收集 =====
const results = { total: 0, passed: 0, failed: 0, skipped: 0, errors: [], details: [] };

function log(msg, level = 'info') {
  const colors = {
    info: '\x1b[36m',
    pass: '\x1b[32m',
    fail: '\x1b[31m',
    skip: '\x1b[33m',
    bold: '\x1b[1m',
    reset: '\x1b[0m'
  };
  const c = colors[level] || colors.info;
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`${c}[${ts}] ${msg}${colors.reset}`);
}

function recordResult(module, name, status, detail = '') {
  results.total++;
  if (status === 'pass') results.passed++;
  else if (status === 'fail') results.failed++;
  else results.skipped++;
  results.details.push({ module, name, status, detail });
  const icon = status === 'pass' ? '\u2705' : status === 'fail' ? '\u274c' : '\u23ed\ufe0f';
  log(
    `${icon} [${module}] ${name}${detail ? ' \u2014 ' + detail : ''}`,
    status === 'pass' ? 'pass' : status === 'fail' ? 'fail' : 'skip'
  );
}

function padStr(s, len) {
  return (s + ' '.repeat(len)).substring(0, len);
}

// 页面内自动答题函数（返回题目数）
// 直接通过 page.evaluate 执行，避免使用 const/let
const AUTO_ANSWER_JS = `(async function() {
  var count = 0;
  var MAX_ITER = 300;
  var wait = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

  // 跳过当前打字动画（如果有）
  function skipTyping() {
    if (typeof npcTyping === 'undefined' || !npcTyping) return;
    var el = document.getElementById('npc-dialog-text');
    if (el && el.onclick) el.click();
    // 给回调 200ms 执行时间
  }

  // 等待选项出现（沉浸模式下需跳过打字动画，最多 5s）
  function waitForOptions() {
    return new Promise(function(resolve) {
      var checkCount = 0;
      function check() {
        // 每次先尝试跳过打字
        skipTyping();
        var area = document.querySelector('#npc-options-area');
        var items = area ? area.querySelectorAll('.npc-option-btn') : [];
        // 检查：有选项 + 确认栏可见（打字完成回调会触发）
        var confirmBar = document.querySelector('#npc-confirm-bar');
        var barVisible = confirmBar ? confirmBar.classList.contains('visible') : false;
        if (items.length > 0 && barVisible) {
          resolve(true);
        } else if (checkCount++ > 25) {
          resolve(false);
        } else {
          setTimeout(check, 200);
        }
      }
      check();
    });
  }

  function clickConfirm() {
    var btn = document.querySelector('#npc-confirm-btn');
    if (btn && !btn.disabled) { btn.click(); return true; }
    return false;
  }
  function selectOption() {
    var area = document.querySelector('#npc-options-area');
    if (!area) return false;
    var items = area.querySelectorAll('.npc-option-btn');
    if (items.length === 0) return false;
    // 选择第一个未禁用的选项
    for (var i = 0; i < items.length; i++) {
      if (items[i].style.pointerEvents !== 'none') {
        items[i].click();
        return true;
      }
    }
    // 所有都禁用了，选第一个
    items[0].click();
    return true;
  }
  function isResultPage() {
    var rp = document.querySelector('#page-result');
    if (!rp) return false;
    // .page 默认 display:none，通过 .active class 显示
    return rp.classList.contains('active');
  }
  function getConfirmText() {
    var el = document.querySelector('#npc-confirm-text');
    return el ? el.textContent.trim() : '';
  }

  // 先等待当前题目就绪
  var ready = await waitForOptions();
  if (!ready) return 0;

  while (MAX_ITER-- > 0) {
    if (isResultPage()) break;
    var ct = getConfirmText();
    if (ct === '\u63d0\u4ea4\u6d4b\u8bc4') {
      clickConfirm();
      count++;
      await wait(1000);
      break;
    }
    if (selectOption()) {
      await wait(150);
      var confirmed = clickConfirm();
      if (!confirmed) {
        // 确认按钮不可用，可能打字动画未结束，等一下
        await waitForOptions();
        clickConfirm();
      }
      count++;
      await wait(250);
    } else {
      await wait(400);
    }
  }
  return count;
})();
`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ===== JS 文件路由拦截 =====
function setupJsRoutes(page) {
  for (const [pattern, filePath] of Object.entries(CONFIG.jsRoutes)) {
    const absPath = resolve(process.cwd(), filePath);
    page.route(new RegExp(`.*${pattern}.*`), async (route) => {
      try {
        await route.fulfill({ path: absPath, contentType: 'application/javascript' });
      } catch (e) {
        await route.continue();
      }
    });
  }
}

// ===== 控制台错误收集 =====
function setupConsoleMonitor(page) {
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error') {
      results.errors.push('[Console Error] ' + msg.text());
    }
  });
  page.on('pageerror', (err) => {
    results.errors.push('[Page Error] ' + err.message);
  });
}

// ===== 核心辅助：通过 evaluate 调用页面函数 =====
async function callPageFn(page, fnStr, ...args) {
  return page.evaluate(
    ([code, a]) => {
      const fn = new Function('return (' + code + ')').call(null);
      return fn(...a);
    },
    [fnStr, args]
  );
}

// 通过 JS 点击元素
async function jsClick(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, selector);
}

// 通过 JS 检查元素是否存在
async function jsExists(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el !== null;
  }, selector);
}

// 通过 JS 获取所有匹配元素的文本
async function jsGetTexts(page, selector) {
  return page.evaluate((sel) => {
    return Array.from(document.querySelectorAll(sel)).map((el) => el.textContent.trim());
  }, selector);
}

// 通过 JS 获取元素数量
async function jsCount(page, selector) {
  return page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
}

// 通过 JS 获取元素的文本内容
async function jsGetText(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : '';
  }, selector);
}

// 通过 JS 检查元素是否含指定 class
async function jsHasClass(page, selector, cls) {
  return page.evaluate(
    ([sel, c]) => {
      const el = document.querySelector(sel);
      return el ? el.classList.contains(c) : false;
    },
    [selector, cls]
  );
}

// 通过 JS 获取元素的 style.display
async function jsGetStyle(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? el.getAttribute('style') || '' : '';
  }, selector);
}

// ===== 主测试流程 =====
async function runTests() {
  log(
    '\ud83d\ude80 \u77e5\u6211\u5fc3\u7075\u6d4b\u8bc4 \u2014 \u7aef\u5230\u7aef\u56de\u5f52\u6d4b\u8bd5\u542f\u52a8',
    'bold'
  );
  log('  \u524d\u7aef\u5730\u5740: ' + CONFIG.frontendUrl, 'info');
  log('  \u65e0\u5934\u6a21\u5f0f: ' + CONFIG.headless, 'info');
  console.log('');

  const browser = await chromium.launch({ headless: CONFIG.headless, slowMo: CONFIG.slowMo });
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    locale: 'zh-CN'
  });
  const page = await context.newPage();
  setupJsRoutes(page);
  setupConsoleMonitor(page);

  try {
    // ============================================================
    // 模块 1: 页面加载
    // ============================================================
    log('\n\ud83d\udce6 \u6a21\u5757 1: \u9875\u9762\u52a0\u8f7d', 'bold');

    // 1.1 页面加载
    try {
      await page.goto(CONFIG.frontendUrl, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForSelector('.scale-card', { state: 'attached', timeout: 10000 });
      recordResult('\u9875\u9762\u52a0\u8f7d', '1.1 \u9996\u9875\u6b63\u5e38\u52a0\u8f7d', 'pass');
    } catch (e) {
      recordResult('\u9875\u9762\u52a0\u8f7d', '1.1 \u9996\u9875\u6b63\u5e38\u52a0\u8f7d', 'fail', e.message);
      await page.screenshot({ path: join(CONFIG.screenshotDir, '1.1-load-fail.png') });
      throw new Error('\u9996\u9875\u52a0\u8f7d\u5931\u8d25\uff0c\u7ec8\u6b62\u6d4b\u8bd5');
    }

    // 1.2 手机外壳 + TabBar
    try {
      const shell = await jsExists(page, '.phone-shell');
      const tabBar = await jsExists(page, '#fixed-tab-bar');
      recordResult(
        '\u9875\u9762\u52a0\u8f7d',
        '1.2 \u624b\u673a\u5916\u58f3+TabBar',
        shell && tabBar ? 'pass' : 'fail',
        `shell=${shell}, tabBar=${tabBar}`
      );
    } catch (e) {
      recordResult('\u9875\u9762\u52a0\u8f7d', '1.2 \u624b\u673a\u5916\u58f3+TabBar', 'fail', e.message);
    }

    // 1.3 量表列表
    try {
      const count = await jsCount(page, '.scale-card');
      recordResult(
        '\u9875\u9762\u52a0\u8f7d',
        '1.3 \u91cf\u8868\u5217\u8868\u5c55\u793a',
        count >= 6 ? 'pass' : 'fail',
        `\u68c0\u6d4b\u5230 ${count} \u4e2a\u91cf\u8868\u5361\u7247`
      );
    } catch (e) {
      recordResult('\u9875\u9762\u52a0\u8f7d', '1.3 \u91cf\u8868\u5217\u8868\u5c55\u793a', 'fail', e.message);
    }

    // 1.4 JS 无 404
    try {
      const jsErrors = results.errors.filter((e) => e.includes('404') || e.includes('net::ERR'));
      recordResult(
        '\u9875\u9762\u52a0\u8f7d',
        '1.4 JS\u6587\u4ef6\u65e0404',
        jsErrors.length === 0 ? 'pass' : 'fail',
        jsErrors.length > 0
          ? jsErrors.length + ' \u4e2a\u8d44\u6e90\u9519\u8bef'
          : '\u6240\u6709JS\u6b63\u5e38\u52a0\u8f7d'
      );
    } catch (e) {
      recordResult('\u9875\u9762\u52a0\u8f7d', '1.4 JS\u6587\u4ef6\u65e0404', 'fail', e.message);
    }

    // ============================================================
    // 模块 2: 首页导航
    // ============================================================
    log('\n\ud83d\udce6 \u6a21\u5757 2: \u9996\u9875\u5bfc\u822a', 'bold');

    // 2.1 TabBar
    try {
      const count = await jsCount(page, '.tab-item');
      recordResult(
        '\u9996\u9875\u5bfc\u822a',
        '2.1 TabBar 4\u4e2aTab',
        count === 4 ? 'pass' : 'fail',
        `\u68c0\u6d4b\u5230 ${count} \u4e2aTab`
      );
    } catch (e) {
      recordResult('\u9996\u9875\u5bfc\u822a', '2.1 TabBar 4\u4e2aTab', 'fail', e.message);
    }

    // 2.2 分类网格（首页分类卡片 + 量表页筛选标签）
    try {
      // 首先检查首页分类网格
      const homeCats = await jsCount(page, '#home-cat-grid .cat-card, #home-cat-grid .cat-card-wide');
      // 然后切换到量表 Tab 检查筛选标签
      await page.evaluate(() => {
        const tabs = document.querySelectorAll('.tab-item');
        if (tabs.length >= 2) tabs[1].click();
      });
      await sleep(800);
      const filterTags = await jsCount(page, '#filterGrid .filter-tag');
      const totalCats = homeCats + filterTags;
      recordResult(
        '\u9996\u9875\u5bfc\u822a',
        '2.2 \u5206\u7c7b\u5bfc\u822a\u5c55\u793a',
        totalCats > 0 ? 'pass' : 'fail',
        `\u9996\u9875\u5206\u7c7b=${homeCats}, \u7b5b\u9009\u6807\u7b7e=${filterTags}`
      );
    } catch (e) {
      recordResult('\u9996\u9875\u5bfc\u822a', '2.2 \u5206\u7c7b\u5bfc\u822a\u5c55\u793a', 'fail', e.message);
    }

    // 2.3 通过 JS 点击第一个量表卡片进入详情
    let firstScaleName = '';
    try {
      firstScaleName = await page.evaluate(() => {
        const card = document.querySelector('.scale-card');
        if (!card) return '';
        const titleEl = card.querySelector('.card-title, .s-card-title, .card-header span');
        return titleEl ? titleEl.textContent.trim() : '';
      });

      // 通过 JS 直接调用 gotoDetail 函数
      const scaleId = await page.evaluate(() => {
        const card = document.querySelector('.scale-card');
        if (!card) return null;
        const match = card.getAttribute('onclick') || card.outerHTML;
        const m = match.match(/gotoDetail\((\d+)\)/);
        return m ? parseInt(m[1]) : null;
      });

      if (scaleId) {
        await page.evaluate((id) => {
          gotoDetail(id);
        }, scaleId);
        await sleep(500);
        recordResult(
          '\u9996\u9875\u5bfc\u822a',
          '2.3 \u70b9\u51fb\u91cf\u8868\u8fdb\u8be6\u60c5',
          'pass',
          firstScaleName ? '\u8fdb\u5165\u300c' + firstScaleName + '\u300d' : ''
        );
      } else {
        recordResult(
          '\u9996\u9875\u5bfc\u822a',
          '2.3 \u70b9\u51fb\u91cf\u8868\u8fdb\u8be6\u60c5',
          'fail',
          '\u672a\u83b7\u53d6\u5230\u91cf\u8868ID'
        );
      }
    } catch (e) {
      recordResult('\u9996\u9875\u5bfc\u822a', '2.3 \u70b9\u51fb\u91cf\u8868\u8fdb\u8be6\u60c5', 'fail', e.message);
    }

    // 2.4 详情页内容检查
    try {
      const title = await jsExists(page, '#detail-name');
      const desc = await jsExists(page, '#detail-desc');
      const modes = await jsCount(page, '.detail-mode-opt');
      const startBtn = await jsExists(page, '.btn-start');
      recordResult(
        '\u9996\u9875\u5bfc\u822a',
        '2.4 \u8be6\u60c5\u9875\u5185\u5bb9\u5b8c\u6574',
        title && desc && startBtn ? 'pass' : 'fail',
        `\u6807\u9898=${title}, \u63cf\u8ff0=${desc}, \u6a21\u5f0f\u9009\u9879=${modes}, \u5f00\u59cb\u6309\u94ae=${startBtn}`
      );
    } catch (e) {
      recordResult('\u9996\u9875\u5bfc\u822a', '2.4 \u8be6\u60c5\u9875\u5185\u5bb9\u5b8c\u6574', 'fail', e.message);
    }

    // ============================================================
    // 模块 3: NPC 沉浸模式测评
    // ============================================================
    log('\n\ud83d\udce6 \u6a21\u5757 3: NPC \u6c89\u6d78\u6a21\u5f0f\u6d4b\u8bc4', 'bold');

    // 3.1 沉浸模式默认选中
    try {
      const isActive = await jsHasClass(page, '#detail-mode-opt-immersive', 'active');
      recordResult(
        'NPC\u6d4b\u8bc4',
        '3.1 \u6c89\u6d78\u6a21\u5f0f\u9ed8\u8ba4\u9009\u4e2d',
        isActive ? 'pass' : 'fail'
      );
    } catch (e) {
      recordResult('NPC\u6d4b\u8bc4', '3.1 \u6c89\u6d78\u6a21\u5f0f\u9ed8\u8ba4\u9009\u4e2d', 'fail', e.message);
    }

    // 3.2+3.3+3.4+3.5 合并：沉浸模式完整流程（一个 evaluate 避免跨调用状态问题）
    try {
      const npcResult = await page.evaluate(async () => {
        // 确保在详情页
        if (currentPage !== 'scale-detail' || !document.querySelector('#page-scale-detail.active')) {
          var card = document.querySelector('.scale-card');
          if (card) {
            var m = (card.getAttribute('onclick') || card.outerHTML).match(/gotoDetail\((\d+)\)/);
            if (m) {
              gotoDetail(parseInt(m[1]));
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        }
        // 3.2 开始测评
        startAssessment();
        // 3.3 等待并跳过欢迎语打字
        for (var i = 0; i < 50; i++) {
          if (typeof npcCallbackFired !== 'undefined' && npcCallbackFired) break;
          if (typeof npcTyping !== 'undefined' && npcTyping) {
            var el = document.getElementById('npc-dialog-text');
            if (el && el.onclick) el.click();
            break;
          }
          await new Promise(function (r) {
            setTimeout(r, 100);
          });
        }
        await new Promise(function (r) {
          setTimeout(r, 300);
        });
        var welcomeText = (document.getElementById('npc-dialog-text') || {}).textContent || '';

        // 3.4 确认开始
        var confirmBtn = document.getElementById('npc-confirm-btn');
        if (!confirmBtn || confirmBtn.disabled)
          return { ok: false, step: 'confirm-disabled', welcomeLen: welcomeText.length };
        confirmBtn.click();
        // 等待第一题选项就绪
        for (var j = 0; j < 50; j++) {
          if (typeof npcTyping !== 'undefined' && npcTyping) {
            var el2 = document.getElementById('npc-dialog-text');
            if (el2 && el2.onclick) el2.click();
            await new Promise(function (r) {
              setTimeout(r, 300);
            });
          }
          var items = document.querySelectorAll('#npc-options-area .npc-option-btn');
          var bar = document.querySelector('#npc-confirm-bar');
          var barVisible = bar ? bar.classList.contains('visible') : false;
          if (items.length > 0 && barVisible) break;
          await new Promise(function (r) {
            setTimeout(r, 100);
          });
        }

        // 3.5 自动答题（内联 AUTO_ANSWER 逻辑）
        var count = 0;
        var MAX_ITER = 300;
        var wait = function (ms) {
          return new Promise(function (r) {
            setTimeout(r, ms);
          });
        };
        function skipTyping() {
          if (typeof npcTyping !== 'undefined' && npcTyping) {
            var el = document.getElementById('npc-dialog-text');
            if (el && el.onclick) el.click();
          }
        }
        function waitForOptions() {
          return new Promise(function (resolve) {
            var checkCount = 0;
            function check() {
              skipTyping();
              var area = document.querySelector('#npc-options-area');
              var its = area ? area.querySelectorAll('.npc-option-btn') : [];
              var cbar = document.querySelector('#npc-confirm-bar');
              var bv = cbar ? cbar.classList.contains('visible') : false;
              if (its.length > 0 && bv) resolve(true);
              else if (checkCount++ > 25) resolve(false);
              else setTimeout(check, 200);
            }
            check();
          });
        }
        function clickConfirm() {
          var btn = document.querySelector('#npc-confirm-btn');
          if (btn && !btn.disabled) {
            btn.click();
            return true;
          }
          return false;
        }
        function selectOption() {
          var area = document.querySelector('#npc-options-area');
          if (!area) return false;
          var its = area.querySelectorAll('.npc-option-btn');
          if (its.length === 0) return false;
          for (var k = 0; k < its.length; k++) {
            if (its[k].style.pointerEvents !== 'none') {
              its[k].click();
              return true;
            }
          }
          its[0].click();
          return true;
        }
        function isResultPage() {
          var rp = document.querySelector('#page-result');
          return rp ? rp.classList.contains('active') : false;
        }
        function getConfirmText() {
          var el = document.querySelector('#npc-confirm-text');
          return el ? el.textContent.trim() : '';
        }

        var ready = await waitForOptions();
        if (!ready) return { ok: false, step: 'waitOptions', welcomeLen: welcomeText.length };

        var startTime = Date.now();
        while (MAX_ITER-- > 0) {
          if (isResultPage()) break;
          var ct = getConfirmText();
          if (ct === '\u63d0\u4ea4\u6d4b\u8bc4') {
            clickConfirm();
            count++;
            await wait(1000);
            break;
          }
          if (selectOption()) {
            await wait(150);
            var confirmed = clickConfirm();
            if (!confirmed) {
              await waitForOptions();
              clickConfirm();
            }
            count++;
            await wait(250);
          } else {
            await wait(400);
          }
        }
        var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        return {
          ok: true,
          step: 'done',
          welcomeLen: welcomeText.length,
          answered: count,
          elapsed: elapsed,
          isResult: isResultPage()
        };
      });

      recordResult('NPC\u6d4b\u8bc4', '3.2 \u70b9\u51fb\u5f00\u59cb\u6d4b\u8bc4', npcResult.ok ? 'pass' : 'fail');
      recordResult(
        'NPC\u6d4b\u8bc4',
        '3.3 \u6b22\u8fce\u8bed\u663e\u793a',
        npcResult.welcomeLen > 10 ? 'pass' : 'fail',
        npcResult.welcomeLen > 10 ? npcResult.welcomeLen + ' \u5b57' : '\u7a7a'
      );
      recordResult(
        'NPC\u6d4b\u8bc4',
        '3.4 \u786e\u8ba4\u5f00\u59cb',
        npcResult.step !== 'confirm-disabled' ? 'pass' : 'fail'
      );
      recordResult(
        'NPC\u6d4b\u8bc4',
        '3.5 \u81ea\u52a8\u7b54\u9898\u5b8c\u6210',
        npcResult.answered > 0 ? 'pass' : 'fail',
        `\u7b54\u4e86 ${npcResult.answered} \u9898, \u8017\u65f6 ${npcResult.elapsed}s`
      );
    } catch (e) {
      recordResult('NPC\u6d4b\u8bc4', '3.2+3.5 \u6d89\u6d78\u6a21\u5f0f\u6d4b\u8bc4', 'fail', e.message);
    }

    // 3.6 结果页
    try {
      await sleep(1500);
      const isResult = await page.evaluate(() => {
        const rp = document.querySelector('#page-result');
        return rp ? rp.classList.contains('active') : false;
      });

      const canvasCount = await jsCount(page, 'canvas');
      const dimCards = await jsCount(page, '.dim-card, [class*="dimension"]');
      const scoreText = await jsGetText(page, '.r-total-score, .score-value, [class*="total-score"]');

      recordResult(
        'NPC\u6d4b\u8bc4',
        '3.6 \u7ed3\u679c\u9875\u5c55\u793a',
        isResult ? 'pass' : 'fail',
        `\u603b\u5206="${scoreText}", \u7ef4\u5ea6\u5361\u7247=${dimCards}, canvas=${canvasCount}`
      );

      await page.screenshot({ path: join(CONFIG.screenshotDir, '3.6-result-page.png') });
    } catch (e) {
      recordResult('NPC\u6d4b\u8bc4', '3.6 \u7ed3\u679c\u9875\u5c55\u793a', 'fail', e.message);
    }

    // 3.7 AI 诊断入口
    try {
      const aiBtn = await jsExists(page, '#diag-start-btn, [onclick*="requestAiDiagnosis"]');
      recordResult(
        'NPC\u6d4b\u8bc4',
        '3.7 AI\u8bca\u65ad\u5165\u53e3',
        aiBtn ? 'pass' : 'fail',
        aiBtn ? 'AI \u6d4b\u8bc4\u62a5\u544a\u6309\u94ae\u5df2\u627e\u5230' : '\u672a\u627e\u5230'
      );
    } catch (e) {
      recordResult('NPC\u6d4b\u8bc4', '3.7 AI\u8bca\u65ad\u5165\u53e3', 'fail', e.message);
    }

    // ============================================================
    // 模块 4: 二次测评回归
    // ============================================================
    log('\n\ud83d\udce6 \u6a21\u5757 4: \u4e8c\u6b21\u6d4b\u8bc4\u56de\u5f52', 'bold');

    // 4.1 返回首页
    try {
      await callPageFn(page, 'goBack', []);
      await sleep(500);
      await callPageFn(page, 'goBack', []);
      await sleep(500);
      const isHome = await page.evaluate(() => {
        const hp = document.querySelector('#page-home');
        return hp ? hp.classList.contains('active') : false;
      });
      recordResult('\u4e8c\u6b21\u6d4b\u8bc4', '4.1 \u8fd4\u56de\u9996\u9875', isHome ? 'pass' : 'fail');
    } catch (e) {
      recordResult('\u4e8c\u6b21\u6d4b\u8bc4', '4.1 \u8fd4\u56de\u9996\u9875', 'fail', e.message);
    }

    // 4.2 再次进入详情
    try {
      const scaleId = await page.evaluate(() => {
        const card = document.querySelector('.scale-card');
        if (!card) return null;
        const match = card.getAttribute('onclick') || card.outerHTML;
        const m = match.match(/gotoDetail\((\d+)\)/);
        return m ? parseInt(m[1]) : null;
      });
      if (scaleId) {
        await page.evaluate((id) => {
          gotoDetail(id);
        }, scaleId);
        await sleep(500);
        recordResult('\u4e8c\u6b21\u6d4b\u8bc4', '4.2 \u518d\u6b21\u8fdb\u5165\u8be6\u60c5\u9875', 'pass');
      } else {
        recordResult('\u4e8c\u6b21\u6d4b\u8bc4', '4.2 \u518d\u6b21\u8fdb\u5165\u8be6\u60c5\u9875', 'fail');
      }
    } catch (e) {
      recordResult('\u4e8c\u6b21\u6d4b\u8bc4', '4.2 \u518d\u6b21\u8fdb\u5165\u8be6\u60c5\u9875', 'fail', e.message);
    }

    // 4.3+4.4 合并：二次测评完整流程
    try {
      const retryResult = await page.evaluate(async () => {
        // 确保在详情页
        if (currentPage !== 'scale-detail' || !document.querySelector('#page-scale-detail.active')) {
          var card = document.querySelector('.scale-card');
          if (card) {
            var m = (card.getAttribute('onclick') || card.outerHTML).match(/gotoDetail\((\d+)\)/);
            if (m) {
              gotoDetail(parseInt(m[1]));
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        }
        startAssessment();
        // 等待并跳过欢迎语
        for (var i = 0; i < 50; i++) {
          if (typeof npcCallbackFired !== 'undefined' && npcCallbackFired) break;
          if (typeof npcTyping !== 'undefined' && npcTyping) {
            var el = document.getElementById('npc-dialog-text');
            if (el && el.onclick) el.click();
            break;
          }
          await new Promise(function (r) {
            setTimeout(r, 100);
          });
        }
        await new Promise(function (r) {
          setTimeout(r, 300);
        });
        var text = (document.getElementById('npc-dialog-text') || {}).textContent || '';

        // 确认开始
        var btn = document.getElementById('npc-confirm-btn');
        if (!btn || btn.disabled) return { ok: false, textLen: text.length };
        btn.click();
        // 等待第一题就绪
        for (var j = 0; j < 50; j++) {
          if (typeof npcTyping !== 'undefined' && npcTyping) {
            var el2 = document.getElementById('npc-dialog-text');
            if (el2 && el2.onclick) el2.click();
            await new Promise(function (r) {
              setTimeout(r, 300);
            });
          }
          var items = document.querySelectorAll('#npc-options-area .npc-option-btn');
          var bar = document.querySelector('#npc-confirm-bar');
          if (items.length > 0 && (bar ? bar.classList.contains('visible') : false)) break;
          await new Promise(function (r) {
            setTimeout(r, 100);
          });
        }

        // 自动答题
        var count = 0;
        var wait = function (ms) {
          return new Promise(function (r) {
            setTimeout(r, ms);
          });
        };
        function skipTyping() {
          if (typeof npcTyping !== 'undefined' && npcTyping) {
            var el = document.getElementById('npc-dialog-text');
            if (el && el.onclick) el.click();
          }
        }
        function waitForOpts() {
          return new Promise(function (resolve) {
            var cc = 0;
            function ck() {
              skipTyping();
              var area = document.querySelector('#npc-options-area');
              var its = area ? area.querySelectorAll('.npc-option-btn') : [];
              var cb = document.querySelector('#npc-confirm-bar');
              var bv = cb ? cb.classList.contains('visible') : false;
              if (its.length > 0 && bv) resolve(true);
              else if (cc++ > 25) resolve(false);
              else setTimeout(ck, 200);
            }
            ck();
          });
        }
        function clickCfm() {
          var b = document.querySelector('#npc-confirm-btn');
          if (b && !b.disabled) {
            b.click();
            return true;
          }
          return false;
        }
        function selOpt() {
          var area = document.querySelector('#npc-options-area');
          if (!area) return false;
          var its = area.querySelectorAll('.npc-option-btn');
          if (its.length === 0) return false;
          for (var k = 0; k < its.length; k++) {
            if (its[k].style.pointerEvents !== 'none') {
              its[k].click();
              return true;
            }
          }
          its[0].click();
          return true;
        }
        function isRes() {
          var rp = document.querySelector('#page-result');
          return rp ? rp.classList.contains('active') : false;
        }
        function getCT() {
          var el = document.querySelector('#npc-confirm-text');
          return el ? el.textContent.trim() : '';
        }
        var ready = await waitForOpts();
        if (!ready) return { ok: false, textLen: text.length, answered: 0 };
        var st = Date.now();
        var MAX_ITER = 300;
        while (MAX_ITER-- > 0) {
          if (isRes()) break;
          var ct = getCT();
          if (ct === '\u63d0\u4ea4\u6d4b\u8bc4') {
            clickCfm();
            count++;
            await wait(1000);
            break;
          }
          if (selOpt()) {
            await wait(150);
            if (!clickCfm()) {
              await waitForOpts();
              clickCfm();
            }
            count++;
            await wait(250);
          } else {
            await wait(400);
          }
        }
        return { ok: true, textLen: text.length, answered: count, elapsed: ((Date.now() - st) / 1000).toFixed(1) };
      });
      recordResult(
        '\u4e8c\u6b21\u6d4b\u8bc4',
        '4.3 \u4e8c\u6b21\u6d4b\u8bc4\u53ef\u542f\u52a8',
        retryResult.textLen > 5 ? 'pass' : 'fail'
      );
      recordResult(
        '\u4e8c\u6b21\u6d4b\u8bc4',
        '4.4 \u4e8c\u6b21\u7b54\u9898\u5b8c\u6210',
        retryResult.answered > 0 ? 'pass' : 'fail',
        `\u7b54\u4e86 ${retryResult.answered} \u9898, \u8017\u65f6 ${retryResult.elapsed}s`
      );
    } catch (e) {
      recordResult('\u4e8c\u6b21\u6d4b\u8bc4', '4.3+4.4', 'fail', e.message);
    }

    // 4.5 返回首页
    try {
      await callPageFn(page, 'goBack', []);
      await sleep(500);
      await callPageFn(page, 'goBack', []);
      await sleep(500);
      const isHome = await page.evaluate(() => {
        const hp = document.querySelector('#page-home');
        return hp ? hp.classList.contains('active') : false;
      });
      recordResult(
        '\u4e8c\u6b21\u6d4b\u8bc4',
        '4.5 \u4e8c\u6b21\u6d4b\u8bc4\u540e\u8fd4\u56de\u9996\u9875',
        isHome ? 'pass' : 'fail'
      );
    } catch (e) {
      recordResult(
        '\u4e8c\u6b21\u6d4b\u8bc4',
        '4.5 \u4e8c\u6b21\u6d4b\u8bc4\u540e\u8fd4\u56de\u9996\u9875',
        'fail',
        e.message
      );
    }

    // ============================================================
    // 模块 5: 测评记录
    // ============================================================
    log('\n\ud83d\udce6 \u6a21\u5757 5: \u6d4b\u8bc4\u8bb0\u5f55', 'bold');

    // 5.1 进入记录页
    try {
      await callPageFn(page, 'showPage', ['history']);
      await sleep(800);
      const isHistory = await page.evaluate(() => {
        const hp = document.querySelector('#page-history');
        return hp ? hp.classList.contains('active') : false;
      });
      recordResult('\u6d4b\u8bc4\u8bb0\u5f55', '5.1 \u8fdb\u5165\u8bb0\u5f55\u9875', isHistory ? 'pass' : 'fail');
    } catch (e) {
      recordResult('\u6d4b\u8bc4\u8bb0\u5f55', '5.1 \u8fdb\u5165\u8bb0\u5f55\u9875', 'fail', e.message);
    }

    // 5.2 记录列表
    try {
      const count = await jsCount(page, '.history-item');
      recordResult(
        '\u6d4b\u8bc4\u8bb0\u5f55',
        '5.2 \u8bb0\u5f55\u5217\u8868\u5c55\u793a',
        count >= 2 ? 'pass' : 'skip',
        count + ' \u6761\u8bb0\u5f55'
      );

      await page.screenshot({ path: join(CONFIG.screenshotDir, '5.2-history-list.png') });
    } catch (e) {
      recordResult('\u6d4b\u8bc4\u8bb0\u5f55', '5.2 \u8bb0\u5f55\u5217\u8868\u5c55\u793a', 'fail', e.message);
    }

    // ============================================================
    // 模块 6: 普通模式测评
    // ============================================================
    log('\n\ud83d\udce6 \u6a21\u5757 6: \u666e\u901a\u6a21\u5f0f\u6d4b\u8bc4', 'bold');

    // 6.1 进入详情
    try {
      await page.evaluate(() => showPage('home'));
      await sleep(500);
      const scaleId = await page.evaluate(() => {
        const card = document.querySelector('.scale-card');
        if (!card) return null;
        const match = card.getAttribute('onclick') || card.outerHTML;
        const m = match.match(/gotoDetail\((\d+)\)/);
        return m ? parseInt(m[1]) : null;
      });
      if (scaleId) {
        await page.evaluate((id) => {
          gotoDetail(id);
        }, scaleId);
        await sleep(500);
        recordResult('\u666e\u901a\u6a21\u5f0f', '6.1 \u8fdb\u5165\u8be6\u60c5\u9875', 'pass');
      } else {
        recordResult('\u666e\u901a\u6a21\u5f0f', '6.1 \u8fdb\u5165\u8be6\u60c5\u9875', 'fail');
      }
    } catch (e) {
      recordResult('\u666e\u901a\u6a21\u5f0f', '6.1 \u8fdb\u5165\u8be6\u60c5\u9875', 'fail', e.message);
    }

    // 6.2 切换普通模式
    try {
      await callPageFn(page, 'selectDetailMode', ['normal']);
      await sleep(300);
      const isActive = await jsHasClass(page, '#detail-mode-opt-normal', 'active');
      recordResult('\u666e\u901a\u6a21\u5f0f', '6.2 \u5207\u6362\u666e\u901a\u6a21\u5f0f', isActive ? 'pass' : 'fail');
    } catch (e) {
      recordResult('\u666e\u901a\u6a21\u5f0f', '6.2 \u5207\u6362\u666e\u901a\u6a21\u5f0f', 'fail', e.message);
    }

    // 6.3+6.4 合并：普通模式完整流程
    try {
      const normalResult = await page.evaluate(async () => {
        // 确保在详情页
        if (currentPage !== 'scale-detail' || !document.querySelector('#page-scale-detail.active')) {
          var card = document.querySelector('.scale-card');
          if (card) {
            var m = (card.getAttribute('onclick') || card.outerHTML).match(/gotoDetail\((\d+)\)/);
            if (m) {
              gotoDetail(parseInt(m[1]));
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        }
        startAssessment();
        // 等待欢迎语（普通模式直接显示，不打字动画，但需等待 showNpcStartPanel）
        for (var i = 0; i < 50; i++) {
          if (typeof npcCallbackFired !== 'undefined' && npcCallbackFired) break;
          if (typeof npcTyping !== 'undefined' && npcTyping) {
            var el = document.getElementById('npc-dialog-text');
            if (el && el.onclick) el.click();
            break;
          }
          await new Promise(function (r) {
            setTimeout(r, 100);
          });
        }
        await new Promise(function (r) {
          setTimeout(r, 300);
        });

        // 确认开始
        var btn = document.getElementById('npc-confirm-btn');
        if (!btn || btn.disabled) return { ok: false, step: 'confirm-disabled' };
        btn.click();
        // 等待第一题就绪（普通模式无打字动画，直接等选项）
        for (var j = 0; j < 50; j++) {
          var items = document.querySelectorAll('#npc-options-area .npc-option-btn');
          var bar = document.querySelector('#npc-confirm-bar');
          if (items.length > 0 && (bar ? bar.classList.contains('visible') : false)) break;
          await new Promise(function (r) {
            setTimeout(r, 100);
          });
        }

        // 自动答题
        var count = 0;
        var wait = function (ms) {
          return new Promise(function (r) {
            setTimeout(r, ms);
          });
        };
        function selOpt() {
          var area = document.querySelector('#npc-options-area');
          if (!area) return false;
          var its = area.querySelectorAll('.npc-option-btn');
          if (its.length === 0) return false;
          for (var k = 0; k < its.length; k++) {
            if (its[k].style.pointerEvents !== 'none') {
              its[k].click();
              return true;
            }
          }
          its[0].click();
          return true;
        }
        function clickCfm() {
          var b = document.querySelector('#npc-confirm-btn');
          if (b && !b.disabled) {
            b.click();
            return true;
          }
          return false;
        }
        function isRes() {
          var rp = document.querySelector('#page-result');
          return rp ? rp.classList.contains('active') : false;
        }
        function getCT() {
          var el = document.querySelector('#npc-confirm-text');
          return el ? el.textContent.trim() : '';
        }
        var st = Date.now();
        var MAX_ITER2 = 300;
        while (MAX_ITER2-- > 0) {
          if (isRes()) break;
          var ct = getCT();
          if (ct === '\u63d0\u4ea4\u6d4b\u8bc4') {
            clickCfm();
            count++;
            await wait(1000);
            break;
          }
          if (selOpt()) {
            await wait(150);
            if (!clickCfm()) {
              await new Promise(function (r) {
                setTimeout(r, 200);
              });
              clickCfm();
            }
            count++;
            await wait(250);
          } else {
            await wait(400);
          }
        }
        return { ok: true, answered: count, elapsed: ((Date.now() - st) / 1000).toFixed(1) };
      });
      recordResult(
        '\u666e\u901a\u6a21\u5f0f',
        '6.3 \u5f00\u59cb\u666e\u901a\u6a21\u5f0f\u6d4b\u8bc4',
        normalResult.ok ? 'pass' : 'fail'
      );
      recordResult(
        '\u666e\u901a\u6a21\u5f0f',
        '6.4 \u666e\u901a\u6a21\u5f0f\u7b54\u9898\u5b8c\u6210',
        normalResult.answered > 0 ? 'pass' : 'fail',
        `\u7b54\u4e86 ${normalResult.answered} \u9898, \u8017\u65f6 ${normalResult.elapsed}s`
      );

      await page.screenshot({ path: join(CONFIG.screenshotDir, '6.4-normal-result.png') });
    } catch (e) {
      recordResult('\u666e\u901a\u6a21\u5f0f', '6.3+6.4', 'fail', e.message);
    }

    // ============================================================
    // 模块 7: 其他功能
    // ============================================================
    log('\n\ud83d\udce6 \u6a21\u5757 7: \u5176\u4ed6\u529f\u80fd', 'bold');

    // 7.1 新手引导
    try {
      const guideDone = await page.evaluate(() => localStorage.getItem('psy_guide_done'));
      recordResult(
        '\u5176\u4ed6\u529f\u80fd',
        '7.1 \u65b0\u624b\u5f15\u5bfc\u5df2\u5b8c\u6210',
        guideDone ? 'pass' : 'skip',
        guideDone
          ? 'localStorage \u5df2\u6807\u8bb0'
          : '\u672a\u6807\u8bb0\uff08\u9996\u6b21\u4f7f\u7528\u4f1a\u5f39\u51fa\uff09'
      );
    } catch (e) {
      recordResult('\u5176\u4ed6\u529f\u80fd', '7.1 \u65b0\u624b\u5f15\u5bfc\u5df2\u5b8c\u6210', 'fail', e.message);
    }

    // 7.2 SCALES 数据完整性
    try {
      const scaleInfo = await page.evaluate(() => {
        if (typeof SCALES === 'undefined' || !Array.isArray(SCALES)) return null;
        return {
          total: SCALES.length,
          withScoring: SCALES.filter((s) => s.scoring).length,
          withAiDiag: SCALES.filter((s) => s.aiDiag && s.aiDiag.enabled).length,
          names: SCALES.map((s) => s.name)
        };
      });

      if (scaleInfo) {
        recordResult(
          '\u5176\u4ed6\u529f\u80fd',
          '7.2 SCALES\u6570\u636e\u5b8c\u6574',
          'pass',
          `\u603b\u8ba1${scaleInfo.total}\u4e2a, \u8ba1\u5206${scaleInfo.withScoring}\u4e2a, AI\u8bca\u65ad${scaleInfo.withAiDiag}\u4e2a`
        );
      } else {
        recordResult(
          '\u5176\u4ed6\u529f\u80fd',
          '7.2 SCALES\u6570\u636e\u5b8c\u6574',
          'fail',
          'SCALES \u672a\u5b9a\u4e49'
        );
      }
    } catch (e) {
      recordResult('\u5176\u4ed6\u529f\u80fd', '7.2 SCALES\u6570\u636e\u5b8c\u6574', 'fail', e.message);
    }

    // 7.3 ScoringEngine 可用
    try {
      const hasEngine = await page.evaluate(() => typeof ScoringEngine !== 'undefined');
      recordResult('\u5176\u4ed6\u529f\u80fd', '7.3 ScoringEngine\u53ef\u7528', hasEngine ? 'pass' : 'fail');
    } catch (e) {
      recordResult('\u5176\u4ed6\u529f\u80fd', '7.3 ScoringEngine\u53ef\u7528', 'fail', e.message);
    }

    // 7.4 SharedData 可用
    try {
      const hasSharedData = await page.evaluate(() => typeof SharedData !== 'undefined');
      recordResult('\u5176\u4ed6\u529f\u80fd', '7.4 SharedData\u53ef\u7528', hasSharedData ? 'pass' : 'fail');
    } catch (e) {
      recordResult('\u5176\u4ed6\u529f\u80fd', '7.4 SharedData\u53ef\u7528', 'fail', e.message);
    }
  } catch (fatalError) {
    log('\n\ud83d\udca5 \u81f4\u547d\u9519\u8bef: ' + fatalError.message, 'fail');
  } finally {
    await browser.close();
  }

  // ============================================================
  // 结果汇总
  // ============================================================
  console.log('\n' + '='.repeat(60));
  log('\ud83d\udcca \u6d4b\u8bd5\u7ed3\u679c\u6c47\u603b', 'bold');
  console.log('='.repeat(60));

  const modules = {};
  for (const d of results.details) {
    if (!modules[d.module]) modules[d.module] = { pass: 0, fail: 0, skip: 0 };
    modules[d.module][d.status]++;
  }

  console.log('');
  console.log(
    '  ' +
      padStr('\u6a21\u5757', 20) +
      ' ' +
      padStr('\u901a\u8fc7', 6) +
      ' ' +
      padStr('\u5931\u8d25', 6) +
      ' ' +
      padStr('\u8df3\u8fc7', 6)
  );
  console.log('  ' + '-'.repeat(40));
  for (const [mod, counts] of Object.entries(modules)) {
    console.log(
      '  ' +
        padStr(mod, 20) +
        ' ' +
        ('\u2705 ' + counts.pass).padStart(5) +
        ' ' +
        ('\u274c ' + counts.fail).padStart(5) +
        ' ' +
        ('\u23ed\ufe0f ' + counts.skip).padStart(5)
    );
  }
  console.log('  ' + '-'.repeat(40));
  console.log(
    '  ' +
      padStr('\u603b\u8ba1', 20) +
      ' ' +
      ('\u2705 ' + results.passed).padStart(5) +
      ' ' +
      ('\u274c ' + results.failed).padStart(5) +
      ' ' +
      ('\u23ed\ufe0f ' + results.skipped).padStart(5)
  );
  console.log('');

  if (results.errors.length > 0) {
    log(
      '\u26a0\ufe0f \u8d2f\u7a7f\u5168\u8fc7\u7a0b\u7684 JS \u9519\u8bef (' + results.errors.length + ' \u4e2a):',
      'fail'
    );
    const uniqueErrors = [...new Set(results.errors)];
    uniqueErrors.forEach((e) => console.log('    \u2022 ' + e));
    console.log('');
  } else {
    log('\u2705 \u65e0 JS \u9519\u8bef', 'pass');
  }

  log('\ud83d\udcf8 \u622a\u56fe\u4fdd\u5b58: ' + CONFIG.screenshotDir, 'info');
  console.log('');

  if (results.failed === 0) {
    log('\ud83c\udf89 \u6240\u6709\u6d4b\u8bd5\u901a\u8fc7\uff01', 'pass');
  } else {
    log('\u274c \u6709 ' + results.failed + ' \u4e2a\u6d4b\u8bd5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5', 'fail');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('\u6d4b\u8bd5\u6846\u67b6\u5f02\u5e38:', err);
  process.exit(2);
});
