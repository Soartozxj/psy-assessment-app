// ===== 用户评价管理 =====
let fbAdminPage = 1;
const fbAdminPageSize = 20;
let fbAdminStarFilter = '';
let fbAdminCachedData = [];
let _fbAdminCloudData = null; // 服务端数据缓存
let _fbAdminCloudLoading = false;

// 从服务端拉取评价列表
function _fetchFeedbackFromCloud() {
  if (_fbAdminCloudLoading) {
    return Promise.resolve(_fbAdminCloudData || []);
  }
  _fbAdminCloudLoading = true;
  return fetch('/api/feedback')
    .then(function (r) {
      if (!r.ok) {
        throw new Error('HTTP ' + r.status + ': ' + r.statusText);
      }
      return r.json();
    })
    .then(function (json) {
      _fbAdminCloudLoading = false;
      if (json.code === 0 && Array.isArray(json.data)) {
        _fbAdminCloudData = json.data;
        return json.data;
      }
      return [];
    })
    .catch(function (e) {
      console.warn('[FB Admin] 云端拉取失败:', e);
      _fbAdminCloudLoading = false;
      return [];
    });
}

// ===== 测评结果收集配置 =====
const FB_COLLECT_KEY = 'psy_fb_collect_config';
const FB_COLLECT_DEFAULT = { mode: 'all', stars: [1, 2, 3, 4, 5] }; // 默认全部收集

