/**
 * 星蓝心镜 — NPC 图片缓存管理器
 *
 * 替代 H5 的 asset-storage.js（IndexedDB），
 * 使用 wx.getFileSystemManager() + wx.env.USER_DATA_PATH 实现图片持久化。
 *
 * 功能：
 *   - 下载图片 → 保存到用户目录 → 缓存映射 → 返回本地路径
 *   - 并发下载控制
 *   - 缓存命中检测
 *   - 文件清理
 *   - 缓存版本管理（自动清除旧版本损坏缓存）
 *
 * 使用方式：
 *   var assetManager = require('./asset-manager.js');
 *   assetManager.getAssetPath('counselor_123').then(function(path) {
 *     // path = 'wxfile://usr/psy_assets/counselor_123.png'
 *     that.setData({ counselorSrc: path });
 *   });
 */

const api = require('./api.js');
const storage = require('./storage.js');
const constants = require('./constants.js');

/** 资源映射 Storage key */
const ASSET_MAP_KEY = 'psy_asset_map';

/** 缓存版本 Storage key — 版本不匹配时自动清除全部缓存 */
const CACHE_VERSION_KEY = 'psy_asset_cache_version';

/**
 * 缓存版本号 — 递增此值可强制清除所有旧缓存
 *
 * v2: 修复旧版 wx.downloadFile 保存 JSON 文本而非二进制图片的问题
 *     旧缓存文件内容为 JSON 文本，<image> 无法加载，必须删除重新下载
 * v3: v2 的 rmdirSync 可能失败（文件占用等），版本号已写入但文件未删除
 *     v3 确保强制重新验证所有缓存文件
 */
const CACHE_VERSION = 3;

/** 用户文件目录 */
const USER_DATA_PATH = wx.env.USER_DATA_PATH;

/** 资源子目录名 */
const ASSET_DIR = 'psy_assets';

/** 完整资源目录路径 */
const ASSET_DIR_PATH = USER_DATA_PATH + '/' + ASSET_DIR;

/** 最大并发下载数 */
const MAX_CONCURRENT_DOWNLOADS = 3;

/** 当前活跃下载数 */
let _activeDownloads = 0;

/** 等待队列 */
const _downloadQueue = [];

/** 内存缓存（id → 本地路径） */
let _memoryCache = {};

/** 文件系统管理器 */
let _fs = null;

/**
 * 获取文件系统管理器
 * @returns {FileSystemManager}
 */
function getFileSystemManager() {
  if (!_fs) {
    _fs = wx.getFileSystemManager();
  }
  return _fs;
}

/**
 * 确保资源目录存在
 * @returns {boolean}
 */
function ensureAssetDir() {
  try {
    const fs = getFileSystemManager();
    try {
      fs.accessSync(ASSET_DIR_PATH);
    } catch (e) {
      // 目录不存在，创建
      fs.mkdirSync(ASSET_DIR_PATH, true);
    }
    return true;
  } catch (e) {
    console.warn('[AssetManager] 创建资源目录失败:', e.message);
    return false;
  }
}

/**
 * 获取资源映射表（id → 相对路径）
 * @returns {object}
 */
function getAssetMap() {
  const map = storage.get(ASSET_MAP_KEY, {});
  if (!map || typeof map !== 'object') {
    return {};
  }
  return map;
}

/**
 * 保存资源映射表
 * @param {object} map - 映射表
 * @returns {boolean}
 */
function saveAssetMap(map) {
  return storage.set(ASSET_MAP_KEY, map);
}

/**
 * 生成文件扩展名
 * 从 MIME 类型或 URL 推断
 * @param {string} [mimeType] - MIME 类型
 * @param {string} [url] - 图片 URL
 * @returns {string} 扩展名（含点号）
 */
function inferExtension(mimeType, url) {
  if (mimeType) {
    const mimeMap = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg'
    };
    if (mimeMap[mimeType]) {
      return mimeMap[mimeType];
    }
  }
  if (url) {
    const match = url.match(/\.(png|jpe?g|gif|webp|svg)(\?|$)/i);
    if (match) {
      return '.' + match[1].toLowerCase();
    }
  }
  return '.png';
}

