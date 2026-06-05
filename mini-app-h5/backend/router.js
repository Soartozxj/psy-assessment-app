/**
 * Hash 路由系统 v1.0.0
 * 
 * 功能：
 * 1. 支持 URL Hash 路由（如 #dashboard, #scales）
 * 2. 支持浏览器前进/后退
 * 3. 支持深度链接（直接访问特定页面）
 * 4. 路由切换时保存滚动位置
 * 5. 未保存数据离开确认
 * 
 * 使用方法：
 * 1. 在 admin-legacy.html 中引入此文件
 * 2. 调用 Router.register() 注册路由
 * 3. 使用 Router.navigate() 跳转页面
 * 4. 使用 Router.getCurrentRoute() 获取当前路由
 * 
 * @version 1.0.0
 * @date 2026-06-05
 */

(function() {
  'use strict';

  // ====================================================
  // 路由配置
  // ====================================================
  const ROUTE_CONFIG = {
    // 默认路由（首页）
    defaultRoute: 'dashboard',
    
    // 路由与页面元素的映射（key 与 data-section 一致，value 与 HTML section id 一致）
    routeMap: {
      'dashboard': 'section-dashboard',
      'scales': 'section-scales',
      'questions': 'section-questions',
      'scoring': 'section-scoring',
      'sysPrompts': 'section-sysPrompts',
      'npcScene': 'section-npcScene',
      'feedback': 'section-feedback',
      'users': 'section-users',
      'records': 'section-records',
      'opsDashboard': 'section-opsDashboard',
      'settings': 'section-settings',
      'aiConfig': 'section-aiConfig'
    },
    
    // 路由标题映射
    titleMap: {
      'dashboard': '数据看板',
      'scales': '量表管理',
      'questions': '题目库',
      'scoring': '计分规则',
      'sysPrompts': '系统提示词',
      'npcScene': 'NPC 场景',
      'feedback': '用户评价',
      'users': '用户列表',
      'records': '测评记录',
      'opsDashboard': '系统运维',
      'settings': '系统设置',
      'aiConfig': 'AI 配置'
    },
    
    // 是否启用路由动画
    enableTransition: true,
    transitionDuration: 300
  };

  // ====================================================
  // 路由管理器
  // ====================================================
  class Router {
    constructor() {
      // 路由注册表
      this.routes = {};
      
      // 当前路由
      this.currentRoute = null;
      
      // 上一路由（用于返回）
      this.previousRoute = null;
      
      // 滚动位置缓存
      this.scrollPositions = {};
      
      // 路由守卫（进入前检查）
      this.beforeEachGuards = [];
      
      // 路由守卫（离开前检查）
      this.beforeLeaveGuards = [];
      
      // 防止重复路由处理
      this.isHandling = false;
      this._lastNavTime = 0;
      
      // 是否正在导航
      this.isNavigating = false;
      
      console.log('🧭 Router 创建成功');
    }

    // ====================================================
    // 初始化
    // ====================================================
    init() {
      console.log('🧭 正在初始化路由系统...');
      
      // 监听 Hash 变化
      window.addEventListener('hashchange', () => {
        this.handleRouteChange();
      });
      
      // 监听页面加载
      window.addEventListener('load', () => {
        this.handleRouteChange();
      });
      
      // 监听 beforeunload（离开页面时检查未保存数据）
      window.addEventListener('beforeunload', (e) => {
        if (this.hasUnsavedChanges()) {
          e.preventDefault();
          e.returnValue = '有未保存的更改，确定要离开吗？';
        }
      });
      
      console.log('✅ 路由系统初始化完成');
      
      // 初始路由
      this.handleRouteChange();
    }

    // ====================================================
    // 注册路由
    // ====================================================
    register(routeName, handler) {
      this.routes[routeName] = handler;
      console.log(`🧭 注册路由: ${routeName}`);
    }

    // ====================================================
    // 导航到指定路由
    // ====================================================
    async navigate(routeName, params = {}) {
      // 跳过已激活的路由
      if (routeName === this.currentRoute) {
        return;
      }
      
      // 防抖：300ms 内只允许一次导航
      const now = Date.now();
      if (this._lastNavTime && (now - this._lastNavTime < 300)) {
        console.warn('🧭 导航过于频繁，已跳过:', routeName);
        return;
      }
      this._lastNavTime = now;
      
      if (this.isNavigating) {
        console.warn('🧭 正在导航中，请稍候...');
        return;
      }
      
      // 检查路由是否存在
      if (!this.routeExists(routeName)) {
        console.error(`🧭 路由不存在: ${routeName}`);
        this.navigateTo404();
        return;
      }
      
      // 执行离开守卫
      if (!await this.runBeforeLeaveGuards(this.currentRoute)) {
        console.log('🧭 路由离开被取消');
        return;
      }
      
      // 保存当前滚动位置
      this.saveScrollPosition(this.currentRoute);
      
      // 执行进入守卫
      if (!await this.runBeforeEachGuards(routeName, params)) {
        console.log('🧭 路由进入被取消');
        return;
      }
      
      this.isNavigating = true;
      
      try {
        // 更新 Hash（会触发 hashchange 事件）
        window.location.hash = routeName;
      } finally {
        this.isNavigating = false;
      }
    }

    // ====================================================
    // 处理路由变化
    // ====================================================
    async handleRouteChange() {
      // 防止重入：如果正在处理路由，跳过
      if (this.isHandling) {
        console.warn('🧭 路由正在处理中，跳过重复请求');
        return;
      }
      
      // 获取当前 Hash
      let hash = window.location.hash.slice(1); // 去掉 # 号
      
      // 如果 Hash 为空，使用默认路由
      if (!hash) {
        hash = ROUTE_CONFIG.defaultRoute;
        window.location.hash = hash;
        return;
      }
      
      // 解析路由参数（如 #scales/edit/1）
      const { routeName, params } = this.parseRoute(hash);
      
      // 如果已经是当前路由，跳过
      if (routeName === this.currentRoute) {
        return;
      }
      
      // 检查路由是否存在
      if (!this.routeExists(routeName)) {
        console.warn(`🧭 未知路由: ${routeName}`);
        this.navigateTo404();
        return;
      }
      
      this.isHandling = true;
      
      try {
        // 执行离开守卫
        if (this.currentRoute && !await this.runBeforeLeaveGuards(this.currentRoute)) {
          // 恢复之前的 Hash
          window.location.hash = this.currentRoute;
          return;
        }
        
        // 保存上一路由
        this.previousRoute = this.currentRoute;
        
        // 更新当前路由
        this.currentRoute = routeName;
        
        // 执行路由切换
        await this.switchRoute(routeName, params);
        
        // 恢复滚动位置
        this.restoreScrollPosition(routeName);
        
        // 更新页面标题
        this.updatePageTitle(routeName);
        
        // 更新侧边栏高亮
        this.updateSidebarHighlight(routeName);
        
        console.log(`🧭 路由切换完成: ${this.previousRoute || '(初始)'} → ${routeName}`);
      } finally {
        this.isHandling = false;
      }
    }

    // ====================================================
    // 切换路由（显示/隐藏页面）
    // ====================================================
    async switchRoute(routeName, params = {}) {
      // 隐藏所有页面
      const allSections = document.querySelectorAll('.section, [id^="section-"]');
      allSections.forEach(section => {
        if (ROUTE_CONFIG.enableTransition) {
          section.style.opacity = '0';
          section.style.transform = 'translateX(20px)';
        }
        setTimeout(() => {
          section.style.display = 'none';
        }, ROUTE_CONFIG.transitionDuration);
      });
      
      // 显示目标页面
      const targetSectionId = ROUTE_CONFIG.routeMap[routeName];
      const targetSection = document.getElementById(targetSectionId);
      
      if (!targetSection) {
        console.error(`🧭 找不到页面元素: ${targetSectionId}`);
        return;
      }
      
      setTimeout(() => {
        targetSection.style.display = 'block';
        
        if (ROUTE_CONFIG.enableTransition) {
          // 触发重排
          targetSection.offsetHeight;
          
          targetSection.style.opacity = '1';
          targetSection.style.transform = 'translateX(0)';
        }
        
        // 调用路由处理器（如果已注册）
        if (this.routes[routeName]) {
          this.routes[routeName](params);
        }
        
        // 触发路由进入事件
        this.emitRouteEnter(routeName, params);
      }, ROUTE_CONFIG.transitionDuration);
    }

    // ====================================================
    // 解析路由（支持参数）
    // ====================================================
    parseRoute(hash) {
      const parts = hash.split('/');
      const routeName = parts[0];
      const params = {};
      
      // 解析参数（如 #scales/edit/1 → { action: 'edit', id: '1' }）
      if (parts.length > 1) {
        params.action = parts[1];
        if (parts.length > 2) {
          params.id = parts[2];
        }
      }
      
      return { routeName, params };
    }

    // ====================================================
    // 检查路由是否存在
    // ====================================================
    routeExists(routeName) {
      return ROUTE_CONFIG.routeMap[routeName] !== undefined;
    }

    // ====================================================
    // 保存滚动位置
    // ====================================================
    saveScrollPosition(routeName) {
      if (routeName) {
        this.scrollPositions[routeName] = {
          x: window.scrollX,
          y: window.scrollY
        };
      }
    }

    // ====================================================
    // 恢复滚动位置
    // ====================================================
    restoreScrollPosition(routeName) {
      const pos = this.scrollPositions[routeName];
      if (pos) {
        window.scrollTo(pos.x, pos.y);
      } else {
        window.scrollTo(0, 0);
      }
    }

    // ====================================================
    // 更新页面标题
    // ====================================================
    updatePageTitle(routeName) {
      const title = ROUTE_CONFIG.titleMap[routeName] || '后台管理';
      document.title = `星蓝心镜 · ${title}`;
    }

    // ====================================================
    // 更新侧边栏高亮
    // ====================================================
    updateSidebarHighlight(routeName) {
      // 移除所有高亮
      document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.remove('active');
      });
      
      // 高亮当前路由
      const activeLink = document.querySelector(`.sidebar-nav a[href="#${routeName}"]`);
      if (activeLink) {
        activeLink.classList.add('active');
      }
    }

    // ====================================================
    // 路由守卫：进入前
    // ====================================================
    beforeEach(guard) {
      this.beforeEachGuards.push(guard);
    }

    async runBeforeEachGuards(to, params) {
      for (const guard of this.beforeEachGuards) {
        const result = await guard(to, this.currentRoute, params);
        if (result === false) {
          return false;
        }
      }
      return true;
    }

    // ====================================================
    // 路由守卫：离开前
    // ====================================================
    beforeLeave(guard) {
      this.beforeLeaveGuards.push(guard);
    }

    async runBeforeLeaveGuards(from) {
      for (const guard of this.beforeLeaveGuards) {
        const result = await guard(from, this.currentRoute);
        if (result === false) {
          return false;
        }
      }
      return true;
    }

    // ====================================================
    // 检查是否有未保存的更改
    // ====================================================
    hasUnsavedChanges() {
      // 检查全局标记
      return window.hasUnsavedChanges === true;
    }

    // ====================================================
    // 设置未保存更改标记
    // ====================================================
    setUnsavedChanges(flag) {
      window.hasUnsavedChanges = flag;
    }

    // ====================================================
    // 导航到 404 页面
    // ====================================================
    navigateTo404() {
      console.error('🧭 404: 路由不存在');
      // 显示 404 提示
      if (window.UIUtils && UIUtils.showToast) {
        UIUtils.showToast('页面不存在', 'error', { duration: 3000 });
      }
      // 恢复之前的 hash，不触发 navigate（避免递归）
      if (this.previousRoute && this.routeExists(this.previousRoute)) {
        window.location.hash = this.previousRoute;
      } else {
        window.location.hash = ROUTE_CONFIG.defaultRoute;
      }
    }

    // ====================================================
    // 获取当前路由
    // ====================================================
    getCurrentRoute() {
      return this.currentRoute;
    }

    // ====================================================
    // 获取上一路由
    // ====================================================
    getPreviousRoute() {
      return this.previousRoute;
    }

    // ====================================================
    // 返回上一页
    // ====================================================
    goBack() {
      if (this.previousRoute) {
        this.navigate(this.previousRoute);
      } else {
        history.back();
      }
    }

    // ====================================================
    // 触发路由事件
    // ====================================================
    emitRouteEnter(routeName, params) {
      if (window.EventHub) {
        window.EventHub.emit('route-enter', {
          route: routeName,
          params,
          timestamp: Date.now()
        });
      }
    }
  }

  // ====================================================
  // 创建路由实例并暴露到全局
  // ====================================================
  const router = new Router();
  
  // 暴露到全局
  window.Router = router;
  
  // 添加 CSS 过渡效果
  function addTransitionStyles() {
    if (!ROUTE_CONFIG.enableTransition) {
      return;
    }
    
    const style = document.createElement('style');
    style.textContent = `
      .section, [id^="section-"] {
        transition: opacity ${ROUTE_CONFIG.transitionDuration}ms ease, 
                    transform ${ROUTE_CONFIG.transitionDuration}ms ease;
      }
    `;
    document.head.appendChild(style);
  }

  // ====================================================
  // 初始化
  // ====================================================
  function init() {
    // 添加过渡样式
    addTransitionStyles();
    
    // 初始化路由
    router.init();
    
    console.log('🧭 Hash 路由系统已启动');
    console.log('🧭 使用方法：');
    console.log('   - Router.navigate("dashboard")');
    console.log('   - Router.navigate("scales/edit/1")');
    console.log('   - window.location.hash = "settings"');
  }

  // 在 DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
