"""
Test configuration and fixtures for Rental Manager API
Provides database sessions, test data, and common fixtures
"""

import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from decimal import Decimal
from datetime import datetime

# SQLAlchemy imports
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import event

# Application imports
from app.db.base import Base
from app.models.brand import Brand
from app.models.category import Category
from app.models.unit_of_measurement import UnitOfMeasurement
from app.models.item import Item
from app.crud.brand import BrandRepository
from app.crud.category import CategoryRepository
from app.crud.unit_of_measurement import UnitOfMeasurementRepository
from app.crud.item import ItemRepository
from app.services.brand import BrandService
from app.services.category import CategoryService
from app.services.unit_of_measurement import UnitOfMeasurementService
from app.services.item import ItemService
from app.services.sku_generator import SKUGenerator
from app.services.item_rental_blocking import ItemRentalBlockingService

# Test database URL - using SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture
async def async_engine():
    """Create async engine for testing"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=StaticPool,
        connect_args={
            "check_same_thread": False,
        },
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Clean up
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest_asyncio.fixture
async def async_session_maker(async_engine):
    """Create async session maker"""
    return async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

@pytest_asyncio.fixture
async def db_session(async_session_maker) -> AsyncGenerator[AsyncSession, None]:
    """Create a database session for testing"""
    async with async_session_maker() as session:
        # Start a transaction
        transaction = await session.begin()
        
        yield session
        
        # Rollback transaction after test
        await transaction.rollback()

# Model Fixtures

@pytest.fixture
def sample_brand_data():
    """Sample brand data for testing"""
    return {
        "name": "Test Brand",
        "code": "TST001",
        "description": "Test brand for testing purposes",
        "is_active": True
    }

@pytest.fixture
def sample_category_data():
    """Sample category data for testing"""
    return {
        "name": "Test Category",
        "category_code": "TESTCAT",
        "description": "Test category for testing",
        "category_level": 1,
        "category_path": "Test Category",
        "is_active": True
    }

@pytest.fixture
def sample_unit_data():
    """Sample unit of measurement data for testing"""
    return {
        "name": "Pieces",
        "code": "PCS",
        "description": "Individual pieces",
        "is_active": True
    }

@pytest.fixture
def sample_item_data():
    """Sample item data for testing"""
    return {
        "item_name": "Test Item",
        "sku": "TEST001",
        "description": "Test item for testing",
        "is_rentable": True,
        "is_salable": True,
        "cost_price": Decimal("100.00"),
        "sale_price": Decimal("150.00"),
        "rental_rate_per_day": Decimal("25.00"),
        "stock_quantity": 10,
        "reorder_level": 5,
        "is_active": True
    }

# Model instance fixtures

@pytest_asyncio.fixture
async def test_brand(db_session: AsyncSession, sample_brand_data) -> Brand:
    """Create a test brand instance"""
    brand = Brand(**sample_brand_data)
    db_session.add(brand)
    await db_session.commit()
    await db_session.refresh(brand)
    return brand

@pytest_asyncio.fixture
async def test_category(db_session: AsyncSession, sample_category_data) -> Category:
    """Create a test category instance"""
    category = Category(**sample_category_data)
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)
    return category

@pytest_asyncio.fixture
async def test_unit(db_session: AsyncSession, sample_unit_data) -> UnitOfMeasurement:
    """Create a test unit of measurement instance"""
    unit = UnitOfMeasurement(**sample_unit_data)
    db_session.add(unit)
    await db_session.commit()
    await db_session.refresh(unit)
    return unit

@pytest_asyncio.fixture
async def test_item(db_session: AsyncSession, sample_item_data, test_brand, test_category, test_unit) -> Item:
    """Create a test item instance with relationships"""
    item_data = sample_item_data.copy()
    item_data.update({
        "brand_id": test_brand.id,
        "category_id": test_category.id,
        "unit_of_measurement_id": test_unit.id
    })
    
    item = Item(**item_data)
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item

# Repository fixtures

@pytest_asyncio.fixture
async def brand_repository(db_session: AsyncSession) -> BrandRepository:
    """Create brand repository instance"""
    return BrandRepository(session=db_session)

@pytest_asyncio.fixture
async def category_repository(db_session: AsyncSession) -> CategoryRepository:
    """Create category repository instance"""
    return CategoryRepository(session=db_session)

@pytest_asyncio.fixture
async def unit_repository(db_session: AsyncSession) -> UnitOfMeasurementRepository:
    """Create unit repository instance"""
    return UnitOfMeasurementRepository(session=db_session)

@pytest_asyncio.fixture
async def item_repository(db_session: AsyncSession) -> ItemRepository:
    """Create item repository instance"""
    return ItemRepository(session=db_session)

# Service fixtures

@pytest_asyncio.fixture
async def brand_service(brand_repository) -> BrandService:
    """Create brand service instance"""
    return BrandService(repository=brand_repository)

@pytest_asyncio.fixture
async def category_service(category_repository) -> CategoryService:
    """Create category service instance"""
    return CategoryService(repository=category_repository)

@pytest_asyncio.fixture
async def unit_service(unit_repository) -> UnitOfMeasurementService:
    """Create unit service instance"""
    return UnitOfMeasurementService(repository=unit_repository)

@pytest_asyncio.fixture
async def sku_generator(db_session: AsyncSession) -> SKUGenerator:
    """Create SKU generator instance"""
    return SKUGenerator(session=db_session)

@pytest_asyncio.fixture
async def item_rental_blocking_service(item_repository) -> ItemRentalBlockingService:
    """Create item rental blocking service instance"""
    return ItemRentalBlockingService(item_repository=item_repository)

@pytest_asyncio.fixture
async def item_service(item_repository, sku_generator) -> ItemService:
    """Create item service instance"""
    return ItemService(repository=item_repository, sku_generator=sku_generator)

# Mock fixtures

@pytest.fixture
def mock_db_session():
    """Mock database session for unit tests that don't need real DB"""
    session = AsyncMock(spec=AsyncSession)
    
    # Mock common methods
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    session.flush = AsyncMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    session.scalars = AsyncMock()
    
    return session

