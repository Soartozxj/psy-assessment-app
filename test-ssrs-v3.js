/**
 * SSRS 新题型本地测试脚本 v3
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

  // 2. 注入 SSRS 数据
  console.log('💾 注入 SSRS 数据...');
  const scalesData = JSON.parse(fs.readFileSync('/Users/rich/WorkBuddy/20260407113106/scales-data.json', 'utf-8'));
  const active = scalesData.filter(s => s.status === 1 || s.status === undefined);

  // 使用 addInitScript 在页面加载前注入 localStorage
  // 先关闭当前页面，设置 initScript 后重新打开
  await context.addInitScript((scalesStr) => {
    const data = JSON.parse(scalesStr);
    localStorage.setItem('psy_scales_data', JSON.stringify(data));
    const active = data.filter(s => s.status === 1 || s.status === undefined);
    localStorage.setItem('psy_scales_synced', JSON.stringify(active));
  }, JSON.stringify(scalesData));

  // 重新打开页面（initScript 会在页面加载前执行）
  console.log('🔄 重新加载页面...');
  await page.goto('http://localhost:8080/mini-app-h5/frontend/index.html');
  await page.waitForTimeout(4000); // 等待 shared-data.js + initPageAfterSharedData

  // 3. 验证 SCALES 已加载
  const ssrsInfo = await page.evaluate(() => {
    if (typeof SCALES === 'undefined' || !SCALES || SCALES.length === 0) {
      return { error: 'SCALES empty', scType: typeof SCALES, sdType: typeof SharedData };
    }
    const ssrs = SCALES.find(s => s.name && s.name.includes('社会支持'));
    if (!ssrs) return { error: 'SSRS not found', count: SCALES.length, names: SCALES.map(s => s.name).slice(0, 3) };
    return { found: true, name: ssrs.name, qCount: ssrs.questions.length };
  });
  console.log('查找结果:', JSON.stringify(ssrsInfo));

  if (ssrsInfo.error) {
    console.error('❌', ssrsInfo.error);
    await page.screenshot({ path: '/tmp/ssrs-debug-v3.png' });
    await browser.close();
    return;
  }

  // 4. 验证 SSRS 题目结构
  const questionsInfo = await page.evaluate(() => {
    const ssrs = SCALES.find(s => s.name && s.name.includes('社会支持'));
    if (!ssrs) return null;
    return ssrs.questions.map(q => ({
      id: q.id, type: q.type || 'radio',
      opts: (q.options || []).length,
      rows: q.rows ? q.rows.length : 0,
      subs: q.subOptions ? q.subOptions.length : 0
    }));
  });
  console.log('题目结构:');
  questionsInfo.forEach(q => {
    console.log(`  Q${q.id}: type=${q.type}, opts=${q.opts}, rows=${q.rows}, subs=${q.subs}`);
  });

  // 5. 通过 JS 直接调用 startAssessment
  console.log('\n▶️ 开始测评...');
  const startResult = await page.evaluate(() => {
    const ssrs = SCALES.find(s => s.name && s.name.includes('社会支持'));
    if (!ssrs) return { error: 'SSRS not found' };
    // 调用 startAssessment（接受 scale 参数或从 currentDetailScale 读取）
    currentDetailScale = ssrs;
    startAssessment();
    return { ok: true };
  });
  console.log('开始结果:', JSON.stringify(startResult));
  await page.waitForTimeout(4000); // 等待欢迎页 + 动画

  // 6. 通过欢迎阶段
  console.log('📝 通过欢迎阶段...');
  const welcomeText = await page.evaluate(() => {
    const el = document.getElementById('npc-confirm-text');
    return el ? el.textContent : '';
  });
  console.log('  确认文案:', welcomeText);

  if (welcomeText.includes('开始') || welcomeText.includes('确认') || welcomeText.includes('了解')) {
    const cb = await page.$('#npc-confirm-btn');
    if (cb) {
      await cb.click({ force: true });
      await page.waitForTimeout(3000);
      console.log('  ✅ 已通过欢迎阶段');
    }
  }

  // 7. 检查 Q1 选项
  await page.waitForTimeout(1500);
  let q1Opts = await page.$$eval('#npc-options-area .npc-option-btn', els => els.length);
  console.log(`\n📝 Q1 选项数: ${q1Opts}`);
  if (q1Opts === 0) {
    await page.waitForTimeout(3000);
    q1Opts = await page.$$eval('#npc-options-area .npc-option-btn', els => els.length);
    console.log(`  等待后: ${q1Opts}`);
    if (q1Opts === 0) {
      await page.screenshot({ path: '/tmp/ssrs-debug-q1v3.png' });
      console.log('截图: /tmp/ssrs-debug-q1v3.png');
      const state = await page.evaluate(() => {
        const pages = document.querySelectorAll('.page');
        return Array.from(pages).filter(p => p.style.display !== 'none').map(p => p.id);
      });
      console.log('可见页面:', state);
      await browser.close();
      return;
    }
  }

  // 8. 通过 Q1~Q4（普通单选，选第3个选项=3分）
  console.log('\n📝 通过 Q1~Q4...');
  for (let qi = 0; qi < 4; qi++) {
    await page.waitForTimeout(800);
    let opts = await page.$$('#npc-options-area .npc-option-btn');
    let retries = 0;
    while (opts.length === 0 && retries < 5) {
      await page.waitForTimeout(1000);
      opts = await page.$$('#npc-options-area .npc-option-btn');
      retries++;
    }
    if (opts.length === 0) { console.log(`  ⚠️ Q${qi+1}: 无选项`); break; }

    await opts[Math.min(2, opts.length - 1)].click();
    await page.waitForTimeout(400);
    const cb = await page.$('#npc-confirm-btn');
    if (cb) {
      await cb.click({ force: true });
      await page.waitForTimeout(1500);
      console.log(`  ✅ Q${qi+1} done`);
    }
  }

  // 9. Q5 矩阵题
  console.log('\n📊 Q5 矩阵题...');
  await page.waitForTimeout(1500);
  const mInfo = await page.evaluate(() => {
    const f = document.getElementById('npc-matrix-form');
    if (!f) return { found: false };
    return { found: true, rows: f.querySelectorAll('tbody tr').length, cols: f.querySelectorAll('thead th').length - 1 };
  });
  console.log(`  ${mInfo.found ? '✅' : '❌'} ${JSON.stringify(mInfo)}`);

  if (mInfo.found) {
    for (let r = 0; r < mInfo.rows; r++) {
      const radio = await page.$(`#npc-matrix-form tbody tr:nth-child(${r+1}) .matrix-radio:nth-child(4)`);
      if (radio) { await radio.click(); await page.waitForTimeout(150); }
    }
    console.log('  ✅ 每行选"一般"(3分)');
    const cb5 = await page.$('#npc-confirm-btn');
    if (cb5) { await cb5.click({ force: true }); await page.waitForTimeout(1500); }
    console.log('  ✅ Q5 已确认');
  }

  // 10. Q6 父子题
  console.log('\n🔗 Q6 父子题...');
  await page.waitForTimeout(1500);
  const p6 = await page.evaluate(() => !!document.getElementById('npc-pc-form'));
  console.log(`  ${p6 ? '✅' : '❌'} 表单已渲染`);

  if (p6) {
    const mainOpts = await page.$$('#npc-pc-form .npc-option-btn[data-pc-main]');
    if (mainOpts.length >= 2) {
      await mainOpts[1].click(); // "下列来源"
      await page.waitForTimeout(500);
      const cbs = await page.$$('#npc-pc-subs .pc-checkbox');
      console.log(`  子选项数: ${cbs.length}`);
      for (const idx of [0, 2, 5]) { // A, C, F
        if (cbs[idx]) { await cbs[idx].click(); await page.waitForTimeout(150); }
      }
      console.log('  ✅ 勾选 A/C/F (3分)');
      const cb6 = await page.$('#npc-confirm-btn');
      if (cb6) { await cb6.click({ force: true }); await page.waitForTimeout(1500); }
      console.log('  ✅ Q6 已确认');
    }
  }

  // 11. Q7 父子题（选"无任何来源"）
  console.log('\n🔗 Q7 父子题...');
  await page.waitForTimeout(1500);
  const p7 = await page.evaluate(() => !!document.getElementById('npc-pc-form'));
  console.log(`  ${p7 ? '✅' : '❌'} 表单已渲染`);

  if (p7) {
    const mainOpts7 = await page.$$('#npc-pc-form .npc-option-btn[data-pc-main]');
    if (mainOpts7.length >= 1) {
      await mainOpts7[0].click(); // "无任何来源"
      await page.waitForTimeout(500);
      console.log('  ✅ 选"无任何来源"(0分)');
      const cb7 = await page.$('#npc-confirm-btn');
      if (cb7) { await cb7.click({ force: true }); await page.waitForTimeout(1500); }
      console.log('  ✅ Q7 已确认');
    }
  }

  // 12. Q8~Q10
  console.log('\n📝 通过 Q8~Q10...');
  for (let qi = 0; qi < 3; qi++) {
    await page.waitForTimeout(800);
    // 检查是否是最后一题
    const lastForm = await page.$('#npc-last-form');
    if (lastForm) {
      const lastOpts = await lastForm.$$('.npc-option-btn');
      if (lastOpts.length > 0) {
        await lastOpts[Math.min(2, lastOpts.length - 1)].click();
        await page.waitForTimeout(3000);
        console.log(`  ✅ Q${8+qi} (最后一题) done`);
        break;
      }
    }
    let opts = await page.$$('#npc-options-area .npc-option-btn');
    let retries = 0;
    while (opts.length === 0 && retries < 5) {
      await page.waitForTimeout(1000);
      opts = await page.$$('#npc-options-area .npc-option-btn');
      retries++;
    }
    if (opts.length > 0) {
      await opts[Math.min(2, opts.length - 1)].click();
      await page.waitForTimeout(400);
      const cb = await page.$('#npc-confirm-btn');
      if (cb) { await cb.click({ force: true }); await page.waitForTimeout(1500); }
      console.log(`  ✅ Q${8+qi} done`);
    } else {
      console.log(`  ⚠️ Q${8+qi}: 无选项`);
      break;
    }
  }

  // 13. 等待结果页
  console.log('\n📊 等待结果页...');
  await page.waitForTimeout(5000);

  // 14. 检查结果
  const result = await page.evaluate(() => {
    if (typeof answers === 'undefined') return { error: 'answers undefined' };
    if (typeof ScoringEngine === 'undefined') return { error: 'ScoringEngine undefined' };
    const s = currentAssessScale;
    if (!s || !s.scoring) return { error: 'no scoring config' };

    // 验证答案格式
    const q5ans = answers[5];
    const q6ans = answers[6];
    const q7ans = answers[7];

    // 计分
    let seResult;
    try {
      seResult = ScoringEngine.calculate(s, answers);
    } catch(e) {
      seResult = { error: e.message };
    }

    return {
      answers: {
        q1: answers[1], q2: answers[2], q3: answers[3], q4: answers[4],
        q5: q5ans, q6: q6ans, q7: q7ans,
        q8: answers[8], q9: answers[9], q10: answers[10]
      },
      scoring: seResult.error ? { error: seResult.error } : {
        totalScore: seResult.metrics.totalScore,
        dims: seResult.dimensions.map(d => ({ key: d.key, score: d.score })),
        maxTotal: seResult.maxScores ? seResult.maxScores.total : null
      }
    };
  });

  console.log('\n📋 Answers:');
  console.log(JSON.stringify(result.answers, null, 2));

  console.log('\n📊 ScoringEngine:');
  console.log(JSON.stringify(result.scoring, null, 2));

  console.log('\n🔍 验证:');
  const q5ok = typeof result.answers.q5 === 'object' && !Array.isArray(result.answers.q5);
  const q6ok = typeof result.answers.q6 === 'object' && Array.isArray(result.answers.q6.subs);
  const q7ok = typeof result.answers.q7 === 'object' && result.answers.q7.main === 0;
  console.log(`  Q5 matrix: ${q5ok ? '✅' : '❌'} ${JSON.stringify(result.answers.q5)}`);
  console.log(`  Q6 parent-child: ${q6ok ? '✅' : '❌'} ${JSON.stringify(result.answers.q6)}`);
  console.log(`  Q7 parent-child: ${q7ok ? '✅' : '❌'} ${JSON.stringify(result.answers.q7)}`);

  if (result.scoring.totalScore !== undefined) {
    console.log(`\n🎯 总分: ${result.scoring.totalScore}`);
    console.log(`   预期: 39 (3+3+3+3+15+3+0+3+3+3)`);
    console.log(`   ${result.scoring.totalScore === 39 ? '✅ 完全正确！' : '⚠️ 分数不符'}`);
    console.log(`   满分: ${result.scoring.maxTotal}`);
  } else {
    console.log(`\n❌ 计分失败:`, result.scoring.error);
  }

  await page.screenshot({ path: '/tmp/ssrs-result-v3.png' });
  console.log('\n截图: /tmp/ssrs-result-v3.png');

  console.log('\n⏳ 浏览器保持打开 10 秒...');
  await page.waitForTimeout(10000);
  await browser.close();
  console.log('🏁 测试结束');
})();
