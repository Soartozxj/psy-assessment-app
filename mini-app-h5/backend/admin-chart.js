/**
 * admin-chart.js - Chart.js 图表升级模块
 *
 * 解决 P2-1: 数据看板手写 SVG 图表问题
 * 使用 Chart.js 替代 describeArc() 手绘弧形路径
 *
 * @version 1.0.0
 * @date 2026-05-20
 */

(function (global) {
  'use strict';

  // ====================================================
  // ChartUtils 命名空间
  // ====================================================
  const ChartUtils = {};

  // Chart.js 实例缓存（用于销毁重建）
  let _chartInstances = {};

  // 分类颜色映射
  const CATEGORY_COLORS = {
    'SCL-90': '#1890ff',
    SDS: '#52c41a',
    SAS: '#faad14',
    EPQ: '#722ed1',
    瑞文: '#eb2f96',
    MMSE: '#13c2c2',
    焦虑: '#fa8c16',
    抑郁: '#a0d911',
    其他: '#bfbfbf'
  };

  /**
   * 获取分类颜色
   */
  function getCategoryColor(category) {
    return CATEGORY_COLORS[category] || '#bfbfbf';
  }

  // ====================================================
  // 饼图/环形图
  // ====================================================

  /**
   * 渲染饼图（替代 describeArc）
   * @param {string} canvasId - Canvas 元素 ID
   * @param {Object[]} data - 数据数组 [{label, value}]
   * @param {Object} [options] - 配置选项
   */
  ChartUtils.renderPieChart = function (canvasId, data, options) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn('Canvas element not found:', canvasId);
      return null;
    }

    // 销毁旧实例
    if (_chartInstances[canvasId]) {
      _chartInstances[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    const config = Object.assign(
      {
        type: 'doughnut',
        data: {
          labels: data.map(function (d) {
            return d.label;
          }),
          datasets: [
            {
              data: data.map(function (d) {
                return d.value;
              }),
              backgroundColor: data.map(function (d) {
                return d.color || getCategoryColor(d.label);
              }),
              borderWidth: 2,
              borderColor: '#fff'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '50%', // 环形图效果
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                padding: 15,
                usePointStyle: true,
                font: { size: 12 }
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const total = context.dataset.data.reduce(function (a, b) {
                    return a + b;
                  }, 0);
                  const value = context.raw;
                  const pct = ((value / total) * 100).toFixed(1);
                  return context.label + ': ' + value + ' (' + pct + '%)';
                }
              }
            }
          },
          animation: {
            animateRotate: true,
            animateScale: true
          }
        }
      },
      options
    );

    _chartInstances[canvasId] = new Chart(ctx, config);
    return _chartInstances[canvasId];
  };

  // ====================================================
  // 柱状图
  // ====================================================

  /**
   * 渲染水平柱状图
   * @param {string} canvasId - Canvas 元素 ID
   * @param {Object[]} data - 数据数组 [{label, value, color}]
   * @param {Object} [options] - 配置选项
   */
  ChartUtils.renderBarChart = function (canvasId, data, options) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn('Canvas element not found:', canvasId);
      return null;
    }

    // 销毁旧实例
    if (_chartInstances[canvasId]) {
      _chartInstances[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    const config = Object.assign(
      {
        type: 'bar',
        data: {
          labels: data.map(function (d) {
            return d.label;
          }),
          datasets: [
            {
              data: data.map(function (d) {
                return d.value;
              }),
              backgroundColor: data.map(function (d) {
                return d.color || '#1890ff';
              }),
              borderRadius: 4,
              barThickness: 20
            }
          ]
        },
        options: {
          indexAxis: 'y', // 水平柱状图
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return context.raw.toLocaleString() + ' 次完成';
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { display: false }
            },
            y: {
              grid: { display: false }
            }
          }
        }
      },
      options
    );

    _chartInstances[canvasId] = new Chart(ctx, config);
    return _chartInstances[canvasId];
  };

  // ====================================================
  // 折线图
  // ====================================================

  /**
   * 渲染折线图
   * @param {string} canvasId - Canvas 元素 ID
   * @param {Object[]} labels - X 轴标签
   * @param {Object[]} values - Y 轴数据
   * @param {Object} [options] - 配置选项
   */
  ChartUtils.renderLineChart = function (canvasId, labels, values, options) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn('Canvas element not found:', canvasId);
      return null;
    }

    // 销毁旧实例
    if (_chartInstances[canvasId]) {
      _chartInstances[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    const config = Object.assign(
      {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: '完成次数',
              data: values,
              borderColor: '#1890ff',
              backgroundColor: 'rgba(24, 144, 255, 0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 3,
              pointHoverRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#f0f0f0' }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      },
      options
    );

    _chartInstances[canvasId] = new Chart(ctx, config);
    return _chartInstances[canvasId];
  };

  // ====================================================
  // 数据看板集成
  // ====================================================

  /**
   * 渲染数据看板（使用 Chart.js 替代手绘 SVG）
   * @param {Object[]} scales - 量表数据
   */
  ChartUtils.renderDashboard = function (scales) {
    if (typeof window.Chart === 'undefined') {
      console.warn('Chart.js not loaded, falling back to SVG');
      return false;
    }

    // 1. 渲染饼图（按分类统计）
    const catCounts = {};
    scales.forEach(function (s) {
      const cat = s.category || '其他';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    const pieData = Object.entries(catCounts).map(function (entry) {
      return { label: entry[0], value: entry[1] };
    });
    ChartUtils.renderPieChart('pie-chart', pieData);

    // 2. 渲染柱状图（完成次数排行）
    const sorted = [...scales]
      .sort(function (a, b) {
        return (b.completedCount || 0) - (a.completedCount || 0);
      })
      .slice(0, 10); // 只显示前 10

    const barData = sorted.map(function (s) {
      return {
        label: s.shortName || s.name.split(' ')[0],
        value: s.completedCount || 0,
        color: s.color || getCategoryColor(s.category)
      };
    });
    ChartUtils.renderBarChart('bar-chart', barData);

    return true;
  };

  // ====================================================
  // 工具方法
  // ====================================================

  /**
   * 销毁指定图表实例
   */
  ChartUtils.destroyChart = function (canvasId) {
    if (_chartInstances[canvasId]) {
      _chartInstances[canvasId].destroy();
      delete _chartInstances[canvasId];
    }
  };

  /**
   * 销毁所有图表实例
   */
  ChartUtils.destroyAll = function () {
    Object.keys(_chartInstances).forEach(function (id) {
      _chartInstances[id].destroy();
    });
    _chartInstances = {};
  };

  /**
   * 更新图表数据
   */
  ChartUtils.updateChart = function (canvasId, newData) {
    const chart = _chartInstances[canvasId];
    if (!chart) {
      return null;
    }

    chart.data.labels = newData.map(function (d) {
      return d.label;
    });
    chart.data.datasets[0].data = newData.map(function (d) {
      return d.value;
    });
    chart.update();
    return chart;
  };

  /**
   * 设置分类颜色
   */
  ChartUtils.setCategoryColor = function (category, color) {
    CATEGORY_COLORS[category] = color;
  };

  /**
   * 获取分类颜色
   */
  ChartUtils.getCategoryColor = function (category) {
    return CATEGORY_COLORS[category] || '#bfbfbf';
  };

  // ====================================================
  // 导出
  // ====================================================

  global.ChartUtils = ChartUtils;

  // 兼容旧 API（如果存在 describeArc，保留备选）
  if (typeof global.describeArc === 'undefined') {
    global.describeArc = function (cx, cy, r, startAngle, endAngle) {
      // SVG 弧形路径生成（保留兼容）
      const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
      const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
      const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
      const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
      const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
      return (
        'M ' +
        cx +
        ' ' +
        cy +
        ' L ' +
        x1 +
        ' ' +
        y1 +
        ' A ' +
        r +
        ' ' +
        r +
        ' 0 ' +
        largeArcFlag +
        ' 1 ' +
        x2 +
        ' ' +
        y2 +
        ' Z'
      );
    };
  }
})(window);
