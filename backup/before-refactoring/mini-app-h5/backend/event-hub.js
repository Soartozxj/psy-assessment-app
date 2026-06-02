/**
 * event-hub.js - 事件中心（广播站）
 *
 * 大白话解释：
 * - 就像一个广播站，负责插件之间的通信
 * - 插件A做完一件事，可以"广播"出去
 * - 其他插件如果关心这件事，就会"听到"并做出反应
 * - 这样插件之间不需要直接认识对方（解耦）
 *
 * 实际场景：
 * - 用户登录成功后，auth-plugin广播"用户已登录"
 * - scale-plugin听到后，自动加载该用户的量表数据
 * - ai-plugin听到后，自动加载该用户的AI配置
 *
 * @version 1.0.0
 * @date 2026-05-27
 */

class EventHub {
  /**
   * 构造函数 - 初始化事件监听器存储
   */
  constructor() {
    // 存放所有的事件监听器（就像广播站的频道列表）
    // 结构：{ 'event-name': [listener1, listener2, ...] }
    this.listeners = {};

    // 存放一次性监听器（执行一次后自动删除）
    this.onceListeners = {};

    // 最大监听器数量（防止内存泄漏）
    this.maxListeners = 20;

    console.log('📡 EventHub 创建成功');
    console.log(`   最大监听器数量: ${this.maxListeners}`);
  }

  /**
   * 订阅事件（监听）
   * @param {string} eventName - 事件名称（频道名）
   * @param {function} callback - 回调函数（听到广播后做什么）
   * @param {object} options - 可选配置
   * @param {boolean} options.once - 是否只执行一次（默认false）
   * @param {number} options.priority - 优先级（数字越小越先执行，默认10）
   * @param {string} options.id - 监听器ID（用于取消订阅，可选）
   *
   * 大白话：告诉广播站，我对某个频道的内容感兴趣
   *
   * @returns {function} 取消订阅的函数（方便使用）
   */
  on(eventName, callback, options = {}) {
    // 参数校验
    if (typeof eventName !== 'string' || !eventName) {
      console.error('❌ eventName 必须是非空字符串');
      return () => {};
    }

    if (typeof callback !== 'function') {
      console.error('❌ callback 必须是函数');
      return () => {};
    }

    // 初始化事件监听器数组
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }

    // 检查监听器数量是否超过限制
    if (this.listeners[eventName].length >= this.maxListeners) {
      console.warn(`⚠️ 事件 ${eventName} 的监听器数量已达上限 (${this.maxListeners})`);
      console.warn('   请检查是否有监听器未取消订阅');
    }

    // 创建监听器对象
    const listener = {
      callback: callback,
      once: options.once || false,
      priority: options.priority || 10,
      id: options.id || this._generateId(),
      createdAt: Date.now()
    };

    // 添加到监听器数组
    this.listeners[eventName].push(listener);

    // 按优先级排序（优先级高的先执行）
    this.listeners[eventName].sort((a, b) => a.priority - b.priority);

    console.log(`📡 订阅事件: ${eventName} (优先级: ${listener.priority})`);

