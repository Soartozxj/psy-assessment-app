function openQuestionManagement() {
  alert('题库管理功能将在后续版本中实现');
}

function importQuestions() {
  alert('题目批量导入功能将在后续版本中实现');
}

function switchTab(tabId) {
  // 切换Tab标题
  document.querySelectorAll('.tab-item').forEach((tab) => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content-section').forEach((content) => content.classList.remove('active'));

  const tabElement = document.querySelector(`.tab-item[onclick="switchTab('${tabId}')"]`);
  if (tabElement) {
    tabElement.classList.add('active');
  }

  const contentElement = document.getElementById(`tab-${tabId}`);
  if (contentElement) {
    contentElement.classList.add('active');
  }

  currentTab = tabId;

  // 根据当前Tab执行相应操作
  if (tabId === 'scale-types') {
    renderScaleTypes();
  }
  if (tabId === 'ai-diag') {
    renderAiDiagScaleList();
  }
  if (tabId === 'scale-rules') {
    refreshScoringCatFilter();
    renderScoringRulesTable();
  }
}

function renderAll() {
  renderDashboard();
  renderScaleTable();
  renderUserTable();
  renderRecordTable();
  updateStats();
  // 如果当前显示的是量表管理页面，则渲染量表类型
  if (currentSection === 'scales') {
    renderScaleTypes();
  }
}

function updateStats() {
  if (typeof window.SharedData !== 'undefined') {
    const stats = window.SharedData.getStatistics();
    document.getElementById('stat-total').textContent = stats.totalScales;
    document.getElementById('stat-active').textContent = stats.activeScales;
    document.getElementById('stat-users').textContent = stats.totalCompleted.toLocaleString();
    document.getElementById('stat-rating').textContent = stats.avgRating;
  } else {
    const active = scales.filter((s) => s.status === 1).length;
    const total = scales.length;
    const totalCompleted = scales.reduce((sum, s) => sum + (s.completedCount || 0), 0);
    const avgRating = scales.length
      ? (scales.reduce((sum, s) => sum + (parseFloat(s.rating) || 0), 0) / scales.length).toFixed(1)
      : '0.0';
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-users').textContent = totalCompleted.toLocaleString();
    document.getElementById('stat-rating').textContent = avgRating;
  }
}

function renderDashboard() {
  // 获取数据
  const displayScales = typeof window.SharedData !== 'undefined' ? window.SharedData.getActiveScales() : scales;

  // 柱状图
  const sorted = [...displayScales].sort((a, b) => (b.completedCount || 0) - (a.completedCount || 0));
  const maxVal = sorted[0] ? sorted[0].completedCount || 1 : 1;
  if (document.getElementById('bar-chart')) {
    document.getElementById('bar-chart').innerHTML = sorted
      .map(
        (s) => `
      <div class="bar-row">
        <div class="bar-name" title="${s.name}">${s.shortName || s.name.split(' ')[0]}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.round(((s.completedCount || 0) / maxVal) * 100)}%;background:${s.color}"></div>
        </div>
        <div class="bar-val">${((s.completedCount || 0) / 1000).toFixed(1)}k</div>
      </div>`
      )
      .join('');
  }

  // 饼图
  const catCounts = {};
  displayScales.forEach((s) => {
    catCounts[s.category] = (catCounts[s.category] || 0) + 1;
  });
  const cats = Object.entries(catCounts);
  const total = cats.reduce((sum, [, v]) => sum + v, 0);
  let startAngle = 0;
  const paths = cats.map(([cat, count]) => {
    const color = CAT_MAP[cat] ? CAT_MAP[cat].color : '#ccc';
    const pct = count / total;
    const angle = pct * 360;
    const path = describeArc(60, 60, 46, startAngle, startAngle + angle);
    startAngle += angle;
    return `<path d="${path}" fill="${color}" />`;
  });

  if (document.getElementById('pie-chart')) {
    document.getElementById('pie-chart').innerHTML =
      paths.join('') +
      '<circle cx="60" cy="60" r="26" fill="white"/><text x="60" y="65" text-anchor="middle" font-size="14" fill="#666">' +
      total +
      '个</text>';
  }

  if (document.getElementById('pie-legend')) {
    document.getElementById('pie-legend').innerHTML = cats
      .map(([cat, count]) => {
        const color = CAT_MAP[cat] ? CAT_MAP[cat].color : '#ccc';
        const name = CAT_MAP[cat] ? CAT_MAP[cat].name : cat;
        return `<div class="legend-item"><div class="legend-dot" style="background:${color}"></div>${name}（${count}）</div>`;
      })
      .join('');
  }
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function polarToCartesian(cx, cy, r, angle) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function renderUserTable() {
  const mockUsers = [
    { id: 'U001', nick: '用户A', reg: '2026-04-01', cnt: 5, last: '2026-04-11', status: '正常' },
    { id: 'U002', nick: '用户B', reg: '2026-04-03', cnt: 3, last: '2026-04-10', status: '正常' },
    { id: 'U003', nick: '用户C', reg: '2026-04-05', cnt: 8, last: '2026-04-11', status: '正常' },
    { id: 'U004', nick: '用户D', reg: '2026-04-07', cnt: 2, last: '2026-04-09', status: '正常' },
    { id: 'U005', nick: '用户E', reg: '2026-04-08', cnt: 1, last: '2026-04-08', status: '正常' }
  ];
  document.getElementById('user-table-body').innerHTML = mockUsers
    .map(
      (u) =>
        `<tr><td>${u.id}</td><td>${u.nick}</td><td>${u.reg}</td><td>${u.cnt}次</td><td>${u.last}</td><td><span class="badge badge-success">${u.status}</span></td></tr>`
    )
    .join('');
}

function renderRecordTable() {
  const mockRec = [
    {
      no: 'ASM001',
      scale: 'SCL-90 症状自评量表',
      user: '用户A',
      score: 125,
      level: '正常',
      time: '2026-04-11 10:30'
    },
    {
      no: 'ASM002',
      scale: 'SDS 抑郁自评量表',
      user: '用户B',
      score: 38,
      level: '无抑郁',
      time: '2026-04-11 11:15'
    },
    {
      no: 'ASM003',
      scale: 'SAS 焦虑自评量表',
      user: '用户C',
      score: 52,
      level: '轻度焦虑',
      time: '2026-04-10 14:20'
    },
    {
      no: 'ASM004',
      scale: 'EPQ 艾森克人格问卷',
      user: '用户A',
      score: 67,
      level: '人格正常',
      time: '2026-04-09 09:00'
    },
    {
      no: 'ASM005',
      scale: 'SDS 抑郁自评量表',
      user: '用户D',
      score: 61,
      level: '中度抑郁',
      time: '2026-04-09 16:45'
    }
  ];
  const levelColor = (l) =>
    l.includes('正常') || l.includes('无') ? 'badge-success' : l.includes('轻') ? 'badge-warning' : 'badge-default';
  document.getElementById('record-table-body').innerHTML = mockRec
    .map(
      (r) =>
        `<tr><td style="font-family:monospace">${r.no}</td><td>${r.scale}</td><td>${r.user}</td><td><strong>${r.score}</strong></td><td><span class="badge ${levelColor(r.level)}">${r.level}</span></td><td style="color:var(--text-muted)">${r.time}</td></tr>`
    )
    .join('');
}
