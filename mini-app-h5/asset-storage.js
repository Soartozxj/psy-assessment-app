/**
 * asset-storage.js — NPC素材 IndexedDB 存储工具
 *
 * 解决 localStorage 5MB 限制问题：
 *   - 图片本体（Blob）存入 IndexedDB（无大小限制）
 *   - 元数据（id/name/uploadTime）仍存于 localStorage
 *
 * 使用方式：
 *   AssetStorage.saveImage('counselor_123', blob).then(...)
 *   AssetStorage.getObjectURL('counselor_123').then(url => img.src = url)
 *   AssetStorage.deleteImage('counselor_123').then(...)
 */

const AssetStorage = (function() {
  const DB_NAME = 'psy_assets';
  const DB_VERSION = 1;
  const STORE_NAME = 'images';

  let _db = null;

  function openDB() {
    return new Promise(function(resolve, reject) {
      if (_db) { resolve(_db); return; }

      var req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      req.onsuccess = function(e) {
        _db = e.target.result;
        resolve(_db);
      };

      req.onerror = function(e) {
        console.error('[AssetStorage] 打开数据库失败:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  /**
   * 保存图片 Blob
   * @param {string} id - 素材ID
   * @param {Blob|File} blob - 图片文件
   * @returns {Promise<void>}
   */
  function saveImage(id, blob) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var req = store.put({ id: id, blob: blob, savedAt: Date.now() });
        req.onsuccess = function() { resolve(); };
        req.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  /**
   * 保存图片 Blob + base64（用于云端同步）
   * @param {string} id - 素材ID
   * @param {Blob|File} blob - 图片文件
   * @param {string} [base64] - base64 dataURL（可选）
   * @returns {Promise<void>}
   */
  function saveImageWithBase64(id, blob, base64) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var record = { id: id, blob: blob, savedAt: Date.now() };
        if (base64) record.base64 = base64;
        var req = store.put(record);
        req.onsuccess = function() {
          // 同步更新内存缓存，避免 getCachedDataURL 返回旧数据
          if (base64) _activeDataURLs[id] = base64;
          resolve();
        };
        req.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  /**
   * 获取图片的 base64 dataURL（用于云端同步）
   * @param {string} id - 素材ID
   * @returns {Promise<string|null>}
   */
  function getBase64(id) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.get(id);
        req.onsuccess = function(e) {
          var record = e.target.result;
          if (record && record.base64) {
            resolve(record.base64);
          } else {
            resolve(null);
          }
        };
        req.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  /**
   * 获取图片的 ObjectURL（用完后需 revokeObjectURL 释放）
   * @param {string} id - 素材ID
   * @returns {Promise<string|null>}
   */
  function getObjectURL(id) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.get(id);
        req.onsuccess = function(e) {
          var record = e.target.result;
          if (record && record.blob) {
            resolve(URL.createObjectURL(record.blob));
          } else {
            resolve(null);
          }
        };
        req.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  /**
   * 删除图片
   * @param {string} id - 素材ID
   * @returns {Promise<void>}
   */
  function deleteImage(id) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var req = store.delete(id);
        req.onsuccess = function() { resolve(); };
        req.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  /**
   * 检查某个 id 是否存在
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  function exists(id) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.count(id);
        req.onsuccess = function(e) { resolve(e.target.result > 0); };
        req.onerror = function() { resolve(false); };
      });
    });
  }

  /**
   * 将 File/Blob 转为 ObjectURL 并填充到 <img> 元素
   * 自动管理 URL 生命周期（图片加载完成后不 revoke，因为需要持续显示）
   * 返回 url 供调用方在合适时机 revoke
   * @param {string} id
   * @param {HTMLImageElement} imgEl
   * @returns {Promise<string|null>}
   */
  function applyToImg(id, imgEl) {
    return getObjectURL(id).then(function(url) {
      if (url && imgEl) {
        imgEl.src = url;
      }
      return url;
    });
  }

  // 管理当前活跃的 ObjectURL，避免内存泄漏
  var _activeURLs = {};

  /**
   * 获取并缓存 ObjectURL（同一 id 复用同一 URL）
   * ⚠️ 微信 WebView 中 blob URL 不可靠，NPC 图片应使用 getCachedDataURL()
   * @param {string} id
   * @returns {Promise<string|null>}
   */
  function getCachedURL(id) {
    if (_activeURLs[id]) {
      return Promise.resolve(_activeURLs[id]);
    }
    return getObjectURL(id).then(function(url) {
      if (url) _activeURLs[id] = url;
      return url;
    });
  }

  // 管理 base64 dataURL 缓存（微信 WebView 兼容方案）
  var _activeDataURLs = {};

  /**
   * 获取并缓存 base64 dataURL（微信 WebView 兼容）
   * 优先从 IndexedDB 读取已保存的 base64 字段，直接返回 data:image/xxx;base64,xxx
   * @param {string} id
   * @returns {Promise<string|null>}
   */
  function getCachedDataURL(id) {
    if (_activeDataURLs[id]) {
      return Promise.resolve(_activeDataURLs[id]);
    }
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.get(id);
        req.onsuccess = function(e) {
          var record = e.target.result;
          if (record && record.base64) {
            _activeDataURLs[id] = record.base64;
            resolve(record.base64);
          } else if (record && record.blob) {
            // 旧版数据只有 blob 没有 base64，动态转换并回写
            var reader = new FileReader();
            reader.onload = function(ev) {
              var b64 = ev.target.result;
              _activeDataURLs[id] = b64;
              // 回写 base64 到 IDB，避免下次再转换
              openDB().then(function(db2) {
                var tx2 = db2.transaction(STORE_NAME, 'readwrite');
                var store2 = tx2.objectStore(STORE_NAME);
                record.base64 = b64;
                store2.put(record);
              }).catch(function() {});
              resolve(b64);
            };
            reader.onerror = function() { resolve(null); };
            reader.readAsDataURL(record.blob);
          } else {
            resolve(null);
          }
        };
        req.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  /**
   * 释放某个 id 的 dataURL 缓存
   * @param {string} id
   */
  function revokeDataURLCache(id) {
    delete _activeDataURLs[id];
  }

  /**
   * 释放某个 id 的缓存 URL
   * @param {string} id
   */
  function revokeCache(id) {
    if (_activeURLs[id]) {
      URL.revokeObjectURL(_activeURLs[id]);
      delete _activeURLs[id];
    }
  }

  /**
   * 释放所有缓存 URL
   */
  function revokeAll() {
    Object.keys(_activeURLs).forEach(function(id) {
      URL.revokeObjectURL(_activeURLs[id]);
    });
    _activeURLs = {};
  }

  return {
    saveImage: saveImage,
    saveImageWithBase64: saveImageWithBase64,
    getObjectURL: getObjectURL,
    getBase64: getBase64,
    getCachedURL: getCachedURL,
    getCachedDataURL: getCachedDataURL,
    revokeCache: revokeCache,
    revokeAll: revokeAll,
    revokeDataURLCache: revokeDataURLCache,
    deleteImage: deleteImage,
    applyToImg: applyToImg,
    exists: exists
  };
})();
