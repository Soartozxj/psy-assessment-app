// 测试 Skill API
import http from 'http';

function testAPI(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3100,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.log(`\n[${method} ${path}] Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log(JSON.stringify(json, null, 2));
          resolve(json);
        } catch (e) {
          console.log(data);
          resolve(data);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[${method} ${path}] Error:`, err.message);
      reject(err);
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== 测试 Skill API ===\n');

  // 测试 1: 获取所有 Skill
  console.log('1. 测试 GET /api/skills');
  await testAPI('/api/skills');

  // 测试 2: 获取单个 Skill
  console.log('\n2. 测试 GET /api/skills/meta-v2_3');
  await testAPI('/api/skills/meta-v2_3');

  console.log('\n=== 测试完成 ===');
}

runTests().catch(console.error);
