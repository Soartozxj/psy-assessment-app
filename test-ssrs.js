/**
 * SSRS 新题型本地测试脚本
 * 测试 matrix + parent-child 题型渲染和计分
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 375, height: 720 } });
  const page = await context.newPage();

  // 1. 打开前端页面
  console.log('📋 打开前端页面...');
  await page.goto('http://localhost:8080/mini-app-h5/frontend/index.html');
  await page.waitForTimeout(2000);

  // 2. 注入 SSRS 数据到 localStorage
  console.log('💾 注入 SSRS 数据...');
  const fs = require('fs');
  const scalesData = JSON.parse(fs.readFileSync('/Users/rich/WorkBuddy/20260407113106/scales-data.json', 'utf-8'));
  await page.evaluate((data) => {
    localStorage.removeItem('psy_scales_synced');
    // 写入 psy_scales_data（SharedData 底层存储）
    localStorage.setItem('psy_scales_data', JSON.stringify(data));
    // 同时写入 psy_scales_synced（前端优先读取的缓存）
    const active = data.filter(s => s.status === 1 || s.status === undefined);
    localStorage.setItem('psy_scales_synced', JSON.stringify(active));
    console.log('✅ localStorage 数据已注入，活跃量表:', active.length);
  }, scalesData);

  // 3. 刷新页面加载新数据
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 4. 验证 SSRS 存在于量表列表
  console.log('🔍 查找 SSRS 量表...');
  const scaleInfo = await page.evaluate(() => {
    // 尝试多种方式获取量表列表
    let scales = window.SCALES || [];
    if (!scales || scales.length === 0) {
      // 从 localStorage 直接读取
      const raw = localStorage.getItem('psy_scales_synced');
      if (raw) {
        try { scales = JSON.parse(raw); } catch(e) {}
      }
    }
    return {
      names: scales.map(s => s.name || s.shortName || 'unknown'),
      count: scales.length
    };
  });
  console.log('量表列表:', scaleInfo.names);
  console.log('量表数量:', scaleInfo.count);

  const ssrsIndex = scaleInfo.names.findIndex(n => n && n.includes('社会支持'));
  if (ssrsIndex === -1) {
    console.error('❌ 未找到 SSRS 量表！');
    console.error('请检查 localStorage 中的数据是否正确');
    // 尝试读取 localStorage 中的 SSRS 数据
    const lsDebug = await page.evaluate(() => {
      const raw = localStorage.getItem('psy_scales_synced');
      if (!raw) return { error: 'psy_scales_synced 为空' };
      const data = JSON.parse(raw);
      const ssrs = data.find(s => s.name && s.name.includes('社会支持'));
      if (!ssrs) return { error: '数据中无SSRS', sample: data.slice(0, 2).map(s => s.name) };
      return { found: true, q5type: ssrs.questions[4].type, q6type: ssrs.questions[5].type };
    });
    console.log('localStorage 调试:', JSON.stringify(lsDebug));
    await page.screenshot({ path: '/tmp/ssrs-debug-1.png' });
    await browser.close();
    return;
  }
  console.log('✅ 找到 SSRS 量表，索引:', ssrsIndex);

  // 5. 点击 SSRS 进入详情页
  console.log('👆 点击 SSRS 量表...');
  const scaleCards = await page.$$('.scale-card');
  console.log(`  scale-card 数量: ${scaleCards.length}`);
  if (scaleCards[ssrsIndex]) {
    await scaleCards[ssrsIndex].click();
    await page.waitForTimeout(1500);
    // 检查是否进入了详情页
    const detailPage = await page.$('#page-scale-detail');
    const isDetailVisible = detailPage ? await detailPage.isVisible() : false;
    console.log(`  详情页可见: ${isDetailVisible}`);
    if (!isDetailVisible) {
      // 可能需要滚动到可见区域
      await scaleCards[ssrsIndex].scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await scaleCards[ssrsIndex].click();
      await page.waitForTimeout(1500);
    }
  } else {
    console.log('❌ 未找到 scale-card');
    // 列出所有可用选择器
    const allSelectors = await page.evaluate(() => {
      const cards = document.querySelectorAll('.scale-card, .scale-item, [class*="scale"]');
      return Array.from(cards).map(c => c.className + ': ' + c.textContent.substring(0, 30));
    });
    console.log('可用元素:', allSelectors.slice(ssrsIndex, ssrsIndex + 2));
  }

  // 6. 点击开始测评
  console.log('▶️ 开始测评...');
  await page.waitForTimeout(500);
  const startBtn = await page.$('.btn-start');
  console.log(`  开始按钮: ${startBtn ? '找到' : '未找到'}`);
  if (!startBtn) {
    await page.screenshot({ path: '/tmp/ssrs-debug-detail.png' });
    console.log('  截图: /tmp/ssrs-debug-detail.png');
  }
  if (startBtn) {
    await startBtn.click({ force: true });
    await page.waitForTimeout(3000);
  } else {
    console.log('❌ 未找到开始测评按钮');
    await browser.close();
    return;
  }

  // 7. 检查是否在欢迎阶段，如果是需要先确认
  console.log('📝 检查欢迎阶段...');
  await page.waitForTimeout(1000);

  // 如果是沉浸模式，先点击确认按钮开始答题
  const welcomeConfirm = await page.$('#npc-confirm-btn');
  if (welcomeConfirm) {
    const confirmText = await page.$('#npc-confirm-text');
    const text = confirmText ? await confirmText.textContent() : '';
    console.log('  确认按钮文案:', text);
    if (text.includes('开始') || text.includes('确认')) {
      await welcomeConfirm.click();
      await page.waitForTimeout(2000);
      console.log('  ✅ 已通过欢迎阶段');
    }
  }

  // 8. 检查 Q1 选项渲染
  console.log('📝 检查 Q1 渲染...');
  await page.waitForTimeout(2000);
  let q1Options = await page.$$('#npc-options-area .npc-option-btn');
  console.log(`  Q1 选项数: ${q1Options.length} (预期 4)`);

  // 如果选项未渲染，可能还在等待打字动画，尝试等待更久
  if (q1Options.length === 0) {
    await page.waitForTimeout(3000);
    q1Options = await page.$$('#npc-options-area .npc-option-btn');
    console.log(`  等待后 Q1 选项数: ${q1Options.length}`);

    // 检查页面状态
    if (q1Options.length === 0) {
      const currentPage = await page.evaluate(() => {
        const pages = document.querySelectorAll('.page');
        for (const p of pages) {
          if (p.style.display !== 'none') return p.id;
        }
        return 'unknown';
      });
      console.log('  当前页面:', currentPage);
      await page.screenshot({ path: '/tmp/ssrs-debug-q1.png' });
      console.log('  截图: /tmp/ssrs-debug-q1.png');
    }
  }

  // 9. 快速通过 Q1~Q4
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(1000); // 等待题目切换动画
    const opts = await page.$$('#npc-options-area .npc-option-btn');
    console.log(`  Q${i + 1} 选项数: ${opts.length}`);
    if (opts.length > 0) {
      // 选择第3个选项（模拟答题）
      const targetOpt = opts[Math.min(2, opts.length - 1)];
      await targetOpt.click();
      await page.waitForTimeout(500);

      // 确认按钮可能需要等待出现（沉浸模式）
      const confirmBtn = await page.$('#npc-confirm-btn.visible, #npc-confirm-btn');
      if (confirmBtn) {
        await page.waitForTimeout(500); // 等待按钮可点击
        const isDisabled = await confirmBtn.getAttribute('disabled');
        if (isDisabled !== 'true' && isDisabled !== true) {
          await confirmBtn.click();
          await page.waitForTimeout(1000);
          console.log(`  ✅ Q${i + 1} 已作答并确认`);
        } else {
          console.log(`  ⚠️ Q${i + 1} 确认按钮被禁用`);
        }
      } else {
        console.log(`  ⚠️ Q${i + 1} 未找到确认按钮`);
      }
    } else {
      console.log(`  ⚠️ Q${i + 1} 无选项`);
      // 可能是最后一题
      const lastForm = await page.$('#npc-last-form');
      if (lastForm) {
        const lastOpts = await lastForm.$$('.npc-option-btn');
        if (lastOpts.length > 0) {
          await lastOpts[Math.min(2, lastOpts.length - 1)].click();
          await page.waitForTimeout(2000);
          console.log(`  ✅ Q${i + 1} (最后一题) 已提交`);
          break;
        }
      }
    }
  }

  // 9. 到达 Q5 — 矩阵题
  console.log('📊 检查 Q5 矩阵题渲染...');
  await page.waitForTimeout(1000);
  const matrixTable = await page.$('#npc-matrix-form table');
  if (matrixTable) {
    console.log('  ✅ Q5 矩阵表格已渲染');
    // 获取行列数
    const rowCount = await page.$$eval('#npc-matrix-form tbody tr', rows => rows.length);
    const colCount = await page.$$eval('#npc-matrix-form thead th', ths => ths.length);
    console.log(`  行数: ${rowCount} (预期 5), 列数: ${colCount - 1} (预期 4)`);

    // 模拟选择：每行选第3列
    for (let r = 0; r < rowCount; r++) {
      const radios = await page.$$eval(`#npc-matrix-form tbody tr:nth-child(${r + 1}) .matrix-radio`, els => els.length);
      if (radios > 0) {
        const radio = await page.$(`#npc-matrix-form tbody tr:nth-child(${r + 1}) .matrix-radio:nth-child(${Math.min(4, radios + 1)})`);
        if (radio) {
          await radio.click();
          await page.waitForTimeout(200);
        }
      }
    }
    console.log('  ✅ Q5 矩阵题已作答（每行选第3列）');

    // 确认
    const confirmBtn5 = await page.$('#npc-confirm-btn');
    if (confirmBtn5) {
      await confirmBtn5.click();
      await page.waitForTimeout(1000);
      console.log('  ✅ Q5 已确认');
    }
  } else {
    console.log('  ❌ Q5 矩阵表格未渲染');
  }

  // 10. 到达 Q6 — 父子题
  console.log('🔗 检查 Q6 父子题渲染...');
  await page.waitForTimeout(1000);
  const pcForm = await page.$('#npc-pc-form');
  if (pcForm) {
    console.log('  ✅ Q6 父子题表单已渲染');

    // 选择"下列来源（可选多项）"
    const mainOpts = await page.$$('#npc-pc-form .npc-option-btn[data-pc-main]');
    if (mainOpts.length >= 2) {
      await mainOpts[1].click(); // 选择第2个主选项
      await page.waitForTimeout(500);
      console.log('  ✅ 已选择"下列来源"主选项');
    }

    // 勾选子选项
    const subArea = await page.$('#npc-pc-subs');
    if (subArea) {
      console.log('  ✅ 子选项区域已展开');
      const checkboxes = await page.$$('#npc-pc-subs .pc-checkbox');
      console.log(`  子选项数: ${checkboxes.length} (预期 9)`);

      // 勾选 A、C、F 3个子选项
      for (const idx of [0, 2, 5]) {
        if (checkboxes[idx]) {
          await checkboxes[idx].click();
          await page.waitForTimeout(200);
        }
      }
      console.log('  ✅ 已勾选 A、C、F 三个子选项（得分应为3）');
    } else {
      console.log('  ❌ 子选项区域未展开');
    }

    // 确认
    const confirmBtn6 = await page.$('#npc-confirm-btn');
    if (confirmBtn6) {
      await confirmBtn6.click();
      await page.waitForTimeout(1000);
      console.log('  ✅ Q6 已确认');
    }
  } else {
    console.log('  ❌ Q6 父子题表单未渲染');
  }

  // 11. Q7 — 父子题（选择"无任何来源"）
  console.log('🔗 检查 Q7 父子题渲染...');
  await page.waitForTimeout(1000);
  const pcForm7 = await page.$('#npc-pc-form');
  if (pcForm7) {
    console.log('  ✅ Q7 父子题已渲染');
    const mainOpts7 = await page.$$('#npc-pc-form .npc-option-btn[data-pc-main]');
    if (mainOpts7.length >= 1) {
      await mainOpts7[0].click(); // 选择"无任何来源"
      await page.waitForTimeout(300);
      console.log('  ✅ 已选择"无任何来源"（得分应为0）');

      const confirmBtn7 = await page.$('#npc-confirm-btn');
      if (confirmBtn7) {
        await confirmBtn7.click();
        await page.waitForTimeout(1000);
        console.log('  ✅ Q7 已确认');
      }
    }
  } else {
    console.log('  ❌ Q7 未渲染');
  }

  // 12. 快速通过 Q8~Q10
  console.log('📝 快速通过 Q8~Q10...');
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(500);
    // 检查是否已经是最后一题
    const lastHint = await page.$('#npc-last-hint');
    const matrixForm = await page.$('#npc-matrix-form');
    const pcForm = await page.$('#npc-pc-form');
    const opts = await page.$$('#npc-options-area .npc-option-btn');

    if (lastHint && opts.length > 0) {
      // 最后一题：选中即提交
      await opts[Math.min(2, opts.length - 1)].click();
      await page.waitForTimeout(1500);
      console.log(`  ✅ Q${8 + i} (最后一题) 已提交`);
      break;
    } else if (opts.length > 0) {
      // 常规题
      await opts[Math.min(2, opts.length - 1)].click();
      await page.waitForTimeout(300);
      const confirmBtn = await page.$('#npc-confirm-btn');
      if (confirmBtn) {
        const isDisabled = await confirmBtn.getAttribute('disabled');
        if (isDisabled !== 'true' && isDisabled !== true) {
          await confirmBtn.click();
          await page.waitForTimeout(1000);
          console.log(`  ✅ Q${8 + i} 已作答`);
        }
      }
    } else {
      console.log(`  ⚠️ Q${8 + i} 无选项可点击`);
      break;
    }
  }

  // 13. 等待结果页
  console.log('\n📊 等待结果页...');
  await page.waitForTimeout(3000);

  // 14. 检查结果
  const resultPage = await page.$('#page-result');
  if (resultPage) {
    console.log('✅ 结果页已显示');

    // 检查总分
    const totalScoreEl = await page.$('.result-score-value');
    const totalScore = totalScoreEl ? await totalScoreEl.textContent() : 'N/A';
    console.log(`  总分: ${totalScore}`);

    // 检查维度
    const dimEls = await page.$$('.dim-item .dim-score');
    console.log(`  维度数: ${dimEls.length} (预期 3)`);

    // 打印 answers 数据
    const answersData = await page.evaluate(() => JSON.stringify(window.answers, null, 2));
    console.log('\n📋 Answers 数据:');
    console.log(answersData);

    // 验证 Q5 格式
    const q5Ans = await page.evaluate(() => answers[5]);
    console.log(`\n  Q5 答案格式: ${typeof q5Ans} (预期 object)`);
    if (typeof q5Ans === 'object') {
      console.log(`  Q5 答案值: ${JSON.stringify(q5Ans)} (预期 {A:2,B:2,C:2,D:2,E:2})`);
    }

    // 验证 Q6 格式
    const q6Ans = await page.evaluate(() => answers[6]);
    console.log(`  Q6 答案格式: ${typeof q6Ans} (预期 object)`);
    if (typeof q6Ans === 'object') {
      console.log(`  Q6 答案值: ${JSON.stringify(q6Ans)} (预期 {main:1,subs:["A","C","F"]})`);
    }

    // 验证 Q7 格式
    const q7Ans = await page.evaluate(() => answers[7]);
    console.log(`  Q7 答案格式: ${typeof q7Ans} (预期 object)`);
    if (typeof q7Ans === 'object') {
      console.log(`  Q7 答案值: ${JSON.stringify(q7Ans)} (预期 {main:0,subs:[]})`);
    }

    // 手动计算预期分数
    console.log('\n🔢 预期分数计算:');
    console.log('  Q1(第3选项): 3分');
    console.log('  Q2(第3选项): 3分');
    console.log('  Q3(第3选项): 3分');
    console.log('  Q4(第3选项): 3分');
    console.log('  Q5(每行第3列="一般"=3分): 5×3=15分');
    console.log('  Q6(选了A/C/F): 3分');
    console.log('  Q7(无任何来源): 0分');
    console.log('  Q8~Q10(各第3选项): 3×3=9分');
    console.log('  预期总分: 3+3+3+3+15+3+0+3+3+3 = 39分');
  } else {
    console.log('❌ 结果页未显示');
    // 检查是否卡在答题页
    const currentPage = await page.evaluate(() => {
      const pages = document.querySelectorAll('.page');
      for (const p of pages) {
        if (p.style.display !== 'none' && p.classList.contains('active')) {
          return p.id;
        }
      }
      return 'unknown';
    });
    console.log('  当前页面:', currentPage);
    // 截图调试
    await page.screenshot({ path: '/tmp/ssrs-test-debug.png' });
    console.log('  已截图: /tmp/ssrs-test-debug.png');
  }

  // 等待用户观察
  console.log('\n⏳ 浏览器保持打开，请手动检查页面。按 Ctrl+C 退出。');
  await page.waitForTimeout(30000);

  await browser.close();
  console.log('🏁 测试结束');
})();
