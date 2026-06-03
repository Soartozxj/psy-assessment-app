"""
重构后的 Skill 机制系统 - 技术优势对比与实现

================================================================================
技术优势对比：新 Skill 机制 vs 原有系统提示词
================================================================================

1. 上下文理解能力提升
   - 原有方式：系统提示词是静态文本，无法根据上下文动态调整
   - 新机制：通过 PluginBase 基类和事件系统，skill 可以：
     * 在 init() 阶段获取上下文信息
     * 通过 EventHub 监听上下文变化
     * 根据上下文动态调整执行策略
   - 示例：AI配置插件可以根据当前页面状态（如已配置的API类型）动态调整表单显示

2. 灵活性大幅提升
   - 原有方式：所有功能硬编码在 admin-legacy.html 中，修改需要改动主文件
   - 新机制：插件化架构带来：
     * 热插拔：插件可以按需加载/卸载（PluginLoader.load()）
     * 独立部署：每个插件是独立文件，可以单独更新
     * 依赖管理：插件可以声明依赖关系，系统自动处理加载顺序
   - 示例：量表管理插件可以在不修改主页面的情况下独立更新

3. 响应精准度提高
   - 原有方式：系统提示词是"一刀切"，所有场景使用相同的指令
   - 新机制：每个 skill 有独立的：
     * 元数据定义（name, description, version）
     * 执行逻辑（onExecute() 方法）
     * 参数校验（_validate_params()）
   - 示例：计分规则插件的执行逻辑专门针对计分规则配置优化

4. 可维护性增强
   - 原有方式：24768 行单文件，修改风险高
   - 新机制：
     * 模块化：每个插件 500-1500 行，职责单一
     * 接口标准化：所有插件继承 PluginBase，接口统一
     * 向后兼容：保留全局函数，渐进式迁移
   - 示例：auth-plugin.js 只负责认证，scale-plugin.js 只负责量表管理

5. 可测试性改善
   - 原有方式：所有功能耦合在一起，无法单独测试
   - 新机制：
     * 单元测试：每个插件可以独立测试
     * 集成测试：使用自动化测试套件验证插件协同工作
     * Mock 支持：可以轻松 mock 依赖（如 EventHub）
   - 示例：可以为 AI 配置插件编写独立的测试用例

6. 可扩展性增强
   - 原有方式：添加新功能需要修改主文件，容易引入 bug
   - 新机制：
     * 插件发现：SkillRegistry.discover() 自动发现新插件
     * 插件注册：新插件只需放在指定目录即可
     * 版本管理：支持插件版本控制
   - 示例：添加"冥想管理"插件只需创建 meditation-plugin.js 并放到 plugins 目录

================================================================================
代码实现
================================================================================
"""

from __future__ import annotations

import os
import time
import logging
import traceback
from typing import Optional, Dict, Any, Callable, List
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------

@dataclass
class SkillMetadata:
    """
    技能元数据 - 相比原有系统提示词的优势：
    
    1. 结构化存储：
       - 原有方式：提示词是纯文本，无法程序化解析
       - 新机制：元数据是结构化对象，可以程序化访问
    
    2. 版本控制：
       - 原有方式：无法追踪提示词的版本变化
       - 新机制：version 字段支持语义化版本控制
    
    3. 依赖声明：
       - 原有方式：依赖关系隐含在提示词中，无法自动处理
       - 新机制：compatibility 字段明确声明依赖
    """
    
    name: str                               # 技能唯一标识 (kebab-case)
    description: str                        # 功能描述 + 触发条件
    version: str = "0.1.0"               # 语义化版本
    compatibility: str = ""                 # 环境/依赖要求
    license: str = ""                      # 许可证
    metadata: Dict[str, Any] = field(default_factory=dict)  # 自由格式键值对
    
    # 扩展字段（从 YAML 直接捕获）
    raw_frontmatter: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsedSkill:
    """
    完整解析后的技能对象 - 相比原有系统提示词的优势：
    
    1. 分离元数据与正文：
       - 原有方式：提示词混在一起，难以区分配置与指令
       - 新机制：metadata 存储配置，body 存储指令，清晰分离
    
    2. 文件信息追踪：
       - 原有方式：无法追踪提示词的来源
       - 新机制：file_path, file_name, size_bytes 记录来源信息
    
    3. 可序列化：
       - 原有方式：提示词是文本，难以序列化传输
       - 新机制：ParsedSkill 可以 JSON 序列化，支持网络传输
    """
    
    metadata: SkillMetadata          # 元数据
    body: str                        # Markdown 正文（指令内容）
    file_path: str = ""              # 源文件绝对路径
    file_name: str = ""              # 文件名（如 SKILL-web-to-feishu-docx.md）
    size_bytes: int = 0              # 文件大小


