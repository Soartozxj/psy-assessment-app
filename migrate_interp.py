#!/usr/bin/env python3
"""
interpretation 数据标准化迁移脚本 v2
将顶层 scoring.interpretation 中的规则迁移到维度级 dim.interpretation
保护逻辑：只迁移 metric 能匹配维度 key 的规则，不匹配的保留在顶层

用法：
  python3 migrate_interp.py --dry-run    # 预览，不修改文件
  python3 migrate_interp.py --apply      # 执行迁移并备份
"""

import json
import sys
import shutil
import os
import argparse
import subprocess
import tempfile
from collections import defaultdict

def rule_key(rule):
    """生成规则唯一标识，用于去重"""
    return (rule.get('metric',''), rule.get('min'), rule.get('max'), rule.get('level',''))

def migrate_scales(data, dry_run=False):
    only_top = []
    hybrid = []
    only_dim = []
    no_interp = []
    migrated = []
    deduplicated = []
    protected = []  # metric 不匹配、保留在顶层的

    for s in data:
        scoring = s.get('scoring', {})
        dims = scoring.get('dimensions', [])
        top_rules = scoring.get('interpretation', [])

        dim_has = any(len(d.get('interpretation', [])) > 0 for d in dims)
        top_has = len(top_rules) > 0
        code = s.get('code', s.get('name', '?'))

        if dim_has and not top_has:
            only_dim.append(code)
            continue
        elif not dim_has and top_has:
            only_top.append(code)
            if dry_run:
                continue

            # 构建维度 key 集合
            dim_keys = set(d.get('key', '') for d in dims)

            metric_rules = defaultdict(list)
            for r in top_rules:
                m = r.get('metric')
                if m:
                    metric_rules[m].append(r)

            # 分离：能匹配的 / 不能匹配的
            matched_metrics = set()
            unmatched_rules = []

            for r in top_rules:
                m = r.get('metric', '')
                if m in dim_keys:
                    matched_metrics.add(m)
                else:
                    unmatched_rules.append(r)

            # 将匹配的规则写入对应维度
            for dim in dims:
                key = dim.get('key', '')
                if key in metric_rules:
                    existing_keys = set(rule_key(r) for r in dim.get('interpretation', []))
                    new_rules = []
                    for r in metric_rules[key]:
                        k = rule_key(r)
                        if k not in existing_keys:
                            new_rules.append(r)
                    if 'interpretation' not in dim or dim['interpretation'] is None:
                        dim['interpretation'] = []
                    dim['interpretation'].extend(new_rules)
                    migrated.append(f"{code}:{key} (+{len(new_rules)}条)")

            # 顶层只保留不能匹配的规则（如 LES 的 negative_event 等）
            scoring['interpretation'] = unmatched_rules
            s['scoring'] = scoring
            if unmatched_rules:
                protected.append(f"{code}: 保留{len(unmatched_rules)}条顶层规则(metric不匹配维度)")

        elif dim_has and top_has:
            hybrid.append(code)
            if dry_run:
                continue

            all_dim_keys = set()
            for dim in dims:
                for r in dim.get('interpretation', []):
                    all_dim_keys.add(rule_key(r))

            remaining = []
            removed = 0
            for r in top_rules:
                k = rule_key(r)
                if k not in all_dim_keys:
                    remaining.append(r)
                else:
                    removed += 1

            scoring['interpretation'] = remaining
            s['scoring'] = scoring
            if removed > 0:
                deduplicated.append(f"{code} (移除{removed}条重复)")
        else:
            no_interp.append(code)

    return only_top, hybrid, only_dim, no_interp, migrated, deduplicated, protected

def main():
    parser = argparse.ArgumentParser(description='interpretation 数据标准化迁移 v2')
    parser.add_argument('--dry-run', action='store_true', help='仅预览，不修改文件')
    parser.add_argument('--apply', action='store_true', help='执行迁移（会先备份）')
    parser.add_argument('--file', default=None, help='指定 scales-data.json 路径（默认：生产服务器）')
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("请指定 --dry-run（预览）或 --apply（执行）")
        sys.exit(1)

    if args.file:
        filepath = args.file
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"读取本地文件: {filepath}")
    else:
        print("从生产服务器读取 scales-data.json...")
        result = subprocess.run(
            ['ssh', '-i', os.path.expanduser('~/.ssh/id_ed25519'),
             'root@101.43.43.125', 'cat /www/wwwroot/www.soarto.com.cn/scales-data.json'],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"无法连接生产服务器: {result.stderr}")
            sys.exit(1)
        data = json.loads(result.stdout)
        filepath = 'production_remote'
        print(f"读取到 {len(data)} 个量表")

    print()

    only_top, hybrid, only_dim, no_interp, migrated, deduplicated, protected = migrate_scales(data, dry_run=args.dry_run)

    print("=" * 50)
    print(f"总量表数: {len(data)}")
    print()
    print(f"【仅顶层，需迁移】{len(only_top)} 个:")
    for c in only_top: print(f"  - {c}")
    print()
    print(f"【混合型，需去重】{len(hybrid)} 个:")
    for c in hybrid: print(f"  - {c}")
    print()
    print(f"【仅维度级，无需处理】{len(only_dim)} 个:")
    for c in only_dim: print(f"  - {c}")
    print()
    print(f"【无规则】{len(no_interp)} 个:")
    for c in no_interp: print(f"  - {c}")
    print("=" * 50)

    if protected:
        print()
        print("【保护（metric 不匹配，保留顶层）】:")
        for p in protected: print(f"  - {p}")

    if args.dry_run:
        print()
        print("dry-run 模式，未修改文件。")
        print("确认无误后运行：python3 migrate_interp.py --apply")
        return

    if args.apply:
        if filepath == 'production_remote':
            print()
            print("备份生产服务器文件...")
            ts = subprocess.run(
                ['date', '+%Y%m%d_%H%M%S'], capture_output=True, text=True
            ).stdout.strip()
            bak_cmd = f"cp /www/wwwroot/www.soarto.com.cn/scales-data.json /www/wwwroot/www.soarto.com.cn/scales-data.json.bak.{ts}"
            subprocess.run(
                ['ssh', '-i', os.path.expanduser('~/.ssh/id_ed25519'),
                 'root@101.43.43.125', bak_cmd],
                check=True
            )
            print("备份完成")

            print("写回生产服务器...")
            json_str = json.dumps(data, ensure_ascii=False, indent=2)
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
                f.write(json_str)
                tmp_path = f.name
            subprocess.run(
                ['scp', '-i', os.path.expanduser('~/.ssh/id_ed25519'),
                 tmp_path, 'root@101.43.43.125:/www/wwwroot/www.soarto.com.cn/scales-data.json'],
                check=True
            )
            os.unlink(tmp_path)
            print("写入完成")
        else:
            bak_path = filepath + '.bak.' + __import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')
            shutil.copy2(filepath, bak_path)
            print(f"备份: {bak_path}")
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"写入: {filepath}")

        print()
        if migrated:
            print(f"迁移完成（{len(migrated)} 个维度）:")
            for m in migrated: print(f"  - {m}")
        if deduplicated:
            print("去重完成:")
            for d in deduplicated: print(f"  - {d}")
        if protected:
            print("保护（未迁移，保留在顶层）:")
            for p in protected: print(f"  - {p}")

        print()
        print("请至 H5/小程序验证后，再清理 scoring.interpretation 顶层冗余字段（第三步）")

if __name__ == '__main__':
    main()
