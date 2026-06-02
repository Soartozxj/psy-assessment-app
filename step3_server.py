#!/usr/bin/env python3
"""Step 3: 清理混合量表顶层冗余 scoring.interpretation（服务器端执行版）"""
import json
import shutil
import sys

HYBRID_CODES = {
    "PPCRS", "FACES II-CV", "CBF-PI-B-2024", "SCL-90", "CPTI", "RPQ_SC",
    "SCSQ", "CBF_PI_15", "BSI18", "TMD", "PMSMU_AQ", "PMVGS", "NMP_C",
    "IAT", "IADDS", "IRIC", "APQ9", "SHORT_VIDEO_ADDICTION",
}

MODE = sys.argv[1] if len(sys.argv) > 1 else "--dry-run"
FILE_PATH = "/www/wwwroot/www.soarto.com.cn/scales-data.json"
BAK_PATH = "/www/wwwroot/www.soarto.com.cn/scales-data.json.bak.20260519_step3"

print(f"模式: {'DRY RUN（不实际修改）' if MODE == '--dry-run' else 'APPLY'}")
print()

# Load
with open(FILE_PATH) as f:
    data = json.load(f)

changed = []
unchanged = []

for i, scale in enumerate(data):
    code = scale.get("code")
    if code not in HYBRID_CODES:
        continue

    scoring = scale.get("scoring", {})
    top = scoring.get("interpretation", [])

    dim_interp_count = sum(1 for d in scoring.get("dimensions", []) if d.get("interpretation"))
    dim_keys = [d.get("key") for d in scoring.get("dimensions", []) if d.get("interpretation")]

    if not top:
        unchanged.append((code, scale.get("name")))
        continue

    changed.append({
        "code": code, "name": scale.get("name"),
        "top_count": len(top), "dim_count": dim_interp_count, "dim_keys": dim_keys
    })

    if MODE == "--apply":
        scoring["interpretation"] = []
        data[i]["scoring"] = scoring

print("=" * 60)
print(f"受影响的量表: {len(changed)} 个")
print(f"无变化的量表: {len(unchanged)} 个")
print("=" * 60)
print()

for c in changed:
    print(f"  {'✅' if MODE == '--apply' else '📋'} {c['code']} | {c['name']}")
    print(f"     顶层规则: {c['top_count']} 条 {'→ 已清空' if MODE == '--apply' else '→ 将清空'}")
    print(f"     维度级: {c['dim_count']} 维 {c['dim_keys']} 保留")
    print()

if unchanged:
    print(f"⚠️  以下量表顶层已是空:")
    for u in unchanged:
        print(f"  - {u[0]}: {u[1]}")
    print()

if MODE == "--dry-run":
    print("💡 dry-run：确认无误后用 --apply 执行")
else:
    # Save
    shutil.copy(FILE_PATH, BAK_PATH)
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("✅ 已保存（自动备份在上一步）")

    # Verify
    print()
    print("验证...")
    with open(FILE_PATH) as f:
        verify = json.load(f)
    still_nonempty = []
    for s in verify:
        if s.get("code") in HYBRID_CODES:
            top = s.get("scoring", {}).get("interpretation", [])
            if top:
                still_nonempty.append((s.get("code"), s.get("name"), len(top)))
    if still_nonempty:
        print(f"⚠️  验证失败！{len(still_nonempty)} 个量表仍非空:")
        for code, name, cnt in still_nonempty:
            print(f"  - {code}: {cnt} 条")
    else:
        print(f"✅ 验证通过：18 个混合量表顶层均已清空")
