function toggleDragSortMode() {
  isDragSortMode = !isDragSortMode;
  const btn = document.getElementById('btn-drag-sort');
  if (isDragSortMode) {
    btn.className = 'btn btn-primary';
    btn.innerHTML = '<span>✅</span> 完成排序';
    // 清除筛选条件，显示全部量表方便排序
    document.getElementById('scale-search').value = '';
    scaleFilterKeyword = '';
    scaleFilterCat = '';
    scaleFilterStatus = '';
    scaleNpcFilter = '';
    showToast('拖拽排序模式已开启，拖动量表行调整顺序', 'success');
  } else {
    btn.className = 'btn btn-default';
    btn.innerHTML = '<span>↕️</span> 拖拽排序';
    showToast('排序已保存，前端将按新顺序显示', 'success');
  }
  renderScaleTable();
}

// 拖拽排序事件处理
function onDragStart(e) {
  _dragSrcId = parseInt(e.currentTarget.getAttribute('data-scale-id'));
  e.currentTarget.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _dragSrcId);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const tr = e.currentTarget;
  if (tr !== e.target.closest('tr')) {
    return;
  }
}

function onDragEnter(e) {
  e.preventDefault();
  const tr = e.currentTarget;
  tr.style.background = '#e8f4fd';
}

function onDragLeave(e) {
  const tr = e.currentTarget;
  tr.style.background = '';
}

function onDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const tr = e.currentTarget;
  tr.style.background = '';

  const targetId = parseInt(tr.getAttribute('data-scale-id'));
  if (_dragSrcId === null || _dragSrcId === targetId) {
    return;
  }

  // 找到源和目标在 scales 数组中的索引
  const srcIdx = scales.findIndex((s) => s.id === _dragSrcId);
  const targetIdx = scales.findIndex((s) => s.id === targetId);
  if (srcIdx < 0 || targetIdx < 0) {
    return;
  }

  // 从数组中移除源，插入到目标位置
  const [moved] = scales.splice(srcIdx, 1);
  scales.splice(targetIdx, 0, moved);

  // 重新计算所有量表的 sortOrder（按当前数组顺序）
  scales.forEach((s, i) => {
    s.sortOrder = i;
  });

  // 保存并重新渲染
  saveScales(scales);
  syncToFrontend();
  renderScaleTable();
  showToast('排序已更新', 'success');
}

function onDragEnd(e) {
  _dragSrcId = null;
  // 清除所有行的样式
  document.querySelectorAll('#scale-table-body tr').forEach((tr) => {
    tr.style.opacity = '';
    tr.style.background = '';
  });
}

function filterScaleTable() {
  scaleFilterKeyword = document.getElementById('scale-search').value.toLowerCase();
  renderScaleTable();
}

