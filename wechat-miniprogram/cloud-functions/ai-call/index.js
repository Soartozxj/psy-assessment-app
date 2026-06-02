// 云函数：ai-call
// 后端代理调用 AI API（保护 API Key）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  // 防止递归调用自身
  if (event._internal) {
    return { code: -1, message: '内部调用标记已废弃' };
  }

  try {
    const { provider, messages, model, temperature, maxTokens } = event || {};

    // 验证 messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { code: -1, message: 'messages 参数错误：必须是非空数组' };
    }
    if (messages.length > 30) {
      return { code: -1, message: 'messages 数量超限（最大30条）' };
    }
    // 限制每条消息长度
    const MAX_MSG_LEN = 8000;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (!m.role || !m.content) {
        return { code: -1, message: 'messages[' + i + '] 缺少 role 或 content' };
      }
      if (typeof m.content !== 'string' || m.content.length > MAX_MSG_LEN) {
        return { code: -1, message: 'messages[' + i + '] content 超长（最大' + MAX_MSG_LEN + '字符）' };
      }
    }

    // 从云数据库读取 AI 配置（API Key 安全存储）
    let aiConfig;
    try {
      const configRes = await db.collection('config').doc('ai_config').get();
      aiConfig = configRes.data;
    } catch (e) {
      return { code: -2, message: 'AI 服务未配置，请在后台系统设置中配置 AI 接口' };
    }

    const effectiveProvider = provider || aiConfig.provider || 'dashscope';
    const effectiveModel = model || (aiConfig[effectiveProvider] || {}).model || 'qwen-plus';
    // temperature 范围限制
    const effectiveTemp = Math.max(
      0,
      Math.min(2, temperature !== undefined ? temperature : aiConfig.temperature || 0.7)
    );
    // maxTokens 范围限制
    const effectiveMaxTokens = Math.max(100, Math.min(8000, maxTokens || aiConfig.maxTokens || 2000));

    let result = '';

    if (effectiveProvider === 'dashscope') {
      // 阿里云 DashScope（通义千问）
      const apiKey = aiConfig.dashscope ? aiConfig.dashscope.apiKey : '';
      if (!apiKey) {
        return { code: -2, message: 'DashScope API Key 未配置' };
      }

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: effectiveModel,
          messages,
          max_tokens: effectiveMaxTokens,
          temperature: effectiveTemp
        })
      });
      const data = await response.json();
      result = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
      if (!result) {
        return { code: -1, message: data.error ? data.error.message : 'AI 返回为空' };
      }
    } else if (effectiveProvider === 'ollama') {
      // Ollama 本地模型（云函数中一般不用，保留兼容）
      const baseUrl = (aiConfig.ollama || {}).baseUrl || 'http://localhost:11434';
      const response = await fetch(baseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: effectiveModel,
          messages,
          stream: false
        })
      });
      const data = await response.json();
      result = data.message ? data.message.content : '';
    } else {
      return { code: -1, message: '不支持的 AI 提供商: ' + effectiveProvider };
    }

    return { code: 0, data: result };
  } catch (err) {
    console.error('[ai-call] 错误:', err);
    return { code: -1, message: 'AI 调用失败: ' + err.message };
  }
};
