#!/usr/bin/env python3
"""
文档清理脚本 - 最终版
删除确认无关的文档，保留正在使用的文档
"""

import os
import shutil
from pathlib import Path

PROJECT_ROOT = Path("/Users/rich/WorkBuddy/20260407113106")

# 确认删除的文件夹（P2 - 无关文档）
FOLDERS_TO_DELETE = [
    "shadcn-docs",  # 与项目无关（shadcn/ui 文档）
    ".workbuddy/memory",  # 个人记忆（保留 MEMORY.md）
    "test-meta-results",  # 临时测试结果
    "test-results",  # 临时测试结果
    "test-displayname-results",  # 临时测试结果
    "test-screenshots",  # 测试截图
    ".playwright-cli",  # Playwright 录制（可重新生成）
]

# 确认删除的文件（P2 - 无关文档）
FILES_TO_DELETE = [
    # 已删除（通过 delete_file 工具）
    # "AgentSkills-主页-中文翻译.md",
    # "DESIGN_SYSTEM.md",
    # "meta-prompt-v2-discussion.md",
    # "meta-prompt-v2-draft.md",
    # "meta-prompt-v2.0.md",
    # "meta-prompt-v2.1.md",
    # "meta-prompt-v2.2.md",
    # ".codebuddy/plans/Skills架构改造方案深度分析与优化_a01e2612.md",
    # ".workbuddy/artifacts/计分提取提示词深度分析报告.md",
    # 过时文档
    "miniprogram-dev-plan.md",
    "overview.md",
    "h5-analysis.md",
    "plan-cloud-data-sync.md",
    "plan-wechat-scan-login.md",
    "prompt-display-name-optimized.md",
    "prompt-management-report.md",
    "prompt-runtime-flow.md",
    "shadcn-docs-complete.md",
    "shadcn-docs-progress.md",
    # 重复文档
    "mini-app-h5-redesign/backend/后台管理整改方案.md",
    "mini-app-h5-redesign/backend/管理后台问题清单.md",
    # 测试录制文件
    "after-90q.yaml",
    "after-login.yaml",
    "ai-tab.yaml",
    "diag-top.yaml",
    "fb-modal.yaml",
    "fb-modal-open.yaml",
    # 测试图片
    "fb-collect-test-detail.png",
    "frontend-test.png",
    "json-toolbar-fix.png",
    "npc-loaded.png",
    "parse-fix-verified.png",
    "result-page-check.png",
    "scale-onboard-error.png",
    "step1-v2.png",
    "step5-rendered.png",
    "tag-panel-initial.png",
    # 过时测试脚本
    "test_displayName.py",
    "test-deepseek-json.js",
    "test-ds-json.js",
    "test-merge-comparison-results.json",
    "test-meta-prompt.py",
    "test-meta-results-*.json",
    "test-round.js",
    "test-ssrs.js",
    "test-ssrs-v2.js",
    "test-ssrs-v3.js",
    "test-ssrs-v4.js",
    "tc-scoring-merge-compare.js",
    "tc-scoring-parse.js",
    "tc-scoring-parse-v2.js",
]

# 保留的文件/文件夹（P0 - 必须保留）
MUST_KEEP = [
    ".workbuddy/memory/MEMORY.md",  # 项目长期记忆
    "prompts/",  # build-prompts.py 正在使用
    "content-creation/",  # 内容运营功能
    "mini-app-h5/",  # 核心业务代码
    "mini-app-native/",  # 微信小程序原生代码
    "server/",  # 后端服务
    "心理评估量表手册-*.md",  # AI 提示词文档
    "内容运营*.md",  # 内容运营规范
    "code-review-*.md",  # 代码审查规范
]


def delete_folder(folder_path):
    """删除文件夹"""
    full_path = PROJECT_ROOT / folder_path
    if full_path.exists() and full_path.is_dir():
        print(f"🗑️  删除文件夹: {folder_path}")
        try:
            shutil.rmtree(full_path)
            print(f"   ✅ 删除成功")
            return True
        except Exception as e:
            print(f"   ❌ 删除失败: {e}")
            return False
    else:
        print(f"⚠️  文件夹不存在: {folder_path}")
        return False


