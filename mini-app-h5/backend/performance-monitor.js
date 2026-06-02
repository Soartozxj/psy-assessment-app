/**
 * 性能监控器 - 插件系统专用
 * 监控插件加载、执行性能和用户交互
 */

class PerformanceMonitor {
  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/performance-logs';
    this.sampleRate = options.sampleRate || 1.0; // 采样率
    this.maxQueueSize = options.maxQueueSize || 20;

    this.metricsQueue = [];
    this.isFlushing = false;
    this.pluginLoadTimes = {};

    this.startFlushTimer();
  }

  /**
   * 初始化性能监控
   */
  init() {
    // 监听页面加载性能
    this.measurePageLoad();

    // 监听插件加载性能
    this.interceptPluginLoading();

    console.log('✅ 性能监控已启动');
  }

  /**
   * 测量页面加载性能
   */
  measurePageLoad() {
    if (typeof PerformanceObserver !== 'undefined') {
      // 监听 Largest Contentful Paint (LCP)
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          this.captureMetric({
            type: 'lcp',
            value: entry.startTime,
            timestamp: new Date().toISOString()
          });
        }
      }).observe({ type: 'largest-contentful-paint' });

      // 监听 First Input Delay (FID)
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          this.captureMetric({
            type: 'fid',
            value: entry.processingStart - entry.startTime,
            timestamp: new Date().toISOString()
          });
        }
      }).observe({ type: 'first-input' });
    }

    // 监听页面加载完成
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.timing;
        this.captureMetric({
          type: 'page-load',
          value: perfData.loadEventEnd - perfData.navigationStart,
          timestamp: new Date().toISOString()
        });
      }, 0);
    });
  }

  /**
   * 拦截插件加载，测量加载时间
   */
  interceptPluginLoading() {
    const pluginManager = window.PluginManager || window.pluginManager;

    if (pluginManager && typeof pluginManager.loadPlugin === 'function') {
      const originalLoadPlugin = pluginManager.loadPlugin.bind(pluginManager);

      pluginManager.loadPlugin = async (pluginName) => {
        const startTime = performance.now();

        try {
          const plugin = await originalLoadPlugin(pluginName);
          const loadTime = performance.now() - startTime;

          this.captureMetric({
            type: 'plugin-load',
            pluginName,
            value: loadTime,
            timestamp: new Date().toISOString()
          });

          return plugin;
        } catch (error) {
          const loadTime = performance.now() - startTime;

          this.captureMetric({
            type: 'plugin-load-error',
            pluginName,
            value: loadTime,
            error: error.message,
            timestamp: new Date().toISOString()
          });

          throw error;
        }
      };
    }
  }

  /**
   * 捕获性能指标
   * @param {object} metric - 性能指标
   */
  captureMetric(metric) {
    // 采样
    if (Math.random() > this.sampleRate) {
      return;
    }

    this.metricsQueue.push(metric);

    if (this.metricsQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  /**
   * 测量插件执行时间
   * @param {string} pluginName - 插件名称
   * @param {string} action - 执行的动作
   * @param {function} fn - 要执行的函数
   */
  async measureExecution(pluginName, action, fn) {
    const startTime = performance.now();

    try {
      const result = await fn();
      const executionTime = performance.now() - startTime;

      this.captureMetric({
        type: 'plugin-execution',
        pluginName,
        action,
        value: executionTime,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;

      this.captureMetric({
        type: 'plugin-execution-error',
        pluginName,
        action,
        value: executionTime,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * 上报性能指标队列
   */
  async flush() {
    if (this.isFlushing || this.metricsQueue.length === 0) {
      return;
    }

    this.isFlushing = true;
    const metrics = [...this.metricsQueue];
    this.metricsQueue = [];

    try {
      if (typeof fetch !== 'undefined') {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metrics })
        }).catch(() => {
          this.metricsQueue.unshift(...metrics);
        });
      } else {
        // 开发环境，输出到控制台
        console.group('⚡ 性能监控 - 捕获到', metrics.length, '个指标');
        metrics.forEach((metric, i) => {
          console.log(`[${i + 1}] ${metric.type}: ${metric.value}ms`);
        });
        console.groupEnd();
      }
    } catch (error) {
      this.metricsQueue.unshift(...metrics);
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
    }, 10000); // 每 10 秒刷新一次
  }

  /**
   * 获取性能报告
   */
  getReport() {
    const metrics = this.metricsQueue;

    const report = {
      totalMetrics: metrics.length,
      byType: {},
      averageByType: {}
    };

    metrics.forEach((metric) => {
      if (!report.byType[metric.type]) {
        report.byType[metric.type] = [];
      }
      report.byType[metric.type].push(metric.value);
    });

    Object.keys(report.byType).forEach((type) => {
      const values = report.byType[type];
      report.averageByType[type] = values.reduce((a, b) => a + b, 0) / values.length;
    });

    return report;
  }
}

// 导出到全局
window.PerformanceMonitor = PerformanceMonitor;

// 自动初始化（如果在浏览器环境）
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.performanceMonitor = new PerformanceMonitor();
    window.performanceMonitor.init();
  });
}
