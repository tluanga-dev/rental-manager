"""
Comprehensive authentication, authorization, and CORS test fixtures.

This module provides all necessary fixtures for testing the complete
authentication and authorization system including CORS compliance.

Import this module into your main conftest.py to use these fixtures.
"""

import pytest
import asyncio
from typing import Dict, List, Optional, AsyncGenerator, Any
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from fastapi import FastAPI

# Import core modules
from app.main import app
from app.shared.dependencies import get_session
from app.core.security import create_token_pair, get_password_hash
from app.core.config import settings

# Import models
from app.modules.users.models import User, UserProfile
from app.modules.auth.models import RefreshToken, LoginAttempt, Role, Permission
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.categories.models import Category
from app.modules.master_data.locations.models import Location, LocationType
from app.modules.master_data.units.models import UnitOfMeasurement
from app.modules.customers.models import Customer
from app.modules.suppliers.models import Supplier

# Import services
from app.modules.users.services import UserService
from app.modules.auth.services import AuthService


class TestUser:
    """Test user data structure for consistent user creation."""
    
    def __init__(
        self,
        username: str,
        email: str,
        password: str,
        full_name: str,
        user_type: str = "USER",
        is_active: bool = True,
        is_superuser: bool = False,
        roles: List[str] = None,
        permissions: List[str] = None
    ):
        self.username = username
        self.email = email
        self.password = password
        self.full_name = full_name
        self.user_type = user_type
        self.is_active = is_active
        self.is_superuser = is_superuser
        self.roles = roles or []
        self.permissions = permissions or []


