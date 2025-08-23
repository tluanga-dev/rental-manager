#!/usr/bin/env python3
"""
Script to fix indentation issues in main.py
"""

import re

def fix_indentation():
    """Fix the systematic indentation issues in main.py"""
    
    with open('main.py', 'r') as f:
        content = f.read()
    
    # Split into lines for processing
    lines = content.split('\n')
    fixed_lines = []
    
    # Track if we're inside the handle_migration_manager function
    in_migration_function = False
    in_session_block = False
    in_while_loop = False
    
    for i, line in enumerate(lines):
        # Detect start of migration manager function
        if 'async def handle_migration_manager():' in line:
            in_migration_function = True
            fixed_lines.append(line)
            continue
            
        # Detect async with session block
        if in_migration_function and 'async with config.get_session() as session:' in line:
            in_session_block = True
            fixed_lines.append(line)
            continue
            
        # Detect while loop
        if in_session_block and 'while True:' in line and line.strip().startswith('while True:'):
            in_while_loop = True
            fixed_lines.append(line)
            continue
        
        # Fix elif statements to match proper indentation
        if in_while_loop and line.strip().startswith('elif choice =='):
            # Should be indented to 16 spaces (4 levels: function + try + session + while)
            fixed_line = '                ' + line.strip()
            fixed_lines.append(fixed_line)
            continue
            
        # Fix try blocks inside choice handlers
        if in_while_loop and line.strip() == 'try:' and i > 0 and 'elif choice ==' in lines[i-2]:
            # Should be indented to 20 spaces (5 levels)
            fixed_line = '                    ' + line.strip()
            fixed_lines.append(fixed_line)
            continue
            
        # Fix except blocks to match their try blocks
        if in_while_loop and line.strip().startswith('except Exception as e:'):
            # Find the matching try block indentation
            fixed_line = '                    ' + line.strip()
            fixed_lines.append(fixed_line)
            continue
        
        # Exit conditions
        if line.strip() == 'except KeyboardInterrupt:':
            in_migration_function = False
            in_session_block = False
            in_while_loop = False
        
        # Default: keep line as is
        fixed_lines.append(line)
    
    # Write fixed content back
    with open('main.py', 'w') as f:
        f.write('\n'.join(fixed_lines))
    
    print("✅ Indentation fixes applied")

if __name__ == '__main__':
    fix_indentation()