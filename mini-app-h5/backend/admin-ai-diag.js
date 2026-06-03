function getSelectedScale() {
  // 新模式：内嵌编辑器通过 _currentScoringScaleId 追踪
  if (typeof _currentScoringScaleId !== 'undefined' && _currentScoringScaleId) {
    return scales.find((s) => s.id === _currentScoringScaleId) || null;
  }
  // 旧模式：模态框/下拉框
  const sel = document.getElementById('sc-scale-select');
  if (!sel || !sel.value) {
    return null;
  }
  return scales.find((s) => s.id === parseInt(sel.value));
}

function getMetaPrompt() {
  const prompts = window.DEFAULT_PROMPTS || [];
  const meta = prompts.find(function (p) {
    return p.id === 'meta';
  });
  if (meta && meta.versions && meta.versions.length > 0) {
    return meta.versions[meta.versions.length - 1].content;
  }
  return '';
}

function loadMetaPromptToEditor() {
  const el = document.getElementById('ai-diag-meta-prompt');
  if (el) {
    el.value = getMetaPrompt();
  }
}

function toggleMetaPromptPanel() {
  const panel = document.getElementById('meta-prompt-panel');
  const icon = document.getElementById('meta-prompt-toggle-icon');
  if (panel.style.display === 'none') {
    panel.style.display = '';
    icon.textContent = '▲ 收起';
    loadMetaPromptToEditor();
  } else {
    panel.style.display = 'none';
    icon.textContent = '▼ 展开';
  }
}

