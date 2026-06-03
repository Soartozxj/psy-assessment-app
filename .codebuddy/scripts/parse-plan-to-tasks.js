/**
 * parse-plan-to-tasks.js
 *
 * 功能：从改造计划（plan.md）自动解析生成任务列表
 * 输入：plan.md 文件路径
 * 输出：.codebuddy/tasks/skills-architecture-tasks.md
 *
 * 使用方式：
 *   node parse-plan-to-tasks.js [plan.md路径]
 *   或直接被CodeBuddy AI Agent调用
 *
 * @version 1.0.0
 * @date 2026-05-29
 */

const fs = require('fs');
const path = require('path');

/**
 * 从plan.md解析任务列表
 * @param {string} planContent - plan.md的文件内容
 * @returns {Array} 解析出的任务数组
 */
function parseTasksFromPlan(planContent) {
  const tasks = [];

  // 正则1：匹配 ### 数字. 任务标题 格式（当前plan.md的实际格式）
  const sectionRegex = /###\s+(\d+)\.\s+(.+?)(?=\n|$)/g;
  let match;
  while ((match = sectionRegex.exec(planContent)) !== null) {
    const taskNum = match[1];
    const taskContent = match[2].trim();

    tasks.push({
      id: `T${taskNum.padStart(3, '0')}`,
      content: taskContent,
      dependencies: [],
      status: 'pending'
    });
  }

  if (tasks.length > 0) {
    console.log(`✅ 从 "### 数字. 任务" 格式解析出 ${tasks.length} 个任务`);
    return tasks;
  }

  // 正则2：匹配Markdown任务列表格式（- [ ] 或 - [x]）
  const taskLineRegex = /[-*]\s+\[([ xX])\]\s+(T\d+):\s+(.+)/g;
  while ((match = taskLineRegex.exec(planContent)) !== null) {
    const status = match[1] === ' ' ? 'pending' : 'completed';
    const id = match[2];
    const content = match[3].trim();

    tasks.push({
      id: id,
      content: content,
      dependencies: [],
      status: status
    });
  }

  if (tasks.length > 0) {
    console.log(`✅ 从Markdown任务列表解析出 ${tasks.length} 个任务`);
    return tasks;
  }

  // 正则3：匹配 "任务XXX：" 格式
  const taskSectionRegex = /任务(\d+)[：:]\s*(.+)/g;
  while ((match = taskSectionRegex.exec(planContent)) !== null) {
    tasks.push({
      id: `T${match[1].padStart(3, '0')}`,
      content: match[2].trim(),
      dependencies: [],
      status: 'pending'
    });
  }

  if (tasks.length > 0) {
    console.log(`✅ 从 "任务XXX：" 格式解析出 ${tasks.length} 个任务`);
  }

  return tasks;
}

/**
 * 生成任务定义Markdown内容
 * @param {Array} tasks - 任务数组
 * @returns {string} Markdown内容
 */
function generateTaskMarkdown(tasks) {
  const now = new Date().toISOString().split('T')[0];

  let md = `---
title: Skills架构改造任务列表
version: 1.0.0
created: ${now}
updated: ${now}
status: in_progress
assignee: AI Agent
---

# 📋 Skills架构改造 - 自动化任务列表

> 本文档定义Skills架构改造的所有任务，支持自动解析和状态追踪。

---

## 📊 任务概览

| 任务ID | 任务内容 | 状态 | 依赖 | 预计时间 | 负责人 |
|---------|----------|------|--------|----------|--------|
`;

  // 任务概览表格
  tasks.forEach((task) => {
    const statusIcon = getStatusIcon(task.status);
    const deps = task.dependencies && task.dependencies.length > 0 ? task.dependencies.join(', ') : '-';

    md += `| ${task.id} | ${task.content} | ${statusIcon} ${task.status} | ${deps} | 0.5天 | AI Agent |\n`;
  });

  md += `\n---\n\n## 📝 任务详情\n\n`;

  // 任务详情
  tasks.forEach((task) => {
    const statusIcon = getStatusIcon(task.status);
    const deps = task.dependencies && task.dependencies.length > 0 ? task.dependencies.join(', ') : '无';

    md += `### ${task.id}: ${task.content}\n\n`;
    md += `**状态**: ${statusIcon} ${task.status}  \n`;
    md += `**依赖**: ${deps}  \n`;
    md += `**预计时间**: 0.5天  \n`;
    md += `**验收标准**:  \n`;
    md += `1. 待定义  \n\n`;
    md += `---\n\n`;
  });

  md += `## 🔄 状态流转图\n\n`;
  md += `\`\`\`\n`;
  md += `pending → in_progress → completed\n`;
  md += `           ↓ (失败)        ↑\n`;
  md += `        retry? ────────┘\n`;
  md += `\`\`\`\n\n`;

  md += `---\n\n`;
  md += `## 📌 备注\n\n`;
  md += `1. **任务定义格式**: YAML front matter + Markdown，便于机器解析和人工阅读  \n`;
  md += `2. **状态持久化**: 任务状态同时保存在 \`.codebuddy/tasks/*.md\` 和 CodeBuddy \`todo_write\` 工具  \n`;
  md += `3. **自动触发**: 改造计划更新时自动重新解析任务列表  \n\n`;

  md += `---\n\n`;
  md += `## 📅 更新日志\n\n`;
  md += `- **${now}** - 从改造计划自动生成任务列表\n`;

  return md;
}

/**
 * 获取状态图标
 * @param {string} status - 任务状态
 * @returns {string} 图标
 */
function getStatusIcon(status) {
  switch (status) {
    case 'completed':
      return '✅';
    case 'in_progress':
      return '🔄';
    case 'pending':
      return '⏳';
    default:
      return '❓';
  }
}

/**
 * 主函数
 */
function main() {
  // 获取plan.md路径
  const args = process.argv.slice(2);
  const planPath = args[0] || path.join(__dirname, '../../../.codebuddy/plans/*/plan.md');

  console.log('📖 读取改造计划:', planPath);

  // 读取plan.md
  let planContent;
  try {
    // 如果传入的是目录，查找plan.md
    if (fs.statSync(planPath).isDirectory()) {
      const files = fs.readdirSync(planPath);
      const planFile = files.find((f) => f === 'plan.md');
      if (planFile) {
        planContent = fs.readFileSync(path.join(planPath, planFile), 'utf-8');
      }
    } else {
      planContent = fs.readFileSync(planPath, 'utf-8');
    }
  } catch (e) {
    console.error('❌ 读取改造计划失败:', e.message);
    process.exit(1);
  }

  if (!planContent) {
    console.error('❌ 未找到 plan.md 文件');
    process.exit(1);
  }

  // 解析任务
  const tasks = parseTasksFromPlan(planContent);

  if (tasks.length === 0) {
    console.warn('⚠️  未解析出任何任务');
    process.exit(1);
  }

  // 生成任务Markdown
  const taskMd = generateTaskMarkdown(tasks);

  // 写入任务定义文件
  const outputPath = path.join(__dirname, '../tasks/skills-architecture-tasks.md');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, taskMd, 'utf-8');

  console.log(`✅ 任务列表已生成: ${outputPath}`);
  console.log(`   任务数量: ${tasks.length}`);
  console.log(`   已完成: ${tasks.filter((t) => t.status === 'completed').length}`);
  console.log(`   进行中: ${tasks.filter((t) => t.status === 'in_progress').length}`);
  console.log(`   待执行: ${tasks.filter((t) => t.status === 'pending').length}`);
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

// 导出供CodeBuddy AI Agent调用
module.exports = {
  parseTasksFromPlan,
  generateTaskMarkdown,
  main
};
