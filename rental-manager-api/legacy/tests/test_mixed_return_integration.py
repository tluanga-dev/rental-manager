"""
Integration tests for mixed condition rental returns.
Tests the complete flow of returning items in different conditions.
"""

import pytest
from decimal import Decimal
from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.db.base import Base
from app.modules.inventory.models import StockLevel, StockMovement, InventoryUnit
from app.modules.inventory.damage_models import DamageAssessment, ReturnLineDetails
from app.modules.inventory.enums import (
    InventoryUnitStatus, StockMovementType, DamageSeverity
)
from app.modules.transactions.rentals.return_service import RentalReturnService
from app.modules.transactions.rentals.return_schemas import (
    RentalReturnRequest, ItemReturnRequest, DamageDetail
)
from app.modules.master_data.item_master.models import Item
from app.modules.master_data.locations.models import Location
from app.modules.transactions.base.models import TransactionHeader, TransactionLine


# Test database URL (use a separate test database)
TEST_DATABASE_URL = "postgresql+asyncpg://test_user:test_pass@localhost:5432/test_rental_db"


@pytest.fixture(scope="session")
async def engine():
    """Create async engine for test database."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
        echo=False
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest.fixture
async def session(engine):
    """Create async session for each test."""
    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def test_data(session):
    """Create test data for rental returns."""
    # Create location
    location = Location(
        name="Main Warehouse",
        code="WH-001",
        address="123 Test St"
    )
    session.add(location)
    await session.flush()
    
    # Create items
    laptop = Item(
        item_name="Test Laptop",
        sku="LAP-001",
        serial_number_required=True,
        purchase_price=Decimal("1000.00"),
        rental_rate_per_period=Decimal("50.00")
    )
    
    projector = Item(
        item_name="Test Projector",
        sku="PRJ-001",
        serial_number_required=False,
        purchase_price=Decimal("500.00"),
        rental_rate_per_period=Decimal("30.00")
    )
    
    session.add_all([laptop, projector])
    await session.flush()
    
    # Create stock levels
    laptop_stock = StockLevel(
        item_id=laptop.id,
        location_id=location.id,
        quantity_on_hand=Decimal("10"),
        quantity_available=Decimal("5"),
        quantity_on_rent=Decimal("5"),
        quantity_damaged=Decimal("0"),
        quantity_under_repair=Decimal("0"),
        quantity_beyond_repair=Decimal("0")
    )
    
    projector_stock = StockLevel(
        item_id=projector.id,
        location_id=location.id,
        quantity_on_hand=Decimal("20"),
        quantity_available=Decimal("10"),
        quantity_on_rent=Decimal("10"),
        quantity_damaged=Decimal("0"),
        quantity_under_repair=Decimal("0"),
        quantity_beyond_repair=Decimal("0")
    )
    
    session.add_all([laptop_stock, projector_stock])
    await session.flush()
    
    # Create rental transaction
    rental_header = TransactionHeader(
        transaction_number="RNT-2024-001",
        transaction_type="RENTAL",
        transaction_date=datetime.now(timezone.utc),
        customer_id=uuid4(),
        location_id=location.id,
        subtotal=Decimal("160.00"),
        total_amount=Decimal("160.00"),
        status="IN_PROGRESS"
    )
    session.add(rental_header)
    await session.flush()
    
    # Create rental lines
    laptop_line = TransactionLine(
        transaction_header_id=rental_header.id,
        line_number=1,
        item_id=laptop.id,
        quantity=Decimal("2"),
        unit_price=Decimal("50.00"),
        line_total=Decimal("100.00"),
        rental_start_date=date.today(),
        rental_end_date=date.today(),
        current_rental_status="RENTAL_INPROGRESS"
    )
    
    projector_line = TransactionLine(
        transaction_header_id=rental_header.id,
        line_number=2,
        item_id=projector.id,
        quantity=Decimal("3"),
        unit_price=Decimal("30.00"),
        line_total=Decimal("90.00"),
        rental_start_date=date.today(),
        rental_end_date=date.today(),
        current_rental_status="RENTAL_INPROGRESS"
    )
    
    session.add_all([laptop_line, projector_line])
    await session.commit()
    
    return {
        'location': location,
        'laptop': laptop,
        'projector': projector,
        'laptop_stock': laptop_stock,
        'projector_stock': projector_stock,
        'rental_header': rental_header,
        'laptop_line': laptop_line,
        'projector_line': projector_line
    }


class TestMixedConditionReturns:
    """Test mixed condition return processing."""
    
    @pytest.mark.asyncio
    async def test_return_all_good_condition(self, session, test_data):
        """Test returning all items in good condition."""
        # Arrange
        service = RentalReturnService()
        rental_id = str(test_data['rental_header'].id)
        
        return_request = RentalReturnRequest(
            rental_id=rental_id,
            return_date=str(date.today()),
            items=[
                ItemReturnRequest(
                    line_id=str(test_data['laptop_line'].id),
                    item_id=str(test_data['laptop'].id),
                    total_return_quantity=Decimal("2"),
                    quantity_good=Decimal("2"),
                    quantity_damaged=Decimal("0"),
                    quantity_beyond_repair=Decimal("0"),
                    quantity_lost=Decimal("0"),
                    return_date=str(date.today()),
                    return_action="COMPLETE_RETURN"
                ),
                ItemReturnRequest(
                    line_id=str(test_data['projector_line'].id),
                    item_id=str(test_data['projector'].id),
                    total_return_quantity=Decimal("3"),
                    quantity_good=Decimal("3"),
                    quantity_damaged=Decimal("0"),
                    quantity_beyond_repair=Decimal("0"),
                    quantity_lost=Decimal("0"),
                    return_date=str(date.today()),
                    return_action="COMPLETE_RETURN"
                )
            ]
        )
        
        # Act
        response = await service.process_rental_return(session, return_request)
        
        # Assert
        assert response.success is True
        assert response.rental_status == "RENTAL_COMPLETED"
        assert len(response.items_returned) == 2
        
        # Check stock levels updated correctly
        laptop_stock = await session.get(StockLevel, test_data['laptop_stock'].id)
        assert laptop_stock.quantity_available == Decimal("7")  # 5 + 2
        assert laptop_stock.quantity_on_rent == Decimal("3")  # 5 - 2
        assert laptop_stock.quantity_damaged == Decimal("0")
        
        projector_stock = await session.get(StockLevel, test_data['projector_stock'].id)
        assert projector_stock.quantity_available == Decimal("13")  # 10 + 3
        assert projector_stock.quantity_on_rent == Decimal("7")  # 10 - 3
        assert projector_stock.quantity_damaged == Decimal("0")
    
    @pytest.mark.asyncio
    async def test_return_mixed_condition(self, session, test_data):
        """Test returning items in mixed conditions (good, damaged, lost)."""
        # Arrange
        service = RentalReturnService()
        rental_id = str(test_data['rental_header'].id)
        
        return_request = RentalReturnRequest(
            rental_id=rental_id,
            return_date=str(date.today()),
            items=[
                ItemReturnRequest(
                    line_id=str(test_data['laptop_line'].id),
                    item_id=str(test_data['laptop'].id),
                    total_return_quantity=Decimal("2"),
                    quantity_good=Decimal("1"),
                    quantity_damaged=Decimal("1"),
                    quantity_beyond_repair=Decimal("0"),
                    quantity_lost=Decimal("0"),
                    damage_details=[
                        DamageDetail(
                            quantity=Decimal("1"),
                            damage_type="PHYSICAL",
                            damage_severity="MODERATE",
                            description="Screen cracked",
                            estimated_repair_cost=Decimal("200.00")
                        )
                    ],
                    return_date=str(date.today()),
                    return_action="COMPLETE_RETURN",
                    damage_penalty=Decimal("50.00")
                )
            ]
        )
        
        # Act
        response = await service.process_rental_return(session, return_request)
        
        # Assert
        assert response.success is True
        
        # Check stock levels - damaged items should NOT be available
        laptop_stock = await session.get(StockLevel, test_data['laptop_stock'].id)
        assert laptop_stock.quantity_available == Decimal("6")  # 5 + 1 (only good item)
        assert laptop_stock.quantity_on_rent == Decimal("3")  # 5 - 2
        assert laptop_stock.quantity_damaged == Decimal("1")  # 0 + 1
        
        # Check damage assessment created
        assessments = await session.execute(
            select(DamageAssessment).where(
                DamageAssessment.item_id == test_data['laptop'].id
            )
        )
        assessment = assessments.scalar_one_or_none()
        assert assessment is not None
        assert assessment.damage_severity == "MODERATE"
        assert assessment.damage_type == "PHYSICAL"
        assert assessment.quantity == Decimal("1")
    
    @pytest.mark.asyncio
    async def test_return_with_beyond_repair_and_lost(self, session, test_data):
        """Test returning items marked as beyond repair and lost."""
        # Arrange
        service = RentalReturnService()
        rental_id = str(test_data['rental_header'].id)
        
        return_request = RentalReturnRequest(
            rental_id=rental_id,
            return_date=str(date.today()),
            items=[
                ItemReturnRequest(
                    line_id=str(test_data['projector_line'].id),
                    item_id=str(test_data['projector'].id),
                    total_return_quantity=Decimal("3"),
                    quantity_good=Decimal("1"),
                    quantity_damaged=Decimal("0"),
                    quantity_beyond_repair=Decimal("1"),
                    quantity_lost=Decimal("1"),
                    damage_details=[
                        DamageDetail(
                            quantity=Decimal("1"),
                            damage_type="PHYSICAL",
                            damage_severity="BEYOND_REPAIR",
                            description="Completely destroyed",
                            estimated_repair_cost=Decimal("500.00")
                        )
                    ],
                    return_date=str(date.today()),
                    return_action="COMPLETE_RETURN"
                )
            ]
        )
        
        # Act
        response = await service.process_rental_return(session, return_request)
        
        # Assert
        assert response.success is True
        
        # Check stock levels
        projector_stock = await session.get(StockLevel, test_data['projector_stock'].id)
        assert projector_stock.quantity_available == Decimal("11")  # 10 + 1 (only good)
        assert projector_stock.quantity_on_rent == Decimal("7")  # 10 - 3
        assert projector_stock.quantity_beyond_repair == Decimal("1")  # 0 + 1
        assert projector_stock.quantity_on_hand == Decimal("19")  # 20 - 1 (lost)
        
        # Check return line details created
        details = await session.execute(
            select(ReturnLineDetails).where(
                ReturnLineDetails.transaction_line_id == test_data['projector_line'].id
            )
        )
        return_details = details.scalar_one_or_none()
        assert return_details is not None
        assert return_details.quantity_returned_good == Decimal("1")
        assert return_details.quantity_returned_beyond_repair == Decimal("1")
        assert return_details.quantity_lost == Decimal("1")
    
    @pytest.mark.asyncio
    async def test_damaged_items_not_rentable(self, session, test_data):
        """Test that damaged items cannot be rented out."""
        # First, return some damaged items
        service = RentalReturnService()
        rental_id = str(test_data['rental_header'].id)
        
        return_request = RentalReturnRequest(
            rental_id=rental_id,
            return_date=str(date.today()),
            items=[
                ItemReturnRequest(
                    line_id=str(test_data['laptop_line'].id),
                    item_id=str(test_data['laptop'].id),
                    total_return_quantity=Decimal("2"),
                    quantity_good=Decimal("0"),
                    quantity_damaged=Decimal("2"),
                    quantity_beyond_repair=Decimal("0"),
                    quantity_lost=Decimal("0"),
                    return_date=str(date.today()),
                    return_action="COMPLETE_RETURN"
                )
            ]
        )
        
        await service.process_rental_return(session, return_request)
        
        # Check that damaged items are not in available inventory
        from app.modules.inventory.repository import AsyncStockLevelRepository
        stock_repo = AsyncStockLevelRepository(session)
        
        rentable_qty = await stock_repo.get_rentable_quantity(
            test_data['laptop'].id,
            test_data['location'].id
        )
        
        # Should only have the original 5 available, NOT the 2 damaged returns
        assert rentable_qty == Decimal("5")
        
        # Verify can_fulfill_rental excludes damaged
        can_rent = await stock_repo.can_fulfill_rental(
            test_data['laptop'].id,
            test_data['location'].id,
            Decimal("6")  # Try to rent more than available
        )
        assert can_rent is False  # Should fail as only 5 available (damaged excluded)


class TestStockMovementAudit:
    """Test that stock movements are properly recorded."""
    
    @pytest.mark.asyncio
    async def test_mixed_return_creates_proper_movements(self, session, test_data):
        """Test that mixed returns create appropriate stock movements."""
        # Arrange
        service = RentalReturnService()
        rental_id = str(test_data['rental_header'].id)
        
        return_request = RentalReturnRequest(
            rental_id=rental_id,
            return_date=str(date.today()),
            items=[
                ItemReturnRequest(
                    line_id=str(test_data['laptop_line'].id),
                    item_id=str(test_data['laptop'].id),
                    total_return_quantity=Decimal("2"),
                    quantity_good=Decimal("1"),
                    quantity_damaged=Decimal("1"),
                    quantity_beyond_repair=Decimal("0"),
                    quantity_lost=Decimal("0"),
                    return_date=str(date.today()),
                    return_action="COMPLETE_RETURN"
                )
            ]
        )
        
        # Act
        await service.process_rental_return(session, return_request)
        
        # Assert - Check stock movements created
        movements = await session.execute(
            select(StockMovement).where(
                StockMovement.item_id == str(test_data['laptop'].id),
                StockMovement.movement_type == StockMovementType.RENTAL_RETURN_MIXED
            )
        )
        movement = movements.scalar_one_or_none()
        
        assert movement is not None
        assert movement.quantity_change == Decimal("-2")  # Negative for returns
        assert movement.transaction_header_id == test_data['rental_header'].id
        assert movement.transaction_line_id == test_data['laptop_line'].id


# Import needed for select
from sqlalchemy import select