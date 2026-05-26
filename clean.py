import sys

path = 'frontend/src/styles/globals.css'
with open(path, 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    line_num = i + 1
    if 682 <= line_num <= 1523: continue
    if 1698 <= line_num <= 1718: continue
    if 2032 <= line_num <= 2059: continue
    new_lines.append(line)

with open(path, 'w') as f:
    f.writelines(new_lines)
print('Successfully cleaned globals.css with Python')
