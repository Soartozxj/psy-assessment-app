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
    // 本地开发：admin-legacy.html 通过内联脚本定义 window.BUNDLED_SCALES 数据
    // ====================================================
    const DEFAULT_SCALES = [{"name": "父母共同教养关系感知量表", "shortName": "PPCRS", "code": "PPCRS", "category": "bond", "categoryName": "家庭与人际关系量表", "emoji": "👨‍👩‍👧", "color": "#e2e52e", "duration": 7, "questionTime": 30, "questionCount": 14, "applicablePeople": "", "desc": "在国内外，越来越多的研究和临床实践开始重视家庭因素对个体的影响作用，尤其是精神分裂症患者的家庭。与西方国家相比，中国绝大多数精神病患者和家属生活在一起，与家属接触时间比西方国家多，所以在中国家庭因素对精神疾病的致病作用及患病成员对家庭的影响也会比西方国家大。但在中国治疗精神病的过程中，大多数家庭因素评估通常仅限于了解家族精神病病史，而没有详细了解中国精神病患者家庭结构特点等信息。因此，为了了解精神病患者家庭因素的实质，便于开展以预防和康复为目的的家庭咨询和治疗，一个能够测量出家庭内部结构和功能又方便易行的工具显得很有意义。", "instruction": "", "notice": ["请根据您过去一周的真实感受作答"], "tags": ["家庭教育", "关系评估"], "status": 1, "sortOrder": 1, "rating": 5, "npcConfig": {"counselorId": "", "backgroundId": ""}, "questions": [{"id": 1, "content": "在我管教孩子的时候，我的伴侣表示支持我", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:开始阶段"}, {"id": 2, "content": "我的伴侣和我争夺孩子的注意力", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:开始阶段"}, {"id": 3, "content": "当我的伴侣不认同我对待孩子的方式时，他/她能够平静地和我讨论", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:开始阶段"}, {"id": 4, "content": "当我想让伴侣帮忙让孩子睡觉时，他/她忽略了我的请求", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 5, "content": "我的伴侣在孩子面前批评我的教养方式", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 6, "content": "当我吩咐孩子做某事时，我的伴侣会反驳我", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 7, "content": "我的伴侣和我使用相似的育儿技巧", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 8, "content": "在我就孩子的问题寻求帮助时，我的伴侣不会帮助我", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 9, "content": "当我告诉伴侣关于孩子的事情时，他/她会倾听", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 10, "content": "当孩子想要什么时，我说不可以，但我的伴侣说可以", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 11, "content": "我的伴侣使用了我要求他/她不要使用的育儿技巧", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 12, "content": "总的来说，我们在孩子养育方面配合得很好", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:结束阶段"}, {"id": 13, "content": "当我试图解决我们的孩子和其他孩子之间的争端时，我的伴侣会帮助我", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:结束阶段"}, {"id": 14, "content": "在孩子面前，即使我的伴侣不同意我对待孩子的方式，但他/她仍然支持我", "options": [{"label": "从不", "score": 1}, {"label": "非常少", "score": 2}, {"label": "偶尔", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:结束阶段"}], "id": 1775965642069, "completedCount": 5, "aiDiag": {"enabled": true, "prompt": "你是一位资深临床心理评估咨询师，专注于家庭系统与重大精神障碍康复支持领域。你正在为一位来访者解读其完成的《{scaleName}》（PPCRS）测评结果。请严格依据以下结构生成专业、温暖、具临床实用性的反馈报告，所有分析必须基于量表原始计分规则与维度定义，不得主观臆断或添加未授权解释：\n\n【综合评估】  \n以整体视角简明概括该家庭父母共同教养关系的质量水平：指出{score}分所对应的{level}（低/中/高）等级，并结合中国家庭现实背景（如患者与家属同住率高、日常互动频密、家庭功能对康复影响显著等）说明该结果的实际意义——例如：“在您这样长期共同生活的家庭中，这一水平提示教养协作模式可能对患者的情绪稳定性、治疗依从性及家庭压力缓冲能力产生基础性影响”。\n\n【维度分析】  \n逐项解析{dimensions}中两个核心维度：  \n• **支持性（dim_支持性）**：聚焦Q1、Q3、Q7、Q9、Q12、Q13、Q14所测量的“主动协同”行为（如共商教养策略、情感支持配偶、一致肯定孩子、分担育儿责任等）。若得分偏低，需具体指出“支持性行为出现频率不足”可能表现为：一方常独自应对教养冲突、回避讨论教育分歧、较少给予伴侣正向反馈；若偏高，则强调“稳定的支持联盟”如何为患者营造安全可预测的家庭氛围。  \n• **非支持性（dim_非支持性）**：聚焦Q2、Q4、Q5、Q6、Q8、Q10、Q11所反映的“协作阻碍”行为（如公开批评对方教养方式、在孩子面前否定配偶权威、拒绝沟通教养分歧、将育儿责任完全推诿等）。若得分偏高，需温和点明“非支持性互动可能被孩子或患者敏感捕捉，加剧其不安全感或病耻感”；若偏低，则肯定“双方在避免破坏性互动上的共识与克制”。  \n⚠️ 注意：两个维度需对比解读（如“支持性中等但非支持性偏高”，提示“表面合作下存在隐性张力”；“双维度均低”则反映“教养互动稀疏，缺乏深度协作亦无明显冲突”）。\n\n【改善建议】  \n紧扣维度特征提供可操作的家庭微干预策略：  \n• 若**支持性不足**：推荐“每日10分钟教养同步时间”（如晚饭后共同回顾孩子当日1个积极表现并互相确认）、“支持性语言打卡”（本周每人每天至少1次用“我注意到你……，这让我觉得……”句式肯定对方教养行为）；  \n• 若**非支持性突出**：建议启动“教养分歧暂停协议”（当意见不合时，约定先说“我们稍后再谈这个”，24小时内由第三方（如社工/治疗师）协助结构化讨论）、“孩子面前一致性话术”（提前约定3句中性回应模板，如“这是爸爸妈妈一起决定的”）；  \n• 若**TOT总分处于临界区间（2.33–3.66）**：强调此阶段改变效能最高，推荐优先开展1次家庭联合访谈，聚焦识别1个高频触发非支持行为的具体情境（如作业辅导、服药监督），进行角色扮演重构。\n\n【注意事项】  \n• 本报告基于{scaleName}标准化工具生成，结果反映当前家庭教养互动的感知状态，具有时效性与情境性，不等同于人格评价或病理诊断；  \n• 所有解读均指向“关系行为模式”，而非归咎个体——教养协作质量受文化期待、代际经验、照护负荷、疾病症状波动等多重因素影响；  \n• 本结果**仅供参考，不构成任何医疗诊断、治疗方案或法律意见**；如需制定个性化家庭干预计划，请务必在精神科医生与家庭治疗师共同参与下进行；  \n• 您愿意完成这份量表，本身已是为家人康复迈出的重要一步——家庭关系的韧性，往往始于一次被看见、被理解的尝试。", "welcome": "根据您的测评结果，我为您生成了以下分析报告。", "temperature": 0.7, "maxTokens": 2000}, "scoring": {"dimensions": [{"key": "supportive", "label": "支持性", "formula": "SUM", "items": "1,3,7,9,12,13,14", "condition": null, "interpretation": [{"min": 7, "max": 15.99, "level": "normal", "label": "低", "color": "#43a047", "text": "感知到的支持性共同教养行为较少"}, {"min": 16, "max": 25.99, "level": "mild", "label": "中等", "color": "#26a69a", "text": "感知到的支持性共同教养行为处于中等水平"}, {"min": 26, "max": 35, "level": "severe", "label": "高", "color": "#7e57c2", "text": "感知到的支持性共同教养行为较多"}]}, {"key": "unsupportive", "label": "非支持性", "formula": "SUM", "items": "2,4,5,6,8,10,11", "condition": null, "interpretation": [{"min": 7, "max": 15.99, "level": "normal", "label": "低", "color": "#43a047", "text": "感知到的非支持性共同教养行为较少"}, {"min": 16, "max": 25.99, "level": "mild", "label": "中等", "color": "#26a69a", "text": "感知到的非支持性共同教养行为处于中等水平"}, {"min": 26, "max": 35, "level": "severe", "label": "高", "color": "#7e57c2", "text": "感知到的非支持性共同教养行为较多"}]}], "metrics": [{"key": "coparenting_total", "label": "共同教养总分", "formula": "AVG", "items": "ALL", "condition": null, "transform": null}], "interpretation": [{"metric": "supportive", "min": 7, "max": 15.99, "level": "normal", "label": "低", "color": "#43a047", "text": "感知到的支持性共同教养行为较少"}, {"metric": "supportive", "min": 16, "max": 25.99, "level": "mild", "label": "中等", "color": "#26a69a", "text": "感知到的支持性共同教养行为处于中等水平"}, {"metric": "supportive", "min": 26, "max": 35, "level": "severe", "label": "高", "color": "#7e57c2", "text": "感知到的支持性共同教养行为较多"}, {"metric": "unsupportive", "min": 7, "max": 15.99, "level": "normal", "label": "低", "color": "#43a047", "text": "感知到的非支持性共同教养行为较少"}, {"metric": "unsupportive", "min": 16, "max": 25.99, "level": "mild", "label": "中等", "color": "#26a69a", "text": "感知到的非支持性共同教养行为处于中等水平"}, {"metric": "unsupportive", "min": 26, "max": 35, "level": "severe", "label": "高", "color": "#7e57c2", "text": "感知到的非支持性共同教养行为较多"}, {"metric": "coparenting_total", "min": 1, "max": 2.99, "level": "normal", "label": "低", "color": "#43a047", "text": "共同教养关系质量较低"}, {"metric": "coparenting_total", "min": 3, "max": 3.99, "level": "mild", "label": "中等", "color": "#26a69a", "text": "共同教养关系质量处于中等水平"}, {"metric": "coparenting_total", "min": 4, "max": 5, "level": "severe", "label": "高", "color": "#7e57c2", "text": "共同教养关系质量较高"}], "screening": null}}, {"name": "家庭亲密度和适应性", "shortName": "FACES II-CV", "code": "FACES II-CV", "category": "bond", "categoryName": "家庭与人际关系量表", "emoji": "💞", "color": "#d97c4a", "duration": 15, "questionTime": 30, "questionCount": 30, "applicablePeople": "", "desc": "在中国治疗精神病的过程中，大多数家庭因素评估通常仅限于了解家族精神病病史，而没有详细了解中国精神病患者家庭结构特点等信息。", "instruction": "", "notice": ["请根据您过去一周的真实感受作答"], "tags": ["家庭教育"], "status": 1, "sortOrder": 1, "rating": 5, "npcConfig": {"counselorId": "", "backgroundId": ""}, "questions": [{"id": 1, "content": "在有难处的时候，家庭成员都会尽最大的努力相互支持", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:开始阶段"}, {"id": 2, "content": "在我们的家庭中每个成员都可以随便发表自己的意见", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:开始阶段"}, {"id": 3, "content": "我们家庭中的成员比较愿意与朋友商讨个人问题而不太愿意与家人商讨", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:开始阶段"}, {"id": 4, "content": "每个家庭成员都参与做出重大的家庭决策", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 5, "content": "所有家庭成员聚集在一起进行活动", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 6, "content": "晚辈对长辈的教导可以发表自己的意见", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 7, "content": "在家庭中，有事大家一起做", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 8, "content": "家庭成员一起讨论问题，并对问题的解决感到满意", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 9, "content": "家庭成员与朋友的关系比家庭成员之间的关系更密切", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 10, "content": "在家庭中，我们轮流分担不同的家务", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 11, "content": "家庭成员之间都熟悉每个成员的亲密朋友", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 12, "content": "家庭状况有变化时，家庭平常的生活规律和家规很容易有相应的改变", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 13, "content": "家庭成员自己要做决策时，喜欢与家人一起商量", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 14, "content": "当家庭中出现矛盾时，成员间相互谦让取得妥协", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 15, "content": "在我们的家庭中，娱乐活动都是全家人一起去做的", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 16, "content": "在解决问题时，孩子们的建议都能够被接受", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 17, "content": "家庭成员之间的关系是非常密切的", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 18, "content": "我们家的家教是合理的", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 19, "content": "在我们的家庭中，每个成员都习惯单独活动", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 20, "content": "我们家喜欢用新方法去解决遇到的问题", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 21, "content": "每个家庭成员都能按家庭所做的决定去做事", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 22, "content": "在我们的家庭中，每个成员都能分担家庭义务", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 23, "content": "家庭成员喜欢在一起度过业余时间", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 24, "content": "尽管家里有人有这样的想法，但家庭的生活规律和家规还是难以改变", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 25, "content": "家庭成员都很主动和家里其他人谈自己的心里话", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 26, "content": "在家庭中，每个家庭成员可以随便提出自己的要求", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 27, "content": "在家庭中，每个家庭成员的朋友都会受到极为热情的接待", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:中间阶段"}, {"id": 28, "content": "当家庭发生矛盾时，家庭成员会把自己的想法藏在心里", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:结束阶段"}, {"id": 29, "content": "在家庭中，我们更愿意分开做事，而不太愿意和全家人一起做", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:结束阶段"}, {"id": 30, "content": "家庭成员可以分享彼此的兴趣和爱好", "options": [{"label": "不是", "score": 1}, {"label": "偶尔", "score": 2}, {"label": "有时", "score": 3}, {"label": "经常", "score": 4}, {"label": "总是", "score": 5}], "transition": "phase:结束阶段"}], "id": 1776000039744, "completedCount": 1, "aiDiag": {"enabled": true, "prompt": "你是一位资深临床心理评估咨询师，专注于家庭系统与人际关系的动态分析。你正在为来访者解读《{scaleName}》（FACES II-CV）量表结果。请严格依据以下结构生成专业、温暖、具实操性的AI诊断反馈——所有判断必须基于输入数据 {score}（含各维度原始分、衍生指标及满意度评分）、{dimensions}（含 dim_亲密度、dim_适应性、metric_R_COH、metric_I_COH、metric_R_ADA、metric_I_ADA、metric_DIS_COH、metric_DIS_ADA）、{answers}（30题作答详情）及量表官方计分规则，不得主观臆断或补充未提供信息。\n\n【输出结构要求】  \n✅ 综合评估：以1–2句话概括家庭系统整体功能倾向（如“呈现高亲密度—低适应性失衡模式”），点明核心张力（如亲密过载但规则僵化），并强调该模式在中国家庭文化语境下的常见表现（如代际边界模糊、情感表达浓烈但冲突调节机制薄弱）。  \n\n✅ 维度分析：  \n- 亲密度维度（dim_亲密度）：结合其得分区间（松散/自由/亲密/缠结）与 R_COH/I_COH 差值（DIS_COH）说明——若 DIS_COH ≥ 8，指出“理想亲密度”与“实际亲密度”存在显著落差，反映主观期待与现实体验的割裂（如渴望深度联结却常感疏离）；若得分处于缠结区间（≥71.9），需关联Q1/Q5/Q7等题项中高频选择“总是”类选项的行为特征（如过度共情、难以独处、回避分歧），解释其可能带来的耗竭感；若处于松散区间（≤55.9），则联系Q24/Q28/Q29等题中“不是”“偶尔”的集中分布，描述情感联结弱化在日常中的体现（如家庭成员间话题局限、重要决定不协商、节日团聚流于形式）。  \n- 适应性维度（dim_适应性）：依据得分区间（僵硬/有规律/灵活/无规律）与 DIS_ADA 指标，说明家庭应对变化的能力特质。例如：若处于僵硬水平（≤44.7）且 R_ADA 显著高于 I_ADA，提示家庭成员内心期待更多弹性（如希望父母能接受自己职业选择），但现实中规则高度固化（如Q3/Q9/Q14多选“不是”）；若处于无规律区间（≥57.1），需结合Q2/Q4/Q26等题中“总是”高频出现，指出决策随意、权责不清、承诺易变等行为模式对青少年成员安全感的潜在影响。  \n- 衍生指标整合：用 DIS_COH 和 DIS_ADA 的数值对比揭示家庭“认知—行为”一致性程度（如 DIS_COH 高 + DIS_ADA 低，提示亲密度议题存在深层未言说矛盾，而适应性调整尚属务实层面）。  \n\n✅ 改善建议：  \n- 针对亲密度失衡：若缠结，建议从“微距离练习”切入（如每周设定2小时独立活动时间，不汇报行踪）；若松散，推荐“结构化分享法”（每晚晚餐时轮流用1句话分享当日1个微小情绪瞬间）；若 DIS_COH 显著，引导用“差异对话模板”：“我注意到我们对‘家人该怎样关心彼此’的理解不太一样，你愿意说说你心里最看重的那个画面吗？”  \n- 针对适应性失衡：若僵硬，设计“规则弹性实验”（如本月允许1次家庭计划临时变更，由不同成员轮流发起）；若无规律，建立“三要素约定”（每次家庭决策必明确：谁负责、何时完成、如何确认）；若 DIS_ADA 高，开展“期待校准工作坊”（用便利贴匿名写下对家庭灵活性的3个具体期待，共同归类排序）。  \n- 所有建议须匹配中国家庭现实约束（如避免建议“频繁家庭会议”，改为“饭后10分钟茶叙”；不推荐西方个人主义话术，强调“既顾全长辈颜面，也安顿自我需求”的双轨策略）。  \n\n✅ 注意事项：  \n- 明确声明：“本解读基于《{scaleName}》标准化施测结果，仅反映当前家庭互动模式的静态切片，**不构成任何医学诊断、精神障碍判定或治疗建议**。心理健康状态受生物、社会、文化多重因素影响，如您感到持续困扰，请务必联系具备资质的精神科医师或临床心理师进行综合评估。”  \n- 提醒分数临界值意义：如 dim_亲密度 得分为63.8（临近“亲密”阈值），需说明“此分数提示家庭正处在关系深化的关键过渡期，微小支持即可促成积极转变”；  \n- 强调文化敏感性：“在中国语境中，‘亲密’不等于无保留袒露，‘适应性’不等于无原则妥协——健康的家庭系统恰是在孝道责任与个体成长间不断动态校准的过程。”  \n\n请始终使用平和、笃定而富有温度的语言，避免绝对化表述（禁用“必然”“肯定”“证明”），多采用“可能反映出”“值得关注的是”“可以尝试”等建设性措辞。所有分析必须可追溯至 {answers} 中的具体题目作答模式，确保每一句结论都有数据锚点。", "welcome": "根据您的测评结果，我为您生成了以下分析报告。", "temperature": 0.7, "maxTokens": 2000}, "scoring": {"dimensions": [{"key": "dim_亲密度", "label": "亲密度", "formula": "SUM", "items": "1,5,7,11,13,15,17,21,23,25,27,30", "condition": null, "interpretation": [{"max": 55.9, "level": "normal", "label": "低", "color": "#43a047", "text": "家庭亲密度处于松散水平"}, {"min": 55.9, "max": 63.9, "level": "moderate", "label": "中等", "color": "#1e88e5", "text": "家庭亲密度处于自由水平"}, {"min": 63.9, "max": 71.9, "level": "moderate", "label": "中等", "color": "#1e88e5", "text": "家庭亲密度处于亲密水平"}, {"min": 71.9, "level": "severe", "label": "高", "color": "#7e57c2", "text": "家庭亲密度处于缠结水平"}]}, {"key": "dim_适应性", "label": "适应性", "formula": "SUM", "items": "2,4,6,8,10,12,14,16,18,20,22,26", "condition": null, "interpretation": [{"max": 44.7, "level": "normal", "label": "低", "color": "#43a047", "text": "家庭适应性处于僵硬水平"}, {"min": 44.7, "max": 50.9, "level": "moderate", "label": "中等", "color": "#1e88e5", "text": "家庭适应性处于有规律水平"}, {"min": 50.9, "max": 57.1, "level": "moderate", "label": "中等", "color": "#1e88e5", "text": "家庭适应性处于灵活水平"}, {"min": 57.1, "level": "severe", "label": "高", "color": "#7e57c2", "text": "家庭适应性处于无规律水平"}]}], "metrics": [{"key": "metric_R_COH", "label": "R_COH", "formula": "SUM", "items": "1,5,7,11,13,15,17,21,23,25,27,30", "condition": null, "transform": null}, {"key": "metric_I_COH", "label": "I_COH", "formula": "SUM", "items": "1,5,7,11,13,15,17,21,23,25,27,30", "condition": null, "transform": null}, {"key": "metric_R_ADA", "label": "R_ADA", "formula": "SUM", "items": "2,4,6,8,10,12,14,16,18,20,22,26", "condition": null, "transform": null}, {"key": "metric_I_ADA", "label": "I_ADA", "formula": "SUM", "items": "2,4,6,8,10,12,14,16,18,20,22,26", "condition": null, "transform": null}, {"key": "metric_DIS_COH", "label": "DIS_COH", "formula": "DERIVED", "items": "ALL", "condition": null, "transform": null, "expression": "ABS(R_COH-I_COH)"}, {"key": "metric_DIS_ADA", "label": "DIS_ADA", "formula": "DERIVED", "items": "ALL", "condition": null, "transform": null, "expression": "ABS(R_ADA-I_ADA)"}], "interpretation": [{"max": 55.9, "level": "normal", "label": "低", "color": "#43a047", "text": "家庭亲密度处于松散水平"}, {"min": 55.9, "max": 63.9, "level": "moderate", "label": "中等", "color": "#1e88e5", "text": "家庭亲密度处于自由水平"}, {"min": 63.9, "max": 71.9, "level": "moderate", "label": "中等", "color": "#1e88e5", "text": "家庭亲密度处于亲密水平"}, {"min": 71.9, "level": "severe", "label": "高", "color": "#7e57c2", "text": "家庭亲密度处于缠结水平"}, {"max": 44.7, "level": "normal", "label": "低", "color": "#43a047", "text": "家庭适应性处于僵硬水平"}, {"min": 44.7, "max": 50.9, "level": "moderate", "label": "中等", "color": "#1e88e5", "text": "家庭适应性处于有规律水平"}, {"min": 50.9, "max": 57.1, "level": "moderate", "label": "中等", "color": "#1e88e5", "text": "家庭适应性处于灵活水平"}, {"min": 57.1, "level": "severe", "label": "高", "color": "#7e57c2", "text": "家庭适应性处于无规律水平"}, {"metric": "metric_DIS_COH", "max": 5, "level": "normal", "label": "低", "color": "#43a047", "text": "对家庭亲密度满意度较高"}, {"metric": "metric_DIS_COH", "min": 5, "max": 12, "level": "moderate", "label": "中等", "color": "#1e88e5", "text": "对家庭亲密度满意度中等"}, {"metric": "metric_DIS_COH", "min": 12, "level": "severe", "label": "高", "color": "#7e57c2", "text": "对家庭亲密度满意度较低"}, {"metric": "metric_DIS_ADA", "max": 5, "level": "normal", "label": "低", "color": "#43a047", "text": "对家庭适应性满意度较高"}, {"metric": "metric_DIS_ADA", "min": 5, "max": 12, "level": "moderate", "label": "中等", "color": "#1e88e5", "text": "对家庭适应性满意度中等"}, {"metric": "metric_DIS_ADA", "min": 12, "level": "severe", "label": "高", "color": "#7e57c2", "text": "对家庭适应性满意度较低"}], "screening": null}}, {"name": "中国大五人格问卷（简式版）", "shortName": "CBF-PI-B", "code": "CBF-PI-B-2024", "category": "personality", "categoryName": "人格特质评估量表", "emoji": "📜", "color": "#d6582e", "duration": 20, "questionTime": 30, "questionCount": 40, "applicablePeople": "", "desc": "中国大五人格问卷（简式版，CBF-PI-B）由王孟成、戴晓阳编制，共40题，含神经质、尽责性、宜人性、开放性、外向性5个维度，各8题。量表采用6级计分，设7道反向题，计分后求和得维度分。其信效度良好，施测简便，适用于成人群体的人格特征评估。", "instruction": "以下是描述个人性格特点的语句，请你依据每句话与自身性格的相符程度进行选择。每个人的性格各不相同，答案没有对错之分，请根据你的真实情况如实作答，选择最贴合你自身的选项即可。", "notice": ["按自身真实情况作答", "答案无对错之分", "依相符程度选择", "客观评价自身性格"], "tags": ["人格测试"], "status": 1, "sortOrder": 0, "rating": 5, "npcConfig": {"counselorId": "", "backgroundId": ""}, "questions": [{"id": 1, "content": "我常常感到害怕", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "神经质(N)", "transition": "phase:开始阶段"}, {"id": 2, "content": "一旦确定了目标，我会坚持努力地实现它", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "尽责性(C)", "transition": "phase:开始阶段"}, {"id": 3, "content": "我觉得大部分人基本上是心怀善意的", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "宜人性(A)", "transition": "phase:开始阶段"}, {"id": 4, "content": "我头脑中经常充满生动的画面", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "开放性(O)", "transition": "phase:中间阶段"}, {"id": 5, "content": "我对人多的聚会感到乏味（反向计分）", "options": [{"label": "完全不符合", "score": 6}, {"label": "大部分不符合", "score": 5}, {"label": "有点不符合", "score": 4}, {"label": "有点符合", "score": 3}, {"label": "大部分符合", "score": 2}, {"label": "完全符合", "score": 1}], "dimension": "外向性(E)", "transition": "phase:中间阶段"}, {"id": 6, "content": "有时我觉得自己一无是处", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "神经质(N)", "transition": "phase:中间阶段"}, {"id": 7, "content": "我常常是仔细考虑之后才做出决定", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "尽责性(C)", "transition": "phase:中间阶段"}, {"id": 8, "content": "我不太关心别人是否受到不公正的待遇（反向计分）", "options": [{"label": "完全不符合", "score": 6}, {"label": "大部分不符合", "score": 5}, {"label": "有点不符合", "score": 4}, {"label": "有点符合", "score": 3}, {"label": "大部分符合", "score": 2}, {"label": "完全符合", "score": 1}], "dimension": "宜人性(A)", "transition": "phase:中间阶段"}, {"id": 9, "content": "我是个勇于冒险、突破常规的人", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "开放性(O)", "transition": "phase:中间阶段"}, {"id": 10, "content": "在热闹的聚会上，我常常表现主动并尽情玩耍", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "外向性(E)", "transition": "phase:中间阶段"}, {"id": 11, "content": "别人一句漫不经心的话，我常常会联系在自己身上", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "神经质(N)", "transition": "phase:中间阶段"}, {"id": 12, "content": "别人认为我是个慎重的人", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "尽责性(C)", "transition": "phase:中间阶段"}, {"id": 13, "content": "我时常觉得别人的痛苦与我无关（反向计分）", "options": [{"label": "完全不符合", "score": 6}, {"label": "大部分不符合", "score": 5}, {"label": "有点不符合", "score": 4}, {"label": "有点符合", "score": 3}, {"label": "大部分符合", "score": 2}, {"label": "完全符合", "score": 1}], "dimension": "宜人性(A)", "transition": "phase:中间阶段"}, {"id": 14, "content": "我喜欢冒险", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "开放性(O)", "transition": "phase:中间阶段"}, {"id": 15, "content": "我尽量避免参加人多的聚会和处于嘈杂的环境（反向计分）", "options": [{"label": "完全不符合", "score": 6}, {"label": "大部分不符合", "score": 5}, {"label": "有点不符合", "score": 4}, {"label": "有点符合", "score": 3}, {"label": "大部分符合", "score": 2}, {"label": "完全符合", "score": 1}], "dimension": "外向性(E)", "transition": "phase:中间阶段"}, {"id": 16, "content": "在面对压力时，我有种快要崩溃的感觉", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "神经质(N)", "transition": "phase:中间阶段"}, {"id": 17, "content": "我会把事情计划好再去做", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "尽责性(C)", "transition": "phase:中间阶段"}, {"id": 18, "content": "我是个不会替别人着想的人（反向计分）", "options": [{"label": "完全不符合", "score": 6}, {"label": "大部分不符合", "score": 5}, {"label": "有点不符合", "score": 4}, {"label": "有点符合", "score": 3}, {"label": "大部分符合", "score": 2}, {"label": "完全符合", "score": 1}], "dimension": "宜人性(A)", "transition": "phase:中间阶段"}, {"id": 19, "content": "我对许多事情有着很强的好奇心", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "开放性(O)", "transition": "phase:中间阶段"}, {"id": 20, "content": "我喜欢与人交谈、开朗健谈", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "外向性(E)", "transition": "phase:中间阶段"}, {"id": 21, "content": "我常常担忧一些无关紧要的事情", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "神经质(N)", "transition": "phase:中间阶段"}, {"id": 22, "content": "我会尽力完成好自己的任务", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "尽责性(C)", "transition": "phase:中间阶段"}, {"id": 23, "content": "虽然社会上有一些骗子，但我觉得大部分人还是可信的", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "宜人性(A)", "transition": "phase:中间阶段"}, {"id": 24, "content": "我喜欢思考一些理论性的问题", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "开放性(O)", "transition": "phase:中间阶段"}, {"id": 25, "content": "在集体中我是个很有影响力的人", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "外向性(E)", "transition": "phase:中间阶段"}, {"id": 26, "content": "我常常感到情绪低落", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "神经质(N)", "transition": "phase:中间阶段"}, {"id": 27, "content": "我是一个倾尽全力做事的人", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "尽责性(C)", "transition": "phase:中间阶段"}, {"id": 28, "content": "当别人向我诉说不幸时，我常常感到难过", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "宜人性(A)", "transition": "phase:中间阶段"}, {"id": 29, "content": "我的日常生活充满了挑战", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "开放性(O)", "transition": "phase:中间阶段"}, {"id": 30, "content": "我很喜欢参加各种社交活动", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "外向性(E)", "transition": "phase:中间阶段"}, {"id": 31, "content": "我常常担心很多事情", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "神经质(N)", "transition": "phase:中间阶段"}, {"id": 32, "content": "在工作上，我时常只求能应付过去（反向计分）", "options": [{"label": "完全不符合", "score": 6}, {"label": "大部分不符合", "score": 5}, {"label": "有点不符合", "score": 4}, {"label": "有点符合", "score": 3}, {"label": "大部分符合", "score": 2}, {"label": "完全符合", "score": 1}], "dimension": "尽责性(C)", "transition": "phase:中间阶段"}, {"id": 33, "content": "尽管人类社会存在着一些阴暗面(如战争、欺骗)，但我觉得大多数人是善良的", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "宜人性(A)", "transition": "phase:中间阶段"}, {"id": 34, "content": "我的想象力相当丰富", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "开放性(O)", "transition": "phase:中间阶段"}, {"id": 35, "content": "我喜欢参加社交与娱乐聚会", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "外向性(E)", "transition": "phase:中间阶段"}, {"id": 36, "content": "我很少感到忧郁或沮丧（反向计分）", "options": [{"label": "完全不符合", "score": 6}, {"label": "大部分不符合", "score": 5}, {"label": "有点不符合", "score": 4}, {"label": "有点符合", "score": 3}, {"label": "大部分符合", "score": 2}, {"label": "完全符合", "score": 1}], "dimension": "神经质(N)", "transition": "phase:中间阶段"}, {"id": 37, "content": "做事讲究逻辑和条理是我的一个特点", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "尽责性(C)", "transition": "phase:中间阶段"}, {"id": 38, "content": "我时常为那些遭遇不幸的人感到难过", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "宜人性(A)", "transition": "phase:结束阶段"}, {"id": 39, "content": "我很愿意也很容易接受那些新事物、新观点、新想法", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "开放性(O)", "transition": "phase:结束阶段"}, {"id": 40, "content": "我希望成为领导者而不是被领导者", "options": [{"label": "完全不符合", "score": 1}, {"label": "大部分不符合", "score": 2}, {"label": "有点不符合", "score": 3}, {"label": "有点符合", "score": 4}, {"label": "大部分符合", "score": 5}, {"label": "完全符合", "score": 6}], "dimension": "外向性(E)", "transition": "phase:结束阶段"}], "id": 1776402134595, "completedCount": 0, "aiDiag": {"enabled": true, "prompt": "你是一位资深临床心理评估咨询师，持有国家二级心理咨询师资格及人格心理学专业背景，长期从事标准化心理量表的施测、解读与个体化反馈工作。你正在为一位完成{scaleName}（CBF-PI-B-2024）测评的来访者生成专业、温暖、有温度的心理画像报告。请严格依据以下结构与要求输出诊断反馈——所有分析必须基于真实作答数据{answers}与官方计分规则，不得虚构或推测未测量内容。\n\n【综合评估】  \n以整体视角概括该个体在五大核心人格维度上的协调性与典型特征：是否存在明显优势维度与相对薄弱维度？各维度得分分布是否趋近均衡（如“四维中等+一维突出”），抑或呈现某种常见组合模式（如“高尽责+低外向”反映务实内敛型，“高开放+高神经质”提示敏感探索型）？用1–2句话凝练其人格轮廓本质，强调这是稳定倾向而非固定标签，体现发展性与情境性。\n\n【维度分析】  \n逐一对五个维度进行精准解读（按神经质→外向性→尽责性→宜人性→开放性顺序），每维包含：  \n① 实际得分{score}与所属水平{level}（严格对照题干中各维度的三档划分标准）；  \n② 结合该维度所含题目（如神经质含Q1/Q6/Q11…）隐含的行为/情绪逻辑，解释此水平在日常生活中的典型表现（例：若神经质得分为42分（高水平），需关联“Q1情绪易波动、Q36压力感知强”等反向题作答倾向，说明其可能在工作截止前夜反复检查细节、对他人轻微批评较难释怀等具象反应）；  \n③ 避免绝对化表述，使用“往往”“较常”“可能伴随”等限定词，体现心理弹性（如：“外向性得分31分（中等水平）表明您既能享受深度一对一交流的专注感，也能在团队协作中自然承担表达角色，并非‘有时外向有时内向’的矛盾，而是具备情境适配的社交资源”）。\n\n【改善建议】  \n针对得分处于“低水平”或“高水平”且可能带来现实适应张力的维度（如神经质>40分伴睡眠困扰、尽责性<25分伴任务拖延），提供3条具体、可操作、非评判性的行为调节建议：  \n• 每条建议须锚定一个可观察动作（例：针对“宜人性低分（22分）”，不写“提升共情”，而写“尝试在他人发言后停顿3秒再回应，同步轻点头3次，帮助自己从评判模式切换至倾听模式”）；  \n• 优先推荐已获实证支持的小干预（如正念呼吸缓解神经质唤醒、两分钟‘启动仪式’改善尽责性启动困难）；  \n• 明确标注建议适用场景（工作/亲密关系/自我独处），增强落地性。\n\n【注意事项】  \n• 重申本报告仅为{scaleName}标准化测评的常模参照解读，**不构成任何医学诊断、精神障碍判定或治疗建议**；  \n• 提示人格特质具有稳定性与可塑性双重属性——当前得分反映近期倾向，但通过持续觉察与微小行动可逐步拓展行为光谱；  \n• 若任一维度得分接近临界值（如神经质=39分或40分）、或多维极端组合（如神经质≥40分且尽责性≤24分），温和建议“可结合生活事件史与主观困扰感，考虑预约面询以获得更立体评估”；  \n• 最后以一句赋能式结语收束（例：“您认真完成40道题的选择，本身已是自我关怀的重要一步——人格不是待修正的缺陷，而是您与世界互动的独特语法。”）\n\n全程保持专业而温润的语调：用“您”建立联结，以“倾向”“风格”“资源”替代“问题”“缺陷”“障碍”，所有判断均有量表依据，所有建议均可被验证执行。", "welcome": "根据您的测评结果，我为您生成了以下分析报告。", "temperature": 0.7, "maxTokens": 2000}, "scoring": {"dimensions": [{"key": "neuroticism", "label": "神经质", "formula": "SUM", "items": "1,6,11,16,21,26,31,36", "condition": null, "interpretation": [{"max": 24, "level": "normal", "label": "低水平", "color": "#43a047", "text": "情绪稳定、心态平和，抗压能力强，极少焦虑/低落"}, {"min": 25, "max": 39, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "情绪基本平稳，偶尔有焦虑、敏感，可自我调节"}, {"min": 40, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "情绪易波动，敏感多虑，常感焦虑、低落、压力大"}]}, {"key": "extraversion", "label": "外向性", "formula": "SUM", "items": "5,10,15,20,25,30,35,40", "condition": null, "interpretation": [{"max": 24, "level": "normal", "label": "低水平", "color": "#43a047", "text": "内向安静，偏爱独处，社交谨慎，不喜热闹场合"}, {"min": 25, "max": 39, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "动静皆宜，社交适度，既不孤僻也不过分活跃"}, {"min": 40, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "开朗健谈，热衷社交，自信主动，喜欢成为焦点"}]}, {"key": "conscientiousness", "label": "尽责性", "formula": "SUM", "items": "2,7,12,17,22,27,32,37", "condition": null, "interpretation": [{"max": 24, "level": "normal", "label": "低水平", "color": "#43a047", "text": "随性散漫，做事拖延，缺乏规划，责任心较弱"}, {"min": 25, "max": 39, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "做事踏实，有基本规划，能完成分内任务"}, {"min": 40, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "自律严谨，目标明确，做事有条理，责任心极强"}]}, {"key": "agreeableness", "label": "宜人性", "formula": "SUM", "items": "3,8,13,18,23,28,33,38", "condition": null, "interpretation": [{"max": 24, "level": "normal", "label": "低水平", "color": "#43a047", "text": "理性自我，较少共情，待人直接，忽视他人感受"}, {"min": 25, "max": 39, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "友善温和，能体谅他人，人际关系和谐"}, {"min": 40, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "同理心强，乐于助人，真诚宽容，重视他人感受"}]}, {"key": "openness", "label": "开放性", "formula": "SUM", "items": "4,9,14,19,24,29,34,39", "condition": null, "interpretation": [{"max": 24, "level": "normal", "label": "低水平", "color": "#43a047", "text": "传统保守，偏爱熟悉事物，不喜冒险与新观念"}, {"min": 25, "max": 39, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "乐于接受新事物，有一定好奇心与想象力"}, {"min": 40, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "好奇心强，想象力丰富，勇于冒险，热衷新观念/新事物"}]}], "metrics": [], "interpretation": [{"metric": "neuroticism", "max": 24, "level": "normal", "label": "低水平", "color": "#43a047", "text": "情绪稳定、心态平和，抗压能力强，极少焦虑/低落"}, {"metric": "neuroticism", "min": 25, "max": 39, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "情绪基本平稳，偶尔有焦虑、敏感，可自我调节"}, {"metric": "neuroticism", "min": 40, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "情绪易波动，敏感多虑，常感焦虑、低落、压力大"}, {"metric": "extraversion", "max": 24, "level": "normal", "label": "低水平", "color": "#43a047", "text": "内向安静，偏爱独处，社交谨慎，不喜热闹场合"}, {"metric": "extraversion", "min": 25, "max": 39, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "动静皆宜，社交适度，既不孤僻也不过分活跃"}, {"metric": "extraversion", "min": 40, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "开朗健谈，热衷社交，自信主动，喜欢成为焦点"}, {"metric": "conscientiousness", "max": 24, "level": "normal", "label": "低水平", "color": "#43a047", "text": "随性散漫，做事拖延，缺乏规划，责任心较弱"}, {"metric": "conscientiousness", "min": 25, "max": 39, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "做事踏实，有基本规划，能完成分内任务"}, {"metric": "conscientiousness", "min": 40, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "自律严谨，目标明确，做事有条理，责任心极强"}, {"metric": "agreeableness", "max": 24, "level": "normal", "label": "低水平", "color": "#43a047", "text": "理性自我，较少共情，待人直接，忽视他人感受"}, {"metric": "agreeableness", "min": 25, "max": 39, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "友善温和，能体谅他人，人际关系和谐"}, {"metric": "agreeableness", "min": 40, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "同理心强，乐于助人，真诚宽容，重视他人感受"}, {"metric": "openness", "max": 24, "level": "normal", "label": "低水平", "color": "#43a047", "text": "传统保守，偏爱熟悉事物，不喜冒险与新观念"}, {"metric": "openness", "min": 25, "max": 39, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "乐于接受新事物，有一定好奇心与想象力"}, {"metric": "openness", "min": 40, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "好奇心强，想象力丰富，勇于冒险，热衷新观念/新事物"}], "screening": null}}, {"name": "90项症状清单", "shortName": "SCL-90", "code": "SCL-90", "category": "spirit", "categoryName": "心理健康与精神病态量表", "emoji": "🫁", "color": "#4a90d9", "duration": 45, "questionTime": 30, "questionCount": 90, "applicablePeople": "", "desc": "90 项症状清单（SCL-90）由心理学家 Derogatis 于 1973 年编制，20 世纪 80 年代引入我国并建立了国人常模，是国内应用最广泛的心理健康筛查量表。量表共 90 个项目，涵盖躯体感受、情绪、思维、人际关系、睡眠饮食等多方面症状，采用 5 级自评评分，能全面反映你近一周的自觉心理症状与不适程度，操作简便、评估直观，结果仅作为心理健康参考，并非精神疾病诊断依据。", "instruction": "下面列出了有些人可能会有的问题，请你仔细阅读每一条，然后根据最近一周内这些情况对你的实际影响和自身真实感觉，在 “没有、很轻、中等、偏重、严重” 五个选项中，选择最符合你的一项并做标记。", "notice": ["按最近一周的真实感受作答，不用反复斟酌。", "独立完成答题，不与他人商量、不受他人影响。", "每题仅选一个答案，确保不漏答、不重复选。", "结果严格保密，仅用于心理健康评估参考。"], "tags": ["专业量表"], "status": 1, "sortOrder": 0, "rating": 5, "npcConfig": {"counselorId": "", "backgroundId": ""}, "questions": [{"id": 1, "content": "头痛", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:开始阶段"}, {"id": 2, "content": "神经过敏，心中不踏实", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "焦虑", "transition": "phase:开始阶段"}, {"id": 3, "content": "头脑中有不必要的想法或字句盘旋", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "强迫症状", "transition": "phase:开始阶段"}, {"id": 4, "content": "头昏或昏倒", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:中间阶段"}, {"id": 5, "content": "对异性的兴趣减退", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 6, "content": "对旁人责备求全", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "人际关系敏感", "transition": "phase:中间阶段"}, {"id": 7, "content": "感到别人能控制你的思想", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "精神病性", "transition": "phase:中间阶段"}, {"id": 8, "content": "责怪别人制造麻烦", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "偏执", "transition": "phase:中间阶段"}, {"id": 9, "content": "忘性大", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "强迫症状", "transition": "phase:中间阶段"}, {"id": 10, "content": "担心自己衣饰的整齐及仪态的端正", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "强迫症状", "transition": "phase:中间阶段"}, {"id": 11, "content": "容易烦恼和激动", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "敌对", "transition": "phase:中间阶段"}, {"id": 12, "content": "胸痛", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:中间阶段"}, {"id": 13, "content": "害怕空旷的场所或街道", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "恐怖", "transition": "phase:中间阶段"}, {"id": 14, "content": "感到自己的精力下降，活动减慢", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 15, "content": "想结束自己的生命", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 16, "content": "听到旁人听不到的声音", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "精神病性", "transition": "phase:中间阶段"}, {"id": 17, "content": "发抖", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "焦虑", "transition": "phase:中间阶段"}, {"id": 18, "content": "感到大多数人都不可信任", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "偏执", "transition": "phase:中间阶段"}, {"id": 19, "content": "胃口不好", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "其他", "transition": "phase:中间阶段"}, {"id": 20, "content": "容易哭泣", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 21, "content": "同异性相处时感到害羞不自在", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "人际关系敏感", "transition": "phase:中间阶段"}, {"id": 22, "content": "感到受骗、中了圈套或有人想抓住你", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 23, "content": "无缘无故地突然感到害怕", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "焦虑", "transition": "phase:中间阶段"}, {"id": 24, "content": "自己不能控制地发脾气", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "敌对", "transition": "phase:中间阶段"}, {"id": 25, "content": "害怕单独出门", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "恐怖", "transition": "phase:中间阶段"}, {"id": 26, "content": "经常责怪自己", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 27, "content": "腰痛", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:中间阶段"}, {"id": 28, "content": "感到难以完成任务", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "强迫症状", "transition": "phase:中间阶段"}, {"id": 29, "content": "感到孤独", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 30, "content": "感到苦闷", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 31, "content": "过分担忧", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 32, "content": "对事物不感兴趣", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 33, "content": "感到害怕", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "焦虑", "transition": "phase:中间阶段"}, {"id": 34, "content": "我的感情容易受到伤害", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "人际关系敏感", "transition": "phase:中间阶段"}, {"id": 35, "content": "旁人能知道你的私下想法", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "精神病性", "transition": "phase:中间阶段"}, {"id": 36, "content": "感到别人不理解你、不同情你", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "人际关系敏感", "transition": "phase:中间阶段"}, {"id": 37, "content": "感到人们对你不友好,不喜欢你", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "人际关系敏感", "transition": "phase:中间阶段"}, {"id": 38, "content": "做事必须做得很慢以保证做得正确", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "强迫症状", "transition": "phase:中间阶段"}, {"id": 39, "content": "心跳得很厉害", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "焦虑", "transition": "phase:中间阶段"}, {"id": 40, "content": "恶心或胃部不舒服", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:中间阶段"}, {"id": 41, "content": "感到比不上他人", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "人际关系敏感", "transition": "phase:中间阶段"}, {"id": 42, "content": "肌肉酸痛", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:中间阶段"}, {"id": 43, "content": "感到有人监视你,谈论你", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "偏执", "transition": "phase:中间阶段"}, {"id": 44, "content": "难以入睡", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "其他", "transition": "phase:中间阶段"}, {"id": 45, "content": "做事必须反复检查", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "强迫症状", "transition": "phase:中间阶段"}, {"id": 46, "content": "难以做出决定", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "强迫症状", "transition": "phase:中间阶段"}, {"id": 47, "content": "怕乘电车、公共汽车、地铁或火车", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "恐怖", "transition": "phase:中间阶段"}, {"id": 48, "content": "呼吸有困难", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:中间阶段"}, {"id": 49, "content": "一阵阵发冷或发热", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:中间阶段"}, {"id": 50, "content": "因为感到害怕而避开某些东西、场合或活动", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "恐怖", "transition": "phase:中间阶段"}, {"id": 51, "content": "脑子变空了", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "强迫症状", "transition": "phase:中间阶段"}, {"id": 52, "content": "身体发麻或刺痛", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:中间阶段"}, {"id": 53, "content": "喉咙有梗阻感", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:中间阶段"}, {"id": 54, "content": "感到没有前途、没有希望", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 55, "content": "不能集中注意力", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "强迫症状", "transition": "phase:中间阶段"}, {"id": 56, "content": "感到身体某一部分软弱无力", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:中间阶段"}, {"id": 57, "content": "感到紧张或容易紧张", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "焦虑", "transition": "phase:中间阶段"}, {"id": 58, "content": "感到手或脚发重", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "躯体化", "transition": "phase:中间阶段"}, {"id": 59, "content": "想到死亡的事", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "其他", "transition": "phase:中间阶段"}, {"id": 60, "content": "吃得太多", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "其他", "transition": "phase:中间阶段"}, {"id": 61, "content": "当别人看着你或谈论你时感到不自在", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "人际关系敏感", "transition": "phase:中间阶段"}, {"id": 62, "content": "有些不属于你自己的想法", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "精神病性", "transition": "phase:中间阶段"}, {"id": 63, "content": "有想打人或伤害他人的冲动", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "敌对", "transition": "phase:中间阶段"}, {"id": 64, "content": "醒得太早", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "其他", "transition": "phase:中间阶段"}, {"id": 65, "content": "必须反复洗手、点数目或触摸某些东西", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "强迫症状", "transition": "phase:中间阶段"}, {"id": 66, "content": "睡得不稳不深", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "其他", "transition": "phase:中间阶段"}, {"id": 67, "content": "有想摔坏或破坏东西的冲动", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "敌对", "transition": "phase:中间阶段"}, {"id": 68, "content": "有一些别人没有的想法或念头", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "偏执", "transition": "phase:中间阶段"}, {"id": 69, "content": "感到对别人神经过敏", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "人际关系敏感", "transition": "phase:中间阶段"}, {"id": 70, "content": "在商店或电影院等人多的地方感到不自在", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "恐怖", "transition": "phase:中间阶段"}, {"id": 71, "content": "感到做任何事情都很困难", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 72, "content": "感到一阵阵恐惧或惊恐", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "焦虑", "transition": "phase:中间阶段"}, {"id": 73, "content": "感到在公共场合吃东西很不舒服", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "人际关系敏感", "transition": "phase:中间阶段"}, {"id": 74, "content": "经常与人争论", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "敌对", "transition": "phase:中间阶段"}, {"id": 75, "content": "单独一人时神经很紧张", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "恐怖", "transition": "phase:中间阶段"}, {"id": 76, "content": "感到别人对你的成绩没有做出恰当的评价", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "偏执", "transition": "phase:中间阶段"}, {"id": 77, "content": "即使和别人在一起也感到孤独", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "精神病性", "transition": "phase:中间阶段"}, {"id": 78, "content": "感到坐立不安、心神不定", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "焦虑", "transition": "phase:中间阶段"}, {"id": 79, "content": "感到自己没有什么价值", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "抑郁", "transition": "phase:中间阶段"}, {"id": 80, "content": "感到熟悉的东西变得陌生或不像是真的", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "焦虑", "transition": "phase:中间阶段"}, {"id": 81, "content": "大叫或摔东西", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "敌对", "transition": "phase:中间阶段"}, {"id": 82, "content": "害怕会在公共场合昏倒", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "恐怖", "transition": "phase:中间阶段"}, {"id": 83, "content": "感到别人想占你的便宜", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "偏执", "transition": "phase:中间阶段"}, {"id": 84, "content": "为一些有关\"性\"的想法而很苦恼", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "精神病性", "transition": "phase:中间阶段"}, {"id": 85, "content": "你认为应该为自己的过错而受到惩罚", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "精神病性", "transition": "phase:中间阶段"}, {"id": 86, "content": "想着要赶快把事情做完", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "焦虑", "transition": "phase:中间阶段"}, {"id": 87, "content": "感到自己的身体有严重问题", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "精神病性", "transition": "phase:中间阶段"}, {"id": 88, "content": "从未感到和其他人很亲近", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "精神病性", "transition": "phase:结束阶段"}, {"id": 89, "content": "感到自己有罪", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "其他", "transition": "phase:结束阶段"}, {"id": 90, "content": "感到自己的脑子有毛病", "options": [{"label": "没有", "score": 1}, {"label": "很轻", "score": 2}, {"label": "中等", "score": 3}, {"label": "偏重", "score": 4}, {"label": "严重", "score": 5}], "dimension": "精神病性", "transition": "phase:结束阶段"}], "id": 1776498370416, "completedCount": 0, "aiDiag": {"enabled": true, "prompt": "你是一位资深临床心理评估咨询师，持有国家二级心理咨询师资质及心理测量专业认证，长期从事心理健康筛查与早期干预工作。请基于用户提交的{scaleName}（SCL-90）自评数据，严格依据中国常模标准与Derogatis原始量表结构进行专业、审慎、共情的AI辅助解读。你需以温暖而坚定的语气，为来访者提供清晰、有温度、有依据的心理健康参考反馈——始终牢记：本结果仅为心理健康状况的初步筛查提示，**不构成任何医学诊断、精神疾病判定或治疗建议**，如存在持续困扰，请务必寻求线下精神科医师或注册心理师的面对面评估。\n\n请严格按以下四部分结构输出诊断报告，所有分析必须基于真实作答数据{answers}与计算所得{score}（含总分、各维度均分、阳性项目数等），并准确映射至{dimensions}中定义的10个因子：\n\n【综合评估】  \n先用1–2句话概括整体心理状态轮廓：结合总分{score.metric_total_score}（正常范围：90–160）、阳性项目数{score.metric_positive_item_count}（正常上限：43）、全局均分{score.metric_global_mean_score}（临界值：2.0），判断当前心理健康筛查总体倾向（“筛查阴性”或“筛查阳性”）。若任一维度均分＞2.0、或总分＞160、或阳性项目数＞43，则明确标注“本次筛查提示存在值得关注的心理不适信号”，并强调这是对近一周主观体验的反映，具有时效性与情境性。\n\n【维度分析】  \n逐项解析{dimensions}中10个维度的实际得分（保留1位小数），紧扣该因子的心理学内涵与题文指向，用生活化语言说明其现实意义：  \n• 躯体化（somatization）：反映身体不适感（如头痛、乏力、胃肠不适等）是否可能与情绪压力相关，而非器质性疾病；  \n• 强迫症状（obsessive_compulsive）：关注反复出现的念头、检查行为或仪式化动作是否干扰日常生活节奏；  \n• 人际关系敏感（interpersonal_sensitivity）：描述在社交中是否易感被评价、难建立信任、回避互动或过度在意他人反应；  \n• 抑郁（depression）：聚焦情绪低落、兴趣减退、精力不足、自我价值感下降等核心体验的强度与频度；  \n• 焦虑（anxiety）：识别紧张不安、心慌出汗、莫名担忧、难以放松等生理与认知表现；  \n• 敌对（hostility）：留意易怒、烦躁、怨恨、争执冲动等情绪反应模式是否频繁出现；  \n• 恐怖（phobia）：指出对特定情境（如人群、封闭空间、社交场合）是否产生明显回避与强烈恐惧；  \n• 偏执（paranoid）：说明是否存在多疑、误解他人意图、感觉被针对或不公平对待的倾向；  \n• 精神病性（psychoticism）：谨慎描述思维松散、幻听幻视倾向、不现实想法、行为怪异等高阶指标（强调此维度高分≠精神病，而是反映思维/感知层面的轻度失序感）；  \n• 其他（other）：涵盖睡眠障碍、饮食紊乱、注意力涣散、健忘等非特异性但影响功能的症状群。  \n⚠️ 对每一项均分＞2.0的维度，须用“您在……方面表现出一定程度的……（具体表现），这可能提示近期压力应对资源有所消耗”句式，避免标签化表述（如禁用“您有强迫症”“您很抑郁”）。\n\n【改善建议】  \n针对得分最高的1–3个异常维度（均分＞2.0且差值最大者优先），提供可操作、具身化、低门槛的自我调节策略：  \n• 若躯体化或焦虑突出：推荐“4-7-8呼吸法”（吸气4秒→屏息7秒→呼气8秒，每日2次，每次3分钟）+ 记录“身体信号-情绪事件”关联日记；  \n• 若强迫症状或抑郁明显：建议启动“微行动启动法”——每天仅完成1件5分钟内可结束的小事（如整理桌面、给植物浇水），重点体验“完成感”而非结果；  \n• 若人际关系敏感或敌对升高：练习“暂停三秒回应法”：当感到被冒犯时，默数3秒再开口，同步轻触拇指与食指感受当下锚点；  \n• 若恐怖或偏执维度升高：引导进行“安全基地想象”练习（闭眼回忆一个绝对安心的场所细节，调动五感沉浸其中，每日1次）；  \n• 所有建议均注明“这些方法旨在增强心理弹性，效果因人而异，坚持1–2周观察自身变化”。\n\n【注意事项】  \n• 再次强调：本报告是基于自评量表的**心理健康快筛参考**，不是诊断工具，不能替代临床面谈、精神科评估或医学检查；  \n• SCL-90反映的是近一周主观体验，状态具有流动性——若近期经历重大生活事件（如考试、离职、亲人离世），结果可能暂时性升高，属正常应激反应；  \n• 若出现以下任一情况，请立即联系专业支持：持续两周以上几乎每天情绪低落/无望感；有伤害自己或他人的念头；出现幻觉、妄想或现实感丧失；无法维持基本饮食、睡眠或自理功能；  \n• 温馨提醒：关注自己，本身就是一种力量。您愿意完成这份量表，已是在照顾自己的重要一步。  \n\n（注：所有数值计算须严格遵循规则——维度分=所含题目原始分平均值；总分=10维度分之和；阳性项目数=原始分≥2的题目数量；全局均分=总分÷90）", "welcome": "根据您的测评结果，我为您生成了以下分析报告。", "temperature": 0.7, "maxTokens": 2000}, "scoring": {"dimensions": [{"key": "somatization", "label": "躯体化", "formula": "AVG", "items": "1,4,12,27,40,42,48,49,52,53,56,58", "condition": null, "interpretation": [{"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}]}, {"key": "obsessive_compulsive", "label": "强迫症状", "formula": "AVG", "items": "3,9,10,28,38,45,46,51,55,65", "condition": null, "interpretation": [{"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}]}, {"key": "interpersonal_sensitivity", "label": "人际关系敏感", "formula": "AVG", "items": "6,21,34,36,37,41,61,69,73", "condition": null, "interpretation": [{"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}]}, {"key": "depression", "label": "抑郁", "formula": "AVG", "items": "5,14,15,20,22,26,29,30,31,32,54,71,79", "condition": null, "interpretation": [{"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}]}, {"key": "anxiety", "label": "焦虑", "formula": "AVG", "items": "2,17,23,33,39,57,72,78,80,86", "condition": null, "interpretation": [{"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}]}, {"key": "hostility", "label": "敌对", "formula": "AVG", "items": "11,24,63,67,74,81", "condition": null, "interpretation": [{"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}]}, {"key": "phobia", "label": "恐怖", "formula": "AVG", "items": "13,25,47,50,70,75,82", "condition": null, "interpretation": [{"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}]}, {"key": "paranoid", "label": "偏执", "formula": "AVG", "items": "8,18,43,68,76,83", "condition": null, "interpretation": [{"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}]}, {"key": "psychoticism", "label": "精神病性", "formula": "AVG", "items": "7,16,35,62,77,84,85,87,88,90", "condition": null, "interpretation": [{"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}]}, {"key": "other", "label": "其他", "formula": "AVG", "items": "19,44,59,60,64,66,89", "condition": null, "interpretation": [{"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}]}], "metrics": [{"key": "metric_total_score", "label": "total_score", "formula": "DERIVED", "items": "ALL", "condition": null, "transform": null, "expression": "somatization + obsessive_compulsive + interpersonal_sensitivity + depression + anxiety + hostility + phobia + paranoid + psychoticism + other"}, {"key": "metric_global_mean_score", "label": "global_mean_score", "formula": "AVG", "items": "ALL", "condition": null, "transform": null}, {"key": "metric_positive_item_count", "label": "positive_item_count", "formula": "COUNT_IF", "items": "ALL", "condition": {">=": 2}, "transform": null}, {"key": "metric_negative_item_count", "label": "negative_item_count", "formula": "COUNT_IF", "items": "ALL", "condition": {"==": 1}, "transform": null}, {"key": "metric_positive_symptom_avg", "label": "positive_symptom_avg", "formula": "DERIVED", "items": "ALL", "condition": null, "transform": null, "expression": "(total_score-negative_item_count)/positive_item_count"}], "interpretation": [{"metric": "metric_total_score", "min": 90, "max": 160, "level": "normal", "label": "正常", "color": "#43a047", "text": "无明显心理不适症状"}, {"metric": "metric_total_score", "min": 160, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在明显心理不适症状"}, {"metric": "metric_positive_item_count", "max": 43, "level": "normal", "label": "正常", "color": "#43a047", "text": "有症状项目数处于正常范围"}, {"metric": "metric_positive_item_count", "min": 43, "level": "mild", "label": "异常", "color": "#e53935", "text": "有症状项目数超出正常范围"}, {"metric": "somatization", "max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"metric": "somatization", "min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}, {"metric": "obsessive_compulsive", "max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"metric": "obsessive_compulsive", "min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}, {"metric": "interpersonal_sensitivity", "max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"metric": "interpersonal_sensitivity", "min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}, {"metric": "depression", "max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"metric": "depression", "min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}, {"metric": "anxiety", "max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"metric": "anxiety", "min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}, {"metric": "hostility", "max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"metric": "hostility", "min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}, {"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}, {"max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}, {"metric": "psychoticism", "max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"metric": "psychoticism", "min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}, {"metric": "other", "max": 2, "level": "normal", "label": "正常", "color": "#43a047", "text": "无该因子相关症状"}, {"metric": "other", "min": 2, "level": "mild", "label": "异常", "color": "#e53935", "text": "存在该因子相关症状"}], "screening": {"logic": "OR", "conditions": [{"metric": "somatization", "op": ">", "value": 160, "label": "总分异常"}, {"metric": "somatization", "op": ">", "value": 43, "label": "阳性项目数异常"}, {"metric": "somatization", "op": ">", "value": 2, "label": "躯体化因子异常"}, {"metric": "somatization", "op": ">", "value": 2, "label": "强迫症状因子异常"}, {"metric": "somatization", "op": ">", "value": 2, "label": "人际关系敏感因子异常"}, {"metric": "somatization", "op": ">", "value": 2, "label": "抑郁因子异常"}, {"metric": "somatization", "op": ">", "value": 2, "label": "焦虑因子异常"}, {"metric": "somatization", "op": ">", "value": 2, "label": "敌对因子异常"}, {"metric": "somatization", "op": ">", "value": 2, "label": "恐怖因子异常"}, {"metric": "somatization", "op": ">", "value": 2, "label": "偏执因子异常"}, {"metric": "somatization", "op": ">", "value": 2, "label": "精神病性因子异常"}, {"metric": "somatization", "op": ">", "value": 2, "label": "其他因子异常"}], "positiveLabel": "筛查阳性", "negativeLabel": "筛查阴性"}}}, {"name": "儿童问题特质问卷", "shortName": "CPTI", "code": "CPTI", "category": "spirit", "categoryName": "心理健康与精神病态量表", "emoji": "🎒", "color": "#4a90d9", "duration": 14, "questionTime": 30, "questionCount": 28, "applicablePeople": "3~12 岁儿童", "desc": "儿童问题特质问卷（CPTI）由荷兰、瑞典学者联合开发，专为3~12 岁儿童设计，填补了 3~6 岁学前儿童问题特质评估的工具空白。量表基于精神病态三因子模型编制，用于评估儿童浮夸欺骗、冷酷无情、冲动刺激追寻三类核心问题特质，助力早期识别儿童行为与品行倾向。量表共 28 题，采用 4 级评分，可由教师或母亲评定，信效度优良、评估精准，结果仅作为儿童行为参考依据。", "instruction": "以下题目描述了儿童常见的行为表现，请您根据孩子日常真实的行为状态，判断每句话与孩子的符合程度，在对应选项上做标记。其中：1 = 一点也不符合，2 = 不是很符合，3 = 基本符合，4 = 非常符合。", "notice": ["依据孩子日常真实表现作答，不凭一时印象评判。", "每题仅选择一个最符合的选项，不漏评、不重复。", "独立完成评定，不与他人商量或受他人影响。", "结果严格保密，仅用于儿童行为评估参考。"], "tags": ["人格测试"], "status": 1, "sortOrder": 0, "rating": 5, "npcConfig": {"counselorId": "", "backgroundId": ""}, "questions": [{"id": 1, "content": "他/她喜欢改变(如兴趣爱好、行为方式等),并且经常改变", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冲动刺激追寻(INS)", "transition": "phase:开始阶段"}, {"id": 2, "content": "他/她很少对他人表现出同情", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冷酷无情(CU)", "transition": "phase:开始阶段"}, {"id": 3, "content": "他/她经常不能耐心等待", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冲动刺激追寻(INS)", "transition": "phase:开始阶段"}, {"id": 4, "content": "他/她通常不在乎别人所分享的快乐和忧伤", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冷酷无情(CU)", "transition": "phase:中间阶段"}, {"id": 5, "content": "他/她经常因为逃避问题而撒谎", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "浮夸欺骗(GD)", "transition": "phase:中间阶段"}, {"id": 6, "content": "他/她看起来只是为了寻求新鲜感而去做某件事情", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冲动刺激追寻(INS)", "transition": "phase:中间阶段"}, {"id": 7, "content": "他/她觉得自己比其他孩子都要优秀", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "浮夸欺骗(GD)", "transition": "phase:中间阶段"}, {"id": 8, "content": "他/她从来不会为其做过的事而惭愧", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冷酷无情(CU)", "transition": "phase:中间阶段"}, {"id": 9, "content": "他/她经常为了得到自己想要的而撒谎", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "浮夸欺骗(GD)", "transition": "phase:中间阶段"}, {"id": 10, "content": "他/她总是着急地给自己更换不同的东西", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冲动刺激追寻(INS)", "transition": "phase:中间阶段"}, {"id": 11, "content": "在其他孩子伤心的时候,他/她经常表现得很冷漠", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冷酷无情(CU)", "transition": "phase:中间阶段"}, {"id": 12, "content": "他/她经常冲动行事", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冲动刺激追寻(INS)", "transition": "phase:中间阶段"}, {"id": 13, "content": "在别人受伤的时候,他/她并不感到不安或难过", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冷酷无情(CU)", "transition": "phase:中间阶段"}, {"id": 14, "content": "他/她经常有什么东西就用掉而不是留着", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冲动刺激追寻(INS)", "transition": "phase:中间阶段"}, {"id": 15, "content": "与同龄人相比,他/她更经常撒谎", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "浮夸欺骗(GD)", "transition": "phase:中间阶段"}, {"id": 16, "content": "他/她看起来很讨厌一成不变并喜欢寻求新异的感觉和体验", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冲动刺激追寻(INS)", "transition": "phase:中间阶段"}, {"id": 17, "content": "他/她做了不被允许的事时很少感到懊悔", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冷酷无情(CU)", "transition": "phase:中间阶段"}, {"id": 18, "content": "他/她经常以高傲自大的态度对人", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "浮夸欺骗(GD)", "transition": "phase:中间阶段"}, {"id": 19, "content": "他/她不喜欢等待", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冲动刺激追寻(INS)", "transition": "phase:中间阶段"}, {"id": 20, "content": "他/她大多数时候看起来并不在乎别人的感受和想法", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冷酷无情(CU)", "transition": "phase:中间阶段"}, {"id": 21, "content": "他/她认为通过欺骗他人来达到目的是有效的", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "浮夸欺骗(GD)", "transition": "phase:中间阶段"}, {"id": 22, "content": "有时候他/她看起来不会感到懊悔", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冷酷无情(CU)", "transition": "phase:中间阶段"}, {"id": 23, "content": "他/她看起来很容易感到厌烦", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冲动刺激追寻(INS)", "transition": "phase:中间阶段"}, {"id": 24, "content": "他/她认为自己几乎在任何事上都做得比其他孩子好", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "浮夸欺骗(GD)", "transition": "phase:中间阶段"}, {"id": 25, "content": "他/她做了不被允许的事时并没有表现出内疚", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冷酷无情(CU)", "transition": "phase:中间阶段"}, {"id": 26, "content": "对他/她来说,撒谎似乎已经是家常便饭了", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "浮夸欺骗(GD)", "transition": "phase:结束阶段"}, {"id": 27, "content": "他/她不会表现出和同龄人同样程度的内疚", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冷酷无情(CU)", "transition": "phase:结束阶段"}, {"id": 28, "content": "他/她总是喜新厌旧", "options": [{"id": "A", "label": "一点也不符合", "score": 1}, {"id": "B", "label": "不是很符合", "score": 2}, {"id": "C", "label": "基本符合", "score": 3}, {"id": "D", "label": "非常符合", "score": 4}], "dimension": "冲动刺激追寻(INS)", "transition": "phase:结束阶段"}], "id": 1776503949320, "completedCount": 0, "aiDiag": {"enabled": true, "prompt": "你是一位资深儿童心理评估咨询师，专注于3–12岁儿童早期行为特质与发展性风险的科学识别与教育支持。你熟悉儿童精神病态三因子模型的理论基础与临床应用，尤其擅长解读《儿童问题特质问卷》（CPTI）的维度结构、计分逻辑与发展意义。请基于用户提交的完整作答数据，严格依据CPTI官方信效度标准与年龄适配性原则，生成一份结构清晰、语言温暖、专业严谨的AI辅助评估反馈。输出必须严格遵循以下四段式结构，且仅使用指定变量：{scaleName}、{score}、{level}、{dimensions}、{answers}。\n\n【综合评估】  \n以整体发展视角出发，结合总分{score.total_score}所处水平（{level.total_score}），简明概括该儿童当前问题特质的整体表现倾向；强调此结果反映的是可塑性较强的发展性行为风格，而非固定人格标签，重申“低/中/高水平”仅表示相对强度，不等同于病理诊断。\n\n【维度分析】  \n逐一对三个核心维度进行具象化解读：  \n• 针对{dimensions.dim_浮夸欺骗}（得分：{score.dim_浮夸欺骗}，水平：{level.dim_浮夸欺骗}），联系Q5/Q7/Q9/Q15/Q18/Q21/Q24/Q26所测量的自我呈现方式，说明其在日常互动中可能表现出的言语真实性、成就归因倾向、对他人评价的敏感度等具体行为线索；  \n• 针对{dimensions.dim_冷酷无情}（得分：{score.dim_冷酷无情}，水平：{level.dim_冷酷无情}），结合Q2/Q4/Q8/Q11/Q13/Q17/Q20/Q22/Q25/Q27所指向的情绪反应性、共情回应、愧疚体验与关怀行为，描述其在同伴冲突、他人痛苦情境、规则后果承担中的典型表现；  \n• 针对{dimensions.dim_冲动刺激追寻}（得分：{score.dim_冲动刺激追寻}，水平：{level.dim_冲动刺激追寻}），依据Q1/Q3/Q6/Q10/Q12/Q14/Q16/Q19/Q23/Q28所捕捉的行为调控特征，说明其在等待任务、课堂专注、活动转换、新奇偏好及挫折耐受等方面的发展现状。  \n所有分析须紧扣题项行为锚点，避免抽象推断，体现“行为—特质—发展意义”的逻辑链条。\n\n【改善建议】  \n按维度提供家庭与学校协同可操作的具体策略：  \n• 若{level.dim_浮夸欺骗}为中/高水平：建议采用“事实复述法”（如温和澄清事件细节）、“成就归因训练”（引导将成功归因于努力而非天赋）、“角色互换游戏”增强观点采择能力；  \n• 若{level.dim_冷酷无情}为中/高水平：推荐“情绪命名日记”（共同标注绘本人物情绪）、“关怀微行动”（每日一件帮助他人的小事）、“后果可视化板”（用图片呈现行为对他人感受的影响）；  \n• 若{level.dim_冲动刺激追寻}为中/高水平：提供“暂停信号卡”（设定身体/语言暂停提示）、“选择菜单制”（在合理范围内提供2–3个活动选项以满足自主需求）、“延迟满足阶梯练习”（从1分钟等待逐步延至5分钟）。  \n所有建议需匹配3–12岁儿童认知与执行功能发展阶段，拒绝成人化要求。\n\n【注意事项】  \n明确声明：本反馈基于{scaleName}标准化工具的常模参照结果，{answers}为评定者主观观察的整合反映，受情境、关系、文化及评定者状态影响；结果仅作为了解儿童行为风格与发展支持方向的参考依据，**不构成任何医学诊断、精神障碍判定或司法证据**；若任一维度达高水平，强烈建议由具备儿童心理评估资质的专业人员开展面对面多源（家长、教师、儿童自评）综合评估；切勿单独依据本报告贴标签、惩罚或过度干预——每个孩子都在动态成长中，早期特质表现具有高度可塑性与教育响应性。", "welcome": "根据您的测评结果，我为您生成了以下分析报告。", "temperature": 0.7, "maxTokens": 2000}, "scoring": {"dimensions": [{"key": "dim_浮夸欺骗", "label": "浮夸欺骗", "formula": "SUM", "items": "5,7,9,15,18,21,24,26", "condition": null, "interpretation": [{"max": 10.74, "level": "normal", "label": "低水平", "color": "#43a047", "text": "无自我中心/欺骗倾向"}, {"min": 10.75, "max": 18.92, "level": "mild", "label": "中等水平", "color": "#fb8c00", "text": "存在一定程度的自我夸大或不诚实表现"}, {"min": 18.93, "level": "moderate", "label": "高水平", "color": "#e53935", "text": "惯于撒谎、高傲自大，需关注行为引导"}]}, {"key": "dim_冷酷无情", "label": "冷酷无情", "formula": "SUM", "items": "2,4,8,11,13,17,20,22,25,27", "condition": null, "interpretation": [{"max": 14.3, "level": "normal", "label": "低水平", "color": "#43a047", "text": "共情能力正常，有愧疚感和同情心"}, {"min": 14.31, "max": 24.84, "level": "mild", "label": "中等水平", "color": "#fb8c00", "text": "偶有冷漠、缺乏情绪反应或共情不足"}, {"min": 24.85, "level": "moderate", "label": "高水平", "color": "#e53935", "text": "冷漠、无愧疚、缺乏同情，需专业评估与干预"}]}, {"key": "dim_冲动刺激追寻", "label": "冲动刺激追寻", "formula": "SUM", "items": "1,3,6,10,12,14,16,19,23,28", "condition": null, "interpretation": [{"max": 15.44, "level": "normal", "label": "低水平", "color": "#43a047", "text": "自控良好，能延迟满足，不易厌烦"}, {"min": 15.45, "max": 25.14, "level": "mild", "label": "中等水平", "color": "#fb8c00", "text": "偶有冲动、注意力易分散、寻求新奇刺激"}, {"min": 25.15, "level": "moderate", "label": "高水平", "color": "#e53935", "text": "高度冲动、难以等待、易厌烦、过度追求刺激"}]}], "metrics": [{"key": "total_score", "label": "", "formula": "DERIVED", "items": "ALL", "condition": null, "transform": null, "expression": "dim_浮夸欺骗 + dim_冷酷无情 + dim_冲动刺激追寻"}], "interpretation": [{"metric": "dim_浮夸欺骗", "max": 10.74, "level": "normal", "label": "低水平", "color": "#43a047", "text": "无自我中心/欺骗倾向"}, {"metric": "dim_浮夸欺骗", "min": 10.75, "max": 18.92, "level": "mild", "label": "中等水平", "color": "#fb8c00", "text": "存在一定程度的自我夸大或不诚实表现"}, {"metric": "dim_浮夸欺骗", "min": 18.93, "level": "moderate", "label": "高水平", "color": "#e53935", "text": "惯于撒谎、高傲自大，需关注行为引导"}, {"metric": "dim_冷酷无情", "max": 14.3, "level": "normal", "label": "低水平", "color": "#43a047", "text": "共情能力正常，有愧疚感和同情心"}, {"metric": "dim_冷酷无情", "min": 14.31, "max": 24.84, "level": "mild", "label": "中等水平", "color": "#fb8c00", "text": "偶有冷漠、缺乏情绪反应或共情不足"}, {"metric": "dim_冷酷无情", "min": 24.85, "level": "moderate", "label": "高水平", "color": "#e53935", "text": "冷漠、无愧疚、缺乏同情，需专业评估与干预"}, {"metric": "dim_冲动刺激追寻", "max": 15.44, "level": "normal", "label": "低水平", "color": "#43a047", "text": "自控良好，能延迟满足，不易厌烦"}, {"metric": "dim_冲动刺激追寻", "min": 15.45, "max": 25.14, "level": "mild", "label": "中等水平", "color": "#fb8c00", "text": "偶有冲动、注意力易分散、寻求新奇刺激"}, {"metric": "dim_冲动刺激追寻", "min": 25.15, "level": "moderate", "label": "高水平", "color": "#e53935", "text": "高度冲动、难以等待、易厌烦、过度追求刺激"}, {"max": 41.62, "level": "normal", "label": "低水平", "color": "#43a047", "text": "问题特质轻微，心理健康状况良好"}, {"min": 41.63, "max": 67.76, "level": "mild", "label": "中等水平", "color": "#fb8c00", "text": "存在一定问题特质倾向，建议观察与教育引导"}, {"min": 67.77, "level": "moderate", "label": "高水平", "color": "#e53935", "text": "问题特质显著，需重点关注、家庭-学校协同干预"}], "screening": null}}, {"name": "反应性-主动性攻击量表（简式中文版）", "shortName": "RPQ-SC", "code": "RPQ_SC", "category": "spirit", "categoryName": "心理健康与精神病态量表", "emoji": "🎯", "color": "#4a90d9", "duration": 6, "questionTime": 30, "questionCount": 11, "applicablePeople": "", "desc": "反应性 - 主动性攻击量表（简式中文版）由原版简化编制，共 11 题，分两维度自评攻击行为，信效度佳、作答快，适配多类测评场景。", "instruction": "请依据自身真实情况，为下列说法选最贴合的答案。1 = 从来没有，2 = 有时，3 = 经常。", "notice": ["独立完成填写", "按真实情况作答", "无需过度思考", "每题仅选一个答案", "完成全部题目"], "tags": ["专业量表"], "status": 1, "sortOrder": 0, "rating": 5, "npcConfig": {"counselorId": "", "backgroundId": ""}, "questions": [{"id": 1, "content": "当他人故意惹我生气时，我会发火", "options": [{"id": "A", "label": "从来没有", "score": 1}, {"id": "B", "label": "有时", "score": 2}, {"id": "C", "label": "经常", "score": 3}], "dimension": "反应性攻击(RA)", "transition": "phase:开始阶段"}, {"id": 2, "content": "当有人伤害我时，我会还击", "options": [{"id": "A", "label": "从来没有", "score": 1}, {"id": "B", "label": "有时", "score": 2}, {"id": "C", "label": "经常", "score": 3}], "dimension": "反应性攻击(RA)", "transition": "phase:开始阶段"}, {"id": 3, "content": "当有人威胁我时，我会变得愤怒", "options": [{"id": "A", "label": "从来没有", "score": 1}, {"id": "B", "label": "有时", "score": 2}, {"id": "C", "label": "经常", "score": 3}], "dimension": "反应性攻击(RA)", "transition": "phase:开始阶段"}, {"id": 4, "content": "当事情不顺利时，我会变得沮丧", "options": [{"id": "A", "label": "从来没有", "score": 1}, {"id": "B", "label": "有时", "score": 2}, {"id": "C", "label": "经常", "score": 3}], "dimension": "反应性攻击(RA)", "transition": "phase:中间阶段"}, {"id": 5, "content": "当有人冤枉我时，我会很生气", "options": [{"id": "A", "label": "从来没有", "score": 1}, {"id": "B", "label": "有时", "score": 2}, {"id": "C", "label": "经常", "score": 3}], "dimension": "反应性攻击(RA)", "transition": "phase:中间阶段"}, {"id": 6, "content": "当有人嘲笑我时，我会动手", "options": [{"id": "A", "label": "从来没有", "score": 1}, {"id": "B", "label": "有时", "score": 2}, {"id": "C", "label": "经常", "score": 3}], "dimension": "反应性攻击(RA)", "transition": "phase:中间阶段"}, {"id": 7, "content": "当他人挑起事端时，我会很快还手", "options": [{"id": "A", "label": "从来没有", "score": 1}, {"id": "B", "label": "有时", "score": 2}, {"id": "C", "label": "经常", "score": 3}], "dimension": "反应性攻击(RA)", "transition": "phase:中间阶段"}, {"id": 8, "content": "我会为了得到想要的东西而威胁他人", "options": [{"id": "A", "label": "从来没有", "score": 1}, {"id": "B", "label": "有时", "score": 2}, {"id": "C", "label": "经常", "score": 3}], "dimension": "主动性攻击(PA)", "transition": "phase:中间阶段"}, {"id": 9, "content": "我会主动攻击他人以夺取物品", "options": [{"id": "A", "label": "从来没有", "score": 1}, {"id": "B", "label": "有时", "score": 2}, {"id": "C", "label": "经常", "score": 3}], "dimension": "主动性攻击(PA)", "transition": "phase:结束阶段"}, {"id": 10, "content": "我会为了好玩而欺负或威胁他人", "options": [{"id": "A", "label": "从来没有", "score": 1}, {"id": "B", "label": "有时", "score": 2}, {"id": "C", "label": "经常", "score": 3}], "dimension": "主动性攻击(PA)", "transition": "phase:结束阶段"}, {"id": 11, "content": "我会主动伤害或打击他人", "options": [{"id": "A", "label": "从来没有", "score": 1}, {"id": "B", "label": "有时", "score": 2}, {"id": "C", "label": "经常", "score": 3}], "dimension": "主动性攻击(PA)", "transition": "phase:结束阶段"}], "id": 1776504488269, "completedCount": 18, "aiDiag": {"enabled": true, "prompt": "你是一位经验丰富的心理评估咨询师，正在为来访者解读《{scaleName}》（RPQ_SC）的测评结果。请基于以下输入数据，严格遵循结构化输出要求生成专业、温暖、非病理化的评估反馈：\n\n【输入数据】  \n- 总分：{score}（{level}）  \n- 维度得分：{dimensions}（含反应性攻击与主动性攻击的具体分值及对应水平）  \n- 原始作答：{answers}（11题Likert 3点计分，1=从来没有，2=有时，3=经常）\n\n【输出结构与内容要求】  \n✅ **综合评估**：以整体攻击行为倾向为切入点，结合总分水平（低/中/高），用平实语言描述来访者在人际互动中表现出的整体行为风格特征（如“更倾向于即时回应压力”或“较常以目标为导向调整行为方式”），强调这是可理解、可调节的心理反应模式，而非人格定性。  \n\n✅ **维度分析**：  \n- 针对「反应性攻击」维度：聚焦Q7–Q9（明确标注题号）所测量的“对感知威胁/挑衅产生的快速、情绪驱动的防御性反应”，结合其得分水平，具体说明其在日常中可能的表现（如易被误解而激动、冲突升级较快、事后易自责等），避免使用“冲动控制障碍”等临床标签；  \n- 针对「主动性攻击」维度：指出该维度实际由Q1–Q6、Q10–Q11共9题构成（注：题干虽未标注，但根据量表编制逻辑及维度归属推断，Q1–Q6、Q10–Q11为主动性攻击条目；Q7–Q9为反应性攻击条目；Q8在原始描述中重复列为反应性，此处以Q7–Q9为反应性核心，其余为主动性），解释其反映的是“为达成目标（如维护权威、获取资源、确立边界）而有意识规划并实施影响他人的行为倾向”，结合得分说明其在目标管理、人际策略、自我主张等方面的典型表现（如善于设定界限但偶显强硬、能主动化解矛盾但也可能忽略他人感受等）。  \n\n✅ **改善建议**：  \n- 若反应性攻击得分偏高：推荐具身化调节策略——如“暂停-呼吸-命名情绪”三步法（在冲动升起时默数3秒、做两次腹式呼吸、用一句话标注当前情绪：“我现在感到被冒犯，心跳加快”），并建议通过结构化日记记录触发情境与身体信号，提升前摄觉察；  \n- 若主动性攻击得分偏高：引导区分“坚定”与“支配”，提供替代性行为练习——如用“我需要……”句式替代“你应该……”表达诉求，或在重要沟通前预演三种非对抗性方案；  \n- 若双维均处中高水平：强调两类倾向常共存且具适应价值，建议开展“意图-影响”反思练习（例如：写下一次主动争取某事的初衷，再客观记录他人当时的非语言反应），增强行为与关系结果之间的联结意识。  \n\n✅ **注意事项**：  \n- 明确声明：“本解读基于《{scaleName}》自评结果生成，仅反映近期特定情境下的行为倾向快照，**仅供参考，不构成任何医学诊断、精神障碍判定或临床干预依据**”；  \n- 提醒：攻击行为倾向受情境、压力、睡眠、社会支持等多重因素动态影响，单次测评不能定义个体；  \n- 温和鼓励：“您愿意完成这份量表，本身已体现对自我成长的重视与勇气——这些倾向不是您的全部，而是您可以更懂自己、更从容选择回应方式的重要线索。”\n\n请始终以尊重、去标签、发展性视角组织语言，避免绝对化表述（如“总是”“从不”），多用“可能”“有时”“倾向”等留有弹性的措辞；所有解释须严格锚定量表定义与计分规则，不引申无关理论。", "welcome": "根据您的测评结果，我为您生成了以下分析报告。", "temperature": 0.7, "maxTokens": 2000}, "scoring": {"dimensions": [{"key": "dim_反应性攻击", "label": "反应性攻击", "formula": "SUM", "items": "1-4,8", "condition": null, "interpretation": [{"max": 8, "level": "normal", "label": "低水平", "color": "#43a047", "text": "对挑衅/威胁的冲动性防御性攻击倾向较低"}, {"min": 9, "max": 12, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "存在一定的冲动性攻击反应，程度适中"}, {"min": 13, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "易因感知到威胁/挑衅出现明显冲动性攻击行为"}]}, {"key": "dim_主动性攻击", "label": "主动性攻击", "formula": "SUM", "items": "5-7,9-11", "condition": null, "interpretation": [{"max": 10, "level": "normal", "label": "低水平", "color": "#43a047", "text": "为达成目标而主动发起预谋性攻击的倾向较低"}, {"min": 11, "max": 14, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "存在一定的目的性、预谋性攻击行为，程度适中"}, {"min": 15, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "常为获取利益/主导地位主动实施有计划的攻击行为"}]}], "metrics": [{"key": "metric_total_score", "label": "total_score", "formula": "DERIVED", "items": "ALL", "condition": null, "transform": null, "expression": "dim_反应性攻击 + dim_主动性攻击"}], "interpretation": [{"max": 8, "level": "normal", "label": "低水平", "color": "#43a047", "text": "对挑衅/威胁的冲动性防御性攻击倾向较低"}, {"min": 9, "max": 12, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "存在一定的冲动性攻击反应，程度适中"}, {"min": 13, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "易因感知到威胁/挑衅出现明显冲动性攻击行为"}, {"max": 10, "level": "normal", "label": "低水平", "color": "#43a047", "text": "为达成目标而主动发起预谋性攻击的倾向较低"}, {"min": 11, "max": 14, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "存在一定的目的性、预谋性攻击行为，程度适中"}, {"min": 15, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "常为获取利益/主导地位主动实施有计划的攻击行为"}, {"metric": "metric_total_score", "max": 19, "level": "normal", "label": "低水平", "color": "#43a047", "text": "整体攻击行为倾向较低"}, {"metric": "metric_total_score", "min": 20, "max": 26, "level": "moderate", "label": "中等水平", "color": "#1e88e5", "text": "存在一定攻击行为，类型以反应性或主动性为主"}, {"metric": "metric_total_score", "min": 27, "level": "severe", "label": "高水平", "color": "#7e57c2", "text": "整体攻击行为倾向显著，两类攻击表现均较突出"}], "screening": null}}, {"name": "简易应对方式问卷", "shortName": "SCSQ", "code": "SCSQ", "category": "stresscoping", "categoryName": "应激与应对量表", "emoji": "💪", "color": "#4a90d9", "duration": 10, "questionTime": 30, "questionCount": 20, "applicablePeople": "16岁以上人群", "desc": "解亚宁、张育坤于1995年编制的自评量表，由积极应对和消极应对两个分量表组成，共20个条目。采用4级评分法。", "instruction": "以下列出的是当你在生活中经受挫折打击，或遇到困难时可能采取的态度和做法。请你仔细阅读每一项，然后在最适合你本人情况的数字上画√。其中，不采取代表0，偶尔采取代表1，有时采取代表2，经常采取代表3。", "notice": ["请根据您过去一周的真实感受作答"], "tags": ["应对方式"], "status": 1, "sortOrder": 10, "rating": 5, "npcConfig": {"counselorId": "", "backgroundId": ""}, "questions": [{"id": 1, "content": "通过工作学习或一些其他活动解脱", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:开始阶段"}, {"id": 2, "content": "与他人交谈，倾诉内心烦恼", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:开始阶段"}, {"id": 3, "content": "尽量看到事物好的一面", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:开始阶段"}, {"id": 4, "content": "改变自己的想法，重新发现生活中什么是重要的", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:中间阶段"}, {"id": 5, "content": "不把问题看得太重", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:中间阶段"}, {"id": 6, "content": "坚持自己的立场，为自己想要得到的而斗争", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:中间阶段"}, {"id": 7, "content": "找出几种不同的解决问题的方法", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:中间阶段"}, {"id": 8, "content": "向亲戚朋友或同学寻求帮助", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:中间阶段"}, {"id": 9, "content": "改正自己原来的一些做法或一些问题", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:中间阶段"}, {"id": 10, "content": "借鉴他人处理类似困难情境的办法", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:中间阶段"}, {"id": 11, "content": "寻找业余爱好，积极参加文体活动", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:中间阶段"}, {"id": 12, "content": "尽量克制自己的失望、悔恨、悲伤或愤怒情绪", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "积极应对", "transition": "phase:中间阶段"}, {"id": 13, "content": "试图通过休息或休假，暂时把问题（烦恼）抛开", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "消极应对", "transition": "phase:中间阶段"}, {"id": 14, "content": "通过吸烟、喝酒、服药或吃东西的方式来解除烦恼", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "消极应对", "transition": "phase:中间阶段"}, {"id": 15, "content": "认为时间会改变现状，唯一要做的便是等待", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "消极应对", "transition": "phase:中间阶段"}, {"id": 16, "content": "试图忘记整个事情", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "消极应对", "transition": "phase:中间阶段"}, {"id": 17, "content": "依靠别人解决问题", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "消极应对", "transition": "phase:中间阶段"}, {"id": 18, "content": "接受现实，因为没有其他办法", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "消极应对", "transition": "phase:结束阶段"}, {"id": 19, "content": "幻想可能会发生某种奇迹来改变现状", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "消极应对", "transition": "phase:结束阶段"}, {"id": 20, "content": "自我安慰", "options": [{"id": "A", "label": "不采取", "score": 0}, {"id": "B", "label": "偶尔采取", "score": 1}, {"id": "C", "label": "有时采取", "score": 2}, {"id": "D", "label": "经常采取", "score": 3}], "dimension": "消极应对", "transition": "phase:结束阶段"}], "id": 1777520156864, "completedCount": 0, "scoring": {"dimensions": [{"key": "positive_coping", "label": "积极应对", "formula": "AVG", "items": "1-12", "interpretation": [{"min": 0, "max": 1.26, "level": "normal", "label": "低水平", "color": "#43A047", "text": "低于常模均值−1SD，提示积极应对资源使用较少"}, {"min": 1.27, "max": 2.3, "level": "moderate", "label": "中等水平", "color": "#1E88E5", "text": "处于常模均值±1SD范围内，积极应对方式使用较均衡"}, {"min": 2.31, "max": 3, "level": "severe", "label": "高水平", "color": "#7E57C2", "text": "高于常模均值+1SD，提示积极应对策略使用频繁且突出"}]}, {"key": "negative_coping", "label": "消极应对", "formula": "AVG", "items": "13-20", "interpretation": [{"min": 0, "max": 0.93, "level": "normal", "label": "低水平", "color": "#43A047", "text": "低于常模均值−1SD，提示消极应对行为较少"}, {"min": 0.94, "max": 2.25, "level": "moderate", "label": "中等水平", "color": "#1E88E5", "text": "处于常模均值±1SD范围内，消极应对方式使用较均衡"}, {"min": 2.26, "max": 3, "level": "severe", "label": "高水平", "color": "#7E57C2", "text": "高于常模均值+1SD，提示消极应对策略使用频繁且突出"}]}], "metrics": [{"key": "coping_tendency", "label": "应对倾向", "formula": "DERIVED", "items": "ALL", "expression": "(positive_coping - 1.78) / 0.52 - (negative_coping - 1.59) / 0.66"}], "interpretation": [{"metric": "positive_coping", "min": 0, "max": 1.26, "level": "normal", "label": "低水平", "color": "#43A047", "text": "低于常模均值−1SD，提示积极应对资源使用较少"}, {"metric": "positive_coping", "min": 1.27, "max": 2.3, "level": "moderate", "label": "中等水平", "color": "#1E88E5", "text": "处于常模均值±1SD范围内，积极应对方式使用较均衡"}, {"metric": "positive_coping", "min": 2.31, "max": 3, "level": "severe", "label": "高水平", "color": "#7E57C2", "text": "高于常模均值+1SD，提示积极应对策略使用频繁且突出"}, {"metric": "negative_coping", "min": 0, "max": 0.93, "level": "normal", "label": "低水平", "color": "#43A047", "text": "低于常模均值−1SD，提示消极应对行为较少"}, {"metric": "negative_coping", "min": 0.94, "max": 2.25, "level": "moderate", "label": "中等水平", "color": "#1E88E5", "text": "处于常模均值±1SD范围内，消极应对方式使用较均衡"}, {"metric": "negative_coping", "min": 2.26, "max": 3, "level": "severe", "label": "高水平", "color": "#7E57C2", "text": "高于常模均值+1SD，提示消极应对策略使用频繁且突出"}, {"metric": "coping_tendency", "min": -9999, "max": -0.2, "level": "severe", "label": "消极倾向", "color": "#E53935", "text": "提示个体在应激中更习惯采用消极应对方式"}, {"metric": "coping_tendency", "min": -0.2, "max": 0.2, "level": "moderate", "label": "中性倾向", "color": "#FF6F00", "text": "积极与消极应对倾向基本平衡"}, {"metric": "coping_tendency", "min": 0.2, "max": 9999, "level": "normal", "label": "积极倾向", "color": "#43A047", "text": "提示个体在应激中主要采用积极应对方式"}], "screening": {"logic": "OR", "conditions": [{"label": "消极倾向", "metric": "coping_tendency", "op": "<", "value": -0.2}, {"label": "积极倾向", "metric": "coping_tendency", "op": ">", "value": 0.2}], "positiveLabel": "存在显著应对倾向（积极或消极）", "negativeLabel": "应对倾向中性（无显著主导倾向）"}}, "aiDiag": {"enabled": true, "prompt": "你是一位专业、温暖且富有同理心的心理评估咨询师，正在为来访者解读《简易应对方式问卷》（SCSQ）的测评结果。请基于量表的理论基础、常模标准与临床意义，结合用户真实作答数据，提供一份结构清晰、语言平实、有温度、有依据的个性化反馈报告。报告须严格遵循以下逻辑框架与表达规范：\n\n### 🌟 综合评估  \n以整体应对倾向（coping_tendency）为核心，结合积极应对与消极应对两个维度的水平分布，简明扼要地概括来访者在面对压力时的习惯性反应风格——是更倾向于主动调适、灵活转化，还是容易回避退缩、情绪内耗？强调这是长期形成的适应策略，而非“对错”判断，并点明其现实功能与潜在发展空间。\n\n### 🔍 维度深度解析  \n逐一对 {dimensions} 中每个维度（即“积极应对”与“消极应对”）进行具象化解读：  \n- **积极应对（positive_coping）**：结合该维度定义（如问题解决、寻求支持、认知重构、自我激励等典型行为），说明当前得分水平（{level}）反映其在日常压力中调动建设性资源的频率与稳定性；若为低水平，不归因为“能力不足”，而描述为“尚未形成稳定习惯”；若为高水平，肯定其心理弹性价值，同时提示避免过度承担或忽视情绪信号。  \n- **消极应对（negative_coping）**：紧扣其内涵（如否认、幻想、自责、逃避、物质使用倾向等防御模式），解释当前水平所提示的行为惯性特征；若为低水平，肯定其情绪耐受力与现实感；若为高水平，以非评判语气指出这些方式短期可能缓解痛苦，但长期易加剧压力循环，并关联到具体作答模式（如{answers}中高频选择Q5/Q12/Q18等题目的倾向）。  \n所有分析必须锚定量表原始计分逻辑（AVG均值）、常模区间（±1SD）及临床含义，避免脱离数据空谈。\n\n### 🌱 改善建议  \n建议须具体、可操作、情境化，杜绝“多沟通”“多运动”等泛化表述。例如：  \n1. 若积极应对处于中低水平：可推荐“微行动启动法”——从本周起，每天记录1件自己已采取的小型积极行动（如主动询问同事意见、提前5分钟规划任务），强化自我效能感；  \n2. 若消极应对处于中高水平：可引导识别“触发点时刻”（如Q7/Q14作答较高分者，常在人际冲突后出现回避倾向），练习“暂停-呼吸-命名情绪”三步短干预；  \n3. 若应对倾向呈显著积极或消极倾向：分别提供1个平衡性练习（如积极倾向者尝试每周1次“允许自己休息而不自责”，消极倾向者尝试1次“用中性语言重述困扰事件”）。  \n每条建议需呼应{answers}中的实际作答线索，体现“因人而异”。\n\n### ❤️ 重要提醒  \n- 本报告基于《简易应对方式问卷》（SCSQ）20题自评结果生成，反映的是特定时间点的习惯性应对偏好，**不构成任何医学诊断或精神障碍判定**；  \n- 应对方式具有可塑性，短期练习即可带来感知变化，无需追求“完美应对”；  \n- 若近期经历重大应激事件（如失业、疾病、关系破裂）或持续感到情绪沉重、躯体不适、社会功能下降，请务必联系专业心理咨询师或精神科医生进行面对面评估；  \n- 所有结论仅供自我觉察与成长参考，**不能替代临床诊疗**。\n\n━━━━━━━━━━━━━━━━━━━━  \n【输出格式要求】  \n你只能使用以下 Markdown 语法输出报告，严禁使用任何 HTML 标签：  \n\n✅ 允许使用的格式：  \n- **粗体**：用 \\*\\*文字\\*\\* 包裹  \n- *斜体*：用 \\*文字\\* 包裹  \n- 标题：用 ## 或 ### 开头（不要用 # 一级标题）  \n- 分隔线：独占一行的 ---  \n- 列表：用 - 或数字 1. 2. 3. 开头  \n- 引用：用 > 开头（如话术、引用语等）  \n- 行内代码：用反引号 ` 包裹  \n\n❌ 严禁使用的格式（会导致页面显示异常）：  \n- 禁止使用任何 HTML 标签（如 <div>、<span>、<br>、<p>、<table>、<strong>、<em> 等）  \n- 禁止使用 HTML 表格（<table>）或 CSS 类名（如 diag-table-wrap）  \n- 禁止使用 <br> 换行，请直接用 Markdown 的空行或换行  \n- 禁止输出 Markdown 表格（| 列 | 列 | 格式），如需呈现对比信息请用列表或粗体标题+文字描述替代  \n\n报告结构建议（纯 Markdown）：  \n### 🌟 综合评估  \n（总结性分析文字）  \n---  \n### 🔍 维度深度解析  \n（每个维度一段分析，用粗体标注维度名）  \n---  \n### 🌱 改善建议  \n（用编号列表 1. 2. 3. 组织建议）  \n---  \n### ❤️ 重要提醒  \n（注意事项）  \n━━━━━━━━━━━━━━━━━━━━  \n\n请严格依据输入变量生成报告：  \n- 量表名称：{scaleName}  \n- 总分：{score}  \n- 总分等级：{level}  \n- 维度详情：{dimensions}  \n- 原始作答：{answers}  \n\n始终牢记：你的角色是陪伴者，不是裁判；你的语言是桥梁，不是标尺。", "welcome": "根据您的测评结果，我为您生成了以下分析报告。", "temperature": 0.7, "maxTokens": 2000}}, {"name": "青少年社会支持量表", "shortName": "ASSS", "code": "ASSS", "category": "stresscoping", "categoryName": "应激与应对量表", "emoji": "🎭", "color": "#4a90d9", "duration": 9, "questionTime": 30, "questionCount": 17, "applicablePeople": "中学生和大学生", "desc": "叶悦妹、戴晓阳等于2008年编制的自评量表，以肖水源的社会支持理论模型为基础。包括主观支持、客观支持和支持利用度3个维度，共17个条目。采用5级评分法。", "instruction": "这是一份关于大学生社会支持的量表。请根据你自身与各个项目所描述情况相符合的程度，在每题后相对应的数字上画√。答案无好坏和对错之分，请根据你的真实情况填写，我们承诺对你的资料严格保密。完成这份问卷可能会耽误你一点宝贵的时间，在此我向你表示衷心的感谢!", "notice": ["请根据您过去一周的真实感受作答"], "tags": ["社会支持"], "status": 1, "sortOrder": 10, "rating": 5, "npcConfig": {"counselorId": "", "backgroundId": ""}, "questions": [{"id": 1, "content": "大多数同学都很关心我", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "主观支持", "transition": "phase:开始阶段"}, {"id": 2, "content": "面对两难的选择时，我会主动向他人寻求帮助", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "支持利用度", "transition": "phase:开始阶段"}, {"id": 3, "content": "当有烦恼时，我会主动向家人、亲友倾诉", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "支持利用度", "transition": "phase:开始阶段"}, {"id": 4, "content": "我经常能得到同学、朋友的照顾和支持", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "主观支持", "transition": "phase:中间阶段"}, {"id": 5, "content": "当遇到困难时，我经常会向家人、亲人寻求帮助", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "支持利用度", "transition": "phase:中间阶段"}, {"id": 6, "content": "我周围有许多关系密切，并可以给予我支持和帮助的人", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "主观支持", "transition": "phase:中间阶段"}, {"id": 7, "content": "在我遇到问题时，同学、朋友都会出现在我身旁", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "主观支持", "transition": "phase:中间阶段"}, {"id": 8, "content": "在遇到困难的时候，我可以依靠家人或亲友", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "客观支持", "transition": "phase:中间阶段"}, {"id": 9, "content": "我经常从同学、朋友那里获得情感上的帮助和支持", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "主观支持", "transition": "phase:中间阶段"}, {"id": 10, "content": "我经常能得到家人、亲友的照顾和支持", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "客观支持", "transition": "phase:中间阶段"}, {"id": 11, "content": "当有需要时，我可以从家人、亲友那里得到经济支持", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "客观支持", "transition": "phase:中间阶段"}, {"id": 12, "content": "当遇到麻烦时，我通常会主动寻求别人的帮助", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "支持利用度", "transition": "phase:中间阶段"}, {"id": 13, "content": "当我生病时，总是能得到家人、亲友的照顾", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "客观支持", "transition": "phase:中间阶段"}, {"id": 14, "content": "当有烦恼时，我会主动向同学、朋友倾诉", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "支持利用度", "transition": "phase:中间阶段"}, {"id": 15, "content": "在我遇到问题时，家人、亲友都会出现在我身旁", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "客观支持", "transition": "phase:结束阶段"}, {"id": 16, "content": "我经常从家人、亲友那里获得情感上的帮助和支持", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "客观支持", "transition": "phase:结束阶段"}, {"id": 17, "content": "当遇到困难时，我经常会向同学、朋友寻求帮助", "options": [{"id": "A", "label": "符合", "score": 5}, {"id": "B", "label": "有点符合", "score": 4}, {"id": "C", "label": "不确定", "score": 3}, {"id": "D", "label": "有点不符合", "score": 2}, {"id": "E", "label": "不符合", "score": 1}], "dimension": "支持利用度", "transition": "phase:结束阶段"}], "id": 1777520630731, "completedCount": 0, "scoring": {"dimensions": [{"key": "subjective_support", "label": "主观支持", "formula": "SUM", "items": "1,4,6,7,9"}, {"key": "objective_support", "label": "客观支持", "formula": "SUM", "items": "8,10,11,13,15,16"}, {"key": "support_utilization", "label": "支持利用度", "formula": "SUM", "items": "2,3,5,12,14,17"}], "metrics": [{"key": "totalScore", "label": "总分", "formula": "DERIVED", "items": "ALL", "expression": "subjective_support + objective_support + support_utilization"}], "interpretation": [], "screening": null}, "aiDiag": {"enabled": true, "prompt": "你是一位专业、温暖且富有同理心的心理评估咨询师，专注于青少年心理健康与发展。你正在为一位中学生或大学生解读《{scaleName}》（ASSS）测评结果。请基于量表理论基础（叶悦妹、戴晓阳，2008；以肖水源社会支持三维度模型为框架）、题目内涵与计分逻辑，对用户作答进行严谨而有人文温度的分析。你的任务不是诊断，而是陪伴式理解——帮助来访者更清晰地看见自己在“被理解与接纳”（主观支持）、“实际可获得的支持资源”（客观支持）以及“主动求助、接纳与转化支持的能力”（支持利用度）三个关键成长维度上的状态。\n\n请严格遵循以下结构输出一份纯 Markdown 格式的个性化反馈报告：\n\n### 🌟 综合评估  \n结合总分 {score}（等级：{level}），整体反映该青少年当前感知到的社会支持系统处于[此处根据{level}动态填充：如“较充实”/“基本稳定”/“存在明显薄弱环节”]水平。社会支持是青少年应对学业压力、人际波动与自我认同探索的重要心理缓冲带；本结果不指向缺陷，而是映照出一段值得被温柔看见的成长图景。\n\n---\n### 🔍 维度深度解析  \n**主观支持**：该维度得分 {dimensions[0].score}/{dimensions[0].max}（{dimensions[0].pct}%，{dimensions[0].levelLabel}）——反映其内心是否真切感受到家人、朋友、师长的关心、尊重与情感共鸣。高分常体现较强的归属感与被信任感；若得分偏低，可能并非缺乏支持源，而是因青春期特有的敏感、自我怀疑或表达习惯，暂时“接收不到”他人传递的暖意。  \n**客观支持**：该维度得分 {dimensions[1].score}/{dimensions[1].max}（{dimensions[1].pct}%，{dimensions[1].levelLabel}）——指向现实中可调用的实际支持资源，如困难时能否获得帮助、是否有倾诉对象、家庭是否提供稳定照料等。它不依赖主观感受，而是可观察的行为事实；得分偏低需关注现实支持网络是否存在结构性缺口（如家庭功能弱化、同伴关系疏离）。  \n**支持利用度**：该维度得分 {dimensions[2].score}/{dimensions[2].max}（{dimensions[2].pct}%，{dimensions[2].levelLabel}）——衡量其是否能主动识别需求、开口求助、接纳建议并灵活运用支持资源。这是最具发展性、也最易通过练习提升的维度；得分偏低往往与“怕麻烦别人”“习惯独自硬扛”“不知如何开口”等典型青少年应对模式相关，而非缺乏支持意愿。\n\n---\n### 🌱 改善建议  \n1. **为“主观支持”松动一点期待**：尝试每天记录1件“别人无意中让我感到被看见的小事”（如同学顺手帮你扶起倒下的水杯），连续一周。这不是要求你立刻相信“大家都爱我”，而是训练大脑重新校准对善意的敏感度。  \n2. **给“客观支持”做一次轻量盘点**：列出3个你*实际*可以联系的人（不限于最亲近者），标注他们最可能提供的支持类型（如：A同学→听你吐槽；B老师→给学习方法建议；C家人→陪你散步）。不必立刻行动，先让这张“支持地图”在心里清晰起来。  \n3. **把“支持利用度”变成一个微小动作**：下次遇到小困扰（如作业卡壳、心情低落），只做一件小事：向名单中的1个人发送一句具体请求，例如“XX，这道题我卡住了，能花2分钟帮我看看第一步吗？”——重点在“具体”和“限时”，降低双方压力。  \n\n---\n### ❤️ 重要提醒  \n> 本报告基于《青少年社会支持量表》（ASSS）的标准化施测与计分规则生成，旨在提供发展性参考视角。  \n> 社会支持状态具有情境性与动态性，单次测评结果不能定义一个人的价值或长期心理状态；它更像一张快照，捕捉的是此刻与重要他人联结的某种质地。  \n> 若近期持续感到孤独、无助、情绪沉重或有自伤/自杀念头，请务必及时联系学校心理老师、信任的成年人，或拨打全国希望24热线：400-161-9995（生命热线，24小时免费）。  \n> **本报告仅供参考，不构成任何形式的医学诊断、治疗建议或心理干预方案。**\n\n━━━━━━━━━━━━━━━━━━━━  \n【输出格式要求】  \n你只能使用以下 Markdown 语法输出报告，严禁使用任何 HTML 标签：  \n\n✅ 允许使用的格式：  \n- **粗体**：用 \\*\\*文字\\*\\* 包裹  \n- *斜体*：用 \\*文字\\* 包裹  \n- 标题：用 ## 或 ### 开头（不要用 # 一级标题）  \n- 分隔线：独占一行的 ---  \n- 列表：用 - 或数字 1. 2. 3. 开头  \n- 引用：用 > 开头（如话术、引用语等）  \n- 行内代码：用反引号 ` 包裹  \n\n❌ 严禁使用的格式（会导致页面显示异常）：  \n- 禁止使用任何 HTML 标签（如 <div>、<span>、<br>、<p>、<table>、<strong>、<em> 等）  \n- 禁止使用 HTML 表格（<table>）或 CSS 类名（如 diag-table-wrap）  \n- 禁止使用 <br> 换行，请直接用 Markdown 的空行或换行  \n- 禁止输出 Markdown 表格（| 列 | 列 | 格式），如需呈现对比信息请用列表或粗体标题+文字描述替代  \n\n报告结构建议（纯 Markdown）：  \n### 🌟 综合评估  \n（总结性分析文字）  \n---  \n### 🔍 维度深度解析  \n（每个维度一段分析，用粗体标注维度名）  \n---  \n### 🌱 改善建议  \n（用编号列表 1. 2. 3. 组织建议）  \n---  \n### ❤️ 重要提醒  \n（注意事项）  \n━━━━━━━━━━━━━━━━━━━━", "welcome": "根据您的测评结果，我为您生成了以下分析报告。", "temperature": 0.7, "maxTokens": 2000}}, {"name": "社会支持评定量表(SSRS)", "shortName": "SSRS", "code": "SSRS", "category": "stresscoping", "categoryName": "应激与应对量表", "emoji": "📋", "color": "#4a90d9", "duration": 5, "questionTime": 30, "questionCount": 10, "applicablePeople": "成年人", "desc": "肖水源1986年编制，1990年修订。包括主观支持、客观支持和社会支持利用度3个维度，共10个条目。用于评估个体社会支持水平。", "instruction": "下面的问题用于反映你在社会中所获得的支持，请按各个问题的具体要求，根据你的实际情况填写。", "notice": ["请根据您过去一周的真实感受作答"], "tags": ["社会支持"], "status": 1, "sortOrder": 10, "rating": 5, "npcConfig": {"counselorId": "counselor_1776389950092", "backgroundId": "bg_new_1777265450382"}, "questions": [{"id": 1, "content": "你有多少个关系密切，并可以得到支持和帮助的朋友(只选一项)", "options": [{"id": "A", "label": "一个也没有", "score": 1}, {"id": "B", "label": "1~2个", "score": 2}, {"id": "C", "label": "3~5个", "score": 3}, {"id": "D", "label": "6个或6个以上", "score": 4}], "dimension": "主观支持", "transition": "phase:开始阶段"}, {"id": 2, "content": "你近1年来(只选一项)", "options": [{"id": "A", "label": "远离家人，且独居一室", "score": 1}, {"id": "B", "label": "住处经常变动，多数时间和陌生人住在一起", "score": 2}, {"id": "C", "label": "和同学、同事或朋友住在一起", "score": 3}, {"id": "D", "label": "和家人住在一起", "score": 4}], "dimension": "客观支持", "transition": "phase:开始阶段"}, {"id": 3, "content": "你与邻居(只选一项)", "options": [{"id": "A", "label": "相互之间从不关心，只是点头之交", "score": 1}, {"id": "B", "label": "遇到困难可能稍微关心", "score": 2}, {"id": "C", "label": "有些邻居很关心你", "score": 3}, {"id": "D", "label": "大多数邻居都很关心你", "score": 4}], "dimension": "主观支持", "transition": "phase:开始阶段"}, {"id": 4, "content": "你与同事(只选一项)", "options": [{"id": "A", "label": "相互之间从不关心，只是点头之交", "score": 1}, {"id": "B", "label": "遇到困难可能稍微关心", "score": 2}, {"id": "C", "label": "有些同事很关心你", "score": 3}, {"id": "D", "label": "大多数同事都很关心你", "score": 4}], "dimension": "主观支持", "transition": "phase:中间阶段"}, {"id": 5, "content": "从家庭成员中得到的支持和照顾(在合适的框内画\"√\")", "options": [{"id": "A", "label": "无", "score": 1}, {"id": "B", "label": "极少", "score": 2}, {"id": "C", "label": "一般", "score": 3}, {"id": "D", "label": "全力支持", "score": 4}], "dimension": "主观支持", "type": "matrix", "rows": [{"id": "row_1", "label": "A.夫妻(恋人)"}, {"id": "row_2", "label": "B.父母"}, {"id": "row_3", "label": "C.儿女"}, {"id": "row_4", "label": "D.兄弟姐妹"}, {"id": "row_5", "label": "E.其他成员(如嫂子)"}], "transition": "phase:中间阶段"}, {"id": 6, "content": "过去，在你遇到急难情况时，曾经得到的经济支持和解决实际问题的帮助的来源", "options": [{"id": "A", "label": "无任何来源", "score": 0, "isTerminal": true}, {"id": "B", "label": "下列来源(可选多项)", "score": 1, "hasChildren": true}], "dimension": "客观支持", "type": "parent-child", "subOptions": [{"id": "sub_1", "label": "配偶"}, {"id": "sub_2", "label": "其他家人"}, {"id": "sub_3", "label": "朋友"}, {"id": "sub_4", "label": "亲戚"}, {"id": "sub_5", "label": "同事"}, {"id": "sub_6", "label": "工作单位"}, {"id": "sub_7", "label": "党团工会等官方或半官方组织"}, {"id": "sub_8", "label": "宗教、社会团体等非官方组织"}, {"id": "sub_9", "label": "其他"}], "transition": "phase:中间阶段"}, {"id": 7, "content": "过去，在你遇到急难情况时，曾经得到的安慰和关心的来源", "options": [{"id": "A", "label": "无任何来源", "score": 0, "isTerminal": true}, {"id": "B", "label": "下列来源(可选多项)", "score": 1, "hasChildren": true}], "dimension": "客观支持", "type": "parent-child", "subOptions": [{"id": "sub_1", "label": "配偶"}, {"id": "sub_2", "label": "其他家人"}, {"id": "sub_3", "label": "朋友"}, {"id": "sub_4", "label": "亲戚"}, {"id": "sub_5", "label": "同事"}, {"id": "sub_6", "label": "工作单位"}, {"id": "sub_7", "label": "党团工会等官方或半官方组织"}, {"id": "sub_8", "label": "宗教、社会团体等非官方组织"}, {"id": "sub_9", "label": "其他"}], "transition": "phase:中间阶段"}, {"id": 8, "content": "当你遇到烦恼时的倾诉方式(只选一项)", "options": [{"id": "A", "label": "从不向任何人倾诉", "score": 1}, {"id": "B", "label": "只向关系极为密切的1~2个人倾诉", "score": 2}, {"id": "C", "label": "如果朋友主动询问你时会说出来", "score": 3}, {"id": "D", "label": "主动倾诉自己的烦恼，以获得支持和理解", "score": 4}], "dimension": "社会支持利用度", "transition": "phase:结束阶段"}, {"id": 9, "content": "当你遇到烦恼时的求助方式(只选一项)", "options": [{"id": "A", "label": "只靠自己，不接受别人的帮助", "score": 1}, {"id": "B", "label": "很少请求别人的帮助", "score": 2}, {"id": "C", "label": "有时请求别人的帮助", "score": 3}, {"id": "D", "label": "有困难时经常向家人、亲友、组织求助", "score": 4}], "dimension": "社会支持利用度", "transition": "phase:结束阶段"}, {"id": 10, "content": "你对于团体(如党团组织、宗教组织、工会、学生会等)组织活动(只选一项)", "options": [{"id": "A", "label": "从不参加", "score": 1}, {"id": "B", "label": "偶尔参加", "score": 2}, {"id": "C", "label": "经常参加", "score": 3}, {"id": "D", "label": "主动参加并积极活动", "score": 4}], "dimension": "社会支持利用度", "transition": "phase:结束阶段"}], "id": 1777627717091, "completedCount": 0, "aiDiag": {"enabled": true, "prompt": "你是一位专业、温暖且富有同理心的心理评估咨询师，正在为来访者解读其完成的{scaleName}测评结果。请基于以下科学依据与临床经验，生成一份结构清晰、语言平实、有温度的专业反馈报告：\n\n- 本量表由肖水源教授于1986年编制、1990年修订，专为成年人设计，从**主观感受、客观资源、利用能力**三个相互关联又各有侧重的层面，系统评估个体所处的社会支持生态；\n- 主观支持（Q1/Q3/Q4/Q5）反映个体对“被关心、被理解、被接纳”的内在体验——它不取决于他人是否实际提供帮助，而在于你是否真切感受到情感联结与归属感；\n- 客观支持（Q2/Q6/Q7）测量可观察、可验证的支持资源存在状况——包括居住安排、实际可求助的人际网络及组织资源，是社会支持的“硬件基础”；\n- 社会支持利用度（Q8/Q9/Q10）则聚焦行为模式——你是否愿意开口、能否识别求助时机、是否主动参与支持性关系或活动，体现的是支持系统的“激活状态”；\n- 总分{score}分（满分40分），属于{level}水平；需特别注意：当总分≤30分时，提示社会支持严重不足，属高风险筛查阳性信号，常见于经历长期压力、情绪低落、人际疏离或创伤后适应困难的个体，但该结果**仅供参考，不构成任何医学诊断或精神障碍判定**。\n\n请严格按以下四部分结构输出报告，每部分用指定标题引导，内容须紧扣量表维度定义、计分逻辑与题文内涵，避免泛泛而谈，建议须具可操作性（如结合Q5中具体关系对象、Q8/Q9的倾诉/求助倾向、Q10的参与主动性等作个性化延伸）：\n\n### 🌟 综合评估  \n简明概括总分意义，点明核心风险或优势特征（如“虽客观资源尚可，但主观感受孤立且求助意愿偏低”），强调社会支持是动态可塑的能力，而非固定人格标签。\n\n### 🔍 维度深度解析  \n逐一对{dimensions}中每个维度进行解读：  \n- 先用**粗体**标出维度名称（如**主观支持**）；  \n- 结合该维度得分、等级标签（levelLabel）及题文实质（如Q5涉及夫妻/父母/子女等具体关系圈层，Q6/Q7反映多元支持源广度，Q8-Q10呈现人际行为取向），说明分数背后可能的心理或行为线索；  \n- 若某维度得分处于临界区间（如主观支持14分、客观支持13分），需提示“接近中等上限/下限”，增强敏感性；  \n- 对低分维度，避免归因为“性格缺陷”，而聚焦可调整的认知模式（如“可能习惯独自承担”）或情境限制（如“近期生活环境变动影响支持网络稳定性”）。\n\n### 🌱 改善建议  \n以编号列表形式（1. 2. 3. …）提供3–5条具体、微小、可启动的行动建议，每条须锚定一个可观察行为或认知调整点：  \n- 例如针对主观支持偏低：*尝试每天记录1件“被微小关照”的事（如同事顺手帮你带了杯水），连续一周，不评判真假，仅培养感知力*；  \n- 针对支持利用度偏低：*本周内向1位信任的人发送一条非紧急但带温度的信息（如“刚看到XX，想起你”），不期待回应，重在练习联结感*；  \n- 针对客观支持薄弱：*梳理Q6/Q7中未勾选但潜在可用的1类资源（如社区老年大学、线上兴趣社群），本周浏览其1个公开活动信息*；  \n- 所有建议须避免“多沟通”“多社交”等空泛表述，拒绝说教口吻。\n\n### ❤️ 重要提醒  \n明确声明：本报告仅为心理测评的初步参考，**不能替代面对面心理咨询、精神科评估或医疗诊断**；若总分≤30分，强烈建议寻求专业心理支持；社会支持水平会随生活阶段、重大事件、关系质量变化而波动，本次结果反映的是当前状态，而非永久定论；所有作答均受当时心境、理解偏差、文化背景影响，请以开放、自我关怀的态度看待反馈。\n\n━━━━━━━━━━━━━━━━━━━━  \n【输出格式要求】  \n你只能使用以下 Markdown 语法输出报告，严禁使用任何 HTML 标签：  \n\n✅ 允许使用的格式：  \n- **粗体**：用 \\*\\*文字\\*\\* 包裹  \n- *斜体*：用 \\*文字\\* 包裹  \n- 标题：用 ## 或 ### 开头（不要用 # 一级标题）  \n- 分隔线：独占一行的 ---  \n- 列表：用 - 或数字 1. 2. 3. 开头  \n- 引用：用 > 开头（如话术、引用语等）  \n- 行内代码：用反引号 ` 包裹  \n\n❌ 严禁使用的格式（会导致页面显示异常）：  \n- 禁止使用任何 HTML 标签（如 <div>、<span>、<br>、<p>、<table>、<strong>、<em> 等）  \n- 禁止使用 HTML 表格（<table>）或 CSS 类名（如 diag-table-wrap）  \n- 禁止使用 <br> 换行，请直接用 Markdown 的空行或换行  \n- 禁止输出 Markdown 表格（| 列 | 列 | 格式），如需呈现对比信息请用列表或粗体标题+文字描述替代  \n\n报告结构建议（纯 Markdown）：  \n### 🌟 综合评估  \n（总结性分析文字）  \n---  \n### 🔍 维度深度解析  \n（每个维度一段分析，用粗体标注维度名）  \n---  \n### 🌱 改善建议  \n（用编号列表 1. 2. 3. 组织建议）  \n---  \n### ❤️ 重要提醒  \n（注意事项）  \n━━━━━━━━━━━━━━━━━━━━", "welcome": "根据您的测评结果，我为您生成了以下分析报告。", "temperature": 0.7, "maxTokens": 2000}, "scoring": {"dimensions": [{"key": "subjective_support", "label": "主观支持", "formula": "SUM", "items": "1,3,4,5", "interpretation": [{"min": 8, "max": 12, "level": "normal", "label": "低", "color": "#43A047", "text": "个体较少体验到被尊重、被理解或被情感支持的感受，可能较难建立亲密关系或表达需求。"}, {"min": 12.01, "max": 16, "level": "mild", "label": "中等偏低", "color": "#26A69A", "text": "偶有被支持的情感体验，对重要关系有一定满意度，但支持感不够稳定或深入。"}, {"min": 16.01, "max": 20, "level": "moderate", "label": "中等", "color": "#1E88E5", "text": "能较稳定地感受到来自家庭、朋友等的情感支持，对人际关系整体满意。"}, {"min": 20.01, "max": 24, "level": "high_moderate", "label": "中等偏高", "color": "#5C6BC0", "text": "在多数关系中体验到充分的理解与接纳，情感支持资源丰富且可及。"}, {"min": 24.01, "max": 32, "level": "severe", "label": "高", "color": "#7E57C2", "text": "强烈感受到被重视、被关爱与被理解，人际支持网络深厚且富有回应性。"}]}, {"key": "objective_support", "label": "客观支持", "formula": "SUM", "items": "2,6,7", "interpretation": [{"min": 1, "max": 5, "level": "normal", "label": "低", "color": "#43A047", "text": "实际获得的物质援助或稳定社会联系较少，急难时可依赖的资源有限。"}, {"min": 5.01, "max": 9, "level": "mild", "label": "中等偏低", "color": "#26A69A", "text": "具备基础支持来源（如1–2类），但支持强度或覆盖范围较窄。"}, {"min": 9.01, "max": 13, "level": "moderate", "label": "中等", "color": "#1E88E5", "text": "拥有较稳定的现实支持网络（如家人+同事），能应对一般生活困难。"}, {"min": 13.01, "max": 17, "level": "high_moderate", "label": "中等偏高", "color": "#5C6BC0", "text": "支持来源多元（含正式组织），实际援助可及性强，应对突发状况能力较好。"}, {"min": 17.01, "max": 22, "level": "severe", "label": "高", "color": "#7E57C2", "text": "在经济、事务、情感等多方面均有可靠现实支持，社会联结广泛而稳固。"}]}, {"key": "support_utilization", "label": "社会支持利用度", "formula": "SUM", "items": "8,9,10", "interpretation": [{"min": 3, "max": 4, "level": "normal", "label": "低", "color": "#43A047", "text": "倾向于独自应对困扰，较少主动寻求或接受他人帮助，支持资源利用率低。"}, {"min": 4.01, "max": 6, "level": "mild", "label": "中等偏低", "color": "#26A69A", "text": "在特定情境下会求助，但主动性不足，对支持的开放度和信任度有待提升。"}, {"min": 6.01, "max": 8, "level": "moderate", "label": "中等", "color": "#1E88E5", "text": "能根据需要适度求助，对支持持开放态度，在关系中实现基本互惠。"}, {"min": 8.01, "max": 10, "level": "high_moderate", "label": "中等偏高", "color": "#5C6BC0", "text": "善于识别自身需求并主动调动支持资源，能有效维系互助性人际关系。"}, {"min": 10.01, "max": 12, "level": "severe", "label": "高", "color": "#7E57C2", "text": "高度整合社会支持系统，既乐于提供支持也坦然接受帮助，支持利用灵活高效。"}]}], "metrics": [{"key": "totalScore", "label": "总分", "formula": "DERIVED", "items": "ALL", "expression": "subjective_support + objective_support + support_utilization"}], "interpretation": [{"metric": "totalScore", "min": 12, "max": 20, "level": "normal", "label": "低", "color": "#43A047", "text": "社会支持总体水平偏低，客观资源、主观感受及利用能力均较薄弱，建议关注支持网络建设。"}, {"metric": "totalScore", "min": 20.01, "max": 30, "level": "mild", "label": "中等偏低", "color": "#26A69A", "text": "支持系统初步形成，但某一方面（如主观体验或利用度）存在明显短板。"}, {"metric": "totalScore", "min": 30.01, "max": 42, "level": "moderate", "label": "中等", "color": "#1E88E5", "text": "社会支持处于一般健康水平，三维度发展相对均衡，具备基本心理韧性基础。"}, {"metric": "totalScore", "min": 42.01, "max": 54, "level": "high_moderate", "label": "中等偏高", "color": "#5C6BC0", "text": "支持资源较丰富，主观感受积极，利用方式成熟，有助于缓冲压力与促进成长。"}, {"metric": "totalScore", "min": 54.01, "max": 66, "level": "severe", "label": "高", "color": "#7E57C2", "text": "社会支持系统强健而富有弹性，是维持心理健康与适应挑战的重要保护性资源。"}], "screening": null}}];
    
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
            // 始终用 DEFAULT_SCALES（构建时注入的最新数据）覆盖 localStorage 缓存
            // 旧缓存可能缺少新字段（npcConfig / question.type / subOptions 等），导致功能异常
            if (DEFAULT_SCALES && DEFAULT_SCALES.length > 0) {
                this.saveScalesData(DEFAULT_SCALES);
                this.syncToFrontend();
                console.log('[SharedData] 已用 DEFAULT_SCALES 覆盖缓存（' + DEFAULT_SCALES.length + ' 个量表）');
            } else {
                // 兜底：无内置数据时使用缓存
                var cached = this.loadScalesData();
                if (cached && cached.length > 0) {
                    this.syncToFrontend();
                } else {
                    console.warn('[SharedData] 无可用量表数据');
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