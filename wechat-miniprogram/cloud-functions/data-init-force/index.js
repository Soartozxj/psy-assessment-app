// 云函数：data-init-force（一次性使用）
// 把 scales.json 的完整数据硬编码在此，部署后调用一次即可
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 管理员 OpenID 列表（仅限管理员调用此函数）
const ADMIN_OPENIDS = ['oyORU3XImvO_rYAWBUTMNm89-3v0']

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 管理员权限验证（必须先检查，防止未授权全量覆盖）
  if (!ADMIN_OPENIDS.includes(openid)) {
    return { code: -2, message: '无管理权限：此操作仅限管理员' }
  }

  try {
    const { fileID } = event || {}
    
    if (!fileID) {
      // 方式1：直接传入 scales 数组
      const { scales } = event || {}
      if (!Array.isArray(scales)) {
        return { code: -1, message: '请传入 { fileID: "cloud://..." } 或 { scales: [...] }' }
      }
      return await doSync(scales)
    }
    
    // 方式2：从云存储读取 JSON 文件
    const fileContent = await cloud.downloadFile({ fileID })
    const scales = JSON.parse(fileContent.fileContent.toString('utf-8'))
    return await doSync(scales)
  } catch (err) {
    return { code: -1, message: '失败: ' + err.message }
  }
}

async function doSync(scales) {
  // 清空旧数据
  const existing = await db.collection('scales').limit(100).get()
  for (const doc of existing.data) {
    await db.collection('scales').doc(doc._id).remove()
  }
  // 写入新数据
  let count = 0
  for (const s of scales) {
    const data = { ...s }
    if (data._openid) delete data._openid
    if (data._id) delete data._id
    data.updatedAt = new Date().toISOString()
    await db.collection('scales').add({ data })
    count++
  }
  return { code: 0, message: '成功：写入 ' + count + ' 个量表' }
}