function buildScaleContext(scale) {
  const name = scale.name || scale.scaleName || '未知量表';
  const code = scale.code || '';
  const category = scale.categoryName || scale.category || '未分类';
  const desc = scale.desc || scale.description || '无描述';
  const questions = scale.questions || [];
  const scoring = scale.scoring || {};

  // --- 基本信息 ---
  let ctx = '【量表基本信息】\n';
  ctx += `名称：${name}\n`;
  if (code) {
    ctx += `编码：${code}\n`;
  }
  ctx += `分类：${category}\n`;
  ctx += `描述：${desc}\n`;
  ctx += `题目数量：${questions.length}\n`;
  if (scale.applicablePeople) {
    ctx += `适用人群：${scale.applicablePeople}\n`;
  }

  // --- 计分规则 ---
  ctx += '\n【计分规则】\n';

  // 维度信息
  if (scoring.dimensions && scoring.dimensions.length > 0) {
    ctx += '维度定义：\n';
    scoring.dimensions.forEach((dim, i) => {
      ctx += `${i + 1}. ${dim.label || dim.key}（key: ${dim.key}）：`;
      const dimItems = Array.isArray(dim.items)
        ? dim.items
        : typeof dim.items === 'string'
          ? dim.items.split(',').map(Number)
          : [];
      if (dimItems.length > 0) {
        ctx += `包含题目 ${dimItems.map((it) => 'Q' + it).join(', ')}`;
      }
      if (dim.formula) {
        ctx += `，公式：${dim.formula}`;
      }
      ctx += '\n';

      // 维度解释规则
      if (dim.interpretation && dim.interpretation.length > 0) {
        dim.interpretation.forEach((item) => {
          const min = item.min !== undefined && item.min !== null ? item.min : '∞';
          const max = item.max !== undefined && item.max !== null ? item.max : '∞';
          const level = item.label || item.level || '';
          const text = item.text || item.advice || '';
          ctx += `   ${min}~${max}分 → ${level}：${text}\n`;
        });
      }
    });
  }

  // 总分解释
  if (scoring.interpretation && scoring.interpretation.length > 0) {
    ctx += '\n总分解释：\n';
    scoring.interpretation.forEach((item) => {
      const min = item.min !== undefined && item.min !== null ? item.min : '∞';
      const max = item.max !== undefined && item.max !== null ? item.max : '∞';
      const level = item.label || item.level || '';
      const text = item.text || item.advice || '';
      ctx += `- ${min}~${max}分 → ${level}：${text}\n`;
    });
  }

  // 筛查条件
  if (scoring.screening) {
    ctx += '\n筛查条件：\n';
    if (scoring.screening.positiveLabel) {
      ctx += `阳性标签：${scoring.screening.positiveLabel}\n`;
    }
    if (scoring.screening.negativeLabel) {
      ctx += `阴性标签：${scoring.screening.negativeLabel}\n`;
    }
    if (scoring.screening.conditions && scoring.screening.conditions.length > 0) {
      scoring.screening.conditions.forEach((cond) => {
        ctx += `- ${cond.metric || ''} ${cond.op || ''} ${cond.value !== undefined ? cond.value : ''}${cond.label ? ' → ' + cond.label : ''}\n`;
      });
    }
  }

  // 衍生指标
  if (scoring.metrics && scoring.metrics.length > 0) {
    ctx += '\n衍生指标：\n';
    scoring.metrics.forEach((m) => {
      ctx += `- ${m.label || m.key}（key: ${m.key}）：${m.formula || ''}`;
      if (m.expression) {
        ctx += `，表达式：${m.expression}`;
      }
      ctx += '\n';
    });
  }

  // --- 题目详情 ---
  ctx += '\n【题目详情】\n';
  // 构建维度映射表（题号 → 维度名）
  const qDimMap = {};
  if (scoring.dimensions) {
    scoring.dimensions.forEach((dim) => {
      if (dim.items) {
        const items = Array.isArray(dim.items)
          ? dim.items
          : typeof dim.items === 'string'
            ? dim.items.split(',').map(Number)
            : [];
        items.forEach((qIdx) => {
          qDimMap[qIdx] = dim.label || dim.key;
          qDimMap[qIdx - 1] = dim.label || dim.key;
        });
      }
    });
  }

  questions.forEach((q, i) => {
    const qNum = i + 1;
    const dimName = qDimMap[i] || qDimMap[qNum] || '';
    const reverseFlag = q.reverseScored ? '，反向计分' : '';
    const qType = q.type || 'standard';

    // 题型标签
    const typeLabel = qType === 'matrix' ? ' [矩阵题]' : qType === 'parent-child' ? ' [父子题]' : '';

    ctx += `Q${qNum}`;
    if (typeLabel) {
      ctx += typeLabel;
    }
    if (dimName) {
      ctx += ` [${dimName}]`;
    }
    if (reverseFlag) {
      ctx += ' [反向计分]';
    }
    ctx += `：${q.text || '(无题文)'}\n`;

    // 选项（所有题型共有）
    if (q.options && q.options.length > 0) {
      ctx += '  共享选项：';
      q.options.forEach((opt, oi) => {
        const label = opt.label || opt.text || '';
        const score = opt.score !== undefined ? opt.score : '';
        ctx += `${label}(${score}分)`;
        if (oi < q.options.length - 1) {
          ctx += ' / ';
        }
      });
      ctx += '\n';
    }

    // 矩阵题：输出行项目
    if (qType === 'matrix' && q.rows && q.rows.length > 0) {
      ctx += '  行项目：';
      q.rows.forEach((row, ri) => {
        const rowLabel = typeof row === 'object' ? row.label || row.text || row.id : row;
        ctx += rowLabel;
        if (ri < q.rows.length - 1) {
          ctx += ' / ';
        }
      });
      ctx += '\n';
      ctx += '  计分：每行选择一个选项，该选项的分数即为该行得分，所有行得分求和\n';
    }

    // 父子题：输出主选项属性 + 子选项
    if (qType === 'parent-child') {
      // 主选项属性
      if (q.options && q.options.length > 0) {
        ctx += '  主选项属性：';
        q.options.forEach((opt, oi) => {
          const label = opt.label || opt.text || '';
          const attrs = [];
          if (opt.isTerminal) {
            attrs.push('终止');
          }
          if (opt.hasChildren) {
            attrs.push('展开子选项');
          }
          ctx += `${label}(${attrs.length ? attrs.join('+') : '默认'})`;
          if (oi < q.options.length - 1) {
            ctx += ' / ';
          }
        });
        ctx += '\n';
      }
      // 子选项
      if (q.subOptions && q.subOptions.length > 0) {
        ctx += '  子选项：';
        q.subOptions.forEach((sub, si) => {
          const subLabel = typeof sub === 'object' ? sub.label || sub.text || sub.id : sub;
          const subScore = typeof sub === 'object' && sub.score !== undefined ? `(${sub.score}分)` : '';
          const subInput = typeof sub === 'object' && sub.hasInput ? '[可填空]' : '';
          ctx += `${subLabel}${subScore}${subInput}`;
          if (si < q.subOptions.length - 1) {
            ctx += ' / ';
          }
        });
        ctx += '\n';
        ctx += '  计分：选"终止"的主选项计0分；选"展开子选项"的主选项后，勾选的子选项数即为该题得分\n';
      }
    }
  });

  return ctx;
}

