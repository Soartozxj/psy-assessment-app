#!/usr/bin/env python3
"""Batch extract remaining modules from admin-legacy.html."""
import re, subprocess, os

FP = '/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/admin-legacy.html'

with open(FP, 'r') as f:
    text = f.read()

def extract_block(path, name, first_fn, last_fn, script_ref):
    global text
    def fb(t, n, s):
        p = r'function\s+' + re.escape(n) + r'\s*\('
        m = re.search(p, t[s:])
        if not m: return None, None
        st = s + m.start()
        d = 0; op = False; p2 = st
        while p2 < len(t):
            if t[p2] == '{': d += 1; op = True
            elif t[p2] == '}': d -= 1
            if op and d == 0: return st, p2+1
            p2 += 1
        return st, len(t)
    
    s1, e1 = fb(text, first_fn, 0)
    s2, e2 = fb(text, last_fn, s1)
    block = text[s1:e2]
    
    with open(path, 'w') as f:
        f.write(block + '\n')
    
    # Remove the block
    before = text.rfind('\n', 0, s1)
    if before < 0: before = 0
    text = text[:before] + text[e2:]
    
    # Add script ref
    text = text.replace('<script src="admin-scale-list.js">', 
                        '    <script src="' + script_ref + '"></script>\n    <script src="admin-scale-list.js">')
    
    # Verify
    r1 = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    scripts = re.findall(r'<script>(.*?)</script>', text, re.DOTALL)
    with open('/tmp/rem.js', 'w') as f:
        for s in scripts:
            if s.strip(): f.write(s + '\n')
    r2 = subprocess.run(['node', '--check', '/tmp/rem.js'], capture_output=True, text=True)
    
    ok1 = 'OK' if r1.returncode == 0 else 'FAIL'
    ok2 = 'OK' if r2.returncode == 0 else 'FAIL'
    size = os.path.getsize(path)
    lines = block.count('\n')
    print(f"  {name}: {lines:4d}行 / {size:6d}B  JS={ok1} HTML={ok2}")
    return ok1 == 'OK' and ok2 == 'OK'

BD = '/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend'
print("提取结果:")

# Scale-form: openScaleModal through autoCalcDuration
extract_block(f'{BD}/admin-scale-form.js', 'scale-form',
    'openScaleModal', 'autoCalcDuration', 'admin-scale-form.js')

# Scoring: manageScoringRules through resetScoring
extract_block(f'{BD}/admin-scoring.js', 'scoring',
    'manageScoringRules', 'resetScoring', 'admin-scoring.js')

# NPC: loadNpcConfig through updateEditPreview
extract_block(f'{BD}/admin-npc.js', 'npc',
    'loadNpcConfig', 'updateEditPreview', 'admin-npc.js')

# Ops: opsLoadConfig through opsManualSearch
extract_block(f'{BD}/admin-ops.js', 'ops',
    'opsLoadConfig', 'opsManualSearch', 'admin-ops.js')

# Sysprompts: inside IIFE
extract_block(f'{BD}/admin-sysprompts.js', 'sysprompts',
    'spLoadData', 'spData', 'admin-sysprompts.js')

# Write final HTML
with open(FP, 'w') as f:
    f.write(text)

print(f"\nadmin-legacy.html: {text.count(chr(10))} lines")
