#!/usr/bin/env python3
"""Extract admin-scale-list.js - contiguous block of scale list functions."""
import re, subprocess, os

FP = '/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/admin-legacy.html'
OUT = '/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/admin-scale-list.js'

with open(FP, 'r') as f:
    text = f.read()

# Scale list functions are in a contiguous block
funcs = ['toggleDragSortMode', 'onDragStart', 'onDragOver', 'onDragEnter',
    'onDragLeave', 'onDrop', 'onDragEnd', 'filterScaleTable', 'renderScaleTable',
    'toggleDropdown', 'closeAllDropdowns', 'filterScoringRulesTable',
    'renderScoringRulesTable', 'refreshScoringCatFilter',
    'openScoringForScale', 'resetScoringForScale']

# Find first and last function boundaries
def fn_boundary(text, name, start):
    pattern = r'function\s+' + re.escape(name) + r'\s*\('
    m = re.search(pattern, text[start:])
    if not m: return None, None
    s = start + m.start()
    d = 0; op = False; p = s
    while p < len(text):
        if text[p] == '{': d += 1; op = True
        elif text[p] == '}': d -= 1
        if op and d == 0: return s, p+1
        p += 1
    return s, len(text)

first_name = funcs[0]
last_name = funcs[-1]

s1, e1 = fn_boundary(text, first_name, 0)
s2, e2 = fn_boundary(text, last_name, s1)

# The block starts at first fn and ends at last fn's closing brace
block_start = s1
block_end = e2

print(f"Block: lines {text[:block_start].count(chr(10))+1}-{text[:block_end].count(chr(10))}")

# Extract
block_text = text[block_start:block_end]

# Write extracted file
with open(OUT, 'w') as f:
    f.write(block_text + '\n')

# Remove from HTML (also remove any comments between functions)
# Find the nearest line before block_start that starts with a fn comment or blank
before = text.rfind('\n\n', 0, block_start)
if before < 0: before = text.rfind('\n', 0, block_start) 
start_trim = before + 1

# And find the line after block_end (should be \n or blank line)
end_trim = block_end

text = text[:start_trim] + text[end_trim:]

# Add script reference before admin-data.js
text = text.replace('<script src="admin-data.js">', '    <script src="admin-scale-list.js"></script>\n    <script src="admin-data.js">')

with open(FP, 'w') as f:
    f.write(text)

# Verify
r1 = subprocess.run(['node', '--check', OUT], capture_output=True, text=True)
scripts = re.findall(r'<script>(.*?)</script>', text, re.DOTALL)
with open('/tmp/rem.js', 'w') as f:
    for s in scripts:
        if s.strip(): f.write(s + '\n')
r2 = subprocess.run(['node', '--check', '/tmp/rem.js'], capture_output=True, text=True)

print(f"JS: extracted={'OK' if r1.returncode==0 else 'FAIL'} html={'OK' if r2.returncode==0 else 'FAIL'}")
print(f"Size: {os.path.getsize(OUT):,} bytes / {block_text.count(chr(10))} lines")
print(f"admin-legacy.html: {text.count(chr(10))} lines")