function fbCollectLoad() {
  try {
    const raw = localStorage.getItem(FB_COLLECT_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(FB_COLLECT_DEFAULT));
}

function fbCollectSave() {
  let mode = 'all';
  const radios = document.querySelectorAll('input[name="fb-collect-mode"]');
  radios.forEach(function (r) {
    if (r.checked) {
      mode = r.value;
    }
  });
  let stars = [1, 2, 3, 4, 5];
  if (mode === 'custom') {
    stars = [];
    document.querySelectorAll('#fb-collect-stars-wrap input[type="checkbox"]').forEach(function (c) {
      if (c.checked) {
        stars.push(parseInt(c.value));
      }
    });
  }
  if (mode === 'none') {
    stars = [];
  }
  const cfg = { mode: mode, stars: stars };
  localStorage.setItem(FB_COLLECT_KEY, JSON.stringify(cfg));
  fbCollectUpdateHint(cfg);
}

function fbCollectSetMode(mode) {
  document.getElementById('fb-collect-stars-wrap').style.display = mode === 'custom' ? '' : 'none';
  fbCollectSave();
}

function fbCollectUpdateHint(cfg) {
  const hint = document.getElementById('fb-collect-hint');
  if (!hint) {
    return;
  }
  if (cfg.mode === 'all') {
    hint.textContent = '当前：所有星级评价都将附带收集测评结果数据';
  } else if (cfg.mode === 'none') {
    hint.textContent = '当前：不收集任何测评结果数据，仅保存评价';
  } else {
    if (cfg.stars.length === 0) {
      hint.textContent = '当前：未选择任何星级（等同不收集）';
    } else {
      hint.textContent = '当前：仅收集 ' + cfg.stars.join('、') + ' 星评价的测评结果数据';
    }
  }
}

function fbCollectInit() {
  const cfg = fbCollectLoad();
  // 设置 radio
  const radios = document.querySelectorAll('input[name="fb-collect-mode"]');
  radios.forEach(function (r) {
    r.checked = r.value === cfg.mode;
  });
  // 设置 checkboxes
  document.querySelectorAll('#fb-collect-stars-wrap input[type="checkbox"]').forEach(function (c) {
    c.checked = cfg.stars.indexOf(parseInt(c.value)) !== -1;
  });
  // 显示/隐藏星级选择
  document.getElementById('fb-collect-stars-wrap').style.display = cfg.mode === 'custom' ? '' : 'none';
  // 提示文字
  fbCollectUpdateHint(cfg);
}

function fbAdminAnonName(nickname) {
  if (!nickname || nickname === '体验用户') {
    return '用户***';
  }
  if (nickname.length <= 1) {
    return '用户*';
  }
  return nickname.charAt(0) + '***';
}

function fbAdminStarsStr(n) {
  let s = '';
  for (let i = 0; i < 5; i++) {
    s += i < n ? '⭐' : '☆';
  }
  return s;
}

function fbAdminSourceLabel(source) {
  if (source === 'mine') {
    return '<span class="fb-admin-source-tag mine">我的页面</span>';
  }
  if (source === 'result') {
    return '<span class="fb-admin-source-tag result">测评简报</span>';
  }
  if (source === 'diag') {
    return '<span class="fb-admin-source-tag diag">测评详情报告</span>';
  }
  return '<span class="fb-admin-source-tag">' + (source || '未知') + '</span>';
}

function fbAdminSetStarFilter(el) {
  document.querySelectorAll('#fb-filter-stars .fb-admin-chip').forEach(function (c) {
    c.classList.remove('active');
  });
  el.classList.add('active');
  fbAdminStarFilter = el.getAttribute('data-stars') || '';
  fbAdminPage = 1;
  renderFeedbackAdmin();
}

function renderFeedbackAdmin(forceRefresh) {
  // 优先从服务端拉取，失败时 fallback 到 localStorage
  if (forceRefresh) {
    _fbAdminCloudData = null;
  }

  const renderWithData = function (allData) {
    fbAdminCachedData = allData;

    // ---- 统计卡 ----
    const total = allData.length;
    const avgStars =
      total > 0
        ? allData.reduce(function (s, f) {
            return s + (f.stars || 0);
          }, 0) / total
        : 0;
    const now = new Date();
    const thisMonth = allData.filter(function (f) {
      const d = new Date(f.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const badCount = allData.filter(function (f) {
      return (f.stars || 0) <= 2;
    }).length;
    const statsHtml =
      '' +
      '<div class="fb-admin-stat-card"><div class="fb-admin-stat-val">' +
      total +
      '</div><div class="fb-admin-stat-label">总评价数</div></div>' +
      '<div class="fb-admin-stat-card"><div class="fb-admin-stat-val">' +
      avgStars.toFixed(1) +
      '<span style="font-size:14px;color:#F5A623">⭐</span></div><div class="fb-admin-stat-label">平均星级</div></div>' +
      '<div class="fb-admin-stat-card"><div class="fb-admin-stat-val" style="color:#52C41A">' +
      thisMonth +
      '</div><div class="fb-admin-stat-label">本月新增</div></div>' +
      '<div class="fb-admin-stat-card"><div class="fb-admin-stat-val" style="color:#FF4D4F">' +
      badCount +
      '</div><div class="fb-admin-stat-label">差评(≤2星)</div>' +
      (badCount > 0
        ? '<div class="fb-admin-stat-sub warn">需关注</div>'
        : '<div class="fb-admin-stat-sub up">👍 无差评</div>') +
      '</div>';
    document.getElementById('fb-admin-stats').innerHTML = statsHtml;

    // ---- 星级分布图 ----
    const starDist = [0, 0, 0, 0, 0];
    allData.forEach(function (f) {
      if (f.stars >= 1 && f.stars <= 5) {
        starDist[f.stars - 1]++;
      }
    });
    const maxBar = Math.max.apply(null, starDist) || 1;
    let barHtml = '';
    for (let i = 5; i >= 1; i--) {
      const cnt = starDist[i - 1];
      const h = Math.round((cnt / maxBar) * 100);
      barHtml +=
        '<div class="fb-admin-bar-item"><div class="fb-admin-bar-count">' +
        cnt +
        '</div><div class="fb-admin-bar" style="height:' +
        h +
        'px"></div><div class="fb-admin-bar-label">' +
        i +
        '星</div></div>';
    }
    document.getElementById('fb-chart-stars').innerHTML = barHtml;
    document.getElementById('fb-chart-avg').innerHTML = '平均 <b>' + avgStars.toFixed(1) + '</b> 星';

    // ---- 热门标签 ----
    const tagCount = {};
    allData.forEach(function (f) {
      if (f.tags && f.tags.length) {
        f.tags.forEach(function (t) {
          tagCount[t] = (tagCount[t] || 0) + 1;
        });
      }
    });
    const tagArr = Object.keys(tagCount)
      .map(function (t) {
        return { tag: t, count: tagCount[t] };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      })
      .slice(0, 12);
    document.getElementById('fb-chart-tags').innerHTML =
      tagArr.length > 0
        ? tagArr
            .map(function (t) {
              return '<div class="fb-admin-tag-item">' + t.tag + '<span class="count">' + t.count + '</span></div>';
            })
            .join('')
        : '<div style="color:var(--text-muted);font-size:12px">暂无标签数据</div>';

    // ---- 量表筛选下拉 ----
    const scaleSet = {};
    allData.forEach(function (f) {
      if (f.scaleName) {
        scaleSet[f.scaleName] = true;
      }
    });
    const scaleSelect = document.getElementById('fb-filter-scale');
    const currentScaleVal = scaleSelect.value;
    scaleSelect.innerHTML =
      '<option value="">全部量表</option>' +
      Object.keys(scaleSet)
        .map(function (s) {
          return '<option value="' + s + '"' + (currentScaleVal === s ? ' selected' : '') + '>' + s + '</option>';
        })
        .join('');

    // ---- 筛选 + 排序 ----
    const keyword = (document.getElementById('fb-search-input').value || '').trim().toLowerCase();
    const scaleFilter = document.getElementById('fb-filter-scale').value;
    const sourceFilter = document.getElementById('fb-filter-source').value;
    const sortMode = document.getElementById('fb-filter-sort').value;

    const filtered = allData.filter(function (f) {
      if (keyword) {
        const haystack = (f.text || f.comment || '') + ' ' + (f.nickname || '') + ' ' + (f.tags || []).join(' ');
        if (haystack.toLowerCase().indexOf(keyword) === -1) {
          return false;
        }
      }
      if (scaleFilter && f.scaleName !== scaleFilter) {
        return false;
      }
      if (sourceFilter && f.source !== sourceFilter) {
        return false;
      }
      if (fbAdminStarFilter === 'low' && f.stars > 2) {
        return false;
      }
      if (fbAdminStarFilter && fbAdminStarFilter !== 'low' && f.stars !== parseInt(fbAdminStarFilter)) {
        return false;
      }
      return true;
    });

    // 排序
    filtered.sort(function (a, b) {
      if (sortMode === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      if (sortMode === 'oldest') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (sortMode === 'highest') {
        return (b.stars || 0) - (a.stars || 0);
      }
      if (sortMode === 'lowest') {
        return (a.stars || 0) - (b.stars || 0);
      }
      return 0;
    });

    // ---- 分页 ----
    const totalPages = Math.ceil(filtered.length / fbAdminPageSize) || 1;
    if (fbAdminPage > totalPages) {
      fbAdminPage = totalPages;
    }
    const start = (fbAdminPage - 1) * fbAdminPageSize;
    const pageData = filtered.slice(start, start + fbAdminPageSize);

    // ---- 表格渲染 ----
    const tbody = document.getElementById('fb-admin-tbody');
    const emptyEl = document.getElementById('fb-admin-empty');
    if (pageData.length === 0) {
      tbody.innerHTML = '';
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
      tbody.innerHTML = pageData
        .map(function (f) {
          const d = new Date(f.createdAt);
          const dateStr = d.toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          const isBad = (f.stars || 0) <= 2;
          const tagsStr = (f.tags || [])
            .map(function (t) {
              return '<span class="fb-admin-tag">' + t + '</span>';
            })
            .join('');
          return (
            '<tr class="' +
            (isBad ? 'row-bad' : '') +
            '">' +
            '<td><div class="fb-admin-user"><div class="fb-admin-avatar">👤</div><div><div class="fb-admin-name">' +
            fbAdminAnonName(f.nickname) +
            '</div><div class="fb-admin-uid">' +
            (f.id || '') +
            '</div></div></div></td>' +
            '<td><span class="fb-admin-stars">' +
            fbAdminStarsStr(f.stars) +
            '</span><span class="fb-admin-stars-label">' +
            f.stars +
            '星</span></td>' +
            '<td><div class="fb-admin-scale-name">' +
            (f.scaleName || '-') +
            '</div>' +
            fbAdminSourceLabel(f.source) +
            (f.assessmentData ? '<span style="font-size:10px;color:#4A90D9;margin-left:4px">📊</span>' : '') +
            '</td>' +
            '<td>' +
            tagsStr +
            '</td>' +
            '<td><div class="fb-admin-content">' +
            (f.text || f.comment || '-').replace(/</g, '&lt;') +
            '</div></td>' +
            '<td><div class="fb-admin-date">' +
            dateStr +
            '</div></td>' +
            '<td><span class="fb-admin-action" data-action="fb-admin-show-detail" data-id="' +
            f.id +
            '">📋 详情</span><span class="fb-admin-action danger" data-action="fb-admin-delete" data-id="' +
            f.id +
            ')">🗑️ 删除</span></td>' +
            '</tr>'
          );
        })
        .join('');
    }

    // ---- 分页渲染 ----
    const pagEl = document.getElementById('fb-admin-pagination');
    if (totalPages <= 1) {
      pagEl.innerHTML = '';
      return;
    }
    let pagHtml =
      '<span class="fb-admin-page' +
      (fbAdminPage === 1 ? ' active' : '') +
      '" data-action="fb-admin-go-page" data-page="1">«</span>';
    for (let p = Math.max(1, fbAdminPage - 2); p <= Math.min(totalPages, fbAdminPage + 2); p++) {
      pagHtml +=
        '<span class="fb-admin-page' +
        (p === fbAdminPage ? ' active' : '') +
        '" data-action="fb-admin-go-page" data-page="' +
        p +
        '">' +
        p +
        '</span>';
    }
    pagHtml +=
      '<span class="fb-admin-page' +
      (fbAdminPage === totalPages ? ' active' : '') +
      '" data-action="fb-admin-go-page" data-page="' +
      totalPages +
      '">»</span>';
    pagEl.innerHTML = pagHtml;

    // 初始化标签管理面板
    fbTagInitPanel();
  }; // end renderWithData

  // 异步从服务端拉取最新数据（不阻塞首次渲染）
  _fetchFeedbackFromCloud().then(function (cloudData) {
    if (cloudData.length > 0) {
      renderWithData(cloudData);
    } else {
      // 服务端无数据，尝试 localStorage fallback
      try {
        const raw = localStorage.getItem('psy_feedback_list');
        if (raw) {
          renderWithData(JSON.parse(raw));
        }
      } catch (e) {}
    }
  });
}

function fbAdminGoPage(p) {
  fbAdminPage = p;
  renderFeedbackAdmin();
}

function fbAdminShowDetail(id) {
  const f = fbAdminCachedData.find(function (item) {
    return item.id === id;
  });
  if (!f) {
    return;
  }
  const d = new Date(f.createdAt);
  const dateStr = d.toLocaleString('zh-CN');

  // 构造关联测评结果区（如果存在 assessmentData）
  let assessHtml = '';
  if (f.assessmentData) {
    const a = f.assessmentData;
    assessHtml =
      '<div style="margin-top:16px;padding:14px 16px;background:#f0f7ff;border-radius:8px;border:1px solid #d6e8f7">' +
      '<div style="font-size:13px;font-weight:600;color:#4A90D9;margin-bottom:10px">📊 关联测评结果</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:' +
      (a.dims && a.dims.length > 0 ? '12px' : '0') +
      '">' +
      '<div style="font-size:12px;color:#888">总分</div>' +
      '<div style="font-size:14px;font-weight:600;color:' +
      (a.color || '#333') +
      '">' +
      (a.totalScore || '-') +
      '<span style="font-size:11px;color:#aaa;font-weight:400"> / ' +
      (a.maxScore || '-') +
      '</span></div>' +
      '<div style="font-size:12px;color:#888"></div>' +
      '<div style="font-size:12px;color:#888">等级</div>' +
      '<div style="font-size:13px;font-weight:500;color:' +
      (a.color || '#333') +
      '">' +
      (a.levelName || '-') +
      '</div>' +
      '<div style="font-size:12px;color:#888"></div>' +
      '</div>';
    // 维度明细
    if (a.dims && a.dims.length > 0) {
      assessHtml += '<div style="font-size:12px;color:#888;margin-bottom:6px">维度明细</div>';
      a.dims.forEach(function (dim) {
        const pct = dim.pct || 0;
        const barColor = dim.color || '#4A90D9';
        assessHtml +=
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
          '<span style="width:70px;font-size:12px;color:#555;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          (dim.name || '-') +
          '</span>' +
          '<div style="flex:1;height:6px;background:#e8e8e8;border-radius:3px;overflow:hidden"><div style="height:100%;width:' +
          pct +
          '%;background:' +
          barColor +
          ';border-radius:3px"></div></div>' +
          '<span style="width:50px;font-size:11px;color:#888;text-align:right">' +
          (dim.score || '-') +
          ' <span style="color:#bbb">(' +
          pct +
          '%)</span></span>' +
          (dim.levelLabel
            ? '<span style="font-size:11px;color:' + barColor + ';white-space:nowrap">' + dim.levelLabel + '</span>'
            : '') +
          '</div>';
      });
    }
    // AI 诊断报告
    if (a.aiDiagText) {
      assessHtml +=
        '<div style="margin-top:12px;padding:10px 12px;background:#fff;border-radius:6px;border:1px solid #e8e8e8">' +
        '<div style="font-size:12px;font-weight:600;color:#333;margin-bottom:6px">🤖 AI 诊断报告</div>' +
        '<div style="font-size:12px;color:#555;line-height:1.7;max-height:200px;overflow-y:auto;white-space:pre-wrap">' +
        a.aiDiagText.replace(/</g, '&lt;') +
        '</div>' +
        '</div>';
    }
    assessHtml += '</div>';
  }

  const html =
    '<div class="fb-detail-overlay" id="fb-detail-overlay" onclick="if(event.target===this)this.remove()">' +
    '<div class="fb-detail-box">' +
    '<div class="fb-detail-header"><h3>📋 评价详情 #' +
    f.id +
    '</h3><button class="fb-detail-close" onclick="document.getElementById(\'fb-detail-overlay\').remove()">✕</button></div>' +
    '<div class="fb-detail-body">' +
    '<div class="fb-detail-row"><span class="fb-detail-label">用户</span><span class="fb-detail-val">' +
    fbAdminAnonName(f.nickname) +
    '</span></div>' +
    '<div class="fb-detail-row"><span class="fb-detail-label">评分</span><span class="fb-detail-val">' +
    fbAdminStarsStr(f.stars) +
    ' ' +
    f.stars +
    '星</span></div>' +
    '<div class="fb-detail-row"><span class="fb-detail-label">关联量表</span><span class="fb-detail-val">' +
    (f.scaleName || '-') +
    '</span></div>' +
    '<div class="fb-detail-row"><span class="fb-detail-label">来源</span><span class="fb-detail-val">' +
    fbAdminSourceLabel(f.source) +
    '</span></div>' +
    '<div class="fb-detail-row"><span class="fb-detail-label">时间</span><span class="fb-detail-val">' +
    dateStr +
    '</span></div>' +
    '<div class="fb-detail-row"><span class="fb-detail-label">标签</span><span class="fb-detail-val">' +
    ((f.tags || []).length > 0 ? f.tags.join('、') : '-') +
    '</span></div>' +
    (f.text || f.comment
      ? '<div class="fb-detail-text">' + (f.text || f.comment).replace(/</g, '&lt;') + '</div>'
      : '') +
    '</div>' +
    assessHtml +
    '<div class="fb-detail-actions"><button class="btn btn-danger" style="padding:6px 16px;font-size:12px" data-action="fb-admin-delete" data-id="' +
    f.id +
    ");document.getElementById('fb-detail-overlay').remove()\">🗑️ 删除评价</button></div>" +
    '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function fbAdminDelete(id) {
  if (!confirm('确定删除该条评价？删除后无法恢复。')) {
    return;
  }
  try {
    const list = JSON.parse(localStorage.getItem('psy_feedback_list') || '[]');
    const idx = list.findIndex(function (f) {
      return f.id === id;
    });
    if (idx !== -1) {
      list.splice(idx, 1);
      localStorage.setItem('psy_feedback_list', JSON.stringify(list));
      showToast('✓ 已删除评价', 'success');
      renderFeedbackAdmin();
    } else {
      showToast('未找到该评价', 'error');
    }
  } catch (e) {
    showToast('删除失败', 'error');
    console.error(e);
  }
}

// ===== 标签管理 =====
let fbTagCurrentScene = 'mine';
let fbTagCurrentType = 'good';

function fbTagSwitchScene(el) {
  document.querySelectorAll('.fb-tag-scene-tab').forEach(function (t) {
    t.classList.remove('active');
  });
  el.classList.add('active');
  fbTagCurrentScene = el.getAttribute('data-scene');
  fbTagRenderList();
}

function fbTagSwitchType(el) {
  document.querySelectorAll('.fb-tag-type-tab').forEach(function (t) {
    t.classList.remove('active');
  });
  el.classList.add('active');
  fbTagCurrentType = el.getAttribute('data-type');
  fbTagRenderList();
}

function fbTagGetConfig() {
  return SharedData.getFeedbackTagConfig();
}

function fbTagGetCurrentTags() {
  const cfg = fbTagGetConfig();
  if (cfg[fbTagCurrentScene] && Array.isArray(cfg[fbTagCurrentScene][fbTagCurrentType])) {
    return cfg[fbTagCurrentScene][fbTagCurrentType];
  }
  return [];
}

function fbTagRenderList() {
  const tags = fbTagGetCurrentTags();
  const maxLen = SharedData.FB_TAG_MAX_LEN;
  const el = document.getElementById('fb-tag-list');
  if (!el) {
    return;
  }
  if (tags.length === 0) {
    el.innerHTML = '<div style="color:#ccc;font-size:12px;padding:8px">暂无标签，请添加或批量导入</div>';
    return;
  }
  el.innerHTML = tags
    .map(function (t, i) {
      const over = t.length > maxLen ? ' over' : '';
      return (
        '<div class="fb-tag-cell">' +
        '<span>' +
        t.replace(/</g, '&lt;') +
        '</span>' +
        '<span class="fb-tag-len' +
        over +
        '">' +
        t.length +
        '/' +
        maxLen +
        '</span>' +
        '<span class="fb-tag-del" data-action="fb-tag-delete" data-index="' +
        i +
        '" title="删除">✕</span>' +
        '</div>'
      );
    })
    .join('');
}

function fbTagAddTags() {
  const input = document.getElementById('fb-tag-new-input');
  if (!input) {
    return;
  }
  const raw = input.value.trim();
  if (!raw) {
    return;
  }
  // 支持换行、逗号（中英文）、顿号、分号（中英文）分隔
  const arr = raw
    .split(/[\n,，、;；]+/)
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return s.length > 0;
    });
  if (arr.length === 0) {
    return;
  }
  const cfg = fbTagGetConfig();
  if (!cfg[fbTagCurrentScene]) {
    cfg[fbTagCurrentScene] = { good: [], neutral: [], bad: [] };
  }
  const existing = cfg[fbTagCurrentScene][fbTagCurrentType] || [];
  const maxLen = SharedData.FB_TAG_MAX_LEN;
  const maxCount = SharedData.FB_TAG_MAX_COUNT;
  let added = 0,
    skipped = 0,
    truncated = 0;
  arr.forEach(function (t) {
    if (existing.indexOf(t) !== -1) {
      skipped++;
      return;
    }
    if (existing.length >= maxCount) {
      return;
    }
    if (t.length > maxLen) {
      t = t.substring(0, maxLen);
      truncated++;
    }
    existing.push(t);
    added++;
  });
  cfg[fbTagCurrentScene][fbTagCurrentType] = existing;
  SharedData.saveFeedbackTagConfig(cfg);
  input.value = '';
  fbTagRenderList();
  let msg = '✓ 已添加 ' + added + ' 个标签';
  if (skipped > 0) {
    msg += '，' + skipped + ' 个重复跳过';
  }
  if (truncated > 0) {
    msg += '，' + truncated + ' 个超长截断';
  }
  showToast(msg, 'success');
}

function fbTagDelete(idx) {
  const cfg = fbTagGetConfig();
  const arr = cfg[fbTagCurrentScene][fbTagCurrentType] || [];
  if (idx < 0 || idx >= arr.length) {
    return;
  }
  const removed = arr.splice(idx, 1)[0];
  cfg[fbTagCurrentScene][fbTagCurrentType] = arr;
  SharedData.saveFeedbackTagConfig(cfg);
  fbTagRenderList();
  showToast('✓ 已删除「' + removed + '」');
}

// 一级页签切换：评价数据 / 标签管理
function fbSwitchMainTab(el) {
  document.querySelectorAll('[data-fbtab]').forEach(function (t) {
    t.classList.remove('active');
  });
  el.classList.add('active');
  const tab = el.getAttribute('data-fbtab');
  document.getElementById('fb-panel-data').style.display = tab === 'data' ? '' : 'none';
  document.getElementById('fb-panel-tags').style.display = tab === 'tags' ? '' : 'none';
  if (tab === 'tags') {
    fbTagInitPanel();
    fbTagRenderList();
  }
}

// 初始化标签管理面板（switchSection feedback 时已触发 renderFeedbackAdmin，这里追加）
function fbTagInitPanel() {
  const lenDisp = document.getElementById('fb-tag-max-len-display');
  const countDisp = document.getElementById('fb-tag-max-count-display');
  if (lenDisp) {
    lenDisp.textContent = SharedData.FB_TAG_MAX_LEN;
  }
  if (countDisp) {
    countDisp.textContent = SharedData.FB_TAG_MAX_COUNT;
  }
  fbTagCurrentScene = 'mine';
  document.querySelectorAll('.fb-tag-scene-tab').forEach(function (t) {
    t.classList.remove('active');
  });
  const first = document.querySelector('.fb-tag-scene-tab[data-scene="mine"]');
  if (first) {
    first.classList.add('active');
  }
  fbTagRenderList();
}
