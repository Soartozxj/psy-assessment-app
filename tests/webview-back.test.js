#!/usr/bin/env node
/**
 * WebView 返回按钮层级自动化测试
 *
 * 用法：NODE_PATH=.../node_modules node tests/webview-back.test.js
 * 前提：本地 HTTP 服务器已启动 (python3 -m http.server 8080)
 *
 * 覆盖场景：
 *   1. 非WebView 模式：goBack() 逐层返回
 *   2. WebView 模式：_doWebViewBack() 层级返回
 *   3. pushStack=false 时 replaceState（不增加 history）
 *   4. 首页返回退出 WebView
 *   5. 从 history 进入 result 的返回
 *   6. AI 诊断页的返回
 *   7. popstate 事件触发的真实浏览器后退
 *   8. 300ms 防抖机制（popstate + hashchange 双触发不重复返回）
 *   9. 连续快速返回的防抖
 */

const assert = require('assert');
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080/mini-app-h5/frontend/index.html';
const WEBVIEW_URL = BASE_URL + '?env=cloud';

let passed = 0,
  failed = 0;
const results = [];

function log(msg) {
  console.log(msg);
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    results.push(`  ❌ ${name}: ${e.message}`);
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function snap(page) {
  return await page.evaluate(() => ({
    page: currentPage,
    prevStack: prevPageStack.slice(),
    h5Stack: _h5PageStack.slice(),
    hash: location.hash,
    histLen: history.length
  }));
}

async function closeModals(page) {
  await page.evaluate(() => {
    document
      .querySelectorAll(
        '.privacy-modal, .privacy-modal-overlay, .fb-modal, .fb-modal-overlay, .delete-confirm-modal, .delete-confirm-overlay'
      )
      .forEach((el) => {
        el.style.display = 'none';
      });
  });
}

/**
 * 导航到指定页面并等待 300ms
 */
async function navTo(page, pageName, pushStack = true) {
  await page.evaluate((args) => showPage(args.name, args.push), { name: pageName, push: pushStack });
  await sleep(100);
}

/**
 * 模拟首页初始化状态
 */
async function resetToHome(page, isWebView = true) {
  const url = isWebView ? WEBVIEW_URL : BASE_URL;
  await page.goto(url);
  await closeModals(page);
  await sleep(400);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  ctx.setDefaultTimeout(10000);
  const page = await ctx.newPage();

  // 收集 console.log 用于调试
  page.on('console', (msg) => {
    if (msg.text().includes('[WebView back]') || msg.text().includes('[EVENT]')) {
      // log('  [console] ' + msg.text());
    }
  });

  // mock wx.miniProgram.navigateBack
  async function mockWxNavigateBack(page) {
    await page.evaluate(() => {
      window.__wxExitCalled = false;
      window.wx = {
        miniProgram: {
          navigateBack: () => {
            window.__wxExitCalled = true;
          }
        }
      };
    });
  }

  try {
    // ===== 场景1：非WebView 模式 =====
    console.log('\n=== 1. 非WebView 模式 goBack() 逐层返回 ===\n');

    await test('正常导航 home → scale-list → scale-detail → assessment', async () => {
      await resetToHome(page, false);
      await navTo(page, 'scale-list');
      await navTo(page, 'scale-detail');
      await navTo(page, 'assessment');
      const s = await snap(page);
      assert.strictEqual(s.page, 'assessment', '应在 assessment 页');
      assert.strictEqual(s.prevStack[s.prevStack.length - 1], 'scale-detail', 'prevStack 顶层应为 scale-detail');
    });

    await test('goBack 3次逐层返回到 home', async () => {
      await page.evaluate(() => goBack());
      assert.strictEqual((await snap(page)).page, 'scale-detail');

      await page.evaluate(() => goBack());
      assert.strictEqual((await snap(page)).page, 'scale-list');

      await page.evaluate(() => goBack());
      assert.strictEqual((await snap(page)).page, 'home');
    });

    await test('home 无历史时 goBack 留在首页', async () => {
      await page.evaluate(() => goBack());
      assert.strictEqual((await snap(page)).page, 'home');
    });

    // ===== 场景2：WebView 模式层级返回（直接调用 _doWebViewBack） =====
    console.log('\n=== 2. WebView 模式 _doWebViewBack 层级返回 ===\n');

    await test('home → scale-list → scale-detail → assessment → result 导航', async () => {
      await resetToHome(page, true);
      await navTo(page, 'scale-list');
      await navTo(page, 'scale-detail');
      await navTo(page, 'assessment');
      await navTo(page, 'result', false);
      const s = await snap(page);
      assert.strictEqual(s.page, 'result', '应在 result 页');
    });

    await test('result(L4) → scale-detail(L3)', async () => {
      await page.evaluate(() => _doWebViewBack('test1'));
      const s = await snap(page);
      assert.strictEqual(s.page, 'scale-detail', `应为 scale-detail，实际 ${s.page}`);
    });

    await test('scale-detail(L3) → scale-list(L2)', async () => {
      await sleep(400);
      await page.evaluate(() => _doWebViewBack('test2'));
      const s = await snap(page);
      assert.strictEqual(s.page, 'scale-list', `应为 scale-list，实际 ${s.page}`);
    });

    await test('scale-list(L2) → home(L1)', async () => {
      await sleep(400);
      await page.evaluate(() => _doWebViewBack('test3'));
      const s = await snap(page);
      assert.strictEqual(s.page, 'home', `应为 home，实际 ${s.page}`);
    });

    await test('home(L1) → 退出 WebView', async () => {
      await sleep(400);
      await mockWxNavigateBack(page);
      await page.evaluate(() => _doWebViewBack('test4'));
      const exitCalled = await page.evaluate(() => window.__wxExitCalled);
      assert.strictEqual(exitCalled, true, '应调用 wx.miniProgram.navigateBack()');
    });

    // ===== 场景3：pushStack=false 不增加 history =====
    console.log('\n=== 3. pushStack=false replaceState 验证 ===\n');

    await test('assessment → result 不增加 history 条目', async () => {
      await resetToHome(page, true);
      await navTo(page, 'scale-list');
      await navTo(page, 'scale-detail');
      await navTo(page, 'assessment');
      const mid = await page.evaluate(() => history.length);
      await navTo(page, 'result', false);
      const after = await page.evaluate(() => history.length);
      assert.strictEqual(after, mid, `history 应保持 ${mid}，实际 ${after}`);
    });

    await test('_doWebViewBack replaceState 不增加 history', async () => {
      // 在 result 页，执行返回
      const before = await page.evaluate(() => history.length);
      await page.evaluate(() => _doWebViewBack('test-replace'));
      const after = await page.evaluate(() => history.length);
      assert.strictEqual(after, before, '_doWebViewBack 应 replaceState，不增加 history');
    });

    // ===== 场景4：从 history 进入 result 的返回 =====
    console.log('\n=== 4. history → result 返回 ===\n');

    await test('从 history 进 result 返回到 scale-detail', async () => {
      await resetToHome(page, true);
      await page.evaluate(() => {
        currentPage = 'home';
        prevPageStack = [];
        _h5PageStack = ['home'];
      });
      await navTo(page, 'history');
      await navTo(page, 'result');
      assert.strictEqual((await snap(page)).page, 'result');

      await page.evaluate(() => _doWebViewBack('test-history'));
      const after = await snap(page);
      assert.strictEqual(after.page, 'scale-detail', `从 history 进 result 返回应为 scale-detail，实际 ${after.page}`);
    });

    // ===== 场景5：AI 诊断页返回 =====
    console.log('\n=== 5. AI 诊断页返回 ===\n');

    await test('ai-diag(L4) → scale-detail(L3)', async () => {
      await resetToHome(page, true);
      await navTo(page, 'scale-list');
      await navTo(page, 'scale-detail');
      await navTo(page, 'assessment');
      await navTo(page, 'result', false);
      await navTo(page, 'ai-diag');
      assert.strictEqual((await snap(page)).page, 'ai-diag');

      await page.evaluate(() => _doWebViewBack('test-ai'));
      const s = await snap(page);
      assert.strictEqual(s.page, 'scale-detail', `ai-diag 返回应为 scale-detail，实际 ${s.page}`);
    });

    // ===== 场景6：mine 页返回 =====
    console.log('\n=== 6. mine(L2) → home(L1) ===\n');

    await test('mine 页返回到首页', async () => {
      await resetToHome(page, true);
      await navTo(page, 'mine');
      assert.strictEqual((await snap(page)).page, 'mine');

      await page.evaluate(() => _doWebViewBack('test-mine'));
      assert.strictEqual((await snap(page)).page, 'home');
    });

    // ===== 场景7：popstate 触发的真实浏览器后退 =====
    console.log('\n=== 7. 真实 popstate 浏览器后退 ===\n');

    await test('popstate 后退 result(L4) → scale-detail(L3)', async () => {
      await resetToHome(page, true);
      await navTo(page, 'scale-list');
      await navTo(page, 'scale-detail');
      await navTo(page, 'assessment');
      await navTo(page, 'result', false);
      assert.strictEqual((await snap(page)).page, 'result');

      // 真实浏览器后退触发 popstate
      await page.goBack();
      await sleep(400);
      const s = await snap(page);
      assert.strictEqual(s.page, 'scale-detail', `popstate 后退应为 scale-detail，实际 ${s.page}`);
    });

    await test('popstate 后退 scale-detail(L3) → scale-list(L2)', async () => {
      await page.goBack();
      await sleep(400);
      const s = await snap(page);
      assert.strictEqual(s.page, 'scale-list', `popstate 后退应为 scale-list，实际 ${s.page}`);
    });

    await test('popstate 后退 scale-list(L2) → home(L1)', async () => {
      await page.goBack();
      await sleep(400);
      const s = await snap(page);
      assert.strictEqual(s.page, 'home', `popstate 后退应为 home，实际 ${s.page}`);
    });

    await test('popstate 后退 home(L1) → 退出 WebView', async () => {
      // 注意：首页 goBack() 会导致浏览器离开页面，无法验证
      // 改用 _doWebViewBack 模拟首页的 popstate 处理
      await mockWxNavigateBack(page);
      await page.evaluate(() => _doWebViewBack('popstate-home'));
      await sleep(400);
      const exitCalled = await page.evaluate(() => window.__wxExitCalled);
      assert.strictEqual(exitCalled, true, '首页 popstate 应退出 WebView');
    });

    // ===== 场景8：300ms 防抖（popstate + hashchange 双触发） =====
    console.log('\n=== 8. 300ms 防抖验证 ===\n');

    await test('防抖不会吞掉下一次返回', async () => {
      await resetToHome(page, true);
      await navTo(page, 'scale-list');
      await navTo(page, 'scale-detail');
      assert.strictEqual((await snap(page)).page, 'scale-detail');

      // 第一次返回
      await page.goBack();
      await sleep(400);
      assert.strictEqual((await snap(page)).page, 'scale-list', '第一次返回应在 scale-list');

      // 第二次返回（间隔 >300ms，应正常触发）
      await page.goBack();
      await sleep(400);
      assert.strictEqual((await snap(page)).page, 'home', '第二次返回应在 home');
    });

    await test('300ms 内连续返回只执行一次', async () => {
      await resetToHome(page, true);
      await navTo(page, 'scale-list');
      await navTo(page, 'scale-detail');
      await navTo(page, 'assessment');
      assert.strictEqual((await snap(page)).page, 'assessment');

      // 连续两次快速返回
      await page.goBack();
      await sleep(100); // <300ms
      await page.goBack();
      await sleep(400); // 等防抖窗口

      const s = await snap(page);
      // 第二次返回应该被防抖吞掉（或只返回了一层）
      // assessment(L4) → scale-detail(L3)，不应该跳到 scale-list
      assert.strictEqual(s.page, 'scale-detail', `快速连续返回应只执行一次，实际 ${s.page}`);
    });

    // ===== 场景9：_levelTargets 语义验证 =====
    console.log('\n=== 9. _levelTargets 语义（_levelTargets[level] 而非 level-1） ===\n');

    await test('L4 返回目标是 _levelTargets[4]=scale-detail', async () => {
      await resetToHome(page, true);
      const levelTarget4 = await page.evaluate(() => _levelTargets[4]);
      assert.strictEqual(levelTarget4, 'scale-detail', '_levelTargets[4] 应为 scale-detail');
    });

    await test('L3 返回目标是 _levelTargets[3]=scale-list', async () => {
      const levelTarget3 = await page.evaluate(() => _levelTargets[3]);
      assert.strictEqual(levelTarget3, 'scale-list', '_levelTargets[3] 应为 scale-list');
    });

    await test('L2 返回目标是 _levelTargets[2]=home', async () => {
      const levelTarget2 = await page.evaluate(() => _levelTargets[2]);
      assert.strictEqual(levelTarget2, 'home', '_levelTargets[2] 应为 home');
    });

    await test('L1 返回目标是 _levelTargets[1]=null（退出）', async () => {
      const levelTarget1 = await page.evaluate(() => _levelTargets[1]);
      assert.strictEqual(levelTarget1, null, '_levelTargets[1] 应为 null（退出）');
    });

    // ===== 场景10：_h5PageStack 在层级返回后重置 =====
    console.log('\n=== 10. _h5PageStack 重置验证 ===\n');

    await test('层级返回后 _h5PageStack 重置为 [home]', async () => {
      await resetToHome(page, true);
      await navTo(page, 'scale-list');
      await navTo(page, 'scale-detail');
      await navTo(page, 'assessment');
      await navTo(page, 'result', false);

      // 从 result 返回
      await page.evaluate(() => _doWebViewBack('test-stack'));
      const s = await snap(page);
      assert.ok(Array.isArray(s.h5Stack), '_h5PageStack 应是数组');
      // 层级返回后重置
      assert.strictEqual(s.h5Stack[0], 'home', '栈底应为 home');
    });

    // ===== 场景11：confirm 弹窗处理（答题中途返回） =====
    console.log('\n=== 11. 答题中途返回 confirm 处理 ===\n');

    await test('答题中途 _doWebViewBack 会被 confirm 阻断', async () => {
      await resetToHome(page, true);
      await navTo(page, 'scale-list');
      await navTo(page, 'scale-detail');
      await navTo(page, 'assessment');

      // 模拟有答题
      await page.evaluate(() => {
        answers = { 1: 0, 2: 1 };
      });

      // 监听 confirm 并取消
      page.on('dialog', async (dialog) => {
        await dialog.dismiss(); // 点取消
      });

      await page.evaluate(() => _doWebViewBack('test-confirm-cancel'));
      await sleep(400);

      const s = await snap(page);
      assert.strictEqual(s.page, 'assessment', '取消确认后应留在 assessment');
    });

    await test('答题中途确认返回', async () => {
      // 先移除之前的 dialog handler
      page.removeAllListeners('dialog');
      page.on('dialog', async (dialog) => {
        await dialog.accept(); // 点确认
      });

      await page.evaluate(() => _doWebViewBack('test-confirm-ok'));
      await sleep(400);

      const s = await snap(page);
      assert.strictEqual(s.page, 'scale-detail', '确认后应返回 scale-detail');
      page.removeAllListeners('dialog');
    });
  } catch (e) {
    log('未预期的错误: ' + e.message);
    console.error(e.stack);
  } finally {
    await browser.close();
  }

  // 汇总
  console.log('\n' + '='.repeat(50));
  console.log(`WebView 返回测试结果：${passed} 通过 / ${failed} 失败 / 共 ${passed + failed} 项`);
  console.log('='.repeat(50));
  results.forEach((r) => log(r));
  if (failed > 0) {
    process.exit(1);
  }
})();
