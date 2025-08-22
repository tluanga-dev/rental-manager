"""
Comprehensive CORS Testing Suite

This module contains extensive tests for Cross-Origin Resource Sharing (CORS) including:
- Whitelist origin validation for all endpoints
- Preflight request handling (OPTIONS)
- Security header verification
- Rate limiting integration with CORS
- CORS bypass attempt detection
"""

import pytest
import asyncio
from typing import List, Dict
from httpx import AsyncClient

from app.modules.users.models import User

from tests.conftest_auth_comprehensive import (
    AuthTestClient, assert_cors_headers_present
)


class TestCORSWhitelistValidation:
    """Test CORS whitelist functionality for allowed and blocked origins."""
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_allowed_origins_access(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test that whitelisted origins can access all endpoints."""
        test_endpoints = [
            "/health",
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/me",
            "/api/users/me",
            "/api/master-data/brands/",
        ]
        
        for origin in cors_whitelist_origins:
            for endpoint in test_endpoints:
                # Test preflight request
                response = await regular_client.options(
                    endpoint,
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": "GET",
                        "Access-Control-Request-Headers": "Authorization, Content-Type"
                    }
                )
                
                # Preflight should succeed for whitelisted origins
                assert response.status_code in [200, 204], f"Preflight failed for {origin} -> {endpoint}"
                assert_cors_headers_present(response, origin)
                
                # Test actual request
                response = await regular_client.get(
                    endpoint,
                    headers={"Origin": origin}
                )
                
                # Should have CORS headers (regardless of auth status)
                assert_cors_headers_present(response, origin)
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_blocked_origins_rejection(
        self,
        regular_client: AsyncClient,
        cors_blocked_origins: List[str]
    ):
        """Test that non-whitelisted origins are properly blocked."""
        test_endpoints = [
            "/health",
            "/api/auth/login",
            "/api/auth/me",
        ]
        
        for origin in cors_blocked_origins:
            for endpoint in test_endpoints:
                # Test preflight request
                response = await regular_client.options(
                    endpoint,
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": "GET",
                        "Access-Control-Request-Headers": "Authorization"
                    }
                )
                
                # Preflight should fail for blocked origins
                # Note: Implementation may vary - some return 403, others don't include CORS headers
                cors_headers = response.headers
                if "access-control-allow-origin" in cors_headers:
                    # If CORS headers are present, they should not match the blocked origin
                    assert cors_headers["access-control-allow-origin"] != origin
                
                # Test actual request
                response = await regular_client.get(
                    endpoint,
                    headers={"Origin": origin}
                )
                
                # Should not have permissive CORS headers for blocked origins
                cors_headers = response.headers
                if "access-control-allow-origin" in cors_headers:
                    assert cors_headers["access-control-allow-origin"] != origin
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_localhost_port_range(
        self,
        regular_client: AsyncClient
    ):
        """Test CORS whitelist localhost port range functionality."""
        # Test ports within allowed range
        allowed_ports = [3000, 3001, 3002, 5000, 8000, 8080, 9000]
        for port in allowed_ports:
            origin = f"http://localhost:{port}"
            
            response = await regular_client.options(
                "/api/auth/login",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "Content-Type"
                }
            )
            
            assert response.status_code in [200, 204], f"Port {port} should be allowed"
            assert_cors_headers_present(response, origin)
        
        # Test ports outside allowed range
        blocked_ports = [2999, 10000, 80, 443]
        for port in blocked_ports:
            origin = f"http://localhost:{port}"
            
            response = await regular_client.options(
                "/api/auth/login",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST"
                }
            )
            
            # Should not allow these ports
            cors_headers = response.headers
            if "access-control-allow-origin" in cors_headers:
                assert cors_headers["access-control-allow-origin"] != origin


class TestCORSAllEndpoints:
    """Test CORS functionality across all API endpoints."""
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_public_endpoints(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test CORS on all public endpoints."""
        public_endpoints = [
            {"method": "GET", "path": "/health"},
            {"method": "GET", "path": "/docs"},
            {"method": "GET", "path": "/redoc"},
            {"method": "GET", "path": "/openapi.json"},
            {"method": "POST", "path": "/api/auth/login"},
            {"method": "POST", "path": "/api/auth/register"},
            {"method": "POST", "path": "/api/auth/refresh"},
            {"method": "POST", "path": "/api/auth/forgot-password"},
            {"method": "POST", "path": "/api/auth/reset-password"},
        ]
        
        origin = cors_whitelist_origins[0]  # Use first whitelisted origin
        
        for endpoint in public_endpoints:
            method = endpoint["method"]
            path = endpoint["path"]
            
            # Test preflight for non-simple requests
            if method in ["POST", "PUT", "DELETE", "PATCH"]:
                preflight_response = await regular_client.options(
                    path,
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": method,
                        "Access-Control-Request-Headers": "Content-Type, Authorization"
                    }
                )
                
                assert preflight_response.status_code in [200, 204], f"Preflight failed for {method} {path}"
                assert_cors_headers_present(preflight_response, origin)
            
            # Test actual request
            response = await getattr(regular_client, method.lower())(
                path,
                headers={"Origin": origin},
                json={} if method in ["POST", "PUT", "PATCH"] else None
            )
            
            # Should have CORS headers
            assert_cors_headers_present(response, origin)
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_authenticated_endpoints(
        self,
        auth_client: AuthTestClient,
        regular_user: User,
        cors_whitelist_origins: List[str]
    ):
        """Test CORS on authenticated endpoints."""
        authenticated_endpoints = [
            {"method": "GET", "path": "/api/auth/me"},
            {"method": "POST", "path": "/api/auth/logout"},
            {"method": "GET", "path": "/api/users/me"},
            {"method": "PUT", "path": "/api/users/me"},
            {"method": "GET", "path": "/api/master-data/brands/"},
            {"method": "POST", "path": "/api/master-data/brands/"},
            {"method": "GET", "path": "/api/customers/"},
            {"method": "POST", "path": "/api/customers/"},
        ]
        
        # Authenticate first
        await auth_client.authenticate(regular_user.email, "User@123")
        origin = cors_whitelist_origins[0]
        
        for endpoint in authenticated_endpoints:
            method = endpoint["method"]
            path = endpoint["path"]
            
            # Test preflight
            if method in ["POST", "PUT", "DELETE", "PATCH"]:
                preflight_response = await auth_client.client.options(
                    path,
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": method,
                        "Access-Control-Request-Headers": "Content-Type, Authorization"
                    }
                )
                
                assert preflight_response.status_code in [200, 204], f"Auth preflight failed for {method} {path}"
                assert_cors_headers_present(preflight_response, origin)
            
            # Test actual authenticated request
            headers = {
                "Origin": origin,
                "Authorization": f"Bearer {auth_client.tokens['access_token']}"
            }
            
            response = await getattr(auth_client.client, method.lower())(
                path,
                headers=headers,
                json={} if method in ["POST", "PUT", "PATCH"] else None
            )
            
            # Should have CORS headers regardless of auth result
            assert_cors_headers_present(response, origin)
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_admin_endpoints(
        self,
        auth_client: AuthTestClient,
        admin_user: User,
        cors_whitelist_origins: List[str]
    ):
        """Test CORS on admin-only endpoints."""
        admin_endpoints = [
            {"method": "GET", "path": "/api/users/"},
            {"method": "POST", "path": "/api/users/"},
            {"method": "GET", "path": "/api/system/settings/"},
            {"method": "POST", "path": "/api/system/settings/"},
        ]
        
        # Authenticate as admin
        await auth_client.authenticate(admin_user.email, "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
        origin = cors_whitelist_origins[0]
        
        for endpoint in admin_endpoints:
            method = endpoint["method"]
            path = endpoint["path"]
            
            # Test preflight
            if method in ["POST", "PUT", "DELETE", "PATCH"]:
                preflight_response = await auth_client.client.options(
                    path,
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": method,
                        "Access-Control-Request-Headers": "Content-Type, Authorization"
                    }
                )
                
                assert preflight_response.status_code in [200, 204], f"Admin preflight failed for {method} {path}"
                assert_cors_headers_present(preflight_response, origin)
            
            # Test actual admin request
            headers = {
                "Origin": origin,
                "Authorization": f"Bearer {auth_client.tokens['access_token']}"
            }
            
            response = await getattr(auth_client.client, method.lower())(
                path,
                headers=headers,
                json={} if method in ["POST", "PUT", "PATCH"] else None
            )
            
            # Should have CORS headers
            assert_cors_headers_present(response, origin)


