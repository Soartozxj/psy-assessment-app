/**
 * diary-plugin.js - 日记管理插件
 *
 * 大白话解释：
 * - 负责用户日记的配置管理
 * - 继承自PluginBase，获得标准接口
 * - 使用Adapter适配H5和小程序双端
 *
 * @version 1.0.0
 * @date 2026-06-01
 */

class DiaryPlugin extends PluginBase {
  /**
   * 构造函数 - 必须调用 super()
   */
  constructor() {
    super({
      name: '日记管理插件',
      version: '1.0.0',
      description: '负责用户日记的配置管理'
    });

    // 插件私有属性
    this._diaries = [];
    this._currentDiary = null;
  }

  /**
   * 初始化逻辑
   */
  async onInit() {
    console.log('🚀 日记管理插件开始初始化...');

    try {
      // 1. 加载日记列表
      await this._loadDiaries();

      console.log('✅ 日记管理插件初始化完成');
    } catch (error) {
      console.error('❌ 日记管理插件初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行逻辑
   * @param {object} params - 执行参数
   */
  async onExecute(params = {}) {
    console.log('🎯 日记管理插件执行:', params);

    const action = params.action || 'list';

    switch (action) {
      case 'list':
        return this._diaries;
      case 'get':
        return await this._getDiary(params.id);
      case 'create':
        return await this._createDiary(params.data);
      case 'update':
        return await this._updateDiary(params.id, params.data);
      case 'delete':
        return await this._deleteDiary(params.id);
      case 'search':
        return await this._searchDiaries(params.keyword);
      default:
        throw new Error(`未知的日记操作: ${action}`);
    }
  }

  /**
   * 销毁逻辑
   */
  async onDestroy() {
    console.log('🗑️ 日记管理插件开始销毁...');

    // 清理状态
    this._diaries = [];
    this._currentDiary = null;

    console.log('✅ 日记管理插件销毁完成');
  }

  /**
   * 加载日记列表
   */
  async _loadDiaries() {
    console.log('📡 加载日记列表...');

    // 模拟数据
    this._diaries = [
      { id: 1, title: '今天心情不错', content: '内容省略...', mood: '😊', date: '2026-06-01' },
      { id: 2, title: '有些焦虑', content: '内容省略...', mood: '😟', date: '2026-05-31' }
    ];

    console.log(`✅ 加载了 ${this._diaries.length} 篇日记`);
  }

  /**
   * 搜索日记
   */
  async _searchDiaries(keyword) {
    console.log('🔍 搜索日记:', keyword);

    const results = this._diaries.filter((diary) => diary.title.includes(keyword) || diary.content.includes(keyword));

    console.log(`✅ 找到 ${results.length} 篇匹配的日记`);
    return results;
  }

  /**
   * 获取单个日记
   */
  async _getDiary(id) {
    return this._diaries.find((d) => d.id === id) || null;
  }

  /**
   * 创建日记
   */
  async _createDiary(data) {
    console.log('➕ 创建日记:', data.title);

    const newDiary = {
      id: Date.now(),
      ...data,
      date: new Date().toISOString().split('T')[0]
    };

    this._diaries.push(newDiary);
    this.showToast('日记创建成功', 'success');
    return newDiary;
  }

  /**
   * 更新日记
   */
  async _updateDiary(id, data) {
    console.log('✏️ 更新日记:', id);

    const index = this._diaries.findIndex((d) => d.id === id);
    if (index === -1) {
      throw new Error(`日记不存在: ${id}`);
    }

    this._diaries[index] = { ...this._diaries[index], ...data };
    this.showToast('日记更新成功', 'success');
    return this._diaries[index];
  }

  /**
   * 删除日记
   */
  async _deleteDiary(id) {
    console.log('🗑️ 删除日记:', id);

    const index = this._diaries.findIndex((d) => d.id === id);
    if (index === -1) {
      throw new Error(`日记不存在: ${id}`);
    }

    this._diaries.splice(index, 1);
    this.showToast('日记删除成功', 'success');
    return { success: true };
  }
}

// 导出到全局
window.DiaryPlugin = DiaryPlugin;

console.log('✅ diary-plugin.js 加载完成');