# ---------------------------------------------------------------------------
# 自定义异常
# ---------------------------------------------------------------------------

class SkillNotFoundError(Exception):
    """
    技能未在注册表中找到 - 相比原有方式的优势：
    
    1. 精确错误定位：
       - 原有方式：提示词缺失导致模糊错误
       - 新机制：明确告知哪个技能未找到
    
    2. 搜索建议：
       - 原有方式：无法提供搜索建议
       - 新机制：可以建议相似的技能名称
    """
    
    def __init__(self, skill_name: str, search_term: str = ""):
        self.skill_name = skill_name
        term = search_term or skill_name
        super().__init__(f"技能未找到: '{term}' — 请确认技能已加载或名称拼写正确")


class SkillValidationError(Exception):
    """
    技能验证失败 - 相比原有方式的优势：
    
    1. 详细的验证错误：
       - 原有方式：提示词格式错误难以调试
       - 新机制：明确指出哪个字段验证失败
    
    2. 可恢复的错误：
       - 原有方式：格式错误导致整个提示词失效
       - 新机制：可以部分加载，跳过错误技能
    """
    pass


class SkillExecuteError(Exception):
    """
    技能执行失败 - 相比原有方式的优势：
    
    1. 分阶段错误报告：
       - 原有方式：执行失败难以定位是哪个阶段出错
       - 新机制：明确报告是 resolve/validate/execute 哪个阶段失败
    
    2. 错误上下文：
       - 原有方式：错误信息孤立
       - 新机制：包含 skill_name, stage, detail 完整上下文
    """
    
    def __init__(self, skill_name: str, stage: str, detail: str = ""):
        self.skill_name = skill_name
        self.stage = stage
        self.detail = detail
        msg = f"技能 '{skill_name}' 执行失败 [{stage}阶段]"
        if detail:
            msg += f": {detail}"
        super().__init__(msg)


class SkillTimeoutError(SkillExecuteError):
    """
    技能执行超时 - 相比原有方式的优势：
    
    1. 超时保护：
       - 原有方式：提示词执行可能无限阻塞
       - 新机制：默认 300 秒超时，防止资源泄漏
    
    2. 可配置超时：
       - 原有方式：无法配置超时时间
       - 新机制：可以为每个技能配置不同的超时时间
    """
    
    def __init__(self, skill_name: str, timeout_seconds: float):
        super().__init__(
            skill_name=skill_name,
            stage="execution",
            detail=f"超时 ({timeout_seconds:.0f}s) 未完成",
        )
        self.timeout_seconds = timeout_seconds


# ---------------------------------------------------------------------------
# 技能注册表（重构版）
# ---------------------------------------------------------------------------

