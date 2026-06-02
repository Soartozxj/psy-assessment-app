/**
 * PluginBase - 插件基类
 *
 * 大白话解释：
 * - 所有插件都必须继承这个基类
 * - 提供标准的插件生命周期管理（初始化、执行、销毁）
 * - 提供通用的工具方法（日志、数据验证等）
 *
 * @version 1.0.0
 * @date 2026-06-01
 */

class PluginBase {
  /**
   * 构造函数
   * @param {object} config - 插件配置
   * @param {string} config.name - 插件名称
   * @param {string} config.version - 插件版本
   * @param {string} [config.description] - 插件描述
   */
  constructor(config = {}) {
    this.name = config.name || '未命名插件';
    this.version = config.version || '1.0.0';
    this.description = config.description || '';
    this.isInitialized = false;

    // 插件私有状态
    this._state = 'created'; // created -> initialized -> destroyed
  }

  /**
   * 初始化插件（模板方法）
   * @returns {object} 初始化结果 { success: boolean, error?: string }
   */
  init() {
    try {
      this.log('初始化插件...');
      this.onInit();
      this.isInitialized = true;
      this._state = 'initialized';
      this.log('插件初始化完成');
      return { success: true };
    } catch (error) {
      this.log(`插件初始化失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * 执行插件操作（模板方法）
   * @param {object} params - 执行参数
   * @param {string} params.action - 操作名称
   * @returns {object} 执行结果 { success: boolean, data?: any, error?: string }
   */
  execute(params = {}) {
    if (!this.isInitialized) {
      return { success: false, error: '插件未初始化' };
    }

    try {
      this.log(`执行操作: ${params.action}`);
      const result = this.onExecute(params);
      this.log(`操作完成: ${params.action}`);
      return { success: true, data: result };
    } catch (error) {
      this.log(`操作失败: ${params.action} - ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * 销毁插件（模板方法）
   * @returns {object} 销毁结果 { success: boolean, error?: string }
   */
  destroy() {
    try {
      this.log('销毁插件...');
      this.onDestroy();
      this.isInitialized = false;
      this._state = 'destroyed';
      this.log('插件销毁完成');
      return { success: true };
    } catch (error) {
      this.log(`插件销毁失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * 日志记录
   * @param {string} message - 日志消息
   * @param {string} [level=info] - 日志级别 (info|warning|error|debug)
   */
  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const prefix = `[${this.name}]`;

    switch (level) {
      case 'error':
        console.error(`%c${timestamp} ${prefix} ${message}`, 'color: #dc3545');
        break;
      case 'warning':
        console.warn(`%c${timestamp} ${prefix} ${message}`, 'color: #ffc107');
        break;
      case 'debug':
        console.debug(`%c${timestamp} ${prefix} ${message}`, 'color: #6c757d');
        break;
      default:
        console.log(`%c${timestamp} ${prefix} ${message}`, 'color: #007bff');
    }
  }

  /**
   * 验证参数
   * @param {object} params - 参数对象
   * @param {string[]} required - 必需参数名数组
   * @throws {Error} 如果缺少必需参数
   */
  validateParams(params, required = []) {
    for (const param of required) {
      if (params[param] === undefined || params[param] === null) {
        throw new Error(`缺少必需参数: ${param}`);
      }
    }
  }

  // ==================== 子类必须实现的方法 ====================

  /**
   * 初始化逻辑（子类实现）
   */
  onInit() {
    throw new Error('子类必须实现 onInit() 方法');
  }

  /**
   * 执行逻辑（子类实现）
   * @param {object} params - 执行参数
   */
  onExecute(params = {}) {
    throw new Error('子类必须实现 onExecute() 方法');
  }

  /**
   * 销毁逻辑（子类实现）
   */
  onDestroy() {
    throw new Error('子类必须实现 onDestroy() 方法');
  }
}

// 导出插件基类
window.PluginBase = PluginBase;
