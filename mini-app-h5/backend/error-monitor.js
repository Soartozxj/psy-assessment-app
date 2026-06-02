/**
 * 错误监控器 - 插件系统专用
 * 捕获和上报插件运行时的错误
 */

class ErrorMonitor {
  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/error-logs';
    this.maxQueueSize = options.maxQueueSize || 10;
    this.flushInterval = options.flushInterval || 5000;

    this.errorQueue = [];
    this.isFlushing = false;

    this.startFlushTimer();
  }

  /**
   * 初始化错误监控
   */
  init() {
    // 捕获 JavaScript 错误
    window.onerror = (message, source, lineno, colno, error) => {
      this.captureError({
        type: 'javascript',
        message,
        source,
        lineno,
        colno,
        stack: error?.stack,
        timestamp: new Date().toISOString()
      });
    };

    // 捕获 Promise 错误
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        type: 'promise',
        message: event.reason?.message || 'Promise rejection',
        stack: event.reason?.stack,
        timestamp: new Date().toISOString()
      });
    });

    console.log('✅ 错误监控已启动');
  }

  /**
   * 捕获错误
   * @param {object} error - 错误对象
   */
  captureError(error) {
    // 添加插件上下文
    error.pluginContext = this.getPluginContext();

    // 添加到队列
    this.errorQueue.push(error);

    // 如果队列已满，立即上报
    if (this.errorQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  /**
   * 获取插件上下文
   */
  getPluginContext() {
    const context = {};
    const pluginManager = window.PluginManager || window.pluginManager;

    if (pluginManager) {
      context.loadedPlugins = Object.keys(pluginManager.plugins || {});
      context.activePlugin = pluginManager.activePlugin?.name || null;
    }

    return context;
  }

  /**
   * 上报错误队列
   */
  async flush() {
    if (this.isFlushing || this.errorQueue.length === 0) {
      return;
    }

    this.isFlushing = true;
    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      // 在真实环境中，这里应该发送到服务器
      // 目前在控制台输出，方便调试
      if (typeof fetch !== 'undefined') {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errors })
        }).catch(() => {
          // 发送失败，重新加入队列
          this.errorQueue.unshift(...errors);
        });
      } else {
        // 开发环境，输出到控制台
        console.group('🚨 错误监控 - 捕获到', errors.length, '个错误');
        errors.forEach((err, i) => {
          console.error(`[${i + 1}] ${err.type}: ${err.message}`);
          if (err.stack) {
            console.error(err.stack);
          }
        });
        console.groupEnd();
      }
    } catch (error) {
      // 上报失败，重新加入队列
      this.errorQueue.unshift(...errors);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * 启动定时刷新
   */
  startFlushTimer() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }
}

// 导出到全局
window.ErrorMonitor = ErrorMonitor;

// 自动初始化（如果在浏览器环境）
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.errorMonitor = new ErrorMonitor();
    window.errorMonitor.init();
  });
}
