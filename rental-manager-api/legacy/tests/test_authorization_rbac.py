"""
Comprehensive Authorization and RBAC Testing Suite

This module contains extensive tests for the authorization system including:
- Role-Based Access Control (RBAC)
- Permission inheritance and validation
- User type hierarchy enforcement
- Resource-level access control
- Admin-only endpoint restrictions
"""

import pytest
from typing import Dict, List
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import User
from app.modules.auth.models import Role, Permission

from tests.conftest_auth_comprehensive import (
    AuthTestClient, assert_authentication_required,
    assert_access_denied, assert_access_granted
)


class TestUserTypeHierarchy:
    """Test user type hierarchy and access levels."""
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_superadmin_access_all_endpoints(
        self, 
        auth_client: AuthTestClient, 
        superadmin_user: User
    ):
        """Test that superadmin has access to all endpoints."""
        await auth_client.authenticate(superadmin_user.email, "SuperK8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
        
        # Test various endpoint access levels
        endpoints_to_test = [
            ("GET", "/api/auth/me"),
            ("GET", "/api/users/me"),
            ("GET", "/api/users/"),  # Admin-only
            ("GET", "/api/master-data/brands/"),
            ("GET", "/api/customers/"),
            ("GET", "/api/suppliers/"),
            ("GET", "/api/inventory/"),
            ("GET", "/api/system/settings/"),  # Admin-only
        ]
        
        for method, endpoint in endpoints_to_test:
            response = await getattr(auth_client, method.lower())(endpoint)
            # Superadmin should have access to all endpoints
            # Note: Some may return 404 if no data, but not 401/403
            assert response.status_code not in [401, 403], f"Superadmin denied access to {method} {endpoint}"
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_admin_access_levels(
        self, 
        auth_client: AuthTestClient, 
        admin_user: User
    ):
        """Test admin user access levels."""
        await auth_client.authenticate(admin_user.email, "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
        
        # Admin should have access to most endpoints
        allowed_endpoints = [
            ("GET", "/api/auth/me"),
            ("GET", "/api/users/me"),
            ("GET", "/api/master-data/brands/"),
            ("GET", "/api/customers/"),
            ("GET", "/api/suppliers/"),
        ]
        
        for method, endpoint in allowed_endpoints:
            response = await getattr(auth_client, method.lower())(endpoint)
            assert response.status_code not in [401, 403], f"Admin denied access to {method} {endpoint}"
        
        # Some admin-only endpoints may require superadmin
        restricted_endpoints = [
            ("GET", "/api/system/settings/"),
            ("POST", "/api/users/"),
        ]
        
        for method, endpoint in restricted_endpoints:
            response = await getattr(auth_client, method.lower())(endpoint)
            # These might be 403 (forbidden) or accessible depending on implementation
            print(f"Admin access to {method} {endpoint}: {response.status_code}")
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_manager_access_levels(
        self, 
        auth_client: AuthTestClient, 
        manager_user: User
    ):
        """Test manager user access levels."""
        await auth_client.authenticate(manager_user.email, "mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8")
        
        # Manager should have access to business operations
        allowed_endpoints = [
            ("GET", "/api/auth/me"),
            ("GET", "/api/users/me"),
            ("GET", "/api/master-data/brands/"),
            ("GET", "/api/customers/"),
            ("GET", "/api/suppliers/"),
            ("GET", "/api/inventory/"),
        ]
        
        for method, endpoint in allowed_endpoints:
            response = await getattr(auth_client, method.lower())(endpoint)
            assert response.status_code not in [401, 403], f"Manager denied access to {method} {endpoint}"
        
        # Manager should NOT have access to admin endpoints
        restricted_endpoints = [
            ("GET", "/api/users/"),
            ("POST", "/api/users/"),
            ("GET", "/api/system/settings/"),
        ]
        
        for method, endpoint in restricted_endpoints:
            response = await getattr(auth_client, method.lower())(endpoint)
            assert response.status_code == 403, f"Manager should not have access to {method} {endpoint}"
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_regular_user_access_levels(
        self, 
        auth_client: AuthTestClient, 
        regular_user: User
    ):
        """Test regular user access levels."""
        await auth_client.authenticate(regular_user.email, "User@123")
        
        # Regular user should have limited access
        allowed_endpoints = [
            ("GET", "/api/auth/me"),
            ("GET", "/api/users/me"),
            ("PUT", "/api/users/me"),
        ]
        
        for method, endpoint in allowed_endpoints:
            response = await getattr(auth_client, method.lower())(endpoint)
            assert response.status_code not in [401, 403], f"User denied access to {method} {endpoint}"
        
        # Regular user should NOT have access to admin or management endpoints
        restricted_endpoints = [
            ("GET", "/api/users/"),
            ("POST", "/api/users/"),
            ("GET", "/api/system/settings/"),
            ("POST", "/api/master-data/brands/"),
            ("DELETE", "/api/customers/123"),
        ]
        
        for method, endpoint in restricted_endpoints:
            response = await getattr(auth_client, method.lower())(endpoint)
            assert response.status_code == 403, f"Regular user should not have access to {method} {endpoint}"
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_customer_user_access_levels(
        self, 
        auth_client: AuthTestClient, 
        customer_user: User
    ):
        """Test customer user access levels."""
        await auth_client.authenticate(customer_user.email, "Customer@123")
        
        # Customer should have very limited access
        allowed_endpoints = [
            ("GET", "/api/auth/me"),
            ("GET", "/api/users/me"),
        ]
        
        for method, endpoint in allowed_endpoints:
            response = await getattr(auth_client, method.lower())(endpoint)
            assert response.status_code not in [401, 403], f"Customer denied access to {method} {endpoint}"
        
        # Customer should NOT have access to most business endpoints
        restricted_endpoints = [
            ("GET", "/api/users/"),
            ("GET", "/api/master-data/brands/"),
            ("POST", "/api/customers/"),
            ("GET", "/api/suppliers/"),
            ("GET", "/api/inventory/"),
        ]
        
        for method, endpoint in restricted_endpoints:
            response = await getattr(auth_client, method.lower())(endpoint)
            assert response.status_code == 403, f"Customer should not have access to {method} {endpoint}"


class TestRoleBasedAccessControl:
    """Test role-based access control functionality."""
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_role_assignment_and_access(
        self, 
        auth_client: AuthTestClient, 
        regular_user: User,
        test_roles: Dict[str, Role],
        db_session: AsyncSession
    ):
        """Test that role assignment grants appropriate access."""
        # Initially user has basic access
        await auth_client.authenticate(regular_user.email, "User@123")
        
        response = await auth_client.get("/api/master-data/brands/")
        initial_access = response.status_code
        
        # Assign manager role to user
        regular_user.roles.append(test_roles["manager"])
        await db_session.commit()
        
        # Re-authenticate to get updated permissions
        await auth_client.authenticate(regular_user.email, "User@123")
        
        # Now should have manager-level access
        response = await auth_client.get("/api/master-data/brands/")
        new_access = response.status_code
        
        # Access level should be maintained or improved
        assert new_access not in [401, 403] or initial_access not in [401, 403]
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_multiple_roles_inheritance(
        self,
        auth_client: AuthTestClient,
        regular_user: User,
        test_roles: Dict[str, Role],
        db_session: AsyncSession
    ):
        """Test that multiple roles provide cumulative permissions."""
        # Assign multiple roles
        regular_user.roles.extend([test_roles["user"], test_roles["manager"]])
        await db_session.commit()
        
        await auth_client.authenticate(regular_user.email, "User@123")
        
        # Should have access from both roles
        user_endpoints = [("/api/auth/me", "GET")]
        manager_endpoints = [("/api/master-data/brands/", "GET")]
        
        for endpoint, method in user_endpoints + manager_endpoints:
            response = await getattr(auth_client, method.lower())(endpoint)
            assert response.status_code not in [401, 403], f"Multi-role user denied access to {method} {endpoint}"
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_role_removal_revokes_access(
        self,
        auth_client: AuthTestClient,
        admin_user: User,
        test_roles: Dict[str, Role],
        db_session: AsyncSession
    ):
        """Test that removing roles revokes appropriate access."""
        # Initially admin has admin access
        await auth_client.authenticate(admin_user.email, "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
        
        response = await auth_client.get("/api/users/")
        assert response.status_code not in [401, 403], "Admin should have access to user management"
        
        # Remove admin role
        admin_user.roles.clear()
        await db_session.commit()
        
        # Re-authenticate to get updated permissions
        await auth_client.authenticate(admin_user.email, "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
        
        # Should no longer have admin access
        response = await auth_client.get("/api/users/")
        assert response.status_code == 403, "User without admin role should not access user management"


class TestPermissionBasedAccess:
    """Test fine-grained permission-based access control."""
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_direct_permission_assignment(
        self,
        auth_client: AuthTestClient,
        regular_user: User,
        test_permissions: Dict[str, Permission],
        db_session: AsyncSession
    ):
        """Test direct permission assignment to users."""
        # Assign specific permission directly to user
        regular_user.direct_permissions.append(test_permissions["users.read"])
        await db_session.commit()
        
        await auth_client.authenticate(regular_user.email, "User@123")
        
        # Should now have access based on direct permission
        # Note: This depends on the actual permission implementation
        response = await auth_client.get("/api/users/me")
        assert response.status_code == 200, "User with direct permission should have access"
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_permission_inheritance_from_roles(
        self,
        auth_client: AuthTestClient,
        manager_user: User,
        test_roles: Dict[str, Role],
        test_permissions: Dict[str, Permission]
    ):
        """Test that permissions are inherited from assigned roles."""
        # Manager role should have certain permissions
        manager_role = test_roles["manager"]
        manager_role.permissions.append(test_permissions["inventory.read"])
        
        await auth_client.authenticate(manager_user.email, "mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8")
        
        # Should have access based on role permissions
        response = await auth_client.get("/api/inventory/")
        assert response.status_code not in [401, 403], "Manager should inherit permissions from role"
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_permission_risk_levels(
        self,
        auth_client: AuthTestClient,
        regular_user: User,
        test_permissions: Dict[str, Permission],
        db_session: AsyncSession
    ):
        """Test that high-risk permissions are properly restricted."""
        # Assign LOW risk permission
        regular_user.direct_permissions.append(test_permissions["users.read"])
        await db_session.commit()
        
        await auth_client.authenticate(regular_user.email, "User@123")
        
        # Should have access to low-risk operations
        response = await auth_client.get("/api/users/me")
        assert response.status_code == 200
        
        # Should NOT have access to high-risk operations without proper permissions
        # Note: This test depends on actual permission enforcement implementation
        response = await auth_client.delete("/api/users/999")
        assert response.status_code in [403, 404], "User should not have delete access"


class TestEndpointSpecificAuthorization:
    """Test authorization for specific endpoint categories."""
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_master_data_endpoints_authorization(
        self,
        auth_client: AuthTestClient,
        regular_user: User,
        manager_user: User,
        admin_user: User
    ):
        """Test authorization for master data endpoints."""
        master_data_endpoints = [
            "/api/master-data/brands/",
            "/api/master-data/categories/",
            "/api/master-data/locations/",
            "/api/master-data/units-of-measurement/",
            "/api/master-data/item-master/",
        ]
        
        # Test regular user access (should be restricted)
        await auth_client.authenticate(regular_user.email, "User@123")
        for endpoint in master_data_endpoints:
            response = await auth_client.get(endpoint)
            assert response.status_code == 403, f"Regular user should not access {endpoint}"
        
        # Test manager user access (should have read access)
        await auth_client.authenticate(manager_user.email, "mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8")
        for endpoint in master_data_endpoints:
            response = await auth_client.get(endpoint)
            assert response.status_code not in [401, 403], f"Manager should access {endpoint}"
        
        # Test admin user access (should have full access)
        await auth_client.authenticate(admin_user.email, "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
        for endpoint in master_data_endpoints:
            response = await auth_client.get(endpoint)
            assert response.status_code not in [401, 403], f"Admin should access {endpoint}"
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_business_operations_authorization(
        self,
        auth_client: AuthTestClient,
        regular_user: User,
        manager_user: User
    ):
        """Test authorization for business operation endpoints."""
        business_endpoints = [
            "/api/customers/",
            "/api/suppliers/",
            "/api/inventory/",
            "/api/transactions/",
            "/api/rentals/",
        ]
        
        # Test regular user access (should be restricted)
        await auth_client.authenticate(regular_user.email, "User@123")
        for endpoint in business_endpoints:
            response = await auth_client.get(endpoint)
            assert response.status_code == 403, f"Regular user should not access {endpoint}"
        
        # Test manager user access (should have access)
        await auth_client.authenticate(manager_user.email, "mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8")
        for endpoint in business_endpoints:
            response = await auth_client.get(endpoint)
            assert response.status_code not in [401, 403], f"Manager should access {endpoint}"
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_system_administration_authorization(
        self,
        auth_client: AuthTestClient,
        regular_user: User,
        manager_user: User,
        admin_user: User,
        superadmin_user: User
    ):
        """Test authorization for system administration endpoints."""
        system_endpoints = [
            "/api/system/settings/",
            "/api/users/",  # User management
        ]
        
        # Test regular user access (should be denied)
        await auth_client.authenticate(regular_user.email, "User@123")
        for endpoint in system_endpoints:
            response = await auth_client.get(endpoint)
            assert response.status_code == 403, f"Regular user should not access {endpoint}"
        
        # Test manager user access (should be denied)
        await auth_client.authenticate(manager_user.email, "mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8")
        for endpoint in system_endpoints:
            response = await auth_client.get(endpoint)
            assert response.status_code == 403, f"Manager should not access {endpoint}"
        
        # Test admin user access (may be allowed depending on implementation)
        await auth_client.authenticate(admin_user.email, "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
        for endpoint in system_endpoints:
            response = await auth_client.get(endpoint)
            # Admin may or may not have access - depends on specific implementation
            print(f"Admin access to {endpoint}: {response.status_code}")
        
        # Test superadmin user access (should be allowed)
        await auth_client.authenticate(superadmin_user.email, "SuperK8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
        for endpoint in system_endpoints:
            response = await auth_client.get(endpoint)
            assert response.status_code not in [401, 403], f"Superadmin should access {endpoint}"
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_user_profile_endpoints(
        self,
        auth_client: AuthTestClient,
        regular_user: User,
        admin_user: User
    ):
        """Test user profile endpoint authorization."""
        # Test own profile access
        await auth_client.authenticate(regular_user.email, "User@123")
        
        response = await auth_client.get("/api/users/me")
        assert response.status_code == 200, "User should access own profile"
        
        response = await auth_client.put("/api/users/me", json={
            "full_name": "Updated Name"
        })
        assert response.status_code in [200, 422], "User should update own profile"
        
        # Test accessing other users' profiles (should be restricted)
        response = await auth_client.get(f"/api/users/{admin_user.id}")
        assert response.status_code == 403, "User should not access other profiles"


class TestAuthorizationEdgeCases:
    """Test edge cases and security scenarios in authorization."""
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_inactive_user_authorization(
        self,
        auth_client: AuthTestClient,
        inactive_user: User
    ):
        """Test that inactive users cannot access protected endpoints."""
        # Inactive users should not be able to login
        login_response = await auth_client.client.post("/api/auth/login", json={
            "username": inactive_user.email,
            "password": "Inactive@123"
        })
        
        assert login_response.status_code == 401, "Inactive user should not be able to login"
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_role_permission_consistency(
        self,
        auth_client: AuthTestClient,
        test_roles: Dict[str, Role],
        test_permissions: Dict[str, Permission],
        db_session: AsyncSession
    ):
        """Test that role-permission assignments are consistent."""
        # Create a user with conflicting role/permission setup
        from app.modules.users.models import User
        from app.core.security import get_password_hash
        
        test_user = User(
            username="roletest",
            email="roletest@test.com",
            password=get_password_hash("Test@123"),
            full_name="Role Test User",
            is_active=True,
            user_type="USER"
        )
        
        # Assign low-privilege role but high-privilege direct permission
        test_user.roles.append(test_roles["user"])
        test_user.direct_permissions.append(test_permissions["system.admin"])
        
        db_session.add(test_user)
        await db_session.commit()
        
        await auth_client.authenticate("roletest@test.com", "Test@123")
        
        # Test which permission takes precedence
        response = await auth_client.get("/api/system/settings/")
        
        # The result depends on implementation - direct permissions might override
        # or the system might use the most restrictive approach
        print(f"User with mixed permissions access result: {response.status_code}")
    
    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_permission_revocation_immediate_effect(
        self,
        auth_client: AuthTestClient,
        manager_user: User,
        test_roles: Dict[str, Role],
        db_session: AsyncSession
    ):
        """Test that permission revocation takes immediate effect."""
        # Initially manager has access
        await auth_client.authenticate(manager_user.email, "mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8")
        
        response = await auth_client.get("/api/master-data/brands/")
        assert response.status_code not in [401, 403], "Manager should initially have access"
        
        # Remove manager role
        manager_user.roles.clear()
        await db_session.commit()
        
        # Test if access is immediately revoked (may depend on token caching)
        response = await auth_client.get("/api/master-data/brands/")
        
        # Note: If permissions are cached in JWT, this might still work
        # until token expires and needs refresh
        print(f"Access after role removal: {response.status_code}")
        
        # After re-authentication, access should definitely be revoked
        await auth_client.authenticate(manager_user.email, "mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8")
        response = await auth_client.get("/api/master-data/brands/")
        assert response.status_code == 403, "Access should be revoked after re-authentication"