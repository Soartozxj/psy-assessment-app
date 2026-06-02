/**
 * 用户反馈系统 - 插件系统专用
 * 收集用户反馈并发送到服务器
 */

class FeedbackSystem {
  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/feedback';
    this.buttonLabel = options.buttonLabel || '📝 反馈';
    this.position = options.position || 'bottom-right';

    this.feedbackData = [];
    this.isOpen = false;

    this.initUI();
  }

  /**
   * 初始化反馈 UI
   */
  initUI() {
    // 创建反馈按钮
    const button = document.createElement('button');
    button.id = 'feedback-button';
    button.textContent = this.buttonLabel;
    button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            z-index: 10000;
        `;
    button.addEventListener('click', () => this.toggleFeedbackForm());
    document.body.appendChild(button);

    // 创建反馈表单（初始隐藏）
    const form = document.createElement('div');
    form.id = 'feedback-form';
    form.style.cssText = `
            position: fixed;
            bottom: 70px;
            right: 20px;
            width: 300px;
            padding: 20px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            display: none;
        `;
    form.innerHTML = `
            <h3>用户反馈</h3>
            <textarea id="feedback-text" placeholder="请描述您的问题或建议..." style="width: 100%; height: 100px;"></textarea>
            <select id="feedback-type" style="width: 100%; margin: 10px 0;">
                <option value="bug">Bug 报告</option>
                <option value="feature">功能请求</option>
                <option value="improvement">改进建议</option>
                <option value="other">其他</option>
            </select>
            <button id="feedback-submit" style="width: 100%; padding: 10px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">提交</button>
        `;
    document.body.appendChild(form);

    // 绑定提交事件
    form.querySelector('#feedback-submit').addEventListener('click', () => this.submitFeedback());
  }

  /**
   * 切换反馈表单
   */
  toggleFeedbackForm() {
    const form = document.getElementById('feedback-form');
    this.isOpen = !this.isOpen;
    form.style.display = this.isOpen ? 'block' : 'none';
  }

  /**
   * 提交反馈
   */
  async submitFeedback() {
    const text = document.getElementById('feedback-text').value.trim();
    const type = document.getElementById('feedback-type').value;

    if (!text) {
      alert('请填写反馈内容');
      return;
    }

    const feedback = {
      type,
      text,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      pluginContext: this.getPluginContext()
    };

    try {
      if (typeof fetch !== 'undefined') {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedback)
        });
        alert('感谢您的反馈！');
      } else {
        // 开发环境，输出到控制台
        console.log('📝 用户反馈:', feedback);
        alert('感谢您的反馈！（开发模式，已记录到控制台）');
      }

      // 清空表单
      document.getElementById('feedback-text').value = '';
      this.toggleFeedbackForm();
    } catch (error) {
      console.error('提交反馈失败:', error);
      alert('提交失败，请稍后重试');
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
}

// 导出到全局
window.FeedbackSystem = FeedbackSystem;

// 自动初始化（如果在浏览器环境）
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.feedbackSystem = new FeedbackSystem();
  });
}
