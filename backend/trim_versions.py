#!/usr/bin/env python3
"""Remove old versions from default-prompts.js, keep only active version per type."""
import re

FP = '/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/default-prompts.js'

with open(FP, 'r', encoding='utf-8') as f:
    text = f.read()

# Strategy: for each prompt entry, find its 'versions: [' and ']',
# then keep only the version object containing "status: 'active'"

# Use a simpler approach: split by 'versions: [' and process each array
parts = text.split('versions: [')

result = [parts[0]]

for i in range(1, len(parts)):
    before = parts[i-1]
    chunk = parts[i]
    
    # Find the matching ']' that closes this versions array
    # Count [] to handle nested content
    depth = 0
    end = -1
    in_str = False
    str_char = None
    
    for j, ch in enumerate(chunk):
        if ch in ["'", '"']:
            if not in_str:
                in_str = True
                str_char = ch
            elif ch == str_char:
                in_str = False
        if not in_str:
            if ch == '[':
                depth += 1
            elif ch == ']':
                depth -= 1
                if depth == 0:
                    end = j
                    break
    
    if end < 0:
        # Can't find closing - keep as-is
        result.append('versions: [' + chunk)
        continue
    
    versions_content = chunk[:end]
    after_versions = chunk[end:]  # ']...'
    
    # Find version objects by matching { ... } patterns
    # Since we know the structure, find all objects that have status: 'active'
    # Split the versions_content to find individual version objects
    objs = []
    depth2 = 0
    obj_start = -1
    for k, ch in enumerate(versions_content):
        if ch == '{':
            if depth2 == 0:
                obj_start = k
            depth2 += 1
        elif ch == '}':
            depth2 -= 1
            if depth2 == 0 and obj_start >= 0:
                objs.append(versions_content[obj_start:k+1])
                obj_start = -1
    
    old_count = len(objs)
    active = [o for o in objs if "'active'" in o]
    
    if active:
        # Determine the entry type name for logging
        type_match = re.search(r"id:\s*'([^']+)'", parts[i] if i > 0 else chunk[:200])
        type_name = type_match.group(1) if type_match else f'entry_{i}'
        print(f"  {type_name}: {old_count} -> {len(active)}")
        
        # Rebuild: keep the active version object, reformat properly
        active_obj = active[0]
        # Remove trailing comma from the object
        if active_obj.rstrip().endswith(','):
            active_obj = active_obj.rstrip()[:-1]
        
        # Build the new versions array content
        indent = '      '
        new_versions = '\n' + indent + active_obj.strip() + '\n    '
        result.append('versions: [' + new_versions + after_versions)
    else:
        print(f"  entry_{i}: no active version found, keeping all {old_count}")
        result.append('versions: [' + versions_content + after_versions)

output = 'versions: ['.join(result)

with open(FP, 'w', encoding='utf-8') as f:
    f.write(output)

import subprocess
r = subprocess.run(['node', '--check', FP], capture_output=True, text=True)
if r.returncode == 0:
    print("JS syntax: OK")
else:
    print(f"JS syntax ERROR: {r.stderr}")
