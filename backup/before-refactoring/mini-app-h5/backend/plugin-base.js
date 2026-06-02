/**
 * plugin-base.js - 插件基类（所有插件都要继承这个类）
 *
 * 大白话解释：
 * - 就像一个插件模板，保证每个插件都有相同的"接口"
 * - 新手只要改模板里的具体逻辑，不用操心架构
 * - 提供了 init()、execute()、destroy() 三个标准方法
 *
 * @version 1.0.0
 * @date 2026-05-27
 */

class PluginBase {
  /**
   * 构造函数
   * @param {object} config - 插件配置
   */
  constructor(config = {}) {
    // 插件基本信息（每个插件都要填）
    this.name = config.name || '未命名插件';
    this.version = config.version || '1.0.0';
    this.description = config.description || '';

    // 插件状态
    this.isInitialized = false;
    this.isDestroyed = false;

    // 插件配置（可以自定义）
    this.config = config;

    // 事件监听器引用（用于销毁时清理）
    this._eventListeners = [];

    console.log(`📦 创建插件: ${this.name} v${this.version}`);
  }

  /**
   * 初始化插件（必须实现）
   * 大白话：插件加载后，先执行这个方法做准备
   */
  async init() {
    if (this.isInitialized) {
      console.warn(`⚠️ 插件 ${this.name} 已经初始化过了`);
      return;
    }

    try {
      console.log(`🚀 开始初始化插件: ${this.name}`);

      // 在这里做初始化工作
      // 比如：连接数据库、注册事件监听、加载配置等
      await this.onInit();

      this.isInitialized = true;
      console.log(`✅ 插件 ${this.name} 初始化成功`);

      // 广播"插件初始化完成"事件
      if (window.EventHub) {
        await window.EventHub.emit('plugin-initialized', {
          name: this.name,
          version: this.version
        });
      }
    } catch (error) {
      console.error(`❌ 插件 ${this.name} 初始化失败:`, error);
      throw error;
    }
  }

  /**
   * 初始化时的具体逻辑（子类要实现这个方法）
   * 大白话：这就是你要写代码的地方
   */
  async onInit() {
    // 子类重写这个方法，写具体的初始化逻辑
    // 比如：
    // - AI插件：测试API连接
    // - 量表插件：从服务器加载量表列表
    // - 登录插件：检查登录状态
    console.log(`💡 插件 ${this.name} 的 onInit() 方法需要子类实现`);
  }

  /**
   * 执行插件功能（必须实现）
   * @param {object} params - 传递给插件的参数
   *
   * 大白话：外部调用插件时，实际上是在调用这个方法
   */
  async execute(params = {}) {
    if (!this.isInitialized) {
      throw new Error(`插件 ${this.name} 未初始化，请先调用 init()`);
    }

    if (this.isDestroyed) {
      throw new Error(`插件 ${this.name} 已销毁，不能执行`);
    }

    try {
      console.log(`🎯 执行插件: ${this.name}`, params);

      // 调用子类的具体执行逻辑
      const result = await this.onExecute(params);

      console.log(`✅ 插件 ${this.name} 执行成功`, result);
      return result;
    } catch (error) {
      console.error(`❌ 插件 ${this.name} 执行失败:`, error);
      throw error;
    }
  }

  /**
   * 执行时的具体逻辑（子类要实现这个方法）
   * 大白话：这就是插件的核心功能代码
   */
  async onExecute(params) {
    // 子类重写这个方法，写具体的执行逻辑
    // 比如：
    // - AI插件：调用DashScope API生成内容
    // - 量表插件：保存量表到数据库
    // - 登录插件：验证用户名密码
    console.log(`💡 插件 ${this.name} 的 onExecute() 方法需要子类实现`);
    return null;
  }

  /**
   * 销毁插件（清理资源）
   * 大白话：插件不用了，清理它占用的内存和资源
   */
  destroy() {
    if (this.isDestroyed) {
      console.warn(`⚠️ 插件 ${this.name} 已经销毁了`);
      return;
    }

    try {
      console.log(`🗑️ 开始销毁插件: ${this.name}`);

      // 调用子类的清理逻辑
      this.onDestroy();

      // 清理事件监听器
      this.cleanupEventListeners();

      // 更新状态
      this.isDestroyed = true;
      this.isInitialized = false;

      console.log(`✅ 插件 ${this.name} 已销毁`);

      // 广播"插件销毁"事件
      if (window.EventHub) {
        window.EventHub.emit('plugin-destroyed', {
          name: this.name
        });
      }
    } catch (error) {
      console.error(`❌ 插件 ${this.name} 销毁失败:`, error);
    }
  }

  /**
   * 销毁时的具体逻辑（子类可选实现）
   * 大白话：清理定时器、取消事件监听、关闭数据库连接等
   */
  onDestroy() {
    // 子类可以重写这个方法，写具体的清理逻辑
    console.log(`💡 插件 ${this.name} 的 onDestroy() 方法（可选）`);
  }

  /**
   * 辅助方法：注册事件监听（自动记录，方便销毁时清理）
   * @param {string} eventName - 事件名称
   * @param {function} callback - 回调函数
   */
  registerEventListener(eventName, callback) {
    if (!window.EventHub) {
      console.warn('⚠️ EventHub 不存在，无法注册事件监听');
      return;
    }

    // 注册事件监听
    window.EventHub.on(eventName, callback);

    // 记录到列表中，方便销毁时清理
    this._eventListeners.push({
      eventName: eventName,
      callback: callback
    });

    console.log(`📡 插件 ${this.name} 注册了事件监听: ${eventName}`);
  }

  /**
   * 清理所有事件监听器
   */
  cleanupEventListeners() {
    if (!window.EventHub) return;

    console.log(`📡 清理插件 ${this.name} 的 ${this._eventListeners.length} 个事件监听器`);

    // 遍历所有监听器，取消订阅
    this._eventListeners.forEach((listener) => {
      window.EventHub.off(listener.eventName, listener.callback);
    });

    // 清空列表
    this._eventListeners = [];
  }

  /**
   * 辅助方法：获取配置项
   * @param {string} key - 配置键
   * @param {*} defaultValue - 默认值
   */
  getConfig(key, defaultValue = null) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  /**
   * 辅助方法：设置配置项
   * @param {string} key - 配置键
   * @param {*} value - 配置值
   */
  setConfig(key, value) {
    this.config[key] = value;
    console.log(`⚙️ 插件 ${this.name} 更新配置: ${key} =`, value);
  }

  /**
   * 辅助方法：显示提示消息（自动适配H5/小程序）
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型（info/success/warning/error）
   */
  showToast(message, type = 'info') {
    if (window.Adapter) {
      window.Adapter.ui.toast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }
}

// 导出到全局（这样其他地方才能用）
window.PluginBase = PluginBase;

console.log('✅ plugin-base.js 加载完成');
