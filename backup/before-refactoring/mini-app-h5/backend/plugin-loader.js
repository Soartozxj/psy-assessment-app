/**
 * plugin-loader.js - 插件加载器（智能仓库管理员）
 *
 * 大白话解释：
 * - 管理插件的加载和卸载
 * - 核心插件预加载（提前放到货架上）
 * - 可选插件按需加载（需要时再去仓库拿）
 * - 支持H5和小程序双端
 *
 * @version 1.0.0
 * @date 2026-05-27
 */

class PluginLoader {
  /**
   * 构造函数
   */
  constructor() {
    // 存放所有已加载的插件（货架）
    this.plugins = {};

    // 记录哪些插件是核心插件（需要预加载）
    this.corePlugins = ['auth', 'ai', 'scale', 'scoring', 'npc'];

    // 记录哪些插件是可选插件（按需加载）
    this.optionalPlugins = ['meditation', 'analytics', 'diary'];

    // 插件存放的目录（仓库地址）
    this.pluginBaseUrl = './plugins/';

    // 加载状态记录（防止重复加载）
    this.loadingPromises = {};

    console.log('📦 PluginLoader 创建成功');
    console.log(`   核心插件: ${this.corePlugins.join(', ')}`);
    console.log(`   可选插件: ${this.optionalPlugins.join(', ')}`);
  }

  /**
   * 初始化：预加载核心插件
   * 大白话：页面打开时，提前把常用插件加载好
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
   * 加载插件
   * @param {string} pluginName - 插件名称（如 'ai'）
   * @param {boolean} silent - 是否静默加载（失败时不报错）
   * @returns {Promise<PluginBase>} 插件实例
   *
   * 大白话：从仓库（plugins目录）拿一个插件放到货架（plugins对象）上
   */
  async load(pluginName, silent = false) {
    // 如果已经加载过，直接返回
    if (this.plugins[pluginName]) {
      console.log(`ℹ️ 插件 ${pluginName} 已加载，跳过`);
      return this.plugins[pluginName];
    }

    // 防止重复加载（如果正在加载中，返回已有的Promise）
    if (this.loadingPromises[pluginName]) {
      console.log(`⏳ 插件 ${pluginName} 正在加载中，等待完成...`);
      return this.loadingPromises[pluginName];
    }

    console.log(`📦 开始加载插件: ${pluginName}`);

    // 创建加载Promise（防止重复加载）
    this.loadingPromises[pluginName] = this._doLoad(pluginName, silent);

    try {
      const pluginInstance = await this.loadingPromises[pluginName];
      return pluginInstance;
    } finally {
      // 加载完成后，删除Promise记录
      delete this.loadingPromises[pluginName];
    }
  }

  /**
   * 实际执行加载（内部方法）
   */
  async _doLoad(pluginName, silent) {
    try {
      // 动态加载JS文件
      const pluginPath = this._getPluginPath(pluginName);
      console.log(`   📂 加载路径: ${pluginPath}`);

      // 使用动态import加载模块（ES6+ 自带功能，不需要Webpack）
      const pluginModule = await import(pluginPath);

      // 获取插件类（支持 default export 和 named export）
      const PluginClass = pluginModule.default || pluginModule[`${this._capitalize(pluginName)}Plugin`];

      if (!PluginClass) {
        throw new Error(`插件文件 ${pluginPath} 没有导出插件类`);
      }

      // 检查是否继承了PluginBase
      if ((!PluginClass.prototype) instanceof window.PluginBase) {
        console.warn(`⚠️ 插件 ${pluginName} 没有继承 PluginBase，自动包装...`);
      }

      // 创建插件实例并初始化
      console.log(`   🔧 创建插件实例: ${pluginName}`);
      const pluginInstance = new PluginClass();

      console.log(`   🚀 初始化插件: ${pluginName}`);
      await pluginInstance.init();

      // 放到货架上
      this.plugins[pluginName] = pluginInstance;

      console.log(`✅ 插件 ${pluginName} 加载成功`);

      // 广播"插件加载完成"事件
      if (window.EventHub) {
        await window.EventHub.emit('plugin-loaded', {
          name: pluginName,
          version: pluginInstance.version,
          description: pluginInstance.description
        });
      }

      return pluginInstance;
    } catch (error) {
      if (!silent) {
        console.error(`❌ 插件 ${pluginName} 加载失败:`, error);
        throw error;
      }
      console.warn(`⚠️ 插件 ${pluginName} 加载失败（静默模式）:`, error.message);
      return null;
    }
  }

