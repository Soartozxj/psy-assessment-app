/**
 * SSRS 新题型本地测试脚本 v2
 * 直接通过 JS 调用 startAssessment 跳过 UI 导航
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 375, height: 720 } });
  const page = await context.newPage();

  // 1. 打开前端页面
  console.log('📋 打开前端页面...');
  await page.goto('http://localhost:8080/mini-app-h5/frontend/index.html');
  await page.waitForTimeout(3000);

  // 2. 注入 SSRS 数据到 localStorage
  console.log('💾 注入 SSRS 数据...');
  const scalesData = JSON.parse(fs.readFileSync('/Users/rich/WorkBuddy/20260407113106/scales-data.json', 'utf-8'));
  await page.evaluate((data) => {
    localStorage.setItem('psy_scales_data', JSON.stringify(data));
    const active = data.filter(s => s.status === 1 || s.status === undefined);
    localStorage.setItem('psy_scales_synced', JSON.stringify(active));
    // 强制刷新 SharedData 缓存
    if (window.SharedData) {
      window.SCALES = SharedData.getActiveScales();
      console.log('✅ SharedData 刷新，量表数:', window.SCALES.length);
    }
  }, scalesData);

  // 3. 如果 SCALES 仍为空，直接设置
  const scalesCount = await page.evaluate(() => {
    return window.SCALES ? window.SCALES.length : 0;
  });
  if (scalesCount === 0) {
    console.log('⚠️ SCALES 仍为空，尝试强制设置...');
    await page.evaluate((data) => {
      const active = data.filter(s => s.status === 1 || s.status === undefined);
      window.SCALES = active.map(s => normalizeScaleData ? normalizeScaleData(s) : s);
      console.log('✅ 强制设置 SCALES，量表数:', window.SCALES.length);
    }, scalesData);
  }

  // 4. 找到 SSRS 量表
  console.log('🔍 查找 SSRS 量表...');
  const ssrsInfo = await page.evaluate(() => {
    if (typeof SCALES === 'undefined' || !SCALES) return { error: 'SCALES undefined' };
    const ssrs = SCALES.find(s => s.name && s.name.includes('社会支持'));
    if (!ssrs) return { error: 'SSRS not found', names: SCALES.map(s => s.name) };
    return { found: true, index: SCALES.indexOf(ssrs), name: ssrs.name, qCount: ssrs.questions.length };
  });
  console.log('查找结果:', JSON.stringify(ssrsInfo));

  if (ssrsInfo.error) {
    console.error('❌', ssrsInfo.error);
    await browser.close();
    return;
  }

  // 5. 验证 SSRS 题目结构
  const questionsInfo = await page.evaluate(() => {
    const ssrs = SCALES.find(s => s.name && s.name.includes('社会支持'));
    if (!ssrs) return null;
    return ssrs.questions.map(q => ({
      id: q.id,
      type: q.type || 'radio',
      opts: (q.options || []).length,
      rows: q.rows ? q.rows.length : 0,
      subs: q.subOptions ? q.subOptions.length : 0
    }));
  });
  console.log('题目结构:');
  questionsInfo.forEach(q => {
    console.log(`  Q${q.id}: type=${q.type}, opts=${q.opts}, rows=${q.rows}, subs=${q.subs}`);
  });

  // 6. 通过 JS 直接调用 startAssessment
  console.log('\n▶️ 直接调用 startAssessment...');
  await page.evaluate((idx) => {
    const scale = SCALES[idx];
    if (scale) startAssessment(scale);
  }, ssrsInfo.index);
  await page.waitForTimeout(3000); // 等待欢迎页

  // 7. 点击确认通过欢迎阶段
  const confirmText = await page.evaluate(() => {
    const el = document.getElementById('npc-confirm-text');
    return el ? el.textContent : '';
  });
  console.log('欢迎阶段确认按钮文案:', confirmText);

  const confirmBtn = await page.$('#npc-confirm-btn');
  if (confirmBtn) {
    await confirmBtn.click({ force: true });
    await page.waitForTimeout(3000);
    console.log('✅ 已通过欢迎阶段');
  }

  // 8. 检查 Q1 渲染
  console.log('\n📝 Q1 渲染检查...');
  await page.waitForTimeout(1000);
  let q1Opts = await page.$$eval('#npc-options-area .npc-option-btn', els => els.length);
  console.log(`Q1 选项数: ${q1Opts} (预期 4)`);

  if (q1Opts === 0) {
    await page.waitForTimeout(3000);
    q1Opts = await page.$$eval('#npc-options-area .npc-option-btn', els => els.length);
    console.log(`等待后 Q1 选项数: ${q1Opts}`);
    if (q1Opts === 0) {
      await page.screenshot({ path: '/tmp/ssrs-debug-v2.png' });
      console.log('截图: /tmp/ssrs-debug-v2.png');
      // 检查当前页面
      const pageState = await page.evaluate(() => {
        const pages = document.querySelectorAll('.page');
        const info = [];
        pages.forEach(p => {
          if (p.style.display !== 'none' && p.style.display !== '') {
            info.push({ id: p.id, display: p.style.display });
          }
        });
        return info;
      });
      console.log('可见页面:', JSON.stringify(pageState));
    }
  }

  // 9. 快速通过 Q1~Q4（普通单选）
  console.log('\n📝 通过 Q1~Q4...');
  for (let qi = 0; qi < 4; qi++) {
    await page.waitForTimeout(1000);
    // 等待选项出现
    let opts = await page.$$('#npc-options-area .npc-option-btn');
    let attempts = 0;
    while (opts.length === 0 && attempts < 5) {
      await page.waitForTimeout(1000);
      opts = await page.$$('#npc-options-area .npc-option-btn');
      attempts++;
    }
    if (opts.length === 0) {
      console.log(`  ⚠️ Q${qi + 1}: 无选项，可能已进入结果页`);
      break;
    }

    // 选第3个选项
    await opts[Math.min(2, opts.length - 1)].click();
    await page.waitForTimeout(500);

    // 点击确认
    const cb = await page.$('#npc-confirm-btn');
    if (cb) {
      await page.waitForTimeout(300);
      await cb.click({ force: true });
      await page.waitForTimeout(1500);
      console.log(`  ✅ Q${qi + 1} 已作答`);
    }
  }

  // 10. 检查 Q5 — 矩阵题
  console.log('\n📊 Q5 矩阵题检查...');
  await page.waitForTimeout(1500);
  const matrixInfo = await page.evaluate(() => {
    const form = document.getElementById('npc-matrix-form');
    if (!form) return { found: false };
    const rows = form.querySelectorAll('tbody tr');
    const cols = form.querySelectorAll('thead th');
    return { found: true, rows: rows.length, cols: cols.length - 1 };
  });
  console.log(`  矩阵表格: ${matrixInfo.found ? '✅' : '❌'}`, JSON.stringify(matrixInfo));

  if (matrixInfo.found) {
    // 每行选第3列（index=2，即"一般"=3分）
    for (let r = 0; r < matrixInfo.rows; r++) {
      const radio = await page.$(`#npc-matrix-form tbody tr:nth-child(${r + 1}) .matrix-radio:nth-child(4)`);
      if (radio) {
        await radio.click();
        await page.waitForTimeout(200);
      }
    }
    console.log('  ✅ Q5 已作答（每行选"一般"=3分）');

    const cb5 = await page.$('#npc-confirm-btn');
    if (cb5) {
      await cb5.click({ force: true });
      await page.waitForTimeout(1500);
      console.log('  ✅ Q5 已确认');
    }
  }

  // 11. 检查 Q6 — 父子题
  console.log('\n🔗 Q6 父子题检查...');
  await page.waitForTimeout(1500);
  const pc6Info = await page.evaluate(() => {
    const form = document.getElementById('npc-pc-form');
    if (!form) return { found: false };
    const mainOpts = form.querySelectorAll('.npc-option-btn[data-pc-main]');
    return { found: true, mainOpts: mainOpts.length };
  });
  console.log(`  父子题表单: ${pc6Info.found ? '✅' : '❌'}`, JSON.stringify(pc6Info));

  if (pc6Info.found) {
    // 选"下列来源（可选多项）"
    const mainOpts = await page.$$('#npc-pc-form .npc-option-btn[data-pc-main]');
    if (mainOpts.length >= 2) {
      await mainOpts[1].click();
      await page.waitForTimeout(500);

      // 勾选 A、C、F
      const checkboxes = await page.$$('#npc-pc-subs .pc-checkbox');
      console.log(`  子选项数: ${checkboxes.length}`);
      for (const idx of [0, 2, 5]) {
        if (checkboxes[idx]) {
          await checkboxes[idx].click();
          await page.waitForTimeout(200);
        }
      }
      console.log('  ✅ Q6 已作答（A/C/F = 3分）');

      const cb6 = await page.$('#npc-confirm-btn');
      if (cb6) {
        await cb6.click({ force: true });
        await page.waitForTimeout(1500);
        console.log('  ✅ Q6 已确认');
      }
    }
  }

  // 12. Q7 — 选"无任何来源"
  console.log('\n🔗 Q7 父子题检查...');
  await page.waitForTimeout(1500);
  const pc7Info = await page.evaluate(() => {
    const form = document.getElementById('npc-pc-form');
    if (!form) return { found: false };
    return { found: true };
  });
  console.log(`  Q7 父子题: ${pc7Info.found ? '✅' : '❌'}`);

  if (pc7Info.found) {
    const mainOpts7 = await page.$$('#npc-pc-form .npc-option-btn[data-pc-main]');
    if (mainOpts7.length >= 1) {
      await mainOpts7[0].click(); // "无任何来源"
      await page.waitForTimeout(500);
      console.log('  ✅ Q7 已作答（无任何来源 = 0分）');

      const cb7 = await page.$('#npc-confirm-btn');
      if (cb7) {
        await cb7.click({ force: true });
        await page.waitForTimeout(1500);
        console.log('  ✅ Q7 已确认');
      }
    }
  }

  // 13. 通过 Q8~Q10
  console.log('\n📝 通过 Q8~Q10...');
  for (let qi = 0; qi < 3; qi++) {
    await page.waitForTimeout(1000);
    let opts = await page.$$('#npc-options-area .npc-option-btn');
    let attempts = 0;
    while (opts.length === 0 && attempts < 5) {
      await page.waitForTimeout(1000);
      opts = await page.$$('#npc-options-area .npc-option-btn');
      attempts++;
    }

    // 检查是否是最后一题（有 #npc-last-form）
    const lastForm = await page.$('#npc-last-form');
    if (lastForm) {
      const lastOpts = await lastForm.$$('.npc-option-btn');
      if (lastOpts.length > 0) {
        await lastOpts[Math.min(2, lastOpts.length - 1)].click();
        await page.waitForTimeout(3000);
        console.log(`  ✅ Q${8 + qi} (最后一题) 已提交`);
        break;
      }
    }

    if (opts.length > 0) {
      await opts[Math.min(2, opts.length - 1)].click();
      await page.waitForTimeout(500);
      const cb = await page.$('#npc-confirm-btn');
      if (cb) {
        await cb.click({ force: true });
        await page.waitForTimeout(1500);
        console.log(`  ✅ Q${8 + qi} 已作答`);
      }
    } else {
      console.log(`  ⚠️ Q${8 + qi} 无选项`);
      break;
    }
  }

  // 14. 等待结果页
  console.log('\n📊 等待结果页...');
  await page.waitForTimeout(5000);

  // 15. 检查结果
  const resultVisible = await page.evaluate(() => {
    const rp = document.getElementById('page-result');
    return rp && rp.style.display !== 'none';
  });

  if (resultVisible) {
    console.log('✅ 结果页已显示');

    // 打印 answers 数据
    const answersData = await page.evaluate(() => {
      if (typeof answers === 'undefined') return { error: 'answers undefined' };
      return answers;
    });
    console.log('\n📋 Answers 数据:');
    console.log(JSON.stringify(answersData, null, 2));

    // 验证各题型答案格式
    console.log('\n🔍 答案格式验证:');
    if (typeof answersData[5] === 'object') {
      console.log(`  Q5 (matrix): ✅ object, ${JSON.stringify(answersData[5])}`);
    } else {
      console.log(`  Q5 (matrix): ❌ ${typeof answersData[5]}`);
    }
    if (typeof answersData[6] === 'object' && answersData[6].subs) {
      console.log(`  Q6 (parent-child): ✅ object, main=${answersData[6].main}, subs=${JSON.stringify(answersData[6].subs)}`);
    } else {
      console.log(`  Q6 (parent-child): ❌ ${typeof answersData[6]}`);
    }
    if (typeof answersData[7] === 'object' && answersData[7].main === 0) {
      console.log(`  Q7 (parent-child): ✅ object, main=${answersData[7].main}, subs=${JSON.stringify(answersData[7].subs)}`);
    } else {
      console.log(`  Q7 (parent-child): ❌ ${typeof answersData[7]}`);
    }

    // 验证计分
    const scores = await page.evaluate(() => {
      const s = currentAssessScale;
      if (!s || !s.scoring || typeof ScoringEngine === 'undefined') return { error: 'no scoring engine' };
      try {
        const result = ScoringEngine.calculate(s, answers);
        return {
          totalScore: result.metrics.totalScore,
          dims: result.dimensions.map(d => ({ key: d.key, score: d.score })),
          maxTotal: result.maxScores ? result.maxScores.total : null
        };
      } catch(e) {
        return { error: e.message };
      }
    });
    console.log('\n📊 ScoringEngine 计分结果:');
    console.log(JSON.stringify(scores, null, 2));
    console.log('\n🔢 预期：总分 3+3+3+3+15+3+0+3+3+3=39');

    await page.screenshot({ path: '/tmp/ssrs-result-v2.png' });
    console.log('截图: /tmp/ssrs-result-v2.png');
  } else {
    console.log('❌ 结果页未显示');
    const pageState = await page.evaluate(() => {
      const pages = document.querySelectorAll('.page');
      const info = [];
      pages.forEach(p => {
        if (p.style.display !== 'none' && p.style.display !== '') {
          info.push(p.id);
        }
      });
      return info;
    });
    console.log('当前可见页面:', pageState);
    await page.screenshot({ path: '/tmp/ssrs-debug-result.png' });
  }

  console.log('\n⏳ 浏览器保持打开 10 秒供检查...');
  await page.waitForTimeout(10000);
  await browser.close();
  console.log('🏁 测试结束');
})();
