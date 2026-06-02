#!/usr/bin/env python3
"""
项目文档智能清理脚本
功能：扫描并删除四类无关文档，执行前预览，执行后生成报告
"""
import os
import json
from pathlib import Path
from datetime import datetime

# 项目根目录
PROJECT_ROOT = Path("/Users/rich/WorkBuddy/20260407113106")

# 分类规则（针对您的要求优化）
CATEGORIES = {
    "无关技术文档": {
        "description": "与项目核心功能无关的技术文档、第三方文档、教程等",
        "folders": [
            ".codebuddy/skills/web-to-feishu-docx",  # Skill文档（除非正在使用）
            "reviews",  # 代码审查模板（如果不再使用）
            "deliverables",  # 交付物（如果不再需要）
        ],
        "patterns": [
            "AgentSkills",
            "DESIGN_SYSTEM",
            "shadcn",
            "tutorial",
            "guide",
            "教程",
        ],
        "exclude_patterns": [
            "SKILL.md",  # 保留skills的主文档
        ]
    },
    "过时文档": {
        "description": "旧版本的文档、已被替代的方案、历史讨论记录等",
        "folders": [
            "prompts/archive",  # 归档的旧版提示词
        ],
        "patterns": [
            "v2.0", "v2.1", "v2.2", "v1.0", "v1.1", "v1.2",  # 旧版本
            "草稿", "讨论", "方案A", "方案B",  # 草稿讨论
            "改造方案", "升级方案", "迁移方案",  # 已实施的方案
            "问题分析", "问题清单",  # 已解决的问题
            "临时", "temp", "tmp",  # 临时文档
            "-副本", "copy", "backup",  # 副本备份
            "meta-prompt-v",  # 旧版meta-prompt
        ],
        "exclude_patterns": [
            "项目路线图",  # 保留项目路线图
            "测试方案",  # 保留测试方案
            "交付物",  # 保留交付物
        ]
    },
    "临时测试文档": {
        "description": "测试报告、临时结果、录制文件、日志等",
        "folders": [
            ".playwright-cli",
            "test-results",
            "test-meta-results",
            "test-displayname-results",
            "coverage",
            ".nyc_output",
            "tests",  # 测试计划文档
        ],
        "patterns": [
            "test-",
            "Test",
            "TEST",
            "临时测试",
            "调试",
            "debug",
            "log-",
            "report-",
            "录制",
            "recording",
            "minitest",
            "fulltest",
        ],
        "extensions": [".log", ".tmp", ".temp", ".yaml", ".yml"]
    },
    "重复文档": {
        "description": "重复的报告、清单、清理记录等",
        "patterns": [
            "文档清理",
            "文档删除",
            "清理报告",
            "删除清单",
            "scan",
            "重复",
            "duplicate",
            "最终报告",  # 如果有多个最终报告
        ],
        "exclude_patterns": [
            "验证报告",  # 保留验证报告
        ]
    }
}

