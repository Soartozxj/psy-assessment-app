// 云函数：data-user
// 用户档案读写
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// profile 允许写入的字段白名单
const ALLOWED_PROFILE_FIELDS = ['nickname', 'avatar', 'phone', 'gender', 'birthday', 'bio'];

// 字段长度限制（防止写入超长数据）
const FIELD_LIMITS = {
  nickname: 50,
  avatar: 500,
  phone: 20,
  bio: 500
};

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    const { action, profile } = event || {};

    switch (action) {
      case 'get': {
        const res = await db.collection('users').where({ _openid: openid }).limit(1).get();

        if (res.data.length > 0) {
          return { code: 0, data: res.data[0] };
        }

        // 自动创建默认档案
        const defaultProfile = {
          _openid: openid,
          userId: openid,
          nickname: '微信用户',
          avatar: '',
          phone: '',
          gender: 0,
          birthday: '',
          createdAt: new Date().toISOString()
        };
        await db.collection('users').add({ data: defaultProfile });
        return { code: 0, data: defaultProfile };
      }

      case 'save': {
        if (!profile || typeof profile !== 'object') {
          return { code: -1, message: '参数错误' };
        }

        // 白名单过滤 + 长度限制
        const filteredProfile = {};
        for (const key of ALLOWED_PROFILE_FIELDS) {
          if (profile[key] !== undefined) {
            let val = profile[key];
            if (typeof val === 'string' && FIELD_LIMITS[key]) {
              val = String(val).substring(0, FIELD_LIMITS[key]);
            }
            filteredProfile[key] = val;
          }
        }

        const existing = await db.collection('users').where({ _openid: openid }).limit(1).get();

        const updateData = {
          ...filteredProfile,
          _openid: openid,
          userId: openid,
          updatedAt: new Date().toISOString()
        };

        if (existing.data.length > 0) {
          await db.collection('users').doc(existing.data[0]._id).update({
            data: updateData
          });
        } else {
          updateData.createdAt = new Date().toISOString();
          await db.collection('users').add({ data: updateData });
        }

        return { code: 0, message: '保存成功' };
      }

      default:
        return { code: -1, message: '未知操作: ' + action };
    }
  } catch (err) {
    console.error('[data-user] 错误:', err);
    return { code: -1, message: '操作失败: ' + err.message };
  }
};
