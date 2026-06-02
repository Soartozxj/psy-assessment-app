#!/usr/bin/env python3
"""量表解释规则综合验证脚本"""
import json

with open("/www/wwwroot/www.soarto.com.cn/scales-data.json", "r") as f:
    data = json.load(f)

# 分类统计
dim_only = []
top_only = []
hybrid = []
no_rules = []
total_dim_rules = 0
total_top_rules = 0
hybrid_top_not_cleared = []

HYBRID_CODES = {
    "PPCRS", "FACES II-CV", "CBF-PI-B-2024", "SCL-90", "CPTI", "RPQ_SC",
    "SCSQ", "CBF_PI_15", "BSI18", "TMD", "PMSMU_AQ", "PMVGS", "NMP_C",
    "IAT", "IADDS", "IRIC", "APQ9", "SHORT_VIDEO_ADDICTION",
}

for scale in data:
    code = scale.get("code", "unknown")
    scoring = scale.get("scoring", {})
    interp = scoring.get("interpretation", [])
    dims = scoring.get("dimensions", [])

    dim_has_interp = any(d.get("interpretation") for d in dims)
    top_has_interp = len(interp) > 0

    # 统计维度级规则
    dim_rule_count = sum(len(d.get("interpretation", [])) for d in dims)
    total_dim_rules += dim_rule_count

    if dim_has_interp and top_has_interp:
        hybrid.append(code)
        total_top_rules += len(interp)
        if len(interp) > 0:
            hybrid_top_not_cleared.append(code)
    elif dim_has_interp:
        dim_only.append(code)
    elif top_has_interp:
        top_only.append(code)
        total_top_rules += len(interp)
    else:
        if dim_rule_count > 0:
            dim_only.append(code)
        else:
            no_rules.append(code)

print("=" * 60)
print("量表解释规则综合验证报告")
print("=" * 60)
print(f"\n维度级 only: {len(dim_only)} 个")
print(f"  {dim_only}")
print(f"\n顶层 only:   {len(top_only)} 个 (应有且仅 LES)")
print(f"  {top_only}")
print(f"\n混合(冗余待清): {len(hybrid)} 个")
print(f"  {hybrid}")
print(f"\n无规则:     {len(no_rules)} 个")
print(f"  {no_rules}")
print(f"\n总计:       {len(data)} 个量表")

print(f"\n--- 规则统计 ---")
print(f"维度级规则总数: {total_dim_rules}")
print(f"顶层规则总数:  {total_top_rules}")
print(f"混合量表顶层仍未清空: {len(hybrid_top_not_cleared)}")
if hybrid_top_not_cleared:
    print(f"  未清空: {hybrid_top_not_cleared}")

# 验证 LES 保护
les = next((s for s in data if s.get("code") == "LES"), None)
if les:
    les_top = les.get("scoring", {}).get("interpretation", [])
    les_dims = les.get("scoring", {}).get("dimensions", [])
    les_dim_interp = any(d.get("interpretation") for d in les_dims)
    print(f"\n--- LES 保护验证 ---")
    print(f"LES 顶层规则数: {len(les_top)}")
    print(f"LES 维度级有规则: {les_dim_interp}")
    print(f"LES metric 字段: {[r.get('metric') for r in les_top[:3]]}")
    print(f"LES dim keys: {[d.get('key') for d in les_dims[:5]]}")

# 验证 SSRS 正确迁移
ssrs = next((s for s in data if s.get("code") == "SSRS"), None)
if ssrs:
    ssrs_dims = ssrs.get("scoring", {}).get("dimensions", [])
    ssrs_top = ssrs.get("scoring", {}).get("interpretation", [])
    print(f"\n--- SSRS 迁移验证 ---")
    for d in ssrs_dims:
        dk = d.get("key")
        di = d.get("interpretation", [])
        if di:
            print(f"  {dk}: {len(di)} 条规则 -> {di[0].get('metric')}")
    print(f"  顶层规则数: {len(ssrs_top)} (应为 0)")

# 验证 18 个混合量表全部清空
print(f"\n--- 18 混合量表清空验证 ---")
all_clear = True
for code in HYBRID_CODES:
    scale = next((s for s in data if s.get("code") == code), None)
    if scale:
        top_interp = scale.get("scoring", {}).get("interpretation", [])
        dim_interp = any(d.get("interpretation") for d in scale.get("scoring", {}).get("dimensions", []))
        status = "✅" if (len(top_interp) == 0 and dim_interp) else "❌"
        if status == "❌":
            all_clear = False
        print(f"  {status} {code}: 顶层{len(top_interp)}条, 维度级{'有' if dim_interp else '无'}规则")
    else:
        print(f"  ⚠️  未找到: {code}")

print(f"\n混合量表全部正确清空: {'✅ YES' if all_clear else '❌ NO'}")
print("=" * 60)
