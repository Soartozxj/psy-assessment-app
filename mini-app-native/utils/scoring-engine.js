/**
 * scoring-engine.js — 星蓝心镜计分引擎 v2（微信小程序版）
 *
 * 从 H5 scoring-engine.js 完整迁移，纯 JS 无 DOM 依赖，零改动。
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

const ScoringEngine = (function () {
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
      if ('+-*/()'.indexOf(ch) !== -1) {
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
      const values = group.options.map(function (o) {
        return o.score || 0;
      });
      var groupVal;
      if (mode === 'max') {
        groupVal = Math.max.apply(null, values);
      } else if (mode === 'min') {
        groupVal = Math.min.apply(null, values);
      } else {
        // mode === 'sum': 使用用户答案计算
        const grpScore = group.options.reduce(function (sum, o) {
          const matched = scores.filter(function (s) {
            return s.optionId === o.id || s.optionIndex === o.optIndex;
          });
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
      const result = [];
      for (let i = 0; i < totalQuestions; i++) {
        result.push(i + 1);
      }
      return result;
    }
    if (Array.isArray(items)) {
      return items;
    }

    const res = [];
    const parts = String(items).split(',');
    for (let pi = 0; pi < parts.length; pi++) {
      const trimmed = parts[pi].trim();
      if (!trimmed) {
        continue;
      }
      if (trimmed.indexOf('-') !== -1) {
        const rangeParts = trimmed.split('-');
        const startStr = parseInt(rangeParts[0].trim());
        const endStr = parseInt(rangeParts[1].trim());
        if (!isNaN(startStr) && !isNaN(endStr)) {
          for (let ri = startStr; ri <= endStr; ri++) {
            res.push(ri);
          }
        }
      } else {
        const num = parseInt(trimmed);
        if (!isNaN(num)) {
          res.push(num);
        }
      }
    }
    return res;
  }

  /**
   * 收集新题型得分（matrix / matrix-multi / parent-child）
   * @param {object} q - 题目对象（含 type 字段）
   * @param {object} ans - 该题的答案（对象格式）
   * @param {string} [dimKey] - 维度 key（用于 grouped 分组过滤）
   * @returns {number|null} 得分，null 表示非特殊题型
   */
  function _collectSpecialScore(q, ans, dimKey) {
    // 矩阵题：每行选一列，各列分数求和
    if (q.type === 'matrix') {
      var total = 0;
      const rows = q.rows || [];
      const opts = q.options || [];
      for (let ri = 0; ri < rows.length; ri++) {
        const colIdx = ans[rows[ri].id];
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
   * @param {object|null} condition - 可选条件过滤
   * @param {string|null} dimKey - 维度 key
   * @returns {number[]} 得分数组
   */
  function collectScores(questions, itemIds, answers, condition, dimKey) {
    const _grpFilter = condition && condition.group && condition.eq;
    const scores = [];
    for (let ii = 0; ii < itemIds.length; ii++) {
      const qid = itemIds[ii];
      // 兼容数字题号和字符串题号
      let q = null;
      for (let qi = 0; qi < questions.length; qi++) {
        if (questions[qi].id == qid) {
          q = questions[qi];
          break;
        }
      }
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
      var opt;
      if (typeof ans === 'number' && ans < q.options.length) {
        opt = q.options[ans];
      } else if (typeof ans === 'string') {
        opt = null;
        for (let oi = 0; oi < q.options.length; oi++) {
          if (q.options[oi].id === ans) {
            opt = q.options[oi];
            break;
          }
        }
      } else {
        opt = null;
        for (let oi2 = 0; oi2 < q.options.length; oi2++) {
          if (q.options[oi2].id === ans) {
            opt = q.options[oi2];
            break;
          }
        }
      }
      if (opt) {
        scores.push(opt.score || 0);
      }
    }
    return scores;
  }

  /**
   * 统一 condition 格式
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
    for (let i = 0; i < ops.length; i++) {
      if (condition[ops[i]] !== undefined) {
        return { operator: ops[i], value: Number(condition[ops[i]]) };
      }
    }
    return null;
  }

  /**
   * 执行公式计算
   * @param {string} formula - SUM | AVG | COUNT_IF | DERIVED
   * @param {number[]} scores - 得分数组
   * @param {object|null} condition - 计数条件
   * @returns {number}
   */
  function applyFormula(formula, scores, condition) {
    if (scores.length === 0 && formula !== 'DERIVED') {
      return 0;
    }

    switch (formula) {
      case 'SUM':
        var sum = 0;
        for (let i = 0; i < scores.length; i++) {
          sum += scores[i];
        }
        return sum;

      case 'AVG':
        if (scores.length === 0) {
          return 0;
        }
        var sum2 = 0;
        for (let j = 0; j < scores.length; j++) {
          sum2 += scores[j];
        }
        return sum2 / scores.length;

      case 'COUNT_IF': {
        const norm = normalizeCondition(condition);
        if (!norm) {
          return scores.length;
        }
        let count = 0;
        for (let k = 0; k < scores.length; k++) {
          if (compareValue(scores[k], norm.operator, norm.value)) {
            count++;
          }
        }
        return count;
      }

      case 'DERIVED':
        return 0;

      default:
        var sum3 = 0;
        for (let m = 0; m < scores.length; m++) {
          sum3 += scores[m];
        }
        return sum3;
    }
  }

  /** 数值比较 */
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
      const expr = expression.replace(/x/gi, '(' + value + ')');
      const result = safeEval(expr);
      return round2(result);
    } catch (_) {
      console.warn('[ScoringEngine] 公式转换失败:', _, transform);
      return value;
    }
  }

  /**
   * 匹配解释规则
   * @param {number} score - 待匹配的分数
   * @param {object[]} rules - 解释规则数组
   * @returns {object|null}
   */
  function matchInterpretation(score, rules) {
    if (!rules || rules.length === 0) {
      return null;
    }
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule.min !== undefined || rule.max !== undefined) {
        const minOk = rule.min === undefined || rule.min === null || score >= rule.min;
        const maxOk = rule.max === undefined || rule.max === null || score <= rule.max;
        if (minOk && maxOk) {
          return rule;
        }
      }
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
   * 生成通用维度解释兜底（当量表未定义 interpretation 规则时使用）
   * 基于 33rd/66th 百分位将得分分为低/中/高三档
   * @param {number} score - 维度得分
   * @param {number} max - 维度满分
   * @param {string} label - 维度名称
   * @returns {object} 解释对象 { level, label, color, text }
   */
  function generateFallbackInterpretation(score, max, label) {
    const pct = max > 0 ? score / max : 0;
    const shortLabel = label || '该维度';
    // 修正百分位：高分→高支持（正向维度）/ 高风险（负向维度）
    // 通用三分法：低(0-33%)/中(33-66%)/高(66-100%)
    let level, color, text;
    if (pct <= 0.33) {
      level = 'low';
      label = '低水平';
      color = '#43a047';
      text = shortLabel + '得分处于较低水平，建议关注并寻求改善方法';
    } else if (pct <= 0.66) {
      level = 'medium';
      label = '中等水平';
      color = '#f0ad4e';
      text = shortLabel + '得分处于中等水平，继续保持当前状态';
    } else {
      level = 'high';
      label = '高水平';
      color = '#e53935';
      text = shortLabel + '得分处于较高水平';
    }
    return { level: level, label: label, color: color, text: text };
  }

  /**
   * 解析条件字符串
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
   * @param {object} metricValues - 所有指标值
   * @returns {object}
   */
  function evaluateScreening(screening, metricValues) {
    if (!screening || !screening.conditions || screening.conditions.length === 0) {
      return { result: 'none', triggeredRules: [], matchedConditions: [] };
    }

    const results = screening.conditions.map(function (cond) {
      const metricName = cond.metric;
      const operator = cond.op || cond.operator;
      const threshold = cond.value !== undefined ? cond.value : cond.threshold;

      if (!metricName || operator === undefined || threshold === undefined) {
        console.warn('[ScoringEngine] 筛查条件缺少字段:', cond);
        return false;
      }

      let actual = metricValues[metricName];
      if (actual === undefined) {
        const keys = Object.keys(metricValues);
        for (let ki = 0; ki < keys.length; ki++) {
          if (metricValues[keys[ki]] && metricValues[keys[ki]].label === metricName) {
            actual = typeof metricValues[keys[ki]] === 'object' ? metricValues[keys[ki]].score : metricValues[keys[ki]];
            break;
          }
        }
      }
      if (actual === undefined) {
        let dimResult = null;
        const dims = metricValues._dimensions || [];
        for (let di = 0; di < dims.length; di++) {
          if (dims[di].label === metricName) {
            dimResult = dims[di];
            break;
          }
        }
        if (dimResult) {
          actual = dimResult.score;
        }
      }

      if (actual === undefined) {
        return false;
      }
      if (typeof actual === 'object' && actual.score !== undefined) {
        actual = actual.score;
      }

      return compareValue(Number(actual), operator, Number(threshold));
    });

    const triggered = [];
    for (let ti = 0; ti < screening.conditions.length; ti++) {
      if (results[ti]) {
        triggered.push(screening.conditions[ti]);
      }
    }

    let logicResult;
    if (screening.logic === 'AND') {
      logicResult = results.every(Boolean);
    } else {
      logicResult = results.some(Boolean);
    }

    return {
      result: logicResult ? screening.positiveLabel || '阳性' : screening.negativeLabel || '阴性',
      triggeredRules: triggered,
      matchedConditions: triggered
    };
  }

  /**
   * 获取指定题号列表中每道题的最大选项分
   */
  function collectMaxScores(questions, itemIds) {
    const maxScores = [];
    for (let ii = 0; ii < itemIds.length; ii++) {
      const qid = itemIds[ii];
      let q = null;
      for (let qi = 0; qi < questions.length; qi++) {
        if (questions[qi].id == qid) {
          q = questions[qi];
          break;
        }
      }
      if (!q) {
        continue;
      }
      if (q.type === 'text') {
        continue;
      }

      if (q.type === 'grouped' && q.groups) {
        const _isMultiply = q.formula === 'multiply';
        let total = _isMultiply ? 1 : 0;
        const _grps = _toGroupArray(q.groups);
        for (let _gi = 0; _gi < _grps.length; _gi++) {
          const group = _grps[_gi];
          if (group.options && group.options.length > 0) {
            const _groupMax = Math.max.apply(
              null,
              group.options.map(function (o) {
                return o.score || 0;
              })
            );
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

      if (q.type === 'matrix' && q.rows && q.rows.length > 0) {
        const maxCol = Math.max.apply(
          null,
          q.options.map(function (o) {
            return o.score || 0;
          })
        );
        maxScores.push(q.rows.length * maxCol);
        continue;
      }

      if (q.type === 'parent-child' && q.subOptions) {
        maxScores.push(q.subOptions.length);
        continue;
      }

      const maxOpt = Math.max.apply(
        null,
        q.options.map(function (o) {
          return o.score || 0;
        })
      );
      maxScores.push(maxOpt);
    }
    return maxScores;
  }

  /**
   * 获取指定题号列表中每道题的最小选项分
   */
  function collectMinScores(questions, itemIds) {
    const minScores = [];
    for (let ii = 0; ii < itemIds.length; ii++) {
      const qid = itemIds[ii];
      let q = null;
      for (let qi = 0; qi < questions.length; qi++) {
        if (questions[qi].id == qid) {
          q = questions[qi];
          break;
        }
      }
      if (!q) {
        continue;
      }
      if (q.type === 'text') {
        continue;
      }

      if (q.type === 'grouped' && q.groups) {
        const _isMultiply = q.formula === 'multiply';
        let total = _isMultiply ? 1 : 0;
        const _grps = _toGroupArray(q.groups);
        for (let _gi = 0; _gi < _grps.length; _gi++) {
          const group = _grps[_gi];
          if (group.options && group.options.length > 0) {
            const _groupMin = Math.min.apply(
              null,
              group.options.map(function (o) {
                return o.score || 0;
              })
            );
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

      if (q.type === 'matrix' && q.rows && q.rows.length > 0) {
        const minCol = Math.min.apply(
          null,
          q.options.map(function (o) {
            return o.score || 0;
          })
        );
        minScores.push(q.rows.length * minCol);
        continue;
      }

      if (q.type === 'parent-child') {
        minScores.push(0);
        continue;
      }

      const minOpt = Math.min.apply(
        null,
        q.options.map(function (o) {
          return o.score || 0;
        })
      );
      minScores.push(minOpt);
    }
    return minScores;
  }

  function inferMaxFromInterpretation(interpretation) {
    if (!interpretation || interpretation.length === 0) {
      return null;
    }
    let hasOpenEnded = false;
    for (let i = 0; i < interpretation.length; i++) {
      const r = interpretation[i];
      if (r.min !== undefined && r.min !== null && (r.max === undefined || r.max === null)) {
        hasOpenEnded = true;
        break;
      }
    }
    if (hasOpenEnded) {
      return null;
    }
    const allMax = [];
    for (let j = 0; j < interpretation.length; j++) {
      if (interpretation[j].max !== undefined && interpretation[j].max !== null) {
        allMax.push(interpretation[j].max);
      }
    }
    return allMax.length > 0 ? Math.max.apply(null, allMax) : null;
  }

  function inferMinFromInterpretation(interpretation) {
    if (!interpretation || interpretation.length === 0) {
      return null;
    }
    const allMin = [];
    for (let j = 0; j < interpretation.length; j++) {
      if (interpretation[j].min !== undefined && interpretation[j].min !== null) {
        allMin.push(interpretation[j].min);
      }
    }
    return allMin.length > 0 ? Math.min.apply(null, allMin) : null;
  }

  function calcMaxScores(scoring, questions, actualMetrics) {
    const dimsMax = {};
    let totalMax = null;
    if (!scoring) {
      scoring = {};
    }

    if (scoring.dimensions && scoring.dimensions.length > 0) {
      for (let di = 0; di < scoring.dimensions.length; di++) {
        const dim = scoring.dimensions[di];
        if (dim.maxScore !== undefined && dim.maxScore > 0) {
          dimsMax[dim.key] = dim.maxScore;
          continue;
        }
        if (dim.interpretation && dim.interpretation.length > 0) {
          const interpMax = inferMaxFromInterpretation(dim.interpretation);
          if (interpMax !== null && interpMax > 0) {
            dimsMax[dim.key] = interpMax;
            continue;
          }
        }
        const itemIds = parseItems(dim.items, questions.length);
        const maxScores = collectMaxScores(questions, itemIds);
        let maxVal = applyFormula(dim.formula || 'SUM', maxScores, dim.condition);
        if (dim.transform) {
          maxVal = applyTransform(maxVal, dim.transform);
        }
        dimsMax[dim.key] = Math.round(maxVal * 100) / 100;
      }
    }

    if (scoring.metrics && scoring.metrics.length > 0) {
      let tsMetric = null;
      for (let mi = 0; mi < scoring.metrics.length; mi++) {
        const m = scoring.metrics[mi];
        const mk = m.key || m.name;
        if (mk === 'totalScore' || mk === 'total_score' || mk === '总分' || mk === 'metric_total_score') {
          tsMetric = m;
          break;
        }
      }
      if (!tsMetric) {
        for (let mi2 = 0; mi2 < scoring.metrics.length; mi2++) {
          const m2 = scoring.metrics[mi2];
          const k2 = (m2.key || m2.name || '').toLowerCase();
          const l2 = (m2.label || '').toLowerCase();
          if (
            l2.indexOf('总分') !== -1 ||
            l2.indexOf('total') !== -1 ||
            k2.indexOf('total') !== -1 ||
            k2.indexOf('总分') !== -1
          ) {
            tsMetric = m2;
            break;
          }
        }
      }
      if (!tsMetric) {
        const interpMetricKeys = {};
        const interpArr = scoring.interpretation || [];
        for (let ii = 0; ii < interpArr.length; ii++) {
          if (interpArr[ii].metric) {
            interpMetricKeys[interpArr[ii].metric] = true;
          }
        }
        const dimKeys = {};
        for (let di2 = 0; di2 < (scoring.dimensions || []).length; di2++) {
          dimKeys[scoring.dimensions[di2].key] = true;
        }
        const candidateKeys = Object.keys(interpMetricKeys).filter(function (k) {
          return !dimKeys[k];
        });
        if (candidateKeys.length > 0) {
          for (let mi3 = 0; mi3 < scoring.metrics.length; mi3++) {
            const m3 = scoring.metrics[mi3];
            if (
              candidateKeys.indexOf(m3.key || m3.name) !== -1 &&
              (m3.formula === 'AVG' || m3.formula === 'SUM' || m3.formula === 'MEAN')
            ) {
              tsMetric = m3;
              break;
            }
          }
        }
      }
      if (tsMetric) {
        if (tsMetric.maxScore !== undefined && tsMetric.maxScore > 0) {
          totalMax = tsMetric.maxScore;
        } else {
          const tsKey = tsMetric.key || tsMetric.name;
          const tsRules = (scoring.interpretation || []).filter(function (r) {
            return r.metric === tsKey;
          });
          if (tsRules.length > 0) {
            const interpMax2 = inferMaxFromInterpretation(tsRules);
            if (interpMax2 !== null && interpMax2 > 0) {
              totalMax = interpMax2;
            }
          }
          if (totalMax === null) {
            if (tsMetric.formula !== 'DERIVED') {
              const itemIds2 = parseItems(tsMetric.items, questions.length);
              const maxScores2 = collectMaxScores(questions, itemIds2);
              let maxVal2 = applyFormula(tsMetric.formula || 'SUM', maxScores2, tsMetric.condition);
              if (tsMetric.transform) {
                maxVal2 = applyTransform(maxVal2, tsMetric.transform);
              }
              totalMax = Math.round(maxVal2 * 100) / 100;
            }
          }
        }
      }
    }

    if (totalMax === null && scoring.interpretation && scoring.interpretation.length > 0) {
      const noMetricRules = scoring.interpretation.filter(function (r) {
        return !r.metric;
      });
      const interpMax3 = inferMaxFromInterpretation(noMetricRules);
      if (interpMax3 !== null && interpMax3 > 0) {
        totalMax = interpMax3;
      }
    }

    if (totalMax === null) {
      const allMax = questions.map(function (q) {
        if (q.type === 'text') {
          return 0;
        }
        if (q.type === 'grouped' && q.groups) {
          const _isMultiply = q.formula === 'multiply';
          let total = _isMultiply ? 1 : 0;
          const _grps = _toGroupArray(q.groups);
          for (let _gi = 0; _gi < _grps.length; _gi++) {
            const group = _grps[_gi];
            if (group.options && group.options.length > 0) {
              const _groupMax = Math.max.apply(
                null,
                group.options.map(function (o) {
                  return o.score || 0;
                })
              );
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
        if (q.type === 'matrix' && q.rows && q.rows.length > 0) {
          const maxCol = Math.max.apply(
            null,
            q.options.map(function (o) {
              return o.score || 0;
            })
          );
          return q.rows.length * maxCol;
        }
        if (q.type === 'parent-child' && q.subOptions) {
          return q.subOptions.length;
        }
        return Math.max.apply(
          null,
          q.options.map(function (o) {
            return o.score || 0;
          })
        );
      });
      let sumAll = 0;
      for (let si = 0; si < allMax.length; si++) {
        sumAll += allMax[si];
      }
      totalMax = sumAll;
    }

    if (totalMax <= 0) {
      totalMax = 100;
    }
    return { total: totalMax, dimensions: dimsMax };
  }

  function calcMinScores(scoring, questions) {
    const dimsMin = {};
    let totalMin = 0;
    if (!scoring) {
      scoring = {};
    }

    if (scoring.dimensions && scoring.dimensions.length > 0) {
      for (let di = 0; di < scoring.dimensions.length; di++) {
        const dim = scoring.dimensions[di];
        if (dim.interpretation && dim.interpretation.length > 0) {
          const interpMin = inferMinFromInterpretation(dim.interpretation);
          if (interpMin !== null) {
            dimsMin[dim.key] = interpMin;
            continue;
          }
        }
        const itemIds = parseItems(dim.items, questions.length);
        const minScores = collectMinScores(questions, itemIds);
        let minVal = applyFormula(dim.formula || 'SUM', minScores, dim.condition);
        if (dim.transform) {
          minVal = applyTransform(minVal, dim.transform);
        }
        dimsMin[dim.key] = Math.round(minVal * 100) / 100;
      }
    }

    if (scoring.metrics && scoring.metrics.length > 0) {
      let tsMetric = null;
      for (let mi = 0; mi < scoring.metrics.length; mi++) {
        const m = scoring.metrics[mi];
        if ((m.key || m.name) === 'totalScore' || (m.key || m.name) === 'total_score' || (m.key || m.name) === '总分') {
          tsMetric = m;
          break;
        }
      }
      if (tsMetric) {
        const tsKey = tsMetric.key || tsMetric.name;
        const tsRules = (scoring.interpretation || []).filter(function (r) {
          return (
            !r.metric ||
            r.metric === tsKey ||
            r.metric === 'totalScore' ||
            r.metric === 'total_score' ||
            r.metric === '总分'
          );
        });
        if (tsRules.length > 0) {
          const interpMin2 = inferMinFromInterpretation(tsRules);
          if (interpMin2 !== null) {
            totalMin = interpMin2;
          }
        }
        if (totalMin === 0 && tsMetric.formula !== 'DERIVED') {
          const itemIds2 = parseItems(tsMetric.items, questions.length);
          const minScores2 = collectMinScores(questions, itemIds2);
          let minVal2 = applyFormula(tsMetric.formula || 'SUM', minScores2, tsMetric.condition);
          if (tsMetric.transform) {
            minVal2 = applyTransform(minVal2, tsMetric.transform);
          }
          totalMin = Math.round(minVal2 * 100) / 100;
        }
      }
    }

    if (totalMin === 0 && scoring.interpretation && scoring.interpretation.length > 0) {
      const interpMin3 = inferMinFromInterpretation(scoring.interpretation);
      if (interpMin3 !== null && interpMin3 > 0) {
        totalMin = interpMin3;
      }
    }

    return { total: totalMin, dimensions: dimsMin };
  }

  function evaluateDerived(derivedMetrics, currentValues) {
    const results = {};
    for (let di = 0; di < derivedMetrics.length; di++) {
      const dm = derivedMetrics[di];
      if (!dm.expression) {
        results[dm.key] = 0;
        continue;
      }
      try {
        let expr = dm.expression;
        const keys = Object.keys(currentValues).sort(function (a, b) {
          return b.length - a.length;
        });
        for (let ki = 0; ki < keys.length; ki++) {
          const k = keys[ki];
          const v = currentValues[k];
          if (typeof v === 'number') {
            const regex = new RegExp(escapeRegex(k), 'g');
            expr = expr.replace(regex, '(' + v + ')');
          }
        }
        const val = safeEval(expr);
        const result = isNaN(val) ? 0 : round2(val);
        results[dm.key] = result;
        // 将结果加回 currentValues，使后续派生指标可以引用
        currentValues[dm.key] = result;
        if (dm.label && dm.label !== dm.key) {
          currentValues[dm.label] = result;
        }
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
   * 主入口：计算量表得分
   * @param {object} scale - 量表对象
   * @param {object} answers - 用户答案
   * @returns {object} 计分结果
   */
  function calculate(scale, answers) {
    const scoring = scale.scoring;
    const questions = (scale.questions || []).map(function (q, qi) {
      const mapped = {
        id: q.id || qi + 1,
        type: q.type,
        content: q.content,
        formula: q.formula,
        groups: q.groups,
        rows: q.rows,
        subOptions: q.subOptions,
        transition: q.transition
      };
      mapped.options = (q.options || []).map(function (o, oi) {
        const optCopy = {};
        optCopy.id = o.id !== undefined ? o.id : String.fromCharCode(65 + oi);
        optCopy.label = o.label;
        optCopy.score = o.score;
        return optCopy;
      });
      return mapped;
    });

    // 无 scoring 配置时回退到简单求和
    if (!scoring) {
      const scores = questions.map(function (q) {
        const ans = answers[q.id];
        if (ans === undefined || ans === null) {
          return 0;
        }
        if (typeof ans === 'object' && ans !== null) {
          const score = _collectSpecialScore(q, ans);
          return score !== null ? score : 0;
        }
        let opt;
        if (typeof ans === 'number' && ans < q.options.length) {
          opt = q.options[ans];
        } else {
          opt = null;
          for (let oi = 0; oi < q.options.length; oi++) {
            if (q.options[oi].id === ans) {
              opt = q.options[oi];
              break;
            }
          }
        }
        return opt ? opt.score || 0 : 0;
      });
      let totalScore = 0;
      for (let si = 0; si < scores.length; si++) {
        totalScore += scores[si];
      }

      const rawCopy = {};
      const ansKeys = Object.keys(answers);
      for (let ak = 0; ak < ansKeys.length; ak++) {
        rawCopy[ansKeys[ak]] = answers[ansKeys[ak]];
      }

      return {
        metrics: { totalScore: totalScore },
        dimensions: [],
        interpretation: null,
        screening: { result: 'none', triggeredRules: [], matchedConditions: [] },
        rawAnswers: rawCopy,
        _fallback: true
      };
    }

    const result = {
      metrics: {},
      dimensions: [],
      interpretation: [],
      screening: { result: 'none', triggeredRules: [], matchedConditions: [] },
      rawAnswers: {}
    };
    const rawKeys = Object.keys(answers);
    for (let rk = 0; rk < rawKeys.length; rk++) {
      result.rawAnswers[rawKeys[rk]] = answers[rawKeys[rk]];
    }

    // 1. 计算维度分
    if (scoring.dimensions && scoring.dimensions.length > 0) {
      for (let di = 0; di < scoring.dimensions.length; di++) {
        var dim = scoring.dimensions[di];
        const itemIds = parseItems(dim.items, questions.length);
        const dimScores = collectScores(questions, itemIds, answers, dim.condition, dim.key);
        let dimScore = applyFormula(dim.formula || 'SUM', dimScores, dim.condition);
        if (dim.transform) {
          dimScore = applyTransform(dimScore, dim.transform);
        }

        // 计算维度满分：优先级 dim.maxScore > interpretation推断 > 从题目计算
        // 维度级规则优先，维度无规则时回退到顶层 scoring.interpretation 按 metric 匹配
        let rawInterp = dim.interpretation || [];
        if (rawInterp.length === 0 && scoring.interpretation && scoring.interpretation.length > 0) {
          rawInterp = scoring.interpretation.filter(function (rule) {
            return rule.metric === dim.key;
          });
        }
        let dimMax = dim.maxScore;
        if (!dimMax && rawInterp.length > 0) {
          dimMax = inferMaxFromInterpretation(rawInterp);
        }
        if (!dimMax) {
          const _dimMaxScores = collectMaxScores(questions, itemIds);
          let _dimMaxVal = applyFormula(dim.formula || 'SUM', _dimMaxScores, dim.condition);
          if (dim.transform) {
            _dimMaxVal = applyTransform(_dimMaxVal, dim.transform);
          }
          dimMax = Math.round(_dimMaxVal * 100) / 100;
        }

        let interp = matchInterpretation(dimScore, rawInterp);
        // 无解释规则时，兜底生成基于百分位的通用解释
        if (!interp) {
          interp = generateFallbackInterpretation(dimScore, dimMax, dim.label || dim.key);
        }

        const dimResult = {
          key: dim.key,
          label: dim.label,
          score: Math.round(dimScore * 100) / 100,
          max: dimMax || 0,
          itemCount: itemIds.length,
          answeredCount: dimScores.length,
          interpretation: interp,
          levelLabel: interp ? interp.label || '' : '',
          levelText: interp ? interp.text || '' : '',
          hasInterp: !!interp
        };
        result.dimensions.push(dimResult);
      }
    }

    // 2. 计算指标分
    const directMetrics = [];
    const derivedMetrics = [];
    if (scoring.metrics && scoring.metrics.length > 0) {
      for (let mi = 0; mi < scoring.metrics.length; mi++) {
        if (scoring.metrics[mi].formula === 'DERIVED') {
          derivedMetrics.push(scoring.metrics[mi]);
        } else {
          directMetrics.push(scoring.metrics[mi]);
        }
      }
    }

    // 2a. 直接指标
    for (let dm2 = 0; dm2 < directMetrics.length; dm2++) {
      const metric = directMetrics[dm2];
      const mItemIds = parseItems(metric.items, questions.length);
      const mScores = collectScores(questions, mItemIds, answers, metric.condition, null);
      let metricValue = applyFormula(metric.formula || 'SUM', mScores, metric.condition);
      if (metric.transform) {
        metricValue = applyTransform(metricValue, metric.transform);
      }
      const mKey = metric.key || metric.name;
      result.metrics[mKey] = Math.round(metricValue * 100) / 100;
    }

    // 2b. 派生指标
    if (derivedMetrics.length > 0) {
      const valueMap = {};
      const mk = Object.keys(result.metrics);
      for (let vk = 0; vk < mk.length; vk++) {
        valueMap[mk[vk]] = result.metrics[mk[vk]];
      }
      for (let dm3 = 0; dm3 < directMetrics.length; dm3++) {
        const dMetric = directMetrics[dm3];
        const dk = dMetric.key || dMetric.name;
        if (dMetric.label || dMetric.name) {
          valueMap[dMetric.label || dMetric.name] = result.metrics[dk];
        }
      }
      for (let dimIdx = 0; dimIdx < result.dimensions.length; dimIdx++) {
        const dim2 = result.dimensions[dimIdx];
        valueMap[dim2.key] = dim2.score;
        if (dim2.label && dim2.label !== dim2.key) {
          valueMap[dim2.label] = dim2.score;
        }
      }
      const derivedResults = evaluateDerived(derivedMetrics, valueMap);
      const drKeys = Object.keys(derivedResults);
      for (let drk = 0; drk < drKeys.length; drk++) {
        result.metrics[drKeys[drk]] = derivedResults[drKeys[drk]];
      }
    }

    // 3. 匹配解释规则
    if (scoring.interpretation && scoring.interpretation.length > 0) {
      for (let ri = 0; ri < scoring.interpretation.length; ri++) {
        const rule = scoring.interpretation[ri];
        var iScore;
        if (rule.metric) {
          iScore = result.metrics[rule.metric];
          if (iScore === undefined) {
            for (let smi = 0; smi < (scoring.metrics || []).length; smi++) {
              if ((scoring.metrics[smi].label || scoring.metrics[smi].name) === rule.metric) {
                iScore = result.metrics[scoring.metrics[smi].key || scoring.metrics[smi].name];
                break;
              }
            }
          }
          if (iScore === undefined) {
            for (let sdi = 0; sdi < result.dimensions.length; sdi++) {
              if (result.dimensions[sdi].label === rule.metric) {
                iScore = result.dimensions[sdi].score;
                break;
              }
            }
          }
        } else {
          iScore = result.metrics.totalScore || result.metrics.total_score;
        }

        if (iScore !== undefined) {
          const matched = matchInterpretation(iScore, [rule]);
          if (matched) {
            result.interpretation.push({
              metric: rule.metric || '总分',
              score: Math.round(iScore * 100) / 100,
              label: matched.label,
              color: matched.color,
              text: matched.text || matched.advice || ''
            });
          }
        }
      }
    }

    // 4. 筛查判定
    if (scoring.screening) {
      const screenValues = {};
      const svKeys = Object.keys(result.metrics);
      for (let svk = 0; svk < svKeys.length; svk++) {
        screenValues[svKeys[svk]] = result.metrics[svKeys[svk]];
      }
      screenValues._dimensions = result.dimensions;
      result.screening = evaluateScreening(scoring.screening, screenValues);
    }

    // 5. 计算理论最大分
    result.maxScores = calcMaxScores(scoring, questions, result.metrics);

    // 6. 回退：无 totalScore 时基于 keys 做 SUM 计算总分
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
   * 等级标签 → 标准化 level 值
   */
  function normalizeLevel(label) {
    if (!label) {
      return 'normal';
    }
    const lower = label.toLowerCase();
    if (/^(low|normal|none|minimal)$/i.test(lower.trim())) {
      return 'normal';
    }
    if (/^(mild|slight|light)$/i.test(lower.trim())) {
      return 'mild';
    }
    if (/^(medium|moderate|middle)$/i.test(lower.trim())) {
      return 'moderate';
    }
    if (/^(high|severe|extreme|heavy)$/i.test(lower.trim())) {
      return 'severe';
    }
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

  function normalizeRangeBounds(min, max) {
    return {
      min: min !== undefined ? Number(min) : undefined,
      max: max !== undefined ? Number(max) : undefined
    };
  }

  /**
   * AI JSON → 引擎 scoring 格式转换器
   */
  function normalizeAiJson(aiJson) {
    const scoring = { dimensions: [], metrics: [], interpretation: [], screening: null };

    if (aiJson.dimensions) {
      for (let di = 0; di < aiJson.dimensions.length; di++) {
        const dim = aiJson.dimensions[di];
        let dimKey = dim.key || pinyinToKey(dim.label, 'dim_');
        dimKey = dimKey.replace(/^metric_/, 'dim_').replace(/_+$/, '');
        const dimEntry = { key: dimKey, label: dim.label, formula: dim.formula || 'SUM', items: dim.items || 'ALL' };
        if (dim.transform) {
          dimEntry.transform = dim.transform;
        }
        if (dim.interpretation && dim.interpretation.length > 0) {
          dimEntry.interpretation = dim.interpretation.map(function (r) {
            let min, max;
            if (r.min !== undefined) {
              min = r.min;
            }
            if (r.max !== undefined) {
              max = r.max;
            }
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

    if (aiJson.metrics) {
      for (let mi = 0; mi < aiJson.metrics.length; mi++) {
        const m = aiJson.metrics[mi];
        const mLabel = m.label || m.name || '';
        let key = m.key || pinyinToKey(mLabel);
        if (key === 'total_score' || key === 'Total_Score') {
          key = 'totalScore';
        }
        const entry = { key: key, label: mLabel, formula: m.formula || 'SUM', items: m.items || 'ALL' };
        if (m.transform) {
          if (typeof m.transform === 'string' && m.transform) {
            entry.transform = m.transform;
          } else if (m.transform.expression) {
            entry.transform = m.transform;
          }
        }
        if (m.formula === 'COUNT_IF' && m.condition && typeof m.condition === 'object') {
          entry.condition = m.condition;
        }
        if (m.formula === 'DERIVED' || (['SUM', 'AVG', 'COUNT_IF'].indexOf(m.formula) === -1 && m.expression)) {
          entry.formula = 'DERIVED';
          entry.expression = m.expression || '';
        } else if (m.formula === 'SUM' && m.items === 'ALL' && scoring.dimensions.length > 0) {
          const dimKeys = scoring.dimensions.map(function (d) {
            return d.key;
          });
          if (dimKeys.length > 0) {
            entry.formula = 'DERIVED';
            entry.expression = dimKeys.join(' + ');
          }
        }
        scoring.metrics.push(entry);
      }
    }

    if (aiJson.interpretation) {
      for (let ii = 0; ii < aiJson.interpretation.length; ii++) {
        const rule = aiJson.interpretation[ii];
        var min2, max2;
        if (rule.min !== undefined) {
          min2 = rule.min;
        }
        if (rule.max !== undefined) {
          max2 = rule.max;
        }
        if (rule.condition && min2 === undefined && max2 === undefined) {
          const parsed2 = parseConditionStr(rule.condition);
          if (parsed2) {
            if (parsed2.operator === '>' || parsed2.operator === '>=') {
              min2 = parsed2.value;
            } else if (parsed2.operator === '<' || parsed2.operator === '<=') {
              max2 = parsed2.value;
            }
          }
        }
        let metricKey = rule.metric;
        if (metricKey === 'total_score' || metricKey === 'Total_Score') {
          metricKey = 'totalScore';
        }
        if (metricKey) {
          let metMatch = null;
          for (let smi = 0; smi < scoring.metrics.length; smi++) {
            if (scoring.metrics[smi].key === metricKey) {
              metMatch = scoring.metrics[smi];
              break;
            }
          }
          if (!metMatch) {
            for (let smi2 = 0; smi2 < scoring.metrics.length; smi2++) {
              if (scoring.metrics[smi2].label === metricKey) {
                metricKey = scoring.metrics[smi2].key;
                break;
              }
            }
          }
        }
        const bounds2 = normalizeRangeBounds(min2, max2);
        scoring.interpretation.push({
          metric: metricKey,
          min: bounds2.min,
          max: bounds2.max,
          level: rule.level || normalizeLevel(rule.label),
          label: rule.label,
          color: rule.color,
          text: rule.text || rule.advice || ''
        });
      }
    }

    if (aiJson.screening) {
      const scr = aiJson.screening;
      const conditions = [];
      const resolveMetricKey = function (name) {
        if (!name) {
          return name;
        }
        if (name === 'total_score' || name === 'Total_Score') {
          name = 'totalScore';
        }
        for (let rk = 0; rk < scoring.metrics.length; rk++) {
          if (scoring.metrics[rk].key === name) {
            return scoring.metrics[rk].key;
          }
        }
        for (let rk2 = 0; rk2 < scoring.metrics.length; rk2++) {
          if (scoring.metrics[rk2].label === name) {
            return scoring.metrics[rk2].key;
          }
        }
        for (let rk3 = 0; rk3 < scoring.dimensions.length; rk3++) {
          if (scoring.dimensions[rk3].key === name || scoring.dimensions[rk3].label === name) {
            return scoring.dimensions[rk3].key;
          }
        }
        return name;
      };
      if (scr.conditions) {
        for (let ci = 0; ci < scr.conditions.length; ci++) {
          const c = scr.conditions[ci];
          const condition = { label: c.label || '' };
          if (c.metric && (c.operator || c.op) && c.value !== undefined) {
            condition.metric = resolveMetricKey(c.metric);
            condition.op = c.operator || c.op;
            condition.value = c.value;
            conditions.push(condition);
            continue;
          }
          if (c.condition) {
            const parsed3 = parseConditionStr(c.condition);
            if (parsed3) {
              condition.metric = scr.metric || '总分';
              condition.op = parsed3.operator;
              condition.value = parsed3.value;
              conditions.push(condition);
              continue;
            }
            const refMatch = c.condition.match(/^(\w+)\s*(>=|<=|!=|==|>|<)\s*(\d+\.?\d*)$/);
            if (refMatch) {
              condition.metric = refMatch[1];
              condition.op = refMatch[2];
              condition.value = Number(refMatch[3]);
              conditions.push(condition);
              continue;
            }
          }
        }
      }
      if (conditions.length > 0) {
        scoring.screening = {
          logic: scr.logic || 'OR',
          conditions: conditions,
          positiveLabel: scr.positiveLabel || '筛查阳性',
          negativeLabel: scr.negativeLabel || '筛查阴性'
        };
      }
    }
    return scoring;
  }

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
    const p = prefix || 'metric_';
    const slug = label
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return p + slug.substring(0, 30);
  }

  // 公开 API
  return {
    calculate: calculate,
    calcMaxScores: calcMaxScores,
    calcMinScores: calcMinScores,
    parseItems: parseItems,
    normalizeAiJson: normalizeAiJson,
    safeEval: safeEval,
    round2: round2
  };
})();

module.exports = ScoringEngine;
