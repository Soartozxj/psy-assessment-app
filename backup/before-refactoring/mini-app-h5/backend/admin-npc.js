function loadNpcConfig() {
  try {
    const data = localStorage.getItem(NPC_CONFIG_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      // 合并默认值，防止缺少字段
      var config = {
        ...DEFAULT_NPC_CONFIG,
        ...parsed,
        counselors: parsed.counselors || [],
        backgrounds: parsed.backgrounds || [],
        roleOptions: parsed.roleOptions || DEFAULT_NPC_CONFIG.roleOptions,
        styleOptions: parsed.styleOptions || DEFAULT_NPC_CONFIG.styleOptions,
        transitions: (parsed.transitions || DEFAULT_NPC_CONFIG.transitions).map(function (t) {
          return typeof t === 'string' ? { text: t, phase: '全部阶段' } : t;
        })
      };
      // 自动补 seq 编号
      _assignSeqNumbers(config.counselors, 'ZXS');
      _assignSeqNumbers(config.backgrounds, 'CJ');
      return config;
    }
  } catch (e) {
    console.error('加载NPC配置失败:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_NPC_CONFIG));
}

// ===== NPC配置云端同步 =====
// 管理员 OpenID（与云托管 ADMIN_OPENIDS 环境变量一致）
var NPC_ADMIN_OPENID = 'oyORU3XImvO_rYAWBUTMNm89-3v0';
var NPC_API_BASE = 'https://identity.soarto.com.cn';

/**
 * 将 NPC 配置同步到云端（不含图片，图片由 syncNpcImagesToCloud 单独上传）
 */
function syncNpcConfigToCloud(config) {
  if (!config) {
    config = loadNpcConfig();
  }
  // 不含 images 字段的纯配置
  var configOnly = Object.assign({}, config);
  delete configOnly.images;
  configOnly._openid = NPC_ADMIN_OPENID;

  fetch(NPC_API_BASE + '/api/npc-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configOnly)
  })
    .then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    })
    .then(function (json) {
      if (json.code === 0) {
        console.log('[NPC-Sync] ✅ 配置已同步到云端');
      } else {
        console.warn('[NPC-Sync] ❌ 配置同步失败:', json.message);
      }
    })
    .catch(function (err) {
      console.error('[NPC-Sync] ❌ 配置同步请求失败:', err.message);
    });
}

/**
 * 将本地 IndexedDB 中的图片逐张上传到云端
 * 使用 PUT /api/npc-image 接口，避免一次性 payload 过大导致 413
 */
function manualSyncNpcImages() {
  try {
    var config = loadNpcConfig();
    console.log('[NPC-Sync] 开始同步图片到云端...');

    // 收集所有需要上传的图片 ID（咨询师 + 背景）
    var imageIds = [];
    (config.counselors || []).forEach(function (c) {
      if (c.id) imageIds.push(c.id);
    });
    (config.backgrounds || []).forEach(function (b) {
      if (b.id) imageIds.push(b.id);
    });
    console.log('[NPC-Sync] 需要同步的图片数:', imageIds.length);

    if (imageIds.length === 0) {
      showToast('没有需要同步的图片', 'info');
      return;
    }

    // 检查 AssetStorage 是否可用
    if (typeof AssetStorage === 'undefined' || typeof AssetStorage.getCachedDataURL !== 'function') {
      showToast('AssetStorage 未加载，请刷新页面重试', 'error');
      return;
    }

    showToast('正在同步 ' + imageIds.length + ' 张图片到云端...', 'info');

    // 注意：不再先清空 images，因为 PUT /api/npc-config 已改为合并写入（保留 images）
    // 逐张 PUT /api/npc-image 会在服务端合并追加

    // 逐张读取并上传图片
    var uploaded = 0;
    var failed = 0;
    var processed = 0;

    // 压缩图片（canvas 缩放 + 按类型压缩）
    // 立绘（ZXS-）：保留 PNG 透明通道，仅缩放尺寸
    // 背景（CJ-）及其他：JPEG 压缩，体积更小
    var MAX_DIM_NPC = 600; // 立绘最大宽/高（手机屏幕够用）
    var MAX_DIM_BG = 1200; // 背景最大宽/高（需要铺满屏幕）
    var JPEG_Q = 0.6; // JPEG 质量

    function compressBase64(base64, imgId) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth;
          var h = img.naturalHeight;
          var isPng = base64.indexOf('image/png') !== -1;
          var isCounselor = imgId && (imgId.indexOf('ZXS-') === 0 || imgId.indexOf('counselor') === 0);
          var maxDim = isCounselor ? MAX_DIM_NPC : MAX_DIM_BG;

          // 已足够小则不压缩
          if (w <= maxDim && h <= maxDim && base64.length < 300 * 1024) {
            resolve(base64);
            return;
          }
          var ratio = Math.min(maxDim / w, maxDim / h, 1);
          var nw = Math.round(w * ratio);
          var nh = Math.round(h * ratio);
          var canvas = document.createElement('canvas');
          canvas.width = nw;
          canvas.height = nh;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, nw, nh);
          // 立绘必须保留 PNG 透明通道，背景用 JPEG 压缩
          var format = isCounselor ? 'image/png' : isPng ? 'image/png' : 'image/jpeg';
          var quality = format === 'image/jpeg' ? JPEG_Q : undefined;
          var compressed = canvas.toDataURL(format, quality);
          console.log(
            '[NPC-Sync] 压缩:',
            imgId || '?',
            format,
            Math.round(base64.length / 1024) + 'KB → ' + Math.round(compressed.length / 1024) + 'KB'
          );
          resolve(compressed);
        };
        img.onerror = function () {
          reject(new Error('图片加载失败'));
        };
        img.src = base64;
      });
    }

    function uploadNext() {
      if (processed >= imageIds.length) {
        var msg = '图片同步完成：成功 ' + uploaded + ' 张' + (failed > 0 ? '，失败 ' + failed + ' 张' : '');
        showToast(msg, failed > 0 ? 'warning' : 'success');
        console.log('[NPC-Sync] ' + msg);
        return;
      }

      var id = imageIds[processed];
      processed++;

      // 从 IndexedDB 读取 base64
      AssetStorage.getCachedDataURL(id)
        .then(function (base64) {
          if (!base64) {
            console.warn('[NPC-Sync] 图片不存在:', id);
            failed++;
            uploadNext();
            return;
          }

          // 压缩图片后再上传
          return compressBase64(base64, id).then(function (compressed) {
            return fetch(NPC_API_BASE + '/api/npc-image', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ _openid: NPC_ADMIN_OPENID, imageId: id, base64: compressed })
            })
              .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
              })
              .then(function (json) {
                if (json.code === 0) {
                  uploaded++;
                  console.log('[NPC-Sync] ✅ 图片已上传:', id, '(' + Math.round(compressed.length / 1024) + 'KB)');
                } else {
                  failed++;
                  console.warn('[NPC-Sync] ❌ 上传失败:', id, json.message);
                }
                uploadNext();
              });
          }); // end compressBase64.then
        })
        .catch(function (err) {
          console.error('[NPC-Sync] ❌ 图片处理失败:', id, err.message);
          failed++;
          uploadNext();
        });
    }

    // 启动逐张上传
    uploadNext();
  } catch (e) {
    console.error('[NPC-Sync] 同步失败:', e);
    showToast('图片同步失败: ' + e.message, 'error');
  }
}

function saveNpcConfig(config) {
  // 保存前确保所有条目都有 seq 编号
  _assignSeqNumbers(config.counselors, 'ZXS');
  _assignSeqNumbers(config.backgrounds, 'CJ');
  localStorage.setItem(NPC_CONFIG_KEY, JSON.stringify(config));
  showToast('NPC配置已保存', 'success');
  // 异步同步到云端（不阻塞 UI）
  syncNpcConfigToCloud(config);
}

/**
 * 从云托管加载 NPC 配置（覆盖本地 localStorage，不含图片 base64）
 * 用于本地配置丢失时的恢复
 */
function restoreNpcConfigFromCloud() {
  if (
    !confirm(
      '确定要从云端恢复 NPC 配置吗？\n\n这将覆盖当前本地的咨询师、背景和过渡语设置。\n如果云端有图片数据会同时恢复。'
    )
  )
    return;
  showToast('正在从云端恢复配置...', 'info');
  fetch(NPC_API_BASE + '/api/npc-config', {
    method: 'GET'
  })
    .then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    })
    .then(function (json) {
      if (json.code !== 0) throw new Error(json.message || '接口错误');
      var data = json.data;
      // 云端返回格式：[{_id:'npc_config', data:{...}}] 或直接 {...}
      var config = Array.isArray(data) && data[0] && data[0].data ? data[0].data : data;
      if (!config || !config.counselors) throw new Error('云端无有效配置');
      // 新架构：配置不含 images，直接存 localStorage
      localStorage.setItem(NPC_CONFIG_KEY, JSON.stringify(config));
      console.log(
        '[NPC-Restore] 配置恢复成功: counselors=' +
          (config.counselors || []).length +
          ', backgrounds=' +
          (config.backgrounds || []).length
      );
      showToast(
        '已恢复 ' +
          (config.counselors || []).length +
          ' 个咨询师 + ' +
          (config.backgrounds || []).length +
          ' 个背景（图片需点「🖼️ 恢复云端图片」单独恢复）',
        'success'
      );
      renderNpcConfig();
    })
    .catch(function (err) {
      console.error('[NPC-Restore] 恢复失败:', err.message);
      showToast('从云端恢复失败: ' + err.message, 'error');
    });
}

/**
 * 将 base64 图片数据写入 IndexedDB
 * @param {Object} images - {id: base64DataUrl, ...}
 * @returns {Promise<number>} 成功写入的数量
 */
