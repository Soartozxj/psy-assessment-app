// 云函数：data-save
// 保存测评结果
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// record 允许写入的字段白名单
const ALLOWED_RECORD_FIELDS = [
  'id',
  'scaleId',
  'scaleName',
  'emoji',
  'color',
  'score',
  'displayTotalScore',
  'levelName',
  'level',
  'dims',
  'answers',
  'duration',
  'completedAt',
  'aiDiagText',
  'npcConfig'
];

// 字段长度限制
const FIELD_LIMITS = {
  scaleName: 100,
  aiDiagText: 10000
};

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    const { record } = event || {};
<<<<<<< Updated upstream
    if (!record || typeof record !== 'object') {
      return { code: -1, message: '参数错误' };
    }
=======
    if (!record || typeof record !== 'object') return { code: -1, message: '参数错误' };
>>>>>>> Stashed changes

    // 白名单过滤 + 长度限制
    const filteredRecord = {};
    for (const key of ALLOWED_RECORD_FIELDS) {
      if (record[key] !== undefined) {
        let val = record[key];
        if (typeof val === 'string' && FIELD_LIMITS[key]) {
          val = String(val).substring(0, FIELD_LIMITS[key]);
        }
        filteredRecord[key] = val;
      }
    }

    // 组装历史记录
    const historyRecord = {
      ...filteredRecord,
      _openid: openid,
      userId: openid,
      id: filteredRecord.id || Date.now(),
      createdAt: new Date().toISOString()
    };

    const res = await db.collection('history').add({ data: historyRecord });

    // 同时增加量表完成人次
    if (filteredRecord.scaleId) {
      const _ = db.command;
      const scaleDoc = await db.collection('scales').where({ id: filteredRecord.scaleId }).limit(1).get();
      if (scaleDoc.data.length > 0) {
        await db
          .collection('scales')
          .doc(scaleDoc.data[0]._id)
          .update({
            data: { completedCount: _.inc(1), updatedAt: new Date().toISOString() }
          });
      }
    }

    return {
      code: 0,
      data: { id: historyRecord.id, _id: res._id }
    };
  } catch (err) {
    console.error('[data-save] 错误:', err);
    return { code: -1, message: '保存失败: ' + err.message };
  }
};
