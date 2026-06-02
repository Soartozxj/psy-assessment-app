/**
 * 星蓝心镜系统 - 数据监控模块
 * 用于监控前后端数据一致性，提供数据同步状态反馈
 */

(function () {
  'use strict';

  // 数据状态监控器
  window.DataMonitor = {
    /**
     * 检查前后端数据一致性
     */
    checkDataConsistency: function () {
      try {
        // 获取后端数据
        const backendData = localStorage.getItem('psy_scales_admin');
        const frontendData = localStorage.getItem('psy_scales_synced');
        const sharedData = localStorage.getItem('psy_scales_data');

        const status = {
          backendCount: 0,
          frontendCount: 0,
          sharedCount: 0,
          backendScales: [],
          frontendScales: [],
          sharedScales: [],
          consistencyIssues: [],
          recommendations: []
        };

        // 解析后端数据
        if (backendData) {
          try {
            const parsed = JSON.parse(backendData);
            status.backendCount = Array.isArray(parsed) ? parsed.length : 0;
            status.backendScales = Array.isArray(parsed)
              ? parsed.map((s) => ({ id: s.id, name: s.name, status: s.status }))
              : [];
          } catch (e) {
            status.consistencyIssues.push('后端数据格式错误');
          }
        }

        // 解析前端同步数据
        if (frontendData) {
          try {
            const parsed = JSON.parse(frontendData);
            status.frontendCount = Array.isArray(parsed) ? parsed.length : 0;
            status.frontendScales = Array.isArray(parsed)
              ? parsed.map((s) => ({ id: s.id, name: s.name, status: s.status }))
              : [];
          } catch (e) {
            status.consistencyIssues.push('前端同步数据格式错误');
          }
        }

        // 解析共享数据
        if (sharedData) {
          try {
            const parsed = JSON.parse(sharedData);
            status.sharedCount = Array.isArray(parsed) ? parsed.length : 0;
            status.sharedScales = Array.isArray(parsed)
              ? parsed.map((s) => ({ id: s.id, name: s.name, status: s.status }))
              : [];
          } catch (e) {
            status.consistencyIssues.push('共享数据格式错误');
          }
        }

        // 检查一致性
        if (status.backendCount !== status.frontendCount && backendData) {
          status.consistencyIssues.push(
            `数据数量不一致：后端 ${status.backendCount} 个 vs 前端 ${status.frontendCount} 个`
          );
          status.recommendations.push('点击"同步到前端"按钮更新前端数据');
        }

        if (status.sharedCount !== status.backendCount && sharedData) {
          status.consistencyIssues.push(
            `共享数据与后端不一致：共享 ${status.sharedCount} 个 vs 后端 ${status.backendCount} 个`
          );
          status.recommendations.push('在后台管理页面重新保存数据');
        }

        // 检查活跃量表数量
        const activeFrontendScales = status.frontendScales.filter((s) => s.status === 1 || s.status === undefined);
        const activeBackendScales = status.backendScales.filter((s) => s.status === 1 || s.status === undefined);

        if (activeFrontendScales.length !== activeBackendScales.length) {
          status.consistencyIssues.push(
            `活跃量表数量不一致：前端 ${activeFrontendScales.length} 个 vs 后端 ${activeBackendScales.length} 个`
          );
          status.recommendations.push('检查后端管理页面中的量表状态设置');
        }

        return status;
      } catch (error) {
        console.error('检查数据一致性失败:', error);
        return {
          consistencyIssues: ['检查失败: ' + error.message],
          recommendations: ['请联系技术支持']
        };
      }
    },

    /**
     * 获取数据统计信息
     */
    getDataStatistics: function () {
      try {
        const scales = window.SharedData.getAllScales();
        const activeScales = window.SharedData.getActiveScales();
        const history = window.SharedData.getHistory();
        const userProfile = window.SharedData.getUserProfile();

        return {
          totalScales: scales.length,
          activeScales: activeScales.length,
          draftScales: scales.filter((s) => s.status === 0).length,
          totalQuestions: scales.reduce((sum, scale) => sum + (scale.questions ? scale.questions.length : 0), 0),
          totalCompletions: scales.reduce((sum, scale) => sum + (scale.completedCount || 0), 0),
          historyCount: history.length,
          userNickname: userProfile.nickname || '体验用户',
          lastUpdated: scales.length > 0 ? this.formatDate(new Date()) : '无数据'
        };
      } catch (error) {
        console.error('获取数据统计失败:', error);
        return {};
      }
    },

    /**
     * 格式日期
     */
    formatDate: function (date) {
      if (!date) {
        return '';
      }
      const d = new Date(date);
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    },

    /**
     * 显示数据监控面板
     */
    showMonitorPanel: function () {
      const stats = this.getDataStatistics();
      const consistency = this.checkDataConsistency();

      const panel = document.createElement('div');
      panel.className = 'data-monitor-panel';
      panel.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: white;
                border: 1px solid #e5e5e5;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                max-width: 400px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 14px;
                color: #333;
            `;

      let html = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                    <div style="font-weight:bold;color:#4A90D9">数据监控面板</div>
                    <div style="font-size:12px;color:#999;cursor:pointer" onclick="this.parentNode.parentNode.remove()">✕</div>
                </div>
                
                <div style="margin-bottom:15px">
                    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                        <span>总量表数：</span>
                        <span><strong>${stats.totalScales || 0}</strong> 个</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                        <span>活跃量表：</span>
                        <span><strong>${stats.activeScales || 0}</strong> 个</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                        <span>总测评次数：</span>
                        <span><strong>${stats.totalCompletions || 0}</strong> 次</span>
                    </div>
                </div>
            `;

      // 显示一致性检查结果
      if (consistency.consistencyIssues && consistency.consistencyIssues.length > 0) {
        html += `
                    <div style="margin-top:15px;padding:10px;background:#fff5f5;border-radius:6px;border-left:3px solid #ff4d4f">
                        <div style="font-weight:bold;color:#ff4d4f;margin-bottom:5px">⚠️ 数据一致性警告</div>
                `;

        consistency.consistencyIssues.forEach((issue) => {
          html += `<div style="margin-bottom:3px;font-size:13px">• ${issue}</div>`;
        });

        if (consistency.recommendations && consistency.recommendations.length > 0) {
          html += `
                        <div style="margin-top:8px;font-weight:bold;color:#333">建议操作：</div>
                    `;
          consistency.recommendations.forEach((rec) => {
            html += `<div style="margin-bottom:3px;font-size:13px">• ${rec}</div>`;
          });
        }

        html += '</div>';
      } else {
        html += `
                    <div style="margin-top:15px;padding:10px;background:#f6ffed;border-radius:6px;border-left:3px solid #52c41a">
                        <div style="font-weight:bold;color:#52c41a">✅ 数据一致性正常</div>
                        <div style="font-size:13px;margin-top:3px">前后端数据同步正常</div>
                    </div>
                `;
      }

      // 添加操作按钮
      html += `
                <div style="display:flex;gap:8px;margin-top:15px">
                    <button onclick="location.reload()" style="flex:1;padding:6px 12px;background:#4A90D9;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px">
                        刷新页面
                    </button>
                    <button onclick="window.SharedData.syncToFrontend() && location.reload()" style="flex:1;padding:6px 12px;background:#7ED321;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px">
                        同步前端
                    </button>
                </div>
            `;

      panel.innerHTML = html;
      document.body.appendChild(panel);

      // 10秒后自动关闭
      setTimeout(() => {
        if (panel.parentNode) {
          panel.style.opacity = '0';
          panel.style.transition = 'opacity 0.3s';
          setTimeout(() => {
            if (panel.parentNode) {
              panel.parentNode.removeChild(panel);
            }
          }, 300);
        }
      }, 10000);
    },

    /**
     * 初始化数据监控
     */
    init: function () {
      // 监听数据变化
      window.SharedData.addDataChangeListener(function (key) {
        // console.log(`数据发生变化: ${key}`);

        // 如果是在后端页面，显示通知
        if (document.title.includes('后台管理')) {
          const notification = document.createElement('div');
          notification.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #4A90D9;
                        color: white;
                        padding: 12px 16px;
                        border-radius: 6px;
                        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                        z-index: 10000;
                        animation: slideIn 0.3s ease;
                    `;

          let message = '';
          switch (key) {
            case 'psy_scales_data':
              message = '量表数据已更新';
              break;
            case 'psy_scales_synced':
              message = '前端数据已同步';
              break;
            case 'psy_assessment_history':
              message = '测评记录已更新';
              break;
            default:
              message = '数据已更新';
          }

          notification.textContent = `📊 ${message}`;
          document.body.appendChild(notification);

          setTimeout(() => {
            if (notification.parentNode) {
              notification.style.opacity = '0';
              notification.style.transition = 'opacity 0.3s';
              setTimeout(() => {
                if (notification.parentNode) {
                  notification.parentNode.removeChild(notification);
                }
              }, 300);
            }
          }, 3000);
        }
      });

      console.log('数据监控模块初始化完成');
    }
  };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof window.SharedData !== 'undefined') {
        window.DataMonitor.init();
      }
    });
  } else {
    if (typeof window.SharedData !== 'undefined') {
      window.DataMonitor.init();
    }
  }
})();
