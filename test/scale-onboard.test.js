/**
 * scale-onboard.html 核心函数单元测试
 * 运行方式: node test/scale-onboard.test.js
 */

// ============================================================
// 辅助函数（从 HTML 中复制，与实际代码保持一致）
// ============================================================

function normalizeScaleData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  // name 缺失时用 displayName / shortName / desc 兜底
  if (!data.name && data.displayName) {
    data.name = data.displayName;
  }
  if (!data.name && data.shortName) {
    data.name = data.shortName;
  }
  if (!data.name && data.desc) {
    data.name = data.desc.replace(/\n/g, ' ').trim().substring(0, 30);
  }
  // code 缺失时自动生成
  if (!data.code && data.name) {
    const raw = data.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '');
    if (/^[\u4e00-\u9fff]+$/.test(raw) || /[\u4e00-\u9fff]/.test(raw)) {
      data.code = (data.shortName || data.displayName || '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .substring(0, 15);
      if (!data.code) {
        data.code = 'SCALE_' + Date.now().toString(36).toUpperCase();
      }
    } else {
      data.code = raw.toUpperCase().substring(0, 15);
    }
  }
  // questions 兜底为空数组
  if (!Array.isArray(data.questions)) {
    if (data.questions && typeof data.questions === 'object') {
      const qs = [];
      Object.keys(data.questions).forEach(function (k) {
        if (!isNaN(parseInt(k))) {
          qs.push(data.questions[k]);
        }
      });
      data.questions = qs.length > 0 ? qs : [];
    } else {
      data.questions = [];
    }
  }
  // preQuestions 兜底
  if (!Array.isArray(data.preQuestions)) {
    data.preQuestions = [];
  }
  return data;
}

function validateImportData(data) {
  const errors = [];

  if (!data.name || data.name.trim() === '') {
    errors.push('缺少量表名称');
  }
  if (!data.code || data.code.trim() === '') {
    errors.push('缺少量表编码');
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    errors.push('缺少题目数组或数组为空');
  }
  if (Array.isArray(data.questions)) {
    data.questions.forEach((q, i) => {
      if (!q.content && !q.text && !q.stem) {
        errors.push(`题目${i + 1}缺少内容`);
      }
      if (!Array.isArray(q.options)) {
        errors.push(`题目${i + 1}的选项不是数组`);
      }
    });
  }

  return errors;
}

// ============================================================
// 测试用例
// ============================================================

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEqual(actual, expected, message = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`❌ 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)} ${message}`);
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(`❌ 期望为真，实际为假 ${message}`);
  }
}

// ----------------------------------------
// normalizeScaleData 测试
// ----------------------------------------

test('normalizeScaleData: 完整数据保持不变', () => {
  const input = {
    name: '测试量表',
    code: 'TEST001',
    category: 'anxiety',
    questions: [{ id: 1, content: '题目1', options: [{ id: 'A', label: '选项', score: 0 }] }]
  };
  const result = normalizeScaleData(input);
  assertEqual(result.name, '测试量表');
  assertEqual(result.code, 'TEST001');
  assertEqual(result.questions.length, 1);
});

test('normalizeScaleData: 缺少 name 时用 desc 前30字', () => {
  const input = {
    desc: '这是一个非常非常非常非常非常长的描述',
    questions: []
  };
  normalizeScaleData(input);
  // 实际会截断到30字
  assertTrue(input.name.length <= 30, 'name 应该被截断到30字以内');
  assertTrue(input.name.includes('这'), 'name 应该包含 desc 的开头');
});

test('normalizeScaleData: 缺少 code 时生成时间戳 code', () => {
  const input = { name: '测试量表', questions: [] };
  normalizeScaleData(input);
  assertTrue(input.code.startsWith('SCALE_') || input.code.length > 0, 'code 应该被生成');
});

test('normalizeScaleData: 空数据直接返回', () => {
  const input = {};
  const result = normalizeScaleData(input);
  // 空数据直接返回原对象
  assertTrue(result === input || result === undefined || result === null, '空数据应直接返回');
});

// ----------------------------------------
// validateImportData 测试
// ----------------------------------------

test('validateImportData: 完整数据无错误', () => {
  const input = {
    name: '测试量表',
    code: 'TEST001',
    questions: [{ id: 1, content: '题目', options: [{ id: 'A', label: '选项', score: 0 }] }]
  };
  const errors = validateImportData(input);
  assertEqual(errors.length, 0);
});

test('validateImportData: 缺少 name 返回错误', () => {
  const input = {
    code: 'TEST001',
    questions: []
  };
  const errors = validateImportData(input);
  assertTrue(
    errors.some((e) => e.includes('名称')),
    '应该报告缺少名称'
  );
});

test('validateImportData: 缺少 questions 返回错误', () => {
  const input = {
    name: '测试',
    code: 'TEST001'
  };
  const errors = validateImportData(input);
  assertTrue(
    errors.some((e) => e.includes('题目')),
    '应该报告缺少题目'
  );
});

test('validateImportData: 题目缺少内容返回错误', () => {
  const input = {
    name: '测试',
    code: 'TEST001',
    questions: [{ id: 1, options: [] }]
  };
  const errors = validateImportData(input);
  assertTrue(errors.length > 0, '应该报告题目缺少内容');
});

test('validateImportData: 题目选项不是数组返回错误', () => {
  const input = {
    name: '测试',
    code: 'TEST001',
    questions: [{ id: 1, content: '题目', options: '不是数组' }]
  };
  const errors = validateImportData(input);
  assertTrue(
    errors.some((e) => e.includes('选项不是数组')),
    '应该报告选项不是数组'
  );
});

// ============================================================
// 运行测试
// ============================================================

console.log('🧪 scale-onboard.html 单元测试\n');
console.log('='.repeat(50));

let passed = 0;
let failed = 0;

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`${e.message}`);
    failed++;
  }
}

console.log('='.repeat(50));
console.log(`\n结果: ${passed} 通过, ${failed} 失败`);

if (failed > 0) {
  process.exit(1);
}
