#!/usr/bin/env node
/**
 * scoring-engine-test.js — 计分引擎全量验证
 *
 * 对26个量表进行模拟计分测试：
 * 1. 从 shared-data.js 读取量表数据
 * 2. 引入 scoring-engine.js
 * 3. 对每个量表构造全选第一个选项的模拟答案
 * 4. 调用 ScoringEngine.calculate(scale, answers)
 * 5. 检查结果：metrics.totalScore 非零、dimensions 数组非空、interpretation 存在
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// ============================================================
// 1. 加载 scoring-engine.js (CommonJS)
// ============================================================
const ScoringEngine = require(path.resolve(__dirname, 'mini-app-native/utils/scoring-engine.js'));

// ============================================================
// 2. 加载 shared-data.js (IIFE / 自执行函数，需用 vm 模块)
// ============================================================
const sharedDataPath = path.resolve(__dirname, 'mini-app-h5/shared-data.js');
const sharedDataCode = fs.readFileSync(sharedDataPath, 'utf-8');

// shared-data.js 是一个 IIFE，通过 window.SharedData 暴露数据
// 用 vm 创建一个沙箱环境来执行它
const sandbox = {
  window: {},
  document: {
    addEventListener: function () {},
    removeEventListener: function () {},
    createElement: function () {
      return { setAttribute: function () {}, appendChild: function () {}, addEventListener: function () {} };
    },
    getElementById: function () {
      return null;
    },
    getElementsByClassName: function () {
      return [];
    },
    querySelector: function () {
      return null;
    },
    querySelectorAll: function () {
      return [];
    },
    body: { appendChild: function () {}, classList: { add: function () {}, remove: function () {} } },
    head: { appendChild: function () {}, classList: { add: function () {}, remove: function () {} } },
    readyState: 'complete',
    cookie: ''
  },
  localStorage: {
    getItem: function () {
      return null;
    },
    setItem: function () {},
    removeItem: function () {},
    clear: function () {}
  },
  sessionStorage: {
    getItem: function () {
      return null;
    },
    setItem: function () {},
    removeItem: function () {},
    clear: function () {}
  },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  fetch: function () {
    return Promise.resolve({
      json: function () {
        return Promise.resolve({});
      },
      ok: true
    });
  },
  XMLHttpRequest: function () {
    this.open = function () {};
    this.send = function () {};
    this.setRequestHeader = function () {};
  },
  navigator: { onLine: true },
  location: { href: '', pathname: '/', search: '', hash: '' },
  Date: Date,
  Math: Math,
  JSON: JSON,
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Error: Error,
  TypeError: TypeError,
  RangeError: RangeError,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  isFinite: isFinite,
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
  RegExp: RegExp,
  Map: Map,
  Set: Set,
  Promise: Promise,
  Symbol: Symbol,
  undefined: undefined,
  alert: function () {},
  confirm: function () {
    return true;
  },
  prompt: function () {
    return '';
  }
};

try {
  vm.runInNewContext(sharedDataCode, sandbox, { filename: 'shared-data.js' });
} catch (e) {
  console.error('[ERROR] 加载 shared-data.js 失败:', e.message);
  process.exit(1);
}

const SharedData = sandbox.window.SharedData;
if (!SharedData) {
  console.error('[ERROR] SharedData 未定义，检查 shared-data.js 导出方式');
  const keys = Object.keys(sandbox);
  console.log('[DEBUG] sandbox keys:', keys.slice(0, 20));
  process.exit(1);
}

// 尝试多种方式获取量表数据
let scales = [];
if (typeof SharedData.getActiveScales === 'function') {
  scales = SharedData.getActiveScales();
} else if (typeof SharedData.getAllScales === 'function') {
  scales = SharedData.getAllScales();
} else if (typeof SharedData.getScales === 'function') {
  scales = SharedData.getScales();
} else if (typeof SharedData.getDefaultScales === 'function') {
  scales = SharedData.getDefaultScales();
} else if (SharedData.scales) {
  scales = SharedData.scales;
} else if (SharedData.DEFAULT_SCALES) {
  scales = SharedData.DEFAULT_SCALES;
}
if (!Array.isArray(scales) || scales.length === 0) {
  // 尝试同步方法
  if (typeof SharedData.syncToFrontend === 'function') {
    SharedData.syncToFrontend();
  }
  if (typeof SharedData.getScales === 'function') {
    scales = SharedData.getScales();
  }
}
if (!Array.isArray(scales) || scales.length === 0) {
  console.error('[ERROR] 未获取到量表数据');
  console.log('[DEBUG] SharedData keys:', Object.keys(SharedData).slice(0, 20));
  console.log('[DEBUG] SharedData type:', typeof SharedData);
  console.log('[DEBUG] SharedData.getScales type:', typeof SharedData.getScales);
  if (typeof SharedData.getScales === 'function') {
    const testResult = SharedData.getScales();
    console.log(
      '[DEBUG] getScales result type:',
      typeof testResult,
      Array.isArray(testResult),
      testResult ? testResult.length : 'N/A'
    );
  }
  process.exit(1);
}

console.log('======================================================');
console.log('计分引擎全量验证 — 共', scales.length, '个量表');
console.log('======================================================\n');

// ============================================================
// 3. 构造模拟答案并测试每个量表
// ============================================================
const results = [];
let passCount = 0;
let warnCount = 0;
let failCount = 0;

for (let si = 0; si < scales.length; si++) {
  const scale = scales[si];
  const scaleName = scale.name || scale.title || scale.shortName || '量表#' + (si + 1);
  const shortName = scale.shortName || scale.code || '';
  const questions = scale.questions || [];

  // 构造模拟答案：每题选第一个选项
  const answers = {};
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const qid = q.id || qi + 1;

    if (q.type === 'matrix' && q.rows && q.options) {
      // 矩阵题：每行选第一列
      const matAns = {};
      for (let ri = 0; ri < q.rows.length; ri++) {
        matAns[q.rows[ri].id] = 0;
      }
      answers[qid] = matAns;
    } else if (q.type === 'parent-child') {
      // 父子题：选第一个主选项，带2个子选项
      answers[qid] = { main: 1, subs: [0, 1] };
    } else if (q.type === 'grouped' && q.groups) {
      // 分组题：每组选第一个选项
      const grpAns = {};
      if (Array.isArray(q.groups)) {
        for (let gi = 0; gi < q.groups.length; gi++) {
          const grp = q.groups[gi];
          const grpOpts = grp.options || [];
          if (grpOpts.length > 0) {
            grpAns[grp.id || grp.label] = grpOpts[0].id !== undefined ? grpOpts[0].id : 0;
          }
        }
      } else if (typeof q.groups === 'object') {
        const grpKeys = Object.keys(q.groups);
        for (let gki = 0; gki < grpKeys.length; gki++) {
          const gk = grpKeys[gki];
          const gOpts = q.groups[gk];
          if (Array.isArray(gOpts) && gOpts.length > 0) {
            grpAns[gk] = gOpts[0].id !== undefined ? gOpts[0].id : 0;
          }
        }
      }
      answers[qid] = grpAns;
    } else if (q.type === 'text') {
      // 文本题：填测试文本
      answers[qid] = '测试回答';
    } else {
      // 普通单选/多选题：选第一个选项
      const opts = q.options || [];
      if (opts.length > 0) {
        answers[qid] = opts[0].id !== undefined ? opts[0].id : 0;
      }
    }
  }

  // 调用计分引擎
  var result;
  let error = null;
  try {
    result = ScoringEngine.calculate(scale, answers);
  } catch (e) {
    error = e;
  }

  // 检查结果
  const checks = {
    noError: true,
    totalScoreNonZero: false,
    dimensionsNonEmpty: false,
    interpretationExists: false,
    metricsValid: false,
    screeningValid: false
  };

  if (error) {
    checks.noError = false;
  } else {
    const ts = result.metrics.totalScore || result.metrics.total_score || result.metrics.totalScore;
    checks.totalScoreNonZero = ts !== undefined && ts !== 0;
    checks.dimensionsNonEmpty = result.dimensions && result.dimensions.length > 0;
    checks.interpretationExists = result.interpretation && result.interpretation.length > 0;
    checks.metricsValid = result.metrics && Object.keys(result.metrics).length > 0;
    checks.screeningValid = result.screening !== undefined;
  }

  const allPass = checks.noError && checks.metricsValid && checks.screeningValid;
  // totalScore 和 dimensions 可能有些量表本来就没有，用 WARN 标记
  let status = allPass ? '✅' : '❌';
  if (!checks.totalScoreNonZero && allPass) {
    status = '⚠️';
  }
  if (!checks.dimensionsNonEmpty && allPass && checks.totalScoreNonZero) {
    status = '⚠️';
  }

  if (error) {
    failCount++;
  } else if (!checks.totalScoreNonZero || !checks.dimensionsNonEmpty) {
    warnCount++;
  } else {
    passCount++;
  }

  const summary = {
    index: si + 1,
    name: scaleName,
    shortName: shortName,
    questionCount: questions.length,
    hasScoring: !!scale.scoring,
    status: status,
    error: error ? error.message : null
  };

  if (!error) {
    summary.totalScore = result.metrics.totalScore || result.metrics.total_score || 0;
    summary.dimensionsCount = result.dimensions ? result.dimensions.length : 0;
    summary.interpretationCount = result.interpretation ? result.interpretation.length : 0;
    summary.hasScreening = result.screening && result.screening.result !== 'none';
    summary.metricKeys = Object.keys(result.metrics);

    // 详细检查
    summary.checks = checks;
  }

  results.push(summary);

  // 打印每个量表的摘要
  console.log('' + (si + 1) + '. [' + status + '] ' + scaleName + ' (' + shortName + ')');
  console.log('   题目数:', questions.length, '| 计分配置:', scale.scoring ? '有' : '无(回退)');
  if (error) {
    console.log('   错误:', error.message);
  } else {
    console.log(
      '   总分:',
      summary.totalScore,
      '| 维度数:',
      summary.dimensionsCount,
      '| 解释数:',
      summary.interpretationCount
    );
    console.log('   指标:', summary.metricKeys.join(', '));
    console.log('   筛查:', summary.hasScreening ? result.screening.result : '无');
    console.log(
      '   检查: 错误=' +
        (checks.noError ? '✅' : '❌') +
        ' 总分非零=' +
        (checks.totalScoreNonZero ? '✅' : '⚠️') +
        ' 维度非空=' +
        (checks.dimensionsNonEmpty ? '✅' : '⚠️') +
        ' 解释=' +
        (checks.interpretationExists ? '✅' : '⚠️') +
        ' 指标有效=' +
        (checks.metricsValid ? '✅' : '❌') +
        ' 筛查=' +
        (checks.screeningValid ? '✅' : '❌')
    );
  }
  console.log('');
}

// ============================================================
// 4. 总结
// ============================================================
console.log('======================================================');
console.log('总结');
console.log('======================================================');
console.log('总量表数:', scales.length);
console.log('PASS (✅):', passCount);
console.log('WARN (⚠️):', warnCount);
console.log('FAIL (❌):', failCount);

// 列出 WARN 和 FAIL
const issues = results.filter(function (r) {
  return r.status !== '✅';
});
if (issues.length > 0) {
  console.log('\n问题详情:');
  for (let ii = 0; ii < issues.length; ii++) {
    const iss = issues[ii];
    console.log('  [' + iss.status + '] #' + iss.index + ' ' + iss.name + ' (' + iss.shortName + ')');
    if (iss.error) {
      console.log('    错误:', iss.error);
    }
    if (iss.checks) {
      if (!iss.checks.totalScoreNonZero) {
        console.log('    总分为零');
      }
      if (!iss.checks.dimensionsNonEmpty) {
        console.log('    维度数组为空');
      }
      if (!iss.checks.interpretationExists) {
        console.log('    无解释规则');
      }
    }
  }
}

console.log('\n测试完成。');
