// 临时云函数：获取当前调用者的 OpenID
// 使用完毕后可删除
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  // 打印到云函数日志
  console.log('========== 管理员 OpenID ==========');
  console.log('OPENID:', wxContext.OPENID);
  console.log('===================================');

  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID || '未绑定开放平台'
  };
};
