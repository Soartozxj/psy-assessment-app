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
    const DEFAULT_SCALES = [{"name":"父母共同教养关系感知量表","shortName":"PPCRS","code":"PPCRS","category":"bond","categoryName":"家庭与人际关系量表","emoji":"📋","color":"#4a90d9","duration":7,"questionTime":30,"questionCount":14,"applicablePeople":"","desc":"在国内外，越来越多的研究和临床实践开始重视家庭因素对个体的影响作用，尤其是精神分裂症患者的家庭。与西方国家相比，中国绝大多数精神病患者和家属生活在一起，与家属接触时间比西方国家多，所以在中国家庭因素对精神疾病的致病作用及患病成员对家庭的影响也会比西方国家大。但在中国治疗精神病的过程中，大多数家庭因素评估通常仅限于了解家族精神病病史，而没有详细了解中国精神病患者家庭结构特点等信息。因此，为了了解精神病患者家庭因素的实质，便于开展以预防和康复为目的的家庭咨询和治疗，一个能够测量出家庭内部结构和功能又方便易行的工具显得很有意义。","instruction":"","notice":["请根据您过去一周的真实感受作答"],"tags":[],"status":1,"sortOrder":1,"rating":5,"npcConfig":{"counselorId":"counselor_new_1777403525025","backgroundId":"bg_new_1777404492569"},"questions":[{"id":1,"content":"在我管教孩子的时候，我的伴侣表示支持我","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:开始阶段"},{"id":2,"content":"我的伴侣和我争夺孩子的注意力","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:开始阶段"},{"id":3,"content":"当我的伴侣不认同我对待孩子的方式时，他/她能够平静地和我讨论","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:开始阶段"},{"id":4,"content":"当我想让伴侣帮忙让孩子睡觉时，他/她忽略了我的请求","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":5,"content":"我的伴侣在孩子面前批评我的教养方式","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":6,"content":"当我吩咐孩子做某事时，我的伴侣会反驳我","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":7,"content":"我的伴侣和我使用相似的育儿技巧","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":8,"content":"在我就孩子的问题寻求帮助时，我的伴侣不会帮助我","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":9,"content":"当我告诉伴侣关于孩子的事情时，他/她会倾听","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":10,"content":"当孩子想要什么时，我说不可以，但我的伴侣说可以","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":11,"content":"我的伴侣使用了我要求他/她不要使用的育儿技巧","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":12,"content":"总的来说，我们在孩子养育方面配合得很好","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:结束阶段"},{"id":13,"content":"当我试图解决我们的孩子和其他孩子之间的争端时，我的伴侣会帮助我","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:结束阶段"},{"id":14,"content":"在孩子面前，即使我的伴侣不同意我对待孩子的方式，但他/她仍然支持我","options":[{"label":"从不","score":1},{"label":"非常少","score":2},{"label":"偶尔","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:结束阶段"}],"id":1775965642069,"completedCount":6},{"name":"家庭亲密度和适应性","shortName":"FACES II-CV","code":"FACES II-CV","category":"bond","categoryName":"家庭与人际关系量表","emoji":"📋","color":"#d97c4a","duration":15,"questionTime":30,"questionCount":30,"applicablePeople":"","desc":"在中国治疗精神病的过程中，大多数家庭因素评估通常仅限于了解家族精神病病史，而没有详细了解中国精神病患者家庭结构特点等信息。","instruction":"","notice":["请根据您过去一周的真实感受作答"],"tags":["家庭教育"],"status":1,"sortOrder":1,"rating":5,"npcConfig":{"counselorId":"counselor_new_1777404035456","backgroundId":"bg_new_1777404535630"},"questions":[{"id":1,"content":"在有难处的时候，家庭成员都会尽最大的努力相互支持","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:开始阶段"},{"id":2,"content":"在我们的家庭中每个成员都可以随便发表自己的意见","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:开始阶段"},{"id":3,"content":"我们家庭中的成员比较愿意与朋友商讨个人问题而不太愿意与家人商讨","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:开始阶段"},{"id":4,"content":"每个家庭成员都参与做出重大的家庭决策","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":5,"content":"所有家庭成员聚集在一起进行活动","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":6,"content":"晚辈对长辈的教导可以发表自己的意见","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":7,"content":"在家庭中，有事大家一起做","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":8,"content":"家庭成员一起讨论问题，并对问题的解决感到满意","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":9,"content":"家庭成员与朋友的关系比家庭成员之间的关系更密切","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":10,"content":"在家庭中，我们轮流分担不同的家务","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":11,"content":"家庭成员之间都熟悉每个成员的亲密朋友","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":12,"content":"家庭状况有变化时，家庭平常的生活规律和家规很容易有相应的改变","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":13,"content":"家庭成员自己要做决策时，喜欢与家人一起商量","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":14,"content":"当家庭中出现矛盾时，成员间相互谦让取得妥协","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":15,"content":"在我们的家庭中，娱乐活动都是全家人一起去做的","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":16,"content":"在解决问题时，孩子们的建议都能够被接受","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":17,"content":"家庭成员之间的关系是非常密切的","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":18,"content":"我们家的家教是合理的","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":19,"content":"在我们的家庭中，每个成员都习惯单独活动","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":20,"content":"我们家喜欢用新方法去解决遇到的问题","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":21,"content":"每个家庭成员都能按家庭所做的决定去做事","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":22,"content":"在我们的家庭中，每个成员都能分担家庭义务","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":23,"content":"家庭成员喜欢在一起度过业余时间","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":24,"content":"尽管家里有人有这样的想法，但家庭的生活规律和家规还是难以改变","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":25,"content":"家庭成员都很主动和家里其他人谈自己的心里话","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":26,"content":"在家庭中，每个家庭成员可以随便提出自己的要求","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":27,"content":"在家庭中，每个家庭成员的朋友都会受到极为热情的接待","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:中间阶段"},{"id":28,"content":"当家庭发生矛盾时，家庭成员会把自己的想法藏在心里","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:结束阶段"},{"id":29,"content":"在家庭中，我们更愿意分开做事，而不太愿意和全家人一起做","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:结束阶段"},{"id":30,"content":"家庭成员可以分享彼此的兴趣和爱好","options":[{"label":"不是","score":1},{"label":"偶尔","score":2},{"label":"有时","score":3},{"label":"经常","score":4},{"label":"总是","score":5}],"transition":"phase:结束阶段"}],"id":1776000039744,"completedCount":1},{"name":"中国大五人格问卷（简式版）","shortName":"CBF-PI-B","code":"CBF-PI-B-2024","category":"personality","categoryName":"人格特质评估量表","emoji":"🧑","color":"#d6582e","duration":20,"questionTime":30,"questionCount":40,"applicablePeople":"","desc":"中国大五人格问卷（简式版，CBF-PI-B）由王孟成、戴晓阳编制，共40题，含神经质、尽责性、宜人性、开放性、外向性5个维度，各8题。量表采用6级计分，设7道反向题，计分后求和得维度分。其信效度良好，施测简便，适用于成人群体的人格特征评估。","instruction":"以下是描述个人性格特点的语句，请你依据每句话与自身性格的相符程度进行选择。每个人的性格各不相同，答案没有对错之分，请根据你的真实情况如实作答，选择最贴合你自身的选项即可。","notice":["按自身真实情况作答","答案无对错之分","依相符程度选择","客观评价自身性格"],"tags":["人格测试"],"status":1,"sortOrder":0,"rating":5,"npcConfig":{"counselorId":"counselor_new_1777404891044","backgroundId":"bg_new_1777404574714"},"questions":[{"id":1,"content":"我常常感到害怕","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"神经质(N)","transition":"phase:开始阶段"},{"id":2,"content":"一旦确定了目标，我会坚持努力地实现它","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"尽责性(C)","transition":"phase:开始阶段"},{"id":3,"content":"我觉得大部分人基本上是心怀善意的","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"宜人性(A)","transition":"phase:开始阶段"},{"id":4,"content":"我头脑中经常充满生动的画面","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"开放性(O)","transition":"phase:中间阶段"},{"id":5,"content":"我对人多的聚会感到乏味（反向计分）","options":[{"label":"完全不符合","score":6},{"label":"大部分不符合","score":5},{"label":"有点不符合","score":4},{"label":"有点符合","score":3},{"label":"大部分符合","score":2},{"label":"完全符合","score":1}],"dimension":"外向性(E)","transition":"phase:中间阶段"},{"id":6,"content":"有时我觉得自己一无是处","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"神经质(N)","transition":"phase:中间阶段"},{"id":7,"content":"我常常是仔细考虑之后才做出决定","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"尽责性(C)","transition":"phase:中间阶段"},{"id":8,"content":"我不太关心别人是否受到不公正的待遇（反向计分）","options":[{"label":"完全不符合","score":6},{"label":"大部分不符合","score":5},{"label":"有点不符合","score":4},{"label":"有点符合","score":3},{"label":"大部分符合","score":2},{"label":"完全符合","score":1}],"dimension":"宜人性(A)","transition":"phase:中间阶段"},{"id":9,"content":"我是个勇于冒险、突破常规的人","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"开放性(O)","transition":"phase:中间阶段"},{"id":10,"content":"在热闹的聚会上，我常常表现主动并尽情玩耍","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"外向性(E)","transition":"phase:中间阶段"},{"id":11,"content":"别人一句漫不经心的话，我常常会联系在自己身上","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"神经质(N)","transition":"phase:中间阶段"},{"id":12,"content":"别人认为我是个慎重的人","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"尽责性(C)","transition":"phase:中间阶段"},{"id":13,"content":"我时常觉得别人的痛苦与我无关（反向计分）","options":[{"label":"完全不符合","score":6},{"label":"大部分不符合","score":5},{"label":"有点不符合","score":4},{"label":"有点符合","score":3},{"label":"大部分符合","score":2},{"label":"完全符合","score":1}],"dimension":"宜人性(A)","transition":"phase:中间阶段"},{"id":14,"content":"我喜欢冒险","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"开放性(O)","transition":"phase:中间阶段"},{"id":15,"content":"我尽量避免参加人多的聚会和处于嘈杂的环境（反向计分）","options":[{"label":"完全不符合","score":6},{"label":"大部分不符合","score":5},{"label":"有点不符合","score":4},{"label":"有点符合","score":3},{"label":"大部分符合","score":2},{"label":"完全符合","score":1}],"dimension":"外向性(E)","transition":"phase:中间阶段"},{"id":16,"content":"在面对压力时，我有种快要崩溃的感觉","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"神经质(N)","transition":"phase:中间阶段"},{"id":17,"content":"我会把事情计划好再去做","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"尽责性(C)","transition":"phase:中间阶段"},{"id":18,"content":"我是个不会替别人着想的人（反向计分）","options":[{"label":"完全不符合","score":6},{"label":"大部分不符合","score":5},{"label":"有点不符合","score":4},{"label":"有点符合","score":3},{"label":"大部分符合","score":2},{"label":"完全符合","score":1}],"dimension":"宜人性(A)","transition":"phase:中间阶段"},{"id":19,"content":"我对许多事情有着很强的好奇心","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"开放性(O)","transition":"phase:中间阶段"},{"id":20,"content":"我喜欢与人交谈、开朗健谈","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"外向性(E)","transition":"phase:中间阶段"},{"id":21,"content":"我常常担忧一些无关紧要的事情","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"神经质(N)","transition":"phase:中间阶段"},{"id":22,"content":"我会尽力完成好自己的任务","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"尽责性(C)","transition":"phase:中间阶段"},{"id":23,"content":"虽然社会上有一些骗子，但我觉得大部分人还是可信的","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"宜人性(A)","transition":"phase:中间阶段"},{"id":24,"content":"我喜欢思考一些理论性的问题","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"开放性(O)","transition":"phase:中间阶段"},{"id":25,"content":"在集体中我是个很有影响力的人","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"外向性(E)","transition":"phase:中间阶段"},{"id":26,"content":"我常常感到情绪低落","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"神经质(N)","transition":"phase:中间阶段"},{"id":27,"content":"我是一个倾尽全力做事的人","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"尽责性(C)","transition":"phase:中间阶段"},{"id":28,"content":"当别人向我诉说不幸时，我常常感到难过","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"宜人性(A)","transition":"phase:中间阶段"},{"id":29,"content":"我的日常生活充满了挑战","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"开放性(O)","transition":"phase:中间阶段"},{"id":30,"content":"我很喜欢参加各种社交活动","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"外向性(E)","transition":"phase:中间阶段"},{"id":31,"content":"我常常担心很多事情","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"神经质(N)","transition":"phase:中间阶段"},{"id":32,"content":"在工作上，我时常只求能应付过去（反向计分）","options":[{"label":"完全不符合","score":6},{"label":"大部分不符合","score":5},{"label":"有点不符合","score":4},{"label":"有点符合","score":3},{"label":"大部分符合","score":2},{"label":"完全符合","score":1}],"dimension":"尽责性(C)","transition":"phase:中间阶段"},{"id":33,"content":"尽管人类社会存在着一些阴暗面(如战争、欺骗)，但我觉得大多数人是善良的","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"宜人性(A)","transition":"phase:中间阶段"},{"id":34,"content":"我的想象力相当丰富","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"开放性(O)","transition":"phase:中间阶段"},{"id":35,"content":"我喜欢参加社交与娱乐聚会","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"外向性(E)","transition":"phase:中间阶段"},{"id":36,"content":"我很少感到忧郁或沮丧（反向计分）","options":[{"label":"完全不符合","score":6},{"label":"大部分不符合","score":5},{"label":"有点不符合","score":4},{"label":"有点符合","score":3},{"label":"大部分符合","score":2},{"label":"完全符合","score":1}],"dimension":"神经质(N)","transition":"phase:中间阶段"},{"id":37,"content":"做事讲究逻辑和条理是我的一个特点","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"尽责性(C)","transition":"phase:中间阶段"},{"id":38,"content":"我时常为那些遭遇不幸的人感到难过","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"宜人性(A)","transition":"phase:结束阶段"},{"id":39,"content":"我很愿意也很容易接受那些新事物、新观点、新想法","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"开放性(O)","transition":"phase:结束阶段"},{"id":40,"content":"我希望成为领导者而不是被领导者","options":[{"label":"完全不符合","score":1},{"label":"大部分不符合","score":2},{"label":"有点不符合","score":3},{"label":"有点符合","score":4},{"label":"大部分符合","score":5},{"label":"完全符合","score":6}],"dimension":"外向性(E)","transition":"phase:结束阶段"}],"id":1776402134595,"completedCount":0},{"name":"90项症状清单","shortName":"SCL-90","code":"SCL-90","category":"spirit","categoryName":"心理健康与精神病态量表","emoji":"📋","color":"#4a90d9","duration":45,"questionTime":30,"questionCount":90,"applicablePeople":"","desc":"90 项症状清单（SCL-90）由心理学家 Derogatis 于 1973 年编制，20 世纪 80 年代引入我国并建立了国人常模，是国内应用最广泛的心理健康筛查量表。量表共 90 个项目，涵盖躯体感受、情绪、思维、人际关系、睡眠饮食等多方面症状，采用 5 级自评评分，能全面反映你近一周的自觉心理症状与不适程度，操作简便、评估直观，结果仅作为心理健康参考，并非精神疾病诊断依据。","instruction":"下面列出了有些人可能会有的问题，请你仔细阅读每一条，然后根据最近一周内这些情况对你的实际影响和自身真实感觉，在 “没有、很轻、中等、偏重、严重” 五个选项中，选择最符合你的一项并做标记。","notice":["按最近一周的真实感受作答，不用反复斟酌。","独立完成答题，不与他人商量、不受他人影响。","每题仅选一个答案，确保不漏答、不重复选。","结果严格保密，仅用于心理健康评估参考。"],"tags":["专业量表"],"status":1,"sortOrder":0,"rating":5,"npcConfig":{"counselorId":"counselor_new_1777404035456","backgroundId":"bg_new_1777404526324"},"questions":[{"id":1,"content":"头痛","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:开始阶段"},{"id":2,"content":"神经过敏，心中不踏实","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"焦虑","transition":"phase:开始阶段"},{"id":3,"content":"头脑中有不必要的想法或字句盘旋","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"强迫症状","transition":"phase:开始阶段"},{"id":4,"content":"头昏或昏倒","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:中间阶段"},{"id":5,"content":"对异性的兴趣减退","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":6,"content":"对旁人责备求全","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"人际关系敏感","transition":"phase:中间阶段"},{"id":7,"content":"感到别人能控制你的思想","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"精神病性","transition":"phase:中间阶段"},{"id":8,"content":"责怪别人制造麻烦","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"偏执","transition":"phase:中间阶段"},{"id":9,"content":"忘性大","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"强迫症状","transition":"phase:中间阶段"},{"id":10,"content":"担心自己衣饰的整齐及仪态的端正","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"强迫症状","transition":"phase:中间阶段"},{"id":11,"content":"容易烦恼和激动","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"敌对","transition":"phase:中间阶段"},{"id":12,"content":"胸痛","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:中间阶段"},{"id":13,"content":"害怕空旷的场所或街道","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"恐怖","transition":"phase:中间阶段"},{"id":14,"content":"感到自己的精力下降，活动减慢","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":15,"content":"想结束自己的生命","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":16,"content":"听到旁人听不到的声音","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"精神病性","transition":"phase:中间阶段"},{"id":17,"content":"发抖","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"焦虑","transition":"phase:中间阶段"},{"id":18,"content":"感到大多数人都不可信任","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"偏执","transition":"phase:中间阶段"},{"id":19,"content":"胃口不好","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"其他","transition":"phase:中间阶段"},{"id":20,"content":"容易哭泣","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":21,"content":"同异性相处时感到害羞不自在","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"人际关系敏感","transition":"phase:中间阶段"},{"id":22,"content":"感到受骗、中了圈套或有人想抓住你","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":23,"content":"无缘无故地突然感到害怕","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"焦虑","transition":"phase:中间阶段"},{"id":24,"content":"自己不能控制地发脾气","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"敌对","transition":"phase:中间阶段"},{"id":25,"content":"害怕单独出门","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"恐怖","transition":"phase:中间阶段"},{"id":26,"content":"经常责怪自己","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":27,"content":"腰痛","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:中间阶段"},{"id":28,"content":"感到难以完成任务","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"强迫症状","transition":"phase:中间阶段"},{"id":29,"content":"感到孤独","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":30,"content":"感到苦闷","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":31,"content":"过分担忧","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":32,"content":"对事物不感兴趣","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":33,"content":"感到害怕","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"焦虑","transition":"phase:中间阶段"},{"id":34,"content":"我的感情容易受到伤害","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"人际关系敏感","transition":"phase:中间阶段"},{"id":35,"content":"旁人能知道你的私下想法","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"精神病性","transition":"phase:中间阶段"},{"id":36,"content":"感到别人不理解你、不同情你","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"人际关系敏感","transition":"phase:中间阶段"},{"id":37,"content":"感到人们对你不友好,不喜欢你","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"人际关系敏感","transition":"phase:中间阶段"},{"id":38,"content":"做事必须做得很慢以保证做得正确","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"强迫症状","transition":"phase:中间阶段"},{"id":39,"content":"心跳得很厉害","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"焦虑","transition":"phase:中间阶段"},{"id":40,"content":"恶心或胃部不舒服","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:中间阶段"},{"id":41,"content":"感到比不上他人","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"人际关系敏感","transition":"phase:中间阶段"},{"id":42,"content":"肌肉酸痛","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:中间阶段"},{"id":43,"content":"感到有人监视你,谈论你","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"偏执","transition":"phase:中间阶段"},{"id":44,"content":"难以入睡","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"其他","transition":"phase:中间阶段"},{"id":45,"content":"做事必须反复检查","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"强迫症状","transition":"phase:中间阶段"},{"id":46,"content":"难以做出决定","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"强迫症状","transition":"phase:中间阶段"},{"id":47,"content":"怕乘电车、公共汽车、地铁或火车","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"恐怖","transition":"phase:中间阶段"},{"id":48,"content":"呼吸有困难","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:中间阶段"},{"id":49,"content":"一阵阵发冷或发热","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:中间阶段"},{"id":50,"content":"因为感到害怕而避开某些东西、场合或活动","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"恐怖","transition":"phase:中间阶段"},{"id":51,"content":"脑子变空了","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"强迫症状","transition":"phase:中间阶段"},{"id":52,"content":"身体发麻或刺痛","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:中间阶段"},{"id":53,"content":"喉咙有梗阻感","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:中间阶段"},{"id":54,"content":"感到没有前途、没有希望","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":55,"content":"不能集中注意力","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"强迫症状","transition":"phase:中间阶段"},{"id":56,"content":"感到身体某一部分软弱无力","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:中间阶段"},{"id":57,"content":"感到紧张或容易紧张","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"焦虑","transition":"phase:中间阶段"},{"id":58,"content":"感到手或脚发重","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"躯体化","transition":"phase:中间阶段"},{"id":59,"content":"想到死亡的事","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"其他","transition":"phase:中间阶段"},{"id":60,"content":"吃得太多","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"其他","transition":"phase:中间阶段"},{"id":61,"content":"当别人看着你或谈论你时感到不自在","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"人际关系敏感","transition":"phase:中间阶段"},{"id":62,"content":"有些不属于你自己的想法","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"精神病性","transition":"phase:中间阶段"},{"id":63,"content":"有想打人或伤害他人的冲动","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"敌对","transition":"phase:中间阶段"},{"id":64,"content":"醒得太早","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"其他","transition":"phase:中间阶段"},{"id":65,"content":"必须反复洗手、点数目或触摸某些东西","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"强迫症状","transition":"phase:中间阶段"},{"id":66,"content":"睡得不稳不深","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"其他","transition":"phase:中间阶段"},{"id":67,"content":"有想摔坏或破坏东西的冲动","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"敌对","transition":"phase:中间阶段"},{"id":68,"content":"有一些别人没有的想法或念头","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"偏执","transition":"phase:中间阶段"},{"id":69,"content":"感到对别人神经过敏","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"人际关系敏感","transition":"phase:中间阶段"},{"id":70,"content":"在商店或电影院等人多的地方感到不自在","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"恐怖","transition":"phase:中间阶段"},{"id":71,"content":"感到做任何事情都很困难","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":72,"content":"感到一阵阵恐惧或惊恐","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"焦虑","transition":"phase:中间阶段"},{"id":73,"content":"感到在公共场合吃东西很不舒服","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"人际关系敏感","transition":"phase:中间阶段"},{"id":74,"content":"经常与人争论","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"敌对","transition":"phase:中间阶段"},{"id":75,"content":"单独一人时神经很紧张","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"恐怖","transition":"phase:中间阶段"},{"id":76,"content":"感到别人对你的成绩没有做出恰当的评价","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"偏执","transition":"phase:中间阶段"},{"id":77,"content":"即使和别人在一起也感到孤独","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"精神病性","transition":"phase:中间阶段"},{"id":78,"content":"感到坐立不安、心神不定","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"焦虑","transition":"phase:中间阶段"},{"id":79,"content":"感到自己没有什么价值","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"抑郁","transition":"phase:中间阶段"},{"id":80,"content":"感到熟悉的东西变得陌生或不像是真的","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"焦虑","transition":"phase:中间阶段"},{"id":81,"content":"大叫或摔东西","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"敌对","transition":"phase:中间阶段"},{"id":82,"content":"害怕会在公共场合昏倒","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"恐怖","transition":"phase:中间阶段"},{"id":83,"content":"感到别人想占你的便宜","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"偏执","transition":"phase:中间阶段"},{"id":84,"content":"为一些有关\"性\"的想法而很苦恼","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"精神病性","transition":"phase:中间阶段"},{"id":85,"content":"你认为应该为自己的过错而受到惩罚","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"精神病性","transition":"phase:中间阶段"},{"id":86,"content":"想着要赶快把事情做完","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"焦虑","transition":"phase:中间阶段"},{"id":87,"content":"感到自己的身体有严重问题","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"精神病性","transition":"phase:中间阶段"},{"id":88,"content":"从未感到和其他人很亲近","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"精神病性","transition":"phase:结束阶段"},{"id":89,"content":"感到自己有罪","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"其他","transition":"phase:结束阶段"},{"id":90,"content":"感到自己的脑子有毛病","options":[{"label":"没有","score":1},{"label":"很轻","score":2},{"label":"中等","score":3},{"label":"偏重","score":4},{"label":"严重","score":5}],"dimension":"精神病性","transition":"phase:结束阶段"}],"id":1776498370416,"completedCount":0},{"name":"儿童问题特质问卷","shortName":"CPTI","code":"CPTI","category":"spirit","categoryName":"心理健康与精神病态量表","emoji":"📋","color":"#4a90d9","duration":14,"questionTime":30,"questionCount":28,"applicablePeople":"3~12 岁儿童","desc":"儿童问题特质问卷（CPTI）由荷兰、瑞典学者联合开发，专为3~12 岁儿童设计，填补了 3~6 岁学前儿童问题特质评估的工具空白。量表基于精神病态三因子模型编制，用于评估儿童浮夸欺骗、冷酷无情、冲动刺激追寻三类核心问题特质，助力早期识别儿童行为与品行倾向。量表共 28 题，采用 4 级评分，可由教师或母亲评定，信效度优良、评估精准，结果仅作为儿童行为参考依据。","instruction":"以下题目描述了儿童常见的行为表现，请您根据孩子日常真实的行为状态，判断每句话与孩子的符合程度，在对应选项上做标记。其中：1 = 一点也不符合，2 = 不是很符合，3 = 基本符合，4 = 非常符合。","notice":["依据孩子日常真实表现作答，不凭一时印象评判。","每题仅选择一个最符合的选项，不漏评、不重复。","独立完成评定，不与他人商量或受他人影响。","结果严格保密，仅用于儿童行为评估参考。"],"tags":["人格测试"],"status":1,"sortOrder":0,"rating":5,"npcConfig":{"counselorId":"counselor_new_1777403822592","backgroundId":"bg_new_1777404563734"},"questions":[{"id":1,"content":"他/她喜欢改变(如兴趣爱好、行为方式等),并且经常改变","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冲动刺激追寻(INS)","transition":"phase:开始阶段"},{"id":2,"content":"他/她很少对他人表现出同情","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冷酷无情(CU)","transition":"phase:开始阶段"},{"id":3,"content":"他/她经常不能耐心等待","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冲动刺激追寻(INS)","transition":"phase:开始阶段"},{"id":4,"content":"他/她通常不在乎别人所分享的快乐和忧伤","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冷酷无情(CU)","transition":"phase:中间阶段"},{"id":5,"content":"他/她经常因为逃避问题而撒谎","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"浮夸欺骗(GD)","transition":"phase:中间阶段"},{"id":6,"content":"他/她看起来只是为了寻求新鲜感而去做某件事情","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冲动刺激追寻(INS)","transition":"phase:中间阶段"},{"id":7,"content":"他/她觉得自己比其他孩子都要优秀","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"浮夸欺骗(GD)","transition":"phase:中间阶段"},{"id":8,"content":"他/她从来不会为其做过的事而惭愧","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冷酷无情(CU)","transition":"phase:中间阶段"},{"id":9,"content":"他/她经常为了得到自己想要的而撒谎","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"浮夸欺骗(GD)","transition":"phase:中间阶段"},{"id":10,"content":"他/她总是着急地给自己更换不同的东西","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冲动刺激追寻(INS)","transition":"phase:中间阶段"},{"id":11,"content":"在其他孩子伤心的时候,他/她经常表现得很冷漠","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冷酷无情(CU)","transition":"phase:中间阶段"},{"id":12,"content":"他/她经常冲动行事","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冲动刺激追寻(INS)","transition":"phase:中间阶段"},{"id":13,"content":"在别人受伤的时候,他/她并不感到不安或难过","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冷酷无情(CU)","transition":"phase:中间阶段"},{"id":14,"content":"他/她经常有什么东西就用掉而不是留着","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冲动刺激追寻(INS)","transition":"phase:中间阶段"},{"id":15,"content":"与同龄人相比,他/她更经常撒谎","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"浮夸欺骗(GD)","transition":"phase:中间阶段"},{"id":16,"content":"他/她看起来很讨厌一成不变并喜欢寻求新异的感觉和体验","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冲动刺激追寻(INS)","transition":"phase:中间阶段"},{"id":17,"content":"他/她做了不被允许的事时很少感到懊悔","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冷酷无情(CU)","transition":"phase:中间阶段"},{"id":18,"content":"他/她经常以高傲自大的态度对人","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"浮夸欺骗(GD)","transition":"phase:中间阶段"},{"id":19,"content":"他/她不喜欢等待","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冲动刺激追寻(INS)","transition":"phase:中间阶段"},{"id":20,"content":"他/她大多数时候看起来并不在乎别人的感受和想法","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冷酷无情(CU)","transition":"phase:中间阶段"},{"id":21,"content":"他/她认为通过欺骗他人来达到目的是有效的","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"浮夸欺骗(GD)","transition":"phase:中间阶段"},{"id":22,"content":"有时候他/她看起来不会感到懊悔","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冷酷无情(CU)","transition":"phase:中间阶段"},{"id":23,"content":"他/她看起来很容易感到厌烦","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冲动刺激追寻(INS)","transition":"phase:中间阶段"},{"id":24,"content":"他/她认为自己几乎在任何事上都做得比其他孩子好","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"浮夸欺骗(GD)","transition":"phase:中间阶段"},{"id":25,"content":"他/她做了不被允许的事时并没有表现出内疚","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冷酷无情(CU)","transition":"phase:中间阶段"},{"id":26,"content":"对他/她来说,撒谎似乎已经是家常便饭了","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"浮夸欺骗(GD)","transition":"phase:结束阶段"},{"id":27,"content":"他/她不会表现出和同龄人同样程度的内疚","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冷酷无情(CU)","transition":"phase:结束阶段"},{"id":28,"content":"他/她总是喜新厌旧","options":[{"id":"A","label":"一点也不符合","score":1},{"id":"B","label":"不是很符合","score":2},{"id":"C","label":"基本符合","score":3},{"id":"D","label":"非常符合","score":4}],"dimension":"冲动刺激追寻(INS)","transition":"phase:结束阶段"}],"id":1776503949320,"completedCount":0},{"name":"反应性-主动性攻击量表（简式中文版）","shortName":"RPQ-SC","code":"RPQ_SC","category":"spirit","categoryName":"心理健康与精神病态量表","emoji":"📋","color":"#4a90d9","duration":6,"questionTime":30,"questionCount":11,"applicablePeople":"","desc":"反应性 - 主动性攻击量表（简式中文版）由原版简化编制，共 11 题，分两维度自评攻击行为，信效度佳、作答快，适配多类测评场景。","instruction":"请依据自身真实情况，为下列说法选最贴合的答案。1 = 从来没有，2 = 有时，3 = 经常。","notice":["独立完成填写","按真实情况作答","无需过度思考","每题仅选一个答案","完成全部题目"],"tags":["专业量表"],"status":1,"sortOrder":0,"rating":5,"npcConfig":{"counselorId":"counselor_new_1777407113128","backgroundId":"bg_new_1777404516079"},"questions":[{"id":1,"content":"当他人故意惹我生气时，我会发火","options":[{"id":"A","label":"从来没有","score":1},{"id":"B","label":"有时","score":2},{"id":"C","label":"经常","score":3}],"dimension":"反应性攻击(RA)","transition":"phase:开始阶段"},{"id":2,"content":"当有人伤害我时，我会还击","options":[{"id":"A","label":"从来没有","score":1},{"id":"B","label":"有时","score":2},{"id":"C","label":"经常","score":3}],"dimension":"反应性攻击(RA)","transition":"phase:开始阶段"},{"id":3,"content":"当有人威胁我时，我会变得愤怒","options":[{"id":"A","label":"从来没有","score":1},{"id":"B","label":"有时","score":2},{"id":"C","label":"经常","score":3}],"dimension":"反应性攻击(RA)","transition":"phase:开始阶段"},{"id":4,"content":"当事情不顺利时，我会变得沮丧","options":[{"id":"A","label":"从来没有","score":1},{"id":"B","label":"有时","score":2},{"id":"C","label":"经常","score":3}],"dimension":"反应性攻击(RA)","transition":"phase:中间阶段"},{"id":5,"content":"当有人冤枉我时，我会很生气","options":[{"id":"A","label":"从来没有","score":1},{"id":"B","label":"有时","score":2},{"id":"C","label":"经常","score":3}],"dimension":"反应性攻击(RA)","transition":"phase:中间阶段"},{"id":6,"content":"当有人嘲笑我时，我会动手","options":[{"id":"A","label":"从来没有","score":1},{"id":"B","label":"有时","score":2},{"id":"C","label":"经常","score":3}],"dimension":"反应性攻击(RA)","transition":"phase:中间阶段"},{"id":7,"content":"当他人挑起事端时，我会很快还手","options":[{"id":"A","label":"从来没有","score":1},{"id":"B","label":"有时","score":2},{"id":"C","label":"经常","score":3}],"dimension":"反应性攻击(RA)","transition":"phase:中间阶段"},{"id":8,"content":"我会为了得到想要的东西而威胁他人","options":[{"id":"A","label":"从来没有","score":1},{"id":"B","label":"有时","score":2},{"id":"C","label":"经常","score":3}],"dimension":"主动性攻击(PA)","transition":"phase:中间阶段"},{"id":9,"content":"我会主动攻击他人以夺取物品","options":[{"id":"A","label":"从来没有","score":1},{"id":"B","label":"有时","score":2},{"id":"C","label":"经常","score":3}],"dimension":"主动性攻击(PA)","transition":"phase:结束阶段"},{"id":10,"content":"我会为了好玩而欺负或威胁他人","options":[{"id":"A","label":"从来没有","score":1},{"id":"B","label":"有时","score":2},{"id":"C","label":"经常","score":3}],"dimension":"主动性攻击(PA)","transition":"phase:结束阶段"},{"id":11,"content":"我会主动伤害或打击他人","options":[{"id":"A","label":"从来没有","score":1},{"id":"B","label":"有时","score":2},{"id":"C","label":"经常","score":3}],"dimension":"主动性攻击(PA)","transition":"phase:结束阶段"}],"id":1776504488269,"completedCount":18}];
    
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
                // 检查缓存中的量表是否缺少 npcConfig（旧版本缓存）
                var needsUpdate = cached.some(function(s) { return !s.npcConfig; });
                if (needsUpdate && DEFAULT_SCALES.some(function(s) { return s.npcConfig; })) {
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
         * 获取 AI 配置（内置默认配置，用于 WebView 模式直连 AI 服务）
         * @returns {object} { provider, dashscope: { apiKey, model }, ollama: {...} }
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