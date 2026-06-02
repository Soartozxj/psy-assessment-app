// 云函数：data-sync
// 后台管理保存量表配置（管理权限验证）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 管理员 OpenID 列表
const ADMIN_OPENIDS = ['oyORU3XImvO_rYAWBUTMNm89-3v0'];

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 管理员权限验证（所有写操作必须验证）
  const { action } = event || {};
  const WRITE_ACTIONS = ['syncAll', 'incrementCompletion', 'syncConfig'];
  if (WRITE_ACTIONS.includes(action) && ADMIN_OPENIDS.length > 0 && !ADMIN_OPENIDS.includes(openid)) {
    return { code: -2, message: '无管理权限' };
  }

  try {
    const { scales, scale, scaleId } = event || {};

    switch (action) {
      case 'syncAll': {
        // 全量覆盖同步（后台编辑保存时调用）
        if (!Array.isArray(scales)) {
          return { code: -1, message: '参数错误：scales 必须是数组' };
        }
        if (scales.length > 200) {
          return { code: -1, message: 'scales 数量超限（最大200）' };
        }

        // 事务保护：先删后写，失败自动回滚
        const transaction = await db.startTransaction();
        try {
          // 删除旧数据
          const existing = await transaction.collection('scales').limit(100).get();
          for (const doc of existing.data) {
            await transaction.collection('scales').doc(doc._id).remove();
          }
          // 写入新数据
          for (const s of scales) {
            s._openid = openid;
            s.updatedAt = new Date().toISOString();
            await transaction.collection('scales').add({ data: s });
          }
          await transaction.commit();
          return { code: 0, message: '同步成功，共 ' + scales.length + ' 个量表' };
        } catch (txErr) {
          await transaction.rollback();
          throw txErr;
        }
      }

      case 'getOne': {
        // 获取单个量表（包括草稿/下架的，管理后台用）
        const doc = await db.collection('scales').where({ id: scaleId }).limit(1).get();
        return { code: 0, data: doc.data[0] || null };
      }

      case 'getAll': {
        // 获取所有量表（管理后台用，含草稿）
        const res = await db.collection('scales').orderBy('sortOrder', 'asc').limit(200).get();
        return { code: 0, data: res.data };
      }

      case 'incrementCompletion': {
        // 增加量表完成人次
        const doc = await db.collection('scales').where({ id: scaleId }).limit(1).get();
        if (doc.data.length > 0) {
          const current = doc.data[0];
          await db
            .collection('scales')
            .doc(current._id)
            .update({
              data: { completedCount: _.inc(1), updatedAt: new Date().toISOString() }
            });
        }
        return { code: 0 };
      }

      default:
        return { code: -1, message: '未知操作: ' + action };
    }
  } catch (err) {
    console.error('[data-sync] 错误:', err);
    return { code: -1, message: '操作失败: ' + err.message };
  }
};