def scan_files():
    """扫描项目中的文档文件"""
    results = {
        "无关技术文档": [],
        "过时文档": [],
        "临时测试文档": [],
        "重复文档": [],
    }
    
    # 扫描所有文件（不仅是.md）
    for file_path in PROJECT_ROOT.rglob("*"):
        # 跳过文件夹
        if not file_path.is_file():
            continue
            
        # 跳过node_modules和.git
        if "node_modules" in file_path.parts or ".git" in file_path.parts:
            continue
            
        rel_path = file_path.relative_to(PROJECT_ROOT)
        file_size = file_path.stat().st_size
        file_name = file_path.name
        
        # 检查是否属于无关技术文档
        is_irrelevant = False
        reason = ""
        
        # 检查文件夹（如果存在folders键）
        if "folders" in CATEGORIES["无关技术文档"]:
            for folder in CATEGORIES["无关技术文档"]["folders"]:
                folder_path = PROJECT_ROOT / folder
                if folder_path.exists() and folder_path.is_dir():
                    if str(rel_path).startswith(folder):
                        # 检查是否应该排除
                        excluded = False
                        if "exclude_patterns" in CATEGORIES["无关技术文档"]:
                            for exclude in CATEGORIES["无关技术文档"]["exclude_patterns"]:
                                if exclude in file_name:
                                    excluded = True
                                    break
                        if not excluded:
                            is_irrelevant = True
                            reason = f"属于无关技术文档文件夹: {folder}"
                        break
        
        # 检查文件名模式
        if not is_irrelevant:
            for pattern in CATEGORIES["无关技术文档"]["patterns"]:
                if pattern in file_name:
                    is_irrelevant = True
                    reason = f"文件名包含无关技术关键词: {pattern}"
                    break
        
        if is_irrelevant:
            results["无关技术文档"].append({
                "path": str(rel_path),
                "size": file_size,
                "reason": reason,
                "category": "无关技术文档"
            })
            continue
        
        # 检查是否属于过时文档
        is_outdated = False
        reason = ""
        
        # 检查文件夹（如果存在folders键）
        if "folders" in CATEGORIES["过时文档"]:
            for folder in CATEGORIES["过时文档"]["folders"]:
                folder_path = PROJECT_ROOT / folder
                if folder_path.exists() and folder_path.is_dir():
                    if str(rel_path).startswith(folder):
                        is_outdated = True
                        reason = f"属于过时文档文件夹: {folder}"
                        break
        
        # 检查文件名模式
        if not is_outdated:
            for pattern in CATEGORIES["过时文档"]["patterns"]:
                if pattern in file_name:
                    # 检查是否应该排除
                    excluded = False
                    for exclude in CATEGORIES["过时文档"]["exclude_patterns"]:
                        if exclude in file_name:
                            excluded = True
                            break
                    if not excluded:
                        is_outdated = True
                        reason = f"文件名包含过时文档关键词: {pattern}"
                        break
        
        if is_outdated:
            results["过时文档"].append({
                "path": str(rel_path),
                "size": file_size,
                "reason": reason,
                "category": "过时文档"
            })
            continue
        
        # 检查是否属于临时测试文档
        is_temp = False
        reason = ""
        
        # 检查文件夹
        for folder in CATEGORIES["临时测试文档"]["folders"]:
            folder_path = PROJECT_ROOT / folder
            if folder_path.exists() and folder_path.is_dir():
                if str(rel_path).startswith(folder):
                    is_temp = True
                    reason = f"属于临时测试文件夹: {folder}"
                    break
        
        # 检查文件名模式
        if not is_temp:
            for pattern in CATEGORIES["临时测试文档"]["patterns"]:
                if pattern in file_name:
                    is_temp = True
                    reason = f"文件名包含临时测试关键词: {pattern}"
                    break
        
        # 检查扩展名
        if not is_temp:
            for ext in CATEGORIES["临时测试文档"]["extensions"]:
                if file_path.suffix == ext:
                    is_temp = True
                    reason = f"文件扩展名是临时文件类型: {ext}"
                    break
        
        if is_temp:
            results["临时测试文档"].append({
                "path": str(rel_path),
                "size": file_size,
                "reason": reason,
                "category": "临时测试文档"
            })
            continue
        
        # 检查是否属于重复文档
        is_duplicate = False
        reason = ""
        
        for pattern in CATEGORIES["重复文档"]["patterns"]:
            if pattern in file_name:
                # 检查是否应该排除
                excluded = False
                for exclude in CATEGORIES["重复文档"]["exclude_patterns"]:
                    if exclude in file_name:
                        excluded = True
                        break
                if not excluded:
                    is_duplicate = True
                    reason = f"文件名包含重复文档关键词: {pattern}"
                    break
        
        if is_duplicate:
            results["重复文档"].append({
                "path": str(rel_path),
                "size": file_size,
                "reason": reason,
                "category": "重复文档"
            })
            continue
    
    return results

def print_scan_results(results, show_details=True):
    """打印扫描结果"""
    print("\n" + "=" * 80)
    print("📋 文档清理扫描结果")
    print("=" * 80)
    
    total_files = 0
    total_size = 0
    
    for category, files in results.items():
        if not files:
            print(f"\n✅ {category}: 无符合条件的文件")
            continue
            
        print(f"\n🔍 {category} (共 {len(files)} 个文件)")
        print(f"   说明: {CATEGORIES[category]['description']}")
        print("-" * 80)
        
        category_size = sum(f["size"] for f in files)
        total_files += len(files)
        total_size += category_size
        
        if show_details:
            for i, file_info in enumerate(files, 1):
                size_kb = file_info["size"] / 1024
                print(f"  {i}. {file_info['path']}")
                print(f"     大小: {size_kb:.2f} KB")
                print(f"     原因: {file_info['reason']}")
                print()
        
        print(f"  📊 小计: {len(files)} 个文件, {category_size / 1024:.2f} KB ({category_size / 1024 / 1024:.2f} MB)")
    
    print("\n" + "=" * 80)
    print(f"📊 总计: {total_files} 个文件, {total_size / 1024:.2f} KB ({total_size / 1024 / 1024:.2f} MB)")
    print("=" * 80)
    
    # 检查是否满足用户要求
    print("\n🔍 用户要求检查:")
    requirements = {
        "无关技术文档": (3, "个文件夹"),  # 用户要求包含3个指定文件夹
        "过时文档": (10, "个文件"),
        "临时测试文档": (20, "个文件"),
        "重复文档": (5, "个文件"),
    }
    
    for category, (required_count, unit) in requirements.items():
        actual_count = len(results[category])
        status = "✅" if actual_count >= required_count else "⚠️"
        print(f"  {status} {category}: 找到 {actual_count} {unit} (要求: {required_count}+)")
    
    return total_files, total_size

def save_scan_results(results, output_file):
    """保存扫描结果到JSON文件"""
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n💾 扫描结果已保存到: {output_file}")