function _restoreImagesToIDB(images) {
  var ids = Object.keys(images);
  if (ids.length === 0) return Promise.resolve(0);
  console.log('[NPC-Restore] 开始恢复 ' + ids.length + ' 张图片到 IndexedDB...');
  var saved = 0;
  var promises = ids.map(function (id) {
    var base64 = images[id];
    if (!base64 || typeof base64 !== 'string') return Promise.resolve(0);
    // 将 base64 转 Blob
    return new Promise(function (resolve) {
      try {
        var parts = base64.split(',');
        var mimeMatch = parts[0].match(/:(.*?);/);
        var mime = mimeMatch ? mimeMatch[1] : 'image/png';
        var byteString = atob(parts[1]);
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        var blob = new Blob([ab], { type: mime });
        AssetStorage.saveImageWithBase64(id, blob, base64)
          .then(function () {
            saved++;
            resolve(1);
          })
          .catch(function (err) {
            console.warn('[NPC-Restore] 图片写入 IDB 失败:', id, err.message);
            resolve(0);
          });
      } catch (e) {
        console.warn('[NPC-Restore] 图片 base64 解析失败:', id, e.message);
        resolve(0);
      }
    });
  });
  return Promise.all(promises).then(function () {
    console.log('[NPC-Restore] 图片恢复完成: ' + saved + '/' + ids.length);
    return saved;
  });
}

/**
 * 仅从云端恢复图片到 IndexedDB（不覆盖配置元数据）
 * 新架构：先获取图片 ID 列表，再逐张下载
 */
function restoreNpcImagesFromCloud() {
  showToast('正在从云端恢复图片...', 'info');
  var NPC_API = NPC_API_BASE;
  fetch(NPC_API + '/api/npc-images')
    .then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    })
    .then(function (json) {
      if (json.code !== 0) throw new Error(json.message || '获取图片列表失败');
      var imageIds = (json.data && json.data.imageIds) || [];
      if (imageIds.length === 0) {
        showToast('云端没有图片数据，请先在本地上传图片后点「☁️ 同步图片到云端」', 'error');
        return;
      }
      showToast('发现 ' + imageIds.length + ' 张图片，开始逐张下载...', 'info');
      var saved = 0;
      var failed = 0;
      function downloadNext(idx) {
        if (idx >= imageIds.length) {
          showToast(
            '已恢复 ' + saved + ' 张图片' + (failed > 0 ? '，失败 ' + failed + ' 张' : ''),
            saved > 0 ? 'success' : 'error'
          );
          if (typeof AssetStorage !== 'undefined' && AssetStorage.revokeDataURLCache) {
            imageIds.forEach(function (id) {
              AssetStorage.revokeDataURLCache(id);
            });
          }
          renderNpcConfig();
          return;
        }
        var id = imageIds[idx];
        fetch(NPC_API + '/api/npc-image?imageId=' + encodeURIComponent(id))
          .then(function (resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.json();
          })
          .then(function (json) {
            if (json.code !== 0 || !json.data || !json.data.base64) {
              failed++;
              downloadNext(idx + 1);
              return;
            }
            var base64 = json.data.base64;
            var parts = base64.split(',');
            var mime = parts[0].match(/:(.*?);/)[1];
            var raw = atob(parts[1]);
            var arr = new Uint8Array(raw.length);
            for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
            var blob = new Blob([arr], { type: mime });
            AssetStorage.saveImageWithBase64(id, blob, base64)
              .then(function () {
                saved++;
                downloadNext(idx + 1);
              })
              .catch(function () {
                failed++;
                downloadNext(idx + 1);
              });
          })
          .catch(function () {
            failed++;
            downloadNext(idx + 1);
          });
      }
      downloadNext(0);
    })
    .catch(function (err) {
      console.error('[NPC-RestoreImages] 恢复失败:', err.message);
      showToast('恢复图片失败: ' + err.message, 'error');
    });
}

// ===== NPC Tab 切换 =====
function switchNpcTab(tabId) {
  // 切换按钮样式
  document.querySelectorAll('.npc-tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('onclick').indexOf(tabId) !== -1);
  });
  // 切换面板
  document.querySelectorAll('.npc-tab-panel').forEach(function (panel) {
    panel.classList.toggle('active', panel.id === tabId);
  });
}

// ===== 渲染NPC配置面板 =====
function renderNpcConfig() {
  const config = loadNpcConfig();
  renderCounselorList(config);
  renderBackgroundList(config);
  renderTransitionList(config);
  // 更新 Tab badge
  var cBadge = document.getElementById('counselor-tab-badge');
  var bBadge = document.getElementById('background-tab-badge');
  var tBadge = document.getElementById('transition-tab-badge');
  if (cBadge) cBadge.textContent = (config.counselors || []).length;
  if (bBadge) bBadge.textContent = (config.backgrounds || []).length;
  if (tBadge) tBadge.textContent = (config.transitions || []).length;
}

