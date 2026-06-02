#!/usr/bin/env python3
"""
技能系统集成验证脚本

测试覆盖:
  1. SkillLoader — 正常加载、空文件、缺少字段、格式错误
  2. SkillRegistry — 发现、查找、验证
  3. SkillRunner — 参数校验、执行、超时、错误处理
  4. 配置一致性 — settings.local.json 与 Brain 目录对齐
"""

import sys
import os
import re
import json
import tempfile
from pathlib import Path
import traceback

# 将 skills 包加入路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from skills import (
    SkillLoader,
    SkillMetadata,
    ParsedSkill,
    SkillLoadError,
    SkillRegistry,
    SkillNotFoundError,
    SkillValidationError,
    SkillRunner,
    SkillExecuteError,
    SkillTimeoutError,
)

BRAIN_DIR = os.path.expanduser(
    "~/Library/Application Support/CodeBuddy CN/User/globalStorage/"
    "tencent-cloud.coding-copilot/brain/361847b51b484e598aef9de8b4c7bfc0"
)

PASS = "✅ PASS"
FAIL = "❌ FAIL"
WARN = "⚠️  WARN"
total = 0
passed = 0


def check(condition, label):
    global total, passed
    total += 1
    if condition:
        passed += 1
        print(f"   {PASS}: {label}")
    else:
        print(f"   {FAIL}: {label}")
    return condition


# ===========================================================================
# 测试 1: SkillLoader — 正常路径
# ===========================================================================
print("=" * 60)
print("[1/6] SkillLoader — 正常加载 SKILL-web-to-feishu-docx.md")

skill_path = os.path.join(BRAIN_DIR, "SKILL-web-to-feishu-docx.md")
assert os.path.exists(skill_path), f"技能文件不存在: {skill_path}"

skill = SkillLoader.load_file(skill_path)
check(skill is not None, "返回非空 ParsedSkill 对象")
check(skill.metadata.name == "web-to-feishu-docx", "技能名称为 'web-to-feishu-docx'")
check(
    "将目标网页及其关联子页面" in skill.metadata.description,
    "description 包含核心功能描述",
)
check(skill.metadata.version == "1.0.0", "版本号为 1.0.0")
check(
    skill.metadata.compatibility == "requires-python>=3.8",
    "兼容性声明正确",
)
check(len(skill.body) > 500, f"正文内容充足 ({len(skill.body)} 字符)")
check(skill.file_name == "SKILL-web-to-feishu-docx.md", "文件名正确")
check(skill.size_bytes > 5000, f"文件大小合理 ({skill.size_bytes} bytes)")
check("工作流程" in skill.body, "正文包含工作流程章节")
check("输入参数规范" in skill.body, "正文包含输入参数规范")

# ===========================================================================
# 测试 2: SkillLoader — 异常路径
# ===========================================================================
print("\n[2/6] SkillLoader — 异常路径")

with tempfile.TemporaryDirectory() as tmpdir:
    # 2a: 文件不存在
    try:
        SkillLoader.load_file(os.path.join(tmpdir, "nonexistent.md"))
        check(False, "不存在的文件应抛出 SkillLoadError")
    except SkillLoadError as e:
        check("文件不存在" in str(e), f"文件不存在 → SkillLoadError: {e.reason}")

    # 2b: 文件为空
    empty_file = os.path.join(tmpdir, "SKILL-empty.md")
    with open(empty_file, "w") as f:
        f.write("")
    try:
        SkillLoader.load_file(empty_file)
        check(False, "空文件应抛出 SkillLoadError")
    except SkillLoadError as e:
        check("文件为空" in str(e), f"空文件 → SkillLoadError")

    # 2c: 缺少 YAML front matter
    no_fm_file = os.path.join(tmpdir, "SKILL-no-fm.md")
    with open(no_fm_file, "w") as f:
        f.write("# 只有正文没有 front matter\n\n一些内容...")
    try:
        SkillLoader.load_file(no_fm_file)
        check(False, "缺少 front matter 应抛出 SkillLoadError")
    except SkillLoadError as e:
        check("YAML front matter 缺失" in str(e), f"缺少 FM → SkillLoadError")

    # 2d: 缺少必填字段 description
    no_desc_file = os.path.join(tmpdir, "SKILL-no-desc.md")
    with open(no_desc_file, "w") as f:
        f.write("---\nname: test-skill\n---\n\n# 正文")
    try:
        SkillLoader.load_file(no_desc_file)
        check(False, "缺少 description 应抛出 SkillLoadError")
    except SkillLoadError as e:
        check("必填字段缺失" in str(e), f"缺少 description → SkillLoadError")

    # 2e: name 格式无效 (大写/下划线)
    bad_name_file = os.path.join(tmpdir, "SKILL-bad-name.md")
    with open(bad_name_file, "w") as f:
        f.write("---\nname: Bad_Name!\ndescription: test desc\n---\n\n# 正文")
    try:
        SkillLoader.load_file(bad_name_file)
        check(False, "name 格式无效应抛出 SkillLoadError")
    except SkillLoadError as e:
        check("名称格式无效" in str(e), f"无效 name → SkillLoadError")

    # 2f: 正文为空
    no_body_file = os.path.join(tmpdir, "SKILL-no-body.md")
    with open(no_body_file, "w") as f:
        f.write("---\nname: test-skill\ndescription: test\n---\n   ")
    try:
        SkillLoader.load_file(no_body_file)
        check(False, "空正文应抛出 SkillLoadError")
    except SkillLoadError as e:
        check("正文内容为空" in str(e), f"空正文 → SkillLoadError")

    # 2g: 有效的最小技能（无版本号）
    minimal_file = os.path.join(tmpdir, "SKILL-minimal.md")
    with open(minimal_file, "w") as f:
        f.write("---\nname: minimal-skill\ndescription: A minimal skill\n---\n\n# 最小技能\n\n做某事。")
    try:
        s = SkillLoader.load_file(minimal_file)
        check(s.metadata.version == "0.1.0", "无 version 时默认 0.1.0")
        check(s.metadata.name == "minimal-skill", "最小技能名称正确")
    except SkillLoadError as e:
        check(False, f"最小有效技能应成功加载: {e}")