function renderAiDiagScaleList() {
  const container = document.getElementById('ai-diag-scale-list');
  if (!container) {
    return;
  }
  const scales = SharedData.getAllScales().filter((s) => s.status !== 0);
  // ✅ P2安全修复：对所有用户数据进行HTML转义
  container.innerHTML = scales
    .map((s) => {
      const hasDiag = s.aiDiag && s.aiDiag.enabled;
      const promptText = s.aiDiag && s.aiDiag.prompt ? s.aiDiag.prompt : '';
      const promptPreview = promptText.length > 60 ? promptText.substring(0, 60) + '…' : promptText;
      const hasDefaultPrompt =
        !promptText &&
        DEFAULT_SCALES.find(function (d) {
          return d.id === s.id;
        });

      // 对所有动态数据进行HTML转义
      const safeId = SecurityUtils.escapeHtml(s.id);
      const safeName = SecurityUtils.escapeHtml(s.name || s.scaleName || '');
      const safeIcon = SecurityUtils.escapeHtml(s.icon || '📋');
      const safeCode = SecurityUtils.escapeHtml(s.code || '');
      const safeColor = SecurityUtils.escapeHtml(s.color || 'var(--primary)');
      const safePromptPreview = SecurityUtils.escapeHtml(promptPreview);

      return (
        '<div class="ai-diag-scale-item" data-id="' +
        safeId +
        '" onclick="selectAiDiagScale(\'' +
        safeId +
        '\')" style="padding:10px 12px;border-radius:8px;cursor:pointer;margin-bottom:4px;transition:background .2s;' +
        (currentAiDiagScaleId === s.id ? 'background:var(--primary-light);' : '') +
        '" onmouseover="this.style.background=this.style.background||\'var(--bg)\'" onmouseout="this.style.background=\'' +
        (currentAiDiagScaleId === s.id ? 'var(--primary-light)' : '') +
        '\'">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
        '<div style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;background:' +
        safeColor +
        '18">' +
        safeIcon +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:6px">' +
        '<span style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
        safeName +
        '</span>' +
        (hasDiag
          ? '<span style="color:var(--success);font-size:11px;flex-shrink:0">✓ 已配置</span>'
          : hasDefaultPrompt
            ? '<span style="color:var(--warning,#e6a700);font-size:11px;flex-shrink:0">◉ 默认</span>'
            : '<span style="color:var(--text-muted);font-size:11px;flex-shrink:0">○ 未配置</span>') +
        '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' +
        safeCode +
        '</div>' +
        (promptPreview
          ? '<div style="font-size:11px;color:var(--text-sec);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.8">' +
            safePromptPreview +
            '</div>'
          : '') +
        '</div>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');
}

function filterAiDiagList() {
  const keyword = (document.getElementById('ai-diag-search')?.value || '').toLowerCase();
  const items = document.querySelectorAll('#ai-diag-scale-list .ai-diag-scale-item');
  items.forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(keyword) ? '' : 'none';
  });
}

