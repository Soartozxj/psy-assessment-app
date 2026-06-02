"""
技能注册表 — 管理已发现技能的索引与查询

提供:
  - 从 Brain 目录发现并注册所有技能
  - 按名称、关键词、优先级查找技能
  - 技能描述 → 任务匹配（渐进式披露的 discovery 阶段）
  - 注册状态摘要（健康检查）
"""

from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Optional, List, Dict

from .loader import SkillLoader, ParsedSkill, SkillMetadata, SkillLoadError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 自定义异常
# ---------------------------------------------------------------------------

class SkillNotFoundError(Exception):
    """技能未在注册表中找到。"""

    def __init__(self, skill_name: str, search_term: str = ""):
        self.skill_name = skill_name
        term = search_term or skill_name
        super().__init__(f"技能未找到: '{term}' — 请确认技能已加载或名称拼写正确")


class SkillValidationError(Exception):
    """技能验证失败（重复名称、无效引用等）。"""


# ---------------------------------------------------------------------------
# SkillRegistry
# ---------------------------------------------------------------------------

class SkillRegistry:
    """技能注册表：发现、索引、查找。"""

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
        """获取指定技能的元数据（仅 discovery 阶段需要的轻量信息）。"""
        return self.get(name).metadata

    def get_all_metadata(self) -> List[SkillMetadata]:
        """获取所有技能的元数据列表（discovery 阶段使用）。"""
        return [s.metadata for s in self._skills.values()]

    # ——— 验证 ———

    def validate(self) -> Dict[str, any]:
        """
        全面验证注册表健康状态。

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
        """生成注册表摘要（用于 console / log 输出）。"""
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