function renderScaleTable() {
  let filtered = scales.filter((s) => {
    const kw =
      !scaleFilterKeyword ||
      s.name.toLowerCase().includes(scaleFilterKeyword) ||
      (s.code || '').toLowerCase().includes(scaleFilterKeyword);
    const cat = !scaleFilterCat || s.category === scaleFilterCat;
    const stat = scaleFilterStatus === '' || String(s.status) === scaleFilterStatus;
    const npcOk = s.npcConfig && s.npcConfig.counselorId && s.npcConfig.backgroundId;
    const npc = !scaleNpcFilter || (scaleNpcFilter === 'yes' ? npcOk : !npcOk);
    return kw && cat && stat && npc;
  });

  // 拖拽排序模式下，按 sortOrder 升序排列
  if (isDragSortMode) {
    filtered = filtered.slice().sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }
  // 列头排序
  else if (scaleSortField) {
    filtered = filtered.slice().sort(function (a, b) {
      let va = a[scaleSortField],
        vb = b[scaleSortField];
      if (scaleSortField === 'updatedAt') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      }
      if (scaleSortField === 'rating') {
        va = parseFloat(va) || 0;
        vb = parseFloat(vb) || 0;
      }
      if (va === vb) {
        return 0;
      }
      const cmp = va > vb ? 1 : -1;
      return scaleSortOrder === 'desc' ? -cmp : cmp;
    });
  }

  const tbody = document.getElementById('scale-table-body');
  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无量表数据</div><div class="empty-sub">点击「新建量表」创建第一个量表</div></div></td></tr>';
    document.getElementById('scale-pagination').textContent = '';
    return;
  }

  tbody.innerHTML = filtered
    .map((s, idx) => {
      const cat = CAT_MAP[s.category] || { name: s.category || '其他', color: '#999' };
      const statusMap = {
        1: ['已上架', 'badge-success'],
        0: ['已下架', 'badge-default'],
        2: ['草稿', 'badge-warning']
      };
      const [statusText, statusClass] = statusMap[s.status] || ['未知', 'badge-default'];

      // NPC 配置状态
      const npcOk = s.npcConfig && s.npcConfig.counselorId && s.npcConfig.backgroundId;
      const npcStatus = npcOk
        ? '<span style="color:var(--success);">✅ 已配置</span>'
        : '<span style="color:var(--danger);">❌ 未配置</span>';

      const dragAttrs = isDragSortMode
        ? 'draggable="true" data-scale-id="' +
          s.id +
          '" ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondragenter="onDragEnter(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)"'
        : '';

      return (
        '<tr ' +
        dragAttrs +
        ' style="' +
        (isDragSortMode ? 'cursor:grab;' : '') +
        '">' +
        '<td>' +
        '<div class="scale-cell">' +
        (isDragSortMode
          ? '<span class="drag-sort-handle" style="cursor:grab;margin-right:6px;font-size:14px;color:#999;user-select:none">⠿</span>'
          : '') +
        (isDragSortMode
          ? '<span class="drag-sort-index" style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:6px;background:#f0f0f0;font-size:11px;font-weight:600;color:#666;margin-right:6px">' +
            (idx + 1) +
            '</span>'
          : '') +
        '<div class="scale-avatar" style="background:' +
        (s.color || '#ccc') +
        '18">' +
        (s.emoji || '📋') +
        '</div>' +
        '<div style="min-width:0">' +
        '<div class="scale-cell-name">' +
        s.name +
        ' <span class="cat-tag" style="background:' +
        cat.color +
        '15;color:' +
        cat.color +
        ';font-size:10px;padding:1px 6px;border-radius:3px;margin-left:6px;">' +
        cat.name +
        '</span>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</td>' +
        '<td>' +
        (s.questionCount || 0) +
        '</td>' +
        '<td>' +
        (s.duration ? s.duration + '分钟' : '-') +
        '</td>' +
        '<td>' +
        (s.completedCount || 0).toLocaleString() +
        '</td>' +
        '<td>⭐ ' +
        parseFloat(s.rating || 0).toFixed(1) +
        '</td>' +
        '<td style="font-size:12px;color:var(--text-muted);white-space:nowrap">' +
        (s.updatedAt ? formatTime(s.updatedAt) : '-') +
        '</td>' +
        '<td><span class="badge ' +
        statusClass +
        '">' +
        statusText +
        '</span></td>' +
        '<td style="font-size:12px;">' +
        npcStatus +
        '</td>' +
        '<td>' +
        '<div class="dropdown-wrap" id="dw-' +
        s.id +
        '">' +
        '<button class="dropdown-trigger" onclick="toggleDropdown(event, ' +
        s.id +
        ')">⋯</button>' +
        '<div class="dropdown-menu" id="dm-' +
        s.id +
        '">' +
        '<div class="dropdown-item" onclick="openEditModal(' +
        s.id +
        ')">✏️ 编辑量表</div>' +
        (s.status === 1
          ? '<div class="dropdown-item" onclick="toggleStatus(' + s.id + ')">📥 下架</div>'
          : '<div class="dropdown-item" style="color:var(--success);font-weight:500;" onclick="toggleStatus(' +
            s.id +
            ')">📤 上架</div>') +
        '<div class="dropdown-item" onclick="exportSingleScale(' +
        s.id +
        ')">📤 导出</div>' +
        '<div class="dropdown-divider"></div>' +
        (function () {
          const sc = s.scoring || {};
          const dims = sc.dimensions || [],
            mets = sc.metrics || [];
          const hasSc = dims.length > 0 || mets.length > 0;
          if (hasSc) {
            return (
              '<div class="dropdown-item" onclick="openScoringForScale(' +
              s.id +
              ')">👁 查看计分规则</div>' +
              '<div class="dropdown-item" onclick="openAiOneClickModal(' +
              s.id +
              ')">🤖 AI 重新配置</div>' +
              '<div class="dropdown-divider"></div>'
            );
          } else {
            return (
              '<div class="dropdown-item" style="color:var(--primary);font-weight:500;" onclick="openAiOneClickModal(' +
              s.id +
              ')">🤖 AI 一键配置</div>' +
              '<div class="dropdown-item" onclick="openScoringForScale(' +
              s.id +
              ')">✋ 手动配置</div>' +
              '<div class="dropdown-divider"></div>'
            );
          }
        })() +
        '<div class="dropdown-item danger" onclick="confirmDelete(' +
        s.id +
        ')">🗑️ 删除量表</div>' +
        '</div>' +
        '</div>' +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  document.getElementById('scale-pagination').innerHTML =
    '共 <strong>' + filtered.length + '</strong> 条记录 / 全部 <strong>' + scales.length + '</strong> 个量表';
}

// ====================================================
// ====================================================
// 操作下拉菜单
// ====================================================
let _openDropdownId = null;

function toggleDropdown(event, scaleId) {
  event.stopPropagation();
  const menu = document.getElementById('dm-' + scaleId);
  if (!menu) {
    return;
  }
  if (menu.classList.contains('open')) {
    menu.classList.remove('open');
    _openDropdownId = null;
  } else {
    // 先关闭其他打开的下拉菜单
    closeAllDropdowns();
    menu.classList.add('open');
    _openDropdownId = scaleId;
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu.open').forEach(function (m) {
    m.classList.remove('open');
  });
  _openDropdownId = null;
}

// 点击页面空白处关闭下拉菜单
document.addEventListener('click', function (e) {
  if (!e.target.closest('.dropdown-wrap')) {
    closeAllDropdowns();
  }
});

// ====================================================
// 计分规则列表
// ====================================================
let scoringFilterKeyword = '';
let scoringFilterCat = '';
let scoringFilterStatus = '';

function filterScoringRulesTable() {
  scoringFilterKeyword = (document.getElementById('scoring-search')?.value || '').toLowerCase();
  scoringFilterCat = document.getElementById('scoring-cat-filter')?.value || '';
  scoringFilterStatus = document.getElementById('scoring-status-filter')?.value || '';
  renderScoringRulesTable();
}

function renderScoringRulesTable() {
  const filtered = scales.filter((s) => {
    const kw =
      !scoringFilterKeyword ||
      s.name.toLowerCase().includes(scoringFilterKeyword) ||
      (s.code || '').toLowerCase().includes(scoringFilterKeyword);
    const cat = !scoringFilterCat || s.category === scoringFilterCat;
    const hasScoring = s.scoring && ((s.scoring.dimensions || []).length > 0 || (s.scoring.metrics || []).length > 0);
    const configured =
      scoringFilterStatus === '' ||
      (scoringFilterStatus === 'configured' && hasScoring) ||
      (scoringFilterStatus === 'unconfigured' && !hasScoring);
    return kw && cat && configured;
  });

  const tbody = document.getElementById('scoring-table-body');
  if (!tbody) {
    return;
  }

  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🧮</div><div class="empty-text">暂无匹配的量表</div><div class="empty-sub">调整筛选条件或为量表配置计分规则</div></div></td></tr>';
    const pag = document.getElementById('scoring-pagination');
    if (pag) {
      pag.textContent = '';
    }
    return;
  }

  tbody.innerHTML = filtered
    .map((s) => {
      const cat = CAT_MAP[s.category] || { name: s.category || '未分类', color: '#999' };
      const sc = s.scoring || {};
      const dims = sc.dimensions || [];
      const metrics = sc.metrics || [];
      const interp = sc.interpretation || [];
      const screening = sc.screening;
      const hasScoring = dims.length > 0 || metrics.length > 0;
      const questions = s.questions || [];

      return `<tr>
      <td>
        <div class="scale-cell">
          <div class="scale-avatar" style="background:${s.color || '#4A90D9'}18">${s.emoji || '📋'}</div>
          <div>
            <div class="scale-cell-name">${escHtml(s.name)}</div>
            <div class="scale-cell-code">${escHtml(s.code || '')} · ${questions.length}题</div>
          </div>
        </div>
      </td>
      <td><span class="cat-tag" style="background:${cat.color}15;color:${cat.color}">${escHtml(cat.name)}</span></td>
      <td>${
        hasScoring
          ? '<span class="badge badge-success">✅ 已配置</span>'
          : '<span class="badge badge-warning">⚠️ 未配置</span>'
      }</td>
      <td>${dims.length > 0 ? dims.length : '-'}</td>
      <td>${metrics.length > 0 ? metrics.length : '-'}</td>
      <td>${interp.length > 0 ? interp.length : '-'}</td>
      <td>${
        screening && (screening.conditions || []).length > 0
          ? '<span class="badge badge-success">已设置</span>'
          : '<span style="color:var(--text-muted)">-</span>'
      }</td>
      <td style="font-size:12px;color:var(--text-muted);white-space:nowrap">${s.updatedAt ? formatTime(s.updatedAt) : '-'}</td>
      <td>
        <div class="dropdown-wrap" id="dw-sc-${s.id}">
          <button class="dropdown-trigger" onclick="toggleDropdown(event, 'sc-${s.id}')">⋯</button>
          <div class="dropdown-menu" id="dm-sc-${s.id}">${
            hasScoring
              ? '<div class="dropdown-item" onclick="openScoringForScale(' +
                s.id +
                ')">👁 查看/编辑</div>' +
                '<div class="dropdown-item" onclick="openAiOneClickModal(' +
                s.id +
                ')">🤖 AI 重新配置</div>' +
                '<div class="dropdown-divider"></div>' +
                '<div class="dropdown-item danger" onclick="resetScoringForScale(' +
                s.id +
                ')">🗑️ 重置计分规则</div>'
              : '<div class="dropdown-item" style="color:var(--primary);font-weight:500;" onclick="openAiOneClickModal(' +
                s.id +
                ')">🤖 AI 一键配置</div>' +
                '<div class="dropdown-item" onclick="openScoringForScale(' +
                s.id +
                ')">✋ 手动配置</div>'
          }</div>
        </div>
      </td>
    </tr>`;
    })
    .join('');

  const configuredCount = scales.filter(
    (s) => s.scoring && ((s.scoring.dimensions || []).length > 0 || (s.scoring.metrics || []).length > 0)
  ).length;
  const pag = document.getElementById('scoring-pagination');
  if (pag) {
    pag.innerHTML = `共 <strong>${filtered.length}</strong> 条 / 已配置 <strong>${configuredCount}</strong> / 全部 <strong>${scales.length}</strong> 个量表`;
  }
}

