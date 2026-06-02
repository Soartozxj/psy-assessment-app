"""
技能文件加载器 — 解析 SKILL-*.md 文件

支持格式:
  - Agent Skills 规范定义的 YAML front matter + Markdown body
  - 文件名约定: SKILL-{name}.md

解析流程:
  1. 读取文件原始内容
  2. 提取 YAML front matter（--- 分隔块）
  3. 验证必填字段: name, description
  4. 收集可选字段: version, compatibility, license 等
  5. 保留 Markdown 正文内容
"""

from __future__ import annotations

import os
import re
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 自定义异常
# ---------------------------------------------------------------------------

class SkillLoadError(Exception):
    """技能文件加载失败（文件不存在、格式错误、字段缺失等）。"""

    def __init__(self, message: str, file_path: str = "", reason: str = ""):
        self.file_path = file_path
        self.reason = reason
        full_msg = f"Skill 加载失败: {message}"
        if file_path:
            full_msg += f" [文件: {file_path}]"
        if reason:
            full_msg += f" [原因: {reason}]"
        super().__init__(full_msg)


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------

@dataclass
class SkillMetadata:
    """技能元数据（从 YAML front matter 解析）。"""

    name: str                               # 必填 — 技能唯一标识 (kebab-case)
    description: str                        # 必填 — 功能描述 + 触发条件
    version: str = "0.1.0"                  # 语义化版本
    compatibility: str = ""                 # 环境/依赖要求
    license: str = ""                       # 许可证
    metadata: Dict[str, Any] = field(default_factory=dict)  # 自由格式键值对

    # 扩展字段（从 YAML 直接捕获）
    raw_frontmatter: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsedSkill:
    """完整解析后的技能对象。"""

    metadata: SkillMetadata          # 元数据
    body: str                        # Markdown 正文（指令内容）
    file_path: str = ""              # 源文件绝对路径
    file_name: str = ""              # 文件名（如 SKILL-web-to-feishu-docx.md）
    size_bytes: int = 0              # 文件大小


# ---------------------------------------------------------------------------
# 加载器
# ---------------------------------------------------------------------------