def delete_files(results):
    """删除文件并生成报告"""
    print("\n" + "=" * 80)
    print("🗑️  开始删除文件...")
    print("=" * 80)
    
    deletion_summary = {
        "无关技术文档": {"count": 0, "size": 0},
        "过时文档": {"count": 0, "size": 0},
        "临时测试文档": {"count": 0, "size": 0},
        "重复文档": {"count": 0, "size": 0},
    }
    
    for category, files in results.items():
        if not files:
            continue
            
        print(f"\n🗑️  删除 {category}...")
        for file_info in files:
            file_path = PROJECT_ROOT / file_info["path"]
            try:
                if file_path.exists():
                    file_size = file_path.stat().st_size
                    file_path.unlink()
                    deletion_summary[category]["count"] += 1
                    deletion_summary[category]["size"] += file_size
                    print(f"  ✅ 已删除: {file_info['path']} ({file_size / 1024:.2f} KB)")
                else:
                    print(f"  ⚠️  文件不存在: {file_info['path']}")
            except Exception as e:
                print(f"  ❌ 删除失败: {file_info['path']} - {e}")
    
    # 删除空文件夹
    print("\n🗑️  清理空文件夹...")
    for category, folders in CATEGORIES.items():
        for folder in folders.get("folders", []):
            folder_path = PROJECT_ROOT / folder
            if folder_path.exists() and folder_path.is_dir():
                try:
                    # 检查文件夹是否为空
                    if not any(folder_path.iterdir()):
                        folder_path.rmdir()
                        print(f"  ✅ 已删除空文件夹: {folder}")
                except Exception as e:
                    print(f"  ⚠️  无法删除文件夹 {folder}: {e}")
    
    # 生成删除报告
    print("\n" + "=" * 80)
    print("📊 删除结果汇总")
    print("=" * 80)
    
    total_deleted = 0
    total_size_freed = 0
    
    for category, summary in deletion_summary.items():
        if summary["count"] > 0:
            print(f"\n{category}:")
            print(f"  删除文件数: {summary['count']}")
            print(f"  释放空间: {summary['size'] / 1024:.2f} KB ({summary['size'] / 1024 / 1024:.2f} MB)")
            total_deleted += summary["count"]
            total_size_freed += summary["size"]
    
    print("\n" + "=" * 80)
    print(f"📊 总计: 删除 {total_deleted} 个文件, 释放 {total_size_freed / 1024:.2f} KB ({total_size_freed / 1024 / 1024:.2f} MB) 空间")
    print("=" * 80)
    
    # 保存删除报告
    report_file = PROJECT_ROOT / "document_cleanup_report.txt"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write("📊 文档清理删除报告\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"清理时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        for category, summary in deletion_summary.items():
            if summary["count"] > 0:
                f.write(f"{category}:\n")
                f.write(f"  删除文件数: {summary['count']}\n")
                f.write(f"  释放空间: {summary['size'] / 1024:.2f} KB ({summary['size'] / 1024 / 1024:.2f} MB)\n\n")
        
        f.write("=" * 80 + "\n")
        f.write(f"📊 总计: 删除 {total_deleted} 个文件, 释放 {total_size_freed / 1024:.2f} KB ({total_size_freed / 1024 / 1024:.2f} MB) 空间\n")
        f.write("=" * 80 + "\n")
    
    print(f"\n💾 删除报告已保存到: {report_file}")
    
    return deletion_summary

def main():
    """主函数"""
    print("🔍 开始智能扫描项目文档...")
    print(f"   项目根目录: {PROJECT_ROOT}")
    print()
    
    # 扫描文件
    results = scan_files()
    
    # 打印扫描结果
    total_files, total_size = print_scan_results(results, show_details=True)
    
    # 保存扫描结果
    save_scan_results(results, PROJECT_ROOT / "document_scan_results.json")
    
    # 检查是否满足要求
    requirements_met = True
    for category, (required_count, unit) in {
        "无关技术文档": (3, "个文件夹"),
        "过时文档": (10, "个文件"),
        "临时测试文档": (20, "个文件"),
        "重复文档": (5, "个文件"),
    }.items():
        if len(results[category]) < required_count:
            requirements_met = False
            break
    
    if not requirements_met:
        print("\n⚠️  警告: 未满足用户要求!")
        print("   1. 检查分类规则是否过于严格")
        print("   2. 手动添加更多文件到删除清单")
        print("   3. 或修改 requirements 中的数量要求")
        print("\n⚠️  是否继续?(y/n): ")
        response = input().strip().lower()
        if response != 'y':
            print("❌ 操作已取消")
            return
    
    # 确认删除
    print("\n" + "=" * 80)
    print("⚠️  确认删除?")
    print("   1. 请仔细检查上面的文件清单")
    print("   2. 确认无误后输入 'y' 继续")
    print("   3. 输入其他任意键取消")
    print("=" * 80)
    print("\n确认删除?(y/n): ")
    response = input().strip().lower()
    
    if response == 'y':
        # 删除文件
        deletion_summary = delete_files(results)
        print("\n✅ 文档清理完成!")
    else:
        print("\n❌ 操作已取消")

if __name__ == "__main__":
    main()
