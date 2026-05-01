/**
 * 星蓝心镜系统 - 共享数据管理模块 v2.0
 * 用于确保前后端数据一致性
 * 
 * v2.0 改动（阶段三 - 云端适配）：
 *   - 新增 initAsync()：云端模式下先从 CloudData 异步拉取数据，再初始化本地
 *   - saveHistory / incrementScaleCompletion / deleteHistory：云端模式下异步同步到云端
 *   - syncToFrontend()：云端模式下同时触发 CloudData.syncScales()
 *   - 本地模式完全兼容，行为不变
 */

(function() {
    'use strict';
    
    // ====================================================
    // 数据存储键定义
    // ====================================================
    const STORAGE_KEYS = {
        SCALES_DATA: 'psy_scales_data',        // 完整的量表数据（所有量表）
        SCALES_SYNC: 'psy_scales_synced',      // 已同步到前端的数据
        HISTORY_DATA: 'psy_assessment_history', // 用户测评历史
        USER_PROFILE: 'psy_user_profile',       // 用户个人信息
        SETTINGS: 'psy_settings'               // 系统设置
    };

    /**
     * 检测是否在云端模式
     */
    function _isCloud() {
        return window.CloudEnv && window.CloudEnv.isCloud;
    }
    
    // ====================================================
    // 默认量表数据（构建时从 scales-data.json 自动注入）
    // 如需更新：后台导出 JSON → 放到 scales-data.json → 重新构建
    // ====================================================
    const DEFAULT_SCALES = __BUNDLED_SCALES__;
    
    // ====================================================
    // 默认 AI 配置（构建时注入 API Key）
    // 本地开发：直接写在这里测试
    // 构建部署：通过 build-deploy.py 将配置文件内容注入
    // ====================================================
    // @BUNDLED_AI_CONFIG_START
    const DEFAULT_AI_CONFIG = {"provider":"dashscope","dashscope":{"apiKey":"","model":"qwen-plus"},"ollama":{"baseUrl":"http://localhost:11434","model":"qwen2.5:7b"}};
    // @BUNDLED_AI_CONFIG_END

    // ====================================================
    // 分类映射（与后端保持一致）
    // ====================================================
    const CATEGORY_MAP = {
        anxiety: { name: '焦虑评估', color: '#F5A623', icon: '😰' },
        depression: { name: '抑郁评估', color: '#5B8DEF', icon: '😔' },
        personality: { name: '人格测试', color: '#7ED321', icon: '🧠' },
        comprehensive: { name: '综合评估', color: '#4A90D9', icon: '🧬' },
        stress: { name: '压力自评', color: '#D0021B', icon: '😣' }
    };
    
    // ====================================================
    // 共享数据管理器
    // ====================================================
    window.SharedData = {
        /**
         * 同步初始化（兼容旧代码）
         * 本地模式：直接从 localStorage 初始化
         * 云端模式：先用 localStorage 缓存数据（后续由 initAsync 更新）
         */
        init: function() {
            // 始终用 DEFAULT_SCALES（构建时注入，保证含最新字段如 npcConfig）覆盖 localStorage 缓存
            // 旧缓存可能缺少新字段，导致 NPC 场景等功能异常
            var cached = this.loadScalesData();
            if (!cached || !DEFAULT_SCALES || DEFAULT_SCALES.length === 0) {
                this.saveScalesData(DEFAULT_SCALES);
                this.syncToFrontend();
            } else {
                // 检查缓存中的量表是否缺少 npcConfig 或 aiDiag（旧版本缓存）
                var needsUpdate = cached.some(function(s) { return !s.npcConfig; });
                if (!needsUpdate) {
                    needsUpdate = cached.some(function(s) {
                        var def = DEFAULT_SCALES.find(function(d) { return d.id === s.id; });
                        return def && def.aiDiag && def.aiDiag.prompt && (!s.aiDiag || !s.aiDiag.prompt);
                    });
                }
                // 检查缓存数量是否少于内置（新增量表场景）
                if (!needsUpdate && cached.length < DEFAULT_SCALES.length) {
                    needsUpdate = true;
                    console.log('[SharedData] 缓存量表(' + cached.length + ')少于内置(' + DEFAULT_SCALES.length + ')，强制更新');
                }
                if (needsUpdate && DEFAULT_SCALES.some(function(s) { return s.npcConfig || DEFAULT_SCALES.length > cached.length; })) {
                    console.log('[SharedData] 检测到旧缓存（缺少 npcConfig），强制更新为 DEFAULT_SCALES');
                    this.saveScalesData(DEFAULT_SCALES);
                    this.syncToFrontend();
                }
            }
            console.log('SharedData 初始化完成，共 ' + this.getActiveScales().length + ' 个量表');
        },

        /**
         * 异步初始化（云端模式下从 CloudData 拉取最新数据）
         * 建议在页面加载时调用此方法获取最新数据
         * @returns {Promise<Array>} 量表列表
         */
        initAsync: function() {
            if (!_isCloud() || !window.CloudData) {
                // 本地模式，直接返回
                this.init();
                return Promise.resolve(this.getActiveScales());
            }

            console.log('[SharedData] 异步初始化 - 从云端拉取最新数据...');
            return window.CloudData.ready().then(function(ok) {
                if (!ok) {
                    console.warn('[SharedData] 云端 SDK 未就绪，使用本地数据');
                    return window.SharedData.getActiveScales();
                }
                return window.CloudData.init();
            }).then(function(scales) {
                console.log('[SharedData] 异步初始化完成，共 ' + (scales ? scales.length : 0) + ' 个量表');
                return scales;
            }).catch(function(err) {
                console.warn('[SharedData] 异步初始化失败，回退本地:', err.message);
                return window.SharedData.getActiveScales();
            });
        },
        
        /**
         * 加载量表数据
         */
        loadScalesData: function() {
            try {
                const data = localStorage.getItem(STORAGE_KEYS.SCALES_DATA);
                if (data) {
                    const parsed = JSON.parse(data);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                }
            } catch (e) {
                console.error('加载量表数据失败:', e);
            }
            return null;
        },
        
        /**
         * 保存量表数据
         */
        saveScalesData: function(scales) {
            try {
                localStorage.setItem(STORAGE_KEYS.SCALES_DATA, JSON.stringify(scales));
                return true;
            } catch (e) {
                console.error('保存量表数据失败:', e);
                return false;
            }
        },
        
        /**
         * 同步数据到前端
         */
        syncToFrontend: function() {
            try {
                const scales = this.getActiveScales();
                localStorage.setItem(STORAGE_KEYS.SCALES_SYNC, JSON.stringify(scales));
                console.log('已同步 ' + scales.length + ' 个量表到前端');

                // 云端模式下，同时同步到云端
                if (_isCloud() && window.CloudData && window.CloudData.syncScales) {
                    var allScales = this.getAllScales();
                    window.CloudData.syncScales(allScales).catch(function(err) {
                        console.warn('[SharedData] 同步到云端失败:', err.message);
                    });
                }

                return true;
            } catch (e) {
                console.error('同步数据到前端失败:', e);
                return false;
            }
        },
        
        /**
         * 获取所有量表（包括草稿和已下架的）
         */
        getAllScales: function() {
            const data = this.loadScalesData();
            return data || DEFAULT_SCALES;
        },
        
        /**
         * 获取已上架的量表（前端可见的）
         */
        getActiveScales: function() {
            const allScales = this.getAllScales();
            return allScales.filter(scale => scale.status === 1 || scale.status === undefined);
        },
        
        /**
         * 根据ID获取量表
         */
        getScaleById: function(id) {
            const scales = this.getAllScales();
            return scales.find(scale => scale.id == id);
        },
        
        /**
         * 根据分类获取量表
         */
        getScalesByCategory: function(category) {
            const activeScales = this.getActiveScales();
            if (!category) return activeScales;
            return activeScales.filter(scale => scale.category === category);
        },
        
        /**
         * 搜索量表
         */
        searchScales: function(keyword) {
            const activeScales = this.getActiveScales();
            const kw = (keyword || '').toLowerCase();
            if (!kw) return activeScales;
            
            return activeScales.filter(scale => {
                const nameMatch = scale.name.toLowerCase().includes(kw);
                const descMatch = scale.desc.toLowerCase().includes(kw);
                const tagsMatch = scale.tags && scale.tags.some(tag => tag.toLowerCase().includes(kw));
                const codeMatch = (scale.code || '').toLowerCase().includes(kw);
                
                return nameMatch || descMatch || tagsMatch || codeMatch;
            });
        },
        
        /**
         * 获取分类信息
         */
        getCategoryInfo: function(category) {
            return CATEGORY_MAP[category] || { name: category, color: '#CCCCCC', icon: '📋' };
        },
        
        /**
         * 获取所有分类
         */
        getAllCategories: function() {
            return Object.keys(CATEGORY_MAP).map(key => ({
                id: key,
                name: CATEGORY_MAP[key].name,
                color: CATEGORY_MAP[key].color,
                icon: CATEGORY_MAP[key].icon
            }));
        },
        
        /**
         * 添加新量表
         */
        addScale: function(scaleData) {
            const scales = this.getAllScales();
            scaleData.id = Date.now(); // 使用时间戳作为ID
            scaleData.createdAt = new Date().toISOString();
            scaleData.updatedAt = new Date().toISOString();
            
            scales.push(scaleData);
            this.saveScalesData(scales);
            this.syncToFrontend();
            
            return scaleData;
        },
        
        /**
         * 更新量表
         */
        updateScale: function(id, scaleData) {
            const scales = this.getAllScales();
            const index = scales.findIndex(scale => scale.id == id);
            
            if (index !== -1) {
                scaleData.id = id;
                scaleData.updatedAt = new Date().toISOString();
                // 保留原有的一些字段
                scaleData.createdAt = scales[index].createdAt || new Date().toISOString();
                scaleData.completedCount = scales[index].completedCount || 0;
                scaleData.rating = scales[index].rating || 5.0;
                
                scales[index] = scaleData;
                this.saveScalesData(scales);
                this.syncToFrontend();
                
                return true;
            }
            
            return false;
        },
        
        /**
         * 删除量表
         */
        deleteScale: function(id) {
            const scales = this.getAllScales();
            const index = scales.findIndex(scale => scale.id == id);
            
            if (index !== -1) {
                scales.splice(index, 1);
                this.saveScalesData(scales);
                this.syncToFrontend();
                return true;
            }
            
            return false;
        },
        
        /**
         * 切换量表状态（上架/下架）
         */
        toggleScaleStatus: function(id) {
            const scales = this.getAllScales();
            const scale = scales.find(scale => scale.id == id);
            
            if (scale) {
                scale.status = scale.status === 1 ? 0 : 1;
                scale.updatedAt = new Date().toISOString();
                this.saveScalesData(scales);
                this.syncToFrontend();
                return true;
            }
            
            return false;
        },
        
        /**
         * 增加量表完成人次
         */
        incrementScaleCompletion: function(id) {
            const scales = this.getAllScales();
            const scale = scales.find(scale => scale.id == id);
            
            if (scale) {
                scale.completedCount = (scale.completedCount || 0) + 1;
                scale.updatedAt = new Date().toISOString();
                this.saveScalesData(scales);
                this.syncToFrontend();

                // 云端模式下，也异步通知云端（data-save 云函数已内置 incrementCompletion 逻辑）
                if (_isCloud() && window.CloudData && window.CloudData.incrementCompletion) {
                    window.CloudData.incrementCompletion(id);
                }

                return true;
            }
            
            return false;
        },
        
        /**
         * 获取统计信息
         */
        getStatistics: function() {
            const scales = this.getAllScales();
            const activeScales = scales.filter(scale => scale.status === 1);
            
            return {
                totalScales: scales.length,
                activeScales: activeScales.length,
                totalCompleted: scales.reduce((sum, scale) => sum + (scale.completedCount || 0), 0),
                avgRating: scales.length ? (scales.reduce((sum, scale) => sum + (parseFloat(scale.rating) || 0), 0) / scales.length).toFixed(1) : '0.0'
            };
        },
        
        /**
         * 获取测评历史（同步，从 localStorage）
         */
        getHistory: function() {
            try {
                const data = localStorage.getItem(STORAGE_KEYS.HISTORY_DATA);
                if (data) {
                    return JSON.parse(data);
                }
            } catch (e) {
                console.error('加载测评历史失败:', e);
            }
            return [];
        },

        /**
         * 异步获取测评历史（云端模式下从云端拉取）
         * @returns {Promise<{list: Array, total: number}>}
         */
        getHistoryAsync: function(page, pageSize) {
            if (!_isCloud() || !window.CloudData) {
                return Promise.resolve({ list: this.getHistory(), total: this.getHistory().length });
            }
            return window.CloudData.getHistory(page, pageSize);
        },
        
        /**
         * 保存测评历史
         */
        saveHistory: function(historyRecord) {
            try {
                const history = this.getHistory();
                historyRecord.id = Date.now();
                historyRecord.createdAt = new Date().toISOString();
                history.unshift(historyRecord);
                localStorage.setItem(STORAGE_KEYS.HISTORY_DATA, JSON.stringify(history));

                // 云端模式下，异步同步到云端
                if (_isCloud() && window.CloudData && window.CloudData.saveHistory) {
                    window.CloudData.saveHistory(historyRecord).catch(function(err) {
                        console.warn('[SharedData] 保存历史到云端失败:', err.message);
                    });
                }

                return historyRecord;
            } catch (e) {
                console.error('保存测评历史失败:', e);
                return null;
            }
        },
        
        /**
         * 删除测评历史
         */
        deleteHistory: function(id) {
            try {
                const history = this.getHistory();
                const index = history.findIndex(record => record.id == id);
                if (index !== -1) {
                    history.splice(index, 1);
                    localStorage.setItem(STORAGE_KEYS.HISTORY_DATA, JSON.stringify(history));

                    // 云端模式下，异步删除云端记录
                    if (_isCloud() && window.CloudData && window.CloudData.deleteHistory) {
                        window.CloudData.deleteHistory(id).catch(function(err) {
                            console.warn('[SharedData] 删除云端历史失败:', err.message);
                        });
                    }

                    return true;
                }
            } catch (e) {
                console.error('删除测评历史失败:', e);
            }
            return false;
        },

        /**
         * 更新测评历史（局部更新指定字段）
         * @param {number} id - 记录 ID
         * @param {object} updates - 需要更新的字段
         * @returns {object|null} 更新后的记录，失败返回 null
         */
        updateHistory: function(id, updates) {
            try {
                const history = this.getHistory();
                const index = history.findIndex(record => record.id == id);
                if (index !== -1) {
                    Object.assign(history[index], updates);
                    localStorage.setItem(STORAGE_KEYS.HISTORY_DATA, JSON.stringify(history));
                    return history[index];
                }
            } catch (e) {
                console.error('更新测评历史失败:', e);
            }
            return null;
        },

        /**
         * 获取用户信息（同步，从 localStorage）
         */
        getUserProfile: function() {
            try {
                const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
                if (data) {
                    return JSON.parse(data);
                }
            } catch (e) {
                console.error('加载用户信息失败:', e);
            }
            return { nickname: '体验用户', userId: 'demo_001' };
        },

        /**
         * 异步获取用户信息（云端模式下从云端拉取）
         * @returns {Promise<object>}
         */
        getUserProfileAsync: function() {
            if (!_isCloud() || !window.CloudData) {
                return Promise.resolve(this.getUserProfile());
            }
            return window.CloudData.getUserProfile();
        },
        
        /**
         * 保存用户信息
         */
        saveUserProfile: function(profile) {
            try {
                localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
                return true;
            } catch (e) {
                console.error('保存用户信息失败:', e);
                return false;
            }
        },
        
        /**
         * 导出数据
         */
        exportData: function() {
            const data = {
                scales: this.getAllScales(),
                history: this.getHistory(),
                userProfile: this.getUserProfile(),
                exportDate: new Date().toISOString(),
                version: '1.0.0'
            };
            
            return {
                filename: `psy_assessment_export_${new Date().toISOString().slice(0, 10)}.json`,
                data: JSON.stringify(data, null, 2)
            };
        },
        
        /**
         * 导入数据
         */
        importData: function(jsonData) {
            try {
                const data = JSON.parse(jsonData);
                
                if (data.scales && Array.isArray(data.scales)) {
                    this.saveScalesData(data.scales);
                }
                
                if (data.history && Array.isArray(data.history)) {
                    localStorage.setItem(STORAGE_KEYS.HISTORY_DATA, JSON.stringify(data.history));
                }
                
                if (data.userProfile) {
                    this.saveUserProfile(data.userProfile);
                }
                
                this.syncToFrontend();
                return true;
            } catch (e) {
                console.error('导入数据失败:', e);
                return false;
            }
        },
        
        /**
         * 重置为默认数据
         */
        resetToDefault: function() {
            this.saveScalesData(DEFAULT_SCALES);
            localStorage.removeItem(STORAGE_KEYS.HISTORY_DATA);
            localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
            this.syncToFrontend();
            return true;
        },
        
        /**
         * 监听数据变化
         */
        addDataChangeListener: function(callback) {
            window.addEventListener('storage', function(e) {
                if (e.key && e.key.startsWith('psy_')) {
                    callback(e.key);
                }
            });
        },

        /**
         * 获取 AI 配置（仅 provider/model，不含 apiKey）
         * @returns {object} { provider, dashscope: { model }, ollama: {...} }
         */
        getAiConfig: function() {
            if (DEFAULT_AI_CONFIG && DEFAULT_AI_CONFIG.provider) {
                return DEFAULT_AI_CONFIG;
            }
            return null;
        },

        // ====================================================
        // 评价反馈数据管理
        // ====================================================

        /**
         * 获取全部评价（同步，从 localStorage）
         * @returns {Array} 评价列表
         */
        getFeedbackList: function() {
            try {
                var data = localStorage.getItem('psy_feedback_list');
                if (data) return JSON.parse(data);
            } catch (e) {
                console.error('加载评价列表失败:', e);
            }
            return [];
        },

        /**
         * 保存评价（新增）
         * @param {object} feedback - { stars, tags, text, source, scaleId, scaleName, recordId }
         * @returns {object} 保存后的评价记录
         */
        saveFeedback: function(feedback) {
            try {
                var list = this.getFeedbackList();
                var profile = this.getUserProfile();
                feedback.id = Date.now();
                feedback.nickname = (profile && profile.nickname) || '体验用户';
                feedback.userId = (profile && profile.userId) || '';
                feedback.createdAt = new Date().toISOString();
                list.unshift(feedback);
                localStorage.setItem('psy_feedback_list', JSON.stringify(list));
                return feedback;
            } catch (e) {
                console.error('保存评价失败:', e);
                return null;
            }
        },

        /**
         * 删除评价
         * @param {number} id - 评价 ID
         * @returns {boolean}
         */
        deleteFeedback: function(id) {
            try {
                var list = this.getFeedbackList();
                var idx = list.findIndex(function(f) { return f.id === id; });
                if (idx !== -1) {
                    list.splice(idx, 1);
                    localStorage.setItem('psy_feedback_list', JSON.stringify(list));
                    return true;
                }
            } catch (e) {
                console.error('删除评价失败:', e);
            }
            return false;
        },

        /**
         * 查询某条测评记录是否已评价
         * @param {string} recordId - 测评记录 ID
         * @returns {object|null} 已有评价，未评价返回 null
         */
        getFeedbackByRecordId: function(recordId) {
            var list = this.getFeedbackList();
            return list.find(function(f) { return f.recordId == recordId; }) || null;
        },

        /**
         * 查询某条测评记录在指定场景是否已评价（v3 双维度）
         * 场景区分：'result' = 测评报告（计分结果），'diag' = 测评详情报告（AI诊断）
         * @param {string} recordId - 测评记录 ID
         * @param {string} scene - 'result' | 'diag'
         * @returns {object|null} 已有评价，未评价返回 null
         */
        getFeedbackByRecordAndScene: function(recordId, scene) {
            var list = this.getFeedbackList();
            return list.find(function(f) { return f.recordId == recordId && f.source === scene; }) || null;
        },

        /**
         * 查询某条测评记录是否已评价（布尔版，兼容旧逻辑）
         * @param {string} recordId
         * @returns {boolean}
         */
        hasFeedbackForRecord: function(recordId) {
            return !!this.getFeedbackByRecordId(recordId);
        },

        /**
         * 查询某条测评记录在指定场景是否已评价（布尔版）
         * @param {string} recordId
         * @param {string} scene - 'result' | 'diag'
         * @returns {boolean}
         */
        hasFeedbackForRecordScene: function(recordId, scene) {
            return !!this.getFeedbackByRecordAndScene(recordId, scene);
        },

        // ===== 评价标签配置 =====
        FB_TAG_MAX_LEN: 8,   // 单个标签最大字数（中文）
        FB_TAG_MAX_COUNT: 15, // 每个类型（good/neutral/bad）最多标签数
        // ★ v2 按评价类型分组：good(4-5星) / neutral(3星) / bad(1-2星)
        FB_DEFAULT_TAGS: {
            mine: {
                good: ['界面美观', '方便快捷', '专业靠谱', '内容丰富', '操作流畅', '值得推荐'],
                neutral: ['中规中矩', '有待改善', '体验一般'],
                bad: ['加载较慢', '功能不足', '界面难看', '操作复杂']
            },
            result: {
                good: ['题目清晰', '报告详细', '等级准确', '有帮助', '建议实用'],
                neutral: ['中规中矩', '题目偏多', '有待改善'],
                bad: ['题目难懂', '结果不准', '等级偏差', '加载太慢']
            },
            diag: {
                good: ['分析透彻', '建议有用', '切合实际', '温暖贴心', '专业可信'],
                neutral: ['中规中矩', '有些泛泛', '有待改善'],
                bad: ['分析空洞', '建议不实', '与感受不符', '不够专业']
            },
            history: {
                good: ['题目清晰', '报告详细', 'AI分析准', '有帮助', '建议实用'],
                neutral: ['中规中矩', '有待改善'],
                bad: ['题目难懂', '结果不准', '体验较差']
            }
        },
        // 旧版默认标签（向后兼容降级用）
        FB_DEFAULT_TAGS_MINE: ['界面美观', '方便快捷', '专业靠谱', '内容丰富', 'AI报告好', '咨询师亲切', '值得推荐', '需要改进'],
        FB_DEFAULT_TAGS_RESULT: ['题目清晰', '报告详细', 'AI分析准', '有帮助', '建议实用', '值得推荐'],
        FB_DEFAULT_TAGS_HISTORY: ['题目清晰', '报告详细', 'AI分析准', '有帮助', '建议实用'],

        /**
         * 星级 → 评价类型映射
         * @param {number} stars - 1~5
         * @returns {string} 'good' | 'neutral' | 'bad'
         */
        fbStarToType: function(stars) {
            if (stars >= 4) return 'good';
            if (stars >= 3) return 'neutral';
            return 'bad';
        },

        /**
         * 获取评价标签配置（所有场景）
         * ★ v2 返回按类型分组的结构 { mine: { good:[], neutral:[], bad:[] }, ... }
         * 自动将旧版扁平数组结构迁移为分组结构
         * @returns {object}
         */
        getFeedbackTagConfig: function() {
            try {
                var data = localStorage.getItem('psy_feedback_tag_config');
                if (data) {
                    var cfg = JSON.parse(data);
                    // 检测是否为旧版扁平结构（mine 是数组而非对象）
                    if (Array.isArray(cfg.mine)) {
                        // 迁移旧版：将扁平数组作为 good 标签
                        var migrated = {};
                        ['mine', 'result', 'diag', 'history'].forEach(function(scene) {
                            var oldArr = Array.isArray(cfg[scene]) ? cfg[scene] : [];
                            migrated[scene] = {
                                good: oldArr.slice(),
                                neutral: [],
                                bad: []
                            };
                        });
                        // 保存迁移后的结构
                        localStorage.setItem('psy_feedback_tag_config', JSON.stringify(migrated));
                        return migrated;
                    }
                    // v2 结构：确保每个场景都有 good/neutral/bad
                    ['mine', 'result', 'diag', 'history'].forEach(function(scene) {
                        if (!cfg[scene] || typeof cfg[scene] !== 'object') {
                            cfg[scene] = { good: [], neutral: [], bad: [] };
                        }
                        ['good', 'neutral', 'bad'].forEach(function(type) {
                            if (!Array.isArray(cfg[scene][type])) cfg[scene][type] = [];
                        });
                    });
                    return cfg;
                }
            } catch (e) { /* 降级到默认 */ }
            // 返回 v2 默认值
            return JSON.parse(JSON.stringify(this.FB_DEFAULT_TAGS));
        },

        /**
         * 获取指定场景+类型的标签
         * @param {string} scene - 'mine' | 'result' | 'history'
         * @param {string} type - 'good' | 'neutral' | 'bad'
         * @returns {string[]}
         */
        getFeedbackTags: function(scene, type) {
            var cfg = this.getFeedbackTagConfig();
            if (cfg[scene] && Array.isArray(cfg[scene][type])) {
                return cfg[scene][type];
            }
            return [];
        },

        /**
         * 保存评价标签配置
         * @param {object} config - { mine: { good:[], neutral:[], bad:[] }, result: {...}, history: {...} }
         * @returns {object} 保存后的配置
         */
        saveFeedbackTagConfig: function(config) {
            var self = this;
            ['mine', 'result', 'diag', 'history'].forEach(function(scene) {
                if (!config[scene] || typeof config[scene] !== 'object') {
                    config[scene] = JSON.parse(JSON.stringify(self.FB_DEFAULT_TAGS[scene]));
                }
                ['good', 'neutral', 'bad'].forEach(function(type) {
                    if (!Array.isArray(config[scene][type])) {
                        config[scene][type] = [];
                    }
                    config[scene][type] = config[scene][type].filter(function(t) {
                        return typeof t === 'string' && t.trim().length > 0;
                    }).map(function(t) {
                        var s = t.trim();
                        return s.length > self.FB_TAG_MAX_LEN ? s.substring(0, self.FB_TAG_MAX_LEN) : s;
                    });
                    // 去重
                    config[scene][type] = config[scene][type].filter(function(v, i, a) { return a.indexOf(v) === i; });
                    // 数量限制
                    if (config[scene][type].length > self.FB_TAG_MAX_COUNT) {
                        config[scene][type] = config[scene][type].slice(0, self.FB_TAG_MAX_COUNT);
                    }
                });
            });
            localStorage.setItem('psy_feedback_tag_config', JSON.stringify(config));
            return config;
        },

        /**
         * 重置评价标签为默认值
         * @returns {object} 默认配置
         */
        resetFeedbackTagConfig: function() {
            var def = JSON.parse(JSON.stringify(this.FB_DEFAULT_TAGS));
            localStorage.setItem('psy_feedback_tag_config', JSON.stringify(def));
            return def;
        }
    };
    
    // 暴露 DEFAULT_SCALES 到全局（后台 admin-legacy.html 的 loadScales() 需要引用）
    window.DEFAULT_SCALES = DEFAULT_SCALES;
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            window.SharedData.init();
        });
    } else {
        window.SharedData.init();
    }
    
})();