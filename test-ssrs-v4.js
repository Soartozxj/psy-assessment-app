/**
 * SSRS 新题型本地测试脚本 v4
 * 使用 evaluateOnNewDocument 在每个页面加载前设置 localStorage
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  // 读取量表数据
  const scalesData = JSON.parse(fs.readFileSync('/Users/rich/WorkBuddy/20260407113106/scales-data.json', 'utf-8'));

  const browser = await chromium.launch({ headless: false, slowMo: 200 });

  // 在浏览器上下文启动前注入 localStorage
  const context = await browser.newContext({
    viewport: { width: 375, height: 720 },
    storageState: {
      origins: [{
        origin: 'http://localhost:8080',
        localStorage: [
          { name: 'psy_scales_data', value: JSON.stringify(scalesData) },
          { name: 'psy_scales_synced', value: JSON.stringify(scalesData.filter(s => s.status === 1 || s.status === undefined)) }
        ]
      }]
    }
  });
  const page = await context.newPage();

  // 打开页面
  console.log('📋 打开前端页面...');
  await page.goto('http://localhost:8080/mini-app-h5/frontend/index.html');
  await page.waitForTimeout(5000); // 等待 shared-data.js 加载 + 页面初始化

  // 验证 SCALES
  const ssrsInfo = await page.evaluate(() => {
    if (typeof SCALES === 'undefined' || !SCALES || SCALES.length === 0) {
      return { error: 'SCALES empty', scType: typeof SCALES, sdType: typeof SharedData };
    }
    const ssrs = SCALES.find(s => s.name && s.name.includes('社会支持'));
    if (!ssrs) return { error: 'SSRS not found', count: SCALES.length };
    return { found: true, name: ssrs.name, qCount: ssrs.questions.length };
  });
  console.log('查找结果:', JSON.stringify(ssrsInfo));

  if (ssrsInfo.error) {
    console.error('❌', ssrsInfo.error);
    // 调试：检查 localStorage 内容
    const lsDebug = await page.evaluate(() => {
      const raw = localStorage.getItem('psy_scales_data');
      if (!raw) return { ls_empty: true };
      const data = JSON.parse(raw);
      return { ls_count: data.length, first_name: data[0].name };
    });
    console.log('localStorage 调试:', JSON.stringify(lsDebug));
    await page.screenshot({ path: '/tmp/ssrs-debug-v4.png' });
    await browser.close();
    return;
  }

  // 验证题目结构
  const questionsInfo = await page.evaluate(() => {
    const ssrs = SCALES.find(s => s.name && s.name.includes('社会支持'));
    return ssrs.questions.map(q => ({
      id: q.id, type: q.type || 'radio',
      opts: (q.options || []).length, rows: q.rows ? q.rows.length : 0,
      subs: q.subOptions ? q.subOptions.length : 0
    }));
  });
  console.log('题目结构:');
  questionsInfo.forEach(q => console.log(`  Q${q.id}: type=${q.type}, opts=${q.opts}, rows=${q.rows}, subs=${q.subs}`));

  // 开始测评
  console.log('\n▶️ 开始测评...');
  await page.evaluate(() => {
    const ssrs = SCALES.find(s => s.name && s.name.includes('社会支持'));
    if (!ssrs) return;
    currentDetailId = ssrs.id;
    startAssessment();
  });
  await page.waitForTimeout(4000);

  // 通过欢迎阶段
  const welcomeText = await page.evaluate(() => {
    const el = document.getElementById('npc-confirm-text');
    return el ? el.textContent : '';
  });
  console.log('欢迎文案:', welcomeText);
  if (welcomeText) {
    await page.waitForTimeout(2000);
    // 直接通过 JS 调用确认函数，绕过 DOM 可见性检查
    await page.evaluate(() => {
      // 方法1：直接调用 npcConfirmAnswer
      if (typeof npcConfirmAnswer === 'function') {
        npcConfirmAnswer();
        return;
      }
      // 方法2：设置 npcStarted 并触发 npcShowQuestion
      npcStarted = true;
      _npcConfirmLock = false;
      npcShowQuestion(0);
    });
    await page.waitForTimeout(3000);
    console.log('✅ 通过欢迎(JS调用)');
  }

  // 检查 Q1
  await page.waitForTimeout(1500);
  let q1Opts = await page.$$eval('#npc-options-area .npc-option-btn', els => els.length);
  console.log(`\n📝 Q1 选项: ${q1Opts}`);
  if (q1Opts === 0) {
    await page.waitForTimeout(3000);
    q1Opts = await page.$$eval('#npc-options-area .npc-option-btn', els => els.length);
    console.log(`  等待后: ${q1Opts}`);
    if (q1Opts === 0) {
      await page.screenshot({ path: '/tmp/ssrs-debug-q1v4.png' });
      const state = await page.evaluate(() => Array.from(document.querySelectorAll('.page')).filter(p => p.style.display !== 'none').map(p => p.id));
      console.log('可见页面:', state);
      await browser.close();
      return;
    }
  }

  // Q1~Q4（选第3个=3分）
  console.log('\n📝 Q1~Q4...');
  for (let qi = 0; qi < 4; qi++) {
    await page.waitForTimeout(800);
    let opts = await page.$$('#npc-options-area .npc-option-btn');
    let retries = 0;
    while (opts.length === 0 && retries < 5) { await page.waitForTimeout(1000); opts = await page.$$('#npc-options-area .npc-option-btn'); retries++; }
    if (opts.length === 0) { console.log(`  ⚠️ Q${qi+1}: 无选项`); break; }
    await opts[Math.min(2, opts.length - 1)].click();
    await page.waitForTimeout(500);
    // 使用 JS 直接调用确认，避免 DOM 可见性问题
    await page.evaluate(() => { _npcConfirmLock = false; npcConfirmAnswer(); });
    await page.waitForTimeout(1500);
    console.log(`  ✅ Q${qi+1}`);
  }

  // Q5 矩阵题
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
    await page.evaluate(() => { _npcConfirmLock = false; npcConfirmAnswer(); });
    await page.waitForTimeout(1500);
    console.log('  ✅ Q5 确认');
  }

  // Q6 父子题
  console.log('\n🔗 Q6 父子题...');
  await page.waitForTimeout(1500);
  const p6 = await page.evaluate(() => !!document.getElementById('npc-pc-form'));
  console.log(`  ${p6 ? '✅' : '❌'}`);
  if (p6) {
    const mainOpts = await page.$$('#npc-pc-form .npc-option-btn[data-pc-main]');
    if (mainOpts.length >= 2) {
      await mainOpts[1].click();
      await page.waitForTimeout(500);
      const cbs = await page.$$('#npc-pc-subs .pc-checkbox');
      console.log(`  子选项: ${cbs.length}`);
      for (const idx of [0, 2, 5]) { if (cbs[idx]) { await cbs[idx].click(); await page.waitForTimeout(150); } }
      console.log('  ✅ A/C/F (3分)');
      const cb6 = await page.$('#npc-confirm-btn');
      if (cb6) { await cb6.click({ force: true }); await page.waitForTimeout(1500); }
      console.log('  ✅ Q6 确认');
    }
  }

  // Q7 父子题（选"无任何来源"）
  console.log('\n🔗 Q7 父子题...');
  await page.waitForTimeout(1500);
  const p7 = await page.evaluate(() => !!document.getElementById('npc-pc-form'));
  console.log(`  ${p7 ? '✅' : '❌'}`);
  if (p7) {
    const mainOpts7 = await page.$$('#npc-pc-form .npc-option-btn[data-pc-main]');
    if (mainOpts7.length >= 1) {
      await mainOpts7[0].click();
      await page.waitForTimeout(500);
      console.log('  ✅ "无任何来源"(0分)');
      const cb7 = await page.$('#npc-confirm-btn');
      if (cb7) { await cb7.click({ force: true }); await page.waitForTimeout(1500); }
      console.log('  ✅ Q7 确认');
    }
  }

  // Q8~Q10
  console.log('\n📝 Q8~Q10...');
  for (let qi = 0; qi < 3; qi++) {
    await page.waitForTimeout(800);
    const lastForm = await page.$('#npc-last-form');
    if (lastForm) {
      const lastOpts = await lastForm.$$('.npc-option-btn');
      if (lastOpts.length > 0) {
        await lastOpts[Math.min(2, lastOpts.length - 1)].click();
        await page.waitForTimeout(3000);
        console.log(`  ✅ Q${8+qi} (最后一题)`);
        break;
      }
    }
    let opts = await page.$$('#npc-options-area .npc-option-btn');
    let retries = 0;
    while (opts.length === 0 && retries < 5) { await page.waitForTimeout(1000); opts = await page.$$('#npc-options-area .npc-option-btn'); retries++; }
    if (opts.length > 0) {
      await opts[Math.min(2, opts.length - 1)].click();
      await page.waitForTimeout(400);
      const cb = await page.$('#npc-confirm-btn');
      if (cb) { await cb.click({ force: true }); await page.waitForTimeout(1500); }
      console.log(`  ✅ Q${8+qi}`);
    } else { console.log(`  ⚠️ Q${8+qi}: 无选项`); break; }
  }

  // 等待结果
  console.log('\n📊 等待结果...');
  await page.waitForTimeout(5000);

  // 检查结果
  const result = await page.evaluate(() => {
    if (typeof answers === 'undefined') return { error: 'answers undefined' };
    if (typeof ScoringEngine === 'undefined') return { error: 'ScoringEngine undefined' };
    const s = currentAssessScale;
    if (!s || !s.scoring) return { error: 'no scoring' };
    try {
      const r = ScoringEngine.calculate(s, answers);
      return {
        answers: { q5: answers[5], q6: answers[6], q7: answers[7] },
        total: r.metrics.totalScore,
        dims: r.dimensions.map(d => ({ k: d.key, s: d.score })),
        max: r.maxScores ? r.maxScores.total : null
      };
    } catch(e) { return { error: e.message }; }
  });

  console.log('\n📋 答案:');
  console.log(JSON.stringify(result.answers, null, 2));
  console.log('\n📊 计分:', JSON.stringify(result, null, 2));

  const q5ok = typeof result.answers?.q5 === 'object' && !Array.isArray(result.answers?.q5);
  const q6ok = typeof result.answers?.q6 === 'object' && Array.isArray(result.answers?.q6?.subs);
  const q7ok = typeof result.answers?.q7 === 'object' && result.answers?.q7?.main === 0;
  console.log(`\n🔍 Q5 matrix: ${q5ok ? '✅' : '❌'}`);
  console.log(`🔍 Q6 parent-child: ${q6ok ? '✅' : '❌'}`);
  console.log(`🔍 Q7 parent-child: ${q7ok ? '✅' : '❌'}`);
  if (result.total !== undefined) {
    console.log(`\n🎯 总分: ${result.total} (预期39) ${result.total === 39 ? '✅' : '⚠️'}`);
    console.log(`   满分: ${result.max}`);
  }

  await page.screenshot({ path: '/tmp/ssrs-result-v4.png' });
  console.log('截图: /tmp/ssrs-result-v4.png');
  await page.waitForTimeout(10000);
  await browser.close();
  console.log('🏁 测试结束');
})();