    // 返回取消订阅的函数（方便使用）
    return () => {
      this.off(eventName, callback);
    };
  }

  /**
   * 订阅事件（只执行一次）
   * @param {string} eventName - 事件名称
   * @param {function} callback - 回调函数
   * @param {object} options - 可选配置
   *
   * 大白话：听到一次广播后，就自动取消订阅
   */
  once(eventName, callback, options = {}) {
    return this.on(eventName, callback, { ...options, once: true });
  }

  /**
   * 取消订阅
   * @param {string} eventName - 事件名称
   * @param {function} callback - 回调函数（可选，不传则移除所有）
   *
   * 大白话：告诉广播站，我不再关心这个频道了
   */
  off(eventName, callback) {
    // 如果没有传入eventName，清空所有事件
    if (!eventName) {
      console.log('📡 清空所有事件监听器');
      this.listeners = {};
      return;
    }

    // 如果没有传入callback，移除该事件的所有监听器
    if (!callback) {
      if (this.listeners[eventName]) {
        delete this.listeners[eventName];
        console.log(`📡 取消订阅事件: ${eventName} (所有监听器)`);
      }
      return;
    }

    // 移除指定的回调函数
    if (this.listeners[eventName]) {
      const beforeCount = this.listeners[eventName].length;

      this.listeners[eventName] = this.listeners[eventName].filter((listener) => listener.callback !== callback);

      const afterCount = this.listeners[eventName].length;

      if (beforeCount > afterCount) {
        console.log(`📡 取消订阅事件: ${eventName} (1个监听器)`);
      }

      // 如果没有监听器了，删除该事件
      if (this.listeners[eventName].length === 0) {
        delete this.listeners[eventName];
      }
    }
  }

  /**
   * 取消订阅（通过ID）
   * @param {string} id - 监听器ID
   */
  offById(id) {
    let found = false;

    Object.keys(this.listeners).forEach((eventName) => {
      const beforeCount = this.listeners[eventName].length;

      this.listeners[eventName] = this.listeners[eventName].filter((listener) => listener.id !== id);

      if (beforeCount > this.listeners[eventName].length) {
        found = true;
      }

      // 如果没有监听器了，删除该事件
      if (this.listeners[eventName].length === 0) {
        delete this.listeners[eventName];
      }
    });

    if (found) {
      console.log(`📡 取消订阅 (ID: ${id})`);
    }
  }

  /**
   * 触发事件（广播）
   * @param {string} eventName - 事件名称
   * @param {*} data - 传递给监听器的数据
   *
   * 大白话：向某个频道广播消息，所有订阅者都会收到
   */
  async emit(eventName, data = {}) {
    const listeners = this.listeners[eventName];

    // 如果没有监听器，记录日志并返回
    if (!listeners || listeners.length === 0) {
      console.log(`📡 事件 ${eventName} 没有订阅者`);
      return;
    }

    console.log(`📡 广播事件: ${eventName}，订阅者数量: ${listeners.length}`, data);

    // 依次调用所有监听器（按优先级顺序）
    // 使用for循环而不是forEach，支持async/await
    for (const listener of listeners) {
      try {
        // 调用回调函数
        await listener.callback(data);

        // 如果是 once 模式，执行完后自动取消订阅
        if (listener.once) {
          this.off(eventName, listener.callback);
        }
      } catch (error) {
        console.error(`❌ 事件 ${eventName} 的监听器执行失败:`, error);
        console.error(`   监听器ID: ${listener.id}`);
        console.error(`   创建时间: ${new Date(listener.createdAt).toLocaleString()}`);
      }
    }
  }

  /**
   * 触发事件（同步版本，不等待异步函数）
   * @param {string} eventName - 事件名称
   * @param {*} data - 传递给监听器的数据
   */
  emitSync(eventName, data = {}) {
    const listeners = this.listeners[eventName];

    if (!listeners || listeners.length === 0) {
      console.log(`📡 事件 ${eventName} 没有订阅者`);
      return;
    }

    console.log(`📡 广播事件(同步): ${eventName}，订阅者数量: ${listeners.length}`);

    // 同步调用所有监听器（不等待Promise）
    listeners.forEach((listener) => {
      try {
        const result = listener.callback(data);

        // 如果是 once 模式，执行完后自动取消订阅
        if (listener.once) {
          this.off(eventName, listener.callback);
        }

        // 如果返回的是Promise，给出警告（可能不是期望的行为）
        if (result && typeof result.then === 'function') {
          console.warn(`⚠️ 事件 ${eventName} 的监听器返回了Promise，但emitSync不会等待`);
        }
      } catch (error) {
        console.error(`❌ 事件 ${eventName} 的监听器执行失败:`, error);
      }
    });
  }

  /**
   * 获取事件的所有监听器
   * @param {string} eventName - 事件名称
   * @returns {Array} 监听器数组
   */
  getListeners(eventName) {
    return this.listeners[eventName] || [];
  }

  /**
   * 获取所有事件名称
   * @returns {Array<string>}
   */
  getEventNames() {
    return Object.keys(this.listeners);
  }

  /**
   * 获取事件监听器数量
   * @param {string} eventName - 事件名称
   * @returns {number}
   */
  listenerCount(eventName) {
    if (!eventName) {
      // 返回所有事件的监听器总数
      let total = 0;
      Object.values(this.listeners).forEach((listeners) => {
        total += listeners.length;
      });
      return total;
    }

    return (this.listeners[eventName] || []).length;
  }

  /**
   * 设置最大监听器数量
   * @param {number} max - 最大数量
   */
  setMaxListeners(max) {
    if (typeof max !== 'number' || max < 1) {
      console.error('❌ max 必须是大于0的数字');
      return;
    }

    this.maxListeners = max;
    console.log(`📡 最大监听器数量已设置为: ${max}`);
  }

  /**
   * 清除所有事件监听器
   * 大白话：关闭广播站（一般用于页面卸载时清理）
   */
  clear() {
    const eventCount = Object.keys(this.listeners).length;
    const listenerCount = this.listenerCount();

    this.listeners = {};

    console.log(`📡 事件中心已清空 (${eventCount}个事件, ${listenerCount}个监听器)`);
  }

  /**
   * 清除指定事件的所有监听器
   * @param {string} eventName - 事件名称
   */
  clearEvent(eventName) {
    if (this.listeners[eventName]) {
      const count = this.listeners[eventName].length;
      delete this.listeners[eventName];
      console.log(`📡 事件 ${eventName} 已清空 (${count}个监听器)`);
    }
  }

  /**
   * 打印所有事件和监听器信息（调试用）
   */
  printDebugInfo() {
    console.group('📡 EventHub 调试信息');

    const eventNames = this.getEventNames();
    console.log(`事件总数: ${eventNames.length}`);
    console.log(`监听器总数: ${this.listenerCount()}`);

    if (eventNames.length > 0) {
      console.group('事件列表:');
      eventNames.forEach((eventName) => {
        const listeners = this.getListeners(eventName);
        console.log(`- ${eventName}: ${listeners.length}个监听器`);

        listeners.forEach((listener, index) => {
          console.log(`  ${index + 1}. 优先级:${listener.priority}, once:${listener.once}, ID:${listener.id}`);
        });
      });
      console.groupEnd();
    }

    console.groupEnd();
  }

  /**
   * 生成唯一ID
   * @returns {string}
   */
  _generateId() {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出到全局（单例模式，全局只有一个事件中心）
window.EventHub = new EventHub();

console.log('✅ event-hub.js 加载完成');
