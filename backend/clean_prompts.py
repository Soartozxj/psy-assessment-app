#!/usr/bin/env python3
"""Clean default-prompts.js: remove duplicate + trim to active versions."""
import re, subprocess

FP = '/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/default-prompts.js'

with open(FP, 'r', encoding='utf-8') as f:
    text = f.read()

# Step 1: Remove duplicate json entry (2nd occurrence)
idx1 = text.find("currentVersion: '5.3'")
idx1 = text.find("id: 'json'", idx1)
idx2 = text.find("id: 'displayname-gen'", idx1)
entry_start = text.rfind('\n  {', 0, idx1)
text = text[:entry_start] + '\n  {\n' + text[idx2:]
# Fix: the displayname-gen entry was cut at 'id:', add back the leading '  {\n'
# Actually the cut might have taken too much. Let me check what we have.
# entry_start has the '\n  {' before the duplicate json entry.
# text[idx2:] starts with "id: 'displayname-gen'..." - need to prefix with '  {\n'

# Step 2: For each entry, trim versions to active only
# Find each 'versions: [' and its matching ']'
result = []
pos = 0
count = 0

while True:
    # Find next versions: [
    start = text.find('versions: [', pos)
    if start < 0:
        result.append(text[pos:])
        break
    
    result.append(text[pos:start])
    result.append('versions: [')
    
    # Find matching closing ]
    arr_start = start + len('versions: [')
    depth = 0
    in_str = False
    str_c = None
    end = arr_start
    
    for j in range(arr_start, len(text)):
        ch = text[j]
        if ch in ["'", '"']:
            if not in_str:
                in_str = True
                str_c = ch
            elif ch == str_c:
                in_str = False
        if not in_str:
            if ch == '[':
                depth += 1
            elif ch == ']':
                if depth == 0:
                    end = j
                    break
                depth -= 1
    
    inner = text[arr_start:end]
    
    # Find version objects
    objs = []
    d2 = 0
    ostart = -1
    for k, c in enumerate(inner):
        if c == '{':
            if d2 == 0:
                ostart = k
            d2 += 1
        elif c == '}':
            d2 -= 1
            if d2 == 0 and ostart >= 0:
                objs.append(inner[ostart:k+1])
                ostart = -1
    
    # Find entry id for logging
    before = text[max(0, start-200):start]
    eid = '?'
    m = re.search(r"id:\s*'([^']+)'", before)
    if m:
        eid = m.group(1)
    
    old_n = len(objs)
    active = [o for o in objs if "'active'" in o]
    
    if active:
        count += 1
        ao = active[0].strip().rstrip(',')
        # Preserve original trailing whitespace
        result.append('\n      ' + ao + '\n    ')
        print(f"  {eid}: {old_n} -> 1")
    else:
        result.append(inner)
        print(f"  {eid}: {old_n} (no active, kept all)")
    
    result.append(']')
    pos = end + 1

output = ''.join(result)

with open(FP, 'w', encoding='utf-8') as f:
    f.write(output)

r = subprocess.run(['node', '--check', FP], capture_output=True, text=True)
if r.returncode == 0:
    print(f"\nJS syntax: OK ({len(output)} chars)")
else:
    print(f"\nJS syntax ERROR: {r.stderr[:200]}")
    # Show around line
    err_line = int(re.search(r'(\d+)', r.stderr.split('\n')[0]).group(1)) if re.search(r'(\d+)', r.stderr) else 0
    lines = output.split('\n')
    if 0 < err_line <= len(lines):
        for l in range(max(0, err_line-3), min(len(lines), err_line+2)):
            marker = '>>>' if l == err_line-1 else '   '
            print(f'{marker} {l+1}: {lines[l][:100]}')