@pytest.fixture
def mock_repository():
    """Mock repository for service tests"""
    repo = AsyncMock()
    
    # Mock common repository methods
    repo.create = AsyncMock()
    repo.get = AsyncMock()
    repo.update = AsyncMock()
    repo.delete = AsyncMock()
    repo.get_all = AsyncMock()
    repo.get_by_name = AsyncMock()
    repo.get_by_code = AsyncMock()
    repo.exists = AsyncMock()
    
    return repo

# Inventory-specific fixtures

@pytest.fixture
def mock_auth_user():
    """Mock authenticated user for API tests"""
    from app.models.user import User
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.username = "testuser"
    user.email = "test@example.com"
    user.is_active = True
    return user

@pytest.fixture
def mock_stock_levels():
    """Mock stock level data for testing"""
    return [
        {
            "id": uuid4(),
            "item_id": uuid4(),
            "location_id": uuid4(),
            "quantity_on_hand": Decimal("100.00"),
            "quantity_available": Decimal("80.00"),
            "quantity_on_rent": Decimal("15.00"),
            "quantity_reserved": Decimal("5.00"),
            "reorder_point": Decimal("10.00"),
            "reorder_quantity": Decimal("50.00"),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        },
        {
            "id": uuid4(),
            "item_id": uuid4(),
            "location_id": uuid4(),
            "quantity_on_hand": Decimal("50.00"),
            "quantity_available": Decimal("45.00"),
            "quantity_on_rent": Decimal("5.00"),
            "quantity_reserved": Decimal("0.00"),
            "reorder_point": Decimal("15.00"),
            "reorder_quantity": Decimal("25.00"),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
    ]

@pytest.fixture
def mock_movements():
    """Mock stock movement data for testing"""
    return [
        {
            "id": uuid4(),
            "stock_level_id": uuid4(),
            "movement_type": "purchase",
            "quantity_change": Decimal("10.00"),
            "quantity_before": Decimal("90.00"),
            "quantity_after": Decimal("100.00"),
            "reason": "Purchase order PO-001",
            "reference_number": "PO-001",
            "created_at": datetime.now(),
            "created_by": uuid4()
        },
        {
            "id": uuid4(),
            "stock_level_id": uuid4(),
            "movement_type": "rental_out",
            "quantity_change": Decimal("-5.00"),
            "quantity_before": Decimal("100.00"),
            "quantity_after": Decimal("95.00"),
            "reason": "Rental to customer",
            "reference_number": "RENT-001",
            "created_at": datetime.now(),
            "created_by": uuid4()
        }
    ]

@pytest.fixture
def mock_units():
    """Mock inventory unit data for testing"""
    return [
        {
            "id": uuid4(),
            "item_id": uuid4(),
            "location_id": uuid4(),
            "sku": "UNIT-0001",
            "serial_number": "SN001",
            "status": "available",
            "condition": "excellent",
            "purchase_cost": Decimal("100.00"),
            "purchase_date": datetime.now().date(),
            "warranty_expiry": None,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        },
        {
            "id": uuid4(),
            "item_id": uuid4(),
            "location_id": uuid4(),
            "sku": "UNIT-0002", 
            "serial_number": "SN002",
            "status": "on_rent",
            "condition": "good",
            "purchase_cost": Decimal("100.00"),
            "purchase_date": datetime.now().date(),
            "warranty_expiry": None,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
    ]

@pytest.fixture
def mock_sku_sequences():
    """Mock SKU sequence data for testing"""
    return [
        {
            "id": uuid4(),
            "prefix": "ITEM",
            "last_sequence": 100,
            "format_template": "{prefix}-{sequence:04d}",
            "description": "Item SKU sequence",
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        },
        {
            "id": uuid4(),
            "prefix": "UNIT",
            "last_sequence": 50,
            "format_template": "{prefix}-{sequence:04d}",
            "description": "Unit SKU sequence",
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
    ]

# Test data factories

class BrandFactory:
    """Factory for creating brand test data"""
    
    @staticmethod
    def build(**kwargs):
        """Build brand data"""
        default_data = {
            "name": f"Test Brand {uuid4().hex[:8]}",
            "code": f"TST{uuid4().hex[:3].upper()}",
            "description": "Test brand description",
            "is_active": True
        }
        default_data.update(kwargs)
        return default_data
    
    @staticmethod
    def build_invalid_name():
        """Build brand with invalid name"""
        return BrandFactory.build(name="")
    
    @staticmethod
    def build_invalid_code():
        """Build brand with invalid code"""
        return BrandFactory.build(code="INVALID@CODE")
    
    @staticmethod
    def build_long_description():
        """Build brand with overly long description"""
        return BrandFactory.build(description="A" * 1001)

class CategoryFactory:
    """Factory for creating category test data"""
    
    @staticmethod
    def build(**kwargs):
        """Build category data"""
        default_data = {
            "name": f"Test Category {uuid4().hex[:8]}",
            "category_code": f"CAT{uuid4().hex[:5].upper()}",
            "description": "Test category description",
            "category_level": 1,
            "category_path": f"Test Category {uuid4().hex[:8]}",
            "is_active": True
        }
        default_data.update(kwargs)
        return default_data
    
    @staticmethod
    def build_child(parent_id, parent_path="Parent Category"):
        """Build child category data"""
        child_name = f"Child Category {uuid4().hex[:8]}"
        return CategoryFactory.build(
            name=child_name,
            parent_category_id=parent_id,
            category_level=2,
            category_path=f"{parent_path} > {child_name}"
        )

class UnitFactory:
    """Factory for creating unit test data"""
    
    @staticmethod
    def build(**kwargs):
        """Build unit data"""
        default_data = {
            "name": f"Test Unit {uuid4().hex[:8]}",
            "code": f"TU{uuid4().hex[:3].upper()}",
            "description": "Test unit description",
            "is_active": True
        }
        default_data.update(kwargs)
        return default_data

class ItemFactory:
    """Factory for creating item test data"""
    
    @staticmethod
    def build(**kwargs):
        """Build item data"""
        default_data = {
            "item_name": f"Test Item {uuid4().hex[:8]}",
            "sku": f"ITEM{uuid4().hex[:8].upper()}",
            "description": "Test item description",
            "is_rentable": True,
            "is_salable": True,
            "cost_price": Decimal("100.00"),
            "sale_price": Decimal("150.00"),
            "rental_rate_per_day": Decimal("25.00"),
            "stock_quantity": 10,
            "reorder_level": 5,
            "is_active": True
        }
        default_data.update(kwargs)
        return default_data
    
    @staticmethod
    def build_rental_only():
        """Build rental-only item"""
        return ItemFactory.build(
            is_rentable=True,
            is_salable=False,
            sale_price=None
        )
    
    @staticmethod
    def build_sale_only():
        """Build sale-only item"""
        return ItemFactory.build(
            is_rentable=False,
            is_salable=True,
            rental_rate_per_day=None
        )
    
    @staticmethod
    def build_invalid_price():
        """Build item with invalid pricing"""
        return ItemFactory.build(
            cost_price=Decimal("200.00"),
            sale_price=Decimal("150.00")  # Sale price less than cost
        )

# Test utilities

def assert_model_fields(model, expected_data, exclude_fields=None):
    """Assert that model fields match expected data"""
    exclude_fields = exclude_fields or {'id', 'created_at', 'updated_at'}
    
    for field, expected_value in expected_data.items():
        if field not in exclude_fields:
            actual_value = getattr(model, field)
            assert actual_value == expected_value, f"Field '{field}': expected {expected_value}, got {actual_value}"

def create_test_hierarchy(category_data_list):
    """Create a test category hierarchy"""
    categories = []
    for data in category_data_list:
        category = Category(**data)
        categories.append(category)
    return categories

# Pytest configuration
def pytest_configure(config):
    """Configure pytest"""
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
    config.addinivalue_line(
        "markers", "unit: mark test as unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "api: mark test as API test"
    )
    config.addinivalue_line(
        "markers", "performance: mark test as performance test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )