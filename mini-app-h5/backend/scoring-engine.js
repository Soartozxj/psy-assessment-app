/**
 * scoring-engine.js — 星蓝心镜计分引擎 v2
 *
 * 核心设计：
 *   - 计分规则嵌入量表对象的 scoring 字段
 *   - 反向计分在导入时已预处理，运行时直接求和
 *   - 支持 SUM / AVG / COUNT_IF / DERIVED 四种公式
 *   - 支持线性公式转换（如 Y = 1.25X），兼容字符串和对象两种格式
 *   - 支持阈值分档解释 + OR/AND 筛查判定
 *   - 支持跨指标引用的派生指标（DERIVED）
 *
 * 数据结构参考：
 *   scale.scoring = {
 *     dimensions: [
 *       { key, label, formula, items, transform?, interpretation?: [{ min, max, level, label, color, text }] }
 *     ],
 *     metrics: [
 *       { key, label, formula, items, transform?, condition?, expression? }
 *     ],
 *     interpretation: [
 *       { metric?, min, max, level, label, color, text }
 *     ],
 *     screening: {
 *       logic: "OR"|"AND",
 *       conditions: [{ metric, op, value, label }],
 *       positiveLabel, negativeLabel
 *     }
 *   }
 *
 * 公式类型：
 *   SUM      — 求和
 *   AVG      — 平均
 *   COUNT_IF — 条件计数（需配合 condition: { ">=": 2 } 或 threshold: 2, operator: ">="）
 *   DERIVED  — 派生指标（需配合 expression: "(总分 - 阴性项目数) / 阳性项目数"）
 */

