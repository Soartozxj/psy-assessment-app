/**
 * 虚拟滚动组件 - 大数据量列表优化
 * 只渲染可见区域的 DOM，大幅提升渲染性能
 */

class VirtualScroll {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;

    if (!this.container) {
      throw new Error('VirtualScroll: 容器元素不存在');
    }

    // 配置
    this.itemHeight = options.itemHeight || 50;
    this.bufferSize = options.bufferSize || 5; // 缓冲区大小
    this.renderItem = options.renderItem || this.defaultRenderItem;

    // 状态
    this.items = [];
    this.visibleItems = [];
    this.scrollTop = 0;
    this.startIndex = 0;
    this.endIndex = 0;

    // DOM 元素
    this.viewport = null;
    this.contentWrapper = null;
    this.itemPool = [];

    this.init();
  }

  /**
   * 初始化虚拟滚动
   */
  init() {
    // 创建视口
    this.viewport = document.createElement('div');
    this.viewport.style.cssText = `
            height: 100%;
            overflow-y: auto;
            position: relative;
        `;

    // 创建内容包装器
    this.contentWrapper = document.createElement('div');
    this.contentWrapper.style.cssText = `
            position: relative;
            width: 100%;
        `;

    this.viewport.appendChild(this.contentWrapper);

    // 替换原容器内容
    this.container.innerHTML = '';
    this.container.appendChild(this.viewport);

    // 监听滚动
    this.viewport.addEventListener('scroll', () => {
      this.onScroll();
    });

    // 初始渲染
    this.onScroll();
  }

  /**
   * 设置数据
   * @param {Array} items - 数据数组
   */
  setItems(items) {
    this.items = items;
    this.contentWrapper.style.height = `${items.length * this.itemHeight}px`;
    this.onScroll();
  }

  /**
   * 处理滚动
   */
  onScroll() {
    this.scrollTop = this.viewport.scrollTop;

    // 计算可见范围
    const viewportHeight = this.viewport.clientHeight;
    this.startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
    this.endIndex = Math.min(
      this.items.length,
      Math.ceil((this.scrollTop + viewportHeight) / this.itemHeight) + this.bufferSize
    );

    // 更新可见项
    this.updateVisibleItems();
  }

  /**
   * 更新可见项
   */
  updateVisibleItems() {
    // 回收不在可见范围内的 DOM
    this.itemPool.forEach((item) => {
      const index = parseInt(item.dataset.index);
      if (index < this.startIndex || index >= this.endIndex) {
        item.style.display = 'none';
      }
    });

    // 渲染可见项
    for (let i = this.startIndex; i < this.endIndex; i++) {
      let itemEl = this.itemPool.find((el) => parseInt(el.dataset.index) === i);

      if (!itemEl) {
        // 创建新元素
        itemEl = this.renderItem(this.items[i], i);
        itemEl.dataset.index = i;
        itemEl.style.cssText = `
                    position: absolute;
                    top: ${i * this.itemHeight}px;
                    left: 0;
                    right: 0;
                    height: ${this.itemHeight}px;
                `;
        this.contentWrapper.appendChild(itemEl);
        this.itemPool.push(itemEl);
      } else {
        // 更新现有元素
        itemEl.style.display = 'block';
        itemEl.style.top = `${i * this.itemHeight}px`;
      }
    }
  }

  /**
   * 默认渲染函数
   * @param {object} item - 数据项
   * @param {number} index - 索引
   * @returns {HTMLElement} 渲染的元素
   */
  defaultRenderItem(item, index) {
    const el = document.createElement('div');
    el.textContent = `Item ${index}: ${JSON.stringify(item).substring(0, 50)}`;
    return el;
  }

  /**
   * 滚动到指定索引
   * @param {number} index - 索引
   */
  scrollToIndex(index) {
    this.viewport.scrollTop = index * this.itemHeight;
  }

  /**
   * 销毁虚拟滚动
   */
  destroy() {
    this.viewport.removeEventListener('scroll', this.onScroll);
    this.container.innerHTML = '';
    this.itemPool = [];
  }
}

// 导出到全局
window.VirtualScroll = VirtualScroll;
