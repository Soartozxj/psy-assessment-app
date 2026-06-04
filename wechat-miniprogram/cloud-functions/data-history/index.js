// 云函数：data-history
// 查询/删除测评历史
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 管理员 OpenID（与 data-sync 保持一致）
const ADMIN_OPENIDS = ['oyORU3XImvO_rYAWBUTMNm89-3v0'];

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const isAdmin = ADMIN_OPENIDS.length > 0 && ADMIN_OPENIDS.includes(openid);

  try {
    const { action, id, scaleId, page, pageSize } = event || {};
    const defaultPageSize = Math.min(pageSize || 20, 50);

    switch (action) {
      case 'list': {
        // 分页查询当前用户的测评历史
        const skip = ((page || 1) - 1) * defaultPageSize;
        const res = await db
          .collection('history')
          .where({ _openid: openid })
          .orderBy('createdAt', 'desc')
          .skip(skip)
          .limit(defaultPageSize)
          .get();

        const countRes = await db.collection('history').where({ _openid: openid }).count();

        return {
          code: 0,
          data: {
            list: res.data,
            total: countRes.total,
            page: page || 1,
            pageSize: defaultPageSize
          }
        };
      }

      case 'listByScale': {
        // 查询某个量表的历史（仅管理员可用）
<<<<<<< Updated upstream
        if (!isAdmin) {
          return { code: -2, message: '无管理权限' };
        }
=======
        if (!isAdmin) return { code: -2, message: '无管理权限' };
>>>>>>> Stashed changes
        const res = await db.collection('history').where({ scaleId }).orderBy('createdAt', 'desc').limit(100).get();
        return { code: 0, data: res.data };
      }

      case 'delete': {
        // 删除单条记录（只能删除自己的）
        const res = await db.collection('history').where({ _openid: openid, id }).limit(1).get();
        if (res.data.length > 0) {
          await db.collection('history').doc(res.data[0]._id).remove();
          return { code: 0, message: '删除成功' };
        }
        return { code: -1, message: '记录不存在' };
      }

      case 'statistics': {
        // 统计信息
        const countRes = await db.collection('history').where({ _openid: openid }).count();
        return {
          code: 0,
          data: { total: countRes.total }
        };
      }

      default:
        return { code: -1, message: '未知操作: ' + action };
    }
  } catch (err) {
    console.error('[data-history] 错误:', err);
    return { code: -1, message: '操作失败: ' + err.message };
  }
};