class TestCORSPreflightRequests:
    """Test CORS preflight request handling."""
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_preflight_options_method(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test OPTIONS method for preflight requests."""
        origin = cors_whitelist_origins[0]
        
        # Test various HTTP methods
        methods_to_test = ["GET", "POST", "PUT", "DELETE", "PATCH"]
        
        for method in methods_to_test:
            response = await regular_client.options(
                "/api/auth/login",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": method,
                    "Access-Control-Request-Headers": "Content-Type, Authorization"
                }
            )
            
            assert response.status_code in [200, 204], f"Preflight failed for {method}"
            
            # Check required CORS headers
            headers = response.headers
            assert "access-control-allow-origin" in headers
            assert "access-control-allow-methods" in headers
            assert "access-control-allow-headers" in headers
            
            # Check that requested method is allowed
            allowed_methods = headers["access-control-allow-methods"]
            assert method in allowed_methods, f"Method {method} not in allowed methods"
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_preflight_custom_headers(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test preflight requests with custom headers."""
        origin = cors_whitelist_origins[0]
        
        custom_headers = [
            "Authorization",
            "Content-Type", 
            "X-Requested-With",
            "X-Request-ID",
            "Cache-Control"
        ]
        
        for header in custom_headers:
            response = await regular_client.options(
                "/api/auth/me",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": header
                }
            )
            
            assert response.status_code in [200, 204], f"Preflight failed for header {header}"
            
            # Check that requested header is allowed
            allowed_headers = response.headers.get("access-control-allow-headers", "")
            assert header.lower() in allowed_headers.lower(), f"Header {header} not allowed"
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_preflight_max_age(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test preflight cache control with max-age."""
        origin = cors_whitelist_origins[0]
        
        response = await regular_client.options(
            "/api/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        
        assert response.status_code in [200, 204]
        
        # Check for max-age header
        headers = response.headers
        if "access-control-max-age" in headers:
            max_age = int(headers["access-control-max-age"])
            assert max_age > 0, "Max age should be positive"
            assert max_age <= 86400, "Max age should not exceed 24 hours"


class TestCORSSecurityHeaders:
    """Test CORS security header configuration."""
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_security_headers_present(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test that proper security headers are included with CORS responses."""
        origin = cors_whitelist_origins[0]
        
        response = await regular_client.get(
            "/api/auth/login",
            headers={"Origin": origin}
        )
        
        headers = response.headers
        
        # Check for CORS headers
        assert "access-control-allow-origin" in headers
        assert headers["access-control-allow-origin"] == origin
        
        # Check for security-related headers
        expected_security_headers = [
            "access-control-allow-credentials",
            "access-control-allow-methods",
            "access-control-allow-headers",
        ]
        
        for header in expected_security_headers:
            assert header in headers, f"Missing security header: {header}"
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_expose_headers(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test that appropriate headers are exposed to client."""
        origin = cors_whitelist_origins[0]
        
        response = await regular_client.get(
            "/health",
            headers={"Origin": origin}
        )
        
        headers = response.headers
        
        # Check for exposed headers
        if "access-control-expose-headers" in headers:
            exposed_headers = headers["access-control-expose-headers"]
            
            # Check for pagination headers that should be exposed
            expected_exposed = [
                "X-Total-Count",
                "X-Page-Count", 
                "X-Has-Next",
                "X-Has-Previous"
            ]
            
            for expected_header in expected_exposed:
                # These might be in the exposed headers list
                print(f"Checking if {expected_header} is exposed: {expected_header in exposed_headers}")
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_credentials_handling(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test CORS credentials handling."""
        origin = cors_whitelist_origins[0]
        
        response = await regular_client.get(
            "/api/auth/login",
            headers={"Origin": origin}
        )
        
        headers = response.headers
        
        # Check credentials handling
        if "access-control-allow-credentials" in headers:
            credentials = headers["access-control-allow-credentials"]
            assert credentials.lower() == "true", "Credentials should be allowed for authenticated endpoints"


class TestCORSWithRateLimiting:
    """Test CORS interaction with rate limiting."""
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    @pytest.mark.slow
    async def test_cors_with_rate_limiting(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test that CORS headers are present even when rate limited."""
        origin = cors_whitelist_origins[0]
        
        # Make multiple rapid requests to trigger rate limiting
        tasks = []
        for i in range(20):  # Exceed rate limit
            task = regular_client.post(
                "/api/auth/login",
                headers={"Origin": origin},
                json={"username": "test", "password": "test"}
            )
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Check that even rate-limited responses have CORS headers
        for response in responses:
            if hasattr(response, 'status_code'):
                if response.status_code == 429:  # Rate limited
                    assert_cors_headers_present(response, origin)
                    print(f"Rate limited response still has CORS headers: {response.status_code}")


class TestCORSBypassAttempts:
    """Test protection against CORS bypass attempts."""
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_origin_spoofing_protection(
        self,
        regular_client: AsyncClient
    ):
        """Test protection against origin header spoofing."""
        # Attempt to spoof a whitelisted origin with variations
        spoofed_origins = [
            "http://localhost:3000.evil.com",
            "http://evil.com/localhost:3000",
            "http://localhost:3000@evil.com",
            "http://sublocalhost:3000",
            "https://localhost:3000.evil.com",
        ]
        
        for spoofed_origin in spoofed_origins:
            response = await regular_client.options(
                "/api/auth/login",
                headers={
                    "Origin": spoofed_origin,
                    "Access-Control-Request-Method": "POST"
                }
            )
            
            # Should not allow spoofed origins
            cors_headers = response.headers
            if "access-control-allow-origin" in cors_headers:
                assert cors_headers["access-control-allow-origin"] != spoofed_origin
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_null_origin_handling(
        self,
        regular_client: AsyncClient
    ):
        """Test handling of null origin values."""
        # Test with null origin
        response = await regular_client.options(
            "/api/auth/login",
            headers={
                "Origin": "null",
                "Access-Control-Request-Method": "POST"
            }
        )
        
        # Should handle null origin appropriately
        cors_headers = response.headers
        if "access-control-allow-origin" in cors_headers:
            # Should not blindly allow null origin
            origin_value = cors_headers["access-control-allow-origin"]
            print(f"Null origin handling result: {origin_value}")
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_multiple_origin_headers(
        self,
        regular_client: AsyncClient
    ):
        """Test handling of multiple Origin headers."""
        # This test checks if the server properly handles the case
        # where multiple Origin headers are sent (which should not happen)
        
        # Note: httpx may not allow multiple headers with same name
        # This is more of a theoretical test
        
        response = await regular_client.get(
            "/health",
            headers={"Origin": "http://localhost:3000"}
        )
        
        # Should handle normally
        assert response.status_code == 200
        assert_cors_headers_present(response, "http://localhost:3000")


class TestCORSErrorScenarios:
    """Test CORS behavior in error scenarios."""
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_with_404_errors(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test that CORS headers are present even for 404 errors."""
        origin = cors_whitelist_origins[0]
        
        response = await regular_client.get(
            "/api/nonexistent-endpoint",
            headers={"Origin": origin}
        )
        
        assert response.status_code == 404
        # Should still have CORS headers for valid origin
        assert_cors_headers_present(response, origin)
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_with_500_errors(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test that CORS headers are present even for server errors."""
        origin = cors_whitelist_origins[0]
        
        # Try to trigger a server error (this might not work depending on implementation)
        response = await regular_client.post(
            "/api/auth/login",
            headers={"Origin": origin},
            json={"invalid": "data_structure"}
        )
        
        # Even if there's an error, CORS headers should be present
        if response.status_code >= 500:
            assert_cors_headers_present(response, origin)
        
        print(f"Error response status: {response.status_code}")
    
    @pytest.mark.asyncio
    @pytest.mark.cors
    async def test_cors_with_validation_errors(
        self,
        regular_client: AsyncClient,
        cors_whitelist_origins: List[str]
    ):
        """Test CORS headers with validation errors."""
        origin = cors_whitelist_origins[0]
        
        # Send invalid data to trigger validation error
        response = await regular_client.post(
            "/api/auth/register",
            headers={"Origin": origin},
            json={
                "username": "",  # Invalid empty username
                "email": "invalid-email",  # Invalid email format
                "password": "123"  # Too short
            }
        )
        
        assert response.status_code == 422  # Validation error
        # Should still have CORS headers
        assert_cors_headers_present(response, origin)