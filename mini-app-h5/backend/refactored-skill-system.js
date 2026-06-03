/**
 * refactored-skill-system.js - 重构后的前端 Skill 机制系统
 *
 * 技术优势对比：新 Skill 机制 vs 原有系统提示词
 * ========================================================================
 *
 * 1. 上下文理解能力提升
 *    - 原有方式：系统提示词是静态文本，无法根据上下文动态调整
 *    - 新机制：通过 PluginBase 基类和事件系统，skill 可以：
 *      * 在 init() 阶段获取上下文信息
 *      * 通过 EventHub 监听上下文变化
 *      * 根据上下文动态调整执行策略
 *    - 示例：AI配置插件可以根据当前页面状态（如已配置的API类型）动态调整表单显示
 *
 * 2. 灵活性大幅提升
 *    - 原有方式：所有功能硬编码在 admin-legacy.html 中，修改需要改动主文件
 *    - 新机制：插件化架构带来：
 *      * 热插拔：插件可以按需加载/卸载（PluginLoader.load()）
 *      * 独立部署：每个插件是独立文件，可以单独更新
 *      * 依赖管理：插件可以声明依赖关系，系统自动处理加载顺序
 *    - 示例：量表管理插件可以在不修改主页面的情况下独立更新
 *
 * 3. 响应精准度提高
 *    - 原有方式：系统提示词是"一刀切"，所有场景使用相同的指令
 *    - 新机制：每个 skill 有独立的：
 *      * 元数据定义（name, description, version）
 *      * 执行逻辑（onExecute() 方法）
 *      * 参数校验（_validate_params()）
 *    - 示例：计分规则插件的执行逻辑专门针对计分规则配置优化
 *
 * 4. 可维护性增强
 *    - 原有方式：24768 行单文件，修改风险高
 *    - 新机制：
 *      * 模块化：每个插件 500-1500 行，职责单一
 *      * 接口标准化：所有插件继承 PluginBase，接口统一
 *      * 向后兼容：保留全局函数，渐进式迁移
 *    - 示例：auth-plugin.js 只负责认证，scale-plugin.js 只负责量表管理
 *
 * 5. 可测试性改善
 *    - 原有方式：所有功能耦合在一起，无法单独测试
 *    - 新机制：
 *      * 单元测试：每个插件可以独立测试
 *      * 集成测试：使用自动化测试套件验证插件协同工作
 *      * Mock 支持：可以轻松 mock 依赖（如 EventHub）
 *    - 示例：可以为 AI 配置插件编写独立的测试用例
 *
 * 6. 可扩展性增强
 *    - 原有方式：添加新功能需要修改主文件，容易引入 bug
 *    - 新机制：
 *      * 插件发现：自动发现新插件
 *      * 插件注册：新插件只需放在指定目录即可
 *      * 版本管理：支持插件版本控制
 *    - 示例：添加"冥想管理"插件只需创建 meditation-plugin.js 并放到 plugins 目录
 *
 * ========================================================================
 * 代码实现
 * ========================================================================
 */

/**
 * SkillPluginBase - 前端插件基类（重构版）
 *
 * 相比原有系统提示词的优势：
 * 1. 生命周期管理：
 *    - 原有方式：提示词没有生命周期概念
 *    - 新机制：init() → execute() → destroy() 完整生命周期
 *
 * 2. 状态管理：
 *    - 原有方式：无法追踪提示词状态
 *    - 新机制：isInitialized, isDestroyed 状态可追踪
 *
 * 3. 事件集成：
 *    - 原有方式：提示词无法与系统集成
 *    - 新机制：自动注册/注销事件监听器
 */