const ScoringEngine = (() => {
  // 兼容数组和对象格式的 groups
  function _toGroupArray(groups) {
    if (!groups) {
      return [];
    }
    if (Array.isArray(groups)) {
      return groups;
    }
    return Object.keys(groups).map(function (k) {
      return { id: k, options: groups[k] };
    });
  }
  /**
   * 安全数学表达式求值（替代 new Function）
   * 仅支持 +, -, *, /, (, ), 数字, Math.abs()
   * @param {string} expr - 已替换好变量的数学表达式
   * @returns {number}
   */
  function safeEval(expr) {
    // 第一步：预处理 Math.abs(x) / ABS(x) → 递归求值 |x|
    const absRegex = /(?:Math\.)?ABS\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi;
    expr = expr.replace(absRegex, function (_, inner) {
      const val = safeEval(inner.trim());
      return String(Math.abs(val));
    });

    // 第二步：验证——只允许数字、运算符、括号、小数点、空格
    if (!/^[\d+\-*/().\s]+$/.test(expr)) {
      throw new Error('非法字符: ' + expr);
    }

    // 第三步：使用递归下降解析器求值
    const tokens = tokenize(expr);
    const result = parseExpression(tokens);
    if (tokens.length > 0) {
      throw new Error('表达式未完全解析，剩余: ' + tokens.join(' '));
    }
    return result;
  }

  /** 分词器 */
  function tokenize(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (/[\d.]/.test(ch)) {
        let num = '';
        while (i < expr.length && /[\d.]/.test(expr[i])) {
          num += expr[i++];
        }
        tokens.push({ type: 'num', value: Number(num) });
        continue;
      }
      if ('+-*/()'.includes(ch)) {
        tokens.push({ type: ch });
        i++;
        continue;
      }
      throw new Error('无法识别的字符: ' + ch);
    }
    return tokens;
  }

  /** 解析表达式: term (('+' | '-') term)* */
  function parseExpression(tokens) {
    let result = parseTerm(tokens);
    while (tokens.length > 0 && (tokens[0].type === '+' || tokens[0].type === '-')) {
      const op = tokens.shift().type;
      const rhs = parseTerm(tokens);
      result = op === '+' ? result + rhs : result - rhs;
    }
    return result;
  }

  /** 解析项: factor (('*' | '/') factor)* */
  function parseTerm(tokens) {
    let result = parseFactor(tokens);
    while (tokens.length > 0 && (tokens[0].type === '*' || tokens[0].type === '/')) {
      const op = tokens.shift().type;
      const rhs = parseFactor(tokens);
      if (op === '/') {
        if (rhs === 0) {
          throw new Error('除以零');
        }
        result = result / rhs;
      } else {
        result = result * rhs;
      }
    }
    return result;
  }

  /** 解析因子: number | '(' expression ')' | unary +/- */
  function parseFactor(tokens) {
    if (tokens.length === 0) {
      throw new Error('意外的表达式结尾');
    }
    let sign = 1;
    while (tokens[0].type === '+' || tokens[0].type === '-') {
      if (tokens.shift().type === '-') {
        sign = -sign;
      }
    }
    const tok = tokens.shift();
    if (tok.type === 'num') {
      return sign * tok.value;
    }
    if (tok.type === '(') {
      const result = parseExpression(tokens);
      if (tokens.length === 0 || tokens.shift().type !== ')') {
        throw new Error('缺少右括号');
      }
      return sign * result;
    }
    throw new Error('意外的符号: ' + JSON.stringify(tok));
  }

  /** 四舍五入保留两位小数 */
  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  /** 提取 grouped 题型的得分计算逻辑 */
  function calcGroupedScore(q, scores, mode) {
    if (!q.groups || q.type !== 'grouped') {
      return null;
    }
    const isMultiply = q.formula === 'multiply';
    let total = isMultiply ? 1 : 0;
    for (let _gi = 0, _grps = _toGroupArray(q.groups); _gi < _grps.length; _gi++) {
      const group = _grps[_gi];
      if (!group.options || group.options.length === 0) {
        continue;
      }
      const values = group.options.map((o) => o.score || 0);
      let groupVal;
      if (mode === 'max') {
        groupVal = Math.max(...values);
      } else if (mode === 'min') {
        groupVal = Math.min(...values);
      } else {
        // mode === 'sum': 使用用户答案计算
        const grpScore = group.options.reduce((sum, o) => {
          const matched = scores.filter((s) => s.optionId === o.id || s.optionIndex === o.optIndex);
          return sum + (matched.length > 0 ? matched[0].score : 0);
        }, 0);
        groupVal = grpScore;
      }
      total = isMultiply ? total * groupVal : total + groupVal;
    }
    return total;
  }

  /**
   * 题号解析：支持 "ALL"、"1,3,5-8,12" 混合格式
   * @param {string|number[]} items - 题号描述
   * @param {number} totalQuestions - 总题数（用于 ALL 展开）
   * @returns {number[]} 展开后的题号数组
   */
  function parseItems(items, totalQuestions) {
    if (items === 'ALL') {
      return Array.from({ length: totalQuestions }, (_, i) => i + 1);
    }
    if (Array.isArray(items)) {
      return items;
    }

    const result = [];
    const parts = String(items).split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-').map((s) => parseInt(s.trim()));
        if (!isNaN(startStr) && !isNaN(endStr)) {
          for (let i = startStr; i <= endStr; i++) {
            result.push(i);
          }
        }
      } else {
        const num = parseInt(trimmed);
        if (!isNaN(num)) {
          result.push(num);
        }
      }
    }
    return result;
  }

  /**
   * 收集新题型得分（matrix / matrix-multi / parent-child）
   * @param {object} q - 题目对象（含 type 字段）
   * @param {object} ans - 该题的答案（对象格式）
   * @returns {number|null} 得分，null 表示非特殊题型
   */
  function _collectSpecialScore(q, ans, dimKey) {
    // 矩阵题：每行选一列，各列分数求和
    if (q.type === 'matrix') {
      let total = 0;
      const rows = q.rows || [];
      const opts = q.options || [];
      for (const row of rows) {
        const colIdx = ans[row.id];
        if (colIdx !== undefined && colIdx !== null && opts[colIdx]) {
          total += opts[colIdx].score || 0;
        }
      }
      return total;
    }
    // 分组下拉题
    if (q.type === 'grouped') {
      const _isMultiply = q.formula === 'multiply';
      const grps = q.groups || {};
      const grpArray = Array.isArray(grps)
        ? grps
        : Object.keys(grps).map(function (k) {
            return { id: k, options: grps[k] };
          });
      // allowRepeat: 每个补充事件独立乘法计分，事件之间求和
      if (Array.isArray(ans)) {
        var total = 0;
        for (let ai = 0; ai < ans.length; ai++) {
          let item = ans[ai],
            itemScore = _isMultiply ? 1 : 0;
          for (var gi = 0; gi < grpArray.length; gi++) {
            var grp = grpArray[gi],
              oid = item[grp.id];
            if (oid !== undefined && oid !== null) {
              var opt = (grp.options || []).find(function (o) {
                return o.id === oid;
              });
              if (opt) {
                if (_isMultiply) {
                  itemScore *= opt.score || 0;
                } else {
                  itemScore += opt.score || 0;
                }
              }
            }
          }
          total += itemScore;
        }
        return total;
      }
      // 普通 grouped
      var total = _isMultiply ? 1 : 0;
      // 按维度 key 前缀匹配分组：father_/f_ → 父亲，mother_/m_ → 母亲
      let targetGroup = null;
      if (dimKey) {
        if (dimKey.indexOf('father_') === 0 || dimKey.indexOf('f_') === 0 || dimKey.indexOf('父亲') === 0) {
          targetGroup = '父亲';
        } else if (dimKey.indexOf('mother_') === 0 || dimKey.indexOf('m_') === 0 || dimKey.indexOf('母亲') === 0) {
          targetGroup = '母亲';
        }
      }
      for (var gi = 0; gi < grpArray.length; gi++) {
        var grp = grpArray[gi],
          oid = ans[grp.id];
        // 如果指定了目标分组，跳过不匹配的分组
        if (targetGroup && grp.id !== targetGroup) {
          continue;
        }
        if (oid !== undefined && oid !== null) {
          var opt = (grp.options || []).find(function (o) {
            return o.id === oid;
          });
          // 回退：按索引匹配（options 无 id 字段时）
          if (!opt && typeof oid === 'number' && oid >= 0 && oid < (grp.options || []).length) {
            opt = grp.options[oid];
          }
          if (opt) {
            if (_isMultiply) {
              total *= opt.score || 0;
            } else {
              total += opt.score || 0;
            }
          }
        }
      }
      return total;
    }
    // 父子题：选"无任何来源"=0分，否则=选中的子选项数
    if (q.type === 'parent-child') {
      if (ans.main === 0 || ans.main === '0') {
        return 0;
      }
      return Array.isArray(ans.subs) ? ans.subs.length : 0;
    }
    return null;
  }

  /**
   * 收集指定题目的得分
   * @param {object[]} questions - 题目数组
   * @param {number[]} itemIds - 题号数组
   * @param {object} answers - 用户答案 { questionId: optionIndex | object }
   * @param {object|null} condition - 可选条件过滤: { group: "g_nature", eq: "A" } 过滤 grouped 答案
   * @returns {number[]} 得分数组
   */
  function collectScores(questions, itemIds, answers, condition, dimKey) {
    const _grpFilter = condition && condition.group && condition.eq;
    const scores = [];
    for (const qid of itemIds) {
      // 兼容数字题号和字符串题号
      const q = questions.find((q) => q.id == qid);
      if (!q) {
        continue;
      }
      // 文字题不计分，直接跳过
      if (q.type === 'text') {
        continue;
      }
      // 兼容数字键和字符串键
      const ans = answers[qid] !== undefined ? answers[qid] : answers[String(qid)];
      if (ans === undefined || ans === null) {
        continue;
      }

      // grouped 条件过滤: 按指定 group 的选中值筛选
      if (_grpFilter && typeof ans === 'object' && ans !== null) {
        if (ans[condition.group] !== condition.eq) {
          continue;
        }
      }

      // 新题型：答案为对象（matrix/parent-child）
      if (typeof ans === 'object' && ans !== null) {
        const score = _collectSpecialScore(q, ans, dimKey);
        if (score !== null) {
          scores.push(score);
        }
        continue;
      }

      // 原有逻辑：简单值（数字索引或选项 id）
      let opt;
      if (typeof ans === 'number' && ans < q.options.length) {
        opt = q.options[ans];
      } else if (typeof ans === 'string') {
        opt = q.options.find((o) => o.id === ans);
      } else {
        opt = q.options.find((o) => o.id === ans);
      }
      if (opt) {
        scores.push(opt.score || 0);
      }
    }
    return scores;
  }

  /**
   * 统一 condition 格式
   * 支持旧格式 { ">=": 2 } 和新格式 { threshold: 2, operator: ">=" }
   * @returns {{ operator: string, value: number }|null}
   */
  function normalizeCondition(condition) {
    if (!condition) {
      return null;
    }
    // 新格式: { threshold, operator }
    if (condition.threshold !== undefined && condition.operator) {
      return { operator: condition.operator, value: Number(condition.threshold) };
    }
    // 旧格式: { ">=": 2 }
    const ops = ['>=', '<=', '!=', '==', '>', '<'];
    for (const op of ops) {
      if (condition[op] !== undefined) {
        return { operator: op, value: Number(condition[op]) };
      }
    }
    return null;
  }

  /**
   * 执行公式计算
   * @param {string} formula - SUM | AVG | COUNT_IF | DERIVED
   * @param {number[]} scores - 得分数组
   * @param {object|null} condition - 计数条件（兼容旧格式 { ">=": 2 } 和新格式 { threshold, operator }）
   * @returns {number}
   */
  function applyFormula(formula, scores, condition) {
    if (scores.length === 0 && formula !== 'DERIVED') {
      return 0;
    }

    switch (formula) {
      case 'SUM':
        return scores.reduce((a, b) => a + b, 0);

      case 'AVG':
        return scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;

      case 'COUNT_IF': {
        const norm = normalizeCondition(condition);
        if (!norm) {
          return scores.length;
        } // 无条件 = 统计总数
        return scores.filter((s) => compareValue(s, norm.operator, norm.value)).length;
      }

      case 'DERIVED':
        // DERIVED 不在此处计算，在 calculate() 中特殊处理
        return 0;

      default:
        return scores.reduce((a, b) => a + b, 0);
    }
  }

  /**
   * 数值比较
   */
  function compareValue(actual, operator, target) {
    switch (operator) {
      case '>=':
        return actual >= target;
      case '>':
        return actual > target;
      case '<=':
        return actual <= target;
      case '<':
        return actual < target;
      case '==':
        return actual === target;
      case '!=':
        return actual !== target;
      default:
        return false;
    }
  }

  /**
   * 应用公式转换（兼容两种格式）
   * 旧格式（对象）: { type: "linear", expression: "1.25*x" }
   * 新格式（字符串）: "1.25*x"
   * @param {number} value - 原始值
   * @param {object|string|null} transform - 转换规则
   * @returns {number}
   */
  function applyTransform(value, transform) {
    if (!transform || value === undefined || value === null || typeof value !== 'number') {
      return value;
    }
    let expression;
    if (typeof transform === 'string') {
      expression = transform;
    } else if (transform.expression) {
      expression = transform.expression;
    } else {
      return value;
    }
    try {
      // 将变量 X/x 替换为实际值
      const expr = expression.replace(/x/gi, `(${value})`);
      // 使用安全求值引擎
      const result = safeEval(expr);
      return round2(result);
    } catch (_) {
      console.warn('[ScoringEngine] 公式转换失败:', _, transform);
      return value;
    }
  }

  /**
   * 匹配解释规则
   * 支持两种格式：
   *   旧格式（无 metric）: { min, max, level, label, ... } — 基于总分匹配
   *   新格式（有 metric）: { metric, min/max 或 condition, label, ... } — 基于指定指标匹配
   * @param {number} score - 待匹配的分数
   * @param {object[]} rules - 解释规则数组
   * @returns {object|null}
   */
  function matchInterpretation(score, rules) {
    if (!rules || rules.length === 0) {
      return null;
    }
    for (const rule of rules) {
      // 新格式：基于 min/max 范围
      if (rule.min !== undefined || rule.max !== undefined) {
        const minOk = rule.min === undefined || rule.min === null || score >= rule.min;
        const maxOk = rule.max === undefined || rule.max === null || score <= rule.max;
        if (minOk && maxOk) {
          return rule;
        }
      }
      // 新格式：基于 condition 字符串（如 ">2"、">=160"）
      if (rule.condition) {
        const parsed = parseConditionStr(rule.condition);
        if (parsed && compareValue(score, parsed.operator, parsed.value)) {
          return rule;
        }
      }
    }
    return null;
  }

  /**
   * 解析条件字符串 ">160"、">=2"、"<50"、"<=43" 为 { operator, value }
   * @param {string} str - 如 ">160"
   * @returns {{ operator: string, value: number }|null}
   */
  function parseConditionStr(str) {
    if (typeof str !== 'string') {
      return null;
    }
    const match = str.trim().match(/^(>=|<=|!=|==|>|<)\s*(-?\d+(\.\d+)?)$/);
    if (!match) {
      return null;
    }
    return { operator: match[1], value: Number(match[2]) };
  }

  /**
   * 执行筛查判定
   * @param {object} screening - 筛查规则
   * @param {object} metricValues - 所有指标值（含维度分）
   * @returns {object} { result, triggeredRules, matchedConditions }
   */
  function evaluateScreening(screening, metricValues) {
    if (!screening || !screening.conditions || screening.conditions.length === 0) {
      return { result: 'none', triggeredRules: [], matchedConditions: [] };
    }

    const results = screening.conditions.map((cond) => {
      // 字段读取：cond.op（标准）/ cond.operator（兼容旧数据）
      //            cond.value（标准）/ cond.threshold（兼容旧数据）
      const metricName = cond.metric;
      const operator = cond.op || cond.operator;
      const threshold = cond.value !== undefined ? cond.value : cond.threshold;

      if (!metricName || operator === undefined || threshold === undefined) {
        console.warn('[ScoringEngine] 筛查条件缺少字段:', cond);
        return false;
      }

      // 在 metricValues 中查找（支持 key 或 label 匹配）
      let actual = metricValues[metricName];
      if (actual === undefined) {
        // 尝试 label 匹配
        const keys = Object.keys(metricValues);
        const matched = keys.find((k) => metricValues[k] && metricValues[k].label === metricName);
        if (matched) {
          actual = typeof metricValues[matched] === 'object' ? metricValues[matched].score : metricValues[matched];
        }
      }
      if (actual === undefined) {
        // 尝试在维度结果中查找
        const dimResult = (metricValues._dimensions || []).find((d) => d.label === metricName);
        if (dimResult) {
          actual = dimResult.score;
        }
      }

      if (actual === undefined) {
        return false;
      }
      // 如果值是对象（维度结果），取 score
      if (typeof actual === 'object' && actual.score !== undefined) {
        actual = actual.score;
      }

      return compareValue(Number(actual), operator, Number(threshold));
    });

    const triggered = [];
    screening.conditions.forEach((cond, i) => {
      if (results[i]) {
        triggered.push(cond);
      }
    });

    const logicFn = screening.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);

    return {
      result: logicFn ? screening.positiveLabel || '阳性' : screening.negativeLabel || '阴性',
      triggeredRules: triggered,
      matchedConditions: triggered
    };
  }

  /**
   * 获取指定题号列表中每道题的最大选项分
   * 支持 matrix（行数×最大列分）和 parent-child（子选项数最大值）
   * @param {object[]} questions - 题目数组
   * @param {number[]} itemIds - 题号数组
   * @returns {number[]} 每道题的最大选项分
   */
  function collectMaxScores(questions, itemIds) {
    const maxScores = [];
    for (const qid of itemIds) {
      const q = questions.find((q) => q.id == qid);
      if (!q) {
        continue;
      }
      // 文字题不计分（matrix-multi 需特殊处理，它没有顶层 options）
      if (q.type === 'text') {
        continue;
      }

      // 分组下拉题：每组最大分之和（必须在 options 检查之前）
      if (q.type === 'grouped' && q.groups) {
        const _isMultiply = q.formula === 'multiply';
        let total = _isMultiply ? 1 : 0;
        for (let _gi = 0, _grps = _toGroupArray(q.groups); _gi < _grps.length; _gi++) {
          const group = _grps[_gi];
          if (group.options && group.options.length > 0) {
            const _groupMax = Math.max(...group.options.map((o) => o.score || 0));
            if (_isMultiply) {
              total *= _groupMax;
            } else {
              total += _groupMax;
            }
          }
        }
        maxScores.push(total);
        continue;
      }

      if (!q.options || q.options.length === 0) {
        continue;
      }

      // 矩阵题：最大分 = 行数 × 最大列分
      if (q.type === 'matrix' && q.rows && q.rows.length > 0) {
        const maxCol = Math.max(...q.options.map((o) => o.score || 0));
        maxScores.push(q.rows.length * maxCol);
        continue;
      }

      // 父子题：最大分 = 子选项数量
      if (q.type === 'parent-child' && q.subOptions) {
        maxScores.push(q.subOptions.length);
        continue;
      }

      const maxOpt = Math.max(...q.options.map((o) => o.score || 0));
      maxScores.push(maxOpt);
    }
    return maxScores;
  }

  /**
   * 获取指定题号列表中每道题的最小选项分
   * 支持 matrix（行数×最小列分）和 parent-child（0，因为可以选"无任何来源"）
   * @param {object[]} questions - 题目数组
   * @param {number[]} itemIds - 题号数组
   * @returns {number[]} 每道题的最小选项分
   */
  function collectMinScores(questions, itemIds) {
    const minScores = [];
    for (const qid of itemIds) {
      const q = questions.find((q) => q.id == qid);
      if (!q) {
        continue;
      }
      // 文字题不计分
      if (q.type === 'text') {
        continue;
      }

      // 分组下拉题：每组最小分之和（必须在 options 检查之前）
      if (q.type === 'grouped' && q.groups) {
        const _isMultiply = q.formula === 'multiply';
        let total = _isMultiply ? 1 : 0;
        for (let _gi = 0, _grps = _toGroupArray(q.groups); _gi < _grps.length; _gi++) {
          const group = _grps[_gi];
          if (group.options && group.options.length > 0) {
            const _groupMin = Math.min(...group.options.map((o) => o.score || 0));
            if (_isMultiply) {
              total *= _groupMin;
            } else {
              total += _groupMin;
            }
          }
        }
        minScores.push(total);
        continue;
      }

      if (!q.options || q.options.length === 0) {
        continue;
      }

      // 矩阵题：最小分 = 行数 × 最小列分
      if (q.type === 'matrix' && q.rows && q.rows.length > 0) {
        const minCol = Math.min(...q.options.map((o) => o.score || 0));
        minScores.push(q.rows.length * minCol);
        continue;
      }

      // 父子题：最小分 = 0（选"无任何来源"）
      if (q.type === 'parent-child') {
        minScores.push(0);
        continue;
      }

      const minOpt = Math.min(...q.options.map((o) => o.score || 0));
      minScores.push(minOpt);
    }
    return minScores;
  }

  /**
   * 计算理论最大分（用于百分比和进度环显示）
   * @param {object} scoring - 计分规则配置
   * @param {object[]} questions - 题目数组（已确保 id 存在）
   * @param {object} actualMetrics - 实际指标值（用于 DERIVED 计算）
   * @returns {{ total: number, dimensions: { key: number } }}
   */
  /**
   * 从 interpretation 数组中推导理论最大分
   * 取所有 interpretation 规则中最大的 max 值作为理论最大分
   * @param {Array} interpretation - 解释规则数组
   * @returns {number|null}
   */
  function inferMaxFromInterpretation(interpretation) {
    if (!interpretation || interpretation.length === 0) {
      return null;
    }
    // 如果存在有 min 但没有 max 的规则（表示无上限区间），则不能用 interpretation 推导满分
    const hasOpenEnded = interpretation.some(
      (r) => r.min !== undefined && r.min !== null && (r.max === undefined || r.max === null)
    );
    if (hasOpenEnded) {
      return null;
    }
    const allMax = interpretation.filter((r) => r.max !== undefined && r.max !== null).map((r) => r.max);
    return allMax.length > 0 ? Math.max(...allMax) : null;
  }

  /**
   * 从 interpretation 数组中推导理论最小分
   * 取所有 interpretation 规则中最小的 min 值作为理论最小分
   * @param {Array} interpretation - 解释规则数组
   * @returns {number|null}
   */
  function inferMinFromInterpretation(interpretation) {
    if (!interpretation || interpretation.length === 0) {
      return null;
    }
    const allMin = interpretation.filter((r) => r.min !== undefined && r.min !== null).map((r) => r.min);
    return allMin.length > 0 ? Math.min(...allMin) : null;
  }

  function calcMaxScores(scoring, questions, actualMetrics) {
    const dimsMax = {};
    let totalMax = null;
    if (!scoring) {
      scoring = {};
    }

    // 1. 维度最大分
    if (scoring.dimensions && scoring.dimensions.length > 0) {
      for (const dim of scoring.dimensions) {
        // 优先使用后台手动配置的 maxScore
        if (dim.maxScore !== undefined && dim.maxScore > 0) {
          dimsMax[dim.key] = dim.maxScore;
          continue;
        }
        // 优先从维度内嵌的 interpretation 推导满分
        if (dim.interpretation && dim.interpretation.length > 0) {
          const interpMax = inferMaxFromInterpretation(dim.interpretation);
          if (interpMax !== null && interpMax > 0) {
            dimsMax[dim.key] = interpMax;
            continue;
          }
        }
        // 降级：从题目选项推导
        const itemIds = parseItems(dim.items, questions.length);
        const maxScores = collectMaxScores(questions, itemIds);
        let maxVal = applyFormula(dim.formula || 'SUM', maxScores, dim.condition);
        if (dim.transform) {
          maxVal = applyTransform(maxVal, dim.transform);
        }
        dimsMax[dim.key] = Math.round(maxVal * 100) / 100;
      }
    }

    // 2. 总分最大分
    if (scoring.metrics && scoring.metrics.length > 0) {
      // 尝试多种方式匹配总分 metric：
      // a) key/name 为标准名称 totalScore / total_score / 总分
      // b) 在顶层 interpretation 中被引用的 metric（且 formula 为汇总型 AVG/SUM/MEAN）
      let tsMetric = scoring.metrics.find(
        (m) =>
          (m.key || m.name) === 'totalScore' ||
          (m.key || m.name) === 'total_score' ||
          (m.key || m.name) === '总分' ||
          (m.key || m.name) === 'metric_total_score'
      );
      // 模糊匹配：label 含"总分"或"total"
      if (!tsMetric) {
        tsMetric = scoring.metrics.find((m) => {
          const k = (m.key || m.name || '').toLowerCase();
          const l = (m.label || '').toLowerCase();
          return l.includes('总分') || l.includes('total') || k.includes('total') || k.includes('总分');
        });
      }
      if (!tsMetric) {
        // 兜底：顶层 interpretation 中有对应规则的 metric，且为汇总型公式
        const interpMetricKeys = new Set((scoring.interpretation || []).filter((r) => r.metric).map((r) => r.metric));
        // 排除掉维度 key（维度满分由维度自己处理）
        const dimKeys = new Set((scoring.dimensions || []).map((d) => d.key));
        const candidateKeys = [...interpMetricKeys].filter((k) => !dimKeys.has(k));
        if (candidateKeys.length > 0) {
          tsMetric = scoring.metrics.find(
            (m) =>
              candidateKeys.includes(m.key || m.name) &&
              (m.formula === 'AVG' || m.formula === 'SUM' || m.formula === 'MEAN')
          );
        }
      }
      if (tsMetric) {
        // 优先使用后台手动配置的满分
        if (tsMetric.maxScore !== undefined && tsMetric.maxScore > 0) {
          totalMax = tsMetric.maxScore;
        } else {
          // 从顶层 interpretation 中找到属于该指标的规则，推导满分
          const tsKey = tsMetric.key || tsMetric.name;
          const tsRules = (scoring.interpretation || []).filter((r) => r.metric === tsKey);
          if (tsRules.length > 0) {
            const interpMax = inferMaxFromInterpretation(tsRules);
            if (interpMax !== null && interpMax > 0) {
              totalMax = interpMax;
            }
          }
          // 降级：从题目选项推导（仅当 interpretation 推导失败时）
          if (totalMax === null) {
            // DERIVED 类型无法从选项直接推导，但 DERIVED 的最终降级走底部全题求和
            if (tsMetric.formula !== 'DERIVED') {
              const itemIds = parseItems(tsMetric.items, questions.length);
              const maxScores = collectMaxScores(questions, itemIds);
              let maxVal = applyFormula(tsMetric.formula || 'SUM', maxScores, tsMetric.condition);
              if (tsMetric.transform) {
                maxVal = applyTransform(maxVal, tsMetric.transform);
              }
              totalMax = Math.round(maxVal * 100) / 100;
            }
          }
        }
      }
    }

    // 如果没有任何总分指标，从顶层 interpretation 推导（仅取无 metric 的规则）
    if (totalMax === null && scoring.interpretation && scoring.interpretation.length > 0) {
      const noMetricRules = scoring.interpretation.filter((r) => !r.metric);
      const interpMax = inferMaxFromInterpretation(noMetricRules);
      if (interpMax !== null && interpMax > 0) {
        totalMax = interpMax;
      }
    }

    // 最终降级：对所有题目的最大选项分求和
    if (totalMax === null) {
      const allMax = questions.map((q) => {
        // 文字题不计分
        if (q.type === 'text') {
          return 0;
        }
        // 分组下拉题：每组最大分之和（或乘积）
        if (q.type === 'grouped' && q.groups) {
          const _isMultiply = q.formula === 'multiply';
          let total = _isMultiply ? 1 : 0;
          for (let _gi = 0, _grps = _toGroupArray(q.groups); _gi < _grps.length; _gi++) {
            const group = _grps[_gi];
            if (group.options && group.options.length > 0) {
              const _groupMax = Math.max(...group.options.map((o) => o.score || 0));
              if (_isMultiply) {
                total *= _groupMax;
              } else {
                total += _groupMax;
              }
            }
          }
          return total;
        }
        if (!q.options || q.options.length === 0) {
          return 0;
        }
        // 矩阵题：行数 × 最大列分
        if (q.type === 'matrix' && q.rows && q.rows.length > 0) {
          const maxCol = Math.max(...q.options.map((o) => o.score || 0));
          return q.rows.length * maxCol;
        }
        // 父子题：子选项数
        if (q.type === 'parent-child' && q.subOptions) {
          return q.subOptions.length;
        }
        return Math.max(...q.options.map((o) => o.score || 0));
      });
      totalMax = allMax.reduce((a, b) => a + b, 0);
    }

    // 确保 totalMax 不为 0 或负数
    if (totalMax <= 0) {
      totalMax = 100;
    }

    return { total: totalMax, dimensions: dimsMax };
  }

  /**
   * 计算理论最低分
   * 与 calcMaxScores 对称，取每题最小选项分，应用相同公式/变换
   * @param {object} scoring - 计分规则配置
   * @param {object[]} questions - 题目数组
   * @returns {{ total: number, dimensions: { key: number } }}
   */
  function calcMinScores(scoring, questions) {
    const dimsMin = {};
    let totalMin = 0;
    if (!scoring) {
      scoring = {};
    }

    // 1. 维度最低分
    if (scoring.dimensions && scoring.dimensions.length > 0) {
      for (const dim of scoring.dimensions) {
        // 优先从维度内嵌的 interpretation 推导最低分
        if (dim.interpretation && dim.interpretation.length > 0) {
          const interpMin = inferMinFromInterpretation(dim.interpretation);
          if (interpMin !== null) {
            dimsMin[dim.key] = interpMin;
            continue;
          }
        }
        // 降级：从题目选项推导
        const itemIds = parseItems(dim.items, questions.length);
        const minScores = collectMinScores(questions, itemIds);
        let minVal = applyFormula(dim.formula || 'SUM', minScores, dim.condition);
        if (dim.transform) {
          minVal = applyTransform(minVal, dim.transform);
        }
        dimsMin[dim.key] = Math.round(minVal * 100) / 100;
      }
    }

    // 2. 总分最低分
    if (scoring.metrics && scoring.metrics.length > 0) {
      const tsMetric = scoring.metrics.find(
        (m) => (m.key || m.name) === 'totalScore' || (m.key || m.name) === 'total_score' || (m.key || m.name) === '总分'
      );
      if (tsMetric) {
        // 从顶层 interpretation 中找到属于 totalScore 的规则，推导最低分
        const tsKey = tsMetric.key || tsMetric.name;
        const tsRules = (scoring.interpretation || []).filter(
          (r) =>
            !r.metric ||
            r.metric === tsKey ||
            r.metric === 'totalScore' ||
            r.metric === 'total_score' ||
            r.metric === '总分'
        );
        if (tsRules.length > 0) {
          const interpMin = inferMinFromInterpretation(tsRules);
          if (interpMin !== null) {
            totalMin = interpMin;
          }
        }
        // 降级：从题目选项推导（仅当 interpretation 推导失败时）
        if (totalMin === 0 && tsMetric.formula !== 'DERIVED') {
          const itemIds = parseItems(tsMetric.items, questions.length);
          const minScores = collectMinScores(questions, itemIds);
          let minVal = applyFormula(tsMetric.formula || 'SUM', minScores, tsMetric.condition);
          if (tsMetric.transform) {
            minVal = applyTransform(minVal, tsMetric.transform);
          }
          totalMin = Math.round(minVal * 100) / 100;
        }
      }
    }

    // 如果没有 totalScore 指标，从顶层 interpretation 推导
    if (totalMin === 0 && scoring.interpretation && scoring.interpretation.length > 0) {
      const interpMin = inferMinFromInterpretation(scoring.interpretation);
      if (interpMin !== null && interpMin > 0) {
        totalMin = interpMin;
      }
    }

    return { total: totalMin, dimensions: dimsMin };
  }

  /**
   * 计算派生指标
   * 按依赖顺序排列，替换指标名后 eval
   * @param {object[]} derivedMetrics - DERIVED 类型的指标数组
   * @param {object} currentValues - 已计算出的所有指标值
   * @returns {object} 新计算的派生指标值
   */
  function evaluateDerived(derivedMetrics, currentValues) {
    const results = {};

    for (const dm of derivedMetrics) {
      if (!dm.expression) {
        results[dm.key] = 0;
        continue;
      }

      try {
        let expr = dm.expression;
        // 替换所有已知变量名（key 和 label）为对应的数值
        // 按 key 长度降序排列，避免短 key 先替换导致误匹配
        const keys = Object.keys(currentValues).sort((a, b) => b.length - a.length);
        for (const k of keys) {
          const v = currentValues[k];
          if (typeof v === 'number') {
            // 使用全词匹配（支持中文变量名，\b 对中文不适用，改用手动边界）
            const regex = new RegExp(escapeRegex(k), 'g');
            expr = expr.replace(regex, `(${v})`);
          }
        }
        // 使用安全求值引擎
        const val = safeEval(expr);
        results[dm.key] = isNaN(val) ? 0 : round2(val);
      } catch (_) {
        console.warn('[ScoringEngine] 派生指标计算失败:', dm.key, dm.expression, _);
        results[dm.key] = 0;
      }
    }
    return results;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 🎯 主入口：计算量表得分
   *
   * @param {object} scale - 量表对象（含 scoring 配置和 questions 数组）
   * @param {object} answers - 用户答案 { questionId: optionIndex }
   * @returns {object} 计分结果
   */
  function calculate(scale, answers) {
    const scoring = scale.scoring;
    // 兼容旧数据：确保题目和选项都有 id
    const questions = (scale.questions || []).map((q, qi) => ({
      ...q,
      id: q.id || qi + 1,
      options: (q.options || []).map((o, oi) => ({
        ...o,
        id: o.id !== undefined ? o.id : String.fromCharCode(65 + oi)
      }))
    }));

    // 无 scoring 配置时，回退到简单求和
    if (!scoring) {
      const scores = questions.map((q) => {
        const ans = answers[q.id];
        if (ans === undefined || ans === null) {
          return 0;
        }
        // 新题型：答案为对象
        if (typeof ans === 'object' && ans !== null) {
          const score = _collectSpecialScore(q, ans, dimKey);
          return score !== null ? score : 0;
        }
        // 原有逻辑
        let opt;
        if (typeof ans === 'number' && ans < q.options.length) {
          opt = q.options[ans];
        } else {
          opt = q.options.find((o) => o.id === ans);
        }
        return opt ? opt.score || 0 : 0;
      });
      const totalScore = scores.reduce((a, b) => a + b, 0);
      return {
        metrics: { totalScore },
        dimensions: [],
        interpretation: null,
        screening: { result: 'none', triggeredRules: [], matchedConditions: [] },
        rawAnswers: { ...answers },
        _fallback: true
      };
    }

    const result = {
      metrics: {},
      dimensions: [],
      interpretation: [],
      screening: { result: 'none', triggeredRules: [], matchedConditions: [] },
      rawAnswers: { ...answers }
    };

    // 1. 计算维度分
    if (scoring.dimensions && scoring.dimensions.length > 0) {
      for (const dim of scoring.dimensions) {
        const itemIds = parseItems(dim.items, questions.length);
        const scores = collectScores(questions, itemIds, answers, dim.condition, dim.key);
        let dimScore = applyFormula(dim.formula || 'SUM', scores, dim.condition);

        // 应用维度 transform（兼容字符串和对象格式）
        if (dim.transform) {
          dimScore = applyTransform(dimScore, dim.transform);
        }

        // 维度级规则优先，维度无规则时回退到顶层 scoring.interpretation 按 metric 匹配
        let dimInterp = dim.interpretation || [];
        if (dimInterp.length === 0 && scoring.interpretation && scoring.interpretation.length > 0) {
          dimInterp = scoring.interpretation.filter(function (rule) {
            return rule.metric === dim.key;
          });
        }

        const dimResult = {
          key: dim.key,
          label: dim.label,
          score: Math.round(dimScore * 100) / 100,
          itemCount: itemIds.length,
          answeredCount: scores.length,
          interpretation: matchInterpretation(dimScore, dimInterp)
        };
        result.dimensions.push(dimResult);
      }
    }

    // 2. 计算指标分（分两轮：先直接指标，再派生指标）
    const directMetrics = [];
    const derivedMetrics = [];
    if (scoring.metrics && scoring.metrics.length > 0) {
      for (const metric of scoring.metrics) {
        if (metric.formula === 'DERIVED') {
          derivedMetrics.push(metric);
        } else {
          directMetrics.push(metric);
        }
      }
    }

    // 2a. 第一轮：直接指标
    for (const metric of directMetrics) {
      const itemIds = parseItems(metric.items, questions.length);
      const scores = collectScores(questions, itemIds, answers, metric.condition, null); // metrics 不计分组
      let metricValue = applyFormula(metric.formula || 'SUM', scores, metric.condition);

      // 应用 transform（兼容字符串 "1.25*x" 和对象 { type: "linear", expression: "1.25*x" }）
      if (metric.transform) {
        metricValue = applyTransform(metricValue, metric.transform);
      }

      const key = metric.key || metric.name;
      result.metrics[key] = Math.round(metricValue * 100) / 100;
    }

    // 2b. 第二轮：派生指标（DERIVED）
    if (derivedMetrics.length > 0) {
      // 建立 name/key → value 映射供 expression 引用
      const valueMap = { ...result.metrics };
      for (const dm of directMetrics) {
        const k = dm.key || dm.name;
        // 同时用 label 作为别名
        if (dm.label || dm.name) {
          valueMap[dm.label || dm.name] = result.metrics[k];
        }
      }
      // ⚠️ 关键：将维度分也加入映射（expression 常引用 dim_xxx 维度 key）
      for (const dim of result.dimensions) {
        valueMap[dim.key] = dim.score;
        if (dim.label && dim.label !== dim.key) {
          valueMap[dim.label] = dim.score;
        }
      }
      const derivedResults = evaluateDerived(derivedMetrics, valueMap);
      for (const [k, v] of Object.entries(derivedResults)) {
        result.metrics[k] = v;
      }
    }

    // 3. 匹配解释规则
    if (scoring.interpretation && scoring.interpretation.length > 0) {
      // 新格式：每个 interpretation 关联一个 metric
      for (const rule of scoring.interpretation) {
        let score;
        if (rule.metric) {
          // 找到对应指标的值
          // 先按 key 查
          score = result.metrics[rule.metric];
          // 再按 label 查 metrics
          if (score === undefined) {
            for (const m of scoring.metrics || []) {
              if ((m.label || m.name) === rule.metric) {
                score = result.metrics[m.key || m.name];
                break;
              }
            }
          }
          // 再按 label 查 dimensions
          if (score === undefined) {
            const dim = result.dimensions.find((d) => d.label === rule.metric);
            if (dim) {
              score = dim.score;
            }
          }
        } else {
          // 旧格式：基于总分
          score = result.metrics.totalScore || result.metrics.total_score;
        }

        if (score !== undefined) {
          const matched = matchInterpretation(score, [rule]);
          if (matched) {
            result.interpretation.push({
              metric: rule.metric || '总分',
              score: Math.round(score * 100) / 100,
              label: matched.label,
              color: matched.color,
              text: matched.text || matched.advice || '' // 兼容旧数据中的 advice
            });
          }
        }
      }
    }

    // 4. 筛查判定
    if (scoring.screening) {
      // 构建包含维度分的查找表
      const screenValues = { ...result.metrics, _dimensions: result.dimensions };
      result.screening = evaluateScreening(scoring.screening, screenValues);
    }

    // 5. 计算理论最大分（用于百分比和进度环）
    result.maxScores = calcMaxScores(scoring, questions, result.metrics);

    // 6. 回退：无 metrics/dimensions 配置时，基于 keys 做 SUM 计算总分
    if (!result.metrics.totalScore && !result.metrics.total_score && scoring.keys && scoring.keys.length > 0) {
      const keyIds = parseItems(scoring.keys, questions.length);
      const allScores = collectScores(questions, keyIds, answers);
      let total = applyFormula(scoring.type || 'SUM', allScores);
      if (scoring.transform) {
        total = applyTransform(total, scoring.transform);
      }
      result.metrics.totalScore = round2(total);
    }

    return result;
  }

  /**
   * 🔧 等级标签 → 标准化 level 值
   * 根据 label 中的关键词智能推断 severity level
   * @param {string} label - 等级标签
   * @returns {string} normal | mild | moderate | severe
   */
  function normalizeLevel(label) {
    if (!label) {
      return 'normal';
    }
    const lower = label.toLowerCase();
    // 英文标准映射
    if (/^(low|normal|none|minimal)$/i.test(lower.trim())) {
      return 'normal';
    }
    if (/^(mild|slight|light)$/i.test(lower.trim())) {
      return 'mild';
    }
    if (/^(medium|moderate|middle|moderate)$/i.test(lower.trim())) {
      return 'moderate';
    }
    if (/^(high|severe|extreme|heavy)$/i.test(lower.trim())) {
      return 'severe';
    }
    // 中文映射
    if (/正常|健康|无|良好/.test(lower)) {
      return 'normal';
    }
    if (/轻度|轻微|偏轻/.test(lower)) {
      return 'mild';
    }
    if (/中度|中等|明显/.test(lower)) {
      return 'moderate';
    }
    if (/重度|严重|极端|偏重/.test(lower)) {
      return 'severe';
    }
    return 'normal';
  }

  /**
   * 规范化解释区间的 min/max
   * - min=0 通常表示 AI 不知道实际最低分，改为 undefined（不设下限）
   * - 确保数值类型
   */
  function normalizeRangeBounds(min, max) {
    const nMin = min !== undefined ? Number(min) : undefined;
    const nMax = max !== undefined ? Number(max) : undefined;
    return { min: nMin, max: nMax };
  }

  /**
   * 🔧 AI JSON → 引擎 scoring 格式转换器
   *
   * 将 AI 解析输出的 JSON 转换为引擎可直接使用的 scoring 配置
   * @param {object} aiJson - AI 解析的原始 JSON
   * @returns {object} 标准化的 scoring 配置
   */
  function normalizeAiJson(aiJson) {
    const scoring = { dimensions: [], metrics: [], interpretation: [], screening: null };

    // 1. 维度
    if (aiJson.dimensions) {
      for (const dim of aiJson.dimensions) {
        // 维度 key：优先用原始 key，否则生成 dim_ 前缀的 key
        let dimKey = dim.key;
        if (!dimKey) {
          dimKey = pinyinToKey(dim.label, 'dim_');
        } else {
          // 清理 AI 生成的 key：去掉 metric_ 前缀（维度不应使用），修正尾部下划线
          dimKey = dimKey.replace(/^metric_/, 'dim_').replace(/_+$/, '');
        }
        const dimEntry = {
          key: dimKey,
          label: dim.label,
          formula: dim.formula || 'SUM',
          items: dim.items || 'ALL'
        };
        // transform：字符串 "1.25*x" 直接使用
        if (dim.transform) {
          dimEntry.transform = dim.transform;
        }
        // 维度级别的 interpretation
        if (dim.interpretation && dim.interpretation.length > 0) {
          dimEntry.interpretation = dim.interpretation.map((r) => {
            let min = undefined,
              max = undefined;

            // 优先使用直接提供的 min/max
            if (r.min !== undefined) {
              min = r.min;
            }
            if (r.max !== undefined) {
              max = r.max;
            }

            // 从 condition 字符串补充（兼容旧格式）
            if (r.condition && min === undefined && max === undefined) {
              const parsed = parseConditionStr(r.condition);
              if (parsed) {
                if (parsed.operator === '>' || parsed.operator === '>=') {
                  min = parsed.value;
                } else if (parsed.operator === '<' || parsed.operator === '<=') {
                  max = parsed.value;
                }
              }
            }

            const bounds = normalizeRangeBounds(min, max);
            return {
              min: bounds.min,
              max: bounds.max,
              level: r.level || normalizeLevel(r.label),
              label: r.label,
              color: r.color,
              text: r.text || r.advice || ''
            };
          });
        }
        scoring.dimensions.push(dimEntry);
      }
    }

    // 2. 指标
    if (aiJson.metrics) {
      for (const m of aiJson.metrics) {
        const mLabel = m.label || m.name || ''; // 兼容 AI 输出的 label/name 两种字段
        let key = m.key || pinyinToKey(mLabel);
        // 标准化 totalScore 的 key：total_score → totalScore（统一为驼峰）
        if (key === 'total_score' || key === 'Total_Score') {
          key = 'totalScore';
        }
        const entry = {
          key,
          label: mLabel,
          formula: m.formula || 'SUM',
          items: m.items || 'ALL'
        };

        // transform
        if (m.transform) {
          if (typeof m.transform === 'string' && m.transform) {
            entry.transform = m.transform;
          } else if (m.transform.expression) {
            entry.transform = m.transform;
          }
        }

        // condition（COUNT_IF 用）
        if (m.formula === 'COUNT_IF') {
          if (m.condition) {
            // 对象格式 { ">=": 2 }
            if (typeof m.condition === 'object') {
              entry.condition = m.condition;
            }
          }
          // 从 description 中提取阈值信息作为 fallback
          if (!entry.condition && m.description) {
            // 兼容 ≥ ≤ = 和 >= <= > < 等写法
            const opMatch = m.description.match(/(>=|<=|>|<|≥|≤|=)\s*(\d+)/);
            if (opMatch) {
              const num = Number(opMatch[2]);
              const op = opMatch[1].replace('≥', '>=').replace('≤', '<=');
              entry.condition = {};
              entry.condition[op === '=' ? '==' : op] = num;
            }
          }
        }

        // DERIVED 检测
        if (m.formula === 'DERIVED' || (!['SUM', 'AVG', 'COUNT_IF'].includes(m.formula) && m.expression)) {
          entry.formula = 'DERIVED';
          entry.expression = m.expression || '';
        } else if (m.formula === 'SUM' && m.items === 'ALL' && scoring.dimensions.length > 0) {
          // 自动优化：总量表 SUM+ALL 可转为 DERIVED 维度求和（计算逻辑等价但更透明）
          // 构建维度 key 求和表达式
          const dimKeys = scoring.dimensions.map((d) => d.key);
          if (dimKeys.length > 0) {
            entry.formula = 'DERIVED';
            entry.expression = dimKeys.join(' + ');
            // 保留 items 为 'ALL' 作为回退标记
          }
        }

        scoring.metrics.push(entry);
      }
    }

    // 3. 解释规则（顶层 interpretation）
    if (aiJson.interpretation) {
      for (const rule of aiJson.interpretation) {
        let min = undefined,
          max = undefined;

        // 优先使用直接提供的 min/max
        if (rule.min !== undefined) {
          min = rule.min;
        }
        if (rule.max !== undefined) {
          max = rule.max;
        }

        // 从 condition 字符串补充（兼容旧格式）
        if (rule.condition && min === undefined && max === undefined) {
          const parsed = parseConditionStr(rule.condition);
          if (parsed) {
            if (parsed.operator === '>' || parsed.operator === '>=') {
              min = parsed.value;
            } else if (parsed.operator === '<' || parsed.operator === '<=') {
              max = parsed.value;
            }
          }
        }

        // 将 metric 从 label 匹配转为 key 匹配（更可靠）
        let metricKey = rule.metric;
        // 标准化 total_score → totalScore
        if (metricKey === 'total_score' || metricKey === 'Total_Score') {
          metricKey = 'totalScore';
        }
        if (metricKey) {
          // 先在 metrics 中按 key 直接匹配
          const metMatch = scoring.metrics.find((m) => m.key === metricKey);
          if (!metMatch) {
            // 再按 label 匹配
            const metByLabel = scoring.metrics.find((m) => m.label === metricKey);
            if (metByLabel) {
              metricKey = metByLabel.key;
            }
          }
          // 再在 dimensions 中按 key 或 label 匹配
          if (!metMatch && !scoring.metrics.find((m) => m.key === metricKey)) {
            const dimMatch = scoring.dimensions.find((d) => d.key === metricKey || d.label === metricKey);
            if (dimMatch) {
              metricKey = dimMatch.key;
            }
          }
        }

        const bounds = normalizeRangeBounds(min, max);

        const entry = {
          metric: metricKey,
          min: bounds.min,
          max: bounds.max,
          level: rule.level || normalizeLevel(rule.label),
          label: rule.label,
          color: rule.color,
          text: rule.text || rule.advice || ''
        };

        scoring.interpretation.push(entry);
      }
    }

    // 4. 筛查规则
    if (aiJson.screening) {
      const scr = aiJson.screening;
      const conditions = [];

      // 辅助函数：将 metric label 转为 key
      const resolveMetricKey = (name) => {
        if (!name) {
          return name;
        }
        // 标准化 total_score → totalScore
        if (name === 'total_score' || name === 'Total_Score') {
          name = 'totalScore';
        }
        // 先按 key 直接匹配
        const metKey = scoring.metrics.find((m) => m.key === name);
        if (metKey) {
          return metKey.key;
        }
        // 按 label 匹配 metrics
        const metByLabel = scoring.metrics.find((m) => m.label === name);
        if (metByLabel) {
          return metByLabel.key;
        }
        // 按 key 或 label 匹配 dimensions
        const dimMatch = scoring.dimensions.find((d) => d.key === name || d.label === name);
        if (dimMatch) {
          return dimMatch.key;
        }
        return name; // 无法匹配则原样返回
      };

      if (scr.conditions) {
        for (const c of scr.conditions) {
          const condition = { label: c.label || '' };

          // 标准格式：{ metric, operator, value } 或 { metric, op, value }
          if (c.metric && (c.operator || c.op) && c.value !== undefined) {
            condition.metric = resolveMetricKey(c.metric);
            condition.op = c.operator || c.op;
            condition.value = c.value;
            conditions.push(condition);
            continue;
          }

          // 从 condition 字符串解析（如 ">160"、"positive_items>43"）
          if (c.condition) {
            const parsed = parseConditionStr(c.condition);
            if (parsed) {
              condition.metric = scr.metric || '总分';
              condition.op = parsed.operator;
              condition.value = parsed.value;
              conditions.push(condition);
              continue;
            }

            // 尝试解析 "指标名>值" 格式（如 "positive_items>43"）
            const refMatch = c.condition.match(/^(\w+)\s*(>=|<=|!=|==|>|<)\s*(\d+\.?\d*)$/);
            if (refMatch) {
              condition.metric = refMatch[1];
              condition.op = refMatch[2];
              condition.value = Number(refMatch[3]);
              conditions.push(condition);
              continue;
            }

            // any_factor>2 这种语义模糊的，跳过（interpretation 已覆盖）
            console.log('[ScoringEngine] 跳过无法解析的筛查条件:', c.condition);
          }
        }
      }

      if (conditions.length > 0) {
        scoring.screening = {
          logic: scr.logic || 'OR',
          conditions,
          positiveLabel: scr.positiveLabel || '筛查阳性',
          negativeLabel: scr.negativeLabel || '筛查阴性'
        };
      }
    }

    return scoring;
  }

  /**
   * 中文标签转拼音 key（简易版）
   * 如 "躯体化" → "somatization"、"总分" → "total_score"
   * 仅用于生成默认 key，可被人工覆盖
   */
  function pinyinToKey(label, prefix) {
    if (!label) {
      return (prefix || 'metric_') + Date.now();
    }
    const map = {
      总分: 'total_score',
      总均分: 'average_score',
      标准分: 'standard_score',
      原始总分: 'raw_total',
      粗分: 'raw_score',
      阳性项目数: 'positive_count',
      阴性项目数: 'negative_count',
      阳性症状均分: 'positive_average',
      阳性症状痛苦水平: 'pdi',
      躯体化: 'somatization',
      强迫症状: 'obsessive_compulsive',
      强迫: 'obsessive',
      人际关系敏感: 'interpersonal_sensitivity',
      人际敏感: 'interpersonal',
      抑郁: 'depression',
      焦虑: 'anxiety',
      敌对: 'hostility',
      恐怖: 'phobia',
      偏执: 'paranoid',
      精神病性: 'psychoticism',
      其他: 'other',
      外向性: 'extraversion',
      宜人性: 'agreeableness',
      尽责性: 'conscientiousness',
      神经质: 'neuroticism',
      开放性: 'openness'
    };
    if (map[label]) {
      return map[label];
    }
    // 未知标签：按前缀生成安全 key，去除特殊字符和首尾下划线
    const p = prefix || 'metric_';
    const slug = label
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return p + slug.substring(0, 30);
  }

  // 暴露内部函数供测试使用（命名空间化，避免全局污染）
  if (typeof globalThis !== 'undefined') {
    globalThis.__ScoringEngineTest = {
      _collectSpecialScore,
      collectScores,
      calcMaxScores,
      calcMinScores,
      safeEval,
      round2
    };
  }

  // 公开 API
  return {
    calculate, // 核心计算
    calcMaxScores, // 理论最大分计算
    calcMinScores, // 理论最低分计算
    parseItems, // 题号解析
    normalizeAiJson // AI JSON → 引擎格式转换
  };
})();
