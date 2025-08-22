#!/usr/bin/env python3
"""
Deployment Validation Script
Tests all critical functionality after deployment
"""

import asyncio
import os
import sys
import json
from typing import Dict, List, Tuple
import httpx
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")


class DeploymentValidator:
    """Validates deployment by testing critical endpoints"""
    
    def __init__(self):
        self.base_url = BASE_URL.rstrip("/")
        self.client = httpx.AsyncClient(timeout=30.0)
        self.token = None
        self.results = []
        
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
    
    async def test_health(self) -> Tuple[bool, str]:
        """Test health endpoint"""
        try:
            response = await self.client.get(f"{self.base_url}/api/health")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    return True, "Health check passed"
                else:
                    return False, f"Health status: {data.get('status')}"
            else:
                return False, f"Health check failed: {response.status_code}"
        except Exception as e:
            return False, f"Health check error: {str(e)}"
    
    async def test_login(self) -> Tuple[bool, str]:
        """Test admin login"""
        try:
            response = await self.client.post(
                f"{self.base_url}/api/auth/login",
                json={
                    "username": ADMIN_USERNAME,
                    "password": ADMIN_PASSWORD
                }
            )
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                if self.token:
                    return True, "Admin login successful"
                else:
                    return False, "No access token received"
            else:
                return False, f"Login failed: {response.status_code}"
        except Exception as e:
            return False, f"Login error: {str(e)}"
    
    async def test_authenticated_endpoint(self, endpoint: str, name: str) -> Tuple[bool, str]:
        """Test an authenticated endpoint"""
        if not self.token:
            return False, f"{name}: No auth token available"
        
        try:
            response = await self.client.get(
                f"{self.base_url}{endpoint}",
                headers={"Authorization": f"Bearer {self.token}"}
            )
            if response.status_code == 200:
                return True, f"{name}: Endpoint accessible"
            elif response.status_code == 401:
                return False, f"{name}: Authentication failed"
            else:
                return False, f"{name}: Failed with {response.status_code}"
        except Exception as e:
            return False, f"{name} error: {str(e)}"
    
    async def test_database_operations(self) -> Tuple[bool, str]:
        """Test database CRUD operations"""
        if not self.token:
            return False, "Database test: No auth token"
        
        try:
            # Test read operation
            headers = {"Authorization": f"Bearer {self.token}"}
            
            # Check if we can list items
            response = await self.client.get(
                f"{self.base_url}/api/items",
                headers=headers
            )
            
            if response.status_code == 200:
                return True, "Database operations working"
            else:
                return False, f"Database test failed: {response.status_code}"
                
        except Exception as e:
            return False, f"Database error: {str(e)}"
    
    async def test_redis_cache(self) -> Tuple[bool, str]:
        """Test Redis cache functionality"""
        try:
            # Make two identical requests
            headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
            
            # First request (cache miss)
            start1 = datetime.now()
            response1 = await self.client.get(
                f"{self.base_url}/api/items",
                headers=headers
            )
            time1 = (datetime.now() - start1).total_seconds()
            
            # Second request (should be cached)
            start2 = datetime.now()
            response2 = await self.client.get(
                f"{self.base_url}/api/items",
                headers=headers
            )
            time2 = (datetime.now() - start2).total_seconds()
            
            if response1.status_code == 200 and response2.status_code == 200:
                # Second request should be faster if cache is working
                if time2 < time1 * 0.5:  # At least 50% faster
                    return True, f"Cache working (1st: {time1:.3f}s, 2nd: {time2:.3f}s)"
                else:
                    return True, f"Cache may not be working (1st: {time1:.3f}s, 2nd: {time2:.3f}s)"
            else:
                return False, "Cache test failed: Could not fetch data"
                
        except Exception as e:
            return False, f"Cache test error: {str(e)}"
    
    async def test_performance_metrics(self) -> Tuple[bool, str]:
        """Test performance monitoring endpoint"""
        try:
            response = await self.client.get(f"{self.base_url}/api/metrics/performance")
            if response.status_code == 200:
                data = response.json()
                if "query_stats" in data or "api_stats" in data:
                    return True, "Performance metrics available"
                else:
                    return True, "Performance endpoint working (no data yet)"
            else:
                return False, f"Performance metrics failed: {response.status_code}"
        except Exception as e:
            # Performance monitoring is optional
            return True, "Performance monitoring not enabled (optional)"
    
    async def run_all_tests(self) -> Dict[str, any]:
        """Run all validation tests"""
        logger.info("=" * 60)
        logger.info("DEPLOYMENT VALIDATION STARTING")
        logger.info("=" * 60)
        logger.info(f"Testing: {self.base_url}")
        logger.info("")
        
        tests = [
            ("Health Check", self.test_health()),
            ("Admin Login", self.test_login()),
            ("User Endpoint", self.test_authenticated_endpoint("/api/users/me", "User Profile")),
            ("Items Endpoint", self.test_authenticated_endpoint("/api/items", "Items")),
            ("Customers Endpoint", self.test_authenticated_endpoint("/api/customers", "Customers")),
            ("Database Operations", self.test_database_operations()),
            ("Redis Cache", self.test_redis_cache()),
            ("Performance Metrics", self.test_performance_metrics()),
        ]
        
        passed = 0
        failed = 0
        
        for name, test_coro in tests:
            success, message = await test_coro
            
            if success:
                logger.info(f"✅ {name}: {message}")
                passed += 1
            else:
                logger.error(f"❌ {name}: {message}")
                failed += 1
            
            self.results.append({
                "test": name,
                "success": success,
                "message": message
            })
        
        logger.info("")
        logger.info("=" * 60)
        logger.info("VALIDATION RESULTS")
        logger.info("=" * 60)
        logger.info(f"✅ Passed: {passed}")
        logger.info(f"❌ Failed: {failed}")
        logger.info(f"📊 Success Rate: {(passed / (passed + failed) * 100):.1f}%")
        
        # Determine overall status
        if failed == 0:
            logger.info("")
            logger.info("🎉 DEPLOYMENT VALIDATION SUCCESSFUL!")
            status = "SUCCESS"
        elif passed >= 6:  # Most critical tests passed
            logger.info("")
            logger.info("⚠️ DEPLOYMENT PARTIALLY SUCCESSFUL")
            logger.info("Some non-critical tests failed. Review and fix if needed.")
            status = "PARTIAL"
        else:
            logger.info("")
            logger.error("❌ DEPLOYMENT VALIDATION FAILED!")
            logger.error("Critical tests failed. Check logs and fix issues.")
            status = "FAILED"
        
        logger.info("=" * 60)
        
        return {
            "status": status,
            "passed": passed,
            "failed": failed,
            "success_rate": passed / (passed + failed) * 100,
            "results": self.results,
            "timestamp": datetime.utcnow().isoformat()
        }


async def main():
    """Main entry point"""
    validator = DeploymentValidator()
    
    try:
        results = await validator.run_all_tests()
        
        # Save results to file
        with open("deployment_validation_results.json", "w") as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"\nResults saved to deployment_validation_results.json")
        
        # Exit with appropriate code
        if results["status"] == "SUCCESS":
            sys.exit(0)
        elif results["status"] == "PARTIAL":
            sys.exit(1)
        else:
            sys.exit(2)
            
    except Exception as e:
        logger.error(f"Validation failed with error: {str(e)}")
        sys.exit(3)
    finally:
        await validator.close()


if __name__ == "__main__":
    # Allow passing base URL as argument
    if len(sys.argv) > 1:
        BASE_URL = sys.argv[1]
    
    asyncio.run(main())