const fs = require('fs');
const filePath = '/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/default-prompts.js';
const raw = fs.readFileSync(filePath, 'utf8');

// 提取 JSON 数组
const match = raw.match(/^window\.DEFAULT_PROMPTS = ([\s\S]+);$/m);
if (!match) { console.error('格式错误'); process.exit(1); }

const prompts = JSON.parse(match[1]);
const jsonPrompt = prompts.find(p => p.id === 'json');
const active = jsonPrompt.versions.find(v => v.status === 'active');

let c = active.content;

// 精确替换所有"生成文件"相关表述
const map = {
  '生成一个可直接下载的 .json 文件': '将 JSON 内容用 ```json 代码块输出',
  '提供一个下载链接': '输出代码块',
  '必须是真实的 .json 文件，可以直接下载打开': '必须是 ```json ... ``` 代码块，内容是可以被 JSON.parse() 解析的合法 JSON',
  '不是在聊天框里输出文字': '不是在聊天框里输出纯文字描述',
  '如果你无法生成文件，就将 JSON 内容用代码块包裹输出': '将 JSON 内容用 ```json ... ``` 代码块包裹输出',
  '不要等我说"开始"，不要问我任何问题，不要在聊天框里用文字描述 JSON 内容，必须直接生成可下载的 .json 文件': '不要等我说"开始"，不要问我任何问题，必须直接用 ```json ... ``` 代码块输出 JSON 内容',
  '使用你的文件生成能力（File/Artifact/Code Interpreter 等工具）创建这个文件': '将完整 JSON 内容放入 ```json ... ``` 代码块中',
  '我现在可以开始生成了': '',
  '我现在可以开始': '',
};

let count = 0;
for (const [from, to] of Object.entries(map)) {
  if (c.includes(from)) {
    c = c.split(from).join(to);
    count++;
    console.log(`✅ 替换: ${from.substring(0, 40)}...`);
  }
}

// 最后兜底：把任何残留的"生成文件"、"下载链接"替换为中性表述
c = c.replace(/生成.*文件/g, '输出 JSON');
c = c.replace(/下载链接/g, '代码块');

console.log(`\n共替换 ${count} 处`);
console.log('仍包含"生成文件":', c.includes('生成文件'));
console.log('仍包含"下载":', c.includes('下载'));

active.content = c;
const out = `window.DEFAULT_PROMPTS = ${JSON.stringify(prompts, null, 0)};`;
fs.writeFileSync(filePath, out, 'utf8');
console.log('\n✅ 文件已写回');
