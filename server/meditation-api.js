/**
 * 星蓝心镜 - 冥想功能 API 路由
 * 
 * 功能：
 *   - 获取冥想音频列表
 *   - 记录播放开始
 *   - 记录冥想完成
 *   - 获取冥想统计
 *   - 获取冥想历史
 * 
 * 使用方式：
 *   const meditationApi = require('./meditation-api.js');
 *   meditationApi(app, authMiddleware, getPool, validationResult, body, param, query);
 */

module.exports = function(app, authMiddleware, getPool, validationResult, body, param, query) {
  // 内存存储（数据库不可用时的降级方案）
  const memoryAudios = [
    {
      id: 1,
      title: '深海冥想',
      description: '在深海般宁静中放松身心',
      category: 'relax',
      audio_url: 'https://example.com/meditation/deep-sea.mp3',
      duration: 600,
      cover_url: '/assets/images/meditation/deep-sea.jpg',
      play_count: 0,
      is_active: 1,
      sort_order: 1
    },
    {
      id: 2,
      title: '森林晨曦',
      description: '在森林晨曦中唤醒活力',
      category: 'focus',
      audio_url: 'https://example.com/meditation/forest-morning.mp3',
      duration: 900,
      cover_url: '/assets/images/meditation/forest.jpg',
      play_count: 0,
      is_active: 1,
      sort_order: 2
    },
    {
      id: 3,
      title: '星空入眠',
      description: '在星空下安然入睡',
      category: 'sleep',
      audio_url: 'https://example.com/meditation/starry-night.mp3',
      duration: 1200,
      cover_url: '/assets/images/meditation/starry.jpg',
      play_count: 0,
      is_active: 1,
      sort_order: 3
    }
  ];
  
  const memoryRecords = [];
  let memoryAudioId = 4;
  let memoryRecordId = 1;

  /**
   * 获取冥想音频列表
   * GET /api/meditation/audios?category=sleep
   */
  app.get('/api/meditation/audios', authMiddleware, [
    query('category').optional().isIn(['sleep', 'focus', 'relax', 'all'])
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ code: -1, message: '参数错误', errors: errors.array() });
    }

    const category = req.query.category || 'all';

    try {
      const db = await getPool();
      
      if (db) {
        let query = 'SELECT * FROM meditation_audios WHERE is_active = 1';
        const params = [];

        if (category !== 'all') {
          query += ' AND category = ?';
          params.push(category);
        }

        query += ' ORDER BY sort_order ASC, id ASC';

        const [audios] = await db.query(query, params);

        res.json({
          code: 0,
          data: {
            list: audios,
            total: audios.length
          }
        });
      } else {
        // 降级：使用内存存储
        let filteredAudios = memoryAudios.filter(a => a.is_active === 1);
        
        if (category !== 'all') {
          filteredAudios = filteredAudios.filter(a => a.category === category);
        }

        res.json({
          code: 0,
          data: {
            list: filteredAudios,
            total: filteredAudios.length
          }
        });
      }
    } catch (err) {
      console.error('[MEDITATION-AUDIOS] 错误:', err);
      
      // 数据库失败，降级到内存存储
      let filteredAudios = memoryAudios.filter(a => a.is_active === 1);
      
      if (category !== 'all') {
        filteredAudios = filteredAudios.filter(a => a.category === category);
      }

      res.json({
        code: 0,
        data: {
          list: filteredAudios,
          total: filteredAudios.length
        }
      });
    }
  });

  /**
   * 记录冥想开始
   * POST /api/meditation/start
   */
  app.post('/api/meditation/start', authMiddleware, [
    body('audio_id').isInt({ min: 1 })
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ code: -1, message: '参数错误', errors: errors.array() });
    }

    const { audio_id } = req.body;
    const openid = req.user.sub;

    try {
      const db = await getPool();
      
      if (db) {
        // 检查音频是否存在
        const [audios] = await db.query(
          'SELECT id FROM meditation_audios WHERE id = ? AND is_active = 1',
          [audio_id]
        );

        if (audios.length === 0) {
          return res.status(404).json({ code: -1, message: '音频不存在或未启用' });
        }

        // 创建冥想记录
        const [result] = await db.query(
          'INSERT INTO meditation_records (openid, audio_id, duration, completed) VALUES (?, ?, 0, 0)',
          [openid, audio_id]
        );

        res.json({
          code: 0,
          data: {
            recordId: result.insertId,
            message: '冥想开始记录成功'
          }
        });
      } else {
        // 降级：使用内存存储
        const audioExists = memoryAudios.some(a => a.id === parseInt(audio_id) && a.is_active === 1);
        
        if (!audioExists) {
          return res.status(404).json({ code: -1, message: '音频不存在或未启用' });
        }

        const newRecord = {
          id: memoryRecordId++,
          openid: openid,
          audio_id: parseInt(audio_id),
          duration: 0,
          completed: 0,
          created_at: new Date()
        };
        memoryRecords.push(newRecord);

        res.json({
          code: 0,
          data: {
            recordId: newRecord.id,
            message: '冥想开始记录成功（内存模式）'
          }
        });
      }
    } catch (err) {
      console.error('[MEDITATION-START] 错误:', err);
      
      // 数据库失败，降级到内存存储
      const audioExists = memoryAudios.some(a => a.id === parseInt(audio_id) && a.is_active === 1);
      
      if (!audioExists) {
        return res.status(404).json({ code: -1, message: '音频不存在或未启用' });
      }

      const newRecord = {
        id: memoryRecordId++,
        openid: openid,
        audio_id: parseInt(audio_id),
        duration: 0,
        completed: 0,
        created_at: new Date()
      };
      memoryRecords.push(newRecord);

      res.json({
        code: 0,
        data: {
          recordId: newRecord.id,
          message: '冥想开始记录成功（降级模式）'
        }
      });
    }
  });

  /**
   * 记录冥想完成
   * POST /api/meditation/complete
   */
  app.post('/api/meditation/complete', authMiddleware, [
    body('record_id').isInt({ min: 1 }),
    body('duration').isInt({ min: 0 })
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ code: -1, message: '参数错误', errors: errors.array() });
    }

    const { record_id, duration } = req.body;
    const openid = req.user.sub;

    try {
      const db = await getPool();
      
      if (db) {
        // 检查记录是否存在且属于当前用户
        const [records] = await db.query(
          'SELECT id FROM meditation_records WHERE id = ? AND openid = ?',
          [record_id, openid]
        );

        if (records.length === 0) {
          return res.status(404).json({ code: -1, message: '记录不存在或无权限' });
        }

        // 更新记录
        await db.query(
          'UPDATE meditation_records SET duration = ?, completed = 1 WHERE id = ?',
          [duration, record_id]
        );

        // 更新音频播放次数
        await db.query(
          'UPDATE meditation_audios SET play_count = play_count + 1 WHERE id = (SELECT audio_id FROM meditation_records WHERE id = ?)',
          [record_id]
        );

        res.json({
          code: 0,
          data: {
            message: '冥想完成记录成功'
          }
        });
      } else {
        // 降级：使用内存存储
        const record = memoryRecords.find(r => r.id === parseInt(record_id) && r.openid === openid);
        
        if (!record) {
          return res.status(404).json({ code: -1, message: '记录不存在或无权限' });
        }

        record.duration = duration;
        record.completed = 1;

        // 更新音频播放次数
        const audio = memoryAudios.find(a => a.id === record.audio_id);
        if (audio) {
          audio.play_count += 1;
        }

        res.json({
          code: 0,
          data: {
            message: '冥想完成记录成功（内存模式）'
          }
        });
      }
    } catch (err) {
      console.error('[MEDITATION-COMPLETE] 错误:', err);
      
      // 数据库失败，降级到内存存储
      const record = memoryRecords.find(r => r.id === parseInt(record_id) && r.openid === openid);
      
      if (!record) {
        return res.status(404).json({ code: -1, message: '记录不存在或无权限' });
      }

      record.duration = duration;
      record.completed = 1;

      // 更新音频播放次数
      const audio = memoryAudios.find(a => a.id === record.audio_id);
      if (audio) {
        audio.play_count += 1;
      }

      res.json({
        code: 0,
        data: {
          message: '冥想完成记录成功（降级模式）'
        }
      });
    }
  });

  /**
   * 获取冥想统计数据
   * GET /api/meditation/stats
   */
  app.get('/api/meditation/stats', authMiddleware, async (req, res) => {
    const openid = req.user.sub;

    try {
      const db = await getPool();
      
      if (db) {
        // 查询总冥想时长、次数
        const [summary] = await db.query(
          `SELECT 
            COUNT(*) as total_sessions,
            SUM(duration) as total_duration,
            SUM(completed) as completed_sessions,
            AVG(CASE WHEN completed = 1 THEN duration ELSE NULL END) as avg_duration
          FROM meditation_records 
          WHERE openid = ?`,
          [openid]
        );

        // 查询本周冥想次数
        const [weekStats] = await db.query(
          `SELECT 
            COUNT(*) as week_sessions,
            SUM(duration) as week_duration
          FROM meditation_records 
          WHERE openid = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
          [openid]
        );

        // 查询连续冥想天数
        const [streakResult] = await db.query(
          `SELECT COUNT(DISTINCT DATE(created_at)) as streak_days
          FROM meditation_records 
          WHERE openid = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          ORDER BY DATE(created_at) DESC`,
          [openid]
        );

        res.json({
          code: 0,
          data: {
            totalSessions: summary[0].total_sessions || 0,
            totalDuration: summary[0].total_duration || 0,
            completedSessions: summary[0].completed_sessions || 0,
            avgDuration: Math.round(summary[0].avg_duration || 0),
            weekSessions: weekStats[0].week_sessions || 0,
            weekDuration: weekStats[0].week_duration || 0,
            streakDays: streakResult[0].streak_days || 0
          }
        });
      } else {
        // 降级：使用内存存储计算统计
        const userRecords = memoryRecords.filter(r => r.openid === openid);
        const completedRecords = userRecords.filter(r => r.completed === 1);
        
        // 计算本周统计
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weekRecords = userRecords.filter(r => new Date(r.created_at) >= oneWeekAgo);
        const weekCompleted = weekRecords.filter(r => r.completed === 1);
        
        // 计算连续天数（简化版）
        const recentDates = userRecords
          .map(r => new Date(r.created_at).toISOString().split('T')[0])
          .filter((date, index, self) => self.indexOf(date) === index)
          .sort()
          .reverse()
          .slice(0, 7);
        
        let streakDays = 0;
        const today = new Date().toISOString().split('T')[0];
        for (let i = 0; i < recentDates.length; i++) {
          const expectedDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          if (recentDates[i] === expectedDate) {
            streakDays++;
          } else {
            break;
          }
        }

        res.json({
          code: 0,
          data: {
            totalSessions: userRecords.length,
            totalDuration: userRecords.reduce((sum, r) => sum + (r.duration || 0), 0),
            completedSessions: completedRecords.length,
            avgDuration: completedRecords.length > 0 
              ? Math.round(completedRecords.reduce((sum, r) => sum + r.duration, 0) / completedRecords.length)
              : 0,
            weekSessions: weekRecords.length,
            weekDuration: weekRecords.reduce((sum, r) => sum + (r.duration || 0), 0),
            streakDays: streakDays
          }
        });
      }
    } catch (err) {
      console.error('[MEDITATION-STATS] 错误:', err);
      
      // 数据库失败，降级到内存存储
      const userRecords = memoryRecords.filter(r => r.openid === openid);
      const completedRecords = userRecords.filter(r => r.completed === 1);
      
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weekRecords = userRecords.filter(r => new Date(r.created_at) >= oneWeekAgo);
      
      let streakDays = 0;
      const recentDates = userRecords
        .map(r => new Date(r.created_at).toISOString().split('T')[0])
        .filter((date, index, self) => self.indexOf(date) === index)
        .sort()
        .reverse()
        .slice(0, 7);
      
      for (let i = 0; i < recentDates.length; i++) {
        const expectedDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        if (recentDates[i] === expectedDate) {
          streakDays++;
        } else {
          break;
        }
      }

      res.json({
        code: 0,
        data: {
          totalSessions: userRecords.length,
          totalDuration: userRecords.reduce((sum, r) => sum + (r.duration || 0), 0),
          completedSessions: completedRecords.length,
          avgDuration: completedRecords.length > 0 
            ? Math.round(completedRecords.reduce((sum, r) => sum + r.duration, 0) / completedRecords.length)
            : 0,
          weekSessions: weekRecords.length,
          weekDuration: weekRecords.reduce((sum, r) => sum + (r.duration || 0), 0),
          streakDays: streakDays
        }
      });
    }
  });

  /**
   * 获取冥想历史记录
   * GET /api/meditation/history?page=1&pageSize=20
   */
  app.get('/api/meditation/history', authMiddleware, [
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
          'SELECT COUNT(*) as total FROM meditation_records WHERE openid = ?',
          [openid]
        );
        const total = countResult[0].total;

        // 查询列表（关联音频信息）
        const [records] = await db.query(
          `SELECT 
            mr.*,
            ma.title as audio_title,
            ma.category as audio_category,
            ma.duration as audio_duration
          FROM meditation_records mr
          LEFT JOIN meditation_audios ma ON mr.audio_id = ma.id
          WHERE mr.openid = ?
          ORDER BY mr.created_at DESC
          LIMIT ? OFFSET ?`,
          [openid, pageSize, offset]
        );

        res.json({
          code: 0,
          data: {
            list: records,
            total: total,
            page: page,
            pageSize: pageSize
          }
        });
      } else {
        // 降级：使用内存存储
        const userRecords = memoryRecords
          .filter(r => r.openid === openid)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        const total = userRecords.length;
        const list = userRecords.slice(offset, offset + pageSize).map(record => {
          const audio = memoryAudios.find(a => a.id === record.audio_id);
          return {
            ...record,
            audio_title: audio ? audio.title : '未知音频',
            audio_category: audio ? audio.category : '',
            audio_duration: audio ? audio.duration : 0
          };
        });

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
      console.error('[MEDITATION-HISTORY] 错误:', err);
      
      // 数据库失败，降级到内存存储
      const userRecords = memoryRecords
        .filter(r => r.openid === openid)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      const total = userRecords.length;
      const list = userRecords.slice(offset, offset + pageSize).map(record => {
        const audio = memoryAudios.find(a => a.id === record.audio_id);
        return {
          ...record,
          audio_title: audio ? audio.title : '未知音频',
          audio_category: audio ? audio.category : '',
          audio_duration: audio ? audio.duration : 0
        };
      });

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

  console.log('[MEDITATION-API] 冥想功能API已加载');
};
