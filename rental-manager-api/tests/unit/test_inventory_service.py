"""
Comprehensive service layer tests for Inventory workflows.

Tests all inventory service methods with edge cases, error conditions, and business logic validation.
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, patch, MagicMock
from typing import List, Dict, Any, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.inventory.inventory_service import InventoryService, inventory_service
from app.models.inventory.enums import (
    StockMovementType,
    InventoryUnitStatus,
    InventoryUnitCondition
)
from app.schemas.inventory.stock_level import (
    StockAdjustment,
    RentalOperation,
    RentalReturn
)
from app.schemas.inventory.inventory_unit import (
    BatchInventoryUnitCreate,
    UnitStatusChange
)


class TestInventoryService:
    """Test suite for InventoryService."""
    
    @pytest_asyncio.fixture
    async def service(self):
        """Create service instance for testing."""
        return InventoryService()
    
    @pytest_asyncio.fixture
    async def mock_stock_level(self):
        """Mock stock level object."""
        stock = MagicMock()
        stock.id = uuid4()
        stock.item_id = uuid4()
        stock.location_id = uuid4()
        stock.quantity_on_hand = Decimal("100.00")
        stock.quantity_available = Decimal("80.00")
        stock.quantity_reserved = Decimal("10.00")
        stock.quantity_on_rent = Decimal("10.00")
        stock.quantity_damaged = Decimal("0.00")
        stock.total_value = Decimal("2500.00")
        stock.reorder_point = Decimal("20.00")
        stock.is_low_stock.return_value = False
        stock.can_fulfill_order.return_value = True
        return stock
    
    @pytest_asyncio.fixture
    async def mock_inventory_unit(self):
        """Mock inventory unit object."""
        unit = MagicMock()
        unit.id = uuid4()
        unit.item_id = uuid4()
        unit.location_id = uuid4()
        unit.sku = "TEST-0001"
        unit.status = InventoryUnitStatus.AVAILABLE.value
        unit.condition = InventoryUnitCondition.GOOD.value
        unit.is_rental_blocked = False
        unit.is_active = True
        unit.next_maintenance_date = None
        unit.warranty_expiry = None
        return unit
    
    @pytest_asyncio.fixture
    async def mock_stock_movement(self):
        """Mock stock movement object."""
        movement = MagicMock()
        movement.id = uuid4()
        movement.movement_type = StockMovementType.PURCHASE
        movement.quantity_change = Decimal("10.00")
        movement.quantity_before = Decimal("90.00")
        movement.quantity_after = Decimal("100.00")
        movement.approved_by_id = None
        return movement
    
    # INITIALIZE STOCK LEVEL TESTS
    
    @pytest.mark.asyncio
    async def test_initialize_stock_level_new(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level,
        mock_stock_movement
    ):
        """Test initializing new stock level."""
        item_id = uuid4()
        location_id = uuid4()
        created_by = uuid4()
        initial_quantity = Decimal("50.00")
        
        # Mock stock level with zero quantity (new)
        mock_stock_level.quantity_on_hand = Decimal("0.00")
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_crud:
            mock_crud.get_or_create.return_value = mock_stock_level
            mock_crud.adjust_quantity.return_value = (mock_stock_level, mock_stock_movement)
            
            result = await service.initialize_stock_level(
                db_session,
                item_id=item_id,
                location_id=location_id,
                initial_quantity=initial_quantity,
                reorder_point=Decimal("10.00"),
                maximum_stock=Decimal("200.00"),
                created_by=created_by
            )
            
            # Verify get_or_create was called
            mock_crud.get_or_create.assert_called_once_with(
                db_session,
                item_id=item_id,
                location_id=location_id,
                created_by=created_by
            )
            
            # Verify adjustment was made
            mock_crud.adjust_quantity.assert_called_once()
            
            # Check adjustment details
            adjust_call = mock_crud.adjust_quantity.call_args
            adjustment = adjust_call[1]['adjustment']
            assert adjustment.adjustment == initial_quantity
            assert adjustment.reason == "Initial stock setup"
            assert adjustment.affect_available is True
            
            # Verify reorder point and max stock were set
            assert mock_stock_level.reorder_point == Decimal("10.00")
            assert mock_stock_level.maximum_stock == Decimal("200.00")
            
            assert result == mock_stock_level
    
    @pytest.mark.asyncio
    async def test_initialize_stock_level_existing(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level
    ):
        """Test initializing existing stock level."""
        item_id = uuid4()
        location_id = uuid4()
        created_by = uuid4()
        
        # Mock stock level with existing quantity
        mock_stock_level.quantity_on_hand = Decimal("25.00")
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_crud:
            mock_crud.get_or_create.return_value = mock_stock_level
            
            result = await service.initialize_stock_level(
                db_session,
                item_id=item_id,
                location_id=location_id,
                initial_quantity=Decimal("30.00"),  # This should be ignored
                created_by=created_by
            )
            
            # Verify no adjustment was made since stock already exists
            mock_crud.adjust_quantity.assert_not_called()
            
            assert result == mock_stock_level
    
    @pytest.mark.asyncio
    async def test_initialize_stock_level_zero_initial(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level
    ):
        """Test initializing stock level with zero initial quantity."""
        item_id = uuid4()
        location_id = uuid4()
        created_by = uuid4()
        
        # Mock new stock level
        mock_stock_level.quantity_on_hand = Decimal("0.00")
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_crud:
            mock_crud.get_or_create.return_value = mock_stock_level
            
            result = await service.initialize_stock_level(
                db_session,
                item_id=item_id,
                location_id=location_id,
                initial_quantity=Decimal("0.00"),
                created_by=created_by
            )
            
            # Verify no adjustment was made for zero quantity
            mock_crud.adjust_quantity.assert_not_called()
            
            assert result == mock_stock_level
    
    # CREATE INVENTORY UNITS TESTS
    
    @pytest.mark.asyncio
    async def test_create_inventory_units_success(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level,
        mock_stock_movement
    ):
        """Test successful inventory units creation."""
        item_id = uuid4()
        location_id = uuid4()
        supplier_id = uuid4()
        created_by = uuid4()
        
        # Mock units
        mock_units = [MagicMock() for _ in range(3)]
        
        with patch('app.services.inventory.inventory_service.inventory_unit') as mock_unit_crud, \
             patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud:
            
            mock_unit_crud.create_batch.return_value = mock_units
            mock_stock_crud.get_or_create.return_value = mock_stock_level
            mock_stock_crud.adjust_quantity.return_value = (mock_stock_level, mock_stock_movement)
            mock_stock_crud.update_average_cost.return_value = mock_stock_level
            
            units, stock, movement = await service.create_inventory_units(
                db_session,
                item_id=item_id,
                location_id=location_id,
                quantity=3,
                unit_cost=Decimal("25.00"),
                serial_numbers=["SN001", "SN002", "SN003"],
                batch_code="BATCH-001",
                supplier_id=supplier_id,
                purchase_order_number="PO-2024-001",
                created_by=created_by
            )
            
            # Verify batch creation
            mock_unit_crud.create_batch.assert_called_once()
            batch_call = mock_unit_crud.create_batch.call_args
            batch_request = batch_call[1]['batch_in']
            assert batch_request.item_id == item_id
            assert batch_request.location_id == location_id
            assert batch_request.quantity == 3
            assert batch_request.purchase_price == Decimal("25.00")
            assert batch_request.serial_numbers == ["SN001", "SN002", "SN003"]
            assert batch_request.batch_code == "BATCH-001"
            
            # Verify stock adjustment
            mock_stock_crud.adjust_quantity.assert_called_once()
            adjust_call = mock_stock_crud.adjust_quantity.call_args
            adjustment = adjust_call[1]['adjustment']
            assert adjustment.adjustment == Decimal("3")
            assert "Purchase receipt - PO: PO-2024-001" in adjustment.reason
            
            # Verify average cost update
            mock_stock_crud.update_average_cost.assert_called_once_with(
                db_session,
                stock_level_id=mock_stock_level.id,
                new_quantity=Decimal("3"),
                new_cost=Decimal("25.00")
            )
            
            assert units == mock_units
            assert stock == mock_stock_level
            assert movement == mock_stock_movement
    
    @pytest.mark.asyncio
    async def test_create_inventory_units_without_serials(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level,
        mock_stock_movement
    ):
        """Test creating units without serial numbers."""
        item_id = uuid4()
        location_id = uuid4()
        created_by = uuid4()
        
        mock_units = [MagicMock(), MagicMock()]
        
        with patch('app.services.inventory.inventory_service.inventory_unit') as mock_unit_crud, \
             patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud:
            
            mock_unit_crud.create_batch.return_value = mock_units
            mock_stock_crud.get_or_create.return_value = mock_stock_level
            mock_stock_crud.adjust_quantity.return_value = (mock_stock_level, mock_stock_movement)
            mock_stock_crud.update_average_cost.return_value = mock_stock_level
            
            units, stock, movement = await service.create_inventory_units(
                db_session,
                item_id=item_id,
                location_id=location_id,
                quantity=2,
                unit_cost=Decimal("15.00"),
                created_by=created_by
            )
            
            # Verify batch creation without serial numbers
            batch_call = mock_unit_crud.create_batch.call_args
            batch_request = batch_call[1]['batch_in']
            assert batch_request.serial_numbers is None
            assert batch_request.batch_code is None
            assert batch_request.supplier_id is None
            assert batch_request.purchase_order_number is None
            
            assert len(units) == 2
    
    # RENTAL CHECKOUT TESTS
    
    @pytest.mark.asyncio
    async def test_process_rental_checkout_success(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level,
        mock_stock_movement
    ):
        """Test successful rental checkout."""
        item_id = uuid4()
        location_id = uuid4()
        customer_id = uuid4()
        transaction_id = uuid4()
        performed_by = uuid4()
        
        # Mock available units
        mock_units = [MagicMock() for _ in range(2)]
        for i, unit in enumerate(mock_units):
            unit.id = uuid4()
            unit.sku = f"UNIT-{i+1:04d}"
        
        # Mock stock level methods
        mock_stock_level.can_fulfill_order.return_value = True
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud, \
             patch('app.services.inventory.inventory_service.inventory_unit') as mock_unit_crud:
            
            mock_stock_crud.get_by_item_location.return_value = mock_stock_level
            mock_stock_crud.process_rental_out.return_value = (mock_stock_level, mock_stock_movement)
            mock_unit_crud.get_available_for_rental.return_value = mock_units
            mock_unit_crud.change_status.return_value = MagicMock()
            
            units, stock, movement = await service.process_rental_checkout(
                db_session,
                item_id=item_id,
                location_id=location_id,
                quantity=Decimal("2"),
                customer_id=customer_id,
                transaction_id=transaction_id,
                performed_by=performed_by
            )
            
            # Verify stock availability check
            mock_stock_level.can_fulfill_order.assert_called_once_with(Decimal("2"))
            
            # Verify units were fetched
            mock_unit_crud.get_available_for_rental.assert_called_once_with(
                db_session,
                item_id=item_id,
                location_id=location_id,
                quantity_needed=2
            )
            
            # Verify units were marked as rented
            assert mock_unit_crud.change_status.call_count == 2
            
            # Check status change calls
            for call in mock_unit_crud.change_status.call_args_list:
                status_change = call[1]['status_change']
                assert status_change.status == InventoryUnitStatus.RENTED
                assert status_change.customer_id == customer_id
            
            # Verify stock level update
            mock_stock_crud.process_rental_out.assert_called_once()
            rental_call = mock_stock_crud.process_rental_out.call_args
            rental_op = rental_call[1]['rental']
            assert rental_op.quantity == Decimal("2")
            assert rental_op.customer_id == customer_id
            assert rental_op.transaction_id == transaction_id
            
            assert len(units) == 2
            assert stock == mock_stock_level
            assert movement == mock_stock_movement
    
    @pytest.mark.asyncio
    async def test_process_rental_checkout_no_stock(
        self, 
        db_session: AsyncSession,
        service: InventoryService
    ):
        """Test rental checkout when no stock level exists."""
        item_id = uuid4()
        location_id = uuid4()
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud:
            mock_stock_crud.get_by_item_location.return_value = None
            
            with pytest.raises(ValueError, match="No stock found for item"):
                await service.process_rental_checkout(
                    db_session,
                    item_id=item_id,
                    location_id=location_id,
                    quantity=Decimal("1"),
                    customer_id=uuid4(),
                    transaction_id=uuid4(),
                    performed_by=uuid4()
                )
    
    @pytest.mark.asyncio
    async def test_process_rental_checkout_insufficient_stock(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level
    ):
        """Test rental checkout with insufficient stock."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Mock insufficient stock
        mock_stock_level.can_fulfill_order.return_value = False
        mock_stock_level.quantity_available = Decimal("1.00")
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud:
            mock_stock_crud.get_by_item_location.return_value = mock_stock_level
            
            with pytest.raises(ValueError, match="Insufficient stock"):
                await service.process_rental_checkout(
                    db_session,
                    item_id=item_id,
                    location_id=location_id,
                    quantity=Decimal("5"),  # More than available
                    customer_id=uuid4(),
                    transaction_id=uuid4(),
                    performed_by=uuid4()
                )
    
    @pytest.mark.asyncio
    async def test_process_rental_checkout_insufficient_units(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level
    ):
        """Test rental checkout with insufficient available units."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Mock sufficient stock level but insufficient units
        mock_stock_level.can_fulfill_order.return_value = True
        mock_units = [MagicMock()]  # Only 1 unit available
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud, \
             patch('app.services.inventory.inventory_service.inventory_unit') as mock_unit_crud:
            
            mock_stock_crud.get_by_item_location.return_value = mock_stock_level
            mock_unit_crud.get_available_for_rental.return_value = mock_units
            
            with pytest.raises(ValueError, match="Insufficient units"):
                await service.process_rental_checkout(
                    db_session,
                    item_id=item_id,
                    location_id=location_id,
                    quantity=Decimal("3"),  # Need 3, only 1 available
                    customer_id=uuid4(),
                    transaction_id=uuid4(),
                    performed_by=uuid4()
                )
    
    # RENTAL RETURN TESTS
    
    @pytest.mark.asyncio
    async def test_process_rental_return_success(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level,
        mock_stock_movement
    ):
        """Test successful rental return."""
        item_id = uuid4()
        location_id = uuid4()
        transaction_id = uuid4()
        performed_by = uuid4()
        
        # Mock units being returned
        unit_ids = [uuid4(), uuid4(), uuid4()]
        mock_units = []
        for unit_id in unit_ids:
            unit = MagicMock()
            unit.id = unit_id
            unit.sku = f"UNIT-{unit_id.hex[:8]}"
            mock_units.append(unit)
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud, \
             patch('app.services.inventory.inventory_service.inventory_unit') as mock_unit_crud:
            
            mock_stock_crud.get_by_item_location.return_value = mock_stock_level
            mock_stock_crud.process_rental_return.return_value = (mock_stock_level, mock_stock_movement)
            mock_unit_crud.get.side_effect = mock_units
            mock_unit_crud.change_status.return_value = MagicMock()
            
            units, stock, movement = await service.process_rental_return(
                db_session,
                item_id=item_id,
                location_id=location_id,
                quantity=Decimal("3"),
                damaged_quantity=Decimal("1"),  # 1 damaged, 2 good
                transaction_id=transaction_id,
                unit_ids=unit_ids,
                condition_notes="Minor damage to first unit",
                performed_by=performed_by
            )
            
            # Verify units were retrieved
            assert mock_unit_crud.get.call_count == 3
            
            # Verify status changes
            assert mock_unit_crud.change_status.call_count == 3
            
            # Check status change calls - first should be damaged
            first_call = mock_unit_crud.change_status.call_args_list[0]
            first_status = first_call[1]['status_change']
            assert first_status.status == InventoryUnitStatus.DAMAGED
            assert first_status.new_condition == InventoryUnitCondition.DAMAGED
            
            # Others should be available
            for call in mock_unit_crud.change_status.call_args_list[1:]:
                status_change = call[1]['status_change']
                assert status_change.status == InventoryUnitStatus.AVAILABLE
                assert status_change.new_condition == InventoryUnitCondition.GOOD
            
            # Verify stock level update
            mock_stock_crud.process_rental_return.assert_called_once()
            return_call = mock_stock_crud.process_rental_return.call_args
            rental_return = return_call[1]['rental_return']
            assert rental_return.quantity == Decimal("3")
            assert rental_return.damaged_quantity == Decimal("1")
            assert rental_return.transaction_id == transaction_id
            assert rental_return.condition_notes == "Minor damage to first unit"
            
            assert len(units) == 3
            assert stock == mock_stock_level
            assert movement == mock_stock_movement
    
    @pytest.mark.asyncio
    async def test_process_rental_return_no_damage(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level,
        mock_stock_movement
    ):
        """Test rental return with no damage."""
        item_id = uuid4()
        location_id = uuid4()
        
        unit_ids = [uuid4(), uuid4()]
        mock_units = [MagicMock() for _ in unit_ids]
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud, \
             patch('app.services.inventory.inventory_service.inventory_unit') as mock_unit_crud:
            
            mock_stock_crud.get_by_item_location.return_value = mock_stock_level
            mock_stock_crud.process_rental_return.return_value = (mock_stock_level, mock_stock_movement)
            mock_unit_crud.get.side_effect = mock_units
            mock_unit_crud.change_status.return_value = MagicMock()
            
            units, stock, movement = await service.process_rental_return(
                db_session,
                item_id=item_id,
                location_id=location_id,
                quantity=Decimal("2"),
                damaged_quantity=Decimal("0"),  # No damage
                transaction_id=uuid4(),
                unit_ids=unit_ids,
                performed_by=uuid4()
            )
            
            # Verify all units were marked as available/good
            for call in mock_unit_crud.change_status.call_args_list:
                status_change = call[1]['status_change']
                assert status_change.status == InventoryUnitStatus.AVAILABLE
                assert status_change.new_condition == InventoryUnitCondition.GOOD
    
    @pytest.mark.asyncio
    async def test_process_rental_return_missing_units(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level,
        mock_stock_movement
    ):
        """Test rental return with some units not found."""
        item_id = uuid4()
        location_id = uuid4()
        
        unit_ids = [uuid4(), uuid4(), uuid4()]
        # Only return 2 units, third returns None
        mock_units = [MagicMock(), MagicMock(), None]
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud, \
             patch('app.services.inventory.inventory_service.inventory_unit') as mock_unit_crud:
            
            mock_stock_crud.get_by_item_location.return_value = mock_stock_level
            mock_stock_crud.process_rental_return.return_value = (mock_stock_level, mock_stock_movement)
            mock_unit_crud.get.side_effect = mock_units
            mock_unit_crud.change_status.return_value = MagicMock()
            
            units, stock, movement = await service.process_rental_return(
                db_session,
                item_id=item_id,
                location_id=location_id,
                quantity=Decimal("3"),
                damaged_quantity=Decimal("0"),
                transaction_id=uuid4(),
                unit_ids=unit_ids,
                performed_by=uuid4()
            )
            
            # Should only process 2 units (third was None)
            assert mock_unit_crud.change_status.call_count == 2
            assert len(units) == 2
    
    # STOCK TRANSFER TESTS
    
    @pytest.mark.asyncio
    async def test_transfer_stock_success(
        self, 
        db_session: AsyncSession,
        service: InventoryService
    ):
        """Test successful stock transfer."""
        item_id = uuid4()
        from_location_id = uuid4()
        to_location_id = uuid4()
        performed_by = uuid4()
        
        # Mock source and destination stock levels
        from_stock = MagicMock()
        from_stock.id = uuid4()
        from_stock.quantity_available = Decimal("50.00")
        
        to_stock = MagicMock()
        to_stock.id = uuid4()
        
        # Mock movements
        out_movement = MagicMock()
        in_movement = MagicMock()
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud:
            mock_stock_crud.get_by_item_location.return_value = from_stock
            mock_stock_crud.get_or_create.return_value = to_stock
            mock_stock_crud.adjust_quantity.side_effect = [
                (from_stock, out_movement),
                (to_stock, in_movement)
            ]
            
            from_result, to_result, movements = await service.transfer_stock(
                db_session,
                item_id=item_id,
                from_location_id=from_location_id,
                to_location_id=to_location_id,
                quantity=Decimal("20.00"),
                transfer_reason="Restock warehouse B",
                performed_by=performed_by
            )
            
            # Verify source stock was checked
            mock_stock_crud.get_by_item_location.assert_called_once_with(
                db_session,
                item_id=item_id,
                location_id=from_location_id
            )
            
            # Verify destination stock was created/retrieved
            mock_stock_crud.get_or_create.assert_called_once_with(
                db_session,
                item_id=item_id,
                location_id=to_location_id,
                created_by=performed_by
            )
            
            # Verify two adjustments were made
            assert mock_stock_crud.adjust_quantity.call_count == 2
            
            # Check out adjustment
            out_call = mock_stock_crud.adjust_quantity.call_args_list[0]
            out_adjustment = out_call[1]['adjustment']
            assert out_adjustment.adjustment == Decimal("-20.00")
            assert "Transfer out: Restock warehouse B" in out_adjustment.reason
            
            # Check in adjustment
            in_call = mock_stock_crud.adjust_quantity.call_args_list[1]
            in_adjustment = in_call[1]['adjustment']
            assert in_adjustment.adjustment == Decimal("20.00")
            assert "Transfer in: Restock warehouse B" in in_adjustment.reason
            
            # Verify movement types were set
            assert out_movement.movement_type == StockMovementType.TRANSFER_OUT
            assert in_movement.movement_type == StockMovementType.TRANSFER_IN
            
            assert from_result == from_stock
            assert to_result == to_stock
            assert movements == [out_movement, in_movement]
    
    @pytest.mark.asyncio
    async def test_transfer_stock_no_source(
        self, 
        db_session: AsyncSession,
        service: InventoryService
    ):
        """Test stock transfer with no source stock."""
        item_id = uuid4()
        from_location_id = uuid4()
        to_location_id = uuid4()
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud:
            mock_stock_crud.get_by_item_location.return_value = None
            
            with pytest.raises(ValueError, match="No stock at source location"):
                await service.transfer_stock(
                    db_session,
                    item_id=item_id,
                    from_location_id=from_location_id,
                    to_location_id=to_location_id,
                    quantity=Decimal("10.00"),
                    transfer_reason="Test transfer",
                    performed_by=uuid4()
                )
    
    @pytest.mark.asyncio
    async def test_transfer_stock_insufficient_source(
        self, 
        db_session: AsyncSession,
        service: InventoryService
    ):
        """Test stock transfer with insufficient source quantity."""
        item_id = uuid4()
        from_location_id = uuid4()
        to_location_id = uuid4()
        
        from_stock = MagicMock()
        from_stock.quantity_available = Decimal("5.00")  # Less than requested
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud:
            mock_stock_crud.get_by_item_location.return_value = from_stock
            
            with pytest.raises(ValueError, match="Insufficient stock at source"):
                await service.transfer_stock(
                    db_session,
                    item_id=item_id,
                    from_location_id=from_location_id,
                    to_location_id=to_location_id,
                    quantity=Decimal("10.00"),  # More than available
                    transfer_reason="Test transfer",
                    performed_by=uuid4()
                )
    
    # STOCK SUMMARY TESTS
    
    @pytest.mark.asyncio
    async def test_get_stock_summary_item_and_location(
        self, 
        db_session: AsyncSession,
        service: InventoryService
    ):
        """Test stock summary for specific item and location."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Mock single stock level
        mock_stock = MagicMock()
        mock_stock.item_id = item_id
        mock_stock.location_id = location_id
        mock_stock.quantity_on_hand = Decimal("100.00")
        mock_stock.quantity_available = Decimal("80.00")
        mock_stock.quantity_reserved = Decimal("10.00")
        mock_stock.quantity_on_rent = Decimal("10.00")
        mock_stock.quantity_damaged = Decimal("0.00")
        mock_stock.total_value = Decimal("2500.00")
        mock_stock.is_low_stock.return_value = False
        
        mock_movement_summary = {
            'total_movements': 10,
            'total_increase': 120.0,
            'total_decrease': 20.0,
            'net_change': 100.0
        }
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud, \
             patch('app.services.inventory.inventory_service.stock_movement') as mock_movement_crud:
            
            mock_stock_crud.get_by_item_location.return_value = mock_stock
            mock_movement_crud.get_summary.return_value = mock_movement_summary
            
            summary = await service.get_stock_summary(
                db_session,
                item_id=item_id,
                location_id=location_id
            )
            
            assert summary['total_on_hand'] == 100.0
            assert summary['total_available'] == 80.0
            assert summary['total_reserved'] == 10.0
            assert summary['total_on_rent'] == 10.0
            assert summary['total_damaged'] == 0.0
            assert summary['total_value'] == 2500.0
            assert summary['location_count'] == 1
            assert summary['item_count'] == 1
            assert summary['low_stock_count'] == 0
            assert summary['utilization_rate'] == 10.0  # 10/100 * 100
            assert summary['availability_rate'] == 80.0  # 80/100 * 100
            assert summary['movement_summary'] == mock_movement_summary
    
    @pytest.mark.asyncio
    async def test_get_stock_summary_by_item(
        self, 
        db_session: AsyncSession,
        service: InventoryService
    ):
        """Test stock summary for item across locations."""
        item_id = uuid4()
        
        # Mock multiple stock levels
        mock_stocks = []
        for i in range(3):
            stock = MagicMock()
            stock.item_id = item_id
            stock.location_id = uuid4()
            stock.quantity_on_hand = Decimal(f"{50 + i * 10}.00")
            stock.quantity_available = Decimal(f"{40 + i * 10}.00")
            stock.quantity_reserved = Decimal("5.00")
            stock.quantity_on_rent = Decimal("5.00")
            stock.quantity_damaged = Decimal("0.00")
            stock.total_value = Decimal(f"{1000 + i * 500}.00")
            stock.is_low_stock.return_value = i == 0  # First one is low stock
            mock_stocks.append(stock)
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud, \
             patch('app.services.inventory.inventory_service.stock_movement') as mock_movement_crud:
            
            mock_stock_crud.get_by_item.return_value = mock_stocks
            mock_movement_crud.get_summary.return_value = {}
            
            summary = await service.get_stock_summary(
                db_session,
                item_id=item_id
            )
            
            # Total across all locations
            assert summary['total_on_hand'] == 180.0  # 50 + 60 + 70
            assert summary['total_available'] == 150.0  # 40 + 50 + 60
            assert summary['total_reserved'] == 15.0  # 3 * 5
            assert summary['total_on_rent'] == 15.0  # 3 * 5
            assert summary['total_value'] == 3000.0  # 1000 + 1500 + 2000
            assert summary['location_count'] == 3
            assert summary['item_count'] == 1
            assert summary['low_stock_count'] == 1
    
    @pytest.mark.asyncio
    async def test_get_stock_summary_zero_totals(
        self, 
        db_session: AsyncSession,
        service: InventoryService
    ):
        """Test stock summary with zero total quantities."""
        # Mock empty stock levels
        mock_stocks = []
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud, \
             patch('app.services.inventory.inventory_service.stock_movement') as mock_movement_crud:
            
            mock_stock_crud.get_multi.return_value = mock_stocks
            mock_movement_crud.get_summary.return_value = {}
            
            summary = await service.get_stock_summary(db_session)
            
            assert summary['total_on_hand'] == 0.0
            assert summary['total_available'] == 0.0
            assert summary['utilization_rate'] == 0.0  # No division by zero
            assert summary['availability_rate'] == 0.0
    
    # STOCK ADJUSTMENT TESTS
    
    @pytest.mark.asyncio
    async def test_perform_stock_adjustment_success(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level,
        mock_stock_movement
    ):
        """Test successful stock adjustment."""
        item_id = uuid4()
        location_id = uuid4()
        performed_by = uuid4()
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud:
            mock_stock_crud.get_or_create.return_value = mock_stock_level
            mock_stock_crud.adjust_quantity.return_value = (mock_stock_level, mock_stock_movement)
            
            stock, movement = await service.perform_stock_adjustment(
                db_session,
                item_id=item_id,
                location_id=location_id,
                adjustment_quantity=Decimal("15.00"),
                reason="Physical count correction",
                notes="Found additional items in storage",
                performed_by=performed_by,
                requires_approval=True
            )
            
            # Verify adjustment was created
            mock_stock_crud.adjust_quantity.assert_called_once()
            adjust_call = mock_stock_crud.adjust_quantity.call_args
            adjustment = adjust_call[1]['adjustment']
            assert adjustment.adjustment == Decimal("15.00")
            assert adjustment.reason == "Physical count correction"
            assert adjustment.notes == "Found additional items in storage"
            assert adjustment.performed_by_id == performed_by
            
            # Verify approval requirement
            assert mock_stock_movement.approved_by_id is None
            
            assert stock == mock_stock_level
            assert movement == mock_stock_movement
    
    @pytest.mark.asyncio
    async def test_perform_stock_adjustment_no_approval(
        self, 
        db_session: AsyncSession,
        service: InventoryService,
        mock_stock_level,
        mock_stock_movement
    ):
        """Test stock adjustment not requiring approval."""
        item_id = uuid4()
        location_id = uuid4()
        performed_by = uuid4()
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud:
            mock_stock_crud.get_or_create.return_value = mock_stock_level
            mock_stock_crud.adjust_quantity.return_value = (mock_stock_level, mock_stock_movement)
            
            stock, movement = await service.perform_stock_adjustment(
                db_session,
                item_id=item_id,
                location_id=location_id,
                adjustment_quantity=Decimal("-5.00"),
                reason="Damaged items removal",
                performed_by=performed_by,
                requires_approval=False
            )
            
            # Approval field should not be modified
            # (mock doesn't change approved_by_id unless we explicitly set it)
    
    # INVENTORY ALERTS TESTS
    
    @pytest.mark.asyncio
    async def test_get_inventory_alerts_comprehensive(
        self, 
        db_session: AsyncSession,
        service: InventoryService
    ):
        """Test comprehensive inventory alerts generation."""
        location_id = uuid4()
        
        # Mock low stock items
        low_stock_item = MagicMock()
        low_stock_item.item_id = uuid4()
        low_stock_item.location_id = location_id
        low_stock_item.quantity_available = Decimal("2.00")
        low_stock_item.reorder_point = Decimal("5.00")
        
        out_of_stock_item = MagicMock()
        out_of_stock_item.item_id = uuid4()
        out_of_stock_item.location_id = location_id
        out_of_stock_item.quantity_available = Decimal("0.00")
        out_of_stock_item.reorder_point = Decimal("10.00")
        
        # Mock maintenance due units
        maintenance_unit = MagicMock()
        maintenance_unit.id = uuid4()
        maintenance_unit.item_id = uuid4()
        maintenance_unit.location_id = location_id
        maintenance_unit.sku = "MAINT-001"
        maintenance_unit.next_maintenance_date = datetime.now() + timedelta(days=3)
        
        # Mock warranty expiring units
        warranty_unit = MagicMock()
        warranty_unit.id = uuid4()
        warranty_unit.item_id = uuid4()
        warranty_unit.location_id = location_id
        warranty_unit.sku = "WARR-001"
        warranty_unit.warranty_expiry = datetime.now().date() + timedelta(days=15)
        
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud, \
             patch('app.services.inventory.inventory_service.inventory_unit') as mock_unit_crud:
            
            mock_stock_crud.get_low_stock_items.return_value = [low_stock_item, out_of_stock_item]
            mock_unit_crud.get_maintenance_due.return_value = [maintenance_unit]
            mock_unit_crud.get_expiring_warranties.return_value = [warranty_unit]
            
            alerts = await service.get_inventory_alerts(
                db_session,
                location_id=location_id
            )
            
            assert len(alerts) == 4
            
            # Check alert types
            alert_types = [alert['alert_type'] for alert in alerts]
            assert 'LOW_STOCK' in alert_types
            assert 'MAINTENANCE_DUE' in alert_types
            assert 'WARRANTY_EXPIRING' in alert_types
            
            # Check severity levels
            low_stock_alerts = [a for a in alerts if a['alert_type'] == 'LOW_STOCK']
            assert len(low_stock_alerts) == 2
            
            # Out of stock should be high severity
            high_severity_alerts = [a for a in low_stock_alerts if a['severity'] == 'high']
            assert len(high_severity_alerts) == 1
            assert high_severity_alerts[0]['quantity'] == 0.0
            
            # Low stock should be medium severity
            medium_severity_alerts = [a for a in low_stock_alerts if a['severity'] == 'medium']
            assert len(medium_severity_alerts) == 1
            assert medium_severity_alerts[0]['quantity'] == 2.0
            
            # Check maintenance alert
            maintenance_alerts = [a for a in alerts if a['alert_type'] == 'MAINTENANCE_DUE']
            assert len(maintenance_alerts) == 1
            assert maintenance_alerts[0]['severity'] == 'medium'
            assert 'MAINT-001' in maintenance_alerts[0]['message']
            
            # Check warranty alert
            warranty_alerts = [a for a in alerts if a['alert_type'] == 'WARRANTY_EXPIRING']
            assert len(warranty_alerts) == 1
            assert warranty_alerts[0]['severity'] == 'low'
            assert 'WARR-001' in warranty_alerts[0]['message']
    
    @pytest.mark.asyncio
    async def test_get_inventory_alerts_no_alerts(
        self, 
        db_session: AsyncSession,
        service: InventoryService
    ):
        """Test inventory alerts when no alerts exist."""
        with patch('app.services.inventory.inventory_service.stock_level') as mock_stock_crud, \
             patch('app.services.inventory.inventory_service.inventory_unit') as mock_unit_crud:
            
            mock_stock_crud.get_low_stock_items.return_value = []
            mock_unit_crud.get_maintenance_due.return_value = []
            mock_unit_crud.get_expiring_warranties.return_value = []
            
            alerts = await service.get_inventory_alerts(db_session)
            
            assert alerts == []


class TestInventoryServiceSingleton:
    """Test the singleton instance."""
    
    def test_singleton_instance(self):
        """Test that the singleton instance exists."""
        assert inventory_service is not None
        assert isinstance(inventory_service, InventoryService)