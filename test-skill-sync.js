// 测试 Skill 同步功能
// 在 http://127.0.0.1:8088/mini-app-h5/backend/admin-prompt-view.html?id=meta 页面的 Console 中执行

console.log('=== 测试 Skill 同步功能 ===');

// 1. 检查前端数据
console.log('1. 前端 pt 对象:', typeof pt !== 'undefined' ? pt : 'pt 未定义');
console.log('2. 前端 pt.versions:', typeof pt !== 'undefined' ? pt.versions : 'N/A');

// 2. 调用后端 API 检查 Skill 是否已同步
fetch('http://127.0.0.1:3100/api/skills')
  .then((r) => r.json())
  .then((data) => {
    console.log('3. 后端 Skill 列表:', data);
    console.log('4. Skill 总数:', data.total);

    // 查找刚刚创建的 Skill (meta-v2.4)
    const newSkill = data.data.find((s) => s.id === 'meta-v2.4' || s.name.includes('v2.4'));
    if (newSkill) {
      console.log('✅ 新版本已同步到 Skill 系统:', newSkill);
    } else {
      console.log(
        '⚠️ 未找到 meta-v2.4，所有 Skill:',
        data.data.map((s) => s.id)
      );
    }
  })
  .catch((err) => {
    console.error('❌ 调用后端 API 失败:', err);
  });
