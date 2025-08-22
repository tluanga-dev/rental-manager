"""
Test configuration and fixtures for the rental management system.
"""

import sys
import os
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Import comprehensive auth fixtures
from tests.conftest_auth_comprehensive import *

import pytest
import pytest_asyncio
import asyncio
from typing import AsyncGenerator, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text

from app.db.base import Base
from app.core.config import settings

# Test database configuration
TEST_DATABASE_URL = "postgresql+asyncpg://tluanga@localhost:5432/postgres"

# Create test engine with better isolation
test_engine = None

def get_test_engine():
    global test_engine
    if test_engine is None:
        test_engine = create_async_engine(
            TEST_DATABASE_URL,
            echo=False,
            pool_size=1,
            max_overflow=0,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
    return test_engine

# Create test session factory
def get_test_session_factory():
    return async_sessionmaker(
        get_test_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
    )


@pytest_asyncio.fixture(scope="function")
async def setup_test_db():
    """Setup and teardown test database."""
    engine = get_test_engine()
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # Drop all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    # Properly dispose of engine connections
    await engine.dispose()
    
    # Reset global engine to ensure fresh instance for next test
    global test_engine
    test_engine = None


@pytest_asyncio.fixture
async def db_session(setup_test_db) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    session_factory = get_test_session_factory()
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@pytest_asyncio.fixture
async def clean_db_session(setup_test_db) -> AsyncGenerator[AsyncSession, None]:
    """Create a clean test database session that auto-rolls back."""
    session_factory = get_test_session_factory()
    async with session_factory() as session:
        # Start a transaction
        transaction = await session.begin()
        
        try:
            yield session
        finally:
            # Always rollback to keep database clean
            await transaction.rollback()
            await session.close()


@pytest_asyncio.fixture
async def session(db_session: AsyncSession) -> AsyncSession:
    """Alias for db_session to maintain compatibility."""
    return db_session


@pytest_asyncio.fixture
async def test_brand(db_session: AsyncSession):
    """Create a test brand."""
    from app.modules.master_data.brands.models import Brand
    
    brand = Brand(
        brand_name="Test Brand",
        brand_code="TB001",
        description="Test brand for testing"
    )
    db_session.add(brand)
    await db_session.commit()
    await db_session.refresh(brand)
    return brand


@pytest_asyncio.fixture
async def test_category(db_session: AsyncSession):
    """Create a test category."""
    from app.modules.master_data.categories.models import Category
    
    category = Category(
        name="Test Category",
        category_code="TEST-CAT"
    )
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)
    return category


@pytest_asyncio.fixture
async def test_uom(db_session: AsyncSession):
    """Create a test unit of measurement."""
    from app.modules.master_data.units.models import UnitOfMeasurement
    
    uom = UnitOfMeasurement(
        name="Piece",
        code="PCS",
        description="Individual pieces"
    )
    db_session.add(uom)
    await db_session.commit()
    await db_session.refresh(uom)
    return uom


@pytest_asyncio.fixture
async def test_supplier(db_session: AsyncSession):
    """Create a test supplier."""
    from app.modules.suppliers.models import Supplier
    
    supplier = Supplier(
        supplier_code="SUP001",
        company_name="Test Supplier Co.",
        contact_person="John Doe",
        email="supplier@test.com",
        phone="+1234567890",
        address="123 Supplier Street"
    )
    db_session.add(supplier)
    await db_session.commit()
    await db_session.refresh(supplier)
    return supplier


@pytest_asyncio.fixture
async def test_location(db_session: AsyncSession):
    """Create a test location."""
    from app.modules.master_data.locations.models import Location, LocationType
    
    location = Location(
        location_code="WH001",
        location_name="Test Warehouse",
        location_type=LocationType.WAREHOUSE,
        address="123 Warehouse Street",
        city="Test City",
        state="Test State",
        country="Test Country"
    )
    db_session.add(location)
    await db_session.commit()
    await db_session.refresh(location)
    return location