class AuthTestClient:
    """Enhanced AsyncClient with authentication capabilities."""
    
    def __init__(self, client: AsyncClient):
        self.client = client
        self.tokens: Dict[str, str] = {}
    
    async def authenticate(self, username: str, password: str) -> Dict[str, Any]:
        """Authenticate and store tokens."""
        response = await self.client.post("/api/auth/login", json={
            "username": username,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            self.tokens = {
                "access_token": data["access_token"],
                "refresh_token": data["refresh_token"]
            }
            return data
        return response.json()
    
    async def authenticated_request(
        self, 
        method: str, 
        url: str, 
        **kwargs
    ) -> Any:
        """Make authenticated request with current tokens."""
        headers = kwargs.get("headers", {})
        if self.tokens.get("access_token"):
            headers["Authorization"] = f"Bearer {self.tokens['access_token']}"
        kwargs["headers"] = headers
        
        return await getattr(self.client, method.lower())(url, **kwargs)
    
    async def get(self, url: str, **kwargs) -> Any:
        """Authenticated GET request."""
        return await self.authenticated_request("GET", url, **kwargs)
    
    async def post(self, url: str, **kwargs) -> Any:
        """Authenticated POST request."""
        return await self.authenticated_request("POST", url, **kwargs)
    
    async def put(self, url: str, **kwargs) -> Any:
        """Authenticated PUT request."""
        return await self.authenticated_request("PUT", url, **kwargs)
    
    async def delete(self, url: str, **kwargs) -> Any:
        """Authenticated DELETE request."""
        return await self.authenticated_request("DELETE", url, **kwargs)
    
    async def patch(self, url: str, **kwargs) -> Any:
        """Authenticated PATCH request."""
        return await self.authenticated_request("PATCH", url, **kwargs)
    
    async def options(self, url: str, **kwargs) -> Any:
        """OPTIONS request for CORS testing."""
        return await self.client.options(url, **kwargs)


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session for testing."""
    async for session in get_session():
        yield session
        break


@pytest.fixture
async def test_app() -> FastAPI:
    """Provide the FastAPI application instance."""
    return app


@pytest.fixture
async def auth_client(test_app: FastAPI) -> AsyncGenerator[AuthTestClient, None]:
    """Provide an enhanced async client with authentication capabilities."""
    async with AsyncClient(app=test_app, base_url="http://test") as client:
        yield AuthTestClient(client)


@pytest.fixture
async def regular_client(test_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Provide a regular async client without authentication."""
    async with AsyncClient(app=test_app, base_url="http://test") as client:
        yield client


# ==============================================================================
# User and Role Fixtures
# ==============================================================================

@pytest.fixture
async def test_roles(db_session: AsyncSession) -> Dict[str, Role]:
    """Create test roles with appropriate permissions."""
    roles = {}
    
    # Admin role
    admin_role = Role(
        name="ADMIN",
        description="Administrator role with full access",
        is_system_role=True,
        is_active=True
    )
    db_session.add(admin_role)
    
    # Manager role
    manager_role = Role(
        name="MANAGER",
        description="Manager role with business operations access",
        is_system_role=False,
        is_active=True
    )
    db_session.add(manager_role)
    
    # User role
    user_role = Role(
        name="USER",
        description="Standard user role with limited access",
        is_system_role=False,
        is_active=True
    )
    db_session.add(user_role)
    
    await db_session.flush()
    
    roles["admin"] = admin_role
    roles["manager"] = manager_role
    roles["user"] = user_role
    
    await db_session.commit()
    return roles


@pytest.fixture
async def test_permissions(db_session: AsyncSession) -> Dict[str, Permission]:
    """Create test permissions for RBAC testing."""
    permissions = {}
    
    permission_data = [
        ("users.read", "Read users", "users", "read", "LOW"),
        ("users.write", "Write users", "users", "write", "MEDIUM"),
        ("users.delete", "Delete users", "users", "delete", "HIGH"),
        ("inventory.read", "Read inventory", "inventory", "read", "LOW"),
        ("inventory.write", "Write inventory", "inventory", "write", "MEDIUM"),
        ("system.admin", "System administration", "system", "admin", "CRITICAL"),
    ]
    
    for name, desc, resource, action, risk in permission_data:
        permission = Permission(
            name=name,
            description=desc,
            resource=resource,
            action=action,
            risk_level=risk,
            is_system_permission=True
        )
        db_session.add(permission)
        permissions[name] = permission
    
    await db_session.flush()
    await db_session.commit()
    return permissions


@pytest.fixture
async def superadmin_user(db_session: AsyncSession) -> User:
    """Create a superadmin user for testing."""
    user = User(
        username="superadmin",
        email="superadmin@test.com",
        password=get_password_hash("sA9#rE2$mN4!xV7&pQ1*wZ8^tL5@kB3"),
        full_name="Super Administrator",
        is_active=True,
        is_superuser=True,
        user_type="SUPERADMIN"
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.commit()
    return user


@pytest.fixture
async def admin_user(db_session: AsyncSession, test_roles: Dict[str, Role]) -> User:
    """Create an admin user for testing."""
    user = User(
        username="admin",
        email="admin@test.com", 
        password=get_password_hash("K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"),
        full_name="Test Administrator",
        is_active=True,
        is_superuser=False,
        user_type="ADMIN"
    )
    user.roles.append(test_roles["admin"])
    db_session.add(user)
    await db_session.flush()
    await db_session.commit()
    return user


@pytest.fixture
async def manager_user(db_session: AsyncSession, test_roles: Dict[str, Role]) -> User:
    """Create a manager user for testing."""
    user = User(
        username="manager",
        email="manager@test.com",
        password=get_password_hash("mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8"),
        full_name="Test Manager",
        is_active=True,
        is_superuser=False,
        user_type="MANAGER"
    )
    user.roles.append(test_roles["manager"])
    db_session.add(user)
    await db_session.flush()
    await db_session.commit()
    return user


@pytest.fixture
async def regular_user(db_session: AsyncSession, test_roles: Dict[str, Role]) -> User:
    """Create a regular user for testing."""
    user = User(
        username="user",
        email="user@test.com",
        password=get_password_hash("User@123"),
        full_name="Test User",
        is_active=True,
        is_superuser=False,
        user_type="USER"
    )
    user.roles.append(test_roles["user"])
    db_session.add(user)
    await db_session.flush()
    await db_session.commit()
    return user


@pytest.fixture
async def inactive_user(db_session: AsyncSession) -> User:
    """Create an inactive user for testing."""
    user = User(
        username="inactive",
        email="inactive@test.com",
        password=get_password_hash("Inactive@123"),
        full_name="Inactive User",
        is_active=False,
        is_superuser=False,
        user_type="USER"
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.commit()
    return user


@pytest.fixture
async def customer_user(db_session: AsyncSession) -> User:
    """Create a customer user for testing."""
    user = User(
        username="customer",
        email="customer@test.com",
        password=get_password_hash("Customer@123"),
        full_name="Test Customer",
        is_active=True,
        is_superuser=False,
        user_type="CUSTOMER"
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.commit()
    return user


# ==============================================================================
# Authentication Token Fixtures
# ==============================================================================

@pytest.fixture
async def superadmin_tokens(superadmin_user: User) -> Dict[str, str]:
    """Create authentication tokens for superadmin user."""
    tokens = create_token_pair(
        user_id=str(superadmin_user.id),
        username=superadmin_user.username,
        scopes=["read", "write", "admin"]
    )
    return {
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type
    }


@pytest.fixture
async def admin_tokens(admin_user: User) -> Dict[str, str]:
    """Create authentication tokens for admin user."""
    tokens = create_token_pair(
        user_id=str(admin_user.id),
        username=admin_user.username,
        scopes=["read", "write"]
    )
    return {
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type
    }


@pytest.fixture
async def manager_tokens(manager_user: User) -> Dict[str, str]:
    """Create authentication tokens for manager user."""
    tokens = create_token_pair(
        user_id=str(manager_user.id),
        username=manager_user.username,
        scopes=["read", "write"]
    )
    return {
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type
    }


@pytest.fixture
async def user_tokens(regular_user: User) -> Dict[str, str]:
    """Create authentication tokens for regular user."""
    tokens = create_token_pair(
        user_id=str(regular_user.id),
        username=regular_user.username,
        scopes=["read"]
    )
    return {
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type
    }


@pytest.fixture
async def expired_tokens() -> Dict[str, str]:
    """Create expired tokens for testing."""
    # Create tokens with past expiry
    from app.core.security import create_access_token, create_refresh_token
    from datetime import timedelta
    
    expired_access = create_access_token(
        {"sub": "test", "user_id": "test"},
        expires_delta=timedelta(seconds=-1)
    )
    expired_refresh = create_refresh_token(
        {"sub": "test", "user_id": "test"},
        expires_delta=timedelta(seconds=-1)
    )
    
    return {
        "access_token": expired_access,
        "refresh_token": expired_refresh,
        "token_type": "bearer"
    }


# ==============================================================================
# CORS Testing Fixtures
# ==============================================================================

@pytest.fixture
def cors_whitelist_origins() -> List[str]:
    """Provide whitelist origins for CORS testing."""
    return [
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://localhost:3002",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "https://localhost:3000",
        "https://localhost:8000"
    ]


@pytest.fixture
def cors_blocked_origins() -> List[str]:
    """Provide blocked origins for CORS testing."""
    return [
        "http://evil.com",
        "https://malicious-site.net",
        "http://localhost:2999",  # Outside port range
        "http://192.168.1.100:3000",  # Different IP
        "ftp://localhost:3000"  # Wrong protocol
    ]


@pytest.fixture
def all_api_endpoints() -> List[Dict[str, str]]:
    """Provide comprehensive list of all API endpoints for CORS testing."""
    return [
        # Public endpoints
        {"method": "GET", "path": "/health"},
        {"method": "GET", "path": "/docs"},
        {"method": "GET", "path": "/redoc"},
        {"method": "GET", "path": "/openapi.json"},
        
        # Auth endpoints
        {"method": "POST", "path": "/api/auth/login"},
        {"method": "POST", "path": "/api/auth/register"},
        {"method": "POST", "path": "/api/auth/refresh"},
        {"method": "POST", "path": "/api/auth/logout"},
        {"method": "POST", "path": "/api/auth/logout-all"},
        {"method": "POST", "path": "/api/auth/change-password"},
        {"method": "POST", "path": "/api/auth/forgot-password"},
        {"method": "POST", "path": "/api/auth/reset-password"},
        {"method": "GET", "path": "/api/auth/me"},
        
        # User management
        {"method": "GET", "path": "/api/users/me"},
        {"method": "PUT", "path": "/api/users/me"},
        {"method": "GET", "path": "/api/users/me/profile"},
        {"method": "PUT", "path": "/api/users/me/profile"},
        {"method": "GET", "path": "/api/users/"},
        {"method": "POST", "path": "/api/users/"},
        {"method": "GET", "path": "/api/users/123"},
        {"method": "PUT", "path": "/api/users/123"},
        {"method": "DELETE", "path": "/api/users/123"},
        
        # Master data endpoints
        {"method": "GET", "path": "/api/master-data/brands/"},
        {"method": "POST", "path": "/api/master-data/brands/"},
        {"method": "GET", "path": "/api/master-data/brands/123"},
        {"method": "PUT", "path": "/api/master-data/brands/123"},
        {"method": "DELETE", "path": "/api/master-data/brands/123"},
        
        {"method": "GET", "path": "/api/master-data/categories/"},
        {"method": "POST", "path": "/api/master-data/categories/"},
        {"method": "GET", "path": "/api/master-data/categories/123"},
        {"method": "PUT", "path": "/api/master-data/categories/123"},
        {"method": "DELETE", "path": "/api/master-data/categories/123"},
        
        {"method": "GET", "path": "/api/master-data/locations/"},
        {"method": "POST", "path": "/api/master-data/locations/"},
        {"method": "GET", "path": "/api/master-data/locations/123"},
        {"method": "PUT", "path": "/api/master-data/locations/123"},
        {"method": "DELETE", "path": "/api/master-data/locations/123"},
        
        {"method": "GET", "path": "/api/master-data/units-of-measurement/"},
        {"method": "POST", "path": "/api/master-data/units-of-measurement/"},
        {"method": "GET", "path": "/api/master-data/units-of-measurement/123"},
        {"method": "PUT", "path": "/api/master-data/units-of-measurement/123"},
        {"method": "DELETE", "path": "/api/master-data/units-of-measurement/123"},
        
        {"method": "GET", "path": "/api/master-data/item-master/"},
        {"method": "POST", "path": "/api/master-data/item-master/"},
        {"method": "GET", "path": "/api/master-data/item-master/123"},
        {"method": "PUT", "path": "/api/master-data/item-master/123"},
        {"method": "DELETE", "path": "/api/master-data/item-master/123"},
        
        # Business operations
        {"method": "GET", "path": "/api/customers/"},
        {"method": "POST", "path": "/api/customers/"},
        {"method": "GET", "path": "/api/customers/123"},
        {"method": "PUT", "path": "/api/customers/123"},
        {"method": "DELETE", "path": "/api/customers/123"},
        
        {"method": "GET", "path": "/api/suppliers/"},
        {"method": "POST", "path": "/api/suppliers/"},
        {"method": "GET", "path": "/api/suppliers/123"},
        {"method": "PUT", "path": "/api/suppliers/123"},
        {"method": "DELETE", "path": "/api/suppliers/123"},
        
        {"method": "GET", "path": "/api/inventory/"},
        {"method": "POST", "path": "/api/inventory/"},
        {"method": "GET", "path": "/api/inventory/123"},
        {"method": "PUT", "path": "/api/inventory/123"},
        {"method": "DELETE", "path": "/api/inventory/123"},
        
        {"method": "GET", "path": "/api/transactions/"},
        {"method": "POST", "path": "/api/transactions/"},
        {"method": "GET", "path": "/api/transactions/123"},
        {"method": "PUT", "path": "/api/transactions/123"},
        {"method": "DELETE", "path": "/api/transactions/123"},
        
        {"method": "GET", "path": "/api/rentals/"},
        {"method": "POST", "path": "/api/rentals/"},
        {"method": "GET", "path": "/api/rentals/123"},
        {"method": "PUT", "path": "/api/rentals/123"},
        {"method": "DELETE", "path": "/api/rentals/123"},
        
        {"method": "GET", "path": "/api/analytics/"},
        {"method": "POST", "path": "/api/analytics/"},
        
        {"method": "GET", "path": "/api/company/"},
        {"method": "POST", "path": "/api/company/"},
        {"method": "PUT", "path": "/api/company/123"},
        
        # System endpoints
        {"method": "GET", "path": "/api/system/settings/"},
        {"method": "POST", "path": "/api/system/settings/"},
        {"method": "PUT", "path": "/api/system/settings/123"},
        {"method": "DELETE", "path": "/api/system/settings/123"},
    ]


# ==============================================================================
# Test Data Fixtures
# ==============================================================================

@pytest.fixture
async def test_brand(db_session: AsyncSession) -> Brand:
    """Create a test brand."""
    brand = Brand(
        brand_name="Test Brand",
        brand_code="TB",
        description="Test brand for testing",
        is_active=True
    )
    db_session.add(brand)
    await db_session.flush()
    await db_session.commit()
    return brand


@pytest.fixture
async def test_category(db_session: AsyncSession) -> Category:
    """Create a test category."""
    category = Category(
        category_name="Test Category",
        category_code="TC",
        description="Test category for testing",
        is_active=True
    )
    db_session.add(category)
    await db_session.flush()
    await db_session.commit()
    return category


@pytest.fixture
async def test_location(db_session: AsyncSession) -> Location:
    """Create a test location."""
    location = Location(
        location_code="TL001",
        location_name="Test Location",
        location_type=LocationType.WAREHOUSE,
        address="123 Test Street",
        city="Test City",
        state="Test State",
        country="Test Country",
        postal_code="12345"
    )
    db_session.add(location)
    await db_session.flush()
    await db_session.commit()
    return location


@pytest.fixture
async def test_customer(db_session: AsyncSession) -> Customer:
    """Create a test customer."""
    customer = Customer(
        customer_name="Test Customer",
        email="customer@test.com",
        phone="1234567890",
        address="123 Customer Street",
        city="Customer City",
        state="Customer State",
        country="Customer Country",
        is_active=True
    )
    db_session.add(customer)
    await db_session.flush()
    await db_session.commit()
    return customer


@pytest.fixture
async def test_supplier(db_session: AsyncSession) -> Supplier:
    """Create a test supplier."""
    supplier = Supplier(
        supplier_name="Test Supplier",
        contact_person="John Doe",
        email="supplier@test.com", 
        phone="1234567890",
        address="123 Supplier Street",
        city="Supplier City",
        state="Supplier State",
        country="Supplier Country",
        is_active=True
    )
    db_session.add(supplier) 
    await db_session.flush()
    await db_session.commit()
    return supplier


# ==============================================================================
# Cleanup Fixtures
# ==============================================================================

@pytest.fixture(autouse=True)
async def cleanup_test_data(db_session: AsyncSession):
    """Automatically cleanup test data after each test."""
    yield
    
    # Clean up test data
    try:
        # Delete in proper order to respect foreign keys
        await db_session.execute(delete(RefreshToken))
        await db_session.execute(delete(LoginAttempt))
        
        # Clean up test users (except system users)
        await db_session.execute(
            delete(User).where(User.email.like("%@test.com"))
        )
        
        await db_session.commit()
    except Exception as e:
        await db_session.rollback()
        print(f"Cleanup error: {e}")


# ==============================================================================
# Utility Functions
# ==============================================================================

def assert_valid_jwt_token(token: str) -> bool:
    """Assert that a token is a valid JWT."""
    parts = token.split('.')
    assert len(parts) == 3, "JWT should have 3 parts"
    return True


def assert_cors_headers_present(response, origin: str = None) -> bool:
    """Assert that CORS headers are properly set."""
    headers = response.headers
    
    assert "access-control-allow-origin" in headers
    assert "access-control-allow-methods" in headers
    assert "access-control-allow-headers" in headers
    
    if origin:
        assert headers["access-control-allow-origin"] == origin
    
    return True


def assert_authentication_required(response) -> bool:
    """Assert that response indicates authentication is required."""
    assert response.status_code == 401
    assert "detail" in response.json()
    return True


def assert_access_denied(response) -> bool:
    """Assert that response indicates access is denied."""
    assert response.status_code == 403
    assert "detail" in response.json()
    return True


def assert_access_granted(response) -> bool:
    """Assert that response indicates access is granted."""
    assert response.status_code in [200, 201, 202, 204]
    return True