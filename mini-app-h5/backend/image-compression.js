/**
 * 图片压缩工具 - 插件系统专用
 * 在浏览器中压缩图片，减少带宽和存储
 */

class ImageCompression {
  /**
   * 压缩图片
   * @param {File|Blob} file - 图片文件
   * @param {object} options - 压缩选项
   * @returns {Promise<Blob>} 压缩后的图片
   */
  static async compress(file, options = {}) {
    const { maxWidth = 1920, maxHeight = 1080, quality = 0.8, mimeType = 'image/jpeg' } = options;

    // 创建 ImageBitmap
    const bitmap = await createImageBitmap(file);

    // 计算新尺寸
    let { width, height } = bitmap;
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    // 创建 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);

    // 压缩
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });

    bitmap.close();
    return blob;
  }

  /**
   * 批量压缩图片
   * @param {FileList|Array} files - 图片文件列表
   * @param {object} options - 压缩选项
   * @returns {Promise<Array>} 压缩后的图片数组
   */
  static async compressBatch(files, options = {}) {
    const results = [];
    for (const file of files) {
      try {
        const compressed = await this.compress(file, options);
        results.push({
          original: file,
          compressed,
          success: true
        });
      } catch (error) {
        results.push({
          original: file,
          error: error.message,
          success: false
        });
      }
    }
    return results;
  }

  /**
   * 创建压缩预览
   * @param {Blob} original - 原始图片
   * @param {Blob} compressed - 压缩后的图片
   */
  static createPreview(original, compressed) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; gap: 20px; margin: 20px 0;';

    // 原始图片
    const originalBox = document.createElement('div');
    originalBox.innerHTML = `
            <h4>原始图片 (${(original.size / 1024).toFixed(2)} KB)</h4>
            <img src="${URL.createObjectURL(original)}" style="max-width: 200px;" />
        `;

    // 压缩图片
    const compressedBox = document.createElement('div');
    compressedBox.innerHTML = `
            <h4>压缩图片 (${(compressed.size / 1024).toFixed(2)} KB)</h4>
            <img src="${URL.createObjectURL(compressed)}" style="max-width: 200px;" />
        `;

    container.appendChild(originalBox);
    container.appendChild(compressedBox);

    return container;
  }
}

// 导出到全局
window.ImageCompression = ImageCompression;