@pytest_asyncio.fixture
async def test_serialized_item(db_session: AsyncSession, test_brand, test_category, test_uom):
    """Create a test item that requires serial numbers."""
    from app.modules.master_data.item_master.models import Item, ItemStatus
    
    item = Item(
        sku="SERIAL001",
        item_name="Test Serialized Item",
        item_status=ItemStatus.ACTIVE.value,
        brand_id=test_brand.id,
        category_id=test_category.id,
        unit_of_measurement_id=test_uom.id,
        serial_number_required=True,  # This item requires serial numbers
        purchase_price=Decimal("100.00"),
        sale_price=Decimal("150.00"),
        security_deposit=Decimal("50.00"),
        reorder_point=10,
        is_rentable=True,
        is_saleable=False
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest_asyncio.fixture
async def test_non_serialized_item(db_session: AsyncSession, test_brand, test_category, test_uom):
    """Create a test item that does NOT require serial numbers."""
    from app.modules.master_data.item_master.models import Item, ItemStatus
    
    item = Item(
        sku="BULK001",
        item_name="Test Bulk Item",
        item_status=ItemStatus.ACTIVE.value,
        brand_id=test_brand.id,
        category_id=test_category.id,
        unit_of_measurement_id=test_uom.id,
        serial_number_required=False,  # This item does NOT require serial numbers
        purchase_price=Decimal("25.00"),
        sale_price=Decimal("40.00"),
        security_deposit=Decimal("10.00"),
        reorder_point=50,
        is_rentable=True,
        is_saleable=False
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest_asyncio.fixture
async def purchase_service(db_session: AsyncSession):
    """Create a purchase service instance."""
    from app.modules.transactions.purchase.service import PurchaseService
    return PurchaseService(db_session)


@pytest_asyncio.fixture
async def test_customer(db_session: AsyncSession):
    """Create a test customer."""
    from app.modules.customers.models import Customer, CustomerType
    from uuid import uuid4
    
    customer = Customer(
        customer_code="CUST001",
        customer_type=CustomerType.INDIVIDUAL,
        first_name="Test",
        last_name="Customer",
        email="test.customer@example.com",
        phone="+1234567890"
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


@pytest_asyncio.fixture
async def test_item(db_session: AsyncSession, test_brand, test_category, test_uom):
    """Create a test item alias for compatibility."""
    return await test_non_serialized_item(db_session, test_brand, test_category, test_uom)


@pytest_asyncio.fixture
async def test_data(
    db_session: AsyncSession,
    test_customer,
    test_location,
    test_non_serialized_item
):
    """Fixture that provides test data for rental tests."""
    return {
        "customer": test_customer,
        "location": test_location,
        "item": test_non_serialized_item,
        "session": db_session
    }


@pytest_asyncio.fixture
async def complete_test_data(
    db_session: AsyncSession,
    test_supplier,
    test_location,
    test_serialized_item,
    test_non_serialized_item
):
    """Fixture that provides all test data needed for purchase tests."""
    return {
        "supplier": test_supplier,
        "location": test_location,
        "serialized_item": test_serialized_item,
        "non_serialized_item": test_non_serialized_item,
        "session": db_session
    }


# Note: Using pytest-asyncio's built-in event_loop fixture
# The asyncio_default_fixture_loop_scope is configured in pytest.ini


# Helper functions for tests
def create_purchase_request_data(supplier_id, location_id, items_data):
    """Helper function to create purchase request data."""
    from app.modules.transactions.purchase.schemas import NewPurchaseRequest, PurchaseItemCreate
    
    items = [
        PurchaseItemCreate(
            item_id=str(item["item_id"]),
            quantity=item["quantity"],
            unit_cost=item["unit_cost"],
            tax_rate=item.get("tax_rate", 0.0),
            discount_amount=item.get("discount_amount", 0.0),
            condition=item.get("condition", "NEW"),
            notes=item.get("notes", "")
        )
        for item in items_data
    ]
    
    return NewPurchaseRequest(
        supplier_id=supplier_id,
        location_id=location_id,
        purchase_date=date.today(),
        notes="Test purchase transaction",
        reference_number=f"TEST-PO-{uuid4().hex[:8].upper()}",
        items=items
    )


async def verify_transaction_created(session: AsyncSession, transaction_id: str):
    """Helper function to verify transaction was created correctly."""
    from app.modules.transactions.base.models import TransactionHeader, TransactionLine
    from sqlalchemy import select
    
    # Verify transaction header
    tx_stmt = select(TransactionHeader).where(TransactionHeader.id == transaction_id)
    tx_result = await session.execute(tx_stmt)
    transaction = tx_result.scalar_one_or_none()
    
    assert transaction is not None, "Transaction header should be created"
    
    # Verify transaction lines
    lines_stmt = select(TransactionLine).where(TransactionLine.transaction_id == transaction_id)
    lines_result = await session.execute(lines_stmt)
    lines = lines_result.scalars().all()
    
    assert len(lines) > 0, "Transaction should have at least one line"
    
    return transaction, lines


async def verify_inventory_updates(session: AsyncSession, item_id: str, location_id: str, expected_quantity: Decimal, should_have_units: bool = False):
    """Helper function to verify inventory was updated correctly."""
    from app.modules.inventory.models import StockLevel, StockMovement, InventoryUnit
    from sqlalchemy import select
    
    # Verify stock level
    stock_stmt = select(StockLevel).where(
        StockLevel.item_id == str(item_id),
        StockLevel.location_id == str(location_id)
    )
    stock_result = await session.execute(stock_stmt)
    stock_level = stock_result.scalar_one_or_none()
    
    assert stock_level is not None, "Stock level should be created"
    assert stock_level.quantity_on_hand == expected_quantity, f"Expected {expected_quantity}, got {stock_level.quantity_on_hand}"
    
    # Verify stock movement
    movement_stmt = select(StockMovement).where(
        StockMovement.item_id == str(item_id),
        StockMovement.location_id == str(location_id)
    )
    movement_result = await session.execute(movement_stmt)
    movements = movement_result.scalars().all()
    
    assert len(movements) > 0, "Stock movement should be created"
    
    # Verify inventory units if expected
    units_stmt = select(InventoryUnit).where(InventoryUnit.item_id == str(item_id))
    units_result = await session.execute(units_stmt)
    units = units_result.scalars().all()
    
    if should_have_units:
        assert len(units) == int(expected_quantity), f"Expected {int(expected_quantity)} inventory units, got {len(units)}"
    else:
        assert len(units) == 0, f"Expected no inventory units, got {len(units)}"
    
    return stock_level, movements, units