// ===== 立绘管理 =====
function renderCounselorList(config) {
  const container = document.getElementById('counselor-list');
  const countEl = document.getElementById('counselor-count');
  const filterBar = document.getElementById('counselor-filter-bar');
  if (!container) return;

  const allCounselors = config.counselors || [];
  countEl.textContent = '(' + allCounselors.length + '个)';

  // 有数据才显示筛选栏
  if (filterBar) {
    filterBar.style.display = allCounselors.length > 0 ? 'flex' : 'none';
  }

  // 动态更新身份筛选选项
  updateFilterRoleOptions(allCounselors);

  // 应用筛选
  const filtered = applyCounselorFilter(allCounselors);

  // 排序
  var sortMode = (document.getElementById('filter-sort') || {}).value || 'seq';
  if (sortMode === 'seq') {
    filtered.sort(function (a, b) {
      var na = parseInt((a.seq || 'ZXS-9999').replace('ZXS-', ''), 10);
      var nb = parseInt((b.seq || 'ZXS-9999').replace('ZXS-', ''), 10);
      return na - nb;
    });
  } else {
    filtered.sort(function (a, b) {
      return new Date(b.uploadTime || 0) - new Date(a.uploadTime || 0);
    });
  }

  if (allCounselors.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="padding:30px 10px"><div style="font-size:32px;margin-bottom:6px">🖼️</div><div style="font-size:13px;color:var(--text-muted)">暂无立绘素材，点击右侧 + 上传</div></div>' +
      '<div class="asset-cell upload-cell" onclick="addCounselor()"><div class="upload-icon">+</div><div class="upload-text">上传立绘</div></div>';
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="padding:30px 10px"><div style="font-size:32px;margin-bottom:6px">🔍</div><div style="font-size:13px;color:var(--text-muted)">没有符合条件的立绘</div></div>';
    return;
  }

  var html = filtered
    .map(function (c) {
      var isDefault = c.id === config.defaultCounselorId;
      var safeName = (c.name || '未命名').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return (
        '<div class="asset-cell' +
        (isDefault ? ' is-default' : '') +
        '" id="asset-' +
        c.id +
        '" onclick="openCounselorDetail(\'' +
        c.id +
        '\')">' +
        (isDefault ? '<span class="cell-default-tag">⭐ 默认</span>' : '') +
        '<span class="cell-seq-tag">' +
        (c.seq || '') +
        '</span>' +
        '<button class="cell-menu-btn" onclick="event.stopPropagation();toggleCellMenu(this)">···</button>' +
        '<div class="cell-dropdown">' +
        '<button class="dropdown-item" onclick="event.stopPropagation();toggleCounselorEdit(\'' +
        c.id +
        '\')">✏️ 编辑信息</button>' +
        (!isDefault
          ? '<button class="dropdown-item" onclick="event.stopPropagation();setDefaultCounselor(\'' +
            c.id +
            '\')">⭐ 设为默认</button>'
          : '') +
        '<button class="dropdown-item danger" onclick="event.stopPropagation();deleteCounselor(\'' +
        c.id +
        '\')">🗑️ 删除立绘</button>' +
        '</div>' +
        '<img id="thumb-' +
        c.id +
        '" class="cell-img" src="" alt="' +
        safeName +
        '" style="display:none" />' +
        '<span id="thumb-placeholder-' +
        c.id +
        '" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:48px;background:var(--bg)">🧑</span>' +
        '<div class="cell-bottom-bar"><div class="cell-name">' +
        (c.seq
          ? '<span style="font-family:monospace;font-size:10px;opacity:0.8;margin-right:4px;">' +
            escHtml(c.seq) +
            '</span>'
          : '') +
        escHtml(c.counselorName || c.name || '未命名') +
        '</div>' +
        (c.role ? '<div class="cell-role">' + escHtml(c.role) + '</div>' : '') +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  // 上传块
  html +=
    '<div class="asset-cell upload-cell" onclick="addCounselor()"><div class="upload-icon">+</div><div class="upload-text">上传立绘</div></div>';

  container.innerHTML = html;

  // 异步填充缩略图
  filtered.forEach(function (c) {
    AssetStorage.getCachedDataURL(c.id).then(function (url) {
      if (!url) return;
      var img = document.getElementById('thumb-' + c.id);
      var placeholder = document.getElementById('thumb-placeholder-' + c.id);
      if (img) {
        img.src = url;
        img.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
    });
  });
}

// ---- 筛选相关 ----
function updateFilterRoleOptions(allCounselors) {
  var config = loadNpcConfig();

  // 更新身份筛选选项（从预设列表）
  var roleSelect = document.getElementById('filter-role');
  if (roleSelect) {
    var currentRole = roleSelect.value;
    var roles = config.roleOptions || DEFAULT_NPC_CONFIG.roleOptions || [];
    var roleHtml = '<option value="">全部身份</option>';
    roles.forEach(function (r) {
      roleHtml += '<option value="' + escHtml(r) + '">' + escHtml(r) + '</option>';
    });
    roleSelect.innerHTML = roleHtml;
    roleSelect.value = currentRole;
  }

  // 更新风格筛选选项（从预设列表）
  var styleSelect = document.getElementById('filter-style');
  if (styleSelect) {
    var currentStyle = styleSelect.value;
    var styles = config.styleOptions || DEFAULT_NPC_CONFIG.styleOptions || [];
    var styleHtml = '<option value="">全部风格</option>';
    styles.forEach(function (s) {
      styleHtml += '<option value="' + escHtml(s) + '">' + escHtml(s) + '</option>';
    });
    styleSelect.innerHTML = styleHtml;
    styleSelect.value = currentStyle;
  }
}

function applyCounselorFilter(allCounselors) {
  var genderFilter = (document.getElementById('filter-gender') || {}).value || '';
  var roleFilter = (document.getElementById('filter-role') || {}).value || '';
  var styleFilter = (document.getElementById('filter-style') || {}).value || '';
  if (!genderFilter && !roleFilter && !styleFilter) return allCounselors;
  return allCounselors.filter(function (c) {
    if (genderFilter && c.gender !== genderFilter) return false;
    if (roleFilter && c.role !== roleFilter) return false;
    if (styleFilter && c.style !== styleFilter) return false;
    return true;
  });
}

function filterCounselors() {
  var config = loadNpcConfig();
  renderCounselorList(config);
}

function resetCounselorFilters() {
  var g = document.getElementById('filter-gender');
  var r = document.getElementById('filter-role');
  var s = document.getElementById('filter-style');
  if (g) g.value = '';
  if (r) r.value = '';
  if (s) s.value = '';
  filterCounselors();
}

// 展开/收起咨询师编辑面板
// ---- 通用 "..." 菜单切换 ----
function toggleCellMenu(btn) {
  var dropdown = btn.parentElement.querySelector('.cell-dropdown');
  document.querySelectorAll('.cell-dropdown.open').forEach(function (d) {
    if (d !== dropdown) d.classList.remove('open');
  });
  dropdown.classList.toggle('open');
}
document.addEventListener('click', function () {
  document.querySelectorAll('.cell-dropdown.open').forEach(function (d) {
    d.classList.remove('open');
  });
});

// ---- 立绘详情弹窗 ----
function openCounselorDetail(id) {
  var config = loadNpcConfig();
  var c = config.counselors.find(function (x) {
    return x.id === id;
  });
  if (!c) return;
  var isDefault = id === config.defaultCounselorId;
  document.getElementById('counselor-detail-title').textContent = c.name || '未命名';
  document.getElementById('counselor-detail-sub').textContent =
    (c.seq ? c.seq + ' · ' : '') + (isDefault ? '⭐ 当前默认立绘' : '咨询师立绘');
  document.getElementById('counselor-detail-seq').textContent = c.seq || '-';
  document.getElementById('counselor-detail-counselor').textContent = c.counselorName || '未设置';
  var genderMap = { female: '女', male: '男', '': '未设置' };
  document.getElementById('counselor-detail-gender').textContent = genderMap[c.gender || ''] || '未设置';
  document.getElementById('counselor-detail-style').textContent = c.style || '未设置';
  document.getElementById('counselor-detail-role').textContent = c.role || '未设置';
  document.getElementById('counselor-detail-motto').textContent = c.motto || '未设置';
  document.getElementById('counselor-detail-bio').textContent = c.bio || '未填写';
  document.getElementById('counselor-detail-time').textContent = c.uploadTime
    ? new Date(c.uploadTime).toLocaleString('zh-CN')
    : '未知';
  document.getElementById('counselor-detail-default-btn').style.display = isDefault ? 'none' : '';
  document.getElementById('counselor-detail-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // 填充大图
  AssetStorage.getCachedDataURL(id).then(function (url) {
    var img = document.getElementById('counselor-detail-img');
    var placeholder = document.getElementById('counselor-detail-placeholder');
    if (url) {
      img.src = url;
      img.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    } else {
      img.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';
    }
  });
  // 绑定弹窗内的按钮
  document.getElementById('counselor-detail-default-btn').onclick = function () {
    setDefaultCounselor(id);
    closeCounselorDetail();
  };
  document.getElementById('counselor-detail-edit-btn').onclick = function () {
    closeCounselorDetail();
    toggleCounselorEdit(id);
  };
  document.getElementById('counselor-detail-del-btn').onclick = function () {
    closeCounselorDetail();
    deleteCounselor(id);
  };
}

function closeCounselorDetail() {
  document.getElementById('counselor-detail-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// ---- 背景详情弹窗 ----
function openBackgroundDetail(id) {
  var config = loadNpcConfig();
  var b = config.backgrounds.find(function (x) {
    return x.id === id;
  });
  if (!b) return;
  var isDefault = id === config.defaultBackgroundId;
  document.getElementById('bg-detail-title').textContent = b.name || '未命名';
  document.getElementById('bg-detail-sub').textContent =
    (b.seq ? b.seq + ' · ' : '') + (isDefault ? '⭐ 当前默认背景' : '场景背景');
  document.getElementById('bg-detail-id').textContent = b.seq || b.id;
  document.getElementById('bg-detail-theme').textContent = b.theme || '未设置';
  document.getElementById('bg-detail-style').textContent = b.style || '未设置';
  document.getElementById('bg-detail-tone').textContent = b.tone || '未设置';
  document.getElementById('bg-detail-layout').textContent = b.layout || '未设置';
  document.getElementById('bg-detail-time').textContent = b.uploadTime
    ? new Date(b.uploadTime).toLocaleString('zh-CN')
    : '未知';
  document.getElementById('bg-detail-default-btn').style.display = isDefault ? 'none' : '';
  document.getElementById('bg-detail-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  AssetStorage.getCachedDataURL(id).then(function (url) {
    var img = document.getElementById('bg-detail-img');
    var placeholder = document.getElementById('bg-detail-placeholder');
    if (url) {
      img.src = url;
      img.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    } else {
      img.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';
    }
  });
  document.getElementById('bg-detail-default-btn').onclick = function () {
    setDefaultBackground(id);
    closeBackgroundDetail();
  };
  document.getElementById('bg-detail-edit-btn').onclick = function () {
    closeBackgroundDetail();
    toggleBgEdit(id);
  };
  document.getElementById('bg-detail-del-btn').onclick = function () {
    closeBackgroundDetail();
    deleteBackground(id);
  };
}

function closeBackgroundDetail() {
  document.getElementById('bg-detail-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function toggleCounselorEdit(id) {
  var config = loadNpcConfig();
  var c = config.counselors.find(function (x) {
    return x.id === id;
  });
  if (!c) {
    showToast('找不到该咨询师数据（id: ' + id + '），请刷新页面重试', 'error');
    return;
  }
  document.getElementById('npc-edit-modal').dataset.mode = 'edit';
  document.getElementById('npc-edit-id').value = id;
  document.getElementById('npc-edit-seq').value = c.seq || '';
  document.getElementById('npc-edit-cname').value = c.name || '未命名';
  document.getElementById('npc-edit-name').value = c.counselorName || '';
  document.getElementById('npc-edit-gender').value = c.gender || '';
  document.getElementById('npc-edit-motto').value = c.motto || '';
  document.getElementById('npc-edit-bio').value = c.bio || '';
  // 先填充下拉框选项，再设置值（确保旧值不在新列表时正确处理）
  refreshEditSelectOptions('role');
  refreshEditSelectOptions('style');
  document.getElementById('npc-edit-role').value = c.role || '';
  document.getElementById('npc-edit-style').value = c.style || '';
  document.getElementById('npc-edit-title').textContent =
    '✏️ 编辑咨询师' + (c.seq ? ' ' + c.seq : '') + '：' + (c.name || '未命名');
  // 加载图片预览
  var thumb = document.getElementById('npc-edit-img-thumb');
  var placeholder = document.getElementById('npc-edit-img-placeholder');
  AssetStorage.getCachedDataURL(id).then(function (url) {
    if (url) {
      thumb.src = url;
      thumb.style.display = 'block';
      placeholder.style.display = 'none';
      document.getElementById('npc-edit-img-preview').style.borderStyle = 'solid';
    } else {
      thumb.style.display = 'none';
      placeholder.style.display = '';
      document.getElementById('npc-edit-img-preview').style.borderStyle = 'dashed';
    }
  });
  document.getElementById('npc-edit-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeNpcEditModal() {
  var id = document.getElementById('npc-edit-id').value;
  var mode = document.getElementById('npc-edit-modal').dataset.mode || '';
  // 新建未保存时，清理临时图片资源
  if (mode === 'new' && id) {
    var config = loadNpcConfig();
    var exists = config.counselors.find(function (x) {
      return x.id === id;
    });
    if (!exists) {
      AssetStorage.revokeCache(id);
      AssetStorage.deleteImage(id);
    }
  }
  document.getElementById('npc-edit-modal').classList.remove('open');
  document.getElementById('npc-edit-modal').dataset.mode = '';
  document.body.style.overflow = '';
  document.getElementById('npc-edit-id').value = '';
  document.getElementById('npc-edit-seq').value = '';
  // 重置图片预览
  document.getElementById('npc-edit-img-thumb').style.display = 'none';
  document.getElementById('npc-edit-img-thumb').src = '';
  document.getElementById('npc-edit-img-placeholder').style.display = '';
  document.getElementById('npc-edit-img-placeholder').textContent = '📷';
  document.getElementById('npc-edit-img-preview').style.borderStyle = 'dashed';
}

// 保存咨询师信息（弹窗版）—— 兼容新建和编辑
function saveNpcEditModal() {
  var id = document.getElementById('npc-edit-id').value;
  if (!id) {
    console.warn('[NPC] id为空，退出');
    return;
  }

  var config = loadNpcConfig();
  // 用 data-mode 标记判断新建/编辑，不再依赖 ID 前缀（脏数据 ID 可能含 counselor_new_ 前缀）
  var editMode = document.getElementById('npc-edit-modal').dataset.mode || 'new';
  var isNew = editMode === 'new';
  var exists = config.counselors.find(function (x) {
    return x.id === id;
  });

  var seqVal = document.getElementById('npc-edit-seq').value || '';
  var nameVal = document.getElementById('npc-edit-name').value || '';
  var genderVal = document.getElementById('npc-edit-gender').value || '';
  var roleVal = document.getElementById('npc-edit-role').value || '';
  var styleVal = document.getElementById('npc-edit-style').value || '';
  var mottoVal = document.getElementById('npc-edit-motto').value || '';
  var bioVal = document.getElementById('npc-edit-bio').value || '';
  var cnameVal = document.getElementById('npc-edit-cname').value || '';

  // 校验编号
  var seqResult = _validateSeqInput(seqVal, 'ZXS', id, config.counselors);
  if (!seqResult.valid) {
    showToast(seqResult.msg, 'error');
    document.getElementById('npc-edit-seq').focus();
    return;
  }

  if (isNew) {
    // 新建模式：创建新记录
    var newCounselor = {
      id: id,
      seq: seqResult.seq,
      name: cnameVal.trim() || '未命名',
      counselorName: nameVal.trim(),
      gender: genderVal,
      role: roleVal.trim(),
      style: styleVal,
      motto: mottoVal.trim(),
      bio: bioVal.trim(),
      uploadTime: new Date().toISOString()
    };
    config.counselors.push(newCounselor);
    if (config.counselors.length === 1) {
      config.defaultCounselorId = id;
    }
  } else {
    // 编辑模式：更新已有记录
    var c = config.counselors.find(function (x) {
      return x.id === id;
    });
    c.seq = seqResult.seq;
    if (cnameVal.trim()) c.name = cnameVal.trim();
    c.counselorName = nameVal.trim();
    c.gender = genderVal;
    c.role = roleVal.trim();
    c.style = styleVal;
    c.motto = mottoVal.trim();
    c.bio = bioVal.trim();
  }

  saveNpcConfig(config);
  closeNpcEditModal();
  renderNpcConfig();
  showToast(isNew ? '新咨询师已创建' : '咨询师信息已保存', 'success');
}

// ===== 选项管理弹窗（身份/风格） =====
var _optionManagerType = ''; // 'role' 或 'style'

function openOptionManager(type) {
  _optionManagerType = type;
  var title = type === 'role' ? '管理身份选项' : '管理风格选项';
  document.getElementById('option-manager-title').textContent = title;
  renderOptionList();
  document.getElementById('option-manager-input').value = '';
  document.getElementById('option-manager-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeOptionManager() {
  document.getElementById('option-manager-modal').style.display = 'none';
  document.body.style.overflow = '';
  // 刷新编辑弹窗中的下拉框选项
  refreshEditSelectOptions(_optionManagerType);
}

function getOptionList(type) {
  var config = loadNpcConfig();
  return type === 'role'
    ? config.roleOptions || DEFAULT_NPC_CONFIG.roleOptions
    : config.styleOptions || DEFAULT_NPC_CONFIG.styleOptions;
}

function setOptionList(type, list) {
  var config = loadNpcConfig();
  if (type === 'role') {
    config.roleOptions = list;
  } else {
    config.styleOptions = list;
  }
  saveNpcConfig(config);
}

function renderOptionList() {
  var list = getOptionList(_optionManagerType);
  var container = document.getElementById('option-manager-list');
  if (list.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px">暂无选项，请在下方添加</div>';
    return;
  }
  container.innerHTML = list
    .map(function (item, idx) {
      return (
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg);border-radius:8px;border:1px solid var(--border);">' +
        '<span style="flex:1;font-size:13px;color:var(--text);">' +
        escHtml(item) +
        '</span>' +
        '<button onclick="editOptionItem(' +
        idx +
        ')" style="width:28px;height:28px;border:1px solid var(--border);border-radius:6px;background:var(--card);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;" title="编辑">✏️</button>' +
        '<button onclick="deleteOptionItem(' +
        idx +
        ')" style="width:28px;height:28px;border:1px solid var(--border);border-radius:6px;background:var(--card);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;" title="删除">🗑️</button>' +
        '</div>'
      );
    })
    .join('');
}

function addOptionItem() {
  var input = document.getElementById('option-manager-input');
  var val = input.value.trim();
  if (!val) return;
  var list = getOptionList(_optionManagerType);
  if (list.indexOf(val) !== -1) {
    showToast('该选项已存在', 'error');
    return;
  }
  list.push(val);
  setOptionList(_optionManagerType, list);
  input.value = '';
  renderOptionList();
}

function editOptionItem(idx) {
  var list = getOptionList(_optionManagerType);
  var oldVal = list[idx];
  // 使用内联编辑：替换该行为 input
  var container = document.getElementById('option-manager-list');
  var rows = container.children;
  if (!rows[idx]) return;
  rows[idx].innerHTML =
    '<input type="text" id="option-edit-' +
    idx +
    '" class="form-control" style="flex:1;height:32px;font-size:13px" value="' +
    escHtml(oldVal) +
    '" />' +
    '<button onclick="confirmEditOptionItem(' +
    idx +
    ')" style="width:28px;height:28px;border:1px solid #52c41a;border-radius:6px;background:var(--card);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;color:#52c41a;" title="确认">✓</button>' +
    '<button onclick="renderOptionList()" style="width:28px;height:28px;border:1px solid var(--border);border-radius:6px;background:var(--card);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;" title="取消">✕</button>';
  var editInput = document.getElementById('option-edit-' + idx);
  if (editInput) {
    editInput.focus();
    editInput.select();
    editInput.onkeydown = function (e) {
      if (e.key === 'Enter') confirmEditOptionItem(idx);
      if (e.key === 'Escape') renderOptionList();
    };
  }
}

function confirmEditOptionItem(idx) {
  var editInput = document.getElementById('option-edit-' + idx);
  if (!editInput) return;
  var newVal = editInput.value.trim();
  if (!newVal) {
    showToast('选项不能为空', 'error');
    return;
  }
  var list = getOptionList(_optionManagerType);
  var dupIdx = list.indexOf(newVal);
  if (dupIdx !== -1 && dupIdx !== idx) {
    showToast('该选项已存在', 'error');
    return;
  }
  list[idx] = newVal;
  setOptionList(_optionManagerType, list);
  renderOptionList();
}

function deleteOptionItem(idx) {
  var list = getOptionList(_optionManagerType);
  if (list.length <= 1) {
    showToast('至少保留一个选项', 'error');
    return;
  }
  list.splice(idx, 1);
  setOptionList(_optionManagerType, list);
  renderOptionList();
}

function refreshEditSelectOptions(type) {
  var config = loadNpcConfig();
  var list =
    type === 'role'
      ? config.roleOptions || DEFAULT_NPC_CONFIG.roleOptions
      : config.styleOptions || DEFAULT_NPC_CONFIG.styleOptions;
  var selId = type === 'role' ? 'npc-edit-role' : 'npc-edit-style';
  var sel = document.getElementById(selId);
  if (!sel) return;
  var currentVal = sel.value;
  sel.innerHTML = '<option value="">请选择</option>';
  list.forEach(function (item) {
    sel.innerHTML += '<option value="' + escHtml(item) + '">' + escHtml(item) + '</option>';
  });
  // 如果当前值不在新列表中，清空；否则保留
  if (list.indexOf(currentVal) !== -1) {
    sel.value = currentVal;
  }
}

function addCounselor() {
  // 新建模式：先打开空编辑弹窗，用户在弹窗内上传图片 + 填写信息
  var tempId = 'counselor_new_' + Date.now();
  document.getElementById('npc-edit-modal').dataset.mode = 'new';
  document.getElementById('npc-edit-id').value = tempId;
  document.getElementById('npc-edit-seq').value = '';
  document.getElementById('npc-edit-cname').value = '';
  document.getElementById('npc-edit-name').value = '';
  document.getElementById('npc-edit-gender').value = '';
  document.getElementById('npc-edit-role').value = '';
  document.getElementById('npc-edit-style').value = '';
  document.getElementById('npc-edit-motto').value = '';
  document.getElementById('npc-edit-bio').value = '';
  refreshEditSelectOptions('role');
  refreshEditSelectOptions('style');
  document.getElementById('npc-edit-title').textContent = '✨ 新增咨询师';
  // 重置图片预览
  var thumb = document.getElementById('npc-edit-img-thumb');
  var placeholder = document.getElementById('npc-edit-img-placeholder');
  thumb.style.display = 'none';
  thumb.src = '';
  placeholder.style.display = '';
  placeholder.textContent = '📷';
  document.getElementById('npc-edit-img-preview').style.borderStyle = 'dashed';
  document.getElementById('npc-edit-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// 上传图片（弹窗内，新建或编辑模式通用）
function handleNpcEditImgUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast('图片大小不能超过10MB', 'error');
    event.target.value = '';
    return;
  }
  var id = document.getElementById('npc-edit-id').value;
  if (!id) return;
  var mode = document.getElementById('npc-edit-modal').dataset.mode || '';
  console.log('[NPC] 图片上传: mode=' + mode + ', id=' + id);
  // 将文件转为 base64 后存入 IndexedDB（用于云端同步）
  var reader = new FileReader();
  reader.onload = function (e) {
    var base64 = e.target.result;
    // 再次检查 id 没有在上传过程中被改变
    var currentId = document.getElementById('npc-edit-id').value;
    if (currentId !== id) {
      console.error('[NPC] 图片上传完成时 id 已变更: ' + id + ' → ' + currentId);
      showToast('上传异常，请关闭弹窗重试', 'error');
      return;
    }
    AssetStorage.saveImageWithBase64(id, file, base64)
      .then(function () {
        var thumb = document.getElementById('npc-edit-img-thumb');
        var placeholder = document.getElementById('npc-edit-img-placeholder');
        var url = URL.createObjectURL(file);
        thumb.src = url;
        thumb.style.display = 'block';
        placeholder.style.display = 'none';
        document.getElementById('npc-edit-img-preview').style.borderStyle = 'solid';
        // 自动填充立绘名称（仅编辑弹窗内）
        var cnameInput = document.getElementById('npc-edit-cname');
        if (!cnameInput.value.trim()) {
          cnameInput.value = file.name.replace(/\.[^.]+$/, '');
        }
        showToast('立绘图片已上传', 'success');
        event.target.value = '';
      })
      .catch(function (err) {
        console.error('立绘图片上传失败:', err);
        showToast('上传失败，请重试', 'error');
        event.target.value = '';
      });
  };
  reader.readAsDataURL(file);
}

function setDefaultCounselor(id) {
  const config = loadNpcConfig();
  config.defaultCounselorId = id;
  saveNpcConfig(config);
  renderNpcConfig();
}

function deleteCounselor(id) {
  const config = loadNpcConfig();
  const c = config.counselors.find((x) => x.id === id);
  if (!c) return;

  // 检查是否有量表引用
  const refScales = scales.filter((s) => s.npcConfig && s.npcConfig.counselorId === id);
  if (refScales.length > 0) {
    showToast('该立绘正在被 ' + refScales.length + ' 个量表使用，无法删除', 'error');
    return;
  }

  config.counselors = config.counselors.filter((x) => x.id !== id);
  if (config.defaultCounselorId === id) {
    config.defaultCounselorId = config.counselors.length > 0 ? config.counselors[0].id : '';
  }
  saveNpcConfig(config);
  // 删除 IndexedDB 中的图片并释放缓存
  AssetStorage.revokeCache(id);
  AssetStorage.deleteImage(id);
  renderNpcConfig();
}

// ===== 背景管理 =====
function renderBackgroundList(config) {
  const container = document.getElementById('background-list');
  const countEl = document.getElementById('background-count');
  const filterBar = document.getElementById('background-filter-bar');
  if (!container) return;

  const allBackgrounds = config.backgrounds || [];
  countEl.textContent = '(' + allBackgrounds.length + '个)';

  // 有数据才显示筛选栏
  if (filterBar) {
    filterBar.style.display = allBackgrounds.length > 0 ? 'flex' : 'none';
  }

  // 动态更新主题筛选选项
  updateBgFilterThemeOptions(allBackgrounds);

  // 应用筛选
  const filtered = applyBackgroundFilter(allBackgrounds);

  // 排序
  var bgSortMode = (document.getElementById('bg-filter-sort') || {}).value || 'seq';
  if (bgSortMode === 'seq') {
    filtered.sort(function (a, b) {
      var na = parseInt((a.seq || 'CJ-9999').replace('CJ-', ''), 10);
      var nb = parseInt((b.seq || 'CJ-9999').replace('CJ-', ''), 10);
      return na - nb;
    });
  } else {
    filtered.sort(function (a, b) {
      return new Date(b.uploadTime || 0) - new Date(a.uploadTime || 0);
    });
  }

  if (allBackgrounds.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="padding:30px 10px"><div style="font-size:32px;margin-bottom:6px">🏠</div><div style="font-size:13px;color:var(--text-muted)">暂无背景素材，点击右侧 + 上传</div></div>' +
      '<div class="asset-cell bg-cell upload-cell" onclick="addBackground()"><div class="upload-icon">+</div><div class="upload-text">上传背景</div></div>';
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="padding:30px 10px"><div style="font-size:32px;margin-bottom:6px">🔍</div><div style="font-size:13px;color:var(--text-muted)">没有符合条件的背景</div></div>';
    return;
  }

  var html = filtered
    .map(function (b) {
      var isDefault = b.id === config.defaultBackgroundId;
      var safeName = (b.name || '未命名').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return (
        '<div class="asset-cell bg-cell' +
        (isDefault ? ' is-default' : '') +
        '" id="asset-' +
        b.id +
        '" onclick="openBackgroundDetail(\'' +
        b.id +
        '\')">' +
        (isDefault ? '<span class="cell-default-tag">⭐ 默认</span>' : '') +
        '<span class="cell-seq-tag">' +
        (b.seq || '') +
        '</span>' +
        '<button class="cell-menu-btn" onclick="event.stopPropagation();toggleCellMenu(this)">···</button>' +
        '<div class="cell-dropdown">' +
        '<button class="dropdown-item" onclick="event.stopPropagation();toggleBgEdit(\'' +
        b.id +
        '\')">✏️ 编辑信息</button>' +
        (!isDefault
          ? '<button class="dropdown-item" onclick="event.stopPropagation();setDefaultBackground(\'' +
            b.id +
            '\')">⭐ 设为默认</button>'
          : '') +
        '<button class="dropdown-item danger" onclick="event.stopPropagation();deleteBackground(\'' +
        b.id +
        '\')">🗑️ 删除背景</button>' +
        '</div>' +
        '<img id="thumb-' +
        b.id +
        '" class="cell-img" src="" alt="' +
        safeName +
        '" style="display:none" />' +
        '<span id="thumb-placeholder-' +
        b.id +
        '" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:36px;background:var(--bg)">🏔️</span>' +
        '<div class="cell-bottom-bar"><div class="cell-name">' +
        (b.seq
          ? '<span style="font-family:monospace;font-size:10px;opacity:0.8;margin-right:4px;">' +
            escHtml(b.seq) +
            '</span>'
          : '') +
        (b.name || '未命名') +
        '</div></div>' +
        '</div>'
      );
    })
    .join('');

  // 上传块
  html +=
    '<div class="asset-cell bg-cell upload-cell" onclick="addBackground()"><div class="upload-icon">+</div><div class="upload-text">上传背景</div></div>';

  container.innerHTML = html;

  // 异步填充缩略图
  filtered.forEach(function (b) {
    AssetStorage.getCachedDataURL(b.id).then(function (url) {
      if (!url) return;
      var img = document.getElementById('thumb-' + b.id);
      var placeholder = document.getElementById('thumb-placeholder-' + b.id);
      if (img) {
        img.src = url;
        img.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
    });
  });
}

// ---- 背景筛选 ----
function updateBgFilterThemeOptions(allBackgrounds) {
  var themeSelect = document.getElementById('bg-filter-theme');
  if (!themeSelect) return;
  var currentVal = themeSelect.value;
  var themes = [];
  allBackgrounds.forEach(function (b) {
    if (b.theme && themes.indexOf(b.theme) === -1) themes.push(b.theme);
  });
  themes.sort();
  var html = '<option value="">全部主题</option>';
  themes.forEach(function (t) {
    html += '<option value="' + t.replace(/"/g, '&quot;') + '">' + t + '</option>';
  });
  themeSelect.innerHTML = html;
  themeSelect.value = currentVal;
}

function applyBackgroundFilter(allBackgrounds) {
  var themeFilter = (document.getElementById('bg-filter-theme') || {}).value || '';
  var styleFilter = (document.getElementById('bg-filter-style') || {}).value || '';
  var toneFilter = (document.getElementById('bg-filter-tone') || {}).value || '';
  var layoutFilter = (document.getElementById('bg-filter-layout') || {}).value || '';
  if (!themeFilter && !styleFilter && !toneFilter && !layoutFilter) return allBackgrounds;
  return allBackgrounds.filter(function (b) {
    if (themeFilter && b.theme !== themeFilter) return false;
    if (styleFilter && b.style !== styleFilter) return false;
    if (toneFilter && b.tone !== toneFilter) return false;
    if (layoutFilter && b.layout !== layoutFilter) return false;
    return true;
  });
}

function filterBackgrounds() {
  var config = loadNpcConfig();
  renderBackgroundList(config);
}

function resetBackgroundFilters() {
  var t = document.getElementById('bg-filter-theme');
  var s = document.getElementById('bg-filter-style');
  var tn = document.getElementById('bg-filter-tone');
  var l = document.getElementById('bg-filter-layout');
  if (t) t.value = '';
  if (s) s.value = '';
  if (tn) tn.value = '';
  if (l) l.value = '';
  filterBackgrounds();
}

function addBackground() {
  // 新建模式：打开空编辑弹窗
  var tempId = 'bg_new_' + Date.now();
  document.getElementById('bg-edit-modal').dataset.mode = 'new';
  document.getElementById('bg-edit-id').value = tempId;
  document.getElementById('bg-edit-seq').value = '';
  document.getElementById('bg-edit-cname').value = '';
  document.getElementById('bg-edit-theme').value = '';
  document.getElementById('bg-edit-style').value = '';
  document.getElementById('bg-edit-tone').value = '';
  document.getElementById('bg-edit-layout').value = '';
  document.getElementById('bg-edit-title').textContent = '✨ 新增场景背景';
  // 重置图片预览
  var thumb = document.getElementById('bg-edit-img-thumb');
  var placeholder = document.getElementById('bg-edit-img-placeholder');
  thumb.style.display = 'none';
  thumb.src = '';
  placeholder.style.display = '';
  placeholder.textContent = '📷';
  document.getElementById('bg-edit-img-preview').style.borderStyle = 'dashed';
  document.getElementById('bg-edit-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function handleBgEditImgUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast('图片大小不能超过10MB', 'error');
    event.target.value = '';
    return;
  }
  var id = document.getElementById('bg-edit-id').value;
  if (!id) return;
  var mode = document.getElementById('bg-edit-modal').dataset.mode || '';
  console.log('[NPC] 背景图片上传: mode=' + mode + ', id=' + id);
  // 将文件转为 base64 后存入 IndexedDB（用于云端同步）
  var reader = new FileReader();
  reader.onload = function (e) {
    var base64 = e.target.result;
    // 再次检查 id 没有在上传过程中被改变
    var currentId = document.getElementById('bg-edit-id').value;
    if (currentId !== id) {
      console.error('[NPC] 背景图片上传完成时 id 已变更: ' + id + ' → ' + currentId);
      showToast('上传异常，请关闭弹窗重试', 'error');
      return;
    }
    AssetStorage.saveImageWithBase64(id, file, base64)
      .then(function () {
        var thumb = document.getElementById('bg-edit-img-thumb');
        var placeholder = document.getElementById('bg-edit-img-placeholder');
        var url = URL.createObjectURL(file);
        thumb.src = url;
        thumb.style.display = 'block';
        placeholder.style.display = 'none';
        document.getElementById('bg-edit-img-preview').style.borderStyle = 'solid';
        // 自动填充背景名称
        var cnameInput = document.getElementById('bg-edit-cname');
        if (!cnameInput.value.trim()) {
          cnameInput.value = file.name.replace(/\.[^.]+$/, '');
        }
        showToast('背景图片已上传', 'success');
        event.target.value = '';
      })
      .catch(function (err) {
        console.error('背景图片上传失败:', err);
        showToast('上传失败，请重试', 'error');
        event.target.value = '';
      });
  };
  reader.readAsDataURL(file);
}

function toggleBgEdit(id) {
  var config = loadNpcConfig();
  var b = config.backgrounds.find(function (x) {
    return x.id === id;
  });
  if (!b) {
    showToast('找不到该背景数据（id: ' + id + '），请刷新页面重试', 'error');
    return;
  }
  document.getElementById('bg-edit-modal').dataset.mode = 'edit';
  document.getElementById('bg-edit-id').value = id;
  document.getElementById('bg-edit-seq').value = b.seq || '';
  document.getElementById('bg-edit-cname').value = b.name || '';
  document.getElementById('bg-edit-theme').value = b.theme || '';
  document.getElementById('bg-edit-style').value = b.style || '';
  document.getElementById('bg-edit-tone').value = b.tone || '';
  document.getElementById('bg-edit-layout').value = b.layout || '';
  document.getElementById('bg-edit-title').textContent =
    '✏️ 编辑背景' + (b.seq ? ' ' + b.seq : '') + '：' + (b.name || '未命名');
  // 加载图片预览
  var thumb = document.getElementById('bg-edit-img-thumb');
  var placeholder = document.getElementById('bg-edit-img-placeholder');
  AssetStorage.getCachedDataURL(id).then(function (url) {
    if (url) {
      thumb.src = url;
      thumb.style.display = 'block';
      placeholder.style.display = 'none';
      document.getElementById('bg-edit-img-preview').style.borderStyle = 'solid';
    } else {
      thumb.style.display = 'none';
      thumb.src = '';
      placeholder.style.display = '';
      document.getElementById('bg-edit-img-preview').style.borderStyle = 'dashed';
    }
  });
  document.getElementById('bg-edit-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBgEditModal() {
  var id = document.getElementById('bg-edit-id').value;
  var mode = document.getElementById('bg-edit-modal').dataset.mode || '';
  // 新建未保存时，清理临时图片资源
  if (mode === 'new' && id) {
    var config = loadNpcConfig();
    var exists = config.backgrounds.find(function (x) {
      return x.id === id;
    });
    if (!exists) {
      AssetStorage.revokeCache(id);
      AssetStorage.deleteImage(id);
    }
  }
  document.getElementById('bg-edit-modal').classList.remove('open');
  document.getElementById('bg-edit-modal').dataset.mode = '';
  document.body.style.overflow = '';
  document.getElementById('bg-edit-id').value = '';
  document.getElementById('bg-edit-seq').value = '';
  document.getElementById('bg-edit-img-thumb').style.display = 'none';
  document.getElementById('bg-edit-img-thumb').src = '';
  document.getElementById('bg-edit-img-placeholder').style.display = '';
  document.getElementById('bg-edit-img-placeholder').textContent = '📷';
  document.getElementById('bg-edit-img-preview').style.borderStyle = 'dashed';
}

function saveBgEditModal() {
  var id = document.getElementById('bg-edit-id').value;
  if (!id) return;
  var seqVal = document.getElementById('bg-edit-seq').value || '';
  var cnameVal = document.getElementById('bg-edit-cname').value || '';
  var themeVal = document.getElementById('bg-edit-theme').value || '';
  var styleVal = document.getElementById('bg-edit-style').value || '';
  var toneVal = document.getElementById('bg-edit-tone').value || '';
  var layoutVal = document.getElementById('bg-edit-layout').value || '';

  var config = loadNpcConfig();
  // 用 data-mode 标记判断新建/编辑，不再依赖 ID 前缀
  var editMode = document.getElementById('bg-edit-modal').dataset.mode || 'new';
  var isNew = editMode === 'new';
  var exists = config.backgrounds.find(function (x) {
    return x.id === id;
  });

  // 校验编号
  var seqResult = _validateSeqInput(seqVal, 'CJ', id, config.backgrounds);
  if (!seqResult.valid) {
    showToast(seqResult.msg, 'error');
    document.getElementById('bg-edit-seq').focus();
    return;
  }

  if (isNew) {
    // 新建模式
    config.backgrounds.push({
      id: id,
      seq: seqResult.seq,
      name: cnameVal.trim() || '未命名',
      theme: themeVal.trim(),
      style: styleVal,
      tone: toneVal,
      layout: layoutVal,
      uploadTime: new Date().toISOString()
    });
    if (config.backgrounds.length === 1) {
      config.defaultBackgroundId = id;
    }
  } else {
    // 编辑模式
    var b = config.backgrounds.find(function (x) {
      return x.id === id;
    });
    if (!b) return;
    b.seq = seqResult.seq;
    if (cnameVal.trim()) b.name = cnameVal.trim();
    b.theme = themeVal.trim();
    b.style = styleVal;
    b.tone = toneVal;
    b.layout = layoutVal;
  }

  saveNpcConfig(config);
  closeBgEditModal();
  renderNpcConfig();
  showToast(isNew ? '新背景已创建' : '背景信息已保存', 'success');
}

function setDefaultBackground(id) {
  const config = loadNpcConfig();
  config.defaultBackgroundId = id;
  saveNpcConfig(config);
  renderNpcConfig();
}

function deleteBackground(id) {
  const config = loadNpcConfig();
  const b = config.backgrounds.find((x) => x.id === id);
  if (!b) return;

  const refScales = scales.filter((s) => s.npcConfig && s.npcConfig.backgroundId === id);
  if (refScales.length > 0) {
    showToast('该背景正在被 ' + refScales.length + ' 个量表使用，无法删除', 'error');
    return;
  }

  config.backgrounds = config.backgrounds.filter((x) => x.id !== id);
  if (config.defaultBackgroundId === id) {
    config.defaultBackgroundId = config.backgrounds.length > 0 ? config.backgrounds[0].id : '';
  }
  saveNpcConfig(config);
  // 删除 IndexedDB 中的图片并释放缓存
  AssetStorage.revokeCache(id);
  AssetStorage.deleteImage(id);
  renderNpcConfig();
}

// ===== 过渡语管理 =====
var _transitionAllData = []; // 缓存全量数据用于筛选

function normalizeTransitions(config) {
  // 确保 transitions 都是对象格式
  if (!config.transitions) config.transitions = [];
  config.transitions = config.transitions.map(function (t) {
    return typeof t === 'string'
      ? { text: t, phase: '全部阶段' }
      : { text: t.text || '', phase: t.phase || '全部阶段' };
  });
}

function renderTransitionList(config) {
  const container = document.getElementById('transition-list');
  const countEl = document.getElementById('transition-count');
  const filterBar = document.getElementById('transition-filter-bar');
  if (!container) return;

  normalizeTransitions(config);
  _transitionAllData = config.transitions;
  countEl.textContent = '(' + config.transitions.length + '条)';

  // 筛选栏：有数据时显示
  if (filterBar) filterBar.style.display = config.transitions.length > 0 ? 'flex' : 'none';

  if (config.transitions.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="padding:20px 10px;grid-column:1/-1"><div style="font-size:24px;margin-bottom:4px">💬</div><div style="font-size:13px;color:var(--text-muted)">暂无过渡语</div></div>';
    return;
  }

  applyTransitionFilter();
}

function applyTransitionFilter() {
  var phaseVal = document.getElementById('trans-filter-phase').value;
  var filtered = _transitionAllData;
  if (phaseVal) {
    filtered = _transitionAllData.filter(function (t) {
      return t.phase === phaseVal;
    });
  }

  var container = document.getElementById('transition-list');
  if (filtered.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="padding:20px 10px;grid-column:1/-1"><div style="font-size:13px;color:var(--text-muted)">没有匹配的过渡语</div></div>';
    return;
  }

  container.innerHTML = filtered
    .map(function (t, displayIdx) {
      // 找到在 _transitionAllData 中的真实索引
      var realIdx = _transitionAllData.indexOf(t);
      var phaseTag = '';
      if (t.phase && t.phase !== '全部阶段') {
        var phaseColor = t.phase === '开始阶段' ? '#52c41a' : t.phase === '中间阶段' ? '#4A90D9' : '#faad14';
        phaseTag =
          '<span style="font-size:10px;padding:1px 5px;border-radius:3px;background:' +
          phaseColor +
          '22;color:' +
          phaseColor +
          ';flex-shrink:0;white-space:nowrap;">' +
          t.phase +
          '</span>';
      }
      return (
        '<div class="transition-item">' +
        '<span class="transition-num">' +
        (displayIdx + 1) +
        '</span>' +
        '<span class="transition-text" onclick="openTransitionEdit(' +
        realIdx +
        ')" title="' +
        t.text.replace(/"/g, '&quot;') +
        '">' +
        t.text +
        '</span>' +
        phaseTag +
        '<span class="transition-actions">' +
        '<button class="transition-edit" onclick="openTransitionEdit(' +
        realIdx +
        ')" title="编辑">✏️</button>' +
        '<button class="transition-del" onclick="deleteTransition(' +
        realIdx +
        ')" title="删除">✕</button>' +
        '</span>' +
        '</div>'
      );
    })
    .join('');
}

function filterTransitions() {
  applyTransitionFilter();
}

function resetTransitionFilters() {
  document.getElementById('trans-filter-phase').value = '';
  applyTransitionFilter();
}

function openTransitionModal() {
  var modal = document.getElementById('transition-modal');
  var textarea = document.getElementById('transition-batch-input');
  textarea.value = '';
  modal.style.display = 'flex';
  setTimeout(function () {
    textarea.focus();
  }, 100);
}

function closeTransitionModal() {
  document.getElementById('transition-modal').style.display = 'none';
}

// ===== 过渡语编辑弹窗 =====
var _transitionEditIndex = -1;

function openTransitionEdit(index) {
  var config = loadNpcConfig();
  normalizeTransitions(config);
  var item = config.transitions[index];
  if (!item) return;
  _transitionEditIndex = index;
  document.getElementById('transition-edit-input').value = item.text || '';
  document.getElementById('transition-edit-phase').value = item.phase || '全部阶段';
  document.getElementById('transition-edit-modal').style.display = 'flex';
  setTimeout(function () {
    var el = document.getElementById('transition-edit-input');
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, 100);
}

function closeTransitionEditModal() {
  document.getElementById('transition-edit-modal').style.display = 'none';
  _transitionEditIndex = -1;
}

function saveTransitionEdit() {
  if (_transitionEditIndex < 0) return;
  var text = document.getElementById('transition-edit-input').value.trim();
  if (!text) {
    showToast('过渡语内容不能为空', 'error');
    return;
  }
  var phase = document.getElementById('transition-edit-phase').value;
  var config = loadNpcConfig();
  normalizeTransitions(config);
  // 检查是否与其他条目重复（排除自身）
  var dup = config.transitions.some(function (t, i) {
    return i !== _transitionEditIndex && t.text === text;
  });
  if (dup) {
    showToast('该过渡语已存在，请修改内容', 'warning');
    return;
  }
  config.transitions[_transitionEditIndex] = { text: text, phase: phase };
  saveNpcConfig(config);
  renderNpcConfig();
  closeTransitionEditModal();
  showToast('过渡语已更新', 'success');
}

function deleteTransitionFromEdit() {
  if (_transitionEditIndex < 0) return;
  var config = loadNpcConfig();
  normalizeTransitions(config);
  if (config.transitions.length <= 3) {
    showToast('过渡语至少保留3条', 'error');
    return;
  }
  config.transitions.splice(_transitionEditIndex, 1);
  saveNpcConfig(config);
  renderNpcConfig();
  closeTransitionEditModal();
  showToast('已删除', 'success');
}

function addTransitionFromModal() {
  const textarea = document.getElementById('transition-batch-input');
  const text = textarea.value.trim();
  if (!text) {
    showToast('请输入至少一条过渡语', 'error');
    textarea.focus();
    return;
  }
  const config = loadNpcConfig();
  normalizeTransitions(config);
  const lines = text
    .split('\n')
    .map(function (l) {
      return l.trim();
    })
    .filter(function (l) {
      return l.length > 0;
    });
  if (lines.length === 0) {
    showToast('请输入至少一条过渡语', 'error');
    return;
  }
  const existing = config.transitions || [];
  const added = [];
  const skipped = [];
  lines.forEach(function (line) {
    var dup = existing.some(function (t) {
      return t.text === line;
    });
    if (dup) {
      skipped.push(line);
    } else {
      existing.push({ text: line, phase: '全部阶段' });
      added.push(line);
    }
  });
  config.transitions = existing;
  saveNpcConfig(config);
  renderNpcConfig();
  closeTransitionModal();
  if (skipped.length > 0) {
    showToast('已添加 ' + added.length + ' 条，跳过 ' + skipped.length + ' 条重复', 'warning');
  } else {
    showToast('已添加 ' + added.length + ' 条过渡语', 'success');
  }
}

function deleteTransition(index) {
  const config = loadNpcConfig();
  normalizeTransitions(config);
  if (config.transitions.length <= 3) {
    showToast('过渡语至少保留3条', 'error');
    return;
  }
  config.transitions.splice(index, 1);
  saveNpcConfig(config);
  renderNpcConfig();
}

// 过渡语弹窗：Ctrl+Enter / Cmd+Enter 快捷提交
document.addEventListener('DOMContentLoaded', function () {
  var transModal = document.getElementById('transition-batch-input');
  if (transModal) {
    transModal.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        addTransitionFromModal();
      }
    });
  }
  // 点击遮罩关闭弹窗
  var modal = document.getElementById('transition-modal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeTransitionModal();
    });
  }
  var editModal = document.getElementById('transition-edit-modal');
  if (editModal) {
    editModal.addEventListener('click', function (e) {
      if (e.target === editModal) closeTransitionEditModal();
    });
    var editInput = document.getElementById('transition-edit-input');
    if (editInput) {
      editInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          saveTransitionEdit();
        }
      });
    }
  }
});

// ===== 量表编辑弹窗中的素材选择 =====
function refreshCounselorOptions() {
  const sel = document.getElementById('f-npc-counselor');
  if (!sel) return;
  const config = loadNpcConfig();
  const counselors = config.counselors || [];
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">使用全局默认</option>';
  counselors.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = (c.counselorName || c.name) + (c.id === config.defaultCounselorId ? ' ⭐默认' : '');
    sel.appendChild(opt);
  });
  sel.value = currentVal;
  sel.onchange = updateNpcSelectPreview;
  updateNpcSelectPreview();
}

function refreshBackgroundOptions() {
  const sel = document.getElementById('f-npc-bg');
  if (!sel) return;
  const config = loadNpcConfig();
  const backgrounds = config.backgrounds || [];
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">使用全局默认</option>';
  backgrounds.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.name + (b.id === config.defaultBackgroundId ? ' ⭐默认' : '');
    sel.appendChild(opt);
  });
  sel.value = currentVal;
  sel.onchange = updateNpcSelectPreview;
  updateNpcSelectPreview();
}

function updateNpcSelectPreview() {
  const config = loadNpcConfig();
  const counselorId = (document.getElementById('f-npc-counselor') || {}).value || '';
  const bgId = (document.getElementById('f-npc-bg') || {}).value || '';
  const cpEl = document.getElementById('npc-counselor-preview');
  const bpEl = document.getElementById('npc-bg-preview');

  if (cpEl) {
    if (counselorId) {
      const c = (config.counselors || []).find((x) => x.id === counselorId);
      cpEl.innerHTML = c
        ? '已选：<strong style="color:var(--primary)">' + (c.counselorName || c.name) + '</strong>'
        : '';
    } else {
      cpEl.innerHTML = '将使用全局默认立绘';
    }
  }
  if (bpEl) {
    if (bgId) {
      const b = (config.backgrounds || []).find((x) => x.id === bgId);
      bpEl.innerHTML = b ? '已选：<strong style="color:var(--primary)">' + b.name + '</strong>' : '';
    } else {
      bpEl.innerHTML = '将使用全局默认背景';
    }
  }

  // 同步更新编辑弹窗内的配置卡片和预览
  updateEditNpcCards(config);
  updateEditPreview(config);
}

// ===== 编辑弹窗内的素材选择器 =====
var _editCounselorTempId = ''; // 临时选中（弹窗内点击但未确认）
var _editBgTempId = '';

function openEditCounselorPicker() {
  var config = loadNpcConfig();
  var currentVal = document.getElementById('f-npc-counselor').value || '';
  _editCounselorTempId = currentVal;
  // 填充身份筛选
  var roleSelect = document.getElementById('edit-cp-role');
  var roles = config.roleOptions || DEFAULT_NPC_CONFIG.roleOptions;
  roleSelect.innerHTML = '<option value="">全部身份</option>';
  roles.forEach(function (r) {
    roleSelect.innerHTML += '<option value="' + escHtml(r) + '">' + escHtml(r) + '</option>';
  });
  // 清空搜索
  document.getElementById('edit-cp-search').value = '';
  document.getElementById('edit-cp-gender').value = '';
  document.getElementById('edit-cp-role').value = '';
  // 渲染列表
  renderEditCounselorGrid(config);
  // 显示弹窗
  document.getElementById('edit-counselor-picker').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeEditCounselorPicker() {
  document.getElementById('edit-counselor-picker').style.display = 'none';
  document.body.style.overflow = '';
}

function renderEditCounselorGrid(config) {
  var container = document.getElementById('edit-cp-grid');
  var counselors = config.counselors || [];
  var search = (document.getElementById('edit-cp-search').value || '').trim().toLowerCase();
  var gender = document.getElementById('edit-cp-gender').value;
  var role = document.getElementById('edit-cp-role').value;

  var filtered = counselors.filter(function (c) {
    if (search && (c.name || '').toLowerCase().indexOf(search) === -1) return false;
    if (gender && c.gender !== gender) return false;
    if (role && c.role !== role) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;padding:40px 10px;color:var(--text-muted);font-size:13px">🔍 暂无匹配的咨询师素材<br><span style="font-size:11px">请先在「NPC场景配置」中上传立绘</span></div>';
    return;
  }

  container.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px">' +
    filtered
      .map(function (c) {
        var sel = c.id === _editCounselorTempId;
        var isDefault = c.id === config.defaultCounselorId;
        var style = c.gender === 'male' ? '#e8fde8' : '#e8f4fd';
        var emoji = c.gender === 'male' ? '👨‍⚕️' : '👩‍⚕️';
        return (
          '<div class="edit-picker-card' +
          (sel ? ' selected' : '') +
          '" data-id="' +
          c.id +
          '" onclick="selectEditCounselor(\'' +
          c.id +
          '\')">' +
          (isDefault ? '<span class="edit-picker-default">默认</span>' : '') +
          (sel ? '<span class="edit-picker-check">✓</span>' : '') +
          '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:' +
          style +
          ';font-size:28px">' +
          emoji +
          '</div>' +
          '<div class="edit-picker-label"><span>' +
          (c.counselorName || c.name || '未命名') +
          '</span></div>' +
          '</div>'
        );
      })
      .join('') +
    '</div>';

  // 异步填充真实缩略图
  filtered.forEach(function (c) {
    AssetStorage.getCachedDataURL(c.id).then(function (url) {
      if (!url) return;
      var card = document.querySelector('.edit-picker-card[data-id="' + c.id + '"]');
      if (card) {
        var img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;z-index:1';
        card.style.position = 'relative';
        card.insertBefore(img, card.firstChild);
      }
    });
  });
}

function selectEditCounselor(id) {
  _editCounselorTempId = id;
  document.querySelectorAll('#edit-cp-grid .edit-picker-card').forEach(function (card) {
    card.classList.toggle('selected', card.getAttribute('data-id') === id);
    // 更新勾选图标
    var existing = card.querySelector('.edit-picker-check');
    if (existing) existing.remove();
    if (card.getAttribute('data-id') === id) {
      var check = document.createElement('span');
      check.className = 'edit-picker-check';
      check.textContent = '✓';
      card.appendChild(check);
    }
  });
}

function filterEditCounselorPicker() {
  var config = loadNpcConfig();
  renderEditCounselorGrid(config);
}

function confirmEditCounselor() {
  document.getElementById('f-npc-counselor').value = _editCounselorTempId;
  closeEditCounselorPicker();
  updateNpcSelectPreview();
  showToast('咨询师已选择', 'success');
}

// ===== 场景背景选择器 =====
function openEditBgPicker() {
  var config = loadNpcConfig();
  var currentVal = document.getElementById('f-npc-bg').value || '';
  _editBgTempId = currentVal;
  // 填充筛选
  var themeSelect = document.getElementById('edit-bp-theme');
  var styleSelect = document.getElementById('edit-bp-style');
  var themes = [],
    styles = [];
  (config.backgrounds || []).forEach(function (b) {
    if (b.theme && themes.indexOf(b.theme) === -1) themes.push(b.theme);
    if (b.style && styles.indexOf(b.style) === -1) styles.push(b.style);
  });
  themeSelect.innerHTML =
    '<option value="">全部主题</option>' +
    themes
      .map(function (t) {
        return '<option value="' + t + '">' + t + '</option>';
      })
      .join('');
  styleSelect.innerHTML =
    '<option value="">全部风格</option>' +
    styles
      .map(function (s) {
        return '<option value="' + s + '">' + s + '</option>';
      })
      .join('');
  // 清空搜索
  document.getElementById('edit-bp-search').value = '';
  document.getElementById('edit-bp-theme').value = '';
  document.getElementById('edit-bp-style').value = '';
  renderEditBgGrid(config);
  document.getElementById('edit-bg-picker').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeEditBgPicker() {
  document.getElementById('edit-bg-picker').style.display = 'none';
  document.body.style.overflow = '';
}

function renderEditBgGrid(config) {
  var container = document.getElementById('edit-bp-grid');
  var backgrounds = config.backgrounds || [];
  var search = (document.getElementById('edit-bp-search').value || '').trim().toLowerCase();
  var theme = document.getElementById('edit-bp-theme').value;
  var style = document.getElementById('edit-bp-style').value;

  var filtered = backgrounds.filter(function (b) {
    if (search && (b.name || '').toLowerCase().indexOf(search) === -1) return false;
    if (theme && b.theme !== theme) return false;
    if (style && b.style !== style) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;padding:40px 10px;color:var(--text-muted);font-size:13px">🔍 暂无匹配的场景背景<br><span style="font-size:11px">请先在「NPC场景配置」中上传背景</span></div>';
    return;
  }

  container.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">' +
    filtered
      .map(function (b) {
        var sel = b.id === _editBgTempId;
        var isDefault = b.id === config.defaultBackgroundId;
        return (
          '<div class="edit-picker-card bg-picker-card' +
          (sel ? ' selected' : '') +
          '" data-id="' +
          b.id +
          '" onclick="selectEditBg(\'' +
          b.id +
          '\')">' +
          (isDefault ? '<span class="edit-picker-default">默认</span>' : '') +
          (sel ? '<span class="edit-picker-check">✓</span>' : '') +
          '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(#e8d5c4,#b8956e);font-size:20px">🏠</div>' +
          '<div class="edit-picker-label"><span>' +
          (b.name || '未命名') +
          '</span></div>' +
          '</div>'
        );
      })
      .join('') +
    '</div>';

  // 异步填充真实缩略图
  filtered.forEach(function (b) {
    AssetStorage.getCachedDataURL(b.id).then(function (url) {
      if (!url) return;
      var card = document.querySelector('.edit-picker-card[data-id="' + b.id + '"]');
      if (card) {
        var img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:1';
        card.style.position = 'relative';
        card.insertBefore(img, card.firstChild);
      }
    });
  });
}

function selectEditBg(id) {
  _editBgTempId = id;
  document.querySelectorAll('#edit-bp-grid .edit-picker-card').forEach(function (card) {
    card.classList.toggle('selected', card.getAttribute('data-id') === id);
    var existing = card.querySelector('.edit-picker-check');
    if (existing) existing.remove();
    if (card.getAttribute('data-id') === id) {
      var check = document.createElement('span');
      check.className = 'edit-picker-check';
      check.textContent = '✓';
      card.appendChild(check);
    }
  });
}

function filterEditBgPicker() {
  var config = loadNpcConfig();
  renderEditBgGrid(config);
}

function confirmEditBg() {
  document.getElementById('f-npc-bg').value = _editBgTempId;
  closeEditBgPicker();
  updateNpcSelectPreview();
  showToast('场景背景已选择', 'success');
}

// ===== 更新编辑弹窗内的选择卡片 =====
function updateEditNpcCards(config) {
  var counselorId = document.getElementById('f-npc-counselor').value || '';
  var bgId = document.getElementById('f-npc-bg').value || '';

  // 咨询师卡片
  var cBtn = document.getElementById('edit-counselor-btn');
  var cInfo = document.getElementById('edit-counselor-info');
  if (counselorId) {
    var c = (config.counselors || []).find(function (x) {
      return x.id === counselorId;
    });
    if (c && cBtn) cBtn.classList.add('selected');
    if (c && cInfo)
      cInfo.innerHTML =
        '<span class="edit-select-name">' +
        (c.counselorName || c.name || '未命名') +
        '</span><span class="edit-select-desc">' +
        (c.gender === 'male' ? '男' : '女') +
        ' · ' +
        (c.style || c.role || '咨询师') +
        ' · 点击更换</span>';
  } else {
    if (cBtn) cBtn.classList.remove('selected');
    if (cInfo)
      cInfo.innerHTML =
        '<span class="edit-select-name" style="color:var(--text-muted)">使用全局默认</span><span class="edit-select-desc">点击选择咨询师</span>';
  }

  // 背景卡片
  var bBtn = document.getElementById('edit-bg-btn');
  var bInfo = document.getElementById('edit-bg-info');
  if (bgId) {
    var b = (config.backgrounds || []).find(function (x) {
      return x.id === bgId;
    });
    if (b && bBtn) bBtn.classList.add('selected');
    if (b && bInfo)
      bInfo.innerHTML =
        '<span class="edit-select-name">' +
        (b.name || '未命名') +
        '</span><span class="edit-select-desc">' +
        (b.style || '场景背景') +
        ' · 点击更换</span>';
  } else {
    if (bBtn) bBtn.classList.remove('selected');
    if (bInfo)
      bInfo.innerHTML =
        '<span class="edit-select-name" style="color:var(--text-muted)">使用全局默认</span><span class="edit-select-desc">点击选择背景</span>';
  }

  // 配置摘要
  var sCounselor = document.getElementById('summary-counselor');
  var sStyle = document.getElementById('summary-style');
  var sMotto = document.getElementById('summary-motto');
  var sBg = document.getElementById('summary-bg');
  var sTrans = document.getElementById('summary-transitions');

  if (sCounselor) {
    if (counselorId) {
      var sc = (config.counselors || []).find(function (x) {
        return x.id === counselorId;
      });
      sCounselor.textContent = sc ? sc.counselorName || sc.name : '全局默认';
      sCounselor.className = 'edit-summary-value accent';
      if (sStyle) sStyle.textContent = sc ? sc.style || sc.role || '-' : '-';
      if (sMotto) sMotto.textContent = sc ? sc.motto || '每一种感受，都值得被温柔以待' : '每一种感受，都值得被温柔以待';
    } else {
      sCounselor.textContent = '全局默认';
      sCounselor.className = 'edit-summary-value';
      if (sStyle) sStyle.textContent = '-';
      if (sMotto) sMotto.textContent = '每一种感受，都值得被温柔以待';
    }
  }
  if (sBg) {
    if (bgId) {
      var sb = (config.backgrounds || []).find(function (x) {
        return x.id === bgId;
      });
      sBg.textContent = sb ? sb.name : '全局默认';
      sBg.className = 'edit-summary-value accent';
    } else {
      sBg.textContent = '全局默认';
      sBg.className = 'edit-summary-value';
    }
  }
  if (sTrans) {
    var trans = config.transitions || [];
    var beginCount = trans.filter(function (t) {
      return t.phase === '开始阶段';
    }).length;
    var midCount = trans.filter(function (t) {
      return t.phase === '中间阶段';
    }).length;
    var endCount = trans.filter(function (t) {
      return t.phase === '结束阶段';
    }).length;
    var allCount = trans.length;
    sTrans.textContent =
      allCount +
      '条' +
      (beginCount + midCount + endCount > 0
        ? '（开始×' + beginCount + ' 中间×' + midCount + ' 结束×' + endCount + '）'
        : '');
  }
}

// ===== 更新编辑弹窗内的手机预览 =====
function updateEditPreview(config) {
  var counselorId = document.getElementById('f-npc-counselor').value || '';
  var bgId = document.getElementById('f-npc-bg').value || '';
  var scene = document.getElementById('edit-preview-scene');
  var charImg = document.getElementById('edit-preview-char-img');
  var nameplate = document.getElementById('edit-preview-np-name');
  var speaker = document.getElementById('edit-preview-speaker');

  // 更新背景
  if (bgId && typeof AssetStorage !== 'undefined') {
    AssetStorage.getCachedDataURL(bgId).then(function (url) {
      if (url && scene) {
        scene.style.backgroundImage = 'url(' + url + ')';
        scene.style.backgroundSize = 'cover';
        scene.style.backgroundPosition = 'center';
      }
    });
  } else if (scene) {
    scene.style.backgroundImage = '';
    scene.style.background = 'linear-gradient(180deg, #e8d5c4 0%, #d4b8a0 30%, #c9a882 60%, #b8956e 100%)';
  }

  // 更新立绘
  if (counselorId && typeof AssetStorage !== 'undefined') {
    AssetStorage.getCachedDataURL(counselorId).then(function (url) {
      if (url && charImg) charImg.src = url;
    });
  } else if (charImg) {
    charImg.src = 'counselor.png';
  }

  // 更新名牌和对话框
  var c = counselorId
    ? (config.counselors || []).find(function (x) {
        return x.id === counselorId;
      })
    : null;
  if (nameplate) nameplate.textContent = c ? c.counselorName || c.name : '咨询师';
  if (speaker) speaker.textContent = '咨询师' + (c ? ' ｜ ' + (c.counselorName || c.name) : '');
}