# ===========================================================================
# 测试 3: SkillRegistry — 发现与查找
# ===========================================================================
print("\n[3/6] SkillRegistry — 发现、索引、查找")

registry = SkillRegistry(brain_dir=BRAIN_DIR)
check(registry.brain_dir == BRAIN_DIR, f"Brain 目录: {BRAIN_DIR}")

n = registry.discover()
check(n >= 1, f"发现技能数: {n}")
check("web-to-feishu-docx" in registry.names, "已注册 web-to-feishu-docx")

# 精确查找
s = registry.get("web-to-feishu-docx")
check(s.metadata.name == "web-to-feishu-docx", "get() 精确查找成功")

# 模糊查找
results = registry.find_by_keyword("飞书")
check(len(results) >= 1, f"关键词'飞书'匹配到 {len(results)} 个技能")
check(results[0].metadata.name == "web-to-feishu-docx", "匹配结果正确")

# 不存在的技能
try:
    registry.get("nonexistent-skill")
    check(False, "不存在的技能应抛出 SkillNotFoundError")
except SkillNotFoundError:
    check(True, "get(不存在) → SkillNotFoundError")

# metadata 萃取
meta = registry.get_metadata("web-to-feishu-docx")
check(isinstance(meta, SkillMetadata), "get_metadata 返回 SkillMetadata")
check(meta.name == "web-to-feishu-docx", "元数据名称一致")

all_meta = registry.get_all_metadata()
check(len(all_meta) == n, f"get_all_metadata 返回 {len(all_meta)} 条")

# ===========================================================================
# 测试 4: SkillRegistry — 验证
# ===========================================================================
print("\n[4/6] SkillRegistry — 健康验证")

v = registry.validate()
check(isinstance(v, dict), "validate() 返回 dict")
check("ok" in v, "结果含 ok 字段")
check("total" in v, "结果含 total 字段")
check("errors" in v, "结果含 errors 字段")
check("warnings" in v, "结果含 warnings 字段")

# summary 输出
summary = registry.summary()
check("Skill Registry 摘要" in summary, "summary 包含标题")
check("web-to-feishu-docx" in summary, "summary 包含技能名称")

print("\n" + summary)

# ===========================================================================
# 测试 5: SkillRunner — 参数校验
# ===========================================================================
print("\n[5/6] SkillRunner — 执行与参数校验")

runner = SkillRunner(registry=registry)

# 5a: 缺少必填参数 → execute() 内部捕获，返回失败结果
r1 = runner.execute()
check(not r1.success, "无参数 → 返回失败结果")
check(isinstance(r1.error, SkillExecuteError), f"错误类型: {type(r1.error).__name__}")
check("缺少必填参数" in str(r1.error), "错误信息含缺少必填参数提示")