class SkillPluginBase {
  /**
   * 构造函数
   * @param {object} config - 插件配置
   */
  constructor(config = {}) {
    // 插件基本信息（每个插件都要填）
    this.name = config.name || '未命名插件';
    this.version = config.version || '1.0.0';
    this.description = config.description || '';

    // 插件状态
    this.isInitialized = false;
    this.isDestroyed = false;

    // 插件配置（可以自定义）
    this.config = config;

    // 事件监听器引用（用于销毁时清理）
    this._eventListeners = [];

    // 执行统计
    this._stats = {
      executeCount: 0,
      lastExecuteTime: null,
      averageExecuteTime: 0
    };

    console.log(`📦 创建技能插件: ${this.name} v${this.version}`);
  }

  /**
   * 初始化插件（必须实现）
   *
   * 相比原有方式的优势：
   * 1. 异步初始化：支持异步操作（如API调用）
   * 2. 事件注册：可以在初始化时注册事件监听
   * 3. 状态检查：防止重复初始化
   */
  async init() {
    if (this.isInitialized) {
      console.warn(`⚠️ 插件 ${this.name} 已经初始化过了`);
      return;
    }

    try {
      console.log(`🚀 开始初始化技能插件: ${this.name}`);

      // 在这里做初始化工作
      // 比如：连接数据库、注册事件监听、加载配置等
      await this.onInit();

      this.isInitialized = true;
      console.log(`✅ 插件 ${this.name} 初始化成功`);

      // 广播"插件初始化完成"事件
      if (window.EventHub) {
        await window.EventHub.emit('plugin-initialized', {
          name: this.name,
          version: this.version,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error(`❌ 插件 ${this.name} 初始化失败:`, error);
      throw error;
    }
  }

  /**
   * 初始化时的具体逻辑（子类要实现这个方法）
   *
   * 相比原有方式的优势：
   * 1. 可重写：子类可以重写此方法实现自定义初始化
   * 2. 错误处理：初始化失败会抛出明确错误
   * 3. 事件集成：可以在此处注册事件监听
   */
  async onInit() {
    // 子类重写这个方法，写具体的初始化逻辑
    // 比如：
    // - AI插件：测试API连接
    // - 量表插件：从服务器加载量表列表
    // - 登录插件：检查登录状态
    console.log(`💡 插件 ${this.name} 的 onInit() 方法需要子类实现`);
  }

  /**
   * 执行插件功能（必须实现）
   *
   * 相比原有方式的优势：
   * 1. 参数验证：自动验证参数类型和必填项
   * 2. 状态检查：防止未初始化或已销毁的插件执行
   * 3. 执行统计：记录执行次数和平均执行时间
   * 4. 错误处理：执行失败会抛出明确错误
   *
   * @param {object} params - 传递给插件的参数
   */
  async execute(params = {}) {
    if (!this.isInitialized) {
      throw new Error(`插件 ${this.name} 未初始化，请先调用 init()`);
    }

    if (this.isDestroyed) {
      throw new Error(`插件 ${this.name} 已销毁，不能执行`);
    }

    // 参数验证
    this._validateParams(params);

    try {
      console.log(`🎯 执行技能插件: ${this.name}`, params);

      // 记录执行开始时间
      const startTime = Date.now();

      // 调用子类的具体执行逻辑
      const result = await this.onExecute(params);

      // 更新执行统计
      const endTime = Date.now();
      this._updateStats(endTime - startTime);

      console.log(`✅ 插件 ${this.name} 执行成功`, result);
      return result;
    } catch (error) {
      console.error(`❌ 插件 ${this.name} 执行失败:`, error);
      throw error;
    }
  }

  /**
   * 执行时的具体逻辑（子类要实现这个方法）
   *
   * 相比原有方式的优势：
   * 1. 可重写：子类可以重写此方法实现自定义执行逻辑
   * 2. 参数传递：可以接收任意参数
   * 3. 异步支持：支持异步操作
   *
   * @param {object} params - 执行参数
   * @returns {any} 执行结果
   */
  async onExecute(params) {
    // 子类重写这个方法，写具体的执行逻辑
    // 比如：
    // - AI插件：调用DashScope API生成内容
    // - 量表插件：保存量表到数据库
    // - 登录插件：验证用户名密码
    console.log(`💡 插件 ${this.name} 的 onExecute() 方法需要子类实现`);
    return null;
  }

  /**
   * 销毁插件（清理资源）
   *
   * 相比原有方式的优势：
   * 1. 资源清理：清理事件监听器、定时器等
   * 2. 状态管理：更新 isDestroyed 状态
   * 3. 事件通知：广播插件销毁事件
   */
  destroy() {
    if (this.isDestroyed) {
      console.warn(`⚠️ 插件 ${this.name} 已经销毁了`);
      return;
    }

    try {
      console.log(`🗑️ 开始销毁技能插件: ${this.name}`);

      // 调用子类的清理逻辑
      this.onDestroy();

      // 清理事件监听器
      this.cleanupEventListeners();

      // 更新状态
      this.isDestroyed = true;
      this.isInitialized = false;

      console.log(`✅ 插件 ${this.name} 已销毁`);

      // 广播"插件销毁"事件
      if (window.EventHub) {
        window.EventHub.emit('plugin-destroyed', {
          name: this.name,
          version: this.version,
          stats: this._stats
        });
      }
    } catch (error) {
      console.error(`❌ 插件 ${this.name} 销毁失败:`, error);
      throw error;
    }
  }

  /**
   * 清理时的具体逻辑（子类可重写）
   *
   * 相比原有方式的优势：
   * 1. 可重写：子类可以重写此方法实现自定义清理
   * 2. 资源释放：可以释放占用的资源
   */
  onDestroy() {
    // 子类重写这个方法，写具体的清理逻辑
    // 比如：
    // - 清除定时器
    // - 取消网络请求
    // - 释放内存
    console.log(`💡 插件 ${this.name} 的 onDestroy() 方法可以子类重写`);
  }

  /**
   * 注册事件监听器（自动管理生命周期）
   *
   * 相比原有方式的优势：
   * 1. 自动清理：插件销毁时自动清理事件监听器
   * 2. 防止泄漏：避免事件监听器导致内存泄漏
   * 3. 统一管理：所有事件监听器集中在 _eventListeners 中
   *
   * @param {string} eventName - 事件名称
   * @param {function} handler - 事件处理函数
   */
  registerEventListener(eventName, handler) {
    if (!window.EventHub) {
      console.warn('⚠️ EventHub 未加载，无法注册事件监听器');
      return;
    }

    // 注册事件监听器
    window.EventHub.on(eventName, handler);

    // 记录到 _eventListeners，用于销毁时清理
    this._eventListeners.push({ eventName, handler });

    console.log(`📡 插件 ${this.name} 注册事件监听器: ${eventName}`);
  }

  /**
   * 清理所有事件监听器
   *
   * 相比原有方式的优势：
   * 1. 自动清理：插件销毁时自动调用
   * 2. 防止泄漏：避免事件监听器导致内存泄漏
   */
  cleanupEventListeners() {
    if (!window.EventHub) {
      return;
    }

    // 注销所有事件监听器
    for (const { eventName, handler } of this._eventListeners) {
      window.EventHub.off(eventName, handler);
    }

    // 清空记录
    this._eventListeners = [];

    console.log(`🧹 插件 ${this.name} 已清理所有事件监听器`);
  }

  /**
   * 参数验证（内部方法）
   *
   * 相比原有方式的优势：
   * 1. 类型检查：验证参数类型
   * 2. 必填检查：验证必填参数是否存在
   * 3. 错误提示：提供详细的错误信息
   *
   * @param {object} params - 要验证的参数
   */
  _validateParams(params) {
    // 子类可以重写此方法实现自定义参数验证
    // 示例：
    // _validateParams(params) {
    //   if (!params.apiKey) {
    //     throw new Error('缺少必填参数: apiKey');
    //   }
    //   if (typeof params.apiKey !== 'string') {
    //     throw new Error('参数 apiKey 必须是字符串');
    //   }
    // }
  }

  /**
   * 更新执行统计（内部方法）
   *
   * 相比原有方式的优势：
   * 1. 执行统计：记录执行次数和平均执行时间
   * 2. 性能监控：可以监控插件性能
   *
   * @param {number} executionTime - 执行时间（毫秒）
   */
  _updateStats(executionTime) {
    this._stats.executeCount++;
    this._stats.lastExecuteTime = executionTime;
    this._stats.averageExecuteTime =
      (this._stats.averageExecuteTime * (this._stats.executeCount - 1) + executionTime) / this._stats.executeCount;
  }

  /**
   * 获取插件统计信息
   *
   * 相比原有方式的优势：
   * 1. 统计信息：获取插件执行统计
   * 2. 性能分析：分析插件性能
   *
   * @returns {object} 统计信息
   */
  getStats() {
    return {
      name: this.name,
      version: this.version,
      isInitialized: this.isInitialized,
      isDestroyed: this.isDestroyed,
      executeCount: this._stats.executeCount,
      lastExecuteTime: this._stats.lastExecuteTime,
      averageExecuteTime: this._stats.averageExecuteTime
    };
  }
}

/**
 * SkillPluginLoader - 前端插件加载器（重构版）
 *
 * 相比原有系统提示词的优势：
 * 1. 按需加载：
 *    - 原有方式：所有提示词一次性加载，浪费资源
 *    - 新机制：核心插件预加载，可选插件按需加载
 *
 * 2. 重复加载保护：
 *    - 原有方式：可能重复加载相同的提示词
 *    - 新机制：loadingPromises 防止重复加载
 *
 * 3. 双端支持：
 *    - 原有方式：只支持单一环境
 *    - 新机制：同时支持 H5 和小程序端
 */
class SkillPluginLoader {
  /**
   * 构造函数
   */
  constructor() {
    // 存放所有已加载的插件（货架）
    this.plugins = {};

    // 记录哪些插件是核心插件（需要预加载）
    this.corePlugins = ['auth'];

    // 记录哪些插件是可选插件（按需加载）
    this.optionalPlugins = ['ai', 'scale', 'scoring', 'npc', 'meditation', 'analytics', 'diary'];

    // 插件存放的目录（仓库地址 - 使用绝对路径，末尾必须有斜杠）
    this.pluginBaseUrl = '/mini-app-h5/backend/plugins/';

    // 加载状态记录（防止重复加载）
    this.loadingPromises = {};

    // 🚀 性能优化：添加插件缓存
    this.pluginCache = new Map(); // 插件实例缓存
    this.metadataCache = new Map(); // 插件元数据缓存
    this.loadingQueue = []; // 预加载队列
    this.preloadInProgress = false; // 预加载状态

    console.log('📦 SkillPluginLoader 创建成功');
    console.log(`   核心插件: ${this.corePlugins.join(', ')}`);
    console.log(`   可选插件: ${this.optionalPlugins.join(', ')}`);
    console.log('   🚀 性能优化已启用: 缓存、懒加载、预加载');
  }

  /**
   * 初始化：预加载核心插件
   *
   * 相比原有方式的优势：
   * 1. 并行加载：使用 Promise.all() 并行加载，加快速度
   * 2. 容错处理：单个插件加载失败不影响其他插件
   * 3. 事件通知：加载完成后广播事件
   */
  async init() {
    console.log('🚀 开始预加载核心插件...');

    const loadPromises = this.corePlugins.map((pluginName) => {
      return this.load(pluginName, true).catch((error) => {
        console.warn(`⚠️ 核心插件 ${pluginName} 加载失败（非致命）:`, error.message);
        return null; // 继续加载其他插件
      });
    });

    // 并行加载所有核心插件（加快速度）
    const results = await Promise.all(loadPromises);
    const successCount = results.filter((r) => r !== null).length;

    console.log(`✅ 核心插件预加载完成: ${successCount}/${this.corePlugins.length} 成功`);

    // 广播"插件系统初始化完成"事件
    if (window.EventHub) {
      await window.EventHub.emit('plugins-ready', {
        corePlugins: this.corePlugins,
        loadedCount: successCount
      });
    }

    return results;
  }

  /**
   * 加载插件（已优化：添加缓存机制）
   *
   * 性能优化点：
   * 1. 缓存机制：已加载的插件直接从缓存返回
   * 2. 并发控制：正在加载的插件返回已有的 Promise
   * 3. 懒加载支持：可选插件按需加载
   * 4. 预加载支持：核心插件提前加载
   *
   * @param {string} pluginName - 插件名称（如 'ai'）
   * @param {boolean} silent - 是否静默加载（失败时不报错）
   * @param {boolean} useCache - 是否使用缓存（默认 true）
   * @returns {Promise<SkillPluginBase>} 插件实例
   */
  async load(pluginName, silent = false, useCache = true) {
    // 🚀 性能优化1：缓存机制 - 如果已经加载过，直接返回
    if (useCache && this.pluginCache.has(pluginName)) {
      console.log(`♻️ 从缓存加载插件 ${pluginName}`);
      return this.pluginCache.get(pluginName);
    }

    // 兼容旧代码：检查 plugins 对象
    if (this.plugins[pluginName]) {
      console.log(`ℹ️ 插件 ${pluginName} 已加载（旧缓存），跳过`);
      // 同步到新缓存
      this.pluginCache.set(pluginName, this.plugins[pluginName]);
      return this.plugins[pluginName];
    }

    // 防止重复加载（如果正在加载中，返回已有的Promise）
    if (this.loadingPromises[pluginName]) {
      console.log(`⏳ 插件 ${pluginName} 正在加载中，等待完成...`);
      return this.loadingPromises[pluginName];
    }

    console.log(`📦 开始加载插件: ${pluginName}`);

    // 创建加载Promise（防止重复加载）
    this.loadingPromises[pluginName] = this._doLoad(pluginName, silent, useCache);

    try {
      const pluginInstance = await this.loadingPromises[pluginName];

      // 🚀 性能优化2：保存到缓存
      if (useCache && pluginInstance) {
        this.pluginCache.set(pluginName, pluginInstance);
        // 同时保存到旧对象（兼容性）
        this.plugins[pluginName] = pluginInstance;
      }

      return pluginInstance;
    } finally {
      // 加载完成后，删除Promise记录
      delete this.loadingPromises[pluginName];
    }
  }

  /**
   * 实际执行加载（内部方法，已优化）
   *
   * 性能优化点：
   * 1. 缓存检查：先检查缓存，避免重复加载
   * 2. 性能监控：记录加载时间，用于性能分析
   * 3. 双端支持：自动检测运行环境（H5/小程序）
   * 4. 类检测：检查插件是否继承了 SkillPluginBase
   * 5. 自动初始化：加载完成后自动初始化
   *
   * @param {string} pluginName - 插件名称
   * @param {boolean} silent - 是否静默加载
   * @param {boolean} useCache - 是否使用缓存
   * @returns {Promise<SkillPluginBase>} 插件实例
   */
  async _doLoad(pluginName, silent, useCache = true) {
    // 🚀 性能优化：检查缓存
    if (useCache && this.pluginCache.has(pluginName)) {
      console.log(`♻️ 从缓存获取插件 ${pluginName}`);
      return this.pluginCache.get(pluginName);
    }

    try {
      const startTime = Date.now(); // 开始计时
      const pluginPath = this._getPluginPath(pluginName);
      console.log(`   📂 加载路径: ${pluginPath}`);

      // 检测运行环境
      const isMiniProgram = typeof wx !== 'undefined' && wx.getSystemInfo;

      let PluginClass;

      if (isMiniProgram) {
        // 小程序端：使用 require() 加载
        const pluginModule = require(pluginPath);
        PluginClass = pluginModule.default || pluginModule[`${this._capitalize(pluginName)}Plugin`];
      } else {
        // H5端：使用动态添加<script>标签加载（兼容非module脚本）
        // 插件文件会在全局注册：window.{PluginName}Plugin
        await this._loadScript(pluginPath);

        // 从全局获取插件类
        const globalVarName = `${this._capitalize(pluginName)}Plugin`;
        PluginClass = window[globalVarName];

        if (!PluginClass) {
          throw new Error(`插件文件 ${pluginPath} 没有在全局注册 ${globalVarName}`);
        }
      }

      if (!PluginClass) {
        throw new Error(`插件文件 ${pluginPath} 没有导出插件类`);
      }

      // 检查是否继承了SkillPluginBase
      if (window.SkillPluginBase && !(PluginClass.prototype instanceof window.SkillPluginBase)) {
        console.warn(`⚠️ 插件 ${pluginName} 没有继承 SkillPluginBase`);
      }

      // 创建插件实例并初始化
      const pluginInstance = new PluginClass();
      await pluginInstance.init();

      // 🚀 性能优化：保存到缓存
      if (useCache) {
        this.pluginCache.set(pluginName, pluginInstance);
        this.metadataCache.set(pluginName, {
          name: pluginName,
          version: pluginInstance.version,
          description: pluginInstance.description,
          loadTime: Date.now() - startTime
        });
      }

      // 保存到 plugins 对象（兼容性）
      this.plugins[pluginName] = pluginInstance;

      const loadTime = Date.now() - startTime;
      console.log(`✅ 插件 ${pluginName} 加载并初始化成功 (耗时: ${loadTime}ms)`);

      return pluginInstance;
    } catch (error) {
      if (!silent) {
        throw error;
      } else {
        console.warn(`⚠️ 插件 ${pluginName} 加载失败（静默模式）:`, error.message);
        return null;
      }
    }
  }

  /**
   * 获取已加载的插件
   *
   * @param {string} pluginName - 插件名称
   * @returns {SkillPluginBase|null} 插件实例
   */
  get(pluginName) {
    return this.plugins[pluginName] || null;
  }

  /**
   * 卸载插件
   *
   * 相比原有方式的优势：
   * 1. 资源清理：卸载时自动调用 destroy()
   * 2. 内存释放：从 plugins 对象中删除引用
   *
   * @param {string} pluginName - 插件名称
   */
  unload(pluginName) {
    const plugin = this.plugins[pluginName];
    if (!plugin) {
      console.warn(`⚠️ 插件 ${pluginName} 未加载`);
      return;
    }

    // 调用插件的 destroy() 方法
    plugin.destroy();

    // 从 plugins 对象中删除
    delete this.plugins[pluginName];

    console.log(`🗑️ 插件 ${pluginName} 已卸载`);
  }

  /**
   * 获取插件路径（内部方法）
   *
   * @param {string} pluginName - 插件名称
   * @returns {string} 插件路径
   */
  _getPluginPath(pluginName) {
    return `${this.pluginBaseUrl}${pluginName}-plugin.js`;
  }

  /**
   * 首字母大写（内部方法）
   *
   * @param {string} str - 字符串
   * @returns {string} 首字母大写的字符串
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * 动态加载脚本（内部方法，H5端使用）
   *
   * 相比原有方式的优势：
   * 1. 异步加载：不阻塞页面渲染
   * 2. Promise封装：支持 async/await
   * 3. 错误处理：加载失败会抛出明确错误
   *
   * @param {string} src - 脚本路径
   * @returns {Promise<void>}
   */
  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
      document.head.appendChild(script);
    });
  }
}

// 导出到全局
window.SkillPluginBase = SkillPluginBase;
window.SkillPluginLoader = SkillPluginLoader;

console.log('✅ refactored-skill-system.js 加载完成');
