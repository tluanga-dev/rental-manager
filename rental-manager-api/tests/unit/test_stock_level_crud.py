"""
Comprehensive CRUD tests for StockLevel.

Tests all CRUD operations with edge cases, error conditions, and business logic validation.
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, patch, MagicMock
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.crud.inventory.stock_level import CRUDStockLevel, stock_level
from app.models.inventory.stock_level import StockLevel
from app.models.inventory.stock_movement import StockMovement
from app.models.inventory.enums import StockStatus, StockMovementType
from app.schemas.inventory.stock_level import (
    StockLevelCreate,
    StockLevelUpdate,
    StockLevelFilter,
    StockAdjustment,
    StockReservation,
    RentalOperation,
    RentalReturn,
    StockTransfer
)


class TestCRUDStockLevel:
    """Test suite for StockLevel CRUD operations."""
    
    @pytest_asyncio.fixture
    async def crud_instance(self):
        """Create CRUD instance for testing."""
        return CRUDStockLevel(StockLevel)
    
    @pytest_asyncio.fixture
    async def sample_stock_level_data(self):
        """Sample stock level data for testing."""
        return {
            "item_id": uuid4(),
            "location_id": uuid4(),
            "quantity_on_hand": Decimal("100.00"),
            "quantity_available": Decimal("90.00"),
            "quantity_reserved": Decimal("10.00"),
            "quantity_on_rent": Decimal("0.00"),
            "quantity_damaged": Decimal("0.00"),
            "quantity_under_repair": Decimal("0.00"),
            "quantity_beyond_repair": Decimal("0.00"),
            "average_cost": Decimal("25.50"),
            "total_value": Decimal("2550.00"),
            "reorder_point": Decimal("20.00"),
            "maximum_stock": Decimal("500.00"),
            "stock_status": StockStatus.IN_STOCK
        }
    
    @pytest_asyncio.fixture
    async def stock_level_create_schema(self, sample_stock_level_data):
        """Create StockLevelCreate schema."""
        return StockLevelCreate(**sample_stock_level_data)
    
    # GET OR CREATE TESTS
    
    @pytest.mark.asyncio
    async def test_get_or_create_existing(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        stock_level_create_schema: StockLevelCreate
    ):
        """Test getting existing stock level."""
        # Create a stock level first
        existing_stock = StockLevel(**stock_level_create_schema.dict())
        db_session.add(existing_stock)
        await db_session.commit()
        await db_session.refresh(existing_stock)
        
        # Get or create should return existing
        result = await crud_instance.get_or_create(
            db_session,
            item_id=existing_stock.item_id,
            location_id=existing_stock.location_id,
            created_by=uuid4()
        )
        
        assert result.id == existing_stock.id
        assert result.item_id == existing_stock.item_id
        assert result.location_id == existing_stock.location_id
    
    @pytest.mark.asyncio
    async def test_get_or_create_new(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel
    ):
        """Test creating new stock level."""
        item_id = uuid4()
        location_id = uuid4()
        created_by = uuid4()
        
        result = await crud_instance.get_or_create(
            db_session,
            item_id=item_id,
            location_id=location_id,
            created_by=created_by
        )
        
        assert result.id is not None
        assert result.item_id == item_id
        assert result.location_id == location_id
        assert result.created_by == created_by
        assert result.updated_by == created_by
        assert result.quantity_on_hand == Decimal("0")
        assert result.quantity_available == Decimal("0")
        assert result.quantity_reserved == Decimal("0")
    
    @pytest.mark.asyncio
    async def test_get_or_create_race_condition(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel
    ):
        """Test handling of race condition during creation."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Mock IntegrityError on first creation attempt
        original_add = db_session.add
        call_count = 0
        
        def mock_add(obj):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise IntegrityError("statement", "params", "unique_constraint")
            return original_add(obj)
        
        # Create a stock level that would be found on retry
        existing_stock = StockLevel(
            item_id=item_id,
            location_id=location_id,
            quantity_on_hand=Decimal("0"),
            quantity_available=Decimal("0"),
            quantity_reserved=Decimal("0"),
            quantity_on_rent=Decimal("0"),
            quantity_damaged=Decimal("0"),
            quantity_under_repair=Decimal("0"),
            quantity_beyond_repair=Decimal("0")
        )
        db_session.add(existing_stock)
        await db_session.commit()
        
        with patch.object(db_session, 'add', side_effect=mock_add), \
             patch.object(db_session, 'rollback', new_callable=AsyncMock):
            
            result = await crud_instance.get_or_create(
                db_session,
                item_id=item_id,
                location_id=location_id
            )
        
        assert result.item_id == item_id
        assert result.location_id == location_id
    
    # ADJUST QUANTITY TESTS
    
    @pytest.mark.asyncio
    async def test_adjust_quantity_positive(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        stock_level_create_schema: StockLevelCreate
    ):
        """Test positive quantity adjustment."""
        # Create stock level
        stock_level_obj = StockLevel(**stock_level_create_schema.dict())
        stock_level_obj.quantity_on_hand = Decimal("50.00")
        stock_level_obj.quantity_available = Decimal("50.00")
        
        db_session.add(stock_level_obj)
        await db_session.commit()
        await db_session.refresh(stock_level_obj)
        
        # Mock the adjust_quantity method
        with patch.object(stock_level_obj, 'adjust_quantity') as mock_adjust:
            adjustment = StockAdjustment(
                item_id=stock_level_obj.item_id,
                location_id=stock_level_obj.location_id,
                adjustment_type="positive",
                adjustment=Decimal("25.00"),
                reason="Purchase receipt",
                notes="New inventory arrived",
                affect_available=True
            )
            
            performed_by = uuid4()
            
            updated_stock, movement = await crud_instance.adjust_quantity(
                db_session,
                stock_level_id=stock_level_obj.id,
                adjustment=adjustment,
                performed_by=performed_by
            )
            
            mock_adjust.assert_called_once_with(
                Decimal("25.00"),
                affect_available=True
            )
            
            assert movement.movement_type == StockMovementType.ADJUSTMENT_POSITIVE
            assert movement.quantity_change == Decimal("25.00")
            assert movement.performed_by_id == performed_by
            assert movement.reason == "Purchase receipt"
            assert movement.notes == "New inventory arrived"
    
    @pytest.mark.asyncio
    async def test_adjust_quantity_negative(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        stock_level_create_schema: StockLevelCreate
    ):
        """Test negative quantity adjustment."""
        # Create stock level
        stock_level_obj = StockLevel(**stock_level_create_schema.dict())
        stock_level_obj.quantity_on_hand = Decimal("100.00")
        
        db_session.add(stock_level_obj)
        await db_session.commit()
        await db_session.refresh(stock_level_obj)
        
        with patch.object(stock_level_obj, 'adjust_quantity') as mock_adjust:
            adjustment = StockAdjustment(
                item_id=stock_level_obj.item_id,
                location_id=stock_level_obj.location_id,
                adjustment_type="negative",
                adjustment=Decimal("-15.00"),
                reason="Damage loss",
                notes="Items damaged during transport"
            )
            
            updated_stock, movement = await crud_instance.adjust_quantity(
                db_session,
                stock_level_id=stock_level_obj.id,
                adjustment=adjustment,
                performed_by=uuid4()
            )
            
            mock_adjust.assert_called_once()
            assert movement.movement_type == StockMovementType.ADJUSTMENT_NEGATIVE
            assert movement.quantity_change == Decimal("-15.00")
    
    @pytest.mark.asyncio
    async def test_adjust_quantity_stock_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel
    ):
        """Test adjustment for non-existent stock level."""
        adjustment = StockAdjustment(
            item_id=uuid4(),
            location_id=uuid4(),
            adjustment_type="positive",
            adjustment=Decimal("10.00"),
            reason="Test"
        )
        
        with pytest.raises(ValueError, match="Stock level .* not found"):
            await crud_instance.adjust_quantity(
                db_session,
                stock_level_id=uuid4(),
                adjustment=adjustment,
                performed_by=uuid4()
            )
    
    # RESERVE STOCK TESTS
    
    @pytest.mark.asyncio
    async def test_reserve_stock_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        stock_level_create_schema: StockLevelCreate
    ):
        """Test successful stock reservation."""
        # Create stock level
        stock_level_obj = StockLevel(**stock_level_create_schema.dict())
        stock_level_obj.quantity_available = Decimal("50.00")
        
        db_session.add(stock_level_obj)
        await db_session.commit()
        await db_session.refresh(stock_level_obj)
        
        with patch.object(stock_level_obj, 'reserve_quantity') as mock_reserve:
            reservation = StockReservation(
                item_id=stock_level_obj.item_id,
                location_id=stock_level_obj.location_id,
                quantity=Decimal("10.00"),
                transaction_id=uuid4(),
                customer_id=uuid4(),
                expiry_date=datetime.now() + timedelta(hours=24)
            )
            
            result = await crud_instance.reserve_stock(
                db_session,
                stock_level_id=stock_level_obj.id,
                reservation=reservation,
                performed_by=uuid4()
            )
            
            mock_reserve.assert_called_once_with(Decimal("10.00"))
            assert result.id == stock_level_obj.id
    
    @pytest.mark.asyncio
    async def test_reserve_stock_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel
    ):
        """Test reservation for non-existent stock level."""
        reservation = StockReservation(
            item_id=uuid4(),
            location_id=uuid4(),
            quantity=Decimal("5.00"),
            transaction_id=uuid4(),
            customer_id=uuid4()
        )
        
        with pytest.raises(ValueError, match="Stock level .* not found"):
            await crud_instance.reserve_stock(
                db_session,
                stock_level_id=uuid4(),
                reservation=reservation,
                performed_by=uuid4()
            )
    
    # RENTAL OPERATIONS TESTS
    
    @pytest.mark.asyncio
    async def test_process_rental_out_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        stock_level_create_schema: StockLevelCreate
    ):
        """Test processing rental out operation."""
        # Create stock level
        stock_level_obj = StockLevel(**stock_level_create_schema.dict())
        stock_level_obj.quantity_available = Decimal("30.00")
        quantity_before = stock_level_obj.quantity_on_hand
        
        db_session.add(stock_level_obj)
        await db_session.commit()
        await db_session.refresh(stock_level_obj)
        
        with patch.object(stock_level_obj, 'rent_out_quantity') as mock_rent_out, \
             patch.object(StockMovement, 'create_rental_out_movement') as mock_create_movement:
            
            # Setup mock return
            mock_movement = MagicMock()
            mock_create_movement.return_value = mock_movement
            
            rental = RentalOperation(
                item_id=stock_level_obj.item_id,
                location_id=stock_level_obj.location_id,
                quantity=Decimal("5.00"),
                transaction_id=uuid4(),
                customer_id=uuid4(),
                rental_rate=Decimal("10.00")
            )
            
            performed_by = uuid4()
            
            updated_stock, movement = await crud_instance.process_rental_out(
                db_session,
                stock_level_id=stock_level_obj.id,
                rental=rental,
                performed_by=performed_by
            )
            
            mock_rent_out.assert_called_once_with(Decimal("5.00"))
            mock_create_movement.assert_called_once_with(
                stock_level_id=stock_level_obj.id,
                item_id=stock_level_obj.item_id,
                location_id=stock_level_obj.location_id,
                quantity=Decimal("5.00"),
                quantity_before=quantity_before,
                transaction_header_id=rental.transaction_id,
                performed_by_id=performed_by
            )
            
            assert updated_stock.id == stock_level_obj.id
            assert movement == mock_movement
    
    @pytest.mark.asyncio
    async def test_process_rental_return_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        stock_level_create_schema: StockLevelCreate
    ):
        """Test processing rental return operation."""
        # Create stock level
        stock_level_obj = StockLevel(**stock_level_create_schema.dict())
        stock_level_obj.quantity_on_rent = Decimal("15.00")
        quantity_before = stock_level_obj.quantity_on_hand
        
        db_session.add(stock_level_obj)
        await db_session.commit()
        await db_session.refresh(stock_level_obj)
        
        with patch.object(stock_level_obj, 'return_from_rent') as mock_return:
            rental_return = RentalReturn(
                item_id=stock_level_obj.item_id,
                location_id=stock_level_obj.location_id,
                quantity=Decimal("10.00"),
                damaged_quantity=Decimal("2.00"),
                transaction_id=uuid4(),
                customer_id=uuid4(),
                condition_notes="Minor scratches on 2 units"
            )
            
            updated_stock, movement = await crud_instance.process_rental_return(
                db_session,
                stock_level_id=stock_level_obj.id,
                rental_return=rental_return,
                performed_by=uuid4()
            )
            
            mock_return.assert_called_once_with(
                Decimal("10.00"),
                damaged_quantity=Decimal("2.00")
            )
            
            # Should create mixed return movement due to damage
            assert movement.movement_type == StockMovementType.RENTAL_RETURN_MIXED
            assert movement.quantity_change == Decimal("10.00")
            assert movement.notes == "Minor scratches on 2 units"
    
    @pytest.mark.asyncio
    async def test_process_rental_return_all_damaged(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        stock_level_create_schema: StockLevelCreate
    ):
        """Test rental return with all items damaged."""
        # Create stock level
        stock_level_obj = StockLevel(**stock_level_create_schema.dict())
        
        db_session.add(stock_level_obj)
        await db_session.commit()
        await db_session.refresh(stock_level_obj)
        
        with patch.object(stock_level_obj, 'return_from_rent') as mock_return:
            rental_return = RentalReturn(
                item_id=stock_level_obj.item_id,
                location_id=stock_level_obj.location_id,
                quantity=Decimal("5.00"),
                damaged_quantity=Decimal("5.00"),  # All damaged
                transaction_id=uuid4(),
                customer_id=uuid4(),
                condition_notes="All units water damaged"
            )
            
            updated_stock, movement = await crud_instance.process_rental_return(
                db_session,
                stock_level_id=stock_level_obj.id,
                rental_return=rental_return,
                performed_by=uuid4()
            )
            
            # Should create damaged return movement
            assert movement.movement_type == StockMovementType.RENTAL_RETURN_DAMAGED
    
    @pytest.mark.asyncio
    async def test_process_rental_return_no_damage(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        stock_level_create_schema: StockLevelCreate
    ):
        """Test rental return with no damage."""
        # Create stock level
        stock_level_obj = StockLevel(**stock_level_create_schema.dict())
        
        db_session.add(stock_level_obj)
        await db_session.commit()
        await db_session.refresh(stock_level_obj)
        
        with patch.object(stock_level_obj, 'return_from_rent') as mock_return:
            rental_return = RentalReturn(
                item_id=stock_level_obj.item_id,
                location_id=stock_level_obj.location_id,
                quantity=Decimal("8.00"),
                damaged_quantity=Decimal("0.00"),  # No damage
                transaction_id=uuid4(),
                customer_id=uuid4(),
                condition_notes="All items in good condition"
            )
            
            updated_stock, movement = await crud_instance.process_rental_return(
                db_session,
                stock_level_id=stock_level_obj.id,
                rental_return=rental_return,
                performed_by=uuid4()
            )
            
            # Should create normal return movement
            assert movement.movement_type == StockMovementType.RENTAL_RETURN
    
    # RETRIEVAL TESTS
    
    @pytest.mark.asyncio
    async def test_get_by_item_location(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        stock_level_create_schema: StockLevelCreate
    ):
        """Test getting stock level by item and location."""
        # Create stock level
        stock_level_obj = StockLevel(**stock_level_create_schema.dict())
        
        db_session.add(stock_level_obj)
        await db_session.commit()
        await db_session.refresh(stock_level_obj)
        
        result = await crud_instance.get_by_item_location(
            db_session,
            item_id=stock_level_obj.item_id,
            location_id=stock_level_obj.location_id
        )
        
        assert result is not None
        assert result.id == stock_level_obj.id
        assert result.item_id == stock_level_obj.item_id
        assert result.location_id == stock_level_obj.location_id
    
    @pytest.mark.asyncio
    async def test_get_by_item_location_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel
    ):
        """Test getting non-existent stock level."""
        result = await crud_instance.get_by_item_location(
            db_session,
            item_id=uuid4(),
            location_id=uuid4()
        )
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_by_item(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        sample_stock_level_data
    ):
        """Test getting all stock levels for an item."""
        item_id = uuid4()
        
        # Create stock levels at different locations
        locations = [uuid4() for _ in range(3)]
        stock_levels = []
        
        for location_id in locations:
            data = sample_stock_level_data.copy()
            data["item_id"] = item_id
            data["location_id"] = location_id
            
            stock_level_obj = StockLevel(**data)
            db_session.add(stock_level_obj)
            stock_levels.append(stock_level_obj)
        
        await db_session.commit()
        
        # Retrieve all for item
        results = await crud_instance.get_by_item(
            db_session,
            item_id=item_id
        )
        
        assert len(results) == 3
        assert all(result.item_id == item_id for result in results)
        
        # Check that all locations are represented
        result_locations = {result.location_id for result in results}
        assert result_locations == set(locations)
    
    @pytest.mark.asyncio
    async def test_get_by_location(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        sample_stock_level_data
    ):
        """Test getting all stock levels at a location."""
        location_id = uuid4()
        
        # Create stock levels for different items
        items = [uuid4() for _ in range(4)]
        
        for item_id in items:
            data = sample_stock_level_data.copy()
            data["item_id"] = item_id
            data["location_id"] = location_id
            
            stock_level_obj = StockLevel(**data)
            db_session.add(stock_level_obj)
        
        await db_session.commit()
        
        # Test retrieval without pagination
        results = await crud_instance.get_by_location(
            db_session,
            location_id=location_id
        )
        
        assert len(results) == 4
        assert all(result.location_id == location_id for result in results)
        
        # Test with pagination
        page1 = await crud_instance.get_by_location(
            db_session,
            location_id=location_id,
            skip=0,
            limit=2
        )
        
        page2 = await crud_instance.get_by_location(
            db_session,
            location_id=location_id,
            skip=2,
            limit=2
        )
        
        assert len(page1) == 2
        assert len(page2) == 2
        
        # Ensure different results
        page1_ids = {result.id for result in page1}
        page2_ids = {result.id for result in page2}
        assert len(page1_ids & page2_ids) == 0
    
    @pytest.mark.asyncio
    async def test_get_filtered_comprehensive(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        sample_stock_level_data
    ):
        """Test comprehensive filtering functionality."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Create diverse stock levels
        stock_levels_data = [
            {
                **sample_stock_level_data,
                "item_id": item_id,
                "location_id": location_id,
                "quantity_on_hand": Decimal("100.00"),
                "quantity_available": Decimal("80.00"),
                "stock_status": StockStatus.IN_STOCK,
                "reorder_point": Decimal("20.00"),
                "maximum_stock": Decimal("200.00")
            },
            {
                **sample_stock_level_data,
                "item_id": item_id,
                "location_id": uuid4(),  # Different location
                "quantity_on_hand": Decimal("5.00"),  # Low stock
                "quantity_available": Decimal("5.00"),
                "stock_status": StockStatus.LOW_STOCK,
                "reorder_point": Decimal("10.00"),  # Below reorder point
                "maximum_stock": Decimal("50.00")
            },
            {
                **sample_stock_level_data,
                "item_id": uuid4(),  # Different item
                "location_id": location_id,
                "quantity_on_hand": Decimal("0.00"),  # Out of stock
                "quantity_available": Decimal("0.00"),
                "stock_status": StockStatus.OUT_OF_STOCK,
                "reorder_point": Decimal("5.00"),
                "maximum_stock": Decimal("30.00")
            },
            {
                **sample_stock_level_data,
                "item_id": uuid4(),
                "location_id": location_id,
                "quantity_on_hand": Decimal("300.00"),  # Overstocked
                "quantity_available": Decimal("280.00"),
                "stock_status": StockStatus.OVERSTOCKED,
                "reorder_point": Decimal("50.00"),
                "maximum_stock": Decimal("250.00")  # Above maximum
            }
        ]
        
        # Create stock levels
        for data in stock_levels_data:
            stock_level_obj = StockLevel(**data)
            db_session.add(stock_level_obj)
        
        await db_session.commit()
        
        # Test item filter
        filter_params = StockLevelFilter(item_id=item_id)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 2
        assert all(stock.item_id == item_id for stock in filtered)
        
        # Test location filter
        filter_params = StockLevelFilter(location_id=location_id)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 3
        assert all(stock.location_id == location_id for stock in filtered)
        
        # Test stock status filter
        filter_params = StockLevelFilter(stock_status=StockStatus.IN_STOCK)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 1
        assert filtered[0].stock_status == StockStatus.IN_STOCK
        
        # Test has_stock filter
        filter_params = StockLevelFilter(has_stock=True)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 3  # All except out of stock
        assert all(stock.quantity_on_hand > 0 for stock in filtered)
        
        # Test has_stock=False filter
        filter_params = StockLevelFilter(has_stock=False)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 1
        assert filtered[0].quantity_on_hand == 0
        
        # Test is_available filter
        filter_params = StockLevelFilter(is_available=True)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 3  # All with available > 0
        assert all(stock.quantity_available > 0 for stock in filtered)
        
        # Test is_low_stock filter
        filter_params = StockLevelFilter(is_low_stock=True)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 1  # Only one with qty <= reorder point
        
        # Test is_overstocked filter
        filter_params = StockLevelFilter(is_overstocked=True)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 1  # Only one above maximum stock
        
        # Test quantity range filters
        filter_params = StockLevelFilter(
            min_quantity=Decimal("50.00"),
            max_quantity=Decimal("200.00")
        )
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 1  # Only the 100.00 stock level
        assert filtered[0].quantity_on_hand == Decimal("100.00")
    
    @pytest.mark.asyncio
    async def test_get_low_stock_items(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        sample_stock_level_data
    ):
        """Test getting low stock items."""
        location_id = uuid4()
        
        # Create stock levels with different quantities
        stock_levels_data = [
            {
                **sample_stock_level_data,
                "quantity_available": Decimal("15.00"),
                "reorder_point": Decimal("20.00"),  # Below reorder point
                "location_id": location_id
            },
            {
                **sample_stock_level_data,
                "quantity_available": Decimal("5.00"),
                "reorder_point": Decimal("10.00"),  # Below reorder point
                "location_id": location_id
            },
            {
                **sample_stock_level_data,
                "quantity_available": Decimal("50.00"),
                "reorder_point": Decimal("20.00"),  # Above reorder point
                "location_id": location_id
            },
            {
                **sample_stock_level_data,
                "quantity_available": Decimal("3.00"),
                "reorder_point": None,  # No reorder point set
                "location_id": location_id
            },
            {
                **sample_stock_level_data,
                "quantity_available": Decimal("2.00"),
                "reorder_point": Decimal("5.00"),  # Below reorder point, different location
                "location_id": uuid4()
            }
        ]
        
        # Create stock levels
        for data in stock_levels_data:
            stock_level_obj = StockLevel(**data)
            db_session.add(stock_level_obj)
        
        await db_session.commit()
        
        # Test without location filter
        low_stock = await crud_instance.get_low_stock_items(db_session)
        assert len(low_stock) == 3  # Three with reorder points and below threshold
        
        # Test with location filter
        low_stock_filtered = await crud_instance.get_low_stock_items(
            db_session,
            location_id=location_id
        )
        assert len(low_stock_filtered) == 2  # Only two at specific location
        assert all(stock.location_id == location_id for stock in low_stock_filtered)
    
    @pytest.mark.asyncio
    async def test_get_total_value_by_location(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        sample_stock_level_data
    ):
        """Test calculating total inventory value by location."""
        location_id = uuid4()
        
        # Create stock levels with different values
        stock_levels_data = [
            {
                **sample_stock_level_data,
                "location_id": location_id,
                "total_value": Decimal("1000.00")
            },
            {
                **sample_stock_level_data,
                "location_id": location_id,
                "total_value": Decimal("2500.00")
            },
            {
                **sample_stock_level_data,
                "location_id": location_id,
                "total_value": Decimal("750.00")
            },
            {
                **sample_stock_level_data,
                "location_id": uuid4(),  # Different location
                "total_value": Decimal("5000.00")
            }
        ]
        
        # Create stock levels
        for data in stock_levels_data:
            stock_level_obj = StockLevel(**data)
            db_session.add(stock_level_obj)
        
        await db_session.commit()
        
        # Get total value for location
        total_value = await crud_instance.get_total_value_by_location(
            db_session,
            location_id=location_id
        )
        
        # Should sum only the first three
        expected_total = Decimal("1000.00") + Decimal("2500.00") + Decimal("750.00")
        assert total_value == expected_total
    
    @pytest.mark.asyncio
    async def test_get_total_value_empty_location(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel
    ):
        """Test total value calculation for location with no stock."""
        total_value = await crud_instance.get_total_value_by_location(
            db_session,
            location_id=uuid4()
        )
        
        assert total_value == Decimal("0")
    
    # UPDATE AVERAGE COST TESTS
    
    @pytest.mark.asyncio
    async def test_update_average_cost_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        stock_level_create_schema: StockLevelCreate
    ):
        """Test updating average cost with new purchase."""
        # Create stock level
        stock_level_obj = StockLevel(**stock_level_create_schema.dict())
        
        db_session.add(stock_level_obj)
        await db_session.commit()
        await db_session.refresh(stock_level_obj)
        
        with patch.object(stock_level_obj, 'update_average_cost') as mock_update:
            result = await crud_instance.update_average_cost(
                db_session,
                stock_level_id=stock_level_obj.id,
                new_quantity=Decimal("20.00"),
                new_cost=Decimal("30.00")
            )
            
            mock_update.assert_called_once_with(
                Decimal("20.00"),
                Decimal("30.00")
            )
            
            assert result.id == stock_level_obj.id
    
    @pytest.mark.asyncio
    async def test_update_average_cost_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel
    ):
        """Test updating average cost for non-existent stock level."""
        with pytest.raises(ValueError, match="Stock level .* not found"):
            await crud_instance.update_average_cost(
                db_session,
                stock_level_id=uuid4(),
                new_quantity=Decimal("10.00"),
                new_cost=Decimal("25.00")
            )
    
    # EDGE CASES AND ERROR HANDLING
    
    @pytest.mark.asyncio
    async def test_rental_operations_stock_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel
    ):
        """Test rental operations with non-existent stock level."""
        rental = RentalOperation(
            item_id=uuid4(),
            location_id=uuid4(),
            quantity=Decimal("5.00"),
            transaction_id=uuid4(),
            customer_id=uuid4()
        )
        
        with pytest.raises(ValueError, match="Stock level .* not found"):
            await crud_instance.process_rental_out(
                db_session,
                stock_level_id=uuid4(),
                rental=rental,
                performed_by=uuid4()
            )
        
        rental_return = RentalReturn(
            item_id=uuid4(),
            location_id=uuid4(),
            quantity=Decimal("3.00"),
            transaction_id=uuid4(),
            customer_id=uuid4()
        )
        
        with pytest.raises(ValueError, match="Stock level .* not found"):
            await crud_instance.process_rental_return(
                db_session,
                stock_level_id=uuid4(),
                rental_return=rental_return,
                performed_by=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_empty_filter_results(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel
    ):
        """Test filtering with no matching results."""
        filter_params = StockLevelFilter(
            item_id=uuid4(),  # Non-existent item
            location_id=uuid4()  # Non-existent location
        )
        
        results = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        
        assert isinstance(results, list)
        assert len(results) == 0
    
    @pytest.mark.asyncio
    async def test_concurrent_updates_with_locking(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockLevel,
        stock_level_create_schema: StockLevelCreate
    ):
        """Test concurrent updates are handled with proper locking."""
        # Create stock level
        stock_level_obj = StockLevel(**stock_level_create_schema.dict())
        
        db_session.add(stock_level_obj)
        await db_session.commit()
        await db_session.refresh(stock_level_obj)
        
        # Mock the with_for_update to ensure it's being used
        with patch('app.crud.inventory.stock_level.select') as mock_select:
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.where.return_value = mock_query
            mock_query.with_for_update.return_value = mock_query
            
            # Mock the result
            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = stock_level_obj
            
            with patch.object(db_session, 'execute', return_value=mock_result), \
                 patch.object(stock_level_obj, 'adjust_quantity'):
                
                adjustment = StockAdjustment(
                    item_id=stock_level_obj.item_id,
                    location_id=stock_level_obj.location_id,
                    adjustment_type="positive",
                    adjustment=Decimal("10.00"),
                    reason="Test"
                )
                
                await crud_instance.adjust_quantity(
                    db_session,
                    stock_level_id=stock_level_obj.id,
                    adjustment=adjustment,
                    performed_by=uuid4()
                )
                
                # Verify that with_for_update was called
                mock_query.with_for_update.assert_called_once()


class TestStockLevelSingleton:
    """Test the singleton instance."""
    
    def test_singleton_instance(self):
        """Test that the singleton instance is properly configured."""
        assert stock_level is not None
        assert isinstance(stock_level, CRUDStockLevel)
        assert stock_level.model == StockLevel