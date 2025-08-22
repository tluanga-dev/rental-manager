"""
Authentication, Authorization & CORS Integration Testing Suite

This module contains integration tests that combine all three systems:
- End-to-end authentication flows with CORS
- Authorization enforcement across origins
- Real-world scenarios and edge cases
- Performance testing under load
"""

import pytest
import asyncio
import time
from typing import List, Dict, Any
from httpx import AsyncClient

from app.modules.users.models import User

from tests.conftest_auth_comprehensive import (
    AuthTestClient, assert_cors_headers_present,
    assert_authentication_required, assert_access_denied, assert_access_granted
)


class TestEndToEndAuthCORSFlow:
    """Test complete authentication flows with CORS validation."""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_complete_registration_login_flow_with_cors(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test complete user registration and login flow with CORS headers."""
        origin = cors_whitelist_origins[0]
        
        # Step 1: User Registration with CORS
        registration_data = {
            "username": "integrationuser",
            "email": "integration@test.com",
            "password": "Integration@123",
            "full_name": "Integration Test User"
        }
        
        # Test preflight for registration
        preflight_response = await regular_client.options(
            "/api/auth/register",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        assert preflight_response.status_code in [200, 204]
        assert_cors_headers_present(preflight_response, origin)
        
        # Actual registration
        register_response = await regular_client.post(
            "/api/auth/register",
            json=registration_data,
            headers={"Origin": origin}
        )
        assert register_response.status_code == 201
        assert_cors_headers_present(register_response, origin)
        
        # Step 2: User Login with CORS
        login_data = {
            "username": "integration@test.com",
            "password": "Integration@123"
        }
        
        # Test preflight for login
        preflight_response = await regular_client.options(
            "/api/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        assert preflight_response.status_code in [200, 204]
        assert_cors_headers_present(preflight_response, origin)
        
        # Actual login
        login_response = await regular_client.post(
            "/api/auth/login",
            json=login_data,
            headers={"Origin": origin}
        )
        assert login_response.status_code == 200
        assert_cors_headers_present(login_response, origin)
        
        login_data = login_response.json()
        access_token = login_data["access_token"]
        
        # Step 3: Access protected endpoint with CORS and auth
        profile_response = await regular_client.get(
            "/api/auth/me",
            headers={
                "Origin": origin,
                "Authorization": f"Bearer {access_token}"
            }
        )
        assert profile_response.status_code == 200
        assert_cors_headers_present(profile_response, origin)
        
        profile_data = profile_response.json()
        assert profile_data["email"] == "integration@test.com"
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_cross_origin_authentication_rejection(
        self,
        regular_client: AsyncClient,
        cors_blocked_origins: List[str],
        regular_user: User
    ):
        """Test that authentication works but CORS blocks non-whitelisted origins."""
        blocked_origin = cors_blocked_origins[0]
        
        # Login should work but without proper CORS headers
        login_data = {
            "username": regular_user.email,
            "password": "User@123"
        }
        
        login_response = await regular_client.post(
            "/api/auth/login",
            json=login_data,
            headers={"Origin": blocked_origin}
        )
        
        # Login might succeed (auth works) but CORS should not allow the origin
        if login_response.status_code == 200:
            # If login succeeds, CORS headers should not include the blocked origin
            cors_headers = login_response.headers
            if "access-control-allow-origin" in cors_headers:
                assert cors_headers["access-control-allow-origin"] != blocked_origin
        
        # Even if we have a valid token, accessing from blocked origin should not have CORS headers
        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            
            profile_response = await regular_client.get(
                "/api/auth/me",
                headers={
                    "Origin": blocked_origin,
                    "Authorization": f"Bearer {token}"
                }
            )
            
            # Request might succeed (auth works) but CORS should not allow the origin
            cors_headers = profile_response.headers
            if "access-control-allow-origin" in cors_headers:
                assert cors_headers["access-control-allow-origin"] != blocked_origin


class TestMultiOriginAuthentication:
    """Test authentication across multiple whitelisted origins."""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_same_user_multiple_origins(
        self,
        regular_user: User,
        cors_whitelist_origins: List[str]
    ):
        """Test same user authenticating from multiple allowed origins."""
        from app.main import app
        
        # Create multiple clients for different origins
        clients_and_origins = []
        
        for i, origin in enumerate(cors_whitelist_origins[:3]):  # Test first 3 origins
            async with AsyncClient(app=app, base_url="http://test") as client:
                auth_client = AuthTestClient(client)
                
                # Login from this origin
                login_data = {
                    "username": regular_user.email,
                    "password": "User@123"
                }
                
                response = await auth_client.client.post(
                    "/api/auth/login",
                    json=login_data,
                    headers={"Origin": origin}
                )
                
                assert response.status_code == 200
                assert_cors_headers_present(response, origin)
                
                token_data = response.json()
                auth_client.tokens = {
                    "access_token": token_data["access_token"],
                    "refresh_token": token_data["refresh_token"]
                }
                
                clients_and_origins.append((auth_client, origin))
        
        # All clients should be able to access user profile
        for auth_client, origin in clients_and_origins:
            response = await auth_client.client.get(
                "/api/auth/me",
                headers={
                    "Origin": origin,
                    "Authorization": f"Bearer {auth_client.tokens['access_token']}"
                }
            )
            
            assert response.status_code == 200
            assert_cors_headers_present(response, origin)
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_concurrent_multi_origin_requests(
        self,
        regular_user: User,
        cors_whitelist_origins: List[str]
    ):
        """Test concurrent requests from multiple origins."""
        from app.main import app
        
        async def make_request_from_origin(origin: str):
            """Make authenticated request from specific origin."""
            async with AsyncClient(app=app, base_url="http://test") as client:
                # Login
                login_response = await client.post(
                    "/api/auth/login",
                    json={"username": regular_user.email, "password": "User@123"},
                    headers={"Origin": origin}
                )
                
                if login_response.status_code != 200:
                    return {"origin": origin, "error": "Login failed", "status": login_response.status_code}
                
                token = login_response.json()["access_token"]
                
                # Access profile
                profile_response = await client.get(
                    "/api/auth/me",
                    headers={
                        "Origin": origin,
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                return {
                    "origin": origin,
                    "status": profile_response.status_code,
                    "has_cors": "access-control-allow-origin" in profile_response.headers,
                    "cors_origin": profile_response.headers.get("access-control-allow-origin")
                }
        
        # Create tasks for concurrent requests
        tasks = [
            make_request_from_origin(origin)
            for origin in cors_whitelist_origins[:5]  # Test first 5 origins
        ]
        
        results = await asyncio.gather(*tasks)
        
        # All requests should succeed with proper CORS headers
        for result in results:
            assert result["status"] == 200, f"Request from {result['origin']} failed"
            assert result["has_cors"], f"Missing CORS headers from {result['origin']}"
            assert result["cors_origin"] == result["origin"], f"Wrong CORS origin for {result['origin']}"


class TestAuthorizationWithCORS:
    """Test authorization levels work correctly with CORS."""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_admin_endpoints_cors_and_authorization(
        self,
        auth_client: AuthTestClient,
        regular_user: User,
        admin_user: User,
        cors_whitelist_origins: List[str]
    ):
        """Test that admin endpoints require both proper CORS and authorization."""
        origin = cors_whitelist_origins[0]
        admin_endpoint = "/api/users/"
        
        # Test 1: Regular user with valid CORS should get 403 (not 401)
        await auth_client.authenticate(regular_user.email, "User@123")
        
        response = await auth_client.client.get(
            admin_endpoint,
            headers={
                "Origin": origin,
                "Authorization": f"Bearer {auth_client.tokens['access_token']}"
            }
        )
        
        assert response.status_code == 403  # Authorized but not permitted
        assert_cors_headers_present(response, origin)
        
        # Test 2: Admin user with valid CORS should get access
        await auth_client.authenticate(admin_user.email, "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
        
        response = await auth_client.client.get(
            admin_endpoint,
            headers={
                "Origin": origin,
                "Authorization": f"Bearer {auth_client.tokens['access_token']}"
            }
        )
        
        # Should have access (200 or 404 if no data, but not 401/403)
        assert response.status_code not in [401, 403]
        assert_cors_headers_present(response, origin)
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_authorization_hierarchy_with_cors(
        self,
        regular_client: AsyncClient,
        regular_user: User,
        manager_user: User,
        admin_user: User,
        superadmin_user: User,
        cors_whitelist_origins: List[str]
    ):
        """Test authorization hierarchy works with CORS across user types."""
        origin = cors_whitelist_origins[0]
        
        # Test different endpoints with different authorization levels
        endpoints_and_levels = [
            ("/api/auth/me", ["user", "manager", "admin", "superadmin"]),
            ("/api/users/me", ["user", "manager", "admin", "superadmin"]),
            ("/api/master-data/brands/", ["manager", "admin", "superadmin"]),
            ("/api/users/", ["admin", "superadmin"]),
            ("/api/system/settings/", ["superadmin"]),
        ]
        
        users_by_level = {
            "user": (regular_user, "User@123"),
            "manager": (manager_user, "mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8"),
            "admin": (admin_user, "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"),
            "superadmin": (superadmin_user, "SuperK8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"),
        }
        
        for endpoint, allowed_levels in endpoints_and_levels:
            for level, (user, password) in users_by_level.items():
                # Login as this user type
                login_response = await regular_client.post(
                    "/api/auth/login",
                    json={"username": user.email, "password": password},
                    headers={"Origin": origin}
                )
                
                if login_response.status_code != 200:
                    continue  # Skip if login fails
                
                token = login_response.json()["access_token"]
                
                # Try to access the endpoint
                response = await regular_client.get(
                    endpoint,
                    headers={
                        "Origin": origin,
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                # Check authorization
                if level in allowed_levels:
                    assert response.status_code not in [401, 403], f"{level} should access {endpoint}"
                else:
                    assert response.status_code == 403, f"{level} should not access {endpoint}"
                
                # All responses should have CORS headers
                assert_cors_headers_present(response, origin)


class TestRateLimitingWithAuthAndCORS:
    """Test rate limiting integration with authentication and CORS."""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.slow
    async def test_rate_limiting_preserves_cors_and_auth_headers(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test that rate limiting responses include proper CORS and auth headers."""
        origin = cors_whitelist_origins[0]
        
        # Make many rapid requests to trigger rate limiting
        tasks = []
        for i in range(15):  # Exceed typical rate limit
            task = regular_client.post(
                "/api/auth/login",
                json={"username": "nonexistent", "password": "wrong"},
                headers={"Origin": origin}
            )
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        rate_limited_responses = []
        for response in responses:
            if hasattr(response, 'status_code'):
                if response.status_code == 429:  # Rate limited
                    rate_limited_responses.append(response)
                
                # All responses should have CORS headers
                assert_cors_headers_present(response, origin)
        
        if rate_limited_responses:
            print(f"Found {len(rate_limited_responses)} rate-limited responses")
            # Rate-limited responses should still have proper headers
            for response in rate_limited_responses:
                assert_cors_headers_present(response, origin)
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.slow
    async def test_authenticated_rate_limiting_with_cors(
        self,
        auth_client: AuthTestClient,
        regular_user: User,
        cors_whitelist_origins: List[str]
    ):
        """Test rate limiting on authenticated endpoints with CORS."""
        origin = cors_whitelist_origins[0]
        
        # Login first
        await auth_client.authenticate(regular_user.email, "User@123")
        
        # Make many rapid requests to an authenticated endpoint
        tasks = []
        for i in range(10):
            task = auth_client.client.get(
                "/api/auth/me",
                headers={
                    "Origin": origin,
                    "Authorization": f"Bearer {auth_client.tokens['access_token']}"
                }
            )
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # All responses should have CORS headers regardless of rate limiting
        for response in responses:
            if hasattr(response, 'status_code'):
                assert_cors_headers_present(response, origin)
                
                if response.status_code == 429:
                    print(f"Authenticated endpoint rate limited: {response.status_code}")


class TestSecurityIntegration:
    """Test security features integration across auth, authz, and CORS."""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_token_tampering_with_cors(
        self,
        regular_client: AsyncClient,
        user_tokens: Dict[str, str],
        cors_whitelist_origins: List[str]
    ):
        """Test that tampered tokens are rejected even with valid CORS."""
        origin = cors_whitelist_origins[0]
        
        # Tamper with token
        valid_token = user_tokens["access_token"]
        tampered_token = valid_token[:-5] + "XXXXX"  # Change last 5 characters
        
        response = await regular_client.get(
            "/api/auth/me",
            headers={
                "Origin": origin,
                "Authorization": f"Bearer {tampered_token}"
            }
        )
        
        # Should reject tampered token
        assert response.status_code == 401
        # But should still have CORS headers for valid origin
        assert_cors_headers_present(response, origin)
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_expired_token_with_cors(
        self,
        regular_client: AsyncClient,
        expired_tokens: Dict[str, str],
        cors_whitelist_origins: List[str]
    ):
        """Test that expired tokens are rejected with proper CORS headers."""
        origin = cors_whitelist_origins[0]
        
        response = await regular_client.get(
            "/api/auth/me",
            headers={
                "Origin": origin,
                "Authorization": f"Bearer {expired_tokens['access_token']}"
            }
        )
        
        # Should reject expired token
        assert response.status_code == 401
        # But should still have CORS headers
        assert_cors_headers_present(response, origin)
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_cors_origin_spoofing_with_valid_auth(
        self,
        auth_client: AuthTestClient,
        regular_user: User
    ):
        """Test that origin spoofing is blocked even with valid authentication."""
        # Login with valid origin
        await auth_client.authenticate(regular_user.email, "User@123")
        
        # Try to use token with spoofed origin
        spoofed_origin = "http://evil.com"
        
        response = await auth_client.client.get(
            "/api/auth/me",
            headers={
                "Origin": spoofed_origin,
                "Authorization": f"Bearer {auth_client.tokens['access_token']}"
            }
        )
        
        # Even with valid auth, spoofed origin should not get CORS headers
        cors_headers = response.headers
        if "access-control-allow-origin" in cors_headers:
            assert cors_headers["access-control-allow-origin"] != spoofed_origin


class TestPerformanceIntegration:
    """Test performance of integrated auth, authz, and CORS systems."""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.slow
    async def test_concurrent_authentication_with_cors(
        self,
        cors_whitelist_origins: List[str]
    ):
        """Test concurrent authentication performance with CORS."""
        from app.main import app
        
        async def authenticate_user(user_num: int, origin: str):
            """Authenticate a test user."""
            async with AsyncClient(app=app, base_url="http://test") as client:
                start_time = time.time()
                
                # Register user
                register_response = await client.post(
                    "/api/auth/register",
                    json={
                        "username": f"perfuser{user_num}",
                        "email": f"perfuser{user_num}@test.com",
                        "password": "PerfTest@123",
                        "full_name": f"Performance Test User {user_num}"
                    },
                    headers={"Origin": origin}
                )
                
                if register_response.status_code != 201:
                    return {"error": "Registration failed", "user": user_num}
                
                # Login user
                login_response = await client.post(
                    "/api/auth/login",
                    json={
                        "username": f"perfuser{user_num}@test.com",
                        "password": "PerfTest@123"
                    },
                    headers={"Origin": origin}
                )
                
                end_time = time.time()
                duration = end_time - start_time
                
                return {
                    "user": user_num,
                    "status": login_response.status_code,
                    "duration": duration,
                    "has_cors": "access-control-allow-origin" in login_response.headers
                }
        
        # Test concurrent authentications
        num_users = 10
        origin = cors_whitelist_origins[0]
        
        tasks = [
            authenticate_user(i, origin)
            for i in range(num_users)
        ]
        
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time
        
        # Analyze results
        successful_auths = [r for r in results if isinstance(r, dict) and r.get("status") == 200]
        failed_auths = [r for r in results if isinstance(r, dict) and r.get("status") != 200]
        
        print(f"Concurrent authentication test:")
        print(f"  Total time: {total_time:.2f}s")
        print(f"  Successful: {len(successful_auths)}/{num_users}")
        print(f"  Failed: {len(failed_auths)}")
        
        if successful_auths:
            avg_duration = sum(r["duration"] for r in successful_auths) / len(successful_auths)
            print(f"  Average duration: {avg_duration:.3f}s")
            
            # All successful responses should have CORS headers
            for result in successful_auths:
                assert result["has_cors"], f"Missing CORS headers for user {result['user']}"
        
        # At least 80% should succeed in reasonable time
        success_rate = len(successful_auths) / num_users
        assert success_rate >= 0.8, f"Success rate too low: {success_rate:.2%}"
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_auth_cors_response_time_benchmark(
        self,
        auth_client: AuthTestClient,
        regular_user: User,
        cors_whitelist_origins: List[str]
    ):
        """Benchmark response times for auth+CORS requests."""
        origin = cors_whitelist_origins[0]
        
        # Login
        await auth_client.authenticate(regular_user.email, "User@123")
        
        # Benchmark different endpoint types
        endpoints = [
            "/api/auth/me",
            "/api/users/me", 
            "/api/master-data/brands/",
            "/health"
        ]
        
        results = {}
        
        for endpoint in endpoints:
            times = []
            
            # Make multiple requests to get average
            for _ in range(10):
                start_time = time.time()
                
                if endpoint == "/health":
                    response = await auth_client.client.get(
                        endpoint,
                        headers={"Origin": origin}
                    )
                else:
                    response = await auth_client.client.get(
                        endpoint,
                        headers={
                            "Origin": origin,
                            "Authorization": f"Bearer {auth_client.tokens['access_token']}"
                        }
                    )
                
                end_time = time.time()
                duration = (end_time - start_time) * 1000  # Convert to ms
                times.append(duration)
                
                # Verify CORS headers are present
                assert_cors_headers_present(response, origin)
            
            avg_time = sum(times) / len(times)
            min_time = min(times)
            max_time = max(times)
            
            results[endpoint] = {
                "avg_ms": avg_time,
                "min_ms": min_time,
                "max_ms": max_time
            }
        
        # Print benchmark results
        print("\\nAuth+CORS Response Time Benchmark:")
        for endpoint, metrics in results.items():
            print(f"  {endpoint}:")
            print(f"    Average: {metrics['avg_ms']:.1f}ms")
            print(f"    Min: {metrics['min_ms']:.1f}ms")
            print(f"    Max: {metrics['max_ms']:.1f}ms")
        
        # Assert reasonable performance (adjust thresholds as needed)
        for endpoint, metrics in results.items():
            assert metrics["avg_ms"] < 1000, f"{endpoint} too slow: {metrics['avg_ms']:.1f}ms"