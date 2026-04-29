// 云函数：file-upload
// 上传/下载文件（图片素材管理）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { action, fileID, category } = event || {}

    switch (action) {
      case 'uploadUrl': {
        // 返回上传的 fileID，前端使用 wx.cloud.uploadFile
        const { fileId, name, type } = event
        // 验证 fileId 格式
        if (!fileId || typeof fileId !== 'string') return { code: -1, message: '缺少有效 fileId' }
        // 验证文件类型（仅允许图片）
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg']
        if (type && !ALLOWED_TYPES.includes(type)) {
          return { code: -1, message: '不支持的文件类型，仅支持 jpeg/png/gif/webp' }
        }
        // 验证 fileId 来源（必须是 cloud:// 开头的合法云存储路径）
        if (!/^cloud:\/\/[a-z0-9-]+\//.test(fileId)) {
          return { code: -1, message: '非法的 fileId 格式' }
        }
        const fileInfo = {
          _openid: openid,
          fileId,
          name: name || '未命名文件',
          type: type || 'image',
          category: category || 'general',
          createdAt: new Date().toISOString()
        }
        const res = await db.collection('files').add({ data: fileInfo })
        return { code: 0, data: { _id: res._id, fileId } }
      }

      case 'list': {
        // 列出某分类下的文件（只能看到自己上传的）
        const cat = category || 'general'
        const res = await db.collection('files')
          .where({ _openid: openid, category: cat })
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get()
        return { code: 0, data: res.data }
      }

      case 'delete': {
        // 删除文件（只能删除自己上传的）
        if (!fileID) return { code: -1, message: '缺少 fileID' }
        
        // 验证文件所有权
        const res = await db.collection('files')
          .where({ _openid: openid, fileId: fileID })
          .limit(1)
          .get()
        if (res.data.length === 0) {
          return { code: -2, message: '文件不存在或无权删除' }
        }
        
        // 删除云存储文件
        try {
          await cloud.deleteFile({ fileList: [fileID] })
        } catch (e) {
          console.warn('云存储删除失败（可能已不存在）:', e)
        }
        
        // 删除数据库记录
        await db.collection('files').doc(res.data[0]._id).remove()
        return { code: 0, message: '删除成功' }
      }

      default:
        return { code: -1, message: '未知操作: ' + action }
    }
  } catch (err) {
    console.error('[file-upload] 错误:', err)
    return { code: -1, message: '操作失败: ' + err.message }
  }
}
