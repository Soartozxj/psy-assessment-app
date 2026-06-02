/**
 * meditation-plugin.js - 冥想引导插件
 *
 * 大白话解释：
 * - 负责冥想引导配置管理
 * - 继承自PluginBase，获得标准接口
 * - 使用Adapter适配H5和小程序双端
 *
 * @version 1.0.0
 * @date 2026-06-01
 */

class MeditationPlugin extends PluginBase {
  /**
   * 构造函数 - 必须调用 super()
   */
  constructor() {
    super({
      name: '冥想引导插件',
      version: '1.0.0',
      description: '负责冥想引导的配置管理'
    });

    // 插件私有属性
    this._meditations = [];
    this._currentMeditation = null;
  }

  /**
   * 初始化逻辑
   */
  async onInit() {
    console.log('🚀 冥想引导插件开始初始化...');

    try {
      // 1. 加载冥想列表
      await this._loadMeditations();

      console.log('✅ 冥想引导插件初始化完成');
    } catch (error) {
      console.error('❌ 冥想引导插件初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行逻辑
   * @param {object} params - 执行参数
   */
  async onExecute(params = {}) {
    console.log('🎯 冥想引导插件执行:', params);

    const action = params.action || 'list';

    switch (action) {
      case 'list':
        return this._meditations;
      case 'get':
        return await this._getMeditation(params.id);
      case 'create':
        return await this._createMeditation(params.data);
      case 'update':
        return await this._updateMeditation(params.id, params.data);
      case 'delete':
        return await this._deleteMeditation(params.id);
      case 'start':
        return await this._startMeditation(params.id);
      default:
        throw new Error(`未知的冥想操作: ${action}`);
    }
  }

  /**
   * 销毁逻辑
   */
  async onDestroy() {
    console.log('🗑️ 冥想引导插件开始销毁...');

    // 清理状态
    this._meditations = [];
    this._currentMeditation = null;

    console.log('✅ 冥想引导插件销毁完成');
  }

  /**
   * 加载冥想列表
   */
  async _loadMeditations() {
    console.log('📡 加载冥想列表...');

    // 模拟数据
    this._meditations = [
      { id: 1, name: '深呼吸冥想', duration: 300, background: '🌲' },
      { id: 2, name: '身体扫描冥想', duration: 600, background: '🍃' }
    ];

    console.log(`✅ 加载了 ${this._meditations.length} 个冥想`);
  }

  /**
   * 开始冥想
   */
  async _startMeditation(id) {
    console.log('🧘 开始冥想:', id);

    const meditation = await this._getMeditation(id);
    if (!meditation) {
      throw new Error(`冥想不存在: ${id}`);
    }

    // 模拟开始冥想
    this._currentMeditation = meditation;

    return {
      meditation: meditation.name,
      duration: meditation.duration,
      startTime: new Date().toISOString()
    };
  }

  /**
   * 获取单个冥想
   */
  async _getMeditation(id) {
    return this._meditations.find((m) => m.id === id) || null;
  }

  /**
   * 创建冥想
   */
  async _createMeditation(data) {
    console.log('➕ 创建冥想:', data.name);

    const newMeditation = {
      id: Date.now(),
      ...data
    };

    this._meditations.push(newMeditation);
    this.showToast('冥想创建成功', 'success');
    return newMeditation;
  }

  /**
   * 更新冥想
   */
  async _updateMeditation(id, data) {
    console.log('✏️ 更新冥想:', id);

    const index = this._meditations.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error(`冥想不存在: ${id}`);
    }

    this._meditations[index] = { ...this._meditations[index], ...data };
    this.showToast('冥想更新成功', 'success');
    return this._meditations[index];
  }

  /**
   * 删除冥想
   */
  async _deleteMeditation(id) {
    console.log('🗑️ 删除冥想:', id);

    const index = this._meditations.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error(`冥想不存在: ${id}`);
    }

    this._meditations.splice(index, 1);
    this.showToast('冥想删除成功', 'success');
    return { success: true };
  }
}

// 导出到全局
window.MeditationPlugin = MeditationPlugin;

console.log('✅ meditation-plugin.js 加载完成');
