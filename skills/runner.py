"""
技能执行调度器 — 根据技能定义调度任务执行

提供:
  - 统一的 execute() 入口
  - 输入参数校验（类型检查、必填验证）
  - 执行超时保护
  - 结构化结果返回
  - 执行日志与错误追踪
"""

from __future__ import annotations

import time
import logging
import traceback
from typing import Optional, Dict, Any, Callable

from .loader import ParsedSkill
from .registry import SkillRegistry, SkillNotFoundError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 自定义异常
# ---------------------------------------------------------------------------

class SkillExecuteError(Exception):
    """技能执行失败。"""

    def __init__(self, skill_name: str, stage: str, detail: str = ""):
        self.skill_name = skill_name
        self.stage = stage
        self.detail = detail
        msg = f"技能 '{skill_name}' 执行失败 [{stage}阶段]"
        if detail:
            msg += f": {detail}"
        super().__init__(msg)


class SkillTimeoutError(SkillExecuteError):
    """技能执行超时。"""

    def __init__(self, skill_name: str, timeout_seconds: float):
        super().__init__(
            skill_name=skill_name,
            stage="execution",
            detail=f"超时 ({timeout_seconds:.0f}s) 未完成",
        )
        self.timeout_seconds = timeout_seconds


# ---------------------------------------------------------------------------
# 结果对象
# ---------------------------------------------------------------------------

class SkillResult:
    """技能执行结果。"""

    def __init__(self):
        self.success: bool = False
        self.skill_name: str = ""
        self.stage_results: dict = {}  # 各阶段中间结果
        self.data: Any = None
        self.error: Optional[Exception] = None
        self.duration_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "skill_name": self.skill_name,
            "data": self.data,
            "error": str(self.error) if self.error else None,
            "duration_ms": round(self.duration_ms, 1),
            "stages_completed": list(self.stage_results.keys()),
        }


# ---------------------------------------------------------------------------
# SkillRunner
# ---------------------------------------------------------------------------

class SkillRunner:
    """技能执行器，封装了参数校验、执行、超时和错误处理。"""

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
        """注册自定义技能处理器函数。

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
        """解析目标技能：优先使用已设置的 skill，其次按名称从 registry 查找。"""
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
        """校验输入参数：必填检查 + 类型转换。"""
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
        """带超时保护的处理器执行。"""
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

        当前配合 CodeBuddy 平台执行：返回参数的规范化描述，
        由平台通过 web_fetch / feishu API 等原生工具完成实际调用。
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
    """安全类型转换。"""
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
    """截取正文的开头部分作为简短摘要。"""
    cleaned = body.strip()
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[:max_len].rsplit("\n", 1)[0] + "\n…"