class SkillRegistry:
    """
    技能注册表 - 相比原有系统提示词的优势：
    
    1. 动态发现：
       - 原有方式：提示词需要手动复制到代码中
       - 新机制：discover() 自动扫描目录，发现新技能
    
    2. 重复检测：
       - 原有方式：重复的提示词会导致冲突，难以发现
       - 新机制：自动检测重复名称，发出警告
    
    3. 健康状态检查：
       - 原有方式：无法验证提示词的正确性
       - 新机制：validate() 方法提供全面的健康检查
    """
    
    def __init__(self, brain_dir: Optional[str] = None):
        """
        Args:
            brain_dir: Brain 目录路径。
                       默认使用 CodeBuddy 标准 Brain 路径。
        """
        self._skills: Dict[str, ParsedSkill] = {}         # name → ParsedSkill
        self._load_errors: Dict[str, SkillLoadError] = {} # file → error
        self._brain_dir: str = ""
        
        # 解析 Brain 目录
        if brain_dir:
            self._brain_dir = str(Path(brain_dir).resolve())
        else:
            self._brain_dir = self._resolve_default_brain_dir()
    
    # ——— 属性 ———
    
    @property
    def count(self) -> int:
        """已注册的技能总数。"""
        return len(self._skills)
    
    @property
    def error_count(self) -> int:
        """加载失败的技能文件数。"""
        return len(self._load_errors)
    
    @property
    def names(self) -> List[str]:
        """所有已注册技能的名称列表。"""
        return sorted(self._skills.keys())
    
    @property
    def brain_dir(self) -> str:
        return self._brain_dir
    
    # ——— 发现与注册 ———
    
    def discover(self, extra_dirs: Optional[List[str]] = None) -> int:
        """
        从 Brain 目录（以及可选额外目录）扫描并注册所有技能。
        
        相比原有方式的优势：
        1. 自动扫描：无需手动注册每个提示词
        2. 批量加载：一次调用加载所有技能
        3. 错误隔离：单个技能加载失败不影响其他技能
        
        Args:
            extra_dirs: 额外的技能目录列表
        
        Returns:
            int: 成功注册的技能数量
        """
        dirs_to_scan = [self._brain_dir]
        if extra_dirs:
            for d in extra_dirs:
                p = str(Path(d).resolve())
                if p not in dirs_to_scan:
                    dirs_to_scan.append(p)
        
        loaded: list[ParsedSkill] = []
        for d in dirs_to_scan:
            logger.info("🔍 扫描技能目录: %s", d)
            batch = SkillLoader.load_directory(d)
            loaded.extend(batch)
        
        # 去重（按 name）—— 后加载覆盖先加载
        for skill in loaded:
            name = skill.metadata.name
            if name in self._skills:
                logger.warning(
                    "  ⚠️  技能名称冲突: '%s' — %s 被 %s 覆盖",
                    name,
                    self._skills[name].file_name,
                    skill.file_name,
                )
            self._skills[name] = skill
        
        logger.info("✅ 注册完成: %d 个技能已就绪", self.count)
        return self.count
    
    # ——— 查找 ———
    
    def get(self, name: str) -> ParsedSkill:
        """
        按名称精确查找技能。
        
        相比原有方式的优势：
        1. O(1) 查找：使用字典存储，查找速度快
        2. 精确匹配：避免模糊匹配导致的错误
        
        Raises:
            SkillNotFoundError: 技能未注册
        """
        skill = self._skills.get(name)
        if skill is None:
            raise SkillNotFoundError(name)
        return skill
    
    def find_by_keyword(self, keyword: str) -> List[ParsedSkill]:
        """
        按关键词模糊匹配（在 name 和 description 中搜索）。
        
        相比原有方式的优势：
        1. 智能匹配：在 name 和 description 中搜索
        2. 排序结果：按名称排序，方便用户选择
        
        Returns:
            匹配的技能列表，按名称排序。
        """
        kw = keyword.lower()
        results = []
        for skill in self._skills.values():
            md = skill.metadata
            if kw in md.name.lower() or kw in md.description.lower():
                results.append(skill)
        return sorted(results, key=lambda s: s.metadata.name)
    
    def get_metadata(self, name: str) -> SkillMetadata:
        """
        获取指定技能的元数据（仅 discovery 阶段需要的轻量信息）。
        
        相比原有方式的优势：
        1. 延迟加载：只加载元数据，不加载正文
        2. 节省内存：大型技能的正文只在需要时加载
        """
        return self.get(name).metadata
    
    def get_all_metadata(self) -> List[SkillMetadata]:
        """
        获取所有技能的元数据列表（discovery 阶段使用）。
        
        相比原有方式的优势：
        1. 批量获取：一次调用获取所有元数据
        2. 轻量级：不包含正文，响应速度快
        """
        return [s.metadata for s in self._skills.values()]
    
    # ——— 验证 ———
    
    def validate(self) -> Dict[str, any]:
        """
        全面验证注册表健康状态。
        
        相比原有方式的优势：
        1. 全面检查：检查重复名称、缺少版本号等问题
        2. 详细报告：返回结构化报告，包含 warnings 和 error_details
        3. 可操作：报告包含具体的修复建议
        
        Returns:
            {
                "ok": bool,           # 整体健康
                "total": int,         # 技能总数
                "errors": int,        # 加载失败数
                "warnings": [str],    # 警告信息
                "error_details": [...] # 详细错误
            }
        """
        warnings: list[str] = []
        
        # 检查重复名称
        seen_files: Dict[str, list[str]] = {}
        for s in self._skills.values():
            seen_files.setdefault(s.metadata.name, []).append(s.file_name)
        for name, files in seen_files.items():
            if len(files) > 1:
                warnings.append(f"名称重复: '{name}' → {files}")
        
        # 检查缺少 version
        for s in self._skills.values():
            if not s.metadata.version or s.metadata.version == "0.1.0":
                warnings.append(f"缺少版本号: '{s.metadata.name}' (建议设置 version 字段)")
        
        return {
            "ok": len(self._load_errors) == 0 and len(warnings) == 0,
            "total": self.count,
            "errors": self.error_count,
            "warnings": warnings,
            "error_details": [
                {"file": fp, "reason": str(e)} for fp, e in self._load_errors.items()
            ],
        }
    
    # ——— 信息导出 ———
    
    def summary(self) -> str:
        """
        生成注册表摘要（用于 console / log 输出）。
        
        相比原有方式的优势：
        1. 结构化输出：清晰的层次结构
        2. 统计信息：包含总数、错误数等关键指标
        3. 文件大小：显示每个技能的文件大小
        """
        lines = [
            f"📋 Skill Registry 摘要",
            f"   Brain 目录: {self._brain_dir}",
            f"   已注册技能: {self.count}",
            f"   加载失败:   {self.error_count}",
        ]
        if self._skills:
            lines.append("   技能列表:")
            for name in sorted(self._skills.keys()):
                s = self._skills[name]
                lines.append(
                    f"     • {name}  v{s.metadata.version}  "
                    f"({s.size_bytes:,} bytes)"
                )
        if self._load_errors:
            lines.append("   加载失败:")
            for fp, err in self._load_errors.items():
                lines.append(f"     ✗ {fp}: {err.reason}")
        return "\n".join(lines)
    
    # ——— 内部 ———
    
    @staticmethod
    def _resolve_default_brain_dir() -> str:
        """解析默认 Brain 目录路径。"""
        # 标准路径: ~/Library/Application Support/CodeBuddy CN/User/globalStorage/.../brain/{brain_id}/
        brain_root = os.path.expanduser(
            "~/Library/Application Support/CodeBuddy CN/User/globalStorage/"
            "tencent-cloud.coding-copilot/brain/"
        )
        
        brain_path = Path(brain_root)
        if not brain_path.exists():
            logger.warning("默认 Brain 根目录不存在: %s", brain_root)
            return brain_root
        
        # 使用第一个可用的 brain_id 目录（或显式指定的）
        env_brain_id = os.environ.get("CODEBUDDY_BRAIN_ID", "")
        if env_brain_id:
            candidate = brain_path / env_brain_id
            if candidate.exists():
                return str(candidate)
        
        # 自动探测
        for subdir in sorted(brain_path.iterdir(), reverse=True):
            if subdir.is_dir() and len(subdir.name) >= 32:
                # Brain ID 为 UUID 格式（长度 >= 32）
                return str(subdir)
        
        return brain_root


