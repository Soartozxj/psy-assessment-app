#!/usr/bin/env python3
"""
Fix JavaScript template literal escaping issues.

This script handles JavaScript/HTML files that contain large template literals
(backtick strings) with inner backticks and braces that need escaping.

Two modes:
  1. Compact JSON-in-JS: window.FOO = [{...}];   -> No template literals, skip
  2. Template literal: window.FOO = `...`;        -> Fix inner escapes

This script is IDEMPOTENT: running it multiple times produces the same result.

Usage:
    python3 fix_template_literal.py <file_path> [--check-only]
"""

import sys
import re


def has_template_literal(content):
    """Check if file uses backtick template literals (not just JSON strings)."""
    # Template literal mode: window.FOO = `...`  (content starts/ends with `)
    # JSON-in-JS mode: window.FOO = [...]  (content is []-delimited, no inner `)
    backtick_count = content.count('`')
    bracket_depth = 0
    in_string = False
    string_char = None

    # Simple heuristic: if all backticks come in pairs at window assignment boundary
    # or if content looks like JSON array, it's not a template literal problem

    # Count backticks inside string values only
    i = 0
    inner_backticks = 0
    while i < len(content):
        c = content[i]
        if c in ['"', "'"] and (i == 0 or content[i-1] != '\\'):
            if not in_string:
                in_string = True
                string_char = c
            elif c == string_char:
                in_string = False
                string_char = None
        elif c == '`' and in_string:
            inner_backticks += 1
        i += 1

    return inner_backticks > 0


def find_template_boundaries_robust(content):
    """
    Find outer template literal boundaries using multiple heuristics.

    Strategy:
    1. If file uses compact JSON format (starts with '[' or '{' after '='), skip
    2. Otherwise, find the first backtick followed by alpha char (start of template)
       and scan forward character by character tracking brace depth
    3. When brace depth returns to 0 and we hit the closing backtick, that's it
    """
    # Mode 1: Compact JSON-in-JS (e.g. window.FOO = [{...}, {...}];)
    # These don't have template literal escaping issues
    json_pattern = re.search(r'=\s*\[\s*\{', content)
    if json_pattern:
        return None, None  # Skip JSON mode

    # Mode 2: Template literal mode
    # Find the outer backtick pair
    # Strategy: scan character by character, tracking ${} brace depth
    backtick_stack = []  # positions of unmatched backticks
    brace_depth = 0
    dollar_brace = False

    for i, c in enumerate(content):
        if dollar_brace:
            dollar_brace = False
            if c == '{':
                brace_depth += 1
            continue

        if c == '$' and i + 1 < len(content) and content[i+1] == '{':
            dollar_brace = True
            continue

        if c == '{' and not (i > 0 and content[i-1] == '$'):
            # Check if inside a string (simple heuristic: preceded by : or [ or , or space)
            if i > 0 and content[i-1] in [':', '[', ',', ' ', '\n', '\t']:
                brace_depth += 1
            continue

        if c == '}':
            if brace_depth > 0:
                brace_depth -= 1
            continue

        if c == '`':
            if not backtick_stack:
                # First backtick - this is the opening
                backtick_stack.append(i)
            else:
                # Check if this backtick is escaped
                num_bs = 0
                j = i - 1
                while j >= 0 and content[j] == '\\':
                    num_bs += 1
                    j -= 1

                if num_bs % 2 == 0:
                    # Not escaped - this closes the template
                    if brace_depth == 0:
                        return backtick_stack[0], i
                    else:
                        # Shouldn't happen in well-formed code, but handle it
                        backtick_stack.append(i)
                # If escaped (odd backslashes), ignore it

    return None, None


def escape_template_content(middle):
    """
    Escape inner content of a template literal (char by char).

    - Bare ` becomes \`
    - Bare { becomes \{
    - Already-escaped chars are preserved as-is
    """
    result = []
    i = 0
    while i < len(middle):
        c = middle[i]

        if c == '`':
            # Count preceding backslashes
            num_bs = 0
            j = i - 1
            while j >= 0 and middle[j] == '\\':
                num_bs += 1
                j -= 1
            if num_bs % 2 == 0:
                result.append('\\`')
            else:
                result.append('`')
            i += 1

        elif c == '{':
            num_bs = 0
            j = i - 1
            while j >= 0 and middle[j] == '\\':
                num_bs += 1
                j -= 1
            if num_bs % 2 == 0:
                result.append('\\{')
            else:
                result.append('{')
            i += 1

        elif c == '\\':
            # Copy \X together (preserves all existing escape sequences)
            result.append(c)
            if i + 1 < len(middle):
                result.append(middle[i + 1])
                i += 2
            else:
                i += 1

        else:
            result.append(c)
            i += 1

    return ''.join(result)


def fix_file(file_path, check_only=False):
    """Fix template literal escaping in a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    open_idx, close_idx = find_template_boundaries_robust(content)

    if open_idx is None or close_idx is None:
        print(f"No template literal found (or file uses JSON mode) in {file_path}")
        return True

    before = content[:open_idx]
    middle = content[open_idx:close_idx+1]
    after = content[close_idx+1:]

    fixed_middle = escape_template_content(middle)

    if middle == fixed_middle:
        print(f"No changes needed in {file_path}")
        return True

    if check_only:
        print(f"Would fix {file_path}: {len(middle)} -> {len(fixed_middle)} chars")
        return True

    fixed = before + fixed_middle + after
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed)

    print(f"Fixed {file_path}: bounds [{open_idx}, {close_idx}], {len(middle)} -> {len(fixed_middle)} chars")
    return True


if __name__ == '__main__':
    check_only = '--check-only' in sys.argv
    file_paths = [a for a in sys.argv[1:] if not a.startswith('--')]

    if not file_paths:
        print("Usage: python3 fix_template_literal.py <file_path>... [--check-only]")
        sys.exit(1)

    for fp in file_paths:
        fix_file(fp, check_only=check_only)
