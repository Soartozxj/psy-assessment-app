/**
 * 统一异常处理机制 v1.0.0
 * 
 * 功能：
 * 1. 统一捕获和处理异常
 * 2. 区分错误类型（网络错误、业务错误、系统错误）
 * 3. 提供友好的用户提示
 * 4. 记录错误日志便于调试
 * 5. 支持错误上报（可选）
 * 
 * 使用方法：
 * 1. 在 admin-legacy.html 中引入此文件
 * 2. 使用 ErrorHandler.handle() 处理异常
 * 3. 使用 ErrorHandler.wrap() 包装异步函数
 * 
 * @version 1.0.0
 * @date 2026-06-05
 */

(function() {
  'use strict';

  // ====================================================
  // 错误类型枚举
  // ====================================================
  const ERROR_TYPES = {
    NETWORK: 'NETWORK',           // 网络错误
    API: 'API',                   // API 错误
    VALIDATION: 'VALIDATION',     // 表单校验错误
    AUTH: 'AUTH',                 // 认证错误
    PERMISSION: 'PERMISSION',     // 权限错误
    BUSINESS: 'BUSINESS',         // 业务错误
    SYSTEM: 'SYSTEM',             // 系统错误
    UNKNOWN: 'UNKNOWN'           // 未知错误
  };

  // ====================================================
  // 错误消息映射
  // ====================================================
  const ERROR_MESSAGES = {
    [ERROR_TYPES.NETWORK]: '网络连接失败，请检查网络后重试',
    [ERROR_TYPES.API]: '服务器响应异常，请稍后重试',
    [ERROR_TYPES.VALIDATION]: '输入数据有误，请检查后重试',
    [ERROR_TYPES.AUTH]: '认证失败，请重新登录',
    [ERROR_TYPES.PERMISSION]: '权限不足，无法执行此操作',
    [ERROR_TYPES.BUSINESS]: '操作失败，请稍后重试',
    [ERROR_TYPES.SYSTEM]: '系统异常，请联系管理员',
    [ERROR_TYPES.UNKNOWN]: '发生未知错误，请刷新页面重试'
  };

  // ====================================================
  // 错误处理配置
  // ====================================================
  const ERROR_CONFIG = {
    // 是否显示详细错误信息（开发模式）
    showDetail: window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1',
    
    // 是否记录错误日志
    enableLogging: true,
    
    // 是否上报错误（生产环境）
    enableReporting: window.location.protocol === 'https:',
    
    // 错误上报端点
    reportingEndpoint: '/api/error-report',
    
    // 最大重试次数
    maxRetries: 3,
    
    // 重试延迟（毫秒）
    retryDelay: 1000
  };

  // ====================================================
  // ErrorHandler 类
  // ====================================================
  class ErrorHandler {
    constructor() {
      // 错误日志
      this.errorLog = [];
      
      // 最大日志数量
      this.maxLogSize = 100;
      
      // 是否正在处理错误（防止递归）
      this.isHandling = false;
      
      console.log('🛡️ ErrorHandler 创建成功');
    }

    // ====================================================
    // 初始化（设置全局错误捕获）
    // ====================================================
    init() {
      console.log('🛡️ 正在初始化错误处理器...');
      
      // 捕获未处理的 Promise 拒绝
      window.addEventListener('unhandledrejection', (event) => {
        this.handle(event.reason, ERROR_TYPES.SYSTEM);
        event.preventDefault();
      });
      
      // 捕获全局 JS 错误（useCapture=true 以便在事件冒泡前拦截）
      window.addEventListener('error', (event) => {
        // 过滤图片/脚本等资源加载错误（没有 event.error 属性，不属于 JS 异常）
        if (!event.error && event.target && event.target !== window) {
          // 资源加载失败（<img src="">, <script> 404 等），只记日志不触发错误处理
          console.warn('[ErrorHandler] 资源加载失败:', event.target.tagName, event.target.src || event.target.href);
          return;
        }
        this.handle(event.error || event.message, ERROR_TYPES.SYSTEM);
      }, true);
      
      console.log('✅ 错误处理器初始化完成');
    }

    // ====================================================
    // 处理错误
    // ====================================================
    handle(error, type = ERROR_TYPES.UNKNOWN, context = {}) {
      // 防止递归
      if (this.isHandling) {
        console.error('🛡️ 错误处理递归，跳过', error);
        return;
      }
      
      this.isHandling = true;
      
      try {
        // 解析错误
        const parsedError = this.parseError(error, type, context);
        
        // 记录日志
        this.logError(parsedError);
        
        // 显示用户提示
        this.showUserNotification(parsedError);
        
        // 上报错误（生产环境）
        if (ERROR_CONFIG.enableReporting) {
          this.reportError(parsedError);
        }
        
        return parsedError;
      } finally {
        this.isHandling = false;
      }
    }

    // ====================================================
    // 解析错误对象
    // ====================================================
    parseError(error, type, context) {
      // 防御性检查：error 可能为 null/undefined
      if (error == null) {
        return { type, message: '未知错误', details: null, statusCode: null, context };
      }
      let message = '';
      let details = null;
      let statusCode = null;
      
      // 解析不同类型的错误
      if (error instanceof Response) {
        // Fetch Response 错误
        type = ERROR_TYPES.NETWORK;
        statusCode = error.status;
        message = ERROR_MESSAGES[type];
        details = `${error.status} ${error.statusText}`;
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        // 网络错误
        type = ERROR_TYPES.NETWORK;
        message = ERROR_MESSAGES[type];
        details = error.message;
      } else if (error instanceof SyntaxError) {
        // JSON 解析错误
        type = ERROR_TYPES.API;
        message = ERROR_MESSAGES[type];
        details = error.message;
      } else if (error.message && error.message.includes('401')) {
        // 认证错误
        type = ERROR_TYPES.AUTH;
        message = ERROR_MESSAGES[type];
        details = error.message;
      } else if (error.message && error.message.includes('403')) {
        // 权限错误
        type = ERROR_TYPES.PERMISSION;
        message = ERROR_MESSAGES[type];
        details = error.message;
      } else if (error.message && error.message.includes('validate')) {
        // 校验错误
        type = ERROR_TYPES.VALIDATION;
        message = error.message;
      } else if (error.code !== undefined) {
        // API 返回的错误格式 { code, message }
        type = type || ERROR_TYPES.API;
        message = error.message || ERROR_MESSAGES[type];
        details = error;
      } else {
        // 其他错误
        type = type || ERROR_TYPES.UNKNOWN;
        message = error.message || ERROR_MESSAGES[type];
        details = error.stack || error;
      }
      
      return {
        type,
        message,
        details,
        statusCode,
        context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      };
    }

    // ====================================================
    // 记录错误日志
    // ====================================================
    logError(parsedError) {
      if (!ERROR_CONFIG.enableLogging) {
        return;
      }
      
      // 输出到控制台
      console.error(
        `🛡️ [${parsedError.type}] ${parsedError.message}`,
        parsedError
      );
      
      // 保存到内存日志
      this.errorLog.push(parsedError);
      
      // 限制日志大小
      if (this.errorLog.length > this.maxLogSize) {
        this.errorLog.shift();
      }
      
      // 保存到 localStorage（保留最近 20 条）
      try {
        const storedLogs = JSON.parse(localStorage.getItem('error_log') || '[]');
        storedLogs.push(parsedError);
        if (storedLogs.length > 20) {
          storedLogs.splice(0, storedLogs.length - 20);
        }
        localStorage.setItem('error_log', JSON.stringify(storedLogs));
      } catch (e) {
        // 忽略存储错误
      }
    }

    // ====================================================
    // 显示用户通知
    // ====================================================
    showUserNotification(parsedError) {
      // 对于无详情、无状态码的 SYSTEM/UNKNOWN 错误，只记录日志，不弹窗
      // 避免阻断性弹窗（如原生 alert）导致页面卡死
      if ((parsedError.type === ERROR_TYPES.SYSTEM || parsedError.type === ERROR_TYPES.UNKNOWN) 
          && !parsedError.details && !parsedError.statusCode) {
        console.warn('[ErrorHandler] 系统级错误（仅日志）:', parsedError.message, parsedError.type);
        return;
      }
      
      // 根据错误类型决定提示方式
      const notificationType = this.getNotificationType(parsedError.type);
      
      // 使用全局 Toast 或 Alert
      if (window.UIUtils && typeof UIUtils.toast === 'function') {
        const message = ERROR_CONFIG.showDetail && parsedError.details
          ? `${parsedError.message}\n详情: ${JSON.stringify(parsedError.details).substring(0, 100)}`
          : parsedError.message;
        
        // UIUtils.toast(message, type, duration) - 第三个参数是数字（毫秒）
        UIUtils.toast(message, notificationType, 5000);
      } else if (window.showToast && typeof window.showToast === 'function') {
        // 兼容：如果全局 showToast 存在
        window.showToast(parsedError.message, notificationType, 5000);
      } else {
        // 降级到 console（不用 alert，避免阻塞 UI）
        console.warn('[ErrorHandler] 无可用通知方式:', parsedError.message);
      }
    }

    // ====================================================
    // 获取通知类型
    // ====================================================
    getNotificationType(errorType) {
      switch (errorType) {
        case ERROR_TYPES.VALIDATION:
        case ERROR_TYPES.AUTH:
        case ERROR_TYPES.PERMISSION:
          return 'warning';
        case ERROR_TYPES.NETWORK:
        case ERROR_TYPES.API:
        case ERROR_TYPES.SYSTEM:
          return 'error';
        case ERROR_TYPES.BUSINESS:
          return 'info';
        default:
          return 'error';
      }
    }

    // ====================================================
    // 上报错误（生产环境）
    // ====================================================
    async reportError(parsedError) {
      try {
        await fetch(ERROR_CONFIG.reportingEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedError)
        });
      } catch (e) {
        // 上报失败不影响主流程
        console.warn('🛡️ 错误上报失败', e);
      }
    }

    // ====================================================
    // 包装异步函数（自动捕获错误）
    // ====================================================
    wrap(asyncFn, context = {}) {
      return async (...args) => {
        try {
          return await asyncFn(...args);
        } catch (error) {
          this.handle(error, ERROR_TYPES.UNKNOWN, {
            ...context,
            function: asyncFn.name || 'anonymous',
            args: args.length > 0 ? JSON.stringify(args).substring(0, 100) : null
          });
          throw error; // 重新抛出，让调用者决定如何处理
        }
      };
    }

    // ====================================================
    // 包装 API 请求（自动处理常见错误）
    // ====================================================
    wrapAPI(apiFn, context = {}) {
      return async (...args) => {
        try {
          const response = await apiFn(...args);
          
          // 检查响应状态
          if (response.code !== undefined && response.code !== 0) {
            throw {
              code: response.code,
              message: response.message || ERROR_MESSAGES[ERROR_TYPES.API]
            };
          }
          
          return response;
        } catch (error) {
          // 判断错误类型
          let type = ERROR_TYPES.API;
          if (error.code === 401 || error.message.includes('认证')) {
            type = ERROR_TYPES.AUTH;
          } else if (error.code === 403 || error.message.includes('权限')) {
            type = ERROR_TYPES.PERMISSION;
          } else if (error.code === -1) {
            type = ERROR_TYPES.BUSINESS;
          }
          
          this.handle(error, type, context);
          throw error;
        }
      };
    }

    // ====================================================
    // 重试机制
    // ====================================================
    async retry(asyncFn, maxRetries = ERROR_CONFIG.maxRetries, delay = ERROR_CONFIG.retryDelay) {
      let lastError;
      
      for (let i = 0; i <= maxRetries; i++) {
        try {
          return await asyncFn();
        } catch (error) {
          lastError = error;
          
          // 如果是最后一次重试，不再重试
          if (i === maxRetries) {
            break;
          }
          
          // 判断是否需要重试（网络错误可重试，权限错误不可重试）
          const errorType = this.parseError(error).type;
          if (errorType === ERROR_TYPES.PERMISSION || errorType === ERROR_TYPES.AUTH) {
            break;
          }
          
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          console.warn(`🛡️ 重试 ${i + 1}/${maxRetries}...`);
        }
      }
      
      throw lastError;
    }

    // ====================================================
    // 获取错误日志
    // ====================================================
    getErrorLog() {
      return [...this.errorLog];
    }

    // ====================================================
    // 清除错误日志
    // ====================================================
    clearErrorLog() {
      this.errorLog = [];
      localStorage.removeItem('error_log');
      console.log('🛡️ 错误日志已清除');
    }

    // ====================================================
    // 创建自定义错误对象
    // ====================================================
    createError(message, type = ERROR_TYPES.BUSINESS, details = null) {
      return {
        code: -1,
        message,
        type,
        details,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ====================================================
  // 创建便捷方法
  // ====================================================
  const errorHandler = new ErrorHandler();

  // 便捷方法：处理错误
  function handleError(error, type, context) {
    return errorHandler.handle(error, type, context);
  }

  // 便捷方法：包装异步函数
  function wrapAsync(fn, context) {
    return errorHandler.wrap(fn, context);
  }

  // 便捷方法：包装 API 函数
  function wrapAPI(fn, context) {
    return errorHandler.wrapAPI(fn, context);
  }

  // 便捷方法：重试
  async function retryAsync(fn, maxRetries, delay) {
    return errorHandler.retry(fn, maxRetries, delay);
  }

  // ====================================================
  // 暴露到全局
  // ====================================================
  window.ErrorHandler = ErrorHandler;
  window.errorHandler = errorHandler;
  window.ERROR_TYPES = ERROR_TYPES;
  window.handleError = handleError;
  window.wrapAsync = wrapAsync;
  window.wrapAPI = wrapAPI;
  window.retryAsync = retryAsync;

  // ====================================================
  // 初始化
  // ====================================================
  function init() {
    errorHandler.init();
    console.log('🛡️ 统一异常处理机制已启动');
    console.log('🛡️ 使用方法：');
    console.log('   - handleError(error, type, context)');
    console.log('   - wrapAsync(asyncFn, context)');
    console.log('   - wrapAPI(apiFn, context)');
    console.log('   - retryAsync(asyncFn, maxRetries, delay)');
  }

  // 在 DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