def delete_file(file_path):
    """删除文件"""
    full_path = PROJECT_ROOT / file_path
    if full_path.exists() and full_path.is_file():
        print(f"🗑️  删除文件: {file_path}")
        try:
            full_path.unlink()
            print(f"   ✅ 删除成功")
            return True
        except Exception as e:
            print(f"   ❌ 删除失败: {e}")
            return False
    else:
        print(f"⚠️  文件不存在: {file_path}")
        return False


def clean_workbuddy_memory():
    """清理 .workbuddy/memory/ 下的每日记录（保留 MEMORY.md）"""
    memory_dir = PROJECT_ROOT / ".workbuddy/memory"
    if not memory_dir.exists():
        print(f"⚠️  .workbuddy/memory/ 不存在")
        return

    print(f"📝 清理 .workbuddy/memory/ 每日记录...")
    count = 0
    for file_path in memory_dir.glob("*.md"):
        if file_path.name == "MEMORY.md":
            print(f"   ⏩ 保留: {file_path.name}")
            continue
        try:
            file_path.unlink()
            count += 1
            print(f"   ✅ 删除: {file_path.name}")
        except Exception as e:
            print(f"   ❌ 删除失败 {file_path.name}: {e}")

    print(f"   📊 共删除 {count} 个文件")


def main():
    print("=" * 60)
    print("文档清理脚本 - 最终版")
    print("=" * 60)
    print()

    # 1. 删除文件夹
    print("📁 第一步：删除无关文件夹")
    print("-" * 60)
    folder_count = 0
    for folder in FOLDERS_TO_DELETE:
        if delete_folder(folder):
            folder_count += 1
    print(f"📊 共删除 {folder_count} 个文件夹")
    print()

    # 2. 删除文件
    print("📄 第二步：删除无关文件")
    print("-" * 60)
    file_count = 0
    for file in FILES_TO_DELETE:
        if delete_file(file):
            file_count += 1
    print(f"📊 共删除 {file_count} 个文件")
    print()

    # 3. 清理 .workbuddy/memory/ 每日记录
    print("📝 第三步：清理个人记忆文档")
    print("-" * 60)
    clean_workbuddy_memory()
    print()

    # 4. 验证结果
    print("🔍 第四步：验证结果")
    print("-" * 60)
    verify_cleanup()
    print()

    print("=" * 60)
    print("✅ 清理完成！")
    print("=" * 60)


def verify_cleanup():
    """验证清理结果"""
    # 统计剩余文档数量
    md_files = list(PROJECT_ROOT.rglob("*.md"))
    md_files = [f for f in md_files if "node_modules" not in str(f)]

    print(f"📊 剩余 Markdown 文档: {len(md_files)} 个")

    # 检查是否误删了必须保留的文件
    print()
    print("🔎 检查必须保留的文件...")
    for pattern in MUST_KEEP:
        if "*" in pattern:
            # 通配符匹配
            matches = list(PROJECT_ROOT.rglob(pattern))
            if matches:
                print(f"   ✅ 保留: {pattern} ({len(matches)} 个文件)")
            else:
                print(f"   ⚠️  未找到: {pattern}")
        else:
            # 精确匹配
            path = PROJECT_ROOT / pattern
            if path.exists():
                print(f"   ✅ 保留: {pattern}")
            else:
                print(f"   ❌ 丢失: {pattern}")

    # 检查是否还有应该删除的文件
    print()
    print("🔎 检查是否还有应删除的文件...")
    check_patterns = [
        "**/test-*.md",
        "**/test-*.json",
        "**/*.yaml",
        "**/*.png",
    ]
    for pattern in check_patterns:
        matches = list(PROJECT_ROOT.rglob(pattern))
        matches = [f for f in matches if "node_modules" not in str(f)]
        if matches:
            print(f"   ⚠️  发现 {len(matches)} 个可能应删除的文件: {pattern}")
            for m in matches[:5]:  # 只显示前 5 个
                print(f"      - {m.relative_to(PROJECT_ROOT)}")
            if len(matches) > 5:
                print(f"      ... 还有 {len(matches) - 5} 个文件")


if __name__ == "__main__":
    main()
