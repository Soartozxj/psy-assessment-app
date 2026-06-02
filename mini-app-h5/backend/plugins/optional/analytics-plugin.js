/**
 * analytics-plugin.js - 数据分析插件
 *
 * 大白话解释：
 * - 负责数据统计和分析
 * - 继承自PluginBase，获得标准接口
 * - 使用Adapter适配H5和小程序双端
 *
 * @version 1.0.0
 * @date 2026-06-01
 */

class AnalyticsPlugin extends PluginBase {
  /**
   * 构造函数 - 必须调用 super()
   */
  constructor() {
    super({
      name: '数据分析插件',
      version: '1.0.0',
      description: '负责数据统计和分析'
    });

    // 插件私有属性
    this._stats = {};
    this._events = [];
  }

  /**
   * 初始化逻辑
   */
  async onInit() {
    console.log('🚀 数据分析插件开始初始化...');

    try {
      // 1. 加载统计数据
      await this._loadStats();

      console.log('✅ 数据分析插件初始化完成');
    } catch (error) {
      console.error('❌ 数据分析插件初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行逻辑
   * @param {object} params - 执行参数
   */
  async onExecute(params = {}) {
    console.log('🎯 数据分析插件执行:', params);

    const action = params.action || 'getStats';

    switch (action) {
      case 'getStats':
        return this._stats;
      case 'getEvents':
        return await this._getEvents(params.limit);
      case 'trackEvent':
        return await this._trackEvent(params.event);
      case 'getUserStats':
        return await this._getUserStats(params.userId);
      case 'getSessionStats':
        return await this._getSessionStats();
      default:
        throw new Error(`未知的分析操作: ${action}`);
    }
  }

  /**
   * 销毁逻辑
   */
  async onDestroy() {
    console.log('🗑️ 数据分析插件开始销毁...');

    // 清理状态
    this._stats = {};
    this._events = [];

    console.log('✅ 数据分析插件销毁完成');
  }

  /**
   * 加载统计数据
   */
  async _loadStats() {
    console.log('📡 加载统计数据...');

    // 模拟数据
    this._stats = {
      totalUsers: 150,
      activeUsers: 45,
      totalSessions: 320,
      averageSessionDuration: 1800, // 30分钟
      popularFeatures: ['冥想', '情绪记录', '量表测试']
    };

    console.log('✅ 统计数据加载完成');
  }

  /**
   * 记录事件
   */
  async _trackEvent(event) {
    console.log('📊 记录事件:', event.name);

    const eventRecord = {
      id: Date.now(),
      name: event.name,
      data: event.data || {},
      timestamp: new Date().toISOString()
    };

    this._events.push(eventRecord);

    // 限制事件数量（防止内存泄漏）
    if (this._events.length > 1000) {
      this._events = this._events.slice(-500);
    }

    this.showToast('事件记录成功', 'success');
    return eventRecord;
  }

  /**
   * 获取事件列表
   */
  async _getEvents(limit = 50) {
    console.log('📋 获取事件列表...');

    const events = this._events.slice(-limit);
    console.log(`✅ 获取到 ${events.length} 个事件`);
    return events;
  }

  /**
   * 获取用户统计
   */
  async _getUserStats(userId) {
    console.log('👤 获取用户统计:', userId);

    // 模拟用户统计数据
    const userStats = {
      userId: userId,
      sessionCount: 15,
      totalDuration: 7200, // 2小时
      lastActive: new Date().toISOString(),
      favoriteFeature: '冥想'
    };

    return userStats;
  }

  /**
   * 获取会话统计
   */
  async _getSessionStats() {
    console.log('📊 获取会话统计...');

    // 模拟会话统计数据
    const sessionStats = {
      todaySessions: 25,
      weekSessions: 180,
      monthSessions: 720,
      averageDuration: 1200 // 20分钟
    };

    return sessionStats;
  }
}

// 导出到全局
window.AnalyticsPlugin = AnalyticsPlugin;

console.log('✅ analytics-plugin.js 加载完成');
