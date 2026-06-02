#!/usr/bin/env python3
"""Extract admin-ai-diag.js from admin-legacy.html - AI diagnosis + one-click modal."""
import re, subprocess, os

FP = '/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/admin-legacy.html'
OUT = '/Users/rich/WorkBuddy/20260407113106/mini-app-h5/backend/admin-ai-diag.js'

with open(FP, 'r') as f:
    text = f.read()

# Variables + Functions to extract (in two blocks)
block1_names = ['getSelectedScale', 'getMetaPrompt', 'loadMetaPromptToEditor',
    'toggleMetaPromptPanel', 'buildScaleContext', 'renderAiDiagScaleList',
    'filterAiDiagList', 'selectAiDiagScale', 'toggleAiDiagEnabled',
    'saveAiDiagConfig', 'resetAiDiagPrompt', 'testAiDiag']

block2_vars = ['_aiModalScaleId', '_aiModalScaleName', '_aiParsedData', '_aiMsgHandler']
block2_funcs = ['openAiOneClickModal', 'closeAiOneClickModal', '_resetAiSteps',
    '_activateAiStep', 'aiOneClickImport']

all_items = block1_names + block2_vars + block2_funcs

def find_boundary(text, name, start_from):
    """Find JS var/let/const/function declaration and its boundary."""
    # Try variable first
    for prefix in ['var ', 'let ', 'const ', 'function ', 'async function ']:
        pattern = prefix + re.escape(name) + r'\b'
        match = re.search(pattern, text[start_from:])
        if match:
            fn_start = start_from + match.start()
            
            # For variables, find end of line (or statement)
            if prefix != 'function ' and prefix != 'async function ':
                line_end = text.find('\n', fn_start)
                if line_end < 0:
                    line_end = len(text)
                return fn_start, line_end + 1
            
            # For functions, track braces
            depth = 0
            found_open = False
            pos = fn_start
            while pos < len(text):
                ch = text[pos]
                if ch == '{':
                    depth += 1
                    found_open = True
                elif ch == '}':
                    depth -= 1
                    if found_open and depth == 0:
                        return fn_start, pos + 1
                pos += 1
            return fn_start, len(text)
    
    return None, None

# Extract items in order they appear
extracted = []
ranges = []
search_pos = 0

for name in all_items:
    start, end = find_boundary(text, name, search_pos)
    if start is not None:
        extracted.append((start, end, name))
        search_pos = start + 1
    else:
        print(f"  NOT FOUND: {name}")

# Sort to remove in reverse order
extracted.sort(key=lambda x: x[0], reverse=True)

# Build output file (extract in original order)
output_parts = []
for start, end, name in sorted(extracted, key=lambda x: x[0]):
    output_parts.append(text[start:end])
# Write extracted file in original order
piece_text = '\n\n'.join(output_parts)
with open(OUT, 'w') as f:
    f.write(piece_text)

# Remove from HTML
for start, end, name in extracted:
    text = text[:start] + text[end:]

# Add script reference to HTML
fb_ref = 'admin-feedback.js'
ai_ref = '    <script src="admin-ai-diag.js"></script>\n'
text = text.replace(fb_ref, ai_ref + fb_ref)

with open(FP, 'w') as f:
    f.write(text)

# Check JS
r1 = subprocess.run(['node', '--check', OUT], capture_output=True, text=True)
scripts = re.findall(r'<script>(.*?)</script>', text, re.DOTALL)
with open('/tmp/check_rem.js', 'w') as f:
    for s in scripts:
        if s.strip(): f.write(s + '\n')
r2 = subprocess.run(['node', '--check', '/tmp/check_rem.js'], capture_output=True, text=True)

print(f"=== admin-ai-diag.js ===")
print(f"files: {os.path.getsize(OUT):,} bytes / {piece_text.count(chr(10))} lines / {len(extracted)} items")
print(f"JS syntax: extracted={'OK' if r1.returncode==0 else 'FAIL'} html={'OK' if r2.returncode==0 else 'FAIL'}")
print(f"admin-legacy.html: {text.count(chr(10))} lines")