class SkillLoader:
    """加载并解析单个 SKILL.md / SKILL-*.md 文件。"""

    # ——— 类常量 ———
    FILE_PATTERN: str = "SKILL-*.md"   # 仅匹配此命名模式
    FILE_PATTERN_LOOSE = "SKILL*.md"   # 宽松匹配（含 SKILL.md）

    # 必填 YAML 键
    REQUIRED_KEYS: tuple = ("name", "description")

    # 已知的可选 YAML 键（映射到 SkillMetadata 字段）
    _META_KEY_MAP: Dict[str, str] = {
        "name":          "name",
        "description":   "description",
        "version":       "version",
        "compatibility": "compatibility",
        "license":       "license",
    }

    # ——— YAML front matter 解析 ———

    _FRONT_MATTER_RE = re.compile(
        r"^\s*---\s*\n(.*?)\n---\s*\n",
        re.DOTALL,
    )

    @classmethod
    def _parse_frontmatter(cls, raw: str) -> Dict[str, Any]:
        """从原始文本中提取 YAML front matter 块（简单行解析，无外部依赖）。"""
        result: Dict[str, Any] = {}
        current_key: Optional[str] = None
        multiline_buffer: list[str] = []

        for line in raw.split("\n"):
            # 跳过空行和纯注释
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue

            # 检测键值对: "key: value"
            m = re.match(r"^([a-zA-Z_-][a-zA-Z0-9_-]*)\s*:\s*(.*)", line)
            if m:
                # 先提交上一段多行内容
                if current_key and multiline_buffer:
                    result[current_key] = "\n".join(multiline_buffer).strip()
                    multiline_buffer = []

                key = m.group(1)
                value = m.group(2).strip()

                # YAML 多行值: "key: >" 表示折叠块
                if value == ">":
                    current_key = key
                    multiline_buffer = []
                elif value in ("|", "|-", "|+"):
                    current_key = key
                    multiline_buffer = []
                    result[key] = ""  # 文字块在下一行开始
                else:
                    # 单行值：去掉引号
                    current_key = None
                    result[key] = _strip_yaml_quotes(value)
            else:
                # 多行缓冲追加
                if current_key:
                    multiline_buffer.append(stripped)

        # 提交最后一段多行内容
        if current_key and multiline_buffer:
            result[current_key] = "\n".join(multiline_buffer).strip()

        return result

    # ——— 文件加载 ———

    @classmethod
    def load_file(cls, file_path: str) -> ParsedSkill:
        """
        加载并解析指定的技能文件。

        Args:
            file_path: SKILL-*.md 文件的绝对/相对路径

        Returns:
            ParsedSkill: 完整解析后的技能对象

        Raises:
            SkillLoadError: 文件不存在 / 格式错误 / 必填字段缺失
        """
        path = Path(file_path).resolve()

        # —— 文件存在性检查 ——
        if not path.exists():
            raise SkillLoadError(
                "文件不存在",
                file_path=str(path),
                reason="指定的技能文件路径无效",
            )
        if not path.is_file():
            raise SkillLoadError(
                "路径不是文件",
                file_path=str(path),
                reason="需传入 .md 文件路径，而非目录",
            )
        if not path.suffix.lower() == ".md":
            raise SkillLoadError(
                "文件类型不支持",
                file_path=str(path),
                reason=f"期望 .md 文件，实际为 {path.suffix}",
            )

        # —— 读取内容 ——
        try:
            raw_content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError as e:
            raise SkillLoadError(
                "文件编码错误",
                file_path=str(path),
                reason=f"无法以 UTF-8 解码: {e}",
            )
        except PermissionError as e:
            raise SkillLoadError(
                "文件读取权限不足",
                file_path=str(path),
                reason=str(e),
            )

        if not raw_content.strip():
            raise SkillLoadError(
                "文件为空",
                file_path=str(path),
                reason="SKILL.md 必须包含 YAML front matter 和正文",
            )

        # —— 提取 YAML front matter ——
        fm_match = cls._FRONT_MATTER_RE.match(raw_content)
        if not fm_match:
            raise SkillLoadError(
                "YAML front matter 缺失",
                file_path=str(path),
                reason="SKILL.md 必须以 --- 分隔的 YAML 块开头（格式: ---\\nkey: value\\n---\\n）",
            )

        frontmatter_raw = fm_match.group(1)
        frontmatter = cls._parse_frontmatter(frontmatter_raw)

        # —— 验证必填字段 ——
        for key in cls.REQUIRED_KEYS:
            if key not in frontmatter or not str(frontmatter[key]).strip():
                raise SkillLoadError(
                    f"必填字段缺失: '{key}'",
                    file_path=str(path),
                    reason=f"YAML front matter 中缺少 {key} 字段或其值为空",
                )

        # —— 提取正文 ——
        body_start = fm_match.end()
        body = raw_content[body_start:].strip()

        if not body:
            raise SkillLoadError(
                "正文内容为空",
                file_path=str(path),
                reason="YAML front matter 之后的 Markdown 指令不能为空",
            )

        # —— 构建 SkillMetadata ——
        name = str(frontmatter["name"]).strip()
        if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", name):
            raise SkillLoadError(
                f"技能名称格式无效: '{name}'",
                file_path=str(path),
                reason="name 必须为小写字母、数字和连字符 (kebab-case)，如 'web-to-feishu-docx'",
            )

        metadata = SkillMetadata(
            name=name,
            description=str(frontmatter["description"]).strip(),
            version=str(frontmatter.get("version", "0.1.0")).strip(),
            compatibility=str(frontmatter.get("compatibility", "")).strip(),
            license=str(frontmatter.get("license", "")).strip(),
            raw_frontmatter=frontmatter,
        )

        file_stat = path.stat()

        return ParsedSkill(
            metadata=metadata,
            body=body,
            file_path=str(path),
            file_name=path.name,
            size_bytes=file_stat.st_size,
        )

    # ——— 批量加载 ———

    @classmethod
    def load_directory(cls, directory: str) -> list[ParsedSkill]:
        """
        扫描目录，加载所有匹配 FILE_PATTERN 的技能文件。

        Args:
            directory: Brain 目录或任意包含 SKILL-*.md 文件的目录

        Returns:
            list[ParsedSkill]: 成功加载的技能列表（加载失败的文件被跳过并记录日志）
        """
        dir_path = Path(directory)
        if not dir_path.exists():
            logger.warning("技能目录不存在: %s", directory)
            return []
        if not dir_path.is_dir():
            logger.warning("路径不是目录: %s", directory)
            return []

        skills: list[ParsedSkill] = []
        candidates = sorted(dir_path.glob(cls.FILE_PATTERN))

        for candidate in candidates:
            try:
                skill = cls.load_file(str(candidate))
                skills.append(skill)
                logger.info("  ✅ 已加载: %s (v%s)", skill.metadata.name, skill.metadata.version)
            except SkillLoadError as e:
                logger.warning("  ⚠️  跳过 %s: %s", candidate.name, e)

        return skills


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

def _strip_yaml_quotes(value: str) -> str:
    """去除 YAML 字符串值的首尾引号。"""
    v = value.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
        return v[1:-1]
    return v
