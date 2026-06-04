/**
 * 星蓝心镜 - 情绪日记 API 路由
 * 
 * 功能：
 *   - 创建情绪日记
 *   - 获取日记列表
 *   - 删除日记
 *   - 获取情绪统计
 * 
 * 使用方式：
 *   const diaryApi = require('./diary-api.js');
 *   diaryApi(app, authMiddleware, getPool, validationResult, body, param, query);
 */

module.exports = function(app, authMiddleware, getPool, validationResult, body, param, query) {
  // 内存存储（数据库不可用时的降级方案）
  const memoryDiary = [];
  let memoryId = 1;

  /**
   * 创建情绪日记
   * POST /api/diary
   */
  app.post('/api/diary', authMiddleware, [
    body('mood_score').isInt({ min: 1, max: 5 }),
    body('mood_emoji').optional(),
    body('content').optional(),
    body('related_assessment_id').optional()
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ code: -1, message: '参数错误', errors: errors.array() });
    }

    const { mood_score, mood_emoji, content, related_assessment_id } = req.body;
    const openid = req.user.sub;

    try {
      const db = await getPool();
      
      // 尝试使用数据库
      if (db) {
        const [result] = await db.query(
          'INSERT INTO diary_entries (openid, mood_score, mood_emoji, content, related_assessment_id) VALUES (?, ?, ?, ?, ?)',
          [openid, mood_score, mood_emoji || '', content || null, related_assessment_id || null]
        );

        res.json({
          code: 0,
          data: {
            id: result.insertId,
            message: '日记记录成功'
          }
        });
      } else {
        // 降级：使用内存存储
        const newEntry = {
          id: memoryId++,
          openid: openid,
          mood_score: mood_score,
          mood_emoji: mood_emoji || '',
          content: content || null,
          related_assessment_id: related_assessment_id || null,
          created_at: new Date(),
          updated_at: new Date()
        };
        memoryDiary.push(newEntry);

        res.json({
          code: 0,
          data: {
            id: newEntry.id,
            message: '日记记录成功（内存模式）'
          }
        });
      }
    } catch (err) {
      console.error('[DIARY-CREATE] 错误:', err);
      
      // 数据库失败，降级到内存存储
      const newEntry = {
        id: memoryId++,
        openid: openid,
        mood_score: mood_score,
        mood_emoji: mood_emoji || '',
        content: content || null,
        related_assessment_id: related_assessment_id || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      memoryDiary.push(newEntry);

      res.json({
        code: 0,
        data: {
          id: newEntry.id,
          message: '日记记录成功（降级模式）'
        }
      });
    }
  });

  /**
   * 获取情绪日记列表
   * GET /api/diary?page=1&pageSize=20
   */
  app.get('/api/diary', authMiddleware, [
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 })
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ code: -1, message: '参数错误', errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;
    const openid = req.user.sub;

    try {
      const db = await getPool();
      
      if (db) {
        // 查询总数
        const [countResult] = await db.query(
          'SELECT COUNT(*) as total FROM diary_entries WHERE openid = ?',
          [openid]
        );
        const total = countResult[0].total;

        // 查询列表
        const [entries] = await db.query(
          'SELECT * FROM diary_entries WHERE openid = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
          [openid, pageSize, offset]
        );

        res.json({
          code: 0,
          data: {
            list: entries,
            total: total,
            page: page,
            pageSize: pageSize
          }
        });
      } else {
        // 降级：使用内存存储
        const userEntries = memoryDiary.filter(e => e.openid === openid);
        const total = userEntries.length;
        const list = userEntries.slice(offset, offset + pageSize);

        res.json({
          code: 0,
          data: {
            list: list,
            total: total,
            page: page,
            pageSize: pageSize
          }
        });
      }
    } catch (err) {
      console.error('[DIARY-LIST] 错误:', err);
      
      // 降级：使用内存存储
      const userEntries = memoryDiary.filter(e => e.openid === openid);
      const total = userEntries.length;
      const list = userEntries.slice(offset, offset + pageSize);

      res.json({
        code: 0,
        data: {
          list: list,
          total: total,
          page: page,
          pageSize: pageSize
        }
      });
    }
  });

  /**
   * 删除情绪日记
   * DELETE /api/diary/:id
   */
  app.delete('/api/diary/:id', authMiddleware, [
    param('id').isInt({ min: 1 })
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ code: -1, message: '参数错误', errors: errors.array() });
    }

    const entryId = parseInt(req.params.id);
    const openid = req.user.sub;

    try {
      const db = await getPool();
      
      // 尝试使用数据库
      if (db) {
        // 检查权限（只能删除自己的日记）
        const [entries] = await db.query(
          'SELECT id FROM diary_entries WHERE id = ? AND openid = ?',
          [entryId, openid]
        );

        if (entries.length === 0) {
          return res.status(404).json({ code: -1, message: '日记不存在或无权限删除' });
        }

        // 删除
        await db.query('DELETE FROM diary_entries WHERE id = ?', [entryId]);

        res.json({
          code: 0,
          data: { message: '删除成功' }
        });
      } else {
        // 降级：从内存中删除
        const index = memoryDiary.findIndex(e => e.id === entryId && e.openid === openid);
        if (index === -1) {
          return res.status(404).json({ code: -1, message: '日记不存在或无权限删除' });
        }
        memoryDiary.splice(index, 1);

        res.json({
          code: 0,
          data: { message: '删除成功（内存模式）' }
        });
      }
    } catch (err) {
      console.error('[DIARY-DELETE] 错误:', err);
      
      // 数据库失败，降级到内存存储
      const index = memoryDiary.findIndex(e => e.id === entryId && e.openid === openid);
      if (index === -1) {
        return res.status(404).json({ code: -1, message: '日记不存在或无权限删除' });
      }
      memoryDiary.splice(index, 1);

      res.json({
        code: 0,
        data: { message: '删除成功（降级模式）' }
      });
    }
  });

  /**
   * 获取情绪统计数据
   * GET /api/diary/stats?period=week
   */
  app.get('/api/diary/stats', authMiddleware, [
    query('period').optional().isIn(['week', 'month', 'year'])
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ code: -1, message: '参数错误', errors: errors.array() });
    }

    const period = req.query.period || 'week';
    const openid = req.user.sub;

    // 计算时间范围
    const now = new Date();
    let startDate;
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    try {
      const db = await getPool();
      
      if (db) {
        // 查询统计数据
        const [stats] = await db.query(
          `SELECT 
            DATE(created_at) as date,
            AVG(mood_score) as avg_mood,
            COUNT(*) as count
          FROM diary_entries 
          WHERE openid = ? AND created_at >= ?
          GROUP BY DATE(created_at)
          ORDER BY date ASC`,
          [openid, startDate]
        );

        // 查询总体统计
        const [summary] = await db.query(
          `SELECT 
            AVG(mood_score) as avg_mood,
            MIN(mood_score) as min_mood,
            MAX(mood_score) as max_mood,
            COUNT(*) as total_entries
          FROM diary_entries 
          WHERE openid = ? AND created_at >= ?`,
          [openid, startDate]
        );

        res.json({
          code: 0,
          data: {
            period: period,
            stats: stats,
            summary: summary[0] || {}
          }
        });
      } else {
        // 降级：使用内存存储计算统计
        const userEntries = memoryDiary.filter(e => 
          e.openid === openid && new Date(e.created_at) >= startDate
        );

        // 按日期分组
        const dateGroups = {};
        userEntries.forEach(entry => {
          const date = new Date(entry.created_at).toISOString().split('T')[0];
          if (!dateGroups[date]) {
            dateGroups[date] = [];
          }
          dateGroups[date].push(entry.mood_score);
        });

        const stats = Object.keys(dateGroups).map(date => {
          const scores = dateGroups[date];
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          return {
            date: date,
            avg_mood: avg,
            count: scores.length
          };
        });

        stats.sort((a, b) => a.date.localeCompare(b.date));

        // 计算总体统计
        let avgMood = 0;
        let minMood = 5;
        let maxMood = 1;
        if (userEntries.length > 0) {
          const scores = userEntries.map(e => e.mood_score);
          avgMood = scores.reduce((a, b) => a + b, 0) / scores.length;
          minMood = Math.min(...scores);
          maxMood = Math.max(...scores);
        }

        res.json({
          code: 0,
          data: {
            period: period,
            stats: stats,
            summary: {
              avg_mood: avgMood,
              min_mood: minMood,
              max_mood: maxMood,
              total_entries: userEntries.length
            }
          }
        });
      }
    } catch (err) {
      console.error('[DIARY-STATS] 错误:', err);
      
      // 降级：返回空统计
      res.json({
        code: 0,
        data: {
          period: period,
          stats: [],
          summary: {}
        }
      });
    }
  });

  console.log('[DIARY-API] 情绪日记API已加载');
};