function selectAiDiagScale(scaleId) {
  currentAiDiagScaleId = scaleId;
  const scale = SharedData.getAllScales().find((s) => s.id == scaleId);
  if (!scale) {
    return;
  }

  document.getElementById('ai-diag-empty').style.display = 'none';
  document.getElementById('ai-diag-editor').style.display = '';

  document.getElementById('ai-diag-scale-name').textContent = scale.name || scale.scaleName || '';
  document.getElementById('ai-diag-scale-code').textContent = scale.code || '';

  const diag = scale.aiDiag || {};
  document.getElementById('ai-diag-enabled').checked = diag.enabled !== false;
  // 如果当前量表没有自定义 prompt，尝试从 DEFAULT_SCALES 加载默认提示词展示
  let promptValue = diag.prompt || '';
  if (!promptValue) {
    const defScale = DEFAULT_SCALES.find(function (d) {
      return d.id === scaleId;
    });
    if (defScale && defScale.aiDiag && defScale.aiDiag.prompt) {
      promptValue = defScale.aiDiag.prompt;
    }
  }
  document.getElementById('ai-diag-prompt').value = promptValue;
  let welcomeValue = diag.welcome || '';
  if (!welcomeValue) {
    const defW = DEFAULT_SCALES.find(function (d) {
      return d.id === scaleId;
    });
    if (defW && defW.aiDiag && defW.aiDiag.welcome) {
      welcomeValue = defW.aiDiag.welcome;
    }
  }
  document.getElementById('ai-diag-welcome').value = welcomeValue;
  document.getElementById('ai-diag-temp').value = diag.temperature || 0.7;
  document.getElementById('ai-diag-max-tokens').value = diag.maxTokens || 2000;

  // 重新渲染列表高亮
  renderAiDiagScaleList();
}

function toggleAiDiagEnabled() {
  // 即时保存启用状态
  if (!currentAiDiagScaleId) {
    return;
  }
  const scale = SharedData.getAllScales().find((s) => s.id == currentAiDiagScaleId);
  if (!scale) {
    return;
  }
  if (!scale.aiDiag) {
    scale.aiDiag = {};
  }
  scale.aiDiag.enabled = document.getElementById('ai-diag-enabled').checked;
  SharedData.saveScalesData(SharedData.getAllScales());
  SharedData.syncToFrontend();
  renderAiDiagScaleList();
}

function saveAiDiagConfig() {
  if (!currentAiDiagScaleId) {
    return;
  }
  const scales = SharedData.getAllScales();
  const scale = scales.find((s) => s.id == currentAiDiagScaleId);
  if (!scale) {
    return;
  }

  scale.aiDiag = {
    enabled: document.getElementById('ai-diag-enabled').checked,
    prompt: document.getElementById('ai-diag-prompt').value.trim(),
    welcome: document.getElementById('ai-diag-welcome').value.trim(),
    temperature: parseFloat(document.getElementById('ai-diag-temp').value) || 0.7,
    maxTokens: parseInt(document.getElementById('ai-diag-max-tokens').value) || 2000
  };

  SharedData.saveScalesData(scales);
  // 同步更新全局 scales 变量，确保 syncToFrontend() 推送的数据包含 aiDiag
  const globalIdx = window.scales
    ? window.scales.findIndex(function (s) {
        return s.id == currentAiDiagScaleId;
      })
    : -1;
  if (globalIdx >= 0 && window.scales) {
    window.scales[globalIdx] = scale;
  }
  SharedData.syncToFrontend();
  renderAiDiagScaleList();
  showToast('测评详情配置已保存', 'success');
}

