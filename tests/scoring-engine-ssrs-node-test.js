#!/usr/bin/env node
/**
 * SSRS 计分引擎 Node.js 测试
 * 使用 vm 模块直接加载 scoring-engine.js，测试新题型计分逻辑
 *
 * 运行：cd /Users/rich/WorkBuddy/20260407113106 && NODE_PATH=node_modules node tests/scoring-engine-ssrs-node-test.js
 */

const fs = require('fs');
const vm = require('vm');

let passed = 0,
  failed = 0;
function assert(c, m) {
  if (!c) {
    failed++;
    console.log(`  ❌ ${m}`);
    return;
  }
  passed++;
  console.log(`  ✅ ${m}`);
}

// ===== 加载 scoring-engine.js =====
const code = fs.readFileSync('mini-app-h5/scoring-engine.js', 'utf8');
const sandbox = { console, Math, Array, Object, JSON, parseFloat, parseInt, isNaN, window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const engine = sandbox.ScoringEngine;
const _collectSpecialScore = sandbox._collectSpecialScore;

console.log('\n🧪 SSRS 计分引擎 Node.js 测试');
console.log('='.repeat(55));
console.log(`Engine API: ${Object.keys(engine).join(', ')}`);

// ===== 定义 SSRS 量表 =====
const SSRS = {
  id: 'SSRS',
  name: '社会支持评定量表',
  code: 'SSRS',
  questionCount: 10,
  questions: [
    { id: 1, type: 'single', options: [{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }] },
    { id: 2, type: 'single', options: [{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }] },
    { id: 3, type: 'single', options: [{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }] },
    { id: 4, type: 'single', options: [{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }] },
    {
      id: 5,
      type: 'matrix',
      rows: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }],
      options: [{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }]
    },
    {
      id: 6,
      type: 'parent-child',
      options: [
        { id: 0, isTerminal: true },
        { id: 1, hasChildren: true }
      ],
      subOptions: [
        { id: 'A' },
        { id: 'B' },
        { id: 'C' },
        { id: 'D' },
        { id: 'E' },
        { id: 'F' },
        { id: 'G' },
        { id: 'H' },
        { id: 'I', hasInput: true }
      ]
    },
    {
      id: 7,
      type: 'parent-child',
      options: [
        { id: 0, isTerminal: true },
        { id: 1, hasChildren: true }
      ],
      subOptions: [
        { id: 'A' },
        { id: 'B' },
        { id: 'C' },
        { id: 'D' },
        { id: 'E' },
        { id: 'F' },
        { id: 'G' },
        { id: 'H' },
        { id: 'I', hasInput: true }
      ]
    },
    { id: 8, type: 'single', options: [{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }] },
    { id: 9, type: 'single', options: [{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }] },
    { id: 10, type: 'single', options: [{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }] }
  ],
  scoring: { type: 'SUM', maxScore: 66, minScore: 12, keys: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }
};

// ===== 模块1: _collectSpecialScore =====
console.log('\n📦 模块1: _collectSpecialScore');

assert(typeof _collectSpecialScore === 'function', '_collectSpecialScore 可访问');

const q5 = SSRS.questions[4];
assert(_collectSpecialScore(q5, { A: 0, B: 1, C: 2, D: 3, E: 2 }) === 13, 'Q5 matrix: 1+2+3+4+3=13');
assert(_collectSpecialScore(q5, { A: 3, B: 3, C: 3, D: 3, E: 3 }) === 20, 'Q5 matrix 满分: 5×4=20');
assert(_collectSpecialScore(q5, { A: 0, B: 0, C: 0, D: 0, E: 0 }) === 5, 'Q5 matrix 最低: 5×1=5');

const q6 = SSRS.questions[5];
assert(_collectSpecialScore(q6, { main: 0, subs: [], subFill: {} }) === 0, 'Q6 无任何来源: 0');
assert(_collectSpecialScore(q6, { main: 1, subs: ['A', 'C', 'I'], subFill: { I: 'x' } }) === 3, 'Q6 3个子选项: 3');
assert(
  _collectSpecialScore(q6, { main: 1, subs: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], subFill: {} }) === 9,
  'Q6 全选9个: 9'
);

const q7 = SSRS.questions[6];
assert(_collectSpecialScore(q7, { main: 1, subs: ['A', 'C', 'I'], subFill: { I: 'x' } }) === 3, 'Q7 3个子选项: 3');
assert(_collectSpecialScore(q7, { main: 0, subs: [], subFill: {} }) === 0, 'Q7 无任何来源: 0');

// ===== 模块2: engine.calculate（公共 API）=====
console.log('\n📦 模块2: engine.calculate（完整计分）');

assert(typeof engine.calculate === 'function', 'calculate 是公共 API');

// 答案：Q1=2, Q2=3, Q3=2, Q4=4, Q5=13, Q6=0, Q7=3, Q8=4, Q9=3, Q10=2 → 总分=36
const answers = {
  1: 1,
  2: 2,
  3: 1,
  4: 3,
  5: { A: 0, B: 1, C: 2, D: 3, E: 2 },
  6: { main: 0, subs: [], subFill: {} },
  7: { main: 1, subs: ['A', 'C', 'I'], subFill: { I: '心理老师' } },
  8: 3,
  9: 2,
  10: 1
};

const result = engine.calculate(SSRS, answers);
const totalScore = result.metrics ? result.metrics.totalScore : result.totalScore;
console.log(`  总分: ${totalScore} (预期: 36)`);

assert(totalScore === 36, `总分: ${totalScore} ≠ 36`);

// ===== 模块3: engine.calcMaxScores / calcMinScores =====
console.log('\n📦 模块3: engine.calcMaxScores / calcMinScores');

assert(typeof engine.calcMaxScores === 'function', 'calcMaxScores 是公共 API');
assert(typeof engine.calcMinScores === 'function', 'calcMinScores 是公共 API');

const maxResult = engine.calcMaxScores(SSRS.scoring, SSRS.questions);
const minResult = engine.calcMinScores(SSRS.scoring, SSRS.questions);

// calcMaxScores 返回 { dimsMax, totalMax } 或类似结构
console.log('  maxResult:', JSON.stringify(maxResult));
console.log('  minResult:', JSON.stringify(minResult));

// 验证总分范围
const totalMax =
  maxResult.totalMax ||
  maxResult.total ||
  (maxResult.dimsMax ? Object.values(maxResult.dimsMax).reduce((a, b) => a + b, 0) : null);
const totalMin =
  minResult.totalMin ||
  minResult.total ||
  (minResult.dimsMax ? Object.values(minResult.dimsMax).reduce((a, b) => a + b, 0) : null);

console.log(`  总分范围: ${totalMin} ~ ${totalMax}`);

if (totalMax !== null) {
  assert(totalMax === 66, `最高分: ${totalMax} ≠ 66`);
}
if (totalMin !== null) {
  assert(totalMin === 12, `最低分: ${totalMin} ≠ 12`);
}

// ===== 汇总 =====
console.log('\n' + '='.repeat(55));
if (failed === 0) {
  console.log(`✅ 全部通过: ${passed}/${passed + failed}`);
} else {
  console.log(`❌ ${failed} 个失败 / ${passed} 个通过`);
}
console.log('='.repeat(55));
process.exit(failed > 0 ? 1 : 0);
