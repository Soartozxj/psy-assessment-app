#!/usr/bin/env node

/**
 * 图片压缩脚本 - 使用 Sharp 压缩图片
 *
 * 使用方法：
 *   node compress-images.js [目录路径] [质量]
 *
 * 示例：
 *   node compress-images.js ./frontend/assets 80
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 配置
const config = {
  quality: parseInt(process.argv[3]) || 80, // 默认质量 80
  maxWidth: 1920,
  maxHeight: 1080,
  outputDir: 'compressed' // 压缩后的图片保存目录
};

// 要压缩的图片目录
const imageDir = process.argv[2] || './frontend/assets';

// 支持的图片格式
const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * 压缩单个图片
 * @param {string} inputPath - 输入图片路径
 * @param {string} outputPath - 输出图片路径
 */
async function compressImage(inputPath, outputPath) {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // 计算新尺寸
    let width = metadata.width;
    let height = metadata.height;

    if (width > config.maxWidth) {
      height = Math.round((height * config.maxWidth) / width);
      width = config.maxWidth;
    }

    if (height > config.maxHeight) {
      width = Math.round((width * config.maxHeight) / height);
      height = config.maxHeight;
    }

    // 压缩
    await image.resize(width, height, { fit: 'inside' }).jpeg({ quality: config.quality }).toFile(outputPath);

    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;
    const savings = (((originalSize - compressedSize) / originalSize) * 100).toFixed(2);

    console.log(`✅ ${path.basename(inputPath)}`);
    console.log(`   原始: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`   压缩: ${(compressedSize / 1024).toFixed(2)} KB`);
    console.log(`   节省: ${savings}%`);

    return {
      success: true,
      originalSize,
      compressedSize,
      savings
    };
  } catch (error) {
    console.error(`❌ 压缩失败: ${inputPath}`);
    console.error(`   错误: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 批量压缩图片
 */
async function compressImages() {
  // 创建输出目录
  const outputDir = path.join(imageDir, config.outputDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 读取图片文件
  const files = fs.readdirSync(imageDir);
  const imageFiles = files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return supportedFormats.includes(ext);
  });

  console.log(`📷 找到 ${imageFiles.length} 张图片`);
  console.log(`⚙️  压缩质量: ${config.quality}%`);
  console.log(`📐 最大尺寸: ${config.maxWidth}x${config.maxHeight}`);
  console.log('');

  // 压缩每张图片
  const compressPromises = imageFiles.map((file) => {
    const inputPath = path.join(imageDir, file);
    const outputPath = path.join(outputDir, file);
    return compressImage(inputPath, outputPath);
  });

  const results = await Promise.all(compressPromises);

  // 统计
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const totalSavings = results.filter((r) => r.success).reduce((sum, r) => sum + parseFloat(r.savings), 0);

  console.log('');
  console.log('📊 压缩完成');
  console.log(`   成功: ${successCount}`);
  console.log(`   失败: ${failCount}`);
  if (successCount > 0) {
    console.log(`   平均节省: ${(totalSavings / successCount).toFixed(2)}%`);
  }
  console.log(`   输出目录: ${outputDir}`);
}

// 运行压缩
compressImages().catch(console.error);
