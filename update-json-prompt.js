const fs = require('fs');
const path = require('path');

// 读取 default-prompts.js
const content = fs.readFileSync('mini-app-h5/backend/default-prompts.js', 'utf8');

// 去掉 window.DEFAULT_PROMPTS = 前缀和末尾的 ;
const jsonStr = content.replace(/^window\.DEFAULT_PROMPTS\s*=\s*/, '').replace(/;\s*$/, '');
const prompts = JSON.parse(jsonStr);

// 找到 json 提示词
const jsonPrompt = prompts.find((p) => p.id === 'json');
if (!jsonPrompt) {
  console.error('未找到 json 提示词');
  process.exit(1);
}

// 读取新的提示词内容
const newContent = fs.readFileSync('json-prompt-v3-simple.txt', 'utf8');

// 更新 2.0 版本的内容
const v2 = jsonPrompt.versions.find((v) => v.version === '2.0');
if (!v2) {
  console.error('未找到 2.0 版本');
  process.exit(1);
}

v2.content = newContent;
v2.note = '极简版：明确输出格式，确保返回合法 JSON（代码块纯 JSON，无额外文字）';
v2.date = new Date().toISOString().split('T')[0];

console.log('已更新 json 提示词 2.0 版本');

// 重新生成文件
const output = 'window.DEFAULT_PROMPTS = ' + JSON.stringify(prompts, null, 2) + ';\n';
fs.writeFileSync('mini-app-h5/backend/default-prompts.js', output);
console.log('✅ default-prompts.js 已更新');
