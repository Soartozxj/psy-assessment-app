// 使用 Node.js 内置的 fetch 测试 API（Node.js 18+ 支持）
const API_BASE = 'http://127.0.0.1:3100';

async function testGetAllSkills() {
  console.log('\n1. 测试 GET /api/skills - 获取所有 Skill');
  try {
    const res = await fetch(`${API_BASE}/api/skills`);
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('数据:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
    return data;
  } catch (err) {
    console.error('错误:', err.message);
    return null;
  }
}

async function testGetSkillById(id) {
  console.log(`\n2. 测试 GET /api/skills/${id} - 获取单个 Skill`);
  try {
    const res = await fetch(`${API_BASE}/api/skills/${id}`);
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('数据:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
    return data;
  } catch (err) {
    console.error('错误:', err.message);
    return null;
  }
}

async function testCreateSkill() {
  console.log('\n3. 测试 POST /api/skills - 创建 Skill');
  const testSkill = {
    id: 'test-skill-' + Date.now(),
    name: '测试 Skill',
    description: '这是一个测试 Skill',
    version: '1.0.0',
    content: '# 测试内容\n\n这是一个测试 Skill 的内容。',
    metadata: {
      type: 'system-prompt',
      icon: '🧪',
      note: '测试用'
    }
  };

  try {
    const res = await fetch(`${API_BASE}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testSkill)
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('数据:', JSON.stringify(data, null, 2));
    return data;
  } catch (err) {
    console.error('错误:', err.message);
    return null;
  }
}

async function runTests() {
  console.log('=== 测试 Skill API ===');
  console.log('API 地址:', API_BASE);

  // 测试 1: 获取所有 Skill
  await testGetAllSkills();

  // 测试 2: 获取单个 Skill
  await testGetSkillById('meta-v2_3');

  // 测试 3: 创建 Skill（会失败，因为需要管理员权限）
  console.log('\n提示: POST /api/skills 需要管理员权限，预期会返回 401 或 403');
  await testCreateSkill();

  console.log('\n=== 测试完成 ===');
}

runTests().catch(console.error);
