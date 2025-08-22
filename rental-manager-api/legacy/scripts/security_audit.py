#!/usr/bin/env python3
"""
Security Audit Script for FastAPI Endpoints

This script analyzes all route files in the FastAPI application to identify:
1. Protected vs unprotected endpoints
2. Authentication dependencies used
3. Potential security vulnerabilities

Usage: python scripts/security_audit.py
"""

import os
import re
import ast
from pathlib import Path
from typing import Dict, List, Tuple, Set
from dataclasses import dataclass, field
from collections import defaultdict
import json
from datetime import datetime


@dataclass
class Endpoint:
    """Represents an API endpoint"""
    method: str
    path: str
    function_name: str
    protected: bool
    auth_dependencies: List[str] = field(default_factory=list)
    line_number: int = 0
    description: str = ""


@dataclass
class RouteModule:
    """Represents a module containing routes"""
    module_path: str
    module_name: str
    router_prefix: str
    endpoints: List[Endpoint] = field(default_factory=list)
    imports: Set[str] = field(default_factory=set)


class SecurityAuditor:
    """Analyzes FastAPI route files for security issues"""
    
    AUTH_DEPENDENCIES = {
        'get_current_user',
        'get_current_active_user', 
        'get_current_superuser',
        'get_current_user_optional'
    }
    
    PUBLIC_ENDPOINTS = {
        # Auth endpoints that should be public
        ('/auth/login', 'POST'),
        ('/auth/register', 'POST'),
        ('/auth/refresh', 'POST'),
        ('/auth/forgot-password', 'POST'),
        ('/auth/reset-password', 'POST'),
        # Health check endpoints
        ('/health', 'GET'),
        ('/api/health', 'GET'),
        ('/api/health/detailed', 'GET'),
    }
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.modules: List[RouteModule] = []
        self.statistics = defaultdict(int)
        
    def scan_directory(self, directory: Path) -> List[RouteModule]:
        """Recursively scan directory for route files"""
        # Find all files that end with 'routes.py' or contain 'routes' in the name
        route_files = list(directory.rglob("**/*routes*.py"))
        modules = []
        
        for route_file in route_files:
            if '__pycache__' in str(route_file):
                continue
            # Skip __init__ files
            if route_file.name == '__init__.py':
                continue
            module = self.analyze_route_file(route_file)
            if module and module.endpoints:
                modules.append(module)
                
        return modules
    
    def analyze_route_file(self, file_path: Path) -> RouteModule:
        """Analyze a single route file"""
        try:
            with open(file_path, 'r') as f:
                content = f.read()
                
            # Extract module information
            module_path = str(file_path.relative_to(self.base_path))
            module_name = self._get_module_name(file_path)
            router_prefix = self._extract_router_prefix(file_path, module_name)
            
            # Find imports
            imports = self._extract_imports(content)
            
            # Find endpoints
            endpoints = self._extract_endpoints(content, imports)
            
            # Debug output
            if len(endpoints) == 0 and '@router.' in content:
                print(f"WARNING: Found @router decorators but extracted 0 endpoints from {file_path.name}")
            
            return RouteModule(
                module_path=module_path,
                module_name=module_name,
                router_prefix=router_prefix,
                endpoints=endpoints,
                imports=imports
            )
            
        except Exception as e:
            import traceback
            print(f"Error analyzing {file_path}: {e}")
            print(traceback.format_exc())
            return None
    
    def _get_module_name(self, file_path: Path) -> str:
        """Extract module name from file path"""
        parts = file_path.parts
        # Find 'modules' index and get the next part
        try:
            modules_idx = parts.index('modules')
            if modules_idx + 1 < len(parts):
                return parts[modules_idx + 1]
        except ValueError:
            pass
        return file_path.parent.name
    
    def _extract_router_prefix(self, file_path: Path, module_name: str) -> str:
        """Extract router prefix based on main.py configuration"""
        # Map module names to their prefixes based on main.py
        prefix_map = {
            'auth': '/api/auth',
            'users': '/api/users',
            'master_data': '/api/master-data',
            'suppliers': '/api/suppliers',
            'customers': '/api/customers',
            'inventory': '/api/inventory',
            'transactions': '/api/transactions',
            'system': '/api/system',
            'company': '/api/company',
            'analytics': '/api/analytics',
            'admin': '/api/admin',
        }
        
        # Check for sub-modules
        if 'master_data' in str(file_path):
            if 'brands' in str(file_path):
                return '/api/master-data/brands'
            elif 'categories' in str(file_path):
                return '/api/master-data/categories'
            elif 'locations' in str(file_path):
                return '/api/master-data/locations'
            elif 'units' in str(file_path):
                return '/api/master-data/units'
            elif 'item_master' in str(file_path):
                return '/api/master-data/items'
                
        if 'transactions' in str(file_path):
            if 'purchase' in str(file_path):
                return '/api/transactions/purchases'
            elif 'sales' in str(file_path):
                return '/api/transactions/sales'
            elif 'rentals' in str(file_path):
                return '/api/transactions/rentals'
            elif 'purchase_returns' in str(file_path):
                return '/api/transactions/purchase-returns'
                
        return prefix_map.get(module_name, f'/api/{module_name}')
    
    def _extract_imports(self, content: str) -> Set[str]:
        """Extract imported authentication dependencies"""
        imports = set()
        import_pattern = r'from\s+[\w.]+\s+import\s+([^;\n]+)'
        
        for match in re.finditer(import_pattern, content):
            import_list = match.group(1)
            for auth_dep in self.AUTH_DEPENDENCIES:
                if auth_dep in import_list:
                    imports.add(auth_dep)
                    
        return imports
    
    def _extract_endpoints(self, content: str, imports: Set[str]) -> List[Endpoint]:
        """Extract endpoints from route file content"""
        endpoints = []
        
        # Pattern to match FastAPI route decorators and their functions
        # First captures method, then path (first string), then function name
        route_pattern = r'@router\.(get|post|put|delete|patch)\s*\(\s*["\']([^"\']+)["\'].*?\)\s*\n\s*(?:async\s+)?def\s+(\w+)\s*\('
        
        for match in re.finditer(route_pattern, content, re.MULTILINE | re.DOTALL):
            method = match.group(1).upper()
            path = match.group(2)
            function_name = match.group(3)
            
            # Get function content to check for auth dependencies
            func_start = match.end()
            func_content = self._extract_function_content(content, func_start)
            
            # Check if endpoint is protected
            auth_deps = []
            protected = False
            
            for auth_dep in self.AUTH_DEPENDENCIES:
                if auth_dep in func_content:
                    auth_deps.append(auth_dep)
                    protected = True
            
            # Extract description from docstring if present
            description = self._extract_docstring(func_content)
            
            endpoints.append(Endpoint(
                method=method,
                path=path,
                function_name=function_name,
                protected=protected,
                auth_dependencies=auth_deps,
                description=description
            ))
            
        return endpoints
    
    def _extract_function_content(self, content: str, start_pos: int) -> str:
        """Extract function content until next function or end of file"""
        next_func = content.find('\nasync def ', start_pos)
        next_decorator = content.find('\n@router.', start_pos)
        
        end_pos = len(content)
        if next_func > 0:
            end_pos = min(end_pos, next_func)
        if next_decorator > 0:
            end_pos = min(end_pos, next_decorator)
            
        return content[start_pos:end_pos]
    
    def _extract_docstring(self, func_content: str) -> str:
        """Extract docstring from function content"""
        docstring_match = re.search(r'"""([^"]+)"""', func_content)
        if docstring_match:
            return docstring_match.group(1).strip()
        return ""
    
    def generate_report(self) -> Dict:
        """Generate comprehensive security audit report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_endpoints': 0,
                'protected_endpoints': 0,
                'unprotected_endpoints': 0,
                'protection_rate': 0.0,
                'modules_scanned': len(self.modules)
            },
            'critical_issues': [],
            'modules': [],
            'unprotected_endpoints_by_risk': {
                'critical': [],
                'high': [],
                'medium': [],
                'low': []
            }
        }
        
        total_endpoints = 0
        protected_endpoints = 0
        
        for module in self.modules:
            module_info = {
                'name': module.module_name,
                'path': module.module_path,
                'prefix': module.router_prefix,
                'total_endpoints': len(module.endpoints),
                'protected_endpoints': 0,
                'unprotected_endpoints': 0,
                'endpoints': []
            }
            
            for endpoint in module.endpoints:
                total_endpoints += 1
                full_path = f"{module.router_prefix}{endpoint.path}"
                
                endpoint_info = {
                    'method': endpoint.method,
                    'path': full_path,
                    'function': endpoint.function_name,
                    'protected': endpoint.protected,
                    'auth_dependencies': endpoint.auth_dependencies,
                    'description': endpoint.description
                }
                
                if endpoint.protected:
                    protected_endpoints += 1
                    module_info['protected_endpoints'] += 1
                else:
                    module_info['unprotected_endpoints'] += 1
                    
                    # Classify risk level
                    risk_level = self._assess_risk_level(
                        full_path, 
                        endpoint.method,
                        module.module_name
                    )
                    
                    if risk_level != 'public':
                        report['unprotected_endpoints_by_risk'][risk_level].append({
                            'module': module.module_name,
                            'method': endpoint.method,
                            'path': full_path,
                            'function': endpoint.function_name
                        })
                        
                        if risk_level == 'critical':
                            report['critical_issues'].append(
                                f"CRITICAL: Unprotected {endpoint.method} {full_path} in {module.module_name}"
                            )
                
                module_info['endpoints'].append(endpoint_info)
            
            report['modules'].append(module_info)
        
        # Update summary
        report['summary']['total_endpoints'] = total_endpoints
        report['summary']['protected_endpoints'] = protected_endpoints
        report['summary']['unprotected_endpoints'] = total_endpoints - protected_endpoints
        if total_endpoints > 0:
            report['summary']['protection_rate'] = (protected_endpoints / total_endpoints) * 100
            
        return report
    
    def _assess_risk_level(self, path: str, method: str, module: str) -> str:
        """Assess risk level of unprotected endpoint"""
        # Check if endpoint should be public
        for public_path, public_method in self.PUBLIC_ENDPOINTS:
            if path.endswith(public_path) and method == public_method:
                return 'public'
        
        # Critical risk patterns
        critical_patterns = [
            'admin', 'superuser', 'delete', 'reset', 'recreate',
            'diagnosis', 'system', 'config', 'settings'
        ]
        
        # High risk patterns
        high_patterns = [
            'create', 'update', 'transaction', 'payment', 
            'inventory', 'customer', 'supplier', 'user'
        ]
        
        # Check patterns
        path_lower = path.lower()
        
        for pattern in critical_patterns:
            if pattern in path_lower or pattern in module.lower():
                return 'critical'
                
        for pattern in high_patterns:
            if pattern in path_lower or method in ['POST', 'PUT', 'DELETE', 'PATCH']:
                return 'high'
                
        if method == 'GET':
            return 'medium'
            
        return 'low'
    
    def print_summary(self, report: Dict):
        """Print report summary to console"""
        print("\n" + "="*80)
        print("SECURITY AUDIT REPORT")
        print("="*80)
        print(f"Timestamp: {report['timestamp']}")
        print(f"Modules Scanned: {report['summary']['modules_scanned']}")
        print(f"Total Endpoints: {report['summary']['total_endpoints']}")
        print(f"Protected Endpoints: {report['summary']['protected_endpoints']}")
        print(f"Unprotected Endpoints: {report['summary']['unprotected_endpoints']}")
        print(f"Protection Rate: {report['summary']['protection_rate']:.1f}%")
        
        if report['critical_issues']:
            print("\n" + "="*80)
            print("CRITICAL SECURITY ISSUES")
            print("="*80)
            for issue in report['critical_issues']:
                print(f"  - {issue}")
        
        print("\n" + "="*80)
        print("UNPROTECTED ENDPOINTS BY RISK LEVEL")
        print("="*80)
        
        for risk_level in ['critical', 'high', 'medium', 'low']:
            endpoints = report['unprotected_endpoints_by_risk'][risk_level]
            if endpoints:
                print(f"\n{risk_level.upper()} RISK ({len(endpoints)} endpoints):")
                for ep in endpoints[:10]:  # Show first 10
                    print(f"  - {ep['method']} {ep['path']} ({ep['module']})")
                if len(endpoints) > 10:
                    print(f"  ... and {len(endpoints) - 10} more")
        
        print("\n" + "="*80)
        print("MODULE SUMMARY")
        print("="*80)
        
        for module in report['modules']:
            protection_rate = 0
            if module['total_endpoints'] > 0:
                protection_rate = (module['protected_endpoints'] / module['total_endpoints']) * 100
            
            status = "✓" if protection_rate == 100 else "✗"
            print(f"{status} {module['name']:20} - {module['protected_endpoints']}/{module['total_endpoints']} protected ({protection_rate:.0f}%)")
    
    def save_report(self, report: Dict, output_file: str):
        """Save report to JSON file"""
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\nDetailed report saved to: {output_file}")
    
    def run(self):
        """Run the security audit"""
        print("Starting security audit...")
        
        # Scan modules directory
        modules_dir = self.base_path / "app" / "modules"
        self.modules = self.scan_directory(modules_dir)
        
        # Generate report
        report = self.generate_report()
        
        # Print summary
        self.print_summary(report)
        
        # Save detailed report
        output_file = self.base_path / "security_audit_report.json"
        self.save_report(report, str(output_file))
        
        return report


def main():
    """Main entry point"""
    # Get the backend directory
    script_dir = Path(__file__).parent
    backend_dir = script_dir.parent
    
    # Run audit
    auditor = SecurityAuditor(backend_dir)
    report = auditor.run()
    
    # Return exit code based on critical issues
    if report['critical_issues']:
        print(f"\n⚠️  FAILED: {len(report['critical_issues'])} critical security issues found!")
        return 1
    else:
        print("\n✅ No critical security issues found.")
        return 0


if __name__ == "__main__":
    exit(main())