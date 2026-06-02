/**
 * npc-scene — NPC 场景背景组件
 *
 * 渐变背景 + 角色立绘（图片）+ 名牌
 * 属性：background, counselorImage, counselorName, motto, scene, sceneOpacity
 */

Component({
  properties: {
    /** 背景图片路径（本地缓存路径） */
    background: { type: String, value: '' },
    /** 咨询师立绘图片路径 */
    counselorImage: { type: String, value: '' },
    /** 咨询师名称 */
    counselorName: { type: String, value: '' },
    /** 咨询师格言 */
    motto: { type: String, value: '' },
    /** 场景模式：full（全屏答题背景） / card（卡片内小场景） */
    scene: { type: String, value: 'full' },
    /** 场景整体透明度（对齐H5: result页0.3, ai-diag页0.35, 默认1） */
    sceneOpacity: { type: String, value: '' }
  },

  data: {
    bgStyle: '',
    wrapStyle: '',
    imgLoaded: false
  },

  observers: {
    background: function (bg) {
      if (bg) {
        this.setData({ bgStyle: 'background-image:url(' + bg + ');background-size:cover;background-position:center;' });
      } else {
        this.setData({ bgStyle: '' });
      }
    },
    sceneOpacity: function (op) {
      if (op) {
        this.setData({ wrapStyle: 'opacity:' + op + ';' });
      } else {
        this.setData({ wrapStyle: '' });
      }
    },
    counselorImage: function (src) {
      // 图片路径变化时重置加载状态
      if (src) {
        this.setData({ imgLoaded: false });
      }
      console.log(
        '[NpcScene] counselorImage changed:',
        src ? src.substring(0, 60) + (src.length > 60 ? '...' : '') : '(empty)'
      );
    }
  },

  methods: {
    _onImgLoad: function (e) {
      console.log('[NpcScene] 图片加载成功, 宽:', e.detail.width, '高:', e.detail.height);
      this.setData({ imgLoaded: true });
    },
    _onImgError: function (e) {
      console.error(
        '[NpcScene] 图片加载失败! src:',
        this.data.counselorImage ? this.data.counselorImage.substring(0, 80) : '(empty)',
        'errMsg:',
        e.detail && e.detail.errMsg ? e.detail.errMsg : 'unknown'
      );
      this.setData({ imgLoaded: false });
    }
  }
});
