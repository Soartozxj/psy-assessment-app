function openScaleModal(id) {
  editingId = id || null;
  if (id) {
    // 编辑模式
    const s = scales.find((s) => s.id === id);
    if (!s) {
      return;
    }
    document.getElementById('modal-title').textContent = '编辑量表：' + s.name;
    document.getElementById('f-name').value = s.name || '';
    document.getElementById('f-shortname').value = s.shortName || '';
    document.getElementById('f-code').value = s.code || '';
    refreshCategorySelect(s.category || '');
    document.getElementById('f-emoji').value = s.emoji || '';
    document.getElementById('f-color').value = s.color || '#4A90D9';
    document.getElementById('f-duration').value = s.duration || '';
    document.getElementById('f-question-time').value = s.questionTime || 30;
    document.getElementById('f-applicable').value = s.applicablePeople || '';
    document.getElementById('f-desc').value = s.desc || '';
    document.getElementById('f-instruction').value = s.instruction || '';

    let noticeItems = s.notice || [];
    if (noticeItems.length === 0) {
      noticeItems = ['请根据您过去一周的真实感受作答'];
    }
    document.getElementById('f-notice').value = JSON.stringify(noticeItems);
    renderNoticeEditor(noticeItems);

    document.getElementById('f-tags').value = (s.tags || []).join(', ');
    document.getElementById('f-status').value = String(s.status || 1);
    document.getElementById('f-sort').value = s.sortOrder || 0;
    refreshCounselorOptions();
    refreshBackgroundOptions();
    if (s.npcConfig) {
      document.getElementById('f-npc-counselor').value = s.npcConfig.counselorId || '';
      document.getElementById('f-npc-bg').value = s.npcConfig.backgroundId || '';
      updateNpcSelectPreview();
    }
    currentQuestions = JSON.parse(JSON.stringify(s.questions || []));
    _autoAssignIfEmpty();
  } else {
    // 新建模式
    document.getElementById('modal-title').textContent = '新建量表';
    clearForm();
    refreshCategorySelect('');
    currentQuestions = [{ id: 1, content: '', options: getPresetOptions('freq4') }];
    _autoAssignIfEmpty();
  }
  renderQEditor();
  autoCalcDuration();
  openModal();
}

// 兼容层
function openCreateModal() {
  openScaleModal();
}
function openEditModal(id) {
  openScaleModal(id);
}

// 自动计算预计时长 = ⌈单题时长 × 题目数 ÷ 60⌉
function autoCalcDuration() {
  const qt = parseInt(document.getElementById('f-question-time').value) || 30;
  const count = currentQuestions.length || 0;
  const minutes = Math.ceil((qt * count) / 60);
  document.getElementById('f-duration').value = minutes;
  const formula = document.getElementById('duration-formula');
  if (formula) {
    formula.textContent = '⌈' + qt + 's × ' + count + '题 ÷ 60⌉ = ' + minutes + ' 分钟';
  }
}
