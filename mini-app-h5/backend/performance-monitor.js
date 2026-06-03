/**
 * performance-monitor.js - Skill 性能监控工具
 *
 * @description 监控 Skill 系统性能，包括插件加载时间、执行时间、内存占用等
 * @version 1.0.0
 * @date 2026-06-03
 *
 * 功能：
 * 1. 监控插件加载性能
 * 2. 监控插件执行性能
 * 3. 监控事件委托性能
 * 4. 生成性能报告
 * 5. 提供性能优化建议
 */

(class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pluginLoadTimes: new Map(), // 插件加载时间
      pluginExecuteTimes: new Map(), // 插件执行时间
      eventDelegateTimes: new Map(), // 事件委托处理时间
      memoryUsage: [], // 内存占用快照
      cacheHitRate: { hits: 0, misses: 0 } // 缓存命中率
    };

    this.enabled = true;
    this.sampleInterval = 5000; // 5秒采样一次
    this.maxSamples = 100; // 最多保存100个样本

    console.log('📊 性能监控工具已创建');
  }

  /**
   * 开始监控
   */
  start() {
    if (!this.enabled) {
      return;
    }

    console.log('📊 开始性能监控...');

    // 监控内存占用
    this._startMemoryMonitoring();

    // 拦截插件加载方法
    this._instrumentPluginLoader();

    // 拦截插件执行方法
    this._instrumentPluginExecute();

    // 拦截事件委托
    this._instrumentEventDelegate();

    console.log('✅ 性能监控已启动');
  }

  /**
   * 停止监控
   */
  stop() {
    this.enabled = false;
    console.log('📊 性能监控已停止');
  }

  /**
   * 生成性能报告
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this._generateSummary(),
      details: {
        pluginLoadTimes: this._analyzePluginLoadTimes(),
        pluginExecuteTimes: this._analyzePluginExecuteTimes(),
        eventDelegateTimes: this._analyzeEventDelegateTimes(),
        memoryUsage: this._analyzeMemoryUsage(),
        cacheHitRate: this._calculateCacheHitRate()
      },
      recommendations: this._generateRecommendations()
    };

    console.log('📊 性能报告:', report);
    return report;
  }

  /**
   * 监控内存占用
   */
  _startMemoryMonitoring() {
    if (!performance.memory) {
      console.warn('⚠️ 浏览器不支持 performance.memory');
      return;
    }

    setInterval(() => {
      if (!this.enabled) {
        return;
      }

      const memory = {
        timestamp: Date.now(),
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };

      this.metrics.memoryUsage.push(memory);

      // 限制样本数量
      if (this.metrics.memoryUsage.length > this.maxSamples) {
        this.metrics.memoryUsage.shift();
      }
    }, this.sampleInterval);
  }

  /**
   * 拦截插件加载方法
   */
  _instrumentPluginLoader() {
    if (!window.PluginLoader) {
      return;
    }

    const originalLoad = window.PluginLoader.load;
    const self = this;

    window.PluginLoader.load = async function (pluginPath, ...args) {
      const startTime = performance.now();
      try {
        const result = await originalLoad.call(this, pluginPath, ...args);
        const endTime = performance.now();
        const loadTime = endTime - startTime;

        self.metrics.pluginLoadTimes.set(pluginPath, {
          time: loadTime,
          timestamp: Date.now(),
          success: true
        });

        console.log(`📊 插件加载: ${pluginPath} (${loadTime.toFixed(2)}ms)`);
        return result;
      } catch (error) {
        const endTime = performance.now();
        const loadTime = endTime - startTime;

        self.metrics.pluginLoadTimes.set(pluginPath, {
          time: loadTime,
          timestamp: Date.now(),
          success: false,
          error: error.message
        });

        throw error;
      }
    };
  }

  /**
   * 拦截插件执行方法
   */
  _instrumentPluginExecute() {
    const originalInit = SkillPluginBase.prototype.init;
    const originalExecute = SkillPluginBase.prototype.execute;
    const self = this;

    SkillPluginBase.prototype.init = async function (...args) {
      const startTime = performance.now();
      try {
        const result = await originalInit.call(this, ...args);
        const endTime = performance.now();
        const executeTime = endTime - startTime;

        if (!self.metrics.pluginExecuteTimes.has(this.name)) {
          self.metrics.pluginExecuteTimes.set(this.name, []);
        }

        self.metrics.pluginExecuteTimes.get(this.name).push({
          operation: 'init',
          time: executeTime,
          timestamp: Date.now()
        });

        console.log(`📊 插件初始化: ${this.name} (${executeTime.toFixed(2)}ms)`);
        return result;
      } catch (error) {
        const endTime = performance.now();
        const executeTime = endTime - startTime;

        if (!self.metrics.pluginExecuteTimes.has(this.name)) {
          self.metrics.pluginExecuteTimes.set(this.name, []);
        }

        self.metrics.pluginExecuteTimes.get(this.name).push({
          operation: 'init',
          time: executeTime,
          timestamp: Date.now(),
          error: error.message
        });

        throw error;
      }
    };

    SkillPluginBase.prototype.execute = async function (...args) {
      const startTime = performance.now();
      try {
        const result = await originalExecute.call(this, ...args);
        const endTime = performance.now();
        const executeTime = endTime - startTime;

        if (!self.metrics.pluginExecuteTimes.has(this.name)) {
          self.metrics.pluginExecuteTimes.set(this.name, []);
        }

        self.metrics.pluginExecuteTimes.get(this.name).push({
          operation: 'execute',
          time: executeTime,
          timestamp: Date.now()
        });

        console.log(`📊 插件执行: ${this.name} (${executeTime.toFixed(2)}ms)`);
        return result;
      } catch (error) {
        const endTime = performance.now();
        const executeTime = endTime - startTime;

        if (!self.metrics.pluginExecuteTimes.has(this.name)) {
          self.metrics.pluginExecuteTimes.set(this.name, []);
        }

        self.metrics.pluginExecuteTimes.get(this.name).push({
          operation: 'execute',
          time: executeTime,
          timestamp: Date.now(),
          error: error.message
        });

        throw error;
      }
    };
  }

  /**
   * 拦截事件委托
   */
  _instrumentEventDelegate() {
    if (!window.EventDelegate) {
      return;
    }

    const originalHandleClick = window.EventDelegate._handleClick;
    const self = this;

    if (originalHandleClick) {
      window.EventDelegate._handleClick = function (event) {
        const startTime = performance.now();
        try {
          const result = originalHandleClick.call(this, event);
          const endTime = performance.now();
          const handleTime = endTime - startTime;

          const action = event.target.getAttribute('data-action');
          if (action) {
            if (!self.metrics.eventDelegateTimes.has(action)) {
              self.metrics.eventDelegateTimes.set(action, []);
            }

            self.metrics.eventDelegateTimes.get(action).push({
              time: handleTime,
              timestamp: Date.now()
            });
          }

          console.log(`📊 事件处理: ${action} (${handleTime.toFixed(2)}ms)`);
          return result;
        } catch (error) {
          const endTime = performance.now();
          const handleTime = endTime - startTime;

          console.error(`❌ 事件处理失败: ${action} (${handleTime.toFixed(2)}ms)`, error);
          throw error;
        }
      };
    }
  }

  /**
   * 生成性能摘要
   */
  _generateSummary() {
    const summary = {
      totalPluginsLoaded: this.metrics.pluginLoadTimes.size,
      totalPluginsExecuted: this.metrics.pluginExecuteTimes.size,
      totalEventsHandled: this.metrics.eventDelegateTimes.size,
      averageLoadTime: this._calculateAverageLoadTime(),
      averageExecuteTime: this._calculateAverageExecuteTime(),
      averageEventHandleTime: this._calculateAverageEventHandleTime()
    };

    return summary;
  }

  /**
   * 分析插件加载时间
   */
  _analyzePluginLoadTimes() {
    const analysis = {};

    this.metrics.pluginLoadTimes.forEach((data, pluginPath) => {
      analysis[pluginPath] = {
        loadTime: data.time,
        timestamp: data.timestamp,
        success: data.success,
        error: data.error || null
      };
    });

    return analysis;
  }

  /**
   * 分析插件执行时间
   */
  _analyzePluginExecuteTimes() {
    const analysis = {};

    this.metrics.pluginExecuteTimes.forEach((dataArray, pluginName) => {
      const times = dataArray.map((d) => d.time);
      analysis[pluginName] = {
        count: dataArray.length,
        averageTime: times.reduce((a, b) => a + b, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        recentExecutions: dataArray.slice(-5) // 最近5次执行
      };
    });

    return analysis;
  }

  /**
   * 分析事件委托时间
   */
  _analyzeEventDelegateTimes() {
    const analysis = {};

    this.metrics.eventDelegateTimes.forEach((dataArray, action) => {
      const times = dataArray.map((d) => d.time);
      analysis[action] = {
        count: dataArray.length,
        averageTime: times.reduce((a, b) => a + b, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times)
      };
    });

    return analysis;
  }

  /**
   * 分析内存占用
   */
  _analyzeMemoryUsage() {
    if (this.metrics.memoryUsage.length === 0) {
      return { error: '没有内存数据' };
    }

    const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    const oldest = this.metrics.memoryUsage[0];

    return {
      current: {
        usedMB: (latest.usedJSHeapSize / 1024 / 1024).toFixed(2),
        totalMB: (latest.totalJSHeapSize / 1024 / 1024).toFixed(2),
        limitMB: (latest.jsHeapSizeLimit / 1024 / 1024).toFixed(2)
      },
      trend: {
        usedDiffMB: ((latest.usedJSHeapSize - oldest.usedJSHeapSize) / 1024 / 1024).toFixed(2),
        percentDiff: (((latest.usedJSHeapSize - oldest.usedJSHeapSize) / oldest.usedJSHeapSize) * 100).toFixed(2)
      },
      samples: this.metrics.memoryUsage.length
    };
  }

  /**
   * 计算缓存命中率
   */
  _calculateCacheHitRate() {
    const total = this.metrics.cacheHitRate.hits + this.metrics.cacheHitRate.misses;
    if (total === 0) {
      return { rate: 0, hits: 0, misses: 0 };
    }

    return {
      rate: ((this.metrics.cacheHitRate.hits / total) * 100).toFixed(2) + '%',
      hits: this.metrics.cacheHitRate.hits,
      misses: this.metrics.cacheHitRate.misses
    };
  }

  /**
   * 生成优化建议
   */
  _generateRecommendations() {
    const recommendations = [];

    // 检查插件加载时间
    const avgLoadTime = this._calculateAverageLoadTime();
    if (avgLoadTime > 1000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `插件平均加载时间 ${avgLoadTime.toFixed(2)}ms 过长，建议启用懒加载或预加载`
      });
    }

    // 检查插件执行时间
    const avgExecuteTime = this._calculateAverageExecuteTime();
    if (avgExecuteTime > 500) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `插件平均执行时间 ${avgExecuteTime.toFixed(2)}ms 过长，建议优化插件逻辑`
      });
    }

    // 检查事件处理时间
    const avgEventTime = this._calculateAverageEventHandleTime();
    if (avgEventTime > 100) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `事件平均处理时间 ${avgEventTime.toFixed(2)}ms 过长，建议优化事件处理器`
      });
    }

    // 检查内存占用
    if (this.metrics.memoryUsage.length > 0) {
      const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
      const memoryUsagePercent = (latest.usedJSHeapSize / latest.jsHeapSizeLimit) * 100;

      if (memoryUsagePercent > 80) {
        recommendations.push({
          type: 'memory',
          priority: 'high',
          message: `内存占用 ${memoryUsagePercent.toFixed(2)}% 过高，建议检查内存泄漏`
        });
      }
    }

    return recommendations;
  }

  /**
   * 计算平均加载时间
   */
  _calculateAverageLoadTime() {
    const times = Array.from(this.metrics.pluginLoadTimes.values()).map((d) => d.time);
    if (times.length === 0) {
      return 0;
    }
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  /**
   * 计算平均执行时间
   */
  _calculateAverageExecuteTime() {
    let totalTime = 0;
    let totalCount = 0;

    this.metrics.pluginExecuteTimes.forEach((dataArray) => {
      dataArray.forEach((d) => {
        totalTime += d.time;
        totalCount++;
      });
    });

    if (totalCount === 0) {
      return 0;
    }
    return totalTime / totalCount;
  }

  /**
   * 计算平均事件处理时间
   */
  _calculateAverageEventHandleTime() {
    let totalTime = 0;
    let totalCount = 0;

    this.metrics.eventDelegateTimes.forEach((dataArray) => {
      dataArray.forEach((d) => {
        totalTime += d.time;
        totalCount++;
      });
    });

    if (totalCount === 0) {
      return 0;
    }
    return totalTime / totalCount;
  }
});

// 导出到全局
window.PerformanceMonitor = PerformanceMonitor;

// 自动创建实例
window.performanceMonitor = new PerformanceMonitor();

console.log('📊 PerformanceMonitor 已加载');
