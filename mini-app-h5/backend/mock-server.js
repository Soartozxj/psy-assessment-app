/**
 * 本地 Mock 系统 v1.0.0
 * 
 * 功能：
 * 1. 拦截 API 请求并返回 Mock 数据
 * 2. 模拟网络延迟和错误响应
 * 3. 支持本地数据持久化（localStorage）
 * 4. 无需后端服务即可进行本地测试
 * 
 * 使用方法：
 * 1. 在 admin-legacy.html 中引入此文件（开发环境）
 * 2. 设置 window.USE_MOCK = true 启用 Mock 模式
 * 3. 所有 API 请求将自动被拦截并返回 Mock 数据
 * 
 * @version 1.0.0
 * @date 2026-06-05
 */

(function() {
  'use strict';

  // ====================================================
  // 配置项
  // ====================================================
  const MOCK_CONFIG = {
    // 是否启用 Mock 模式
    enabled: window.USE_MOCK !== false,
    
    // 模拟网络延迟（毫秒）
    delay: {
      min: 100,
      max: 500
    },
    
    // 是否模拟随机错误（用于测试错误处理）
    simulateErrors: false,
    errorRate: 0.05, // 5% 概率返回错误
    
    // Mock 数据版本
    version: '1.0.0'
  };

  // ====================================================
  // Mock 数据存储（使用 localStorage）
  // ====================================================
  const MockDB = {
    // 获取存储的数据
    get(collection) {
      const key = `mock_db_${collection}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    },

    // 保存数据
    set(collection, data) {
      const key = `mock_db_${collection}`;
      localStorage.setItem(key, JSON.stringify(data));
    },

    // 初始化默认数据
    initDefaults() {
      // 初始化 Skill 数据
      if (!localStorage.getItem('mock_db_skills')) {
        const defaultSkills = {
'csv-v3_1': { name: 'csv-v3_1', displayName: '量表 CSV 生成 v3.1', type: 'system-prompt', category: 'import', version: '3.1', description: '量表 CSV 生成 提示词 v3.1', body: '_日期: 2026-05-07_\n\n你是一位心理测量学专家，精通各类心理评估量表的维度结构、计分方法和题目编制规范，同时具备专业的结构化数据处理能力。\n\n我接下来会发送一份量表手册的原文给你。这份手册可能包含一张或多张量表（可能以"附："、"附录"、"量表一"等形式分隔），也可能存在题目缺失、编号不连续、选项数量不统一、反向计分、特殊题型（矩阵题/父子题）等实际情况。\n\n你的任务是：\n\n1. 通读全文，识别其中所有量表\n2. 对每张量表，提取其基本信息（名称、编码、分类、描述、指导语等）和全部题目（题号、题目内容、所属维度、选项及分值）\n   ⚠️ 题目内容和选项文本必须逐字照搬手册原文，严禁', content: '_日期: 2026-05-07_\n\n你是一位心理测量学专家，精通各类心理评估量表的维度结构、计分方法和题目编制规范，同时具备专业的结构化数据处理能力。\n\n我接下来会发送一份量表手册的原文给你。这份手册可能包含一张或多张量表（可能以"附："、"附录"、"量表一"等形式分隔），也可能存在题目缺失、编号不连续、选项数量不统一、反向计分、特殊题型（矩阵题/父子题）等实际情况。\n\n你的任务是：\n\n1. 通读全文，识别其中所有量表\n2. 对每张量表，提取其基本信息（名称、编码、分类、描述、指导语等）和全部题目（题号、题目内容、所属维度、选项及分值）\n   ⚠️ 题目内容和选项文本必须逐字照搬手册原文，严禁', enabled: true },
          'json-v5_3': { name: 'json-v5_3', displayName: '量表 JSON 生成 v5.3', type: 'system-prompt', category: 'import', version: '5.3', description: '量表 JSON 生成 提示词 v5.3', body: '你是一位心理测量学专家，精通各类心理评估量表的维度结构、计分方法和题目编制规范，同时具备专业的结构化数据处理能力。另外，你还需要将量表的专业信息「翻译」为普通用户能理解的展示文案——不是学术编辑，也不是营销文案，而是**专家翻译**：基于量表的真实内容，用通俗语言讲清楚"这个测什么"和"做完我能知道什么"。\n\n我接下来会发送一份量表手册的原文给你。这份手册可能包含一张或多张量表（可能以"附："、"附录"、"量表一"等形式分隔），也可能存在题目缺失、编号不连续、选项数量不统一、反向计分、特殊题型（矩阵题/父子题/文字题）等实际情况。\n\n你的任务是：\n\n1. 通读全文，识别其中所有量表\n2. 对每', content: '你是一位心理测量学专家，精通各类心理评估量表的维度结构、计分方法和题目编制规范，同时具备专业的结构化数据处理能力。另外，你还需要将量表的专业信息「翻译」为普通用户能理解的展示文案——不是学术编辑，也不是营销文案，而是**专家翻译**：基于量表的真实内容，用通俗语言讲清楚"这个测什么"和"做完我能知道什么"。\n\n我接下来会发送一份量表手册的原文给你。这份手册可能包含一张或多张量表（可能以"附："、"附录"、"量表一"等形式分隔），也可能存在题目缺失、编号不连续、选项数量不统一、反向计分、特殊题型（矩阵题/父子题/文字题）等实际情况。\n\n你的任务是：\n\n1. 通读全文，识别其中所有量表\n2. 对每', enabled: true },
          'meta-v2.4': { name: 'meta-v2.4', displayName: '报告结构化生成 v2.4', type: 'system-prompt', category: 'meta', version: '2.4', description: '报告结构化生成 提示词', body: '你是一个心理测评系统的 Prompt 工程师。\n\n请根据以下量表的完整信息，先分析量表，再为其生成一段「测评报告 System Prompt」。\n输出分为两步——先输出分析结果，再输出生成的 SP。（SP_START/SP_END 分隔符由系统自动追加，你不需要手动添加。）\n\n{scaleContext}\n\n━━━━━━━━━━━━━━━━━━━━\n\n## 第一步：量表分析\n\n填写以下分析模板，每一项必须基于 {scaleContext} 中的实际信息，不可猜测。\n每一项的取舍原则：该项信息是否直接影响后续 SP 的生成？若否，移除。\n\n【量表分析】\n\n**A. 测评关系**\n\n- 测评模式：', content: '你是一个心理测评系统的 Prompt 工程师。\n\n请根据以下量表的完整信息，先分析量表，再为其生成一段「测评报告 System Prompt」。\n输出分为两步——先输出分析结果，再输出生成的 SP。（SP_START/SP_END 分隔符由系统自动追加，你不需要手动添加。）\n\n{scaleContext}\n\n━━━━━━━━━━━━━━━━━━━━\n\n## 第一步：量表分析\n\n填写以下分析模板，每一项必须基于 {scaleContext} 中的实际信息，不可猜测。\n每一项的取舍原则：该项信息是否直接影响后续 SP 的生成？若否，移除。\n\n【量表分析】\n\n**A. 测评关系**\n\n- 测评模式：', enabled: true },
          'meta-v2.5': { name: 'meta-v2.5', displayName: '报告结构化生成 v2.5', type: 'system-prompt', category: 'meta', version: '2.5', description: '报告结构化生成 提示词', body: '你是一个心理测评系统的 Prompt 工程师。\n\n请根据以下量表的完整信息，先分析量表，再为其生成一段「测评报告 System Prompt」。\n输出分为两步——先输出分析结果，再输出生成的 SP。（SP_START/SP_END 分隔符由系统自动追加，你不需要手动添加。）\n\n{scaleContext}\n\n━━━━━━━━━━━━━━━━━━━━\n\n## 第一步：量表分析\n\n填写以下分析模板，每一项必须基于 {scaleContext} 中的实际信息，不可猜测。\n每一项的取舍原则：该项信息是否直接影响后续 SP 的生成？若否，移除。\n\n【量表分析】\n\n**A. 测评关系**\n\n- 测评模式：', content: '你是一个心理测评系统的 Prompt 工程师。\n\n请根据以下量表的完整信息，先分析量表，再为其生成一段「测评报告 System Prompt」。\n输出分为两步——先输出分析结果，再输出生成的 SP。（SP_START/SP_END 分隔符由系统自动追加，你不需要手动添加。）\n\n{scaleContext}\n\n━━━━━━━━━━━━━━━━━━━━\n\n## 第一步：量表分析\n\n填写以下分析模板，每一项必须基于 {scaleContext} 中的实际信息，不可猜测。\n每一项的取舍原则：该项信息是否直接影响后续 SP 的生成？若否，移除。\n\n【量表分析】\n\n**A. 测评关系**\n\n- 测评模式：', enabled: true },
          'meta-v2.6': { name: 'meta-v2.6', displayName: '报告结构化生成 v2.6', type: 'system-prompt', category: 'meta', version: '2.6', description: '报告结构化生成 提示词', body: '你是一个心理测评系统的 Prompt 工程师。\n\n请根据以下量表的完整信息，先分析量表，再为其生成一段「测评报告 System Prompt」。\n输出分为两步——先输出分析结果，再输出生成的 SP。（SP_START/SP_END 分隔符由系统自动追加，你不需要手动添加。）\n\n{scaleContext}\n\n━━━━━━━━━━━━━━━━━━━━\n\n## 第一步：量表分析\n\n填写以下分析模板，每一项必须基于 {scaleContext} 中的实际信息，不可猜测。\n每一项的取舍原则：该项信息是否直接影响后续 SP 的生成？若否，移除。\n\n【量表分析】\n\n**A. 测评关系**\n\n- 测评模式：', content: '你是一个心理测评系统的 Prompt 工程师。\n\n请根据以下量表的完整信息，先分析量表，再为其生成一段「测评报告 System Prompt」。\n输出分为两步——先输出分析结果，再输出生成的 SP。（SP_START/SP_END 分隔符由系统自动追加，你不需要手动添加。）\n\n{scaleContext}\n\n━━━━━━━━━━━━━━━━━━━━\n\n## 第一步：量表分析\n\n填写以下分析模板，每一项必须基于 {scaleContext} 中的实际信息，不可猜测。\n每一项的取舍原则：该项信息是否直接影响后续 SP 的生成？若否，移除。\n\n【量表分析】\n\n**A. 测评关系**\n\n- 测评模式：', enabled: true },
          'meta-v2_3': { name: 'meta-v2_3', displayName: '报告结构化生成 v2.3', type: 'system-prompt', category: 'meta', version: '2.3', description: '报告结构化生成 提示词 v2.3', body: '你是一个心理测评系统的 Prompt 工程师。\n\n请根据以下量表的完整信息，先分析量表，再为其生成一段「测评报告 System Prompt」。\n输出分为两步——先输出分析结果，再输出生成的 SP。（SP_START/SP_END 分隔符由系统自动追加，你不需要手动添加。）\n\n{scaleContext}\n\n━━━━━━━━━━━━━━━━━━━━\n\n## 第一步：量表分析\n\n填写以下分析模板，每一项必须基于 {scaleContext} 中的实际信息，不可猜测。\n每一项的取舍原则：该项信息是否直接影响后续 SP 的生成？若否，移除。\n\n【量表分析】\n\n**A. 测评关系**\n\n- 测评模式：', content: '你是一个心理测评系统的 Prompt 工程师。\n\n请根据以下量表的完整信息，先分析量表，再为其生成一段「测评报告 System Prompt」。\n输出分为两步——先输出分析结果，再输出生成的 SP。（SP_START/SP_END 分隔符由系统自动追加，你不需要手动添加。）\n\n{scaleContext}\n\n━━━━━━━━━━━━━━━━━━━━\n\n## 第一步：量表分析\n\n填写以下分析模板，每一项必须基于 {scaleContext} 中的实际信息，不可猜测。\n每一项的取舍原则：该项信息是否直接影响后续 SP 的生成？若否，移除。\n\n【量表分析】\n\n**A. 测评关系**\n\n- 测评模式：', enabled: true },
          'output-format-v1_0': { name: 'output-format-v1_0', displayName: '输出格式规范 v1.0', type: 'system-prompt', category: 'output', version: '1.0', description: '输出格式规范 提示词 v1.0', body: '【⚠️ 输出格式强制要求】\n你只能使用以下 Markdown 语法，严禁使用任何 HTML 标签：\n\n- 粗体用 **文字** ，斜体用 _文字_\n- 标题用 ## 或 ### 开头，分隔线用独占一行的 ---\n- 列表用 - 或数字编号 1. 2. 3. 开头\n- 引用语用 > 开头\n- **严禁**使用 <div>、<span>、<br>、<table>、<strong> 等 HTML 标签\n- **严禁**使用 | 列 | 列 | Markdown 表格语法\n- 如需呈现对比信息，请用列表或粗体标题+文字描述替代表格\n\n---', content: '【⚠️ 输出格式强制要求】\n你只能使用以下 Markdown 语法，严禁使用任何 HTML 标签：\n\n- 粗体用 **文字** ，斜体用 _文字_\n- 标题用 ## 或 ### 开头，分隔线用独占一行的 ---\n- 列表用 - 或数字编号 1. 2. 3. 开头\n- 引用语用 > 开头\n- **严禁**使用 <div>、<span>、<br>、<table>、<strong> 等 HTML 标签\n- **严禁**使用 | 列 | 列 | Markdown 表格语法\n- 如需呈现对比信息，请用列表或粗体标题+文字描述替代表格\n\n---', enabled: true },
          'scoring-merge-v1_0': { name: 'scoring-merge-v1_0', displayName: '计分合并提示词（一步到位） v1.0', type: 'system-prompt', category: 'scoring', version: '1.0', description: '计分合并提示词（一步到位） 提示词 v1.0', body: '## 角色定义\n\n你是心理测量学专家，精通各类心理评估量表的计分方法、维度结构、划界标准与解释体系，同时具备将非结构化文本转换为结构化 JSON 的能力。\n\n---\n\n## 输入说明\n\n我会同时提供两部分内容：\n\n**第一部分：量表手册原文**\n可能包含：\n\n- 多个版本（原版 vs 中文修订版、完整版 vs 简版）\n- 无关内容（编制背景、信效度、参考文献、实施指导等）\n- 长文本（需定位计分相关章节）\n\n**第二部分：量表字段信息**\n包含：\n\n- 题目列表（题号、题目类型：单选/矩阵/父子/分组下拉）\n- 选项分值范围\n- 实际导入的题目数量\n\n---\n\n## 处理流程（AI 内部推理，', content: '## 角色定义\n\n你是心理测量学专家，精通各类心理评估量表的计分方法、维度结构、划界标准与解释体系，同时具备将非结构化文本转换为结构化 JSON 的能力。\n\n---\n\n## 输入说明\n\n我会同时提供两部分内容：\n\n**第一部分：量表手册原文**\n可能包含：\n\n- 多个版本（原版 vs 中文修订版、完整版 vs 简版）\n- 无关内容（编制背景、信效度、参考文献、实施指导等）\n- 长文本（需定位计分相关章节）\n\n**第二部分：量表字段信息**\n包含：\n\n- 题目列表（题号、题目类型：单选/矩阵/父子/分组下拉）\n- 选项分值范围\n- 实际导入的题目数量\n\n---\n\n## 处理流程（AI 内部推理，', enabled: true },
          'scoring-parse-v1_1': { name: 'scoring-parse-v1_1', displayName: '计分 JSON 解析 v1.1', type: 'system-prompt', category: 'scoring', version: '1.1', description: '计分 JSON 解析 提示词 v1.1', body: '你是心理量表计分规则解析专家。阅读用户提供的量表计分规则文字，输出严格符合以下结构定义的 JSON。\n\n═══════════════════════════════════════════\n一、JSON 结构定义（严格遵守）\n═══════════════════════════════════════════\n\n{\n"dimensions": [\n{\n"key": "英文标识（如 somatization、neuroticism）",\n"label": "维度中文名（如"躯体化"、"神经质"）",\n"items": "题目编号，格式：1-5,7,12-15（连续用短横线，不连续用逗号）",', content: '你是心理量表计分规则解析专家。阅读用户提供的量表计分规则文字，输出严格符合以下结构定义的 JSON。\n\n═══════════════════════════════════════════\n一、JSON 结构定义（严格遵守）\n═══════════════════════════════════════════\n\n{\n"dimensions": [\n{\n"key": "英文标识（如 somatization、neuroticism）",\n"label": "维度中文名（如"躯体化"、"神经质"）",\n"items": "题目编号，格式：1-5,7,12-15（连续用短横线，不连续用逗号）",', enabled: true },
          'scoring-v4_4': { name: 'scoring-v4_4', displayName: '计分规则提取 v4.4', type: 'system-prompt', category: 'scoring', version: '4.4', description: '计分规则提取 提示词 v4.4', body: '你是一位心理测量学专家，精通各类心理评估量表的计分方法、维度结构、划界标准与解释体系，同时具备专业的结构化数据提取能力。\n\n我接下来会发送一份量表手册的原文给你。这份手册可能包含一张或多张量表的计分信息，也可能存在多个版本（如原版 vs 中文修订版、完整版 vs 简版）。\n\n你的任务是：\n\n1. 通读全文，识别与计分相关的所有内容\n2. 确认量表版本和题目数量，避免将不同版本混淆\n3. 提取维度/因子定义、全局指标、分数解释与划界标准\n4. 记录反向计分题号（仅作参考，不写入计分公式，见 B 节）\n5. 识别特殊题型（矩阵题、父子题、分组下拉题），并使用对应的计分格式（见 C 节）\n6. 按标', content: '你是一位心理测量学专家，精通各类心理评估量表的计分方法、维度结构、划界标准与解释体系，同时具备专业的结构化数据提取能力。\n\n我接下来会发送一份量表手册的原文给你。这份手册可能包含一张或多张量表的计分信息，也可能存在多个版本（如原版 vs 中文修订版、完整版 vs 简版）。\n\n你的任务是：\n\n1. 通读全文，识别与计分相关的所有内容\n2. 确认量表版本和题目数量，避免将不同版本混淆\n3. 提取维度/因子定义、全局指标、分数解释与划界标准\n4. 记录反向计分题号（仅作参考，不写入计分公式，见 B 节）\n5. 识别特殊题型（矩阵题、父子题、分组下拉题），并使用对应的计分格式（见 C 节）\n6. 按标', enabled: true },
          'system-templates-v1_0': { name: 'system-templates-v1_0', displayName: '系统提示词模板 v1.0', type: 'system-prompt', category: 'template', version: '1.0', description: '系统提示词模板 提示词 v1.0', body: '以下为各类型的初始模板文本，每段以 `---KEY---` 开头标记类型：\n\n---scoring---\n你是一位心理测量学专家，精通各类心理评估量表的计分方法、维度结构、划界标准与解释体系，同时具备专业的结构化数据提取能力。\n\n我接下来会发送一份量表手册的原文给你。这份手册可能包含一张或多张量表的计分信息，也可能存在多个版本（如原版 vs 中文修订版、完整版 vs 简版）。\n\n你的任务是：\n\n1. 通读全文，识别与计分相关的所有内容\n2. 确认量表版本和题目数量，避免将不同版本混淆\n3. 提取维度/因子定义、全局指标、分数解释与划界标准、筛查条件\n4. 记录反向计分题号（仅作参考，不写入计分', content: '以下为各类型的初始模板文本，每段以 `---KEY---` 开头标记类型：\n\n---scoring---\n你是一位心理测量学专家，精通各类心理评估量表的计分方法、维度结构、划界标准与解释体系，同时具备专业的结构化数据提取能力。\n\n我接下来会发送一份量表手册的原文给你。这份手册可能包含一张或多张量表的计分信息，也可能存在多个版本（如原版 vs 中文修订版、完整版 vs 简版）。\n\n你的任务是：\n\n1. 通读全文，识别与计分相关的所有内容\n2. 确认量表版本和题目数量，避免将不同版本混淆\n3. 提取维度/因子定义、全局指标、分数解释与划界标准、筛查条件\n4. 记录反向计分题号（仅作参考，不写入计分', enabled: true },
        };
        localStorage.setItem('mock_db_skills', JSON.stringify(defaultSkills));
      }
      // 初始化量表数据
      if (!localStorage.getItem('mock_db_scales')) {
        const defaultScales = [
          {
            id: 1,
            name: 'PHQ-9 抑郁症筛查',
            shortName: 'PHQ-9',
            code: 'phq9',
            category: 'depression',
            categoryName: '抑郁',
            emoji: '😔',
            color: '#4A90D9',
            duration: 5,
            questionCount: 9,
            desc: '抑郁症筛查量表',
            instruction: '请根据过去两周的感受选择最符合的选项',
            tags: ['抑郁', '筛查'],
            status: 1,
            completedCount: 1250,
            questions: [],
            scoring: {
              dimensions: [
                {
                  key: 'totalScore',
                  label: '总分',
                  items: 'ALL',
                  formula: 'SUM'
                }
              ],
              interpretation: [
                { min: 0, max: 4, label: '正常', color: '#52C41A' },
                { min: 5, max: 9, label: '轻度', color: '#FAAD14' },
                { min: 10, max: 14, label: '中度', color: '#FA8C16' },
                { min: 15, max: 27, label: '重度', color: '#FF4D4F' }
              ]
            }
          },
          {
            id: 2,
            name: 'GAD-7 焦虑症筛查',
            shortName: 'GAD-7',
            code: 'gad7',
            category: 'anxiety',
            categoryName: '焦虑',
            emoji: '😰',
            color: '#722ED1',
            duration: 4,
            questionCount: 7,
            desc: '焦虑症筛查量表',
            instruction: '请根据过去两周的感受选择最符合的选项',
            tags: ['焦虑', '筛查'],
            status: 1,
            completedCount: 980,
            questions: [],
            scoring: {
              dimensions: [
                {
                  key: 'totalScore',
                  label: '总分',
                  items: 'ALL',
                  formula: 'SUM'
                }
              ],
              interpretation: [
                { min: 0, max: 4, label: '正常', color: '#52C41A' },
                { min: 5, max: 9, label: '轻度', color: '#FAAD14' },
                { min: 10, max: 14, label: '中度', color: '#FA8C16' },
                { min: 15, max: 21, label: '重度', color: '#FF4D4F' }
              ]
            }
          }
        ];
        this.set('scales', defaultScales);
      }

      // 初始化历史记录
      if (!localStorage.getItem('mock_db_history')) {
        this.set('history', []);
      }

      // 初始化配置
      if (!localStorage.getItem('mock_db_config')) {
        const defaultConfig = {
          ai_config: {
            dashscope: {
              keys: [
                { key: 'sk-mock-key-001', name: '主 Key' },
                { key: 'sk-mock-key-002', name: '备用 #1' }
              ]
            },
            provider: 'dashscope'
          },
          npc_config: {
            counselors: [
              { id: 'counselor_001', name: '暖心姐姐', emoji: '👩' },
              { id: 'counselor_002', name: '理性导师', emoji: '👨💼' }
            ],
            backgrounds: [
              { id: 'bg_001', name: '温馨客厅', thumbnail: '' },
              { id: 'bg_002', name: '心理咨询室', thumbnail: '' }
            ]
          }
        };
        this.set('config', defaultConfig);
      }
    },

    // 生成唯一 ID
    generateId(collection) {
      const data = this.get(collection);
      const maxId = data.reduce((max, item) => Math.max(max, item.id || 0), 0);
      return maxId + 1;
    }
  };

  // ====================================================
  // Mock API 处理器
  // ====================================================
  const MockAPI = {
    // GET /api/scales - 获取量表列表
    async getScales(req) {
      const scales = MockDB.get('scales');
      const status = req.query.status;
      
      let filtered = scales;
      if (status !== undefined) {
        filtered = scales.filter(s => String(s.status) === String(status));
      }
      
      return {
        code: 0,
        data: filtered,
        count: filtered.length
      };
    },

    // PUT /api/scales - 全量同步量表
    async putScales(req) {
      const scales = req.body.scales || [];
      MockDB.set('scales', scales);
      return {
        code: 0,
        message: '同步成功',
        saved: scales.length,
        total: scales.length
      };
    },

    // POST /api/submit - 提交测评答案
    async submitAnswer(req) {
      const { scaleId, answers, duration } = req.body;
      
      // 模拟计分
      const scales = MockDB.get('scales');
      const scale = scales.find(s => String(s.id) === String(scaleId));
      
      if (!scale) {
        return { code: -1, message: '量表不存在' };
      }
      
      // 简单计分逻辑（实际应调用 ScoringEngine）
      let totalScore = 0;
      for (const [qid, optIdx] of Object.entries(answers)) {
        if (scale.questions[qid - 1] && scale.questions[qid - 1].options[optIdx]) {
          totalScore += scale.questions[qid - 1].options[optIdx].score || 0;
        }
      }
      
      const recordId = MockDB.generateId('history');
      const record = {
        id: recordId,
        scaleId: parseInt(scaleId),
        scaleName: scale.name,
        emoji: scale.emoji,
        score: totalScore,
        maxScore: 27, // 简化处理
        level: totalScore < 5 ? 'normal' : totalScore < 10 ? 'mild' : 'moderate',
        levelName: totalScore < 5 ? '正常' : totalScore < 10 ? '轻度' : '中度',
        color: totalScore < 5 ? '#52C41A' : totalScore < 10 ? '#FAAD14' : '#FF4D4F',
        categoryName: scale.categoryName,
        date: new Date().toLocaleDateString('zh-CN'),
        completedAt: new Date().toISOString(),
        _openid: req.body._openid || 'mock_user_001'
      };
      
      const history = MockDB.get('history');
      history.push(record);
      MockDB.set('history', history);
      
      return {
        code: 0,
        data: {
          id: recordId,
          score: totalScore,
          maxScore: 27,
          level: record.level,
          levelName: record.levelName,
          color: record.color,
          interp: '模拟解释文本',
          dims: [],
          screening: { result: 'none' }
        }
      };
    },

    // GET /api/history - 查询测评历史
    async getHistory(req) {
      const openid = req.query.openid;
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;
      
      let history = MockDB.get('history');
      
      // 按 openid 过滤
      if (openid) {
        history = history.filter(h => h._openid === openid);
      }
      
      // 分页
      const total = history.length;
      const start = (page - 1) * pageSize;
      const paginated = history.slice(start, start + pageSize);
      
      return {
        code: 0,
        data: {
          list: paginated,
          total,
          page,
          pageSize
        }
      };
    },

    // DELETE /api/history/:id - 删除历史记录
    async deleteHistory(req) {
      const id = parseInt(req.params.id);
      let history = MockDB.get('history');
      
      history = history.filter(h => h.id !== id);
      MockDB.set('history', history);
      
      return { code: 0, message: '删除成功' };
    },

    // GET /api/ai-config - 获取 AI 配置
    async getAIConfig(req) {
      const config = MockDB.get('config');
      const aiConfig = config.ai_config || {};
      
      // 脱敏处理
      const maskedKeys = (aiConfig.dashscope?.keys || []).map((k, i) => ({
        index: i + 1,
        key: k.key.substring(0, 8) + '***' + k.key.substring(k.key.length - 4),
        name: k.name,
        active: i === 0
      }));
      
      return {
        code: 0,
        data: {
          count: maskedKeys.length,
          keys: maskedKeys,
          provider: aiConfig.provider || 'dashscope'
        }
      };
    },

    // PUT /api/ai-config - 保存 AI 配置
    async putAIConfig(req) {
      const { keys } = req.body;
      const config = MockDB.get('config');
      
      if (!config.ai_config) {
        config.ai_config = { dashscope: { keys: [] } };
      }
      
      config.ai_config.dashscope.keys = keys.map((k, i) => ({
        key: typeof k === 'string' ? k : k.key,
        name: i === 0 ? '主 Key' : `备用 #${i}`
      }));
      
      MockDB.set('config', config);
      
      return { code: 0, data: { count: keys.length } };
    },

    // GET /api/skills - 获取 Skill 列表
    async getSkills(req) {
      const skills = MockDB.get('skills');
      const result = Object.values(skills);
      return { code: 0, data: result, total: result.length };
    },

    // GET /api/skills/:name - 获取单个 Skill
    async getSkill(req) {
      const name = req.params.name;
      const skills = MockDB.get('skills');
      const skill = skills[name];
      if (!skill) return { code: -1, message: 'Skill 不存在' };
      
      // 从服务端读取真实的 .md 文件内容
      if (!skill.body || skill.body.length < 10) {
        try {
          const originalFetch = window._mockOriginalFetch || fetch;
          const resp = await originalFetch('../skills/system-prompts/' + name + '.md');
          if (resp.ok) {
            const mdContent = await resp.text();
            skill.body = mdContent;
            skill.content = mdContent;
            skills[name] = skill;
            MockDB.set('skills', skills);
          }
        } catch (e) {
          // 读取失败就用 saved body
        }
      }
      
      return { code: 0, data: skill };
    },

    // PUT /api/skills/:name - 保存单个 Skill
    async saveSkill(req) {
      const name = req.params.name;
      const skills = MockDB.get('skills');
      skills[name] = { ...skills[name], ...req.body, name };
      MockDB.set('skills', skills);
      return { code: 0, message: 'Skill 已保存' };
    },

    // DELETE /api/skills/:name - 删除单个 Skill
    async deleteSkill(req) {
      const name = req.params.name;
      const skills = MockDB.get('skills');
      delete skills[name];
      MockDB.set('skills', skills);
      return { code: 0, message: 'Skill 已删除' };
    },

    // GET /api/npc-config - 获取 NPC 配置
    async getNPCConfig(req) {
      const config = MockDB.get('config');
      const npcConfig = config.npc_config || {};
      return { code: 0, data: npcConfig };
    },

    // PUT /api/npc-config - 保存 NPC 配置
    async putNPCConfig(req) {
      const config = MockDB.get('config');
      config.npc_config = req.body;
      MockDB.set('config', config);
      return { code: 0, message: 'NPC 配置已保存' };
    },

    // GET /api/npc-images - 获取图片 ID 列表（Mock）
    async getNPCImages(req) {
      const config = MockDB.get('config');
      const npcConfig = config.npc_config || {};
      // 返回所有有图片的 counselor 和 background 的 ID 列表
      const ids = [
        ...(npcConfig.counselors || []).map(c => c.id),
        ...(npcConfig.backgrounds || []).map(b => b.id)
      ];
      return { code: 0, data: { imageIds: ids } };
    },

    // GET /api/npc-image?imageId=... - 获取单张图片（Mock：返回简单占位图）
    async getNPCImage(req) {
      const imageId = req.query && req.query.imageId;
      if (!imageId) return { code: -1, message: '缺少 imageId 参数' };
      // 返回一个简单的 SVG 占位图 base64
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
        <rect width="200" height="300" fill="#e8e0f0"/>
        <circle cx="100" cy="90" r="45" fill="#c4b5d4"/>
        <rect x="60" y="150" width="80" height="100" rx="10" fill="#c4b5d4"/>
        <text x="100" y="280" text-anchor="middle" fill="#8b7fa8" font-size="11">Mock 占位图</text>
      </svg>`;
      const base64 = btoa(unescape(encodeURIComponent(svg)));
      return { code: 0, data: { imageId, base64: `data:image/svg+xml;base64,${base64}`, mimeType: 'image/svg+xml' } };
    },

    // POST /api/ai-diagnose - AI 诊断（模拟）
    async aiDiagnose(req) {
      // 模拟 AI 返回
      const mockDiagnoses = [
        '根据您的测评结果，建议保持积极乐观的心态，适当运动，保证充足睡眠。',
        '您的心理状态总体良好，但需要注意调节工作压力，建议尝试冥想或深呼吸练习。',
        '建议寻求专业心理咨询师的帮助，进行更深入的评估和指导。'
      ];
      
      const randomIndex = Math.floor(Math.random() * mockDiagnoses.length);
      
      return {
        code: 0,
        data: mockDiagnoses[randomIndex]
      };
    }
  };

  // ====================================================
  // 请求拦截器
  // ====================================================
  function interceptFetch() {
    const originalFetch = window.fetch;
    window._mockOriginalFetch = originalFetch;
    
    window.fetch = async function(url, options = {}) {
      // 如果请求 .md 文件（Skill 正文），直接转发
      if (url.includes('.md')) {
        return originalFetch.apply(this, arguments);
      }
      
      // 如果不是 API 请求，直接转发
      if (!url.includes('/api/')) {
        return originalFetch.apply(this, arguments);
      }
      
      // NPC API 始终走真实云端（Mock 数据非真实 NPC）
      const isNPCAPI = url.includes('/api/npc-');
      if (isNPCAPI) {
        return originalFetch.apply(this, arguments);
      }
      
      // Skills API 始终走 Mock（本地无可用的 skills 后端）
      const isSkillAPI = url.includes('/api/skills');
      
      // Mock 未启用且非 skill API → 转发真实请求
      if (!MOCK_CONFIG.enabled && !isSkillAPI) {
        return originalFetch.apply(this, arguments);
      }
      
      console.log(`[Mock] 拦截 API 请求: ${options.method || 'GET'} ${url}`);
      
      // 模拟网络延迟
      const delay = MOCK_CONFIG.delay.min + Math.random() * (MOCK_CONFIG.delay.max - MOCK_CONFIG.delay.min);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 模拟随机错误
      if (MOCK_CONFIG.simulateErrors && Math.random() < MOCK_CONFIG.errorRate) {
        console.warn('[Mock] 模拟随机错误');
        return {
          ok: false,
          status: 500,
          json: async () => ({ code: -1, message: '模拟服务器错误' })
        };
      }
      
      // 解析请求
      const urlObj = new URL(url, window.location.origin);
      const path = urlObj.pathname;
      const method = options.method || 'GET';
      const body = options.body ? JSON.parse(options.body) : {};
      
      const req = {
        query: Object.fromEntries(urlObj.searchParams),
        params: extractParams(path),
        body,
        method
      };
      
      // 路由到对应的 Mock 处理器
      let result;
      
      try {
        if (path === '/api/skills' && method === 'GET') {
          result = await MockAPI.getSkills(req);
        } else if (path.startsWith('/api/skills/') && method === 'GET') {
          result = await MockAPI.getSkill(req);
        } else if (path.startsWith('/api/skills/') && method === 'PUT') {
          result = await MockAPI.saveSkill(req);
        } else if (path.startsWith('/api/skills/') && method === 'DELETE') {
          result = await MockAPI.deleteSkill(req);
        } else if (path === '/api/scales' && method === 'GET') {
          result = await MockAPI.getScales(req);
        } else if (path === '/api/scales' && method === 'PUT') {
          result = await MockAPI.putScales(req);
        } else if (path === '/api/submit' && method === 'POST') {
          result = await MockAPI.submitAnswer(req);
        } else if (path === '/api/history' && method === 'GET') {
          result = await MockAPI.getHistory(req);
        } else if (path.startsWith('/api/history/') && method === 'DELETE') {
          result = await MockAPI.deleteHistory(req);
        } else if (path === '/api/ai-config' && method === 'GET') {
          result = await MockAPI.getAIConfig(req);
        } else if (path === '/api/ai-config' && method === 'PUT') {
          result = await MockAPI.putAIConfig(req);
        } else if (path === '/api/npc-config' && method === 'GET') {
          result = await MockAPI.getNPCConfig(req);
        } else if (path === '/api/npc-config' && method === 'PUT') {
          result = await MockAPI.putNPCConfig(req);
        } else if (path === '/api/npc-images' && method === 'GET') {
          result = await MockAPI.getNPCImages(req);
        } else if (path === '/api/npc-image' && method === 'GET') {
          result = await MockAPI.getNPCImage(req);
        } else if (path === '/api/npc-image' && method === 'PUT') {
          result = { code: 0, message: '图片已存储（Mock）', data: { id: req.body.imageId } };
        } else if (path === '/api/ai-diagnose' && method === 'POST') {
          result = await MockAPI.aiDiagnose(req);
        } else {
          console.warn(`[Mock] 未实现的 API: ${method} ${path}`);
          result = { code: -1, message: '未实现的 Mock API' };
        }
      } catch (error) {
        console.error('[Mock] 处理请求失败:', error);
        result = { code: -1, message: error.message };
      }
      
      // 返回模拟响应
      return {
        ok: result.code === 0,
        status: result.code === 0 ? 200 : 500,
        json: async () => result,
        text: async () => JSON.stringify(result)
      };
    };
    
    console.log('[Mock] fetch 已拦截，所有 API 请求将返回 Mock 数据');
  }

  // 辅助函数：从路径中提取参数
  function extractParams(path) {
    // /api/history/:id
    let match = path.match(/\/api\/history\/(\d+)/);
    if (match) return { id: match[1], name: match[1] };
    // /api/skills/:name
    match = path.match(/\/api\/skills\/(.+)/);
    if (match) return { name: match[1] };
    return {};
  }

  // ====================================================
  // 初始化
  // ====================================================
  function init() {
    // 始终安装拦截器（skills API 即使 Mock 关闭也需要拦截）
    // 检查是否启用 Mock 模式
    const isEnabled = MOCK_CONFIG.enabled || window.USE_MOCK;
    if (!isEnabled) {
      console.log('[Mock] Mock 模式未启用（skills API 代理保持活跃）');
    } else {
      console.log('[Mock] 正在初始化 Mock 系统...');
    }
    
    // 初始化默认数据
    MockDB.initDefaults();
    
    // 拦截 fetch 请求
    interceptFetch();
    
    // 暴露 Mock 控制接口到全局
    window.MockServer = {
      version: MOCK_CONFIG.version,
      config: MOCK_CONFIG,
      db: MockDB,
      api: MockAPI,
      
      // 启用/禁用 Mock
      enable() {
        window.USE_MOCK = true;
        location.reload();
      },
      
      disable() {
        window.USE_MOCK = false;
        location.reload();
      },
      
      // 清除所有 Mock 数据
      reset() {
        Object.keys(localStorage)
          .filter(key => key.startsWith('mock_db_'))
          .forEach(key => localStorage.removeItem(key));
        console.log('[Mock] 所有 Mock 数据已清除');
      },
      
      // 打印当前 Mock 数据
      printData(collection) {
        console.log(`[Mock] ${collection} 数据:`, MockDB.get(collection));
      }
    };
    
    console.log('[Mock] ✅ Mock 系统初始化完成');
    console.log('[Mock] 使用 window.MockServer 控制 Mock 行为');
    console.log('[Mock]  - MockServer.enable() / disable()');
    console.log('[Mock]  - MockServer.reset() 清除数据');
  }

  // 在 DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