# 5b: 缺少必填参数 target_url
r2 = runner.execute(feishu_doc_url="https://xxx.feishu.cn/docx/ABC", feishu_token="t-xxx")
check(not r2.success, "缺少 target_url → 返回失败结果")
check("缺少必填参数" in str(r2.error), "错误信息指明缺少 target_url")

# 5c: 直接用 ParsedSkill 构造 runner
single_runner = SkillRunner(skill=s)
result = single_runner.execute(
    target_url="https://example.com",
    feishu_doc_url="https://xxx.feishu.cn/docx/ABC",
    feishu_token="t-test-token",
)
check(result.success, "完整参数执行成功")
check(result.skill_name == "web-to-feishu-docx", "结果包含技能名")
check(result.duration_ms > 0, f"耗时记录正常 ({result.duration_ms:.1f}ms)")
d = result.to_dict()
check(d["success"] is True, "to_dict 正确序列化")
check(d["skill_name"] == "web-to-feishu-docx", "to_dict skill_name 正确")

# 5d: 自定义处理器
def custom_handler(params):
    return {"custom": True, "pages": len(params.get("target_url", ""))}

single_runner.register_handler("web-to-feishu-docx", custom_handler)
result2 = single_runner.execute(
    target_url="https://example.com",
    feishu_doc_url="https://xxx.feishu.cn/docx/ABC",
    feishu_token="t-test-token",
)
check(result2.success, "自定义处理器执行成功")
check(result2.data == {"custom": True, "pages": 19}, "自定义处理器返回数据正确")

# ===========================================================================
# 测试 6: 配置一致性
# ===========================================================================
print("\n[6/6] CodeBuddy 技能集成检查")

# 6a — 检查 .codebuddy/skills/ 目录结构
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cb_skills_dir = os.path.join(project_root, ".codebuddy", "skills")

if os.path.isdir(cb_skills_dir):
    skill_dirs = [
        d for d in os.listdir(cb_skills_dir)
        if os.path.isdir(os.path.join(cb_skills_dir, d))
    ]
    check(
        "web-to-feishu-docx" in skill_dirs,
        ".codebuddy/skills/web-to-feishu-docx/ 目录存在",
    )

    # 6b — 检查 SKILL.md 文件
    skill_md_path = os.path.join(cb_skills_dir, "web-to-feishu-docx", "SKILL.md")
    check(os.path.isfile(skill_md_path), "SKILL.md 文件存在")

    if os.path.isfile(skill_md_path):
        # 6c — 检查 YAML frontmatter 格式（CodeBuddy 兼容性）
        content = Path(skill_md_path).read_text(encoding="utf-8")
        fm_match = re.match(r"^\s*---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
        check(fm_match is not None, "SKILL.md 包含 YAML front matter")

        if fm_match:
            fm_raw = fm_match.group(1)
            # 验证 description 使用双引号包裹（CodeBuddy 标准格式）
            desc_match = re.search(r'description:\s*"(.+)"', fm_raw)
            check(desc_match is not None, "description 使用双引号格式")

            # 验证 name 字段
            name_match = re.search(r"name:\s*(.+)", fm_raw)
            if name_match:
                name_val = name_match.group(1).strip()
                check(name_val == "web-to-feishu-docx", "name 字段: web-to-feishu-docx")

            # 确保没有非标准字段
            check("compatibility:" not in fm_raw, "无 compatibility 非标准字段（已清理）")
            check("version:" not in fm_raw, "无 version 字段（SKILL.md 级别不需要）")

    # 6d — 确认 settings.local.json 不含无效字段
    settings_path = os.path.join(project_root, ".codebuddy", "settings.local.json")
    if os.path.exists(settings_path):
        with open(settings_path, "r") as f:
            config = json.load(f)
        check(
            "localSkills" not in config,
            "settings.local.json 不含无效的 localSkills 字段（已清理）",
        )
else:
    check(False, ".codebuddy/skills/ 目录不存在")

# 6e — 检查 Brain 目录中技能文件仍保留（用于 Python 引擎）
brain_files = [
    f for f in os.listdir(BRAIN_DIR)
    if f.startswith("SKILL-") and f.endswith(".md")
]
check(len(brain_files) >= 1, "Brain 目录中保留 SKILL-*.md（Python 引擎使用）")

# ===========================================================================
# 总结
# ===========================================================================
print("\n" + "=" * 60)
print(f"📊 测试总结: {passed}/{total} 通过")

if passed == total:
    print("🎉 全部测试通过！技能系统集成成功。")
    sys.exit(0)
else:
    failed = total - passed
    print(f"⚠️  {failed} 项测试未通过，请检查上述输出。")
    sys.exit(1)
