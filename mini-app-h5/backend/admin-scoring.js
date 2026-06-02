function manageScoringRules() {
  const existingModal = document.getElementById('scoring-rules-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modalHTML = `
    <div class="modal-overlay scoring-rules-modal" id="scoring-rules-modal">
      <div class="modal" style="width: 900px; max-height: 92vh; display:flex; flex-direction:column;">
        <div class="modal-header" style="flex-shrink:0;">
          <span class="modal-title"><span>🧮</span><span>计分规则配置</span></span>
          <button class="modal-close" data-action="close-scoring-modal">✕</button>
        </div>
        <div class="modal-body" style="overflow-y:auto; flex:1; padding:20px;">
          <!-- 量表选择 -->
          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:13px;font-weight:500;color:var(--text-sec);margin-bottom:8px;">选择量表</label>
            <select id="sc-scale-select" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;" onchange="loadScoringForm()">
              <option value="">请选择量表</option>
              ${scales.map((s) => `<option value="${s.id}">${s.name}（${(s.questions || []).length}题）${s.scoring ? ' ✅已配置' : ''}</option>`).join('')}
            </select>
          </div>
          <!-- 配置区域 -->
          <div id="sc-form-area"></div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  const modal = document.getElementById('scoring-rules-modal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeScoringModal() {
  const modal = document.getElementById('scoring-rules-modal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => modal.remove(), 300);
  }
}

// ========== 加载配置表单 ==========

// ========== 计分规则管理 - 左侧量表列表 ==========
// 追踪当前内嵌编辑器选中的量表 ID
let _currentScoringScaleId = null;

function renderScoringScaleList() {
  const container = document.getElementById('scoring-scale-list');
  if (!container) {
    return;
  }
  const searchInput = document.getElementById('scoring-scale-search');
  const keyword = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const filtered = scales.filter((s) => s.name.toLowerCase().includes(keyword));
  container.innerHTML = filtered
    .map((s) => {
      const qCount = (s.questions || []).length;
      const hasScoring = !!(s.scoring && (s.scoring.dimensions || []).length > 0);
      return `<div class="sc-scale-item" data-action="select-scoring-scale" data-scale-id="${s.id}" data-scale-id="${s.id}" style="padding:10px 12px;margin-bottom:4px;border-radius:6px;cursor:pointer;border:1px solid transparent;transition:all 0.15s;">
      <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:2px;">${escHtml(s.name)}</div>
      <div style="font-size:11px;color:var(--text-muted);">${qCount}题 ${hasScoring ? '<span style="color:#52c41a;font-weight:600;">✓ 已配置</span>' : '<span style="color:#d9d9d9;">未配置</span>'}</div>
    </div>`;
    })
    .join('');
}

function filterScoringScaleList() {
  renderScoringScaleList();
}

// ========== 选中量表并加载编辑器 ==========
function selectScoringScale(scaleId) {
  _currentScoringScaleId = scaleId;
  // 高亮选中项
  document.querySelectorAll('.sc-scale-item').forEach((el) => {
    el.style.background = el.dataset.scaleId == scaleId ? 'var(--primary)08' : '';
    el.style.borderColor = el.dataset.scaleId == scaleId ? 'var(--primary)' : 'transparent';
  });
  // 显示编辑器
  const emptyDiv = document.getElementById('scoring-empty');
  const editorDiv = document.getElementById('scoring-editor');
  if (emptyDiv) {
    emptyDiv.style.display = 'none';
  }
  if (editorDiv) {
    editorDiv.style.display = 'block';
  }
  // 加载表单
  const scale = scales.find((s) => s.id === scaleId);
  if (!scale) {
    return;
  }
  const nameEl = document.getElementById('scoring-scale-name');
  const codeEl = document.getElementById('scoring-scale-code');
  if (nameEl) {
    nameEl.textContent = scale.name;
  }
  if (codeEl) {
    codeEl.textContent = scale.code || '';
  }
  loadScoringFormInline(scaleId);
}

// ========== 构建计分规则表单 HTML（共用） ==========
function buildScoringFormHTML(scaleId) {
  const scale = scales.find((s) => s.id === scaleId);
  if (!scale) {
    return '';
  }
  const questions = scale.questions || [];
  const sc = scale.scoring || { dimensions: [], metrics: [], interpretation: [], screening: null };
  const dims = sc.dimensions || [];
  const metrics = sc.metrics || [];
  const interp = sc.interpretation || [];
  const screening = sc.screening || null;
  const existingDims = dims.map((d) => d.label);
  const questionDims = [...new Set(questions.filter((q) => q.dimension).map((q) => q.dimension))];
  const unusedDims = questionDims.filter((d) => !existingDims.includes(d));

  return `
    <!-- 步骤导航（sc-panel-0~4，switchScPanel(btn,idx) 切换） -->
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
      <button class="sc-tab active" data-action="sc-switch-panel" data-index="0" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border);background:var(--primary);color:#fff;cursor:pointer;font-size:13px;">① 维度配置</button>
      <button class="sc-tab" data-action="sc-switch-panel" data-index="1" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border);background:#fff;cursor:pointer;font-size:13px;">② 指标配置</button>
      <button class="sc-tab" data-action="sc-switch-panel" data-index="2" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border);background:#fff;cursor:pointer;font-size:13px;">③ 解释规则</button>
      <button class="sc-tab" data-action="sc-switch-panel" data-index="3" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border);background:#fff;cursor:pointer;font-size:13px;">④ 筛查规则</button>
      <button class="sc-tab" data-action="sc-switch-panel" data-index="4" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border);background:#fff;cursor:pointer;font-size:13px;">⑤ 模拟测试</button>
    </div>

    <!-- ① 维度配置 -->
    <div class="sc-panel" id="sc-panel-0">
      ${unusedDims.length > 0 ? `<div style="padding:10px 14px;background:#FFF8E1;border:1px solid #F5A623;border-radius:6px;font-size:12px;color:#8B6914;margin-bottom:16px;">💡 题目中已标记但未配置的维度：${unusedDims.map((d) => '<strong>' + escHtml(d) + '</strong>').join('、')}，建议添加对应维度规则。</div>` : ''}
      <div id="sc-dims-list">${dims.length === 0 ? '<div style="text-align:center;padding:30px;color:var(--text-muted);">暂无维度配置<br><span style="font-size:12px;">点击下方按钮添加维度</span></div>' : ''}</div>
      <button data-action="sc-add-dimension" style="margin-top:12px;padding:8px 16px;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">➕ 添加维度</button>
    </div>

    <!-- ② 指标配置 -->
    <div class="sc-panel" id="sc-panel-1" style="display:none;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">配置量表级计算指标（总分、阳性数等），可附加公式转换。</div>
      <div id="sc-metrics-list"></div>
      <button data-action="sc-add-metric" style="margin-top:12px;padding:8px 16px;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">➕ 添加指标</button>
    </div>

    <!-- ③ 解释规则 -->
    <div class="sc-panel" id="sc-panel-2" style="display:none;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">配置总分/标准分的阈值分档解释，每个区间对应一个等级。</div>
      <button data-action="sc-auto-fill-ranges" style="margin-bottom:12px;padding:6px 14px;background:#FFF8E1;border:1px solid #F5A623;border-radius:6px;cursor:pointer;font-size:12px;color:#8B6914;">🪄 自动推导分值范围</button>
      <div id="sc-interp-list"></div>
      <button data-action="sc-add-interp-rule" style="margin-top:12px;padding:8px 16px;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">➕ 添加分档</button>
    </div>

    <!-- ④ 筛查规则 -->
    <div class="sc-panel" id="sc-panel-3" style="display:none;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">配置多条件筛查判定（OR/AND 逻辑组合），可选功能。</div>
      <div id="sc-screening-area"></div>
    </div>

    <!-- ⑤ 模拟测试 -->
    <div class="sc-panel" id="sc-panel-4" style="display:none;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">用模拟数据测试当前计分规则，验证配置是否正确。</div>
      <div id="sc-test-area">
        <button data-action="sc-run-test" style="padding:10px 20px;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">🧪 运行模拟测试</button>
      </div>
    </div>
  `;
}

// ========== 内嵌模式加载计分表单 ==========
function loadScoringFormInline(scaleId) {
  const container = document.getElementById('scoring-form-container');
  if (!container) {
    return;
  }
  const scale = scales.find((s) => s.id === scaleId);
  if (!scale) {
    return;
  }
  container.innerHTML = buildScoringFormHTML(scaleId);
  // 渲染已有数据
  const sc = scale.scoring || {};
  const dims = sc.dimensions || [];
  const metrics = sc.metrics || [];
  const interp = sc.interpretation || [];
  const screening = sc.screening || null;
  dims.forEach((d, i) => renderDimension(d, i));
  metrics.forEach((m, i) => renderMetric(m, i));
  interp.forEach((r, i) => renderInterpRule(r, i, metrics, dims));
  renderScreening(screening, metrics, dims);
}

// ========== 切换计分规则面板（内嵌模式） ==========
function switchScPanel(btn, idx) {
  document.querySelectorAll('.sc-tab').forEach((t) => {
    t.style.background = '#fff';
    t.style.color = '';
  });
  btn.style.background = 'var(--primary)';
  btn.style.color = '#fff';
  document.querySelectorAll('.sc-panel').forEach((p) => (p.style.display = 'none'));
  const panel = document.getElementById('sc-panel-' + idx);
  if (panel) {
    panel.style.display = 'block';
  }
}

// ========== 内嵌模式保存 ==========
function saveScoringConfig() {
  const scaleId = _currentScoringScaleId;
  if (!scaleId) {
    showToast('请先选择一个量表', 'warning');
    return;
  }
  const scale = scales.find((s) => s.id === scaleId);
  if (!scale) {
    return;
  }
  const data = collectScoringData();
  scale.scoring = data;
  const idx = scales.findIndex((s) => s.id === scale.id);
  if (idx >= 0) {
    scales[idx] = scale;
  }
  SharedData.saveScalesData(scales);
  SharedData.syncToFrontend();
  showToast('计分规则已保存！', 'success');
  renderScoringScaleList();
}

// 旧函数重定向（兼容其他引用）
function loadScoringForm() {
  if (_currentScoringScaleId) {
    loadScoringFormInline(_currentScoringScaleId);
  } else if (scales.length > 0) {
    loadScoringFormInline(scales[0].id);
  }
}

function switchScTab(btn, panelId) {
  document.querySelectorAll('.sc-tab').forEach((t) => {
    t.style.background = '#fff';
    t.style.color = '';
  });
  btn.style.background = 'var(--primary)';
  btn.style.color = '#fff';
  document.querySelectorAll('.sc-panel').forEach((p) => (p.style.display = 'none'));
  document.getElementById(panelId).style.display = 'block';
}

// ========== 维度 CRUD ==========
function addDimension() {
  const scale = getSelectedScale();
  if (!scale) {
    return;
  }
  renderDimension({ key: '', label: '', formula: 'AVG', items: '', condition: null, interpretation: [] });
}

function renderDimension(dim, index) {
  const container = document.getElementById('sc-dims-list');
  const id = 'dim-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
  const isCollapsed = false;
  const interpHtml = (dim.interpretation || [])
    .map(
      (r, ri) => `
    <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;flex-wrap:wrap;">
      <input type="number" placeholder="最低分" value="${r.min !== undefined ? r.min : ''}" data-role="interp-min" style="width:70px;padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
      <span style="color:var(--text-muted);font-size:11px;">~</span>
      <input type="number" placeholder="最高分" value="${r.max !== undefined ? r.max : ''}" data-role="interp-max" style="width:70px;padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
      <select data-role="interp-level" style="padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
        <option value="normal" ${r.level === 'normal' ? 'selected' : ''}>正常</option>
        <option value="mild" ${r.level === 'mild' ? 'selected' : ''}>轻度</option>
        <option value="moderate" ${r.level === 'moderate' ? 'selected' : ''}>中度</option>
        <option value="severe" ${r.level === 'severe' ? 'selected' : ''}>中重度</option>
      </select>
      <input type="text" placeholder="等级标签" value="${escHtml(r.label || '')}" data-role="interp-label" style="width:80px;padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
      <input type="color" value="${r.color || '#7ED321'}" data-role="interp-color" style="width:32px;height:30px;border:1px solid var(--border);border-radius:4px;cursor:pointer;">
      <input type="text" placeholder="解释文本" value="${escHtml(r.text || '')}" data-role="interp-text" style="flex:1;min-width:120px;padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
      <button data-action="remove-parent" style="padding:4px 8px;background:var(--danger);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;">✕</button>
    </div>
  `
    )
    .join('');

  const scale = getSelectedScale();
  const reverseQIds = (scale.questions || []).filter((q) => q.reverse).map((q) => q.id);
  const reverseHint =
    reverseQIds.length > 0
      ? `<div style="font-size:11px;color:#D0021B;margin-top:4px;">🔄 反向计分题：${reverseQIds.join(', ')}（分值已在导入时翻转）</div>`
      : '';

  const html = `
    <div class="sc-dim-card" id="${id}" style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;background:#fff;">
      <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
        <span style="font-size:16px;font-weight:600;color:var(--primary);">${escHtml(dim.label || '新维度')}</span>
        <span style="font-size:11px;color:var(--text-muted);background:var(--bg-gray);padding:2px 8px;border-radius:10px;">${dim.formula || 'AVG'}</span>
        <span style="flex:1;"></span>
        <button data-action="sc-remove-dim" style="padding:4px 8px;background:none;border:1px solid var(--danger);color:var(--danger);border-radius:4px;cursor:pointer;font-size:11px;">删除</button>
        <span style="font-size:11px;color:var(--text-muted);">▼</span>
      </div>
      <div style="display:${isCollapsed ? 'none' : 'block'};margin-top:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
          <div>
            <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">维度键名（英文）</label>
            <input type="text" value="${escHtml(dim.key || '')}" data-role="dim-key" placeholder="如 somatization" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">维度名称（中文）</label>
            <input type="text" value="${escHtml(dim.label || '')}" data-role="dim-label" placeholder="如 躯体化" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">计算公式</label>
            <select data-role="dim-formula" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
              <option value="SUM" ${dim.formula === 'SUM' ? 'selected' : ''}>SUM（求和）</option>
              <option value="AVG" ${(dim.formula || 'AVG') === 'AVG' ? 'selected' : ''}>AVG（平均分）</option>
              <option value="COUNT_IF" ${dim.formula === 'COUNT_IF' ? 'selected' : ''}>COUNT_IF（条件计数）</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">题号（如 1,3,5-8,12）</label>
            <input type="text" value="${dim.items === 'ALL' ? 'ALL' : Array.isArray(dim.items) ? dim.items.join(',') : dim.items || ''}" data-role="dim-items" placeholder="1,3,5-8,12" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">满分（留空自动推导）</label>
            <input type="number" value="${dim.maxScore !== undefined ? dim.maxScore : ''}" data-role="dim-maxscore" placeholder="自动" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
          </div>
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">COUNT_IF 条件（仅 COUNT_IF 时填写，如 >=2）</label>
          <input type="text" value="${
            dim.condition
              ? Object.entries(dim.condition)
                  .map(([k, v]) => k + v)
                  .join(', ')
              : ''
          }" data-role="dim-condition" placeholder="如 >=2 或 >=2, <=4" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
        </div>
        ${reverseHint}
        <div style="margin-top:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:13px;font-weight:500;">维度解释阈值</span>
            <button data-action="sc-add-dim-interp" style="padding:4px 10px;background:var(--bg-gray);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:11px;">➕ 添加</button>
          </div>
          <div data-role="dim-interps">${interpHtml}</div>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

function addDimInterp(btn) {
  const container = btn.nextElementSibling;
  const html = `
    <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
      <input type="number" placeholder="最高分" data-role="interp-max" style="width:70px;padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
      <select data-role="interp-level" style="padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
        <option value="normal">正常</option><option value="mild">轻度</option><option value="moderate">中度</option><option value="severe">中重度</option>
      </select>
      <input type="text" placeholder="等级标签" data-role="interp-label" style="width:80px;padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
      <input type="color" value="#7ED321" data-role="interp-color" style="width:32px;height:30px;border:1px solid var(--border);border-radius:4px;cursor:pointer;">
      <input type="text" placeholder="解释文本" data-role="interp-text" style="flex:1;padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
      <button data-action="remove-parent" style="padding:4px 8px;background:var(--danger);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;">✕</button>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

// ========== 指标 CRUD ==========
function addMetric() {
  renderMetric({ key: '', label: '', formula: 'SUM', items: 'ALL', condition: null, transform: null });
}

function renderMetric(metric) {
  const container = document.getElementById('sc-metrics-list');
  const id = 'metric-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
  const html = `
    <div id="${id}" style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;background:#fff;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="font-size:14px;font-weight:600;">${escHtml(metric.label || '新指标')}</span>
        <button data-action="sc-remove-dim" style="padding:4px 8px;background:none;border:1px solid var(--danger);color:var(--danger);border-radius:4px;cursor:pointer;font-size:11px;margin-left:auto;">删除</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">指标键名</label>
          <input type="text" value="${escHtml(metric.key || '')}" data-role="metric-key" placeholder="如 totalScore" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">指标名称</label>
          <input type="text" value="${escHtml(metric.label || '')}" data-role="metric-label" placeholder="如 总分" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">计算公式</label>
          <select data-role="metric-formula" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
            <option value="SUM" ${(metric.formula || 'SUM') === 'SUM' ? 'selected' : ''}>SUM（求和）</option>
            <option value="AVG" ${metric.formula === 'AVG' ? 'selected' : ''}>AVG（平均分）</option>
            <option value="COUNT_IF" ${metric.formula === 'COUNT_IF' ? 'selected' : ''}>COUNT_IF（条件计数）</option>
            <option value="DERIVED" ${metric.formula === 'DERIVED' ? 'selected' : ''}>DERIVED（派生指标）</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;">
        <div>
          <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">题号（如 ALL 或 1,3,5-8）</label>
          <input type="text" value="${metric.items === 'ALL' ? 'ALL' : Array.isArray(metric.items) ? metric.items.join(',') : metric.items || ''}" data-role="metric-items" placeholder="ALL" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">条件（COUNT_IF）</label>
          <input type="text" value="${
            metric.condition
              ? Object.entries(metric.condition)
                  .map(([k, v]) => k + v)
                  .join(', ')
              : ''
          }" data-role="metric-condition" placeholder="如 >=2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">满分（留空自动推导）</label>
          <input type="number" value="${metric.maxScore !== undefined ? metric.maxScore : ''}" data-role="metric-maxscore" placeholder="自动" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
        </div>
      </div>
      <div style="margin-top:8px;">
        <label style="font-size:12px;color:var(--text-sec);display:block;margin-bottom:4px;">派生表达式（DERIVED 用，如 (总分-阴性项目数)/阳性项目数）</label>
        <input type="text" value="${metric.expression || ''}" data-role="metric-expression" placeholder="如 (total_score-negative_count)/positive_count" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:'SF Mono','Fira Code',monospace;">
      </div>
      <div style="margin-top:10px;display:flex;align-items:center;gap:10px;">
        <label style="font-size:12px;color:var(--text-sec);">公式转换：</label>
        <select data-role="metric-transform-type" onchange="this.nextElementSibling.disabled=this.value==='none'" style="padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
          <option value="none" ${!metric.transform ? 'selected' : ''}>无</option>
          <option value="linear" ${metric.transform && metric.transform.type === 'linear' ? 'selected' : ''}>线性公式（如 1.25*x）</option>
        </select>
        <input type="text" value="${metric.transform ? metric.transform.expression : ''}" data-role="metric-transform-expr" placeholder="如 1.25*x" style="flex:1;padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px;" ${!metric.transform ? 'disabled' : ''}>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

// ========== 解释规则 CRUD ==========
function addInterpRule() {
  const scale = getSelectedScale();
  const sc = scale ? scale.scoring || {} : {};
  const metrics = sc.metrics || [];
  const dims = sc.dimensions || [];
  renderInterpRule(
    { min: '', max: '', level: 'normal', label: '', color: '#7ED321', text: '' },
    undefined,
    metrics,
    dims
  );
}

function renderInterpRule(rule, index, metrics, dimensions) {
  metrics = metrics || [];
  dimensions = dimensions || [];
  const container = document.getElementById('sc-interp-list');

  // 构建指标/维度选项
  const metricOptions = metrics
    .map(
      (m) =>
        `<option value="${escHtml(m.key)}" ${rule.metric === m.key ? 'selected' : ''}>${escHtml(m.label || m.key)}</option>`
    )
    .join('');
  const dimOptions = dimensions
    .map(
      (d) =>
        `<option value="${escHtml(d.key)}" ${rule.metric === d.key ? 'selected' : ''}>${escHtml(d.label || d.key)}</option>`
    )
    .join('');

  const html = `
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap;" class="sc-interp-row">
      <select data-role="interp-metric" style="padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;min-width:100px;">
        <option value="" ${!rule.metric ? 'selected' : ''}>-- 总分 --</option>
        ${metricOptions}
        <optgroup label="维度">
          ${dimOptions}
        </optgroup>
      </select>
      <input type="number" value="${rule.min !== undefined && rule.min !== '' ? rule.min : ''}" data-role="interp-min" placeholder="最低分" style="width:80px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      <span style="color:var(--text-muted);">~</span>
      <input type="number" value="${rule.max !== undefined && rule.max !== '' ? rule.max : ''}" data-role="interp-max" placeholder="最高分" style="width:80px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      <select data-role="interp-level" style="padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
        <option value="normal" ${rule.level === 'normal' ? 'selected' : ''}>正常</option>
        <option value="mild" ${rule.level === 'mild' ? 'selected' : ''}>轻度</option>
        <option value="moderate" ${rule.level === 'moderate' ? 'selected' : ''}>中度</option>
        <option value="severe" ${rule.level === 'severe' ? 'selected' : ''}>中重度</option>
      </select>
      <input type="text" value="${escHtml(rule.label || '')}" data-role="interp-label" placeholder="标签" style="width:80px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      <input type="color" value="${rule.color || '#7ED321'}" data-role="interp-color" style="width:36px;height:34px;border:1px solid var(--border);border-radius:6px;cursor:pointer;">
      <input type="text" value="${escHtml(rule.text || '')}" data-role="interp-text" placeholder="解释文本" style="flex:1;min-width:120px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      <button data-action="remove-parent" style="padding:6px 10px;background:var(--danger);color:#fff;border:none;border-radius:6px;cursor:pointer;">✕</button>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

// ========== 筛查规则 ==========
function renderScreening(screening, metrics, dimensions) {
  const area = document.getElementById('sc-screening-area');
  const conditions = (screening && screening.conditions) || [];
  // 下拉框同时包含维度和指标，方便筛查条件引用维度 key
  const dimOpts = (dimensions || []).map((d) => ({ key: d.key, label: (d.label || d.key) + '（维度）' }));
  const metOpts = (metrics || []).map((m) => ({ key: m.key, label: (m.label || m.key) + '（指标）' }));
  const allOpts = dimOpts.concat(metOpts);

  const condHtml = conditions
    .map(
      (c, i) => `
    <div class="sc-screen-cond" style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
      <select data-role="scr-metric" style="padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
        ${allOpts.map((o) => `<option value="${o.key}" ${c.metric === o.key ? 'selected' : ''}>${escHtml(o.label)}</option>`).join('')}
        <option value="" ${!c.metric ? 'selected' : ''}>-- 选择指标 --</option>
      </select>
      <select data-role="scr-op" style="padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
        ${['>', '>=', '<', '<=', '=='].map((op) => `<option value="${op}" ${c.op === op ? 'selected' : ''}>${op}</option>`).join('')}
      </select>
      <input type="number" value="${c.value || ''}" data-role="scr-value" placeholder="阈值" style="width:80px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      <input type="text" value="${escHtml(c.label || '')}" data-role="scr-label" placeholder="标签说明" style="width:100px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      <button data-action="remove-parent" style="padding:6px 10px;background:var(--danger);color:#fff;border:none;border-radius:6px;cursor:pointer;">✕</button>
    </div>
  `
    )
    .join('');

  area.innerHTML = `
    <div style="margin-bottom:12px;">
      <label style="font-size:12px;color:var(--text-sec);margin-right:12px;">判定逻辑：</label>
      <label style="font-size:13px;cursor:pointer;"><input type="radio" name="scr-logic" value="OR" ${(screening && screening.logic) !== 'AND' ? 'checked' : ''}> OR（任一条件满足）</label>
      <label style="font-size:13px;cursor:pointer;margin-left:12px;"><input type="radio" name="scr-logic" value="AND" ${screening && screening.logic === 'AND' ? 'checked' : ''}> AND（全部条件满足）</label>
    </div>
    <div id="sc-screen-conds">${condHtml || '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px;">暂无条件，请先配置指标</div>'}</div>
    <button data-action="sc-add-screen-cond" style="margin-top:8px;padding:6px 14px;background:var(--bg-gray);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px;">➕ 添加条件</button>
  `;
}

function addScreenCond() {
  const scale = getSelectedScale();
  const sc = scale ? scale.scoring || {} : {};
  const dims = sc.dimensions || [];
  const metrics = sc.metrics || [];
  // 下拉框同时包含维度和指标
  const dimOptions = dims.map((d) => `<option value="${d.key}">${escHtml(d.label || d.key)}（维度）</option>`).join('');
  const metOptions = metrics
    .map((m) => `<option value="${m.key}">${escHtml(m.label || m.key)}（指标）</option>`)
    .join('');
  const metricOptions = dimOptions + metOptions;
  const container = document.getElementById('sc-screen-conds');
  // 清除空提示
  if (container.querySelector('div[style*="text-align:center"]')) {
    container.innerHTML = '';
  }
  const html = `
    <div class="sc-screen-cond" style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
      <select data-role="scr-metric" style="padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">${metricOptions}<option value="" selected>-- 选择指标 --</option></select>
      <select data-role="scr-op" style="padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
        ${['>', '>=', '<', '<=', '=='].map((op) => `<option value="${op}">${op}</option>`).join('')}
      </select>
      <input type="number" data-role="scr-value" placeholder="阈值" style="width:80px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      <input type="text" data-role="scr-label" placeholder="标签说明" style="width:100px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      <button data-action="remove-parent" style="padding:6px 10px;background:var(--danger);color:#fff;border:none;border-radius:6px;cursor:pointer;">✕</button>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

// ========== 模拟测试 ==========
function runScoringTest() {
  const scale = getSelectedScale();
  if (!scale) {
    return;
  }

  // 临时收集当前表单数据
  const tempScoring = collectScoringData();
  const scaleWithScoring = { ...scale, scoring: tempScoring };

  // 生成模拟答案（全部选第一个选项）
  const answers = {};
  scale.questions.forEach((q) => {
    answers[q.id] = 0;
  });

  const result = ScoringEngine.calculate(scaleWithScoring, answers);

  const area = document.getElementById('sc-test-area');
  area.innerHTML = `
    <div style="padding:16px;background:#F0F8FF;border:1px solid var(--primary);border-radius:8px;margin-bottom:12px;">
      <div style="font-size:13px;font-weight:500;color:var(--primary);margin-bottom:8px;">🧪 模拟结果（全部选择第一个选项）</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
        ${Object.entries(result.metrics)
          .map(
            ([k, v]) => `
          <div style="background:#fff;padding:10px;border-radius:6px;border:1px solid var(--border);">
            <div style="font-size:11px;color:var(--text-muted);">${k}</div>
            <div style="font-size:20px;font-weight:600;color:var(--text);">${v}</div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
    ${
      result.interpretation
        ? `
    <div style="padding:12px;background:${result.interpretation.color}15;border:1px solid ${result.interpretation.color}40;border-radius:8px;">
      <div style="font-size:13px;font-weight:500;color:${result.interpretation.color};">${result.interpretation.label || result.interpretation.level}</div>
      <div style="font-size:12px;color:var(--text-sec);margin-top:4px;">${result.interpretation.text || ''}</div>
    </div>`
        : ''
    }
    ${
      result.dimensions.length > 0
        ? `
    <div style="margin-top:12px;">
      <div style="font-size:13px;font-weight:500;margin-bottom:8px;">维度得分：</div>
      <div style="display:grid;gap:8px;">
        ${result.dimensions
          .map(
            (d) => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg);border-radius:6px;">
            <span style="font-size:13px;font-weight:500;min-width:80px;">${escHtml(d.label)}</span>
            <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${Math.min(100, (d.score / 5) * 100)}%;background:${(d.interpretation && d.interpretation.color) || 'var(--primary)'};border-radius:4px;"></div>
            </div>
            <span style="font-size:13px;font-weight:600;min-width:50px;text-align:right;">${d.score}</span>
            ${d.interpretation ? `<span style="font-size:11px;color:${d.interpretation.color};background:${d.interpretation.color}15;padding:2px 8px;border-radius:10px;">${d.interpretation.label || d.interpretation.level}</span>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    </div>`
        : ''
    }
    ${
      result.screening && result.screening.result !== 'none'
        ? `
    <div style="margin-top:12px;padding:12px;background:${result.screening.result === (scaleWithScoring.scoring.screening || {}).positiveLabel ? '#FFF2F0' : '#F0FFF0'};border:1px solid ${result.screening.result === (scaleWithScoring.scoring.screening || {}).positiveLabel ? '#FFB3B3' : '#B3FFB3'};border-radius:8px;font-size:13px;">
      🔍 筛查结果：<strong>${result.screening.result}</strong>
      ${result.screening.triggeredRules.length > 0 ? `（触发：${result.screening.triggeredRules.map((r) => r.metric + r.op + r.value).join(', ')}）` : ''}
    </div>`
        : ''
    }
    <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">
      💡 提示：模拟使用全部选择第一个选项的答案。保存规则后，可在前端进行完整测评测试。
    </div>
  `;
}

// ========== 数据收集与保存 ==========
function collectScoringData() {
  const data = { dimensions: [], metrics: [], interpretation: [], screening: null };

  // 收集维度
  document.querySelectorAll('.sc-dim-card').forEach((card) => {
    const key = card.querySelector('[data-role="dim-key"]').value.trim();
    const label = card.querySelector('[data-role="dim-label"]').value.trim();
    if (!label) {
      return;
    }
    const items = card.querySelector('[data-role="dim-items"]').value.trim();
    const formula = card.querySelector('[data-role="dim-formula"]').value;
    const condStr = card.querySelector('[data-role="dim-condition"]').value.trim();
    const condition = parseConditionStr(condStr);
    const dimMaxScoreEl = card.querySelector('[data-role="dim-maxscore"]');
    const dimMaxScore =
      dimMaxScoreEl && dimMaxScoreEl.value.trim() !== '' ? parseFloat(dimMaxScoreEl.value) : undefined;

    const interpretations = [];
    card.querySelectorAll('[data-role="dim-interps"] > div').forEach((row) => {
      const minInput = row.querySelector('[data-role="interp-min"]');
      const minVal = minInput ? parseFloat(minInput.value) : NaN;
      const max = parseFloat(row.querySelector('[data-role="interp-max"]').value);
      const level = row.querySelector('[data-role="interp-level"]').value;
      const lbl = row.querySelector('[data-role="interp-label"]').value.trim();
      const color = row.querySelector('[data-role="interp-color"]').value;
      const text = row.querySelector('[data-role="interp-text"]').value.trim();
      if (!isNaN(max) || !isNaN(minVal)) {
        interpretations.push({
          min: isNaN(minVal) ? undefined : minVal,
          max: isNaN(max) ? undefined : max,
          level,
          label: lbl,
          color,
          text
        });
      }
    });

    data.dimensions.push({
      key,
      label,
      formula,
      items,
      condition,
      interpretation: interpretations,
      maxScore: dimMaxScore
    });
  });

  // 收集指标
  document.querySelectorAll('#sc-metrics-list > div').forEach((card) => {
    const key = card.querySelector('[data-role="metric-key"]').value.trim();
    const label = card.querySelector('[data-role="metric-label"]').value.trim();
    if (!key) {
      return;
    }
    const formula = card.querySelector('[data-role="metric-formula"]').value;
    const items = card.querySelector('[data-role="metric-items"]').value.trim() || 'ALL';
    const condStr = card.querySelector('[data-role="metric-condition"]').value.trim();
    const condition = parseConditionStr(condStr);
    const transformType = card.querySelector('[data-role="metric-transform-type"]').value;
    const transformExpr = card.querySelector('[data-role="metric-transform-expr"]').value.trim();
    const transform =
      transformType === 'linear' && transformExpr ? { type: 'linear', expression: transformExpr } : null;
    // DERIVED 派生表达式
    const exprEl = card.querySelector('[data-role="metric-expression"]');
    const expression = exprEl ? exprEl.value.trim() : '';
    const metricMaxScoreEl = card.querySelector('[data-role="metric-maxscore"]');
    const metricMaxScore =
      metricMaxScoreEl && metricMaxScoreEl.value.trim() !== '' ? parseFloat(metricMaxScoreEl.value) : undefined;
    const entry = { key, label, formula, items, condition, transform };
    if (formula === 'DERIVED' && expression) {
      entry.expression = expression;
    }
    if (metricMaxScore !== undefined && !isNaN(metricMaxScore)) {
      entry.maxScore = metricMaxScore;
    }
    data.metrics.push(entry);
  });

  // 收集解释规则
  document.querySelectorAll('.sc-interp-row').forEach((row) => {
    const min = row.querySelector('[data-role="interp-min"]').value.trim();
    const max = row.querySelector('[data-role="interp-max"]').value.trim();
    if (min === '' && max === '') {
      return;
    }
    const metricEl = row.querySelector('[data-role="interp-metric"]');
    const metric = metricEl ? metricEl.value.trim() : '';
    data.interpretation.push({
      metric: metric || undefined,
      min: min !== '' ? parseFloat(min) : undefined,
      max: max !== '' ? parseFloat(max) : undefined,
      level: row.querySelector('[data-role="interp-level"]').value,
      label: row.querySelector('[data-role="interp-label"]').value.trim(),
      color: row.querySelector('[data-role="interp-color"]').value,
      text: row.querySelector('[data-role="interp-text"]').value.trim()
    });
  });

  // 收集筛查规则
  const scrConds = [];
  document.querySelectorAll('.sc-screen-cond').forEach((row) => {
    const metric = row.querySelector('[data-role="scr-metric"]').value;
    const op = row.querySelector('[data-role="scr-op"]').value;
    const value = parseFloat(row.querySelector('[data-role="scr-value"]').value);
    const labelEl = row.querySelector('[data-role="scr-label"]');
    const label = labelEl ? labelEl.value.trim() : '';
    if (metric && !isNaN(value)) {
      scrConds.push({ metric, op, value, label });
    }
  });
  if (scrConds.length > 0) {
    const logic = document.querySelector('input[name="scr-logic"]:checked');
    data.screening = {
      logic: logic ? logic.value : 'OR',
      conditions: scrConds,
      positiveLabel: '筛查阳性',
      negativeLabel: '筛查阴性'
    };
  }

  return data;
}

function parseConditionStr(str) {
  if (!str) {
    return null;
  }
  const cond = {};
  str.split(',').forEach((part) => {
    part = part.trim();
    const match = part.match(/^(>=|<=|>|<|==|!=)(.+)$/);
    if (match) {
      cond[match[1]] = parseFloat(match[2]);
    }
  });
  return Object.keys(cond).length > 0 ? cond : null;
}

function saveScoring() {
  const scale = getSelectedScale();
  if (!scale) {
    return;
  }
  const data = collectScoringData();
  scale.scoring = data;
  // 保存到 localStorage
  const idx = scales.findIndex((s) => s.id === scale.id);
  if (idx >= 0) {
    scales[idx] = scale;
  }
  SharedData.saveScalesData(scales);
  SharedData.syncToFrontend();
  showToast('计分规则已保存！', 'success');
  // 刷新量表选择下拉（显示 ✅已配置 标记）
  const select = document.getElementById('sc-scale-select');
  const option = select.querySelector(`option[value="${scale.id}"]`);
  if (option) {
    option.textContent = `${scale.name}（${(scale.questions || []).length}题） ✅已配置`;
  }
  // 刷新计分规则Tab列表
  renderScoringRulesTable();
}

function resetScoring() {
  const scaleId = _currentScoringScaleId;
  if (!scaleId) {
    return;
  }
  if (!confirm('确定要重置该量表的计分规则吗？')) {
    return;
  }
  const scale = scales.find((s) => s.id === scaleId);
  if (!scale) {
    return;
  }
  scale.scoring = null;
  const idx = scales.findIndex((s) => s.id === scale.id);
  if (idx >= 0) {
    scales[idx] = scale;
  }
  SharedData.saveScalesData(scales);
  SharedData.syncToFrontend();
  loadScoringFormInline(scaleId);
  showToast('计分规则已重置', 'success');
  renderScoringScaleList();
}