/**
 * 生成资源文件路径
 * @param {string} id - 资源 ID
 * @param {string} [ext] - 扩展名
 * @returns {string} 完整文件路径
 */
function generateFilePath(id, ext) {
  // 清理 ID 中不合法的文件名字符
  const safeId = String(id).replace(/[^a-zA-Z0-9_\-]/g, '_');
  const extension = ext || '.png';
  return ASSET_DIR_PATH + '/' + safeId + extension;
}

/**
 * 检查缓存版本，不匹配则清除所有缓存
 * 这是最可靠的方式：旧版 wx.downloadFile 保存的 JSON 文本损坏文件会被彻底清除
 */
function checkCacheVersion() {
  const storedVersion = storage.get(CACHE_VERSION_KEY, 0);
  if (storedVersion !== CACHE_VERSION) {
    console.log('[AssetManager] 缓存版本不匹配(存储:', storedVersion, '当前:', CACHE_VERSION, ')，清除所有旧缓存');
    try {
      const fs = getFileSystemManager();
      // 逐个删除文件再删目录（比 rmdirSync recursive 更可靠）
      try {
        const files = fs.readdirSync(ASSET_DIR_PATH);
        for (let i = 0; i < files.length; i++) {
          try {
            fs.unlinkSync(ASSET_DIR_PATH + '/' + files[i]);
          } catch (e) {
            console.warn('[AssetManager] 删除文件失败:', files[i], e.message);
          }
        }
        console.log('[AssetManager] 已删除', files.length, '个缓存文件');
      } catch (e) {
        console.log('[AssetManager] 资源目录不存在或读取失败:', e.message);
      }
      // 删除空目录
      try {
        fs.rmdirSync(ASSET_DIR_PATH);
        console.log('[AssetManager] 资源目录已删除');
      } catch (e) {
        // 目录可能不存在或有残留
      }
    } catch (e) {
      console.warn('[AssetManager] 清除缓存异常:', e.message);
    }
    storage.remove(ASSET_MAP_KEY);
    _memoryCache = {};
    storage.set(CACHE_VERSION_KEY, CACHE_VERSION);
    console.log('[AssetManager] 旧缓存已清除，图片将在下次访问时重新下载');
  }
}

// 模块加载时立即检查缓存版本
checkCacheVersion();

/**
 * 检查资源是否已缓存
 * @param {string} id - 资源 ID
 * @returns {Promise<string|null>} 本地路径或 null
 */
function getAssetPath(id) {
  // 1. 内存缓存
  if (_memoryCache[id]) {
    return Promise.resolve(_memoryCache[id]);
  }

  // 2. 映射表查找
  const map = getAssetMap();
  const relativePath = map[id];
  if (relativePath) {
    const fullPath = ASSET_DIR_PATH + '/' + relativePath;
    // 验证文件是否存在
    try {
      const fs = getFileSystemManager();
      fs.accessSync(fullPath);
      _memoryCache[id] = fullPath;
      return Promise.resolve(fullPath);
    } catch (e) {
      // 文件不存在，清理映射
      delete map[id];
      saveAssetMap(map);
    }
  }

  return Promise.resolve(null);
}

/**
 * 下载并保存图片
 * @param {string} id - 资源 ID
 * @param {string} [customUrl] - 自定义下载 URL
 * @returns {Promise<string>} 本地文件路径
 */