// 同步计分规则Tab的分类筛选下拉（复用 CAT_MAP + SCALE_TYPES）
function refreshScoringCatFilter() {
  const select = document.getElementById('scoring-cat-filter');
  if (!select) {
    return;
  }
  const builtIn = Object.entries(CAT_MAP).map(([key, val]) => ({ value: key, label: val.name }));
  const custom = (SCALE_TYPES || []).filter((t) => t.id && !CAT_MAP[t.id]).map((t) => ({ value: t.id, label: t.name }));
  const allOptions = [...builtIn, ...custom];
  const current = select.value;
  select.innerHTML =
    '<option value="">全部分类</option>' +
    allOptions
      .map((o) => `<option value="${o.value}"${o.value === current ? ' selected' : ''}>${escHtml(o.label)}</option>`)
      .join('');
}

// 打开指定量表的计分规则配置弹窗
function openScoringForScale(scaleId) {
  manageScoringRules();
  setTimeout(() => {
    const sel = document.getElementById('sc-scale-select');
    if (sel) {
      sel.value = scaleId;
      loadScoringForm();
    }
  }, 100);
}

// 重置指定量表的计分规则
function resetScoringForScale(scaleId) {
  const scale = scales.find((s) => s.id === scaleId);
  if (!scale) {
    return;
  }
  if (!confirm(`确定要重置「${scale.name}」的计分规则吗？`)) {
    return;
  }
  scale.scoring = null;
  const idx = scales.findIndex((s) => s.id === scaleId);
  if (idx >= 0) {
    scales[idx] = scale;
  }
  SharedData.saveScalesData(scales);
  SharedData.syncToFrontend();
  renderScoringRulesTable();
  showToast('计分规则已重置', 'success');
}
