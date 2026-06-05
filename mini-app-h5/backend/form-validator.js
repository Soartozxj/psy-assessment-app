/**
 * 表单校验工具库 v1.0.0
 * 
 * 功能：
 * 1. 提供统一的表单校验方法
 * 2. 支持实时校验和提交时校验
 * 3. 支持异步校验（如唯一性检查）
 * 4. 提供友好的错误提示
 * 5. 支持自定义校验规则
 * 
 * 使用方法：
 * 1. 创建 Validator 实例
 * 2. 添加校验规则
 * 3. 调用 validate() 或 validateField() 进行校验
 * 
 * @version 1.0.0
 * @date 2026-06-05
 */

(function() {
  'use strict';

  // ====================================================
  // 预设校验规则
  // ====================================================
  const VALIDATION_RULES = {
    // 必填
    required(value, fieldName) {
      if (value === undefined || value === null || value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        return `${fieldName}不能为空`;
      }
      return true;
    },

    // 最小长度
    minLength(value, min, fieldName) {
      if (String(value).length < min) {
        return `${fieldName}至少需要${min}个字符`;
      }
      return true;
    },

    // 最大长度
    maxLength(value, max, fieldName) {
      if (String(value).length > max) {
        return `${fieldName}不能超过${max}个字符`;
      }
      return true;
    },

    // 长度范围
    lengthRange(value, min, max, fieldName) {
      const len = String(value).length;
      if (len < min || len > max) {
        return `${fieldName}长度应在${min}-${max}个字符之间`;
      }
      return true;
    },

    // 数字范围
    numberRange(value, min, max, fieldName) {
      const num = Number(value);
      if (isNaN(num) || num < min || num > max) {
        return `${fieldName}应在${min}-${max}之间`;
      }
      return true;
    },

    // 整数
    integer(value, fieldName) {
      if (!Number.isInteger(Number(value))) {
        return `${fieldName}必须是整数`;
      }
      return true;
    },

    // 正数
    positiveNumber(value, fieldName) {
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        return `${fieldName}必须是正数`;
      }
      return true;
    },

    // 邮箱格式
    email(value, fieldName) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return `${fieldName}格式不正确`;
      }
      return true;
    },

    // URL 格式
    url(value, fieldName) {
      try {
        new URL(value);
        return true;
      } catch {
        return `${fieldName}格式不正确`;
      }
    },

    // 颜色格式（#RRGGBB 或 #RGB）
    color(value, fieldName) {
      const colorRegex = /^#([0-9A-Fa-f]{3}){1,2}$/;
      if (!colorRegex.test(value)) {
        return `${fieldName}格式不正确（应为 #RRGGBB 或 #RGB）`;
      }
      return true;
    },

    // Emoji（单个字符）
    singleEmoji(value, fieldName) {
      // 简单的 emoji 检查（Unicode 范围）
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]/u;
      if (!emojiRegex.test(value)) {
        return `${fieldName}应为 emoji 字符`;
      }
      return true;
    },

    // 选项数量
    minOptions(value, min, fieldName) {
      if (!Array.isArray(value) || value.length < min) {
        return `${fieldName}至少需要${min}个选项`;
      }
      return true;
    },

    // 数组非空
    nonEmptyArray(value, fieldName) {
      if (!Array.isArray(value) || value.length === 0) {
        return `${fieldName}不能为空`;
      }
      return true;
    },

    // 自定义正则
    pattern(value, regex, fieldName, message) {
      if (!regex.test(value)) {
        return message || `${fieldName}格式不正确`;
      }
      return true;
    }
  };

  // ====================================================
  // Validator 类
  // ====================================================
  class Validator {
    constructor(formId, options = {}) {
      // 表单元素
      this.form = typeof formId === 'string' ? document.getElementById(formId) : formId;
      
      if (!this.form) {
        throw new Error(`表单不存在: ${formId}`);
      }

      // 校验规则
      this.rules = {};

      // 错误提示容器
      this.errorContainer = options.errorContainer || null;

      // 是否实时校验
      this.realtime = options.realtime !== false;

      // 校验成功回调
      this.onSuccess = options.onSuccess || null;

      // 校验失败回调
      this.onError = options.onError || null;

      // 存储字段错误信息
      this.errors = {};

      // 初始化
      this.init();
    }

    // ====================================================
    // 初始化
    // ====================================================
    init() {
      // 如果启用实时校验，监听输入事件
      if (this.realtime) {
        this.form.addEventListener('input', (e) => {
          const field = e.target;
          if (this.rules[field.name || field.id]) {
            this.validateField(field.name || field.id);
          }
        });

        this.form.addEventListener('change', (e) => {
          const field = e.target;
          if (this.rules[field.name || field.id]) {
            this.validateField(field.name || field.id);
          }
        });
      }

      console.log('✅ Validator 初始化完成', this.form.id || '(无ID表单)');
    }

    // ====================================================
    // 添加校验规则
    // ====================================================
    addRule(fieldName, rules) {
      this.rules[fieldName] = rules;
      return this;
    }

    // ====================================================
    // 校验单个字段
    // ====================================================
    validateField(fieldName) {
      const rules = this.rules[fieldName];
      if (!rules || rules.length === 0) {
        return true;
      }

      // 获取字段值
      const field = this.form.elements[fieldName] || document.getElementById(fieldName);
      if (!field) {
        console.warn(`字段不存在: ${fieldName}`);
        return true;
      }

      const value = this.getFieldValue(field);
      let firstError = null;

      // 依次执行校验规则
      for (const rule of rules) {
        const result = this.executeRule(rule, value, fieldName);

        if (result !== true) {
          // 校验失败
          firstError = typeof result === 'string' ? result : rule.message || '校验失败';
          break;
        }
      }

      if (firstError) {
        this.errors[fieldName] = firstError;
        this.showFieldError(fieldName, firstError);
        return false;
      } else {
        delete this.errors[fieldName];
        this.clearFieldError(fieldName);
        return true;
      }
    }

    // ====================================================
    // 校验整个表单
    // ====================================================
    validate() {
      let isValid = true;
      this.errors = {};

      for (const fieldName in this.rules) {
        const fieldValid = this.validateField(fieldName);
        if (!fieldValid) {
          isValid = false;
        }
      }

      // 回调
      if (isValid && this.onSuccess) {
        this.onSuccess();
      } else if (!isValid && this.onError) {
        this.onError(this.errors);
      }

      return isValid;
    }

    // ====================================================
    // 异步校验（如唯一性检查）
    // ====================================================
    async validateAsync(fieldName, asyncRule) {
      const field = this.form.elements[fieldName] || document.getElementById(fieldName);
      if (!field) {
        return false;
      }

      const value = this.getFieldValue(field);

      try {
        const result = await asyncRule(value, fieldName);
        
        if (result !== true) {
          const errorMsg = typeof result === 'string' ? result : '校验失败';
          this.errors[fieldName] = errorMsg;
          this.showFieldError(fieldName, errorMsg);
          return false;
        } else {
          delete this.errors[fieldName];
          this.clearFieldError(fieldName);
          return true;
        }
      } catch (error) {
        const errorMsg = error.message || '校验失败';
        this.errors[fieldName] = errorMsg;
        this.showFieldError(fieldName, errorMsg);
        return false;
      }
    }

    // ====================================================
    // 执行单个校验规则
    // ====================================================
    executeRule(rule, value, fieldName) {
      // 如果是函数，直接调用
      if (typeof rule === 'function') {
        return rule(value, fieldName);
      }

      // 如果是对象，解析规则
      if (typeof rule === 'object') {
        const ruleName = rule.rule;
        const params = rule.params || [];

        if (VALIDATION_RULES[ruleName]) {
          return VALIDATION_RULES[ruleName](value, ...params, fieldName);
        } else {
          console.warn(`未知校验规则: ${ruleName}`);
          return true;
        }
      }

      // 如果是字符串，按预定义规则处理
      if (typeof rule === 'string') {
        if (VALIDATION_RULES[rule]) {
          return VALIDATION_RULES[rule](value, fieldName);
        }
      }

      return true;
    }

    // ====================================================
    // 获取字段值
    // ====================================================
    getFieldValue(field) {
      if (field.type === 'checkbox') {
        if (field.name.endsWith('[]')) {
          // 复选框组
          const checkboxes = this.form.querySelectorAll(`input[name="${field.name}"]:checked`);
          return Array.from(checkboxes).map(cb => cb.value);
        }
        return field.checked;
      }

      if (field.type === 'radio') {
        const checked = this.form.querySelector(`input[name="${field.name}"]:checked`);
        return checked ? checked.value : null;
      }

      if (field.tagName === 'SELECT' && field.multiple) {
        return Array.from(field.selectedOptions).map(opt => opt.value);
      }

      return field.value;
    }

    // ====================================================
    // 显示字段错误
    // ====================================================
    showFieldError(fieldName, message) {
      const field = this.form.elements[fieldName] || document.getElementById(fieldName);
      if (!field) {
        return;
      }

      // 添加错误样式
      field.classList.add('input-error');

      // 查找或创建错误提示元素
      let errorEl = field.parentNode.querySelector('.field-error');
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        field.parentNode.appendChild(errorEl);
      }

      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }

    // ====================================================
    // 清除字段错误
    // ====================================================
    clearFieldError(fieldName) {
      const field = this.form.elements[fieldName] || document.getElementById(fieldName);
      if (!field) {
        return;
      }

      // 移除错误样式
      field.classList.remove('input-error');

      // 隐藏错误提示
      const errorEl = field.parentNode.querySelector('.field-error');
      if (errorEl) {
        errorEl.style.display = 'none';
      }
    }

    // ====================================================
    // 清除所有错误
    // ====================================================
    clearAllErrors() {
      this.errors = {};
      this.form.querySelectorAll('.input-error').forEach(field => {
        field.classList.remove('input-error');
      });
      this.form.querySelectorAll('.field-error').forEach(errorEl => {
        errorEl.style.display = 'none';
      });
    }

    // ====================================================
    // 获取所有错误
    // ====================================================
    getErrors() {
      return { ...this.errors };
    }

    // ====================================================
    // 是否有错误
    // ====================================================
    hasErrors() {
      return Object.keys(this.errors).length > 0;
    }
  }

  // ====================================================
  // 创建量表表单校验器（预设规则）
  // ====================================================
  function createScaleFormValidator(formId) {
    const validator = new Validator(formId, {
      realtime: true,
      onError(errors) {
        // 显示第一个错误
        const firstError = Object.values(errors)[0];
        if (window.UIUtils && UIUtils.showToast) {
          UIUtils.showToast(firstError, 'error');
        }
      }
    });

    // 量表名称（必填，2-50字符）
    validator.addRule('name', [
      { rule: 'required', message: '量表名称不能为空' },
      { rule: 'minLength', params: [2], message: '量表名称至少2个字符' },
      { rule: 'maxLength', params: [50], message: '量表名称不能超过50个字符' }
    ]);

    // 简称（必填，1-20字符）
    validator.addRule('shortName', [
      { rule: 'required', message: '简称不能为空' },
      { rule: 'maxLength', params: [20], message: '简称不能超过20个字符' }
    ]);

    // 代码（必填，只能包含小写字母、数字、横线）
    validator.addRule('code', [
      { rule: 'required', message: '代码不能为空' },
      { rule: 'pattern', params: [/^[a-z0-9-]+$/, '代码'], message: '代码只能包含小写字母、数字和横线' }
    ]);

    // 分类（必填）
    validator.addRule('category', [
      { rule: 'required', message: '请选择分类' }
    ]);

    // Emoji（可选，但如果填写必须是 emoji）
    validator.addRule('emoji', [
      { 
        rule(value, fieldName) {
          if (!value) return true; // 允许为空
          return VALIDATION_RULES.singleEmoji(value, fieldName);
        }
      }
    ]);

    // 颜色（可选，但如果填写必须符合颜色格式）
    validator.addRule('color', [
      { 
        rule(value, fieldName) {
          if (!value) return true; // 允许为空
          return VALIDATION_RULES.color(value, fieldName);
        }
      }
    ]);

    // 预计时长（必填，1-120分钟）
    validator.addRule('duration', [
      { rule: 'required', message: '预计时长不能为空' },
      { rule: 'integer', message: '预计时长必须是整数' },
      { rule: 'numberRange', params: [1, 120], message: '预计时长应在1-120分钟之间' }
    ]);

    // 单题时长（必填，10-120秒）
    validator.addRule('questionTime', [
      { rule: 'required', message: '单题时长不能为空' },
      { rule: 'integer', message: '单题时长必须是整数' },
      { rule: 'numberRange', params: [10, 120], message: '单题时长应在10-120秒之间' }
    ]);

    // 描述（必填，10-500字符）
    validator.addRule('desc', [
      { rule: 'required', message: '描述不能为空' },
      { rule: 'minLength', params: [10], message: '描述至少10个字符' },
      { rule: 'maxLength', params: [500], message: '描述不能超过500个字符' }
    ]);

    // 指导语（必填，10-1000字符）
    validator.addRule('instruction', [
      { rule: 'required', message: '指导语不能为空' },
      { rule: 'minLength', params: [10], message: '指导语至少10个字符' },
      { rule: 'maxLength', params: [1000], message: '指导语不能超过1000个字符' }
    ]);

    // 标签（可选，但如果填写格式必须正确）
    validator.addRule('tags', [
      { 
        rule(value, fieldName) {
          if (!value) return true;
          const tags = value.split(',').map(t => t.trim());
          if (tags.length > 10) {
            return '标签不能超过10个';
          }
          return true;
        }
      }
    ]);

    // 状态（必填）
    validator.addRule('status', [
      { rule: 'required', message: '请选择状态' }
    ]);

    return validator;
  }

  // ====================================================
  // 创建 AI 配置表单校验器
  // ====================================================
  function createAIConfigValidator(formId) {
    const validator = new Validator(formId, {
      realtime: true
    });

    // API Key（必填，至少10个字符）
    validator.addRule('apiKey', [
      { rule: 'required', message: 'API Key 不能为空' },
      { rule: 'minLength', params: [10], message: 'API Key 至少10个字符' }
    ]);

    // 温度（0-2之间）
    validator.addRule('temperature', [
      { rule: 'numberRange', params: [0, 2], message: '温度应在0-2之间' }
    ]);

    // 最大 Token（1-8000之间）
    validator.addRule('maxTokens', [
      { rule: 'integer', message: '最大 Token 必须是整数' },
      { rule: 'numberRange', params: [1, 8000], message: '最大 Token 应在1-8000之间' }
    ]);

    return validator;
  }

  // ====================================================
  // 暴露到全局
  // ====================================================
  window.Validator = Validator;
  window.VALIDATION_RULES = VALIDATION_RULES;
  window.createScaleFormValidator = createScaleFormValidator;
  window.createAIConfigValidator = createAIConfigValidator;

  console.log('✅ form-validator.js 加载完成');

})();
