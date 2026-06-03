/**
 * skill-event-hub.test.js - EventHub 单元测试
 *
 * 测试范围：
 * 1. 事件订阅（on）
 * 2. 事件发布（emit）
 * 3. 事件取消订阅（off）
 * 4. 多监听器支持
 * 5. 错误处理
 * 6. 边界情况和异常处理
 */

// ============================================================
// 模拟 EventHub 类
// ============================================================

class EventHub {
  constructor() {
    this.events = {};
    this.onceEvents = {};
  }

  /**
   * 订阅事件
   * @param {string} event - 事件名称
   * @param {function} callback - 回调函数
   * @returns {function} 取消订阅的函数
   */
  on(event, callback) {
    if (!event || typeof event !== 'string') {
      throw new Error('事件名称必须是非空字符串');
    }

    if (!callback || typeof callback !== 'function') {
      throw new Error('回调函数必须是函数');
    }

    if (!this.events[event]) {
      this.events[event] = [];
    }

    this.events[event].push(callback);

    // 返回取消订阅的函数
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * 订阅事件（一次性）
   * @param {string} event - 事件名称
   * @param {function} callback - 回调函数
   */
  once(event, callback) {
    if (!event || typeof event !== 'string') {
      throw new Error('事件名称必须是非空字符串');
    }

    if (!callback || typeof callback !== 'function') {
      throw new Error('回调函数必须是函数');
    }

    if (!this.onceEvents[event]) {
      this.onceEvents[event] = [];
    }

    this.onceEvents[event].push(callback);
  }

  /**
   * 取消订阅
   * @param {string} event - 事件名称
   * @param {function} [callback] - 回调函数（不提供则取消所有）
   */
  off(event, callback) {
    if (!event || typeof event !== 'string') {
      throw new Error('事件名称必须是非空字符串');
    }

    if (!this.events[event]) {
      return;
    }

    if (callback) {
      // 取消特定回调
      this.events[event] = this.events[event].filter((cb) => cb !== callback);

      // 如果该事件没有监听器了，删除事件
      if (this.events[event].length === 0) {
        delete this.events[event];
      }
    } else {
      // 取消所有回调
      delete this.events[event];
    }
  }

  /**
   * 发布事件
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    if (!event || typeof event !== 'string') {
      throw new Error('事件名称必须是非空字符串');
    }

    const results = [];

    // 触发普通监听器
    if (this.events[event]) {
      this.events[event].forEach((callback) => {
        try {
          const result = callback(data);
          results.push(result);
        } catch (error) {
          console.error(`EventHub error in ${event}:`, error);
          results.push({ error: error.message });
        }
      });
    }

    // 触发一次性监听器
    if (this.onceEvents[event]) {
      const callbacks = [...this.onceEvents[event]];

      // 清空一次性监听器
      delete this.onceEvents[event];

      callbacks.forEach((callback) => {
        try {
          const result = callback(data);
          results.push(result);
        } catch (error) {
          console.error(`EventHub error in ${event}:`, error);
          results.push({ error: error.message });
        }
      });
    }

    return results;
  }

  /**
   * 清除所有事件监听器
   */
  clear() {
    this.events = {};
    this.onceEvents = {};
  }

  /**
   * 获取事件监听器数量
   * @param {string} event - 事件名称
   * @returns {number} 监听器数量
   */
  listenerCount(event) {
    if (!event || typeof event !== 'string') {
      return 0;
    }

    let count = 0;

    if (this.events[event]) {
      count += this.events[event].length;
    }

    if (this.onceEvents[event]) {
      count += this.onceEvents[event].length;
    }

    return count;
  }

  /**
   * 获取所有已注册的事件名称
   * @returns {Array<string>} 事件名称数组
   */
  eventNames() {
    const normalEvents = Object.keys(this.events);
    const onceEvents = Object.keys(this.onceEvents);

    // 合并并去重
    return [...new Set([...normalEvents, ...onceEvents])];
  }
}

// ============================================================
// 测试用例
// ============================================================

describe('EventHub - 事件总线单元测试', () => {
  let eventHub;
  let consoleSpy;

  // 每个测试前创建新的事件总线实例
  beforeEach(() => {
    eventHub = new EventHub();

    // 模拟 console.error
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  // 每个测试后清理
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================================
  // 1. 事件订阅测试
  // ============================================================

  describe('on() - 事件订阅', () => {
    test('应该成功订阅事件', () => {
      const callback = jest.fn();
      eventHub.on('test-event', callback);

      expect(eventHub.events['test-event']).toBeDefined();
      expect(eventHub.events['test-event'].length).toBe(1);
      expect(eventHub.events['test-event'][0]).toBe(callback);
    });

    test('应该支持多次订阅同一事件', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      eventHub.on('test-event', callback1);
      eventHub.on('test-event', callback2);

      expect(eventHub.events['test-event'].length).toBe(2);
    });

    test('应该在事件名称为空时抛出异常', () => {
      const callback = jest.fn();

      expect(() => {
        eventHub.on('', callback);
      }).toThrow('事件名称必须是非空字符串');
    });

    test('应该在事件名称不是字符串时抛出异常', () => {
      const callback = jest.fn();

      expect(() => {
        eventHub.on(123, callback);
      }).toThrow('事件名称必须是非空字符串');
    });

    test('应该在回调函数不是函数时抛出异常', () => {
      expect(() => {
        eventHub.on('test-event', 'not a function');
      }).toThrow('回调函数必须是函数');
    });

    test('应该返回取消订阅的函数', () => {
      const callback = jest.fn();
      const unsubscribe = eventHub.on('test-event', callback);

      expect(typeof unsubscribe).toBe('function');

      // 调用返回的函数应该取消订阅
      unsubscribe();
      expect(eventHub.events['test-event']).toBeUndefined();
    });
  });

  // ============================================================
  // 2. 事件发布测试
  // ============================================================

  describe('emit() - 事件发布', () => {
    test('应该成功触发事件监听器', () => {
      const callback = jest.fn();
      eventHub.on('test-event', callback);

      eventHub.emit('test-event', { data: 'test' });

      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    test('应该触发所有监听器', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      eventHub.on('test-event', callback1);
      eventHub.on('test-event', callback2);

      eventHub.emit('test-event', { data: 'test' });

      expect(callback1).toHaveBeenCalledWith({ data: 'test' });
      expect(callback2).toHaveBeenCalledWith({ data: 'test' });
    });

    test('应该传递数据给监听器', () => {
      const callback = jest.fn();
      eventHub.on('test-event', callback);

      const testData = { id: 1, name: '测试数据' };
      eventHub.emit('test-event', testData);

      expect(callback).toHaveBeenCalledWith(testData);
    });

    test('应该支持无数据发布', () => {
      const callback = jest.fn();
      eventHub.on('test-event', callback);

      eventHub.emit('test-event');

      expect(callback).toHaveBeenCalledWith(undefined);
    });

    test('应该在事件不存在时静默处理', () => {
      expect(() => {
        eventHub.emit('non-existent-event');
      }).not.toThrow();
    });

    test('应该在事件名称为空时抛出异常', () => {
      expect(() => {
        eventHub.emit('');
      }).toThrow('事件名称必须是非空字符串');
    });

    test('应该捕获监听器抛出的异常', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('监听器错误');
      });

      eventHub.on('test-event', errorCallback);

      expect(() => {
        eventHub.emit('test-event');
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
    });

    test('应该返回监听器返回值数组', () => {
      const callback1 = jest.fn(() => 'result1');
      const callback2 = jest.fn(() => 'result2');

      eventHub.on('test-event', callback1);
      eventHub.on('test-event', callback2);

      const results = eventHub.emit('test-event');

      expect(results).toEqual(['result1', 'result2']);
    });
  });

  // ============================================================
  // 3. 事件取消订阅测试
  // ============================================================

  describe('off() - 事件取消订阅', () => {
    test('应该成功取消特定监听器', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      eventHub.on('test-event', callback1);
      eventHub.on('test-event', callback2);

      eventHub.off('test-event', callback1);

      expect(eventHub.events['test-event'].length).toBe(1);
      expect(eventHub.events['test-event'][0]).toBe(callback2);
    });

    test('应该成功取消所有监听器', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      eventHub.on('test-event', callback1);
      eventHub.on('test-event', callback2);

      eventHub.off('test-event');

      expect(eventHub.events['test-event']).toBeUndefined();
    });

    test('应该在事件不存在时静默处理', () => {
      expect(() => {
        eventHub.off('non-existent-event');
      }).not.toThrow();
    });

    test('应该在事件名称为空时抛出异常', () => {
      expect(() => {
        eventHub.off('');
      }).toThrow('事件名称必须是非空字符串');
    });

    test('应该自动清理空事件数组', () => {
      const callback = jest.fn();
      eventHub.on('test-event', callback);

      eventHub.off('test-event', callback);

      expect(eventHub.events['test-event']).toBeUndefined();
    });
  });

  // ============================================================
  // 4. 一次性事件测试
  // ============================================================

  describe('once() - 一次性事件订阅', () => {
    test('应该成功订阅一次性事件', () => {
      const callback = jest.fn();
      eventHub.once('test-event', callback);

      expect(eventHub.onceEvents['test-event']).toBeDefined();
      expect(eventHub.onceEvents['test-event'].length).toBe(1);
    });

    test('应该只触发一次监听器', () => {
      const callback = jest.fn();
      eventHub.once('test-event', callback);

      eventHub.emit('test-event', 'data1');
      eventHub.emit('test-event', 'data2');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('data1');
    });

    test('应该在触发后自动移除监听器', () => {
      const callback = jest.fn();
      eventHub.once('test-event', callback);

      eventHub.emit('test-event');

      expect(eventHub.onceEvents['test-event']).toBeUndefined();
    });

    test('应该在事件名称为空时抛出异常', () => {
      const callback = jest.fn();

      expect(() => {
        eventHub.once('', callback);
      }).toThrow('事件名称必须是非空字符串');
    });

    test('应该在回调函数不是函数时抛出异常', () => {
      expect(() => {
        eventHub.once('test-event', 'not a function');
      }).toThrow('回调函数必须是函数');
    });
  });

  // ============================================================
  // 5. 混合事件测试（普通 + 一次性）
  // ============================================================

  describe('混合事件（普通 + 一次性）', () => {
    test('应该同时触发普通和一次性监听器', () => {
      const normalCallback = jest.fn();
      const onceCallback = jest.fn();

      eventHub.on('test-event', normalCallback);
      eventHub.once('test-event', onceCallback);

      eventHub.emit('test-event', 'data');

      expect(normalCallback).toHaveBeenCalledWith('data');
      expect(onceCallback).toHaveBeenCalledWith('data');
    });

    test('应该只移除一次性监听器（普通监听器保留）', () => {
      const normalCallback = jest.fn();
      const onceCallback = jest.fn();

      eventHub.on('test-event', normalCallback);
      eventHub.once('test-event', onceCallback);

      eventHub.emit('test-event');

      expect(eventHub.events['test-event']).toBeDefined();
      expect(eventHub.onceEvents['test-event']).toBeUndefined();
    });
  });

  // ============================================================
  // 6. 清除所有事件测试
  // ============================================================

  describe('clear() - 清除所有事件', () => {
    test('应该成功清除所有事件', () => {
      eventHub.on('event1', jest.fn());
      eventHub.on('event2', jest.fn());
      eventHub.once('event3', jest.fn());

      eventHub.clear();

      expect(eventHub.events).toEqual({});
      expect(eventHub.onceEvents).toEqual({});
    });

    test('应该在没有事件时正常工作', () => {
      expect(() => {
        eventHub.clear();
      }).not.toThrow();

      expect(eventHub.events).toEqual({});
      expect(eventHub.onceEvents).toEqual({});
    });
  });

  // ============================================================
  // 7. 监听器计数测试
  // ============================================================

  describe('listenerCount() - 监听器计数', () => {
    test('应该返回 0（事件不存在）', () => {
      const count = eventHub.listenerCount('non-existent');

      expect(count).toBe(0);
    });

    test('应该返回普通监听器数量', () => {
      eventHub.on('test-event', jest.fn());
      eventHub.on('test-event', jest.fn());
      eventHub.on('test-event', jest.fn());

      const count = eventHub.listenerCount('test-event');

      expect(count).toBe(3);
    });

    test('应该返回一次性监听器数量', () => {
      eventHub.once('test-event', jest.fn());
      eventHub.once('test-event', jest.fn());

      const count = eventHub.listenerCount('test-event');

      expect(count).toBe(2);
    });

    test('应该返回总监听器数量（普通 + 一次性）', () => {
      eventHub.on('test-event', jest.fn());
      eventHub.on('test-event', jest.fn());
      eventHub.once('test-event', jest.fn());

      const count = eventHub.listenerCount('test-event');

      expect(count).toBe(3);
    });

    test('应该在事件名称为空时返回 0', () => {
      const count = eventHub.listenerCount('');

      expect(count).toBe(0);
    });
  });

  // ============================================================
  // 8. 事件名称列表测试
  // ============================================================

  describe('eventNames() - 获取所有事件名称', () => {
    test('应该返回空数组（无事件）', () => {
      const events = eventHub.eventNames();

      expect(events).toEqual([]);
    });

    test('应该返回所有普通事件名称', () => {
      eventHub.on('event1', jest.fn());
      eventHub.on('event2', jest.fn());

      const events = eventHub.eventNames();

      expect(events).toContain('event1');
      expect(events).toContain('event2');
      expect(events.length).toBe(2);
    });

    test('应该返回所有一次性事件名称', () => {
      eventHub.once('event1', jest.fn());
      eventHub.once('event2', jest.fn());

      const events = eventHub.eventNames();

      expect(events).toContain('event1');
      expect(events).toContain('event2');
      expect(events.length).toBe(2);
    });

    test('应该去重（普通 + 一次性有相同事件名称）', () => {
      eventHub.on('event1', jest.fn());
      eventHub.once('event1', jest.fn());

      const events = eventHub.eventNames();

      expect(events).toContain('event1');
      expect(events.length).toBe(1);
    });
  });

  // ============================================================
  // 9. 边界情况测试
  // ============================================================

  describe('边界情况', () => {
    test('应该处理特殊字符的事件名称', () => {
      const callback = jest.fn();
      const specialEventName = 'event-测试_123@#$';

      eventHub.on(specialEventName, callback);
      eventHub.emit(specialEventName, 'data');

      expect(callback).toHaveBeenCalledWith('data');
    });

    test('应该处理非常长的事件名称', () => {
      const callback = jest.fn();
      const longEventName = 'A'.repeat(1000);

      eventHub.on(longEventName, callback);
      eventHub.emit(longEventName, 'data');

      expect(callback).toHaveBeenCalledWith('data');
    });

    test('应该处理非常大的数据对象', () => {
      const callback = jest.fn();
      const largeData = { data: 'A'.repeat(1000000) };

      eventHub.on('test-event', callback);
      eventHub.emit('test-event', largeData);

      expect(callback).toHaveBeenCalledWith(largeData);
    });

    test('应该处理监听器返回 undefined', () => {
      const callback = jest.fn(() => undefined);

      eventHub.on('test-event', callback);
      const results = eventHub.emit('test-event');

      expect(results).toContain(undefined);
    });

    test('应该处理监听器返回 Promise', async () => {
      const callback = jest.fn(() => Promise.resolve('async result'));

      eventHub.on('test-event', callback);
      const results = eventHub.emit('test-event');

      expect(results[0]).toBeInstanceOf(Promise);
      const resolved = await results[0];
      expect(resolved).toBe('async result');
    });
  });

  // ============================================================
  // 10. 实际使用场景测试
  // ============================================================

  describe('实际使用场景', () => {
    test('插件初始化事件流程', () => {
      const initListener = jest.fn();
      const readyListener = jest.fn();

      // 订阅插件初始化事件
      eventHub.on('plugin-init', initListener);

      // 订阅插件就绪事件
      eventHub.on('plugin-ready', readyListener);

      // 发布初始化事件
      eventHub.emit('plugin-init', { pluginName: '测试插件' });
      expect(initListener).toHaveBeenCalledWith({ pluginName: '测试插件' });

      // 发布就绪事件
      eventHub.emit('plugin-ready', { pluginName: '测试插件', status: 'ready' });
      expect(readyListener).toHaveBeenCalledWith({ pluginName: '测试插件', status: 'ready' });
    });

    test('错误事件处理流程', () => {
      const errorHandler = jest.fn();

      eventHub.on('error', errorHandler);

      // 发布错误事件
      eventHub.emit('error', {
        pluginName: '测试插件',
        error: '初始化失败',
        timestamp: new Date().toISOString()
      });

      expect(errorHandler).toHaveBeenCalledWith({
        pluginName: '测试插件',
        error: '初始化失败',
        timestamp: expect.any(String)
      });
    });

    test('事件链（一个事件触发另一个事件）', () => {
      const chainListener = jest.fn();

      // 第一个事件的监听器触发第二个事件
      eventHub.on('event1', (data) => {
        eventHub.emit('event2', { from: 'event1', data });
      });

      eventHub.on('event2', chainListener);

      // 触发事件链
      eventHub.emit('event1', 'initial data');

      expect(chainListener).toHaveBeenCalledWith({
        from: 'event1',
        data: 'initial data'
      });
    });
  });
});
