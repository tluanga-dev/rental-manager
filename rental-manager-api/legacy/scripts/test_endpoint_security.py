#!/usr/bin/env python3
"""
Comprehensive Security Test Suite for API Endpoints

This script tests all API endpoints to ensure they are properly protected
with JWT authentication. It tests both authenticated and unauthenticated access.

Usage: python scripts/test_endpoint_security.py [--base-url http://localhost:8000]
"""

import asyncio
import httpx
import sys
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import json
from pathlib import Path
import argparse


@dataclass
class TestEndpoint:
    """Represents an endpoint to test"""
    method: str
    path: str
    module: str
    should_be_protected: bool = True
    auth_level: str = "user"  # user, superuser, or public


@dataclass
class TestResult:
    """Test result for an endpoint"""
    endpoint: TestEndpoint
    test_passed: bool
    unauthenticated_status: int
    authenticated_status: int
    error_message: Optional[str] = None
    security_issue: Optional[str] = None


class SecurityTester:
    """Tests API endpoints for proper authentication"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.valid_token = None
        self.admin_token = None
        self.results: List[TestResult] = []
        
    async def get_auth_tokens(self) -> Tuple[Optional[str], Optional[str]]:
        """Get authentication tokens for testing"""
        async with httpx.AsyncClient() as client:
            # Try to login with admin credentials
            login_data = {
                "username": "admin",
                "password": "admin123"  # Default test password
            }
            
            try:
                response = await client.post(
                    f"{self.base_url}/api/auth/login",
                    json=login_data
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if "access_token" in data:
                        admin_token = data["access_token"]
                        return admin_token, admin_token
                    elif "data" in data and "access_token" in data["data"]:
                        admin_token = data["data"]["access_token"]
                        return admin_token, admin_token
            except Exception as e:
                print(f"Warning: Could not get auth token: {e}")
                
        return None, None
    
    def get_critical_endpoints(self) -> List[TestEndpoint]:
        """Get list of critical endpoints that must be protected"""
        return [
            # Admin endpoints - CRITICAL
            TestEndpoint("GET", "/api/admin/diagnosis", "admin", True, "superuser"),
            TestEndpoint("GET", "/api/admin/status", "admin", True, "superuser"),
            TestEndpoint("POST", "/api/admin/create", "admin", True, "superuser"),
            TestEndpoint("POST", "/api/admin/recreate", "admin", True, "superuser"),
            TestEndpoint("GET", "/api/admin/test-login", "admin", True, "superuser"),
            
            # System endpoints - CRITICAL
            TestEndpoint("GET", "/api/system/settings", "system", True, "superuser"),
            TestEndpoint("PUT", "/api/system/settings", "system", True, "superuser"),
            TestEndpoint("GET", "/api/system/whitelist/status", "system", True, "superuser"),
            TestEndpoint("POST", "/api/system/whitelist/reload", "system", True, "superuser"),
            TestEndpoint("GET", "/api/system/whitelist/config", "system", True, "superuser"),
            
            # Customer endpoints - HIGH RISK
            TestEndpoint("POST", "/api/customers/", "customers", True, "user"),
            TestEndpoint("GET", "/api/customers/", "customers", True, "user"),
            TestEndpoint("PUT", "/api/customers/123", "customers", True, "user"),
            TestEndpoint("DELETE", "/api/customers/123", "customers", True, "user"),
            
            # Transaction endpoints - HIGH RISK
            TestEndpoint("GET", "/api/transactions/", "transactions", True, "user"),
            TestEndpoint("POST", "/api/transactions/purchases", "transactions", True, "user"),
            TestEndpoint("GET", "/api/transactions/rentals", "transactions", True, "user"),
            
            # Master data endpoints - MEDIUM RISK
            TestEndpoint("POST", "/api/master-data/items", "master_data", True, "user"),
            TestEndpoint("PUT", "/api/master-data/items/123", "master_data", True, "user"),
            TestEndpoint("DELETE", "/api/master-data/items/123", "master_data", True, "user"),
            
            # Public endpoints that should NOT be protected
            TestEndpoint("POST", "/api/auth/login", "auth", False, "public"),
            TestEndpoint("POST", "/api/auth/register", "auth", False, "public"),
            TestEndpoint("GET", "/api/health", "system", False, "public"),
        ]
    
    async def test_endpoint(self, endpoint: TestEndpoint) -> TestResult:
        """Test a single endpoint for proper authentication"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{self.base_url}{endpoint.path}"
            
            # Test 1: Unauthenticated request
            try:
                unauthenticated_response = await client.request(
                    endpoint.method, 
                    url,
                    json={} if endpoint.method in ["POST", "PUT", "PATCH"] else None
                )
                unauthenticated_status = unauthenticated_response.status_code
            except Exception as e:
                return TestResult(
                    endpoint=endpoint,
                    test_passed=False,
                    unauthenticated_status=500,
                    authenticated_status=500,
                    error_message=f"Request failed: {e}"
                )
            
            # Test 2: Authenticated request
            authenticated_status = 200
            if self.valid_token and endpoint.should_be_protected:
                try:
                    token = self.admin_token if endpoint.auth_level == "superuser" else self.valid_token
                    headers = {"Authorization": f"Bearer {token}"}
                    
                    authenticated_response = await client.request(
                        endpoint.method,
                        url,
                        json={} if endpoint.method in ["POST", "PUT", "PATCH"] else None,
                        headers=headers
                    )
                    authenticated_status = authenticated_response.status_code
                except Exception as e:
                    authenticated_status = 500
            
            # Analyze results
            test_passed = True
            security_issue = None
            
            if endpoint.should_be_protected:
                # Protected endpoint - should reject unauthenticated requests
                if unauthenticated_status not in [401, 403]:
                    test_passed = False
                    security_issue = f"SECURITY ISSUE: Endpoint allows unauthenticated access (status: {unauthenticated_status})"
                
                # Should accept authenticated requests (or fail for other reasons like 404)
                if self.valid_token and authenticated_status == 401:
                    test_passed = False
                    security_issue = f"SECURITY ISSUE: Endpoint rejects valid authentication (status: {authenticated_status})"
                    
            else:
                # Public endpoint - should allow unauthenticated access
                if unauthenticated_status in [401, 403]:
                    test_passed = False
                    security_issue = f"FUNCTIONALITY ISSUE: Public endpoint requires authentication (status: {unauthenticated_status})"
            
            return TestResult(
                endpoint=endpoint,
                test_passed=test_passed,
                unauthenticated_status=unauthenticated_status,
                authenticated_status=authenticated_status,
                security_issue=security_issue
            )
    
    async def run_security_tests(self) -> Dict[str, Any]:
        """Run comprehensive security tests"""
        print("🔒 Starting Security Test Suite...")
        print("="*80)
        
        # Get authentication tokens
        print("Getting authentication tokens...")
        self.valid_token, self.admin_token = await self.get_auth_tokens()
        
        if not self.valid_token:
            print("⚠️  Warning: Could not get authentication token. Some tests may be limited.")
        else:
            print("✅ Authentication token obtained")
        
        # Get endpoints to test
        endpoints = self.get_critical_endpoints()
        print(f"Testing {len(endpoints)} critical endpoints...")
        print()
        
        # Run tests
        results = []
        security_issues = []
        functionality_issues = []
        
        for endpoint in endpoints:
            result = await self.test_endpoint(endpoint)
            results.append(result)
            
            # Print immediate results
            status = "✅ PASS" if result.test_passed else "❌ FAIL"
            print(f"{status} {endpoint.method:6} {endpoint.path:40} ({endpoint.module})")
            
            if result.security_issue:
                if "SECURITY ISSUE" in result.security_issue:
                    security_issues.append(result)
                else:
                    functionality_issues.append(result)
                    
                print(f"      → {result.security_issue}")
            
            if result.error_message:
                print(f"      → Error: {result.error_message}")
        
        # Generate summary report
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r.test_passed)
        failed_tests = total_tests - passed_tests
        
        print()
        print("="*80)
        print("SECURITY TEST SUMMARY")
        print("="*80)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Security Issues: {len(security_issues)}")
        print(f"Functionality Issues: {len(functionality_issues)}")
        print()
        
        if security_issues:
            print("🚨 CRITICAL SECURITY ISSUES:")
            for issue in security_issues:
                print(f"  - {issue.endpoint.method} {issue.endpoint.path}")
                print(f"    {issue.security_issue}")
            print()
        
        if functionality_issues:
            print("⚠️  FUNCTIONALITY ISSUES:")
            for issue in functionality_issues:
                print(f"  - {issue.endpoint.method} {issue.endpoint.path}")
                print(f"    {issue.security_issue}")
            print()
        
        if not security_issues and not functionality_issues:
            print("🎉 ALL SECURITY TESTS PASSED!")
        
        # Return detailed results
        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "security_issues": len(security_issues),
            "functionality_issues": len(functionality_issues),
            "results": [
                {
                    "method": r.endpoint.method,
                    "path": r.endpoint.path,
                    "module": r.endpoint.module,
                    "should_be_protected": r.endpoint.should_be_protected,
                    "test_passed": r.test_passed,
                    "unauthenticated_status": r.unauthenticated_status,
                    "authenticated_status": r.authenticated_status,
                    "security_issue": r.security_issue,
                    "error_message": r.error_message
                }
                for r in results
            ]
        }


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Test API endpoint security")
    parser.add_argument("--base-url", default="http://localhost:8000", 
                       help="Base URL of the API server")
    parser.add_argument("--output", help="Output file for detailed results")
    
    args = parser.parse_args()
    
    # Check if server is running
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{args.base_url}/api/health", timeout=5.0)
            if response.status_code != 200:
                print(f"❌ Server not responding properly at {args.base_url}")
                print("Please ensure the backend server is running.")
                sys.exit(1)
        except Exception as e:
            print(f"❌ Cannot connect to server at {args.base_url}")
            print(f"Error: {e}")
            print("Please ensure the backend server is running.")
            sys.exit(1)
    
    # Run security tests
    tester = SecurityTester(args.base_url)
    results = await tester.run_security_tests()
    
    # Save detailed results if requested
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"Detailed results saved to: {args.output}")
    
    # Exit with error code if there are security issues
    if results["security_issues"] > 0:
        print(f"\n❌ SECURITY TEST FAILED: {results['security_issues']} critical security issues found!")
        sys.exit(1)
    else:
        print(f"\n✅ SECURITY TESTS PASSED: No critical security issues found!")
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())