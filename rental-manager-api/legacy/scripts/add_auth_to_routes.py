#!/usr/bin/env python3
"""
Script to automatically add authentication to all unprotected endpoints in route files.

Usage: python scripts/add_auth_to_routes.py <route_file_path> [--auth-type user|superuser]
"""

import sys
import re
from pathlib import Path
from typing import List


def add_authentication_imports(content: str) -> str:
    """Add authentication imports if not present"""
    imports_to_add = [
        "from app.modules.auth.dependencies import get_current_user",
        "from app.modules.users.models import User"
    ]
    
    lines = content.split('\n')
    import_section_end = 0
    has_auth_import = False
    has_user_import = False
    
    # Find where imports end and check if auth imports exist
    for i, line in enumerate(lines):
        if line.strip().startswith('from ') or line.strip().startswith('import '):
            import_section_end = i
            if 'get_current_user' in line:
                has_auth_import = True
            if 'from app.modules.users.models import User' in line:
                has_user_import = True
    
    # Add missing imports after the last import
    if not has_auth_import:
        lines.insert(import_section_end + 1, imports_to_add[0])
        import_section_end += 1
    
    if not has_user_import:
        lines.insert(import_section_end + 1, imports_to_add[1])
    
    return '\n'.join(lines)


def add_auth_to_endpoint(content: str, auth_type: str = "user") -> str:
    """Add authentication dependency to all unprotected endpoints"""
    
    auth_dep = "get_current_superuser" if auth_type == "superuser" else "get_current_user"
    
    # Pattern to match route decorators and function definitions
    route_pattern = r'(@router\.(get|post|put|delete|patch)\s*\([^)]*\)[^\n]*\n)\s*(async\s+def\s+\w+\s*\([^)]*)\):'
    
    def replace_endpoint(match):
        decorator = match.group(1)
        method = match.group(2)
        func_def = match.group(3)
        
        # Check if already has authentication
        if 'get_current_user' in func_def or 'get_current_superuser' in func_def:
            return match.group(0)  # Return unchanged
        
        # Add authentication parameter
        if func_def.strip().endswith('('):
            # No parameters
            new_func_def = func_def + f'\n    current_user: User = Depends({auth_dep})'
        else:
            # Has parameters, add as last parameter
            new_func_def = func_def + f',\n    current_user: User = Depends({auth_dep})'
        
        return decorator + new_func_def + '):'
    
    return re.sub(route_pattern, replace_endpoint, content, flags=re.MULTILINE | re.DOTALL)


def secure_route_file(file_path: Path, auth_type: str = "user") -> bool:
    """Secure all endpoints in a route file"""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Check if file has router decorators
        if '@router.' not in content:
            print(f"No router decorators found in {file_path}")
            return False
        
        # Add imports
        content = add_authentication_imports(content)
        
        # Add authentication to endpoints
        content = add_auth_to_endpoint(content, auth_type)
        
        # Write back to file
        with open(file_path, 'w') as f:
            f.write(content)
        
        print(f"✅ Successfully secured endpoints in {file_path}")
        return True
        
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/add_auth_to_routes.py <route_file_path> [--auth-type user|superuser]")
        sys.exit(1)
    
    file_path = Path(sys.argv[1])
    auth_type = "user"  # default
    
    # Parse auth type argument
    if len(sys.argv) > 2:
        if sys.argv[2] == "--auth-type" and len(sys.argv) > 3:
            if sys.argv[3] in ["user", "superuser"]:
                auth_type = sys.argv[3]
            else:
                print("Invalid auth type. Use 'user' or 'superuser'")
                sys.exit(1)
    
    if not file_path.exists():
        print(f"File not found: {file_path}")
        sys.exit(1)
    
    if not file_path.name.endswith(('routes.py', '_routes.py')):
        print(f"Warning: {file_path} doesn't appear to be a routes file")
    
    success = secure_route_file(file_path, auth_type)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()