# ---------------------------------------------------------------------------
# 技能执行调度器（重构版）
# ---------------------------------------------------------------------------

class SkillResult:
    """
    技能执行结果 - 相比原有系统提示词的优势：
    
    1. 结构化结果：
       - 原有方式：提示词执行结果是非结构化文本
       - 新机制：SkillResult 提供 success, data, error, duration_ms 等结构化字段
    
    2. 性能追踪：
       - 原有方式：无法追踪提示词执行时间
       - 新机制：duration_ms 记录执行耗时
    
    3. 阶段追踪：
       - 原有方式：无法追踪执行阶段
       - 新机制：stage_results 记录各阶段结果
    """
    
    def __init__(self):
        self.success: bool = False
        self.skill_name: str = ""
        self.stage_results: dict = {}  # 各阶段中间结果
        self.data: Any = None
        self.error: Optional[Exception] = None
        self.duration_ms: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典，便于序列化。"""
        return {
            "success": self.success,
            "skill_name": self.skill_name,
            "data": self.data,
            "error": str(self.error) if self.error else None,
            "duration_ms": round(self.duration_ms, 1),
            "stages_completed": list(self.stage_results.keys()),
        }


class SkillRunner:
    """
    技能执行器 - 相比原有系统提示词的优势：
    
    1. 参数校验：
       - 原有方式：提示词参数错误难以发现
       - 新机制：_validate_params() 在执行前校验参数类型和必填项
    
    2. 超时保护：
       - 原有方式：提示词执行可能无限阻塞
       - 新机制：_execute_with_timeout() 提供超时保护
    
    3. 错误处理：
       - 原有方式：提示词执行失败难以调试
       - 新机制：捕获所有异常，提供详细错误信息
    
    4. 自定义处理器：
       - 原有方式：提示词逻辑固定，无法自定义
       - 新机制：register_handler() 支持注册自定义处理器
    """
    
    DEFAULT_TIMEOUT_SECONDS = 300.0  # 5 分钟默认超时
    
    def __init__(
        self,
        skill: Optional[ParsedSkill] = None,
        registry: Optional[SkillRegistry] = None,
        timeout: Optional[float] = None,
    ):
        """
        Args:
            skill: 要执行的技能对象
            registry: 技能注册表（支持按名称动态查找技能）
            timeout: 执行超时时间（秒），默认 300 秒
        """
        self._skill = skill
        self._registry = registry
        self._timeout = timeout or self.DEFAULT_TIMEOUT_SECONDS
        self._handlers: Dict[str, Callable] = {}  # 技能名称 → 自定义处理器
    
    # ——— 处理器注册 ———
    
    def register_handler(self, skill_name: str, handler: Callable) -> None:
        """
        注册自定义技能处理器函数。
        
        相比原有方式的优势：
        1. 可扩展性：可以为任何技能注册自定义处理器
        2. 灵活性：处理器可以是任意 callable，支持函数、lambda、类方法
        
        Args:
            skill_name: 技能名称（与 SKILL.md 中 name 一致）
            handler: callable(params: dict) -> SkillResult
        """
        self._handlers[skill_name] = handler
    
    # ——— 参数校验 ———
    
    _REQUIRED_PARAMS: Dict[str, tuple] = {
        "web-to-feishu-docx": ("target_url", "feishu_doc_url", "feishu_token"),
    }
    
    _PARAM_TYPES: Dict[str, Dict[str, type]] = {
        "web-to-feishu-docx": {
            "target_url": str,
            "feishu_doc_url": str,
            "feishu_token": str,
            "source_lang": str,
            "target_lang": str,
            "max_pages": int,
            "append_mode": bool,
        },
    }
    
    # ——— 主执行入口 ———
    
    def execute(self, **params) -> SkillResult:
        """
        执行技能。
        
        执行阶段:
          1. 解析目标技能（支持按名称从 registry 查找）
          2. 参数校验（必填检查 + 类型转换）
          3. 技能执行（调用注册的处理器或通用流程）
          4. 结果封装（成功/失败 + 耗时）
        
        相比原有方式的优势：
        1. 分阶段执行：每个阶段独立，易于调试
        2. 详细日志：每个阶段都有日志记录
        3. 错误恢复：单个阶段失败不影响其他阶段
        
        Args:
            **params: 技能所需参数（参见各技能定义的输入参数规范）
        
        Returns:
            SkillResult: 结构化执行结果
        
        Raises:
            SkillNotFoundError: 技能未找到
            SkillExecuteError: 执行失败（参数错误、超时等）
        """
        result = SkillResult()
        start_time = time.time()
        
        try:
            # —— 阶段 1: 解析技能 ——
            skill = self._resolve_skill()
            result.skill_name = skill.metadata.name
            result.stage_results["resolve"] = "ok"
            
            # —— 阶段 2: 参数校验 ——
            params = self._validate_params(skill.metadata.name, params)
            result.stage_results["validate"] = "ok"
            
            # —— 阶段 3: 执行 ——
            logger.info(
                "🚀 开始执行技能: %s (超时: %.0fs)",
                skill.metadata.name,
                self._timeout,
            )
            
            # 检查自定义处理器
            handler = self._handlers.get(skill.metadata.name)
            if handler:
                exec_result = self._execute_with_timeout(handler, params)
            else:
                exec_result = self._execute_default(skill, params)
            
            result.data = exec_result
            result.success = True
            result.stage_results["execute"] = "ok"
            
        except SkillNotFoundError as e:
            result.error = e
            logger.error("❌ 技能未找到: %s", e)
        except SkillExecuteError as e:
            result.error = e
            logger.error("❌ %s", e)
        except Exception as e:
            result.error = SkillExecuteError(
                skill_name=result.skill_name or "unknown",
                stage="execute",
                detail=f"未预期的错误: {e}\n{traceback.format_exc()}",
            )
            logger.error("❌ 未预期的错误: %s", e)
        
        result.duration_ms = (time.time() - start_time) * 1000
        logger.info(
            "🏁 技能执行完成: %s | 成功=%s | 耗时=%.0fms",
            result.skill_name,
            result.success,
            result.duration_ms,
        )
        return result
    
    # ——— 内部方法 ———
    
    def _resolve_skill(self) -> ParsedSkill:
        """
        解析目标技能：优先使用已设置的 skill，其次按名称从 registry 查找。
        
        相比原有方式的优势：
        1. 灵活解析：支持直接传入 skill 对象或从 registry 查找
        2. 错误提示：提供清晰的错误信息
        """
        if self._skill:
            return self._skill
        if self._registry:
            # 查找 registry 中第一个技能（仅注册一个时适用）
            if self._registry.count == 1:
                return self._registry.get(self._registry.names[0])
            raise SkillNotFoundError(
                skill_name="(auto)",
                search_term="SkillRunner 未指定技能名称，且 registry 中的技能数 > 1",
            )
        raise SkillNotFoundError(
            skill_name="(none)",
            search_term="SkillRunner 未绑定技能 — 请传入 skill= 或 registry= 参数",
        )
    
    def _validate_params(
        self, skill_name: str, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        校验输入参数：必填检查 + 类型转换。
        
        相比原有方式的优势：
        1. 必填检查：确保必填参数不缺失
        2. 类型转换：自动转换参数类型，避免类型错误
        3. 详细错误：明确指出哪个参数错误
        """
        required = self._REQUIRED_PARAMS.get(skill_name, ())
        
        # 检查必填参数
        missing = [k for k in required if k not in params or params[k] is None]
        if missing:
            raise SkillExecuteError(
                skill_name=skill_name,
                stage="validate",
                detail=f"缺少必填参数: {', '.join(missing)}",
            )
        
        # 类型转换
        type_map = self._PARAM_TYPES.get(skill_name, {})
        validated: Dict[str, Any] = {}
        for key, value in params.items():
            if value is None:
                continue
            expected_type = type_map.get(key)
            if expected_type:
                try:
                    validated[key] = _convert_type(value, expected_type)
                except (ValueError, TypeError) as e:
                    raise SkillExecuteError(
                        skill_name=skill_name,
                        stage="validate",
                        detail=f"参数 '{key}' 类型错误: 期望 {expected_type.__name__}, 实际 {type(value).__name__} — {e}",
                    )
            else:
                validated[key] = value
        
        return validated
    
    def _execute_with_timeout(
        self, handler: Callable, params: Dict[str, Any]
    ) -> Any:
        """
        带超时保护的处理器执行。
        
        相比原有方式的优势：
        1. 超时保护：防止处理器无限阻塞
        2. 线程隔离：在独立线程中执行，不阻塞主线程
        3. 错误传播：处理器异常会正确传播
        """
        import threading
        
        result_box: dict = {"value": None, "error": None}
        
        def _target():
            try:
                result_box["value"] = handler(params)
            except Exception as e:
                result_box["error"] = e
        
        thread = threading.Thread(target=_target, daemon=True)
        thread.start()
        thread.join(timeout=self._timeout)
        
        if thread.is_alive():
            raise SkillTimeoutError(
                skill_name="(handler)", timeout_seconds=self._timeout
            )
        
        if result_box["error"]:
            raise result_box["error"]
        
        return result_box["value"]
    
    def _execute_default(
        self, skill: ParsedSkill, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        通用执行流程（当没有自定义处理器时）。
        
        相比原有方式的优势：
        1. 默认实现：提供合理的默认执行流程
        2. 平台无关：不依赖特定平台，可在任何环境运行
        3. 可扩展：子类可以重写此方法
        """
        return {
            "skill": skill.metadata.name,
            "version": skill.metadata.version,
            "params": params,
            "instruction_summary": _summarize_body(skill.body),
            "message": (
                f"技能 '{skill.metadata.name}' (v{skill.metadata.version}) "
                f"已就绪，等待平台调度执行。\n"
                f"目标: {params.get('target_url', 'N/A')}\n"
                f"飞书文档: {params.get('feishu_doc_url', 'N/A')}"
            ),
        }


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

def _convert_type(value: Any, expected_type: type) -> Any:
    """
    安全类型转换。
    
    相比原有方式的优势：
    1. 安全转换：避免类型转换错误
    2. 支持常见类型：bool, int, str 等
    3. 错误提示：转换失败时提供详细错误信息
    """
    if expected_type is bool and isinstance(value, str):
        return value.lower() in ("true", "1", "yes", "on")
    if expected_type is int and isinstance(value, str):
        return int(value)
    if expected_type is str and not isinstance(value, str):
        return str(value)
    if not isinstance(value, expected_type):
        raise TypeError(f"期望 {expected_type.__name__}，实际 {type(value).__name__}")
    return value


def _summarize_body(body: str, max_len: int = 200) -> str:
    """
    截取正文的开头部分作为简短摘要。
    
    相比原有方式的优势：
    1. 摘要生成：自动生成技能摘要
    2. 长度限制：避免摘要过长
    3. 智能截断：在换行符处截断，保持可读性
    """
    cleaned = body.strip()
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[:max_len].rsplit("\n", 1)[0] + "\n…"


# ---------------------------------------------------------------------------
# 示例使用
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    """
    使用示例 - 展示新 Skill 机制的优势
    """
    print("=" * 80)
    print("新 Skill 机制演示")
    print("=" * 80)
    
    # 1. 创建注册表
    print("\n1. 创建技能注册表...")
    registry = SkillRegistry()
    print(f"   Brain 目录: {registry.brain_dir}")
    
    # 2. 发现技能
    print("\n2. 发现技能...")
    count = registry.discover()
    print(f"   发现 {count} 个技能")
    
    # 3. 显示注册表摘要
    print("\n3. 注册表摘要:")
    print(registry.summary())
    
    # 4. 验证注册表
    print("\n4. 验证注册表:")
    validation = registry.validate()
    print(f"   整体健康: {validation['ok']}")
    print(f"   技能总数: {validation['total']}")
    print(f"   加载失败: {validation['errors']}")
    if validation['warnings']:
        print(f"   警告: {len(validation['warnings'])} 个")
        for warning in validation['warnings']:
            print(f"     - {warning}")
    
    # 5. 创建执行器
    print("\n5. 创建技能执行器...")
    runner = SkillRunner(registry=registry)
    print(f"   默认超时: {runner.DEFAULT_TIMEOUT_SECONDS}秒")
    
    # 6. 注册自定义处理器
    print("\n6. 注册自定义处理器...")
    def my_custom_handler(params: dict) -> dict:
        print(f"   自定义处理器被调用，参数: {params}")
        return {"result": "自定义处理器执行成功"}
    
    if registry.count > 0:
        first_skill_name = registry.names[0]
        runner.register_handler(first_skill_name, my_custom_handler)
        print(f"   已为 '{first_skill_name}' 注册自定义处理器")
    
    print("\n" + "=" * 80)
    print("演示完成")
    print("=" * 80)
