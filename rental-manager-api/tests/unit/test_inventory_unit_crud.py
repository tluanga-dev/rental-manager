"""
Comprehensive CRUD tests for InventoryUnit.

Tests all CRUD operations with edge cases, error conditions, and business logic validation.
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, patch
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.crud.inventory.inventory_unit import CRUDInventoryUnit, inventory_unit
from app.models.inventory.inventory_unit import InventoryUnit
from app.models.inventory.enums import (
    InventoryUnitStatus,
    InventoryUnitCondition,
    get_acceptable_rental_conditions,
    get_rentable_statuses
)
from app.schemas.inventory.inventory_unit import (
    InventoryUnitCreate,
    InventoryUnitUpdate,
    InventoryUnitFilter,
    BatchInventoryUnitCreate,
    UnitStatusChange,
    UnitTransfer,
    RentalBlock,
    MaintenanceSchedule
)


class TestCRUDInventoryUnit:
    """Test suite for InventoryUnit CRUD operations."""
    
    @pytest_asyncio.fixture
    async def crud_instance(self):
        """Create CRUD instance for testing."""
        return CRUDInventoryUnit(InventoryUnit)
    
    @pytest_asyncio.fixture
    async def sample_unit_data(self):
        """Sample inventory unit data for testing."""
        return {
            "item_id": uuid4(),
            "location_id": uuid4(),
            "sku": f"UNIT-{uuid4().hex[:8].upper()}",
            "serial_number": f"SN{uuid4().hex[:12].upper()}",
            "barcode": f"BC{uuid4().hex[:16].upper()}",
            "batch_code": f"BATCH-{datetime.now().strftime('%Y%m%d')}-001",
            "purchase_date": datetime.now().date(),
            "purchase_price": Decimal("299.99"),
            "sale_price": Decimal("399.99"),
            "rental_rate_per_period": Decimal("29.99"),
            "security_deposit": Decimal("100.00"),
            "supplier_id": uuid4(),
            "purchase_order_number": "PO-2024-001",
            "warranty_expiry": datetime.now().date() + timedelta(days=365),
            "quantity": Decimal("1.00"),
            "notes": "Test unit for testing purposes"
        }
    
    @pytest_asyncio.fixture
    async def unit_create_schema(self, sample_unit_data):
        """Create InventoryUnitCreate schema."""
        return InventoryUnitCreate(**sample_unit_data)
    
    @pytest_asyncio.fixture
    async def batch_create_data(self, sample_unit_data):
        """Sample batch creation data."""
        return {
            "item_id": sample_unit_data["item_id"],
            "location_id": sample_unit_data["location_id"],
            "quantity": 5,
            "purchase_date": sample_unit_data["purchase_date"],
            "purchase_price": sample_unit_data["purchase_price"],
            "sale_price": sample_unit_data["sale_price"],
            "rental_rate_per_period": sample_unit_data["rental_rate_per_period"],
            "security_deposit": sample_unit_data["security_deposit"],
            "supplier_id": sample_unit_data["supplier_id"],
            "purchase_order_number": sample_unit_data["purchase_order_number"],
            "warranty_expiry": sample_unit_data["warranty_expiry"],
            "serial_numbers": [f"SN{i:06d}" for i in range(1, 6)]
        }
    
    # CREATE TESTS
    
    @pytest.mark.asyncio
    async def test_create_with_sku_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test successful unit creation with SKU."""
        created_by = uuid4()
        
        # Mock the validate method to avoid model validation issues
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=created_by,
                auto_generate_sku=False
            )
        
        # Assertions
        assert unit.id is not None
        assert unit.sku == unit_create_schema.sku
        assert unit.serial_number == unit_create_schema.serial_number
        assert unit.purchase_price == unit_create_schema.purchase_price
        assert unit.created_by == created_by
        assert unit.updated_by == created_by
        assert unit.created_at is not None
    
    @pytest.mark.asyncio
    async def test_create_with_auto_generate_sku(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        sample_unit_data
    ):
        """Test unit creation with automatic SKU generation."""
        # Remove SKU to trigger auto-generation
        sample_unit_data.pop('sku', None)
        unit_in = InventoryUnitCreate(**sample_unit_data)
        
        # Mock the generate_sku method
        with patch.object(crud_instance, 'generate_sku', return_value="AUTO-GENERATED-SKU"), \
             patch.object(InventoryUnit, 'validate'):
            
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_in,
                created_by=uuid4(),
                auto_generate_sku=True
            )
        
        assert unit.sku == "AUTO-GENERATED-SKU"
    
    @pytest.mark.asyncio
    async def test_create_with_duplicate_serial_number(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test error handling for duplicate serial number."""
        # Mock IntegrityError with serial number constraint
        with patch.object(db_session, 'flush', side_effect=IntegrityError("statement", "params", "serial_number")):
            with pytest.raises(ValueError, match="Serial number .* already exists"):
                await crud_instance.create_with_sku(
                    db_session,
                    unit_in=unit_create_schema,
                    created_by=uuid4()
                )
    
    @pytest.mark.asyncio
    async def test_create_with_duplicate_sku(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test error handling for duplicate SKU."""
        # Mock IntegrityError with SKU constraint
        with patch.object(db_session, 'flush', side_effect=IntegrityError("statement", "params", "sku")):
            with pytest.raises(ValueError, match="SKU .* already exists"):
                await crud_instance.create_with_sku(
                    db_session,
                    unit_in=unit_create_schema,
                    created_by=uuid4()
                )
    
    @pytest.mark.asyncio
    async def test_create_batch_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        batch_create_data
    ):
        """Test successful batch creation."""
        batch_in = BatchInventoryUnitCreate(**batch_create_data)
        created_by = uuid4()
        
        # Mock required methods
        with patch.object(crud_instance, 'generate_batch_code', return_value="BATCH-20241122-ABCD1234"), \
             patch.object(crud_instance, 'generate_sku', side_effect=lambda db, item_id, suffix: f"SKU-{suffix}"), \
             patch.object(InventoryUnit, 'validate'):
            
            units = await crud_instance.create_batch(
                db_session,
                batch_in=batch_in,
                created_by=created_by
            )
        
        assert len(units) == 5
        assert all(unit.batch_code == "BATCH-20241122-ABCD1234" for unit in units)
        assert all(unit.created_by == created_by for unit in units)
        assert all(unit.quantity == Decimal("1") for unit in units)
        
        # Check serial numbers are assigned correctly
        serial_numbers = [unit.serial_number for unit in units]
        assert serial_numbers == batch_create_data["serial_numbers"]
    
    @pytest.mark.asyncio
    async def test_create_batch_with_auto_generate_batch_code(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        batch_create_data
    ):
        """Test batch creation with auto-generated batch code."""
        # Remove batch_code to trigger auto-generation
        batch_create_data.pop('batch_code', None)
        batch_in = BatchInventoryUnitCreate(**batch_create_data)
        
        with patch.object(crud_instance, 'generate_batch_code', return_value="AUTO-BATCH-CODE"), \
             patch.object(crud_instance, 'generate_sku', side_effect=lambda db, item_id, suffix: f"SKU-{suffix}"), \
             patch.object(InventoryUnit, 'validate'):
            
            units = await crud_instance.create_batch(
                db_session,
                batch_in=batch_in,
                created_by=uuid4()
            )
        
        assert all(unit.batch_code == "AUTO-BATCH-CODE" for unit in units)
    
    @pytest.mark.asyncio
    async def test_create_batch_with_fewer_serial_numbers(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        batch_create_data
    ):
        """Test batch creation with fewer serial numbers than quantity."""
        batch_create_data["quantity"] = 7
        batch_create_data["serial_numbers"] = ["SN001", "SN002", "SN003"]  # Only 3 serial numbers
        batch_in = BatchInventoryUnitCreate(**batch_create_data)
        
        with patch.object(crud_instance, 'generate_batch_code', return_value="BATCH-TEST"), \
             patch.object(crud_instance, 'generate_sku', side_effect=lambda db, item_id, suffix: f"SKU-{suffix}"), \
             patch.object(InventoryUnit, 'validate'):
            
            units = await crud_instance.create_batch(
                db_session,
                batch_in=batch_in,
                created_by=uuid4()
            )
        
        # First 3 should have provided serial numbers, rest should be None
        assert units[0].serial_number == "SN001"
        assert units[1].serial_number == "SN002"
        assert units[2].serial_number == "SN003"
        assert units[3].serial_number is None
        assert units[4].serial_number is None
    
    # READ TESTS
    
    @pytest.mark.asyncio
    async def test_get_by_sku(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test getting unit by SKU."""
        # Create a unit first
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        # Retrieve by SKU
        found_unit = await crud_instance.get_by_sku(
            db_session,
            sku=unit.sku
        )
        
        assert found_unit is not None
        assert found_unit.id == unit.id
        assert found_unit.sku == unit.sku
    
    @pytest.mark.asyncio
    async def test_get_by_sku_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit
    ):
        """Test getting unit by non-existent SKU."""
        unit = await crud_instance.get_by_sku(
            db_session,
            sku="NON-EXISTENT-SKU"
        )
        
        assert unit is None
    
    @pytest.mark.asyncio
    async def test_get_by_serial_number(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test getting unit by serial number."""
        # Create a unit first
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        # Retrieve by serial number
        found_unit = await crud_instance.get_by_serial_number(
            db_session,
            serial_number=unit.serial_number
        )
        
        assert found_unit is not None
        assert found_unit.id == unit.id
        assert found_unit.serial_number == unit.serial_number
    
    @pytest.mark.asyncio
    async def test_get_by_batch_code(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        batch_create_data
    ):
        """Test getting units by batch code."""
        batch_in = BatchInventoryUnitCreate(**batch_create_data)
        batch_code = "TEST-BATCH-001"
        
        with patch.object(crud_instance, 'generate_batch_code', return_value=batch_code), \
             patch.object(crud_instance, 'generate_sku', side_effect=lambda db, item_id, suffix: f"SKU-{suffix}"), \
             patch.object(InventoryUnit, 'validate'):
            
            await crud_instance.create_batch(
                db_session,
                batch_in=batch_in,
                created_by=uuid4()
            )
        
        # Retrieve by batch code
        units = await crud_instance.get_by_batch_code(
            db_session,
            batch_code=batch_code
        )
        
        assert len(units) == 5
        assert all(unit.batch_code == batch_code for unit in units)
    
    @pytest.mark.asyncio
    async def test_get_by_batch_code_with_pagination(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        batch_create_data
    ):
        """Test pagination in get_by_batch_code."""
        batch_create_data["quantity"] = 10
        batch_in = BatchInventoryUnitCreate(**batch_create_data)
        batch_code = "TEST-BATCH-PAGINATION"
        
        with patch.object(crud_instance, 'generate_batch_code', return_value=batch_code), \
             patch.object(crud_instance, 'generate_sku', side_effect=lambda db, item_id, suffix: f"SKU-{suffix}"), \
             patch.object(InventoryUnit, 'validate'):
            
            await crud_instance.create_batch(
                db_session,
                batch_in=batch_in,
                created_by=uuid4()
            )
        
        # Test pagination
        page1 = await crud_instance.get_by_batch_code(
            db_session,
            batch_code=batch_code,
            skip=0,
            limit=3
        )
        
        page2 = await crud_instance.get_by_batch_code(
            db_session,
            batch_code=batch_code,
            skip=3,
            limit=3
        )
        
        assert len(page1) == 3
        assert len(page2) == 3
        
        # Ensure different units
        page1_ids = [unit.id for unit in page1]
        page2_ids = [unit.id for unit in page2]
        assert len(set(page1_ids) & set(page2_ids)) == 0
    
    @pytest.mark.asyncio
    async def test_get_available_for_rental(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        sample_unit_data
    ):
        """Test getting available units for rental."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Create units with different statuses
        units_data = [
            {
                **sample_unit_data,
                "item_id": item_id,
                "location_id": location_id,
                "sku": f"AVAILABLE-001",
                "status": InventoryUnitStatus.AVAILABLE,
                "condition": InventoryUnitCondition.EXCELLENT,
                "is_rental_blocked": False,
                "is_active": True
            },
            {
                **sample_unit_data,
                "item_id": item_id,
                "location_id": location_id,
                "sku": f"AVAILABLE-002",
                "status": InventoryUnitStatus.AVAILABLE,
                "condition": InventoryUnitCondition.GOOD,
                "is_rental_blocked": False,
                "is_active": True
            },
            {
                **sample_unit_data,
                "item_id": item_id,
                "location_id": location_id,
                "sku": f"RENTED-001",
                "status": InventoryUnitStatus.RENTED,
                "condition": InventoryUnitCondition.GOOD,
                "is_rental_blocked": False,
                "is_active": True
            },
            {
                **sample_unit_data,
                "item_id": item_id,
                "location_id": location_id,
                "sku": f"BLOCKED-001",
                "status": InventoryUnitStatus.AVAILABLE,
                "condition": InventoryUnitCondition.GOOD,
                "is_rental_blocked": True,
                "is_active": True
            }
        ]
        
        # Create units
        for data in units_data:
            unit_in = InventoryUnitCreate(**data)
            with patch.object(InventoryUnit, 'validate'):
                await crud_instance.create_with_sku(
                    db_session,
                    unit_in=unit_in,
                    created_by=uuid4()
                )
        
        # Get available units
        available = await crud_instance.get_available_for_rental(
            db_session,
            item_id=item_id,
            location_id=location_id,
            quantity_needed=5
        )
        
        # Should only return 2 available units (not rented, not blocked)
        assert len(available) == 2
        assert all(unit.status == InventoryUnitStatus.AVAILABLE.value for unit in available)
        assert all(not unit.is_rental_blocked for unit in available)
        assert all(unit.is_active for unit in available)
    
    @pytest.mark.asyncio
    async def test_get_filtered_comprehensive(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        sample_unit_data
    ):
        """Test comprehensive filtering functionality."""
        item_id = uuid4()
        location_id = uuid4()
        supplier_id = uuid4()
        
        # Create diverse units
        units_data = [
            {
                **sample_unit_data,
                "item_id": item_id,
                "location_id": location_id,
                "supplier_id": supplier_id,
                "sku": "FILTER-001",
                "serial_number": "SN001",
                "status": InventoryUnitStatus.AVAILABLE,
                "condition": InventoryUnitCondition.EXCELLENT,
                "purchase_price": Decimal("100.00"),
                "is_rental_blocked": False,
                "warranty_expiry": datetime.now().date() + timedelta(days=100)
            },
            {
                **sample_unit_data,
                "item_id": item_id,
                "location_id": location_id,
                "supplier_id": supplier_id,
                "sku": "FILTER-002",
                "serial_number": "SN002",
                "status": InventoryUnitStatus.RENTED,
                "condition": InventoryUnitCondition.GOOD,
                "purchase_price": Decimal("200.00"),
                "is_rental_blocked": True,
                "warranty_expiry": datetime.now().date() - timedelta(days=10)  # Expired
            },
            {
                **sample_unit_data,
                "item_id": uuid4(),  # Different item
                "location_id": location_id,
                "supplier_id": supplier_id,
                "sku": "FILTER-003",
                "serial_number": "SN003",
                "status": InventoryUnitStatus.UNDER_REPAIR,
                "condition": InventoryUnitCondition.DAMAGED,
                "purchase_price": Decimal("150.00"),
                "next_maintenance_date": datetime.now() + timedelta(days=5)
            }
        ]
        
        # Create units
        for data in units_data:
            unit_in = InventoryUnitCreate(**data)
            with patch.object(InventoryUnit, 'validate'):
                await crud_instance.create_with_sku(
                    db_session,
                    unit_in=unit_in,
                    created_by=uuid4()
                )
        
        # Test item filter
        filter_params = InventoryUnitFilter(item_id=item_id)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 2
        assert all(unit.item_id == item_id for unit in filtered)
        
        # Test status filter
        filter_params = InventoryUnitFilter(status=InventoryUnitStatus.AVAILABLE)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 1
        assert filtered[0].status == InventoryUnitStatus.AVAILABLE.value
        
        # Test condition filter
        filter_params = InventoryUnitFilter(condition=InventoryUnitCondition.EXCELLENT)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 1
        assert filtered[0].condition == InventoryUnitCondition.EXCELLENT.value
        
        # Test serial number partial match
        filter_params = InventoryUnitFilter(serial_number="SN00")
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 3  # All have SN00X pattern
        
        # Test availability filter
        filter_params = InventoryUnitFilter(is_available=True)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 1  # Only one is available and not blocked
        
        # Test rental blocked filter
        filter_params = InventoryUnitFilter(is_rental_blocked=True)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 1
        assert filtered[0].is_rental_blocked
        
        # Test price range filter
        filter_params = InventoryUnitFilter(min_price=Decimal("150.00"), max_price=Decimal("250.00"))
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 2  # Units with prices 200.00 and 150.00
    
    # STATUS CHANGE TESTS
    
    @pytest.mark.asyncio
    async def test_change_status_to_rented(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test changing unit status to rented."""
        # Create available unit
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        # Mock the can_be_rented method
        with patch.object(unit, 'can_be_rented', return_value=True), \
             patch.object(unit, 'rent_out') as mock_rent_out:
            
            customer_id = uuid4()
            updated_by = uuid4()
            
            status_change = UnitStatusChange(
                status=InventoryUnitStatus.RENTED,
                customer_id=customer_id,
                notes="Rented to customer"
            )
            
            updated_unit = await crud_instance.change_status(
                db_session,
                unit_id=unit.id,
                status_change=status_change,
                updated_by=updated_by
            )
            
            mock_rent_out.assert_called_once_with(
                customer_id=customer_id,
                updated_by=updated_by
            )
            assert "Rented to customer" in updated_unit.notes
    
    @pytest.mark.asyncio
    async def test_change_status_rental_without_customer(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test renting unit without providing customer ID."""
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        with patch.object(unit, 'can_be_rented', return_value=True):
            status_change = UnitStatusChange(
                status=InventoryUnitStatus.RENTED
                # Missing customer_id
            )
            
            with pytest.raises(ValueError, match="Customer ID required for rental"):
                await crud_instance.change_status(
                    db_session,
                    unit_id=unit.id,
                    status_change=status_change,
                    updated_by=uuid4()
                )
    
    @pytest.mark.asyncio
    async def test_change_status_cannot_be_rented(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test renting unit that cannot be rented."""
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        with patch.object(unit, 'can_be_rented', return_value=False):
            status_change = UnitStatusChange(
                status=InventoryUnitStatus.RENTED,
                customer_id=uuid4()
            )
            
            with pytest.raises(ValueError, match="Unit cannot be rented in current state"):
                await crud_instance.change_status(
                    db_session,
                    unit_id=unit.id,
                    status_change=status_change,
                    updated_by=uuid4()
                )
    
    @pytest.mark.asyncio
    async def test_change_status_return_from_rent(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test returning unit from rent."""
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        # Set unit as rented
        unit.status = InventoryUnitStatus.RENTED.value
        
        with patch.object(unit, 'return_from_rent') as mock_return:
            status_change = UnitStatusChange(
                status=InventoryUnitStatus.AVAILABLE,
                new_condition=InventoryUnitCondition.GOOD
            )
            
            await crud_instance.change_status(
                db_session,
                unit_id=unit.id,
                status_change=status_change,
                updated_by=uuid4()
            )
            
            mock_return.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_change_status_complete_repair(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test completing repair and returning to available."""
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        # Set unit as under repair
        unit.status = InventoryUnitStatus.UNDER_REPAIR.value
        
        with patch.object(unit, 'complete_repair') as mock_complete:
            status_change = UnitStatusChange(
                status=InventoryUnitStatus.AVAILABLE,
                new_condition=InventoryUnitCondition.EXCELLENT
            )
            
            await crud_instance.change_status(
                db_session,
                unit_id=unit.id,
                status_change=status_change,
                updated_by=uuid4()
            )
            
            mock_complete.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_change_status_send_for_repair(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test sending unit for repair."""
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        with patch.object(unit, 'send_for_repair') as mock_send:
            status_change = UnitStatusChange(
                status=InventoryUnitStatus.UNDER_REPAIR,
                notes="Needs motor repair"
            )
            
            await crud_instance.change_status(
                db_session,
                unit_id=unit.id,
                status_change=status_change,
                updated_by=uuid4()
            )
            
            mock_send.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_change_status_mark_damaged(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test marking unit as damaged."""
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        with patch.object(unit, 'mark_as_damaged') as mock_damage:
            status_change = UnitStatusChange(
                status=InventoryUnitStatus.DAMAGED,
                notes="Water damage"
            )
            
            await crud_instance.change_status(
                db_session,
                unit_id=unit.id,
                status_change=status_change,
                updated_by=uuid4()
            )
            
            mock_damage.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_change_status_retire_unit(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test retiring unit."""
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        with patch.object(unit, 'retire') as mock_retire:
            status_change = UnitStatusChange(
                status=InventoryUnitStatus.RETIRED,
                reason="End of life"
            )
            
            await crud_instance.change_status(
                db_session,
                unit_id=unit.id,
                status_change=status_change,
                updated_by=uuid4()
            )
            
            mock_retire.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_change_status_unit_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit
    ):
        """Test status change for non-existent unit."""
        status_change = UnitStatusChange(status=InventoryUnitStatus.AVAILABLE)
        
        with pytest.raises(ValueError, match="Unit .* not found"):
            await crud_instance.change_status(
                db_session,
                unit_id=uuid4(),
                status_change=status_change,
                updated_by=uuid4()
            )
    
    # TRANSFER TESTS
    
    @pytest.mark.asyncio
    async def test_transfer_unit_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test successful unit transfer."""
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        new_location_id = uuid4()
        
        with patch.object(unit, 'transfer_to_location') as mock_transfer:
            transfer = UnitTransfer(
                new_location_id=new_location_id,
                notes="Transfer to warehouse B"
            )
            
            updated_unit = await crud_instance.transfer_unit(
                db_session,
                unit_id=unit.id,
                transfer=transfer,
                updated_by=uuid4()
            )
            
            mock_transfer.assert_called_once()
            assert "Transfer to warehouse B" in updated_unit.notes
    
    @pytest.mark.asyncio
    async def test_transfer_unit_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit
    ):
        """Test transfer for non-existent unit."""
        transfer = UnitTransfer(new_location_id=uuid4())
        
        with pytest.raises(ValueError, match="Unit .* not found"):
            await crud_instance.transfer_unit(
                db_session,
                unit_id=uuid4(),
                transfer=transfer,
                updated_by=uuid4()
            )
    
    # RENTAL BLOCKING TESTS
    
    @pytest.mark.asyncio
    async def test_block_rental_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test blocking unit from rental."""
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        with patch.object(unit, 'block_rental') as mock_block:
            rental_block = RentalBlock(
                block=True,
                reason="Maintenance required"
            )
            
            await crud_instance.block_rental(
                db_session,
                unit_id=unit.id,
                rental_block=rental_block,
                blocked_by=uuid4()
            )
            
            mock_block.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_unblock_rental_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test unblocking unit for rental."""
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        with patch.object(unit, 'unblock_rental') as mock_unblock:
            rental_block = RentalBlock(block=False)
            
            await crud_instance.block_rental(
                db_session,
                unit_id=unit.id,
                rental_block=rental_block,
                blocked_by=uuid4()
            )
            
            mock_unblock.assert_called_once()
    
    # MAINTENANCE TESTS
    
    @pytest.mark.asyncio
    async def test_schedule_maintenance(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        unit_create_schema: InventoryUnitCreate
    ):
        """Test scheduling maintenance for unit."""
        with patch.object(InventoryUnit, 'validate'):
            unit = await crud_instance.create_with_sku(
                db_session,
                unit_in=unit_create_schema,
                created_by=uuid4()
            )
        
        maintenance_date = datetime.now() + timedelta(days=30)
        
        with patch.object(unit, 'schedule_maintenance') as mock_schedule:
            schedule = MaintenanceSchedule(
                next_maintenance_date=maintenance_date,
                notes="Regular service"
            )
            
            updated_unit = await crud_instance.schedule_maintenance(
                db_session,
                unit_id=unit.id,
                schedule=schedule,
                updated_by=uuid4()
            )
            
            mock_schedule.assert_called_once()
            assert "Regular service" in updated_unit.notes
    
    @pytest.mark.asyncio
    async def test_get_maintenance_due(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        sample_unit_data
    ):
        """Test getting units with maintenance due."""
        location_id = uuid4()
        
        # Create units with different maintenance dates
        units_data = [
            {
                **sample_unit_data,
                "sku": "MAINT-DUE-001",
                "location_id": location_id,
                "next_maintenance_date": datetime.now() + timedelta(days=2),  # Due soon
                "is_active": True
            },
            {
                **sample_unit_data,
                "sku": "MAINT-DUE-002",
                "location_id": location_id,
                "next_maintenance_date": datetime.now() - timedelta(days=1),  # Overdue
                "is_active": True
            },
            {
                **sample_unit_data,
                "sku": "MAINT-FUTURE-001",
                "location_id": location_id,
                "next_maintenance_date": datetime.now() + timedelta(days=30),  # Future
                "is_active": True
            },
            {
                **sample_unit_data,
                "sku": "NO-MAINT-001",
                "location_id": location_id,
                "next_maintenance_date": None,  # No maintenance scheduled
                "is_active": True
            }
        ]
        
        # Create units
        for data in units_data:
            unit_in = InventoryUnitCreate(**data)
            with patch.object(InventoryUnit, 'validate'):
                await crud_instance.create_with_sku(
                    db_session,
                    unit_in=unit_in,
                    created_by=uuid4()
                )
        
        # Get maintenance due (7 days ahead)
        due_units = await crud_instance.get_maintenance_due(
            db_session,
            location_id=location_id,
            days_ahead=7
        )
        
        assert len(due_units) == 2  # Due soon and overdue
        assert all(unit.location_id == location_id for unit in due_units)
    
    @pytest.mark.asyncio
    async def test_get_expiring_warranties(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        sample_unit_data
    ):
        """Test getting units with expiring warranties."""
        current_date = datetime.now()
        
        # Create units with different warranty expiry dates
        units_data = [
            {
                **sample_unit_data,
                "sku": "WARRANTY-EXPIRING-001",
                "warranty_expiry": current_date.date() + timedelta(days=15),  # Expiring soon
            },
            {
                **sample_unit_data,
                "sku": "WARRANTY-EXPIRED-001",
                "warranty_expiry": current_date.date() - timedelta(days=5),  # Already expired
            },
            {
                **sample_unit_data,
                "sku": "WARRANTY-VALID-001",
                "warranty_expiry": current_date.date() + timedelta(days=365),  # Long valid
            },
            {
                **sample_unit_data,
                "sku": "NO-WARRANTY-001",
                "warranty_expiry": None,  # No warranty
            }
        ]
        
        # Create units
        for data in units_data:
            unit_in = InventoryUnitCreate(**data)
            with patch.object(InventoryUnit, 'validate'):
                await crud_instance.create_with_sku(
                    db_session,
                    unit_in=unit_in,
                    created_by=uuid4()
                )
        
        # Get expiring warranties (30 days ahead)
        expiring_units = await crud_instance.get_expiring_warranties(
            db_session,
            days_ahead=30
        )
        
        assert len(expiring_units) == 1  # Only the one expiring soon
        assert expiring_units[0].warranty_expiry > current_date.date()
    
    # UTILITY TESTS
    
    @pytest.mark.asyncio
    async def test_generate_sku(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit
    ):
        """Test SKU generation."""
        item_id = uuid4()
        
        # Mock item lookup
        with patch('app.crud.inventory.inventory_unit.select') as mock_select:
            mock_item = type('Item', (), {'sku': 'BASE-SKU'})()
            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_item
            mock_select.return_value = mock_result
            
            # Mock count query
            mock_count_result = AsyncMock()
            mock_count_result.scalar.return_value = 5
            
            with patch.object(db_session, 'execute', side_effect=[mock_result, mock_count_result, mock_count_result]):
                sku = await crud_instance.generate_sku(
                    db_session,
                    item_id=item_id
                )
            
            assert sku == "BASE-SKU-0006"
    
    @pytest.mark.asyncio
    async def test_generate_sku_with_suffix(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit
    ):
        """Test SKU generation with custom suffix."""
        item_id = uuid4()
        
        # Mock item lookup
        with patch('app.crud.inventory.inventory_unit.select') as mock_select:
            mock_item = type('Item', (), {'sku': 'BASE-SKU'})()
            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_item
            mock_select.return_value = mock_result
            
            # Mock uniqueness check
            mock_count_result = AsyncMock()
            mock_count_result.scalar.return_value = 0  # Unique
            
            with patch.object(db_session, 'execute', side_effect=[mock_result, mock_count_result]):
                sku = await crud_instance.generate_sku(
                    db_session,
                    item_id=item_id,
                    suffix="CUSTOM"
                )
            
            assert sku == "BASE-SKU-CUSTOM"
    
    @pytest.mark.asyncio
    async def test_generate_sku_item_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit
    ):
        """Test SKU generation with non-existent item."""
        item_id = uuid4()
        
        # Mock item lookup returning None
        with patch('app.crud.inventory.inventory_unit.select') as mock_select:
            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_select.return_value = mock_result
            
            with patch.object(db_session, 'execute', return_value=mock_result):
                with pytest.raises(ValueError, match="Item .* not found"):
                    await crud_instance.generate_sku(
                        db_session,
                        item_id=item_id
                    )
    
    @pytest.mark.asyncio
    async def test_generate_batch_code(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit
    ):
        """Test batch code generation."""
        item_id = uuid4()
        
        batch_code = await crud_instance.generate_batch_code(
            db_session,
            item_id=item_id
        )
        
        # Should follow format: BATCH-YYYYMMDD-XXXXXXXX
        assert batch_code.startswith("BATCH-")
        parts = batch_code.split("-")
        assert len(parts) == 3
        assert len(parts[1]) == 8  # YYYYMMDD
        assert len(parts[2]) == 8  # 8-char UUID suffix
    
    @pytest.mark.asyncio
    async def test_get_valuation_summary(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDInventoryUnit,
        sample_unit_data
    ):
        """Test valuation summary calculation."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Create units with different prices
        units_data = [
            {
                **sample_unit_data,
                "item_id": item_id,
                "location_id": location_id,
                "sku": "VAL-001",
                "purchase_price": Decimal("100.00"),
                "sale_price": Decimal("150.00"),
                "quantity": Decimal("1.00"),
                "is_active": True
            },
            {
                **sample_unit_data,
                "item_id": item_id,
                "location_id": location_id,
                "sku": "VAL-002",
                "purchase_price": Decimal("200.00"),
                "sale_price": None,  # No sale price
                "quantity": Decimal("2.00"),
                "is_active": True
            },
            {
                **sample_unit_data,
                "item_id": uuid4(),  # Different item
                "location_id": location_id,
                "sku": "VAL-003",
                "purchase_price": Decimal("50.00"),
                "sale_price": Decimal("75.00"),
                "quantity": Decimal("1.00"),
                "is_active": True
            }
        ]
        
        # Create units
        for data in units_data:
            unit_in = InventoryUnitCreate(**data)
            with patch.object(InventoryUnit, 'validate'):
                await crud_instance.create_with_sku(
                    db_session,
                    unit_in=unit_in,
                    created_by=uuid4()
                )
        
        # Get valuation for specific item
        summary = await crud_instance.get_valuation_summary(
            db_session,
            item_id=item_id
        )
        
        assert summary["total_units"] == 2
        assert summary["total_purchase_value"] == 500.0  # (100*1) + (200*2)
        assert summary["average_purchase_price"] == 150.0  # (100+200)/2
        # total_sale_value: (150*1) + (200*2) = 550 (use purchase price when sale price is None)
        assert summary["total_sale_value"] == 550.0


class TestInventoryUnitSingleton:
    """Test the singleton instance."""
    
    def test_singleton_instance(self):
        """Test that the singleton instance is properly configured."""
        assert inventory_unit is not None
        assert isinstance(inventory_unit, CRUDInventoryUnit)
        assert inventory_unit.model == InventoryUnit