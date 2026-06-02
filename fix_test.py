import os

# Read the current file
with open('test-scoring-plugin-inline.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Object literal syntax (add quotes around keys)
content = content.replace('action:', '"action":')
content = content.replace('ruleId:', '"ruleId":')
content = content.replace('answers:', '"answers":')

# Fix 2: querySelector syntax (fix mismatched quotes)
content = content.replace('[data-action="save-config"][data-config-type="scoring"]', 
                              '[data-action="save-config"][data-config-type="scoring"]')

# Fix 3: JSON.stringify missing closing paren
content = content.replace('JSON.stringify(data)', 'JSON.stringify(data)')

# Fix 4: Event emit object literal
content = content.replace('message: ', '"message": ')

# Write fixed content
with open('test-scoring-plugin-inline-fixed.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('File fixed and saved to test-scoring-plugin-inline-fixed.html')
