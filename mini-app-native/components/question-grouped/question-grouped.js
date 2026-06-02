/**
 * question-grouped — 分组下拉题组件
 *
 * 每组一个 picker 或芯片选择
 * 支持 allowRepeat（重复选择，生成多条记录）
 * 触发事件：onAnswer，携带 {questionId, answer}
 */

Component({
  properties: {
    question: { type: Object, value: {} },
    value: { type: null, value: null },
    npcMode: { type: String, value: 'normal' },
    showIndex: { type: Boolean, value: true },
    index: { type: Number, value: 0 },
    disabled: { type: Boolean, value: false }
  },

  data: {
    groups: [], // [{id, label, options: [{id, label, score}]}]
    selections: {}, // {groupId: optionId}
    selectionFlags: {}, // {groupId: Boolean} — 预计算供 WXML 使用
    repeatItems: [], // allowRepeat 模式下的条目列表
    repeatEditing: false,
    newItem: {}
  },

  observers: {
    question: function (q) {
      if (!q) {
        return;
      }
      let groups = [];
      // groups 字段可能是数组或对象
      if (Array.isArray(q.groups)) {
        groups = q.groups.map(function (g) {
          return {
            id: g.id || g.label,
            label: g.label || g.id,
            options: g.options || []
          };
        });
      } else if (q.groups && typeof q.groups === 'object') {
        const keys = Object.keys(q.groups);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const val = q.groups[k];
          if (Array.isArray(val)) {
            groups.push({ id: k, label: k, options: val });
          } else {
            groups.push({ id: k, label: String(val), options: q.options || [] });
          }
        }
      }
      this.setData({ groups: groups });
      this._syncValue();
    },
    value: function () {
      this._syncValue();
    }
  },

  methods: {
    /** 根据 selections 预计算 selectionFlags，供 WXML 使用 */
    _computeSelectionFlags: function (selections) {
      const flags = {};
      if (selections && typeof selections === 'object') {
        const keys = Object.keys(selections);
        for (let i = 0; i < keys.length; i++) {
          const val = selections[keys[i]];
          flags[keys[i]] = val !== undefined && val !== null && val !== '';
        }
      }
      return flags;
    },

    _syncValue: function () {
      const val = this.properties.value;
      if (!val) {
        return;
      }
      if (Array.isArray(val)) {
        this.setData({ repeatItems: val });
      } else if (typeof val === 'object') {
        const flags = this._computeSelectionFlags(val);
        this.setData({ selections: val, selectionFlags: flags });
      }
    },

    /** 单选 picker 变更 */
    onPickerChange: function (e) {
      if (this.properties.disabled) {
        return;
      }
      const groupId = e.currentTarget.dataset.groupId;
      const idx = Number(e.detail.value);
      const groups = this.data.groups;
      let group = null;
      for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === groupId) {
          group = groups[i];
          break;
        }
      }
      if (!group || !group.options[idx]) {
        return;
      }

      const selections = this.data.selections;
      selections[groupId] = group.options[idx].id !== undefined ? group.options[idx].id : idx;
      const flags = this._computeSelectionFlags(selections);
      this.setData({ selections: selections, selectionFlags: flags });
      this._emitAnswer();
    },

    /** 芯片选择 */
    onChipSelect: function (e) {
      if (this.properties.disabled) {
        return;
      }
      const groupId = e.currentTarget.dataset.groupId;
      const optId = e.currentTarget.dataset.optId;
      const selections = this.data.selections;
      selections[groupId] = optId;
      const flags = this._computeSelectionFlags(selections);
      this.setData({ selections: selections, selectionFlags: flags });
      this._emitAnswer();
    },

    /** allowRepeat: 添加条目 */
    onAddRepeatItem: function () {
      this.setData({ repeatEditing: true, newItem: {} });
    },

    /** allowRepeat: 确认编辑条目 */
    onConfirmRepeatItem: function () {
      const groups = this.data.groups;
      const newItem = this.data.newItem;
      // 校验每组都选了
      for (let i = 0; i < groups.length; i++) {
        if (newItem[groups[i].id] === undefined) {
          return;
        }
      }
      const items = this.data.repeatItems.slice();
      items.push(newItem);
      this.setData({ repeatItems: items, repeatEditing: false, newItem: {} });
      this._emitAnswer();
    },

    /** allowRepeat: 删除条目 */
    onDeleteRepeatItem: function (e) {
      const idx = e.currentTarget.dataset.index;
      const items = this.data.repeatItems.slice();
      items.splice(idx, 1);
      this.setData({ repeatItems: items });
      this._emitAnswer();
    },

    /** allowRepeat 编辑态 picker */
    onRepeatPickerChange: function (e) {
      const groupId = e.currentTarget.dataset.groupId;
      const idx = Number(e.detail.value);
      const groups = this.data.groups;
      let group = null;
      for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === groupId) {
          group = groups[i];
          break;
        }
      }
      if (!group || !group.options[idx]) {
        return;
      }
      const newItem = this.data.newItem;
      newItem[groupId] = group.options[idx].id !== undefined ? group.options[idx].id : idx;
      this.setData({ newItem: newItem });
    },

    _emitAnswer: function () {
      const q = this.properties.question;
      if (q.allowRepeat) {
        this.triggerEvent('answer', {
          questionId: q.id,
          answer: this.data.repeatItems
        });
      } else {
        this.triggerEvent('answer', {
          questionId: q.id,
          answer: this.data.selections
        });
      }
    }
  }
});
