// 云函数：data-init
// 前端初始化时调用，拉取已上架的量表列表
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const { category, keyword } = event || {};

    // 查询已上架的量表
<<<<<<< Updated upstream
    const query = db.collection('scales').where({ status: 1 });
=======
    let query = db.collection('scales').where({ status: 1 });
>>>>>>> Stashed changes
    const res = await query.orderBy('sortOrder', 'asc').limit(100).get();
    let scales = res.data || [];

    // 分类过滤
    if (category) {
      scales = scales.filter((s) => s.category === category);
    }

    // 关键词搜索
    if (keyword) {
      const kw = keyword.toLowerCase();
      scales = scales.filter((s) => {
        return (
          (s.name || '').toLowerCase().includes(kw) ||
          (s.shortName || '').toLowerCase().includes(kw) ||
          (s.code || '').toLowerCase().includes(kw) ||
          (s.tags || []).some((t) => t.toLowerCase().includes(kw))
        );
      });
    }

    // 按分类聚合
    const categoryMap = {};
    scales.forEach((s) => {
      const cat = s.category || 'other';
      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          id: cat,
          name: s.categoryName || cat,
          color: s.color || '#CCCCCC',
          scales: []
        };
      }
      categoryMap[cat].scales.push(s);
    });
    const categories = Object.values(categoryMap);

    return {
      code: 0,
      data: {
        scales,
        categories,
        total: scales.length
      }
    };
  } catch (err) {
    console.error('[data-init] 错误:', err);
    return { code: -1, message: '获取量表数据失败: ' + err.message };
  }
};