function resetAiDiagPrompt() {
  if (!currentAiDiagScaleId) {
    return;
  }
  document.getElementById('ai-diag-prompt').value = '';
  document.getElementById('ai-diag-welcome').value = '';
  document.getElementById('ai-diag-temp').value = 0.7;
  document.getElementById('ai-diag-max-tokens').value = 2000;
  showToast('已重置为默认值', 'info');
}

async function testAiDiag() {
  if (!currentAiDiagScaleId) {
    return;
  }
  const btn = document.getElementById('ai-diag-test-btn');
  const resultEl = document.getElementById('ai-diag-test-result');
  const prompt = document.getElementById('ai-diag-prompt').value.trim();

  if (!prompt) {
    showToast('请先编写测评详情 Prompt', 'warning');
    return;
  }

  const testDataEl = document.getElementById('ai-diag-test-data');
  let testData;
  try {
    testData = JSON.parse(testDataEl.value || '{}');
  } catch (e) {
    testData = {
      score: 156,
      level: '轻度异常',
      dimensions: [
        { name: '躯体化', score: 1.6 },
        { name: '强迫症状', score: 2.4 }
      ]
    };
  }

  btn.disabled = true;
  btn.textContent = '⏳ 请求中...';
  resultEl.style.display = 'block';
  resultEl.textContent = '正在发送测试请求...';

  const scale = SharedData.getAllScales().find((s) => s.id == currentAiDiagScaleId);
  const scaleName = scale ? scale.name || scale.scaleName : '测试量表';

  // 替换变量
  const systemPrompt = prompt
    .replace(/\{scaleName\}/g, scaleName)
    .replace(/\{score\}/g, testData.score || 'N/A')
    .replace(/\{level\}/g, testData.level || 'N/A')
    .replace(/\{dimensions\}/g, JSON.stringify(testData.dimensions || []))
    .replace(/\{answers\}/g, JSON.stringify(testData.answers || {}));

  try {
    const result = await callAi([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请根据以上提示词和测评数据，生成测评分析报告。' }
    ]);
    resultEl.textContent = result || '（AI 未返回内容）';
    showToast('测评详情测试完成', 'success');
  } catch (e) {
    resultEl.textContent = '❌ 请求失败：' + e.message;
    showToast('请求失败：' + e.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = '发送测试请求';
}

let _aiModalScaleId = null; // 当前目标量表 ID

let _aiModalScaleName = ''; // 当前目标量表名称

let _aiParsedData = null; // iframe 中解析后的标准化数据

let _aiMsgHandler = null; // postMessage 监听引用

function openAiOneClickModal(scaleId) {
  const scale = scales.find(function (s) {
    return s.id === scaleId;
  });
  if (!scale) {
    showToast('未找到对应量表');
    return;
  }

  _aiModalScaleId = scaleId;
  _aiModalScaleName = scale.name;
  _aiParsedData = null;

  // 填充信息
  document.getElementById('aiTargetScale').textContent = scale.name;
  document.getElementById('aiModalSubtitle').textContent = '正在为「' + scale.name + '」生成计分规则';

  // 重置按钮状态
  document.getElementById('aiImportBtn').disabled = true;
  document.getElementById('aiImportBtn').innerHTML = '📥 导入到量表';
  document.getElementById('aiImportBtn').style.background = '';
  document.getElementById('aiFooterImportBtn').disabled = true;
  document.getElementById('aiFooterImportBtn').innerHTML = '📥 导入到量表';
  document.getElementById('aiFooterImportBtn').style.background = '';

  // 重置步骤
  _resetAiSteps();

  // 显示模态框
  document.getElementById('aiOneClickModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  // 加载 iframe
  const iframe = document.getElementById('aiTestIframe');
  iframe.src = './ai-scoring-test.html?v=' + Date.now();

  // iframe 加载完成后发送系统提示词
  iframe.onload = function () {
    _sendSysPromptToIframe();
  };

  // 监听 iframe postMessage
  _aiMsgHandler = function (event) {
    if (!event.data || !event.data.type) {
      return;
    }
    if (event.data.type === 'ai-parse-start') {
      _activateAiStep(3);
    } else if (event.data.type === 'ai-parse-complete') {
      _activateAiStep(3);
    } else if (event.data.type === 'ai-normalize-complete') {
      _aiParsedData = event.data.data;
      _activateAiStep(3);
      _activateAiStep(4);
      // 启用导入按钮
      document.getElementById('aiImportBtn').disabled = false;
      document.getElementById('aiFooterImportBtn').disabled = false;
    } else if (event.data.type === 'ai-extract-start') {
      _activateAiStep(2);
    } else if (event.data.type === 'ai-extract-complete') {
      _activateAiStep(3);
    }
  };
  window.addEventListener('message', _aiMsgHandler);

  // 关闭下拉菜单
  closeAllDropdowns();
}

function closeAiOneClickModal() {
  document.getElementById('aiOneClickModal').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('aiTestIframe').src = 'about:blank';
  if (_aiMsgHandler) {
    window.removeEventListener('message', _aiMsgHandler);
    _aiMsgHandler = null;
  }
  _aiParsedData = null;
}

function _resetAiSteps() {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('aiStep' + i);
    if (el) {
      if (i === 1) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  }
}

function _activateAiStep(num) {
  const el = document.getElementById('aiStep' + num);
  if (el) {
    el.classList.add('active');
  }
}

function aiOneClickImport() {
  if (!_aiModalScaleId) {
    return;
  }

  const scale = scales.find(function (s) {
    return s.id === _aiModalScaleId;
  });
  if (!scale) {
    showToast('量表数据丢失，请刷新页面重试');
    return;
  }

  // 尝试从 iframe 获取标准化数据
  let importedData = null;

  // 方案1：使用 postMessage 缓存的数据
  if (_aiParsedData && _aiParsedData.dimensions && _aiParsedData.dimensions.length > 0) {
    importedData = _aiParsedData;
  }

  // 方案2：直接从 iframe 获取（同源下可用）
  if (!importedData) {
    try {
      const iframe = document.getElementById('aiTestIframe');
      const iframeWin = iframe.contentWindow || iframe.contentDocument;
      if (iframeWin && iframeWin._lastNormalizedData) {
        importedData = iframeWin._lastNormalizedData;
      }
    } catch (e) {
      // 跨域安全限制，降级提示
    }
  }

  if (!importedData) {
    showToast('请先在右侧页面完成解析并点击「标准化 + 验证」');
    return;
  }

  // 禁用按钮，显示加载状态
  const btn = document.getElementById('aiImportBtn');
  const footerBtn = document.getElementById('aiFooterImportBtn');
  btn.disabled = true;
  footerBtn.disabled = true;
  btn.innerHTML = '⏳ 导入中...';
  footerBtn.innerHTML = '⏳ 导入中...';

  // 写入量表数据（不破坏现有结构）
  scale.scoring = {
    dimensions: importedData.dimensions || [],
    metrics: importedData.metrics || [],
    interpretation: importedData.interpretation || [],
    screening: importedData.screening || null
  };

  // 保存
  saveScales(scales);

  // 成功反馈
  setTimeout(function () {
    btn.innerHTML = '✅ 导入成功';
    btn.style.background = 'var(--success)';
    footerBtn.innerHTML = '✅ 导入成功';
    footerBtn.style.background = 'var(--success)';

    showToast('✅ 已成功导入「' + _aiModalScaleName + '」的计分规则');

    // 激活所有步骤
    for (let i = 1; i <= 4; i++) {
      _activateAiStep(i);
    }

    // 2秒后关闭弹窗并刷新表格
    setTimeout(function () {
      closeAiOneClickModal();
      renderScaleTable();
      renderScoringRulesTable();
    }, 1500);
  }, 600);
}
