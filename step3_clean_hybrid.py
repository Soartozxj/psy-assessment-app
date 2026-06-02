#!/usr/bin/env python3
"""
Step 3: 清理混合量表顶层冗余 scoring.interpretation

在 Step 2 迁移完成后，有 18 个量表同时拥有：
  - 维度级 dim.interpretation（已填充，Step 2 迁移所得）
  - 顶层 scoring.interpretation（冗余，应清空）

本脚本清空这 18 个量表的顶层 interpretation 字段。
"""

import json
import sys
import subprocess
import re

SERVER_FILE = "root@101.43.43.125:/www/wwwroot/www.soarto.com.cn/scales-data.json"
REMOTE_BAK = "/www/wwwroot/www.soarto.com.cn/scales-data.json.bak.20260519_2130"

# 用 code 匹配（字符串，稳定）
HYBRID_CODES = {
    "PPCRS",           # 父母共同教养关系感知量表
    "FACES II-CV",     # 家庭亲密度和适应性
    "CBF-PI-B-2024",   # 中国大五人格问卷（简式版）
    "SCL-90",          # 90项症状清单
    "CPTI",            # 儿童问题特质问卷
    "RPQ_SC",          # 反应性-主动性攻击量表
    "SCSQ",            # 简易应对方式问卷
    "CBF_PI_15",       # CBF-PI-15
    "BSI18",           # BSI-18
    "TMD",             # 手机依赖测验
    "PMSMU_AQ",        # 问题性移动社交媒体使用评估问卷
    "PMVGS",           # 问题性移动视频游戏使用量表
    "NMP_C",           # 无手机恐惧量表
    "IAT",             # 青少年网络成瘾诊断量表
    "IADDS",           # 中学生网络成瘾诊断量表
    "IRIC",            # 人际反应指针量表
    "APQ9",            # 父母教养行为问卷(简式版)
    "SHORT_VIDEO_ADDICTION",  # 大学生短视频成瘾量表
}


def get_remote_data():
    """从生产服务器读取 scales-data.json"""
    result = subprocess.run(
        ["ssh", "-i", "/Users/rich/.ssh/id_ed25519", "root@101.43.43.125",
         "cat /www/wwwroot/www.soarto.com.cn/scales-data.json"],
        capture_output=True, text=True, check=True
    )
    return json.loads(result.stdout)


def save_remote_data(data, dry_run=False):
    """保存数据到生产服务器"""
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    # 先写入本地临时文件，再 scp 上传
    local_tmp = "/tmp/scales-data-step3.json"
    with open(local_tmp, "w", encoding="utf-8") as f:
        f.write(json_str)

    if dry_run:
        print(f"  [dry-run] 不会实际保存到服务器")
        return

    subprocess.run(
        ["scp", "-i", "/Users/rich/.ssh/id_ed25519",
         local_tmp, SERVER_FILE],
        check=True
    )
    print(f"  已上传到生产服务器")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--dry-run"
    if mode not in ("--dry-run", "--apply"):
        print(f"用法: python3 {sys.argv[0]} [--dry-run|--apply]")
        sys.exit(1)

    print(f"模式: {'DRY RUN（不实际修改）' if mode == '--dry-run' else 'APPLY（实际执行）'}")
    print()

    data = get_remote_data()

    changed = []
    unchanged = []

    for i, scale in enumerate(data):
        code = scale.get("code")
        if code not in HYBRID_CODES:
            continue

        scoring = scale.get("scoring", {})
        top = scoring.get("interpretation", [])

        if not top:
            unchanged.append((scale.get("name"), "顶层已是空数组"))
            continue

        dim_interp_count = sum(
            1 for d in scoring.get("dimensions", [])
            if d.get("interpretation")
        )
        dim_keys = [d.get("key") for d in scoring.get("dimensions", [])
                    if d.get("interpretation")]

        if mode == "--dry-run":
            changed.append({
                "code": code,
                "name": scale.get("name"),
                "top_count": len(top),
                "dim_count": dim_interp_count,
                "dim_keys": dim_keys
            })
        else:
            # 清空顶层 interpretation
            scoring["interpretation"] = []
            data[i]["scoring"] = scoring
            changed.append({
                "code": code,
                "name": scale.get("name"),
                "top_count": len(top),
                "dim_count": dim_interp_count,
                "dim_keys": dim_keys
            })

    print(f"{'='*60}")
    print(f"受影响的量表: {len(changed)} 个")
    print(f"无变化的量表: {len(unchanged)} 个")
    print(f"{'='*60}")
    print()

    for c in changed:
        print(f"  ✅ {c['code']} | {c['name']}")
        print(f"     顶层规则: {c['top_count']} 条 → 清空")
        print(f"     维度级: {c['dim_count']} 维 {c['dim_keys']} 保留")
        print()

    if unchanged:
        print(f"⚠️  以下量表顶层已是空（无需处理）:")
        for u in unchanged:
            print(f"  - {u[0]}: {u[1]}")
        print()

    if mode == "--dry-run":
        print("💡 这是 dry-run，不实际修改数据。")
        print("   确认无误后用 --apply 执行实际修改。")
    else:
        print("✅ 数据已修改（上一步已自动备份）。")

        # 验证：重新读取并检查
        print()
        print("验证修改结果...")
        verify_data = get_remote_data()
        verify_changed = []
        for scale in verify_data:
            code = scale.get("code")
            if code in HYBRID_CODES:
                top = scale.get("scoring", {}).get("interpretation", [])
                if top:
                    verify_changed.append((code, scale.get("name"), len(top)))

        if verify_changed:
            print(f"⚠️  验证失败！仍有 {len(verify_changed)} 个量表顶层非空:")
            for code, name, cnt in verify_changed:
                print(f"  - {code} | {name}: {cnt} 条")
        else:
            print("✅ 验证通过：18 个混合量表顶层 interpretation 均已清空")


if __name__ == "__main__":
    main()