  /**
   * 获取插件路径（支持H5和小程序双端）
   */
  _getPluginPath(pluginName) {
    // 检测运行环境
    const isMiniProgram = typeof wx !== 'undefined' && wx.getSystemInfo;

    if (isMiniProgram) {
      // 小程序端：使用 require() 加载
      // 注意：小程序不支持动态import，需要提前在app.js中注册
      return `${this.pluginBaseUrl}core/${pluginName}-plugin.js`;
    } else {
      // H5端：使用动态import加载
      // 判断是核心插件还是可选插件
      const isCore = this.corePlugins.includes(pluginName);
      const subDir = isCore ? 'core' : 'optional';
      return `${this.pluginBaseUrl}${subDir}/${pluginName}-plugin.js?v=${Date.now()}`;
    }
  }

  /**
   * 首字母大写
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * 获取已加载的插件
   * @param {string} pluginName - 插件名称
   * @returns {PluginBase|null} 插件实例
   *
   * 大白话：从货架上拿一个插件给你用
   */
  get(pluginName) {
    const plugin = this.plugins[pluginName];
    if (!plugin) {
      console.warn(`⚠️ 插件 ${pluginName} 未加载，请先调用 load('${pluginName}')`);
      return null;
    }
    return plugin;
  }

  /**
   * 执行插件
   * @param {string} pluginName - 插件名称
   * @param {object} params - 传递给插件的参数
   * @returns {Promise<any>} 执行结果
   *
   * 大白话：让指定的插件干活
   */
  async execute(pluginName, params = {}) {
    // 获取插件
    let plugin = this.get(pluginName);

    // 如果插件未加载，尝试加载（非静默模式）
    if (!plugin) {
      console.log(`🔄 插件 ${pluginName} 未加载，尝试加载...`);
      plugin = await this.load(pluginName, false);
    }

    if (!plugin) {
      throw new Error(`插件 ${pluginName} 加载失败，无法执行`);
    }

    // 执行插件
    console.log(`🎯 执行插件: ${pluginName}`, params);
    const result = await plugin.execute(params);

    return result;
  }

  /**
   * 卸载插件（释放内存）
   * @param {string} pluginName - 插件名称
   *
   * 大白话：把不用的插件从货架上拿下来
   */
  unload(pluginName) {
    const plugin = this.plugins[pluginName];

    if (!plugin) {
      console.warn(`⚠️ 插件 ${pluginName} 未加载，无需卸载`);
      return;
    }

    // 检查是否是核心插件（核心插件不建议卸载）
    if (this.corePlugins.includes(pluginName)) {
      console.warn(`⚠️ ${pluginName} 是核心插件，不建议卸载`);
    }

    console.log(`🗑️ 开始卸载插件: ${pluginName}`);

    // 调用插件的销毁方法
    plugin.destroy();

    // 从货架上移除
    delete this.plugins[pluginName];

    console.log(`✅ 插件 ${pluginName} 已卸载`);

    // 广播"插件卸载"事件
    if (window.EventHub) {
      window.EventHub.emit('plugin-unloaded', {
        name: pluginName
      });
    }
  }

  /**
   * 卸载所有插件
   * 大白话：清空货架（一般用于页面卸载时清理内存）
   */
  unloadAll() {
    console.log(`🗑️ 开始卸载所有插件 (共 ${Object.keys(this.plugins).length} 个)...`);

    Object.keys(this.plugins).forEach((pluginName) => {
      this.unload(pluginName);
    });

    console.log(`✅ 所有插件已卸载`);
  }

  /**
   * 获取所有已加载的插件信息
   * @returns {Array<object>} 插件信息列表
   */
  getPluginsInfo() {
    return Object.keys(this.plugins).map((name) => {
      const plugin = this.plugins[name];
      return {
        name: name,
        displayName: plugin.name,
        version: plugin.version,
        description: plugin.description,
        isInitialized: plugin.isInitialized,
        isDestroyed: plugin.isDestroyed
      };
    });
  }

  /**
   * 检查插件是否已加载
   * @param {string} pluginName - 插件名称
   * @returns {boolean}
   */
  isLoaded(pluginName) {
    return !!this.plugins[pluginName];
  }

  /**
   * 预加载可选插件（用户点击前提前加载）
   * @param {string} pluginName - 插件名称
   */
  async preloadOptional(pluginName) {
    if (!this.optionalPlugins.includes(pluginName)) {
      console.warn(`⚠️ ${pluginName} 不是可选插件`);
      return;
    }

    console.log(`⏰ 预加载可选插件: ${pluginName}`);
    await this.load(pluginName, true);
  }
}

// 创建全局单例（整个应用只有一个插件加载器）
window.PluginLoader = new PluginLoader();

console.log('✅ plugin-loader.js 加载完成');
