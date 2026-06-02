/**
 * pages/history — 历史记录（TabBar页面）
 *
 * 顶部筛选 + 日期分组列表 + 左滑删除 + 空状态
 */

const storage = require('../../utils/storage.js');
const api = require('../../utils/api.js');
const constants = require('../../utils/constants.js');
const app = getApp();

Page({
  data: {
    categories: ['全部'],
    categoryKeys: [''],
    currentCategory: 0,
    records: [],
    groupedRecords: [],
    emptyText: '暂无测评记录'
  },

  onLoad: function () {
    // 动态构建分类列表
    const catList = ['全部'];
    const catKeys = [''];
    constants.CATEGORIES.forEach(function (c) {
      catList.push(c.name);
      catKeys.push(c.key);
    });
    this.setData({ categories: catList, categoryKeys: catKeys });
  },

  onShow: function () {
    this._loadRecords();
  },

  /**
   * 规范化记录：优先用 scale 的 displayName 和 emoji（来自量表缓存）
   * 解决历史记录显示后台名称而非展示名称的问题
   */
  _normalizeRecords: function (records) {
    const scales = (app.globalData && app.globalData.scales) || [];
    // 建立 scaleId → scale 的映射
    const scaleMap = {};
    for (let i = 0; i < scales.length; i++) {
      scaleMap[String(scales[i].id)] = scales[i];
    }
    for (let j = 0; j < records.length; j++) {
      const r = records[j];
      // 统一 score 为数字，避免云端返回的 "42.00" 显示为 "42.00分"
      if (r.score !== undefined && r.score !== null) {
        r.score = Number(r.score) || 0;
      }
      const scale = scaleMap[String(r.scaleId)];
      if (scale) {
        // displayName 优先于后台名称
        if (scale.displayName) {
          r.scaleName = scale.displayName;
        }
        // emoji 优先
        if (scale.icon) {
          r.emoji = scale.icon;
        } else if (scale.emoji) {
          r.emoji = scale.emoji;
        }
      }
    }
    return records;
  },

  _loadRecords: function () {
    const idx = this.data.currentCategory;
    const cat = this.data.categoryKeys[idx];
    let records = cat ? storage.getLocalHistoryByCategory(cat) : storage.getLocalHistory();
    records.sort(function (a, b) {
      return (b.completedAt || b.date || '').localeCompare(a.completedAt || a.date || '');
    });
    records = this._normalizeRecords(records);
    this.setData({
      records: records,
      groupedRecords: this._groupByDate(records),
      emptyText: records.length === 0 ? '暂无测评记录' : '没有匹配的记录'
    });

    // 尝试云端同步
    this._syncCloud();
  },

  _syncCloud: function () {
    const self = this;
    api
      .fetchHistory(1, 50)
      .then(function (res) {
        const cloudRecords = res.list || res.data || res || [];
        if (cloudRecords.length > 0) {
          const local = storage.getLocalHistory();

          // 构建本地记录索引：id + scaleId@date 5分钟窗口去重
          const localIdSet = {};
          const localKeySet = {};
          for (let i = 0; i < local.length; i++) {
            const r = local[i];
            if (r.id) {
              localIdSet[String(r.id)] = true;
            }
            // 用 scaleId@日期时分 作为模糊键（5分钟窗口内视为同一次）
            if (r.scaleId && (r.completedAt || r.date)) {
              const d = (r.completedAt || r.date || '').substring(0, 16); // yyyy-MM-ddTHH:mm
              localKeySet[r.scaleId + '@' + d] = true;
            }
          }

          const merged = local.slice();
          let addedCount = 0;
          for (let j = 0; j < cloudRecords.length; j++) {
            const c = cloudRecords[j];
            const idMatch = c.id && localIdSet[String(c.id)];
            // 模糊匹配：同量表+同分钟
            let fuzzyKey = '';
            if (c.scaleId && (c.completedAt || c.date)) {
              fuzzyKey = c.scaleId + '@' + (c.completedAt || c.date || '').substring(0, 16);
            }
            const fuzzyMatch = fuzzyKey && localKeySet[fuzzyKey];

            if (!idMatch && !fuzzyMatch) {
              merged.push(c);
              addedCount++;
              // 同步更新索引，防止同批次云端记录互相重复
              if (c.id) {
                localIdSet[String(c.id)] = true;
              }
              if (fuzzyKey) {
                localKeySet[fuzzyKey] = true;
              }
            } else {
              console.log('[History] 去重跳过:', c.scaleName || c.scaleId, c.id || '');
            }
          }

          if (addedCount > 0) {
            // 合并后写回本地，避免下次进入历史页重复合并
            storage.saveLocalHistory(merged);
            console.log('[History] 云端同步: 新增', addedCount, '条, 共', merged.length, '条已写回本地');
          } else {
            console.log('[History] 云端同步: 无新记录');
          }

          merged.sort(function (a, b) {
            return (b.completedAt || b.date || '').localeCompare(a.completedAt || a.date || '');
          });
          self.setData({
            records: self._normalizeRecords(merged),
            groupedRecords: self._groupByDate(merged)
          });
        }
      })
      .catch(function (err) {
        console.warn('[History] 云端同步失败:', err.message || err);
      });
  },

  _groupByDate: function (records) {
    const groups = {};
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const dateStr = r.date || (r.completedAt ? r.completedAt.substring(0, 10) : '未知日期');
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(r);
    }
    const result = [];
    const keys = Object.keys(groups).sort().reverse();
    for (let k = 0; k < keys.length; k++) {
      result.push({ date: keys[k], items: groups[keys[k]] });
    }
    return result;
  },

  onCategoryTap: function (e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ currentCategory: idx });
    this._loadRecords();
  },

  onRecordTap: function (e) {
    const record = e.currentTarget.dataset.record;
    if (!record) {
      return;
    }
    // 映射历史记录字段到结果页期望的字段
    if (record.score !== undefined && record.totalScore === undefined) {
      record.totalScore = record.score;
    }
    if (record.maxScore !== undefined && record.totalMaxScore === undefined) {
      record.totalMaxScore = record.maxScore;
    }
    // 兼容服务端字段名 dimensions → dims
    if (record.dimensions !== undefined && record.dims === undefined) {
      let rawDims = record.dimensions;
      if (typeof rawDims === 'string') {
        try {
          rawDims = JSON.parse(rawDims);
        } catch (e) {
          rawDims = [];
        }
      }
      record.dims = rawDims || [];
    }
    // 兼容服务端 screeningResult 字符串
    if (record.screeningResult && typeof record.screeningResult === 'string') {
      try {
        record.screeningResult = JSON.parse(record.screeningResult);
      } catch (e) {}
    }
    app.globalData.lastAssessmentResult = record;
    wx.navigateTo({ url: '/pages/result/result?recordId=' + record.id });
  },

  onDeleteRecord: function (e) {
    const id = e.currentTarget.dataset.id;
    const self = this;
    wx.showModal({
      title: '确认删除',
      content: '确定删除这条记录吗？',
      success: function (res) {
        if (res.confirm) {
          storage.deleteLocalHistory(id);
          self._loadRecords();
        }
      }
    });
  },

  /** 去测评（空状态按钮） */
  onGoToScales: function () {
    wx.navigateTo({ url: '/pages/scale-list/scale-list' });
  }
});
