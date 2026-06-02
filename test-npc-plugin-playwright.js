const { chromium } = require('playwright');

async function testNpcPlugin() {
  console.log('🧪 开始NPC插件自动化测试...');

  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1400,900']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 访问测试页面
    console.log('📂 访问NPC插件测试页面...');
    await page.goto('http://localhost:8000/test-npc-plugin-inline.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 等待页面加载完成
    await page.waitForTimeout(3000);

    console.log('✅ 测试页面加载完成');

    // 点击"运行所有测试"按钮
    console.log('▶️ 开始执行测试...');
    await page.click('button:has-text("运行所有测试")');

    // 等待测试完成（最长等待60秒）
    await page.waitForTimeout(60000);

    // 捕获测试结果
    console.log('📊 捕获测试结果...');

    const testResults = await page.evaluate(() => {
      const results = [];
      const resultItems = document.querySelectorAll('#test-results .result-item');

      resultItems.forEach((item, index) => {
        const isPass = item.classList.contains('pass');
        const html = item.innerHTML;

        // 提取测试名称
        const nameMatch = html.match(/<strong>(✅|❌)\s*(.+?)<\/strong>/);
        const name = nameMatch ? nameMatch[2] : `测试${index + 1}`;

        // 提取消息
        const messageMatch = html.match(/<small>(.+?)<\/small>/);
        const message = messageMatch ? messageMatch[1] : '';

        results.push({
          id: `test-${index + 1}`,
          name: name,
          passed: isPass,
          message: message
        });
      });

      // 获取汇总信息
      const summary = document.querySelector('.summary');
      let summaryData = null;
      if (summary) {
        const summaryText = summary.textContent;
        const totalMatch = summaryText.match(/总测试数:\s*(\d+)/);
        const passedMatch = summaryText.match(/通过数:\s*(\d+)/);
        const failedMatch = summaryText.match(/失败数:\s*(\d+)/);
        const passRateMatch = summaryText.match(/通过率:\s*([\d.]+)%/);

        summaryData = {
          total: totalMatch ? parseInt(totalMatch[1]) : 0,
          passed: passedMatch ? parseInt(passedMatch[1]) : 0,
          failed: failedMatch ? parseInt(failedMatch[1]) : 0,
          passRate: passRateMatch ? parseFloat(passRateMatch[1]) : 0
        };
      }

      return { results, summary: summaryData };
    });

    // 输出测试结果
    console.log('\n📊 ============ NPC插件测试结果 ============');
    console.log(`总测试数: ${testResults.summary.total}`);
    console.log(`通过数: ${testResults.summary.passed}`);
    console.log(`失败数: ${testResults.summary.failed}`);
    console.log(`通过率: ${testResults.summary.passRate}%`);
    console.log('\n📝 详细结果:');

    testResults.results.forEach((result) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.message}`);
    });

    console.log('\n============================================\n');

    // 生成测试报告
    const report = generateTestReport(testResults);

    // 保存报告到文件
    const fs = require('fs');
    const reportPath = `/Users/rich/WorkBuddy/20260407113106/NPC插件测试报告_${new Date().toISOString().split('T')[0]}.md`;
    fs.writeFileSync(reportPath, report);
    console.log(`📄 测试报告已保存: ${reportPath}`);

    // 截图保存测试结果
    await page.screenshot({
      path: '/Users/rich/WorkBuddy/20260407113106/npc-test-screenshot.png',
      fullPage: true
    });
    console.log('📸 测试截图已保存: npc-test-screenshot.png');

    return testResults;
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

function generateTestReport(testResults) {
  const { results, summary } = testResults;

  let md = '# 📋 NPC插件测试报告\n\n';
  md += `**测试日期**: ${new Date().toLocaleDateString()}\n`;
  md += `**测试时间**: ${new Date().toLocaleTimeString()}\n`;
  md += '**测试人员**: rich\n';
  md += '**测试版本**: NPC插件 v1.0.0\n\n';
  md += '---\n\n';

  md += '## 📊 测试结果汇总\n\n';
  md += '| 指标 | 数值 |\n';
  md += '|------|------|\n';
  md += `| 总测试数 | ${summary.total} |\n`;
  md += `| 通过数 | ${summary.passed} |\n`;
  md += `| 失败数 | ${summary.failed} |\n`;
  md += `| 通过率 | ${summary.passRate}% |\n\n`;

  md += '---\n\n';
  md += '## 📝 详细测试结果\n\n';

  results.forEach((result) => {
    md += `### ${result.id}. ${result.name}\n`;
    md += `- **状态**: ${result.passed ? '✅ 通过' : '❌ 失败'}\n`;
    md += `- **消息**: ${result.message}\n\n`;
  });

  md += '---\n\n';
  md += '## 🎯 测试结论\n\n';

  if (summary.passRate === 100) {
    md += '✅ **测试通过率100%**，NPC插件功能正常，可以上线。\n\n';
  } else if (summary.passRate >= 80) {
    md += `⚠️ **测试通过率${summary.passRate}%**，大部分功能正常，建议修复失败用例后上线。\n\n`;
  } else {
    md += `❌ **测试通过率${summary.passRate}%**，存在较多问题，需要修复后重新测试。\n\n`;
  }

  md += '## 📌 后续建议\n\n';
  md += '1. 修复失败的测试用例\n';
  md += '2. 增加更多边界条件测试\n';
  md += '3. 进行手动验证确认\n';
  md += '4. 更新相关文档\n\n';

  md += '---\n\n';
  md += `*报告生成时间: ${new Date().toLocaleString()}*\n`;

  return md;
}

// 执行测试
testNpcPlugin()
  .then((results) => {
    console.log('✅ NPC插件测试完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ NPC插件测试失败:', error);
    process.exit(1);
  });