function downloadAsset(id, customUrl) {
  // 先检查缓存
  return getAssetPath(id).then(function (cachedPath) {
    if (cachedPath) {
      return cachedPath;
    }

    // 需要下载
    return new Promise(function (resolve, reject) {
      ensureAssetDir();

      // 构造下载 URL — NPC 图片 API 部署在 identity.soarto.com.cn
      let downloadUrl = customUrl;
      if (!downloadUrl) {
        downloadUrl = constants.NPC_API_BASE + '/api/npc-image?imageId=' + encodeURIComponent(id);
      }

      // H5 逻辑：GET /api/npc-image 返回 JSON { code:0, data:{ imageId, base64 } }
      // 小程序不能用 wx.downloadFile（它期望二进制响应），必须用 wx.request 解析 JSON
      wx.request({
        url: downloadUrl,
        method: 'GET',
        header: { 'content-type': 'application/json' },
        timeout: constants.TIMEOUT_MS,
        success: function (res) {
          if (res.statusCode !== 200) {
            console.warn('[AssetManager] 下载失败 HTTP:', res.statusCode, id);
            reject(new Error('HTTP ' + res.statusCode));
            return;
          }
          const json = res.data;
          if (!json || json.code !== 0 || !json.data || !json.data.base64) {
            console.warn('[AssetManager] 图片数据为空:', id, json && json.message);
            reject(new Error((json && json.message) || '图片数据为空'));
            return;
          }
          // base64 → 文件系统（对齐 H5 的 base64→Blob→IndexedDB 流程）
          saveBase64Asset(id, json.data.base64)
            .then(function (filePath) {
              console.log('[AssetManager] 下载成功:', id, '→', filePath);
              resolve(filePath);
            })
            .catch(function (e) {
              console.warn('[AssetManager] base64 保存失败:', id, e.message);
              reject(e);
            });
        },
        fail: function (err) {
          console.warn('[AssetManager] 请求失败:', id, err.errMsg);
          reject(new Error(err.errMsg || '请求失败'));
        }
      });
    });
  });
}

/**
 * 带并发控制的下载
 * @param {string} id - 资源 ID
 * @param {string} [customUrl] - 自定义 URL
 * @returns {Promise<string>}
 */
function queueDownload(id, customUrl) {
  return new Promise(function (resolve, reject) {
    if (_activeDownloads < MAX_CONCURRENT_DOWNLOADS) {
      _activeDownloads++;
      downloadAsset(id, customUrl)
        .then(resolve)
        .catch(reject)
        .finally(function () {
          _activeDownloads--;
          // 处理等待队列
          if (_downloadQueue.length > 0) {
            const next = _downloadQueue.shift();
            queueDownload(next.id, next.url).then(next.resolve).catch(next.reject);
          }
        });
    } else {
      _downloadQueue.push({ id: id, url: customUrl, resolve: resolve, reject: reject });
    }
  });
}

/**
 * 保存 base64 数据为文件
 * 用于云端同步场景（NPC配置API返回base64图片）
 * @param {string} id - 资源 ID
 * @param {string} base64Data - base64 数据（含 data:image/xxx;base64, 前缀）
 * @returns {Promise<string>} 本地文件路径
 */
