#!/usr/bin/env python3
"""
Simple test to verify security management system components
"""

import sys
import json
from datetime import datetime

# Test results
results = {
    "timestamp": datetime.now().isoformat(),
    "backend": {
        "models": [],
        "routes": [],
        "services": []
    },
    "frontend": {
        "components": [],
        "api_service": []
    },
    "summary": {
        "total": 0,
        "passed": 0,
        "failed": 0
    }
}

def test_backend_components():
    """Test backend security components"""
    print("\n🔧 Testing Backend Security Components...\n")
    
    # Test 1: Import security models
    try:
        sys.path.insert(0, 'rental-manager-backend')
        from app.modules.security.models import (
            SecurityAuditLog, SessionToken, IPWhitelist
        )
        results["backend"]["models"].append({
            "test": "Import security models",
            "success": True,
            "tables": ["security_audit_logs", "session_tokens", "ip_whitelist"]
        })
        print("✅ Security models imported successfully")
    except Exception as e:
        results["backend"]["models"].append({
            "test": "Import security models",
            "success": False,
            "error": str(e)
        })
        print(f"❌ Failed to import security models: {e}")
    
    # Test 2: Check security schemas
    try:
        from app.modules.security.schemas import (
            PermissionResponse, RoleResponse, SecurityStats,
            SecurityAuditLog as AuditLogSchema
        )
        results["backend"]["models"].append({
            "test": "Import security schemas",
            "success": True
        })
        print("✅ Security schemas imported successfully")
    except Exception as e:
        results["backend"]["models"].append({
            "test": "Import security schemas",
            "success": False,
            "error": str(e)
        })
        print(f"❌ Failed to import security schemas: {e}")
    
    # Test 3: Check security services
    try:
        from app.modules.security.services import SecurityService
        results["backend"]["services"].append({
            "test": "Import SecurityService",
            "success": True
        })
        print("✅ SecurityService imported successfully")
    except Exception as e:
        results["backend"]["services"].append({
            "test": "Import SecurityService",
            "success": False,
            "error": str(e)
        })
        print(f"❌ Failed to import SecurityService: {e}")
    
    # Test 4: Check security routes
    try:
        from app.modules.security.routes import router
        # Count endpoints
        endpoint_count = len([r for r in router.routes if hasattr(r, 'methods')])
        results["backend"]["routes"].append({
            "test": "Import security routes",
            "success": True,
            "endpoints": endpoint_count
        })
        print(f"✅ Security routes imported successfully ({endpoint_count} endpoints)")
    except Exception as e:
        results["backend"]["routes"].append({
            "test": "Import security routes",
            "success": False,
            "error": str(e)
        })
        print(f"❌ Failed to import security routes: {e}")

def test_frontend_components():
    """Test frontend security components exist"""
    print("\n🖥️  Testing Frontend Security Components...\n")
    
    import os
    
    # Test 1: Check main security page
    security_page = "rental-manager-frontend/src/app/admin/security/page.tsx"
    if os.path.exists(security_page):
        results["frontend"]["components"].append({
            "test": "Security page exists",
            "success": True,
            "path": security_page
        })
        print(f"✅ Security page exists: {security_page}")
    else:
        results["frontend"]["components"].append({
            "test": "Security page exists",
            "success": False
        })
        print(f"❌ Security page not found")
    
    # Test 2: Check security components
    components = [
        "SecurityDashboard.tsx",
        "RoleManagement.tsx",
        "PermissionManagement.tsx",
        "AuditLogs.tsx",
        "UserSecurity.tsx"
    ]
    
    components_dir = "rental-manager-frontend/src/app/admin/security/components/"
    for component in components:
        path = os.path.join(components_dir, component)
        if os.path.exists(path):
            results["frontend"]["components"].append({
                "test": f"Component {component}",
                "success": True
            })
            print(f"✅ Component exists: {component}")
        else:
            results["frontend"]["components"].append({
                "test": f"Component {component}",
                "success": False
            })
            print(f"❌ Component not found: {component}")
    
    # Test 3: Check API service
    api_service = "rental-manager-frontend/src/services/api/security.ts"
    if os.path.exists(api_service):
        results["frontend"]["api_service"].append({
            "test": "Security API service exists",
            "success": True,
            "path": api_service
        })
        print(f"✅ Security API service exists: {api_service}")
    else:
        results["frontend"]["api_service"].append({
            "test": "Security API service exists",
            "success": False
        })
        print(f"❌ Security API service not found")

def generate_report():
    """Generate test report"""
    
    # Calculate totals
    for category in results["backend"].values():
        for test in category:
            results["summary"]["total"] += 1
            if test.get("success"):
                results["summary"]["passed"] += 1
            else:
                results["summary"]["failed"] += 1
    
    for category in results["frontend"].values():
        for test in category:
            results["summary"]["total"] += 1
            if test.get("success"):
                results["summary"]["passed"] += 1
            else:
                results["summary"]["failed"] += 1
    
    # Print summary
    print("\n" + "="*50)
    print("📊 Test Results Summary")
    print("="*50)
    print(f"Total Tests: {results['summary']['total']}")
    print(f"✅ Passed: {results['summary']['passed']}")
    print(f"❌ Failed: {results['summary']['failed']}")
    
    if results['summary']['total'] > 0:
        success_rate = (results['summary']['passed'] / results['summary']['total']) * 100
        print(f"Success Rate: {success_rate:.1f}%")
    
    # Save report
    with open("security-test-report-simple.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\n📄 Report saved to: security-test-report-simple.json")

def main():
    """Main test runner"""
    print("🚀 Security Management System Component Test")
    print("="*50)
    
    # Add parent directory to path for imports
    sys.path.insert(0, '.')
    
    # Run tests
    test_backend_components()
    test_frontend_components()
    
    # Generate report
    generate_report()
    
    print("\n✅ Testing Complete!")
    
    # Return exit code based on failures
    if results['summary']['failed'] > 0:
        sys.exit(1)
    sys.exit(0)

if __name__ == "__main__":
    main()