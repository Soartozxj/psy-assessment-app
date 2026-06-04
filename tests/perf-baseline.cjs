#!/usr/bin/env node
/**
 * 性能基线采集脚本
 *
 * 用法：NODE_PATH=.../node_modules node tests/perf-baseline.cjs [--url BASE_URL]
 * 默认：http://localhost:8080
 *
 * 采集指标：
 *   1. 首页加载时间（DOMContentLoaded / Load）
 *   2. shared-data.js 加载大小
 *   3. scoring-engine.js 加载大小
 *   4. index.html 文件大小
 *   5. 页面 JS 执行时间
 *   6. 关键页面切换时间（首页 → 量表列表 → 量表详情 → 答题）
 *
 * 输出：JSON 格式的性能报告，保存到 tests/perf-baseline.json
 */

const { chromium } = require('chromium' in require ? '.' : 'playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const URL = (process.argv.find((a) => a.startsWith('--url')) || '--url=http://localhost:8080').split('=')[1];
const FRONTEND_URL = URL + '/mini-app-h5/frontend/index.html';
const OUTPUT = path.join(__dirname, 'perf-baseline.json');

async function fetchSize(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, { timeout: 10000 }, (res) => {
        let size = 0;
        res.on('data', (chunk) => (size += chunk.length));
        res.on('end', () => resolve({ url, size, status: res.statusCode }));
      })
      .on('error', reject);
  });
}

function ms(elapsed) {
  return Math.round(elapsed);
}