function saveBase64Asset(id, base64Data) {
  return new Promise(function (resolve, reject) {
    ensureAssetDir();

    if (!base64Data) {
      reject(new Error('base64数据为空'));
      return;
    }

    try {
      // 解析 MIME 类型和原始数据
      const parts = base64Data.split(',');
      const mimeInfo = parts[0].match(/:(.*?);/);
      const mime = mimeInfo ? mimeInfo[1] : 'image/png';
      const ext = inferExtension(mime, null);
      const filePath = generateFilePath(id, ext);

      // 小程序使用 writeFile 写入 base64 数据
      const fs = getFileSystemManager();
      const base64Raw = parts[1] || parts[0];

      fs.writeFile({
        filePath: filePath,
        data: base64Raw,
        encoding: 'base64',
        success: function () {
          const map = getAssetMap();
          map[id] = id + ext;
          saveAssetMap(map);
          _memoryCache[id] = filePath;
          console.log('[AssetManager] base64保存成功:', id, '→', filePath);
          resolve(filePath);
        },
        fail: function (err) {
          console.warn('[AssetManager] base64保存失败:', id, err.errMsg);
          reject(new Error(err.errMsg || '保存失败'));
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 检查资源是否存在
 * @param {string} id - 资源 ID
 * @returns {Promise<boolean>}
 */
function exists(id) {
  return getAssetPath(id).then(function (path) {
    return path !== null;
  });
}

/**
 * 删除指定资源
 * @param {string} id - 资源 ID
 * @returns {Promise<boolean>}
 */
function deleteAsset(id) {
  return new Promise(function (resolve) {
    const map = getAssetMap();
    const relativePath = map[id];
    if (!relativePath) {
      resolve(true);
      return;
    }

    const fullPath = ASSET_DIR_PATH + '/' + relativePath;
    try {
      const fs = getFileSystemManager();
      fs.unlinkSync(fullPath);
    } catch (e) {
      // 文件可能已不存在
    }

    delete map[id];
    delete _memoryCache[id];
    saveAssetMap(map);
    resolve(true);
  });
}

/**
 * 清理所有缓存资源
 * @returns {Promise<boolean>}
 */
function clearAll() {
  return new Promise(function (resolve) {
    try {
      const fs = getFileSystemManager();
      // 删除整个资源目录
      try {
        fs.rmdirSync(ASSET_DIR_PATH, true);
      } catch (e) {
        // 目录可能不存在
      }
    } catch (e) {
      // 忽略
    }

    // 清理映射表和内存缓存
    storage.remove(ASSET_MAP_KEY);
    _memoryCache = {};
    console.log('[AssetManager] 所有缓存已清理');
    resolve(true);
  });
}

/**
 * 同步云端 NPC 图片
 * 从后端获取图片列表，逐张下载并缓存
 * @returns {Promise<number>} 成功下载的图片数量
 */
function syncFromCloud() {
  return new Promise(function (resolve) {
    // NPC 图片 API 部署在云托管 identity.soarto.com.cn（对齐 H5）
    const NPC_API = constants.NPC_API_BASE;
    const listUrl = NPC_API + '/api/npc-images';

    wx.request({
      url: listUrl,
      method: 'GET',
      header: { 'content-type': 'application/json' },
      success: function (res) {
        if (res.statusCode !== 200 || !res.data || res.data.code !== 0) {
          console.warn('[AssetManager] 获取图片列表失败');
          resolve(0);
          return;
        }

        const imageIds = (res.data.data && res.data.data.imageIds) || [];
        if (imageIds.length === 0) {
          resolve(0);
          return;
        }

        // 逐张下载
        let saved = 0;
        let skipped = 0;

        function downloadNext(idx) {
          if (idx >= imageIds.length) {
            console.log('[AssetManager] 图片同步完成, 下载:', saved, '跳过:', skipped);
            resolve(saved);
            return;
          }

          const imgId = imageIds[idx];
          // 检查是否已缓存
          exists(imgId).then(function (has) {
            if (has) {
              skipped++;
              downloadNext(idx + 1);
            } else {
              const imgUrl = NPC_API + '/api/npc-image?imageId=' + encodeURIComponent(imgId);
              queueDownload(imgId, imgUrl)
                .then(function () {
                  saved++;
                  downloadNext(idx + 1);
                })
                .catch(function () {
                  downloadNext(idx + 1);
                });
            }
          });
        }

        downloadNext(0);
      },
      fail: function () {
        console.warn('[AssetManager] 网络请求失败');
        resolve(0);
      }
    });
  });
}

/**
 * 获取缓存统计信息
 * @returns {object} { count: number, mapSize: number }
 */
function getCacheStats() {
  const map = getAssetMap();
  const keys = Object.keys(map);
  return {
    count: keys.length,
    mapSize: JSON.stringify(map).length
  };
}

module.exports = {
  getAssetPath: getAssetPath,
  downloadAsset: downloadAsset,
  queueDownload: queueDownload,
  saveBase64Asset: saveBase64Asset,
  exists: exists,
  deleteAsset: deleteAsset,
  clearAll: clearAll,
  syncFromCloud: syncFromCloud,
  getCacheStats: getCacheStats,
  ASSET_DIR_PATH: ASSET_DIR_PATH
};
