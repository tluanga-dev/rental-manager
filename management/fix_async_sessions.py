#!/usr/bin/env python3
"""
Script to fix async session usage in main.py
"""

def fix_async_sessions():
    """Fix all async with config.get_session() patterns"""
    
    with open('main.py', 'r') as f:
        content = f.read()
    
    # Replace all instances of async with config.get_session() as session:
    # with the correct async for session in config.get_session(): pattern
    
    # This is a bit tricky because we need to fix the indentation of the content
    # Let's do a simple replacement that works for most cases
    old_pattern = "async with config.get_session() as session:"
    new_pattern = "async for session in config.get_session():"
    
    fixed_content = content.replace(old_pattern, new_pattern)
    
    with open('main.py', 'w') as f:
        f.write(fixed_content)
    
    print("✅ Fixed async session usage patterns")

if __name__ == '__main__':
    fix_async_sessions()
    print("🎉 Async session patterns fixed!")