(async () => {
  console.log(`\n性能基线采集：${URL}\n`);
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: URL,
    resources: {},
    timings: {},
    warnings: []
  };

  // ===== 1. 静态资源大小 =====
  console.log('📊 采集静态资源大小...');
  const resources = [
    { name: 'index.html', url: '/mini-app-h5/frontend/index.html' },
    { name: 'shared-data.js', url: '/mini-app-h5/shared-data.js' },
    { name: 'scoring-engine.js', url: '/mini-app-h5/scoring-engine.js' },
    { name: 'cloud-data.js', url: '/mini-app-h5/cloud-data.js' },
    { name: 'cloud-api.js', url: '/mini-app-h5/cloud-api.js' },
    { name: 'data-monitor.js', url: '/mini-app-h5/data-monitor.js' },
    { name: 'admin-legacy.html', url: '/mini-app-h5/backend/admin-legacy.html' }
  ];

  for (const r of resources) {
    try {
      const res = await fetchSize(URL + r.url);
      report.resources[r.name] = {
        size: res.size,
        sizeKB: (res.size / 1024).toFixed(1),
        status: res.status
      };
      console.log(`  ${r.name}: ${(res.size / 1024).toFixed(1)} KB`);
    } catch (e) {
      report.resources[r.name] = { error: e.message };
      report.warnings.push(`${r.name} 加载失败: ${e.message}`);
      console.log(`  ${r.name}: ❌ ${e.message}`);
    }
  }

  // 总前端大小
  const totalKB =
    Object.values(report.resources)
      .filter((r) => r.size)
      .reduce((sum, r) => sum + r.size, 0) / 1024;
  report.resources.totalKB = totalKB.toFixed(1);
  console.log(`  总计: ${totalKB.toFixed(1)} KB`);

  // ===== 2. 页面加载时间 =====
  console.log('\n⏱️ 采集页面加载时间...');

  let browser, page;
  try {
    browser = await chromium.launch();
    const ctx = await browser.newContext();
    page = await ctx.newPage();

    // 首页加载
    const [domReady, fullLoad] = await page.evaluate(() => {
      return new Promise((resolve) => {
        const t0 = performance.timing.navigationStart || Date.now();
        const handler = () => {
          const t = performance.timing;
          resolve([t.domContentLoadedEventEnd - t.navigationStart, t.loadEventEnd - t.navigationStart]);
        };
        window.addEventListener('load', handler);
      });
    });

    report.timings.domContentLoaded = ms(domReady);
    report.timings.fullLoad = ms(fullLoad);
    console.log(`  DOMContentLoaded: ${ms(domReady)} ms`);
    console.log(`  Full Load: ${ms(fullLoad)} ms`);

    // 关闭弹窗
    await page.evaluate(() => {
      document
        .querySelectorAll('.privacy-modal, .privacy-modal-overlay, .fb-modal, .fb-modal-overlay')
        .forEach((el) => {
          el.style.display = 'none';
        });
    });
    await page.waitForTimeout(500);

    // 页面切换时间
    const navTimings = {};

    const t1 = await page.evaluate(() => {
      const start = performance.now();
      showPage('scale-list', true);
      return performance.now() - start;
    });
    navTimings['home → scale-list'] = ms(t1);
    console.log(`  home → scale-list: ${ms(t1)} ms`);

    const t2 = await page.evaluate(() => {
      const start = performance.now();
      showPage('scale-detail', true);
      return performance.now() - start;
    });
    navTimings['scale-list → scale-detail'] = ms(t2);
    console.log(`  scale-list → scale-detail: ${ms(t2)} ms`);

    const t3 = await page.evaluate(() => {
      const start = performance.now();
      showPage('assessment', true);
      return performance.now() - start;
    });
    navTimings['scale-detail → assessment'] = ms(t3);
    console.log(`  scale-detail → assessment: ${ms(t3)} ms`);

    report.timings.navigation = navTimings;

    // 返回时间
    await page.waitForTimeout(100);
    const t4 = await page.evaluate(() => {
      const start = performance.now();
      goBack();
      return performance.now() - start;
    });
    navTimings['assessment → scale-detail (goBack)'] = ms(t4);
    console.log(`  assessment → scale-detail (goBack): ${ms(t4)} ms`);

    // JS Heap
    const heap = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + ' MB',
          totalJSHeapSize: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1) + ' MB'
        };
      }
      return null;
    });
    if (heap) {
      report.timings.jsHeap = heap;
      console.log(`  JS Heap: ${heap.usedJSHeapSize} / ${heap.totalJSHeapSize}`);
    }
  } catch (e) {
    report.timings.error = e.message;
    report.warnings.push('页面计时采集失败: ' + e.message);
    console.log(`  ❌ 页面计时采集失败: ${e.message}`);
  } finally {
    if (browser) await browser.close();
  }

  // ===== 3. 阈值检查 =====
  console.log('\n⚠️  阈值检查:');

  if (report.timings.domContentLoaded > 2000) {
    report.warnings.push(`DOMContentLoaded ${report.timings.domContentLoaded}ms > 2000ms`);
    console.log(`  ⚠️ DOMContentLoaded 偏慢: ${report.timings.domContentLoaded}ms`);
  } else {
    console.log(`  ✅ DOMContentLoaded 正常: ${report.timings.domContentLoaded}ms`);
  }

  if (report.timings.fullLoad > 5000) {
    report.warnings.push(`Full Load ${report.timings.fullLoad}ms > 5000ms`);
    console.log(`  ⚠️ Full Load 偏慢: ${report.timings.fullLoad}ms`);
  } else {
    console.log(`  ✅ Full Load 正常: ${report.timings.fullLoad}ms`);
  }

  const sharedDataKB = parseFloat(report.resources['shared-data.js']?.sizeKB || 0);
  if (sharedDataKB > 200) {
    report.warnings.push(`shared-data.js ${sharedDataKB}KB > 200KB`);
    console.log(`  ⚠️ shared-data.js 较大: ${sharedDataKB}KB`);
  } else {
    console.log(`  ✅ shared-data.js 大小正常: ${sharedDataKB}KB`);
  }

  // 保存报告
  fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2));
  console.log(`\n📄 报告已保存: ${OUTPUT}`);

  // 汇总
  console.log('\n' + '='.repeat(50));
  if (report.warnings.length === 0) {
    console.log('✅ 所有性能指标正常');
  } else {
    console.log(`⚠️  ${report.warnings.length} 个警告`);
    report.warnings.forEach((w) => console.log(`  - ${w}`));
  }
})();
