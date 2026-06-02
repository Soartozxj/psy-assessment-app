"""
Skills 系统 — 本地技能加载、注册与执行引擎

基于 Agent Skills 开放规范（Anthropic），提供完整的技能生命周期管理：
  1. 解析 SKILL-*.md 文件的 YAML 前端元数据与 Markdown 正文
  2. 从 Brain 目录发现并注册所有可用技能
  3. 按渐进式披露（Progressive Disclosure）模式调度技能执行

典型用法:
    from skills import SkillRegistry, SkillRunner

    registry = SkillRegistry()
    registry.discover()

    skill = registry.get("web-to-feishu-docx")
    result = SkillRunner(skill).execute(
        target_url="https://example.com",
        feishu_doc_url="https://xxx.feishu.cn/docx/ABC",
        feishu_token="t-xxx..."
    )
"""

from .loader import SkillLoader, SkillMetadata, ParsedSkill, SkillLoadError
from .registry import SkillRegistry, SkillNotFoundError, SkillValidationError
from .runner import SkillRunner, SkillExecuteError, SkillTimeoutError

__all__ = [
    "SkillLoader",
    "SkillMetadata",
    "ParsedSkill",
    "SkillLoadError",
    "SkillRegistry",
    "SkillNotFoundError",
    "SkillValidationError",
    "SkillRunner",
    "SkillExecuteError",
    "SkillTimeoutError",
]
