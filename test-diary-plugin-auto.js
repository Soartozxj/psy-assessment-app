/**
 * Diary插件自动化测试脚本
 *
 * 测试目标：
 * 1. 插件文件存在性
 * 2. 插件加载功能
 * 3. 所有action执行（list/get/create/update/delete/search）
 * 4. 错误处理
 * 5. 数据持久化（模拟）
 *
 * 使用方法：
 * node test-diary-plugin-auto.js
 */

const { chromium } = require('playwright');

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
  startTime: null,
  endTime: null
};

// 记录测试结果
function recordTest(name, passed, error = null, details = null) {
  testResults.total++;

  const testItem = {
    name,
    passed,
    error,
    details,
    timestamp: new Date().toISOString()
  };

  testResults.tests.push(testItem);

  if (passed) {
    testResults.passed++;
    console.log(`  ✅ ${name}`);
  } else {
    testResults.failed++;
    console.log(`  ❌ ${name}`);
    if (error) {
      console.log(`     错误: ${error}`);
    }
  }
}

// 主测试函数
async function runDiaryPluginTests() {
  console.log('🧪 ========== Diary插件自动化测试开始 ==========\n');
  testResults.startTime = new Date();

  const browser = await chromium.launch({
    headless: false, // 显示浏览器，方便调试
    args: ['--window-size=1400,900']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });

  const page = await context.newPage();

  // 监听控制台消息
  page.on('console', (msg) => {
    if (msg.type() === 'log' && msg.text().includes('📔')) {
      console.log(`     [插件日志] ${msg.text()}`);
    }
  });

  try {
    // ========== 测试1: 环境准备 ==========
    console.log('\n📊 ========== 测试1: 环境准备 ==========');

    // 1.1 访问admin页面
    console.log('  步骤1: 访问admin-legacy.html...');

    try {
      await page.goto('http://localhost:8000/mini-app-h5/backend/admin-legacy.html', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      recordTest('访问admin页面成功', true);
    } catch (error) {
      // 如果localhost:8000不可用，尝试其他端口
      console.log('  ⚠️ localhost:8000不可用，尝试启动服务器...');

      // 这里可以添加自动启动服务器的逻辑
      recordTest('访问admin页面成功', false, '服务器未启动，请先运行: cd mini-app-h5 && python3 -m http.server 8000');
      throw new Error('服务器未启动');
    }

    // 1.2 等待页面初始化
    console.log('  步骤2: 等待页面初始化...');
    await page.waitForTimeout(3000);

    const pageReady = await page.evaluate(() => {
      return window.PluginLoader !== undefined;
    });

    recordTest('PluginLoader已加载', pageReady);

    if (!pageReady) {
      throw new Error('PluginLoader未加载');
    }

    // ========== 测试2: 插件文件检查 ==========
    console.log('\n📊 ========== 测试2: 插件文件检查 ==========');

    const diaryPluginExists = await page.evaluate(async () => {
      try {
        const response = await fetch('/mini-app-h5/backend/plugins/optional/diary-plugin.js');
        return response.ok;
      } catch (error) {
        return false;
      }
    });

    recordTest('Diary插件文件存在', diaryPluginExists);

    if (!diaryPluginExists) {
      throw new Error('Diary插件文件不存在');
    }

    // ========== 测试3: 插件加载测试 ==========
    console.log('\n📊 ========== 测试3: 插件加载测试 ==========');

    const loadResult = await page.evaluate(async () => {
      try {
        // 加载diary插件
        await window.PluginLoader.load('diary', false);

        // 等待插件初始化
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 获取插件实例
        const plugin = window.PluginLoader.get('diary');

        if (plugin) {
          return {
            success: true,
            name: plugin.name || plugin.constructor.name,
            version: plugin.version || 'unknown',
            hasExecute: typeof plugin.execute === 'function'
          };
        } else {
          return { success: false, error: '插件加载后未找到实例' };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    recordTest('Diary插件加载成功', loadResult.success, loadResult.error);

    if (loadResult.success) {
      console.log(`    插件名称: ${loadResult.name}`);
      console.log(`    插件版本: ${loadResult.version}`);
      console.log(`    有execute方法: ${loadResult.hasExecute}`);

      recordTest('插件有execute方法', loadResult.hasExecute);
    }

    // ========== 测试4: list action测试 ==========
    console.log('\n📊 ========== 测试4: list action测试 ==========');

    const listResult = await page.evaluate(async () => {
      try {
        const result = await window.PluginLoader.execute('diary', { action: 'list' });

        return {
          success: true,
          data: result,
          count: Array.isArray(result) ? result.length : 0,
          isArray: Array.isArray(result)
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    recordTest('list action执行成功', listResult.success, listResult.error);

    if (listResult.success) {
      console.log(`    返回数据类型: ${listResult.isArray ? '数组' : '非数组'}`);
      console.log(`    日记数量: ${listResult.count}`);

      recordTest('list返回的是数组', listResult.isArray);
      recordTest('list返回至少1条数据', listResult.count >= 1, null, `实际: ${listResult.count}`);

      // 验证数据结构
      if (listResult.count > 0) {
        const firstDiary = listResult.data[0];
        const hasRequiredFields =
          firstDiary.id !== undefined && firstDiary.title !== undefined && firstDiary.content !== undefined;

        recordTest(
          '日记数据有必需字段(id/title/content)',
          hasRequiredFields,
          null,
          `字段: ${Object.keys(firstDiary).join(', ')}`
        );
      }
    }

    // ========== 测试5: get action测试 ==========
    console.log('\n📊 ========== 测试5: get action测试 ==========');

    if (listResult.success && listResult.count > 0) {
      const firstDiaryId = listResult.data[0].id;

      const getResult = await page.evaluate(async (id) => {
        try {
          const result = await window.PluginLoader.execute('diary', {
            action: 'get',
            id: id
          });

          return {
            success: true,
            data: result,
            found: result !== null
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, firstDiaryId);

      recordTest('get action执行成功', getResult.success, getResult.error);

      if (getResult.success) {
        console.log(`    查找ID: ${firstDiaryId}`);
        console.log(`    是否找到: ${getResult.found}`);

        recordTest('get返回了日记数据', getResult.found);
      }
    } else {
      recordTest('get action测试跳过', false, 'list测试失败，无法获取日记ID');
    }

    // ========== 测试6: create action测试 ==========
    console.log('\n📊 ========== 测试6: create action测试 ==========');

    const createResult = await page.evaluate(async () => {
      try {
        const newDiaryData = {
          title: '测试日记_' + Date.now(),
          content: '这是一篇测试日记的内容',
          mood: '😊'
        };

        const result = await window.PluginLoader.execute('diary', {
          action: 'create',
          data: newDiaryData
        });

        return {
          success: true,
          data: result,
          hasId: result.id !== undefined,
          titleMatches: result.title === newDiaryData.title
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    recordTest('create action执行成功', createResult.success, createResult.error);

    if (createResult.success) {
      console.log(`    创建的日记ID: ${createResult.data.id}`);
      console.log(`    日记标题: ${createResult.data.title}`);

      recordTest('创建的日记有ID', createResult.hasId);
      recordTest('日记标题正确', createResult.titleMatches);
    }

    // ========== 测试7: update action测试 ==========
    console.log('\n📊 ========== 测试7: update action测试 ==========');

    if (createResult.success) {
      const createdDiaryId = createResult.data.id;
      const updatedTitle = '更新后的标题_' + Date.now();

      // 将参数包装为单个对象
      const updateParams = {
        id: createdDiaryId,
        newTitle: updatedTitle
      };

      const updateResult = await page.evaluate(async (params) => {
        try {
          const result = await window.PluginLoader.execute('diary', {
            action: 'update',
            id: params.id,
            data: { title: params.newTitle }
          });

          return {
            success: true,
            data: result,
            titleUpdated: result.title === params.newTitle
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, updateParams);

      recordTest('update action执行成功', updateResult.success, updateResult.error);

      if (updateResult.success) {
        console.log(`    更新后的标题: ${updateResult.data.title}`);
        recordTest('日记标题已更新', updateResult.titleUpdated);
      }
    } else {
      recordTest('update action测试跳过', false, 'create测试失败，无法获取新创建的日记ID');
    }

    // ========== 测试8: search action测试 ==========
    console.log('\n📊 ========== 测试8: search action测试 ==========');

    const searchResult = await page.evaluate(async () => {
      try {
        const result = await window.PluginLoader.execute('diary', {
          action: 'search',
          keyword: '测试'
        });

        return {
          success: true,
          data: result,
          count: Array.isArray(result) ? result.length : 0
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    recordTest('search action执行成功', searchResult.success, searchResult.error);

    if (searchResult.success) {
      console.log('    搜索关键词: "测试"');
      console.log(`    找到结果数: ${searchResult.count}`);

      recordTest('search返回数组', Array.isArray(searchResult.data));
      recordTest('search找到至少1条结果', searchResult.count >= 1, null, `实际: ${searchResult.count}`);
    }

    // ========== 测试9: delete action测试 ==========
    console.log('\n📊 ========== 测试9: delete action测试 ==========');

    if (createResult.success) {
      const createdDiaryId = createResult.data.id;

      const deleteResult = await page.evaluate(async (id) => {
        try {
          const result = await window.PluginLoader.execute('diary', {
            action: 'delete',
            id: id
          });

          // 验证删除成功
          const checkResult = await window.PluginLoader.execute('diary', {
            action: 'get',
            id: id
          });

          return {
            success: true,
            deleteResult: result,
            stillExists: checkResult !== null
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, createdDiaryId);

      recordTest('delete action执行成功', deleteResult.success, deleteResult.error);

      if (deleteResult.success) {
        console.log(`    删除的日记ID: ${createdDiaryId}`);
        console.log(`    删除后仍存在: ${deleteResult.stillExists}`);

        recordTest('日记已成功删除', !deleteResult.stillExists);
      }
    } else {
      recordTest('delete action测试跳过', false, 'create测试失败，无法获取新创建的日记ID');
    }

    // ========== 测试10: 错误处理测试 ==========
    console.log('\n📊 ========== 测试10: 错误处理测试 ==========');

    // 10.1 测试未知action
    const unknownActionResult = await page.evaluate(async () => {
      try {
        await window.PluginLoader.execute('diary', { action: 'unknown_action' });
        return { success: true, shouldFail: false };
      } catch (error) {
        return { success: false, expectedError: true, errorMessage: error.message };
      }
    });

    recordTest(
      '未知action抛出错误',
      unknownActionResult.expectedError || !unknownActionResult.success,
      null,
      `错误信息: ${unknownActionResult.errorMessage || '无'}`
    );

    // 10.2 测试get不存在的日记
    const getNonExistentResult = await page.evaluate(async () => {
      try {
        const result = await window.PluginLoader.execute('diary', {
          action: 'get',
          id: 99999
        });

        return {
          success: true,
          data: result,
          isNull: result === null
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    recordTest(
      'get不存在的日记返回null',
      getNonExistentResult.success && getNonExistentResult.isNull,
      getNonExistentResult.error
    );

    // ========== 测试完成 ==========
    console.log('\n✅ ========== 所有测试完成 ==========');
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error.message);
    recordTest('测试执行异常', false, error.message);
  } finally {
    testResults.endTime = new Date();

    // 生成测试报告
    await generateTestReport();

    // 关闭浏览器
    await browser.close();

    // 输出摘要
    printTestSummary();
  }
}

// 生成测试报告
async function generateTestReport() {
  console.log('\n📝 生成测试报告...');

  const report = {
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      passRate: ((testResults.passed / testResults.total) * 100).toFixed(1) + '%',
      startTime: testResults.startTime,
      endTime: testResults.endTime,
      duration: testResults.endTime - testResults.startTime
    },
    tests: testResults.tests
  };

  // 保存JSON报告
  const fs = require('fs');
  const reportPath = '/Users/rich/WorkBuddy/20260407113106/diary-plugin-test-report.json';

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  ✅ JSON报告已保存: ${reportPath}`);

  // 生成Markdown报告
  const markdownReport = generateMarkdownReport(report);
  const markdownPath = '/Users/rich/WorkBuddy/20260407113106/diary-plugin-test-report.md';

  fs.writeFileSync(markdownPath, markdownReport);
  console.log(`  ✅ Markdown报告已保存: ${markdownPath}`);
}

// 生成Markdown报告
function generateMarkdownReport(report) {
  let md = '# Diary插件自动化测试报告\n\n';

  // 摘要
  md += '## 📊 测试摘要\n\n';
  md += '| 指标 | 值 |\n';
  md += '|------|-----|\n';
  md += `| 总测试数 | ${report.summary.total} |\n`;
  md += `| 通过 | ${report.summary.passed} |\n`;
  md += `| 失败 | ${report.summary.failed} |\n`;
  md += `| 通过率 | ${report.summary.passRate} |\n`;
  md += `| 开始时间 | ${report.summary.startTime} |\n`;
  md += `| 结束时间 | ${report.summary.endTime} |\n`;
  md += `| 耗时 | ${report.summary.duration}ms |\n\n`;

  // 测试结果详情
  md += '## 📋 测试结果详情\n\n';

  const passedTests = report.tests.filter((t) => t.passed);
  const failedTests = report.tests.filter((t) => !t.passed);

  if (passedTests.length > 0) {
    md += '### ✅ 通过的测试\n\n';
    passedTests.forEach((test, index) => {
      md += `${index + 1}. **${test.name}**\n`;
      if (test.details) {
        md += `   - 详情: ${test.details}\n`;
      }
    });
    md += '\n';
  }

  if (failedTests.length > 0) {
    md += '### ❌ 失败的测试\n\n';
    failedTests.forEach((test, index) => {
      md += `${index + 1}. **${test.name}**\n`;
      if (test.error) {
        md += `   - 错误: ${test.error}\n`;
      }
      if (test.details) {
        md += `   - 详情: ${test.details}\n`;
      }
    });
    md += '\n';
  }

  // 建议
  md += '## 💡 建议\n\n';

  if (report.summary.failed === 0) {
    md += '🎉 所有测试通过！Diary插件功能正常，可以上线。\n';
  } else {
    md += '⚠️ 部分测试失败，建议修复以下问题：\n\n';
    failedTests.forEach((test, index) => {
      md += `${index + 1}. ${test.name}: ${test.error || '未知错误'}\n`;
    });
  }

  md += '\n---\n\n';
  md += `*报告生成时间: ${new Date().toISOString()}*\n`;

  return md;
}

// 打印测试摘要
function printTestSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试摘要');
  console.log('='.repeat(60));
  console.log(`总测试数: ${testResults.total}`);
  console.log(`通过: ${testResults.passed}`);
  console.log(`失败: ${testResults.failed}`);
  console.log(`通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  console.log(`耗时: ${testResults.endTime - testResults.startTime}ms`);
  console.log('='.repeat(60));

  if (testResults.failed === 0) {
    console.log('\n🎉 所有测试通过！Diary插件功能正常。');
  } else {
    console.log('\n⚠️ 部分测试失败，请查看报告获取详情。');
  }

  console.log('\n📝 测试报告已生成:');
  console.log('  - diary-plugin-test-report.json');
  console.log('  - diary-plugin-test-report.md');
}

// 运行测试
runDiaryPluginTests().catch((error) => {
  console.error('❌ 测试运行失败:', error);
  process.exit(1);
});
