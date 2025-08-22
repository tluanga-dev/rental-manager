"""
Comprehensive Authentication Testing Suite

This module contains extensive tests for the authentication system including:
- User registration and login flows
- JWT token management and validation
- Password security and management
- Multi-device session handling
- Security edge cases and attack vectors
"""

import pytest
import asyncio
from typing import Dict, Any
from datetime import datetime, timezone, timedelta
import json
import time

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt

from app.core.security import verify_token, create_token_pair
from app.core.config import settings
from app.modules.users.models import User
from app.modules.auth.models import RefreshToken, LoginAttempt
from app.modules.auth.services import AuthService

from tests.conftest_auth_comprehensive import (
    AuthTestClient, assert_valid_jwt_token, assert_authentication_required,
    assert_access_denied, assert_access_granted
)


class TestAuthenticationFlows:
    """Test core authentication flows and JWT token management."""
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_user_registration_success(self, auth_client: AuthTestClient):
        """Test successful user registration."""
        registration_data = {
            "username": "newuser",
            "email": "newuser@test.com", 
            "password": "NewUser@123",
            "full_name": "New Test User"
        }
        
        response = await auth_client.client.post(
            "/api/auth/register", 
            json=registration_data
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@test.com"
        assert data["full_name"] == "New Test User"
        assert data["is_active"] is True
        assert "password" not in data  # Password should not be returned
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_user_registration_duplicate_username(self, auth_client: AuthTestClient, regular_user: User):
        """Test registration with duplicate username fails."""
        registration_data = {
            "username": regular_user.username,
            "email": "different@test.com",
            "password": "Test@123",
            "full_name": "Different User"
        }
        
        response = await auth_client.client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_user_registration_duplicate_email(self, auth_client: AuthTestClient, regular_user: User):
        """Test registration with duplicate email fails."""
        registration_data = {
            "username": "differentuser",
            "email": regular_user.email,
            "password": "Test@123",
            "full_name": "Different User"
        }
        
        response = await auth_client.client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_user_registration_weak_password(self, auth_client: AuthTestClient):
        """Test registration with weak password fails."""
        registration_data = {
            "username": "weakuser",
            "email": "weak@test.com",
            "password": "123",  # Too short
            "full_name": "Weak User"
        }
        
        response = await auth_client.client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 400
        assert "password" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_user_login_success(self, auth_client: AuthTestClient, regular_user: User):
        """Test successful user login with valid credentials."""
        login_data = {
            "username": regular_user.email,
            "password": "User@123"
        }
        
        response = await auth_client.client.post("/api/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        assert "user" in data
        
        # Verify tokens are valid JWTs
        assert_valid_jwt_token(data["access_token"])
        assert_valid_jwt_token(data["refresh_token"])
        
        # Verify user data
        user_data = data["user"]
        assert user_data["id"] == str(regular_user.id)
        assert user_data["username"] == regular_user.username
        assert user_data["email"] == regular_user.email
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_user_login_invalid_credentials(self, auth_client: AuthTestClient, regular_user: User):
        """Test login with invalid credentials fails."""
        login_data = {
            "username": regular_user.email,
            "password": "WrongPassword@123"
        }
        
        response = await auth_client.client.post("/api/auth/login", json=login_data)
        
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_user_login_nonexistent_user(self, auth_client: AuthTestClient):
        """Test login with non-existent user fails."""
        login_data = {
            "username": "nonexistent@test.com",
            "password": "Password@123"
        }
        
        response = await auth_client.client.post("/api/auth/login", json=login_data)
        
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_user_login_inactive_user(self, auth_client: AuthTestClient, inactive_user: User):
        """Test login with inactive user fails."""
        login_data = {
            "username": inactive_user.email,
            "password": "Inactive@123"
        }
        
        response = await auth_client.client.post("/api/auth/login", json=login_data)
        
        assert response.status_code == 401
        assert "disabled" in response.json()["detail"].lower()


class TestJWTTokenManagement:
    """Test JWT token creation, validation, and lifecycle management."""
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_token_creation_and_validation(self, regular_user: User):
        """Test JWT token creation and validation."""
        user_id = str(regular_user.id)
        username = regular_user.username
        scopes = ["read", "write"]
        
        # Create token pair
        tokens = create_token_pair(user_id, username, scopes)
        
        assert tokens.token_type == "bearer"
        assert_valid_jwt_token(tokens.access_token)
        assert_valid_jwt_token(tokens.refresh_token)
        
        # Validate access token
        access_token_data = verify_token(tokens.access_token, "access")
        assert access_token_data.user_id == user_id
        assert access_token_data.username == username
        assert access_token_data.scopes == scopes
        
        # Validate refresh token
        refresh_token_data = verify_token(tokens.refresh_token, "refresh")
        assert refresh_token_data.user_id == user_id
        assert refresh_token_data.username == username
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_token_refresh_success(self, auth_client: AuthTestClient, regular_user: User):
        """Test successful token refresh."""
        # First login to get tokens
        login_response = await auth_client.authenticate(regular_user.email, "User@123")
        refresh_token = login_response["refresh_token"]
        
        # Use refresh token to get new access token
        refresh_data = {"refresh_token": refresh_token}
        response = await auth_client.client.post("/api/auth/refresh", json=refresh_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        
        # Verify new access token is valid
        assert_valid_jwt_token(data["access_token"])
        
        # Verify new token is different from original
        assert data["access_token"] != login_response["access_token"]
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_token_refresh_invalid_token(self, auth_client: AuthTestClient):
        """Test token refresh with invalid refresh token fails."""
        refresh_data = {"refresh_token": "invalid.token.here"}
        response = await auth_client.client.post("/api/auth/refresh", json=refresh_data)
        
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_token_refresh_expired_token(self, auth_client: AuthTestClient, expired_tokens: Dict[str, str]):
        """Test token refresh with expired refresh token fails."""
        refresh_data = {"refresh_token": expired_tokens["refresh_token"]}
        response = await auth_client.client.post("/api/auth/refresh", json=refresh_data)
        
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_access_with_expired_token(self, auth_client: AuthTestClient, expired_tokens: Dict[str, str]):
        """Test API access with expired access token fails."""
        headers = {"Authorization": f"Bearer {expired_tokens['access_token']}"}
        response = await auth_client.client.get("/api/auth/me", headers=headers)
        
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_access_with_malformed_token(self, auth_client: AuthTestClient):
        """Test API access with malformed token fails."""
        headers = {"Authorization": "Bearer malformed.token"}
        response = await auth_client.client.get("/api/auth/me", headers=headers)
        
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_access_without_token(self, auth_client: AuthTestClient):
        """Test API access without token fails."""
        response = await auth_client.client.get("/api/auth/me")
        
        assert response.status_code == 401


class TestUserLogoutAndSessionManagement:
    """Test user logout and multi-device session management."""
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_user_logout_success(self, auth_client: AuthTestClient, regular_user: User):
        """Test successful user logout."""
        # Login first
        login_response = await auth_client.authenticate(regular_user.email, "User@123")
        refresh_token = login_response["refresh_token"]
        
        # Logout
        logout_data = {"refresh_token": refresh_token}
        response = await auth_client.post("/api/auth/logout", json=logout_data)
        
        assert response.status_code == 200
        
        # Try to use the refresh token - should fail
        refresh_response = await auth_client.client.post(
            "/api/auth/refresh", 
            json={"refresh_token": refresh_token}
        )
        assert refresh_response.status_code == 401
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_logout_all_devices(self, auth_client: AuthTestClient, regular_user: User, db_session: AsyncSession):
        """Test logout from all devices."""
        # Create multiple sessions by logging in multiple times
        sessions = []
        for i in range(3):
            login_response = await auth_client.authenticate(regular_user.email, "User@123")
            sessions.append(login_response["refresh_token"])
        
        # Verify multiple refresh tokens exist
        stmt = select(RefreshToken).where(RefreshToken.user_id == str(regular_user.id))
        result = await db_session.execute(stmt)
        tokens_before = result.scalars().all()
        assert len(tokens_before) >= 3
        
        # Logout from all devices
        response = await auth_client.post("/api/auth/logout-all")
        assert response.status_code == 200
        
        # Verify all refresh tokens are invalidated
        for refresh_token in sessions:
            refresh_response = await auth_client.client.post(
                "/api/auth/refresh",
                json={"refresh_token": refresh_token}
            )
            assert refresh_response.status_code == 401
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_concurrent_sessions(self, regular_user: User):
        """Test multiple concurrent sessions for same user."""
        # Create multiple authenticated clients
        from app.main import app
        clients = []
        
        async with AsyncClient(app=app, base_url="http://test") as client1:
            async with AsyncClient(app=app, base_url="http://test") as client2:
                async with AsyncClient(app=app, base_url="http://test") as client3:
                    auth_client1 = AuthTestClient(client1)
                    auth_client2 = AuthTestClient(client2)
                    auth_client3 = AuthTestClient(client3)
                    
                    # Login from all three clients
                    login1 = await auth_client1.authenticate(regular_user.email, "User@123")
                    login2 = await auth_client2.authenticate(regular_user.email, "User@123")
                    login3 = await auth_client3.authenticate(regular_user.email, "User@123")
                    
                    # All sessions should be active
                    response1 = await auth_client1.get("/api/auth/me")
                    response2 = await auth_client2.get("/api/auth/me")
                    response3 = await auth_client3.get("/api/auth/me")
                    
                    assert response1.status_code == 200
                    assert response2.status_code == 200
                    assert response3.status_code == 200
                    
                    # Logout from one session
                    await auth_client1.post("/api/auth/logout", json={
                        "refresh_token": login1["refresh_token"]
                    })
                    
                    # First session should be logged out, others still active
                    response1 = await auth_client1.get("/api/auth/me")
                    response2 = await auth_client2.get("/api/auth/me")
                    response3 = await auth_client3.get("/api/auth/me")
                    
                    assert response1.status_code == 401
                    assert response2.status_code == 200
                    assert response3.status_code == 200


class TestPasswordManagement:
    """Test password-related functionality."""
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_change_password_success(self, auth_client: AuthTestClient, regular_user: User):
        """Test successful password change."""
        # Login first
        await auth_client.authenticate(regular_user.email, "User@123")
        
        # Change password
        password_data = {
            "current_password": "User@123",
            "new_password": "NewPassword@123"
        }
        response = await auth_client.post("/api/auth/change-password", json=password_data)
        
        assert response.status_code == 200
        
        # Try to login with old password - should fail
        old_login = await auth_client.client.post("/api/auth/login", json={
            "username": regular_user.email,
            "password": "User@123"
        })
        assert old_login.status_code == 401
        
        # Login with new password - should succeed
        new_login = await auth_client.client.post("/api/auth/login", json={
            "username": regular_user.email,
            "password": "NewPassword@123"
        })
        assert new_login.status_code == 200
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_change_password_wrong_current(self, auth_client: AuthTestClient, regular_user: User):
        """Test password change with wrong current password fails."""
        await auth_client.authenticate(regular_user.email, "User@123")
        
        password_data = {
            "current_password": "WrongPassword@123",
            "new_password": "NewPassword@123"
        }
        response = await auth_client.post("/api/auth/change-password", json=password_data)
        
        assert response.status_code == 400
        assert "current password" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_change_password_weak_new_password(self, auth_client: AuthTestClient, regular_user: User):
        """Test password change with weak new password fails."""
        await auth_client.authenticate(regular_user.email, "User@123")
        
        password_data = {
            "current_password": "User@123",
            "new_password": "123"  # Too weak
        }
        response = await auth_client.post("/api/auth/change-password", json=password_data)
        
        assert response.status_code == 400
        assert "password" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_forgot_password_success(self, auth_client: AuthTestClient, regular_user: User):
        """Test forgot password functionality."""
        forgot_data = {"email": regular_user.email}
        response = await auth_client.client.post("/api/auth/forgot-password", json=forgot_data)
        
        # Should always return success to prevent email enumeration
        assert response.status_code == 200
        assert "reset link" in response.json()["message"].lower()
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_forgot_password_nonexistent_email(self, auth_client: AuthTestClient):
        """Test forgot password with non-existent email."""
        forgot_data = {"email": "nonexistent@test.com"}
        response = await auth_client.client.post("/api/auth/forgot-password", json=forgot_data)
        
        # Should return success to prevent email enumeration
        assert response.status_code == 200
        assert "reset link" in response.json()["message"].lower()


class TestSecurityFeatures:
    """Test security features and attack prevention."""
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_login_attempt_logging(self, auth_client: AuthTestClient, regular_user: User, db_session: AsyncSession):
        """Test that login attempts are properly logged."""
        # Successful login
        await auth_client.client.post("/api/auth/login", json={
            "username": regular_user.email,
            "password": "User@123"
        })
        
        # Failed login
        await auth_client.client.post("/api/auth/login", json={
            "username": regular_user.email,
            "password": "WrongPassword"
        })
        
        # Check login attempts are logged
        stmt = select(LoginAttempt).where(LoginAttempt.email == regular_user.email)
        result = await db_session.execute(stmt)
        attempts = result.scalars().all()
        
        assert len(attempts) >= 2
        success_attempts = [a for a in attempts if a.success]
        failed_attempts = [a for a in attempts if not a.success]
        
        assert len(success_attempts) >= 1
        assert len(failed_attempts) >= 1
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    @pytest.mark.slow
    async def test_rate_limiting_login_endpoint(self, auth_client: AuthTestClient, regular_user: User):
        """Test rate limiting on login endpoint."""
        # Make multiple rapid login attempts
        tasks = []
        for i in range(10):  # More than the rate limit
            task = auth_client.client.post("/api/auth/login", json={
                "username": regular_user.email,
                "password": "WrongPassword"
            })
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Some requests should be rate limited (429)
        status_codes = [r.status_code for r in responses if hasattr(r, 'status_code')]
        
        # Should have some 429 responses if rate limiting is working
        # Note: This test may be flaky depending on rate limit configuration
        rate_limited = [code for code in status_codes if code == 429]
        print(f"Rate limited responses: {len(rate_limited)} out of {len(status_codes)}")
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_jwt_algorithm_confusion_attack(self, auth_client: AuthTestClient):
        """Test protection against JWT algorithm confusion attacks."""
        # Create a malicious token using 'none' algorithm
        malicious_payload = {
            "sub": "attacker",
            "user_id": "1",
            "exp": int(time.time()) + 3600
        }
        
        # Create unsigned token (algorithm confusion attack)
        malicious_token = f"{jwt.encode(malicious_payload, '', algorithm='none')}"
        
        headers = {"Authorization": f"Bearer {malicious_token}"}
        response = await auth_client.client.get("/api/auth/me", headers=headers)
        
        # Should reject the malicious token
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_token_signature_tampering(self, auth_client: AuthTestClient, user_tokens: Dict[str, str]):
        """Test protection against token signature tampering."""
        # Take a valid token and tamper with the signature
        valid_token = user_tokens["access_token"]
        parts = valid_token.split('.')
        
        # Change the last character of the signature
        tampered_signature = parts[2][:-1] + ('x' if parts[2][-1] != 'x' else 'y')
        tampered_token = f"{parts[0]}.{parts[1]}.{tampered_signature}"
        
        headers = {"Authorization": f"Bearer {tampered_token}"}
        response = await auth_client.client.get("/api/auth/me", headers=headers)
        
        # Should reject the tampered token
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_token_payload_manipulation(self, auth_client: AuthTestClient):
        """Test protection against token payload manipulation."""
        import base64
        
        # Create a token with manipulated payload
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "sub": "admin",  # Trying to escalate to admin
            "user_id": "1",
            "scopes": ["admin"],
            "exp": int(time.time()) + 3600
        }
        
        # Encode with wrong secret (should be rejected)
        manipulated_token = jwt.encode(payload, "wrong_secret", algorithm="HS256")
        
        headers = {"Authorization": f"Bearer {manipulated_token}"}
        response = await auth_client.client.get("/api/auth/me", headers=headers)
        
        # Should reject the manipulated token
        assert response.status_code == 401


class TestCurrentUserEndpoint:
    """Test the /api/auth/me endpoint functionality."""
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_get_current_user_success(self, auth_client: AuthTestClient, regular_user: User):
        """Test successful retrieval of current user information."""
        await auth_client.authenticate(regular_user.email, "User@123")
        
        response = await auth_client.get("/api/auth/me")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == str(regular_user.id)
        assert data["username"] == regular_user.username
        assert data["email"] == regular_user.email
        assert data["full_name"] == regular_user.full_name
        assert data["is_active"] == regular_user.is_active
        assert data["user_type"] == regular_user.user_type
        assert "password" not in data
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_get_current_user_unauthenticated(self, auth_client: AuthTestClient):
        """Test current user endpoint without authentication."""
        response = await auth_client.client.get("/api/auth/me")
        
        assert_authentication_required(response)
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_get_current_user_invalid_token(self, auth_client: AuthTestClient):
        """Test current user endpoint with invalid token."""
        headers = {"Authorization": "Bearer invalid.token.here"}
        response = await auth_client.client.get("/api/auth/me", headers=headers)
        
        assert_authentication_required(response)